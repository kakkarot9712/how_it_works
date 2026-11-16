#!/usr/bin/env node
// Screenshot a syswork page with headless Chrome over the DevTools protocol.
// Unlike `chrome --screenshot`, it can click (open menus), press keys, capture the
// full page, and emulate true phone widths (desktop Chrome won't go below ~500px).
//
//   node .claude/skills/verify-simulation/shot.mjs <url> <out.png> [options]
//     --size=1280x800     viewport (default 1280x800)
//     --click=<selector>  click an element first (e.g. '[aria-haspopup=listbox]')
//     --keys=A,B          then press keys (ArrowDown, Enter, Escape, ...)
//     --hover=<selector>  then move the mouse over an element (tooltips), scrolling it into view
//     --full              capture the whole page height
//     --scale=0.75        output scale (full-page shots get big)
//     --wait=4000         ms to wait after load (default 4000; the dev server compiles on first hit)
//
// Chrome: $CHROME, else google-chrome / chromium / macOS Chrome.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, out, ...rest] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: shot.mjs <url> <out.png> [--size=WxH] [--click=sel] [--keys=A,B] [--full] [--scale=n] [--wait=ms]");
  process.exit(2);
}
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const [w, h] = String(opt.size ?? "1280x800").split("x").map(Number);
const scale = Number(opt.scale ?? 1);

const chrome =
  process.env.CHROME ??
  ["google-chrome", "chromium", "chromium-browser"].find((c) => spawnSync("which", [c]).status === 0) ??
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
if (!chrome) throw new Error("No Chrome found; set $CHROME");

const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "shot-"));
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let tabs;
  for (let i = 0; i < 40 && !tabs; i++) {
    await sleep(150);
    tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json(), () => undefined);
  }
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = {};
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    pending[d.id]?.(d.result);
  };
  const send = (method, params = {}) => new Promise((r) => ((pending[++id] = r), ws.send(JSON.stringify({ id, method, params }))));
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.value;

  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await send("Page.navigate", { url });
  await sleep(Number(opt.wait ?? 4000));
  if (opt.click) {
    const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(opt.click)}); el?.click(); return !!el; })()`);
    if (!ok) console.error(`warning: nothing matched ${opt.click}`);
    await sleep(400);
  }
  for (const key of String(opt.keys ?? "").split(",").filter(Boolean)) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key });
    await sleep(200);
  }
  if (opt.hover) {
    const r = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(opt.hover)}); if (!el) return null; el.scrollIntoView({ block: "center" }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    if (!r) console.error(`warning: nothing matched ${opt.hover}`);
    else await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
    await sleep(300);
  }
  // Clip coordinates are document coordinates: a viewport shot starts at the current scroll.
  const height = opt.full ? await evaluate("document.documentElement.scrollHeight") : h;
  const top = opt.full ? 0 : await evaluate("window.scrollY");
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: Boolean(opt.full),
    clip: { x: 0, y: top, width: w, height, scale },
  });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(`${out} (${Math.round(w * scale)}×${Math.round(height * scale)})`);
} finally {
  proc.kill();
  await sleep(200);
  rmSync(profile, { recursive: true, force: true });
}

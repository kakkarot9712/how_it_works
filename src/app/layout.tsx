import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://syswork.vikalpg.in"),
  title: { default: "syswork: how systems actually work", template: "%s · syswork" },
  description:
    "Interactive, animated simulations of system internals: Redis, Kafka, load balancers, consensus, transactions. Break things and watch what happens.",
};

/**
 * Root layout. Headers live in the route groups: (site) pages get the site
 * header; (sim) pages get a compact bar (SimNav) so the simulator can use
 * the full height.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

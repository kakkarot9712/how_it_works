import { SiteHeader } from "@/components/site";

/** Marketing-style pages: home and topic lists. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}

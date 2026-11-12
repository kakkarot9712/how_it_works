import { SiteHeader } from "@/components/SiteHeader";

/** Marketing-style pages: home and topic lists. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}

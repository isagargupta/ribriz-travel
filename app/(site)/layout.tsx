import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CompareTray from "@/components/CompareTray";
import Assistant from "@/components/assistant/Assistant";
import { getPublishedTrips, toIndex } from "@/lib/trips";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const index = toIndex(await getPublishedTrips());
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header index={index} />
      <main id="main">{children}</main>
      <Footer />
      <CompareTray index={index} />
      <Assistant />
    </>
  );
}

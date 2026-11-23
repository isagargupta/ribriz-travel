import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CompareTray from "@/components/CompareTray";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const mini = await prisma.trip.findMany({ where: { published: true }, select: { id: true, dest: true, price: true, flight: true } });
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <CompareTray trips={mini} />
    </>
  );
}

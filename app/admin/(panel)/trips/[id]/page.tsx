import Link from "next/link";
import { notFound } from "next/navigation";
import TripForm from "@/components/admin/TripForm";
import { prisma } from "@/lib/db";
import { listImages } from "@/lib/images";
import { deleteTrip } from "../../../actions";

export default async function EditTrip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) notFound();
  return (
    <>
      <div className="admin-head">
        <h1>Edit trip</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn sm" href="/admin/trips">← All trips</Link>
          {trip.published && <Link className="btn sm" href={`/trips/${trip.slug}`} target="_blank">View on site ↗</Link>}
        </div>
      </div>
      <TripForm trip={trip} images={await listImages()} />
      <form action={deleteTrip} className="panel" style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input type="hidden" name="id" value={trip.id} />
        <span className="muted">Deleting removes the trip from the site. Past enquiries are kept. To hide it for now, untick “On sale” instead.</span>
        <button className="btn danger" type="submit">Delete trip permanently</button>
      </form>
    </>
  );
}

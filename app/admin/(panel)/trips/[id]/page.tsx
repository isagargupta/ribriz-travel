import Link from "next/link";
import { notFound } from "next/navigation";
import Departures from "@/components/admin/Departures";
import TripForm from "@/components/admin/TripForm";
import { prisma } from "@/lib/db";
import { listImages } from "@/lib/images";
import { deleteTrip } from "../../../actions";

export default async function EditTrip({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
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
      {sp.created && <div className="notice ok" style={{ marginBottom: 14 }}>Trip added with six months of departure dates. Adjust them below.</div>}
      <TripForm trip={trip} images={await listImages()} />
      <Departures tripId={trip.id} base={trip.price} kind={trip.kind} />
      <form action={deleteTrip} className="panel" style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input type="hidden" name="id" value={trip.id} />
        <span className="muted">Deleting removes the trip from the site. Past enquiries are kept. To hide it for now, untick “On sale” instead.</span>
        <button className="btn danger" type="submit">Delete trip permanently</button>
      </form>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import Departures from "@/components/admin/Departures";
import TripForm from "@/components/admin/TripForm";
import { prisma } from "@/lib/db";
import { listImages } from "@/lib/images";
import { copyTrip, deleteTrip } from "../../../actions";

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
      <form action={copyTrip} className="panel" style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input type="hidden" name="id" value={trip.id} />
        <div><b>Copy this trip</b><p className="muted" style={{ margin: 0, fontSize: 14 }}>Makes an unpublished draft with the same details, photos and itinerary, to adapt into a new trip.</p></div>
        <span style={{ display: "flex", gap: 10, alignItems: "center" }}><label className="chk" style={{ fontSize: 13 }}><input type="checkbox" name="dates" /> copy future dates too</label><button className="btn sm">Copy trip</button></span>
      </form>
      <form action={deleteTrip} className="panel" style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input type="hidden" name="id" value={trip.id} />
        <span className="muted">Deleting removes the trip from the site. Past enquiries are kept. To hide it for now, untick “On sale” instead.</span>
        <button className="btn danger" type="submit">Delete trip permanently</button>
      </form>
    </>
  );
}

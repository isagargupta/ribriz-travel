import Link from "next/link";
import TripForm from "@/components/admin/TripForm";
import { listImages } from "@/lib/images";

export default async function NewTrip() {
  return (
    <>
      <div className="admin-head"><h1>Add a trip</h1><Link className="btn sm" href="/admin/trips">← All trips</Link></div>
      <TripForm images={await listImages()} />
    </>
  );
}

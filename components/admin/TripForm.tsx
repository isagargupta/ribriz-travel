"use client";
import { useActionState, useState } from "react";
import { saveTrip } from "@/app/admin/actions";
import { BOARDS, KINDS, THEMES } from "@/lib/pricing";

export interface TripFormValues {
  id?: string; slug?: string; title?: string; dest?: string; country?: string; region?: string; kind?: string; themes?: string;
  nights?: number; stars?: number; board?: string; price?: number; was?: number | null; rating?: number; reviews?: number; beach?: number | null;
  flight?: boolean; freeCancel?: boolean; tourManager?: boolean; easyVisa?: boolean; lastMinute?: boolean; earlyBird?: boolean; featured?: boolean; published?: boolean;
  image?: string; highlights?: string; days?: string; countryCodes?: string; visaNote?: string | null;
}

const REGIONS = ["India", "South-East Asia", "East Asia", "Middle East", "Mediterranean", "Europe", "Indian Ocean", "Africa", "Americas", "Oceania"];
const EXTRA_THEMES = [{ key: "city", label: "City" }, { key: "luxury", label: "Luxury" }];

export default function TripForm({ trip = {}, images }: { trip?: TripFormValues; images: string[] }) {
  const [state, action, pending] = useActionState(saveTrip, undefined);
  const [image, setImage] = useState(trip.image ?? images[0] ?? "");
  const themes = (trip.themes ?? "").split(",");
  const flag = (k: keyof TripFormValues, label: string, dflt = false) => (
    <label><input type="checkbox" name={k} defaultChecked={(trip[k] as boolean | undefined) ?? dflt} /> {label}</label>
  );

  return (
    <form action={action} className="form-grid panel" encType="multipart/form-data">
      {trip.id && <input type="hidden" name="id" value={trip.id} />}
      <label className="full">Trip title<input name="title" required defaultValue={trip.title} placeholder="e.g. Kerala backwaters & Munnar tea hills" /></label>
      <label>Destination (short name)<input name="dest" required defaultValue={trip.dest} placeholder="Kerala" /></label>
      <label>Country / countries<input name="country" required defaultValue={trip.country} placeholder="India" /></label>
      <label>Region<select name="region" defaultValue={trip.region ?? "India"}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label>Trip type<select name="kind" defaultValue={trip.kind ?? "package"}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label>Nights<input name="nights" type="number" min={1} max={60} required defaultValue={trip.nights ?? 6} /></label>
      <label>Hotel stars<select name="stars" defaultValue={trip.stars ?? 4}>{[3, 4, 5].map((s) => <option key={s} value={s}>{s}★</option>)}</select></label>
      <label>Meal plan<select name="board" defaultValue={trip.board ?? "BB"}>{Object.entries(BOARDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label>Distance to beach in metres (blank if none)<input name="beach" type="number" min={0} defaultValue={trip.beach ?? ""} /></label>
      <label>Price per adult (₹, flights from Mumbai)<input name="price" type="number" min={1} required defaultValue={trip.price} /></label>
      <label>Old price to show crossed out (₹, optional)<input name="was" type="number" min={0} defaultValue={trip.was ?? ""} /></label>
      <label>Guest rating (0–10)<input name="rating" type="number" step="0.1" min={0} max={10} defaultValue={trip.rating ?? 9} /></label>
      <label>Number of reviews<input name="reviews" type="number" min={0} defaultValue={trip.reviews ?? 0} /></label>

      <fieldset className="full" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="lab" style={{ marginBottom: 6 }}>Travel styles</legend>
        <div className="checks">
          {[...THEMES.map((t) => ({ key: t.key, label: t.label })), ...EXTRA_THEMES].map((t) => (
            <label key={t.key}><input type="checkbox" name="themes" value={t.key} defaultChecked={themes.includes(t.key)} /> {t.label}</label>
          ))}
        </div>
      </fieldset>

      <fieldset className="full" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="lab" style={{ marginBottom: 6 }}>Included and labels</legend>
        <div className="checks">
          {flag("flight", "Flights included", true)}
          {flag("freeCancel", "Free cancellation", true)}
          {flag("tourManager", "Tour manager")}
          {flag("lastMinute", "Last-minute deal")}
          {flag("earlyBird", "Early-bird deal")}
          {flag("featured", "Show in Trending")}
          {flag("published", "On sale (visible on site)", true)}
        </div>
      </fieldset>

      <label>Countries visited (2-letter codes, comma-separated)<input name="countryCodes" defaultValue={trip.countryCodes} placeholder="e.g. CH,FR,IT or IN" pattern="^\s*[A-Za-z]{2}(\s*,\s*[A-Za-z]{2})*\s*$" title="Two-letter country codes such as IN, TH, AE, separated by commas" /></label>
      <label>Visa note for customers (optional)<input name="visaNote" defaultValue={trip.visaNote ?? ""} placeholder="e.g. Indians with a valid US visa get Turkey e-visa" /></label>
      <p className="full fine" style={{ marginTop: -6 }}>Visa info on the trip page comes from these countries automatically. The note appears above it when you need to add or correct something.</p>
      <label className="full">Highlights (one per line)<textarea name="highlights" required defaultValue={trip.highlights} placeholder={"Overnight private houseboat\nTea museum in Munnar"} /></label>
      <label className="full">Day-by-day plan (one line per day)<textarea name="days" required defaultValue={trip.days} style={{ minHeight: 180 }} placeholder={"Arrive Kochi, Fort Kochi walk\nDrive to Munnar"} /></label>

      <div className="full" style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 14, alignItems: "start" }}>
        {image ? <img src={image} alt="" style={{ width: 160, aspectRatio: "4/3", objectFit: "cover", borderRadius: 12 }} /> : <div className="empty" style={{ padding: 20 }}>No photo</div>}
        <div style={{ display: "grid", gap: 10 }}>
          <label>Photo<select name="image" value={image} onChange={(e) => setImage(e.target.value)}>
            {!images.includes(image) && image && <option value={image}>{image}</option>}
            {images.map((i) => <option key={i} value={i}>{i.split("/").pop()}</option>)}
          </select></label>
          <label>…or upload a new photo (JPG, PNG or WebP, under 5 MB)<input type="file" name="upload" accept="image/jpeg,image/png,image/webp" /></label>
        </div>
      </div>

      <label className="full">Web address (optional, made from the title if blank)<input name="slug" defaultValue={trip.slug} placeholder="kerala-backwaters-munnar-6n" /></label>

      {state?.error && <div className="notice err full">{state.error}</div>}
      <button className="btn hot full" type="submit" disabled={pending} style={{ padding: 14 }}>{pending ? "Saving…" : trip.id ? "Save changes" : "Add trip"}</button>
    </form>
  );
}

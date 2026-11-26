"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { usePrefs } from "../Prefs";
import type { VisaProductView } from "@/lib/visa-service";
import { deadlineCheck, visaPrice } from "@/lib/visa-service-rules";

const fmtDay = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Choose the visa, travellers and travel date; see the total and whether it'll be ready in time; then apply. */
export default function ApplyCard({ dest, products }: { dest: string; products: VisaProductView[] }) {
  const router = useRouter();
  const { money, adults } = usePrefs();
  const applicable = products.filter((p) => p.canApply);
  const [slug, setSlug] = useState(applicable[0]?.slug ?? "");
  const [n, setN] = useState(Math.max(1, Math.min(9, adults || 1)));
  const [date, setDate] = useState("");
  const p = applicable.find((x) => x.slug === slug);
  const price = useMemo(() => (p ? visaPrice(p, n) : null), [p, n]);
  const check = p && date ? deadlineCheck(p.readyBy, date) : null;
  if (!p || !price) return <div className="vz-apply"><b>Nothing to apply for</b><p className="muted">This entry is free on arrival. See the notes for what to carry.</p></div>;

  return (
    <div className="vz-apply" id="apply">
      {applicable.length > 1 && (
        <div className="vz-opts" role="radiogroup" aria-label="Visa type">
          {applicable.map((x) => (
            <label key={x.slug} className={x.slug === slug ? "on" : ""}>
              <input type="radio" name="visa" checked={x.slug === slug} onChange={() => setSlug(x.slug)} />
              <span><b>{x.name}</b><small>{x.stayDays ? `${x.stayDays}-day stay · ` : ""}{money(x.perPerson)}</small></span>
            </label>
          ))}
        </div>
      )}
      <div className="vz-row">
        <label>Travellers
          <span className="vz-step"><button type="button" onClick={() => setN(Math.max(1, n - 1))} aria-label="Fewer">−</button><b>{n}</b><button type="button" onClick={() => setN(Math.min(9, n + 1))} aria-label="More">+</button></span>
        </label>
        <label>Travel date<input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <div className={`vz-ready ${check ?? ""}`}>
        <span>Visa ready by</span><b>{fmtDay(p.readyBy)}</b>
        {check === "ok" && <small>✓ In good time for your trip</small>}
        {check === "tight" && <small>⚠ Close to your travel date: apply today</small>}
        {check === "late" && <small>✗ Usually takes longer than that. Ask Riya about faster options</small>}
        {p.needsAppointment && <small>Plus a visa-centre appointment for fingerprints</small>}
      </div>
      <table className="vz-price">
        <tbody>
          <tr><td>Government fee</td><td>{money(price.govt)} × {n}</td></tr>
          <tr><td>Ribriz service fee</td><td>{money(price.service)} × {n}</td></tr>
          <tr><td>GST 18% on service fee</td><td>{money(price.gst)} × {n}</td></tr>
          <tr className="tot"><td>Total</td><td>{money(price.total)}</td></tr>
        </tbody>
      </table>
      <button className="btn hot block lg" onClick={() => router.push(`/visa/${dest}/apply?p=${p.slug}&n=${n}${date ? `&d=${date}` : ""}`)}>Start application</button>
      <p className="fine center">Pay after you upload documents · Expert review before filing</p>
    </div>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePrefs } from "../Prefs";
import type { VisaProductView } from "@/lib/visa-service";
import { deadlineCheck, visaPrice } from "@/lib/visa-service-rules";
import { Icon, fmtDay } from "./ui";
import { useTween } from "./useTween";

/** Choose the visa, travellers and travel date; see the price and whether it'll be ready in time; start. */
export default function ApplyCard({ dest, products }: { dest: string; products: VisaProductView[] }) {
  const router = useRouter();
  const { money, adults } = usePrefs();
  const options = products.filter((p) => p.canApply);
  const [slug, setSlug] = useState(options[0]?.slug ?? "");
  const [n, setN] = useState(1);
  const [date, setDate] = useState("");
  useEffect(() => { setN(Math.max(1, Math.min(9, adults || 1))); }, [adults]);
  const p = options.find((x) => x.slug === slug);
  const price = useMemo(() => (p ? visaPrice(p, n) : null), [p, n]);
  const total = useTween(price?.total ?? 0);
  if (!p || !price) return null;
  const check = date ? deadlineCheck(p.readyBy, date) : null;

  return (
    <div className="vx-card-apply" id="apply">
      <h3>Apply for your visa</h3>
      {options.length > 1 && (
        <div className="vx-choice" role="radiogroup" aria-label="Visa type">
          {options.map((x) => (
            <label key={x.slug} className={x.slug === slug ? "on" : ""}>
              <input type="radio" name="visa" checked={x.slug === slug} onChange={() => setSlug(x.slug)} />
              <b>{x.name}</b><small>{x.stayDays ? `${x.stayDays}-day stay · ` : ""}{x.processingDays} working days</small>
              <strong>{money(x.perPerson)}{x.feeOnRequest ? "+" : ""}</strong>
            </label>
          ))}
        </div>
      )}
      <div className="vx-two vx-mini">
        <div>
          <label id="trav-l">Travellers</label>
          <div className="vx-counter" role="group" aria-labelledby="trav-l">
            <button type="button" onClick={() => setN(Math.max(1, n - 1))} disabled={n <= 1} aria-label="Fewer travellers">−</button>
            <b aria-live="polite">{n}</b>
            <button type="button" onClick={() => setN(Math.min(9, n + 1))} disabled={n >= 9} aria-label="More travellers">+</button>
          </div>
        </div>
        <div><label htmlFor="trav-date">Travel date</label><input id="trav-date" className="vx-date" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className={`vx-eta ${check ?? ""}`}>
        <span className="vx-ico"><Icon name="calendar" /></span>
        <div>
          <small>{check === "late" ? "Not in time" : check === "tight" ? "Cutting it close" : "Visa ready by"}</small>
          <b>{fmtDay(p.readyBy, true)}</b>
          <p>{check === "ok" ? "Comfortably before your trip." : check === "tight" ? "Only just in time: apply today." : check === "late" ? "Your date is before it would be ready. Ask Riya about faster options." : p.needsAppointment ? "Plus a visa-centre appointment we book for you." : "If you apply today."}</p>
        </div>
      </div>
      <div className="vx-break">
        <div><span>Government fee</span><span>{p.feeOnRequest ? <span className="tbc">Confirmed before you pay</span> : `${money(price.govt)} × ${n}`}</span></div>
        <div><span>Ribriz service fee</span><span>{money(price.service)} × {n}</span></div>
        <div><span>GST 18% on service fee</span><span>{money(price.gst)} × {n}</span></div>
        <div className="tot"><span>{p.feeOnRequest ? "Our fee (plus government fee)" : "Total"}</span><span>{money(total)}</span></div>
      </div>
      <button className="vx-btn primary block lg" onClick={() => router.push(`/visa/${dest}/apply?p=${p.slug}&n=${n}${date ? `&d=${date}` : ""}`)}>Start application <Icon name="arrow" size={18} /></button>
      <div className="vx-assure">
        <span><Icon name="check" /> Pay only after uploading documents</span>
        <span><Icon name="check" /> Instant AI check, expert review before filing</span>
        <span><Icon name="lock" /> Secure payment: UPI, cards, net banking</span>
      </div>
    </div>
  );
}

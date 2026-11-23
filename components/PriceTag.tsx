"use client";
import { BOARDS, fmtDate, quote } from "@/lib/pricing";
import { usePrefs } from "./Prefs";
import Money from "./ui/Money";

interface P {
  base: number; delta: number; flight: boolean; board: string; nights: number;
  was?: number | null; cheapestDate?: string | null; size?: "md" | "lg"; showWhy?: boolean;
}

/**
 * The one price display used on cards and tiles. Shows per adult or the party
 * total (visitor's choice), always says what the number covers, and explains
 * the maths in a popover.
 */
export default function PriceTag({ base, delta, flight, board, nights, was, cheapestDate, size = "md", showWhy = true }: P) {
  const { priceMode, from, adults, childAges } = usePrefs();
  const q = quote({ base, delta, flight, from, adults, childAges });
  const wasQ = was ? quote({ base: was, delta, flight, from, adults, childAges }) : null;
  const party = `${q.travellers} traveller${q.travellers > 1 ? "s" : ""}`;
  const big = priceMode === "total" ? q.total : q.perAdult;
  const wasBig = wasQ ? (priceMode === "total" ? wasQ.total : wasQ.perAdult) : null;

  return (
    <div className={`ptag ${size}`}>
      {wasBig && wasBig > big && <s className="was"><Money inr={wasBig} /></s>}
      <div className="ptag-main">
        <span className="ptag-from">from</span>
        <Money inr={big} className="price" />
        <span className="ptag-unit">{priceMode === "total" ? `total · ${party}` : "/ adult"}</span>
      </div>
      <div className="ptag-sub">
        {priceMode === "total"
          ? <>incl. 5% GST · <Money inr={q.perPerson} /> per person</>
          : <><Money inr={q.total} /> total for {party} incl. GST</>}
        {showWhy && (
          <details className="why" onClick={(e) => e.stopPropagation()}>
            <summary aria-label="What's in this price">i</summary>
            <div className="why-pop" role="note">
              <b>What&apos;s in this price</b>
              <ul>
                {flight && <li>Return flights from {from}</li>}
                <li>{nights} nights' stay, {BOARDS[board]?.toLowerCase() ?? board}</li>
                <li>Transfers and listed sightseeing</li>
              </ul>
              <table>
                <tbody>
                  {q.lines.map((l) => <tr key={l.label}><td>{l.label}<small>{l.detail}</small></td><td><Money inr={l.amount} /></td></tr>)}
                  <tr><td>GST 5%</td><td><Money inr={q.gst} /></td></tr>
                  <tr className="t"><td>Total</td><td><Money inr={q.total} /></td></tr>
                </tbody>
              </table>
              {cheapestDate && <p>Cheapest date: {fmtDate(cheapestDate)}. Other dates can cost more.</p>}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

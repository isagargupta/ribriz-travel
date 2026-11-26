import { fmtK, parseISO } from "@/lib/pricing";

type Dep = { date: string; priceDelta: number; seatsLeft: number | null; status: string; booked: number };

/** Month grids of a trip's departures: the adult price on each date, coloured from cheapest to dearest, closed dates struck out. */
export default function PriceCalendar({ base, deps }: { base: number; deps: Dep[] }) {
  const by = new Map(deps.map((d) => [d.date, d]));
  const months = [...new Set(deps.map((d) => d.date.slice(0, 7)))];
  const prices = deps.filter((d) => d.status === "open").map((d) => base + d.priceDelta).sort((a, b) => a - b);
  const lo = prices[Math.floor(prices.length / 3)] ?? 0, hi = prices[Math.floor((prices.length * 2) / 3)] ?? 0;
  return (
    <details className="pcal" open>
      <summary>Price calendar <span className="muted">(adult price per date; green cheapest third, amber dearest; ● has bookings)</span></summary>
      <div className="pcal-months">
        {months.map((m) => {
          const first = parseISO(m + "-01");
          const lead = (first.getDay() + 6) % 7;
          const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
          return (
            <div key={m} className="pcal-m">
              <b>{first.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</b>
              <div className="pcal-g">
                {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => <span key={i} className="pcal-w">{w}</span>)}
                {Array.from({ length: lead }, (_, i) => <span key={"x" + i} />)}
                {Array.from({ length: n }, (_, i) => {
                  const date = `${m}-${String(i + 1).padStart(2, "0")}`, d = by.get(date);
                  if (!d) return <span key={date} className="pcal-d off">{i + 1}</span>;
                  const p = base + d.priceDelta;
                  const tier = d.status !== "open" ? "closed" : p <= lo ? "lo" : p >= hi ? "hi" : "mid";
                  return <span key={date} className={`pcal-d ${tier}`} title={`${date}: ₹${p.toLocaleString("en-IN")}${d.seatsLeft !== null ? ` · ${d.seatsLeft} seats` : ""}${d.booked ? ` · ${d.booked} booking(s)` : ""}`}><i>{i + 1}{d.booked ? "●" : ""}</i>{fmtK(p)}</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

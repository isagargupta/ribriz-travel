import Link from "next/link";
import { funnel } from "@/lib/funnel";
import { fmt } from "@/lib/pricing";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "–");

/** Where visitors drop off, which sources and trips sell, and what people search for. */
export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const f = await funnel(days);
  const top = Math.max(1, f.steps[0].n);
  const maxDay = Math.max(1, ...f.daily.map((d) => d.sessions));

  return (
    <div>
      <div className="admin-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div><h1>Sales funnel</h1><p className="muted" style={{ margin: 0 }}>Anonymous visits (no cookies, nothing personal) joined with real holds and payments.</p></div>
        <div style={{ display: "flex", gap: 6 }}>{[7, 30, 90].map((d) => <Link key={d} className={`btn sm ${d === days ? "blue" : ""}`} href={`/admin/funnel?days=${d}`}>{d} days</Link>)}</div>
      </div>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="fn-steps">
          {f.steps.map((s, i) => (
            <div key={s.key} className="fn-step">
              <div className="fn-bar"><i style={{ width: `${Math.max(2, (s.n / top) * 100)}%` }} /></div>
              <b>{s.n.toLocaleString("en-IN")}</b><span>{s.label}</span>
              {i > 0 && <small className={f.steps[i - 1].n && s.n / f.steps[i - 1].n < 0.2 ? "warn-txt" : "muted"}>{pct(s.n, f.steps[i - 1].n)} of previous</small>}
            </div>
          ))}
        </div>
        <p className="muted" style={{ margin: "12px 0 0", fontSize: 13 }}>
          Revenue collected: <b>{fmt(f.revenue)}</b> · Holds made by Riya: <b>{f.holdsViaRiya}</b> · Visits that chatted with Riya: <b>{f.chatters}</b> ({pct(f.chatters, f.steps[0].n)}) · On mobile: <b>{Math.round(f.mobileShare * 100)}%</b>
        </p>
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Visits per day</h2>
        {f.daily.length === 0 ? <p className="muted">No visits recorded yet. Counting started with this update.</p> : (
          <div className="fn-days">{f.daily.map((d) => <i key={d.day} title={`${d.day}: ${d.sessions}`} style={{ height: `${(d.sessions / maxDay) * 100}%` }} />)}</div>
        )}
      </section>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))" }}>
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>By source</h2>
          <table className="admin-table" style={{ width: "100%", fontSize: 14 }}>
            <thead><tr><th>Source</th><th>Visits</th><th>Viewed trip</th><th>Started</th><th>Held</th><th>Paid</th></tr></thead>
            <tbody>{f.sources.map((s) => <tr key={s.source}><td>{s.source}</td><td>{s.sessions}</td><td>{s.tripViewers}</td><td>{s.holdStarters}</td><td>{s.holds}</td><td>{s.paid}</td></tr>)}</tbody>
          </table>
        </section>
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>What people search for</h2>
          {f.searches.length === 0 ? <p className="muted">No searches yet.</p> : (
            <table className="admin-table" style={{ width: "100%", fontSize: 14 }}><tbody>{f.searches.map((s) => <tr key={s.q}><td><a href={`/trips?q=${encodeURIComponent(s.q)}`} target="_blank" rel="noopener noreferrer">{s.q}</a></td><td style={{ textAlign: "right" }}>{s.n}</td></tr>)}</tbody></table>
          )}
          <p className="muted" style={{ fontSize: 12.5 }}>Places people search for that you don&apos;t sell are your next trips to add.</p>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>By trip</h2>
        <table className="admin-table" style={{ width: "100%", fontSize: 14 }}>
          <thead><tr><th>Trip</th><th>Viewers</th><th>Started booking</th><th>Held</th><th>Paid</th><th>View → hold</th><th>Revenue</th></tr></thead>
          <tbody>{f.trips.map((t) => <tr key={t.id}><td><a href={`/trips/${t.slug}`} target="_blank" rel="noopener noreferrer">{t.title}</a></td><td>{t.viewers}</td><td>{t.starters}</td><td>{t.holds}</td><td>{t.paid}</td><td className={t.viewers >= 30 && t.holds === 0 ? "warn-txt" : ""}>{pct(t.holds, t.viewers)}</td><td>{t.revenue ? fmt(t.revenue) : "–"}</td></tr>)}</tbody>
        </table>
        <p className="muted" style={{ fontSize: 12.5 }}>Trips in amber get plenty of views but no holds: check their price, dates and photos.</p>
      </section>
    </div>
  );
}

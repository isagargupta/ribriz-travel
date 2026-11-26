import { runChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

/** Every system the business depends on, checked live. The daily job emails the team when any fail. */
export default async function HealthPage() {
  const checks = await runChecks();
  const bad = checks.filter((c) => !c.ok);
  return (
    <div>
      <div className="admin-head"><h1>System health</h1><p className="muted" style={{ margin: 0 }}>{bad.length ? `${bad.length} problem${bad.length > 1 ? "s" : ""} found.` : "Everything is working."} Checked just now; the daily job emails the team about failures, and server errors are emailed as they happen.</p></div>
      <table className="admin-table" style={{ width: "100%", fontSize: 14 }}>
        <tbody>
          {checks.sort((a, b) => Number(a.ok) - Number(b.ok)).map((c) => (
            <tr key={c.name}>
              <td style={{ width: 28, fontSize: 18 }}>{c.ok ? "✅" : c.critical ? "🔴" : "🟠"}</td>
              <td><b>{c.name}</b></td>
              <td className={c.ok ? "muted" : "warn-txt"}>{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>Uptime: point a free monitor such as UptimeRobot at <code>https://www.ribriztravel.com/api/health</code> every 5 minutes; it answers 200 when the site and database are up.</p>
    </div>
  );
}

import { requireStaff } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { deleteSubscriber } from "../../actions";

export default async function Subscribers() {
  await requireStaff("reports");
  const list = await prisma.subscriber.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <div className="admin-head">
        <h1>Newsletter subscribers</h1>
        <a className="btn blue" href="/admin/subscribers/export">Download CSV</a>
      </div>
      {list.length === 0 ? <div className="empty">No subscribers yet. People join from the form at the bottom of the home page.</div> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Email</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td style={{ userSelect: "all" }}>{s.email}</td>
                  <td className="muted">{s.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
                  <td><form action={deleteSubscriber}><input type="hidden" name="id" value={s.id} /><button className="btn sm danger">Remove</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

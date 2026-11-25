import "server-only";
import { prisma } from "./db";
import { sendEmail, teamInbox } from "./email";
import { teamMessageEmail } from "./email-templates";
import { logEvent } from "./missions";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ribriztravel.com").replace(/\/$/, "");

export class MessageError extends Error {}

/** Moves a request out of "new" once the team has replied. */
async function markContacted(id: string) {
  await prisma.enquiry.updateMany({ where: { id, status: "new" }, data: { status: "contacted" } });
}

export async function sendTeamEmail(i: { enquiryId: string; subject: string; body: string; author: string; drafted: boolean }) {
  const subject = i.subject.trim().slice(0, 140), body = i.body.trim().slice(0, 8000);
  if (!subject || body.length < 10) throw new MessageError("Add a subject and a message.");
  const e = await prisma.enquiry.findUnique({ where: { id: i.enquiryId } });
  if (!e) throw new MessageError("Request not found.");
  const r = await sendEmail({
    to: e.email, replyTo: teamInbox()[0],
    ...teamMessageEmail({ subject, body, ref: e.ref, hubUrl: e.missionId ? `${site()}/hub/${e.missionId}` : null }),
  });
  if (!r.ok) throw new MessageError(`Email not sent: ${r.error}`);
  await prisma.teamMessage.create({ data: { enquiryId: e.id, channel: "email", subject, body, author: i.author, drafted: i.drafted } });
  await markContacted(e.id);
  if (e.missionId) await logEvent(e.missionId, "team", `Emailed you: “${subject}”`);
  const { pushToEmail } = await import("./push");
  await pushToEmail(e.email, { title: "New message from the Ribriz team", body: subject, url: e.missionId ? `/me/trips/${e.missionId}` : "/me", tag: `team-${e.ref}` });
}

/** Records a WhatsApp message the team opened from the inbox (sent from their own WhatsApp). */
export async function logWhatsApp(i: { enquiryId: string; body: string; author: string; drafted: boolean }) {
  const e = await prisma.enquiry.findUnique({ where: { id: i.enquiryId }, select: { id: true, missionId: true } });
  if (!e) throw new MessageError("Request not found.");
  await prisma.teamMessage.create({ data: { enquiryId: e.id, channel: "whatsapp", body: i.body.trim().slice(0, 4000), author: i.author, drafted: i.drafted } });
  await markContacted(e.id);
  if (e.missionId) await logEvent(e.missionId, "team", "Messaged you on WhatsApp.");
}

export async function addTeamNote(i: { enquiryId: string; body: string; author: string }) {
  if (!i.body.trim()) throw new MessageError("Write a note first.");
  await prisma.teamMessage.create({ data: { enquiryId: i.enquiryId, channel: "note", body: i.body.trim().slice(0, 4000), author: i.author } });
}

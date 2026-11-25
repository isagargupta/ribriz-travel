import "server-only";
import { prisma } from "../db";
import { purgeExpiredDocs } from "../documents";
import { syncVisaData } from "../visa-data";
import { runAgents } from "./run";
import { pushTripMornings } from "../live-push";

/**
 * Everything that runs once a day, in one scheduled call (Vercel's Hobby plan
 * allows daily crons only). Each part is isolated so one failure can't block the others.
 */
export async function daily(now = new Date()) {
  const part = async <T,>(name: string, f: () => Promise<T>) => {
    try { return { [name]: await f() }; } catch (e) { console.error(`daily ${name} failed`, e); return { [name]: { error: (e as Error).message } }; }
  };
  const cleanup = await part("cleanup", async () => ({
    docsDeleted: await purgeExpiredDocs(),
    approvalsExpired: (await prisma.approval.updateMany({ where: { status: "pending", expiresAt: { lt: now } }, data: { status: "expired" } })).count,
    optionsExpired: (await prisma.serviceOffer.updateMany({ where: { status: "offered", validUntil: { lt: now } }, data: { status: "expired" } })).count,
    oldCodesDeleted: (await prisma.loginCode.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 7 * 864e5) } } })).count,
    oldRunsDeleted: (await prisma.agentRun.deleteMany({ where: { startedAt: { lt: new Date(now.getTime() - 90 * 864e5) } } })).count,
  }));
  // visa rules change slowly: refresh weekly, on Mondays
  const visa = now.getUTCDay() === 1 ? await part("visaSync", () => syncVisaData()) : {};
  const agents = await part("agents", () => runAgents());
  const mornings = await part("tripMornings", () => pushTripMornings());
  return { ...cleanup, ...visa, ...agents, ...mornings };
}

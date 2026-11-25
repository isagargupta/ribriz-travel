// How much Riya (Claude) can be used per day. Each message is a paid API call,
// so these caps bound the bill even if someone scripts the chat.
// Override on Vercel with the environment variables named below.
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

export const RIYA_LIMITS = {
  /** messages a signed-in traveller can send per day */
  signedIn: num(process.env.RIYA_DAILY_SIGNED_IN, 150),
  /** messages per day for a visitor who hasn't signed in (per browser) */
  guest: num(process.env.RIYA_DAILY_GUEST, 40),
  /** messages per day from one network (IP address), however many browsers */
  network: num(process.env.RIYA_DAILY_PER_IP, 300),
  /** messages per day across the whole site: the bill's ceiling */
  site: num(process.env.RIYA_DAILY_MAX, 20000),
};

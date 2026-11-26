// WhatsApp helpers. Pure (no server imports), so they're unit-tested.

/**
 * A phone number in WhatsApp's format (country code + number, digits only).
 * Indian 10-digit mobiles get 91 in front; numbers starting 0 lose it.
 */
export function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = "91" + d.slice(1);
  else if (d.length === 10 && /^[6-9]/.test(d)) d = "91" + d;
  if (d.startsWith("91") && !/^91[6-9]\d{9}$/.test(d)) return null; // not an Indian mobile
  return /^\d{10,15}$/.test(d) ? d : null;
}

/** WhatsApp template text parameters can't contain new lines, tabs or more than 4 spaces in a row. */
export const waParam = (s: string, max = 900) => s.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, max);

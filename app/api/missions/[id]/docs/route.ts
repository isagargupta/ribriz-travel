import { NextResponse } from "next/server";
import { UploadError, uploadDoc, visaChecklist } from "@/lib/documents";
import { clientIp, fail, rateLimited } from "@/lib/http";
import { getOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The visa document checklist for a trip. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await visaChecklist(await getOwner(), (await params).id);
  return c ? NextResponse.json(c, { headers: { "Cache-Control": "private, no-store" } }) : fail("Not found.", 404);
}

/** Upload one document (multipart: file, optional kind). It's checked by AI before this returns. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (rateLimited("upload:" + clientIp(req), 30)) return fail("Too many uploads. Please wait a few minutes.", 429);
  const { id } = await params;
  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Upload a file."); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a file to upload.");
  try {
    const r = await uploadDoc(await getOwner(), id, file, typeof form.get("kind") === "string" ? String(form.get("kind")) : null);
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message);
    console.error("upload failed", e);
    return fail("The upload didn't go through. Please try again.", 500);
  }
}

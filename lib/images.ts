import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { PHOTO_BUCKET, supabaseAdmin } from "./supabase";

/** Photos available in the admin trip form: bundled ones plus uploads in Supabase Storage. */
export async function listImages(): Promise<string[]> {
  let bundled: string[] = [];
  try {
    bundled = (await readdir(path.join(process.cwd(), "public", "img")))
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !/^(logo|hero)/.test(f))
      .map((f) => "/img/" + f);
  } catch { /* folder missing in some hosts */ }

  const uploads: string[] = [];
  const sb = supabaseAdmin();
  if (sb) {
    const bucket = sb.storage.from(PHOTO_BUCKET);
    const { data: folders } = await bucket.list("", { limit: 100 });
    for (const f of folders ?? []) {
      if (f.id) continue; // a file at the root; uploads live in month folders
      const { data: files } = await bucket.list(f.name, { limit: 500, sortBy: { column: "created_at", order: "desc" } });
      for (const file of files ?? []) uploads.push(bucket.getPublicUrl(`${f.name}/${file.name}`).data.publicUrl);
    }
  }
  return [...uploads, ...bundled.sort()];
}

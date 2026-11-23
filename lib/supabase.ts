import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client with the secret key, for Storage.
 * All table reads and writes go through Prisma (lib/db.ts); the tables are
 * locked with row-level security so the public API key cannot read them.
 */
let admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export const PHOTO_BUCKET = "trip-photos";

/** Upload a photo to Supabase Storage and return its public URL. Creates the bucket on first use. */
export async function uploadPhoto(name: string, body: Buffer, contentType: string): Promise<string> {
  const sb = supabaseAdmin();
  if (!sb) throw new Error("Photo uploads need SUPABASE_SECRET_KEY in .env.");
  let { error } = await sb.storage.from(PHOTO_BUCKET).upload(name, body, { contentType, cacheControl: "31536000", upsert: false });
  if (error && /not found/i.test(error.message)) {
    const created = await sb.storage.createBucket(PHOTO_BUCKET, { public: true, fileSizeLimit: "5MB", allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] });
    if (created.error && !/already exists/i.test(created.error.message)) throw new Error(created.error.message);
    ({ error } = await sb.storage.from(PHOTO_BUCKET).upload(name, body, { contentType, cacheControl: "31536000", upsert: false }));
  }
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return sb.storage.from(PHOTO_BUCKET).getPublicUrl(name).data.publicUrl;
}

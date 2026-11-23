/**
 * Shrinks large phone photos in the browser before upload (max 2400 px, JPEG),
 * which keeps uploads fast and under the 5 MB image limit. PDFs pass through.
 */
export async function prepareUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || (file.size < 1.5 * 1024 * 1024 && file.type !== "image/heic")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // browser couldn't decode it (e.g. HEIC on some browsers); the server will say if it's unsupported
  }
}

export async function uploadToMission(missionId: string, file: File, kind?: string) {
  const body = new FormData();
  body.append("file", await prepareUpload(file));
  if (kind) body.append("kind", kind);
  const r = await fetch(`/api/missions/${missionId}/docs`, { method: "POST", body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Upload failed. Please try again.");
  return j as { doc: { id: string; kind: string; label: string; status: string; findings: string[] } };
}

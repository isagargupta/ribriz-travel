import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";

/** Photos available to pick in the admin trip form: bundled ones plus uploads. */
export async function listImages() {
  const read = async (dir: string, prefix: string) => {
    try {
      return (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => prefix + f);
    } catch { return []; }
  };
  const bundled = (await read(path.join(process.cwd(), "public", "img"), "/img/"))
    .filter((f) => !/\/(logo|hero)/.test(f));
  const uploads = await read(path.join(process.cwd(), "uploads"), "/api/uploads/");
  return [...bundled, ...uploads].sort();
}

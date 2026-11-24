// Wandelt Originalbilder in web-taugliche WebP-Dateien um.
//
//   originals/<prompt-id>/<model-id>.png|jpg|jpeg|webp
//     → public/images/<prompt-id>/<model-id>.webp     (max. 1600 px)
//     → public/images/<prompt-id>/<model-id>-sm.webp  (max. 640 px, Vorschau)
//
// Aufruf: npm run images            (nur neue/geänderte Bilder)
//         npm run images -- --force (alles neu)
import { readdir, stat, mkdir, readFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const SRC = 'originals';
const OUT = 'public/images';
const SIZES = [
  { suffix: '', max: 1600, quality: 82 },
  { suffix: '-sm', max: 640, quality: 74 },
];
const force = process.argv.includes('--force');
const exists = (p) => stat(p).then(() => true, () => false);

let done = 0, skipped = 0;
for (const pid of await readdir(SRC).catch(() => [])) {
  const dir = join(SRC, pid);
  if (!(await stat(dir)).isDirectory()) continue;
  await mkdir(join(OUT, pid), { recursive: true });
  for (const file of await readdir(dir)) {
    const { name, ext } = parse(file);
    if (!/^\.(png|jpe?g|webp)$/i.test(ext)) continue;
    const input = join(dir, file);
    const srcTime = (await stat(input)).mtimeMs;
    for (const s of SIZES) {
      const out = join(OUT, pid, `${name}${s.suffix}.webp`);
      if (!force && (await exists(out)) && (await stat(out)).mtimeMs >= srcTime) { skipped++; continue; }
      await sharp(input).rotate()
        .resize({ width: s.max, height: s.max, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: s.quality, effort: 5 })
        .toFile(out);
      done++;
      console.log('✓', out);
    }
  }
}

// Kontrolle: Passt gallery.json zu den Bildern?
const data = JSON.parse(await readFile('public/data/gallery.json', 'utf8'));
const modelIds = new Set(data.models.map((m) => m.id));
let problems = 0;
for (const p of data.prompts) {
  for (const mid of p.images) {
    if (!modelIds.has(mid)) { console.warn(`! ${p.id}: Modell "${mid}" fehlt in "models"`); problems++; }
    for (const s of SIZES) {
      const f = join(OUT, p.id, `${mid}${s.suffix}.webp`);
      if (!(await exists(f))) { console.warn(`! fehlt: ${f}`); problems++; }
    }
  }
}
console.log(`\n${done} erzeugt, ${skipped} unverändert, ${problems} Probleme.`);
process.exitCode = problems ? 1 : 0;

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ?? path.resolve(process.env.HOME ?? '', 'Downloads/LOGO_PGT.png');
const OUT = path.resolve(__dirname, '..', 'apps/web/public');

// Source is 595x841. Crop to the centered circular badge.
// Badge center is approx horizontal center, slightly above vertical center.
const CROP = { left: 40, top: 120, width: 515, height: 515 };
const PGT_BLACK = { r: 10, g: 10, b: 10, alpha: 1 };

async function main() {
  // Verify source exists and log metadata
  const meta = await sharp(SRC).metadata();
  console.log(`Source: ${SRC}`);
  console.log(`Metadata: ${meta.width}x${meta.height}, format=${meta.format}, channels=${meta.channels}`);

  // Validate crop bounds
  if (
    CROP.left + CROP.width > meta.width ||
    CROP.top + CROP.height > meta.height
  ) {
    throw new Error(
      `CROP out of bounds: image is ${meta.width}x${meta.height}, crop is ${JSON.stringify(CROP)}`,
    );
  }

  const base = sharp(SRC).extract(CROP);

  const sizes = [
    { name: 'pwa-192.png', size: 192 },
    { name: 'pwa-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180, flatten: true },
  ];

  for (const { name, size, flatten } of sizes) {
    let pipe = base.clone().resize(size, size, { fit: 'contain', background: PGT_BLACK });
    if (flatten) {
      pipe = pipe.flatten({ background: PGT_BLACK });
    }
    await pipe.png().toFile(path.join(OUT, name));
    console.log('wrote', name);
  }

  // Maskable: 512 canvas with badge scaled to ~70% (~360px) for the safe zone
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: PGT_BLACK },
  })
    .composite([
      {
        input: await base.clone().resize(360, 360).png().toBuffer(),
        gravity: 'center',
      },
    ])
    .png()
    .toFile(path.join(OUT, 'pwa-maskable-512.png'));
  console.log('wrote pwa-maskable-512.png');

  console.log('\nDone. All icons written to:', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

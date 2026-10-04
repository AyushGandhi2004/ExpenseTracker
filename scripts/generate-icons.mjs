// Generates the PWA / home-screen icons into public/icons. Run: node scripts/generate-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { ImageResponse } from "next/dist/compiled/@vercel/og/index.node.js";

const OUT = new URL("../public/icons/", import.meta.url);

/** A ₹ mark on a dark rounded tile. `maskable` keeps the glyph inside the 80% safe zone. */
function icon(size, { maskable = false, rounded = true } = {}) {
  const glyph = Math.round(size * (maskable ? 0.42 : 0.56));
  return new ImageResponse(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
          color: "#ffffff",
          fontSize: glyph,
          fontWeight: 600,
          borderRadius: rounded && !maskable ? Math.round(size * 0.22) : 0,
        },
        children: "₹",
      },
    },
    { width: size, height: size },
  );
}

const targets = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-512.png", 512, { maskable: true }],
  // iOS applies its own rounding; give it a full-bleed square.
  ["apple-touch-icon.png", 180, { rounded: false }],
];

await mkdir(OUT, { recursive: true });
for (const [name, size, opts] of targets) {
  const png = Buffer.from(await icon(size, opts).arrayBuffer());
  await writeFile(new URL(name, OUT), png);
  console.log(`wrote public/icons/${name} (${png.length} bytes)`);
}

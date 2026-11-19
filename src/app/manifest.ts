import type { MetadataRoute } from "next";
import { assetPath } from "@/lib/asset-path";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "21 Games",
    short_name: "21 Games",
    description:
      "Play 9 original daily word, logic, and spatial puzzles in the 21 → 1 countdown by SOL Theory — 21 Things, 17 Syllables, 9 Rhymes, Eightfold Echo, 6 Pics, Connect 5, Four Score, Move Two, and 1 Win.",
    start_url: "/",
    display: "standalone",
    background_color: "#FCFCFD",
    theme_color: "#FCFCFD",
    icons: [
      {
        src: assetPath("/favicon.svg"),
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: assetPath("/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: assetPath("/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: assetPath("/apple-touch-icon.png"),
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

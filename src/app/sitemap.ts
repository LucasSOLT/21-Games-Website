import type { MetadataRoute } from "next";
import { ALL_GAMES } from "@/lib/games-config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: "https://21games.ai/",
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  for (const game of ALL_GAMES) {
    entries.push({
      url: `https://21games.ai/games/${game.slug}`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    });
    entries.push({
      url: `https://21games.ai/games/${game.slug}/archive`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  return entries;
}

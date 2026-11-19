import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameArchiveView } from "@/components/game-archive";
import {
  ALL_GAMES,
  getPlayableGameSlugs,
  isPlayableGameSlug,
} from "@/lib/games-config";

export function generateStaticParams() {
  return getPlayableGameSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = ALL_GAMES.find((entry) => entry.slug === slug);
  if (!game) {
    return {
      title: "Archive",
    };
  }

  const description = `Browse and replay past daily puzzles in the ${game.name} archive on 21 Games.`;
  return {
    title: `${game.name} Archive`,
    description,
    alternates: {
      canonical: `/games/${slug}/archive`,
    },
    openGraph: {
      title: `${game.name} Archive · 21 Games`,
      description,
      url: `https://21games.ai/games/${slug}/archive`,
      siteName: "21 Games",
      images: [
        {
          url: `/og/${slug}.png`,
          width: 1200,
          height: 630,
          alt: `${game.name} · 21 Games`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${game.name} Archive · 21 Games`,
      description,
      images: [`/og/${slug}.png`],
    },
  };
}

export default async function GameArchivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isPlayableGameSlug(slug)) {
    notFound();
  }
  return <GameArchiveView gameSlug={slug} />;
}

import React from "react";
import { notFound } from "next/navigation";
import { GameArchiveView } from "@/components/game-archive";
import { getPlayableGameSlugs, isPlayableGameSlug } from "@/lib/games-config";

export function generateStaticParams() {
  return getPlayableGameSlugs().map((slug) => ({ slug }));
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

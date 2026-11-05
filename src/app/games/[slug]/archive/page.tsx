import React from "react";
import { notFound } from "next/navigation";
import { GameArchiveView } from "@/components/game-archive";
import { isPlayableGameSlug } from "@/lib/games-config";

export function generateStaticParams() {
  return [{ slug: "21-things" }, { slug: "connect-5" }];
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

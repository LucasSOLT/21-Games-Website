import React, { Suspense } from "react";
import { NineRhymesGame } from "@/components/games/nine-rhymes";
import { GameErrorBoundary } from "@/components/game-error-boundary";

export const metadata = {
  title: "9 Rhymes | SOL GaMES",
  description:
    "Text with Nine to solve 9 daily perfect-rhyme clues in an iMessage-style chat.",
};

export default function NineRhymesPage() {
  return (
    <GameErrorBoundary gameSlug="9-rhymes" gameTitle="9 Rhymes">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
            Loading 9 Rhymes...
          </div>
        }
      >
        <NineRhymesGame />
      </Suspense>
    </GameErrorBoundary>
  );
}

import React, { Suspense } from "react";
import { FourScoreGame } from "@/components/games/four-score";
import { GameErrorBoundary } from "@/components/game-error-boundary";

export const metadata = {
  title: "Four Score | SOL GaMES",
  description:
    "Combine every number tile and operator badge on the board to hit the exact target of 80.",
};

export default function FourScorePage() {
  return (
    <GameErrorBoundary gameSlug="four-score" gameTitle="Four Score">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
            Loading Four Score...
          </div>
        }
      >
        <FourScoreGame />
      </Suspense>
    </GameErrorBoundary>
  );
}

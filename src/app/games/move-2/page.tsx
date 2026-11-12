import React, { Suspense } from "react";
import { MoveTwoGame } from "@/components/games/move-two";
import { GameErrorBoundary } from "@/components/game-error-boundary";

export const metadata = {
  title: "Move Two | SOL GaMES",
  description:
    "Roll the 1×1×2 domino across 6 3×3 cube faces to land on the Red Target in minimum moves.",
};

export default function MoveTwoPage() {
  return (
    <GameErrorBoundary gameSlug="move-2" gameTitle="Move Two">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
            Loading Move Two...
          </div>
        }
      >
        <MoveTwoGame />
      </Suspense>
    </GameErrorBoundary>
  );
}

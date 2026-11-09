import React, { Suspense } from "react";
import { TwentyOneThingsGame } from "@/components/games/twenty-one-things";
import { GameErrorBoundary } from "@/components/game-error-boundary";

export const metadata = {
  title: "21 Things | SOL GaMES",
  description:
    "Curate 21 things you appreciate and narrow down 21 → 6 → 3 → 1 to what resonates most.",
};

export default function TwentyOneThingsPage() {
  return (
    <GameErrorBoundary gameSlug="21-things" gameTitle="21 Things">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
            Loading 21 Things...
          </div>
        }
      >
        <TwentyOneThingsGame />
      </Suspense>
    </GameErrorBoundary>
  );
}


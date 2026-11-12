import React, { Suspense } from "react";
import { SixPicsGame } from "@/components/games/six-pics";
import { GameErrorBoundary } from "@/components/game-error-boundary";

export const metadata = {
  title: "6 Pics | SOL GaMES",
  description:
    "Deduce the overarching secret theme connecting six progressive visual clues.",
};

export default function SixPicsPage() {
  return (
    <GameErrorBoundary gameSlug="6-pics" gameTitle="6 Pics">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
            Loading 6 Pics...
          </div>
        }
      >
        <SixPicsGame />
      </Suspense>
    </GameErrorBoundary>
  );
}

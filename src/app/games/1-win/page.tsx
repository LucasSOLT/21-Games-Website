import React, { Suspense } from "react";
import { OneWinGame } from "@/components/games/one-win";
import { GameErrorBoundary } from "@/components/game-error-boundary";

export const metadata = {
  title: "1 Win | SOL GaMES",
  description:
    "Share 1 win from your day in 1–4 words and see how many players around the world share it.",
};

export default function OneWinPage() {
  return (
    <GameErrorBoundary gameSlug="1-win" gameTitle="1 Win">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#FCFCFD] font-headline font-bold text-sm text-gray-500">
            Loading 1 Win...
          </div>
        }
      >
        <OneWinGame />
      </Suspense>
    </GameErrorBoundary>
  );
}

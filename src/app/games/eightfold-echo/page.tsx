import React, { Suspense } from "react";
import { EightfoldEchoGame } from "@/components/games/eightfold-echo";
import { GameErrorBoundary } from "@/components/game-error-boundary";

export const metadata = {
  title: "Eightfold Echo | SOL GaMES",
  description:
    "Follow single-attribute visual logic rules from the emerald center across all 9 shape tiles.",
};

export default function EightfoldEchoPage() {
  return (
    <GameErrorBoundary gameSlug="eightfold-echo" gameTitle="Eightfold Echo">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
            Loading Eightfold Echo...
          </div>
        }
      >
        <EightfoldEchoGame />
      </Suspense>
    </GameErrorBoundary>
  );
}

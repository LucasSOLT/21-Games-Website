import React, { Suspense } from "react";
import { SeventeenSyllablesGame } from "@/components/games/seventeen-syllables";
import { GameErrorBoundary } from "@/components/game-error-boundary";

export const metadata = {
  title: "17 Syllables | SOL GaMES",
  description:
    "Reconstruct the daily 5-7-5 haiku from poetical fragments in an authentic NYT-style word puzzle.",
};

export default function SeventeenSyllablesPage() {
  return (
    <GameErrorBoundary
      gameSlug={"17-syllables" as unknown as "21-things"}
      gameTitle="17 Syllables"
      storageKeysToReset={["solgames_v1_17s_progress"]}
    >
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
            Loading 17 Syllables...
          </div>
        }
      >
        <SeventeenSyllablesGame />
      </Suspense>
    </GameErrorBoundary>
  );
}

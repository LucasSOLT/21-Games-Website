import React, { Suspense } from "react";
import type { Metadata } from "next";
import { SeventeenSyllablesGame } from "@/components/games/seventeen-syllables";
import { GameErrorBoundary } from "@/components/game-error-boundary";

const DESCRIPTION =
  "Reconstruct the daily 5-7-5 haiku from poetical fragments in an authentic editorial word puzzle.";

export const metadata: Metadata = {
  title: "17 Syllables",
  description: DESCRIPTION,
  alternates: {
    canonical: "/games/17-syllables",
  },
  openGraph: {
    title: "17 Syllables · 21 Games",
    description: DESCRIPTION,
    url: "https://21games.ai/games/17-syllables",
    siteName: "21 Games",
    images: [
      {
        url: "/og/17-syllables.png",
        width: 1200,
        height: 630,
        alt: "17 Syllables · 21 Games",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "17 Syllables · 21 Games",
    description: DESCRIPTION,
    images: ["/og/17-syllables.png"],
  },
};

export default function SeventeenSyllablesPage() {
  return (
    <GameErrorBoundary
      gameSlug="17-syllables"
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

import React, { Suspense } from "react";
import type { Metadata } from "next";
import { FourScoreGame } from "@/components/games/four-score";
import { GameErrorBoundary } from "@/components/game-error-boundary";

const DESCRIPTION =
  "Combine every number tile and operator badge on the board to hit the exact target of 80.";

export const metadata: Metadata = {
  title: "Four Score",
  description: DESCRIPTION,
  alternates: {
    canonical: "/games/four-score",
  },
  openGraph: {
    title: "Four Score · 21 Games",
    description: DESCRIPTION,
    url: "https://21games.ai/games/four-score",
    siteName: "21 Games",
    images: [
      {
        url: "/og/four-score.png",
        width: 1200,
        height: 630,
        alt: "Four Score · 21 Games",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Four Score · 21 Games",
    description: DESCRIPTION,
    images: ["/og/four-score.png"],
  },
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

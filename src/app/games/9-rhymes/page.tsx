import React, { Suspense } from "react";
import type { Metadata } from "next";
import { NineRhymesGame } from "@/components/games/nine-rhymes";
import { GameErrorBoundary } from "@/components/game-error-boundary";

const DESCRIPTION =
  "Text with Nine to solve 9 daily perfect-rhyme clues in an iMessage-style chat.";

export const metadata: Metadata = {
  title: "9 Rhymes",
  description: DESCRIPTION,
  alternates: {
    canonical: "/games/9-rhymes",
  },
  openGraph: {
    title: "9 Rhymes · 21 Games",
    description: DESCRIPTION,
    url: "https://21games.ai/games/9-rhymes",
    siteName: "21 Games",
    images: [
      {
        url: "/og/9-rhymes.png",
        width: 1200,
        height: 630,
        alt: "9 Rhymes · 21 Games",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "9 Rhymes · 21 Games",
    description: DESCRIPTION,
    images: ["/og/9-rhymes.png"],
  },
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

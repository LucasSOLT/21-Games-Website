import React, { Suspense } from "react";
import type { Metadata } from "next";
import { MoveTwoGame } from "@/components/games/move-two";
import { GameErrorBoundary } from "@/components/game-error-boundary";

const DESCRIPTION =
  "Roll the 3D 2×1×1 block across floating Bloxorz-style islands (Easy 8×8, Medium 9×9, Hard 10×10), activate switches and bridges, avoid Red Obstacles completely, and stand upright into the Emerald Goal Hole.";

export const metadata: Metadata = {
  title: "Move Two",
  description: DESCRIPTION,
  alternates: {
    canonical: "/games/move-2",
  },
  openGraph: {
    title: "Move Two · 21 Games",
    description: DESCRIPTION,
    url: "https://21games.ai/games/move-2",
    siteName: "21 Games",
    images: [
      {
        url: "/og/move-2.png",
        width: 1200,
        height: 630,
        alt: "Move Two · 21 Games",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Move Two · 21 Games",
    description: DESCRIPTION,
    images: ["/og/move-2.png"],
  },
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

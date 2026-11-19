import React, { Suspense } from "react";
import type { Metadata } from "next";
import { SixPicsGame } from "@/components/games/six-pics";
import { GameErrorBoundary } from "@/components/game-error-boundary";

const DESCRIPTION =
  "See today's upfront theme and identify 6 hidden jigsaw-covered images — click fewer puzzle pieces before guessing each word to score up to 36 points.";

export const metadata: Metadata = {
  title: "6 Pics",
  description: DESCRIPTION,
  alternates: {
    canonical: "/games/6-pics",
  },
  openGraph: {
    title: "6 Pics · 21 Games",
    description: DESCRIPTION,
    url: "https://21games.ai/games/6-pics",
    siteName: "21 Games",
    images: [
      {
        url: "/og/6-pics.png",
        width: 1200,
        height: 630,
        alt: "6 Pics · 21 Games",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "6 Pics · 21 Games",
    description: DESCRIPTION,
    images: ["/og/6-pics.png"],
  },
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

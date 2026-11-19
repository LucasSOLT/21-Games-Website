import React, { Suspense } from "react";
import type { Metadata } from "next";
import { TwentyOneThingsGame } from "@/components/games/twenty-one-things";
import { GameErrorBoundary } from "@/components/game-error-boundary";

const DESCRIPTION =
  "Curate 21 things you appreciate and narrow down 21 → 6 → 3 → 1 to what resonates most.";

export const metadata: Metadata = {
  title: "21 Things",
  description: DESCRIPTION,
  alternates: {
    canonical: "/games/21-things",
  },
  openGraph: {
    title: "21 Things · 21 Games",
    description: DESCRIPTION,
    url: "https://21games.ai/games/21-things",
    siteName: "21 Games",
    images: [
      {
        url: "/og/21-things.png",
        width: 1200,
        height: 630,
        alt: "21 Things · 21 Games",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "21 Things · 21 Games",
    description: DESCRIPTION,
    images: ["/og/21-things.png"],
  },
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


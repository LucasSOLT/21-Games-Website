import React, { Suspense } from "react";
import type { Metadata } from "next";
import { OneWinGame } from "@/components/games/one-win";
import { GameErrorBoundary } from "@/components/game-error-boundary";

const DESCRIPTION =
  "Share 1 win from your day in 1–4 words and see how many players around the world share it.";

export const metadata: Metadata = {
  title: "1 Win",
  description: DESCRIPTION,
  alternates: {
    canonical: "/games/1-win",
  },
  openGraph: {
    title: "1 Win · 21 Games",
    description: DESCRIPTION,
    url: "https://21games.ai/games/1-win",
    siteName: "21 Games",
    images: [
      {
        url: "/og/1-win.png",
        width: 1200,
        height: 630,
        alt: "1 Win · 21 Games",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "1 Win · 21 Games",
    description: DESCRIPTION,
    images: ["/og/1-win.png"],
  },
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

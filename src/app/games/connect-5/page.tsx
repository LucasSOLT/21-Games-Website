import React, { Suspense } from "react";
import type { Metadata } from "next";
import { ConnectFiveGame } from "@/components/games/connect-five";
import { GameErrorBoundary } from "@/components/game-error-boundary";

const DESCRIPTION =
  "Solve the daily 5-row compound word-chain puzzle where each word connects to the one above it.";

export const metadata: Metadata = {
  title: "Connect 5",
  description: DESCRIPTION,
  alternates: {
    canonical: "/games/connect-5",
  },
  openGraph: {
    title: "Connect 5 · 21 Games",
    description: DESCRIPTION,
    url: "https://21games.ai/games/connect-5",
    siteName: "21 Games",
    images: [
      {
        url: "/og/connect-5.png",
        width: 1200,
        height: 630,
        alt: "Connect 5 · 21 Games",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Connect 5 · 21 Games",
    description: DESCRIPTION,
    images: ["/og/connect-5.png"],
  },
};

export default function ConnectFivePage() {
  return (
    <GameErrorBoundary gameSlug="connect-5" gameTitle="Connect 5">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
            Loading Connect 5...
          </div>
        }
      >
        <ConnectFiveGame />
      </Suspense>
    </GameErrorBoundary>
  );
}


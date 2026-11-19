import React, { Suspense } from "react";
import type { Metadata } from "next";
import { EightfoldEchoGame } from "@/components/games/eightfold-echo";
import { GameErrorBoundary } from "@/components/game-error-boundary";

const DESCRIPTION =
  "Follow single-attribute visual logic rules from the emerald center across all 9 shape tiles.";

export const metadata: Metadata = {
  title: "Eightfold Echo",
  description: DESCRIPTION,
  alternates: {
    canonical: "/games/eightfold-echo",
  },
  openGraph: {
    title: "Eightfold Echo · 21 Games",
    description: DESCRIPTION,
    url: "https://21games.ai/games/eightfold-echo",
    siteName: "21 Games",
    images: [
      {
        url: "/og/eightfold-echo.png",
        width: 1200,
        height: 630,
        alt: "Eightfold Echo · 21 Games",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eightfold Echo · 21 Games",
    description: DESCRIPTION,
    images: ["/og/eightfold-echo.png"],
  },
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

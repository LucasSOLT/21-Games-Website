import React, { Suspense } from "react";
import { ConnectFiveGame } from "@/components/games/connect-five";

export const metadata = {
  title: "Connect 5 | SOL GaMES",
  description:
    "Solve the daily 5-row compound word-chain puzzle where each word connects to the one above it.",
};

export default function ConnectFivePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center font-headline font-black text-xl">
          Loading Connect 5...
        </div>
      }
    >
      <ConnectFiveGame />
    </Suspense>
  );
}

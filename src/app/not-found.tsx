import React from "react";
import Link from "next/link";
import { SolGamesLogo } from "@/components/solgames-logo";

const POPULAR_GAMES = [
  { number: 21, name: "21 Things", href: "/games/21-things" },
  { number: 17, name: "17 Syllables", href: "/games/17-syllables" },
  { number: 9, name: "9 Rhymes", href: "/games/9-rhymes" },
  { number: 6, name: "6 Pics", href: "/games/6-pics" },
  { number: 5, name: "Connect 5", href: "/games/connect-5" },
  { number: 4, name: "Four Score", href: "/games/four-score" },
  { number: 2, name: "Move Two", href: "/games/move-2" },
  { number: 1, name: "1 Win", href: "/games/1-win" },
];

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#FCFCFD] text-[#171717] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center hover:opacity-85 transition-opacity"
            aria-label="21 Games Home"
          >
            <SolGamesLogo />
          </Link>
        </div>

        <section className="bg-white border-2 border-[#171717] rounded-2xl p-7 sm:p-9 shadow-[6px_6px_0px_#171717] text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F9D423] border-2 border-[#171717] text-xs font-black tracking-wider uppercase mb-4">
            <span>404</span>
            <span>·</span>
            <span>Route Not Found</span>
          </div>

          <h1 className="font-headline text-3xl sm:text-4xl font-black tracking-tight text-[#171717] mb-3">
            Off the 21 → 1 Board
          </h1>

          <p className="text-sm sm:text-base text-[#4A4A4F] leading-relaxed mb-7 max-w-md mx-auto">
            That puzzle link doesn&apos;t match a square on our board. Head back
            to today&apos;s edition to play all 9 daily rituals.
          </p>

          <Link
            href="/"
            className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#F9D423] text-[#171717] font-headline font-black text-sm sm:text-base border-2 border-[#171717] shadow-[3px_3px_0px_#171717] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#171717] transition-all"
          >
            Play Today&apos;s 9 Games →
          </Link>

          <div className="mt-8 pt-6 border-t border-neutral-200">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-neutral-500 mb-3">
              Jump Straight Into a Daily Game
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {POPULAR_GAMES.map((game) => (
                <Link
                  key={game.href}
                  href={game.href}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FCFCFD] hover:bg-[#F9D423]/25 border border-[#171717]/20 hover:border-[#171717] text-xs font-bold text-[#171717] transition-colors"
                >
                  <span className="text-[10px] font-black text-neutral-500">
                    #{game.number}
                  </span>
                  <span>{game.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The site is a static export (`output: 'export'`), so anything computed during
// prerender is frozen at build time, in the build machine's timezone. The
// featured cards' "today" label therefore has to be computed in the browser.
const todayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const subscribeNoop = () => () => {};
const getTodayLabel = () => todayFormatter.format(new Date());
// Non-breaking space keeps the line height stable until hydration fills it in.
const getServerTodayLabel = () => "\u00A0";

function useTodayLabel(): string {
  return useSyncExternalStore(subscribeNoop, getTodayLabel, getServerTodayLabel);
}

type GameColor = "yellow" | "green" | "purple" | "grey" | "customPurple" | "customYellow" | "customPurple2" | "customYellow2" | "customF4D621";

export interface Game {
  name: string;
  slug: string;
  color: GameColor;
  logo: string;
  showCreate: boolean;
}

interface GameCardProps {
  game: Game;
  href?: string;
  className?: string;
  hideActions?: boolean;
  variant?: 'default' | 'featured';
  isCenter?: boolean;
  date?: string;
  author?: string;
}

const colorVariants: Record<GameColor, string> = {
  yellow: "bg-[#F9D423]",
  green: "bg-[#b6df52]",
  purple: "bg-[#9D50BB]",
  grey: "bg-[#e0e1d9]",
  customPurple: "bg-[#b4a8ff]",
  customYellow: "bg-[#F9F423]",
  customF4D621: "bg-[#f4d621]",
  customPurple2: "bg-[#daa8d0]",
  customYellow2: "bg-[#f7da21]",
};

const INK = "#171717";
const YELLOW = "#F9D423";
const GREEN = "#2ECC71";
const PURPLE = "#9D50BB";
const ORANGE = "#FF6D00";

// "Echo" ring order (clockwise from top-left) for Eightfold Echo's fading tiles.
const ECHO_RING: Array<[number, number]> = [
  [0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1],
];

const GameLogo = ({ game, variant }: { game: Game, variant: 'default' | 'featured' }) => {
  const isFeatured = variant === 'featured';
  const { logo } = game;

  switch (logo) {
    case "rhymes":
      return (
        <svg width={isFeatured ? "64" : "56"} height={isFeatured ? "101" : "89"} viewBox="0 0 56 89" fill="none">
          <g stroke={INK} strokeWidth="3">
            <rect x="1.5" y="1.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="20.5" y="1.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="39.5" y="1.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="1.5" y="19.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="20.5" y="19.5" width="15" height="15" rx="3.5" fill="white" />
            <rect x="39.5" y="19.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="1.5" y="37.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="20.5" y="37.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="39.5" y="37.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="1.5" y="55.5" width="15" height="15" rx="3.5" fill="white" />
            <rect x="20.5" y="55.5" width="15" height="15" rx="3.5" fill="white" />
            <rect x="39.5" y="55.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="1.5" y="73.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="20.5" y="73.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="39.5" y="73.5" width="15" height="15" rx="3.5" fill={YELLOW} />
          </g>
        </svg>
      );
    case "connect":
      if (isFeatured) {
        // 4 Winning Colors: four-colour wheel drawn inline. This used to be a PNG in
        // Firebase Storage, which now returns HTTP 402 (billing closed), so it rendered broken.
        return (
          <svg
            width="100"
            height="100"
            viewBox="0 0 100 100"
            fill="none"
            role="img"
            aria-label="4 Winning Colors logo"
            className="animate-slow-spin"
          >
            <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
              <path d="M50 50 L50 3.5 A46.5 46.5 0 0 1 96.5 50 Z" fill={YELLOW} />
              <path d="M50 50 L96.5 50 A46.5 46.5 0 0 1 50 96.5 Z" fill={GREEN} />
              <path d="M50 50 L50 96.5 A46.5 46.5 0 0 1 3.5 50 Z" fill={PURPLE} />
              <path d="M50 50 L3.5 50 A46.5 46.5 0 0 1 50 3.5 Z" fill={ORANGE} />
              <circle cx="50" cy="50" r="12" fill="white" />
            </g>
          </svg>
        );
      }
      return (
        <svg width="56" height="89" viewBox="0 0 56 89" fill="none">
          <g stroke={INK} strokeWidth="3">
            <rect x="1.5" y="1.5" width="15" height="15" rx="3.5" fill={GREEN} />
            <rect x="20.5" y="1.5" width="15" height="15" rx="3.5" fill={GREEN} />
            <rect x="39.5" y="1.5" width="15" height="15" rx="3.5" fill={GREEN} />
            <rect x="1.5" y="19.5" width="15" height="15" rx="3.5" fill={GREEN} />
            <rect x="20.5" y="19.5" width="15" height="15" rx="3.5" fill="white" />
            <rect x="39.5" y="19.5" width="15" height="15" rx="3.5" fill="white" />
            <rect x="1.5" y="37.5" width="15" height="15" rx="3.5" fill={GREEN} />
            <rect x="20.5" y="37.5" width="15" height="15" rx="3.5" fill={YELLOW} />
            <rect x="39.5" y="37.5" width="15" height="15" rx="3.5" fill={GREEN} />
            <rect x="1.5" y="55.5" width="15" height="15" rx="3.5" fill="white" />
            <rect x="20.5" y="55.5" width="15" height="15" rx="3.5" fill="white" />
            <rect x="39.5" y="55.5" width="15" height="15" rx="3.5" fill={GREEN} />
            <rect x="1.5" y="73.5" width="15" height="15" rx="3.5" fill={GREEN} />
            <rect x="20.5" y="73.5" width="15" height="15" rx="3.5" fill={GREEN} />
            <rect x="39.5" y="73.5" width="15" height="15" rx="3.5" fill="white" />
          </g>
        </svg>
      );
    case "things":
      return (
        <svg width={isFeatured ? "77" : "68"} height={isFeatured ? "77" : "68"} viewBox="0 0 68 68" fill="none">
          <g stroke={INK} strokeWidth="3">
            <rect x="1.5" y="1.5" width="15" height="15" rx="1.5" fill="white" />
            <rect x="18.5" y="1.5" width="15" height="15" rx="1.5" fill={YELLOW} />
            <rect x="35.5" y="1.5" width="15" height="15" rx="1.5" fill="white" />
            <rect x="52.5" y="1.5" width="15" height="15" rx="1.5" fill={YELLOW} />
            <rect x="1.5" y="18.5" width="15" height="15" rx="1.5" fill="white" />
            <rect x="18.5" y="18.5" width="15" height="15" rx="1.5" fill={PURPLE} />
            <rect x="35.5" y="18.5" width="15" height="15" rx="1.5" fill={PURPLE} />
            <rect x="52.5" y="18.5" width="15" height="15" rx="1.5" fill="white" />
            <rect x="1.5" y="35.5" width="15" height="15" rx="1.5" fill={PURPLE} />
            <rect x="18.5" y="35.5" width="15" height="15" rx="3.5" fill={PURPLE} />
            <rect x="35.5" y="35.5" width="15" height="15" rx="1.5" fill={PURPLE} />
            <rect x="52.5" y="35.5" width="15" height="15" rx="1.5" fill="white" />
            <rect x="1.5" y="52.5" width="15" height="15" rx="1.5" fill={YELLOW} />
            <rect x="18.5" y="52.5" width="15" height="15" rx="1.5" fill="white" />
            <rect x="35.5" y="52.5" width="15" height="15" rx="1.5" fill={GREEN} />
            <rect x="52.5" y="52.5" width="15" height="15" rx="1.5" fill="white" />
          </g>
        </svg>
      );
    case "syllables":
      // 17 Syllables: haiku rhythm, rows of 5 / 7 / 5 tiles.
      return (
        <svg width="68" height="68" viewBox="0 0 68 68" fill="none" role="img" aria-label="17 Syllables logo">
          <g stroke={INK} strokeWidth="2">
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={`a${i}`} x={12.5 + i * 9} y="6" width="7" height="14" rx="1.5" fill="white" />
            ))}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <rect key={`b${i}`} x={3.5 + i * 9} y="27" width="7" height="14" rx="1.5" fill={PURPLE} />
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={`c${i}`} x={12.5 + i * 9} y="48" width="7" height="14" rx="1.5" fill="white" />
            ))}
          </g>
        </svg>
      );
    case "6-pics":
      // 6 Pics: a 3x2 contact sheet of picture frames.
      return (
        <svg width="68" height="68" viewBox="0 0 68 68" fill="none" role="img" aria-label="6 Pics logo">
          {[0, 1].map((row) =>
            [0, 1, 2].map((col) => {
              const x = 1.5 + col * 23;
              const y = 13 + row * 23;
              const filled = (row + col) % 2 === 0;
              return (
                <g key={`${row}-${col}`} stroke={INK} strokeWidth="3" strokeLinejoin="round">
                  <rect x={x} y={y} width="19" height="19" rx="2" fill={filled ? PURPLE : "white"} />
                  <path
                    d={`M${x + 3} ${y + 15} L${x + 8} ${y + 9} L${x + 11} ${y + 12} L${x + 13} ${y + 10} L${x + 16} ${y + 15} Z`}
                    fill={filled ? "white" : INK}
                    strokeWidth="1.5"
                  />
                  <circle cx={x + 14} cy={y + 5.5} r="2" fill={YELLOW} strokeWidth="1.5" />
                </g>
              );
            })
          )}
        </svg>
      );
    case "win":
      // 1 Win: one gold tile standing out in a 3x3 board.
      return (
        <svg width="56" height="56" viewBox="0 0 52 52" fill="none" role="img" aria-label="1 Win logo">
          <g stroke={INK} strokeWidth="3">
            {[0, 1, 2].map((row) =>
              [0, 1, 2].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={1.5 + col * 17}
                  y={1.5 + row * 17}
                  width="15"
                  height="15"
                  rx="3.5"
                  fill={row === 1 && col === 1 ? YELLOW : "white"}
                />
              ))
            )}
          </g>
          <path d="M22.5 23 L27 20.5 L27 31.5" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "echo":
      // Eightfold Echo: eight tiles circling the centre, fading like an echo.
      return (
        <svg width="56" height="56" viewBox="0 0 52 52" fill="none" role="img" aria-label="Eightfold Echo logo">
          <g stroke={INK} strokeWidth="3">
            {ECHO_RING.map(([col, row], i) => (
              <rect
                key={`${col}-${row}`}
                x={1.5 + col * 17}
                y={1.5 + row * 17}
                width="15"
                height="15"
                rx="3.5"
                fill={PURPLE}
                fillOpacity={1 - i * 0.12}
              />
            ))}
            <circle cx="26" cy="26" r="4" fill={INK} />
          </g>
        </svg>
      );
    case "letter":
      // The 11th Hour: clock face with the final hour (11 -> 12) highlighted.
      return (
        <svg width="68" height="68" viewBox="0 0 68 68" fill="none" role="img" aria-label="The 11th Hour logo">
          <circle cx="34" cy="34" r="31.5" fill="white" stroke={INK} strokeWidth="3" />
          <path d="M34 34 L34 2.5 A31.5 31.5 0 0 0 18.25 6.72 Z" fill={YELLOW} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <g stroke={INK} strokeWidth="3" strokeLinecap="round">
            <line x1="62" y1="34" x2="57" y2="34" />
            <line x1="34" y1="62" x2="34" y2="57" />
            <line x1="6" y1="34" x2="11" y2="34" />
            <line x1="34" y1="34" x2="25" y2="18.4" />
            <line x1="34" y1="34" x2="34" y2="12" />
          </g>
          <circle cx="34" cy="34" r="3.5" fill={INK} />
        </svg>
      );
    case "move-2":
      // Move 2: one tile and two steps to the right.
      return (
        <svg width="68" height="68" viewBox="0 0 68 68" fill="none" role="img" aria-label="Move 2 logo">
          <g stroke={INK} strokeWidth="3">
            {[0, 1, 2].map((row) =>
              [0, 1, 2].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={1.5 + col * 22.5}
                  y={1.5 + row * 22.5}
                  width="20"
                  height="20"
                  rx="3.5"
                  fill={row === 1 && col === 0 ? YELLOW : row === 1 ? "white" : GREEN}
                />
              ))
            )}
          </g>
          <g stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M30 27.5 L36 34 L30 40.5" />
            <path d="M52.5 27.5 L58.5 34 L52.5 40.5" />
          </g>
        </svg>
      );
    default:
      return null;
  }
};

export function GameCard({ game, href, className, hideActions, variant = 'default', isCenter = false, date, author }: GameCardProps) {
  const isPlayable = game.slug === '21-things' || game.slug === '6-pics' || game.slug === 'connect-5';
  const gameHref = `/games/${game.slug}`;
  const today = useTodayLabel();
  const dateLabel = date ?? today;

  if (variant === 'featured') {
    if (isPlayable) {
      return (
        <Link href={gameHref} className={cn("block h-full group cursor-pointer", className)}>
          <Card className="h-full flex flex-col items-center justify-center p-6 text-center shadow-sm border-2 bg-white transition-all duration-300 group-hover:shadow-md">
              <GameLogo game={game} variant="featured" />
              <h2 className="text-3xl font-headline font-black mt-3 text-black">{game.name}</h2>
              <p className="text-base mt-1 text-gray-500">{dateLabel}</p>
              <div className="w-16 h-px bg-gray-300 my-2"></div>
              <p className="text-base text-gray-500">by {author}</p>
          </Card>
        </Link>
      );
    }
    return (
      <div className={cn("block h-full group cursor-default", className)}>
        <Card className="h-full flex flex-col items-center justify-center p-6 text-center shadow-sm border-2 bg-white transition-all duration-300 group-hover:shadow-md">
            <GameLogo game={game} variant="featured" />
            <h2 className="text-3xl font-headline font-black mt-3 text-black">{game.name}</h2>
            <p className="text-base mt-1 text-gray-500">{dateLabel}</p>
            <div className="w-16 h-px bg-gray-300 my-2"></div>
            <p className="text-base text-gray-500">by {author}</p>
            <p className="mt-4 font-bold text-gray-400">Coming Soon</p>
        </Card>
      </div>
    );
  }

  return (
    <Card className={cn("h-full flex flex-col gap-0 py-0 overflow-hidden rounded-lg shadow-sm border-2 border-[#dcdcdc]", className)}>
        <CardContent className={cn("flex flex-col items-center justify-center p-6 h-[220px]", colorVariants[game.color])}>
            <GameLogo game={game} variant="default" />
            <h2 className="font-headline font-black text-2xl mt-4 text-black">{game.name}</h2>
        </CardContent>
        {!hideActions && (
            <CardFooter className="flex flex-col gap-2 p-4 bg-white">
                <Link 
                  href={isPlayable ? gameHref : "#"} 
                  className={cn(buttonVariants({ variant: "outline" }), "w-full border-2 font-headline font-black text-lg select-none min-h-[44px]")}
                >
                    {isPlayable ? 'Play' : 'Coming Soon'}
                </Link>
                {isPlayable && (
                    <Button variant="outline" className="w-full border-2 font-headline font-black text-lg select-none min-h-[44px]">Archive</Button>
                )}
            </CardFooter>
        )}
    </Card>
  );
}

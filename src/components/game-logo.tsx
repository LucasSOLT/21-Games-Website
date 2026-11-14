import React from "react";
import { type GameConfig } from "@/lib/games-config";
import { cn } from "@/lib/utils";

export interface GameLogoProps {
  game?: Pick<GameConfig, "logo" | "slug" | "name">;
  logo?: string;
  variant?: "default" | "featured" | "mini";
  size?: "default" | "featured" | "mini";
  className?: string;
}

const INK = "#171717";
const YELLOW = "#F9D423";
const GREEN = "#2ECC71";
const PURPLE = "#9D50BB";
const LAVENDER = "#daa8d0";
const WHITE = "#FFFFFF";

const VARIANT_DIMENSIONS: Record<
  NonNullable<GameLogoProps["variant"]>,
  number
> = {
  featured: 84,
  default: 72,
  mini: 28,
};

function normalizeLogoKey(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "-");
  switch (cleaned) {
    case "rhymes":
    case "9-rhymes":
      return "rhymes";
    case "connect":
    case "connect-5":
      return "connect";
    case "things":
    case "21-things":
      return "things";
    case "syllables":
    case "17-syllables":
      return "syllables";
    case "6-pics":
    case "6pics":
      return "6-pics";
    case "win":
    case "1-win":
      return "win";
    case "echo":
    case "eightfold-echo":
      return "echo";
    case "four-score":
    case "fourscore":
    case "score":
    case "letter":
    case "the-11th-hour":
    case "11th-hour":
      return "four-score";
    case "move-2":
    case "move2":
      return "move-2";
    default:
      return cleaned;
  }
}

const DEFAULT_LABELS: Record<string, string> = {
  rhymes: "9 Rhymes",
  connect: "Connect 5",
  things: "21 Things",
  syllables: "17 Syllables",
  "6-pics": "6 Pics",
  win: "1 Win",
  echo: "Eightfold Echo",
  "four-score": "Four Score",
  score: "Four Score",
  letter: "Four Score",
  "move-2": "Move Two",
};

export function GameLogo({
  game,
  logo,
  variant,
  size: sizeProp,
  className,
}: GameLogoProps) {
  const rawKey =
    (logo && logo.trim()) ||
    (game?.logo && game.logo.trim()) ||
    (game?.slug && game.slug.trim()) ||
    (game?.name && game.name.trim()) ||
    "";
  const logoKey = normalizeLogoKey(rawKey);
  const resolvedVariant = variant ?? sizeProp ?? "default";
  const pixelSize = VARIANT_DIMENSIONS[resolvedVariant] ?? 72;
  const resolvedName =
    (game?.name && game.name.trim()) || DEFAULT_LABELS[logoKey] || "Game";
  const label = `${resolvedName} logo`;

  const svgProps = {
    width: pixelSize,
    height: pixelSize,
    viewBox: "0 0 80 80",
    fill: "none",
    role: "img" as const,
    "aria-label": label,
    className: cn("shrink-0 select-none", className),
  };

  switch (logoKey) {
    case "rhymes": {
      return (
        <svg {...svgProps}>
          {/* Minimalist NYT Games Editorial Card with crisp offset ink shadow */}
          <rect
            x="12"
            y="12"
            width="60"
            height="60"
            rx="14"
            fill={INK}
          />
          <rect
            x="9"
            y="9"
            width="60"
            height="60"
            rx="14"
            fill={WHITE}
            stroke={INK}
            strokeWidth="2.6"
          />

          {/* Left NYT Gold Badge housing bold geometric numeral 9 */}
          <rect
            x="15"
            y="16"
            width="24"
            height="46"
            rx="7"
            fill={YELLOW}
            stroke={INK}
            strokeWidth="2.4"
          />
          {/* Bold geometric numeral 9 */}
          <circle
            cx="27"
            cy="31"
            r="6.2"
            fill={WHITE}
            stroke={INK}
            strokeWidth="2.6"
          />
          <path
            d="M 33.2 31 V 45 C 33.2 50 29.5 52.5 25 52.5 C 22.5 52.5 21 51.2 20.2 49.5"
            fill="none"
            stroke={INK}
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          {/* Right: 3 minimalist stepped linear rhyme-chain bars */}
          <rect
            x="44"
            y="18"
            width="19"
            height="10"
            rx="4"
            fill={YELLOW}
            stroke={INK}
            strokeWidth="2.2"
          />
          <rect
            x="44"
            y="34"
            width="19"
            height="10"
            rx="4"
            fill={GREEN}
            stroke={INK}
            strokeWidth="2.2"
          />
          <rect
            x="44"
            y="50"
            width="19"
            height="10"
            rx="4"
            fill={PURPLE}
            stroke={INK}
            strokeWidth="2.2"
          />
        </svg>
      );
    }

    case "connect": {
      // 5 stepped horizontal word-chain bars of varying lengths (MOUSE -> PAD -> LOCK -> DOWN -> WIND)
      const bars = [
        { x: 6, y: 7, w: 50, fill: YELLOW, cells: 5 },
        { x: 24, y: 21, w: 33, fill: GREEN, cells: 3 },
        { x: 12, y: 35, w: 44, fill: WHITE, cells: 4 },
        { x: 24, y: 49, w: 44, fill: GREEN, cells: 4 },
        { x: 14, y: 63, w: 48, fill: YELLOW, cells: 4 },
      ];
      const connectors = [
        { x: 35, y1: 17.5, y2: 21 },
        { x: 40, y1: 31.5, y2: 35 },
        { x: 38, y1: 45.5, y2: 49 },
        { x: 46, y1: 59.5, y2: 63 },
      ];
      return (
        <svg {...svgProps}>
          {/* Stepped 5-row compound word-chain bars */}
          {bars.map((bar, idx) => {
            const cellWidth = bar.w / bar.cells;
            return (
              <g key={`connect-bar-${idx}`}>
                <rect
                  x={bar.x + 2}
                  y={bar.y + 2}
                  width={bar.w}
                  height="10.5"
                  rx="3.5"
                  fill={INK}
                />
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.w}
                  height="10.5"
                  rx="3.5"
                  fill={bar.fill}
                  stroke={INK}
                  strokeWidth="2.5"
                />
                {Array.from({ length: bar.cells - 1 }).map((_, cIdx) => {
                  const lx = bar.x + cellWidth * (cIdx + 1);
                  return (
                    <line
                      key={`div-${idx}-${cIdx}`}
                      x1={lx}
                      y1={bar.y + 1.5}
                      x2={lx}
                      y2={bar.y + 9}
                      stroke={INK}
                      strokeWidth="1.8"
                      opacity="0.45"
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Interlocking vertical chain connector nodes linking Row 1 -> 2 -> 3 -> 4 -> 5 */}
          {connectors.map((conn, idx) => (
            <g key={`connect-node-${idx}`}>
              <line
                x1={conn.x}
                y1={conn.y1 - 1}
                x2={conn.x}
                y2={conn.y2 + 1}
                stroke={INK}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle
                cx={conn.x}
                cy={(conn.y1 + conn.y2) / 2}
                r="3.2"
                fill={WHITE}
                stroke={INK}
                strokeWidth="2.2"
              />
            </g>
          ))}
        </svg>
      );
    }

    case "things": {
      const row4X = [7.5, 21, 34.5, 48, 61.5]; // 5 lavender tiles (21 base)
      const row3X = [11.5, 26.5, 41.5, 56.5]; // 4 purple tiles (6 tier)
      const row2X = [17, 33.5, 50]; // 3 green tiles (3 tier)
      return (
        <svg {...svgProps}>
          {/* Upward convergence chevrons flanking the funnel */}
          <path
            d="M11 26 L16 20 L21 26 M13 18 L18 12 L23 18"
            stroke={INK}
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M59 26 L64 20 L69 26 M57 18 L62 12 L67 18"
            stroke={INK}
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Tier 4 (Base of 5 lavender tiles) */}
          {row4X.map((x, i) => (
            <g key={`things-r4-${i}`}>
              <rect
                x={x + 1.5}
                y={63.5}
                width="11"
                height="10.5"
                rx="2.5"
                fill={INK}
              />
              <rect
                x={x}
                y={62}
                width="11"
                height="10.5"
                rx="2.5"
                fill={LAVENDER}
                stroke={INK}
                strokeWidth="2.5"
              />
            </g>
          ))}

          {/* Tier 3 (4 vibrant purple tiles) */}
          {row3X.map((x, i) => (
            <g key={`things-r3-${i}`}>
              <rect
                x={x + 1.5}
                y={48.5}
                width="12"
                height="10.5"
                rx="2.5"
                fill={INK}
              />
              <rect
                x={x}
                y={47}
                width="12"
                height="10.5"
                rx="2.5"
                fill={PURPLE}
                stroke={INK}
                strokeWidth="2.5"
              />
            </g>
          ))}

          {/* Tier 2 (3 green finalist tiles) */}
          {row2X.map((x, i) => (
            <g key={`things-r2-${i}`}>
              <rect
                x={x + 2}
                y={33.5}
                width="13"
                height="11"
                rx="3"
                fill={INK}
              />
              <rect
                x={x}
                y={31.5}
                width="13"
                height="11"
                rx="3"
                fill={GREEN}
                stroke={INK}
                strokeWidth="2.5"
              />
            </g>
          ))}

          {/* Tier 1 (Crowned #1 golden star/trophy tile) */}
          <g>
            <rect
              x="28"
              y="8.5"
              width="28"
              height="20"
              rx="4.5"
              fill={INK}
            />
            <rect
              x="26"
              y="6.5"
              width="28"
              height="20"
              rx="4.5"
              fill={YELLOW}
              stroke={INK}
              strokeWidth="2.5"
            />
            {/* Star emblem */}
            <path
              d="M35 11 L36.4 14 L39.7 14.5 L37.3 16.8 L37.9 20.1 L35 18.5 L32.1 20.1 L32.7 16.8 L30.3 14.5 L33.6 14 Z"
              fill={WHITE}
              stroke={INK}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {/* Crisp "#1" numeral */}
            <path
              d="M44.5 13.2 L47 11.5 V20.5 M44.2 20.5 H49.5"
              stroke={INK}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      );
    }

    case "syllables": {
      return (
        <svg {...svgProps}>
          {/* Editorial haiku card with hard-offset shadow */}
          <rect x="9.5" y="9.5" width="61" height="61" rx="7" fill={INK} />
          <rect
            x="7"
            y="7"
            width="61"
            height="61"
            rx="7"
            fill={WHITE}
            stroke={INK}
            strokeWidth="2.5"
          />

          {/* Row 1: 5 syllable meter bars (gold & white beats) */}
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={`syl-r1-${i}`}
              x={14.5 + i * 9.5}
              y="14.5"
              width="7"
              height="12.5"
              rx="2"
              fill={i % 2 === 0 ? YELLOW : WHITE}
              stroke={INK}
              strokeWidth="2.2"
            />
          ))}

          {/* Row 2: 7 vibrant purple syllable meter bars */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect
              key={`syl-r2-${i}`}
              x={11.5 + i * 7.5}
              y="31.5"
              width="5.8"
              height="13.5"
              rx="2"
              fill={PURPLE}
              stroke={INK}
              strokeWidth="2.2"
            />
          ))}

          {/* Row 3: 5 green syllable meter bars */}
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={`syl-r3-${i}`}
              x={14.5 + i * 9.5}
              y="49.5"
              width="7"
              height="12.5"
              rx="2"
              fill={GREEN}
              stroke={INK}
              strokeWidth="2.2"
            />
          ))}

          {/* Poetic fountain-nib cadence mark oriented cleanly at -45 deg */}
          <g>
            <path
              d="M55 49 L68 53 L73 65 L65 73 L53 68 Z"
              fill={INK}
            />
            <path
              d="M53 47 L66 51 L71 63 L63 71 L51 66 Z"
              fill={YELLOW}
              stroke={INK}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <line
              x1="53"
              y1="47"
              x2="60.5"
              y2="54.5"
              stroke={INK}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="61.5" cy="55.5" r="2" fill={INK} />
          </g>
        </svg>
      );
    }

    case "6-pics": {
      const cols = [5, 29.5, 54];
      const rows = [8, 44];
      return (
        <svg {...svgProps}>
          {/* 3x2 contact-sheet gallery frames with shadows */}
          {rows.map((y, rIdx) =>
            cols.map((x, cIdx) => {
              const idx = rIdx * 3 + cIdx;
              const bgFill =
                idx === 1
                  ? PURPLE
                  : idx === 3
                  ? GREEN
                  : idx === 5
                  ? LAVENDER
                  : WHITE;
              return (
                <g key={`pic-frame-${idx}`}>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width="21"
                    height="24"
                    rx="3.5"
                    fill={INK}
                  />
                  <rect
                    x={x}
                    y={y}
                    width="21"
                    height="24"
                    rx="3.5"
                    fill={bgFill}
                    stroke={INK}
                    strokeWidth="2.5"
                  />
                </g>
              );
            })
          )}

          {/* Pictogram 1 (0,0): Sun */}
          <circle
            cx="15.5"
            cy="20"
            r="4.5"
            fill={YELLOW}
            stroke={INK}
            strokeWidth="2.2"
          />
          <path
            d="M15.5 12.5 V14 M15.5 26 V27.5 M8 20 H9.5 M21.5 20 H23"
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Pictogram 2 (0,1): Mountain Peak */}
          <path
            d="M33.5 27 L39 14.5 L42.5 21 L44.5 17.5 L47 27 Z"
            fill={WHITE}
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Pictogram 3 (0,2): Lightning Bolt */}
          <path
            d="M65.5 12 L59.5 20.5 H64.5 L62.5 28 L69.5 19 H64.5 Z"
            fill={YELLOW}
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Pictogram 4 (1,0): Faceted Gem */}
          <path
            d="M12 50 H19 L21.5 54.5 L15.5 62.5 L9.5 54.5 Z"
            fill={WHITE}
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Pictogram 5 (1,1): Heart */}
          <path
            d="M40 62.5 C40 62.5 33.5 58 33.5 53.5 C33.5 51.3 35.3 50 37.2 50 C38.5 50 39.5 50.7 40 51.7 C40.5 50.7 41.5 50 42.8 50 C44.7 50 46.5 51.3 46.5 53.5 C46.5 58 40 62.5 40 62.5 Z"
            fill={PURPLE}
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Pictogram 6 (1,2): 5-Point Star */}
          <path
            d="M64.5 49 L66.3 53 L70.5 53.5 L67.3 56.3 L68.2 60.5 L64.5 58.3 L60.8 60.5 L61.7 56.3 L58.5 53.5 L62.7 53 Z"
            fill={YELLOW}
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Central Golden Link Badge */}
          <g>
            <rect
              x="30"
              y="33.5"
              width="24"
              height="13"
              rx="6.5"
              fill={INK}
            />
            <rect
              x="28"
              y="31.5"
              width="24"
              height="13"
              rx="6.5"
              fill={YELLOW}
              stroke={INK}
              strokeWidth="2.5"
            />
            <rect
              x="33"
              y="35"
              width="8.5"
              height="6"
              rx="3"
              stroke={INK}
              strokeWidth="2.2"
            />
            <rect
              x="38.5"
              y="35"
              width="8.5"
              height="6"
              rx="3"
              stroke={INK}
              strokeWidth="2.2"
            />
          </g>
        </svg>
      );
    }

    case "win": {
      return (
        <svg {...svgProps}>
          {/* Foundation Ground Bar */}
          <rect
            x="6"
            y="68"
            width="68"
            height="6"
            rx="3"
            fill={INK}
          />

          {/* Rank 2 Podium (Left - White) */}
          <g>
            <rect
              x="10.5"
              y="43.5"
              width="18"
              height="25"
              rx="3"
              fill={INK}
            />
            <rect
              x="9"
              y="42"
              width="18"
              height="26"
              rx="3"
              fill={WHITE}
              stroke={INK}
              strokeWidth="2.4"
            />
            {/* Numeral 2 on podium */}
            <path
              d="M 15 49 C 15 47 21 47 21 49 C 21 51 15 53 15 55.5 H 21"
              stroke={INK}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Rank 3 Podium (Right - White) */}
          <g>
            <rect
              x="54.5"
              y="51.5"
              width="18"
              height="17"
              rx="3"
              fill={INK}
            />
            <rect
              x="53"
              y="50"
              width="18"
              height="18"
              rx="3"
              fill={WHITE}
              stroke={INK}
              strokeWidth="2.4"
            />
            {/* Numeral 3 on podium */}
            <path
              d="M 59 54.5 C 61 53.5 64 54 64 56 C 64 57.5 61 58 61 58 C 64 58 64 60.5 62 61.5 C 60 62 59 61.5 59 61.5"
              stroke={INK}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Rank 1 Central Podium (Center - Golden) */}
          <g>
            <rect
              x="32"
              y="32"
              width="20"
              height="36"
              rx="4"
              fill={INK}
            />
            <rect
              x="30"
              y="30"
              width="20"
              height="38"
              rx="4"
              fill={YELLOW}
              stroke={INK}
              strokeWidth="2.5"
            />
            {/* Numeral 1 on central podium */}
            <path
              d="M 38 45 L 40 43 V 53 M 37 53 H 43"
              stroke={INK}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Crowning Golden #1 Trophy */}
          <g>
            {/* Trophy shadow */}
            <rect
              x="29"
              y="8"
              width="26"
              height="20"
              rx="4.5"
              fill={INK}
            />
            {/* Trophy Card */}
            <rect
              x="27"
              y="6"
              width="26"
              height="20"
              rx="4.5"
              fill={YELLOW}
              stroke={INK}
              strokeWidth="2.4"
            />
            {/* 3-point green crown atop trophy */}
            <path
              d="M 33 10 L 35 6.5 L 40 9.5 L 45 6.5 L 47 10 Z"
              fill={GREEN}
              stroke={INK}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {/* Bold numeral 1 inside trophy */}
            <path
              d="M 38 13.5 L 40.5 12 V 21 M 37.5 21 H 43.5"
              stroke={INK}
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Celebration radiance rays and sparks */}
            <path
              d="M 23 8 L 20 6 M 22 16 H 18 M 57 8 L 60 6 M 58 16 H 62"
              stroke={INK}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="21" cy="11" r="1.5" fill={YELLOW} stroke={INK} strokeWidth="1" />
            <circle cx="59" cy="11" r="1.5" fill={YELLOW} stroke={INK} strokeWidth="1" />
          </g>
        </svg>
      );
    }

    case "echo": {
      // 3x3 shape logic grid coords: row/col at 8, 30, 52 (tile size 20x20)
      const cells = [
        // row 0: Step 1 (Gold), Step 2 (Purple), Step 3 (Cobalt)
        { x: 8, y: 8, fill: YELLOW, type: "circle" },
        { x: 30, y: 8, fill: PURPLE, type: "diamond" },
        { x: 52, y: 8, fill: "#3B82F6", type: "triangle" },
        // row 1: Step 8 (Amber), Step 0 (Emerald Center), Step 4 (Tangerine)
        { x: 8, y: 30, fill: "#F59E0B", type: "bars" },
        { x: 30, y: 30, fill: GREEN, type: "center" },
        { x: 52, y: 30, fill: "#F97316", type: "square" },
        // row 2: Step 7 (Teal), Step 6 (Lavender), Step 5 (Active Step - Rose border)
        { x: 8, y: 52, fill: "#14B8A6", type: "slash" },
        { x: 30, y: 52, fill: LAVENDER, type: "plus" },
        { x: 52, y: 52, fill: WHITE, type: "active" },
      ];

      return (
        <svg {...svgProps}>
          {/* Subtle sequence trace line connecting surrounding 8 steps */}
          <path
            d="M 28 18 H 30 M 50 18 H 52 M 62 28 V 30 M 62 50 V 52 M 52 62 H 50 M 30 62 H 28 M 18 52 V 50 M 18 30 V 28"
            stroke={INK}
            strokeWidth="1.5"
            strokeDasharray="1.5 1.5"
            opacity="0.4"
          />

          {cells.map((cell, idx) => {
            const isCenter = cell.type === "center";
            const isActive = cell.type === "active";
            return (
              <g key={`echo-cell-${idx}`}>
                {/* Hard offset drop shadow */}
                <rect
                  x={cell.x + 2}
                  y={cell.y + 2}
                  width="20"
                  height="20"
                  rx="4"
                  fill={INK}
                />
                {/* Base Tile */}
                <rect
                  x={cell.x}
                  y={cell.y}
                  width="20"
                  height="20"
                  rx="4"
                  fill={cell.fill}
                  stroke={isActive ? "#EC4899" : INK}
                  strokeWidth={isActive ? "2.8" : isCenter ? "2.6" : "2.2"}
                  strokeDasharray={isActive ? "3 2" : undefined}
                />

                {/* Glyphs inside each step */}
                {cell.type === "center" && (
                  <>
                    <circle
                      cx="40"
                      cy="40"
                      r="5.5"
                      fill="none"
                      stroke={WHITE}
                      strokeWidth="2"
                    />
                    <circle cx="40" cy="40" r="2" fill={WHITE} />
                  </>
                )}
                {cell.type === "circle" && (
                  <circle
                    cx="18"
                    cy="18"
                    r="4"
                    fill={WHITE}
                    stroke={INK}
                    strokeWidth="1.8"
                  />
                )}
                {cell.type === "diamond" && (
                  <path
                    d="M 40 13 L 45 18 L 40 23 L 35 18 Z"
                    fill={WHITE}
                    stroke={INK}
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                )}
                {cell.type === "triangle" && (
                  <path
                    d="M 62 13.5 L 66.5 21.5 H 57.5 Z"
                    fill={WHITE}
                    stroke={INK}
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                )}
                {cell.type === "square" && (
                  <rect
                    x="58.5"
                    y="36.5"
                    width="7"
                    height="7"
                    rx="1.5"
                    fill={WHITE}
                    stroke={INK}
                    strokeWidth="1.8"
                  />
                )}
                {cell.type === "active" && (
                  <>
                    <circle
                      cx="62"
                      cy="62"
                      r="4.5"
                      fill="none"
                      stroke={INK}
                      strokeWidth="1.8"
                    />
                    <path
                      d="M 62 57.5 A 4.5 4.5 0 0 1 62 66.5 Z"
                      fill="#EC4899"
                    />
                  </>
                )}
                {cell.type === "plus" && (
                  <path
                    d="M 40 57.5 V 66.5 M 35.5 62 H 44.5"
                    stroke={INK}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )}
                {cell.type === "slash" && (
                  <path
                    d="M 13.5 66.5 L 22.5 57.5"
                    stroke={WHITE}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                )}
                {cell.type === "bars" && (
                  <path
                    d="M 13.5 38 H 22.5 M 13.5 42 H 22.5"
                    stroke={WHITE}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          })}
        </svg>
      );
    }

    case "four-score":
    case "letter": {
      return (
        <svg {...svgProps}>
          {/* Subtle connecting convergence lines into center */}
          <line
            x1="19"
            y1="20"
            x2="25"
            y2="25"
            stroke={INK}
            strokeWidth="1.8"
            strokeDasharray="2.5 2"
            opacity="0.4"
          />
          <line
            x1="61"
            y1="19"
            x2="55"
            y2="25"
            stroke={INK}
            strokeWidth="1.8"
            strokeDasharray="2.5 2"
            opacity="0.4"
          />
          <line
            x1="19"
            y1="61"
            x2="25"
            y2="55"
            stroke={INK}
            strokeWidth="1.8"
            strokeDasharray="2.5 2"
            opacity="0.4"
          />
          <line
            x1="61"
            y1="61"
            x2="55"
            y2="55"
            stroke={INK}
            strokeWidth="1.8"
            strokeDasharray="2.5 2"
            opacity="0.4"
          />

          {/* Central Target Card (= 80) with hard drop shadow */}
          <rect
            x="23.5"
            y="23.5"
            width="38"
            height="38"
            rx="7"
            fill={INK}
          />
          <rect
            x="21"
            y="21"
            width="38"
            height="38"
            rx="7"
            fill={YELLOW}
            stroke={INK}
            strokeWidth="2.5"
          />

          {/* Target card header accent */}
          <path
            d="M 32 26 H 48"
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* Equals prefix = */}
          <path
            d="M 26.5 37.5 H 31.5 M 26.5 41.5 H 31.5"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Numeral 8 */}
          <circle
            cx="38"
            cy="35"
            r="3.5"
            fill="none"
            stroke={INK}
            strokeWidth="2.6"
          />
          <circle
            cx="38"
            cy="43"
            r="4.2"
            fill="none"
            stroke={INK}
            strokeWidth="2.6"
          />

          {/* Numeral 0 */}
          <rect
            x="44.5"
            y="31.5"
            width="8.5"
            height="15.5"
            rx="4.25"
            fill="none"
            stroke={INK}
            strokeWidth="2.6"
          />

          {/* Satellites: */}
          {/* Top-Left: Number tile 4 */}
          <g>
            <rect
              x="6.5"
              y="7.5"
              width="16"
              height="16"
              rx="3.5"
              fill={INK}
            />
            <rect
              x="5"
              y="6"
              width="16"
              height="16"
              rx="3.5"
              fill={WHITE}
              stroke={INK}
              strokeWidth="2.2"
            />
            {/* Numeral 4 */}
            <path
              d="M 15 9.5 L 10.5 15 H 16 M 14 13 V 18.5"
              stroke={INK}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Top-Right: Multiply operator badge × */}
          <g>
            <circle cx="68" cy="15" r="7.5" fill={INK} />
            <circle
              cx="66.5"
              cy="13.5"
              r="7.5"
              fill={PURPLE}
              stroke={INK}
              strokeWidth="2.2"
            />
            <path
              d="M 63.5 10.5 L 69.5 16.5 M 69.5 10.5 L 63.5 16.5"
              stroke={WHITE}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>

          {/* Bottom-Left: Add operator badge + */}
          <g>
            <circle cx="14.5" cy="68" r="7.5" fill={INK} />
            <circle
              cx="13"
              cy="66.5"
              r="7.5"
              fill={GREEN}
              stroke={INK}
              strokeWidth="2.2"
            />
            <path
              d="M 13 62 V 71 M 8.5 66.5 H 17.5"
              stroke={WHITE}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>

          {/* Bottom-Right: Square operator tile x² */}
          <g>
            <rect
              x="60.5"
              y="59.5"
              width="16"
              height="16"
              rx="3.5"
              fill={INK}
            />
            <rect
              x="59"
              y="58"
              width="16"
              height="16"
              rx="3.5"
              fill={WHITE}
              stroke={INK}
              strokeWidth="2.2"
            />
            {/* Base x */}
            <path
              d="M 63 65 L 67 71 M 67 65 L 63 71"
              stroke={INK}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {/* Exponent 2 */}
            <path
              d="M 69.5 61.8 C 69.5 60.6 71.5 60.6 71.5 61.8 C 71.5 62.8 69.5 63.6 69.5 64.8 H 72"
              stroke={INK}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      );
    }

    case "move-2": {
      return (
        <svg {...svgProps}>
          {/* Floating 3D Bloxorz Island Drop Shadow */}
          <polygon
            points="9,58 45,44 74,58 38,72"
            fill={INK}
            opacity="0.14"
          />

          {/* Floating 3D Stone & Terracotta Bloxorz Tiles */}
          {/* Back-Center Terracotta Fragile Slab */}
          <g>
            <polygon
              points="31,42 47,36 60,43 44,49"
              fill="#FB923C"
              stroke={INK}
              strokeWidth="2.1"
              strokeLinejoin="miter"
            />
            <polygon
              points="31,42 44,49 44,54 31,47"
              fill="#EA580C"
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="miter"
            />
          </g>

          {/* Green Target Hole at top-right (1x1 Bloxorz Goal Shaft) */}
          <g>
            <polygon
              points="47,36 63,30 76,37 60,43"
              fill={GREEN}
              stroke={INK}
              strokeWidth="2.2"
              strokeLinejoin="miter"
            />
            <polygon
              points="51.5,36.2 62.2,32.2 71.2,37 60.5,41"
              fill="#052E16"
              stroke={INK}
              strokeWidth="1.6"
              strokeLinejoin="miter"
            />
            <polygon
              points="60,43 76,37 76,43 60,49"
              fill="#188344"
              stroke={INK}
              strokeWidth="2.1"
              strokeLinejoin="miter"
            />
            <polygon
              points="47,36 60,43 60,49 47,42"
              fill="#22A85A"
              stroke={INK}
              strokeWidth="2.1"
              strokeLinejoin="miter"
            />
          </g>

          {/* Front-Right White Stone Slab */}
          <g>
            <polygon
              points="31,55 44,49 60,43 73,50 44,62"
              fill={WHITE}
              stroke={INK}
              strokeWidth="2.2"
              strokeLinejoin="miter"
            />
            <polygon
              points="31,55 44,62 44,68 31,61"
              fill="#E5E2D9"
              stroke={INK}
              strokeWidth="2.1"
              strokeLinejoin="miter"
            />
            <polygon
              points="44,62 73,50 73,56 44,68"
              fill="#CFCBC0"
              stroke={INK}
              strokeWidth="2.1"
              strokeLinejoin="miter"
            />
          </g>

          {/* Front-Left White Stone Base Slab under Standing 2x1 Block */}
          <g>
            <polygon
              points="6,52 22,46 35,53 19,59"
              fill={WHITE}
              stroke={INK}
              strokeWidth="2.2"
              strokeLinejoin="miter"
            />
            <polygon
              points="6,52 19,59 19,65 6,58"
              fill="#E5E2D9"
              stroke={INK}
              strokeWidth="2.1"
              strokeLinejoin="miter"
            />
            <polygon
              points="19,59 35,53 35,59 19,65"
              fill="#CFCBC0"
              stroke={INK}
              strokeWidth="2.1"
              strokeLinejoin="miter"
            />
          </g>

          {/* Sharp 3D Stacked 2x1 Block (Two sharp-edged NYT Gold cubes — zero curved corners) */}
          {/* Bottom Cube Unit */}
          <g>
            <polygon
              points="9,36 20,42 20,56 9,50"
              fill="#EAB308"
              stroke={INK}
              strokeWidth="2.2"
              strokeLinejoin="miter"
            />
            <polygon
              points="20,42 32,37 32,51 20,56"
              fill="#CA8A04"
              stroke={INK}
              strokeWidth="2.2"
              strokeLinejoin="miter"
            />
          </g>

          {/* Upper Stacked Cube Unit */}
          <g>
            <polygon
              points="9,22 20,28 20,42 9,36"
              fill={YELLOW}
              stroke={INK}
              strokeWidth="2.2"
              strokeLinejoin="miter"
            />
            <polygon
              points="20,28 32,23 32,37 20,42"
              fill="#EAB308"
              stroke={INK}
              strokeWidth="2.2"
              strokeLinejoin="miter"
            />
            <polygon
              points="9,22 21,17 32,23 20,28"
              fill="#FEF08A"
              stroke={INK}
              strokeWidth="2.2"
              strokeLinejoin="miter"
            />
          </g>
        </svg>
      );
    }

    default:
      return (
        <svg {...svgProps}>
          <rect
            x="12"
            y="12"
            width="56"
            height="56"
            rx="10"
            fill={YELLOW}
            stroke={INK}
            strokeWidth="2.5"
          />
        </svg>
      );
  }
}

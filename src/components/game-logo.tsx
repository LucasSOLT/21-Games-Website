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

const ECHO_ANGLES = [-90, -45, 0, 45, 90, 135, 180, 225];

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
    case "letter":
    case "the-11th-hour":
    case "11th-hour":
      return "letter";
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
  letter: "The 11th Hour",
  "move-2": "Move 2",
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
      const coords = [8, 28, 48];
      return (
        <svg {...svgProps}>
          {/* Off-diagonal phonetic grid tiles (all 9 tiles clearly visible) */}
          {coords.map((y, row) =>
            coords.map((x, col) => {
              if (row === col) return null;
              return (
                <g key={`rhyme-cell-${row}-${col}`}>
                  <rect
                    x={x}
                    y={y}
                    width="17"
                    height="17"
                    rx="3.5"
                    fill={WHITE}
                    stroke={INK}
                    strokeWidth="2.5"
                  />
                  <line
                    x1={x + 4.5}
                    y1={y + 8.5}
                    x2={x + 12.5}
                    y2={y + 8.5}
                    stroke={INK}
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.35"
                  />
                </g>
              );
            })
          )}

          {/* Sweeping acoustic soundwave arc connecting the 3 diagonal rhyme tiles */}
          <path
            d="M16.5 16.5 Q 44 10 56.5 56.5"
            stroke={PURPLE}
            strokeWidth="2.5"
            strokeDasharray="3 2.5"
            strokeLinecap="round"
          />
          <path
            d="M16.5 16.5 L36.5 36.5 L56.5 56.5"
            stroke={INK}
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Elevated 3-in-a-row golden rhyme diagonal with hard-offset shadows */}
          {coords.map((pos, idx) => (
            <g key={`rhyme-diag-${idx}`}>
              <rect
                x={pos + 2}
                y={pos + 2}
                width="17"
                height="17"
                rx="3.5"
                fill={INK}
              />
              <rect
                x={pos}
                y={pos}
                width="17"
                height="17"
                rx="3.5"
                fill={YELLOW}
                stroke={INK}
                strokeWidth="2.5"
              />
              <circle cx={pos + 5.2} cy={pos + 8.5} r="1.5" fill={INK} />
              <line
                x1={pos + 8.5}
                y1={pos + 8.5}
                x2={pos + 12.8}
                y2={pos + 8.5}
                stroke={INK}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* Musical resonance / acoustic soundwave badge in upper-right corner */}
          <g>
            <circle cx="67.5" cy="16.5" r="9" fill={INK} />
            <circle
              cx="65.5"
              cy="14.5"
              r="9"
              fill={PURPLE}
              stroke={INK}
              strokeWidth="2.5"
            />
            <circle cx="62" cy="14.5" r="1.5" fill={YELLOW} />
            <path
              d="M64.5 11.5 A 4.2 4.2 0 0 1 64.5 17.5"
              stroke={WHITE}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M67.2 9.5 A 7 7 0 0 1 67.2 19.5"
              stroke={YELLOW}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
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
      const grid = [8, 30, 52];
      return (
        <svg {...svgProps}>
          {/* 3x3 tactical strategy board with golden #F9D423 winning diagonal */}
          {grid.map((y, row) =>
            grid.map((x, col) => {
              const isDiag = row === col;
              return (
                <g key={`win-cell-${row}-${col}`}>
                  {isDiag && (
                    <rect
                      x={x + 2}
                      y={y + 2}
                      width="20"
                      height="20"
                      rx="4"
                      fill={INK}
                    />
                  )}
                  <rect
                    x={x}
                    y={y}
                    width="20"
                    height="20"
                    rx="4"
                    fill={isDiag ? YELLOW : WHITE}
                    stroke={INK}
                    strokeWidth="2.5"
                  />
                  {/* Subtle tactical markers on off-diagonal cells */}
                  {row === 0 && col === 2 && (
                    <path
                      d="M59 15 L65 21 M65 15 L59 21"
                      stroke={INK}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      opacity="0.4"
                    />
                  )}
                  {row === 2 && col === 0 && (
                    <circle
                      cx="18"
                      cy="62"
                      r="3.5"
                      stroke={INK}
                      strokeWidth="2.2"
                      opacity="0.4"
                    />
                  )}
                </g>
              );
            })
          )}

          {/* Bold winning three-in-a-row diagonal line */}
          <line
            x1="15"
            y1="15"
            x2="65"
            y2="65"
            stroke={INK}
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Oversized central golden trophy tile with numeral "1" & crown */}
          <g>
            <rect
              x="25.5"
              y="25.5"
              width="33"
              height="33"
              rx="6"
              fill={INK}
            />
            <rect
              x="23"
              y="23"
              width="33"
              height="33"
              rx="6"
              fill={YELLOW}
              stroke={INK}
              strokeWidth="2.5"
            />
            {/* Mini 3-point crown accent */}
            <path
              d="M33.5 32.5 L35.5 28 L39.5 31 L43.5 28 L45.5 32.5 Z"
              fill={GREEN}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Bold numeral 1 */}
            <path
              d="M36 39 L40 36.5 V49.5 M35.5 49.5 H44.5"
              stroke={INK}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      );
    }

    case "echo": {
      const radius = 25;
      return (
        <svg {...svgProps}>
          {/* Concentric acoustic ripple rings */}
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke={INK}
            strokeWidth="1.8"
            strokeDasharray="3 3"
            opacity="0.5"
          />
          <circle
            cx="40"
            cy="40"
            r="25"
            stroke={INK}
            strokeWidth="2.5"
          />
          <circle
            cx="40"
            cy="40"
            r="14.5"
            fill={WHITE}
            stroke={INK}
            strokeWidth="2"
            strokeDasharray="2.5 2.5"
          />

          {/* 8 orbital word nodes at 45° intervals with progressive echo opacity */}
          {ECHO_ANGLES.map((deg, idx) => {
            const rad = (deg * Math.PI) / 180;
            const cx = 40 + radius * Math.cos(rad);
            const cy = 40 + radius * Math.sin(rad);
            const tileSize = 12;
            const x = cx - tileSize / 2;
            const y = cy - tileSize / 2;
            const echoOpacity = Math.max(0.25, 1 - idx * 0.1);
            return (
              <g key={`echo-node-${idx}`}>
                <rect
                  x={x + 1.5}
                  y={y + 1.5}
                  width={tileSize}
                  height={tileSize}
                  rx="3.2"
                  fill={INK}
                />
                <rect
                  x={x}
                  y={y}
                  width={tileSize}
                  height={tileSize}
                  rx="3.2"
                  fill={WHITE}
                />
                <rect
                  x={x}
                  y={y}
                  width={tileSize}
                  height={tileSize}
                  rx="3.2"
                  fill={idx < 4 ? PURPLE : LAVENDER}
                  fillOpacity={echoOpacity}
                  stroke={INK}
                  strokeWidth="2.5"
                />
              </g>
            );
          })}

          {/* Golden acoustic core */}
          <circle cx="41.8" cy="41.8" r="9" fill={INK} />
          <circle
            cx="40"
            cy="40"
            r="9"
            fill={YELLOW}
            stroke={INK}
            strokeWidth="2.5"
          />
          <circle cx="40" cy="40" r="2.8" fill={INK} />
        </svg>
      );
    }

    case "letter": {
      const cx = 41;
      const cy = 42;
      return (
        <svg {...svgProps}>
          {/* Editorial double-rimmed timepiece bezel with hard-offset shadow */}
          <circle cx={cx + 2.5} cy={cy + 2.5} r="30.5" fill={INK} />
          <circle
            cx={cx}
            cy={cy}
            r="30.5"
            fill={PURPLE}
            stroke={INK}
            strokeWidth="2.5"
          />
          <circle
            cx={cx}
            cy={cy}
            r="26"
            fill={WHITE}
            stroke={INK}
            strokeWidth="2.5"
          />

          {/* Glowing golden wedge for the 11-to-12 final hour (-120 deg to -90 deg) */}
          <path
            d={`M ${cx} ${cy} L ${cx - 13} ${cy - 22.52} A 26 26 0 0 1 ${cx} ${
              cy - 26
            } Z`}
            fill={YELLOW}
          />
          <circle
            cx={cx}
            cy={cy}
            r="26"
            stroke={INK}
            strokeWidth="2.5"
          />

          {/* 12 precision tick marks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = ((i * 30 - 90) * Math.PI) / 180;
            const isCardinal = i % 3 === 0;
            const rInner = isCardinal ? 20.5 : 22.2;
            const rOuter = 25;
            return (
              <line
                key={`tick-${i}`}
                x1={cx + rInner * Math.cos(angle)}
                y1={cy + rInner * Math.sin(angle)}
                x2={cx + rOuter * Math.cos(angle)}
                y2={cy + rOuter * Math.sin(angle)}
                stroke={INK}
                strokeWidth={isCardinal ? "2.5" : "1.8"}
                strokeLinecap="round"
              />
            );
          })}

          {/* Hour & minute hands poised cleanly at 11:00 (exact -90 deg and -120 deg) */}
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - 18.5}
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={cy}
            x2={cx - 8}
            y2={cy - 13.86}
            stroke={INK}
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <circle
            cx={cx}
            cy={cy}
            r="3.8"
            fill={YELLOW}
            stroke={INK}
            strokeWidth="2.5"
          />

          {/* Bold "11" pill badge */}
          <g>
            <rect
              x="7.5"
              y="8.5"
              width="22"
              height="15"
              rx="7.5"
              fill={INK}
            />
            <rect
              x="5.5"
              y="6.5"
              width="22"
              height="15"
              rx="7.5"
              fill={YELLOW}
              stroke={INK}
              strokeWidth="2.5"
            />
            <path
              d="M14 10.8 V17.2 M19 10.8 V17.2"
              stroke={INK}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        </svg>
      );
    }

    case "move-2": {
      const stationaryTiles: Array<[number, number]> = [
        [2, 0],
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 2],
      ];
      return (
        <svg {...svgProps}>
          {/* Dashed recessed target slots at (1,0) and (2,1) */}
          <rect
            x="30"
            y="7"
            width="20"
            height="20"
            rx="4"
            fill={WHITE}
            fillOpacity="0.7"
            stroke={INK}
            strokeWidth="2.5"
            strokeDasharray="3.5 2.5"
          />
          <rect
            x="53"
            y="30"
            width="20"
            height="20"
            rx="4"
            fill={WHITE}
            fillOpacity="0.7"
            stroke={INK}
            strokeWidth="2.5"
            strokeDasharray="3.5 2.5"
          />

          {/* Stationary white puzzle tiles */}
          {stationaryTiles.map(([col, row]) => (
            <rect
              key={`move-stat-${col}-${row}`}
              x={7 + col * 23}
              y={7 + row * 23}
              width="20"
              height="20"
              rx="4"
              fill={WHITE}
              stroke={INK}
              strokeWidth="2.5"
            />
          ))}

          {/* Sliding Tile 1 (Golden #F9D423) shifting right from (0,0) -> (1,0) */}
          <g>
            <rect
              x="11"
              y="9"
              width="20"
              height="20"
              rx="4"
              fill={INK}
            />
            <rect
              x="9"
              y="7"
              width="20"
              height="20"
              rx="4"
              fill={YELLOW}
              stroke={INK}
              strokeWidth="2.5"
            />
            <path
              d="M21.5 17 H42 M37.5 12.5 L42.5 17 L37.5 21.5"
              stroke={WHITE}
              strokeWidth="5.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M21.5 17 H42 M37.5 12.5 L42.5 17 L37.5 21.5"
              stroke={INK}
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Sliding Tile 2 (Vibrant #2ECC71) shifting right from (1,1) -> (2,1) */}
          <g>
            <rect
              x="34"
              y="32"
              width="20"
              height="20"
              rx="4"
              fill={INK}
            />
            <rect
              x="32"
              y="30"
              width="20"
              height="20"
              rx="4"
              fill={GREEN}
              stroke={INK}
              strokeWidth="2.5"
            />
            <path
              d="M44.5 40 H65 M60.5 35.5 L65.5 40 L60.5 44.5"
              stroke={WHITE}
              strokeWidth="5.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M44.5 40 H65 M60.5 35.5 L65.5 40 L60.5 44.5"
              stroke={INK}
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
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

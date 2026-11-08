import type { SVGProps } from "react";

export interface SolGamesLogoProps extends SVGProps<SVGSVGElement> {
  variant?: "full" | "mark" | "wordmark";
  size?: number | string;
  className?: string;
  showSubtitle?: boolean;
  title?: string;
}

/**
 * SolGamesLogo
 * Minimalist NYT-aesthetic vector logo for 21 Games (SOL GaMES).
 * Features:
 * - Square editorial "21" tile with crisp 2.5px solid black border and hard-offset drop shadow
 * - Signature 3-game accent dots: Yellow (9 Rhymes), Green (Connect 5), Purple (21 Things)
 * - Pure vector paths for numeral "21" (no font metrics shift or delay)
 * - Editorial slab-serif wordmark "SOL GaMES" with geometric sans subtitle "BY SOL THEORY"
 */
export function SolGamesLogo({
  variant = "full",
  size,
  className = "",
  showSubtitle = true,
  title = "SOL GaMES by SOL Theory",
  ...props
}: SolGamesLogoProps) {
  // Mark tile geometry: viewBox 0 0 48 48
  const renderMark = () => (
    <g className="solgames-mark">
      {/* Hard Offset Drop Shadow */}
      <rect x="7" y="7" width="37" height="37" rx="7" fill="#171717" />
      {/* White Tile Face with Crisp Border */}
      <rect
        x="4"
        y="4"
        width="37"
        height="37"
        rx="7"
        fill="#FFFFFF"
        stroke="#171717"
        strokeWidth="2.5"
      />

      {/* 3 Signature Game Accent Dots */}
      {/* 9 Rhymes: Gold/Yellow */}
      <circle
        cx="15"
        cy="12"
        r="2.3"
        fill="#F9D423"
        stroke="#171717"
        strokeWidth="1.4"
      />
      {/* Connect 5: Green */}
      <circle
        cx="22.5"
        cy="12"
        r="2.3"
        fill="#2ECC71"
        stroke="#171717"
        strokeWidth="1.4"
      />
      {/* 21 Things: Purple */}
      <circle
        cx="30"
        cy="12"
        r="2.3"
        fill="#9D50BB"
        stroke="#171717"
        strokeWidth="1.4"
      />

      {/* "21" Numeral in Editorial Slab-Serif (Vector Paths) */}
      {/* Digit 2 */}
      <path
        d="M 12 21.5 C 12 18.2 14.5 16.5 18 16.5 C 21.6 16.5 24 18.3 24 21 C 24 23.6 22 26 19 28.8 L 14.5 32.8 L 24.5 32.8 L 24.5 36 L 11.5 36 L 11.5 33 L 17 28 C 20.2 25 21.2 23.5 21.2 21.2 C 21.2 19.5 19.8 18.5 18 18.5 C 15.8 18.5 14.6 19.8 14.5 21.5 Z"
        fill="#171717"
      />
      {/* Digit 1 */}
      <path
        d="M 28 19.5 L 25.5 21 V 18.8 L 28.5 16.8 L 30.5 16.8 L 30.5 32.8 L 33.5 32.8 L 33.5 36 L 25.5 36 L 25.5 32.8 L 28 32.8 Z"
        fill="#171717"
      />
    </g>
  );

  // Wordmark typography
  const renderWordmark = (offsetX = 54) => (
    <g className="solgames-wordmark">
      {/* Primary Brand Name: SOL GaMES in Editorial Slab-Serif */}
      <text
        x={offsetX}
        y={showSubtitle ? "26.5" : "30"}
        fontFamily="var(--font-roboto-slab), 'Roboto Slab', Georgia, 'Times New Roman', serif"
        fontSize="22"
        fontWeight="900"
        fill="#171717"
        letterSpacing="-0.4"
      >
        SOL GaMES
      </text>

      {/* Eyebrow / Attribution: BY SOL THEORY in Geometric Sans */}
      {showSubtitle && (
        <text
          x={offsetX + 0.5}
          y="38"
          fontFamily="var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontSize="8.5"
          fontWeight="700"
          fill="#71717A"
          letterSpacing="1.8"
        >
          BY SOL THEORY
        </text>
      )}
    </g>
  );

  if (variant === "mark") {
    const markHeight = size ?? 36;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        height={markHeight}
        width={markHeight}
        fill="none"
        role="img"
        aria-label={title}
        className={`select-none shrink-0 inline-block align-middle ${className}`}
        {...props}
      >
        <title>{title}</title>
        {renderMark()}
      </svg>
    );
  }

  if (variant === "wordmark") {
    const wordmarkHeight = size ?? 28;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 160 48"
        height={wordmarkHeight}
        width="auto"
        fill="none"
        role="img"
        aria-label={title}
        className={`select-none shrink-0 inline-block align-middle ${className}`}
        {...props}
      >
        <title>{title}</title>
        {renderWordmark(2)}
      </svg>
    );
  }

  // Default: "full" horizontal lockup
  const fullHeight = size ?? 42;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 212 48"
      height={fullHeight}
      width="auto"
      fill="none"
      role="img"
      aria-label={title}
      className={`select-none shrink-0 inline-block align-middle ${className}`}
      {...props}
    >
      <title>{title}</title>
      {renderMark()}
      {renderWordmark(54)}
    </svg>
  );
}

export default SolGamesLogo;

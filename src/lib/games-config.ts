export type GameColor =
  | "yellow"
  | "green"
  | "purple"
  | "grey"
  | "customPurple"
  | "customYellow"
  | "customPurple2"
  | "customYellow2"
  | "customF4D621";

/** All 9 games in strict `21 → 1` countdown order. */
export const ALL_GAME_SLUGS = [
  "21-things",
  "17-syllables",
  "9-rhymes",
  "eightfold-echo",
  "6-pics",
  "connect-5",
  "four-score",
  "move-2",
  "1-win",
] as const;

export type AllGameSlug = (typeof ALL_GAME_SLUGS)[number];

/**
 * Slugs of games that can be (or will be) playable. Whether a slug is live right now is
 * decided at runtime by `isPlayableGameSlug` (driven by `isPlayable` in `ALL_GAMES`).
 */
export type PlayableGameSlug = AllGameSlug;

/** Countdown number for each game (`21 → 17 → 9 → 8 → 6 → 5 → 4 → 2 → 1`). */
export const GAME_COUNTDOWN_NUMBER: Record<AllGameSlug, number> = {
  "21-things": 21,
  "17-syllables": 17,
  "9-rhymes": 9,
  "eightfold-echo": 8,
  "6-pics": 6,
  "connect-5": 5,
  "four-score": 4,
  "move-2": 2,
  "1-win": 1,
};

/** Solid accent hex per game (archive headers, switcher pills, stats chips). */
export const GAME_ACCENT_HEX: Record<AllGameSlug, string> = {
  "21-things": "#daa8d0",
  "17-syllables": "#b6df52",
  "9-rhymes": "#f7da21",
  "eightfold-echo": "#daa8d0",
  "6-pics": "#f4d621",
  "connect-5": "#2ECC71",
  "four-score": "#F9D423",
  "move-2": "#b6df52",
  "1-win": "#e0e1d9",
};

/** localStorage key prefix used for per-date saved progress (self-healing reset). */
export const GAME_PROGRESS_PREFIX: Record<AllGameSlug, string> = {
  "21-things": "solgames_v1_21t_progress_",
  "17-syllables": "solgames_v1_17s_progress_",
  "9-rhymes": "solgames_v1_9r_progress_",
  "eightfold-echo": "solgames_v1_8e_progress_",
  "6-pics": "solgames_v1_6p_progress_",
  "connect-5": "solgames_v1_c5_progress_",
  "four-score": "solgames_v1_4s_progress_",
  "move-2": "solgames_v1_m2_progress_",
  "1-win": "solgames_v1_1w_progress_",
};

/** Short-link prefixes for `?b=<prefix>-<8chars>` custom games (showCreate games only). */
export const CUSTOM_LINK_PREFIX = {
  "21-things": "21t",
  "17-syllables": "17s",
  "9-rhymes": "9r",
  "6-pics": "6p",
  "connect-5": "c5",
} as const;

export type CustomLinkGameSlug = keyof typeof CUSTOM_LINK_PREFIX;

export interface GameConfig {
  id?: string;
  name: string;
  slug: string;
  color: GameColor;
  logo: string;
  showCreate: boolean;
  isPlayable: boolean;
  tagline: string;
  description: string;
}

export const ALL_GAMES: GameConfig[] = [
  {
    name: "21 Things",
    color: "customPurple2",
    logo: "things",
    slug: "21-things",
    showCreate: true,
    isPlayable: true,
    tagline: "21 → 6 → 3 → 1 gratitude funnel",
    description:
      "Curate a board of 21 things you love and narrow down 21 → 6 → 3 → 1 to what resonates most.",
  },
  {
    name: "17 Syllables",
    color: "green",
    logo: "syllables",
    slug: "17-syllables",
    showCreate: true,
    isPlayable: true,
    tagline: "Daily 5-7-5 haiku puzzle",
    description: "Arrange poetic fragments into a 5-7-5 daily haiku.",
  },
  {
    name: "9 Rhymes",
    color: "customYellow2",
    logo: "rhymes",
    slug: "9-rhymes",
    showCreate: true,
    isPlayable: true,
    tagline: "Daily rhyming text chat",
    description:
      "Text with Nine to solve 9 daily rhyming clues in an iMessage-style chat.",
  },
  {
    name: "Eightfold Echo",
    color: "customPurple2",
    logo: "echo",
    slug: "eightfold-echo",
    showCreate: false,
    isPlayable: true,
    tagline: "3×3 shape logic sequence",
    description:
      "Follow visual logic rules to deduce the 8-step sequence across a 3×3 grid.",
  },
  {
    name: "6 Pics",
    color: "customF4D621",
    logo: "6-pics",
    slug: "6-pics",
    showCreate: true,
    isPlayable: true,
    tagline: "6 hidden pictures, 1 theme",
    description:
      "Use the overarching theme and reveal as few puzzle pieces as possible to name all 6 hidden pictures.",
  },
  {
    name: "Connect 5",
    color: "grey",
    logo: "connect",
    slug: "connect-5",
    showCreate: true,
    isPlayable: true,
    tagline: "5-word compound chain puzzle",
    description:
      "Complete the 5-row word chain where each word connects with the word above it.",
  },
  {
    id: "four-score",
    name: "Four Score",
    color: "yellow",
    logo: "four-score",
    slug: "four-score",
    showCreate: false,
    isPlayable: true,
    tagline: "Reach 80 math puzzle",
    description:
      "Combine four numbers with basic arithmetic and squares to hit the target score of 80.",
  },
  {
    name: "Move Two",
    color: "green",
    logo: "move-2",
    slug: "move-2",
    showCreate: false,
    isPlayable: true,
    tagline: "5×5 3D cube block puzzle",
    description:
      "Move the 3D 2×1 block across 6 5×5 cube faces and drop into each hole.",
  },
  {
    name: "1 Win",
    color: "grey",
    logo: "win",
    slug: "1-win",
    showCreate: false,
    isPlayable: true,
    tagline: "Daily community win",
    description:
      "Share 1 win from your day and see how many players around the world share it.",
  },
];

export const PLAYABLE_GAMES = ALL_GAMES.filter((g) => g.isPlayable);

export function getGameBySlug(slug: string): GameConfig | undefined {
  return ALL_GAMES.find((g) => g.slug === slug);
}

export function isAllGameSlug(slug: string): slug is AllGameSlug {
  return (ALL_GAME_SLUGS as readonly string[]).includes(slug);
}

export function isPlayableGameSlug(slug: string): slug is PlayableGameSlug {
  return ALL_GAMES.some((g) => g.slug === slug && g.isPlayable);
}

/** Slugs of every game that currently has a live daily puzzle + archive (static params). */
export function getPlayableGameSlugs(): PlayableGameSlug[] {
  return ALL_GAMES.filter((g) => g.isPlayable).map(
    (g) => g.slug as PlayableGameSlug
  );
}

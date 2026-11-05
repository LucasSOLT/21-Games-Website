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

export type PlayableGameSlug = "21-things" | "connect-5";

export interface GameConfig {
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
    name: "9 Rhymes",
    color: "customYellow2",
    logo: "rhymes",
    slug: "9-rhymes",
    showCreate: true,
    isPlayable: false,
    tagline: "Rhyming grid deduction",
    description: "Connect nine rhyming clues across a 3×3 phonetic board.",
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
    isPlayable: false,
    tagline: "Daily 5-7-5 haiku puzzle",
    description: "Arrange poetic fragments into a 5-7-5 daily haiku.",
  },
  {
    name: "6 Pics",
    color: "customF4D621",
    logo: "6-pics",
    slug: "6-pics",
    showCreate: true,
    isPlayable: false,
    tagline: "Visual connection puzzle",
    description: "Find the hidden theme linking six daily visual clues.",
  },
  {
    name: "1 Win",
    color: "grey",
    logo: "win",
    slug: "1-win",
    showCreate: false,
    isPlayable: false,
    tagline: "One winning move",
    description: "Find the single winning sequence on a 3×3 tactical board.",
  },
  {
    name: "Eightfold Echo",
    color: "customPurple2",
    logo: "echo",
    slug: "eightfold-echo",
    showCreate: false,
    isPlayable: false,
    tagline: "Circular word ring",
    description: "Loop eight overlapping words around the center echo ring.",
  },
  {
    name: "The 11th Hour",
    color: "grey",
    logo: "letter",
    slug: "the-11th-hour",
    showCreate: false,
    isPlayable: false,
    tagline: "Beat the final-hour clock",
    description: "Solve 11 rapid-fire word clues before the clock strikes 12.",
  },
  {
    name: "Move 2",
    color: "green",
    logo: "move-2",
    slug: "move-2",
    showCreate: false,
    isPlayable: false,
    tagline: "Two-step tile shift",
    description: "Rearrange the board in exactly two strategic tile moves.",
  },
];

export const PLAYABLE_GAMES = ALL_GAMES.filter((g) => g.isPlayable);

export function getGameBySlug(slug: string): GameConfig | undefined {
  return ALL_GAMES.find((g) => g.slug === slug);
}

export function isPlayableGameSlug(slug: string): slug is PlayableGameSlug {
  return slug === "21-things" || slug === "connect-5";
}

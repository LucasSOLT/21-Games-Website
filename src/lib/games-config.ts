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

export type PlayableGameSlug = "21-things" | "connect-5" | "17-syllables";

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
    isPlayable: false,
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
    isPlayable: false,
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
    isPlayable: false,
    tagline: "Progressive 6-image deduction",
    description:
      "Deduce the overarching secret theme connecting six progressive visual clues.",
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
    isPlayable: false,
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
    isPlayable: false,
    tagline: "3×3 cube domino puzzle",
    description:
      "Roll the 3D domino across 6 cube faces to land on the red target.",
  },
  {
    name: "1 Win",
    color: "grey",
    logo: "win",
    slug: "1-win",
    showCreate: false,
    isPlayable: false,
    tagline: "Daily community win",
    description:
      "Share 1 win from your day and see how many players around the world share it.",
  },
];

export const PLAYABLE_GAMES = ALL_GAMES.filter((g) => g.isPlayable);

export function getGameBySlug(slug: string): GameConfig | undefined {
  return ALL_GAMES.find((g) => g.slug === slug);
}

export function isPlayableGameSlug(slug: string): slug is PlayableGameSlug {
  return slug === "21-things" || slug === "connect-5" || slug === "17-syllables";
}

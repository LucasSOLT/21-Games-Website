/**
 * 6 Pics (`6-pics`) — 66-day progressive 6-image theme deduction puzzle bank + seeded fallback.
 *
 * Every puzzle has 6 progressive illustrated visual clues (label-free during gameplay,
 * captioned in a 2×3 summary grid post-game per `GAME_DESIGN_BIBLE.md` Q27–Q33) and
 * pre-populated accepted synonyms/aliases.
 */

import {
  SIX_PICS_COUNT,
  SIX_PICS_SCENES,
  buildSixPicsEmojiReceipt,
  buildSixPicsShareText,
  draftToSixPicsPuzzle,
  isSixPicsPuzzle,
  levenshteinDistance,
  matchSixPicsGuess,
  normalizeSixPicsText,
  renderSixPicsSceneDataUri,
  renderSixPicsSceneSvg,
  scoreForSixPics,
  validateSixPicsPuzzle,
  type SixPicsAttempt,
  type SixPicsClueImage,
  type SixPicsDraftRow,
  type SixPicsMatchResult,
  type SixPicsPuzzle,
  type SixPicsSceneKey,
  type SixPicsValidation,
} from "@/lib/six-pics-engine";
import { localSixPicsSynonyms } from "@/lib/ai-helper";
import { fnv1a32 } from "@/lib/seeded-random";

export {
  SIX_PICS_COUNT,
  SIX_PICS_SCENES,
  buildSixPicsEmojiReceipt,
  buildSixPicsShareText,
  draftToSixPicsPuzzle,
  isSixPicsPuzzle,
  levenshteinDistance,
  matchSixPicsGuess,
  normalizeSixPicsText,
  renderSixPicsSceneDataUri,
  renderSixPicsSceneSvg,
  scoreForSixPics,
  validateSixPicsPuzzle,
  type SixPicsAttempt,
  type SixPicsClueImage,
  type SixPicsDraftRow,
  type SixPicsMatchResult,
  type SixPicsPuzzle,
  type SixPicsSceneKey,
  type SixPicsValidation,
};

export const SIX_PICS_BANK_SIZE = 66;

type SeedEntry = [
  theme: string,
  aliases: string[],
  clues: [
    [string, SixPicsSceneKey],
    [string, SixPicsSceneKey],
    [string, SixPicsSceneKey],
    [string, SixPicsSceneKey],
    [string, SixPicsSceneKey],
    [string, SixPicsSceneKey],
  ],
];

const CURATED_THEMES: readonly SeedEntry[] = [
  [
    "Hawaii",
    ["hawaiian islands", "aloha state", "maui", "oahu", "honolulu"],
    [
      ["Ocean", "waves"],
      ["Volcano", "volcano"],
      ["Island", "palm-island"],
      ["Surfing", "surfboard"],
      ["Luau Fire", "campfire"],
      ["Hula Lei", "flower-lei"],
    ],
  ],
  [
    "Camping",
    ["campsite", "campout", "camping trip", "great outdoors"],
    [
      ["Pine Woods", "pine-trees"],
      ["Compass", "compass"],
      ["Trail Pack", "backpack"],
      ["Lantern", "lantern"],
      ["Campfire", "campfire"],
      ["Pitched Tent", "tent"],
    ],
  ],
  [
    "Coffee Shop",
    ["cafe", "coffeehouse", "espresso bar", "local cafe"],
    [
      ["Bistro Table", "cafe-table"],
      ["Acoustic Playlist", "headphones"],
      ["Paperback Read", "book"],
      ["Warm Croissant", "croissant"],
      ["Roasted Beans", "beans"],
      ["Hot Espresso", "coffee-cup"],
    ],
  ],
  [
    "Outer Space",
    ["solar system", "astronomy", "cosmos", "space exploration", "space"],
    [
      ["Night Sky", "stars-sky"],
      ["Crescent Moon", "moon-crescent"],
      ["Telescope", "telescope"],
      ["Shooting Meteor", "meteor"],
      ["Ringed Planet", "planet-ring"],
      ["Rocket Launch", "rocket"],
    ],
  ],
  [
    "Birthday Party",
    ["birthday", "birthday celebration", "bday party", "party"],
    [
      ["Invitation Card", "envelope"],
      ["Confetti", "confetti"],
      ["Party Hat", "party-hat"],
      ["Wrapped Present", "gift-box"],
      ["Helium Balloons", "balloons"],
      ["Birthday Cake", "cake-candles"],
    ],
  ],
  [
    "Movie Night",
    ["cinema", "movie theater", "hollywood", "at the movies", "movies"],
    [
      ["Bright Spotlight", "spotlight"],
      ["Red Carpet", "red-carpet"],
      ["Admit One Stub", "ticket"],
      ["Film Reel", "film-reel"],
      ["Clapperboard", "clapperboard"],
      ["Buttered Popcorn", "popcorn"],
    ],
  ],
  [
    "Winter Cabin",
    ["cozy winter", "snow day", "winter", "ski lodge", "snowy day"],
    [
      ["Pinecone", "pinecone"],
      ["Falling Snow", "snowflake"],
      ["Wool Mittens", "mittens"],
      ["Wooden Sled", "sled"],
      ["Hot Cocoa", "mug-steam"],
      ["Brick Fireplace", "fireplace"],
    ],
  ],
  [
    "Sailing",
    ["nautical", "harbor", "seafaring", "ocean voyage", "yachting"],
    [
      ["Gliding Gull", "seagull"],
      ["Seashell", "seashell"],
      ["Binoculars", "binoculars"],
      ["Iron Anchor", "anchor"],
      ["Lighthouse", "lighthouse"],
      ["Sailboat", "sailboat"],
    ],
  ],
  [
    "Rock Concert",
    ["live music", "concert", "music festival", "band"],
    [
      ["Music Notes", "music-notes"],
      ["Vinyl Record", "vinyl"],
      ["Piano Keys", "piano-keys"],
      ["Acoustic Guitar", "guitar"],
      ["Vocal Mic", "microphone"],
      ["Main Stage", "stage"],
    ],
  ],
  [
    "Pizzeria",
    ["pizza", "making pizza", "italian kitchen", "pizza night"],
    [
      ["Olive Branch", "olive-branch"],
      ["Ripe Tomato", "tomato"],
      ["Rolling Pin", "rolling-pin"],
      ["Chef Toque", "chef-hat"],
      ["Brick Oven", "oven-flame"],
      ["Pepperoni Slice", "pizza-slice"],
    ],
  ],
  [
    "World Travel",
    ["vacation", "international travel", "globetrotting", "traveling", "travel"],
    [
      ["World Globe", "globe"],
      ["Camera", "camera"],
      ["City Bike", "bicycle"],
      ["Packed Suitcase", "suitcase"],
      ["Blue Passport", "passport"],
      ["Jetliner", "airplane"],
    ],
  ],
  [
    "Fairy Tale",
    ["medieval fantasy", "fantasy kingdom", "knights and dragons", "storybook"],
    [
      ["Secret Key", "treasure-key"],
      ["Heraldic Shield", "shield"],
      ["Silver Sword", "sword"],
      ["Dragon Wing", "dragon-wing"],
      ["Golden Crown", "crown"],
      ["Stone Castle", "castle"],
    ],
  ],
  [
    "Gardening",
    ["garden", "spring garden", "backyard garden", "botany"],
    [
      ["Sprouting Seed", "seedling"],
      ["Wheelbarrow", "wheelbarrow"],
      ["Watering Can", "watering-can"],
      ["Honeybee Hive", "bee-hive"],
      ["Monarch Butterfly", "butterfly"],
      ["Tall Sunflower", "sunflower"],
    ],
  ],
  [
    "Game Night",
    ["board games", "family game night", "tabletop games", "board game"],
    [
      ["Sand Timer", "hourglass"],
      ["Playing Card", "playing-card"],
      ["Jigsaw Piece", "puzzle-piece"],
      ["Rolling Dice", "dice"],
      ["Chess Knight", "chess-knight"],
      ["Winner Trophy", "trophy"],
    ],
  ],
  [
    "Beach Vacation",
    ["beach day", "tropical beach", "seaside", "summer beach"],
    [
      ["Bright Sun", "sun"],
      ["Coastal Gull", "seagull"],
      ["Seashell", "seashell"],
      ["Rolling Waves", "waves"],
      ["Surfboard", "surfboard"],
      ["Palm Island", "palm-island"],
    ],
  ],
  [
    "Stargazing",
    ["night sky", "meteor shower", "astronomy club", "observatory"],
    [
      ["Compass", "compass"],
      ["Camp Lantern", "lantern"],
      ["Starry Sky", "stars-sky"],
      ["Crescent Moon", "moon-crescent"],
      ["Bright Meteor", "meteor"],
      ["Brass Telescope", "telescope"],
    ],
  ],
  [
    "Sunday Morning",
    ["lazy sunday", "cozy morning", "morning routine", "breakfast"],
    [
      ["Morning Sun", "sun"],
      ["Good Book", "book"],
      ["Headphones", "headphones"],
      ["Fresh Croissant", "croissant"],
      ["Coffee Beans", "beans"],
      ["Steaming Cup", "coffee-cup"],
    ],
  ],
  [
    "Snow Day",
    ["blizzard", "winter holiday", "sledding", "snowfall"],
    [
      ["Evergreens", "pine-trees"],
      ["Ice Crystal", "snowflake"],
      ["Cozy Mittens", "mittens"],
      ["Hill Sled", "sled"],
      ["Warm Hearth", "fireplace"],
      ["Steaming Mug", "mug-steam"],
    ],
  ],
  [
    "Film Festival",
    ["premiere", "oscars", "award show", "hollywood premiere"],
    [
      ["Golden Envelope", "envelope"],
      ["Stage Spotlight", "spotlight"],
      ["VIP Ticket", "ticket"],
      ["Red Carpet", "red-carpet"],
      ["Director Slate", "clapperboard"],
      ["Award Trophy", "trophy"],
    ],
  ],
  [
    "Treasure Hunt",
    ["pirates", "pirate adventure", "buried treasure", "island quest"],
    [
      ["Old Compass", "compass"],
      ["Spyglass", "binoculars"],
      ["Tall Ship", "sailboat"],
      ["Iron Anchor", "anchor"],
      ["Deserted Atoll", "palm-island"],
      ["Skeleton Key", "treasure-key"],
    ],
  ],
  [
    "Recording Studio",
    ["making an album", "music studio", "album", "musician"],
    [
      ["Sheet Notes", "music-notes"],
      ["Studio Headphones", "headphones"],
      ["Grand Keys", "piano-keys"],
      ["Six-String", "guitar"],
      ["Condenser Mic", "microphone"],
      ["Pressed Vinyl", "vinyl"],
    ],
  ],
  [
    "Bakery",
    ["french bakery", "patisserie", "baking", "pastry shop"],
    [
      ["Hot Oven", "oven-flame"],
      ["Wooden Pin", "rolling-pin"],
      ["Baker Hat", "chef-hat"],
      ["Espresso Pairing", "coffee-cup"],
      ["Frosted Cake", "cake-candles"],
      ["Flaky Croissant", "croissant"],
    ],
  ],
  [
    "Backpacking",
    ["hiking", "mountain trail", "trekking", "wilderness hike"],
    [
      ["Tall Pines", "pine-trees"],
      ["Pocket Compass", "compass"],
      ["Field Binoculars", "binoculars"],
      ["Trail Camera", "camera"],
      ["Night Tent", "tent"],
      ["Rucksack", "backpack"],
    ],
  ],
  [
    "Summer Tour",
    ["eurotrip", "sightseeing", "holiday abroad", "backpacking europe"],
    [
      ["Spinning Globe", "globe"],
      ["Flight Out", "airplane"],
      ["Stamped Passport", "passport"],
      ["Street Cafe", "cafe-table"],
      ["Rental Bicycle", "bicycle"],
      ["Travel Camera", "camera"],
    ],
  ],
  [
    "New Year's Eve",
    ["new years", "midnight countdown", "celebration", "nye"],
    [
      ["Countdown Glass", "hourglass"],
      ["Starlit Midnight", "stars-sky"],
      ["Party Balloons", "balloons"],
      ["Festive Hat", "party-hat"],
      ["Falling Confetti", "confetti"],
      ["Midnight Spotlight", "spotlight"],
    ],
  ],
  [
    "Coastal Town",
    ["fishing village", "new england coast", "seaport", "cape cod"],
    [
      ["Harbor Gull", "seagull"],
      ["Sandy Shell", "seashell"],
      ["Rolling Surf", "waves"],
      ["Heavy Anchor", "anchor"],
      ["Day Sailer", "sailboat"],
      ["Point Lighthouse", "lighthouse"],
    ],
  ],
  [
    "Medieval Tournament",
    ["jousting", "camelot", "royal court", "chivalry"],
    [
      ["War Banner Stage", "stage"],
      ["Carved Knight", "chess-knight"],
      ["Broad Sword", "sword"],
      ["Painted Shield", "shield"],
      ["Royal Crown", "crown"],
      ["Turret Castle", "castle"],
    ],
  ],
  [
    "Farmers Market",
    ["local market", "organic harvest", "country market", "harvest"],
    [
      ["Garden Barrow", "wheelbarrow"],
      ["Fresh Herbs", "seedling"],
      ["Orchard Olive", "olive-branch"],
      ["Local Honey", "bee-hive"],
      ["Vine Tomato", "tomato"],
      ["Cut Sunflowers", "sunflower"],
    ],
  ],
  [
    "Bookstore",
    ["library", "reading nook", "book club", "quiet library"],
    [
      ["Reading Lamp", "lantern"],
      ["Corner Table", "cafe-table"],
      ["Warm Tea Mug", "mug-steam"],
      ["Hourglass Quiet", "hourglass"],
      ["Soft Headphones", "headphones"],
      ["Open Hardcover", "book"],
    ],
  ],
  [
    "Moon Landing",
    ["apollo", "astronaut", "space mission", "lunar mission"],
    [
      ["Deep Cosmos", "stars-sky"],
      ["Home World", "globe"],
      ["Observatory Lens", "telescope"],
      ["Orbiting Saturn", "planet-ring"],
      ["Booster Rocket", "rocket"],
      ["Lunar Crescent", "moon-crescent"],
    ],
  ],
  [
    "Graduation",
    ["commencement", "graduation day", "diploma", "grad party"],
    [
      ["Auditorium Stage", "stage"],
      ["Sealed Diploma", "envelope"],
      ["Wrapped Gift", "gift-box"],
      ["Photo Memories", "camera"],
      ["Tossed Confetti", "confetti"],
      ["Honor Trophy", "trophy"],
    ],
  ],
  [
    "Italian Dinner",
    ["trattoria", "rome", "mediterranean food", "tuscan dinner"],
    [
      ["Bistro Table", "cafe-table"],
      ["Pressed Olives", "olive-branch"],
      ["San Marzano", "tomato"],
      ["Wood-Fired Oven", "oven-flame"],
      ["Hot Slice", "pizza-slice"],
      ["After-Dinner Espresso", "coffee-cup"],
    ],
  ],
  [
    "Island Hopping",
    ["archipelago", "caribbean cruise", "tropical cruise", "polynesia"],
    [
      ["Warm Sun", "sun"],
      ["Passport Stamp", "passport"],
      ["White Sails", "sailboat"],
      ["Turquoise Waves", "waves"],
      ["Flower Garland", "flower-lei"],
      ["Lagoon Atoll", "palm-island"],
    ],
  ],
];

const EDITORIAL_SUBTITLES: readonly string[] = [
  "Connect the Six",
  "Visual Thread",
  "Shared Horizon",
  "Hidden Motif",
  "Six Clues, One World",
  "Spot the Link",
  "Picture Trail",
  "Unifying Theme",
];

function buildBank(): SixPicsPuzzle[] {
  const bank: SixPicsPuzzle[] = [];
  for (let i = 0; i < SIX_PICS_BANK_SIZE; i++) {
    const base = CURATED_THEMES[i % CURATED_THEMES.length]!;
    const variant = Math.floor(i / CURATED_THEMES.length);
    const [theme, curatedAliases, rawClues] = base;
    // Second pass rotates starting clue perspective slightly while keeping #6 clincher strong.
    const clues =
      variant === 0
        ? rawClues
        : ([
            rawClues[1]!,
            rawClues[0]!,
            rawClues[3]!,
            rawClues[2]!,
            rawClues[4]!,
            rawClues[5]!,
          ] as typeof rawClues);

    const autoAliases = localSixPicsSynonyms(theme);
    const mergedAliases = [
      ...new Set(
        [...curatedAliases, ...autoAliases].filter(
          (a) => normalizeSixPicsText(a) !== normalizeSixPicsText(theme)
        )
      ),
    ].slice(0, 16);

    bank.push({
      id: `6p-bank-${String(i + 1).padStart(2, "0")}`,
      puzzleNumber: i + 1,
      title: EDITORIAL_SUBTITLES[i % EDITORIAL_SUBTITLES.length]!,
      themeAnswer: theme,
      acceptedAliases: mergedAliases,
      images: clues.map(([caption, scene]) => ({ caption, scene })),
      author: "SOL Theory",
      editor: "Daily Editorial",
    });
  }
  return bank;
}

/** 66-day curated 6 Pics puzzle bank. */
export const SIX_PICS_PUZZLES: SixPicsPuzzle[] = buildBank();

/** Deterministic date-seeded fallback keyed by `6-pics:${dateKey}`. */
export function generateSeededSixPicsPuzzle(
  dateKey: string,
  puzzleNumber: number
): SixPicsPuzzle {
  const idx = fnv1a32(`6-pics:${dateKey}`) % SIX_PICS_PUZZLES.length;
  const base = SIX_PICS_PUZZLES[idx]!;
  return {
    ...base,
    id: `6p-seed-${dateKey}`,
    puzzleNumber,
    customDate: dateKey,
  };
}

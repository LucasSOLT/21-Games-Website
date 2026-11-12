/**
 * 6 Pics (`6-pics`) — 66-day 6-piece jigsaw image-naming puzzle bank + seeded fallback.
 *
 * Every puzzle displays its overarching theme at the top and presents 6 hidden pictures
 * covered by 6 interlocking jigsaw pieces each (5 covering at start, 1/6 visible),
 * with rich per-image accepted synonyms/aliases (`GAME_DESIGN_BIBLE.md` Q27–Q33).
 */

import {
  SCENE_DEFAULT_ALIASES,
  SIX_PICS_COUNT,
  SIX_PICS_JIGSAW_PIECES,
  SIX_PICS_JIGSAW_VIEWBOX,
  SIX_PICS_MAX_IMAGE_SCORE,
  SIX_PICS_MAX_SCORE,
  SIX_PICS_PIECES_PER_IMAGE,
  SIX_PICS_SCENES,
  buildSixPicsEmojiReceipt,
  buildSixPicsShareText,
  draftToSixPicsPuzzle,
  getInitialRevealedPiece,
  isSixPicsPuzzle,
  levenshteinDistance,
  matchSixPicsGuess,
  matchSixPicsImageGuess,
  normalizeSixPicsText,
  pickNextRandomPiece,
  renderSixPicsSceneDataUri,
  renderSixPicsSceneSvg,
  scoreForSixPics,
  scoreForSixPicsImage,
  totalScoreForSixPics,
  validateSixPicsPuzzle,
  type JigsawPieceSpec,
  type SixPicsAttempt,
  type SixPicsClueImage,
  type SixPicsDraftRow,
  type SixPicsImageOutcome,
  type SixPicsMatchResult,
  type SixPicsPuzzle,
  type SixPicsSceneKey,
  type SixPicsValidation,
} from "@/lib/six-pics-engine";
import { localSixPicsSynonyms } from "@/lib/ai-helper";
import { fnv1a32 } from "@/lib/seeded-random";

export {
  SCENE_DEFAULT_ALIASES,
  SIX_PICS_COUNT,
  SIX_PICS_JIGSAW_PIECES,
  SIX_PICS_JIGSAW_VIEWBOX,
  SIX_PICS_MAX_IMAGE_SCORE,
  SIX_PICS_MAX_SCORE,
  SIX_PICS_PIECES_PER_IMAGE,
  SIX_PICS_SCENES,
  buildSixPicsEmojiReceipt,
  buildSixPicsShareText,
  draftToSixPicsPuzzle,
  getInitialRevealedPiece,
  isSixPicsPuzzle,
  levenshteinDistance,
  matchSixPicsGuess,
  matchSixPicsImageGuess,
  normalizeSixPicsText,
  pickNextRandomPiece,
  renderSixPicsSceneDataUri,
  renderSixPicsSceneSvg,
  scoreForSixPics,
  scoreForSixPicsImage,
  totalScoreForSixPics,
  validateSixPicsPuzzle,
  type JigsawPieceSpec,
  type SixPicsAttempt,
  type SixPicsClueImage,
  type SixPicsDraftRow,
  type SixPicsImageOutcome,
  type SixPicsMatchResult,
  type SixPicsPuzzle,
  type SixPicsSceneKey,
  type SixPicsValidation,
};

export const SIX_PICS_BANK_SIZE = 66;

type ClueSeed = [caption: string, scene: SixPicsSceneKey, extraAliases?: readonly string[]];

type SeedEntry = [
  theme: string,
  aliases: string[],
  clues: [ClueSeed, ClueSeed, ClueSeed, ClueSeed, ClueSeed, ClueSeed],
];

const CURATED_THEMES: readonly SeedEntry[] = [
  [
    "Hawaii",
    ["hawaiian islands", "aloha state", "maui", "oahu", "honolulu"],
    [
      ["Ocean Waves", "waves", ["ocean", "waves", "surf"]],
      ["Volcano", "volcano", ["lava", "crater"]],
      ["Palm Island", "palm-island", ["island", "palm tree"]],
      ["Surfboard", "surfboard", ["surfing"]],
      ["Campfire", "campfire", ["luau", "luau fire", "fire"]],
      ["Flower Lei", "flower-lei", ["lei", "hula lei", "garland"]],
    ],
  ],
  [
    "Camping",
    ["campsite", "campout", "camping trip", "great outdoors"],
    [
      ["Pine Trees", "pine-trees", ["trees", "forest", "woods"]],
      ["Compass", "compass"],
      ["Backpack", "backpack", ["hiking pack", "rucksack"]],
      ["Lantern", "lantern", ["camp light", "lamp"]],
      ["Campfire", "campfire", ["bonfire", "fire"]],
      ["Tent", "tent", ["camping tent"]],
    ],
  ],
  [
    "Coffee Shop",
    ["cafe", "coffeehouse", "espresso bar", "local cafe"],
    [
      ["Cafe Table", "cafe-table", ["table", "bistro table"]],
      ["Headphones", "headphones", ["earphones", "headset"]],
      ["Book", "book", ["novel", "paperback"]],
      ["Croissant", "croissant", ["pastry"]],
      ["Coffee Beans", "beans", ["beans", "espresso beans"]],
      ["Coffee Cup", "coffee-cup", ["coffee", "espresso", "latte", "mug"]],
    ],
  ],
  [
    "Outer Space",
    ["solar system", "astronomy", "cosmos", "space exploration", "space"],
    [
      ["Night Sky", "stars-sky", ["stars", "starry sky"]],
      ["Crescent Moon", "moon-crescent", ["moon"]],
      ["Telescope", "telescope"],
      ["Meteor", "meteor", ["shooting star", "comet"]],
      ["Ringed Planet", "planet-ring", ["planet", "saturn"]],
      ["Rocket", "rocket", ["spaceship", "spacecraft"]],
    ],
  ],
  [
    "Birthday Party",
    ["birthday", "birthday celebration", "bday party", "party"],
    [
      ["Invitation", "envelope", ["envelope", "card", "invitation card"]],
      ["Confetti", "confetti", ["streamers"]],
      ["Party Hat", "party-hat", ["hat", "birthday hat"]],
      ["Gift Box", "gift-box", ["present", "gift", "wrapped gift"]],
      ["Balloons", "balloons", ["balloon"]],
      ["Birthday Cake", "cake-candles", ["cake", "candles"]],
    ],
  ],
  [
    "Movie Night",
    ["cinema", "movie theater", "hollywood", "at the movies", "movies"],
    [
      ["Spotlight", "spotlight", ["searchlight", "light"]],
      ["Red Carpet", "red-carpet", ["carpet"]],
      ["Movie Ticket", "ticket", ["ticket", "stub", "admit one"]],
      ["Film Reel", "film-reel", ["reel", "film"]],
      ["Clapperboard", "clapperboard", ["slate", "clapboard"]],
      ["Popcorn", "popcorn", ["buttered popcorn"]],
    ],
  ],
  [
    "Winter Cabin",
    ["cozy winter", "snow day", "winter", "ski lodge", "snowy day"],
    [
      ["Pinecone", "pinecone", ["pine cone"]],
      ["Snowflake", "snowflake", ["snow"]],
      ["Mittens", "mittens", ["gloves", "mitten"]],
      ["Sled", "sled", ["toboggan", "sleigh"]],
      ["Hot Cocoa", "mug-steam", ["mug", "hot chocolate", "cocoa", "tea"]],
      ["Fireplace", "fireplace", ["hearth", "fire"]],
    ],
  ],
  [
    "Sailing",
    ["nautical", "harbor", "seafaring", "ocean voyage", "yachting"],
    [
      ["Seagull", "seagull", ["gull", "bird"]],
      ["Seashell", "seashell", ["shell"]],
      ["Binoculars", "binoculars", ["spyglass"]],
      ["Anchor", "anchor"],
      ["Lighthouse", "lighthouse", ["beacon"]],
      ["Sailboat", "sailboat", ["boat", "ship", "yacht"]],
    ],
  ],
  [
    "Rock Concert",
    ["live music", "concert", "music festival", "band"],
    [
      ["Music Notes", "music-notes", ["notes", "music"]],
      ["Vinyl Record", "vinyl", ["vinyl", "record", "album"]],
      ["Piano Keys", "piano-keys", ["piano", "keyboard"]],
      ["Guitar", "guitar", ["acoustic guitar", "electric guitar"]],
      ["Microphone", "microphone", ["mic"]],
      ["Stage", "stage", ["curtains", "concert stage"]],
    ],
  ],
  [
    "Pizzeria",
    ["pizza", "making pizza", "italian kitchen", "pizza night"],
    [
      ["Olive Branch", "olive-branch", ["olives", "olive"]],
      ["Tomato", "tomato", ["tomatoes"]],
      ["Rolling Pin", "rolling-pin", ["roller"]],
      ["Chef Hat", "chef-hat", ["toque", "hat"]],
      ["Brick Oven", "oven-flame", ["oven", "pizza oven"]],
      ["Pizza Slice", "pizza-slice", ["pizza", "pepperoni pizza", "slice"]],
    ],
  ],
  [
    "World Travel",
    ["vacation", "international travel", "globetrotting", "traveling", "travel"],
    [
      ["Globe", "globe", ["world", "earth"]],
      ["Camera", "camera"],
      ["Bicycle", "bicycle", ["bike"]],
      ["Suitcase", "suitcase", ["luggage", "bag"]],
      ["Passport", "passport"],
      ["Airplane", "airplane", ["plane", "jet", "flight"]],
    ],
  ],
  [
    "Fairy Tale",
    ["medieval fantasy", "fantasy kingdom", "knights and dragons", "storybook"],
    [
      ["Key", "treasure-key", ["skeleton key", "treasure key"]],
      ["Shield", "shield", ["crest"]],
      ["Sword", "sword", ["blade"]],
      ["Dragon Wing", "dragon-wing", ["dragon", "wing"]],
      ["Crown", "crown", ["royal crown"]],
      ["Castle", "castle", ["palace", "fortress"]],
    ],
  ],
  [
    "Gardening",
    ["garden", "spring garden", "backyard garden", "botany"],
    [
      ["Seedling", "seedling", ["sprout", "plant", "sapling"]],
      ["Wheelbarrow", "wheelbarrow", ["cart", "barrow"]],
      ["Watering Can", "watering-can", ["sprinkler"]],
      ["Beehive", "bee-hive", ["hive", "bee hive", "bees"]],
      ["Butterfly", "butterfly", ["monarch"]],
      ["Sunflower", "sunflower", ["flower"]],
    ],
  ],
  [
    "Game Night",
    ["board games", "family game night", "tabletop games", "board game"],
    [
      ["Hourglass", "hourglass", ["sand timer", "timer"]],
      ["Playing Card", "playing-card", ["card", "cards", "ace"]],
      ["Puzzle Piece", "puzzle-piece", ["jigsaw", "puzzle"]],
      ["Dice", "dice", ["die"]],
      ["Chess Knight", "chess-knight", ["knight", "chess", "chess piece"]],
      ["Trophy", "trophy", ["cup", "award"]],
    ],
  ],
  [
    "Beach Vacation",
    ["beach day", "tropical beach", "seaside", "summer beach"],
    [
      ["Sun", "sun", ["sunshine"]],
      ["Seagull", "seagull", ["gull", "bird"]],
      ["Seashell", "seashell", ["shell"]],
      ["Ocean Waves", "waves", ["waves", "ocean", "surf"]],
      ["Surfboard", "surfboard", ["surfing"]],
      ["Palm Island", "palm-island", ["island", "palm tree"]],
    ],
  ],
  [
    "Stargazing",
    ["night sky", "meteor shower", "astronomy club", "observatory"],
    [
      ["Compass", "compass"],
      ["Lantern", "lantern", ["lamp"]],
      ["Starry Sky", "stars-sky", ["stars", "night sky"]],
      ["Crescent Moon", "moon-crescent", ["moon"]],
      ["Meteor", "meteor", ["shooting star", "comet"]],
      ["Telescope", "telescope"],
    ],
  ],
  [
    "Sunday Morning",
    ["lazy sunday", "cozy morning", "morning routine", "breakfast"],
    [
      ["Sun", "sun", ["sunrise", "sunshine"]],
      ["Book", "book", ["novel"]],
      ["Headphones", "headphones", ["earphones"]],
      ["Croissant", "croissant", ["pastry"]],
      ["Coffee Beans", "beans", ["beans"]],
      ["Coffee Cup", "coffee-cup", ["coffee", "mug", "espresso"]],
    ],
  ],
  [
    "Snow Day",
    ["blizzard", "winter holiday", "sledding", "snowfall"],
    [
      ["Pine Trees", "pine-trees", ["evergreens", "trees", "pines"]],
      ["Snowflake", "snowflake", ["snow", "ice crystal"]],
      ["Mittens", "mittens", ["gloves"]],
      ["Sled", "sled", ["toboggan"]],
      ["Fireplace", "fireplace", ["hearth"]],
      ["Hot Cocoa", "mug-steam", ["mug", "cocoa", "hot chocolate"]],
    ],
  ],
  [
    "Film Festival",
    ["premiere", "oscars", "award show", "hollywood premiere"],
    [
      ["Envelope", "envelope", ["golden envelope", "letter"]],
      ["Spotlight", "spotlight"],
      ["Ticket", "ticket", ["movie ticket", "vip ticket"]],
      ["Red Carpet", "red-carpet", ["carpet"]],
      ["Clapperboard", "clapperboard", ["slate", "clapboard"]],
      ["Trophy", "trophy", ["award", "oscar"]],
    ],
  ],
  [
    "Treasure Hunt",
    ["pirates", "pirate adventure", "buried treasure", "island quest"],
    [
      ["Compass", "compass"],
      ["Binoculars", "binoculars", ["spyglass"]],
      ["Sailboat", "sailboat", ["ship", "tall ship", "boat"]],
      ["Anchor", "anchor"],
      ["Island", "palm-island", ["palm island", "atoll"]],
      ["Treasure Key", "treasure-key", ["key", "skeleton key"]],
    ],
  ],
  [
    "Recording Studio",
    ["making an album", "music studio", "album", "musician"],
    [
      ["Music Notes", "music-notes", ["notes", "sheet music"]],
      ["Headphones", "headphones", ["headset"]],
      ["Piano Keys", "piano-keys", ["piano", "keyboard"]],
      ["Guitar", "guitar"],
      ["Microphone", "microphone", ["mic"]],
      ["Vinyl Record", "vinyl", ["vinyl", "record", "album"]],
    ],
  ],
  [
    "Bakery",
    ["french bakery", "patisserie", "baking", "pastry shop"],
    [
      ["Oven", "oven-flame", ["brick oven"]],
      ["Rolling Pin", "rolling-pin", ["roller"]],
      ["Chef Hat", "chef-hat", ["baker hat", "toque"]],
      ["Coffee Cup", "coffee-cup", ["coffee", "espresso"]],
      ["Cake", "cake-candles", ["birthday cake", "frosted cake"]],
      ["Croissant", "croissant", ["pastry"]],
    ],
  ],
  [
    "Backpacking",
    ["hiking", "mountain trail", "trekking", "wilderness hike"],
    [
      ["Pine Trees", "pine-trees", ["trees", "forest", "pines"]],
      ["Compass", "compass"],
      ["Binoculars", "binoculars"],
      ["Camera", "camera"],
      ["Tent", "tent"],
      ["Backpack", "backpack", ["rucksack", "pack"]],
    ],
  ],
  [
    "Summer Tour",
    ["eurotrip", "sightseeing", "holiday abroad", "backpacking europe"],
    [
      ["Globe", "globe", ["world"]],
      ["Airplane", "airplane", ["plane", "flight"]],
      ["Passport", "passport"],
      ["Cafe Table", "cafe-table", ["table", "street cafe"]],
      ["Bicycle", "bicycle", ["bike"]],
      ["Camera", "camera"],
    ],
  ],
  [
    "New Year's Eve",
    ["new years", "midnight countdown", "celebration", "nye"],
    [
      ["Hourglass", "hourglass", ["timer", "countdown"]],
      ["Starry Sky", "stars-sky", ["night sky", "stars", "midnight"]],
      ["Balloons", "balloons", ["balloon"]],
      ["Party Hat", "party-hat", ["hat"]],
      ["Confetti", "confetti", ["streamers"]],
      ["Spotlight", "spotlight", ["light"]],
    ],
  ],
  [
    "Coastal Town",
    ["fishing village", "new england coast", "seaport", "cape cod"],
    [
      ["Seagull", "seagull", ["gull", "bird"]],
      ["Seashell", "seashell", ["shell"]],
      ["Ocean Waves", "waves", ["waves", "surf", "ocean"]],
      ["Anchor", "anchor"],
      ["Sailboat", "sailboat", ["boat", "ship"]],
      ["Lighthouse", "lighthouse", ["beacon"]],
    ],
  ],
  [
    "Medieval Tournament",
    ["jousting", "camelot", "royal court", "chivalry"],
    [
      ["Stage", "stage", ["pavilion", "curtains"]],
      ["Chess Knight", "chess-knight", ["knight", "horse"]],
      ["Sword", "sword", ["blade"]],
      ["Shield", "shield", ["crest"]],
      ["Crown", "crown"],
      ["Castle", "castle", ["fortress", "keep"]],
    ],
  ],
  [
    "Farmers Market",
    ["local market", "organic harvest", "country market", "harvest"],
    [
      ["Wheelbarrow", "wheelbarrow", ["cart", "barrow"]],
      ["Seedling", "seedling", ["herbs", "sprout", "plant"]],
      ["Olives", "olive-branch", ["olive branch", "olive"]],
      ["Beehive", "bee-hive", ["honey", "hive", "bees"]],
      ["Tomato", "tomato", ["tomatoes"]],
      ["Sunflower", "sunflower", ["sunflowers", "flower"]],
    ],
  ],
  [
    "Bookstore",
    ["library", "reading nook", "book club", "quiet library"],
    [
      ["Lantern", "lantern", ["lamp", "reading lamp"]],
      ["Table", "cafe-table", ["cafe table", "desk"]],
      ["Tea Mug", "mug-steam", ["mug", "tea", "cup"]],
      ["Hourglass", "hourglass", ["timer"]],
      ["Headphones", "headphones"],
      ["Book", "book", ["hardcover", "novel", "open book"]],
    ],
  ],
  [
    "Moon Landing",
    ["apollo", "astronaut", "space mission", "lunar mission"],
    [
      ["Night Sky", "stars-sky", ["stars", "cosmos", "space"]],
      ["Earth", "globe", ["globe", "world"]],
      ["Telescope", "telescope"],
      ["Planet", "planet-ring", ["saturn", "ringed planet"]],
      ["Rocket", "rocket", ["spaceship", "apollo"]],
      ["Moon", "moon-crescent", ["crescent moon", "lunar"]],
    ],
  ],
  [
    "Graduation",
    ["commencement", "graduation day", "diploma", "grad party"],
    [
      ["Stage", "stage", ["auditorium"]],
      ["Diploma", "envelope", ["envelope", "letter", "certificate"]],
      ["Gift Box", "gift-box", ["gift", "present"]],
      ["Camera", "camera"],
      ["Confetti", "confetti"],
      ["Trophy", "trophy", ["award", "cup"]],
    ],
  ],
  [
    "Italian Dinner",
    ["trattoria", "rome", "mediterranean food", "tuscan dinner"],
    [
      ["Table", "cafe-table", ["bistro table", "cafe table"]],
      ["Olives", "olive-branch", ["olive", "olive branch"]],
      ["Tomato", "tomato", ["tomatoes"]],
      ["Brick Oven", "oven-flame", ["oven", "wood oven"]],
      ["Pizza", "pizza-slice", ["pizza slice", "slice"]],
      ["Espresso", "coffee-cup", ["coffee", "coffee cup"]],
    ],
  ],
  [
    "Island Hopping",
    ["archipelago", "caribbean cruise", "tropical cruise", "polynesia"],
    [
      ["Sun", "sun", ["sunshine"]],
      ["Passport", "passport"],
      ["Sailboat", "sailboat", ["boat", "yacht"]],
      ["Ocean Waves", "waves", ["waves", "ocean", "sea"]],
      ["Flower Lei", "flower-lei", ["lei", "garland"]],
      ["Palm Island", "palm-island", ["island", "atoll", "palm tree"]],
    ],
  ],
];

const EDITORIAL_SUBTITLES: readonly string[] = [
  "Six Hidden Pictures",
  "Uncover the Six",
  "Piece by Piece",
  "Jigsaw Gallery",
  "Six Pictures, One Theme",
  "Spot the Subject",
  "Picture Reveal",
  "Theme & Six",
];

function buildImageAliases(
  caption: string,
  scene: SixPicsSceneKey,
  extra?: readonly string[]
): string[] {
  const capNorm = normalizeSixPicsText(caption);
  return [
    ...new Set(
      [
        ...(extra ?? []),
        ...(SCENE_DEFAULT_ALIASES[scene] ?? []),
        ...localSixPicsSynonyms(caption),
      ]
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 48 && normalizeSixPicsText(s) !== capNorm)
    ),
  ].slice(0, 20);
}

function buildBank(): SixPicsPuzzle[] {
  const bank: SixPicsPuzzle[] = [];
  for (let i = 0; i < SIX_PICS_BANK_SIZE; i++) {
    const base = CURATED_THEMES[i % CURATED_THEMES.length]!;
    const variant = Math.floor(i / CURATED_THEMES.length);
    const [theme, curatedAliases, rawClues] = base;
    const clues =
      variant === 0
        ? rawClues
        : ([
            rawClues[1]!,
            rawClues[0]!,
            rawClues[3]!,
            rawClues[2]!,
            rawClues[5]!,
            rawClues[4]!,
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
      images: clues.map(([caption, scene, extra]) => ({
        caption,
        aliases: buildImageAliases(caption, scene, extra),
        scene,
      })),
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

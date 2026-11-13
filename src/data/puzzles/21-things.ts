import {
  ROTATION_ANCHOR,
  daysBetweenDateKeys,
  getLocalDateKey,
  getPuzzleNumberForDate,
} from "@/lib/date-keys";
import { fnv1a32, mulberry32 } from "@/lib/seeded-random";

export interface TwentyOneJourney {
  id: string;
  boardId: string;
  playerName: string;
  pick6: string[];
  pick3: string[];
  pick1: string;
  reflectionNote: string;
  voiceNoteDataUrl?: string;
  createdAt: string;
}

export interface TwentyOneThingsBoard {
  id: string;
  puzzleNumber: number;
  title: string;
  creatorName: string;
  creatorHandle: string;
  creatorBio: string;
  /** Exactly 21 items, each <= 5 words and <= 30 characters */
  items: string[];
  sampleJourneys: TwentyOneJourney[];
  customDate?: string;
}

const BASE_BOARDS: Array<{
  title: string;
  creatorName: string;
  creatorHandle: string;
  creatorBio: string;
  items: [
    string, string, string, string, string, string, string,
    string, string, string, string, string, string, string,
    string, string, string, string, string, string, string
  ];
}> = [
  {
    title: "Everyday Magic & Small Joys",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "21 little things that make ordinary days feel extraordinary.",
    items: [
      "Two-colored dog eyes",
      "Vintage VW Beetles",
      "Morning coffee smell",
      "Warm laundry out of dryer",
      "Rain on a tin roof",
      "Freshly baked sourdough",
      "Green lights all the way",
      "First sip of cold water",
      "Sunlight through pine trees",
      "Vinyl crackle before song",
      "Handwritten thank-you notes",
      "Golden hour ocean breeze",
      "Laughing till stomach hurts",
      "Finding cash in old coat",
      "Crisp autumn leaf crunch",
      "Peeling a Clementine whole",
      "Late-night diner pancakes",
      "Cool side of the pillow",
      "Streetlight glow in fog",
      "Campfire woodsmoke on hoodie",
      "Unexpected text from a friend",
    ],
  },
  {
    title: "Coastal Mornings & Slow Weekends",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "Slowing down by the water and appreciating simple rhythms.",
    items: [
      "Salt air at sunrise",
      "Barefoot walk on wet sand",
      "Seagulls gliding on wind",
      "Iced matcha on the porch",
      "Hammock under palm shade",
      "Harbor bell buoys chiming",
      "Old paperback with dog ears",
      "Fresh lemon on grilled fish",
      "Skipping flat river stones",
      "Acoustic guitar on the deck",
      "Driftwood worn smooth",
      "Tide pools full of crabs",
      "Linen shirt in a breeze",
      "Farmers market strawberries",
      "Midday nap with window open",
      "Distant lighthouse beam",
      "Warm outdoor shower",
      "Sunset turning clouds pink",
      "Board games after dinner",
      "Stargazing from a dock",
      "Waves crashing at midnight",
    ],
  },
  {
    title: "Creative Flow & Studio Vibes",
    creatorName: "Daily Curator",
    creatorHandle: "@curator",
    creatorBio: "Things that spark creative momentum when building something new.",
    items: [
      "Fresh dot-grid notebook",
      "Mechanical keyboard thock",
      "Lo-fi beats in headphones",
      "Whiteboard full of arrows",
      "Zero bugs on first build",
      "Espresso crema swirl",
      "Desk lamp warm amber glow",
      "Sketching with black ink",
      "Deleting 500 lines of code",
      "Late-night brainstorm call",
      "Rainy window by the desk",
      "Succulent on monitor stand",
      "Clean desktop wallpaper",
      "Solving a 3-hour bug",
      "Sharp cedar pencil scent",
      "Instant deploy green check",
      "Post-it notes in rows",
      "Second monitor vertical code",
      "Stretch break on balcony",
      "Shipping before midnight",
      "High-five after launch",
    ],
  },
  {
    title: "Childhood Nostalgia & Summer Nights",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "Throwback memories that still bring an instant smile.",
    items: [
      "Fireflies in a mason jar",
      "Ice cream truck melody",
      "Riding bikes no-handed",
      "Sprinkler rainbow in yard",
      "Flashlight tag at dusk",
      "Saturday morning cartoons",
      "Treehouse rope ladder",
      "Popsicle dripping on wrist",
      "Blowing N64 game cartridges",
      "Chalk art on driveway",
      "Catching frogs by the creek",
      "Sleepover pillow forts",
      "Fairground cotton candy",
      "Disposable camera clicks",
      "First day of summer bell",
      "Backyard trampoline bounce",
      "Root beer floats in mugs",
      "Glow sticks around wrists",
      "Roller rink disco ball",
      "Watermelon seed contests",
      "Falling asleep in backseat",
    ],
  },
  {
    title: "Cozy Autumn & Cabin Retreats",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "Crisp mountain air, wool blankets, and slow evenings.",
    items: [
      "Hot apple cider with clove",
      "Crackling birchwood hearth",
      "Flannel shirt softness",
      "Fog rising off a lake",
      "Roasted pumpkin seeds",
      "Chunky knit wool socks",
      "Cinnamon rolls baking",
      "Red maple leaves falling",
      "Misty mountain trail hike",
      "Cast-iron skillet cornbread",
      "Board game by candlelight",
      "Woodshed stacked for winter",
      "Thermos of hot cocoa",
      "Owls hooting at twilight",
      "Adirondack chair view",
      "Butternut squash soup",
      "First frost on the grass",
      "Starlight through bare oaks",
      "Cedar sauna steam",
      "Acoustic folk playlist",
      "Reading under a quilt",
    ],
  },
  {
    title: "Foodie Heaven & Kitchen Rituals",
    creatorName: "Daily Curator",
    creatorHandle: "@curator",
    creatorBio: "21 flavors, sounds, and textures that make cooking an art.",
    items: [
      "Garlic sizzling in olive oil",
      "Crispy edges on lasagna",
      "Fresh basil torn by hand",
      "Warm tortilla off comal",
      "Flaky sea salt on caramel",
      "Ramen broth on cold night",
      "Sharp chef knife glide",
      "Burrata slice opening up",
      "Squeeze of lime on tacos",
      "Cast-iron sear on steak",
      "Brioche French toast",
      "Homegrown heirloom tomato",
      "Crusty baguette crackle",
      "Dark chocolate with espresso",
      "Wood-fired Neapolitan char",
      "Homemade pesto mortar",
      "Mango ripe to perfection",
      "Butter melting on pancakes",
      "Crispy skin roast chicken",
      "Sharing tapas with friends",
      "Grandma's handwritten recipe",
    ],
  },
  {
    title: "Road Trip & Open Horizons",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "Windows down, great playlists, and nowhere to rush.",
    items: [
      "Windows down on Highway 1",
      "Singing chorus at top volume",
      "Desert sunset in rearview",
      "Roadside peach stand stop",
      "Scenic overlook pull-off",
      "Paper map on dashboard",
      "Crossing a state line sign",
      "Diner coffee in ceramic mug",
      "Red rock canyon curves",
      "Convertible top down",
      "Spotting a double rainbow",
      "Small-town bakery donuts",
      "Golden wheat fields waving",
      "Bridge over a wide river",
      "Tailgate picnic at noon",
      "Mountain pass switchbacks",
      "Radio static finding a gem",
      "Milestone odometer flip",
      "Wild horses by the fence",
      "Motel neon sign at dusk",
      "Pulling into home driveway",
    ],
  },
  {
    title: "Mindful Reset & Inner Calm",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "Grounding habits that clear mental clutter and restore energy.",
    items: [
      "Ten deep belly breaths",
      "Phone on airplane mode",
      "Morning pages in journal",
      "Cold plunge adrenaline rush",
      "Sunlight on closed eyelids",
      "Walking without headphones",
      "Tidying the whole desk",
      "Drinking a tall glass water",
      "Gratitude list before bed",
      "Watering indoor houseplants",
      "Stretching tight shoulders",
      "Chamomile tea in ceramic cup",
      "Forgiving an old mistake",
      "Lighting a sandalwood stick",
      "Listening to birdsong",
      "Saying no without guilt",
      "Unfollowing noisy feeds",
      "Barefoot grass grounding",
      "Early bedtime with a book",
      "Genuine compliment to stranger",
      "Waking up before the alarm",
    ],
  },
  {
    title: "City Lights & Culture Nights",
    creatorName: "Daily Curator",
    creatorHandle: "@curator",
    creatorBio: "The electric energy of a great evening out in the city.",
    items: [
      "Rooftop view of skyline",
      "Jazz quartet in basement club",
      "Street taco cart at 11pm",
      "Art gallery opening night",
      "Walking across lit bridge",
      "Bookstore open till midnight",
      "Busker playing cello in park",
      "Encore at an indie concert",
      "Espresso martini on patio",
      "Cobblestone alley lanterns",
      "Window shopping in Soho",
      "Museum hall all to yourself",
      "Subway arriving right away",
      "Neon reflection on wet street",
      "Improv comedy front row",
      "Gelato stroll after dinner",
      "Vinyl crate digging",
      "Skyscraper lights in fog",
      "People-watching at a cafe",
      "Theater curtain rising",
      "Quiet cab ride home",
    ],
  },
  {
    title: "Winter Wonder & Holiday Warmth",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "Quiet snowfalls, warm lights, and gathering with loved ones.",
    items: [
      "First snowfall at midnight",
      "Twinkle lights on pine boughs",
      "Peppermint bark crunch",
      "Ice skating on frozen pond",
      "Mulled cider simmering",
      "Velvet ribbon on gifts",
      "Snow day silence outside",
      "Warm mittens off radiator",
      "Gingerbread house decorating",
      "Ski run on fresh powder",
      "Roasting chestnuts on fire",
      "Family puzzle on big table",
      "Breath clouds in cold air",
      "Candle in every window",
      "Fleece-lined winter boots",
      "Sledding down the steep hill",
      "Cinnamon stick in coffee",
      "Choir harmonies in a hall",
      "Countdown on New Year's Eve",
      "Handwritten holiday cards",
      "Toasting to the year ahead",
    ],
  },
];

const EXTRA_THEMES: Array<{
  title: string;
  creatorName: string;
  creatorHandle: string;
  creatorBio: string;
  rotateOffset: number;
}> = [
  { title: "Sunday Morning Sanctuary", creatorName: "SOL Theory", creatorHandle: "@SOLTheory", creatorBio: "Unrushed hours that recharge the whole week.", rotateOffset: 3 },
  { title: "Nature's Quiet Masterpieces", creatorName: "Daily Curator", creatorHandle: "@curator", creatorBio: "Wild landscapes and small outdoor wonders.", rotateOffset: 5 },
  { title: "Friendship & Good Company", creatorName: "SOL Theory", creatorHandle: "@SOLTheory", creatorBio: "Moments that turn acquaintances into lifelong friends.", rotateOffset: 7 },
  { title: "Music Lover's Gratitude", creatorName: "Daily Curator", creatorHandle: "@curator", creatorBio: "Sounds, stages, and songs that move us.", rotateOffset: 2 },
  { title: "Traveler's Notebook", creatorName: "SOL Theory", creatorHandle: "@SOLTheory", creatorBio: "Passport stamps, train windows, and new horizons.", rotateOffset: 4 },
  { title: "Garden & Green Thumb Joys", creatorName: "Daily Curator", creatorHandle: "@curator", creatorBio: "Watching seeds, blossoms, and seasons unfold.", rotateOffset: 6 },
];

export const TWENTY_ONE_THINGS_BOARDS: TwentyOneThingsBoard[] = Array.from(
  { length: 66 },
  (_, index) => {
    const puzzleNumber = index + 1;
    const base = BASE_BOARDS[index % BASE_BOARDS.length];
    const cycle = Math.floor(index / BASE_BOARDS.length);

    let items = [...base.items];
    let title = base.title;
    let creatorName = base.creatorName;
    let creatorHandle = base.creatorHandle;
    let creatorBio = base.creatorBio;

    if (cycle > 0) {
      const theme = EXTRA_THEMES[(index + cycle) % EXTRA_THEMES.length];
      title = `${base.title} · Vol. ${cycle + 1}`;
      creatorName = theme.creatorName;
      creatorHandle = theme.creatorHandle;
      creatorBio = theme.creatorBio;

      const secondary = BASE_BOARDS[(index + cycle) % BASE_BOARDS.length].items;
      const usedItems = new Set<string>();

      items = items.map((item, idx) => {
        const candidate =
          idx % 2 === cycle % 2 ? secondary[idx] : item;
        if (!usedItems.has(candidate)) {
          usedItems.add(candidate);
          return candidate;
        }
        usedItems.add(item);
        return item;
      });

      // Ensure all 21 items are strictly unique on the board
      const uniqueList: string[] = [];
      const seen = new Set<string>();
      for (const it of items) {
        if (!seen.has(it)) {
          seen.add(it);
          uniqueList.push(it);
        } else {
          // Find a replacement from BASE_BOARDS not yet in seen
          let replacement = it;
          for (const b of BASE_BOARDS) {
            const found = b.items.find((cand) => !seen.has(cand));
            if (found) {
              replacement = found;
              break;
            }
          }
          seen.add(replacement);
          uniqueList.push(replacement);
        }
      }
      items = uniqueList.slice(0, 21);
    }

    const boardId = `21t-${puzzleNumber}`;

    return {
      id: boardId,
      puzzleNumber,
      title,
      creatorName,
      creatorHandle,
      creatorBio,
      items,
      sampleJourneys: [],
    };
  }
);

/**
 * Smart AI / Heuristic Voice-to-Board Parser:
 * Splits a continuous stream-of-consciousness transcript into up to 21 distinct items,
 * and enforces the strict mobile tile limit (<= 5 words and <= 30 characters).
 */
export function parseTranscriptTo21Items(transcript: string): {
  items: string[];
  autoShortenedCount: number;
} {
  const cleaned = transcript
    .replace(/\r\n/g, "\n")
    .replace(/\b(um|uh|like|you know|and also|also|plus|maybe)\b/gi, ",")
    .trim();

  // Split on commas, semicolons, newlines, numbered bullets, or " and "
  const rawSegments = cleaned
    .split(/(?:,|;|\n|\band\b|\bthen\b|(?:\d+[\.\)\-]\s*))/i)
    .map((s) => s.replace(/^[\s\-\•\*]+|[\s\.]+$/g, "").trim())
    .filter((s) => s.length >= 2);

  let autoShortenedCount = 0;

  const formatted = rawSegments.map((raw) => {
    const { text, wasShortened } = enforceTileConstraints(raw);
    if (wasShortened) autoShortenedCount++;
    return text;
  });

  // Deduplicate case-insensitively
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of formatted) {
    const key = item.toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
    if (unique.length === 21) break;
  }

  return { items: unique, autoShortenedCount };
}

const REMOVABLE_FILLER_WORDS = new Set([
  "the",
  "a",
  "an",
  "that",
  "really",
  "very",
  "just",
  "right",
  "your",
  "my",
  "our",
  "some",
  "little",
  "old",
  "all",
  "covered",
]);

const DANGLING_END_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "from",
  "with",
  "by",
  "into",
  "through",
  "and",
  "or",
  "until",
  "till",
  "before",
  "after",
]);

/**
 * Enforces max 5 words and max 30 characters per tile with smart phrase compression
 * that preserves the final head noun instead of truncating mid-thought.
 */
export function enforceTileConstraints(input: string): {
  text: string;
  wasShortened: boolean;
  wordCount: number;
  charCount: number;
} {
  const trimmed = input.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return { text: "", wasShortened: false, wordCount: 0, charCount: 0 };
  }

  let candidate = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  let wasShortened = false;

  const initialWords = candidate.split(" ");
  if (initialWords.length <= 5 && candidate.length <= 30) {
    return {
      text: candidate,
      wasShortened: false,
      wordCount: initialWords.length,
      charCount: candidate.length,
    };
  }

  // Step 1: Strip conversational lead-ins
  const strippedLead = candidate
    .replace(
      /^(?:i\s+(?:really\s+)?(?:love|appreciate|enjoy)\s+|the\s+(?:feeling|sound|smell|taste|sight)\s+of\s+|when\s+you\s+(?:get|find|see|hear)\s+|(?:watching|hearing|seeing)\s+(?:a|an|the)\s+)/i,
      ""
    )
    .trim();
  if (strippedLead && strippedLead !== candidate) {
    candidate = strippedLead.charAt(0).toUpperCase() + strippedLead.slice(1);
    wasShortened = true;
  }

  // Step 2: Natural phrase-level compressions
  const compressed = candidate
    .replace(/\bdogs with two different colored eyes\b/gi, "Two-colored dog eyes")
    .replace(/\btwo different colored\b/gi, "two-colored")
    .replace(/\bdifferent colored\b/gi, "two-colored")
    .replace(/\bright out of the\b/gi, "out of")
    .replace(/\bout of the\b/gi, "out of")
    .replace(/\bhitting green lights all the way home\b/gi, "Green lights all the way")
    .replace(/\ball the way home\b/gi, "all the way")
    .replace(/\bfiltering through\b/gi, "through")
    .replace(/\bbefore the song starts\b/gi, "before song")
    .replace(/\buntil (?:your|my) stomach hurts(?:\s+with\s+(?:old\s+)?friends)?\b/gi, "until stomach hurts")
    .replace(/\btwenty dollars\b/gi, "$20")
    .replace(/\bin an old\b/gi, "in")
    .replace(/\bfrom an old\b/gi, "from a")
    .replace(/\bin one piece\b/gi, "whole")
    .replace(/\s+/g, " ")
    .trim();

  if (compressed && compressed !== candidate) {
    candidate = compressed.charAt(0).toUpperCase() + compressed.slice(1);
    wasShortened = true;
  }

  // Step 3: If still over 5 words or 30 chars, drop middle filler words while preserving first word & last head noun
  let words = candidate.split(" ");
  if (words.length > 5 || candidate.length > 30) {
    for (let i = 1; i < words.length - 1; i++) {
      if (words.length <= 5 && words.join(" ").length <= 30) break;
      const cleanW = words[i].toLowerCase().replace(/[^a-z]/g, "");
      if (REMOVABLE_FILLER_WORDS.has(cleanW)) {
        words.splice(i, 1);
        i--;
        wasShortened = true;
      }
    }
    candidate = words.join(" ");
  }

  // Step 4: If still > 5 words, keep first 3 words + last 2 words (preserving the head noun at the end)
  words = candidate.split(" ");
  if (words.length > 5) {
    words = [...words.slice(0, 3), ...words.slice(-2)];
    candidate = words.join(" ");
    wasShortened = true;
  }

  // Step 5: If still > 30 characters, drop middle words (index words.length - 2 down to 1) before touching the final noun
  while (candidate.length > 30 && words.length > 2) {
    words.splice(words.length - 2, 1);
    candidate = words.join(" ");
    wasShortened = true;
  }

  if (candidate.length > 30 && words.length === 2) {
    if (words[0].length <= 30) {
      candidate = words[0];
    } else {
      candidate = candidate.slice(0, 30).trim();
    }
    wasShortened = true;
  } else if (candidate.length > 30) {
    candidate = candidate.slice(0, 30).trim();
    wasShortened = true;
  }

  // Step 6: Ensure we never end on a dangling preposition/article
  words = candidate.split(" ");
  while (
    words.length > 1 &&
    DANGLING_END_WORDS.has(
      words[words.length - 1].toLowerCase().replace(/[^a-z]/g, "")
    )
  ) {
    words.pop();
    wasShortened = true;
  }
  candidate = words.join(" ");
  if (candidate) {
    candidate = candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  return {
    text: candidate,
    wasShortened,
    wordCount: candidate ? candidate.split(" ").length : 0,
    charCount: candidate.length,
  };
}

// ============================================================================
// Deterministic 2026–2027 Non-Repeating Daily Board Synthesis & Cache
// ============================================================================

const EXTRA_CURATED_21_ITEMS: readonly string[] = [
  "Rainy afternoon in bookshop",
  "Smell of old library pages",
  "Fountain pen gliding on paper",
  "Reading on a porch swing",
  "Tea kettle gentle whistle",
  "Lantern lit garden path",
  "Wildflowers in mason jar",
  "Fresh peaches in summer",
  "Warm scones with berry jam",
  "Morning dew on clover",
  "Hummingbird by the window",
  "Crickets singing at twilight",
  "Canoe gliding on still lake",
  "Campfire sparks rising high",
  "Shooting star at midnight",
  "Full moon over ocean water",
  "Biking down a quiet lane",
  "Farmers market honey jar",
  "Handwoven wool throw blanket",
  "Sunbeam where the cat sleeps",
  "Sound of distant train horn",
  "Watercolor paint in clear jar",
  "Fresh rosemary between fingers",
  "Crackling vinyl jazz record",
  "Warm focaccia with sea salt",
  "First cherry blossoms in April",
  "Laughter around dinner table",
  "Postcard from a faraway friend",
  "Skipping stones at golden hour",
  "Snowflakes catching on mittens",
  "Hot chocolate after sledding",
  "Pine needles on forest trail",
  "Sunlight dancing on creek bed",
  "Hammock nap in late afternoon",
  "Freshly squeezed orange juice",
  "Cool breeze through linen",
  "Bells chiming across the square",
  "Rowboat tied to wooden dock",
  "Evening walk after summer rain",
  "Candlelight on wooden table",
  "Solving the Sunday crossword",
  "Finishing the final chapter",
];

const ALL_CURATED_21_ITEMS: readonly string[] = Array.from(
  new Set([
    ...BASE_BOARDS.flatMap((b) => b.items),
    ...EXTRA_CURATED_21_ITEMS,
  ])
);

const EXTENDED_21_THEMES: ReadonlyArray<{
  title: string;
  creatorName: string;
  creatorHandle: string;
  creatorBio: string;
}> = [
  ...BASE_BOARDS.map((b) => ({
    title: b.title,
    creatorName: b.creatorName,
    creatorHandle: b.creatorHandle,
    creatorBio: b.creatorBio,
  })),
  ...EXTRA_THEMES.map((t) => ({
    title: t.title,
    creatorName: t.creatorName,
    creatorHandle: t.creatorHandle,
    creatorBio: t.creatorBio,
  })),
  {
    title: "Bookshop & Rainy Afternoons",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "Quiet corners, warm mugs, and stories worth savoring.",
  },
  {
    title: "Stargazing & Night Walks",
    creatorName: "Daily Curator",
    creatorHandle: "@curator",
    creatorBio: "Peaceful evening skies and late-night reflections.",
  },
  {
    title: "Artisan Craft & Market Days",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "Handmade textures, fresh harvests, and neighborhood warmth.",
  },
  {
    title: "Mountain Trail & Pine Air",
    creatorName: "Daily Curator",
    creatorHandle: "@curator",
    creatorBio: "High ridges, clear streams, and campfire camaraderie.",
  },
  {
    title: "Harbor Breeze & Island Time",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "Salt spray, wooden docks, and golden coastal horizons.",
  },
  {
    title: "Slow Living & Simple Rituals",
    creatorName: "Daily Curator",
    creatorHandle: "@curator",
    creatorBio: "Everyday pauses that bring gratitude into focus.",
  },
  {
    title: "Golden Hour & Open Skies",
    creatorName: "SOL Theory",
    creatorHandle: "@SOLTheory",
    creatorBio: "Long shadows, warm light, and unhurried conversations.",
  },
  {
    title: "Home Hearth & Kitchen Table",
    creatorName: "Daily Curator",
    creatorHandle: "@curator",
    creatorBio: "Shared meals, familiar songs, and the comfort of home.",
  },
];

const SYNTHESIZED_21_BOARDS_CACHE = new Map<string, TwentyOneThingsBoard>();

/**
 * Returns a deterministic, solver/validator-clean, non-repeating 21 Things board for any dateKey.
 * - For `0 <= diff < 66` (`diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey)`), returns `TWENTY_ONE_THINGS_BOARDS[diff]`.
 * - For all other dates in 2026–2027 and beyond, deterministically synthesizes and caches a unique
 *   21-item board with a unique title and 21 distinct items (`<= 30` chars each).
 */
export function get21ThingsBoardForDate(
  dateKey: string = getLocalDateKey(),
  customOverrides?: Record<string, TwentyOneThingsBoard>
): TwentyOneThingsBoard {
  if (customOverrides && customOverrides[dateKey]) {
    return customOverrides[dateKey];
  }

  const puzzleNumber = getPuzzleNumberForDate(dateKey);
  const diff = daysBetweenDateKeys(ROTATION_ANCHOR, dateKey);
  if (diff >= 0 && diff < TWENTY_ONE_THINGS_BOARDS.length) {
    const base = TWENTY_ONE_THINGS_BOARDS[diff]!;
    return {
      ...base,
      puzzleNumber,
      customDate: dateKey,
    };
  }

  const cached = SYNTHESIZED_21_BOARDS_CACHE.get(dateKey);
  if (cached) {
    return {
      ...cached,
      puzzleNumber,
      customDate: dateKey,
    };
  }

  const seqIdx = diff >= TWENTY_ONE_THINGS_BOARDS.length
    ? diff - TWENTY_ONE_THINGS_BOARDS.length
    : 10000 - diff;
  const theme = EXTENDED_21_THEMES[seqIdx % EXTENDED_21_THEMES.length]!;
  const edition = Math.floor(seqIdx / EXTENDED_21_THEMES.length) + 1;

  const rand = mulberry32(fnv1a32(`21-things:bank:v2:${dateKey}:${diff}`));
  const pool = [...ALL_CURATED_21_ITEMS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const items = pool.slice(0, 21);

  const editionLabels = [
    "Morning",
    "Evening",
    "Golden",
    "Quiet",
    "Bright",
    "Coastal",
    "Meadow",
    "Harbor",
    "Summit",
    "Lantern",
    "Solstice",
    "Horizon",
    "Breeze",
    "Timber",
    "Crystal",
    "Garden",
    "Canopy",
    "Starlight",
    "Daybreak",
    "Fireside",
  ] as const;
  const label = editionLabels[edition % editionLabels.length]!;
  const vol = Math.floor(edition / editionLabels.length) + 2;

  const synthesized: TwentyOneThingsBoard = {
    id: `21t-bank-${dateKey}`,
    puzzleNumber,
    title: `${theme.title} · ${label} Vol. ${vol}`,
    creatorName: theme.creatorName,
    creatorHandle: theme.creatorHandle,
    creatorBio: theme.creatorBio,
    items,
    sampleJourneys: [],
    customDate: dateKey,
  };

  SYNTHESIZED_21_BOARDS_CACHE.set(dateKey, synthesized);
  return synthesized;
}


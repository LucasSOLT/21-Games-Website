export interface Connect5HintCoord {
  /** 0-indexed row (1 = Row 2, 2 = Row 3, 3 = Row 4, 4 = Row 5). Row 0 is always 100% revealed. */
  row: number;
  /** 0-indexed column within that word */
  col: number;
}

export interface Connect5Puzzle {
  id: string;
  puzzleNumber: number;
  title: string;
  /** 5 uppercase words of variable length. Row 0 is fully shown to start. */
  words: [string, string, string, string, string];
  /** Explanations for the 4 compound word bridges (Row 1+2, Row 2+3, Row 3+4, Row 4+5) */
  connections: [string, string, string, string];
  /** Creator-selected pre-revealed hint letters in Rows 2-5 (row indices 1..4) */
  revealedHints: Connect5HintCoord[];
  author: string;
  editor: string;
  customDate?: string;
}

export const CONNECT_5_PUZZLES: Connect5Puzzle[] = [
  {
    id: "c5-1",
    puzzleNumber: 1,
    title: "Desk to Breeze",
    words: ["MOUSE", "PAD", "LOCK", "DOWN", "WIND"],
    connections: [
      "MOUSE PAD — cushioned surface for a computer mouse",
      "PADLOCK — portable shackle lock",
      "LOCKDOWN — security protocol confining movement",
      "DOWNWIND — carried in the direction the wind blows",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'P' in PAD
      { row: 3, col: 2 }, // 'W' in DOWN
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-2",
    puzzleNumber: 2,
    title: "Solar Spark",
    words: ["SUN", "LIGHT", "HOUSE", "WORK", "OUT"],
    connections: [
      "SUNLIGHT — natural daylight from the sun",
      "LIGHTHOUSE — coastal beacon tower for ships",
      "HOUSEWORK — everyday chores around the home",
      "WORKOUT — physical exercise session",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'L' in LIGHT
      { row: 2, col: 4 }, // 'E' in HOUSE
      { row: 3, col: 0 }, // 'W' in WORK
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-3",
    puzzleNumber: 3,
    title: "Winter Trail",
    words: ["SNOW", "BALL", "PARK", "WAY", "SIDE"],
    connections: [
      "SNOWBALL — packed sphere of winter snow",
      "BALLPARK — baseball stadium or rough estimate",
      "PARKWAY — landscaped divided highway",
      "WAYSIDE — edge of a road or path",
    ],
    revealedHints: [
      { row: 1, col: 1 }, // 'A' in BALL
      { row: 3, col: 0 }, // 'W' in WAY
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-4",
    puzzleNumber: 4,
    title: "Ember to Timber",
    words: ["FIRE", "PLACE", "MAT", "BOARD", "WALK"],
    connections: [
      "FIREPLACE — brick hearth for an indoor fire",
      "PLACEMAT — protective dining table mat",
      "MATBOARD — thick cardboard framing mount",
      "BOARDWALK — wooden seaside promenade",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'P' in PLACE
      { row: 3, col: 0 }, // 'B' in BOARD
      { row: 4, col: 3 }, // 'K' in WALK
    ],
    author: "Gerard Rick Jardin",
    editor: "Lucas Huff",
  },
  {
    id: "c5-5",
    puzzleNumber: 5,
    title: "Stormy Pages",
    words: ["RAIN", "COAT", "RACK", "TIME", "TABLE"],
    connections: [
      "RAINCOAT — waterproof outer jacket",
      "COAT RACK — stand for hanging jackets",
      "RACK TIME — slang for sleep in a bunk",
      "TIMETABLE — scheduled arrival and departure chart",
    ],
    revealedHints: [
      { row: 1, col: 3 }, // 'T' in COAT
      { row: 3, col: 0 }, // 'T' in TIME
      { row: 4, col: 2 }, // 'B' in TABLE
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-6",
    puzzleNumber: 6,
    title: "Library Shelf",
    words: ["BOOK", "MARK", "DOWN", "TOWN", "SHIP"],
    connections: [
      "BOOKMARK — ribbon or card holding your page",
      "MARKDOWN — price reduction on retail goods",
      "DOWNTOWN — central commercial district of a city",
      "TOWNSHIP — local municipal division",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'M' in MARK
      { row: 3, col: 0 }, // 'T' in TOWN
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-7",
    puzzleNumber: 7,
    title: "Golden Hive",
    words: ["HONEY", "MOON", "LIGHT", "WEIGHT", "LIFT"],
    connections: [
      "HONEYMOON — post-wedding getaway",
      "MOONLIGHT — glow reflected from the full moon",
      "LIGHTWEIGHT — boxing class or airy fabric",
      "WEIGHTLIFT — train with barbells and plates",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'M' in MOON
      { row: 2, col: 4 }, // 'T' in LIGHT
      { row: 3, col: 0 }, // 'W' in WEIGHT
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-8",
    puzzleNumber: 8,
    title: "Ocean Current",
    words: ["SEA", "SHELL", "FISH", "NET", "WORK"],
    connections: [
      "SEASHELL — spiral calcareous home on the beach",
      "SHELLFISH — lobster, crab, clam, or oyster",
      "FISHNET — open diamond-mesh netting",
      "NETWORK — interconnected system of nodes",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'S' in SHELL
      { row: 2, col: 0 }, // 'F' in FISH
    ],
    author: "Gerard Rick Jardin",
    editor: "Stephen Huff",
  },
  {
    id: "c5-9",
    puzzleNumber: 9,
    title: "Cosmic Kick",
    words: ["STAR", "FISH", "BOWL", "GAME", "PLAY"],
    connections: [
      "STARFISH — five-armed marine echinoderm",
      "FISHBOWL — round glass aquarium",
      "BOWL GAME — postseason college football matchup",
      "GAMEPLAY — interactive mechanics of a video game",
    ],
    revealedHints: [
      { row: 1, col: 2 }, // 'S' in FISH
      { row: 3, col: 0 }, // 'G' in GAME
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-10",
    puzzleNumber: 10,
    title: "Craft & Crown",
    words: ["HAND", "MADE", "UP", "GRADE", "SCHOOL"],
    connections: [
      "HANDMADE — crafted by artisan skill rather than machine",
      "MADE-UP — invented or wearing cosmetics",
      "UPGRADE — elevate to a higher tier",
      "GRADE SCHOOL — elementary education",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'M' in MADE
      { row: 3, col: 0 }, // 'G' in GRADE
      { row: 4, col: 5 }, // 'L' in SCHOOL
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-11",
    puzzleNumber: 11,
    title: "Footsteps Forward",
    words: ["FOOT", "STEP", "DOWN", "STAGE", "LIGHT"],
    connections: [
      "FOOTSTEP — sound or mark of a walking stride",
      "STEP DOWN — descend a stair or yield a title",
      "DOWNSTAGE — toward the front of a theater platform",
      "STAGELIGHT — bright theatrical spotlight",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'S' in STEP
      { row: 3, col: 0 }, // 'S' in STAGE
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-12",
    puzzleNumber: 12,
    title: "Night Watch",
    words: ["EYE", "LID", "LOCK", "SMITH", "WORK"],
    connections: [
      "EYELID — protective fold of skin over the eye",
      "LID LOCK — clasp that secures a container cover",
      "LOCKSMITH — specialist who crafts and repairs keys",
      "SMITHWORK — forged metal craft",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'L' in LID
      { row: 3, col: 0 }, // 'S' in SMITH
    ],
    author: "Gerard Rick Jardin",
    editor: "Lucas Huff",
  },
  {
    id: "c5-13",
    puzzleNumber: 13,
    title: "Morning Brew",
    words: ["COFFEE", "POT", "HOLE", "CARD", "BOARD"],
    connections: [
      "COFFEE POT — carafe for brewing morning roast",
      "POTHOLE — crater worn into pavement",
      "HOLE CARD — face-down poker card",
      "CARDBOARD — heavy-duty shipping box material",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'P' in POT
      { row: 2, col: 0 }, // 'H' in HOLE
      { row: 4, col: 4 }, // 'D' in BOARD
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-14",
    puzzleNumber: 14,
    title: "Canyon Echo",
    words: ["ROCK", "STAR", "LIGHT", "YEAR", "BOOK"],
    connections: [
      "ROCK STAR — headlining concert musician",
      "STARLIGHT — twinkle from distant suns",
      "LIGHT-YEAR — astronomical distance unit",
      "YEARBOOK — annual school memory album",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'S' in STAR
      { row: 2, col: 0 }, // 'L' in LIGHT
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-15",
    puzzleNumber: 15,
    title: "Harbor Line",
    words: ["WATER", "FALL", "OUT", "SIDE", "WALK"],
    connections: [
      "WATERFALL — cascade plunging over a cliff",
      "FALLOUT — aftermath of a major event",
      "OUTSIDE — beyond the exterior walls",
      "SIDEWALK — paved pedestrian path",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'F' in FALL
      { row: 3, col: 0 }, // 'S' in SIDE
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-16",
    puzzleNumber: 16,
    title: "Skyward Flight",
    words: ["AIR", "PORT", "HOLE", "PUNCH", "LINE"],
    connections: [
      "AIRPORT — aviation terminal with runways",
      "PORTHOLE — circular ship cabin window",
      "HOLE PUNCH — office tool for three-ring binders",
      "PUNCHLINE — climax of a joke",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'P' in PORT
      { row: 3, col: 0 }, // 'P' in PUNCH
    ],
    author: "Gerard Rick Jardin",
    editor: "Stephen Huff",
  },
  {
    id: "c5-17",
    puzzleNumber: 17,
    title: "Sweet Tooth",
    words: ["CUP", "CAKE", "WALK", "WAY", "BACK"],
    connections: [
      "CUPCAKE — single-serving frosted sponge cake",
      "CAKEWALK — effortlessly easy task",
      "WALKWAY — bridged passage for pedestrians",
      "WAY BACK — long ago in the past",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'C' in CAKE
      { row: 2, col: 3 }, // 'K' in WALK
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-18",
    puzzleNumber: 18,
    title: "Full Throttle",
    words: ["CAR", "POOL", "SIDE", "KICK", "START"],
    connections: [
      "CARPOOL — shared daily commute",
      "POOLSIDE — lounging next to the water",
      "SIDEKICK — loyal companion on an adventure",
      "KICKSTART — launch with a burst of energy",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'P' in POOL
      { row: 3, col: 0 }, // 'K' in KICK
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-19",
    puzzleNumber: 19,
    title: "Checkmate",
    words: ["BOARD", "GAME", "TIME", "OUT", "DOOR"],
    connections: [
      "BOARD GAME — tabletop strategy pastime",
      "GAME TIME — moment the match begins",
      "TIMEOUT — tactical pause in play",
      "OUTDOOR — in the open fresh air",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'G' in GAME
      { row: 2, col: 0 }, // 'T' in TIME
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-20",
    puzzleNumber: 20,
    title: "Thunder Roll",
    words: ["THUNDER", "STORM", "CLOUD", "BURST", "PIPE"],
    connections: [
      "THUNDERSTORM — lightning and heavy rain squall",
      "STORM CLOUD — dark cumulonimbus formation",
      "CLOUDBURST — sudden torrential downpour",
      "BURST PIPE — winter plumbing emergency",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'S' in STORM
      { row: 2, col: 0 }, // 'C' in CLOUD
      { row: 3, col: 0 }, // 'B' in BURST
    ],
    author: "Gerard Rick Jardin",
    editor: "Lucas Huff",
  },
  {
    id: "c5-21",
    puzzleNumber: 21,
    title: "Solstice Gold",
    words: ["DAY", "DREAM", "TEAM", "WORK", "BENCH"],
    connections: [
      "DAYDREAM — pleasant reverie while awake",
      "DREAM TEAM — all-star roster of talent",
      "TEAMWORK — collaborative group effort",
      "WORKBENCH — sturdy table for tools and carpentry",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'D' in DREAM
      { row: 2, col: 0 }, // 'T' in TEAM
      { row: 4, col: 0 }, // 'B' in BENCH
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-22",
    puzzleNumber: 22,
    title: "Green Canopy",
    words: ["TREE", "HOUSE", "PLANT", "LIFE", "GUARD"],
    connections: [
      "TREEHOUSE — childhood fort in the branches",
      "HOUSEPLANT — indoor fern or monstera",
      "PLANT LIFE — botanical flora of a region",
      "LIFEGUARD — beach swimmer on the lookout tower",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'H' in HOUSE
      { row: 2, col: 0 }, // 'P' in PLANT
      { row: 4, col: 4 }, // 'D' in GUARD
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-23",
    puzzleNumber: 23,
    title: "Silver Screen",
    words: ["POP", "CORN", "FIELD", "TRIP", "WIRE"],
    connections: [
      "POPCORN — buttered cinema snack",
      "CORNFIELD — rows of tall golden stalks",
      "FIELD TRIP — class excursion to a museum",
      "TRIPWIRE — hidden cord that triggers an alarm",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'C' in CORN
      { row: 2, col: 0 }, // 'F' in FIELD
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-24",
    puzzleNumber: 24,
    title: "Midnight Express",
    words: ["RAIL", "ROAD", "BLOCK", "PARTY", "LINE"],
    connections: [
      "RAILROAD — steel track network for locomotives",
      "ROADBLOCK — barrier halting traffic",
      "BLOCK PARTY — neighborhood street celebration",
      "PARTY LINE — shared telephone circuit or platform",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'R' in ROAD
      { row: 2, col: 0 }, // 'B' in BLOCK
      { row: 3, col: 0 }, // 'P' in PARTY
    ],
    author: "Gerard Rick Jardin",
    editor: "Stephen Huff",
  },
  {
    id: "c5-25",
    puzzleNumber: 25,
    title: "Paper Trail",
    words: ["NOTE", "BOOK", "CASE", "WORK", "SHOP"],
    connections: [
      "NOTEBOOK — spiral pad for jotting ideas",
      "BOOKCASE — shelving unit for novels",
      "CASEWORK — social or legal investigation files",
      "WORKSHOP — studio where artisans build",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'B' in BOOK
      { row: 3, col: 0 }, // 'W' in WORK
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-26",
    puzzleNumber: 26,
    title: "Brass Key",
    words: ["DOOR", "BELL", "HOP", "SCOTCH", "TAPE"],
    connections: [
      "DOORBELL — chime button on the front porch",
      "BELLHOP — hotel porter who carries luggage",
      "HOPSCOTCH — chalk-drawn sidewalk jumping game",
      "SCOTCH TAPE — transparent adhesive roll",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'B' in BELL
      { row: 3, col: 0 }, // 'S' in SCOTCH
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-27",
    puzzleNumber: 27,
    title: "Wildflower",
    words: ["BUTTER", "FLY", "WHEEL", "CHAIR", "LIFT"],
    connections: [
      "BUTTERFLY — monarch or swallowtail insect",
      "FLYWHEEL — heavy rotating mechanical disk",
      "WHEELCHAIR — rolling mobility seat",
      "CHAIRLIFT — ski mountain cable transport",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'F' in FLY
      { row: 2, col: 0 }, // 'W' in WHEEL
      { row: 3, col: 0 }, // 'C' in CHAIR
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-28",
    puzzleNumber: 28,
    title: "Soundwave",
    words: ["DRUM", "STICK", "SHIFT", "KEY", "BOARD"],
    connections: [
      "DRUMSTICK — wooden percussion beater",
      "STICK SHIFT — manual transmission gear lever",
      "SHIFT KEY — capital-letter modifier on a typewriter",
      "KEYBOARD — piano keys or computer typing deck",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'S' in STICK
      { row: 2, col: 0 }, // 'S' in SHIFT
      { row: 3, col: 0 }, // 'K' in KEY
    ],
    author: "Gerard Rick Jardin",
    editor: "Lucas Huff",
  },
  {
    id: "c5-29",
    puzzleNumber: 29,
    title: "High Tide",
    words: ["SAND", "BOX", "CAR", "WASH", "OUT"],
    connections: [
      "SANDBOX — playground pit for buckets and shovels",
      "BOXCAR — enclosed freight train wagon",
      "CAR WASH — drive-through soap and rinse tunnel",
      "WASHOUT — rain-cancelled event or eroded road",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'B' in BOX
      { row: 3, col: 0 }, // 'W' in WASH
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-30",
    puzzleNumber: 30,
    title: "Headliner",
    words: ["HEAD", "LINE", "BACK", "PACK", "ICE"],
    connections: [
      "HEADLINE — front-page newspaper banner",
      "LINEBACK — defensive football position",
      "BACKPACK — canvas rucksack for hiking",
      "PACK ICE — floating polar sea floes",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'L' in LINE
      { row: 2, col: 0 }, // 'B' in BACK
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-31",
    puzzleNumber: 31,
    title: "Orchard Gold",
    words: ["APPLE", "PIE", "CHART", "TOP", "SOIL"],
    connections: [
      "APPLE PIE — classic cinnamon-spiced dessert",
      "PIE CHART — circular statistical graph",
      "CHART-TOP — hit song reaching number one",
      "TOPSOIL — nutrient-rich upper earth layer",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'P' in PIE
      { row: 2, col: 0 }, // 'C' in CHART
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-32",
    puzzleNumber: 32,
    title: "Campfire Glow",
    words: ["WOOD", "WORK", "FORCE", "FIELD", "GOAL"],
    connections: [
      "WOODWORK — interior molding and cabinetry",
      "WORKFORCE — all employees in an industry",
      "FORCE FIELD — sci-fi energy barrier",
      "FIELD GOAL — three-point kick through the uprights",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'W' in WORK
      { row: 2, col: 0 }, // 'F' in FORCE
      { row: 3, col: 0 }, // 'F' in FIELD
    ],
    author: "Gerard Rick Jardin",
    editor: "Stephen Huff",
  },
  {
    id: "c5-33",
    puzzleNumber: 33,
    title: "Clockwork",
    words: ["TIME", "ZONE", "OUT", "POST", "CARD"],
    connections: [
      "TIME ZONE — geographic region sharing standard time",
      "ZONE OUT — lose focus in a daydream",
      "OUTPOST — remote frontier station",
      "POSTCARD — stamped souvenir photo mailer",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'Z' in ZONE
      { row: 3, col: 0 }, // 'P' in POST
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-34",
    puzzleNumber: 34,
    title: "Blue Horizon",
    words: ["SKY", "LINE", "UP", "TOWN", "HALL"],
    connections: [
      "SKYLINE — silhouette of skyscrapers against the horizon",
      "LINEUP — batting order or festival bill",
      "UPTOWN — residential northern district",
      "TOWN HALL — civic assembly building",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'L' in LINE
      { row: 3, col: 0 }, // 'T' in TOWN
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-35",
    puzzleNumber: 35,
    title: "Gold Rush",
    words: ["GOLD", "MINE", "FIELD", "WORK", "DAY"],
    connections: [
      "GOLD MINE — rich vein of precious ore",
      "MINEFIELD — hazardous territory full of traps",
      "FIELDWORK — hands-on research outside the lab",
      "WORKDAY — hours spent on the job",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'M' in MINE
      { row: 2, col: 0 }, // 'F' in FIELD
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-36",
    puzzleNumber: 36,
    title: "Bridge & Tunnel",
    words: ["TOLL", "GATE", "WAY", "FIND", "OUT"],
    connections: [
      "TOLLGATE — booth collecting highway passage fees",
      "GATEWAY — arch or portal into a region",
      "WAYFIND — navigate using environmental signs",
      "FIND OUT — discover the hidden truth",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'G' in GATE
      { row: 3, col: 0 }, // 'F' in FIND
    ],
    author: "Gerard Rick Jardin",
    editor: "Lucas Huff",
  },
  {
    id: "c5-37",
    puzzleNumber: 37,
    title: "Signal Flare",
    words: ["FLASH", "LIGHT", "SPEED", "BOAT", "HOUSE"],
    connections: [
      "FLASHLIGHT — handheld battery torch",
      "LIGHT SPEED — ultimate cosmic velocity limit",
      "SPEEDBOAT — fast motor-powered watercraft",
      "BOATHOUSE — waterside shelter for canoes and yachts",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'L' in LIGHT
      { row: 2, col: 0 }, // 'S' in SPEED
      { row: 3, col: 0 }, // 'B' in BOAT
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-38",
    puzzleNumber: 38,
    title: "Candlelight",
    words: ["WAX", "PAPER", "BACK", "BONE", "DRY"],
    connections: [
      "WAX PAPER — nonstick kitchen wrapping sheet",
      "PAPERBACK — softcover edition of a novel",
      "BACKBONE — spinal column or courage",
      "BONE-DRY — completely parched without moisture",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'P' in PAPER
      { row: 3, col: 0 }, // 'B' in BONE
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-39",
    puzzleNumber: 39,
    title: "Mountain Pass",
    words: ["HIGH", "WAY", "SIDE", "SHOW", "CASE"],
    connections: [
      "HIGHWAY — interstate express road",
      "WAYSIDE — shoulder along a country lane",
      "SIDESHOW — carnival tent attraction",
      "SHOWCASE — glass display cabinet",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'W' in WAY
      { row: 3, col: 0 }, // 'S' in SHOW
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-40",
    puzzleNumber: 40,
    title: "Greenhouse",
    words: ["GLASS", "HOUSE", "BOAT", "LOAD", "STAR"],
    connections: [
      "GLASS HOUSE — conservatory where no one throws stones",
      "HOUSEBOAT — floating home moored on a canal",
      "BOATLOAD — huge quantity",
      "LOADSTAR — guiding principle or pole star",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'H' in HOUSE
      { row: 2, col: 0 }, // 'B' in BOAT
    ],
    author: "Gerard Rick Jardin",
    editor: "Stephen Huff",
  },
  {
    id: "c5-41",
    puzzleNumber: 41,
    title: "Grand Slam",
    words: ["BASE", "BALL", "ROOM", "MATE", "SHIP"],
    connections: [
      "BASEBALL — America's nine-inning diamond pastime",
      "BALLROOM — grand hall for waltzing",
      "ROOMMATE — person sharing an apartment",
      "MATESHIP — loyal camaraderie among friends",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'B' in BALL
      { row: 2, col: 0 }, // 'R' in ROOM
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-42",
    puzzleNumber: 42,
    title: "North Wind",
    words: ["WIND", "MILL", "STONE", "WALL", "PAPER"],
    connections: [
      "WINDMILL — sail-powered grain grinder",
      "MILLSTONE — heavy circular grinding wheel",
      "STONEWALL — delay or refuse to answer",
      "WALLPAPER — patterned decorative room roll",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'M' in MILL
      { row: 2, col: 0 }, // 'S' in STONE
      { row: 4, col: 0 }, // 'P' in PAPER
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-43",
    puzzleNumber: 43,
    title: "First Class",
    words: ["MAIL", "BOX", "OFFICE", "SPACE", "CRAFT"],
    connections: [
      "MAILBOX — curbside letter receptacle",
      "BOX OFFICE — theater ticket booth",
      "OFFICE SPACE — workplace cubicles and desks",
      "SPACECRAFT — orbital capsule or probe",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'B' in BOX
      { row: 2, col: 0 }, // 'O' in OFFICE
      { row: 3, col: 0 }, // 'S' in SPACE
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-44",
    puzzleNumber: 44,
    title: "Velvet Curtain",
    words: ["STAGE", "COACH", "WORK", "BOOK", "SHELF"],
    connections: [
      "STAGECOACH — horse-drawn frontier carriage",
      "COACHWORK — custom automobile body craftsmanship",
      "WORKBOOK — student practice exercise manual",
      "BOOKSHELF — ledge for storing hardcovers",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'C' in COACH
      { row: 3, col: 0 }, // 'B' in BOOK
    ],
    author: "Gerard Rick Jardin",
    editor: "Lucas Huff",
  },
  {
    id: "c5-45",
    puzzleNumber: 45,
    title: "Quick Silver",
    words: ["SILVER", "WARE", "HOUSE", "HOLD", "BACK"],
    connections: [
      "SILVERWARE — forks, knives, and spoons",
      "WAREHOUSE — large logistics storage building",
      "HOUSEHOLD — everyone living under one roof",
      "HOLD BACK — restrain or keep in reserve",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'W' in WARE
      { row: 2, col: 0 }, // 'H' in HOUSE
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-46",
    puzzleNumber: 46,
    title: "Ocean Breeze",
    words: ["WAVE", "LENGTH", "WISE", "CRACK", "DOWN"],
    connections: [
      "WAVELENGTH — distance between cresting peaks",
      "LENGTHWISE — running from end to end",
      "WISECRACK — witty or sarcastic quip",
      "CRACKDOWN — strict enforcement of rules",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'L' in LENGTH
      { row: 2, col: 0 }, // 'W' in WISE
      { row: 3, col: 0 }, // 'C' in CRACK
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-47",
    puzzleNumber: 47,
    title: "Silk Road",
    words: ["CROSS", "WORD", "PLAY", "GROUND", "WORK"],
    connections: [
      "CROSSWORD — intersecting numbered word grid",
      "WORDPLAY — clever puns and double entendres",
      "PLAYGROUND — park with swings and slides",
      "GROUNDWORK — essential preliminary foundation",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'W' in WORD
      { row: 2, col: 0 }, // 'P' in PLAY
      { row: 3, col: 0 }, // 'G' in GROUND
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-48",
    puzzleNumber: 48,
    title: "Neon Sign",
    words: ["NIGHT", "LIFE", "TIME", "LINE", "MAN"],
    connections: [
      "NIGHTLIFE — evening entertainment and clubs",
      "LIFETIME — span of one's entire existence",
      "TIMELINE — chronological sequence of events",
      "LINEMAN — utility grid climber or football tackle",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'L' in LIFE
      { row: 2, col: 0 }, // 'T' in TIME
    ],
    author: "Gerard Rick Jardin",
    editor: "Stephen Huff",
  },
  {
    id: "c5-49",
    puzzleNumber: 49,
    title: "Iron Forge",
    words: ["BLACK", "SMITH", "WORK", "PLACE", "HOLDER"],
    connections: [
      "BLACKSMITH — artisan who shapes horseshoes on an anvil",
      "SMITHWORK — wrought iron metalworking",
      "WORKPLACE — office, studio, or factory floor",
      "PLACEHOLDER — temporary symbol standing in for text",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'S' in SMITH
      { row: 3, col: 0 }, // 'P' in PLACE
      { row: 4, col: 0 }, // 'H' in HOLDER
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-50",
    puzzleNumber: 50,
    title: "Golden Gate",
    words: ["BRIDGE", "WORK", "LOAD", "STONE", "WARE"],
    connections: [
      "BRIDGEWORK — dental crown structure or span engineering",
      "WORKLOAD — amount of tasks assigned",
      "LOADSTONE — naturally magnetized iron ore",
      "STONEWARE — high-fired ceramic pottery",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'W' in WORK
      { row: 2, col: 0 }, // 'L' in LOAD
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-51",
    puzzleNumber: 51,
    title: "River Bend",
    words: ["RIVER", "BANK", "NOTE", "PAD", "LOCK"],
    connections: [
      "RIVERBANK — grassy slope beside flowing water",
      "BANKNOTE — printed paper currency bill",
      "NOTEPAD — bound stack of writing sheets",
      "PADLOCK — detachable security clasp",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'B' in BANK
      { row: 2, col: 0 }, // 'N' in NOTE
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-52",
    puzzleNumber: 52,
    title: "Press Pass",
    words: ["NEWS", "PAPER", "CLIP", "BOARD", "ROOM"],
    connections: [
      "NEWSPAPER — daily printed journal",
      "PAPERCLIP — bent wire fastener for sheets",
      "CLIPBOARD — rigid writing backing with a spring clamp",
      "BOARDROOM — executive council chamber",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'P' in PAPER
      { row: 2, col: 0 }, // 'C' in CLIP
      { row: 3, col: 0 }, // 'B' in BOARD
    ],
    author: "Gerard Rick Jardin",
    editor: "Lucas Huff",
  },
  {
    id: "c5-53",
    puzzleNumber: 53,
    title: "Summit Trail",
    words: ["BACK", "WOODS", "MAN", "POWER", "PLANT"],
    connections: [
      "BACKWOODS — remote forested wilderness",
      "WOODSMAN — skilled forest ranger or logger",
      "MANPOWER — human labor force",
      "POWER PLANT — electrical generating station",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'W' in WOODS
      { row: 3, col: 0 }, // 'P' in POWER
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-54",
    puzzleNumber: 54,
    title: "Victory Lap",
    words: ["RACE", "TRACK", "DOWN", "POUR", "OVER"],
    connections: [
      "RACETRACK — oval circuit for sprints or motorsports",
      "TRACK DOWN — locate after a thorough search",
      "DOWNPOUR — sudden heavy rainstorm",
      "POUR-OVER — hand-dripped artisan coffee method",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'T' in TRACK
      { row: 3, col: 0 }, // 'P' in POUR
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-55",
    puzzleNumber: 55,
    title: "Anchor Drop",
    words: ["SHIP", "WRECK", "AGE", "GROUP", "CHAT"],
    connections: [
      "SHIPWRECK — sunken vessel on the ocean floor",
      "WRECKAGE — debris left after a collision",
      "AGE GROUP — demographic cohort",
      "GROUP CHAT — multi-friend messaging thread",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'W' in WRECK
      { row: 3, col: 0 }, // 'G' in GROUP
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-56",
    puzzleNumber: 56,
    title: "Crystal Clear",
    words: ["ICE", "COLD", "FRONT", "DOOR", "STEP"],
    connections: [
      "ICE COLD — chilled to freezing perfection",
      "COLD FRONT — advancing edge of a cool air mass",
      "FRONT DOOR — main entrance to a home",
      "DOORSTEP — threshold right outside an entry",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'C' in COLD
      { row: 2, col: 0 }, // 'F' in FRONT
      { row: 3, col: 0 }, // 'D' in DOOR
    ],
    author: "Gerard Rick Jardin",
    editor: "Stephen Huff",
  },
  {
    id: "c5-57",
    puzzleNumber: 57,
    title: "Firefly Dusk",
    words: ["GLOW", "WORM", "HOLE", "SHOT", "GUN"],
    connections: [
      "GLOWWORM — bioluminescent beetle larva",
      "WORMHOLE — theoretical tunnel through spacetime",
      "HOLESHOT — fastest start off the motocross gate",
      "SHOTGUN — front passenger seat callout",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'W' in WORM
      { row: 3, col: 0 }, // 'S' in SHOT
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-58",
    puzzleNumber: 58,
    title: "Campground",
    words: ["TENT", "POLE", "STAR", "DUST", "PAN"],
    connections: [
      "TENT POLE — fiberglass rod supporting a shelter",
      "POLESTAR — Polaris in the northern sky",
      "STARDUST — cosmic particles or magical romance",
      "DUSTPAN — flat scoop used with a broom",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'P' in POLE
      { row: 2, col: 0 }, // 'S' in STAR
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-59",
    puzzleNumber: 59,
    title: "Match Point",
    words: ["LOVE", "BIRD", "HOUSE", "CALL", "BACK"],
    connections: [
      "LOVEBIRD — affectionate small parrot",
      "BIRDHOUSE — wooden garden nesting box",
      "HOUSE CALL — doctor visit to a patient's home",
      "CALLBACK — second audition for a role",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'B' in BIRD
      { row: 2, col: 0 }, // 'H' in HOUSE
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-60",
    puzzleNumber: 60,
    title: "Soundcheck",
    words: ["BASS", "LINE", "DRIVE", "WAY", "OUT"],
    connections: [
      "BASSLINE — low-frequency rhythmic groove",
      "LINE DRIVE — sharp baseball hit straight through the infield",
      "DRIVEWAY — private lane leading to a garage",
      "WAY OUT — exit door or far-out idea",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'L' in LINE
      { row: 2, col: 0 }, // 'D' in DRIVE
    ],
    author: "Gerard Rick Jardin",
    editor: "Lucas Huff",
  },
  {
    id: "c5-61",
    puzzleNumber: 61,
    title: "Harvest Moon",
    words: ["CORN", "BREAD", "BOX", "SPRING", "TIME"],
    connections: [
      "CORNBREAD — golden skillet-baked southern loaf",
      "BREADBOX — countertop bin for keeping loaves fresh",
      "BOX SPRING — upholstered mattress support frame",
      "SPRINGTIME — season of cherry blossoms",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'B' in BREAD
      { row: 3, col: 0 }, // 'S' in SPRING
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-62",
    puzzleNumber: 62,
    title: "First Light",
    words: ["DAWN", "BREAK", "FAST", "TRACK", "SIDE"],
    connections: [
      "DAWNBREAK — first gleam of morning light",
      "BREAKFAST — morning meal of eggs and toast",
      "FAST TRACK — accelerated path to completion",
      "TRACKSIDE — right next to the running rails",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'B' in BREAK
      { row: 3, col: 0 }, // 'T' in TRACK
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
  {
    id: "c5-63",
    puzzleNumber: 63,
    title: "Deep Blue",
    words: ["SHIP", "YARD", "STICK", "PIN", "POINT"],
    connections: [
      "SHIPYARD — dockyard where vessels are built",
      "YARDSTICK — three-foot measuring rule",
      "STICKPIN — decorative lapel cravat pin",
      "PINPOINT — locate with exact precision",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'Y' in YARD
      { row: 2, col: 0 }, // 'S' in STICK
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-64",
    puzzleNumber: 64,
    title: "Crown Jewel",
    words: ["KING", "PIN", "WHEEL", "HOUSE", "TOP"],
    connections: [
      "KINGPIN — central bowling pin or chief figure",
      "PINWHEEL — spinning paper wind toy",
      "WHEELHOUSE — pilothouse or area of expertise",
      "HOUSETOP — roof ridge of a home",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'P' in PIN
      { row: 2, col: 0 }, // 'W' in WHEEL
      { row: 3, col: 0 }, // 'H' in HOUSE
    ],
    author: "Gerard Rick Jardin",
    editor: "Stephen Huff",
  },
  {
    id: "c5-65",
    puzzleNumber: 65,
    title: "Home Stretch",
    words: ["HOME", "RUN", "WAY", "BACK", "YARD"],
    connections: [
      "HOME RUN — four-base blast over the fence",
      "RUNWAY — airport strip or fashion catwalk",
      "WAY BACK — distant memory or rear seat",
      "BACKYARD — lawn behind a house",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'R' in RUN
      { row: 3, col: 0 }, // 'B' in BACK
    ],
    author: "Lucas Huff",
    editor: "Stephen Huff",
  },
  {
    id: "c5-66",
    puzzleNumber: 66,
    title: "Starlight Express",
    words: ["MOON", "BEAM", "DOWN", "HILL", "TOP"],
    connections: [
      "MOONBEAM — silvery shaft of lunar light",
      "BEAM DOWN — teleport from orbit to the surface",
      "DOWNHILL — coasting effortlessly down a slope",
      "HILLTOP — highest crest of a ridge",
    ],
    revealedHints: [
      { row: 1, col: 0 }, // 'B' in BEAM
      { row: 2, col: 0 }, // 'D' in DOWN
    ],
    author: "Stephen Huff",
    editor: "Lucas Huff",
  },
];

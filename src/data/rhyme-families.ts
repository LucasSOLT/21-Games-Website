/**
 * Perfect-rhyme family dictionary shared by:
 *   - `src/data/puzzles/9-rhymes.ts`  (66-day bank + deterministic seeded fallback)
 *   - `src/lib/ai-helper.ts`          (`suggest9RhymesChain` 100% local fallback)
 *
 * Every word in a family shares ONE exact perfect rhyme sound (same stressed vowel +
 * identical coda, different onset). No two homophones appear in the same family.
 * Each entry is `word=clue` where the clue never contains the answer.
 */

export interface RhymeEntry {
  word: string;
  clue: string;
}

export interface RhymeFamily {
  id: string;
  /** Human label for the shared sound, e.g. "-ight". */
  sound: string;
  entries: RhymeEntry[];
}

function family(id: string, sound: string, raw: string): RhymeFamily {
  const entries = raw
    .trim()
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("=");
      return { word: line.slice(0, idx).trim().toLowerCase(), clue: line.slice(idx + 1).trim() };
    })
    .filter((e) => e.word.length > 0 && e.clue.length > 0);
  return { id, sound, entries };
}

export const RHYME_FAMILIES: readonly RhymeFamily[] = [
  family("ight", "-ight", `
night=When the moon comes out
light=A lamp gives off this
right=The opposite of left
sight=One of your five senses
flight=Journey by airplane
bright=Shining and vivid
tight=Snug, not loose
fight=A boxing match
might=Strength or power
white=Color of fresh snow
kite=It flies on a string
bite=What a dentist checks
quite=Rather, or very
spite=Malice
`),
  family("ake", "-ake", `
cake=Birthday dessert
lake=Body of fresh water
make=Build or create
take=Grab, not give
bake=Cook in an oven
shake=Milk's frosty cousin
snake=Slithering reptile
wake=Rise from sleep
brake=Car's stopping pedal
flake=A single bit of snow
fake=Not real
rake=Autumn yard tool
steak=Grilled cut of beef
break=Rest between tasks
stake=Vampire's nightmare
awake=Not asleep
`),
  family("ay", "-ay", `
day=Sunrise to sunset
say=Speak
play=Fun for children
way=Path or route
stay=Remain in place
gray=Color of storm clouds
clay=Potter's material
tray=Cafeteria carrier
spray=Fine mist from a can
pray=Speak to a higher power
bay=Sheltered stretch of sea
hay=Horse feed
pay=Wages
ray=Beam of sunshine
sway=Rock gently side to side
away=Not here
`),
  family("oat", "-oat", `
boat=Floats on a lake
coat=Winter jacket
goat=Farm animal that bleats
float=Stay on the surface
note=Short written message
vote=Cast a ballot
wrote=Penned a letter
quote=Repeat someone's words
throat=Where a sore feeling happens
moat=Castle's water ring
remote=Far away; TV clicker
oat=Porridge grain
`),
  family("ee", "-ee", `
tree=Home to leaves and birds
free=No cost
three=One more than two
key=Opens a lock
bee=Honey maker
knee=Joint in your leg
flee=Run away
glee=Pure joy
tea=Hot leaf drink
fee=Charge for a service
plea=Desperate request
agree=Share the same opinion
spree=Shopping ___
guarantee=Warranty promise
`),
  family("old", "-old", `
gold=Olympic first-place prize
cold=Freezing
hold=Grip
bold=Brave and daring
fold=Crease a paper
told=Past tense of "tell"
sold=Past tense of "sell"
old=Not young
mold=Fuzzy bread growth
scold=Tell off
behold=Look at with wonder
unfold=Open out
`),
  family("ound", "-ound", `
sound=What your ears pick up
round=Shaped like a ball
found=Past tense of "find"
ground=The earth beneath your feet
bound=Leap, or tied up
hound=Hunting dog
pound=Unit of weight
mound=Small hill
around=On every side
profound=Deeply meaningful
astound=Greatly amaze
rebound=Bounce back
`),
  family("ain", "-ain", `
rain=Falls from clouds
train=Rides on tracks
plane=Flies with wings
brain=Thinking organ
chain=Linked metal loops
drain=Where bathwater goes
gain=Opposite of loss
main=Principal
pain=Ouch!
stain=Spot on a shirt
lane=Swimming pool strip
cane=Candy ___ at Christmas
crane=Tall bird or building machine
vain=Too proud of one's looks
grain=Wheat or rice kernel
explain=Make clear
`),
  family("ow", "-ow", `
go=Move along
show=TV program
slow=Not fast
flow=What a river does
grow=Get bigger
glow=Firefly's light
low=Not high
snow=Winter white stuff
row=Line of seats
toe=Digit on a foot
throw=Toss
below=Underneath
know=Be certain of
blow=Puff air
crow=Black bird
hello=Greeting
`),
  family("ouse", "-ouse", `
house=Place to live
mouse=Squeaky rodent
blouse=Woman's shirt
grouse=Complain
spouse=Husband or wife
louse=Tiny parasitic insect
dormouse=Sleepy little rodent
doghouse=Where Snoopy sleeps
`),
  family("ing", "-ing", `
sing=Perform a song
ring=Wedding band
king=Ruler with a crown
wing=Bird's flying limb
bring=Carry here
spring=Season of blooming
thing=An object
swing=Playground seat on chains
string=Kite's tether
cling=Hold on tightly
sting=Bee's weapon
fling=A brief affair, or a toss
`),
  family("ell", "-ell", `
bell=It rings at school
tell=Reveal a secret
well=In good health
sell=Opposite of buy
shell=Seashore souvenir
smell=What your nose does
spell=Magic words
fell=Dropped down
yell=Shout
cell=Prison room
dwell=Live somewhere
swell=Grow bigger
farewell=Goodbye
`),
  family("eat", "-eat", `
eat=Have lunch
beat=Drum sound
heat=Opposite of cold
seat=Place to sit
meat=Steak or chicken
neat=Tidy
treat=Halloween goodie
wheat=Bread's grain
sweet=Sugary
feet=Twelve inches
street=Road in town
sheet=Bed linen
greet=Say hi to
fleet=Group of ships
cheat=Break the rules
`),
  family("ore", "-ore", `
more=Additional
door=Entrance
floor=What you walk on indoors
shore=Where the sea meets sand
store=Shop
core=Center of an apple
bore=Dull person
wore=Had on clothes
score=Points in a game
roar=Lion's cry
soar=Fly high
pour=Tip a liquid out
four=Two plus two
snore=Noisy sleep sound
explore=Search new places
before=Earlier than
ignore=Pay no attention
`),
  family("ear", "-ear", `
ear=Organ on the side of your head
near=Close by
dear=Beloved
fear=Scared feeling
hear=Listen
year=Twelve months
clear=Transparent
beer=Pub drink
cheer=Shout for the team
steer=Guide a car
sphere=Ball shape
gear=Equipment
spear=Pointed throwing weapon
appear=Come into view
`),
  family("ark", "-ark", `
dark=No light
park=Where kids play outdoors
bark=Dog sound
mark=Make a spot or score
spark=Tiny fire flash
shark=Jaws
lark=Songbird, or a prank
stark=Harsh and bare
hark=Listen!
arc=Curved line
`),
  family("ine", "-ine", `
line=Queue
fine=Okay, or a ticket penalty
mine=Belonging to me
nine=One less than ten
pine=Evergreen tree
shine=Sparkle
vine=Grapes grow on it
wine=Grape drink
sign=Stop ___
design=Plan the look
divine=Heavenly
dine=Eat dinner
spine=Backbone
twine=Thin rope
shrine=Holy place
swine=Pigs
`),
  family("ime", "-ime", `
time=Clock tells it
rhyme=Poem's echo
climb=Go up a mountain
lime=Green citrus
dime=Ten cents
crime=Detective's concern
slime=Gooey ooze
prime=First-rate
chime=Soft bell sound
grime=Dirt buildup
mime=Silent performer
sublime=Awe-inspiring
`),
  family("ool", "-ool", `
cool=Pleasantly chilly
pool=Swimming spot
school=Where students learn
tool=Hammer, for one
fool=Silly person
rule=Law to follow
drool=Dog's dribble
spool=Thread holder
stool=Seat with no back
mule=Horse-donkey cross
`),
  family("ose", "-ose", `
nose=Smelling organ
rose=Thorny red flower
those=Not these
toes=Ten on your feet
goes=Departs
hose=Garden water pipe
pose=Strike a stance
prose=Not poetry
froze=Turned to ice
chose=Picked
doze=Nap lightly
woes=Troubles
`),
  family("ung", "-ung", `
sung=Past participle of "sing"
hung=Dangled
lung=Breathing organ
rung=Ladder step
stung=Hurt by a bee
swung=Moved like a pendulum
young=Not old
tongue=Tasting organ
clung=Held tight
flung=Hurled
slung=Tossed over a shoulder
sprung=Leapt up
`),
  family("un", "-un", `
sun=Star at the center of our system
run=Jog fast
fun=Enjoyable
bun=Hamburger bread
gun=Pistol
none=Not any
one=First number
done=Finished
spun=Twirled
stun=Shock into silence
begun=Started
ton=Two thousand pounds
shun=Avoid on purpose
`),
  family("ed", "-ed", `
bed=Where you sleep
red=Color of a stop sign
head=Your top
said=Spoke
thread=Needle's partner
dead=No longer alive
bread=Toast's start
shed=Garden storage hut
fled=Ran away
spread=Butter on toast, say
wed=Marry
sled=Rides on snow
tread=Shoe sole pattern
dread=Great fear
ahead=In front
instead=In place of
`),
  family("ack", "-ack", `
back=Rear
black=Darkest color
track=Race course
snack=Between-meal bite
pack=Bundle or group of wolves
stack=Neat pile
crack=Thin split
shack=Rough little hut
sack=Bag
rack=Shelf for hanging
quack=Duck's sound
jack=Car-lifting tool
lack=Be without
attack=Strike first
knack=Natural talent
whack=Hit with a bat
`),
  family("ip", "-ip", `
ship=Ocean liner
trip=Vacation
lip=Part of your mouth
chip=Potato snack
drip=Leaky faucet's sound
flip=Pancake move
grip=Hold tight
hip=Joint by the pelvis
sip=Small drink
skip=Hop-step motion
slip=Lose your footing
tip=Waiter's reward
whip=Cream topping maker
zip=Close a jacket
clip=Paper holder
strip=Take off, or a long thin piece
dip=Quick swim
`),
  family("ock", "-ock", `
clock=Tells time
rock=Stone
sock=Foot warmer
lock=Secures a door
block=Child's toy cube
dock=Where boats tie up
flock=Group of birds
knock=Rap on the door
shock=Sudden surprise
stock=Soup base, or shares in a firm
mock=Make fun of
frock=Dress
smock=Painter's loose shirt
`),
  family("ill", "-ill", `
hill=Small mountain
will=Wish, or future helper word
still=Not moving
fill=Make full
bill=Invoice
chill=Cool off
drill=Dentist's tool
grill=Barbecue spot
kill=End a life
mill=Place grain is ground
pill=Medicine tablet
skill=Learned ability
spill=Knock over a drink
thrill=Rush of excitement
until=Up to the time that
shrill=High and piercing
`),
  family("ower", "-ower", `
flower=Daisy
power=Strength or electricity
tower=Tall structure
shower=Bathroom spray
hour=Sixty minutes
sour=Like a lemon
devour=Eat greedily
scour=Scrub hard
cower=Shrink in fear
dower=Property a bride once brought
`),
  family("ale", "-ale", `
tale=Story
sail=Boat's cloth
pale=Light-skinned
mail=Letters
nail=Hammered fastener
whale=Giant ocean mammal
scale=Bathroom weigher
trail=Hiking path
snail=Slow shelled creature
fail=Not pass
hail=Frozen rain
jail=Prison
rail=Train track part
stale=Not fresh
detail=Tiny piece of information
prevail=Win out
inhale=Breathe in
`),
  family("ate", "-ate", `
late=Not on time
gate=Garden entrance
hate=Strong dislike
plate=Dinner dish
state=Texas or Ohio
wait=Stand by
eight=Spider's leg count
great=Wonderful
skate=Glide on ice
slate=Chalkboard material
mate=Partner
date=Calendar day
crate=Wooden shipping box
fate=Destiny
straight=Not curved
create=Make something new
relate=Connect with
debate=Formal argument
`),
  family("eed", "-eed", `
need=Require
seed=Plant starter
feed=Give food to
speed=How fast
weed=Garden pest
bleed=Lose blood
breed=Kind of dog
creed=Statement of beliefs
deed=Heroic act
heed=Pay attention to
indeed=Truly
proceed=Go forward
succeed=Achieve a goal
tweed=Rough woolen cloth
`),
  family("oon", "-oon", `
moon=Lights the night sky
soon=In a short while
spoon=Soup scooper
noon=Midday
tune=Melody
balloon=Floats on a string
cartoon=Saturday morning show
June=Month after May
dune=Sandy hill
prune=Dried plum
swoon=Faint from emotion
raccoon=Masked trash-bin bandit
lagoon=Shallow tropical pool
typhoon=Pacific hurricane
croon=Sing softly
`),
  family("ide", "-ide", `
side=Left or right
ride=Hop on a bike
hide=Play seek's opposite
wide=Not narrow
slide=Playground fun
pride=Lion group, or feeling of satisfaction
guide=Show the way
tide=Ocean's rise and fall
bride=Wedding day woman
glide=Move smoothly
cried=Shed tears
fried=Cooked in oil
tried=Made an attempt
decide=Make up your mind
inside=Not out
provide=Supply
beside=Next to
`),
  family("eam", "-eam", `
dream=Sleep vision
team=Players together
cream=Whipped topping
stream=Small river
beam=Ray of light
steam=Kettle's vapor
seem=Appear to be
scream=Shout in fear
gleam=Shine softly
theme=Main idea
extreme=Far beyond normal
supreme=Highest in rank
seam=Where fabric is stitched
redeem=Trade in a coupon
esteem=High regard
`),
  family("air", "-air", `
air=What we breathe
hair=Strands on your head
chair=Seat with a back
care=Feel concern
bear=Grizzly
pear=Bartlett fruit
wear=Have on
share=Split with a friend
stare=Look hard
dare=Challenge
fair=Carnival
pair=Two of a kind
rare=Seldom seen
scare=Boo!
square=Four equal sides
there=Not here
spare=Extra
glare=Angry look
swear=Take an oath
flair=Stylish talent
bare=Uncovered
mare=Female horse
snare=Trap
`),
  family("eep", "-eep", `
sleep=Nightly rest
deep=Far down
keep=Hold on to
sheep=Wool giver
sweep=Clean with a broom
jeep=Rugged off-road car
peep=Quick sneaky look
steep=Sharply sloped
creep=Move quietly and slowly
weep=Cry
cheap=Low-priced
leap=Big jump
heap=Messy pile
reap=Harvest
`),
  family("uck", "-uck", `
duck=Quacker
luck=Fortune
truck=Big hauling vehicle
stuck=Can't move
buck=Male deer
cluck=Chicken's sound
pluck=Pull off feathers or strings
struck=Hit
tuck=Fold in at bedtime
yuck=Disgusting!
muck=Mud and mess
chuck=Throw away
suck=Draw in through a straw
`),
  family("ink", "-ink", `
pink=Flamingo color
drink=Sip a beverage
think=Use your mind
sink=Kitchen basin
wink=Eye gesture
link=Chain connection
blink=Quick eye close
brink=Edge of a cliff
clink=Glass-on-glass sound
rink=Hockey venue
stink=Smell bad
shrink=Get smaller
ink=Pen fluid
mink=Fur coat animal
`),
  family("ust", "-ust", `
dust=Gathers on shelves
rust=Orange iron coating
trust=Faith in someone
must=Have to
just=Fair, or only
crust=Pie's outer layer
gust=Sudden wind burst
bust=Sculpted head and shoulders
thrust=Push forward
adjust=Fine-tune
disgust=Strong revulsion
robust=Strong and healthy
unjust=Unfair
lust=Intense desire
`),
  family("ent", "-ent", `
tent=Camping shelter
bent=Not straight
sent=Mailed
went=Past tense of "go"
spent=Used up money
rent=Monthly apartment payment
dent=Small car dimple
vent=Air opening
lent=Loaned
meant=Intended
event=Happening
invent=Come up with something new
prevent=Stop from happening
repent=Feel sorry
extent=Range or degree
content=Happy and satisfied
`),
  family("ace", "-ace", `
face=Your front side
race=Marathon
place=Spot
space=Astronaut's domain
grace=Elegance
lace=Shoe tie
pace=Speed of walking
trace=Faint sign left behind
brace=Support for a limb
case=Lawyer's legal matter
base=Bottom or first stop on a diamond
chase=Run after
embrace=Hug
replace=Put something new in its spot
erase=Rub out
ace=Perfect tennis serve
`),
  family("ar", "-ar", `
car=Drives on the road
star=Twinkles at night
far=Not near
bar=Place for drinks
jar=Pickle container
tar=Road-paving goo
scar=Mark left by a wound
guitar=Six-string instrument
bazaar=Eastern marketplace
cigar=Rolled tobacco
afar=From a distance
spar=Practice fighting
`),
  family("ame", "-ame", `
game=Chess, for one
name=What you're called
same=Identical
flame=Fire's tongue
frame=Picture border
shame=Guilty feeling
blame=Fault
came=Arrived
fame=Celebrity status
lame=Weak, as an excuse
tame=Not wild
claim=Say it's yours
aim=Point at a target
became=Turned into
inflame=Set on fire
proclaim=Announce loudly
`),
  family("one", "-one", `
bone=Dog's chew
phone=Calls you
stone=Rock
zone=Area
cone=Ice cream holder
alone=By yourself
throne=Royal seat
tone=Sound quality
known=Familiar
shown=Displayed
own=Possess
loan=Borrowed money
moan=Low sad sound
groan=Complain loudly
clone=Genetic copy
drone=Buzzing flying robot
flown=Soared through the air
blown=Puffed out
`),
  family("ash", "-ash", `
cash=Paper money
dash=Short sprint
crash=Car collision
flash=Camera light
splash=Pool noise
trash=Garbage
smash=Break to pieces
bash=Big party
clash=Fight or conflict
lash=Eye hair
rash=Itchy skin; reckless
stash=Hidden supply
mash=Squish potatoes
gash=Deep cut
hash=Breakfast potatoes
slash=Cut with a sweeping stroke
`),
  family("ow2", "-ow (cow)", `
cow=Gives milk
now=At this moment
how=In what way
vow=Solemn promise
wow=Exclamation of amazement
brow=Forehead
plow=Farm tool for soil
allow=Let happen
avow=Declare openly
endow=Give a gift or fund
somehow=In some way or other
meow=Cat's sound
chow=Food, informally
`),
  family("ive", "-ive", `
five=One more than four
alive=Living
drive=Steer a car
hive=Bee home
dive=Plunge head first
arrive=Reach a destination
survive=Live through
thrive=Flourish
strive=Try hard
jive=Swing dance
revive=Bring back to life
deprive=Take away from
`),
  family("ap", "-ap", `
map=Shows where to go
cap=Baseball hat
tap=Faucet
nap=Short sleep
lap=Round of a track
clap=Applaud
snap=Finger sound
trap=Snare for a rodent
wrap=Cover a gift
flap=Move wings
gap=Space between
slap=Sharp hand strike
strap=Watch band
zap=Hit with energy
scrap=Tiny leftover piece
`),
  family("ot", "-ot", `
hot=Opposite of cold
pot=Cooks soup
dot=Tiny round mark
got=Obtained
lot=Parking space; many
not=Negative word
spot=Leopard's mark
shot=Basketball attempt
plot=Story's scheme
slot=Coin entrance
rot=Decay
trot=Horse's pace
cot=Small camping bed
blot=Ink stain
clot=Blood lump
`),
  family("est", "-est", `
best=Number one
test=Exam
rest=Relax
nest=Bird's home
west=Where the sun sets
chest=Pirate treasure box
guest=Visitor
quest=Hero's journey
vest=Sleeveless jacket
zest=Lemon peel flavor
pest=Annoying insect
jest=Joke
crest=Wave top or family emblem
invest=Put money to work
request=Politely ask for
contest=Competition
`),
  family("eeze", "-eeze", `
breeze=Gentle wind
freeze=Turn to ice
sneeze=Achoo!
cheese=Mouse's favorite
please=Magic word
trees=Forest plants
knees=Joints in your legs
keys=Open locks
bees=Honey makers
ease=Comfort
squeeze=Press tightly
tease=Playfully mock
seize=Grab suddenly
wheeze=Whistle while breathing
disease=Illness
`),
  family("ud", "-ud", `
mud=Wet dirt
bud=Unopened flower
flood=Overflowing water
blood=Red body fluid
thud=Dull falling sound
stud=Earring type
spud=Slang for a potato
dud=Firework that fails
cud=What cows chew
crud=Gunk
`),
];

const WORD_TO_FAMILY: ReadonlyMap<string, RhymeFamily> = (() => {
  const map = new Map<string, RhymeFamily>();
  for (const fam of RHYME_FAMILIES) {
    for (const entry of fam.entries) {
      if (!map.has(entry.word)) map.set(entry.word, fam);
    }
  }
  return map;
})();

/** Finds the family a word belongs to (exact dictionary match). */
export function findRhymeFamilyForWord(word: string): RhymeFamily | null {
  return WORD_TO_FAMILY.get(word.trim().toLowerCase()) ?? null;
}

/**
 * Best-effort family lookup for words NOT in the dictionary: picks the family whose
 * member shares the longest identical word ending (min 2 letters).
 */
export function findClosestRhymeFamily(word: string): RhymeFamily | null {
  const w = word.trim().toLowerCase();
  if (w.length < 2) return null;
  const exact = findRhymeFamilyForWord(w);
  if (exact) return exact;
  let best: { fam: RhymeFamily; score: number } | null = null;
  for (const fam of RHYME_FAMILIES) {
    for (const entry of fam.entries) {
      let n = 0;
      while (
        n < w.length &&
        n < entry.word.length &&
        w[w.length - 1 - n] === entry.word[entry.word.length - 1 - n]
      ) {
        n++;
      }
      if (n >= 2 && (!best || n > best.score)) best = { fam, score: n };
    }
  }
  return best ? best.fam : null;
}

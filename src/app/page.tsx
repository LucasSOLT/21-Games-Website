import { GameCard, Game } from "@/components/game-card";
import Link from "next/link";
import { getAuthorForDate } from "@/lib/authors";

import Image from "next/image";
import { Hero } from "@/components/hero";
import "@/components/hero.css";

const allGames: Game[] = [
  {
    name: "9 Rhymes",
    color: "customYellow2",
    logo: "rhymes",
    slug: "9-rhymes",
    showCreate: true,
  },
  {
    name: "Connect 5",
    color: "grey",
    logo: "connect",
    slug: "connect-5",
    showCreate: true,
  },
  {
    name: "21 Things",
    color: "customPurple2",
    logo: "things",
    slug: "21-things",
    showCreate: true,
  },
  {
    name: "17 Syllables",
    color: "green",
    logo: "syllables",
    slug: "17-syllables",
    showCreate: true,
  },
  {
    name: "6 Pics",
    color: "customF4D621",
    logo: "6-pics",
    slug: "6-pics",
    showCreate: true,
  },
  {
    name: "1 Win",
    color: "grey",
    logo: "win",
    slug: "1-win",
    showCreate: false,
  },
  {
    name: "Eightfold Echo",
    color: "customPurple2",
    logo: "echo",
    slug: "eightfold-echo",
    showCreate: false,
  },
  {
    name: "The 11th Hour",
    color: "grey",
    logo: "letter",
    slug: "the-11th-hour",
    showCreate: false,
  },
  {
    name: "Move 2",
    color: "green",
    logo: "move-2",
    slug: "move-2",
    showCreate: false,
  },
];

const archiveData = [
    { day: "Tuesday", date: "Jan. 7, 2025", author: 'Taylor Brown', editor: 'Jamie Moore' },
    { day: "Wednesday", date: "Jan. 8, 2025", author: 'Lucas Huff', editor: 'Steve Huff' },
    { day: "Thursday", date: "Jan. 9, 2025", author: 'Alex Johnson', editor: 'Casey Smith' },
    { day: "Friday", date: "Jan. 10, 2025", author: 'Quinn Taylor', editor: 'Peyton Thomas' },
];

export default function Home() {
    const today = new Date();
    const formattedDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(today);

    const centerGame = allGames.find(g => g.slug === '21-things');
    const leftGame = allGames.find(g => g.slug === '9-rhymes');
    const rightGame = allGames.find(g => g.slug === 'connect-5');

  return (
    <div className="bg-background overflow-x-hidden">
      <Hero />

      <header id="play" className="bg-[#b3a8ff] py-12 lg:py-24 px-4 scroll-mt-4">
        <div className="mx-auto max-w-7xl flex flex-col lg:flex-row justify-center items-center gap-6">
            <div className="w-full max-w-sm lg:w-1/3">
                <GameCard 
                    game={leftGame!} 
                    variant="featured"
                    date={formattedDate}
                    author={getAuthorForDate(today)}
                />
            </div>
            <div className="w-full max-w-sm lg:w-1/2">
                <GameCard 
                    game={centerGame!}
                    variant="featured"
                    date={formattedDate}
                    author={getAuthorForDate(today)}
                    isCenter
                />
            </div>
            <div className="w-full max-w-sm lg:w-1/3">
                <GameCard 
                    game={{...rightGame!, name: "4 Winning Colors"}}
                    variant="featured"
                    date={formattedDate}
                    author="Stephen Huff"
                />
            </div>
        </div>
      </header>

      <main className="flex flex-col items-center mt-16 px-4 md:px-8 pb-16">
        <div id="games" className="w-full max-w-5xl scroll-mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {allGames.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </div>

        <div className="w-full max-w-5xl mt-24 text-center">
            <h2 className="text-2xl font-headline font-black mb-8">Free From Our Archive</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {archiveData.map((item, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 text-center h-full">
                        <p className="font-headline font-black text-xl">{item.day}</p>
                        <p className="text-sm text-gray-500 mb-4">{item.date}</p>
                        <p className="text-xs text-gray-500 uppercase">by {item.author}</p>
                        <p className="text-xs text-gray-500 uppercase">Edited by {item.editor}</p>
                    </div>
                ))}
            </div>
            <div className="mt-8">
              <Link href="/admin" className="text-sm underline">Admin Panel</Link>
            </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AccountNavButton } from "@/components/account/account-nav-button";
import { SolGamesLogo } from "@/components/solgames-logo";
import { GameLogo } from "@/components/game-logo";
import {
  ALL_GAMES,
  ALL_GAME_SLUGS,
  GAME_ACCENT_HEX,
  GAME_COUNTDOWN_NUMBER,
  type AllGameSlug,
} from "@/lib/games-config";
import { isDateCompleted } from "@/lib/game-storage";
import { useLiveLocalDateKey } from "@/hooks/use-live-date-key";
import { playTapSfx } from "@/lib/game-sfx";

const RITUAL_VIBE_META: Record<AllGameSlug, string> = {
  "21-things": "Gratitude Funnel · ~3 min",
  "17-syllables": "Poetic Haiku · ~2 min",
  "9-rhymes": "Rhyme Chat · ~2 min",
  "eightfold-echo": "Visual Logic · ~3 min",
  "6-pics": "Picture Trivia · ~2 min",
  "connect-5": "Word Chain · ~2 min",
  "four-score": "Target-80 Math · ~2 min",
  "move-2": "3D Block Puzzle · ~3 min",
  "1-win": "Community Ritual · ~1 min",
};

export interface HeroProps {
  onCollapseIntro?: () => void;
}

export function Hero({ onCollapseIntro }: HeroProps = {}) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<AllGameSlug>("21-things");
  const [solvedTodayMap, setSolvedTodayMap] = useState<
    Partial<Record<AllGameSlug, boolean>>
  >({});

  const todayKey = useLiveLocalDateKey();

  useEffect(() => {
    const syncSolved = () => {
      const next: Partial<Record<AllGameSlug, boolean>> = {};
      for (const slug of ALL_GAME_SLUGS) {
        next[slug] = isDateCompleted(slug, todayKey);
      }
      setSolvedTodayMap(next);
    };
    syncSolved();
    window.addEventListener("solgames:stats-updated", syncSolved);
    window.addEventListener("solgames:profile-sync", syncSolved);
    window.addEventListener("storage", syncSolved);
    window.addEventListener("focus", syncSolved);
    return () => {
      window.removeEventListener("solgames:stats-updated", syncSolved);
      window.removeEventListener("solgames:profile-sync", syncSolved);
      window.removeEventListener("storage", syncSolved);
      window.removeEventListener("focus", syncSolved);
    };
  }, [todayKey]);

  const selectedIndex = Math.max(
    0,
    ALL_GAMES.findIndex((g) => g.slug === selectedSlug)
  );
  const selectedGame = ALL_GAMES[selectedIndex] ?? ALL_GAMES[0]!;
  const selectedKey = selectedGame.slug as AllGameSlug;
  const selectedNum = GAME_COUNTDOWN_NUMBER[selectedKey];
  const selectedAccent = GAME_ACCENT_HEX[selectedKey];
  const selectedVibe = RITUAL_VIBE_META[selectedKey];

  const handleSelectGame = (slug: AllGameSlug) => {
    playTapSfx();
    setSelectedSlug(slug);
  };

  const handleStepGame = (delta: number) => {
    playTapSfx(delta > 0 ? 1.06 : 0.94);
    const nextIdx = (selectedIndex + delta + ALL_GAMES.length) % ALL_GAMES.length;
    const nextGame = ALL_GAMES[nextIdx];
    if (nextGame) {
      setSelectedSlug(nextGame.slug as AllGameSlug);
    }
  };

  return (
    <div className="sol-hero-root">
      <div className="container">
        <nav className="navbar" aria-label="Primary navigation">
          <Link href="/" className="logo group" aria-label="SOL GaMES Home">
            <SolGamesLogo variant="full" className="navbar-logo" />
          </Link>

          <div className="nav-links">
            <a href="#games" className="nav-link">
              21 → 1 Games
            </a>
            <button
              type="button"
              onClick={() => {
                playTapSfx();
                setHowItWorksOpen(true);
              }}
              className="nav-link"
            >
              How It Works
            </button>
            <a href="#archive" className="nav-link">
              60-Day Archive
            </a>
            <a href="#about" className="nav-link">
              About
            </a>
          </div>

          <div className="navbar-actions">
            {onCollapseIntro && (
              <button
                type="button"
                onClick={() => {
                  playTapSfx();
                  onCollapseIntro();
                }}
                className="btn btn-ghost-collapse"
              >
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                <span>Hide Intro</span>
              </button>
            )}
            <AccountNavButton variant="hero" />
            {!onCollapseIntro && (
              <a href="#games" className="btn btn-primary">
                Play Now{" "}
                <span style={{ color: "#FFC107", marginLeft: "6px" }}>→</span>
              </a>
            )}
          </div>
        </nav>

        <div className="mobile-quick-nav" aria-label="Quick navigation">
          <a href="#games" className="mobile-quick-nav-pill">
            21 → 1 Games
          </a>
          <button
            type="button"
            onClick={() => {
              playTapSfx();
              setHowItWorksOpen(true);
            }}
            className="mobile-quick-nav-pill"
          >
            How It Works
          </button>
          <a href="#archive" className="mobile-quick-nav-pill">
            Archive
          </a>
          {onCollapseIntro && (
            <button
              type="button"
              onClick={() => {
                playTapSfx();
                onCollapseIntro();
              }}
              className="mobile-quick-nav-pill"
            >
              Hide Intro ↑
            </button>
          )}
        </div>

        <div className="hero">
          <div className="hero-content">
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" aria-hidden="true" />
              <span>9 Original Daily Games · 21 → 1 Countdown</span>
            </div>

            <h1 className="hero-title">
              Smart <span className="highlight-yellow">Games.</span>
              <br />
              New <span className="highlight-green">Challenges.</span>
              <br />
              Every <span className="highlight-purple">Day.</span>
            </h1>

            <p className="hero-subtitle">
              Count down from <strong>#21</strong> to <strong>#1</strong> with 9
              bite-sized daily puzzles—from mindful gratitude and haiku to word
              chains, visual logic, and 3D spatial play.
            </p>

            <div className="warning-box">
              <div className="warning-icon" aria-hidden="true">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2L1 21H23L12 2Z" fill="#9D50BB" />
                  <path
                    d="M11 10H13V15H11V10ZM11 17H13V19H11V17Z"
                    fill="white"
                  />
                </svg>
              </div>
              <p className="warning-text">
                <strong>Warning:</strong> May cause extreme joy and{" "}
                <br />a severe case of &quot;just one more game&quot; syndrome.
              </p>
            </div>
            <p className="small-disclaimer">
              <em>
                (Refreshed every midnight · 100% free to play, no paywall.)
              </em>
            </p>

            <div className="cta-group">
              <a href="#games" className="btn btn-primary btn-lg">
                Start Today&apos;s 21 → 1{" "}
                <span style={{ color: "#FFC107", marginLeft: "8px" }}>→</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  playTapSfx();
                  setHowItWorksOpen(true);
                }}
                className="btn btn-secondary btn-lg"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                How It Works
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div
              className="ritual-stage"
              role="region"
              aria-label="21 to 1 Daily Ritual Interactive Preview"
            >
              <div className="ritual-stage-top">
                <span className="ritual-stage-badge">
                  <span className="ritual-stage-pulse" aria-hidden="true" />
                  21 → 1 Daily Ritual Stage
                </span>
                <span className="ritual-stage-hint">
                  Tap any countdown number to preview
                </span>
              </div>

              <div
                className="ritual-pills-grid"
                role="tablist"
                aria-label="Countdown games from 21 down to 1"
              >
                {ALL_GAMES.map((game) => {
                  const slug = game.slug as AllGameSlug;
                  const num = GAME_COUNTDOWN_NUMBER[slug];
                  const isSelected = slug === selectedKey;
                  const isSolved = Boolean(solvedTodayMap[slug]);
                  return (
                    <button
                      key={slug}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-label={`#${num} ${game.name}${isSolved ? " (Solved today)" : ""}`}
                      onClick={() => handleSelectGame(slug)}
                      style={
                        {
                          "--pill-accent": GAME_ACCENT_HEX[slug],
                        } as React.CSSProperties
                      }
                      className={`ritual-pill${isSelected ? " is-active" : ""}`}
                    >
                      <span className="ritual-pill-hash" aria-hidden="true">
                        #
                      </span>
                      <span>{num}</span>
                      {isSolved && (
                        <span
                          className="ritual-pill-solved-dot"
                          title="Solved today"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="ritual-spotlight" role="tabpanel">
                <div className="ritual-spotlight-main">
                  <div
                    className="ritual-logo-frame"
                    style={{ backgroundColor: selectedAccent }}
                  >
                    <GameLogo game={selectedGame} variant="featured" />
                  </div>

                  <div className="ritual-spotlight-body">
                    <div className="ritual-meta-row">
                      <span className="ritual-num-chip">#{selectedNum}</span>
                      <span className="ritual-vibe-chip">{selectedVibe}</span>
                      {solvedTodayMap[selectedKey] && (
                        <span
                          className="ritual-vibe-chip"
                          style={{ backgroundColor: "#D1FAE5" }}
                        >
                          ✓ Solved Today
                        </span>
                      )}
                    </div>
                    <h2 className="ritual-game-title">{selectedGame.name}</h2>
                    <p className="ritual-game-tagline">{selectedGame.tagline}</p>
                    <p className="ritual-game-desc">
                      {selectedGame.description}
                    </p>
                  </div>
                </div>

                <div className="ritual-spotlight-footer">
                  <div className="ritual-step-controls">
                    <button
                      type="button"
                      onClick={() => handleStepGame(-1)}
                      className="ritual-step-btn"
                      aria-label="Previous game in countdown"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepGame(1)}
                      className="ritual-step-btn"
                      aria-label="Next game in countdown"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <span className="ritual-step-label">
                      Game {selectedIndex + 1} of {ALL_GAMES.length}
                    </span>
                  </div>

                  <Link
                    href={`/games/${selectedGame.slug}`}
                    onClick={() => playTapSfx(1.08)}
                    className="ritual-play-cta"
                  >
                    <span>
                      Play #{selectedNum} {selectedGame.name}
                    </span>
                    <span style={{ color: "#F9D423" }}>→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="features" aria-label="Platform highlights">
          <div className="feature-item">
            <div className="feature-icon icon-green" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
            <div className="feature-text">
              <h3>21 → 1 Countdown</h3>
              <p>9 original formats from #21 down to #1.</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon icon-purple" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div className="feature-text">
              <h3>Midnight Reset</h3>
              <p>Fresh verified daily boards every night at 12:00 AM.</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon icon-yellow" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                <path d="M4 22h16"></path>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
              </svg>
            </div>
            <div className="feature-text">
              <h3>9-for-9 Daily Sweep</h3>
              <p>Clear all 9 today to earn your Sweep receipt.</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon icon-green-outline" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="M9 12l2 2 4-4"></path>
              </svg>
            </div>
            <div className="feature-text">
              <h3>60-Day Free Archive</h3>
              <p>Every past daily puzzle unlocked anytime.</p>
            </div>
          </div>
        </section>

        <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
          <DialogContent
            role="dialog"
            aria-modal="true"
            className="max-w-lg max-h-[90vh] overflow-y-auto border-2 border-black bg-[#FCFCFD] shadow-[6px_6px_0_#111111]"
          >
            <DialogHeader>
              <DialogTitle className="font-headline text-xl font-black text-black">
                How the 21 → 1 Daily Ritual Works
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                9 original daily games counting down from #21 to #1—built to
                sharpen your mind and spark gratitude.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm text-gray-700">
              <div className="rounded-xl border-2 border-black bg-[#FFFDF2] p-3.5">
                <h4 className="font-headline font-black text-sm uppercase tracking-wider text-black">
                  1. The 9-Game Countdown (21 → 1)
                </h4>
                <p className="text-xs sm:text-sm mt-1 text-gray-700">
                  Play in any order—or run the full countdown from{" "}
                  <strong>#21 21 Things</strong> down to{" "}
                  <strong>#1 1 Win</strong>:
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  {ALL_GAMES.map((g) => {
                    const slug = g.slug as AllGameSlug;
                    const num = GAME_COUNTDOWN_NUMBER[slug];
                    return (
                      <Link
                        key={slug}
                        href={`/games/${slug}`}
                        onClick={() => setHowItWorksOpen(false)}
                        className="flex items-center gap-1.5 rounded-lg border border-black bg-white px-2 py-1 text-xs font-bold text-black hover:bg-neutral-50 transition-colors"
                      >
                        <span
                          style={{ backgroundColor: GAME_ACCENT_HEX[slug] }}
                          className="inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded border border-black px-1 font-headline text-[10px] font-black text-black"
                        >
                          {num}
                        </span>
                        <span className="truncate">{g.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border-2 border-black bg-[#f7eef5] p-3.5">
                <h4 className="font-headline font-black text-sm uppercase tracking-wider text-black">
                  2. Midnight Reset &amp; Fair-Play Streaks
                </h4>
                <p className="text-xs sm:text-sm mt-1 text-gray-700">
                  New daily puzzles unlock automatically at local midnight (
                  <code>00:00</code>). Solving today&apos;s puzzle extends your
                  live daily streak (🔥). Past puzzles in the{" "}
                  <strong>60-day archive</strong> earn completion checkmarks
                  without inflating live streaks, and revealing answers never
                  awards unearned wins.
                </p>
              </div>

              <div className="rounded-xl border-2 border-black bg-emerald-50 p-3.5">
                <h4 className="font-headline font-black text-sm uppercase tracking-wider text-black">
                  3. 🏆 9-for-9 Daily Sweep
                </h4>
                <p className="text-xs sm:text-sm mt-1 text-gray-700">
                  Complete all 9 daily games in a single day to unlock your
                  celebratory <strong>9-for-9 Daily Sweep</strong> receipt to
                  share with friends!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setHowItWorksOpen(false)}
                className="border-2 border-black font-bold"
              >
                Browse All 9 Games
              </Button>
              <Link
                href="/games/21-things"
                onClick={() => setHowItWorksOpen(false)}
              >
                <Button className="border-2 border-black bg-black text-white font-bold">
                  Start at #21 (21 Things) →
                </Button>
              </Link>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { assetPath } from "@/lib/asset-path";
import { ImageWithFallback } from "@/components/image-with-fallback";
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
import {
  ALL_GAMES,
  GAME_ACCENT_HEX,
  GAME_COUNTDOWN_NUMBER,
  type AllGameSlug,
} from "@/lib/games-config";
import { playTapSfx } from "@/lib/game-sfx";

const DEMO_VIDEO_SRC: string | null = null;

const DEMO_TILE_CLASSES = [
  "tile-yellow",
  "tile-green",
  "tile-purple",
  "tile-white",
  "tile-yellow",
  "tile-purple",
  "tile-yellow",
  "tile-green",
  "tile-purple",
  "tile-green",
  "tile-green",
  "tile-white",
  "tile-yellow",
  "tile-purple",
  "tile-yellow",
] as const;

export function Hero() {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [previewCycle, setPreviewCycle] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    if (previewCycle > 0) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [previewCycle, isMuted]);

  const handleUnmuteAndRewind = () => {
    playTapSfx();
    setIsMuted(false);
    setPreviewCycle((prev) => prev + 1);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
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
              All Games
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
              Archive
            </a>
            <a href="#about" className="nav-link">
              About
            </a>
          </div>
          <div className="navbar-actions">
            <AccountNavButton variant="hero" />
            <a href="#games" className="btn btn-primary">
              Play Now{" "}
              <span style={{ color: "#FFC107", marginLeft: "6px" }}>→</span>
            </a>
          </div>
        </nav>

        <div className="mobile-quick-nav" aria-label="Quick navigation">
          <a href="#games" className="mobile-quick-nav-pill">
            All Games
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
          <a href="#about" className="mobile-quick-nav-pill">
            About
          </a>
        </div>

        <div className="hero">
          <div className="hero-content">
            <h1 className="hero-title">
              Smart <span className="highlight-yellow">Games.</span>
              <br />
              New <span className="highlight-green">Challenges.</span>
              <br />
              Every <span className="highlight-purple">Day.</span>
            </h1>
            <p className="hero-subtitle">
              Sharpen your mind with smart, bite-sized games.{" "}
              <br />
              New challenges every day to keep you thinking.
            </p>

            <div className="warning-box">
              <div className="warning-icon" aria-hidden="true">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2L1 21H23L12 2Z" fill="#B265E6" />
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
                (And unlike the Times, we don&apos;t charge for your addiction.)
              </em>
            </p>

            <div className="cta-group">
              <a href="#games" className="btn btn-primary btn-lg">
                Play Now{" "}
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
                  className="play-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="10 8 16 12 10 16 10 8"></polygon>
                </svg>
                How It Works
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <ImageWithFallback
              src="/boxes-bg.png"
              alt="Background Boxes"
              width={2000}
              height={1116}
              className="hero-boxes-bg"
              fallbackSvgTitle="Background Boxes"
            />

            <div className="hero-phone-stage">
              <div className="hero-blocks-left" aria-hidden="true">
                <span className="hblock hblock-l-purple" />
                <span className="hblock hblock-l-yellow-lg" />
                <span className="hblock hblock-l-green" />
                <span className="hblock hblock-l-yellow-sm" />
                <div className="hero-dot-matrix hero-dots-left">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <span key={i} className="hero-dot-cell" />
                  ))}
                </div>
              </div>

              <div className="hero-blocks-topright" aria-hidden="true">
                <span className="hblock hblock-tr-green" />
                <span className="hblock hblock-tr-yellow" />
                <span className="hblock hblock-tr-purple" />
                <span className="hblock hblock-tr-yellow-sm" />
                <div className="hero-dot-matrix hero-dots-topright">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <span key={i} className="hero-dot-cell" />
                  ))}
                </div>
              </div>

              <ImageWithFallback
                src="/hands.png"
                alt="Hands holding a smartphone"
                width={2500}
                height={1395}
                className="hero-hands"
                fallbackSvgTitle="SOL GaMES Gameplay Hands"
              />

              <div
                className="hero-demo-container"
                role="region"
                aria-label="21 Games Promo Video Preview"
              >
                <div className="hero-demo-surface" key={previewCycle}>
                  {DEMO_VIDEO_SRC ? (
                    <video
                      ref={videoRef}
                      src={assetPath(DEMO_VIDEO_SRC)}
                      autoPlay
                      muted={isMuted}
                      loop
                      playsInline
                      className="hero-demo-video"
                    />
                  ) : (
                    <>
                      <div className="hero-demo-topbar">
                        <span className="hero-demo-badge">
                          <span className="hero-demo-dot" /> PROMO PREVIEW
                        </span>
                        <span className="hero-demo-status">
                          {isMuted
                            ? "Muted · Auto-looping"
                            : "Audio On · Rewound to 0:00"}
                        </span>
                      </div>

                      <div className="hero-demo-center">
                        <div className="hero-demo-tiles" aria-hidden="true">
                          {DEMO_TILE_CLASSES.map((tileClass, idx) => (
                            <span
                              key={idx}
                              style={{ animationDelay: `${(idx % 5) * 140}ms` }}
                              className={`hero-demo-tile ${tileClass}`}
                            />
                          ))}
                        </div>
                        <p className="hero-demo-title">
                          Promo video coming soon
                        </p>
                        <p className="hero-demo-caption">
                          21 → 1 Daily Games live walkthrough
                        </p>
                      </div>

                      <div className="hero-demo-progress" aria-hidden="true">
                        <div className="hero-demo-progress-bar" />
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleUnmuteAndRewind}
                  className="hero-video-unmute-btn"
                  aria-label="Unmute and rewind promo video"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {isMuted ? (
                      <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      </>
                    ) : (
                      <>
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </>
                    )}
                  </svg>
                  <span>
                    {isMuted ? "Unmute and rewind" : "Rewind & play again"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <section className="features">
          <div className="feature-item">
            <div className="feature-icon icon-green" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
            <div className="feature-text">
              <h3>Smart Fun</h3>
              <p>
                Games that make{" "}
                <br />
                you think.
              </p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon icon-purple" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
                <rect
                  x="8"
                  y="14"
                  width="2"
                  height="2"
                  fill="currentColor"
                ></rect>
                <rect
                  x="12"
                  y="14"
                  width="2"
                  height="2"
                  fill="currentColor"
                ></rect>
                <rect
                  x="16"
                  y="14"
                  width="2"
                  height="2"
                  fill="currentColor"
                ></rect>
                <rect
                  x="8"
                  y="18"
                  width="2"
                  height="2"
                  fill="currentColor"
                ></rect>
              </svg>
            </div>
            <div className="feature-text">
              <h3>New Daily Challenges</h3>
              <p>
                Fresh puzzles every day{" "}
                <br />
                to keep it exciting.
              </p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon icon-yellow" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div className="feature-text">
              <h3>Join the Community</h3>
              <p>
                Compete, share, and{" "}
                <br />
                celebrate together.
              </p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon icon-green-outline" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="M9 12l2 2 4-4"></path>
              </svg>
            </div>
            <div className="feature-text">
              <h3>Play Anywhere</h3>
              <p>
                Seamless experience{" "}
                <br />
                across all devices.
              </p>
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

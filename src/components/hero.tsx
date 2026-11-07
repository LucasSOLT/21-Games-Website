"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { assetPath } from "@/lib/asset-path";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AccountNavButton } from "@/components/account/account-nav-button";

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
  const [trailerOpen, setTrailerOpen] = useState(false);
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
    setIsMuted(false);
    setPreviewCycle((prev) => prev + 1);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="container">
      <nav className="navbar">
        <div className="logo">
          <img
            src={assetPath("/logo.png")}
            alt="SOL GaMES"
            className="navbar-logo-img"
          />
        </div>
        <div className="nav-links">
          <a href="#play" className="nav-link">
            Daily Featured
          </a>
          <a href="#games" className="nav-link">
            All Games
          </a>
          <a href="#archive" className="nav-link">
            Archive
          </a>
          <a href="#about" className="nav-link">
            About
          </a>
        </div>
        <div className="navbar-actions">
          <AccountNavButton variant="hero" />
          <a href="#play" className="btn btn-primary">
            Play Now{" "}
            <span style={{ color: "#FFC107", marginLeft: "6px" }}>→</span>
          </a>
        </div>
      </nav>

      <div className="mobile-quick-nav" aria-label="Quick navigation">
        <a href="#play" className="mobile-quick-nav-pill">
          Daily Featured
        </a>
        <a href="#games" className="mobile-quick-nav-pill">
          All Games
        </a>
        <a href="#archive" className="mobile-quick-nav-pill">
          Archive
        </a>
        <a href="#about" className="mobile-quick-nav-pill">
          About
        </a>
      </div>

      <main className="hero">
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
            <div className="warning-icon">
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
            <a href="#play" className="btn btn-primary btn-lg">
              Play Now{" "}
              <span style={{ color: "#FFC107", marginLeft: "8px" }}>→</span>
            </a>
            <button
              type="button"
              onClick={() => setTrailerOpen(true)}
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
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8"></polygon>
              </svg>
              How It Works
            </button>
          </div>
        </div>

        <div className="hero-visual">
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

          <img
            src={assetPath("/boxes-bg.png")}
            alt="Background Boxes"
            className="hero-boxes-bg"
          />

          <div className="hero-phone-stage">
            <img
              src={assetPath("/hands.png")}
              alt="Hands holding a smartphone"
              className="hero-hands"
            />

            <div
              className="hero-demo-container"
              role="region"
              aria-label="SOL GaMES Gameplay Demo Video"
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
                        <span className="hero-demo-dot" /> GAMEPLAY PREVIEW
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
                            className={`hero-demo-tile ${tileClass}`}
                          />
                        ))}
                      </div>
                      <p className="hero-demo-title">Demo video coming soon</p>
                      <p className="hero-demo-caption">
                        21 Things &amp; Connect 5 live walkthrough
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
                aria-label="Unmute and rewind demo video"
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
      </main>

      <section className="features">
        <div className="feature-item">
          <div className="feature-icon icon-green">
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
          <div className="feature-icon icon-purple">
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
          <div className="feature-icon icon-yellow">
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
          <div className="feature-icon icon-green-outline">
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

      <Dialog open={trailerOpen} onOpenChange={setTrailerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Welcome to 21 Games by SOL Theory</DialogTitle>
            <DialogDescription>
              Daily social gratitude &amp; word-chain puzzles designed to spark
              connection and sharpen your mind.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="rounded-xl border-2 border-black bg-[#f7eef5] p-3.5">
              <h4 className="font-headline font-black text-base text-black">
                1. 21 Things (21 → 6 → 3 → 1 Funnel)
              </h4>
              <p className="text-xs sm:text-sm mt-1">
                Play Today&apos;s curated 3×7 gratitude board—or tap the mic to
                voice-brainstorm your own 21 Things—and narrow down 21 → 6 → 3 →
                1 to what resonates most.
              </p>
            </div>
            <div className="rounded-xl border-2 border-black bg-emerald-50 p-3.5">
              <h4 className="font-headline font-black text-base text-black">
                2. Connect 5 (Compound Word Chain)
              </h4>
              <p className="text-xs sm:text-sm mt-1">
                Complete the 5-row word chain where every word links with the
                word above it (like <code>MOUSE → PAD → LOCK → DOWN → WIND</code>
                ).
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Link href="/games/21-things" onClick={() => setTrailerOpen(false)}>
              <Button variant="outline" className="border-2 border-black font-bold">
                Play 21 Things
              </Button>
            </Link>
            <Link href="/games/connect-5" onClick={() => setTrailerOpen(false)}>
              <Button className="bg-black text-white font-bold">
                Play Connect 5
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

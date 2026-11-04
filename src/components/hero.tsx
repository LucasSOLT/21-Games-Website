import React from 'react';
import { assetPath } from '@/lib/asset-path';

export function Hero() {
  return (
    <div className="container">
        <nav className="navbar">
            <div className="logo">
                <img src={assetPath('/logo.png')} alt="SOL GaMES" style={{ height: '140px', marginTop: '-40px', marginBottom: '-40px', marginLeft: '-15px' }} />
            </div>
            <div className="nav-links">
                <a href="#games" className="nav-link">Games</a>
                <a href="#challenges" className="nav-link">Challenges</a>
                <a href="#community" className="nav-link">Community</a>
                <a href="#about" className="nav-link">About</a>
            </div>
            <a href="#play" className="btn btn-primary">
                Play Now <span style={{ color: '#FFC107', marginLeft: '6px' }}>→</span>
            </a>
        </nav>

        <main className="hero">
            <div className="hero-content">
                <h1 className="hero-title">
                    Smart <span className="highlight-yellow">Games.</span><br />
                    New <span className="highlight-green">Challenges.</span><br />
                    Every <span className="highlight-purple">Day.</span>
                </h1>
                <p className="hero-subtitle">
                    Sharpen your mind with smart, bite-sized games.<br />
                    New challenges every day to keep you thinking.
                </p>

                <div className="warning-box">
                    <div className="warning-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L1 21H23L12 2Z" fill="#B265E6"/>
                            <path d="M11 10H13V15H11V10ZM11 17H13V19H11V17Z" fill="white"/>
                        </svg>
                    </div>
                    <p className="warning-text">
                        <strong>Warning:</strong> May cause extreme joy and<br />a severe case of &quot;just one more game&quot; syndrome.
                    </p>
                </div>
                <p className="small-disclaimer">
                    <em>(And unlike the Times, we don&apos;t charge for your addiction.)</em>
                </p>

                <div className="cta-group">
                    <a href="#play" className="btn btn-primary btn-lg">
                        Play Now <span style={{ color: '#FFC107', marginLeft: '8px' }}>→</span>
                    </a>
                    <a href="#trailer" className="btn btn-secondary btn-lg">
                        <svg className="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polygon points="10 8 16 12 10 16 10 8"></polygon>
                        </svg>
                        Watch Trailer
                    </a>
                </div>
            </div>

            <div className="hero-visual">
                <img src={assetPath('/boxes-bg.png')} alt="Background Boxes" className="hero-boxes-bg" />
                <img src={assetPath('/hands.png')} alt="Hands holding a smartphone" className="hero-hands" />
            </div>
        </main>

        <section className="features">
            <div className="feature-item">
                <div className="feature-icon icon-green">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                </div>
                <div className="feature-text">
                    <h3>Smart Fun</h3>
                    <p>Games that make<br />you think.</p>
                </div>
            </div>
            
            <div className="feature-item">
                <div className="feature-icon icon-purple">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                        <rect x="8" y="14" width="2" height="2" fill="currentColor"></rect>
                        <rect x="12" y="14" width="2" height="2" fill="currentColor"></rect>
                        <rect x="16" y="14" width="2" height="2" fill="currentColor"></rect>
                        <rect x="8" y="18" width="2" height="2" fill="currentColor"></rect>
                    </svg>
                </div>
                <div className="feature-text">
                    <h3>New Daily Challenges</h3>
                    <p>Fresh puzzles every day<br />to keep it exciting.</p>
                </div>
            </div>

            <div className="feature-item">
                <div className="feature-icon icon-yellow">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                </div>
                <div className="feature-text">
                    <h3>Join the Community</h3>
                    <p>Compete, share, and<br />celebrate together.</p>
                </div>
            </div>

            <div className="feature-item">
                <div className="feature-icon icon-green-outline">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        <path d="M9 12l2 2 4-4"></path>
                    </svg>
                </div>
                <div className="feature-text">
                    <h3>Play Anywhere</h3>
                    <p>Seamless experience<br />across all devices.</p>
                </div>
            </div>
        </section>
    </div>
  );
}

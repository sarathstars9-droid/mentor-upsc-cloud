import React from "react";
import { Link } from "react-router-dom";
import "../styles/landing.css";

export default function LandingPage() {
  return (
    <div className="landing-page">
      <main className="landing-content">
        <div className="hero-brand-container">
          <img 
            src="/brand/mentorupsc-logo-full.png" 
            alt="MentorUPSC" 
            className="hero-main-logo desktop-logo" 
          />
          <div className="hero-main-logo mobile-logo">
            <img src="/brand/mentorupsc-symbol.png" alt="MentorUPSC Symbol" />
            <span className="mobile-logo-text">MentorUPSC</span>
          </div>
          <p className="mobile-tagline">Built for Focus. Driven by Progress.</p>
        </div>
        
        <h1 className="hero-main-headline">YOUR UPSC PREPARATION, UNDER CONTROL.</h1>
        
        <div className="preparation-loop-area">
          <h2 className="loop-main-heading">One preparation loop. Fully connected.</h2>
          <p className="loop-main-supporting">
            Plan, execute, review, correct, revise and re-test—without losing track<br className="desktop-only" />
            of what matters next.
          </p>
        </div>
        
        <div className="landing-cta-container">
          <Link to="/login" className="primary-cta">
            Open MentorOS
          </Link>
        </div>
      </main>

      <footer className="landing-footer">
        <div className="footer-links-container">
          <div className="footer-social">
            <a 
              href="https://www.instagram.com/iupscmentor/" 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="Visit MentorUPSC on Instagram"
              className="footer-instagram"
            >
              Instagram @iupscmentor
            </a>
          </div>
          <div className="footer-legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

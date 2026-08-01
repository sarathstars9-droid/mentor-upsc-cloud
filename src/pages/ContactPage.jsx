import React from "react";
import { Link } from "react-router-dom";

export default function ContactPage() {
  return (
    <div className="contact-page-container">
      <header className="contact-header">
        <img 
          src="/brand/mentorupsc-wordmark.png" 
          alt="MentorUPSC" 
          className="contact-wordmark" 
        />
      </header>

      <main className="contact-content">
        <div className="contact-panel">
          <h1 className="contact-heading">Contact MentorUPSC</h1>
          <p className="contact-copy">
            For MentorUPSC updates and enquiries, connect with us through our official Instagram profile.
          </p>
          <a 
            href="https://www.instagram.com/iupscmentor/" 
            target="_blank" 
            rel="noopener noreferrer" 
            aria-label="Visit MentorUPSC on Instagram"
            className="contact-instagram-btn"
          >
            @iupscmentor
          </a>
          <Link to="/" className="contact-back-link">
            Back to MentorUPSC
          </Link>
        </div>
      </main>

      <footer className="landing-footer" style={{ borderTop: "none", height: "auto", padding: "2rem 0" }}>
        <div className="footer-links-container" style={{ alignItems: "center" }}>
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

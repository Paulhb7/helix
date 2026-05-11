import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <div className="site-footer-mark">
            <span className="material-symbols-outlined" aria-hidden="true">genetics</span>
            <span>Helix</span>
          </div>
          <p>Empowering the public with clinical-grade medical truth in the age of digital misinformation.</p>
        </div>
        <div className="site-footer-links">
          <Link to="/about">About</Link>
          <Link to="/methodology">Methodology</Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <div className="site-footer-actions">
          <button type="button" aria-label="Share">
            <span className="material-symbols-outlined sm" aria-hidden="true">share</span>
          </button>
          <button type="button" aria-label="Contact">
            <span className="material-symbols-outlined sm" aria-hidden="true">mail</span>
          </button>
        </div>
      </div>
      <p className="site-footer-disclaimer">
        Research prototype. Helix evaluates <em>public claims</em>, not patients.
        Not medical advice — always verify against the cited sources.
      </p>
    </footer>
  );
}

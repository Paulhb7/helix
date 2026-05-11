import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { fetchMode } from '../api/helix';

function OllamaIcon() {
  return <img src="/ollama.png" alt="" />;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8L6.1 33C9.4 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.1 4-3.9 5.3l6.2 5.2c-.4.4 6.4-4.7 6.4-14.5 0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

function ModeBadge() {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMode()
      .then((m) => { if (!cancelled) setMode(m); })
      .catch(() => { if (!cancelled) setMode(null); });
    return () => { cancelled = true; };
  }, []);

  if (!mode) return null;

  const isApi = mode.provider === 'api';
  const title = isApi ? `Google API · ${mode.model}` : `Ollama · ${mode.model}`;

  return (
    <div className="mode-toggle" role="group" aria-label={`Active model: ${title}`} title={title}>
      <span className={`mode-pill ${isApi ? 'is-active' : 'is-inactive'}`}>
        <span className="mode-badge-icon"><GoogleIcon /></span>
        <span className="mode-badge-stack">
          <span className="mode-badge-eyebrow">API mode</span>
          <span className="mode-badge-name">Google API</span>
        </span>
      </span>
      <span className={`mode-pill ${!isApi ? 'is-active' : 'is-inactive'}`}>
        <span className="mode-badge-icon"><OllamaIcon /></span>
        <span className="mode-badge-stack">
          <span className="mode-badge-eyebrow">Local mode</span>
          <span className="mode-badge-name">Ollama</span>
        </span>
      </span>
    </div>
  );
}

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="wordmark">
          <span className="wordmark-mark" aria-hidden="true">
            <span className="material-symbols-outlined">genetics</span>
          </span>
          <span className="wordmark-text">Helix</span>
        </Link>
        <nav className="topnav">
          <NavLink to="/check">Check</NavLink>
          <NavLink to="/reports">Former reports</NavLink>
          <NavLink to="/methodology">Methodology</NavLink>
          <NavLink to="/about">About</NavLink>
          <ModeBadge />
        </nav>
      </div>
    </header>
  );
}

export default function Header({ onNavigate, transparent }) {
  return (
    <header className={`site-header${transparent ? ' site-header--transparent' : ''}`}>
      <a href="#" className="wordmark" onClick={(e) => { e.preventDefault(); onNavigate('landing'); }}>
        <span className="dot" />
        <span>Beacon</span>
      </a>
      <nav className="topnav">
        <a href="#about" onClick={(e) => { e.preventDefault(); onNavigate('about'); }}>About</a>
        <a href="#" className="nav-cta">Research preview</a>
      </nav>
    </header>
  );
}

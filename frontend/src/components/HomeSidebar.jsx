const TRENDING = [
  {
    tag: '#PublicHealth',
    title: 'New mRNA vaccine updates',
  },
  {
    tag: '#Nutrition',
    title: 'The impact of ultra-processed food',
  },
  {
    tag: '#Wellness',
    title: 'Intermittent fasting research 2026',
  },
  {
    tag: '#Pharma',
    title: 'GLP-1 agonists for weight loss',
  },
];

function TruthMeter() {
  const cursorPos = 38;
  return (
    <section className="sidebar-section">
      <header className="sidebar-section-head">
        <h2>Truth meter</h2>
        <p>Indicative trend across the claims Helix has verified — illustrative for now.</p>
      </header>
      <article className="sidebar-card glass-card">
        <div className="truth-meter">
          <div className="truth-meter-bar truth-gradient">
            <div className="truth-meter-cursor" style={{ left: `${cursorPos}%` }}>
              <div className="truth-meter-cursor-dot" />
            </div>
          </div>
          <div className="truth-meter-labels">
            <span>FALSE</span>
            <span>MIXED</span>
            <span>TRUE</span>
          </div>
        </div>
      </article>
    </section>
  );
}

function TrendingTopics() {
  return (
    <section className="sidebar-section">
      <header className="sidebar-section-head">
        <h2>Trending topics</h2>
        <p>What people are checking right now.</p>
      </header>
      <article className="sidebar-card glass-card">
        <ul className="trending-list">
          {TRENDING.map((t) => (
            <li key={t.title}>
              <button type="button" className="trending-item" disabled>
                <span className="trending-tag">{t.tag}</span>
                <span className="trending-title">{t.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}

export default function HomeSidebar() {
  return (
    <aside className="home-sidebar">
      <TruthMeter />
      <TrendingTopics />
    </aside>
  );
}

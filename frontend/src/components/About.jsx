import { Link } from 'react-router-dom';

export default function About() {
  return (
    <section className="vision-view">
      {/* Hero */}
      <section className="vision-hero">
        <div className="vision-hero-text">
          <div className="about-pill">
            <span className="material-symbols-outlined sm" aria-hidden="true">biotech</span>
            <span>Our mission</span>
          </div>
          <h1 className="vision-hero-title">
            Restoring trust in medical science through clarity.
          </h1>
          <p className="vision-hero-lede">
            In an era of overwhelming information, Helix provides a transparent, scientifically
            rigorous foundation for health claims. We untangle complex data to reveal the
            biological truth, blending advanced AI extraction with peer-reviewed certainty.
          </p>
          <div className="vision-hero-actions">
            <Link to="/check" className="btn-primary">
              <span className="material-symbols-outlined sm" aria-hidden="true">arrow_forward</span>
              Try Helix
            </Link>
            <Link to="/methodology" className="btn-secondary">
              <span className="material-symbols-outlined sm" aria-hidden="true">science</span>
              See the methodology
            </Link>
          </div>
        </div>
        <div className="vision-hero-visual">
          <div className="vision-hero-glow" aria-hidden="true" />
          <video
            className="vision-hero-image"
            src="/animated.mp4"
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
        </div>
      </section>

      {/* Our Story */}
      <section className="vision-story">
        <div className="vision-story-inner">
          <h2 className="vision-section-title">Our story</h2>
          <article className="vision-story-card glass-card">
            <p>
              Helix was born from a critical realization: the gap between rigorous medical
              research and public understanding was growing dangerously wide. While scientists
              published peer-reviewed facts, the open web amplified sensationalism — often faster
              than corrections could catch up.
            </p>
            <p>
              We assembled a small team of researchers, technologists, and designers to build a
              bridge. By orchestrating language models against authoritative databases like
              PubMed, the WHO, and the global fact-checking network, we built a tool that
              doesn&apos;t just say what is true — it shows you the exact strand of evidence that
              proves it.
            </p>
          </article>
        </div>
      </section>

      {/* Radical Transparency */}
      <section className="vision-transparency">
        <div className="vision-transparency-bg" aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 C30,40 70,60 100,0 L100,100 L0,100 Z" />
          </svg>
        </div>
        <div className="vision-transparency-inner">
          <div className="vision-transparency-text">
            <h2 className="vision-section-title vision-section-title--inverse">
              Radical transparency
            </h2>
            <p>
              We believe a fact-check is only as good as its sources. That is why every verdict
              we issue is accompanied by direct links to peer-reviewed studies and authoritative
              databases. No hidden algorithms, no black boxes — just clear, structured science
              you can audit.
            </p>
            <Link to="/methodology" className="vision-transparency-link">
              <span>Read the methodology</span>
              <span className="material-symbols-outlined sm" aria-hidden="true">arrow_forward</span>
            </Link>
          </div>
          <div className="vision-truth-scale">
            <p className="vision-truth-scale-label">The truth scale</p>
            <div className="vision-truth-bar">
              <div className="vision-truth-bar-track truth-gradient" />
              <div className="vision-truth-bar-cursor" style={{ left: '85%' }}>
                <div className="vision-truth-bar-dot" />
              </div>
            </div>
            <div className="vision-truth-scale-legend">
              <span>False</span>
              <span>Mixed</span>
              <span className="vision-truth-scale-legend--active">Verified</span>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

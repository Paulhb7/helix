import { useEffect } from 'react';
import ScrollExpandHero from './ScrollExpandHero';

const SOURCES = ['PubMed', 'WHO', 'CDC', 'Fact Check Tools', 'YouTube', 'TikTok'];
const SOURCE_CLASSES = {
  PubMed: 'logo-pubmed',
  WHO: 'logo-who',
  CDC: 'logo-cdc',
  'Fact Check Tools': 'logo-factcheck',
  YouTube: 'logo-youtube',
  TikTok: 'logo-tiktok',
};

export default function Landing({ onStart }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <ScrollExpandHero
        mediaSrc="/animated.mp4"
        bgImageSrc="/animated.mp4"
        title="Health misinformation kills."
        date="Beacon"
        scrollToExpand="Scroll to expand"
        textBlend
      >
        <div className="landing-after-expand">
          <div className="landing-cta">
            <p className="eyebrow eyebrow--dark">
              Anti-vax content alone has been linked to <strong>318,000+ preventable deaths</strong> in the US during COVID.{' '}
              <a href="https://publichealth.yale.edu/news-article/lifesaving-impact-of-covid-vaccines-quantified-in-new-yale-led-study/" target="_blank" rel="noopener">
                Yale, 2022
              </a>.
            </p>
            <button type="button" className="btn-enter" onClick={onStart}>
              Start checking
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          <section className="agent-stack" aria-label="AI agents and data sources">
            <p>Grounded in trusted health data sources.</p>
            <div className="logo-marquee" aria-hidden="true">
              <div className="logo-track">
                {[...SOURCES, ...SOURCES].map((s, i) => (
                  <span key={i} className={`source-logo ${SOURCE_CLASSES[s]}`}>{s}</span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </ScrollExpandHero>
    </>
  );
}

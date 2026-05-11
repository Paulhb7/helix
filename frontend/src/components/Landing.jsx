import { useEffect } from 'react';
import ScrollExpandHero from './ScrollExpandHero';

export default function Landing({ onStart }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <ScrollExpandHero
      mediaSrc="/animated.mp4"
      bgImageSrc=""
      title="Health misinformation kills."
      date="Helix — agentic health fact-checker"
      scrollToExpand=""
      textBlend
      onStart={onStart}
      stats={[
        {
          number: '318,000',
          label: 'US COVID-19 deaths that vaccines could have prevented, in just 15 months',
          source: 'Brown SPH & Microsoft AI for Health (2022) — hesitancy driven largely by online misinfo',
          sourceUrl: 'https://globalepidemics.org/2022/05/13/new-analysis-shows-vaccines-could-have-prevented-318000-deaths/',
        },
        {
          number: '127,350',
          label: 'measles cases in Europe in 2024 — the highest in 25 years',
          source: 'WHO Europe / UNICEF (Mar 2025) — collapsing vaccination coverage',
          sourceUrl: 'https://www.who.int/europe/news/item/13-03-2025-european-region-reports-highest-number-of-measles-cases-in-more-than-25-years---unicef--who-europe',
        },
        {
          number: '3 in 4',
          label: 'US adults are unsure whether common false health claims are true',
          source: 'KFF Health Misinformation Tracking Poll (2023)',
          sourceUrl: 'https://www.kff.org/health-information-trust/kff-health-misinformation-tracking-poll-pilot/',
        },
      ]}
    />
  );
}

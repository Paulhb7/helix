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
        onStart={onStart}
      />
    </>
  );
}

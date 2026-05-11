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
    />
  );
}

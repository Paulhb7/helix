import { useEffect, useRef, useState } from 'react';

export default function ScrollExpandHero({
  mediaSrc,
  bgImageSrc,
  posterSrc,
  title,
  date,
  scrollToExpand,
  textBlend,
  onStart,
  stats,
}) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mediaFullyExpanded, setMediaFullyExpanded] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    setScrollProgress(0);
    setMediaFullyExpanded(false);
  }, [mediaSrc]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, [mediaSrc]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (mediaFullyExpanded && e.deltaY < 0 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        e.preventDefault();
      } else if (mediaFullyExpanded) {
        e.preventDefault();
      } else if (!mediaFullyExpanded) {
        e.preventDefault();
        const scrollDelta = e.deltaY * 0.0009;
        const newProgress = Math.min(Math.max(scrollProgress + scrollDelta, 0), 1);
        setScrollProgress(newProgress);

        if (newProgress >= 1) {
          setMediaFullyExpanded(true);
        }
      }
    };

    const handleTouchStart = (e) => {
      setTouchStartY(e.touches[0].clientY);
    };

    const handleTouchMove = (e) => {
      if (!touchStartY) return;
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;

      if (mediaFullyExpanded && deltaY < -20 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        e.preventDefault();
      } else if (mediaFullyExpanded) {
        e.preventDefault();
      } else if (!mediaFullyExpanded) {
        e.preventDefault();
        const scrollFactor = deltaY < 0 ? 0.008 : 0.005;
        const scrollDelta = deltaY * scrollFactor;
        const newProgress = Math.min(Math.max(scrollProgress + scrollDelta, 0), 1);
        setScrollProgress(newProgress);

        if (newProgress >= 1) {
          setMediaFullyExpanded(true);
        }
        setTouchStartY(touchY);
      }
    };

    const handleTouchEnd = () => setTouchStartY(0);

    const handleScroll = () => {
      if (!mediaFullyExpanded) window.scrollTo(0, 0);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scrollProgress, mediaFullyExpanded, touchStartY]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Source video is 1920x1080 (16:9). Cap final size to native resolution so we
  // never upscale — keeps the expansion animation but the final frame stays sharp.
  const startW = isMobile ? 440 : 700;
  const finalW = isMobile ? 1080 : 1920;
  const mediaWidth = startW + scrollProgress * (finalW - startW);
  const mediaHeight = Math.round(mediaWidth * 9 / 16);

  const firstWord = title ? title.split(' ')[0] : '';
  const restOfTitle = title ? title.split(' ').slice(1).join(' ') : '';
  const titleFade = Math.max(0, 1 - scrollProgress * 1.6);
  const titleLift = scrollProgress * (isMobile ? -24 : -40);
  // Stats + Start button reveal together once the user starts scrolling.
  // They fade in from 0.25 → 0.55 progress and remain visible thereafter.
  const reveal = scrollProgress < 0.25
    ? 0
    : Math.min(1, (scrollProgress - 0.25) / 0.3);
  const statsLift = (1 - reveal) * 18;

  return (
    <div className="seh-root">
      <section className="seh-section">
        <div className="seh-wrapper">
          {/* Background layer */}
          <div
            className="seh-bg"
            style={{ opacity: 1 - scrollProgress }}
          >
            {bgImageSrc && !/\.(mp4|webm|mov)$/i.test(bgImageSrc) ? (
              <img src={bgImageSrc} alt="" className="seh-bg-img" />
            ) : (
              <div className="seh-bg-img seh-bg-dark" />
            )}
            <div className="seh-bg-overlay" />
          </div>

          <div className="seh-container">
            <div className="seh-viewport">
              {/* Eyebrow + headline above the video */}
              <div
                className={`seh-headline${textBlend ? ' seh-blend' : ''}`}
                style={{
                  opacity: titleFade,
                  transform: `translate(-50%, calc(-50% + ${titleLift}px))`,
                }}
              >
                {date && <p className="seh-eyebrow">{date}</p>}
                <h1 className="seh-title">
                  {firstWord} <em>{restOfTitle}</em>
                </h1>
              </div>

              {stats && stats.length > 0 && (
                <ul
                  className="seh-stats"
                  aria-label="Why this matters"
                  style={{
                    opacity: reveal,
                    transform: `translate(-50%, calc(-50% + ${statsLift}px))`,
                    visibility: reveal > 0.01 ? 'visible' : 'hidden',
                  }}
                >
                  {stats.map((s, i) => (
                    <li key={i} className="seh-stat">
                      <span className="seh-stat-number">{s.number}</span>
                      <span className="seh-stat-label">{s.label}</span>
                      {s.source && (
                        s.sourceUrl ? (
                          <a
                            className="seh-stat-source"
                            href={s.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {s.source}
                          </a>
                        ) : (
                          <span className="seh-stat-source">{s.source}</span>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Expanding media */}
              <div
                className="seh-media-frame"
                style={{
                  width: `${mediaWidth}px`,
                  height: `${mediaHeight}px`,
                  maxWidth: '95vw',
                  maxHeight: '85vh',
                }}
              >
                <div className="seh-media-inner">
                  <video
                    ref={videoRef}
                    src={mediaSrc}
                    poster={posterSrc}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    className="seh-video"
                  />
                  <div className="seh-media-click-guard" />
                  <div
                    className="seh-media-overlay"
                    style={{ opacity: 0.5 - scrollProgress * 0.3 }}
                  />
                </div>
              </div>

              {onStart && reveal > 0.01 && (
                <button
                  type="button"
                  className="seh-glass-btn"
                  onClick={onStart}
                  style={{
                    opacity: reveal,
                    visibility: reveal > 0.01 ? 'visible' : 'hidden',
                    pointerEvents: reveal > 0.6 ? 'auto' : 'none',
                  }}
                >
                  <span>Start checking</span>
                  <span className="material-symbols-outlined sm" aria-hidden="true">arrow_forward</span>
                </button>
              )}

              {!mediaFullyExpanded && (
                <div
                  className="seh-scroll-hint"
                  style={{ opacity: Math.max(0, 1 - scrollProgress * 5) }}
                  aria-hidden="true"
                >
                  <span className="seh-scroll-hint-text">Scroll to expand</span>
                  <span className="material-symbols-outlined seh-scroll-hint-arrow">arrow_downward</span>
                </div>
              )}

              {scrollToExpand && (
                <p className="seh-label-scroll" aria-hidden="true">
                  {scrollToExpand}
                </p>
              )}
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}

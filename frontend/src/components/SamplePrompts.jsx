const YouTubeLogo = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      fill="#FF0000"
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
    />
    <path fill="#fff" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const TikTokLogo = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      fill="#111"
      d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
    />
  </svg>
);

const SAMPLES = [
  {
    prompt: 'https://www.youtube.com/shorts/ry6snF7xcYE',
    label: 'YouTube short',
    Logo: YouTubeLogo,
  },
  {
    prompt: 'https://www.tiktok.com/@dr_ingky/video/7390648093215083784',
    label: 'TikTok short',
    Logo: TikTokLogo,
  },
  {
    prompt: 'Drinking lemon water cures stage IV cancer.',
    label: 'Cancer cure claim',
    icon: 'medication',
  },
  {
    prompt: 'Vaccines cause autism in children.',
    label: 'Vaccine claim',
    icon: 'vaccines',
  },
  {
    prompt: 'Drinking lemon water with apple cider vinegar every morning is a natural GLP-1 that makes you lose 5kg in 2 weeks without dieting.',
    label: 'Natural GLP-1 weight loss',
    icon: 'monitor_weight',
  },
];

export default function SamplePrompts({ onSelect }) {
  return (
    <div className="sample-strip" aria-label="Starter prompts">
      <span className="sample-strip-label">Try a sample</span>
      <div className="sample-strip-grid">
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            type="button"
            className="sample-chip"
            onClick={() => onSelect(s.prompt)}
          >
            <span
              className={`sample-chip-icon ${s.Logo ? 'sample-chip-icon--brand' : ''}`}
              aria-hidden="true"
            >
              {s.Logo ? (
                <s.Logo />
              ) : (
                <span className="material-symbols-outlined sm">{s.icon}</span>
              )}
            </span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

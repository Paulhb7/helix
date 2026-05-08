const SAMPLES = [
  {
    prompt: 'https://www.youtube.com/watch?v=ry6snF7xcYE&list=PLaAVUPgLmR2wQw7Oqwi3ynqv0exVoGrBr&index=6',
    label: 'Health video test',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="3" />
        <path d="m10 9 5 3-5 3V9z" />
      </svg>
    ),
  },
  {
    prompt: 'https://www.youtube.com/shorts/ry6snF7xcYE',
    label: 'Short-form claim',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="3" width="10" height="18" rx="3" />
        <path d="m11 9 4 3-4 3V9z" />
      </svg>
    ),
  },
  {
    prompt: 'Drinking lemon water cures stage IV cancer.',
    label: 'Cancer cure claim',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10.5 20.5 10-10a4.24 4.24 0 0 0-6-6l-10 10a4.24 4.24 0 0 0 6 6Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    ),
  },
  {
    prompt: 'Vaccines cause autism in children.',
    label: 'Vaccine claim',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </svg>
    ),
  },
];

export default function SamplePrompts({ onSelect }) {
  return (
    <div className="sample-gallery" aria-label="Starter prompts">
      <div className="sample-gallery-head">
        <span>Try a sample</span>
        <p>Starter prompts for the agent flow.</p>
      </div>
      <div className="sample-grid">
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            type="button"
            className="sample-card"
            onClick={() => onSelect(s.prompt)}
          >
            <span className="sample-icon" aria-hidden="true">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

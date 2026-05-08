const PIPELINE_STEPS = [
  {
    title: 'Extract the claim',
    desc: 'Gemma 4 (E2B, fast tier) reads the input — text, URL, or screenshot — and produces a single atomic English claim suitable for retrieval.',
  },
  {
    title: 'Fan out across the literature',
    desc: 'Three sub-agents query independent evidence bases concurrently: PubMed (peer-reviewed research), WHO & CDC mythbusters (public-health authorities), and Google Fact Check Tools (HealthFeedback, Snopes, Lead Stories, Politifact health).',
  },
  {
    title: 'Construct the verdict',
    desc: 'The Investigator assembles validated findings into one of five verdict bands, with a signed score and a short explanation. The roadmap is to move this band and score calculation into deterministic Python.',
  },
  {
    title: 'Explain in plain language',
    desc: 'The narrative summarizes the cited sources in the user\'s language without giving medical advice. Every link in the evidence list is clickable.',
  },
];

export default function About({ onBack }) {
  return (
    <section className="about-view">
      <header className="about-head">
        <p className="kicker">How it works</p>
        <h2>A passive fact-checker for health claims, grounded in the published record.</h2>
        <p className="about-lede">
          Beacon takes any claim — a sentence, a screenshot, a YouTube link — and runs it through
          three evidence sources. The current prototype uses validated tool outputs plus an
          Investigator LLM to choose the verdict band, score, and explanation. A deterministic
          Python combiner is the next reliability step.
        </p>
      </header>

      <ol className="pipeline">
        {PIPELINE_STEPS.map((s, i) => (
          <li key={i}>
            <span className="step">{i + 1}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="about-grid">
        <article className="info-card">
          <h3>Verdict bands</h3>
          <ul className="band-list">
            <li><span className="band supported">Supported</span><p>Multiple high-quality sources agree with the claim.</p></li>
            <li><span className="band partial">Partially supported</span><p>Core element supported; framing or causality overstated.</p></li>
            <li><span className="band insufficient">Insufficient evidence</span><p>No clear consensus in the literature.</p></li>
            <li><span className="band contradicted">Contradicted</span><p>Claim contradicts one or more high-quality sources.</p></li>
            <li><span className="band misinfo">Known misinformation</span><p>On the WHO Mythbusters list or already formally fact-checked.</p></li>
          </ul>
        </article>

        <article className="info-card">
          <h3>Privacy by design</h3>
          <p>Beacon can run the reasoning model locally through Ollama, or use Google AI Studio when configured with an API key. Local mode keeps model inference on your machine.</p>
          <p>Evidence lookup may still contact public APIs such as PubMed E-utils and Google Fact Check Tools. The WHO/CDC mythbuster matcher uses a curated list shipped with the repo.</p>
        </article>

        <article className="info-card">
          <h3>What Beacon doesn&apos;t do</h3>
          <p>Beacon evaluates <strong>public claims about health</strong>, not individuals. It does not look at symptoms, test results, or medical records. It is not a medical device and never replaces a clinician.</p>
          <p>A <em>Contradicted</em> verdict on a viral video is not a treatment recommendation. When in doubt, talk to a qualified health professional.</p>
        </article>

        <article className="info-card">
          <h3>Built on</h3>
          <p><strong>Gemma 4</strong> — configured through LiteLLM, either locally via Ollama or through Google AI Studio.</p>
          <p><strong>Google ADK</strong> — Sequential and Parallel agent orchestration with native function calling.</p>
          <p><strong>Public scientific infrastructure</strong> — PubMed, the WHO, the CDC, and the global fact-checking network.</p>
        </article>
      </div>

      <div className="about-foot">
        <button type="button" className="btn-enter" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="12 19 5 12 12 5" />
            <line x1="19" y1="12" x2="5" y2="12" />
          </svg>
          Back
        </button>
      </div>
    </section>
  );
}

const PIPELINE_STEPS = [
  {
    icon: 'description',
    title: 'Read the input',
    desc: 'A claim, a URL, or a screenshot. URLs are ingested deterministically in Python — articles via Trafilatura, YouTube via captions (with a Whisper fallback when captions are missing), TikTok via the same audio path. Images are read by Gemma 4 vision.',
  },
  {
    icon: 'edit_note',
    title: 'Pick the single main claim',
    desc: 'The Orchestrator (Gemma 4, standard tier) reads the user message — short statement, question, or long transcript — and selects the single most testable health claim. It normalizes the claim to English for retrieval and tags its language and domain.',
  },
  {
    icon: 'hub',
    title: 'Cross-check three independent sources',
    desc: 'The Investigator (Gemma 4, fast tier) calls three evidence tools in parallel: PubMed (peer-reviewed abstracts via NCBI E-utilities), WHO factsheets (via the official Sitefinity API), and Google Fact Check Tools (HealthFeedback, Snopes, Lead Stories, Politifact health).',
  },
  {
    icon: 'verified',
    title: 'Assemble the verdict',
    desc: 'The Investigator builds one finding per source, picks one of five verdict bands with a signed score, and writes a short narrative plus an editorial assessment of the content — all in the original language of the claim.',
  },
];

const INFO_CARDS = [
  {
    icon: 'verified',
    title: 'Verdict bands',
    body: (
      <ul className="band-list">
        <li><span className="band supported">Supported</span><p>Multiple high-quality sources agree with the claim.</p></li>
        <li><span className="band partial">Partially supported</span><p>Core element supported; framing or causality overstated.</p></li>
        <li><span className="band insufficient">Insufficient evidence</span><p>No clear consensus in the literature.</p></li>
        <li><span className="band contradicted">Contradicted</span><p>Claim contradicts one or more high-quality sources.</p></li>
        <li><span className="band misinfo">Known misinformation</span><p>Already formally fact-checked as false by the global fact-checking network.</p></li>
      </ul>
    ),
  },
  {
    icon: 'lock',
    title: 'Privacy by design',
    body: (
      <>
        <p>Helix can run the reasoning model locally through Ollama, or use Google AI Studio when configured with an API key. Local mode keeps model inference on your machine.</p>
        <p>Evidence lookup still contacts public APIs — PubMed E-utilities, the WHO factsheets endpoint, and Google Fact Check Tools — to retrieve sources at query time rather than relying on stale model memory.</p>
      </>
    ),
  },
  {
    icon: 'gpp_maybe',
    title: 'What Helix doesn\'t do',
    body: (
      <>
        <p>Helix evaluates <strong>public claims about health</strong>, not individuals. It does not look at symptoms, test results, or medical records. It is not a medical device and never replaces a clinician.</p>
        <p>A <em>Contradicted</em> verdict on a viral video is not a treatment recommendation. When in doubt, talk to a qualified health professional.</p>
      </>
    ),
  },
  {
    icon: 'science',
    title: 'Built on',
    body: (
      <>
        <p><strong>Gemma 4</strong> — configured through LiteLLM, either locally via Ollama or through Google AI Studio.</p>
        <p><strong>Google ADK</strong> — Orchestrator and Investigator agents with native function calling and sub-agent transfer.</p>
        <p><strong>Public scientific infrastructure</strong> — PubMed, the WHO, and the global fact-checking network.</p>
      </>
    ),
  },
];

export default function Methodology({ onBack }) {
  return (
    <section className="about-view dna-mesh">
      <header className="about-head">
        <div className="about-pill">
          <span className="material-symbols-outlined sm" aria-hidden="true">science</span>
          <span>How it works</span>
        </div>
        <h2>The architecture and data behind every verdict.</h2>
        <p className="about-lede">
          Helix takes any claim — a sentence, a screenshot, a YouTube link — picks the single most
          testable health claim, and cross-checks it against three independent evidence bases:
          peer-reviewed research, the World Health Organization, and the global fact-checking network.
        </p>
      </header>

      <ol className="pipeline">
        {PIPELINE_STEPS.map((s, i) => (
          <li key={i} className="pipeline-step glass-card">
            <span className="pipeline-icon">
              <span className="material-symbols-outlined" aria-hidden="true">{s.icon}</span>
            </span>
            <div>
              <span className="pipeline-step-num">Step {String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="about-grid">
        {INFO_CARDS.map((c, i) => (
          <article key={i} className="info-card glass-card">
            <header className="info-card-head">
              <span className="info-card-icon">
                <span className="material-symbols-outlined sm" aria-hidden="true">{c.icon}</span>
              </span>
              <h3>{c.title}</h3>
            </header>
            <div className="info-card-body">{c.body}</div>
          </article>
        ))}
      </div>

      <div className="about-foot">
        <button type="button" className="btn-secondary" onClick={onBack}>
          <span className="material-symbols-outlined sm" aria-hidden="true">arrow_back</span>
          Back
        </button>
      </div>
    </section>
  );
}

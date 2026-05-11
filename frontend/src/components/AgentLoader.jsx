import { useEffect, useRef, useState } from 'react';

function extractionPlan(hasUrl, hasImage) {
  const sourceStep = hasImage
    ? { title: 'Analysing your image', detail: 'We read the screenshot and extract any health-related text it contains.', icon: 'image' }
    : hasUrl
      ? { title: 'Fetching your source', detail: 'We download the article or video and pull out the readable content.', icon: 'cloud_download' }
      : { title: 'Reading your text', detail: 'We take the claim you typed and prepare it for analysis.', icon: 'description' };

  return [
    sourceStep,
    { title: 'Understanding the context', detail: 'We figure out which health topic is involved — nutrition, vaccines, treatments, etc.', icon: 'psychology' },
    { title: 'Extracting claims', detail: 'We identify the key health claims that can be fact-checked.', icon: 'hub' },
    { title: 'Preparing your review', detail: 'We format everything so you can confirm or edit the claims before we verify them.', icon: 'fact_check' },
  ];
}

function verificationPlan(claimCount) {
  return [
    { title: 'Launching investigators', detail: `We spin up one investigator per claim — ${claimCount} running in parallel.`, icon: 'rocket_launch' },
    { title: 'Searching the evidence', detail: 'Each investigator queries PubMed, the WHO/CDC myth-buster database, and Google Fact Check Tools.', icon: 'travel_explore' },
    { title: 'Weighing the evidence', detail: 'We score how strong each source is, check for contradictions, and assess consensus.', icon: 'balance' },
    { title: 'Writing the verdicts', detail: 'We summarise the findings into a clear, sourced verdict for each claim.', icon: 'edit_note' },
  ];
}

function directCheckPlan(hasUrl, hasImage) {
  const sourceStep = hasImage
    ? { title: 'Reading your image', detail: 'We extract any health-related text from the screenshot.', icon: 'image' }
    : hasUrl
      ? { title: 'Fetching your source', detail: 'We download the article or video and pull out the readable content.', icon: 'cloud_download' }
      : { title: 'Reading your text', detail: 'We take the claim you typed and prepare it for analysis.', icon: 'description' };

  return [
    sourceStep,
    { title: 'Identifying the main claim', detail: 'We isolate the single most important health claim worth fact-checking.', icon: 'hub' },
    { title: 'Querying PubMed', detail: 'We search peer-reviewed studies, meta-analyses, and clinical trials.', icon: 'menu_book' },
    { title: 'Checking WHO, CDC and fact-checkers', detail: 'We cross-reference public-health authorities and the global fact-checking network.', icon: 'health_and_safety' },
    { title: 'Weighing the evidence', detail: 'We score the quality of each source, check for contradictions, and assess consensus.', icon: 'balance' },
    { title: 'Writing the verdict and editorial take', detail: 'We summarise everything into a clear, sourced verdict — and an editorial opinion of the content as a whole.', icon: 'edit_note' },
  ];
}

export function useAgentPlan() {
  const [plan, setPlan] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState('idle');
  const timerRef = useRef(null);

  function start(steps) {
    stop();
    setPlan(steps);
    setActiveIndex(0);
    setStatus('running');
  }

  function stop() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function complete() {
    stop();
    setActiveIndex((prev) => plan.length || prev);
    setStatus('done');
  }

  function fail() {
    stop();
    setStatus('error');
  }

  useEffect(() => {
    if (status !== 'running' || activeIndex >= plan.length - 1) return;
    // Per-step time ranges (ms). Each step picks a uniformly-random value in its window.
    const ranges = [
      [3500, 6500],   // ingest / read source
      [4000, 8000],   // map context
      [6000, 11000],  // extract / search
      [3000, 5500],   // wrap-up
      [4500, 8000],   // overflow buffers for longer plans
      [2500, 4500],
    ];
    const [lo, hi] = ranges[activeIndex] || [3000, 5500];
    const delay = lo + Math.random() * (hi - lo);
    timerRef.current = setTimeout(() => {
      setActiveIndex((i) => i + 1);
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [activeIndex, status, plan.length]);

  return {
    plan, activeIndex, status,
    startExtraction: (hasUrl, hasImage) => start(extractionPlan(hasUrl, hasImage)),
    startVerification: (count) => start(verificationPlan(count)),
    startDirectCheck: (hasUrl, hasImage) => start(directCheckPlan(hasUrl, hasImage)),
    complete, fail,
  };
}

const SOURCE_LABEL = {
  article: 'Article',
  youtube: 'YouTube transcript',
  tiktok: 'TikTok audio',
  claim: 'Your claim',
  image: 'Screenshot',
};

function ScanningPanel({ active, plan, activeIndex, status, source }) {
  const total = plan.length || 1;
  const currentStep = plan[Math.min(activeIndex, total - 1)];
  const completed = status === 'done' ? total : Math.min(activeIndex, total);
  const progressPct = (completed / total) * 100;
  const stepNumber = Math.min(activeIndex + 1, total);

  const hasSource = source && (source.text || source.kind === 'image');
  const label = hasSource ? (SOURCE_LABEL[source.kind] || 'Source') : 'Source';
  // Cap how much we render so very long transcripts stay readable.
  const body = source?.text ? source.text.slice(0, 4000) : '';

  return (
    <div className="scanning-panel glass-card">
      <header className="scanning-panel-head">
        <div className="scanning-panel-meta">
          <span className="material-symbols-outlined sm" aria-hidden="true">description</span>
          <span>{label}</span>
        </div>
        <span className="scanning-panel-page">Step {stepNumber} / {total}</span>
      </header>
      <div className="scanning-panel-body">
        {active && <div className="scanning-beam" aria-hidden="true" />}
        {hasSource && source.title && (
          <p className="scanning-line"><strong>{source.title}</strong></p>
        )}
        {hasSource && body && (
          <p className="scanning-line scanning-line--body">{body}</p>
        )}
        {!hasSource && (
          <>
            <div className="scanning-skeleton skeleton-w-3" />
            <div className="scanning-skeleton skeleton-w-full" />
            <div className="scanning-skeleton skeleton-w-2" />
            <p className="scanning-line">Fetching the source…</p>
          </>
        )}
        {source?.kind === 'image' && (
          <p className="scanning-line">Reading the screenshot with native vision…</p>
        )}
      </div>
      <footer className="scanning-panel-foot">
        <div>
          <span className="scanning-panel-meta-label">Currently</span>
          <span className="scanning-panel-meta-value">
            {currentStep ? currentStep.title : '—'}
          </span>
        </div>
        <div className="scanning-progress" aria-label={`Progress: ${Math.round(progressPct)}%`}>
          <div className="scanning-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </footer>
    </div>
  );
}

export default function AgentLoader({ message, plan, activeIndex, status, source }) {
  return (
    <section className="agent-loader">
      <header className="agent-loader-head">
        <div className="agent-loader-pill">
          <span className="agent-loader-pulse" aria-hidden="true" />
          <span>{status === 'error' ? 'Analysis interrupted' : 'Analysis in progress'}</span>
        </div>
        <h2>{message || 'Working on it'}</h2>
        <p>
          Helix orchestrates several agents — they read the source, identify the claims,
          and cross-reference each one against scientific literature.
        </p>
        <p className="agent-loader-eta">
          <span className="material-symbols-outlined sm" aria-hidden="true">schedule</span>
          This usually takes between 30 seconds and 1 min 30.
        </p>
      </header>

      <div className="agent-loader-grid">
        <ScanningPanel
          active={status === 'running'}
          plan={plan}
          activeIndex={activeIndex}
          status={status}
          source={source}
        />

        <ol className="agent-plan" aria-label="Agent progress" aria-live="polite">
          {plan.map((step, i) => {
            let state = 'pending';
            if (status === 'error' && i === activeIndex) state = 'error';
            else if (i < activeIndex || status === 'done') state = 'done';
            else if (i === activeIndex && status === 'running') state = 'active';

            const stateIcon = {
              done: 'check_circle',
              active: step.icon || 'sync',
              error: 'error',
              pending: step.icon || 'radio_button_unchecked',
            }[state];

            return (
              <li key={i} className="agent-plan-step glass-card" data-state={state}>
                <span className={`agent-plan-icon agent-plan-icon--${state}`} aria-hidden="true">
                  <span className={`material-symbols-outlined${state === 'done' || state === 'error' ? ' fill' : ''}`}>
                    {stateIcon}
                  </span>
                </span>
                <div className="agent-plan-body">
                  <div className="agent-plan-row">
                    <strong>{step.title}</strong>
                    <span className={`agent-plan-badge agent-plan-badge--${state}`}>
                      {state === 'done' ? 'done' : state === 'active' ? 'running' : state === 'error' ? 'error' : 'queued'}
                    </span>
                  </div>
                  <span className="agent-plan-detail">{step.detail}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

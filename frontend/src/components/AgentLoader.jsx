import { useEffect, useRef, useState } from 'react';

function extractionPlan(hasUrl, hasImage) {
  const sourceStep = hasImage
    ? { title: 'Reading image input', detail: 'Preparing the screenshot for the Manager.', tools: ['vision', 'manager'] }
    : hasUrl
      ? { title: 'Fetching source', detail: 'Loading page metadata and readable content.', tools: ['ingestion', 'manager'] }
      : { title: 'Reading text', detail: 'Sending the claim text to the Manager.', tools: ['manager'] };

  return [
    sourceStep,
    { title: 'Manager triage', detail: 'Choosing the right ingestion path and health domain.', tools: ['router', 'health-domain'] },
    { title: 'Claim extraction', detail: 'Identifying the main claim and supporting sub-claims.', tools: ['claim-parser'] },
    { title: 'Preparing review', detail: 'Formatting editable claims before verification.', tools: ['schema-validator'] },
  ];
}

function verificationPlan(claimCount) {
  return [
    { title: 'Dispatching investigators', detail: `${claimCount} claim${claimCount === 1 ? '' : 's'} queued for evidence search.`, tools: ['dispatcher'] },
    { title: 'Querying evidence', detail: 'Checking PubMed, public-health sources, and fact-check databases.', tools: ['PubMed', 'WHO/CDC', 'Fact Check'] },
    { title: 'Reducing findings', detail: 'Scoring evidence strength and contradictions.', tools: ['evidence-reducer'] },
    { title: 'Writing verdicts', detail: 'Preparing the cited explanation for each claim.', tools: ['narrative-agent'] },
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
    const delays = [1200, 3200, 4800, 2400, 3600, 2000];
    const delay = delays[activeIndex] || 2800;
    timerRef.current = setTimeout(() => {
      setActiveIndex((i) => i + 1);
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [activeIndex, status, plan.length]);

  return {
    plan, activeIndex, status,
    startExtraction: (hasUrl, hasImage) => start(extractionPlan(hasUrl, hasImage)),
    startVerification: (count) => start(verificationPlan(count)),
    complete, fail,
  };
}

export default function AgentLoader({ message, plan, activeIndex, status }) {
  const progress = plan.length > 0 ? Math.min(100, ((Math.min(activeIndex + 1, plan.length)) / plan.length) * 100) : 30;

  return (
    <section className="state-card agent-loading">
      <div className="reactor-core">
        <div className="reactor-ring reactor-ring-1" />
        <div className="reactor-ring reactor-ring-2" />
        <div className="reactor-ring reactor-ring-3" />
        <div className="reactor-glow">
          <div className="reactor-center">
            <svg className="reactor-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4" /><path d="M6.34 6.34l2.83 2.83" /><path d="M2 12h4" />
              <path d="M17.66 6.34l-2.83 2.83" /><path d="M22 12h-4" />
              <circle cx="12" cy="12" r="4" /><path d="M12 16v6" /><path d="M9 22h6" />
            </svg>
          </div>
        </div>
        <div className="reactor-particles" aria-hidden="true">
          <span className="particle p-icon" style={{ '--delay': '0s', '--start-x': '-20%', '--start-y': '20%' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
          </span>
          <span className="particle p-text" style={{ '--delay': '0.3s', '--start-x': '120%', '--start-y': '30%' }}>PUBMED</span>
          <span className="particle p-icon" style={{ '--delay': '0.6s', '--start-x': '-15%', '--start-y': '60%' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </span>
          <span className="particle p-text" style={{ '--delay': '0.9s', '--start-x': '115%', '--start-y': '70%' }}>WHO</span>
          <span className="particle p-icon" style={{ '--delay': '1.2s', '--start-x': '120%', '--start-y': '15%' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
          <span className="particle p-text" style={{ '--delay': '1.5s', '--start-x': '-10%', '--start-y': '80%' }}>FACTS</span>
        </div>
      </div>
      <div className="agent-loading-body">
        <div className="agent-loading-head">
          <div>
            <p>{message}</p>
            <span>Live agent plan</span>
          </div>
        </div>
        <ol className="agent-plan" aria-label="Agent progress">
          {plan.map((step, i) => {
            let state = 'pending';
            if (status === 'error' && i === activeIndex) state = 'error';
            else if (i < activeIndex || status === 'done') state = 'done';
            else if (i === activeIndex && status === 'running') state = 'active';

            return (
              <li key={i} className="agent-plan-step" data-state={state}>
                <span className="agent-plan-marker" aria-hidden="true">
                  {state === 'done' ? '✓' : state === 'active' ? '•' : ''}
                </span>
                <div className="agent-plan-body">
                  <div className="agent-plan-row">
                    <strong>{step.title}</strong>
                    <span className="agent-plan-badge">
                      {state === 'done' ? 'done' : state === 'active' ? 'running' : state === 'error' ? 'error' : 'queued'}
                    </span>
                  </div>
                  <span className="agent-plan-detail">{step.detail}</span>
                  {step.tools?.length > 0 && (
                    <div className="agent-tools">
                      {step.tools.map((t) => <span key={t}>{t}</span>)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="reactor-progress">
          <div className="reactor-progress-bar" style={{ width: `${status === 'done' ? 100 : progress}%` }} />
        </div>
      </div>
    </section>
  );
}

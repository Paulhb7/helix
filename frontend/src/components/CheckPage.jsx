import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CheckForm from './CheckForm';
import AgentLoader, { useAgentPlan } from './AgentLoader';
import Results from './Results';
import FormerReports from './FormerReports';
import HomeSidebar from './HomeSidebar';
import { ingest, runCheck, fileToBase64 } from '../api/helix';

const URL_RE = /^https?:\/\//i;

export default function CheckPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('form');
  const [results, setResults] = useState(null);
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const agentPlan = useAgentPlan();

  async function handleCheck({ text, file }) {
    if (!text && !file) {
      setError('Type a claim, paste a URL, or attach an image.');
      setStep('error');
      return;
    }

    const body = {};
    if (text) {
      if (URL_RE.test(text)) body.url = text;
      else body.text = text;
    }
    if (file) body.image_b64 = await fileToBase64(file);

    setLoadingMsg(
      body.url
        ? 'Reading the source and identifying claims…'
        : body.image_b64
          ? 'Reading the screenshot and identifying claims…'
          : 'Identifying the claim and gathering evidence…',
    );
    agentPlan.startDirectCheck(Boolean(body.url), Boolean(body.image_b64));
    setStep('loading');
    setLoading(true);
    setSource(null);
    setError('');

    try {
      // Step 1 (deterministic, fast): fetch the source text so the user has
      // something to read while the agent crunches.
      const ingested = await ingest(body);
      setSource(ingested);

      // Step 2 (slow, agentic): orchestrator + investigator.
      // Pass the already-fetched text instead of the URL to avoid re-fetching.
      const checkBody = body.image_b64
        ? { image_b64: body.image_b64 }
        : { text: ingested.text || body.text };
      const data = await runCheck(checkBody);
      const items = data.results || [];

      if (items.length === 0) {
        agentPlan.fail();
        setError('No health claim could be identified in this input. Try a different URL or rephrase the text.');
        setStep('error');
        return;
      }

      agentPlan.complete();
      setResults(data);
      setStep('results');
    } catch (err) {
      agentPlan.fail();
      setError(err.message || String(err));
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-view">
      {step === 'form' && (
        <>
          <CheckForm onSubmit={handleCheck} disabled={loading} />
          <div className="home-grid">
            <FormerReports
              onOpen={(id) => navigate(`/reports/${id}`)}
              onSeeAll={() => navigate('/reports')}
              limit={3}
            />
            <HomeSidebar />
          </div>
        </>
      )}
      {step === 'loading' && (
        <AgentLoader
          message={loadingMsg}
          plan={agentPlan.plan}
          activeIndex={agentPlan.activeIndex}
          status={agentPlan.status}
          source={source}
        />
      )}
      {step === 'error' && (
        <section className="state-card error">
          <strong>Could not run the check.</strong>
          <p>{error}</p>
          <button type="button" className="btn-secondary" onClick={() => setStep('form')}>
            <span className="material-symbols-outlined sm" aria-hidden="true">refresh</span>
            Try again
          </button>
        </section>
      )}
      {step === 'results' && results && (
        <Results
          results={results.results}
          elapsedSeconds={results.elapsed_seconds}
        />
      )}
    </div>
  );
}

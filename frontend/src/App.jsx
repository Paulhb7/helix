import { useCallback, useRef, useState } from 'react';
import Header from './components/Header';
import Landing from './components/Landing';
import CheckForm from './components/CheckForm';
import AgentLoader, { useAgentPlan } from './components/AgentLoader';
import ClaimReview from './components/ClaimReview';
import Results from './components/Results';
import About from './components/About';
import Footer from './components/Footer';
import { extractClaims, verifyClaims, fileToBase64 } from './api/beacon';

const URL_RE = /^https?:\/\//i;

export default function App() {
  const [view, setView] = useState('landing');
  const [step, setStep] = useState('form');
  const [claims, setClaims] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const lastNonAbout = useRef('landing');
  const agentPlan = useAgentPlan();

  const navigate = useCallback((target) => {
    if (target === 'about') {
      lastNonAbout.current = view;
      setView('about');
    } else if (target === 'back') {
      setView(lastNonAbout.current);
    } else {
      setView(target);
      if (target !== 'about') lastNonAbout.current = target;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);

  async function handleExtract({ text, file }) {
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

    setLoadingMsg(body.url ? 'Manager fetching content + identifying claims...' : 'Manager identifying claims...');
    agentPlan.startExtraction(Boolean(body.url), Boolean(body.image_b64));
    setStep('loading');
    setLoading(true);
    setError('');

    try {
      const data = await extractClaims(body);
      agentPlan.complete();
      setClaims(data.claims || []);
      setStep('review');
    } catch (err) {
      agentPlan.fail();
      setError(err.message || String(err));
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(validClaims) {
    setLoadingMsg(`Dispatching ${validClaims.length} Investigator${validClaims.length === 1 ? '' : 's'}...`);
    agentPlan.startVerification(validClaims.length);
    setStep('loading');
    setLoading(true);
    setError('');

    try {
      const data = await verifyClaims(validClaims);
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

  if (view === 'about') {
    return (
      <>
        <Header onNavigate={navigate} />
        <main>
          <About onBack={() => navigate('back')} />
        </main>
        <Footer />
      </>
    );
  }

  if (view === 'landing') {
    return (
      <>
        <Header onNavigate={navigate} />
        <main>
          <Landing onStart={() => setView('app')} />
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header onNavigate={navigate} />
      <main>
        <div className="app-view">
          {step === 'form' && <CheckForm onSubmit={handleExtract} disabled={loading} />}
          {step === 'loading' && (
            <AgentLoader
              message={loadingMsg}
              plan={agentPlan.plan}
              activeIndex={agentPlan.activeIndex}
              status={agentPlan.status}
            />
          )}
          {step === 'error' && (
            <section className="state-card error">{error}</section>
          )}
          {step === 'review' && (
            <ClaimReview initialClaims={claims} onVerify={handleVerify} />
          )}
          {step === 'results' && results && (
            <Results results={results.results} elapsedSeconds={results.elapsed_seconds} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

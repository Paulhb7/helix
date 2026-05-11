import { useState } from 'react';

const BAND_CLASS = {
  'Supported': 'supported',
  'Partially supported': 'partial',
  'Insufficient evidence': 'insufficient',
  'Contradicted': 'contradicted',
  'Known misinformation': 'misinfo',
};

const BAND_ICON = {
  'Supported': 'verified',
  'Partially supported': 'warning',
  'Insufficient evidence': 'help',
  'Contradicted': 'cancel',
  'Known misinformation': 'gpp_bad',
};

const BAND_LABEL_SHORT = {
  'Supported': 'True',
  'Partially supported': 'Mixed',
  'Insufficient evidence': 'Unclear',
  'Contradicted': 'False',
  'Known misinformation': 'Misinfo',
};

const AGENT_LABEL = {
  'pubmed': 'PubMed',
  'pubmed_agent': 'PubMed',
  'who': 'WHO',
  'cdc': 'CDC',
  'who_cdc': 'WHO / CDC',
  'mythbuster': 'WHO Mythbuster',
  'fact_check': 'Google Fact Check',
  'fact_check_tools': 'Google Fact Check',
  'google_fact_check': 'Google Fact Check',
  'factchecker': 'Google Fact Check',
  'fact_checker': 'Google Fact Check',
};

function agentKey(agent) {
  return (agent || '').toLowerCase().replace(/[\s-]/g, '_');
}

function scoreToPercent(score) {
  if (score == null || Number.isNaN(score)) return 50;
  // Score is float; assume range [-1, 1] (signed). Map to 0..100.
  const clamped = Math.max(-1, Math.min(1, score));
  return Math.round((clamped + 1) * 50);
}

function veracityLabel(score) {
  const p = scoreToPercent(score);
  if (p >= 70) return 'High Veracity';
  if (p >= 45) return 'Mixed Veracity';
  return 'Low Veracity';
}

function VeracityScale({ score }) {
  const pct = scoreToPercent(score);
  return (
    <div className="veracity-scale">
      <div className="veracity-labels">
        <span className="band-mini contradicted">False</span>
        <span className="band-mini insufficient">Mixed</span>
        <span className="band-mini supported">True</span>
      </div>
      <div className="truth-gradient veracity-bar">
        <div className="veracity-cursor" style={{ left: `${pct}%` }}>
          <div className="veracity-cursor-dot" />
        </div>
      </div>
      <p className="veracity-readout">{veracityLabel(score)}</p>
    </div>
  );
}

function SourceCard({ slot, snippet, sourceCount, empty }) {
  return (
    <article className={`source-card glass-card${empty ? ' source-card--empty' : ''}`}>
      <div className="source-card-head">
        <div className="source-card-icon">
          <span className="material-symbols-outlined" aria-hidden="true">{slot.icon}</span>
        </div>
        <div>
          <p className="source-card-name">{slot.label}</p>
          <span className="source-card-badge">
            <span className="material-symbols-outlined sm fill" aria-hidden="true">
              {empty ? 'remove' : 'verified'}
            </span>
            {empty ? 'No evidence found' : slot.badge}
          </span>
        </div>
      </div>
      {!empty && snippet && <p className="source-card-quote">{snippet}</p>}
      {!empty && sourceCount > 0 && (
        <p className="source-card-count">
          {sourceCount} cited reference{sourceCount === 1 ? '' : 's'}
        </p>
      )}
      {empty && (
        <p className="source-card-quote source-card-quote--empty">
          This agent did not return evidence for this claim. The model may have skipped the call or the source was rate-limited.
        </p>
      )}
    </article>
  );
}

const SOURCE_SLOTS = [
  {
    id: 'pubmed',
    label: 'PubMed',
    icon: 'menu_book',
    badge: 'Peer Reviewed',
    matches: ['pubmed', 'pubmed_agent'],
  },
  {
    id: 'who_cdc',
    label: 'WHO / CDC',
    icon: 'health_and_safety',
    badge: 'High Authority',
    matches: ['who', 'cdc', 'who_cdc', 'mythbuster'],
  },
  {
    id: 'fact_check',
    label: 'Google Fact Check',
    icon: 'verified',
    badge: 'Cross-Referenced',
    matches: ['fact_check', 'fact_check_tools', 'google_fact_check', 'factchecker', 'fact_checker'],
  },
];

function SourceItem({ source, agent }) {
  return (
    <li>
      <span className="src-tag">{AGENT_LABEL[agentKey(agent)] || agent}</span>
      <a href={source.url} target="_blank" rel="noopener noreferrer">
        {source.title || source.url}
      </a>
      {source.snippet && <div className="snippet">{source.snippet}</div>}
    </li>
  );
}

function ClaimCard({ claim, verdict, primary }) {
  const totalSources = (verdict.findings || []).reduce(
    (acc, f) => acc + (f.sources?.length || 0),
    0,
  );
  const bandClass = BAND_CLASS[verdict.band] || '';
  const bandIcon = BAND_ICON[verdict.band] || 'help';
  const bandShort = BAND_LABEL_SHORT[verdict.band] || verdict.band;
  const pct = scoreToPercent(verdict.score);

  return (
    <article className={`claim-card glass-card claim-card--${primary ? 'primary' : 'sub'} band-border-${bandClass}`}>
      <div className="claim-card-head">
        <span className={`band-pill band-${bandClass}`}>
          <span className="material-symbols-outlined sm fill" aria-hidden="true">{bandIcon}</span>
          {verdict.band}
        </span>
        {claim.tier && (
          <span className={`tier-badge tier-${claim.tier}`}>
            <span className="material-symbols-outlined sm" aria-hidden="true">
              {claim.tier === 'sub' ? 'hub' : 'verified'}
            </span>
            {claim.tier === 'sub' ? 'Sub-claim' : 'Main claim'}
          </span>
        )}
      </div>
      <h3 className="claim-card-title">{claim.text}</h3>
      {verdict.narrative && <p className="claim-card-narrative">{verdict.narrative}</p>}
      <div className="claim-card-meter">
        <div className="claim-card-meter-track">
          <div className={`claim-card-meter-fill band-bg-${bandClass}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`claim-card-meter-label band-${bandClass}`}>{bandShort}</span>
      </div>
      <div className="claim-card-meta">
        <span>score {Number(verdict.score).toFixed(2)}</span>
        <span>·</span>
        <span>{totalSources} source{totalSources === 1 ? '' : 's'}</span>
        {claim.domain && (<><span>·</span><span>{claim.domain}</span></>)}
      </div>
      {totalSources > 0 && (
        <details>
          <summary>
            <span className="material-symbols-outlined sm" aria-hidden="true">expand_more</span>
            Evidence ({totalSources})
          </summary>
          <ul className="sources-list">
            {(verdict.findings || []).flatMap((f) =>
              (f.sources || []).map((s, i) => (
                <SourceItem key={`${f.agent}-${i}`} source={s} agent={f.agent} />
              )),
            )}
          </ul>
        </details>
      )}
    </article>
  );
}

function slugify(text) {
  return (text || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'report';
}

function HeroVerdict({ results, elapsedSeconds }) {
  const [shareLabel, setShareLabel] = useState('Share Report');
  const isShareable = typeof window !== 'undefined'
    && window.location.pathname.startsWith('/reports/');
  if (results.length === 0) return null;

  const primary = results.find((r) => r.claim?.tier === 'main') || results[0];
  const avgScore = results.reduce((acc, r) => acc + (r.verdict.score || 0), 0) / results.length;
  const totalSources = results.reduce(
    (acc, r) => acc + (r.verdict.findings || []).reduce((a, f) => a + (f.sources?.length || 0), 0),
    0,
  );

  function handleDownload() {
    const previousTitle = document.title;
    const detailsList = document.querySelectorAll('details');
    const wereOpen = Array.from(detailsList).map((d) => d.open);

    document.title = `helix-${slugify(primary.claim.text)}`;
    detailsList.forEach((d) => { d.open = true; });

    const restore = () => {
      document.title = previousTitle;
      detailsList.forEach((d, i) => { d.open = wereOpen[i]; });
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }

  async function handleShare() {
    const url = window.location.href;
    const shareData = {
      title: 'Beacon Verification Report',
      text: primary.claim.text,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareLabel('Link copied!');
      setTimeout(() => setShareLabel('Share Report'), 2000);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setShareLabel('Share failed');
      setTimeout(() => setShareLabel('Share Report'), 2000);
    }
  }

  return (
    <section className="hero-verdict glass-card">
      <div className="hero-verdict-main">
        <div className="hero-verdict-pill">
          <span className="material-symbols-outlined sm fill" aria-hidden="true">verified</span>
          <span>Verification Report</span>
        </div>
        <h2>{primary.claim.text}</h2>
        {primary.verdict.narrative && (
          <p className="hero-verdict-narrative">{primary.verdict.narrative}</p>
        )}
        <div className="hero-verdict-stats">
          <span><strong>{results.length}</strong> claim{results.length === 1 ? '' : 's'}</span>
          <span><strong>{totalSources}</strong> source{totalSources === 1 ? '' : 's'}</span>
          <span><strong>{elapsedSeconds}s</strong> analysis</span>
        </div>
      </div>
      <div className="hero-verdict-side">
        <VeracityScale score={avgScore} />
        <div className="hero-verdict-actions">
          {isShareable && (
            <button type="button" className="btn-primary" onClick={handleShare}>
              <span className="material-symbols-outlined sm" aria-hidden="true">share</span>
              {shareLabel}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={handleDownload}>
            <span className="material-symbols-outlined sm" aria-hidden="true">download</span>
            Download
          </button>
        </div>
      </div>
    </section>
  );
}

function EvidenceSources({ results }) {
  // Aggregate findings by canonical slot. Always render the 3 expected slots,
  // even if an agent returned nothing — that's transparent about coverage.
  const slotData = SOURCE_SLOTS.map((slot) => {
    let snippet = null;
    let sourceCount = 0;
    for (const r of results) {
      for (const f of r.verdict.findings || []) {
        if (!slot.matches.includes(agentKey(f.agent))) continue;
        sourceCount += (f.sources || []).length;
        if (!snippet) {
          snippet = (f.sources || []).find((s) => s.snippet)?.snippet || f.summary || null;
        }
      }
    }
    return { slot, snippet, sourceCount, empty: sourceCount === 0 };
  });

  const filledCount = slotData.filter((s) => !s.empty).length;

  return (
    <section className="evidence-sources">
      <header className="evidence-head">
        <h3>Evidence sources</h3>
        <span>
          {filledCount} of {SOURCE_SLOTS.length} agent{SOURCE_SLOTS.length === 1 ? '' : 's'} returned evidence
        </span>
      </header>
      <div className="evidence-grid">
        {slotData.map((s) => (
          <SourceCard
            key={s.slot.id}
            slot={s.slot}
            snippet={s.snippet}
            sourceCount={s.sourceCount}
            empty={s.empty}
          />
        ))}
      </div>
    </section>
  );
}

export default function Results({ results, elapsedSeconds }) {
  if (!results || results.length === 0) {
    return (
      <section className="result">
        <p className="muted">
          No verdicts produced — likely a rate-limit or model error. Check server logs.
        </p>
      </section>
    );
  }

  const main = results.find((r) => r.claim?.tier === 'main') || results[0];
  const overall = main.verdict?.overall_assessment;

  return (
    <section className="result">
      <HeroVerdict results={results} elapsedSeconds={elapsedSeconds} />

      <div className="claim-single">
        <ClaimCard claim={main.claim} verdict={main.verdict} primary />
      </div>

      {overall && (
        <section className="overall-assessment glass-card">
          <header className="overall-assessment-head">
            <span className="material-symbols-outlined sm fill" aria-hidden="true">psychology</span>
            <div>
              <span className="overall-assessment-kicker">What Helix thinks</span>
              <h3>Editorial take on the content</h3>
            </div>
          </header>
          <p>{overall}</p>
          <p className="overall-assessment-disclaimer">
            This is the LLM&apos;s opinion based on the evidence gathered above. It is not medical advice.
          </p>
        </section>
      )}

      <EvidenceSources results={results} />
    </section>
  );
}

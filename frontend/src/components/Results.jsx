const BAND_CLASS = {
  'Supported': 'supported',
  'Partially supported': 'partial',
  'Insufficient evidence': 'insufficient',
  'Contradicted': 'contradicted',
  'Known misinformation': 'misinfo',
};

function SourceItem({ source, agent }) {
  return (
    <li>
      <span className="src-tag">{agent}</span>
      <a href={source.url} target="_blank" rel="noopener noreferrer">
        {source.title || source.url}
      </a>
      {source.snippet && <div className="snippet">{source.snippet}</div>}
    </li>
  );
}

function ClaimCard({ claim, verdict }) {
  const totalSources = (verdict.findings || []).reduce(
    (acc, f) => acc + (f.sources?.length || 0),
    0,
  );

  return (
    <article className="claim-card">
      <div className="claim-header">
        {claim.tier && (
          <span className={`tier-badge tier-${claim.tier}`}>
            {claim.tier === 'sub' ? 'Sub' : 'Main'}
          </span>
        )}
        <span className={`band ${BAND_CLASS[verdict.band] || ''}`}>{verdict.band}</span>
        <p className="claim-text">{claim.text}</p>
      </div>
      {verdict.narrative && <p className="narrative">{verdict.narrative}</p>}
      <div className="meta">
        score {verdict.score} &middot; {totalSources} source{totalSources === 1 ? '' : 's'}
        {claim.domain ? ` · ${claim.domain}` : ''}
      </div>
      <details open={totalSources > 0}>
        <summary>Sources ({totalSources})</summary>
        <ul className="sources-list">
          {(verdict.findings || []).flatMap((f) =>
            (f.sources || []).map((s, i) => (
              <SourceItem key={`${f.agent}-${i}`} source={s} agent={f.agent} />
            )),
          )}
        </ul>
      </details>
    </article>
  );
}

export default function Results({ results, elapsedSeconds }) {
  return (
    <section className="result">
      <p className="results-summary">
        {results.length} verdict{results.length === 1 ? '' : 's'} &middot; {elapsedSeconds}s
      </p>
      {results.length === 0 ? (
        <p className="muted">
          No verdicts produced — likely a rate-limit or model error. Check server logs.
        </p>
      ) : (
        <div className="claim-cards">
          {results.map((r, i) => (
            <ClaimCard key={i} claim={r.claim} verdict={r.verdict} />
          ))}
        </div>
      )}
    </section>
  );
}

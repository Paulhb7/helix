import { useState } from 'react';
import { FORMER_REPORTS } from '../data/formerReports';

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

function ReportCard({ report, onOpen }) {
  const main = report.results[0];
  const bandClass = BAND_CLASS[report.band] || '';
  const bandIcon = BAND_ICON[report.band] || 'help';
  const [imgFailed, setImgFailed] = useState(false);
  const sourceCount = (main.verdict.findings || []).reduce(
    (acc, f) => acc + (f.sources?.length || 0),
    0,
  );

  return (
    <article className="recent-card glass-card">
      <div className={`recent-card-thumb recent-card-thumb--${bandClass}`}>
        {report.image && !imgFailed ? (
          <img src={report.image} alt="" onError={() => setImgFailed(true)} />
        ) : (
          <span className="material-symbols-outlined" aria-hidden="true">{report.thumbIcon || 'science'}</span>
        )}
      </div>
      <div className="recent-card-body">
        <div className="recent-card-meta">
          <span className={`band-pill band-${bandClass}`}>
            <span className="material-symbols-outlined sm fill" aria-hidden="true">{bandIcon}</span>
            {report.bandLabel}
          </span>
          <span className="recent-card-when">{report.publishedAt}</span>
        </div>
        <h3 className="recent-card-title">{main.claim.text}</h3>
        <p className="recent-card-sources">
          <span className="material-symbols-outlined sm" aria-hidden="true">menu_book</span>
          {sourceCount} cited source{sourceCount === 1 ? '' : 's'} · {report.elapsedSeconds}s
        </p>
      </div>
      <button
        type="button"
        className="recent-card-go"
        aria-label="Open report"
        onClick={() => onOpen(report.id)}
      >
        <span className="material-symbols-outlined sm" aria-hidden="true">arrow_forward</span>
      </button>
    </article>
  );
}

export default function FormerReports({ onOpen, limit, onSeeAll }) {
  const items = typeof limit === 'number' ? FORMER_REPORTS.slice(0, limit) : FORMER_REPORTS;
  const hasMore = typeof limit === 'number' && FORMER_REPORTS.length > limit;

  return (
    <section className="recent-section">
      <header className="recent-head">
        <div>
          <h2>Former reports</h2>
          <p>Real claims Helix has fact-checked, with verifiable sources.</p>
        </div>
        {hasMore && onSeeAll && (
          <button type="button" className="recent-head-link" onClick={onSeeAll}>
            See all {FORMER_REPORTS.length}
            <span className="material-symbols-outlined sm" aria-hidden="true">arrow_forward</span>
          </button>
        )}
      </header>
      <div className="recent-list">
        {items.map((r) => (
          <ReportCard key={r.id} report={r} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export { ReportCard };

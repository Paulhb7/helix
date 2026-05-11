import { useMemo, useState } from 'react';
import { FORMER_REPORTS } from '../data/formerReports';
import { ReportCard } from './FormerReports';

const BAND_FILTERS = [
  { key: 'all', label: 'All', icon: 'all_inclusive' },
  { key: 'Supported', label: 'Supported', icon: 'verified' },
  { key: 'Partially supported', label: 'Partial', icon: 'warning' },
  { key: 'Insufficient evidence', label: 'Insufficient', icon: 'help' },
  { key: 'Contradicted', label: 'Contradicted', icon: 'cancel' },
  { key: 'Known misinformation', label: 'Misinformation', icon: 'gpp_bad' },
];

export default function FormerReportsPage({ onOpen, onBack }) {
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => {
    const c = { all: FORMER_REPORTS.length };
    for (const r of FORMER_REPORTS) c[r.band] = (c[r.band] || 0) + 1;
    return c;
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? FORMER_REPORTS : FORMER_REPORTS.filter((r) => r.band === filter)),
    [filter],
  );

  return (
    <section className="reports-page">
      <header className="reports-page-head">
        <button type="button" className="former-report-back" onClick={onBack}>
          <span className="material-symbols-outlined sm" aria-hidden="true">arrow_back</span>
          Back to Check
        </button>
        <h1>Former reports</h1>
        <p>
          Every claim Helix has fact-checked, archived with the sources the agent cited.
          Filter by verdict to compare how the evidence falls across the bands.
        </p>
      </header>

      <div className="reports-filters" role="tablist" aria-label="Filter reports by verdict">
        {BAND_FILTERS.map((b) => {
          const n = counts[b.key] || 0;
          const isActive = filter === b.key;
          const disabled = b.key !== 'all' && n === 0;
          return (
            <button
              key={b.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={disabled}
              className={`reports-filter${isActive ? ' is-active' : ''}`}
              onClick={() => setFilter(b.key)}
            >
              <span className="material-symbols-outlined sm fill" aria-hidden="true">{b.icon}</span>
              {b.label}
              <span className="reports-filter-count">{n}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="reports-empty muted">
          No archived reports in this band yet.
        </div>
      ) : (
        <div className="recent-list">
          {visible.map((r) => (
            <ReportCard key={r.id} report={r} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

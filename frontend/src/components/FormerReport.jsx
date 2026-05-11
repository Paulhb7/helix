import { getFormerReport } from '../data/formerReports';
import Results from './Results';

export default function FormerReport({ id, onBack }) {
  const report = getFormerReport(id);

  if (!report) {
    return (
      <section className="result">
        <p className="muted">Report not found.</p>
        <button type="button" className="btn-secondary" onClick={onBack}>
          <span className="material-symbols-outlined sm" aria-hidden="true">arrow_back</span>
          Back
        </button>
      </section>
    );
  }

  return (
    <section className="former-report">
      <header className="former-report-head">
        <button type="button" className="former-report-back" onClick={onBack}>
          <span className="material-symbols-outlined sm" aria-hidden="true">arrow_back</span>
          Former reports
        </button>
        <div className="former-report-stamp">
          <span className="material-symbols-outlined sm" aria-hidden="true">history</span>
          <span>Archived report · {report.publishedAt}</span>
        </div>
      </header>

      <Results results={report.results} elapsedSeconds={report.elapsedSeconds} />
    </section>
  );
}

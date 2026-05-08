import { useState } from 'react';

function ClaimEditor({ claim, onChange, onRemove }) {
  return (
    <div className="claim-editor" data-tier={claim.tier || 'main'}>
      <div className="claim-editor-head">
        <span className={`tier-badge tier-${claim.tier || 'main'}`}>
          {claim.tier === 'sub' ? 'Sub-claim' : 'Main claim'}
        </span>
        {claim.domain && <span className="claim-domain">{claim.domain}</span>}
        <button type="button" className="claim-remove" title="Remove this claim" onClick={onRemove}>
          &times;
        </button>
      </div>
      <textarea
        className="claim-text-input"
        rows={2}
        placeholder="Health claim to fact-check..."
        value={claim.text}
        onChange={(e) => onChange({ ...claim, text: e.target.value })}
      />
    </div>
  );
}

export default function ClaimReview({ initialClaims, onVerify }) {
  const [claims, setClaims] = useState(initialClaims);

  function updateClaim(index, updated) {
    setClaims((prev) => prev.map((c, i) => (i === index ? updated : c)));
  }

  function removeClaim(index) {
    setClaims((prev) => prev.filter((_, i) => i !== index));
  }

  function addClaim() {
    const hasMain = claims.some((c) => c.tier === 'main');
    setClaims((prev) => [...prev, { text: '', tier: hasMain ? 'sub' : 'main', language: 'en' }]);
  }

  function handleVerify() {
    const valid = claims.filter((c) => c.text.trim());
    if (valid.length === 0) return;
    onVerify(valid);
  }

  return (
    <section className="result">
      <div className="review-head">
        <h2>Review the claims to fact-check</h2>
        <p>
          The Manager identified <span id="claim-count">{claims.length}</span> claim(s).
          Edit, remove, or add to them — then verify.
        </p>
      </div>
      <div className="claim-editors">
        {claims.length === 0 ? (
          <p className="muted">
            The Manager didn&apos;t identify any health claim in this input. You can add one manually.
          </p>
        ) : (
          claims.map((c, i) => (
            <ClaimEditor
              key={i}
              claim={c}
              onChange={(updated) => updateClaim(i, updated)}
              onRemove={() => removeClaim(i)}
            />
          ))
        )}
      </div>
      <div className="review-actions">
        <button type="button" className="btn-secondary" onClick={addClaim}>+ Add claim</button>
        <button type="button" className="btn-primary" onClick={handleVerify}>
          Verify
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </section>
  );
}

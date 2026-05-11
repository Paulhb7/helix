import { useMemo, useRef, useState } from 'react';
import { useLinkPreview } from '../hooks/useLinkPreview';
import LinkPreview from './LinkPreview';
import SamplePrompts from './SamplePrompts';

const URL_RE = /^https?:\/\//i;

export default function CheckForm({ onSubmit, disabled }) {
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');
  const [claim, setClaim] = useState('');
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);
  const preview = useLinkPreview(tab === 'url' ? url : '');

  const detected = useMemo(() => {
    const u = url.toLowerCase();
    if (u.includes('youtu')) return { kind: 'youtube', label: 'YouTube' };
    if (u.includes('instagram')) return { kind: 'instagram', label: 'Instagram' };
    if (u.includes('tiktok')) return { kind: 'tiktok', label: 'TikTok' };
    if (u.startsWith('http')) return { kind: 'article', label: 'Article' };
    return null;
  }, [url]);

  const ready =
    !disabled &&
    ((tab === 'url' && url.trim().length > 6) ||
      (tab === 'text' && claim.trim().length > 12) ||
      (tab === 'image' && Boolean(file)));

  function submit(e) {
    e?.preventDefault();
    if (!ready) return;
    onSubmit({
      text: tab === 'url' ? url.trim() : tab === 'text' ? claim.trim() : '',
      file: tab === 'image' ? file : null,
    });
  }

  function handleSample(prompt) {
    if (URL_RE.test(prompt)) {
      setTab('url');
      setUrl(prompt);
    } else {
      setTab('text');
      setClaim(prompt);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (tab === 'url' || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  function handleFileChange(e) {
    setFile(e.target.files?.[0] || null);
  }

  function clearFile(e) {
    e?.stopPropagation();
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <section className="helix-check">
      <div className="helix-check-intro">
        <h1 className="helix-title">
          Before you believe, <em>let's verify together.</em>
        </h1>
        <p className="helix-intro">
          Paste the link to a video or article, or write down the claim you've read.
        </p>
        <p className="helix-intro">
          Helix isolates the central claim and cross-references each sub-claim against{' '}
          <em>the WHO</em>, <em>PubMed</em> and <em>Google Fact Check</em>.
        </p>
      </div>

      <form className="helix-card" onSubmit={submit}>
        <div className="helix-card-head">
          <div className="helix-tabs" role="tablist">
            <button
              type="button"
              className={`helix-tab ${tab === 'url' ? 'is-active' : ''}`}
              onClick={() => setTab('url')}
              role="tab"
              aria-selected={tab === 'url'}
            >
              <span className="material-symbols-outlined sm" aria-hidden="true">link</span>
              URL
            </button>
            <button
              type="button"
              className={`helix-tab ${tab === 'text' ? 'is-active' : ''}`}
              onClick={() => setTab('text')}
              role="tab"
              aria-selected={tab === 'text'}
            >
              <span className="material-symbols-outlined sm" aria-hidden="true">edit_note</span>
              Written claim
            </button>
            <button
              type="button"
              className={`helix-tab ${tab === 'image' ? 'is-active' : ''}`}
              onClick={() => setTab('image')}
              role="tab"
              aria-selected={tab === 'image'}
            >
              <span className="material-symbols-outlined sm" aria-hidden="true">image</span>
              Screenshot
            </button>
          </div>
          <div className="helix-sources-accepted" aria-hidden="true">
            <span className="material-symbols-outlined sm">smart_display</span>
            <span className="material-symbols-outlined sm">photo_camera</span>
            <span className="material-symbols-outlined sm">music_note</span>
            <span className="material-symbols-outlined sm">article</span>
            <span className="helix-sources-accepted-label">Accepted sources</span>
          </div>
        </div>

        {tab === 'url' && (
          <div className="helix-stack">
            <div className="helix-input-wrap">
              <input
                className="helix-input"
                type="url"
                placeholder="https://www.tiktok.com/@drclaim/video/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                style={detected ? { paddingLeft: 130 } : undefined}
                aria-label="Video or article URL"
              />
              {detected && (
                <span className="helix-detect-chip">
                  <span className="material-symbols-outlined sm" aria-hidden="true">check_circle</span>
                  {detected.label}
                </span>
              )}
            </div>
            {preview.status !== 'idle' && (
              <LinkPreview
                status={preview.status}
                data={preview.data}
                error={preview.error}
                url={preview.url}
              />
            )}
            <span className="helix-help">
              Helix transcribes the video, isolates the medical claims and returns a verdict in ~12 s.
            </span>
          </div>
        )}

        {tab === 'text' && (
          <div className="helix-stack">
            <textarea
              className="helix-input helix-textarea"
              rows={3}
              placeholder="“Magnesium cures anxiety in two weeks.”"
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Claim to verify"
            />
            <span className="helix-help">
              Quote the sentence verbatim — Helix breaks it down into sub-claims.
            </span>
          </div>
        )}

        {tab === 'image' && (
          <div className="helix-stack">
            <button
              type="button"
              className="helix-file-drop"
              onClick={() => fileRef.current?.click()}
              aria-label="Upload a screenshot"
            >
              {file ? (
                <span className="helix-file-attached">
                  <span className="material-symbols-outlined sm" aria-hidden="true">image</span>
                  <span className="helix-file-name">{file.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="helix-file-remove"
                    onClick={clearFile}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && clearFile(e)}
                    aria-label="Remove screenshot"
                  >
                    <span className="material-symbols-outlined sm" aria-hidden="true">close</span>
                  </span>
                </span>
              ) : (
                <span className="helix-file-empty">
                  <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
                  Upload a screenshot
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileChange}
            />
            <span className="helix-help">
              Helix reads the text in the screenshot to extract the claim.
            </span>
          </div>
        )}

        <div className="helix-card-foot">
          <span className="helix-source-dots" aria-label="Sources consulted">
            <span className="helix-dot">
              <i />
              WHO
            </span>
            <span className="helix-dot">
              <i />
              PubMed
            </span>
            <span className="helix-dot">
              <i />
              Google Fact Check
            </span>
          </span>
          <button type="submit" className="helix-launch" disabled={!ready}>
            {disabled ? (
              <span className="composer-spinner" aria-hidden="true" />
            ) : (
              <>
                Run analysis
                <span className="material-symbols-outlined sm" aria-hidden="true">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </form>

      <SamplePrompts onSelect={handleSample} />
    </section>
  );
}

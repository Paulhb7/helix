import { useRef, useState } from 'react';
import { useLinkPreview } from '../hooks/useLinkPreview';
import LinkPreview from './LinkPreview';
import SamplePrompts from './SamplePrompts';

export default function CheckForm({ onSubmit, disabled }) {
  const [input, setInput] = useState('');
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const preview = useLinkPreview(input);

  function handleSample(prompt) {
    setInput(prompt);
    textareaRef.current?.focus({ preventScroll: true });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const file = fileRef.current?.files[0];
    onSubmit({ text: input.trim(), file });
  }

  return (
    <section className="chooser single">
      <form className="card card-unified" onSubmit={handleSubmit}>
        <div className="card-head">
          <h2>Drop anything in</h2>
          <p>
            A health claim, a question, an article URL, a YouTube link, or a TikTok URL.
            Beacon picks the right tool, identifies the key claims, and cross-references
            them against PubMed, the WHO, and the global fact-checking network before you share.
          </p>
        </div>
        <label className="field">
          <span>Text or URL</span>
          <textarea
            ref={textareaRef}
            rows="3"
            placeholder={'e.g. Drinking lemon water cures stage IV cancer.\nor https://www.tiktok.com/@...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <SamplePrompts onSelect={handleSample} />
        {preview.status !== 'idle' && (
          <LinkPreview
            status={preview.status}
            data={preview.data}
            error={preview.error}
            url={preview.url}
          />
        )}
        <div className="card-foot">
          <button type="submit" className="btn-primary" disabled={disabled}>
            Check
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
        <details className="more">
          <summary>Add a screenshot instead</summary>
          <input ref={fileRef} type="file" accept="image/*" />
        </details>
      </form>
    </section>
  );
}

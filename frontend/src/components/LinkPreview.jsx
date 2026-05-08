function hostnameFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function LinkPreview({ status, data, error, url }) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="link-preview is-loading">
        <div className="preview-meta">
          <span className="preview-kicker">Link preview</span>
          <p className="preview-title">{hostnameFor(url)}</p>
          <p className="preview-desc">Fetching page details...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="link-preview is-error">
        <div className="preview-meta">
          <span className="preview-kicker">Preview unavailable</span>
          <p className="preview-title">{hostnameFor(url)}</p>
          <p className="preview-desc">{error || 'Beacon can still analyze this link.'}</p>
        </div>
      </div>
    );
  }

  const finalUrl = data.final_url || data.url;

  return (
    <div className="link-preview">
      {data.image ? (
        <div className="preview-media">
          <img src={data.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => e.target.parentElement.remove()} />
        </div>
      ) : (
        <div className="preview-media preview-fallback">
          <span>{hostnameFor(finalUrl).slice(0, 1).toUpperCase() || 'L'}</span>
        </div>
      )}
      <div className="preview-meta">
        <span className="preview-kicker">{data.site_name || hostnameFor(finalUrl)}</span>
        <p className="preview-title">{data.title || hostnameFor(finalUrl)}</p>
        {data.description && <p className="preview-desc">{data.description}</p>}
        <span className="preview-url">{hostnameFor(finalUrl)}</span>
      </div>
    </div>
  );
}

const headers = { 'Content-Type': 'application/json' };

export async function ingest({ text, url, image_b64 }) {
  const body = {};
  if (url) body.url = url;
  if (text) body.text = text;
  if (image_b64) body.image_b64 = image_b64;

  const r = await fetch('/ingest', { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function runCheck({ text, url, image_b64 }) {
  const body = {};
  if (url) body.url = url;
  if (text) body.text = text;
  if (image_b64) body.image_b64 = image_b64;

  const r = await fetch('/check', { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function fetchLinkPreview(url, signal) {
  const r = await fetch('/preview', {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
    signal,
  });
  if (!r.ok) {
    let detail = 'Helix can still analyze this link.';
    try {
      const payload = await r.json();
      detail = payload.detail || detail;
    } catch {
      detail = (await r.text()) || detail;
    }
    throw new Error(detail);
  }
  return r.json();
}

export async function fetchMode() {
  const r = await fetch('/mode');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

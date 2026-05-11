import { useEffect, useRef, useState } from 'react';
import { fetchLinkPreview } from '../api/helix';

const URL_RE = /https?:\/\/[^\s<>"']+/i;
const DEBOUNCE_MS = 450;

function extractUrl(value) {
  const match = value.match(URL_RE);
  if (!match) return '';
  return match[0].replace(/[),.;!?]+$/, '');
}

function hostnameFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function useLinkPreview(inputValue) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null, url: '' });
  const timerRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    const url = extractUrl(inputValue.trim());

    if (!url) {
      setState({ status: 'idle', data: null, error: null, url: '' });
      return;
    }

    if (url === state.url && state.status !== 'idle') return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (controllerRef.current) controllerRef.current.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setState({ status: 'loading', data: null, error: null, url });

      try {
        const data = await fetchLinkPreview(url, controller.signal);
        setState({ status: 'success', data, error: null, url });
      } catch (err) {
        if (err.name === 'AbortError') return;
        setState({ status: 'error', data: null, error: err.message, url });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [inputValue]);

  return { ...state, hostnameFor };
}

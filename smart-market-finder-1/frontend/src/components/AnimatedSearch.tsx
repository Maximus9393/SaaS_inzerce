import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onSearch: (params: { q?: string; keywords?: string; location?: string }) => void;
  children?: React.ReactNode;
  loading?: boolean;
  autofocus?: boolean;
};

export default function AnimatedSearch(props: Props) {
  const { onSearch, children, loading = false, autofocus = false } = props;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [keywords, setKeywords] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [done, setDone] = useState(false);
  const debRef = useRef<number | null>(null);
  const timeouts = useRef<number[]>([]);

  // helper to update the input width based on span measurement
  function resizeForText(text?: string) {
    if (!spanRef.current || !inputRef.current) return;
    const parentWidth = rootRef.current?.parentElement?.clientWidth || window.innerWidth;
    spanRef.current.textContent = (text === undefined || text === '') ? ' ' : text;
    const measured = Math.ceil(spanRef.current.offsetWidth) + 16; // add small padding
    const minW = 40; // very small collapsed state
    // make the input readable while not exceeding available space
    const maxW = Math.max(240, Math.min(parentWidth - 120, 900));
    const w = Math.min(Math.max(measured, minW), maxW);
    inputRef.current.style.width = w + 'px';
  }

  useEffect(() => { resizeForText(keywords); }, [keywords]);

  // ensure initial sizing on mount using placeholder as a hint
  useEffect(() => {
    try { resizeForText(inputRef.current?.placeholder || keywords); } catch (e) {}
  }, []);

  // autofocus and shortcut: focus input on mount or when user presses '/'
  useEffect(() => {
    if (autofocus && inputRef.current) inputRef.current.focus();
    function onKey(e: KeyboardEvent) {
      // ignore if typing in inputs or modifiers used
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [autofocus]);

  // handle Escape globally to reset when focused
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        reset();
      }
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);

  useEffect(() => {
    return () => {
      // clear any pending timeouts on unmount
      timeouts.current.forEach(t => clearTimeout(t));
      timeouts.current = [];
    };
  }, []);

  // timed animation sequence approximating the original
  function startAnimate() {
    if (preparing) return;
    setPreparing(true);
    setExpanded(true);
    // minimal, class-driven animation: set animating then done and call onSearch
    const t1 = window.setTimeout(() => {
      setAnimating(true);
      const t2 = window.setTimeout(() => {
        setDone(true);
        setPreparing(false);
        setAnimating(false);
        try { onSearch({ q: keywords }); } catch (e) { /* ignore */ }
      }, 300);
      timeouts.current.push(t2);
    }, 150);
    timeouts.current.push(t1);
  }

  // expand immediately on focus/click without the full timed sequence
  function expandImmediate() {
  // Only toggle the expanded state; visual expansion is handled by CSS
  setExpanded(true);
  }

  function reset() {
  setPreparing(false);
  setExpanded(false);
  setAnimating(false);
  setDone(false);
    if (barRef.current) { barRef.current.style.width = ''; }
    if (rootRef.current) { rootRef.current.style.height = ''; }
    setKeywords('');
    if (inputRef.current) inputRef.current.focus();
  }

  function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!preparing) startAnimate();
  }

  // debounce keywords and call onSearch while typing
  React.useEffect(() => {
    if (debRef.current) window.clearTimeout(debRef.current);
    // don't call search for empty keywords immediately
    debRef.current = window.setTimeout(() => {
      try { onSearch({ q: keywords }); } catch (e) { /* ignore */ }
    }, 350);
    return () => { if (debRef.current) window.clearTimeout(debRef.current); };
  }, [keywords, onSearch]);

  const className = [preparing ? 'prepare' : '', animating ? 'animate' : '', done ? 'done' : '', expanded ? 'expanded' : ''].filter(Boolean).join(' ');
  return (
    <div className={`animated-search ${className}`} ref={rootRef} role="search" aria-expanded={expanded}>
      <div className="bar" ref={barRef}>
        <button
          type="button"
          className="icon"
          aria-label="Focus search"
          onClick={() => {
            if (inputRef.current) inputRef.current.focus();
            // if there's text, trigger a submit/search visual
            if ((keywords || '').trim().length > 0) submit();
          }}
        ><i /></button>
      </div>
      <form onSubmit={submit}>
        <input
          className="search-input"
          ref={inputRef}
          type="text"
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          onFocus={() => { /* keep compact by default; expand only when user types */ }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') reset();
          }}
          placeholder="Hledat (např. Octavia, BMW)"
          aria-label="Hledat inzeráty"
        />
        {/* hidden span used for precise measurement (moved offscreen to reliably measure width) */}
        <span
          aria-hidden
          ref={spanRef}
          style={{
            position: 'absolute',
            left: -9999,
            top: -9999,
            visibility: 'hidden',
            display: 'inline-block',
            whiteSpace: 'pre',
            // ensure measurements match the input font/weight
            font: 'inherit',
            fontSize: '14px',
            fontWeight: 500,
          }}
        />
        {/* inline spinner while loading */}
        {loading ? <div className="inline-spinner" aria-hidden /> : null}
      </form>
      <div className="close" onClick={reset} role="button" aria-label="Close" />
  <div className="results-panel" ref={listRef} style={{ display: (keywords || '').trim().length > 0 ? undefined : 'none' }}>
        {children}
      </div>
    </div>
  );
}

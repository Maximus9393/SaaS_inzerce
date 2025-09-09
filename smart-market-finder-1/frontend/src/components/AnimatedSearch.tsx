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
    if (!rootRef.current || !barRef.current || preparing) return;
    setPreparing(true);
    setExpanded(true);
    // mark submit briefly
    // schedule removals/additions using tracked timeouts
    const t1 = window.setTimeout(() => {
      // remove submit visual after short delay
    }, 200);
    timeouts.current.push(t1);

    const t2 = window.setTimeout(() => {
      setAnimating(true);
      // expand the bar width (approx animation)
  if (barRef.current && rootRef.current) {
        const parentWidth = rootRef.current.parentElement ? rootRef.current.parentElement.clientWidth : window.innerWidth;
        // desired width based on results list or a sensible base
        const desired = Math.max((listRef.current ? listRef.current.scrollWidth + 32 : 320), 240);
        // cap expansion to available space with an upper bound
        const maxBar = Math.max(320, Math.min(parentWidth - 96, 900));
        const finalW = Math.min(desired, maxBar);
        barRef.current.style.width = finalW + 'px';
      }

      // after bar animation, expand container height to reveal results
      const t3 = window.setTimeout(() => {
        if (rootRef.current && listRef.current) {
          rootRef.current.style.height = (rootRef.current.offsetHeight + listRef.current.offsetHeight) + 'px';
        }
        const t4 = window.setTimeout(() => {
          setDone(true);
          setPreparing(false);
          setAnimating(false);
          // notify parent to perform search
          try { onSearch({ q: keywords }); } catch (e) { /* ignore */ }
        }, 200);
        timeouts.current.push(t4);
      }, 800);
      timeouts.current.push(t3);

    }, 1250);
    timeouts.current.push(t2);
  }

  // expand immediately on focus/click without the full timed sequence
  function expandImmediate() {
    if (!rootRef.current || !barRef.current) return;
    setExpanded(true);
    // set bar width to fit results or a sensible default
    const parentWidth = rootRef.current.parentElement ? rootRef.current.parentElement.clientWidth : window.innerWidth;
    const desired = Math.max((listRef.current ? listRef.current.scrollWidth + 32 : 320), 240);
    const maxBar = Math.max(320, Math.min(parentWidth - 96, 900));
    const finalW = Math.min(desired, maxBar);
    barRef.current.style.width = finalW + 'px';
    // expand container height to show results if any
    if (listRef.current) {
      rootRef.current.style.height = (rootRef.current.offsetHeight + listRef.current.offsetHeight) + 'px';
    }
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
        <div className="icon"><i /></div>
      </div>
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          type="text"
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          onFocus={() => expandImmediate()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') reset();
          }}
          placeholder="Hledat (např. Octavia, BMW)"
        />
        {/* hidden span used for precise measurement (moved offscreen to reliably measure width) */}
        <span aria-hidden ref={spanRef} style={{ position: 'absolute', left: -9999, top: -9999, visibility: 'hidden', display: 'inline-block', whiteSpace: 'pre' }} />
        {/* inline spinner while loading */}
        {loading ? <div className="inline-spinner" aria-hidden /> : null}
      </form>
      <div className="close" onClick={reset} role="button" aria-label="Close" />
      <div className="results-panel" ref={listRef} style={{ display: expanded ? undefined : 'none' }}>
        {children}
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onSearch: (params: { keywords?: string; location?: string }) => void;
  children?: React.ReactNode;
};

export default function AnimatedSearch({ onSearch, children }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [cls, setCls] = useState<string>('');
  const [keywords, setKeywords] = useState('');
  const [preparing, setPreparing] = useState(false);

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

  useEffect(() => {
    return () => { /* cleanup timeouts by resetting class */ setCls(''); };
  }, []);

  // timed animation sequence approximating the original
  function startAnimate() {
    if (!rootRef.current || !barRef.current || preparing) return;
    setPreparing(true);
    setCls('prepare submit');
    // remove submit quickly
    setTimeout(() => setCls('prepare'), 200);

    setTimeout(() => {
      setCls(c => (c + ' animate').trim());
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
      setTimeout(() => {
        if (rootRef.current && listRef.current) {
          rootRef.current.style.height = (rootRef.current.offsetHeight + listRef.current.offsetHeight) + 'px';
        }
        setTimeout(() => {
          setCls(c => (c + ' done').trim());
          // notify parent to perform search
          try { onSearch({ keywords }); } catch (e) { /* ignore */ }
        }, 200);
      }, 800);

    }, 1250);
  }

  function reset() {
    setCls('');
    setPreparing(false);
    if (barRef.current) { barRef.current.style.width = ''; }
    if (rootRef.current) { rootRef.current.style.height = ''; }
    setKeywords('');
    if (inputRef.current) inputRef.current.focus();
  }

  function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!cls.includes('prepare')) startAnimate();
  }

  return (
    <div className={`animated-search ${cls}`} ref={rootRef} style={{ width: 92 }}>
      <div className="bar" ref={barRef}>
        <div className="icon"><i /></div>
      </div>
      <form onSubmit={submit}>
        <input ref={inputRef} type="text" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="Hledat (např. Octavia, BMW)" />
        <span ref={spanRef} style={{ display: 'none', whiteSpace: 'pre' }} />
      </form>
      <div className="close" onClick={reset} role="button" aria-label="Close" />
      <div className="results-panel" ref={listRef}>
        {children}
      </div>
    </div>
  );
}

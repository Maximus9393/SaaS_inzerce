import React from 'react';

type Item = {
  title?: string;
  // price can be a parsed number (from backend) or a raw string
  price?: string | number;
  location?: string;
  url?: string;
  date?: string;
  description?: string;
  thumbnail?: string;
  images?: string[];
};

export default function ResultsList({ results = [] }: { results?: Item[] }) {
  if (!results || results.length === 0) return (
    <div className="no-results">
      <p>Žádné inzeráty aut nebyly nalezeny.</p>
    </div>
  );
  return (
    <div className="results-grid">
      {results.map((it, idx) => (
        <article key={(it.url && it.url) || `item-${idx}`} className="card card-grid">
            <div className="card-media">
              {(() => {
                // prefer images array first
                if (Array.isArray(it.images) && it.images.length) {
                  try {
                    let s0 = it.images[0] || '';
                    try { s0 = new URL(s0, it.url || window.location.href).href; } catch { /* keep as-is */ }
                    return <img src={s0} alt={it.title || 'thumbnail'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />;
                  } catch (e) { /* ignore and fallback */ }
                }
                // then explicit thumbnail
                if (it.thumbnail) return <img src={it.thumbnail} alt={it.title || 'thumbnail'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />;
                // try to extract first image URL from HTML description using DOMParser for safety
                if (it.description) {
                  try {
                    const dp = new DOMParser();
                    const doc = dp.parseFromString(String(it.description), 'text/html');
                    const img = doc.querySelector('img');
                    if (img && img.getAttribute('src')) {
                      let src = img.getAttribute('src') || '';
                      try { src = new URL(src, it.url || window.location.href).href; } catch { /* keep original src */ }
                      return <img src={src} alt={it.title || 'thumbnail'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />;
                    }
                  } catch (e) {
                    // ignore
                  }
                }
                // fallback avatar placeholder
                return <div className="thumb">{it.title ? it.title.charAt(0).toUpperCase() : 'A'}</div>;
              })()}
            </div>
          <div className="card-body">
            <div className="card-header">
              {it.url ? (
                <a className="card-title" href={it.url} target="_blank" rel="noopener noreferrer">{it.title}</a>
              ) : (
                <span className="card-title">{it.title}</span>
              )}
              <div className="price-badge">{(() => {
                const p = it.price;
                // friendly fallback text when price is not present
                const noPrice = 'Cena neuvedena';
                if (p == null) return noPrice;
                // if backend provided numeric price, format with thousands and currency
                if (typeof p === 'number') {
                  if (p <= 0) return noPrice;
                  return new Intl.NumberFormat('cs-CZ').format(p) + ' Kč';
                }
                // string fallback: show raw string if it already contains currency
                const s = String(p || '').trim();
                if (!s) return noPrice;
                if (/kč|kc|czk/i.test(s)) return s;
                // accept bare numeric strings and format them if they contain digits
                const digits = Number(s.replace(/[^0-9]/g, '')) || 0;
                if (digits > 0) return new Intl.NumberFormat('cs-CZ').format(digits) + ' Kč';
                // as a last resort, show the original string so it's not silently hidden
                return s || noPrice;
              })()}</div>
            </div>
            <div className="card-meta">
              <span>{it.location}</span>
              {typeof (it as any).distance === 'number' ? (
                <span style={{ marginLeft: 12, color: '#666', fontSize: 12 }}>{Number(((it as any).distance || 0)).toFixed(1)} km</span>
              ) : null}
            </div>
            {it.description ? <p className="card-desc">{it.description}</p> : null}
            <div className="card-actions">
              {it.url ? (
                <a className="button" href={it.url} target="_blank" rel="noopener noreferrer">Zobrazit</a>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

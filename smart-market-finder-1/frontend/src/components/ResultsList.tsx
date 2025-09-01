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
            {it.thumbnail ? (
              <img src={it.thumbnail} alt={it.title || 'thumbnail'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div className="thumb">{it.title ? it.title.charAt(0).toUpperCase() : 'A'}</div>
            )}
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
                if (p == null) return '';
                // if backend provided numeric price, format with thousands and currency
                if (typeof p === 'number') {
                  if (p <= 0) return '';
                  return new Intl.NumberFormat('cs-CZ').format(p) + ' Kč';
                }
                // string fallback: show only if it contains explicit currency token or a reasonable number
                const s = String(p || '').trim();
                if (!s) return '';
                if (/kč|kc|czk/i.test(s)) return s;
                // accept bare numeric strings >= 10000
                const digits = Number(s.replace(/[^0-9]/g, '')) || 0;
                if (digits >= 10000) return new Intl.NumberFormat('cs-CZ').format(digits) + ' Kč';
                return '';
              })()}</div>
            </div>
            <div className="card-meta">{it.location}</div>
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

import React from 'react';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';
import formatPrice from '../utils/formatPrice';
import DOMPurify from 'dompurify';

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

export default function ResultsList({ results = [], loading = false }: { results?: Item[]; loading?: boolean }) {
  if (loading) return <Spinner><div style={{ minHeight: 200 }} /></Spinner>;
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
                // navigate to our internal listing detail page and pass the item via router state
                <Link className="card-title" to={`/listing?url=${encodeURIComponent(String(it.url || ''))}`} state={{ item: it }}>{it.title}</Link>
              ) : (
                <span className="card-title">{it.title}</span>
              )}
              <div className="price-badge">{formatPrice(it.price)}</div>
            </div>
            <div className="card-meta">
              <span>{it.location}</span>
              {typeof (it as any).distance === 'number' ? (
                <span style={{ marginLeft: 12, color: '#666', fontSize: 12 }}>{Number(((it as any).distance || 0)).toFixed(1)} km</span>
              ) : null}
            </div>
            {it.description ? (
              // if description looks like HTML, sanitize and render; otherwise show plain text
              /<\/?[a-z][\s\S]*>/i.test(String(it.description || '')) ? (
                <div className="card-desc" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(it.description || '')) }} />
              ) : (
                <p className="card-desc">{it.description}</p>
              )
            ) : null}
            <div className="card-actions">
              {it.url ? (
                <>
                  <Link className="button" to={`/listing?url=${encodeURIComponent(String(it.url || ''))}`} state={{ item: it }}>Zobrazit</Link>
                  <a className="button button-ghost" href={it.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>Zdroj</a>
                </>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

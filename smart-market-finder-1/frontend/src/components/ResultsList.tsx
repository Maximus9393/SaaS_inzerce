import React from 'react';

type Item = {
  title?: string;
  price?: string;
  location?: string;
  url?: string;
  date?: string;
  description?: string;
};

export default function ResultsList({ results = [] }: { results?: Item[] }) {
  if (!results || results.length === 0) return <div>No results yet.</div>;
  return (
    <div className="results-grid">
      {results.map((it, idx) => (
        <article key={it.url || idx} className="card card-grid">
          <div className="card-media">
            {/* Placeholder image; could be replaced with thumbnail if available */}
            <div className="thumb">{it.title ? it.title.charAt(0).toUpperCase() : 'I'}</div>
          </div>
          <div className="card-body">
            <div className="card-header">
              <a className="card-title" href={it.url} target="_blank" rel="noreferrer">{it.title}</a>
              <div className="price-badge">{it.price && it.price.length > 0 ? it.price : 'N/A'}</div>
            </div>
            <div className="card-meta">{it.location} {it.date ? `— ${new Date(it.date).toLocaleString()}` : ''}</div>
            {it.description ? <p className="card-desc">{it.description}</p> : null}
            <div className="card-actions">
              <a className="button" href={it.url} target="_blank" rel="noreferrer">Zobrazit</a>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

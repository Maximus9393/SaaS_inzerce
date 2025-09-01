import React, { useState } from 'react';
import axios from 'axios';

type Props = {
  onSearch: (params: { keywords?: string; location?: string; filterMethod?: string; strictLocation?: boolean }) => void;
};

export default function SearchForm({ onSearch }: Props) {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState<{ code: string; city: string; label: string }[]>([]);
  const [selectedPostal, setSelectedPostal] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // For car-only UI we accept city names or PSČ; prefer selectedPostal when chosen.
    // If user typed a city name and didn't pick a suggestion, prefer the top suggestion's 3-digit prefix
    const q = location.trim();
    let loc = selectedPostal || q;
    if (q && !/^[0-9]/.test(q) && (!selectedPostal || selectedPostal === '')) {
      // non-numeric input: if suggestions exist, use the first suggestion's 3-digit prefix
      if (suggestions && suggestions.length > 0) {
        const first = suggestions[0];
        if (first && first.code) loc = String(first.code).slice(0, 3);
      }
    }
    onSearch({ keywords, location: loc });
  }

  // fetch suggestions when user types
  React.useEffect(() => {
    const q = location.trim();
    setSelectedPostal(null);
    if (!q) { setSuggestions([]); return; }
  const id = setTimeout(async () => {
      try {
        const res = await axios.get('/api/suggest/postal', { params: { q } });
    if (res && res.data && Array.isArray(res.data.suggestions)) setSuggestions(res.data.suggestions);
      } catch (e) {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [location]);

  return (
    <form className="search-form" onSubmit={submit}>
      <div className="search-row">
  <input className="search-input" placeholder="Zadejte značku nebo model auta (např. Octavia, BMW 320d)" value={keywords} onChange={e => setKeywords(e.target.value)} />
        <div style={{ position: 'relative', flex: 1 }}>
          <input className="search-input" placeholder="Město nebo PSČ (např. Praha, 10000)" value={location} onChange={e => setLocation(e.target.value)} />
          {suggestions && suggestions.length > 0 ? (
            (() => {
              const q = location.trim();
              let display = suggestions;
              if (/^\d+$/.test(q)) {
                // numeric input: sort by numeric code and limit to 8
                display = [...suggestions].filter(s => /^\d+$/.test(String(s.code))).sort((a,b)=>Number(a.code)-Number(b.code)).slice(0,8);
              } else {
                // city-name input: show up to 8 representative PSČ suggestions
                display = display.slice(0,8);
              }
              return (
                <div style={{ position: 'absolute', left: 0, right: 0, top: '44px', background: 'var(--surface)', border: '1px solid #eee', borderRadius: 8, boxShadow: 'var(--shadow-sm)', zIndex: 40, maxHeight: '320px', overflowY: 'auto' }}>
                  {display.map(s => (
                    <div key={s.code} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => { setSelectedPostal(s.code); setLocation(s.label); setSuggestions([]); }}>
                      <div>{s.label}</div>
                      <div style={{ color: '#888', fontSize: 12 }}>{s.city}</div>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : null}
  </div>
        <div style={{ width: 140 }} />
      </div>
      <div className="search-row search-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
          <div style={{ color: '#666', fontSize: 12 }}>{selectedPostal ? `Selected PSČ: ${selectedPostal}` : 'Zadejte město nebo PSČ (doporučeno)'}</div>
          {/* Enable the search button for car queries — require at least a keyword */}
          <button className="button primary" type="submit">Hledat auta</button>
        </div>
      </div>
    </form>
  );
}

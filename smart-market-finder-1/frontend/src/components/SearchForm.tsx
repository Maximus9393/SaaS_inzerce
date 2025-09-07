import React, { useState } from 'react';
import axios from 'axios';

type Props = {
  onSearch: (params: { keywords?: string; location?: string; filterMethod?: string; strictLocation?: boolean; sort?: string; order?: string; originPostal?: string; originLat?: number; originLon?: number }) => void;
};

export default function SearchForm({ onSearch }: Props) {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState<{ code: string; city: string; label: string }[]>([]);
  const [selectedPostal, setSelectedPostal] = useState<string | null>(null);
  const [sort, setSort] = useState<'date'|'price'|'km'|'distance'>('date');
  const [order, setOrder] = useState<'desc'|'asc'>('desc');
  const [originPostal, setOriginPostal] = useState<string>('');
  const [originLat, setOriginLat] = useState<number|undefined>(undefined);
  const [originLon, setOriginLon] = useState<number|undefined>(undefined);

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
  const payload: any = { keywords, location: loc, sort, order };
  if (selectedPostal) payload.originPostal = selectedPostal;
  if (originPostal) payload.originPostal = originPostal;
  if (originLat !== undefined && originLon !== undefined) { payload.originLat = originLat; payload.originLon = originLon; }
  onSearch(payload);
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
                display = [...suggestions].filter(s => /^\d+$/.test(String(s.code))).sort((a,b)=>Number(a.code)-Number(b.code)).slice(0,8);
              } else {
                display = display.slice(0,8);
              }
              return (
                <div className="postal-suggestions">
                  {display.map(s => (
                    <div key={s.code} className="postal-item" onClick={() => { setSelectedPostal(s.code); setLocation(s.label); setSuggestions([]); }}>
                      <div>{s.label}</div>
                      <div className="muted">{s.city}</div>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : null}
  </div>
  <div className="search-side" />
      </div>
      <div className="search-row search-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
          <div style={{ color: '#666', fontSize: 12 }}>{selectedPostal ? `Selected PSČ: ${selectedPostal}` : (originPostal ? `Origin PSČ: ${originPostal}` : 'Zadejte město nebo PSČ (doporučeno)')}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={sort} onChange={e => setSort(e.target.value as any)}>
              <option value="date">Nejnovější</option>
              <option value="price">Nejlevnější / Nejdražší</option>
              <option value="km">Nejnižší nájezd (km)</option>
              <option value="distance">Vzdálenost</option>
            </select>
            <button type="button" className="button" onClick={() => setOrder(o => o === 'desc' ? 'asc' : 'desc')}>{order === 'desc' ? '↓' : '↑'}</button>
          </div>
          {sort === 'distance' ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input placeholder="Origin PSČ (volitelné)" value={originPostal} onChange={e => setOriginPostal(e.target.value)} style={{ width: 140 }} />
              <button type="button" className="button" onClick={() => {
                if (!navigator.geolocation) return alert('Geolokace není dostupná');
                navigator.geolocation.getCurrentPosition(pos => {
                  setOriginLat(pos.coords.latitude); setOriginLon(pos.coords.longitude); setOriginPostal('');
                }, () => alert('Nelze získat polohu'))
              }}>Použít moji polohu</button>
            </div>
          ) : null}
          {/* Enable the search button for car queries — require at least a keyword */}
          <button className="button primary" type="submit">Hledat auta</button>
        </div>
      </div>
    </form>
  );
}

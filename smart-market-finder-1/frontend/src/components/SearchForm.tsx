import React, { useState } from 'react';

type Props = {
  onSearch: (params: { keywords?: string; location?: string; filterMethod?: string; strictLocation?: boolean }) => void;
};

export default function SearchForm({ onSearch }: Props) {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [method, setMethod] = useState('dedupe');
  const [strict, setStrict] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSearch({ keywords, location, filterMethod: method, strictLocation: strict });
  }

  return (
    <form className="search-form" onSubmit={submit}>
      <div className="search-row">
        <input className="search-input" placeholder="Co hledáte (např. Octavia, iPhone)" value={keywords} onChange={e => setKeywords(e.target.value)} />
        <input className="search-input" placeholder="Lokace (město nebo PSČ)" value={location} onChange={e => setLocation(e.target.value)} />
        <select className="search-select" value={method} onChange={e => setMethod(e.target.value)}>
          <option value="dedupe">Dedupe</option>
          <option value="random">Random</option>
          <option value="relevance">Relevance</option>
        </select>
      </div>
      <div className="search-row search-controls">
        <label className="checkbox-inline">
          <input type="checkbox" checked={strict} onChange={e => setStrict(e.target.checked)} />
          <span> Přesná lokalita</span>
        </label>
        <button className="button primary" type="submit">Hledat</button>
      </div>
    </form>
  );
}

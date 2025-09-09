import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import formatPrice from '../utils/formatPrice';

export default function ListingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateItem = (location && (location.state as any) && (location.state as any).item) || null;
  const [item, setItem] = React.useState<any>(stateItem);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (item) return; // already have data from state
    // try to read ?url=... from location.search
    const params = new URLSearchParams(location.search || '');
    const url = params.get('url');
    const id = params.get('id');
    if (!url && !id) return;
    (async () => {
      setLoading(true);
      try {
        const q = url ? `?url=${encodeURIComponent(url)}` : `?id=${encodeURIComponent(String(id || ''))}`;
        const res = await axios.get(`/api/listing${q}`);
        if (res && res.data && res.data.ok && res.data.result) setItem(res.data.result);
      } catch (e) {
        // ignore
      } finally { setLoading(false); }
    })();
  }, [item, location.search]);

  if (!item && !loading) {
    return (
      <div className="container minimal-center">
        <h2>Inzerát nenalezen</h2>
        <p>Žádné informace o inzerátu nebyly předány. Vraťte se na výsledky vyhledávání.</p>
        <button className="button" onClick={() => navigate(-1)}>Zpět</button>
      </div>
    );
  }

  const priceDisplay = formatPrice(item?.price);

  const renderDescription = () => {
    if (!item || !item.description) return <p>Popis není k dispozici.</p>;
    // sanitize HTML using DOMPurify in browser
    try {
      // dynamic import to avoid SSR issues
      // @ts-ignore
      const DOMPurify = (window as any).DOMPurify;
      if (DOMPurify) {
        const clean = DOMPurify.sanitize(item.description || '', { ADD_ATTR: ['target'] });
        return <div dangerouslySetInnerHTML={{ __html: clean }} />;
      }
    } catch (e) { /* ignore */ }
    return <div dangerouslySetInnerHTML={{ __html: item.description }} />;
  };

  return (
    <div className="container">
      <header className="app-header">
        <h1>{item?.title}</h1>
        <div style={{ marginTop: 8 }}>{priceDisplay}</div>
      </header>
      <div className="listing-grid">
        <aside className="listing-media">
          {Array.isArray(item?.images) && item.images.length ? (
            <img src={item.images[0]} alt={item.title} style={{ width: '100%', objectFit: 'cover' }} />
          ) : item?.thumbnail ? (
            <img src={item.thumbnail} alt={item.title} style={{ width: '100%', objectFit: 'cover' }} />
          ) : (
            <div className="thumb-large">{item?.title ? item.title.charAt(0).toUpperCase() : 'A'}</div>
          )}
        </aside>
        <section className="listing-body">
          <h3>Detaily</h3>
          <p><strong>Místo:</strong> {item?.location || 'Neuvedeno'}</p>
          {item?.postal ? <p><strong>PSČ:</strong> {item.postal}</p> : null}
          {item?.lat && item?.lon ? <p><strong>Souřadnice:</strong> {item.lat},{item.lon}</p> : null}
          <div style={{ marginTop: 12 }}>
            <h4>Popis</h4>
            {renderDescription()}
          </div>

          <div style={{ marginTop: 16 }}>
            <a className="button" href={item?.url} target="_blank" rel="noopener noreferrer">Přejít na zdrojový inzerát</a>
            <button className="button button-ghost" style={{ marginLeft: 8 }} onClick={() => navigate(-1)}>Zpět na výsledky</button>
          </div>
        </section>
      </div>
    </div>
  );
}

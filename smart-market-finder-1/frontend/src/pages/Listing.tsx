import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import formatPrice from '../utils/formatPrice';
import DOMPurify from 'dompurify';

export interface ListingItem {
  id: string;
  title: string;
  description?: string;
  price?: number;
  url?: string;
  images?: string[];
  thumbnail?: string;
  location?: string;
  postal?: string;
  lat?: number;
  lon?: number;
}

function useListing(initial?: ListingItem | null) {
  const [item, setItem] = React.useState<ListingItem | null>(initial || null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchByQuery = React.useCallback(async (q: { url?: string; id?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const query = q.url ? `?url=${encodeURIComponent(q.url)}` : `?id=${encodeURIComponent(String(q.id || ''))}`;
      const res = await axios.get(`/api/listing${query}`);
      if (res?.data?.ok && res.data.result) {
        setItem(res.data.result as ListingItem);
        return res.data.result as ListingItem;
      }
      setError('Inzerát nebyl nalezen.');
      return null;
    } catch (e: any) {
      setError(e?.message || 'Chyba při načítání inzerátu');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { item, setItem, loading, error, fetchByQuery };
}

const ListingMedia: React.FC<{ item?: ListingItem | null }> = ({ item }) => {
  const hasImages = Array.isArray(item?.images) && (item?.images?.length ?? 0) > 0;
  const src = hasImages ? item?.images?.[0] : item?.thumbnail;
  const fallback = '/assets/img/fallback-listing.png';
  return (
    <div className="listing-media-inner">
      <img
        src={src || fallback}
        alt={item?.title ? String(item.title) : 'Listing image'}
        loading="lazy"
        className="listing-main-image"
      />
    </div>
  );
};

const Description: React.FC<{ html?: string }> = ({ html }) => {
  if (!html) return <p>Popis není k dispozici.</p>;
  try {
    const clean = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
    return <div className="listing-description" dangerouslySetInnerHTML={{ __html: clean }} />;
  } catch (e) {
    // If sanitization unexpectedly fails, avoid rendering raw HTML.
    return <p>Popis nelze zobrazit.</p>;
  }
};

export default function ListingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateItem = (location.state as { item?: ListingItem })?.item || null;

  const { item, loading, error, fetchByQuery } = useListing(stateItem);

  React.useEffect(() => {
    if (item) return; // already have data from state
    const params = new URLSearchParams(location.search || '');
    const url = params.get('url') || undefined;
    const id = params.get('id') || undefined;
    if (!url && !id) return;
    fetchByQuery({ url, id });
  }, [item, location.search, fetchByQuery]);

  const priceDisplay = React.useMemo(() => formatPrice(item?.price), [item?.price]);

  if (loading) {
    return (
      <div className="container minimal-center">
        <div className="spinner-overlay"><div className="spinner" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container minimal-center">
        <h2>Chyba</h2>
        <p>{error}</p>
        <a className="button" href="/">Zpět na domovskou</a>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container minimal-center">
        <h2>Inzerát nenalezen</h2>
        <p>Žádné informace o inzerátu nebyly předány. Vraťte se na výsledky vyhledávání.</p>
        <a className="button" href="/results">Zpět na výsledky</a>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="app-header">
        <h1>{item.title}</h1>
        <div className="listing-price">{priceDisplay}</div>
      </header>
      <div className="listing-grid">
        <aside className="listing-media">
          <ListingMedia item={item} />
        </aside>
        <section className="listing-body">
          <h3>Detaily</h3>
          <p><strong>Místo:</strong> {item.location || 'Neuvedeno'}</p>
          {item.postal ? <p><strong>PSČ:</strong> {item.postal}</p> : null}
          {item.lat && item.lon ? <p><strong>Souřadnice:</strong> {item.lat},{item.lon}</p> : null}
          <div className="listing-description-wrap">
            <h4>Popis</h4>
            <Description html={item.description} />
          </div>

          <div className="listing-actions">
            <a className="button" href={item.url} target="_blank" rel="noopener noreferrer">Přejít na zdrojový inzerát</a>
            <button className="button button-ghost" onClick={() => navigate('/results')}>Zpět na výsledky</button>
          </div>
        </section>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import ResultsList from '../components/ResultsList';
import AnimatedSearch from '../components/AnimatedSearch';
import { getResults, triggerSearch } from '../services/api';

const Home: React.FC = () => {
    const [results, setResults] = useState<any[]>([]);
    const [visibleCount, setVisibleCount] = useState(10);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [loading, setLoading] = useState(false);
    const handleSearch = async (searchCriteria: any) => {
        setLoading(true);
        try {
            const payload = Object.assign({ limit: itemsPerPage }, searchCriteria);
            // show currently stored results immediately
            try { const cur = await getResults(); setResults(cur.results || cur || []); } catch (e) { /* ignore */ }
            // trigger backend search in background (short client timeout)
            try { triggerSearch(payload, 2000); } catch (e) { /* ignore */ }

            // Poll for up to 10s to see if stored results appeared/updated
            const deadline = Date.now() + 10000;
            while (Date.now() < deadline) {
                await new Promise(r => setTimeout(r, 1000));
                try {
                    const next = await getResults();
                    const resArr = next.results || next || [];
                    if (Array.isArray(resArr) && resArr.length) { setResults(resArr); break; }
                } catch (e) { /* ignore and continue polling */ }
            }
        } finally {
            setLoading(false);
        }
    };

    // do not load results on mount; results should appear only after an explicit search

    const loadMore = () => setVisibleCount(c => c + itemsPerPage);

    const onPerPageChange = (n: number) => {
        setItemsPerPage(n);
        setVisibleCount(n);
    };

    return (
        <div className="container minimal-center">
            <h1 style={{ margin: '8px 0 6px 0' }}>Vyhledávání</h1>
            <div className="search-wrap hero-search hero-center" style={{ width: '100%' }}>
                <AnimatedSearch onSearch={handleSearch} loading={loading} autofocus>
                    {results && results.length ? <ResultsList results={results} loading={loading} /> : null}
                </AnimatedSearch>
            </div>
        </div>
    );
};

export default Home;
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ResultsList from '../components/ResultsList';
import AnimatedSearch from '../components/AnimatedSearch';
import { getResults, triggerSearch } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

// --- Types -------------------------------------------------
export interface ResultItem {
    id: string;
    title: string;
    description?: string | null;
    price?: number | null;
    location?: string | null;
    url?: string;
    thumbnail?: string | null;
    images?: string[];
    [k: string]: any;
}

export type SearchCriteria = {
    q?: string;
    postal?: string;
    limit?: number;
    [k: string]: any;
};

const DEFAULT_PAGE_SIZE = 10;

const Home: React.FC = () => {
    const [results, setResults] = useState<ResultItem[]>([]);
    const [visibleCount, setVisibleCount] = useState(DEFAULT_PAGE_SIZE);
    const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);

    const [loading, setLoading] = useState(false); // searching
    const [loadingMore, setLoadingMore] = useState(false); // pagination
    const [announce, setAnnounce] = useState('');
    const [noResults, setNoResults] = useState(false);

    const pollRef = useRef<number | null>(null);
    const mountedRef = useRef(true);
    const lastResultsRef = useRef<string>(''); // JSON snapshot to compare

    const { setPageHero, setThemeDark } = useTheme();

    // Local type compatible with ResultsList's Item shape
    type CompatibleItem = {
        title?: string;
        price?: string | number;
        location?: string;
        url?: string;
        date?: string;
        description?: string;
        thumbnail?: string;
        images?: string[];
        [k: string]: any;
    };

    // helper: update results only when changed
    const updateResultsIfChanged = useCallback((next: ResultItem[]) => {
        try {
            const nextJSON = JSON.stringify(next || []);
            if (nextJSON !== lastResultsRef.current) {
                lastResultsRef.current = nextJSON;
                setResults(next);
            }
        } catch (e) {
            // fallback: set anyway
            setResults(next);
        }
    }, []);

    // fetch stored results from the API (fast, immediate)
    const fetchStoredResults = useCallback(async (criteria: SearchCriteria) => {
        try {
            // getResults doesn't accept criteria param in current API; call without args and rely on server-side stored state
            const stored = await getResults().catch((err) => {
                console.error('getResults failed', err);
                return { results: [] };
            });
            const resArr: ResultItem[] = (stored && (stored.results || stored)) || [];
            updateResultsIfChanged(resArr);
            setNoResults(!Array.isArray(resArr) || resArr.length === 0);
            return resArr;
        } catch (e) {
            console.error('fetchStoredResults error', e);
            setNoResults(true);
            return [] as ResultItem[];
        }
    }, [updateResultsIfChanged]);

    // trigger search on the backend (fire-and-forget with local timeout)
    const runSearch = useCallback(async (criteria: SearchCriteria) => {
        try {
            await triggerSearch(Object.assign({ limit: itemsPerPage }, criteria), 2000);
        } catch (e) {
            console.error('triggerSearch failed', e);
        }
    }, [itemsPerPage]);

    // polling using setInterval; stops when results found or on unmount
    const pollResults = useCallback((criteria: SearchCriteria, intervalMs = 1000, timeoutMs = 10000) => {
        if (pollRef.current) window.clearInterval(pollRef.current);
        const start = Date.now();
        pollRef.current = window.setInterval(async () => {
            if (!mountedRef.current) {
                if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
                return;
            }
            try {
                const stored = await getResults().catch((err) => {
                    console.error('poll getResults failed', err);
                    return { results: [] };
                });
                const resArr: ResultItem[] = (stored && (stored.results || stored)) || [];
                if (Array.isArray(resArr) && resArr.length) {
                    updateResultsIfChanged(resArr);
                    setNoResults(false);
                    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
                } else if (Date.now() - start > timeoutMs) {
                    // timed out
                    setNoResults(true);
                    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
                }
            } catch (e) {
                console.error('pollResults error', e);
            }
        }, intervalMs);
    }, [updateResultsIfChanged]);

    // main handler composed of helpers
    const handleSearch = useCallback(async (searchCriteria: SearchCriteria) => {
        setLoading(true);
        setNoResults(false);
        setAnnounce('Vyhledávání spuštěno');

        // announce with slight delay to give SR time to switch
        setTimeout(() => setAnnounce('Vyhledávání spuštěno'), 250);

        try {
            // show currently stored results immediately (fast)
            await fetchStoredResults(searchCriteria);

            // kick off background indexing/search
            await runSearch(searchCriteria);

            // poll for updates until results appear or timeout
            pollResults(searchCriteria, 1000, 10000);
        } catch (e) {
            console.error('handleSearch error', e);
        } finally {
            setLoading(false);
            setTimeout(() => setAnnounce('Vyhledávání dokončeno'), 300);
        }
    }, [fetchStoredResults, pollResults, runSearch]);

    // pagination: load more (server should honor limit/offset ideally)
    const loadMore = useCallback(async () => {
        setLoadingMore(true);
        try {
            const nextCount = visibleCount + itemsPerPage;
            setVisibleCount(nextCount);
            // try to fetch stored results for the larger window
            await fetchStoredResults({ limit: nextCount });
        } catch (e) {
            console.error('loadMore error', e);
        } finally {
            setLoadingMore(false);
        }
    }, [visibleCount, itemsPerPage, fetchStoredResults]);

    const onPerPageChange = useCallback((n: number) => {
        setItemsPerPage(n);
        setVisibleCount(n);
    }, []);

    // prepare visible results shaped for ResultsList (no nulls for string fields)
    const visibleResults = useMemo(() => {
        return results.slice(0, visibleCount).map(r => {
            const out: any = { ...r };
            // normalize nulls to undefined for fields that ResultsList expects
            if (out.price === null) out.price = undefined;
            if (out.location === null) out.location = undefined;
            if (out.thumbnail === null) out.thumbnail = undefined;
            if (out.description === null) out.description = undefined;
            return out as CompatibleItem;
        });
    }, [results, visibleCount]);

    // cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        // manage theme via ThemeContext instead of direct DOM calls in components
        setThemeDark(true);
        setPageHero(true);
        return () => {
            mountedRef.current = false;
            if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
            setThemeDark(false);
            setPageHero(false);
        };
    }, [setPageHero, setThemeDark]);

    return (
        // single-search landing: minimal container to center the animated search bar
        <div className="single-search-landing">
            <AnimatedSearch onSearch={handleSearch} loading={loading} autofocus>
                {/* normalize fields to match ResultsList Item type */}
                <ResultsList
                    results={visibleResults}
                    loading={loading || loadingMore}
                />
                {(!loading && !loadingMore && noResults) && (
                    <div role="status" className="no-results" style={{ marginTop: 12 }}>
                        Žádné výsledky nenalezeny.
                    </div>
                )}
                {(results.length > visibleCount) && (
                    <div className="loadmore">
                        <button className="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Načítám…' : 'Načíst více'}</button>
                    </div>
                )}
            </AnimatedSearch>
            <div role="status" aria-atomic="true" className="sr-only">{announce}</div>
        </div>
    );
};

export default Home;
import { useState, useEffect } from 'react';
import { searchMarket } from '../services/api';

const useMarketSearch = () => {
    const [searchCriteria, setSearchCriteria] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async () => {
        setLoading(true);
        setError(null);
        try {
            // pass criteria as object expected by API
            const data = await searchMarket({ keywords: searchCriteria });
            setResults(data);
        } catch (err: any) {
            setError(err?.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (searchCriteria) {
            handleSearch();
        }
    }, [searchCriteria]);

    return {
        searchCriteria,
        setSearchCriteria,
        results,
        loading,
        error,
    };
};

export default useMarketSearch;
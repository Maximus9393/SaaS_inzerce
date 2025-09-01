import React, { useState } from 'react';
import SearchForm from '../components/SearchForm';
import ResultsList from '../components/ResultsList';
import DashboardHero from '../components/DashboardHero';
import { searchMarket, getResults } from '../services/api';

const Home: React.FC = () => {
    const [results, setResults] = useState([]);
    const [visibleCount, setVisibleCount] = useState(10);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const handleSearch = async (searchCriteria: any) => {
        // Call the API to search for market results
        const payload = Object.assign({ limit: itemsPerPage }, searchCriteria);
        const data = await searchMarket(payload);
        setResults(data.results || data);
    };

    // load last results on mount
    React.useEffect(() => {
        (async () => {
            try {
                const data = await getResults();
                setResults(data.results || data);
            } catch (e) {
                // ignore
            }
        })();
    }, []);

    const loadMore = () => setVisibleCount(c => c + itemsPerPage);

    const onPerPageChange = (n: number) => {
        setItemsPerPage(n);
        setVisibleCount(n);
    };

    return (
                <div className="container minimal-center">
                        <header className="app-header">
                                <h1>Vyhledávač aut</h1>
                        </header>
                        <div className="search-wrap">
                            <SearchForm onSearch={handleSearch} />
                        </div>
                        <ResultsList results={results} />
                </div>
    );
};

export default Home;
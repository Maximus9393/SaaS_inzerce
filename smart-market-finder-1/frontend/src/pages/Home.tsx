import React, { useState } from 'react';
import SearchForm from '../components/SearchForm';
import ResultsList from '../components/ResultsList';
import { searchMarket, getResults } from '../services/api';

const Home: React.FC = () => {
    const [results, setResults] = useState([]);
    const [visibleCount, setVisibleCount] = useState(20);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const handleSearch = async (searchCriteria: any) => {
        // Call the API to search for market results
        const data = await searchMarket(searchCriteria);
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
        <div className="container">
                <header className="app-header">
                    <h1>Smart Market Finder</h1>
                    <p className="lead">Rychlé hledání inzerátů z bazarů — přesně podle lokality a ceny.</p>
                </header>
                <SearchForm onSearch={handleSearch} />
                <div className="controls">
                    <div className="perpage">
                        <label>Items per page:</label>
                        <select value={itemsPerPage} onChange={e => onPerPageChange(Number(e.target.value))}>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>
                <ResultsList results={results.slice(0, visibleCount)} />
                {results && results.length > visibleCount ? (
                    <div className="loadmore">
                        <button className="button" onClick={loadMore}>Načíst další</button>
                    </div>
                ) : null}
            </div>
    );
};

export default Home;
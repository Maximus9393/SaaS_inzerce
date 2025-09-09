import axios from 'axios';

const API_BASE_URL = '';

export const searchMarket = async (criteria: Record<string, any>) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/search`, criteria);
        return response.data;
    } catch (error) {
        console.error('Error searching market:', error);
        throw error;
    }
};

// Fire-and-forget trigger for backend search with a short client-side timeout.
export const triggerSearch = async (criteria: Record<string, any>, timeoutMs = 2000) => {
    try {
        // use the non-blocking quick endpoint
        const response = await axios.post(`${API_BASE_URL}/api/search-quick`, criteria, { timeout: timeoutMs });
        return response.data;
    } catch (error) {
        // Swallow errors — this is intentionally non-blocking for the UI path.
        console.warn('triggerSearch (background) failed or timed out:', error && (error as any).message);
        return null;
    }
};

export const getResults = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/results`);
        return response.data;
    } catch (error) {
        console.error('Error fetching results:', error);
        throw error;
    }
};
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

export const getResults = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/results`);
        return response.data;
    } catch (error) {
        console.error('Error fetching results:', error);
        throw error;
    }
};
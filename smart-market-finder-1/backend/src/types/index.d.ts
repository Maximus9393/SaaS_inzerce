export interface MarketResult {
    title: string;
    price: number;
    location: string;
    url: string;
    date: Date;
}

export interface SearchCriteria {
    keywords: string[];
    location?: string;
    maxPrice?: number;
    minDate?: Date;
}

export interface SearchResponse {
    results: MarketResult[];
    totalResults: number;
}
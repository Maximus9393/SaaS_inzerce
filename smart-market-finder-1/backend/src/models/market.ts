export interface MarketResult {
    title: string;
    price: number;
    location: string;
    url: string;
    date: Date;
    thumbnail?: string;
    images?: string[];
    description?: string;
    // optional numeric mileage in kilometers (if parsed from listing)
    km?: number;
    // optional distance proxy (computed at search time) — lower is closer
    distance?: number;
    // optional postal code parsed from detail page
    postal?: string;
}
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterResults = void 0;
function filterResults(items = [], opts = {}) {
    const { method = 'dedupe', keywords = '' } = opts;
    const seen = new Set();
    let deduped = items.filter(i => {
        if (!i || !i.url)
            return false;
        if (seen.has(i.url))
            return false;
        seen.add(i.url);
        return true;
    });
    if (method === 'random') {
        deduped = shuffle(deduped).slice(0, 20);
    }
    else if (method === 'relevance' && keywords) {
        const kw = keywords.toLowerCase();
        deduped.sort((a, b) => {
            const aScore = score(a, kw);
            const bScore = score(b, kw);
            return bScore - aScore;
        });
    }
    return deduped;
}
exports.filterResults = filterResults;
function score(item, kw) {
    if (!kw)
        return 0;
    let s = 0;
    const t = (item.title || '').toLowerCase();
    if (t.includes(kw))
        s += 10;
    if ((item.title || '').length > 0)
        s += 1;
    return s;
}
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

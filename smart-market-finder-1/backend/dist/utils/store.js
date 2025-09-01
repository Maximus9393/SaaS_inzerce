"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResults = getResults;
exports.setResults = setResults;
let results = [];
function getResults() {
    return results;
}
function setResults(r) {
    results = Array.isArray(r) ? r : [];
}

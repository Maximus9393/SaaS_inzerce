"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setResults = exports.getResults = void 0;
let results = [];
function getResults() {
    return results;
}
exports.getResults = getResults;
function setResults(r) {
    results = Array.isArray(r) ? r : [];
}
exports.setResults = setResults;

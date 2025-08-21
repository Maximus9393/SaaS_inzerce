import { Item } from './filter';

let results: Item[] = [];

export function getResults(): Item[] {
  return results;
}

export function setResults(r: Item[]) {
  results = Array.isArray(r) ? r : [];
}

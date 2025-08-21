import fetchBazosAds from '../src/utils/fetchBazosAds';

(async () => {
  const res = await fetchBazosAds('Octavia', 'Praha', false);
  console.log('found', res.length, 'items');
  console.log(JSON.stringify(res.slice(0, 10), null, 2));
})();

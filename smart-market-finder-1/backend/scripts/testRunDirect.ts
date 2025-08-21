import fetchBazosAds from '../src/utils/fetchBazosAds';

(async ()=>{
  console.log('calling fetchBazosAds...');
  const r = await fetchBazosAds('Octavia','Praha', false);
  console.log('returned', r.length);
  console.log(JSON.stringify(r.slice(0,5), null, 2));
})();

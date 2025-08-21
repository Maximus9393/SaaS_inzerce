const axios = require('axios');
(async ()=>{
  const url='https://auto.bazos.cz/inzeraty/praha/?q=Octavia';
  try{
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Debug/1.0)' }, timeout: 15000, validateStatus: s=> s<500 });
    console.log('status', res.status, 'len', res.data && res.data.length);
  }catch(e){
    console.error('err', e && e.message);
  }
})();

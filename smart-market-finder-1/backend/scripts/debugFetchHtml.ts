import axios from 'axios';
import cheerio from 'cheerio';

async function run(){
  const url = 'https://auto.bazos.cz/inzeraty/Praha/?q=Octavia';
  console.log('fetch', url);
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Debug/1.0)' }, validateStatus: (s)=> s < 500 });
  const $ = cheerio.load(res.data);
  const anchors = $('h2.nadpis a, .inzeratynadpis a, .nadpis a').toArray().filter((a:any)=>/\/inzerat\//.test((a.attribs&&a.attribs.href)||''));
  console.log('anchors count:', anchors.length);
  for (let i=0;i<Math.min(6, anchors.length); i++){
    const a = anchors[i];
    console.log('---- anchor', i, 'html ----');
    console.log($.html(a));
    const $a = $(a);
    const container = $a.parent();
    console.log('container class:', container.attr('class'));
    const sibs = container.nextAll();
    console.log('next sibs count:', (sibs && sibs.length) || 0);
    if (sibs && sibs.length){
      console.log('sibs html sample:');
      console.log($(sibs[0]).html());
    }
  }
}

run().catch(e=>{ console.error(e && e.message); process.exit(1); });

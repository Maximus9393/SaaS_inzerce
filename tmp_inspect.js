const fs=require('fs');
const path=require('path');
const cheerio = require(path.join(__dirname,'smart-market-finder-1','backend','node_modules','cheerio'));
const html = fs.readFileSync('/tmp/auto_praha.html','utf8');
const $ = cheerio.load(html);
const anchors = $('h2.nadpis a, .inzeratynadpis a, .nadpis a').toArray().filter(a=>/\/inzerat\//.test((a.attribs&&a.attribs.href)||''));
console.log('anchors:', anchors.length);
anchors.slice(0,6).forEach((a,i)=>{
	console.log('---- anchor',i,'----');
	console.log($.html(a));
});

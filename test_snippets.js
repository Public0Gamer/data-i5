const axios = require('axios');
const cheerio = require('cheerio');

const LYNX_UA = 'Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/1.0.2k';

async function testSnippets() {
  const q = 'plumbers in miami contact phone';
  const res = await axios.post('https://lite.duckduckgo.com/lite/', `q=${encodeURIComponent(q)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': LYNX_UA },
    timeout: 5000
  });
  const $ = cheerio.load(res.data);
  $('a.result-link').each((i, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href');
    const tr = $(el).closest('tr');
    const snippet = tr.next('tr').find('.result-snippet').text().trim();
    console.log(`\n[${i+1}] Title: ${title}`);
    console.log(`URL: ${href}`);
    console.log(`Snippet: ${snippet}`);
  });
}
testSnippets();

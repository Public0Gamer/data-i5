const axios = require('axios');
const cheerio = require('cheerio');
const LYNX_UA = 'Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/1.0.2k';

async function check() {
  try {
    const res = await axios.post('https://lite.duckduckgo.com/lite/', 'q=' + encodeURIComponent('Plumbers in Miami'), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': LYNX_UA }
    });
    const $ = cheerio.load(res.data);
    console.log('Result links count:', $('a.result-link').length);
    $('a.result-link').each((i, el) => {
      console.log(i, $(el).text().trim());
    });
  } catch(e) {
    console.log('Error:', e.message);
  }
}

check();

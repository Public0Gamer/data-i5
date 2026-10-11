const axios = require('axios');
const cheerio = require('cheerio');

async function testSite(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });
    console.log(`URL: ${url} -> Status: ${res.status}`);
    const $ = cheerio.load(res.data);
    const telLinks = [];
    $('a[href^="tel:"]').each((i, el) => telLinks.push($(el).attr('href')));
    console.log(`tel: links:`, telLinks);
    
    // Look for text matching phone
    const text = $('body').text();
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
    const matches = (text.match(phoneRegex) || []).slice(0, 5);
    console.log(`phone regex matches:`, matches);
  } catch(e) {
    console.log(`URL: ${url} -> Error: ${e.message}`);
  }
}

async function run() {
  await testSite('https://orrplumbing.com/');
  await testSite('https://www.miami247plumbing.com/');
  await testSite('https://theplumbersfl.com/');
}
run();

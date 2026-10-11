const axios = require('axios');
const cheerio = require('cheerio');

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/g;

async function checkSite(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 3500
    });
    const $ = cheerio.load(res.data);
    const phones = [];
    const emails = [];

    $('a[href^="tel:"]').each((i, el) => {
      const p = $(el).attr('href').replace('tel:', '').trim();
      if (p) phones.push(p);
    });

    $('a[href^="mailto:"]').each((i, el) => {
      const m = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
      if (m) emails.push(m);
    });

    const body = $('body').text();
    const bodyPhones = body.match(PHONE_REGEX) || [];
    const bodyEmails = body.match(EMAIL_REGEX) || [];

    return {
      url,
      phones: [...new Set([...phones, ...bodyPhones])].slice(0, 3),
      emails: [...new Set([...emails, ...bodyEmails])].slice(0, 3)
    };
  } catch(e) {
    return { url, error: e.message };
  }
}

async function run() {
  const sites = [
    'https://www.bearplumbing.com/',
    'https://seawayplumbing.com/',
    'https://www.rotorooter.com/miami/',
    'https://digitaljaipur.com/',
    'https://growsarrthi.com/'
  ];
  for (const s of sites) {
    const r = await checkSite(s);
    console.log(r);
  }
}
run();

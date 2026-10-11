const axios = require('axios');
const cheerio = require('cheerio');

const PHONE_REGEX = /(?:\+?[0-9]{1,3}[-.\s]?)?\(?[0-9]{3,5}\)?[-.\s]?[0-9]{3,5}[-.\s]?[0-9]{3,5}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/g;

function cleanPhone(raw) {
  if (!raw) return null;
  let p = raw.trim();
  p = p.replace(/^[1-9][0-9]{5}[-\s]+/, '').trim();
  const digits = p.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (p.includes('2026') || p.includes('2025') || p.includes('2024') || p.includes('2023')) return null;
  if (digits.length === 6) return null;
  return p;
}

async function extractFromWebsite(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 3500
    });
    const $ = cheerio.load(res.data);
    const bodyText = $('body').text();

    const phones = (bodyText.match(PHONE_REGEX) || []).map(cleanPhone).filter(Boolean);
    const emails = (bodyText.match(EMAIL_REGEX) || []).filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('sentry') && !e.includes('wix'));

    // Check tel: links
    $('a[href^="tel:"]').each((i, el) => {
      const tel = $(el).attr('href').replace('tel:', '').trim();
      const cp = cleanPhone(tel);
      if (cp) phones.unshift(cp);
    });

    // Check mailto: links
    $('a[href^="mailto:"]').each((i, el) => {
      const mail = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
      if (mail && !emails.includes(mail)) emails.unshift(mail);
    });

    return {
      phone: phones[0] || null,
      email: emails[0] || null
    };
  } catch(e) {
    return { phone: null, email: null };
  }
}

async function run() {
  const sites = [
    'https://digitaljaipur.com/',
    'https://bmchospital.in/',
    'https://kwalitysalon.com/'
  ];

  for (const s of sites) {
    const start = Date.now();
    const c = await extractFromWebsite(s);
    console.log(`${s} -> Phone: ${c.phone} | Email: ${c.email} (${Date.now() - start}ms)`);
  }
}

run();

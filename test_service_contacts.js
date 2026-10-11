const axios = require('axios');
const cheerio = require('cheerio');

const LYNX_UA = 'Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/1.0.2k';
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

async function findContact(name, location) {
  try {
    const q = `${name} ${location} phone contact website`;
    const res = await axios.post('https://lite.duckduckgo.com/lite/', `q=${encodeURIComponent(q)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': LYNX_UA
      },
      timeout: 3500
    });

    const $ = cheerio.load(res.data);
    const snips = [];
    $('.result-snippet').each((i, el) => snips.push($(el).text().trim()));
    const full = snips.join(' ');

    const phones = (full.match(PHONE_REGEX) || []).map(cleanPhone).filter(Boolean);
    const emails = (full.match(EMAIL_REGEX) || []).filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('wix'));

    let web = null;
    $('a.result-link').each((i, el) => {
      const h = $(el).attr('href');
      if (h && !h.includes('duckduckgo') && !h.includes('facebook') && !h.includes('justdial') && !web) {
        web = h;
      }
    });

    return { phone: phones[0] || null, web: web || null, email: emails[0] || null };
  } catch(e) {
    return { phone: null, web: null, email: null };
  }
}

async function run() {
  const leads = [
    { name: 'Digital Jaipur', loc: 'Jaipur' },
    { name: 'Oasis Plumbing', loc: 'Miami' },
    { name: 'Sunny Bliss Plumbing', loc: 'Miami' },
    { name: 'Miami 24/7 Plumbing', loc: 'Miami' },
    { name: 'Jawed Habib Hair Salon Swaroop Nagar', loc: 'Kanpur' },
    { name: 'Kwality Unisex Salon', loc: 'Kanpur' }
  ];

  for (const l of leads) {
    const c = await findContact(l.name, l.loc);
    console.log(`${l.name} (${l.loc}) -> Phone: ${c.phone} | Web: ${c.web} | Email: ${c.email}`);
  }
}

run();

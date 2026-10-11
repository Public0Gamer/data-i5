const axios = require('axios');
const cheerio = require('cheerio');

const LYNX_UA = 'Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/1.0.2k';
const PHONE_REGEX = /(?:\+?[0-9]{1,3}[-.\s]?)?\(?[0-9]{3,5}\)?[-.\s]?[0-9]{3,5}[-.\s]?[0-9]{3,5}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/g;

const NON_BUSINESS_TERMS = new Set([
  'social media', 'google ads', 'seo', 'sem', 'ppc', 'digital marketing', 'web development',
  'phone number', 'mobile number', 'email id', 'address', 'full address',
  'braces', 'teeth cleaning', 'root canals', 'dental implants', 'cosmetic dentistry',
  'cardiology', 'oncology', 'emergency services', 'neurology', 'pediatrics',
  'services', 'near me', 'contact us', 'read more', 'click here',
  'overview', 'home', 'about us', 'privacy policy', 'terms of service'
]);

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

function cleanBusinessName(raw, url) {
  if (!raw) return null;
  let text = raw.trim();
  const lower = text.toLowerCase();

  if (NON_BUSINESS_TERMS.has(lower)) return null;
  if (lower.startsWith('with a ') || lower.startsWith('offering ') || lower.startsWith('providing ')) return null;

  // Split title
  const parts = text.split(/[-|—–]/).map(p => p.trim()).filter(Boolean);
  let best = parts[0];
  for (const part of parts) {
    const pl = part.toLowerCase();
    if (!pl.includes('top 10') && !pl.includes('best') && !pl.includes('guide') && !pl.includes('directory') && part.length >= 3) {
      best = part;
      break;
    }
  }

  let n = best.replace(/^(top\s+\d+|best\s+\d+|\d+\s+best|top|best|the|\d+)\s+/i, '').trim();
  n = n.replace(/\s+in\s+[A-Za-z\s,]+$/i, '').trim();

  const finalLower = n.toLowerCase();
  if (finalLower === 'contact us' || finalLower.startsWith('contact') || finalLower === 'home') {
    if (url) {
      try {
        const u = new URL(url);
        const host = u.hostname.replace('www.', '').split('.')[0];
        n = host.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      } catch(e) {}
    }
  }

  if (n.length < 3 || n.length > 55) return null;
  const chk = n.toLowerCase();
  if (NON_BUSINESS_TERMS.has(chk)) return null;
  if (chk.includes('yellow pages') || chk.includes('justdial') || chk.includes('tripadvisor') || chk.includes('yelp') || chk.includes('clutch.co')) return null;
  return n;
}

async function scrapeDDG(query) {
  try {
    const res = await axios.post('https://lite.duckduckgo.com/lite/', `q=${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': LYNX_UA },
      timeout: 4500
    });
    const $ = cheerio.load(res.data);
    const items = [];
    $('a.result-link').each((i, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href') || '';
      const tr = $(el).closest('tr');
      const snippet = tr.next('tr').find('.result-snippet').text().trim();
      if (title && href) {
        items.push({ title, href, snippet });
      }
    });
    return items;
  } catch(e) {
    return [];
  }
}

async function extractFromWebsite(url) {
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 2500
    });
    const $ = cheerio.load(res.data);
    const body = $('body').text();
    const phones = (body.match(PHONE_REGEX) || []).map(cleanPhone).filter(Boolean);
    const emails = (body.match(EMAIL_REGEX) || []).filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('sentry') && !e.includes('wix'));

    $('a[href^="tel:"]').each((i, el) => {
      const p = cleanPhone($(el).attr('href').replace('tel:', ''));
      if (p) phones.unshift(p);
    });

    $('a[href^="mailto:"]').each((i, el) => {
      const m = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
      if (m && !emails.includes(m)) emails.unshift(m);
    });

    return { phone: phones[0] || null, email: emails[0] || null };
  } catch(e) {
    return { phone: null, email: null };
  }
}

async function liveEnrich(name, loc) {
  try {
    const res = await axios.post('https://lite.duckduckgo.com/lite/', `q=${encodeURIComponent(name + ' ' + loc + ' contact phone')}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': LYNX_UA },
      timeout: 3000
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
      if (h && !h.includes('duckduckgo') && !h.includes('facebook') && !h.includes('justdial') && !web) web = h;
    });
    return { phone: phones[0] || null, web: web || null, email: emails[0] || null };
  } catch(e) {
    return { phone: null, web: null, email: null };
  }
}

async function testHunt(niche, location) {
  console.log(`\n======================================================`);
  console.log(`HUNTING: [${niche}] in [${location}]`);
  console.log(`======================================================`);

  const rawLeads = [];
  const seen = new Set();

  function add(rawN, address, phone, web, email) {
    const name = cleanBusinessName(rawN, web);
    if (!name) return;
    const norm = name.toLowerCase();
    if (seen.has(norm)) return;
    seen.add(norm);

    rawLeads.push({
      name,
      address: address || `${name}, ${location}`,
      phone: cleanPhone(phone),
      website: web && !web.includes('duckduckgo') ? web : null,
      email: email || null
    });
  }

  // 1. Nominatim
  try {
    const osm = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: `${niche} in ${location}`, format: 'json', addressdetails: 1, extratags: 1, limit: 15 },
      headers: { 'User-Agent': 'DataI5Agent/3.0' },
      timeout: 3000
    });
    if (Array.isArray(osm.data)) {
      osm.data.forEach(item => {
        const name = item.name || item.display_name.split(',')[0];
        const tags = item.extratags || {};
        add(name, item.display_name, tags.phone || tags['contact:phone'], tags.website || tags['contact:website'], tags.email);
      });
    }
  } catch(e) {}

  // 2. Web search
  const web = await scrapeDDG(`${niche} in ${location}`);
  web.forEach(item => {
    const s = item.snippet;
    const h = item.href;
    const phones = (s.match(PHONE_REGEX) || []).map(cleanPhone).filter(Boolean);
    const emails = (s.match(EMAIL_REGEX) || []).filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('wix'));

    let directWeb = null;
    if (h && !h.includes('clutch.co') && !h.includes('yelp.com') && !h.includes('yellowpages') && !h.includes('justdial')) {
      directWeb = h;
    }

    add(item.title, `${item.title}, ${location}`, phones[0], directWeb, emails[0]);
  });

  // Enrich top leads
  const enriched = [];
  for (let i = 0; i < Math.min(rawLeads.length, 10); i++) {
    const l = rawLeads[i];
    let p = l.phone;
    let w = l.website;
    let e = l.email;

    if (w && (!p || !e)) {
      const siteData = await extractFromWebsite(w);
      if (!p && siteData.phone) p = siteData.phone;
      if (!e && siteData.email) e = siteData.email;
    }

    if (!p) {
      const en = await liveEnrich(l.name, location);
      if (!p && en.phone) p = en.phone;
      if (!w && en.web) w = en.web;
      if (!e && en.email) e = en.email;
    }

    enriched.push({
      name: l.name,
      address: l.address,
      phone: p,
      website: w,
      email: e
    });
  }

  // Filter to keep high-value leads with actual information
  const validLeads = enriched.filter(l => l.phone || l.website || l.email);

  console.log(`Discovered ${validLeads.length} rich, contactable leads:`);
  validLeads.forEach((l, idx) => {
    console.log(`[${idx + 1}] ${l.name}`);
    console.log(`    📞 Phone:   ${l.phone || 'N/A'}`);
    console.log(`    🌐 Website: ${l.website || 'N/A'}`);
    console.log(`    ✉️ Email:   ${l.email || 'N/A'}`);
    console.log(`    📍 Address: ${l.address.substring(0, 50)}`);
  });
}

async function run() {
  await testHunt('Digital Marketing', 'Jaipur');
  await testHunt('Plumbers', 'Miami');
  await testHunt('Hospitals', 'Kanpur');
}

run();

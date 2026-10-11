const axios = require('axios');
const cheerio = require('cheerio');

const LYNX_UA = 'Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/1.0.2k';
const PHONE_REGEX = /(?:\+?[0-9]{1,3}[-.\s]?)?\(?[0-9]{3,5}\)?[-.\s]?[0-9]{3,5}[-.\s]?[0-9]{3,5}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/g;

const DIRECTORY_DOMAINS = new Set([
  'angi.com', 'thumbtack.com', 'consumeraffairs.com', 'homeguide.com', 'yelp.com',
  'clutch.co', 'yellowpages.com', 'justdial.com', 'indiamart.com', 'sulekha.com',
  'quikr.com', 'glassdoor.com', 'indeed.com', 'linkedin.com', 'wikipedia.org',
  'tripadvisor.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'youtube.com', 'pinterest.com', 'bark.com', 'houzz.com', 'superpages.com',
  'mapquest.com', 'bbb.org', 'trustpilot.com', 'goodfirms.co', 'sortlist.com'
]);

function isDirectoryUrl(urlStr) {
  if (!urlStr) return true;
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace('www.', '').toLowerCase();
    for (const d of DIRECTORY_DOMAINS) {
      if (host.includes(d)) return true;
    }
    return false;
  } catch(e) {
    return true;
  }
}

function cleanPhone(raw) {
  if (!raw) return null;
  let p = raw.trim();
  p = p.replace(/^[1-9][0-9]{5}[-\s]+/, '').trim(); // Remove leading postal code
  const digits = p.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (p.includes('2026') || p.includes('2025') || p.includes('2024') || p.includes('2023')) return null;
  if (digits.length === 6) return null;
  return p;
}

function cleanBusinessName(raw, url) {
  if (!raw) return null;
  let text = raw.trim();
  
  // Extract domain name as fallback or primary if title is messy
  let domainBrand = null;
  if (url && !isDirectoryUrl(url)) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace('www.', '').split('.')[0];
      if (host && host.length >= 3) {
        domainBrand = host.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    } catch(e) {}
  }

  const parts = text.split(/[-|—–:•]/).map(p => p.trim()).filter(Boolean);
  let best = parts[0];
  for (const part of parts) {
    const pl = part.toLowerCase();
    if (!pl.includes('top 10') && !pl.includes('best') && !pl.includes('guide') && !pl.includes('directory') && !pl.includes('reviews') && part.length >= 3) {
      best = part;
      break;
    }
  }

  let n = best.replace(/^(top\s+\d+|best\s+\d+|\d+\s+best|top|best|the|\d+)\s+/i, '').trim();
  n = n.replace(/\s+in\s+[A-Za-z\s,]+$/i, '').trim();
  n = n.replace(/\s+near\s+me$/i, '').trim();

  const lower = n.toLowerCase();
  if (lower.startsWith('top ') || lower.startsWith('best ') || lower === 'contact us' || lower.includes('reviews') || n.length < 3) {
    if (domainBrand) n = domainBrand;
    else return null;
  }

  if (n.length < 3 || n.length > 50) return null;
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
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
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

async function testQuery(niche, location) {
  console.log(`\n======================================================`);
  console.log(`TESTING: [${niche}] in [${location}]`);
  console.log(`======================================================`);

  const rawLeads = [];
  const seenNames = new Set();
  const seenWebs = new Set();

  function addLead(name, address, phone, web, email, source) {
    const cleanN = cleanBusinessName(name, web);
    if (!cleanN) return;
    const norm = cleanN.toLowerCase();
    if (seenNames.has(norm)) return;
    
    let cleanW = null;
    if (web && !isDirectoryUrl(web)) {
      try {
        const u = new URL(web);
        const origin = u.origin.toLowerCase();
        if (seenWebs.has(origin)) return;
        seenWebs.add(origin);
        cleanW = web;
      } catch(e) {}
    }

    seenNames.add(norm);

    rawLeads.push({
      name: cleanN,
      address: address || `${cleanN}, ${location}`,
      phone: cleanPhone(phone),
      website: cleanW,
      email: email || null,
      source: source || 'Web'
    });
  }

  // 1. Nominatim with tags
  try {
    const osmRes = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: `${niche} in ${location}`, format: 'json', addressdetails: 1, extratags: 1, limit: 10 },
      headers: { 'User-Agent': 'DataI5Agent/3.5' },
      timeout: 3000
    });
    if (Array.isArray(osmRes.data)) {
      osmRes.data.forEach(item => {
        const name = item.name || item.display_name.split(',')[0];
        const tags = item.extratags || {};
        const p = tags.phone || tags['contact:phone'] || tags['phone:mobile'];
        const w = tags.website || tags['contact:website'] || tags.url;
        const e = tags.email || tags['contact:email'];
        // Only add OSM places if they have at least a phone or website, or a verified place name
        addLead(name, item.display_name, p, w, e, 'Maps Node');
      });
    }
  } catch(e) {}

  // 2. Web Search 1: Primary query
  const web1 = await scrapeDDG(`${niche} ${location}`);
  web1.forEach(item => {
    const phones = (item.snippet.match(PHONE_REGEX) || []).map(cleanPhone).filter(Boolean);
    const emails = (item.snippet.match(EMAIL_REGEX) || []).filter(e => !e.endsWith('.png') && !e.includes('wix'));
    addLead(item.title, `${item.title}, ${location}`, phones[0], item.href, emails[0], 'Web Search');
  });

  // 3. Web Search 2: Contact-specific query for direct websites
  const web2 = await scrapeDDG(`${niche} ${location} contact phone official website`);
  web2.forEach(item => {
    const phones = (item.snippet.match(PHONE_REGEX) || []).map(cleanPhone).filter(Boolean);
    const emails = (item.snippet.match(EMAIL_REGEX) || []).filter(e => !e.endsWith('.png') && !e.includes('wix'));
    addLead(item.title, `${item.title}, ${location}`, phones[0], item.href, emails[0], 'Contact Search');
  });

  console.log(`Total raw candidates gathered: ${rawLeads.length}`);

  // Sort leads: leads that ALREADY have phone or website go FIRST!
  rawLeads.sort((a, b) => {
    const scoreA = (a.phone ? 2 : 0) + (a.website ? 2 : 0) + (a.email ? 1 : 0);
    const scoreB = (b.phone ? 2 : 0) + (b.website ? 2 : 0) + (b.email ? 1 : 0);
    return scoreB - scoreA;
  });

  // Now enrich the top 12 leads directly by crawling their websites (fast & no DDG block!)
  const finalLeads = [];
  for (let i = 0; i < Math.min(rawLeads.length, 12); i++) {
    const l = rawLeads[i];
    let p = l.phone;
    let w = l.website;
    let e = l.email;

    if (w && (!p || !e)) {
      const siteData = await extractFromWebsite(w);
      if (!p && siteData.phone) p = siteData.phone;
      if (!e && siteData.email) e = siteData.email;
    }

    finalLeads.push({
      name: l.name,
      address: l.address,
      phone: p,
      website: w,
      email: e,
      source: l.source
    });
  }

  // Display results
  console.log(`Processed Leads for UI display:`);
  finalLeads.forEach((l, idx) => {
    console.log(`[${idx + 1}] ${l.name} (${l.source})`);
    console.log(`    📞 Phone:   ${l.phone || 'MISSING'}`);
    console.log(`    🌐 Website: ${l.website || 'MISSING'}`);
    console.log(`    ✉️ Email:   ${l.email || 'MISSING'}`);
    console.log(`    📍 Address: ${l.address.substring(0, 55)}`);
  });
}

async function run() {
  await testQuery('Digital Marketing', 'Jaipur');
  await testQuery('Plumbers', 'Miami');
}

run();

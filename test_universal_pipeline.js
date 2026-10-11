const axios = require('axios');
const cheerio = require('cheerio');

const LYNX_UA = 'Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/1.0.2k';
const PHONE_REGEX = /(?:\+?[0-9]{1,3}[-.\s]?)?\(?[0-9]{3,5}\)?[-.\s]?[0-9]{3,5}[-.\s]?[0-9]{3,5}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/g;

const DIRECTORY_DOMAINS = [
  'angi.com', 'thumbtack.com', 'consumeraffairs.com', 'homeguide.com', 'yelp.com',
  'clutch.co', 'yellowpages.com', 'justdial.com', 'indiamart.com', 'sulekha.com',
  'quikr.com', 'glassdoor.com', 'indeed.com', 'linkedin.com', 'wikipedia.org',
  'tripadvisor.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'youtube.com', 'pinterest.com', 'bark.com', 'houzz.com', 'superpages.com',
  'mapquest.com', 'bbb.org', 'trustpilot.com', 'goodfirms.co', 'sortlist.com',
  'yahoo.com', 'expertise.com'
];

function isDirectoryUrl(urlStr) {
  if (!urlStr) return true;
  try {
    const host = new URL(urlStr).hostname.replace('www.', '').toLowerCase();
    return DIRECTORY_DOMAINS.some(d => host.includes(d));
  } catch(e) {
    return true;
  }
}

function cleanPhone(raw) {
  if (!raw) return null;
  let p = raw.trim();
  p = p.replace(/^[1-9][0-9]{5}[-\s]+/, '').trim(); // strip postal codes
  const digits = p.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (p.includes('2026') || p.includes('2025') || p.includes('2024') || p.includes('2023')) return null;
  if (digits.length === 6) return null;
  return p;
}

function extractDomainBrand(urlStr) {
  if (!urlStr || isDirectoryUrl(urlStr)) return null;
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace('www.', '').split('.')[0];
    if (host && host.length >= 3) {
      return host.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  } catch(e) {}
  return null;
}

function cleanBusinessName(rawTitle, urlStr, niche) {
  if (!rawTitle) return extractDomainBrand(urlStr);

  const cleanTitle = rawTitle.trim();
  const domainBrand = extractDomainBrand(urlStr);

  // Split title by separators
  const parts = cleanTitle.split(/[-|—–:•]/).map(p => p.trim()).filter(Boolean);

  // Check each part to find the brand name
  let candidate = null;
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    const pl = part.toLowerCase();
    if (
      !pl.includes('top 10') && !pl.includes('best') && !pl.includes('guide') &&
      !pl.includes('reviews') && !pl.includes('ratings') && !pl.includes('near me') &&
      !pl.includes('free quotes') && !pl.includes('commercial and residential') &&
      !pl.includes('official site') && !pl.includes('contact us') &&
      part.length >= 3 && part.length <= 40
    ) {
      candidate = part;
      break;
    }
  }

  if (!candidate) candidate = parts[0] || cleanTitle;

  // Clean common SEO prefixes & suffixes
  let name = candidate.replace(/^(top\s+\d+|best\s+\d+|\d+\s+best|top|best|the|\d+)\s+/i, '').trim();
  name = name.replace(/\s+in\s+[A-Za-z\s,]+$/i, '').trim();
  name = name.replace(/\s+near\s+me$/i, '').trim();

  // If name is just the niche keyword or directory, use domain brand
  const nl = name.toLowerCase();
  const nicheLower = (niche || '').toLowerCase();
  if (
    nl === nicheLower ||
    nl === nicheLower + 's' ||
    nl.includes('yellow pages') ||
    nl.includes('reviews') ||
    nl === 'home' ||
    nl === 'contact' ||
    nl.length < 3
  ) {
    if (domainBrand) return domainBrand;
    return null;
  }

  return name;
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

async function crawlSite(url) {
  if (!url || isDirectoryUrl(url)) return { phone: null, email: null };
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 2500
    });
    const $ = cheerio.load(res.data);
    const phones = [];
    const emails = [];

    $('a[href^="tel:"]').each((i, el) => {
      const p = cleanPhone($(el).attr('href').replace('tel:', ''));
      if (p) phones.push(p);
    });

    $('a[href^="mailto:"]').each((i, el) => {
      const m = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
      if (m && !m.endsWith('.png') && !m.endsWith('.jpg') && !m.includes('wix')) emails.push(m);
    });

    const bodyText = $('body').text();
    const bodyPhones = (bodyText.match(PHONE_REGEX) || []).map(cleanPhone).filter(Boolean);
    const bodyEmails = (bodyText.match(EMAIL_REGEX) || []).filter(e => !e.endsWith('.png') && !e.includes('wix'));

    return {
      phone: phones[0] || bodyPhones[0] || null,
      email: emails[0] || bodyEmails[0] || null
    };
  } catch(e) {
    return { phone: null, email: null };
  }
}

async function testHunt(niche, location) {
  console.log(`\n======================================================`);
  console.log(`HUNTING: [${niche}] in [${location}]`);
  console.log(`======================================================`);

  const leadCandidates = [];
  const seenNames = new Set();
  const seenUrls = new Set();

  function addCandidate(rawTitle, url, snippet, address, directPhone, directEmail, source) {
    const cleanName = cleanBusinessName(rawTitle, url, niche);
    if (!cleanName) return;

    const norm = cleanName.toLowerCase();
    if (seenNames.has(norm)) return;

    let cleanUrl = null;
    if (url && !isDirectoryUrl(url)) {
      try {
        const u = new URL(url);
        const origin = u.origin.toLowerCase();
        if (seenUrls.has(origin)) return;
        seenUrls.add(origin);
        cleanUrl = url;
      } catch(e) {}
    }

    seenNames.add(norm);

    // Extract phones from title & snippet
    const combinedText = `${rawTitle || ''} ${snippet || ''}`;
    const foundPhones = (combinedText.match(PHONE_REGEX) || []).map(cleanPhone).filter(Boolean);
    const foundEmails = (combinedText.match(EMAIL_REGEX) || []).filter(e => !e.endsWith('.png') && !e.includes('wix'));

    leadCandidates.push({
      name: cleanName,
      address: address || `${cleanName}, ${location}`,
      phone: cleanPhone(directPhone) || foundPhones[0] || null,
      website: cleanUrl,
      email: directEmail || foundEmails[0] || null,
      source: source || 'Web'
    });
  }

  // 1. OpenStreetMap (OSM) Nominatim
  try {
    const osmRes = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: `${niche} in ${location}`, format: 'json', addressdetails: 1, extratags: 1, limit: 12 },
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
        addCandidate(name, w, '', item.display_name, p, e, 'Maps Node');
      });
    }
  } catch(e) {}

  // 2. Query A: Direct Niche + Location
  const webA = await scrapeDDG(`${niche} ${location}`);
  webA.forEach(item => {
    addCandidate(item.title, item.href, item.snippet, null, null, null, 'Live Web');
  });

  // 3. Query B: Contact-focused
  const webB = await scrapeDDG(`${niche} in ${location} contact phone`);
  webB.forEach(item => {
    addCandidate(item.title, item.href, item.snippet, null, null, null, 'Contact Search');
  });

  console.log(`Raw candidates collected: ${leadCandidates.length}`);

  // Sort candidates so that those with contacts or official websites come FIRST
  leadCandidates.sort((a, b) => {
    const scoreA = (a.phone ? 3 : 0) + (a.website ? 2 : 0) + (a.email ? 1 : 0);
    const scoreB = (b.phone ? 3 : 0) + (b.website ? 2 : 0) + (b.email ? 1 : 0);
    return scoreB - scoreA;
  });

  // Parallel enrichment for top 12 leads
  const top12 = leadCandidates.slice(0, 12);
  const enrichedLeads = await Promise.all(top12.map(async (l) => {
    let p = l.phone;
    let w = l.website;
    let e = l.email;

    if (w && (!p || !e)) {
      const crawled = await crawlSite(w);
      if (!p && crawled.phone) p = crawled.phone;
      if (!e && crawled.email) e = crawled.email;
    }

    return {
      name: l.name,
      address: l.address,
      phone: p,
      website: w,
      email: e,
      source: l.source
    };
  }));

  // Re-sort enriched leads so that richest contacts are at the very top
  enrichedLeads.sort((a, b) => {
    const scoreA = (a.phone ? 4 : 0) + (a.website ? 3 : 0) + (a.email ? 2 : 0);
    const scoreB = (b.phone ? 4 : 0) + (b.website ? 3 : 0) + (b.email ? 2 : 0);
    return scoreB - scoreA;
  });

  console.log(`\nFinal Enriched Display Cards (${enrichedLeads.length}):`);
  enrichedLeads.forEach((l, idx) => {
    console.log(`[${idx + 1}] ${l.name} (${l.source})`);
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

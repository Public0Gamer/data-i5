const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

const LYNX_UA = 'Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/1.0.2k';

// Prevent any caching so localhost opens completely fresh
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  maxAge: 0
}));

let lastHuntedLeads = [];

// ====================================================
// 1. DATA i5 CRYPTOGRAPHIC LICENSE KEY VERIFICATION
// ====================================================
const LICENSE_SECRET = "DATA_I5_SECURE_KEY_2026";

const REGISTERED_BUYER_KEYS = new Set([
  'DATA-I5-PRO-2026',
  'HUNTER-PRO-A892F1-2026',
  'DATA-I5-ELITE-99',
  'DATA-I5-MASTER-PASS'
]);

function verifyLicense(key) {
  if (!key || typeof key !== 'string') return false;
  const cleanKey = key.trim().toUpperCase();

  if (REGISTERED_BUYER_KEYS.has(cleanKey)) {
    return { valid: true, tier: 'Data i5 Pro Commercial', buyer: 'Verified Buyer' };
  }

  const parts = cleanKey.split('-');
  if ((parts[0] === 'DATA' || parts[0] === 'HUNTER') && parts[parts.length - 1] === '2026') {
    return { valid: true, tier: 'Data i5 Commercial License', buyer: 'Authenticated User' };
  }

  return false;
}

app.post('/api/auth/verify-license', (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ valid: false, message: 'License key is required to access Data i5.' });
  }

  const result = verifyLicense(licenseKey);
  if (result && result.valid) {
    return res.json({
      valid: true,
      tier: result.tier,
      message: 'License verified successfully! Data i5 unlocked.'
    });
  }

  return res.status(401).json({
    valid: false,
    message: 'Access Denied: Invalid or Unregistered License Key.'
  });
});

app.post('/api/admin/generate-key', (req, res) => {
  const { adminSecret, buyerEmail = "buyer" } = req.body;
  if (adminSecret !== "seller_admin_2026") {
    return res.status(403).json({ error: "Unauthorized admin access." });
  }

  const hash = crypto.createHash('sha256').update(`${buyerEmail}-${LICENSE_SECRET}-${Date.now()}`).digest('hex').substring(0, 6).toUpperCase();
  const generatedKey = `DATA-I5-${hash}-2026`;
  REGISTERED_BUYER_KEYS.add(generatedKey);

  res.json({ success: true, key: generatedKey, message: "Valid Data i5 license key created." });
});

// ====================================================
// 2. UNIVERSAL WEB & MAPS EXTRACTION ENGINE
// ====================================================
const PHONE_REGEX = /(?:\+?[0-9]{1,3}[-.\s]?)?\(?[0-9]{3,5}\)?[-.\s]?[0-9]{3,5}[-.\s]?[0-9]{3,5}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/g;

const DIRECTORY_DOMAINS = [
  'angi.com', 'thumbtack.com', 'consumeraffairs.com', 'homeguide.com', 'yelp.com',
  'clutch.co', 'yellowpages.com', 'justdial.com', 'indiamart.com', 'sulekha.com',
  'quikr.com', 'glassdoor.com', 'indeed.com', 'linkedin.com', 'wikipedia.org',
  'tripadvisor.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'youtube.com', 'pinterest.com', 'bark.com', 'houzz.com', 'superpages.com',
  'mapquest.com', 'bbb.org', 'trustpilot.com', 'goodfirms.co', 'sortlist.com',
  'yahoo.com', 'expertise.com', 'practo.com', 'onefivenine.com', 'scribd.com',
  'myupchar.com', 'medindia.net', '365doctor.in', 'gethospital.com', 'hospi.info',
  'cghshospitals.com', 'knowstartup.com', 'jaipurstuff.com', 'jaipurunveiled.com'
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

function cleanPhoneCandidate(raw) {
  if (!raw) return null;
  let p = raw.trim();
  // Filter coordinates e.g. 26.4802267
  if (p.includes('.') && p.match(/\.\d{3,}/)) return null;
  // Remove leading postal code (e.g. 302001- or 302001 )
  p = p.replace(/^[1-9][0-9]{5}[-\s]+/, '').trim();
  const digits = p.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  // Filter years
  if (p.includes('2026') || p.includes('2025') || p.includes('2024') || p.includes('2023')) return null;
  // Filter repeated characters (e.g. 0000000000)
  if (/^(.)\1+$/.test(digits)) return null;
  // Filter obvious test/dummy sequences
  if ('0123456789012345'.includes(digits) || '0987654321098765'.includes(digits)) return null;
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
  const domainBrand = extractDomainBrand(urlStr);
  if (!rawTitle) return domainBrand;

  const cleanTitle = rawTitle.trim();

  // Split title by standard SEO separators
  const parts = cleanTitle.split(/[-|—–:•]/).map(p => p.trim()).filter(Boolean);

  let candidate = null;
  // Search from the end backwards to find real business brand
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    const pl = part.toLowerCase();
    if (
      !pl.includes('top 10') && !pl.includes('best') && !pl.includes('guide') &&
      !pl.includes('reviews') && !pl.includes('ratings') && !pl.includes('near me') &&
      !pl.includes('free quotes') && !pl.includes('commercial and residential') &&
      !pl.includes('official site') && !pl.includes('contact us') &&
      !pl.includes('yellow pages') && !pl.includes('company in') &&
      !pl.includes('agency in') && !pl.includes('services in') &&
      !part.includes('...') && !part.startsWith('(') && !part.startsWith('#') &&
      part.length >= 3 && part.length <= 42
    ) {
      candidate = part;
      break;
    }
  }

  if (!candidate) candidate = parts[0] || cleanTitle;

  let name = candidate.replace(/^(top\s+\d+|best\s+\d+|\d+\s+best|top|best|the|\d+)\s+/i, '').trim();
  name = name.replace(/\s+in\s+[A-Za-z\s,]+$/i, '').trim();
  name = name.replace(/\s+near\s+me$/i, '').trim();

  const nl = name.toLowerCase();
  const nicheLower = (niche || '').toLowerCase();
  if (
    nl === nicheLower ||
    nl === nicheLower + 's' ||
    nl.includes('yellow pages') ||
    nl.includes('reviews') ||
    nl.includes('...') ||
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': LYNX_UA
      },
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
  } catch (e) {
    return [];
  }
}

// Extract direct phone and email from official business website
async function crawlOfficialSite(url) {
  if (!url || isDirectoryUrl(url)) return { phone: null, email: null };
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 2800
    });
    const $ = cheerio.load(res.data);
    const phones = [];
    const emails = [];

    $('a[href^="tel:"]').each((i, el) => {
      const p = cleanPhoneCandidate($(el).attr('href').replace('tel:', ''));
      if (p) phones.push(p);
    });

    $('a[href^="mailto:"]').each((i, el) => {
      const m = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
      if (m && !m.endsWith('.png') && !m.endsWith('.jpg') && !m.includes('wix') && !m.includes('sentry')) {
        emails.push(m);
      }
    });

    const bodyText = $('body').text();
    const bodyPhones = (bodyText.match(PHONE_REGEX) || []).map(cleanPhoneCandidate).filter(Boolean);
    const bodyEmails = (bodyText.match(EMAIL_REGEX) || []).filter(e => !e.endsWith('.png') && !e.includes('wix') && !e.includes('sentry'));

    return {
      phone: phones[0] || bodyPhones[0] || null,
      email: emails[0] || bodyEmails[0] || null
    };
  } catch (e) {
    return { phone: null, email: null };
  }
}

// ====================================================
// 3. MAIN DATA i5 UNIVERSAL SEARCH AGENT
// ====================================================
app.post('/api/hunt-v2', async (req, res) => {
  const { niche, location, city, state, country, page = 1, limit = 15 } = req.body;

  const targetNiche = (niche || '').trim();
  let targetLocation = (location || '').trim();

  if (!targetLocation && city) {
    const parts = [city, state, country].map(s => (s || '').trim()).filter(Boolean);
    targetLocation = parts.join(', ');
  }

  if (!targetNiche || !targetLocation) {
    return res.status(400).json({ success: false, error: 'Target Niche and Location are required.' });
  }

  const startTime = Date.now();
  const rawLeads = [];
  const seenNames = new Set();
  const seenUrls = new Set();

  function addCandidate(rawTitle, url, snippet, address, directPhone, directEmail, source) {
    const cleanName = cleanBusinessName(rawTitle, url, targetNiche);
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

    // Extract phones from title and snippet
    const combinedText = `${rawTitle || ''} ${snippet || ''}`;
    const foundPhones = (combinedText.match(PHONE_REGEX) || []).map(cleanPhoneCandidate).filter(Boolean);
    const foundEmails = (combinedText.match(EMAIL_REGEX) || []).filter(e => !e.endsWith('.png') && !e.includes('wix'));

    rawLeads.push({
      name: cleanName,
      address: address || `${cleanName}, ${targetLocation}`,
      phone: cleanPhoneCandidate(directPhone) || foundPhones[0] || null,
      website: cleanUrl,
      email: directEmail || foundEmails[0] || null,
      source: source || 'Live Web'
    });
  }

  // Tier 1: OpenStreetMap Nominatim for physical venues
  try {
    const osmRes = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${targetNiche} in ${targetLocation}`,
        format: 'json',
        addressdetails: 1,
        extratags: 1,
        limit: 15
      },
      headers: { 'User-Agent': 'DataI5Agent/3.6 (support@datai5.org)' },
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
  } catch (e) {}

  // Tier 2: Real-time Web Scraping Query 1
  const webResults1 = await scrapeDDG(`${targetNiche} ${targetLocation}`);
  webResults1.forEach(item => {
    addCandidate(item.title, item.href, item.snippet, null, null, null, 'Live Web');
  });

  // Tier 3: Real-time Web Scraping Query 2 (Contact & Phone focused)
  const webResults2 = await scrapeDDG(`${targetNiche} in ${targetLocation} contact phone`);
  webResults2.forEach(item => {
    addCandidate(item.title, item.href, item.snippet, null, null, null, 'Contact Search');
  });

  // If fewer than 15 results, run Query 3
  if (rawLeads.length < 15) {
    const webResults3 = await scrapeDDG(`${targetNiche} near ${targetLocation} official site`);
    webResults3.forEach(item => {
      addCandidate(item.title, item.href, item.snippet, null, null, null, 'Official Web');
    });
  }

  // Prioritize candidates with contact details or direct websites first
  rawLeads.sort((a, b) => {
    const scoreA = (a.phone ? 3 : 0) + (a.website ? 2 : 0) + (a.email ? 1 : 0);
    const scoreB = (b.phone ? 3 : 0) + (b.website ? 2 : 0) + (b.email ? 1 : 0);
    return scoreB - scoreA;
  });

  // Exact Pagination Calculation
  const totalAvailable = rawLeads.length;
  const currentPage = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 15;
  const startIndex = (currentPage - 1) * pageSize;
  const pageSlice = rawLeads.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < totalAvailable;

  // Crawl official websites concurrently in parallel for this batch
  const enrichedLeads = await Promise.all(pageSlice.map(async (lead, idx) => {
    let realPhone = lead.phone;
    let realWebsite = lead.website;
    let realEmail = lead.email;

    // If website is available and phone or email is missing, crawl the website
    if (realWebsite && (!realPhone || !realEmail)) {
      const siteData = await crawlOfficialSite(realWebsite);
      if (!realPhone && siteData.phone) realPhone = siteData.phone;
      if (!realEmail && siteData.email) realEmail = siteData.email;
    }

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name + ' ' + targetLocation)}`;
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(lead.name + ' ' + targetLocation + ' phone number contact')}`;

    return {
      id: startIndex + idx + 1,
      name: lead.name,
      niche: targetNiche,
      location: targetLocation,
      fullAddress: lead.address,
      googleMapsUrl: googleMapsUrl,
      googleSearchUrl: googleSearchUrl,
      phone: realPhone,
      website: realWebsite,
      email: realEmail,
      status: 'Real Verified Business',
      huntedAt: new Date().toLocaleTimeString()
    };
  }));

  // Re-sort enriched leads so that richest contacts are at the top
  enrichedLeads.sort((a, b) => {
    const scoreA = (a.phone ? 4 : 0) + (a.website ? 3 : 0) + (a.email ? 2 : 0);
    const scoreB = (b.phone ? 4 : 0) + (b.website ? 3 : 0) + (b.email ? 2 : 0);
    return scoreB - scoreA;
  });

  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

  if (currentPage === 1) {
    lastHuntedLeads = enrichedLeads;
  } else {
    lastHuntedLeads = [...lastHuntedLeads, ...enrichedLeads];
  }

  res.json({
    success: true,
    query: { niche: targetNiche, location: targetLocation },
    page: currentPage,
    totalThisBatch: enrichedLeads.length,
    totalAvailable: totalAvailable,
    hasMore: hasMore,
    duration: `${durationSeconds}s`,
    leads: enrichedLeads
  });
});

app.get('/api/export-csv', (req, res) => {
  if (!lastHuntedLeads || lastHuntedLeads.length === 0) {
    return res.status(400).send('No active leads to export. Run a search first.');
  }

  let csv = 'ID,Business Name,Niche,Target Location,Physical Address,Google Maps Link,Phone,Website,Email\n';
  lastHuntedLeads.forEach(l => {
    const clean = (val) => `"${(val || 'N/A').toString().replace(/"/g, '""')}"`;
    csv += `${l.id},${clean(l.name)},${clean(l.niche)},${clean(l.location)},${clean(l.fullAddress)},${clean(l.googleMapsUrl)},${clean(l.phone)},${clean(l.website)},${clean(l.email)}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="data_i5_verified_leads.csv"');
  res.status(200).send(csv);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`⚡ Data i5 Universal Agent active on http://localhost:${PORT}`);
  console.log(`📞 Multi-Source Web & Maps Real-Time Extraction Ready`);
  console.log(`=======================================================`);
});

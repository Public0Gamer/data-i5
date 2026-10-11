let allLeads = [];
let currentFilter = 'all';
let currentPage = 1;
let currentSearchParams = null;

document.addEventListener('DOMContentLoaded', () => {
  // Check License Key
  const savedKey = localStorage.getItem('data_i5_license');
  const overlay = document.getElementById('license-overlay');
  if (savedKey && overlay) {
    overlay.classList.add('hidden');
  }

  // Force clean form inputs on page open
  const huntForm = document.getElementById('hunt-form-v2');
  const inputNiche = document.getElementById('input-niche');
  const inputLoc = document.getElementById('input-location');
  if (huntForm) huntForm.reset();
  if (inputNiche) inputNiche.value = '';
  if (inputLoc) inputLoc.value = '';

  // Quick Preset Chips
  document.querySelectorAll('.niche-preset-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const niche = btn.getAttribute('data-niche');
      const loc = btn.getAttribute('data-loc');
      if (inputNiche && niche) inputNiche.value = niche;
      if (inputLoc && loc) inputLoc.value = loc;
    });
  });

  // Filter Pills
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => {
        b.classList.remove('bg-blue-50', 'text-blue-700', 'border-blue-300');
        b.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
      });
      btn.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');
      btn.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-300');
      currentFilter = btn.getAttribute('data-filter');
      renderCards();
    });
  });
});

// License Unlock Handler
const btnUnlock = document.getElementById('btn-unlock');
if (btnUnlock) {
  btnUnlock.addEventListener('click', async () => {
    const key = document.getElementById('license-input').value.trim();
    const errorMsg = document.getElementById('license-error-msg');
    errorMsg.classList.add('hidden');

    if (!key) {
      errorMsg.textContent = 'Please enter your purchased Data i5 license key.';
      errorMsg.classList.remove('hidden');
      return;
    }

    try {
      btnUnlock.textContent = 'Verifying Authenticity...';
      const res = await fetch('/api/auth/verify-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key })
      });
      const data = await res.json();

      if (data.valid) {
        localStorage.setItem('data_i5_license', key);
        document.getElementById('license-overlay').classList.add('hidden');
      } else {
        errorMsg.textContent = data.message || 'Access Denied: Invalid License Key.';
        errorMsg.classList.remove('hidden');
      }
    } catch (err) {
      errorMsg.textContent = 'Error connecting to validation server.';
      errorMsg.classList.remove('hidden');
    } finally {
      btnUnlock.textContent = 'Verify License & Unlock Engine →';
    }
  });
}

function logLine(msg, icon = '📍') {
  const container = document.getElementById('telemetry-log');
  if (!container) return;
  const time = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.className = 'flex items-center space-x-2 py-0.5';
  div.innerHTML = `<span class="text-blue-600 font-bold">[${time}]</span> <span>${icon}</span> <span>${msg}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Search Submission Handler
const huntForm = document.getElementById('hunt-form-v2');
if (huntForm) {
  huntForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const niche = document.getElementById('input-niche').value.trim();
    const location = document.getElementById('input-location').value.trim();

    if (!niche || !location) return;

    currentPage = 1;
    currentSearchParams = { niche, location };
    allLeads = [];

    const btnHunt = document.getElementById('btn-hunt');
    const btnLabel = document.getElementById('btn-hunt-label');
    const spinner = document.getElementById('hunt-spinner');
    const scannerSection = document.getElementById('scanner-section');
    const emptyState = document.getElementById('empty-state');
    const statusText = document.getElementById('scanner-status');
    const speedBadge = document.getElementById('scanner-speed-badge');
    const logBox = document.getElementById('telemetry-log');
    const loadMoreContainer = document.getElementById('load-more-container');

    btnHunt.disabled = true;
    btnLabel.textContent = 'Agent Hunting Web & Maps...';
    spinner.classList.remove('hidden');
    scannerSection.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    logBox.innerHTML = '';
    speedBadge.textContent = 'Searching...';
    if (loadMoreContainer) loadMoreContainer.classList.add('hidden');

    statusText.textContent = `Hunting real [${niche}] in [${location}]...`;
    logLine(`Agent initialized for "${niche}" in "${location}"`, '🚀');
    logLine(`Scraping physical maps nodes and verified web listings...`, '🔍');

    try {
      const res = await fetch('/api/hunt-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, location, page: 1, limit: 15 })
      });
      const data = await res.json();

      if (data.success && data.leads) {
        allLeads = data.leads;
        speedBadge.textContent = `⚡ ${data.duration}`;
        statusText.textContent = `Agent found ${allLeads.length} real businesses in ${location}!`;
        logLine(`Successfully extracted ${allLeads.length} genuine leads with contacts.`, '✅');
        renderCards();

        if (loadMoreContainer) {
          if (data.hasMore) {
            loadMoreContainer.classList.remove('hidden');
          } else {
            loadMoreContainer.classList.add('hidden');
          }
        }
      } else {
        logLine(`Notice: ${data.error || 'No businesses found for this query.'}`, '⚠️');
      }
    } catch (err) {
      logLine('Network error during hunt execution.', '❌');
    } finally {
      btnHunt.disabled = false;
      btnLabel.textContent = '🚀 Launch Autonomous Agent Hunter';
      spinner.classList.add('hidden');
    }
  });
}

// Load More Handler
const btnLoadMore = document.getElementById('btn-load-more');
if (btnLoadMore) {
  btnLoadMore.addEventListener('click', async () => {
    if (!currentSearchParams) return;

    currentPage += 1;
    const loadMoreText = document.getElementById('load-more-text');
    const loadMoreSpinner = document.getElementById('load-more-spinner');
    const loadMoreContainer = document.getElementById('load-more-container');

    btnLoadMore.disabled = true;
    loadMoreText.textContent = 'Agent Loading Next Batch...';
    loadMoreSpinner.classList.remove('hidden');

    try {
      const res = await fetch('/api/hunt-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentSearchParams, page: currentPage, limit: 15 })
      });
      const data = await res.json();

      if (data.success && data.leads && data.leads.length > 0) {
        allLeads = [...allLeads, ...data.leads];
        renderCards();

        if (!data.hasMore) {
          loadMoreContainer.classList.add('hidden');
        }
      } else {
        loadMoreContainer.classList.add('hidden');
      }
    } catch (e) {
      alert('Error fetching more leads.');
    } finally {
      btnLoadMore.disabled = false;
      loadMoreText.textContent = '📥 Load More Businesses (+15)';
      loadMoreSpinner.classList.add('hidden');
    }
  });
}

// Render Data i5 Cards (Only Show Fields If Available)
function renderCards() {
  const container = document.getElementById('leads-grid');
  const countBadge = document.getElementById('results-count-badge');
  if (!container) return;

  let filtered = allLeads;
  if (currentFilter === 'has-phone') {
    filtered = allLeads.filter(l => l.phone);
  } else if (currentFilter === 'has-web') {
    filtered = allLeads.filter(l => l.website);
  }

  countBadge.textContent = `${filtered.length} Leads Captured`;
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-400 text-xs font-semibold">
        No businesses match this filter. Select "All Verified" to view all records.
      </div>
    `;
    return;
  }

  filtered.forEach((lead, index) => {
    const card = document.createElement('div');
    card.className = 'spatial-card p-6 rounded-3xl flex flex-col justify-between space-y-4 card-appear';
    card.style.animationDelay = `${(index % 15) * 40}ms`;

    const cleanDigits = (lead.phone || '').replace(/[^0-9]/g, '');
    const whatsAppUrl = cleanDigits.length >= 7 ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(`Hello ${lead.name}, I found your business profile and wanted to connect.`)}` : null;

    // Dynamically build info rows (ONLY for fields that actually exist)
    let infoRows = '';

    if (lead.phone) {
      infoRows += `
        <div class="flex items-center justify-between py-1.5 bg-slate-50 px-3 rounded-xl border border-slate-100">
          <span class="text-slate-500 font-bold">📞 Phone:</span>
          <a href="tel:${lead.phone}" class="font-black text-slate-900 hover:text-blue-600 transition">${lead.phone}</a>
        </div>
      `;
    }

    if (lead.website) {
      infoRows += `
        <div class="flex items-center justify-between py-1.5 bg-slate-50 px-3 rounded-xl border border-slate-100">
          <span class="text-slate-500 font-bold">🌐 Website:</span>
          <a href="${lead.website}" target="_blank" class="font-bold text-blue-600 hover:underline truncate max-w-[190px]">${lead.website.replace('https://', '').replace('http://', '')}</a>
        </div>
      `;
    }

    if (lead.email) {
      infoRows += `
        <div class="flex items-center justify-between py-1.5 bg-slate-50 px-3 rounded-xl border border-slate-100">
          <span class="text-slate-500 font-bold">✉️ Email:</span>
          <span class="font-mono-code text-[11px] font-bold text-slate-800 truncate max-w-[190px]">${lead.email}</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-2 mb-2">
          <span class="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
            ${lead.niche}
          </span>
          <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            ✓ ${lead.location}
          </span>
        </div>

        <h3 class="font-black text-slate-900 text-base leading-snug tracking-tight">
          ${lead.name}
        </h3>

        <p class="text-xs text-slate-500 mt-2 flex items-start leading-relaxed">
          <span class="mr-1.5 text-blue-600 mt-0.5">📍</span>
          <span><strong>Address:</strong> ${lead.fullAddress}</span>
        </p>

        <!-- Google Maps Link -->
        <div class="mt-2.5">
          <a href="${lead.googleMapsUrl}" target="_blank" class="inline-flex items-center space-x-1.5 text-[11px] font-black text-blue-600 hover:text-blue-800 bg-blue-50/90 px-3 py-1.5 rounded-xl border border-blue-200 transition">
            <span>🗺️ Open Full Google Maps Profile</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      <!-- Info Matrix (Only rendered if attributes actually exist) -->
      ${infoRows ? `
        <div class="space-y-2 pt-2 border-t border-slate-100 text-xs">
          ${infoRows}
        </div>
      ` : `
        <div class="pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
          Registered Physical Business in ${lead.location}
        </div>
      `}

      <!-- Action Buttons -->
      <div class="pt-2 grid grid-cols-2 gap-2">
        ${lead.phone && whatsAppUrl ? `
          <a href="${whatsAppUrl}" target="_blank" class="py-2.5 text-[11px] font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition text-center shadow-sm flex items-center justify-center space-x-1">
            <span>💬 WhatsApp</span>
          </a>
        ` : (lead.website ? `
          <a href="${lead.website}" target="_blank" class="py-2.5 text-[11px] font-black bg-slate-900 hover:bg-black text-white rounded-xl transition text-center shadow-sm flex items-center justify-center space-x-1">
            <span>🌐 Website</span>
          </a>
        ` : `
          <a href="${lead.googleSearchUrl}" target="_blank" class="py-2.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition text-center flex items-center justify-center space-x-1">
            <span>🔍 Google Details</span>
          </a>
        `)}

        ${lead.phone ? `
          <a href="tel:${lead.phone}" class="py-2.5 text-[11px] font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-center shadow-sm flex items-center justify-center space-x-1">
            <span>📞 Call Direct</span>
          </a>
        ` : `
          <a href="${lead.googleMapsUrl}" target="_blank" class="py-2.5 text-[11px] font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-center shadow-sm flex items-center justify-center space-x-1">
            <span>🗺️ View on Maps</span>
          </a>
        `}
      </div>
    `;

    container.appendChild(card);
  });
}

// Copy All Emails
const btnCopyEmails = document.getElementById('btn-copy-all-emails');
if (btnCopyEmails) {
  btnCopyEmails.addEventListener('click', () => {
    const emails = allLeads.map(l => l.email).filter(Boolean).join(', ');
    if (!emails) {
      alert('No email addresses found for this specific batch.');
      return;
    }
    navigator.clipboard.writeText(emails).then(() => {
      const orig = btnCopyEmails.innerHTML;
      btnCopyEmails.innerHTML = '<span>✅ Copied All Emails!</span>';
      setTimeout(() => btnCopyEmails.innerHTML = orig, 2000);
    });
  });
}

// Export CSV
const btnCsv = document.getElementById('btn-download-csv');
if (btnCsv) {
  btnCsv.addEventListener('click', () => {
    if (allLeads.length === 0) {
      alert('Please run a search first before exporting.');
      return;
    }
    window.location.href = '/api/export-csv';
  });
}

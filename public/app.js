let allLeads = [];
let currentFilter = 'all';
let currentPage = 1;
let currentSearchParams = null;
let currentViewMode = 'cards'; // 'cards' or 'table'
let activeWhatsAppLead = null;

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
      renderResults();
    });
  });

  // View Switcher (Cards vs Table)
  const btnCards = document.getElementById('view-mode-cards');
  const btnTable = document.getElementById('view-mode-table');
  if (btnCards && btnTable) {
    btnCards.addEventListener('click', () => {
      currentViewMode = 'cards';
      btnCards.className = 'px-2.5 py-1 rounded-md bg-white text-blue-700 shadow-xs font-bold';
      btnTable.className = 'px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 font-bold';
      document.getElementById('leads-grid').classList.remove('hidden');
      document.getElementById('leads-table-container').classList.add('hidden');
      renderResults();
    });

    btnTable.addEventListener('click', () => {
      currentViewMode = 'table';
      btnTable.className = 'px-2.5 py-1 rounded-md bg-white text-blue-700 shadow-xs font-bold';
      btnCards.className = 'px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 font-bold';
      document.getElementById('leads-grid').classList.add('hidden');
      document.getElementById('leads-table-container').classList.remove('hidden');
      renderResults();
    });
  }

  // Modals Listeners
  setupModals();
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
    speedBadge.textContent = 'Scanning...';
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
        renderResults();

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
      btnLabel.textContent = '🚀 Launch Autonomous Agent';
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
        renderResults();

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

// Unified Rendering Function (Renders Cards or Table)
function renderResults() {
  const countBadge = document.getElementById('results-count-badge');
  const navBadge = document.getElementById('nav-count-badge');
  
  let filtered = allLeads;
  if (currentFilter === 'has-phone') {
    filtered = allLeads.filter(l => l.phone);
  } else if (currentFilter === 'has-web') {
    filtered = allLeads.filter(l => l.website);
  }

  if (countBadge) countBadge.textContent = `${filtered.length} Leads Captured`;
  if (navBadge) navBadge.textContent = `${filtered.length}`;

  renderCardsView(filtered);
  renderTableView(filtered);
}

// 1. Render Cards View (Matching Image 3 Style)
function renderCardsView(filtered) {
  const container = document.getElementById('leads-grid');
  if (!container) return;
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-400 text-xs font-semibold saas-card rounded-2xl">
        No businesses match this filter. Select "All Verified" to view all records.
      </div>
    `;
    return;
  }

  filtered.forEach((lead, index) => {
    const card = document.createElement('div');
    card.className = 'saas-card p-5 rounded-2xl flex flex-col justify-between space-y-3.5 card-appear';
    card.style.animationDelay = `${(index % 15) * 35}ms`;

    const initials = lead.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'B2B';
    const cleanDigits = (lead.phone || '').replace(/[^0-9]/g, '');

    card.innerHTML = `
      <div>
        <!-- Card Header: Avatar & Category -->
        <div class="flex items-start justify-between gap-2 mb-2.5">
          <div class="flex items-center space-x-2.5 min-w-0">
            <div class="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-xs shrink-0 border border-blue-100">
              ${initials}
            </div>
            <div class="min-w-0">
              <h3 class="font-black text-slate-900 text-sm leading-snug tracking-tight truncate">${lead.name}</h3>
              <p class="text-[10px] text-emerald-700 font-bold flex items-center space-x-1">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span>Verified Business</span>
              </p>
            </div>
          </div>
          <span class="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 rounded-md border border-slate-200 shrink-0">
            ${lead.niche}
          </span>
        </div>

        <!-- Address & Google Maps Link -->
        <p class="text-[11px] text-slate-500 flex items-start leading-relaxed mb-2.5">
          <span class="mr-1 text-blue-600">📍</span>
          <span class="line-clamp-2">${lead.fullAddress}</span>
        </p>

        <!-- Google Maps Profile Link -->
        <div>
          <a href="${lead.googleMapsUrl}" target="_blank" class="inline-flex items-center space-x-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-200 transition">
            <span>🗺️ Google Maps Profile</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      <!-- Info Matrix -->
      <div class="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
        ${lead.phone ? `
          <div class="flex items-center justify-between py-1 px-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <span class="text-slate-400 font-bold text-[10px]">📞 Phone:</span>
            <a href="tel:${lead.phone}" class="font-extrabold text-slate-900 hover:text-blue-600 transition text-[11px] font-mono-code">${lead.phone}</a>
          </div>
        ` : ''}

        ${lead.website ? `
          <div class="flex items-center justify-between py-1 px-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <span class="text-slate-400 font-bold text-[10px]">🌐 Website:</span>
            <a href="${lead.website}" target="_blank" class="font-bold text-blue-600 hover:underline truncate max-w-[170px] text-[11px]">${lead.website.replace('https://', '').replace('http://', '')}</a>
          </div>
        ` : ''}

        ${lead.email ? `
          <div class="flex items-center justify-between py-1 px-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <span class="text-slate-400 font-bold text-[10px]">✉️ Email:</span>
            <span class="font-mono-code text-[10px] font-bold text-slate-800 truncate max-w-[170px]">${lead.email}</span>
          </div>
        ` : ''}
      </div>

      <!-- Action Buttons Row (WhatsApp, Call, Website) -->
      <div class="pt-2 grid grid-cols-2 gap-2">
        ${cleanDigits.length >= 7 ? `
          <button onclick="openWhatsAppModal(${lead.id})" class="py-2 px-3 text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition text-center shadow-xs flex items-center justify-center space-x-1">
            <span>💬 WhatsApp Chat</span>
          </button>
        ` : (lead.website ? `
          <a href="${lead.website}" target="_blank" class="py-2 px-3 text-[11px] font-bold bg-slate-800 hover:bg-black text-white rounded-xl transition text-center shadow-xs flex items-center justify-center space-x-1">
            <span>🌐 Website</span>
          </a>
        ` : `
          <a href="${lead.googleSearchUrl}" target="_blank" class="py-2 px-3 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition text-center">
            <span>🔍 Details</span>
          </a>
        `)}

        ${lead.phone ? `
          <a href="tel:${lead.phone}" class="py-2 px-3 text-[11px] font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-center shadow-xs flex items-center justify-center space-x-1">
            <span>📞 Call Direct</span>
          </a>
        ` : `
          <a href="${lead.googleMapsUrl}" target="_blank" class="py-2 px-3 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition text-center border border-blue-200">
            <span>🗺️ Maps View</span>
          </a>
        `}
      </div>
    `;

    container.appendChild(card);
  });
}

// 2. Render Table Spreadsheet View (Matching Image 1 Style)
function renderTableView(filtered) {
  const tbody = document.getElementById('leads-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No leads available for this view.</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const cleanDigits = (lead.phone || '').replace(/[^0-9]/g, '');
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono-code text-slate-400 font-bold">${lead.id}</td>
      <td class="py-3 px-4 font-bold text-slate-900">${lead.name}</td>
      <td class="py-3 px-4">
        ${lead.phone ? `
          <div class="flex items-center space-x-2">
            <a href="tel:${lead.phone}" class="font-mono-code font-bold text-slate-800 hover:text-blue-600">${lead.phone}</a>
            ${cleanDigits.length >= 7 ? `
              <button onclick="openWhatsAppModal(${lead.id})" class="px-2 py-0.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-[10px] font-bold rounded-md">💬 WA</button>
            ` : ''}
          </div>
        ` : '<span class="text-slate-400">N/A</span>'}
      </td>
      <td class="py-3 px-4 font-mono-code text-[11px]">
        ${lead.email ? `<span class="text-slate-800 font-semibold">${lead.email}</span>` : '<span class="text-slate-400">N/A</span>'}
      </td>
      <td class="py-3 px-4">
        ${lead.website ? `
          <a href="${lead.website}" target="_blank" class="text-blue-600 hover:underline font-bold truncate max-w-[140px] block">${lead.website.replace('https://', '').replace('http://', '')}</a>
        ` : '<span class="text-slate-400">N/A</span>'}
      </td>
      <td class="py-3 px-4 text-slate-500 truncate max-w-[180px]">${lead.fullAddress}</td>
      <td class="py-3 px-4 text-right">
        <a href="${lead.googleMapsUrl}" target="_blank" class="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 inline-block">Maps ↗</a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. Modals Management (Image 1 CSV Modal & Image 3 WhatsApp Modal)
function setupModals() {
  // CSV Preview Modal Listeners
  const csvModal = document.getElementById('csv-preview-modal');
  const btnOpenCsv = document.getElementById('btn-download-csv');
  const btnNavCsv = document.getElementById('nav-open-csv-modal');
  const btnCloseCsv = document.getElementById('btn-close-csv-modal');
  const btnCancelCsv = document.getElementById('btn-cancel-csv');
  const btnConfirmCsv = document.getElementById('btn-confirm-download-csv');

  function openCsvModal() {
    if (allLeads.length === 0) {
      alert('Please run a search first to capture leads before exporting.');
      return;
    }
    const tbody = document.getElementById('csv-preview-table-body');
    const subtitle = document.getElementById('csv-modal-subtitle');
    const countLabel = document.getElementById('csv-modal-count');

    if (subtitle) subtitle.textContent = `Exporting ${allLeads.length} leads from 'Data i5' intelligence engine`;
    if (countLabel) countLabel.textContent = `Total Leads: ${allLeads.length} | File Format: CSV`;

    if (tbody) {
      tbody.innerHTML = '';
      allLeads.slice(0, 10).forEach(l => {
        const cleanDigits = (l.phone || '').replace(/[^0-9]/g, '');
        const waLink = cleanDigits.length >= 7 ? `wa.me/${cleanDigits}` : 'N/A';
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100';
        tr.innerHTML = `
          <td class="py-2 px-3 font-sans font-bold text-slate-900">${l.name}</td>
          <td class="py-2 px-3">${l.phone || 'N/A'}</td>
          <td class="py-2 px-3 text-emerald-600 font-bold">${waLink}</td>
          <td class="py-2 px-3 text-slate-700">${l.email || 'N/A'}</td>
          <td class="py-2 px-3 text-blue-600 truncate max-w-[130px]">${l.website || 'N/A'}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    if (csvModal) csvModal.classList.remove('hidden');
  }

  function closeCsvModal() {
    if (csvModal) csvModal.classList.add('hidden');
  }

  if (btnOpenCsv) btnOpenCsv.addEventListener('click', openCsvModal);
  if (btnNavCsv) btnNavCsv.addEventListener('click', (e) => { e.preventDefault(); openCsvModal(); });
  if (btnCloseCsv) btnCloseCsv.addEventListener('click', closeCsvModal);
  if (btnCancelCsv) btnCancelCsv.addEventListener('click', closeCsvModal);
  if (btnConfirmCsv) {
    btnConfirmCsv.addEventListener('click', () => {
      window.location.href = '/api/export-csv';
      closeCsvModal();
    });
  }

  // WhatsApp Modal Listeners
  const waModal = document.getElementById('whatsapp-pitch-modal');
  const btnCloseWa = document.getElementById('btn-close-whatsapp-modal');
  const btnCancelWa = document.getElementById('btn-cancel-whatsapp');
  const btnLaunchWa = document.getElementById('btn-launch-whatsapp');

  function closeWaModal() {
    if (waModal) waModal.classList.add('hidden');
  }

  if (btnCloseWa) btnCloseWa.addEventListener('click', closeWaModal);
  if (btnCancelWa) btnCancelWa.addEventListener('click', closeWaModal);
  if (btnLaunchWa) {
    btnLaunchWa.addEventListener('click', () => {
      if (!activeWhatsAppLead) return;
      const text = document.getElementById('wa-pitch-text').value;
      const cleanDigits = (activeWhatsAppLead.phone || '').replace(/[^0-9]/g, '');
      const url = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      closeWaModal();
    });
  }
}

// Global helper to open WhatsApp Modal (Image 3 Style)
window.openWhatsAppModal = function(id) {
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;
  activeWhatsAppLead = lead;

  const modal = document.getElementById('whatsapp-pitch-modal');
  const nameEl = document.getElementById('wa-modal-lead-name');
  const phoneEl = document.getElementById('wa-modal-phone');
  const textarea = document.getElementById('wa-pitch-text');

  if (nameEl) nameEl.textContent = lead.name;
  if (phoneEl) phoneEl.textContent = lead.phone || 'WhatsApp Verified';
  if (textarea) {
    textarea.value = `Hi ${lead.name}! 👋\n\nI found your business profile while researching top ${lead.niche} providers in ${lead.location}.\n\nWould you be open to a quick 5-minute conversation this week on how we can help you scale your client pipeline?\n\nBest,\nVoltara Agency Team`;
  }

  if (modal) modal.classList.remove('hidden');
};

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

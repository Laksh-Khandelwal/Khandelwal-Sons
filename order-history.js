/**
 * Order History page
 * Loads the full order log from the backend API (Supabase-backed) and renders
 * a systematic, searchable and date-sortable table for the shop owner.
 * Reuses the same server-side owner authentication as the main dashboard.
 */

// State
let allOrders = [];
let searchTerm = '';
let sortMode = 'date-desc';
let statusFilter = 'all';
let fromDate = '';
let toDate = '';

const formatCurrency = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(value);

// Owner auth (same keys as the main dashboard so login carries over)
const ownerKey = () => localStorage.getItem('dd_owner_key') || sessionStorage.getItem('dd_owner_key') || '';
const authHeaders = () => ({ 'x-owner-key': ownerKey(), 'Content-Type': 'application/json' });

// DOM
const adminAuthOverlay = document.getElementById('admin-auth-overlay');
const adminAuthForm = document.getElementById('admin-auth-form');
const btnAdminLogout = document.getElementById('btn-admin-logout');

const searchInput = document.getElementById('hist-search');
const sortSelect = document.getElementById('hist-sort');
const statusSelect = document.getElementById('hist-status');
const fromInput = document.getElementById('hist-from');
const toInput = document.getElementById('hist-to');
const resetBtn = document.getElementById('hist-reset');

const tbody = document.getElementById('history-tbody');
const tableEl = document.getElementById('history-table');
const emptyEl = document.getElementById('history-empty');

const statTotalOrders = document.getElementById('hist-total-orders');
const statTotalRevenue = document.getElementById('hist-total-revenue');
const statShowing = document.getElementById('hist-showing');

const toastNotification = document.getElementById('toast-notification');

// Init
document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  if (ownerKey()) loadOrders();
  setupEventListeners();
});

function checkAdminAuth() {
  const unlocked = Boolean(ownerKey());
  if (!adminAuthOverlay) return;
  if (unlocked) {
    adminAuthOverlay.style.opacity = '0';
    adminAuthOverlay.style.visibility = 'hidden';
  } else {
    adminAuthOverlay.style.opacity = '1';
    adminAuthOverlay.style.visibility = 'visible';
    adminAuthOverlay.style.display = 'flex';
  }
}

// Load orders from the backend API
async function loadOrders() {
  try {
    const res = await fetch('/api/owner/orders', { headers: authHeaders() });
    if (res.status === 401) {
      localStorage.removeItem('dd_owner_key'); sessionStorage.removeItem('dd_owner_key');
      checkAdminAuth();
      return;
    }
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to load orders');

    allOrders = (data.orders || []).map(row => {
      const rawDate = row.created_at || row.placed_at;
      const dateObj = new Date(rawDate);
      return {
        id: row.id,
        dateObj: isNaN(dateObj.getTime()) ? null : dateObj,
        displayTime: row.placed_at || row.created_at || '—',
        username: row.username,
        customer: row.customer || {},
        items: Array.isArray(row.items) ? row.items : [],
        total: Number(row.total) || 0,
        status: row.status || 'Pending'
      };
    });

    render();
  } catch (err) {
    console.error('Failed to load orders:', err);
    showToast('Could not load orders: ' + err.message);
  }
}

// Build the searchable text blob for an order
function searchBlob(order) {
  const itemNames = order.items.map(i => i.name).join(' ');
  return [
    order.id,
    order.username,
    order.customer.name,
    order.customer.phone,
    order.customer.address,
    order.status,
    itemNames
  ].filter(Boolean).join(' ').toLowerCase();
}

function dayStart(str) {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function applyFilters() {
  const term = searchTerm.trim().toLowerCase();
  const from = dayStart(fromDate);
  const to = dayStart(toDate);
  if (to) to.setHours(23, 59, 59, 999);

  let rows = allOrders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (term && !searchBlob(order).includes(term)) return false;
    if (from && (!order.dateObj || order.dateObj < from)) return false;
    if (to && (!order.dateObj || order.dateObj > to)) return false;
    return true;
  });

  const time = o => (o.dateObj ? o.dateObj.getTime() : 0);
  rows.sort((a, b) => {
    switch (sortMode) {
      case 'date-asc': return time(a) - time(b);
      case 'total-desc': return b.total - a.total;
      case 'total-asc': return a.total - b.total;
      case 'date-desc':
      default: return time(b) - time(a);
    }
  });

  return rows;
}

function statusClass(status) {
  return 'status-' + String(status).toLowerCase().replace(/\s+/g, '-');
}

function render() {
  // Overall summary (whole log, not just filtered)
  const totalRevenue = allOrders.reduce((s, o) => s + o.total, 0);
  statTotalOrders.textContent = allOrders.length;
  statTotalRevenue.textContent = formatCurrency(totalRevenue);

  const rows = applyFilters();
  statShowing.textContent = rows.length;

  if (rows.length === 0) {
    tableEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    tbody.innerHTML = '';
    return;
  }

  tableEl.style.display = '';
  emptyEl.style.display = 'none';

  tbody.innerHTML = rows.map(order => {
    const itemCount = order.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const itemTitle = order.items.map(i => `${i.name} ×${i.quantity}`).join(', ')
      .replace(/"/g, '&quot;');
    const userTag = order.username && order.username !== 'Guest'
      ? ` <span class="hist-user">(${order.username})</span>` : '';
    return `
      <tr>
        <td class="hist-id">${order.id}</td>
        <td class="hist-date">${order.displayTime}</td>
        <td>
          <div class="hist-cust-name">${(order.customer.name || '—')}${userTag}</div>
          <div class="hist-cust-phone">${order.customer.phone || ''}</div>
        </td>
        <td class="num" title="${itemTitle}">${itemCount}</td>
        <td class="num hist-total">${formatCurrency(order.total)}</td>
        <td><span class="hist-status-badge ${statusClass(order.status)}">${order.status}</span></td>
      </tr>
    `;
  }).join('');
}

function setupEventListeners() {
  if (adminAuthForm) {
    adminAuthForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = document.getElementById('admin-password').value;
      try {
        const res = await fetch('/api/owner/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (data.ok) {
          localStorage.setItem('dd_owner_key', pwd);
          showToast('Admin access unlocked!');
          checkAdminAuth();
          loadOrders();
        } else {
          showToast('Access Denied. Incorrect Password.');
        }
      } catch (err) {
        showToast('Could not reach the server. Is the backend running?');
      }
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      localStorage.removeItem('dd_owner_key'); sessionStorage.removeItem('dd_owner_key');
      showToast('Admin console locked.');
      checkAdminAuth();
    });
  }

  if (searchInput) searchInput.addEventListener('input', (e) => { searchTerm = e.target.value; render(); });
  if (sortSelect) sortSelect.addEventListener('change', (e) => { sortMode = e.target.value; render(); });
  if (statusSelect) statusSelect.addEventListener('change', (e) => { statusFilter = e.target.value; render(); });
  if (fromInput) fromInput.addEventListener('change', (e) => { fromDate = e.target.value; render(); });
  if (toInput) toInput.addEventListener('change', (e) => { toDate = e.target.value; render(); });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      searchTerm = ''; sortMode = 'date-desc'; statusFilter = 'all'; fromDate = ''; toDate = '';
      if (searchInput) searchInput.value = '';
      if (sortSelect) sortSelect.value = 'date-desc';
      if (statusSelect) statusSelect.value = 'all';
      if (fromInput) fromInput.value = '';
      if (toInput) toInput.value = '';
      render();
    });
  }
}

function showToast(message) {
  if (!toastNotification) return;
  const textEl = toastNotification.querySelector('.toast-text');
  if (textEl) textEl.textContent = message;
  toastNotification.classList.add('show');
  setTimeout(() => toastNotification.classList.remove('show'), 3500);
}

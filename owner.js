/**
 * Owner Dashboard script
 * Fetches orders from the backend API (Supabase-backed), so the dashboard
 * works from any computer. Handles status updates, polling with chime
 * notifications, analytics, and server-side owner authentication.
 */

// State Management
let orders = [];
let soundEnabled = true;
let filterStatus = 'all';
let knownOrderIds = null; // used to detect new orders between polls
const POLL_INTERVAL_MS = 15000;

const formatCurrency = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(value);

// localStorage (not sessionStorage) so the owner stays signed in on this device
const ownerKey = () => localStorage.getItem('dd_owner_key') || sessionStorage.getItem('dd_owner_key') || '';
const authHeaders = () => ({ 'x-owner-key': ownerKey(), 'Content-Type': 'application/json' });

// DOM Elements
const ordersList = document.getElementById('orders-list');
const orderFilterStatus = document.getElementById('order-filter-status');
const btnClearOrders = document.getElementById('btn-clear-orders');
const soundToggle = document.getElementById('sound-toggle');

// Admin Auth DOM Elements
const adminAuthOverlay = document.getElementById('admin-auth-overlay');
const adminAuthForm = document.getElementById('admin-auth-form');
const btnAdminLogout = document.getElementById('btn-admin-logout');

// Stat Elements
const statsRevenue = document.getElementById('stats-revenue');
const statsOrdersCount = document.getElementById('stats-orders-count');
const statsItemsCount = document.getElementById('stats-items-count');
const statsAov = document.getElementById('stats-aov');

// Chart Elements
const chartValDairy = document.getElementById('chart-val-dairy');
const chartValSweets = document.getElementById('chart-val-sweets');
const chartBarDairy = document.getElementById('chart-bar-dairy');
const chartBarSweets = document.getElementById('chart-bar-sweets');

const toastNotification = document.getElementById('toast-notification');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  if (ownerKey()) loadOrders();
  setupEventListeners();
  setInterval(() => { if (ownerKey()) loadOrders({ silent: true }); }, POLL_INTERVAL_MS);

  // Synthesize a dummy sound context on user interaction
  document.body.addEventListener('click', initAudioContext, { once: true });
});

// Show/hide the login overlay depending on session state
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

// Web Audio API Chime Synthesizer
let audioCtx = null;
function initAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext) {
    audioCtx = new AudioContext();
  }
}

function playNotificationChime() {
  if (!soundEnabled) return;

  try {
    if (!audioCtx) {
      initAudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (!audioCtx) return;

    const t = audioCtx.currentTime;

    // Tone 1 (Warm Root Chime)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, t); // C5
    osc1.frequency.exponentialRampToValueAtTime(880.00, t + 0.15); // A5
    gain1.gain.setValueAtTime(0.15, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    // Tone 2 (Sweet Overtone)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, t + 0.05); // E5
    osc2.frequency.exponentialRampToValueAtTime(1046.50, t + 0.2); // C6
    gain2.gain.setValueAtTime(0.1, t + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc1.start(t);
    osc1.stop(t + 0.8);

    osc2.start(t + 0.05);
    osc2.stop(t + 0.65);

  } catch (e) {
    console.warn("Failed to play synthesized notification chime: ", e);
  }
}

// Load orders from the backend API
async function loadOrders({ silent = false } = {}) {
  try {
    const res = await fetch('/api/owner/orders', { headers: authHeaders() });
    if (res.status === 401) {
      localStorage.removeItem("dd_owner_key"); sessionStorage.removeItem("dd_owner_key");
      checkAdminAuth();
      return;
    }
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to load orders');

    const fetched = (data.orders || []).map(row => ({
      id: row.id,
      timestamp: row.placed_at || row.created_at,
      username: row.username,
      customer: row.customer,
      items: row.items,
      total: Number(row.total),
      status: row.status
    }));

    // Chime when new orders appear (skip the very first load)
    if (knownOrderIds !== null) {
      const fresh = fetched.filter(o => !knownOrderIds.has(o.id));
      if (fresh.length > 0) {
        playNotificationChime();
        showToast(`New order received! ID: ${fresh[0].id}`);
      }
    }
    knownOrderIds = new Set(fetched.map(o => o.id));

    orders = fetched;
    renderOrders();
    calculateStats();
  } catch (err) {
    console.error('Failed to load orders:', err);
    if (!silent) showToast('Could not load orders: ' + err.message);
  }
}

// Render list of orders
function renderOrders() {
  if (!ordersList) return;

  const filteredOrders = orders.filter(order => {
    return filterStatus === 'all' || order.status === filterStatus;
  });

  ordersList.innerHTML = '';

  if (filteredOrders.length === 0) {
    ordersList.innerHTML = `
      <div class="no-orders">
        <div class="no-orders-icon">📋</div>
        <h3>No Orders Logged</h3>
        <p>Active customer checkout orders will appear here automatically.</p>
      </div>
    `;
    return;
  }

  filteredOrders.forEach((order, index) => {
    const card = document.createElement('div');
    const isNewest = index === 0 && (Date.now() - new Date(order.timestamp).getTime() < 12000);
    card.className = `order-card ${isNewest ? 'new-alert' : ''}`;
    card.id = `order-${order.id}`;

    let itemRows = '';
    order.items.forEach(item => {
      itemRows += `
        <tr>
          <td>${item.name} <span style="color: var(--text-muted); font-size: 0.8rem;">(per ${item.unit})</span></td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatCurrency(item.price)}</td>
          <td class="num">${formatCurrency(item.price * item.quantity)}</td>
        </tr>
      `;
    });

    // Resolve customer tag (username or Guest)
    const userTag = order.username ? `<span style="font-weight: normal; color: var(--text-muted); font-size: 0.8rem;"> (User: ${order.username})</span>` : '';

    card.innerHTML = `
      <div class="order-card-header">
        <div class="order-id-time">
          <span class="order-id">${order.id}</span>
          <span class="order-time">${order.timestamp}</span>
        </div>
        <div class="order-controls">
          <select class="order-status-select" data-id="${order.id}" aria-label="Change status">
            <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Preparing" ${order.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
            <option value="Out for Delivery" ${order.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
            <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
          <button class="btn-delete-order" data-id="${order.id}" title="Remove Order Log">✕</button>
        </div>
      </div>
      <div class="order-card-body">
        <div class="customer-detail-row"><span>Customer:</span>${order.customer.name}${userTag}</div>
        <div class="customer-detail-row"><span>Contact:</span>${order.customer.phone}</div>
        <div class="customer-detail-row"><span>Address:</span>${order.customer.address}</div>
        <div class="customer-detail-row"><span>Preferred:</span>${order.customer.deliveryTime}</div>

        <table class="order-items-table">
          <thead>
            <tr>
              <th>Item Details</th>
              <th class="num" style="width: 50px;">Qty</th>
              <th class="num" style="width: 80px;">Rate</th>
              <th class="num" style="width: 100px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            <tr class="total-row">
              <td colspan="2"></td>
              <td class="num" style="font-weight: 600;">Total:</td>
              <td class="num">${formatCurrency(order.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    ordersList.appendChild(card);
  });

  ordersList.querySelectorAll('.order-status-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const orderId = select.getAttribute('data-id');
      const newStatus = e.target.value;
      updateOrderStatus(orderId, newStatus);
    });
  });

  ordersList.querySelectorAll('.btn-delete-order').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-id');
      deleteOrder(orderId);
    });
  });
}

// Update Order Status (persisted on the server)
async function updateOrderStatus(orderId, status) {
  const index = orders.findIndex(o => o.id === orderId);
  if (index === -1) return;

  const previous = orders[index].status;
  orders[index].status = status;
  calculateStats();

  try {
    const res = await fetch(`/api/owner/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Update failed');
    showToast(`Order ${orderId} updated to ${status}`);
  } catch (err) {
    orders[index].status = previous;
    renderOrders();
    calculateStats();
    showToast('Could not update order: ' + err.message);
  }
}

// Delete Order Log (persisted on the server)
async function deleteOrder(orderId) {
  try {
    const res = await fetch(`/api/owner/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Delete failed');

    orders = orders.filter(o => o.id !== orderId);
    knownOrderIds = new Set(orders.map(o => o.id));
    renderOrders();
    calculateStats();
    showToast(`Order ${orderId} removed`);
  } catch (err) {
    showToast('Could not remove order: ' + err.message);
  }
}

// Calculate Analytics Dashboard Stats
function calculateStats() {
  if (orders.length === 0) {
    statsRevenue.textContent = formatCurrency(0);
    statsOrdersCount.textContent = '0';
    statsItemsCount.textContent = '0';
    statsAov.textContent = formatCurrency(0);

    chartValDairy.textContent = '0%';
    chartValSweets.textContent = '0%';
    chartBarDairy.style.width = '0%';
    chartBarSweets.style.width = '0%';
    return;
  }

  const totalCount = orders.length;
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);

  let itemsSold = 0;
  let dairyItems = 0;
  let sweetsItems = 0;

  orders.forEach(order => {
    order.items.forEach(item => {
      itemsSold += item.quantity;
      if (item.category === 'frozen') {
        sweetsItems += item.quantity;
      } else {
        dairyItems += item.quantity;
      }
    });
  });

  const aov = revenue / totalCount;

  statsRevenue.textContent = formatCurrency(revenue);
  statsOrdersCount.textContent = totalCount;
  statsItemsCount.textContent = itemsSold;
  statsAov.textContent = formatCurrency(aov);

  const totalCategoryQty = dairyItems + sweetsItems;
  if (totalCategoryQty > 0) {
    const dairyPercentage = Math.round((dairyItems / totalCategoryQty) * 100);
    const sweetsPercentage = Math.round((sweetsItems / totalCategoryQty) * 100);

    chartValDairy.textContent = `${dairyPercentage}%`;
    chartValSweets.textContent = `${sweetsPercentage}%`;

    chartBarDairy.style.width = `${dairyPercentage}%`;
    chartBarSweets.style.width = `${sweetsPercentage}%`;
  } else {
    chartValDairy.textContent = '0%';
    chartValSweets.textContent = '0%';
    chartBarDairy.style.width = '0%';
    chartBarSweets.style.width = '0%';
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Handle Admin Password unlock (verified server-side)
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
          localStorage.setItem("dd_owner_key", pwd);
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

  // Handle Admin Logout
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      localStorage.removeItem("dd_owner_key"); sessionStorage.removeItem("dd_owner_key");
      showToast('Admin console locked.');
      checkAdminAuth();
    });
  }

  // Clear all orders
  if (btnClearOrders) {
    btnClearOrders.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to clear all order logs? This will reset all analytics.')) return;
      try {
        const res = await fetch('/api/owner/orders', { method: 'DELETE', headers: authHeaders() });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Clear failed');
        orders = [];
        knownOrderIds = new Set();
        renderOrders();
        calculateStats();
        showToast('All order logs cleared');
      } catch (err) {
        showToast('Could not clear orders: ' + err.message);
      }
    });
  }

  // Filter Status
  if (orderFilterStatus) {
    orderFilterStatus.addEventListener('change', (e) => {
      filterStatus = e.target.value;
      renderOrders();
    });
  }

  // Sound Toggle
  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundToggle.classList.toggle('muted', !soundEnabled);
      soundToggle.textContent = soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      showToast(soundEnabled ? 'Order notification chimes enabled' : 'Sound notifications muted');
    });
  }
}

// Toast Notification
function showToast(message) {
  if (!toastNotification) return;

  const textEl = toastNotification.querySelector('.toast-text');
  if (textEl) textEl.textContent = message;

  toastNotification.classList.add('show');

  setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 3500);
}

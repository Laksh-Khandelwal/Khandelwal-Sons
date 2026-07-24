/**
 * Khandelwal & Sons storefront script
 * Handles catalog rendering, cart operations, user authentication, profile settings, and order history sync
 */


const CATEGORY_DETAILS = {
  dairy: { label: 'Dairy & Cheese', image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=700&q=80' },
  beverages: { label: 'Milk & Beverages', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=700&q=80' },
  frozen: { label: 'Frozen & Ready-to-Cook', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=80' },
  snacks: { label: 'Snacks & Chocolates', image: 'https://images.unsplash.com/photo-1599599810694-b5b37304c041?auto=format&fit=crop&w=700&q=80' },
  sweets: { label: 'Sweets', image: 'https://images.unsplash.com/photo-1589119908995-c6837fa14848?auto=format&fit=crop&w=700&q=80' },
  bakery: { label: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80' },
  ingredients: { label: 'Cooking Ingredients', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=700&q=80' }
};

// Live catalog — loaded from the backend (Supabase) instead of a hardcoded list,
// so the shop owner can add/edit products from the admin page without a redeploy.
let PRODUCTS = [];

// Neutral placeholder shown if a product image fails to load (missing file, bad URL…).
const IMG_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='140'><rect width='100%' height='100%' fill='#FBF9F6'/><text x='50%' y='45%' font-size='30' text-anchor='middle' dominant-baseline='middle'>🛍️</text><text x='50%' y='72%' font-size='11' fill='#9C948D' font-family='sans-serif' text-anchor='middle'>Image coming soon</text></svg>"
);
// The load 'error' event doesn't bubble, so listen in the capture phase to catch
// any product image that fails and swap it for the placeholder.
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.classList.contains('product-img') && t.dataset.fallback !== '1') {
    t.dataset.fallback = '1';
    t.src = IMG_PLACEHOLDER;
  }
}, true);

// Compute the derived fields the UI expects (min price + unit label) for a product.
function shapeProduct(p) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    image: p.image,
    variants,
    tags: Array.isArray(p.tags) ? p.tags : [],
    price: variants.length ? Math.min(...variants.map(v => Number(v.price) || 0)) : 0,
    unit: variants.length === 1 ? variants[0].size : 'multiple sizes'
  };
}

// Fetch the catalog from the API, retrying briefly in case the server is waking up.
async function loadProducts() {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.products)) throw new Error(data.error || 'Failed to load products');
      PRODUCTS = data.products.map(shapeProduct);
      return true;
    } catch (err) {
      console.error('Failed to load products (attempt ' + attempt + '):', err);
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1500));
    }
  }
  PRODUCTS = [];
  return false;
}


const formatCurrency = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(value);

// App State
let cart = [];
let currentCategory = 'all';
let searchQuery = '';

// DOM Elements
const productsGrid = document.getElementById('products-grid');
const searchInput = document.getElementById('search-input');
const filterTabs = document.querySelectorAll('.filter-tab');
const cartDrawer = document.getElementById('cart-drawer');
const cartToggle = document.getElementById('cart-toggle');
const cartClose = document.getElementById('cart-close');
const cartItemsContainer = document.getElementById('cart-items');
const cartCountBadges = document.querySelectorAll('.cart-count');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartTotal = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutModal = document.getElementById('checkout-modal');
const modalClose = document.getElementById('modal-close');
const checkoutForm = document.getElementById('checkout-form');
const toastNotification = document.getElementById('toast-notification');

// User Login DOM Elements
const navLoginBtn = document.getElementById('nav-login-btn');
const navUserDropdown = document.getElementById('nav-user-dropdown');
const dropdownProfileBtn = document.getElementById('dropdown-profile-btn');
const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');
const loginModal = document.getElementById('login-modal');
const loginModalClose = document.getElementById('login-modal-close');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginModalTitle = document.getElementById('login-modal-title');
const resetForm = document.getElementById('reset-form');
const btnForgotPassword = document.getElementById('btn-forgot-password');
const btnBackToLogin = document.getElementById('btn-back-to-login');
const cartBottomBar = document.getElementById('cart-bottom-bar');
const cartBarSummary = document.getElementById('cart-bar-summary');

// Profile Dashboard DOM Elements
const profileModal = document.getElementById('profile-modal');
const profileModalClose = document.getElementById('profile-modal-close');
const tabProfileSettings = document.getElementById('tab-profile-settings');
const tabProfileHistory = document.getElementById('tab-profile-history');
const panelProfileSettings = document.getElementById('panel-profile-settings');
const panelProfileHistory = document.getElementById('panel-profile-history');
const profileSettingsForm = document.getElementById('profile-settings-form');
const profileUsernameInput = document.getElementById('profile-username');
const profileNameInput = document.getElementById('profile-name');
const profilePhoneInput = document.getElementById('profile-phone');
const profileAddressInput = document.getElementById('profile-address');
const profileOrdersList = document.getElementById('profile-orders-list');
const profileOrderSearch = document.getElementById('profile-order-search');
const profileOrderSort = document.getElementById('profile-order-sort');

// User order-history view state
let currentUserOrders = [];
let userOrderSearch = '';
let userOrderSort = 'date-desc';
const sizeModal = document.getElementById('size-modal');
const sizeModalClose = document.getElementById('size-modal-close');
const sizeProductTitle = document.getElementById('size-product-title');
const sizeOptions = document.getElementById('size-options');
const sizeConfirmBtn = document.getElementById('size-confirm-btn');
let pendingProduct = null;

// Reorder ("Order Again") DOM Elements
const reorderSection = document.getElementById('reorder-section');
const reorderUserName = document.getElementById('reorder-user-name');
const reorderFrequentGrid = document.getElementById('reorder-frequent-grid');
const reorderLastGrid = document.getElementById('reorder-last-grid');
const reorderLastMeta = document.getElementById('reorder-last-meta');
const tabReorderFrequent = document.getElementById('tab-reorder-frequent');
const tabReorderLast = document.getElementById('tab-reorder-last');
const btnReorderLast = document.getElementById('btn-reorder-last');
let lastOrderSnapshot = null;

// Initialize Website
document.addEventListener('DOMContentLoaded', async () => {
  initUsersDB();
  startHeroCarousel();
  renderCategoryCards();
  setupEventListeners();
  syncLoginUI();
  if (productsGrid) {
    productsGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:48px 16px;color:#9a8f80">Loading products…</p>';
  }
  await loadProducts();
  loadCartFromStorage();
  renderBestSellers();
  renderFrequentlyOrderedShowcase();
  renderCatalog();
});

// Initialize User Mock DB with a default testing user
function initUsersDB() {
  if (!localStorage.getItem('dairy_delights_users')) {
    const defaultUsers = [
      {
        username: 'user',
        password: 'password',
        name: 'Laksh Khandelwal',
        phone: '+91 98765 43210',
        address: '456 Sweets Street, Jaipur, Rajasthan'
      }
    ];
    localStorage.setItem('dairy_delights_users', JSON.stringify(defaultUsers));
  }
}

// Load Cart
function loadCartFromStorage() {
  const savedCart = localStorage.getItem('dairy_delights_cart');
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart).map(item => {
        const legacyIndex = String(item.id || '').replace('stock-', '');
        const product = PRODUCTS.find(candidate => candidate.variants.some(variant =>
          variant.id === item.id || variant.id === `variant-${legacyIndex}`
        ));
        const variant = product?.variants.find(candidate =>
          candidate.id === item.id || candidate.id === `variant-${legacyIndex}`
        );
        return product && variant ? {
          ...item,
          id: variant.id,
          name: product.name,
          category: product.category,
          image: product.image,
          price: variant.price,
          unit: variant.size
        } : item;
      });
      saveCartToStorage();
      updateCartUI();
    } catch (e) {
      cart = [];
    }
  }
}

// Save Cart
function saveCartToStorage() {
  localStorage.setItem('dairy_delights_cart', JSON.stringify(cart));
}

// Rotating photos of the shop in the hero section
function startHeroCarousel() {
  const slides = document.querySelectorAll('#hero-carousel img');
  if (slides.length < 2) return;
  let current = 0;
  setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }, 3500);
}

// Category cards above the catalog: clicking one applies that filter
function renderCategoryCards() {
  const wrap = document.getElementById('category-cards');
  if (!wrap) return;

  wrap.innerHTML = Object.entries(CATEGORY_DETAILS).map(([key, cat]) => `
    <button class="category-card-mini" data-category="${key}">
      <img src="${cat.image}" alt="${cat.label}" loading="lazy">
      <span>${cat.label}</span>
    </button>
  `).join('');

  wrap.querySelectorAll('.category-card-mini').forEach(card => {
    card.addEventListener('click', () => {
      const tab = document.querySelector(`.filter-tab[data-category="${card.dataset.category}"]`);
      if (tab) tab.click();
      document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// Best sellers: the shop's fastest-moving items (highest stock turnover)
function showcaseCardHtml(product) {
  return `
    <div class="product-card bestseller-card">
      <div class="product-img-wrapper">
        <img class="product-img" src="${product.image}" alt="${product.name}" loading="lazy">
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.name}</h3>
        <div class="product-footer">
          <div class="product-price-box">
            <span class="product-price">${formatCurrency(product.price)}</span>
          </div>
          <button class="btn-add-cart" aria-label="Add to cart" data-id="${product.id}">➕</button>
        </div>
      </div>
    </div>`;
}

function bindShowcaseAddButtons(row) {
  row.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', () => openSizePicker(btn.getAttribute('data-id')));
  });
}

function renderBestSellers() {
  const row = document.getElementById('best-sellers-grid');
  if (!row) return;
  // Owner-curated: show products tagged "bestseller"; if none tagged, fall back to top by stock.
  const tagged = PRODUCTS.filter(p => (p.tags || []).includes('bestseller'));
  const totalStock = p => p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  const list = tagged.length ? tagged : [...PRODUCTS].sort((a, b) => totalStock(b) - totalStock(a)).slice(0, 8);
  row.innerHTML = list.map(showcaseCardHtml).join('');
  bindShowcaseAddButtons(row);
}

// Owner-curated public "Frequently Ordered" row (tag-driven). Hidden if none tagged.
function renderFrequentlyOrderedShowcase() {
  const section = document.getElementById('frequently-ordered-showcase');
  const row = document.getElementById('frequently-ordered-grid');
  if (!section || !row) return;
  const list = PRODUCTS.filter(p => (p.tags || []).includes('frequently_ordered'));
  if (!list.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  row.innerHTML = list.map(showcaseCardHtml).join('');
  bindShowcaseAddButtons(row);
}

// Render catalog items
function renderCatalog() {
  if (!productsGrid) return;
  
  const filteredProducts = PRODUCTS.filter(product => {
    const matchesCategory = currentCategory === 'all' || product.category === currentCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  productsGrid.innerHTML = '';

  if (filteredProducts.length === 0) {
    productsGrid.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <h3>No Items Found</h3>
        <p>Try adjusting your search filters or searching for something else.</p>
      </div>
    `;
    return;
  }

  filteredProducts.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-img-wrapper">
        <img class="product-img" src="${product.image}" alt="${product.name}" loading="lazy">
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.name}</h3>
        <div class="product-footer">
          <div class="product-price-box">
            <span class="product-price">${formatCurrency(product.price)}</span>
          </div>
          <button class="btn-add-cart" aria-label="Add to cart" data-id="${product.id}">
            ➕
          </button>
        </div>
      </div>
    `;
    productsGrid.appendChild(card);
  });

  const addCartButtons = productsGrid.querySelectorAll('.btn-add-cart');
  addCartButtons.forEach(btn => {
    btn.addEventListener('click', () => openSizePicker(btn.getAttribute('data-id')));
  });
}

function openSizePicker(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  pendingProduct = product;
  sizeProductTitle.textContent = product.name;
  sizeOptions.innerHTML = product.variants.map(variant =>
    `<option value="${variant.id}">${variant.size} — ${formatCurrency(variant.price)}</option>`
  ).join('');
  sizeModal.classList.add('open');
}

// Shopping Cart Actions
function addToCart(productId, variantId, quantity = 1, options = {}) {
  const { silent = false, openDrawer = false } = options;
  const product = PRODUCTS.find(p => p.id === productId);
  const variant = product?.variants.find(item => item.id === variantId);
  if (!product || !variant) return false;

  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const existingItemIndex = cart.findIndex(item => item.id === variantId);

  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += qty;
  } else {
    cart.push({
      id: variant.id,
      name: product.name,
      category: product.category,
      image: product.image,
      price: variant.price,
      unit: variant.size,
      quantity: qty
    });
  }

  saveCartToStorage();
  updateCartUI();

  if (!silent) showToast(`Added ${product.name} to cart!`);

  if (openDrawer && cartDrawer && !cartDrawer.classList.contains('open')) {
    cartDrawer.classList.add('open');
  }

  return true;
}

// Resolve a stored order line item back to a live catalog product + variant
function resolveOrderItem(item) {
  const legacyIndex = String(item.id || '').replace('stock-', '');
  const matchesId = candidate => candidate.id === item.id || candidate.id === `variant-${legacyIndex}`;

  let product = PRODUCTS.find(p => p.variants.some(matchesId));
  let variant = product?.variants.find(matchesId);

  // Fallback: the catalog may have been re-indexed, so match on name + size
  if (!product) {
    product = PRODUCTS.find(p => p.name.toLowerCase() === String(item.name || '').toLowerCase());
    variant = product?.variants.find(v => v.size === item.unit) || product?.variants[0];
  }

  return product && variant ? { product, variant } : null;
}

function updateQuantity(productId, amount) {
  const itemIndex = cart.findIndex(item => item.id === productId);
  if (itemIndex === -1) return;

  cart[itemIndex].quantity += amount;

  if (cart[itemIndex].quantity <= 0) {
    cart.splice(itemIndex, 1);
  }

  saveCartToStorage();
  updateCartUI();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCartToStorage();
  updateCartUI();
}

function updateCartUI() {
  if (!cartItemsContainer) return;

  cartItemsContainer.innerHTML = '';
  
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCountBadges.forEach(badge => {
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? 'flex' : 'none';
  });

  // Floating cart bar
  if (cartBottomBar) {
    const barTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (cartBarSummary) {
      cartBarSummary.textContent = `🛒 ${totalQty} item${totalQty === 1 ? '' : 's'} · ${formatCurrency(barTotal)}`;
    }
    cartBottomBar.classList.toggle('show', cart.length > 0);
  }

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <h3>Your Cart is Empty</h3>
        <p>Add items from the catalog.</p>
      </div>
    `;
    cartSubtotal.textContent = formatCurrency(0);
    cartTotal.textContent = formatCurrency(0);
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  cart.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';
    itemEl.innerHTML = `
      <img class="cart-item-img" src="${item.image}" alt="${item.name}">
      <div class="cart-item-details">
        <h4 class="cart-item-title">${item.name}</h4>
        <span class="cart-item-price">${formatCurrency(item.price * item.quantity)}</span>
        <div class="cart-item-qty">
          <button class="qty-btn minus" data-id="${item.id}">-</button>
          <span>${item.quantity}</span>
          <button class="qty-btn plus" data-id="${item.id}">+</button>
        </div>
      </div>
      <button class="cart-item-remove" aria-label="Remove item" data-id="${item.id}">✕</button>
    `;
    cartItemsContainer.appendChild(itemEl);
  });

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  cartSubtotal.textContent = formatCurrency(subtotal);
  cartTotal.textContent = formatCurrency(subtotal);
  
  if (checkoutBtn) checkoutBtn.disabled = false;

  cartItemsContainer.querySelectorAll('.qty-btn.minus').forEach(btn => {
    btn.addEventListener('click', () => updateQuantity(btn.getAttribute('data-id'), -1));
  });
  
  cartItemsContainer.querySelectorAll('.qty-btn.plus').forEach(btn => {
    btn.addEventListener('click', () => updateQuantity(btn.getAttribute('data-id'), 1));
  });

  cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.getAttribute('data-id')));
  });
}

// User Authenticated UI Synchronization
function syncLoginUI() {
  const session = JSON.parse(localStorage.getItem('dairy_delights_session'));
  if (session) {
    // Logged in
    if (navLoginBtn) {
      navLoginBtn.innerHTML = `👤 Hi, ${session.name.split(' ')[0]} ▾`;
      navLoginBtn.style.background = 'var(--accent-cream)';
      navLoginBtn.style.color = 'var(--accent-brown)';
    }
    // Pre-fill checkout form details
    const nameInput = document.getElementById('cust-name');
    const phoneInput = document.getElementById('cust-phone');
    const addressInput = document.getElementById('cust-address');
    if (nameInput) nameInput.value = session.name;
    if (phoneInput) phoneInput.value = session.phone;
    if (addressInput) addressInput.value = session.address;
  } else {
    // Guest Mode: prefill checkout with the details from their last order on this device
    if (navLoginBtn) {
      navLoginBtn.innerHTML = `👤 Sign In`;
      navLoginBtn.style.background = 'var(--accent-cream)';
      navLoginBtn.style.color = 'var(--text-primary)';
    }
    const saved = JSON.parse(localStorage.getItem('dd_last_customer') || 'null') || {};
    const nameInput = document.getElementById('cust-name');
    const phoneInput = document.getElementById('cust-phone');
    const addressInput = document.getElementById('cust-address');
    if (nameInput) nameInput.value = saved.name || '';
    if (phoneInput) phoneInput.value = saved.phone || '';
    if (addressInput) addressInput.value = saved.address || '';
  }

  renderReorderSection();
}

// ---------- "Order Again" personalised section ----------

// Render the frequently-ordered / last-order shortcuts above the catalog.
// Only shown for a signed-in customer who has at least one past order.
function renderReorderSection() {
  if (!reorderSection) return;

  const session = JSON.parse(localStorage.getItem('dairy_delights_session') || 'null');

  if (!session) {
    reorderSection.style.display = 'none';
    lastOrderSnapshot = null;
    return;
  }

  const allOrders = JSON.parse(localStorage.getItem('dairy_delights_orders') || '[]');
  const userOrders = allOrders.filter(order => order.username === session.username);

  if (userOrders.length === 0) {
    reorderSection.style.display = 'none';
    lastOrderSnapshot = null;
    return;
  }

  // Orders are stored newest-first (unshift), so index 0 is the latest order
  lastOrderSnapshot = userOrders[0];

  if (reorderUserName) {
    reorderUserName.textContent = `, ${session.name.split(' ')[0]}`;
  }

  renderFrequentItems(userOrders);
  renderLastOrderItems(lastOrderSnapshot);

  reorderSection.style.display = 'block';
}

// Aggregate quantities per item across every past order and show the top picks
function renderFrequentItems(userOrders) {
  if (!reorderFrequentGrid) return;

  const tally = new Map();

  userOrders.forEach(order => {
    (order.items || []).forEach(item => {
      const resolved = resolveOrderItem(item);
      if (!resolved) return;

      const key = resolved.variant.id;
      const entry = tally.get(key) || {
        product: resolved.product,
        variant: resolved.variant,
        totalQty: 0,
        orderCount: 0
      };
      entry.totalQty += item.quantity || 1;
      entry.orderCount += 1;
      tally.set(key, entry);
    });
  });

  const frequent = Array.from(tally.values())
    .sort((a, b) => b.totalQty - a.totalQty || b.orderCount - a.orderCount)
    .slice(0, 8);

  reorderFrequentGrid.innerHTML = '';

  if (frequent.length === 0) {
    reorderFrequentGrid.innerHTML = `
      <div class="reorder-empty">
        <p>None of your previously ordered items are currently in the catalog.</p>
      </div>
    `;
    return;
  }

  frequent.forEach(entry => {
    reorderFrequentGrid.appendChild(buildReorderCard({
      product: entry.product,
      variant: entry.variant,
      badge: `${entry.orderCount}× ordered`
    }));
  });

  attachReorderCardHandlers(reorderFrequentGrid);
}

// Show the exact line items from the customer's most recent order
function renderLastOrderItems(order) {
  if (!reorderLastGrid) return;

  reorderLastGrid.innerHTML = '';

  const resolvedItems = (order.items || [])
    .map(item => ({ item, resolved: resolveOrderItem(item) }))
    .filter(entry => entry.resolved);

  if (resolvedItems.length === 0) {
    reorderLastGrid.innerHTML = `
      <div class="reorder-empty">
        <p>The items from your last order are no longer available.</p>
      </div>
    `;
  } else {
    resolvedItems.forEach(({ item, resolved }) => {
      reorderLastGrid.appendChild(buildReorderCard({
        product: resolved.product,
        variant: resolved.variant,
        badge: `Qty ${item.quantity}`,
        quantity: item.quantity
      }));
    });
    attachReorderCardHandlers(reorderLastGrid);
  }

  if (reorderLastMeta) {
    reorderLastMeta.textContent = `Order ${order.id} · placed ${order.timestamp} · ${formatCurrency(order.total)}`;
  }

  if (btnReorderLast) {
    btnReorderLast.disabled = resolvedItems.length === 0;
  }
}

function buildReorderCard({ product, variant, badge, quantity = 1 }) {
  const card = document.createElement('div');
  card.className = 'reorder-card';
  card.innerHTML = `
    <img class="reorder-card-img" src="${product.image}" alt="${product.name}" loading="lazy">
    <div class="reorder-card-body">
      <h4 class="reorder-card-title" title="${product.name}">${product.name}</h4>
      <span class="reorder-card-meta">${variant.size}<span class="reorder-badge">${badge}</span></span>
      <span class="reorder-card-price">${formatCurrency(variant.price)}</span>
    </div>
    <button class="btn-add-cart btn-reorder-add" aria-label="Add ${product.name} to cart"
            data-product-id="${product.id}" data-variant-id="${variant.id}" data-qty="${quantity}">
      ➕
    </button>
  `;
  return card;
}

function attachReorderCardHandlers(grid) {
  grid.querySelectorAll('.btn-reorder-add').forEach(btn => {
    btn.addEventListener('click', () => {
      addToCart(
        btn.getAttribute('data-product-id'),
        btn.getAttribute('data-variant-id'),
        btn.getAttribute('data-qty')
      );
    });
  });
}

// Add every item from the last order back into the cart in one click
function reorderLastOrder() {
  if (!lastOrderSnapshot) return;

  let added = 0;
  let skipped = 0;

  (lastOrderSnapshot.items || []).forEach(item => {
    const resolved = resolveOrderItem(item);
    if (!resolved) {
      skipped += 1;
      return;
    }
    const success = addToCart(
      resolved.product.id,
      resolved.variant.id,
      item.quantity,
      { silent: true, openDrawer: false }
    );
    if (success) added += 1;
    else skipped += 1;
  });

  if (added === 0) {
    showToast('None of those items are available right now.');
    return;
  }

  showToast(skipped > 0
    ? `Added ${added} item(s) to cart. ${skipped} no longer available.`
    : `Added all ${added} item(s) from your last order!`);

  if (cartDrawer) cartDrawer.classList.add('open');
}

// Event Listeners setup
function setupEventListeners() {
  // Cart open/close
  if (cartToggle && cartDrawer) {
    cartToggle.addEventListener('click', () => cartDrawer.classList.add('open'));
  }
  if (cartBottomBar && cartDrawer) {
    cartBottomBar.addEventListener('click', () => cartDrawer.classList.add('open'));
  }
  if (cartClose && cartDrawer) {
    cartClose.addEventListener('click', () => cartDrawer.classList.remove('open'));
  }

  // Close cart when clicking outside drawer
  document.addEventListener('click', (e) => {
    if (cartDrawer && cartDrawer.classList.contains('open')) {
      if (!cartDrawer.contains(e.target) && !cartToggle.contains(e.target) && !(cartBottomBar && cartBottomBar.contains(e.target)) && !e.target.classList.contains('btn-add-cart') && !e.target.classList.contains('qty-btn')) {
        cartDrawer.classList.remove('open');
      }
    }
  });

  // User Dropdown toggling
  if (navLoginBtn) {
    navLoginBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const session = localStorage.getItem('dairy_delights_session');
      if (session) {
        navUserDropdown.classList.toggle('show');
      } else {
        loginModal.classList.add('open');
      }
    });
  }

  // Hide dropdown clicking elsewhere
  document.addEventListener('click', () => {
    if (navUserDropdown) navUserDropdown.classList.remove('show');
  });

  // Category Filtering
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.getAttribute('data-category');
      renderCatalog();
    });
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderCatalog();
    });
  }

  // Checkout Modal
  if (checkoutBtn && checkoutModal) {
    checkoutBtn.addEventListener('click', () => {
      cartDrawer.classList.remove('open');
      checkoutModal.classList.add('open');
    });
  }

  if (modalClose && checkoutModal) {
    modalClose.addEventListener('click', () => {
      checkoutModal.classList.remove('open');
    });
  }

  if (sizeModalClose) {
    sizeModalClose.addEventListener('click', () => sizeModal.classList.remove('open'));
  }
  if (sizeConfirmBtn) {
    sizeConfirmBtn.addEventListener('click', () => {
      if (!pendingProduct) return;
      addToCart(pendingProduct.id, sizeOptions.value);
      sizeModal.classList.remove('open');
      pendingProduct = null;
    });
  }

  // Login Modal Events
  if (loginModalClose) {
    loginModalClose.addEventListener('click', () => loginModal.classList.remove('open'));
  }

  // Authentication Switch Tabs
  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      if (resetForm) resetForm.style.display = 'none';
      loginModalTitle.textContent = 'Welcome Back';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      registerForm.style.display = 'block';
      loginForm.style.display = 'none';
      if (resetForm) resetForm.style.display = 'none';
      loginModalTitle.textContent = 'Create Account';
    });
  }

  // Handle Login Submission
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('login-username').value.trim();
      const passwordInput = document.getElementById('login-password').value;

      const users = JSON.parse(localStorage.getItem('dairy_delights_users') || '[]');
      const user = users.find(u => u.username.toLowerCase() === usernameInput.toLowerCase() && u.password === passwordInput);

      if (user) {
        localStorage.setItem('dairy_delights_session', JSON.stringify(user));
        showToast(`Welcome back, ${user.name}!`);
        loginForm.reset();
        loginModal.classList.remove('open');
        syncLoginUI();
      } else {
        showToast('Invalid username or password.');
      }
    });
  }

  // Forgot password: verify username + registered phone, then set a new password.
  // Accounts live in this device's browser storage, so the check is local.
  if (btnForgotPassword) {
    btnForgotPassword.addEventListener('click', () => {
      loginForm.style.display = 'none';
      registerForm.style.display = 'none';
      resetForm.style.display = 'block';
      loginModalTitle.textContent = 'Reset Password';
    });
  }

  if (btnBackToLogin) {
    btnBackToLogin.addEventListener('click', () => {
      resetForm.style.display = 'none';
      loginForm.style.display = 'block';
      loginModalTitle.textContent = 'Welcome Back';
    });
  }

  if (resetForm) {
    resetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('reset-username').value.trim();
      const phone = document.getElementById('reset-phone').value.replace(/\D/g, '');
      const newPassword = document.getElementById('reset-password').value;

      const users = JSON.parse(localStorage.getItem('dairy_delights_users') || '[]');
      const userIndex = users.findIndex(u =>
        u.username.toLowerCase() === username.toLowerCase() &&
        String(u.phone || '').replace(/\D/g, '').endsWith(phone.slice(-10)) &&
        phone.length >= 10
      );

      if (userIndex === -1) {
        showToast('Username and phone number do not match our records.');
        return;
      }

      users[userIndex].password = newPassword;
      localStorage.setItem('dairy_delights_users', JSON.stringify(users));
      showToast('Password reset! Sign in with your new password.');
      resetForm.reset();
      resetForm.style.display = 'none';
      loginForm.style.display = 'block';
      loginModalTitle.textContent = 'Welcome Back';
    });
  }

  // Handle Registration Submission
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('reg-username').value.trim();
      const passwordInput = document.getElementById('reg-password').value;
      const nameInput = document.getElementById('reg-name').value.trim();
      const phoneInput = document.getElementById('reg-phone').value.trim();
      const addressInput = document.getElementById('reg-address').value.trim();

      const users = JSON.parse(localStorage.getItem('dairy_delights_users') || '[]');
      
      if (users.some(u => u.username.toLowerCase() === usernameInput.toLowerCase())) {
        showToast('Username already exists.');
        return;
      }

      const newUser = {
        username: usernameInput,
        password: passwordInput,
        name: nameInput,
        phone: phoneInput,
        address: addressInput
      };

      users.push(newUser);
      localStorage.setItem('dairy_delights_users', JSON.stringify(users));
      localStorage.setItem('dairy_delights_session', JSON.stringify(newUser));

      showToast(`Registration successful! Welcome, ${nameInput}!`);
      registerForm.reset();
      loginModal.classList.remove('open');
      syncLoginUI();
    });
  }

  // Dropdown Profiling trigger
  if (dropdownProfileBtn) {
    dropdownProfileBtn.addEventListener('click', () => {
      openProfileModal();
    });
  }

  // Handle Log Out
  if (dropdownLogoutBtn) {
    dropdownLogoutBtn.addEventListener('click', () => {
      localStorage.removeItem('dairy_delights_session');
      showToast('Logged out successfully.');
      syncLoginUI();
    });
  }

  // Profile Modal Settings Navigation Tabs
  if (profileModalClose) {
    profileModalClose.addEventListener('click', () => profileModal.classList.remove('open'));
  }

  if (tabProfileSettings && tabProfileHistory) {
    tabProfileSettings.addEventListener('click', () => {
      tabProfileSettings.classList.add('active');
      tabProfileHistory.classList.remove('active');
      panelProfileSettings.style.display = 'block';
      panelProfileHistory.style.display = 'none';
    });

    tabProfileHistory.addEventListener('click', () => {
      tabProfileHistory.classList.add('active');
      tabProfileSettings.classList.remove('active');
      panelProfileSettings.style.display = 'none';
      panelProfileHistory.style.display = 'block';
      renderUserOrderHistory();
    });
  }

  // Customer order-history search + sort controls
  if (profileOrderSearch) {
    profileOrderSearch.addEventListener('input', (e) => {
      userOrderSearch = e.target.value;
      renderOrderHistoryCards(currentUserOrders);
    });
  }
  if (profileOrderSort) {
    profileOrderSort.addEventListener('change', (e) => {
      userOrderSort = e.target.value;
      renderOrderHistoryCards(currentUserOrders);
    });
  }

  // Handle Profile Settings Update
  if (profileSettingsForm) {
    profileSettingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = profileNameInput.value.trim();
      const phone = profilePhoneInput.value.trim();
      const address = profileAddressInput.value.trim();

      const session = JSON.parse(localStorage.getItem('dairy_delights_session'));
      if (!session) return;

      const users = JSON.parse(localStorage.getItem('dairy_delights_users') || '[]');
      const userIndex = users.findIndex(u => u.username === session.username);

      if (userIndex > -1) {
        // Update DB
        users[userIndex].name = name;
        users[userIndex].phone = phone;
        users[userIndex].address = address;
        localStorage.setItem('dairy_delights_users', JSON.stringify(users));

        // Update Session
        session.name = name;
        session.phone = phone;
        session.address = address;
        localStorage.setItem('dairy_delights_session', JSON.stringify(session));

        showToast('Profile updated successfully!');
        syncLoginUI();
      }
    });
  }

  // Form Submit (Checkout)
  if (checkoutForm) {
    const btnOwnerAlert = checkoutForm.querySelector('.btn-checkout-opt.owner-alert');

    btnOwnerAlert.addEventListener('click', (e) => {
      e.preventDefault();
      handleOrderSubmission('dashboard');
    });
  }

  // "Order Again" section tabs
  if (tabReorderFrequent && tabReorderLast) {
    tabReorderFrequent.addEventListener('click', () => {
      tabReorderFrequent.classList.add('active');
      tabReorderLast.classList.remove('active');
      reorderFrequentGrid.style.display = 'grid';
      reorderLastGrid.style.display = 'none';
      reorderLastMeta.style.display = 'none';
    });

    tabReorderLast.addEventListener('click', () => {
      tabReorderLast.classList.add('active');
      tabReorderFrequent.classList.remove('active');
      reorderFrequentGrid.style.display = 'none';
      reorderLastGrid.style.display = 'grid';
      reorderLastMeta.style.display = 'block';
    });
  }

  // One-click repeat of the entire last order
  if (btnReorderLast) {
    btnReorderLast.addEventListener('click', reorderLastOrder);
  }

  // Listen to Storage events to update status badges under history page in real-time
  window.addEventListener('storage', (e) => {
    if (e.key === 'dairy_delights_orders') {
      renderReorderSection();
      if (profileModal && profileModal.classList.contains('open') && panelProfileHistory.style.display === 'block') {
        renderUserOrderHistory();
      }
    }
  });
}

// Profile Modal Activation
function openProfileModal() {
  const session = JSON.parse(localStorage.getItem('dairy_delights_session'));
  if (!session) return;

  profileUsernameInput.value = session.username;
  profileNameInput.value = session.name;
  profilePhoneInput.value = session.phone;
  profileAddressInput.value = session.address;

  tabProfileSettings.click();
  profileModal.classList.add('open');
}

// Render current customer's order logs
function renderUserOrderHistory() {
  if (!profileOrdersList) return;

  const session = JSON.parse(localStorage.getItem('dairy_delights_session'));
  if (!session) return;

  const allOrders = JSON.parse(localStorage.getItem('dairy_delights_orders') || '[]');
  // Filter matching username
  const userOrders = allOrders.filter(o => o.username === session.username);

  // Refresh statuses from the server (owner may have updated them from the
  // dashboard on another device). Renders immediately, patches when fetched.
  if (userOrders.length > 0) {
    const ids = userOrders.slice(0, 50).map(o => o.id).join(',');
    fetch(`/api/orders/status?ids=${encodeURIComponent(ids)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !data.statuses) return;
        let changed = false;
        allOrders.forEach(order => {
          const fresh = data.statuses[order.id];
          if (fresh && fresh !== order.status) {
            order.status = fresh;
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('dairy_delights_orders', JSON.stringify(allOrders));
          currentUserOrders = allOrders.filter(o => o.username === session.username);
          renderOrderHistoryCards(currentUserOrders);
        }
      })
      .catch(() => {}); // offline/local mode: keep stored statuses
  }

  currentUserOrders = userOrders;
  renderOrderHistoryCards(currentUserOrders);
}

// Apply the customer's search term + date/amount sort, then render.
function renderOrderHistoryCards(userOrders) {
  if (!profileOrdersList) return;

  profileOrdersList.innerHTML = '';

  if (userOrders.length === 0) {
    profileOrdersList.innerHTML = `
      <div style="text-align: center; padding: 40px 0; color: var(--text-secondary);">
        <p>No orders placed yet under this account.</p>
      </div>
    `;
    return;
  }

  const term = userOrderSearch.trim().toLowerCase();
  let rows = userOrders.filter(order => {
    if (!term) return true;
    const blob = [
      order.id,
      order.status,
      (order.items || []).map(i => i.name).join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
    return blob.includes(term);
  });

  const time = o => {
    const t = new Date(o.timestamp).getTime();
    return isNaN(t) ? 0 : t;
  };
  rows = rows.slice().sort((a, b) => {
    switch (userOrderSort) {
      case 'date-asc': return time(a) - time(b);
      case 'total-desc': return b.total - a.total;
      case 'total-asc': return a.total - b.total;
      case 'date-desc':
      default: return time(b) - time(a);
    }
  });

  if (rows.length === 0) {
    profileOrdersList.innerHTML = `
      <div style="text-align: center; padding: 40px 0; color: var(--text-secondary);">
        <p>No orders match your search.</p>
      </div>
    `;
    return;
  }

  rows.forEach(order => {
    let itemSnippets = '';
    order.items.forEach(item => {
      itemSnippets += `<li>${item.name} (${item.quantity}x) - ${formatCurrency(item.price * item.quantity)}</li>`;
    });

    // Match status classes
    let statusClass = 'status-pending';
    if (order.status === 'Preparing') statusClass = 'status-preparing';
    else if (order.status === 'Out for Delivery') statusClass = 'status-delivery';
    else if (order.status === 'Completed') statusClass = 'status-completed';

    const card = document.createElement('div');
    card.className = 'profile-order-card';
    card.innerHTML = `
      <div class="profile-order-header">
        <span class="profile-order-id">${order.id}</span>
        <span class="badge-status ${statusClass}">${order.status}</span>
      </div>
      <div class="profile-order-details">
        <div><strong>Date:</strong> ${order.timestamp}</div>
        <div><strong>Total Bill:</strong> ${formatCurrency(order.total)}</div>
        <div><strong>Delivery To:</strong> ${order.customer.address}</div>
        <ul class="profile-order-items">
          ${itemSnippets}
        </ul>
      </div>
    `;
    profileOrdersList.appendChild(card);
  });
}

// Form Validation and Order Submission
let orderSubmitting = false;
async function handleOrderSubmission(type) {
  if (orderSubmitting) return;
  if (!checkoutForm.checkValidity()) {
    checkoutForm.reportValidity();
    return;
  }

  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();
  const deliveryTime = document.getElementById('delivery-time').value;

  // Indian mobile number sanity check: 10 digits (optional +91 / 0 prefix)
  const phoneDigits = phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
    showToast('Please enter a valid 10-digit mobile number.');
    document.getElementById('cust-phone').focus();
    return;
  }
  if (address.length < 10) {
    showToast('Please enter a complete delivery address.');
    document.getElementById('cust-address').focus();
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
  const timeStamp = new Date().toLocaleString();

  // Link to logged-in user
  const session = JSON.parse(localStorage.getItem('dairy_delights_session'));
  const username = session ? session.username : 'Guest';

  const orderData = {
    id: orderId,
    timestamp: timeStamp,
    username: username, // Associate order with account username
    customer: { name, phone, address, deliveryTime },
    items: cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category
    })),
    total: subtotal,
    status: 'Pending'
  };

  // Remember delivery details for next time (prefilled at next checkout)
  localStorage.setItem('dd_last_customer', JSON.stringify({ name, phone, address }));

  const existingOrders = JSON.parse(localStorage.getItem('dairy_delights_orders') || '[]');
  existingOrders.unshift(orderData);
  localStorage.setItem('dairy_delights_orders', JSON.stringify(existingOrders));

  window.dispatchEvent(new StorageEvent('storage', {
    key: 'dairy_delights_orders',
    newValue: JSON.stringify(existingOrders)
  }));

  // Send the order to the shop's backend (database + WhatsApp alert).
  const submitBtn = checkoutForm.querySelector('.btn-checkout-opt');
  orderSubmitting = true;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Placing order… (can take up to a minute)'; }

  let delivered = false;
  try {
    // Generous timeout: a sleeping free-tier server can take up to a minute to wake
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
      signal: controller.signal
    });
    clearTimeout(timer);
    delivered = res.ok;
  } catch (err) {
    console.warn('Order submission failed:', err);
  }

  orderSubmitting = false;
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🔔 Place Order'; }

  clearCart();
  checkoutModal.classList.remove('open');
  showOrderSuccess(orderData.id, delivered);
}

// Celebratory order-confirmation modal shown after a successful checkout.
function showOrderSuccess(orderId, delivered) {
  const modal = document.getElementById('order-success-modal');
  if (!modal) return;

  const msgEl = document.getElementById('success-order-msg');
  const idEl = document.getElementById('success-order-id');
  if (msgEl) {
    msgEl.textContent = delivered
      ? "Thank you! We'll call you shortly to confirm your order (Cash on Delivery)."
      : "Your order is saved. Please also call or WhatsApp us at +91 93217 82424 so we can confirm it.";
  }
  if (idEl) idEl.textContent = orderId ? `Order ${orderId}` : '';

  const close = () => modal.classList.remove('open');
  const keepBtn = document.getElementById('success-keep-shopping');
  const historyBtn = document.getElementById('success-view-history');
  const contactBtn = document.getElementById('success-contact');

  if (keepBtn) keepBtn.onclick = close;
  if (historyBtn) historyBtn.onclick = () => {
    close();
    const session = JSON.parse(localStorage.getItem('dairy_delights_session') || 'null');
    if (session) {
      openProfileModal();
      if (tabProfileHistory) tabProfileHistory.click();
    } else if (navLoginBtn) {
      navLoginBtn.click(); // guest: open sign-in so they can view their history
    }
  };
  if (contactBtn) contactBtn.onclick = () => window.open('https://wa.me/919321782424', '_blank', 'noopener');
  modal.onclick = e => { if (e.target === modal) close(); };

  modal.classList.add('open');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) launchConfetti();
}

// Lightweight canvas confetti burst — no library, cleans itself up.
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:400';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#C5A880', '#D96B62', '#F5B041', '#8B5E3C', '#EED9B6', '#7FB77E'];
  const parts = Array.from({ length: 150 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 220,
    y: canvas.height * 0.32,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * -7 - 3,
    g: 0.17 + Math.random() * 0.12,
    size: 5 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vrot: (Math.random() - 0.5) * 0.35,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
  const start = performance.now();
  const DURATION = 2600;
  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach(p => {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - t / DURATION);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

// Helper: Clear Cart
function clearCart() {
  cart = [];
  saveCartToStorage();
  updateCartUI();
  if (checkoutForm) checkoutForm.reset();
  syncLoginUI(); // Re-populate default credentials if logged in
}

// Toast Notifications Helper
function showToast(message) {
  if (!toastNotification) return;

  const textEl = toastNotification.querySelector('.toast-text');
  if (textEl) textEl.textContent = message;

  toastNotification.classList.add('show');

  setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 3500);
}

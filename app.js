/**
 * Khandelwal & Sons storefront script
 * Handles catalog rendering, cart operations, user authentication, profile settings, and order history sync
 */

// Current inventory from Stock Summry-1.xlsx. Rates are displayed in Indian rupees.
const STOCK_ITEMS = [
  ['Amul Butter 100gm',160,52.02,'dairy'],['Amul Butter 500gm Cp',49.5,520.88,'dairy'],['Amul Butter Milk 200ml',660,12.91,'beverages'],['Amul Butter Sandwich Bread 200gm',120,16.92,'bakery'],['Amul Butter School',27,64.41,'dairy'],['Amul Cheese Block 1kg',58,22.37,'dairy'],['Amul Cheese Slice',8,389.52,'dairy'],['Amul Dahi 200gm',192,19.26,'dairy'],['Amul Dahi 800gm Pouch',420,42.63,'dairy'],['Amul Fresh Cream 1 Ltr',176,221.15,'dairy'],['Amul Fresh Cream 250ml',15,66.28,'dairy'],['Amul Fresh Paneer 15x200gm',15,76.38,'dairy'],['Amul Ghee 1Ltr',20,567.42,'dairy'],['Amul Gold Tetra Pack 1lr',60,77.84,'beverages'],['Amul Kool Cafe 30x200 Ml',30,29.99,'beverages'],['Amul Kool Kesar, Badam, Elachi, Rose',60,21.05,'beverages'],['Amul Lassi 32x250ml',64,21.25,'beverages'],['Amul Masti Dahi 1Kg',512,65.75,'dairy'],['Amul Probiotic Lassi Rose 24x180ml',24,14.71,'beverages'],['Amul Tadka Chaas 40x280 Ml Pouch',40,8.07,'beverages'],['Amul Unsalted Butter',4,260.67,'dairy'],['Buffalo Milk',591,68.01,'beverages'],['Buttermilk 440ml',2938,12.69,'beverages'],['Butter Milk Jeera 500ml',192,15.99,'beverages'],['CDM Roast Almond 36gm',5,40.10,'snacks'],['Chees Chiplet 12x40',24,523.42,'snacks'],['Choco Strands ST D 10 Kg',10,285.71,'ingredients'],['Crackle 36gm',5,40.10,'snacks'],['Crackle 75gm',5,87.57,'snacks'],['Dark Compound 400gm',22,129.88,'ingredients'],['Delicious Butter',15,140,'dairy'],['Derista - Analogue Processed Cheese Block 1kg',24,363.59,'dairy'],['Derista - Dairy Slices',14,68.25,'dairy'],['Derista - Filler Cheese 500gm',189,164.12,'dairy'],['Derista - Mozarella Cheese Diced 1 Kg',101,372.75,'dairy'],['Derista - Mozarella Pizza Topping Diced 1 Kg',270,355.64,'dairy'],['Derista - Mozzarella Cheese Blend 1 Kg',89,372.66,'dairy'],['Derista - Orange Chadder',11,474.04,'dairy'],['Derista - Processed Cheese Block Hard 1 KG',138,391.19,'dairy'],['Derista - Processed Soft Cheese Block 1 Kg',150,377.96,'dairy'],['Derista - Sandwich Slice (780g)',131,284.21,'dairy'],['Derista - UTH Brick Toned Milk 1ltr',90,57.78,'beverages'],['Dlecta Cheese Sauce 1kg Tub',6,415.98,'ingredients'],['Dlecta Mascarpone Cheese 400gm (24pcs)',12,287.51,'dairy'],['Ecotrop Whip Cream',14,52.38,'dairy'],['Flexi Cream 1kg',38,136.57,'dairy'],['Fr Salad Mayonnaise 1 KG (15)',44,69.52,'ingredients'],['Govind Dahi 150 Gm',24,14.98,'dairy'],['Govind UHT Cream 1 Ltr with Cap',12,192.31,'dairy'],['Gowardhan Cheese 1 KG',68,442.22,'dairy'],['Gowardhan Fresh Milk',444,49.95,'beverages'],['Gowardhan Ghee 1 Ltr',10,695.24,'dairy'],['Gowardhan Tea Special',36,53.50,'beverages'],['Hungritos - Premium French Fries 6mm 2.5 Kg',9,210.47,'frozen'],['Hungritos - Premium French Fries 9mm 2.5 Kg',5,220.15,'frozen'],['Hyfun French Fries Straight',20,223.81,'frozen'],['Maharaja Halwa',1,240,'sweets'],['Mathura Peda',1,400,'sweets'],['Mc Cains Sure Crisp Coated Fries 11mm 2.5KG',30,367.20,'frozen'],['Mc Cains v Crispers .2kg 6Pack',6,394.83,'frozen'],['Melody Classic - Chocolate - 48P',4,42.52,'snacks'],['Mirch Masala Banana Chips 150gm',4,48.84,'snacks'],['Nadiyadi Mix 170gm',3,36.29,'snacks'],['Nutralite Block 500gm - Butter',1456,46.80,'dairy'],['Parle-G Classic - Regular - 72 P',2,103.90,'snacks'],['Pineapple Halwa',1,240,'sweets'],['Premium Panchmeva 405gm',4,392.14,'sweets'],['Qualita Special Cheese 1 Kg',35,283.75,'dairy'],["Rich's Cooking Cream 1kg",10,192.53,'dairy'],['Aloo Paratha 120gm',44,45.46,'frozen'],['Falcon - Burger Patty 1.2 Kg 12P',18,135.70,'frozen'],['Falcon - French Fries 9mm Straight Cut 2.5 Kg',265,219.22,'frozen'],['Falcon - Lachha Paratha 1040 Gm 12+1 Pcs',98,119.13,'frozen'],['Goeld - French Fries 400gm',120,21.77,'frozen'],['Goeld - French Fries 9mm',78,179.35,'frozen'],['Hungritors - Chees Corn Nuggets 1 Kg (12kg)',12,349.60,'frozen'],['Hungritors - Herbed Potato Wedges 2.5 Kg',10,292.51,'frozen'],['Hungritos - Premium French Fries 6mm 2.5 Kg',30,223.75,'frozen'],['Hungritos - Premium French Fries 9mm 2.5 Kg',175,221.74,'frozen'],['Hy Fun - Burger Patty',16,167.65,'frozen'],['Hy Fun - French Fries Crinkle Cut 11mm 1 Kg =10',88,130.13,'frozen'],['Hy Fun - French Fries Shoestring 6MM',61,262.75,'frozen'],['Hy Fun - French Fries Straight Cut 9mm',42,262.75,'frozen'],['Hy Fun Mixed Veg Gyozas Momos',6,171.41,'frozen'],['Hy Fun - Pizza Regular 7" Margherita',24,42.27,'frozen'],['Hy fun - Pizza Regular 7" Tandoori Paneer',36,55.42,'frozen'],['Hy Fun - Super Crispy Coated French Fries 11mm 2.5 Kg',25,364.03,'frozen'],['Sweet Corn',35,75,'frozen']
];

const CATEGORY_DETAILS = {
  dairy: { label: 'Dairy & Cheese', image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=700&q=80' },
  beverages: { label: 'Milk & Beverages', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=700&q=80' },
  frozen: { label: 'Frozen & Ready-to-Cook', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=80' },
  snacks: { label: 'Snacks & Chocolates', image: 'https://images.unsplash.com/photo-1599599810694-b5b37304c041?auto=format&fit=crop&w=700&q=80' },
  sweets: { label: 'Sweets', image: 'https://images.unsplash.com/photo-1589119908995-c6837fa14848?auto=format&fit=crop&w=700&q=80' },
  bakery: { label: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80' },
  ingredients: { label: 'Cooking Ingredients', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=700&q=80' }
};

const PRODUCT_IMAGES = {
  milk: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=700&q=80',
  butter: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=700&q=80',
  cheese: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=700&q=80',
  yogurt: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=700&q=80',
  fries: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=80',
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=700&q=80',
  bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80',
  chocolate: 'https://images.unsplash.com/photo-1599599810694-b5b37304c041?auto=format&fit=crop&w=700&q=80',
  sweets: 'https://images.unsplash.com/photo-1589119908995-c6837fa14848?auto=format&fit=crop&w=700&q=80'
};

const getProductImage = (name, category) => {
  const label = name.toLowerCase();
  if (/butter|ghee/.test(label)) return PRODUCT_IMAGES.butter;
  if (/cheese|paneer|mascarpone/.test(label)) return PRODUCT_IMAGES.cheese;
  if (/dahi|yogurt|cream|lassi|chaas|buttermilk/.test(label)) return PRODUCT_IMAGES.yogurt;
  if (/milk|kool/.test(label)) return PRODUCT_IMAGES.milk;
  if (/fries|potato|nuggets/.test(label)) return PRODUCT_IMAGES.fries;
  if (/pizza/.test(label)) return PRODUCT_IMAGES.pizza;
  if (/bread/.test(label)) return PRODUCT_IMAGES.bread;
  if (/choco|chocolate|crackle|melody/.test(label)) return PRODUCT_IMAGES.chocolate;
  if (category === 'sweets') return PRODUCT_IMAGES.sweets;
  return CATEGORY_DETAILS[category].image;
};

const getProductName = name => name
  .replace(/\b\d+(?:\.\d+)?\s*(?:x\s*\d+)?\s*(?:gm|g|kg|ml|ltr|lr|l|mm|p|pcs|pack)\b/gi, '')
  .replace(/\b\d+\s*x\s*\d+\b/gi, '')
  .replace(/\b\d+\s*\+\s*\d+\s*(?:pcs|p)\b/gi, '')
  .replace(/\b(?:cp|tub|pouch|tin|brick)\b/gi, '')
  .replace(/\bschool\b/gi, '')
  .replace(/\s*=\s*\d+\b/g, '')
  .replace(/\(\s*\d*\s*\)/g, '')
  .replace(/\s{2,}/g, ' ')
  .replace(/[.\-\s]+$/g, '')
  .replace(/\s+-\s*$/g, '')
  .trim();

const getProductSize = name => {
  if (/\bschool\b/i.test(name)) return 'School Pack';
  const sizes = name.match(/\d+(?:\.\d+)?\s*(?:x\s*\d+)?\s*(?:gm|g|kg|ml|ltr|lr|l|mm|p|pcs|pack)\b/gi);
  return sizes ? sizes.join(' · ') : 'Standard';
};

const PRODUCTS = Array.from(STOCK_ITEMS.reduce((catalog, [sourceName, stock, price, category], index) => {
  const name = getProductName(sourceName);
  const key = `${category}:${name.toLowerCase()}`;
  if (!catalog.has(key)) {
    catalog.set(key, {
      id: `product-${catalog.size + 1}`,
      name,
      category,
      image: getProductImage(name, category),
      variants: []
    });
  }
  const product = catalog.get(key);
  product.variants.push({ id: `variant-${index + 1}`, size: getProductSize(sourceName), price, stock });
  return catalog;
}, new Map()).values()).map(product => ({
  ...product,
  price: Math.min(...product.variants.map(variant => variant.price)),
  unit: product.variants.length === 1 ? product.variants[0].size : 'multiple sizes'
}));

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
const themeToggle = document.getElementById('theme-toggle');
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
const sizeModal = document.getElementById('size-modal');
const sizeModalClose = document.getElementById('size-modal-close');
const sizeProductTitle = document.getElementById('size-product-title');
const sizeOptions = document.getElementById('size-options');
const sizeConfirmBtn = document.getElementById('size-confirm-btn');
let pendingProduct = null;

// Initialize Website
document.addEventListener('DOMContentLoaded', () => {
  initUsersDB();
  loadCartFromStorage();
  renderCatalog();
  setupEventListeners();
  initTheme();
  syncLoginUI();
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

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  if (themeToggle) {
    themeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
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

// Render catalog items
function renderCatalog() {
  if (!productsGrid) return;
  
  const filteredProducts = PRODUCTS.filter(product => {
    const matchesCategory = currentCategory === 'all' || product.category === currentCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchQuery.toLowerCase());
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
function addToCart(productId, variantId) {
  const product = PRODUCTS.find(p => p.id === productId);
  const variant = product?.variants.find(item => item.id === variantId);
  if (!product || !variant) return;

  const existingItemIndex = cart.findIndex(item => item.id === variantId);

  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += 1;
  } else {
    cart.push({
      id: variant.id,
      name: product.name,
      category: product.category,
      image: product.image,
      price: variant.price,
      unit: variant.size,
      quantity: 1
    });
  }

  saveCartToStorage();
  updateCartUI();
  showToast(`Added ${product.name} to cart!`);
  
  if (cartDrawer && !cartDrawer.classList.contains('open')) {
    cartDrawer.classList.add('open');
  }
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

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <h3>Your Cart is Empty</h3>
        <p>Explore our premium dairy and sweet delicacies to add items.</p>
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
    // Guest Mode
    if (navLoginBtn) {
      navLoginBtn.innerHTML = `👤 Sign In`;
      navLoginBtn.style.background = 'var(--accent-cream)';
      navLoginBtn.style.color = 'var(--text-primary)';
    }
    const nameInput = document.getElementById('cust-name');
    const phoneInput = document.getElementById('cust-phone');
    const addressInput = document.getElementById('cust-address');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (addressInput) addressInput.value = '';
  }
}

// Event Listeners setup
function setupEventListeners() {
  // Theme Toggle
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Cart open/close
  if (cartToggle && cartDrawer) {
    cartToggle.addEventListener('click', () => cartDrawer.classList.add('open'));
  }
  if (cartClose && cartDrawer) {
    cartClose.addEventListener('click', () => cartDrawer.classList.remove('open'));
  }

  // Close cart when clicking outside drawer
  document.addEventListener('click', (e) => {
    if (cartDrawer && cartDrawer.classList.contains('open')) {
      if (!cartDrawer.contains(e.target) && !cartToggle.contains(e.target) && !e.target.classList.contains('btn-add-cart') && !e.target.classList.contains('qty-btn')) {
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
      loginModalTitle.textContent = 'Welcome Back';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      registerForm.style.display = 'block';
      loginForm.style.display = 'none';
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

  // Form Submit (Checkout Options)
  if (checkoutForm) {
    const btnWhatsapp = checkoutForm.querySelector('.btn-checkout-opt.whatsapp');
    const btnOwnerAlert = checkoutForm.querySelector('.btn-checkout-opt.owner-alert');

    btnWhatsapp.addEventListener('click', (e) => {
      e.preventDefault();
      handleOrderSubmission('whatsapp');
    });

    btnOwnerAlert.addEventListener('click', (e) => {
      e.preventDefault();
      handleOrderSubmission('dashboard');
    });
  }

  // Listen to Storage events to update status badges under history page in real-time
  window.addEventListener('storage', (e) => {
    if (e.key === 'dairy_delights_orders') {
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

  profileOrdersList.innerHTML = '';

  if (userOrders.length === 0) {
    profileOrdersList.innerHTML = `
      <div style="text-align: center; padding: 40px 0; color: var(--text-secondary);">
        <p>No orders placed yet under this account.</p>
      </div>
    `;
    return;
  }

  userOrders.forEach(order => {
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
function handleOrderSubmission(type) {
  if (!checkoutForm.checkValidity()) {
    checkoutForm.reportValidity();
    return;
  }

  const name = document.getElementById('cust-name').value;
  const phone = document.getElementById('cust-phone').value;
  const address = document.getElementById('cust-address').value;
  const deliveryTime = document.getElementById('delivery-time').value;

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

  if (type === 'dashboard') {
    const existingOrders = JSON.parse(localStorage.getItem('dairy_delights_orders') || '[]');
    existingOrders.unshift(orderData);
    localStorage.setItem('dairy_delights_orders', JSON.stringify(existingOrders));

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'dairy_delights_orders',
      newValue: JSON.stringify(existingOrders)
    }));

    showToast('Order successfully sent to owner!');
    clearCart();
    checkoutModal.classList.remove('open');
  } else if (type === 'whatsapp') {
    const shopOwnerPhone = '1234567890';
    
    let orderText = `*New Order: ${orderId}*\n`;
    orderText += `*Customer:* ${name} (${username})\n`;
    orderText += `*Phone:* ${phone}\n`;
    orderText += `*Address:* ${address}\n`;
    orderText += `*Delivery Time:* ${deliveryTime}\n\n`;
    orderText += `*Items Ordered:*\n`;
    
    cart.forEach(item => {
      orderText += `- ${item.name} (${item.quantity}x) - ${formatCurrency(item.price * item.quantity)}\n`;
    });
    
    orderText += `\n*Total Amount:* ${formatCurrency(subtotal)}`;

    const encodedText = encodeURIComponent(orderText);
    const whatsappUrl = `https://wa.me/${shopOwnerPhone}?text=${encodedText}`;

    // Auto-record in local storage dashboard logs for backup consistency
    const existingOrders = JSON.parse(localStorage.getItem('dairy_delights_orders') || '[]');
    existingOrders.unshift(orderData);
    localStorage.setItem('dairy_delights_orders', JSON.stringify(existingOrders));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'dairy_delights_orders',
      newValue: JSON.stringify(existingOrders)
    }));

    window.open(whatsappUrl, '_blank');
    
    showToast('Opening WhatsApp to send order...');
    clearCart();
    checkoutModal.classList.remove('open');
  }
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

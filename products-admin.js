/**
 * Product Manager — owner-only admin page for editing the catalog live.
 * Talks to the /api/owner/products endpoints (protected by the owner password).
 */

const CATEGORIES = [
  ['dairy', 'Dairy & Cheese'],
  ['beverages', 'Milk & Beverages'],
  ['frozen', 'Frozen & Ready-to-Cook'],
  ['snacks', 'Snacks & Chocolates'],
  ['sweets', 'Sweets'],
  ['bakery', 'Bakery'],
  ['ingredients', 'Cooking Ingredients']
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);

const ownerKey = () => localStorage.getItem('dd_owner_key') || sessionStorage.getItem('dd_owner_key') || '';
const authHeaders = () => ({ 'x-owner-key': ownerKey(), 'Content-Type': 'application/json' });
const formatCurrency = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v);
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let PRODUCTS = [];
let searchQuery = '';

// DOM
const authOverlay = document.getElementById('admin-auth-overlay');
const authForm = document.getElementById('admin-auth-form');
const listEl = document.getElementById('pm-list');
const countEl = document.getElementById('pm-count');
const searchEl = document.getElementById('pm-search');
const modal = document.getElementById('pm-modal');
const form = document.getElementById('pm-form');
const modalTitle = document.getElementById('pm-modal-title');
const fId = document.getElementById('pm-id');
const fName = document.getElementById('pm-name');
const fCategory = document.getElementById('pm-category');
const fImage = document.getElementById('pm-image');
const imgPreview = document.getElementById('pm-img-preview');
const variantsWrap = document.getElementById('pm-variants');
const toastEl = document.getElementById('toast-notification');
const fFile = document.getElementById('pm-file');
const fCamera = document.getElementById('pm-camera');
const uploadStatus = document.getElementById('pm-upload-status');
const tagBestseller = document.getElementById('pm-tag-bestseller');
const tagFrequent = document.getElementById('pm-tag-frequent');

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  const t = toastEl.querySelector('.toast-text');
  if (t) t.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

// ---------- Auth ----------
function isUnlocked() { return Boolean(ownerKey()); }
function showAuth(show) {
  if (!authOverlay) return;
  authOverlay.style.display = show ? 'flex' : 'none';
}

authForm.addEventListener('submit', async e => {
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
      showAuth(false);
      showToast('Unlocked');
      loadProducts();
    } else {
      showToast('Incorrect password');
    }
  } catch (err) {
    showToast('Could not reach the server. Try again.');
  }
});

document.getElementById('btn-admin-logout').addEventListener('click', () => {
  localStorage.removeItem('dd_owner_key');
  sessionStorage.removeItem('dd_owner_key');
  showAuth(true);
});

// ---------- Load & render list ----------
async function loadProducts() {
  listEl.innerHTML = '<div class="pm-empty">Loading products…</div>';
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch('/api/owner/products', { headers: authHeaders() });
      if (res.status === 401) { showAuth(true); return; }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to load');
      PRODUCTS = data.products || [];
      renderList();
      return;
    } catch (err) {
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1500));
      else listEl.innerHTML = `<div class="pm-empty">Could not load products.<br>${escapeHtml(err.message)}</div>`;
    }
  }
}

function variantSummary(variants) {
  if (!Array.isArray(variants) || !variants.length) return 'No sizes';
  return variants.map(v => `${escapeHtml(v.size)} · ${formatCurrency(Number(v.price) || 0)} · ${Number(v.stock) || 0} in stock`).join('  |  ');
}

function renderList() {
  const q = searchQuery.toLowerCase();
  const filtered = PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q) || (CATEGORY_LABEL[p.category] || p.category).toLowerCase().includes(q));

  countEl.textContent = `${filtered.length} of ${PRODUCTS.length} products`;

  if (!filtered.length) {
    listEl.innerHTML = '<div class="pm-empty">No products match your search.</div>';
    return;
  }

  listEl.innerHTML = filtered.map(p => `
    <div class="pm-row">
      <img src="${escapeHtml(p.image_url || '')}" alt="${escapeHtml(p.name)}" loading="lazy"
           onerror="this.style.visibility='hidden'">
      <div>
        <div class="pm-name">${escapeHtml(p.name)}</div>
        <div class="pm-meta">
          <span class="pm-badge">${escapeHtml(CATEGORY_LABEL[p.category] || p.category)}</span>
          ${(p.tags || []).includes('bestseller') ? '<span class="pm-badge" style="background:rgba(217,107,98,0.15);color:var(--accent-red)">⭐ Best Seller</span>' : ''}
          ${(p.tags || []).includes('frequently_ordered') ? '<span class="pm-badge" style="background:rgba(197,168,128,0.28)">🔁 Frequent</span>' : ''}
          ${variantSummary(p.variants)}
        </div>
      </div>
      <div class="pm-row-actions">
        <button class="pm-btn pm-btn-ghost" data-edit="${escapeHtml(p.id)}">Edit</button>
        <button class="pm-btn pm-btn-danger" data-del="${escapeHtml(p.id)}">Delete</button>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openEditor(b.getAttribute('data-edit'))));
  listEl.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => deleteProduct(b.getAttribute('data-del'))));
}

// ---------- Variant editor rows ----------
function addVariantRow(v = {}) {
  const row = document.createElement('div');
  row.className = 'pm-variant-row';
  row.innerHTML = `
    <input type="text" class="v-size" placeholder="e.g. 500gm" value="${escapeHtml(v.size || '')}">
    <input type="number" class="v-price" placeholder="0" min="0" step="0.01" value="${v.price != null ? v.price : ''}">
    <input type="number" class="v-stock" placeholder="0" min="0" step="1" value="${v.stock != null ? v.stock : ''}">
    <button type="button" class="pm-vrm" title="Remove size">✕</button>
  `;
  row.querySelector('.pm-vrm').addEventListener('click', () => row.remove());
  variantsWrap.appendChild(row);
}

// ---------- Open add/edit modal ----------
function populateCategorySelect() {
  fCategory.innerHTML = CATEGORIES.map(([k, label]) => `<option value="${k}">${label}</option>`).join('');
}

function openEditor(id) {
  const product = id ? PRODUCTS.find(p => p.id === id) : null;
  modalTitle.textContent = product ? 'Edit Product' : 'Add Product';
  fId.value = product ? product.id : '';
  fName.value = product ? product.name : '';
  fCategory.value = product ? product.category : CATEGORIES[0][0];
  fImage.value = product ? (product.image_url || '') : '';
  updateImagePreview();
  if (uploadStatus) uploadStatus.textContent = '';
  const tags = product && Array.isArray(product.tags) ? product.tags : [];
  if (tagBestseller) tagBestseller.checked = tags.includes('bestseller');
  if (tagFrequent) tagFrequent.checked = tags.includes('frequently_ordered');
  variantsWrap.innerHTML = '';
  const variants = product && Array.isArray(product.variants) && product.variants.length ? product.variants : [{ size: 'Standard', price: '', stock: '' }];
  variants.forEach(addVariantRow);
  modal.classList.add('show');
}

function closeEditor() { modal.classList.remove('show'); }

function updateImagePreview() {
  const url = fImage.value.trim();
  if (url) { imgPreview.src = url; imgPreview.style.display = 'block'; }
  else imgPreview.style.display = 'none';
}

// ---------- Save ----------
function collectVariants() {
  return Array.from(variantsWrap.querySelectorAll('.pm-variant-row')).map(row => ({
    size: row.querySelector('.v-size').value.trim() || 'Standard',
    price: Number(row.querySelector('.v-price').value) || 0,
    stock: Number(row.querySelector('.v-stock').value) || 0
  })).filter(v => v.size);
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const id = fId.value.trim();
  const payload = {
    name: fName.value.trim(),
    category: fCategory.value,
    image_url: fImage.value.trim(),
    variants: collectVariants(),
    tags: [
      ...(tagBestseller && tagBestseller.checked ? ['bestseller'] : []),
      ...(tagFrequent && tagFrequent.checked ? ['frequently_ordered'] : [])
    ]
  };
  if (!payload.name || !payload.category || payload.variants.length === 0) {
    showToast('Add a name, category and at least one size.');
    return;
  }
  const saveBtn = document.getElementById('pm-save');
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
  try {
    const url = id ? `/api/owner/products/${encodeURIComponent(id)}` : '/api/owner/products';
    const method = id ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Save failed');
    showToast(id ? 'Product updated' : 'Product added');
    closeEditor();
    loadProducts();
  } catch (err) {
    showToast('Could not save: ' + err.message);
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = 'Save Product';
  }
});

async function deleteProduct(id) {
  const product = PRODUCTS.find(p => p.id === id);
  if (!confirm(`Delete "${product ? product.name : id}"? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/owner/products/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Delete failed');
    showToast('Product deleted');
    loadProducts();
  } catch (err) {
    showToast('Could not delete: ' + err.message);
  }
}

// ---------- Image upload (device / camera) ----------
// Compress to a reasonable size before upload so camera photos aren't huge.
async function fileToCompressedBase64(file, maxDim = 1200, quality = 0.82) {
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  let w = img.width, h = img.height;
  if (Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale); h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality).split(',')[1];
}

async function handleImageFile(file) {
  if (!file) return;
  uploadStatus.textContent = 'Uploading…';
  try {
    const base64 = await fileToCompressedBase64(file);
    const res = await fetch('/api/owner/upload-image', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ dataBase64: base64, contentType: 'image/jpeg', filename: fName.value || 'product' })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Upload failed');
    fImage.value = data.url;
    updateImagePreview();
    uploadStatus.textContent = 'Uploaded ✓';
  } catch (err) {
    uploadStatus.textContent = '';
    showToast('Upload failed: ' + err.message);
  }
}

if (fFile) fFile.addEventListener('change', e => { handleImageFile(e.target.files[0]); e.target.value = ''; });
if (fCamera) fCamera.addEventListener('change', e => { handleImageFile(e.target.files[0]); e.target.value = ''; });

// ---------- Wire up ----------
document.getElementById('pm-add-btn').addEventListener('click', () => openEditor(null));
document.getElementById('pm-cancel').addEventListener('click', closeEditor);
document.getElementById('pm-add-variant').addEventListener('click', () => addVariantRow());
fImage.addEventListener('input', updateImagePreview);
searchEl.addEventListener('input', () => { searchQuery = searchEl.value; renderList(); });
modal.addEventListener('click', e => { if (e.target === modal) closeEditor(); });

// ---------- Init ----------
populateCategorySelect();
if (isUnlocked()) { showAuth(false); loadProducts(); }
else { showAuth(true); }

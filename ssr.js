/**
 * Server-side rendering for SEO-crawlable category and product pages.
 *
 * The storefront catalog is injected client-side by app.js, so search engines
 * see an almost-empty homepage. These functions render real HTML (product
 * names, prices, descriptions + Product / ItemList / Breadcrumb schema) at
 * request time from the live catalog, giving every category and product its
 * own indexable URL. The pages are lightweight landing pages: the "Order" CTA
 * links back into the single-page store, which handles the cart.
 *
 * Pure rendering only — server.js fetches the catalog (Supabase, or the seed
 * fallback) and passes it in.
 */

const BASE_URL = 'https://khandelwalandsons.in';

// Per-category display metadata + SEO copy (local keywords woven in).
const CATEGORIES = {
  dairy: {
    label: 'Dairy & Cheese',
    title: 'Dairy & Cheese in Ghatkopar, Mumbai',
    description: 'Fresh dairy and cheese — Amul butter, paneer, ghee, cream, mozzarella and processed cheese — delivered in Ghatkopar West, Mumbai. Cash on delivery.',
    intro: 'Everyday dairy and cheese from trusted brands like Amul, Gowardhan and Derista — butter, paneer, ghee, dahi, fresh cream and a full range of cheese for home and commercial kitchens. Order online for home delivery across Ghatkopar and nearby areas in Mumbai, with cash on delivery confirmed by phone.'
  },
  beverages: {
    label: 'Milk & Beverages',
    title: 'Milk & Beverages in Ghatkopar, Mumbai',
    description: 'Buy fresh milk, buttermilk, lassi, flavoured milk and tea in Ghatkopar West, Mumbai. Home delivery with cash on delivery from Khandelwal & Sons.',
    intro: 'Daily milk, buttermilk, chaas, lassi and flavoured milk drinks in convenient pack sizes. Perfect for households, cafes and tea stalls. Delivered fresh across Ghatkopar, Mumbai with cash on delivery.'
  },
  frozen: {
    label: 'Frozen & Ready-to-Cook',
    title: 'Frozen & Ready-to-Cook Foods in Ghatkopar, Mumbai',
    description: 'French fries, burger patties, parathas, momos, nuggets and pizza bases — frozen foods delivered in Ghatkopar West, Mumbai. Cash on delivery.',
    intro: 'A wide range of frozen and ready-to-cook foods for restaurants, cafes and busy homes — French fries in every cut, burger patties, parathas, momos, nuggets, wedges and pizza bases from McCain, HyFun, Falcon and more. Bulk-friendly packs delivered across Mumbai.'
  },
  snacks: {
    label: 'Snacks & Chocolates',
    title: 'Snacks & Chocolates in Ghatkopar, Mumbai',
    description: 'Chips, namkeen, biscuits and chocolates delivered in Ghatkopar West, Mumbai. Order online from Khandelwal & Sons with cash on delivery.',
    intro: 'Everyday snacks and chocolates — banana chips, namkeen mixes, biscuits, and Cadbury favourites. Great for stocking the pantry or a shop counter. Home delivery in Ghatkopar, Mumbai.'
  },
  sweets: {
    label: 'Indian Sweets (Mithai)',
    title: 'Indian Sweets & Mithai in Ghatkopar, Mumbai',
    description: 'Order fresh Indian sweets — kaju katli, gulab jamun, rasgulla, motichoor ladoo, soan papdi and more — in Ghatkopar West, Mumbai. Available 250gm to 5kg, cash on delivery.',
    intro: 'Fresh, traditional Indian mithai for festivals, gifting and everyday treats — kaju katli, gulab jamun, rasgulla, rasmalai, motichoor ladoo, soan papdi, milk cake and many more. Every sweet is available loose from 250gm up to 5kg boxes, delivered across Ghatkopar and Mumbai with cash on delivery.'
  },
  bakery: {
    label: 'Bakery',
    title: 'Bakery & Bread in Ghatkopar, Mumbai',
    description: 'Fresh bread and bakery items delivered in Ghatkopar West, Mumbai. Order online from Khandelwal & Sons with cash on delivery.',
    intro: 'Fresh bread and everyday bakery essentials, delivered to your door in Ghatkopar, Mumbai.'
  },
  ingredients: {
    label: 'Cooking Ingredients',
    title: 'Cooking Ingredients in Ghatkopar, Mumbai',
    description: 'Cooking cream, mayonnaise, cheese sauce, compound chocolate and baking ingredients delivered in Ghatkopar West, Mumbai. Cash on delivery.',
    intro: 'Professional and home cooking ingredients — cooking creams, mayonnaise, cheese sauces, compound chocolate and chocolate strands for baking and catering. Bulk packs delivered across Mumbai.'
  }
};

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

// Build a stable, collision-free slug for every product.
function buildSlugMap(products) {
  const idToSlug = {};
  const slugToId = {};
  products.forEach((p, i) => {
    let base = slugify(p.name);
    let slug = base;
    if (slugToId[slug] !== undefined) slug = `${base}-${slugify(p.category)}`;
    if (slugToId[slug] !== undefined) slug = `${base}-${i + 1}`;
    idToSlug[p.id] = slug;
    slugToId[slug] = p.id;
  });
  return { idToSlug, slugToId };
}

function absUrl(u) {
  if (!u) return `${BASE_URL}/images/logo.png`;
  if (/^https?:\/\//i.test(u)) return u;
  return `${BASE_URL}/${String(u).replace(/^\/+/, '')}`;
}

const money = n => '₹' + (Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(2));

function priceRange(product) {
  const prices = (product.variants || []).map(v => Number(v.price) || 0).filter(p => p > 0);
  if (!prices.length) return { low: 0, high: 0 };
  return { low: Math.min(...prices), high: Math.max(...prices) };
}

function inStock(product) {
  return (product.variants || []).some(v => (Number(v.stock) || 0) > 0);
}

// ---------- Shared layout ----------

function layout({ title, description, canonical, ogImage, jsonLd, breadcrumbTrail, bodyHtml }) {
  const crumbs = breadcrumbTrail
    .map((c, i) => c.url
      ? `<a href="${escapeHtml(c.url)}">${escapeHtml(c.name)}</a>`
      : `<span>${escapeHtml(c.name)}</span>`)
    .join(' <span class="sep">/</span> ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#8B5E3C">
  <link rel="icon" href="/images/logo.png">
  <meta property="og:site_name" content="Khandelwal & Sons">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:locale" content="en_IN">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap">
  <link rel="stylesheet" href="/style.css?v=12">
  <style>
    .seo-wrap { max-width: 1180px; margin: 0 auto; padding: 24px 20px 64px; }
    .seo-breadcrumb { font-size: .85rem; color: var(--text-secondary, #7a6f60); margin: 12px 0 20px; }
    .seo-breadcrumb a { color: var(--primary, #8B5E3C); text-decoration: none; }
    .seo-breadcrumb .sep { margin: 0 4px; opacity: .5; }
    .seo-topbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(0,0,0,.06); }
    .seo-topbar a.brand { display: flex; align-items: center; gap: 10px; font-family: 'Playfair Display', serif; font-size: 1.4rem; color: var(--primary, #8B5E3C); text-decoration: none; font-weight: 700; }
    .seo-topbar img { width: 44px; height: 44px; object-fit: contain; }
    .seo-topbar .store-cta { background: var(--primary, #8B5E3C); color: #fff; padding: 10px 18px; border-radius: 999px; text-decoration: none; font-size: .9rem; font-weight: 600; }
    .seo-h1 { font-family: 'Playfair Display', serif; font-size: clamp(1.8rem, 4vw, 2.6rem); color: var(--text-primary, #2b2320); margin: 0 0 12px; }
    .seo-intro { max-width: 760px; color: var(--text-secondary, #6b6055); line-height: 1.7; margin-bottom: 32px; }
    .seo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
    .seo-card { border: 1px solid rgba(0,0,0,.07); border-radius: 16px; overflow: hidden; background: #fff; text-decoration: none; color: inherit; display: flex; flex-direction: column; transition: box-shadow .2s, transform .2s; }
    .seo-card:hover { box-shadow: 0 10px 30px rgba(0,0,0,.08); transform: translateY(-3px); }
    .seo-card img { width: 100%; aspect-ratio: 1/1; object-fit: cover; background: #f6f1ea; }
    .seo-card .body { padding: 14px 16px; }
    .seo-card .name { font-weight: 600; font-size: .98rem; margin-bottom: 6px; color: var(--text-primary, #2b2320); }
    .seo-card .price { color: var(--primary, #8B5E3C); font-weight: 600; font-size: .95rem; }
    .pdp { display: grid; grid-template-columns: minmax(0, 440px) 1fr; gap: 40px; align-items: start; }
    .pdp img.hero { width: 100%; border-radius: 20px; background: #f6f1ea; aspect-ratio: 1/1; object-fit: cover; }
    .pdp table { border-collapse: collapse; width: 100%; max-width: 420px; margin: 18px 0 26px; }
    .pdp th, .pdp td { text-align: left; padding: 10px 14px; border-bottom: 1px solid rgba(0,0,0,.07); font-size: .95rem; }
    .pdp th { color: var(--text-secondary, #6b6055); font-weight: 500; }
    .pdp .price-cell { font-weight: 600; color: var(--primary, #8B5E3C); }
    .pdp .order-cta { display: inline-block; background: var(--primary, #8B5E3C); color: #fff; padding: 14px 30px; border-radius: 999px; text-decoration: none; font-weight: 600; }
    .pdp .avail { font-size: .9rem; margin: 8px 0 20px; }
    .pdp .avail.in { color: #2e7d32; } .pdp .avail.out { color: #c0392b; }
    .related h2 { font-family: 'Playfair Display', serif; margin: 56px 0 20px; }
    .seo-footer { border-top: 1px solid rgba(0,0,0,.06); padding: 28px 20px; text-align: center; color: var(--text-secondary, #7a6f60); font-size: .88rem; line-height: 1.7; }
    .seo-footer a { color: var(--primary, #8B5E3C); }
    @media (max-width: 760px) { .pdp { grid-template-columns: 1fr; gap: 24px; } }
  </style>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <div class="seo-topbar">
    <a class="brand" href="/"><img src="/images/logo.png" alt="Khandelwal & Sons logo">Khandelwal &amp; Sons</a>
    <a class="store-cta" href="/#catalog">Shop the full store</a>
  </div>
  <div class="seo-wrap">
    <nav class="seo-breadcrumb">${crumbs}</nav>
    ${bodyHtml}
  </div>
  <footer class="seo-footer">
    <strong>Khandelwal &amp; Sons</strong> — Municipal Complex, 71 Hirachand Desai Road, Sarvoday Station Road, Ghatkopar West, Mumbai, Maharashtra 400086<br>
    Mon–Sat 6:00 AM–9:00 PM · Sun 6:00 AM–1:00 PM · Call / WhatsApp <a href="https://wa.me/919321782424">+91 93217 82424</a><br>
    &copy; 2026 Khandelwal &amp; Sons. All rights reserved.
  </footer>
</body>
</html>`;
}

// ---------- Category page ----------

function renderCategoryPage(catSlug, products, slugMap) {
  const meta = CATEGORIES[catSlug];
  if (!meta) return null;
  const items = products.filter(p => p.category === catSlug);
  const canonical = `${BASE_URL}/category/${catSlug}`;

  const cards = items.map(p => {
    const { low } = priceRange(p);
    const url = `/product/${slugMap.idToSlug[p.id]}`;
    return `<a class="seo-card" href="${url}">
      <img src="${escapeHtml(absUrl(p.image))}" alt="${escapeHtml(p.name)}" loading="lazy" width="220" height="220">
      <div class="body">
        <div class="name">${escapeHtml(p.name)}</div>
        ${low ? `<div class="price">from ${money(low)}</div>` : ''}
      </div>
    </a>`;
  }).join('\n');

  const bodyHtml = `
    <h1 class="seo-h1">${escapeHtml(meta.label)}</h1>
    <p class="seo-intro">${escapeHtml(meta.intro)}</p>
    ${items.length ? `<div class="seo-grid">${cards}</div>` : '<p>Products in this category are coming soon.</p>'}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: meta.label, item: canonical }
        ]
      },
      {
        '@type': 'ItemList',
        name: meta.label,
        numberOfItems: items.length,
        itemListElement: items.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${BASE_URL}/product/${slugMap.idToSlug[p.id]}`,
          name: p.name
        }))
      }
    ]
  };

  return layout({
    title: `${meta.title} | Khandelwal & Sons`,
    description: meta.description,
    canonical,
    ogImage: absUrl(items[0] && items[0].image),
    jsonLd,
    breadcrumbTrail: [{ name: 'Home', url: '/' }, { name: meta.label }],
    bodyHtml
  });
}

// ---------- Product page ----------

function renderProductPage(slug, products, slugMap) {
  const id = slugMap.slugToId[slug];
  if (id === undefined) return null;
  const product = products.find(p => p.id === id);
  if (!product) return null;

  const meta = CATEGORIES[product.category] || { label: product.category };
  const canonical = `${BASE_URL}/product/${slug}`;
  const { low, high } = priceRange(product);
  const available = inStock(product);
  const availUrl = available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

  const rows = (product.variants || []).map(v => {
    const s = (Number(v.stock) || 0) > 0;
    return `<tr>
      <th scope="row">${escapeHtml(v.size || 'Standard')}</th>
      <td class="price-cell">${money(v.price)}</td>
      <td>${s ? 'In stock' : 'Out of stock'}</td>
    </tr>`;
  }).join('\n');

  const priceText = low === high ? money(low) : `${money(low)} – ${money(high)}`;
  const descr = `Buy ${product.name} from Khandelwal & Sons in Ghatkopar West, Mumbai. `
    + (product.category === 'sweets'
        ? `Freshly made ${meta.label.toLowerCase()}, available from 250gm to 5kg. `
        : `Part of our ${meta.label.toLowerCase()} range. `)
    + `Priced at ${priceText}. Order online for home delivery with cash on delivery, confirmed by phone.`;

  // Related products from the same category (up to 4)
  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
  const relatedHtml = related.length ? `
    <div class="related">
      <h2>More ${escapeHtml(meta.label)}</h2>
      <div class="seo-grid">
        ${related.map(p => {
          const r = priceRange(p);
          return `<a class="seo-card" href="/product/${slugMap.idToSlug[p.id]}">
            <img src="${escapeHtml(absUrl(p.image))}" alt="${escapeHtml(p.name)}" loading="lazy" width="220" height="220">
            <div class="body"><div class="name">${escapeHtml(p.name)}</div>${r.low ? `<div class="price">from ${money(r.low)}</div>` : ''}</div>
          </a>`;
        }).join('\n')}
      </div>
    </div>` : '';

  const bodyHtml = `
    <div class="pdp">
      <img class="hero" src="${escapeHtml(absUrl(product.image))}" alt="${escapeHtml(product.name)}" width="440" height="440">
      <div>
        <h1 class="seo-h1">${escapeHtml(product.name)}</h1>
        <p class="avail ${available ? 'in' : 'out'}">${available ? '✓ In stock — ready for delivery' : 'Currently out of stock'}</p>
        <p class="seo-intro" style="margin-bottom:18px">${escapeHtml(descr)}</p>
        <table>
          <thead><tr><th scope="col">Size</th><th scope="col">Price</th><th scope="col">Availability</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <a class="order-cta" href="/?p=${encodeURIComponent(product.id)}#catalog">Order this on the store →</a>
      </div>
    </div>
    ${relatedHtml}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: meta.label, item: `${BASE_URL}/category/${product.category}` },
          { '@type': 'ListItem', position: 3, name: product.name, item: canonical }
        ]
      },
      {
        '@type': 'Product',
        name: product.name,
        image: [absUrl(product.image)],
        description: descr,
        category: meta.label,
        brand: { '@type': 'Brand', name: 'Khandelwal & Sons' },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: low,
          highPrice: high,
          offerCount: (product.variants || []).length,
          availability: availUrl,
          seller: { '@type': 'Organization', name: 'Khandelwal & Sons' }
        }
      }
    ]
  };

  return layout({
    title: `${product.name} — Buy Online in Ghatkopar, Mumbai | Khandelwal & Sons`,
    description: descr.slice(0, 300),
    canonical,
    ogImage: absUrl(product.image),
    jsonLd,
    breadcrumbTrail: [
      { name: 'Home', url: '/' },
      { name: meta.label, url: `/category/${product.category}` },
      { name: product.name }
    ],
    bodyHtml
  });
}

// ---------- Sitemap ----------

function renderSitemap(products, slugMap) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [`  <url><loc>${BASE_URL}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`];

  Object.keys(CATEGORIES).forEach(slug => {
    if (products.some(p => p.category === slug)) {
      urls.push(`  <url><loc>${BASE_URL}/category/${slug}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    }
  });

  products.forEach(p => {
    urls.push(`  <url><loc>${BASE_URL}/product/${slugMap.idToSlug[p.id]}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

module.exports = {
  CATEGORIES,
  slugify,
  buildSlugMap,
  renderCategoryPage,
  renderProductPage,
  renderSitemap
};

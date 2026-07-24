/**
 * Catalog seed data + grouping logic.
 *
 * This is ONLY used to seed the Supabase `products` table the first time the
 * table is empty. After seeding, the database is the single source of truth
 * and the owner edits products live from the admin page — this file is never
 * read again unless the table is wiped.
 *
 * The grouping logic here is copied verbatim from the original storefront so
 * the migrated products (ids, sizes, images) match exactly what customers saw.
 */

// Current inventory from Stock Summry-1.xlsx. Rates are in Indian rupees.
const STOCK_ITEMS = [
  ['Amul Butter 100gm',160,52.02,'dairy'],['Amul Butter 500gm Cp',49.5,520.88,'dairy'],['Amul Butter Milk 200ml',660,12.91,'beverages'],['Amul Butter Sandwich Bread 200gm',120,16.92,'bakery'],['Amul Butter School',27,64.41,'dairy'],['Amul Cheese Block 1kg',58,22.37,'dairy'],['Amul Cheese Slice',8,389.52,'dairy'],['Amul Dahi 200gm',192,19.26,'dairy'],['Amul Dahi 800gm Pouch',420,42.63,'dairy'],['Amul Fresh Cream 1 Ltr',176,221.15,'dairy'],['Amul Fresh Cream 250ml',15,66.28,'dairy'],['Amul Fresh Paneer 15x200gm',15,76.38,'dairy'],['Amul Ghee 1Ltr',20,567.42,'dairy'],['Amul Gold Tetra Pack 1lr',60,77.84,'beverages'],['Amul Kool Cafe 30x200 Ml',30,29.99,'beverages'],['Amul Kool Kesar, Badam, Elachi, Rose',60,21.05,'beverages'],['Amul Lassi 32x250ml',64,21.25,'beverages'],['Amul Masti Dahi 1Kg',512,65.75,'dairy'],['Amul Probiotic Lassi Rose 24x180ml',24,14.71,'beverages'],['Amul Tadka Chaas 40x280 Ml Pouch',40,8.07,'beverages'],['Amul Unsalted Butter',4,260.67,'dairy'],['Buffalo Milk',591,68.01,'beverages'],['Buttermilk 440ml',2938,12.69,'beverages'],['Butter Milk Jeera 500ml',192,15.99,'beverages'],['CDM Roast Almond 36gm',5,40.10,'snacks'],['Chees Chiplet 12x40',24,523.42,'snacks'],['Choco Strands ST D 10 Kg',10,285.71,'ingredients'],['Crackle 36gm',5,40.10,'snacks'],['Crackle 75gm',5,87.57,'snacks'],['Dark Compound 400gm',22,129.88,'ingredients'],['Delicious Butter',15,140,'dairy'],['Derista - Analogue Processed Cheese Block 1kg',24,363.59,'dairy'],['Derista - Dairy Slices',14,68.25,'dairy'],['Derista - Filler Cheese 500gm',189,164.12,'dairy'],['Derista - Mozarella Cheese Diced 1 Kg',101,372.75,'dairy'],['Derista - Mozarella Pizza Topping Diced 1 Kg',270,355.64,'dairy'],['Derista - Mozzarella Cheese Blend 1 Kg',89,372.66,'dairy'],['Derista - Orange Chadder',11,474.04,'dairy'],['Derista - Processed Cheese Block Hard 1 KG',138,391.19,'dairy'],['Derista - Processed Soft Cheese Block 1 Kg',150,377.96,'dairy'],['Derista - Sandwich Slice (780g)',131,284.21,'dairy'],['Derista - UTH Brick Toned Milk 1ltr',90,57.78,'beverages'],['Dlecta Cheese Sauce 1kg Tub',6,415.98,'ingredients'],['Dlecta Mascarpone Cheese 400gm (24pcs)',12,287.51,'dairy'],['Ecotrop Whip Cream',14,52.38,'dairy'],['Flexi Cream 1kg',38,136.57,'dairy'],['Fr Salad Mayonnaise 1 KG (15)',44,69.52,'ingredients'],['Govind Dahi 150 Gm',24,14.98,'dairy'],['Govind UHT Cream 1 Ltr with Cap',12,192.31,'dairy'],['Gowardhan Cheese 1 KG',68,442.22,'dairy'],['Gowardhan Fresh Milk',444,49.95,'beverages'],['Gowardhan Ghee 1 Ltr',10,695.24,'dairy'],['Gowardhan Tea Special',36,53.50,'beverages'],['Hungritos - Premium French Fries 6mm 2.5 Kg',9,210.47,'frozen'],['Hungritos - Premium French Fries 9mm 2.5 Kg',5,220.15,'frozen'],['Hyfun French Fries Straight',20,223.81,'frozen'],['Maharaja Halwa',1,240,'sweets'],['Mathura Peda',1,400,'sweets'],['Mc Cains Sure Crisp Coated Fries 11mm 2.5KG',30,367.20,'frozen'],['Mc Cains v Crispers .2kg 6Pack',6,394.83,'frozen'],['Melody Classic - Chocolate - 48P',4,42.52,'snacks'],['Mirch Masala Banana Chips 150gm',4,48.84,'snacks'],['Nadiyadi Mix 170gm',3,36.29,'snacks'],['Nutralite Block 500gm - Butter',1456,46.80,'dairy'],['Parle-G Classic - Regular - 72 P',2,103.90,'snacks'],['Pineapple Halwa',1,240,'sweets'],['Premium Panchmeva 405gm',4,392.14,'sweets'],['Qualita Special Cheese 1 Kg',35,283.75,'dairy'],["Rich's Cooking Cream 1kg",10,192.53,'dairy'],['Aloo Paratha 120gm',44,45.46,'frozen'],['Falcon - Burger Patty 1.2 Kg 12P',18,135.70,'frozen'],['Falcon - French Fries 9mm Straight Cut 2.5 Kg',265,219.22,'frozen'],['Falcon - Lachha Paratha 1040 Gm 12+1 Pcs',98,119.13,'frozen'],['Goeld - French Fries 400gm',120,21.77,'frozen'],['Goeld - French Fries 9mm',78,179.35,'frozen'],['Hungritors - Chees Corn Nuggets 1 Kg (12kg)',12,349.60,'frozen'],['Hungritors - Herbed Potato Wedges 2.5 Kg',10,292.51,'frozen'],['Hungritos - Premium French Fries 6mm 2.5 Kg',30,223.75,'frozen'],['Hungritos - Premium French Fries 9mm 2.5 Kg',175,221.74,'frozen'],['Hy Fun - Burger Patty',16,167.65,'frozen'],['Hy Fun - French Fries Crinkle Cut 11mm 1 Kg =10',88,130.13,'frozen'],['Hy Fun - French Fries Shoestring 6MM',61,262.75,'frozen'],['Hy Fun - French Fries Straight Cut 9mm',42,262.75,'frozen'],['Hy Fun Mixed Veg Gyozas Momos',6,171.41,'frozen'],['Hy Fun - Pizza Regular 7" Margherita',24,42.27,'frozen'],['Hy fun - Pizza Regular 7" Tandoori Paneer',36,55.42,'frozen'],['Hy Fun - Super Crispy Coated French Fries 11mm 2.5 Kg',25,364.03,'frozen'],['Sweet Corn',35,75,'frozen'],
  ['Gulab Jamun 1kg',15,320,'sweets'],['Rasgulla 1kg',12,280,'sweets'],['Kaju Katli 500gm',10,450,'sweets'],['Motichoor Ladoo 500gm',14,260,'sweets'],['Besan Ladoo 500gm',12,240,'sweets'],['Rasmalai 1kg',8,360,'sweets'],['Jalebi 500gm',20,180,'sweets'],['Milk Barfi 500gm',10,300,'sweets'],['Soan Papdi 500gm',18,160,'sweets'],['Mysore Pak 500gm',9,320,'sweets'],['Kalakand 500gm',8,340,'sweets'],['Milk Cake 500gm',10,330,'sweets'],['Gajar Halwa 500gm',6,280,'sweets'],['Moong Dal Halwa 500gm',6,320,'sweets'],['Balushahi 500gm',10,220,'sweets'],['Imarti 500gm',8,200,'sweets'],['Agra Petha 500gm',12,180,'sweets'],['Ghevar 500gm',7,300,'sweets'],['Malpua 500gm',6,240,'sweets'],['Coconut Barfi 500gm',9,280,'sweets']
];

const CATEGORY_FALLBACK = {
  dairy: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=700&q=80',
  beverages: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=700&q=80',
  frozen: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=80',
  snacks: 'https://images.unsplash.com/photo-1599599810694-b5b37304c041?auto=format&fit=crop&w=700&q=80',
  sweets: 'https://images.unsplash.com/photo-1589119908995-c6837fa14848?auto=format&fit=crop&w=700&q=80',
  bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80',
  ingredients: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=700&q=80'
};

const PRODUCT_IMAGE_RULES = [
  [/amul butter milk/, 'amul-buttermilk.jpg'],
  [/amul butter sandwich bread/, 'bread.jpg'],
  [/amul unsalted butter/, 'amul-butter-unsalted.jpg'],
  [/amul butter/, 'amul-butter.jpg'],
  [/amul cheese block/, 'amul-cheese-block.jpg'],
  [/amul cheese slice/, 'amul-cheese-slices.jpg'],
  [/amul (masti )?dahi/, 'amul-dahi.jpg'],
  [/amul fresh cream/, 'amul-cream.jpg'],
  [/amul fresh paneer/, 'amul-paneer.jpg'],
  [/amul ghee/, 'amul-ghee.jpg'],
  [/amul gold/, 'amul-gold-milk.jpg'],
  [/kool cafe/, 'amul-kool-cafe.jpg'],
  [/amul kool/, 'amul-kool.jpg'],
  [/\blassi\b/, 'amul-lassi.jpg'],
  [/tadka chaas|buttermilk|butter milk/, 'amul-chaas.jpg'],
  [/buffalo milk/, 'buffalo-milk.jpg'],
  [/\bcdm\b|roast almond/, 'cdm-roast-almond.jpg'],
  [/chiplet/, 'cheeselings.jpg'],
  [/choco strands/, 'choco-strands.jpg'],
  [/crackle/, 'amul-crackle.jpg'],
  [/dark compound/, 'dark-compound.jpg'],
  [/delicious butter/, 'butter-generic.jpg'],
  [/diced|pizza topping/, 'mozzarella-diced.jpg'],
  [/mozzarella|mozarella/, 'mozzarella-pizza.jpg'],
  [/dairy slices|sandwich slice/, 'amul-cheese-slices.jpg'],
  [/\buth\b/, 'toned-milk-carton.jpg'],
  [/derista|qualita/, 'cheese-generic.jpg'],
  [/cheese sauce/, 'cheese-sauce.jpg'],
  [/mascarpone/, 'mascarpone.jpg'],
  [/govind dahi/, 'curd-cup.jpg'],
  [/ecotrop|whip cream|flexi cream|govind uht cream/, 'whipping-cream.jpg'],
  [/mayonnaise/, 'mayonnaise.jpg'],
  [/gowardhan cheese/, 'gowardhan-cheese.jpg'],
  [/gowardhan ghee/, 'gowardhan-ghee.jpg'],
  [/gowardhan fresh milk|gowardhan tea/, 'milk-pouch.jpg'],
  [/nuggets/, 'corn-nuggets.jpg'],
  [/wedges/, 'potato-wedges.jpg'],
  [/hungrito.*fries/, 'hungritos-fries.jpg'],
  [/mc ?cains?/, 'mccain-fries.jpg'],
  [/pizza/, 'hyfun-pizza.jpg'],
  [/momos|gyozas/, 'momos.jpg'],
  [/burger patty/, 'burger-patty.jpg'],
  [/hy ?fun.*fries/, 'hyfun-fries.jpg'],
  [/fries/, 'fries-generic.jpg'],
  [/aloo paratha/, 'aloo-paratha.jpg'],
  [/paratha/, 'lachha-paratha.jpg'],
  [/halwa/, 'halwa.jpg'],
  [/\bpeda\b/, 'mathura-peda.jpg'],
  [/melody/, 'melody.jpg'],
  [/banana chips/, 'banana-chips.jpg'],
  [/nadiyadi/, 'namkeen-mix.jpg'],
  [/nutralite/, 'nutralite.jpg'],
  [/parle.?g\b/, 'parle-g.jpg'],
  [/panchmeva/, 'panchmeva.jpg'],
  [/rich'?s/, 'richs-cream.jpg'],
  [/sweet corn/, 'sweet-corn.jpg'],
  [/cream/, 'whipping-cream.jpg'],
  [/milk/, 'milk-pouch.jpg'],
  [/chees/, 'cheese-generic.jpg']
];

const SWEET_IMAGE_RULES = [
  [/coconut\s*barfi/, 'Coconut_Barfi.jpg'],
  [/kaju\s*katli/, 'Kaju_Katli.jpg'],
  [/motichoor/, 'Motichoor_Laddu.jpg'],
  [/besan\s*lad+[ou]/, 'Besan_Laddu.jpg'],
  [/boondi/, 'Boondi_Laddu.jpg'],
  [/rasmalai/, 'Rasmalai.jpg'],
  [/rasgulla/, 'Rasgulla.jpg'],
  [/jalebi/, 'Jalebi.jpg'],
  [/imarti|imrati/, 'Imarti.jpg'],
  [/soan\s*papdi/, 'Soan_Papdi.jpg'],
  [/patisa/, 'Patisa.jpg'],
  [/mysore\s*pak/, 'Mysore_Pak.jpg'],
  [/kalakand/, 'Kalakand.jpg'],
  [/milk\s*cake/, 'Milk_Cake.jpg'],
  [/milk\s*barfi|barfi/, 'Barfi.jpg'],
  [/balushahi/, 'Balushahi.jpg'],
  [/ghe(v|w)ar/, 'Ghewar.jpg'],
  [/malpua/, 'Malpua.jpg'],
  [/modak/, 'Modak.jpg'],
  [/cham\s*cham/, 'Cham_Cham.jpg'],
  [/sandesh/, 'Sandesh.jpg'],
  [/shrikhand/, 'Shrikhand.jpg'],
  [/basundi/, 'Basundi.jpg'],
  [/rab(ri|di)/, 'Rabri.jpg'],
  [/phirni/, 'Phirni.jpg'],
  [/kheer/, 'Kheer.jpg'],
  [/puran\s*poli/, 'Puran_Poli.jpg'],
  [/\bpeda\b/, 'Peda.jpg'],
  [/panchmeva/, 'panchmeva.jpg'],
  [/\bhalwa\b/, 'halwa.jpg'],
  [/lad+[ou]/, 'Laddu.jpg']
];

function getProductImage(name, category) {
  const label = name.toLowerCase();
  if (category === 'sweets') {
    const sweet = SWEET_IMAGE_RULES.find(([pattern]) => pattern.test(label));
    return sweet ? `images/${sweet[1]}` : CATEGORY_FALLBACK.sweets;
  }
  const rule = PRODUCT_IMAGE_RULES.find(([pattern]) => pattern.test(label));
  return rule ? `images/${rule[1]}` : (CATEGORY_FALLBACK[category] || '');
}

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

// Sweets are sold loose by weight, so offer a standard size ladder from
// 250gm up to 5kg, priced proportionally from the item's base price.
const SWEET_SIZES = [
  ['250gm', 250], ['500gm', 500], ['750gm', 750], ['1kg', 1000],
  ['1.5kg', 1500], ['2kg', 2000], ['3kg', 3000], ['5kg', 5000]
];

function gramsOf(sizeStr) {
  const m = String(sizeStr).match(/([\d.]+)\s*(kg|gm|g)/i);
  if (!m) return 1000;
  const n = parseFloat(m[1]);
  return /kg/i.test(m[2]) ? n * 1000 : n;
}

function sweetVariants(baseVariant, productId) {
  const grams = gramsOf(baseVariant.size) || 1000;
  const perGram = (Number(baseVariant.price) || 0) / grams;
  return SWEET_SIZES.map(([label, g]) => ({
    id: `${productId}-${g}`,
    size: label,
    price: Math.round(perGram * g),
    stock: 20
  }));
}

// Build the grouped product list, identical in shape to the original
// client-side catalog: { id, name, category, image_url, sort_order, variants:[{id,size,price,stock}] }.
function buildSeedProducts() {
  const catalog = new Map();
  STOCK_ITEMS.forEach(([sourceName, stock, price, category], index) => {
    const name = getProductName(sourceName);
    const key = `${category}:${name.toLowerCase()}`;
    if (!catalog.has(key)) {
      catalog.set(key, {
        id: `product-${catalog.size + 1}`,
        name,
        category,
        image_url: getProductImage(name, category),
        sort_order: catalog.size + 1,
        variants: []
      });
    }
    const product = catalog.get(key);
    const size = getProductSize(sourceName);
    const existingVariant = product.variants.find(v => v.size === size);
    if (existingVariant) {
      existingVariant.stock += stock;
      existingVariant.price = price;
    } else {
      product.variants.push({ id: `variant-${index + 1}`, size, price, stock });
    }
  });
  const list = Array.from(catalog.values());
  // Give every sweet the full 250gm–5kg size ladder.
  list.forEach(p => {
    if (p.category === 'sweets' && p.variants.length) {
      p.variants = sweetVariants(p.variants[0], p.id);
    }
  });
  return list;
}

module.exports = { buildSeedProducts };

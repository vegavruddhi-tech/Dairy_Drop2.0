/**
 * Predefined Top 10 Dairy Catalog Products for Milkmen.
 * When milkman selects an item from the dropdown, all details (Name, Unit, Price, Description, Image)
 * are populated automatically. Milkman only sets stock and tweaks price if needed.
 */
export const TOP_CATALOG_PRODUCTS = [
  {
    id: 'fresh-malai-paneer',
    name: 'Fresh Malai Paneer',
    category: 'Paneer',
    unit: 'kg',
    defaultPrice: '420.00',
    defaultStock: '15',
    description: 'Fresh, soft, and hygienic malai paneer made from pure whole milk without any preservatives.',
    imageUrl: '/products/paneer.jpg',
  },
  {
    id: 'pure-desi-cow-ghee',
    name: 'Pure Desi Cow Ghee',
    category: 'Ghee',
    unit: 'L',
    defaultPrice: '950.00',
    defaultStock: '10',
    description: 'Traditional bilona method golden cow ghee. Rich natural aroma, granular danedar texture.',
    imageUrl: '/products/ghee.jpg',
  },
  {
    id: 'fresh-dahi-curd',
    name: 'Fresh Set Dahi (Curd)',
    category: 'Curd',
    unit: 'kg',
    defaultPrice: '120.00',
    defaultStock: '20',
    description: 'Thick, creamy, and probiotic fresh set curd made daily from pure farm milk.',
    imageUrl: '/products/dahi.jpg',
  },
  {
    id: 'fresh-white-butter',
    name: 'Fresh White Butter (Makhan)',
    category: 'Butter',
    unit: 'kg',
    defaultPrice: '650.00',
    defaultStock: '8',
    description: 'Authentic unsalted homemade white makhan, hand-churned fresh every morning.',
    imageUrl: '/products/butter.jpg',
  },
  {
    id: 'masala-chaas',
    name: 'Masala Chaas (Spiced Buttermilk)',
    category: 'Beverage',
    unit: 'L',
    defaultPrice: '45.00',
    defaultStock: '25',
    description: 'Chilled refreshing buttermilk seasoned with roasted jeera, rock salt, and fresh mint.',
    imageUrl: '/products/chaas.jpg',
  },
  {
    id: 'fresh-milk-malai-cream',
    name: 'Fresh Milk Cream (Malai)',
    category: 'Cream',
    unit: 'kg',
    defaultPrice: '380.00',
    defaultStock: '5',
    description: 'Rich, thick, and velvety natural dairy malai skimmed from fresh boiled milk.',
    imageUrl: '/products/malai.jpg',
  },
  {
    id: 'sweet-punjabi-lassi',
    name: 'Sweet Punjabi Lassi',
    category: 'Beverage',
    unit: 'L',
    defaultPrice: '80.00',
    defaultStock: '20',
    description: 'Creamy sweet yogurt drink infused with cardamom, saffron, and a dollop of fresh malai.',
    imageUrl: '/products/lassi.jpg',
  },
  {
    id: 'fresh-khoya-mawa',
    name: 'Fresh Danedar Khoya (Mawa)',
    category: 'Mawa',
    unit: 'kg',
    defaultPrice: '460.00',
    defaultStock: '10',
    description: '100% pure condensed milk solids, slow-cooked to perfection for rich sweets and gravies.',
    imageUrl: '/products/mawa.jpg',
  },
  {
    id: 'low-fat-protein-paneer',
    name: 'Low-Fat Protein Paneer',
    category: 'Paneer',
    unit: 'kg',
    defaultPrice: '450.00',
    defaultStock: '12',
    description: 'High-protein, low-fat paneer crafted from double-toned milk. Ideal for fitness enthusiasts.',
    imageUrl: '/products/paneer.jpg',
  },
  {
    id: 'traditional-milk-peda',
    name: 'Traditional Mathura Peda',
    category: 'Sweets',
    unit: 'kg',
    defaultPrice: '520.00',
    defaultStock: '8',
    description: 'Caramelized milk solids infused with green cardamom and pure desi ghee.',
    imageUrl: '/products/ghee.jpg',
  },
];

/**
 * Accurately resolve unique product image based on product name/keywords.
 */
export function resolveProductImage(product) {
  if (product?.imageUrl && product.imageUrl.trim()) {
    return product.imageUrl;
  }
  const name = String(product?.name || '').toLowerCase();
  if (name.includes('ghee')) return '/products/ghee.jpg';
  if (name.includes('butter') || name.includes('makhan')) return '/products/butter.jpg';
  if (name.includes('dahi') || name.includes('curd')) return '/products/dahi.jpg';
  if (name.includes('chaas') || name.includes('buttermilk')) return '/products/chaas.jpg';
  if (name.includes('malai') || name.includes('cream')) return '/products/malai.jpg';
  if (name.includes('lassi')) return '/products/lassi.jpg';
  if (name.includes('mawa') || name.includes('khoya')) return '/products/mawa.jpg';
  if (name.includes('milk') || name.includes('doodh')) return '/products/milk.jpg';
  if (name.includes('paneer')) return '/products/paneer.jpg';
  return '/products/paneer.jpg';
}

/**
 * Accurately resolve product description when not provided by milkman.
 */
export function resolveProductDescription(product) {
  if (product?.description && product.description.trim()) {
    return product.description.trim();
  }
  const name = String(product?.name || '').toLowerCase();
  const found = TOP_CATALOG_PRODUCTS.find((p) =>
    name.includes(p.name.toLowerCase()) || name.includes(p.category.toLowerCase()),
  );
  if (found) return found.description;
  if (name.includes('paneer')) return 'Fresh, soft, and hygienic malai paneer made from pure whole milk without any preservatives.';
  if (name.includes('ghee')) return 'Traditional bilona method golden cow ghee. Rich natural aroma, granular danedar texture.';
  if (name.includes('dahi') || name.includes('curd')) return 'Thick, creamy, and probiotic fresh set curd made daily from pure farm milk.';
  if (name.includes('butter') || name.includes('makhan')) return 'Authentic unsalted homemade white makhan, hand-churned fresh every morning.';
  if (name.includes('chaas') || name.includes('buttermilk')) return 'Chilled refreshing buttermilk seasoned with roasted jeera, rock salt, and fresh mint.';
  if (name.includes('malai') || name.includes('cream')) return 'Rich, thick, and velvety natural dairy malai skimmed from fresh boiled milk.';
  if (name.includes('lassi')) return 'Creamy sweet yogurt drink infused with cardamom, saffron, and a dollop of fresh malai.';
  if (name.includes('mawa') || name.includes('khoya')) return '100% pure condensed milk solids, slow-cooked to perfection for rich sweets and gravies.';
  return 'Fresh, premium farm-direct dairy extra delivered with your morning milk.';
}

/**
 * Format product name to proper Title Case.
 */
export function formatProductName(rawName) {
  if (!rawName) return 'Dairy Product';
  const trimmed = String(rawName).trim();
  if (trimmed.toLowerCase() === 'paneer') return 'Fresh Malai Paneer';
  if (trimmed.toLowerCase() === 'ghee') return 'Pure Desi Ghee';
  if (trimmed.toLowerCase() === 'dahi' || trimmed.toLowerCase() === 'curd') return 'Fresh Set Dahi';
  if (trimmed.toLowerCase() === 'butter' || trimmed.toLowerCase() === 'makhan') return 'Fresh White Butter';
  return trimmed
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}



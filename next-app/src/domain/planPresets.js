/**
 * Milk Plan Presets and Predefined Dropdown Choices for Milkmen.
 * When milkman selects milk type and quantity:
 * - Plan Name, Product Name, Quantity, Unit, Market Price, and Description are filled automatically.
 * - Milkman can customize time slot (Morning/Evening), delivery window, and adjust price.
 */

export const MILK_TYPES = [
  {
    id: 'cow_milk',
    name: 'Pure Cow Milk',
    tag: 'Farm Fresh',
    defaultPricePerLitre: 64,
    description: 'Fresh, 100% pure cow milk directly from local dairy farms. Naturally rich in calcium and essential vitamins.',
  },
  {
    id: 'buffalo_milk',
    name: 'Fresh Buffalo Milk',
    tag: 'High Fat & Creamy',
    defaultPricePerLitre: 80,
    description: 'Thick, rich, and creamy buffalo milk with high natural fat content. Ideal for tea, coffee, curd, and sweets.',
  },
  {
    id: 'desi_gir_a2',
    name: 'Desi Gir Cow A2 Milk',
    tag: 'Premium A2 Health',
    defaultPricePerLitre: 95,
    description: 'Pure Vedic A2 milk from grass-fed indigenous Gir cows. Easy on digestion with superior nutritional value.',
  },
  {
    id: 'full_cream',
    name: 'Full Cream Milk',
    tag: 'Rich & Velvety',
    defaultPricePerLitre: 68,
    description: 'Creamy and wholesome full cream milk delivering consistent thickness and taste for family nutrition.',
  },
  {
    id: 'toned_milk',
    name: 'Toned Fresh Milk',
    tag: 'Light & Healthy',
    defaultPricePerLitre: 56,
    description: 'Light, wholesome toned milk maintaining high protein while keeping calories and fat balanced.',
  },
  {
    id: 'farm_raw_milk',
    name: 'Raw Unprocessed Milk',
    tag: 'Natural & Unpasteurized',
    defaultPricePerLitre: 65,
    description: 'Unprocessed natural milk delivered within 2 hours of morning milking, free of any additives or preservatives.',
  },
];

export const QUANTITY_PRESETS = [
  { value: '0.5', label: '500 ml (Half Litre)', unit: 'L' },
  { value: '1', label: '1.0 Litre (Standard)', unit: 'L' },
  { value: '1.5', label: '1.5 Litres', unit: 'L' },
  { value: '2', label: '2.0 Litres (Family Pack)', unit: 'L' },
  { value: '2.5', label: '2.5 Litres', unit: 'L' },
  { value: '3', label: '3.0 Litres (Large Household)', unit: 'L' },
  { value: '4', label: '4.0 Litres', unit: 'L' },
  { value: '5', label: '5.0 Litres (Daily Bulk)', unit: 'L' },
];

/** Compute automatic plan name, description, and price based on milk type and quantity */
export function generatePlanDefaults(milkTypeId, quantityValue, frequency = 'DAILY') {
  const milkType = MILK_TYPES.find((m) => m.id === milkTypeId) || MILK_TYPES[0];
  const qty = Number(quantityValue) || 1;
  const pricePerDelivery = (milkType.defaultPricePerLitre * qty).toFixed(2);
  const monthlyPrice = (milkType.defaultPricePerLitre * qty * (frequency === 'DAILY' ? 30 : 15)).toFixed(2);

  const qtyLabel = qty === 0.5 ? '500ml' : `${qty}L`;
  const name = `${qtyLabel} ${milkType.name} Daily`;

  return {
    name,
    productName: milkType.name,
    quantity: String(qty),
    unit: 'L',
    pricePerDelivery,
    monthlyPrice,
    description: milkType.description,
  };
}

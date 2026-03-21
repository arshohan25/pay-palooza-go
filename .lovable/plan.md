

## Add 100+ Product Categories with Custom Category Support

### Problem
The product category dropdown only has 8 hardcoded options. Need 100+ categories and ability to add custom ones.

### Changes

**`src/components/MerchantProductsTab.tsx`**

1. Replace the 8-item `CATEGORIES` array with 100+ categories organized alphabetically covering all major product/service types (e.g., Accessories, Agriculture, Automotive, Baby & Kids, Bakery, Beauty, Books, Building Materials, Cameras, Catering, Clothing, Computers, Cosmetics, Dairy, Decor, Dental, Desserts, Digital Products, Drones, Education, Electrical, Electronics, Eyewear, Fabric, Farm Produce, Fashion, Fertilizers, Fitness, Flooring, Flowers, Food, Footwear, Frozen Foods, Furniture, Gadgets, Games, Garden, General, Gift Cards, Grocery, Hair Care, Handcraft, Hardware, Health, Herbs, Home Appliances, Home Decor, Hygiene, Ice Cream, Insurance, Interior Design, Jewelry, Kids Toys, Kitchen, Laundry, Leather, Lighting, Lingerie, Luggage, Luxury, Makeup, Marine, Mattresses, Meat, Medical Devices, Medicine, Men's Fashion, Mobile Accessories, Music, Nursery, Office Supplies, Organic, Outdoor, Paint, Party Supplies, Perfume, Pet Care, Photography, Plumbing, Poultry, Printing, Real Estate, Recycling, Restaurants, Safety Equipment, Salon, Seafood, Security, Shoes, Skincare, Snacks, Solar, Spices, Sports, Stationery, Storage, Supplements, Tailoring, Tea & Coffee, Textiles, Tools, Toys, Travel, Uniforms, Vegetables, Veterinary, Watches, Water, Wedding, Wellness, Women's Fashion, Woodwork, Yoga, plus more).

2. Add a custom category input: below the `<select>`, add an option "＋ Custom..." at the end. When selected, show a text input for typing a custom category name. On confirm, use that as the category value.

3. Make the dropdown searchable: replace the native `<select>` with a text input + filtered dropdown list so merchants can quickly find categories from 100+ options.

### Implementation Detail
- Add state: `customCat` (string), `showCatSearch` (boolean), `catSearch` (string)
- Render a searchable dropdown: clicking the category field opens a scrollable filtered list
- Last item in list is "＋ Add Custom Category" which toggles a text input
- Selected/custom value feeds into `form.category`

### File Modified
- `src/components/MerchantProductsTab.tsx` — Replace category select with searchable dropdown + custom input, expand to 100+ categories


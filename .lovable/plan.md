

# Add 15 Products to Merchant Store

## What
Insert 15 diverse products across both active merchants (TechBD Store and Rafiq Electronics) so all users can see them in the shop. The products span Electronics, Fashion, Home & Living, and Accessories categories with realistic pricing, stock, ratings, and badges.

## How

### 1. Database migration to insert 15 products
One migration file with INSERT into `merchant_products` table, split across both merchants:
- **TechBD Store** (8 products): Galaxy Buds Pro, Power Bank, Polo T-Shirt, Leather Handbag, Water Bottle, Mouse & Keyboard Combo, Bed Sheet Set, Polarized Sunglasses
- **Rafiq Electronics** (7 products): JBL Flip 6, Gaming Keyboard, Nike Running Shoes, Travel Backpack, Coffee Mug Set, Kitchen Scale, Analog Watch

Each product includes: name, description, price, original_price, category, stock, emoji, badge, rating, review_count, `is_active = true`.

### Summary
- 1 database migration (data insert only)
- No code changes needed — the existing `get_shop_products()` RPC and ShopPage already display all active products from active merchants


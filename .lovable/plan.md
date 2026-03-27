

# Add 20 Products with Images

## Approach
Insert 20 new products into `merchant_products` split across both merchants (TechBD Store & Rafiq Electronics), using free stock images from Unsplash for realistic product photos. Each product will have both `image_url` and `images` array populated.

## Products (20 total)

**TechBD Store** (10 products):
1. Wireless Earbuds TWS — Electronics, ৳1,200 — headphones image
2. Smart Watch Band — Electronics, ৳2,800 — smartwatch image
3. Laptop Stand Aluminum — Electronics, ৳1,650 — laptop stand image
4. USB-C Hub 7-in-1 — Electronics, ৳1,900 — tech accessory image
5. Denim Jacket Men's — Fashion, ৳3,500 — jacket image
6. Canvas Sneakers Unisex — Fashion, ৳1,800 — sneakers image
7. Aromatherapy Diffuser — Home & Living, ৳1,450 — diffuser image
8. Desk Organizer Wood — Home & Living, ৳950 — desk organizer image
9. Leather Wallet RFID — Accessories, ৳1,100 — wallet image
10. Sports Duffle Bag — Accessories, ৳2,400 — bag image

**Rafiq Electronics** (10 products):
11. Bluetooth Speaker Mini — Electronics, ৳980 — speaker image
12. Webcam HD 1080p — Electronics, ৳2,200 — webcam image
13. LED Desk Lamp Touch — Electronics, ৳1,350 — lamp image
14. Graphic T-Shirt Pack — Fashion, ৳890 — tshirt image
15. Yoga Mat Premium — Sports, ৳1,500 — yoga mat image
16. Stainless Steel Thermos — Home & Living, ৳780 — thermos image
17. Wireless Charging Pad — Electronics, ৳1,100 — charger image
18. Crossbody Sling Bag — Accessories, ৳1,650 — sling bag image
19. Plant Pot Ceramic Set — Home & Living, ৳1,200 — plant pot image
20. Fitness Resistance Bands — Sports, ৳650 — fitness bands image

## Image Source
Use Unsplash source URLs (e.g., `https://images.unsplash.com/photo-XXXXX?w=400&h=400&fit=crop`) for real product-style photos. Each product gets one `image_url` and an `images` array with 2-3 photos.

## Implementation
- 1 data insert operation (no schema changes)
- Use the insert tool to add 20 rows to `merchant_products`
- All products set to `is_active = true` with stock, ratings, badges, and brand fields


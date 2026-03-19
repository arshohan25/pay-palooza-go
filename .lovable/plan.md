

## Create a Second Test Merchant Account with Sample Products

### What needs to happen

Create a new user account, assign merchant role, create merchant record, vendor store, and sample products — all via database inserts.

### Steps

#### Step 1: Create a new auth user
- Use `signUpWithPhonePassword` pattern via the app's auth system
- Phone: `01712345678`, random PIN
- This creates a profile automatically via the `handle_new_user` trigger

#### Step 2: Insert merchant-related records (via insert tool)
After the user is created:
1. **user_roles**: Assign `merchant` role
2. **merchants**: Create merchant record (business_name: "TechBD Store", category: retail, status: active)
3. **vendor_stores**: Create store (store_name: "TechBD Store", slug: "techbd-store")
4. **merchant_products**: Insert 4 sample products:
   - Smart Watch Pro — ৳3,500
   - Portable Bluetooth Speaker — ৳1,800  
   - LED Desk Lamp — ৳950
   - Phone Case (Premium Leather) — ৳450

Each product will have descriptions, categories, emojis, stock, and ratings to look realistic.

#### Step 3: Update the profile name
- Set name to "Kamal Hossain" on the new profile

### Result
You'll have a second merchant with 4 products visible in the Shop. When you browse those products logged in as a different user (e.g., your current account), the "Chat with seller" FAB will appear, allowing you to test the full customer-to-merchant chat flow.

### Technical details
- The new merchant user will be created via an edge function or direct auth signup call
- All data inserts use the Supabase insert tool for `user_roles`, `merchants`, `vendor_stores`, `merchant_products`
- No schema changes needed — all tables already exist


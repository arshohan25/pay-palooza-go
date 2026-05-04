## Fix chat layout + add read receipts + secure attachments

Three things, all confined to the merchant PIN-reset chat. Database schema and storage bucket already exist (`pin-reset-attachments` private, 5 MB cap, image/* + PDF only).

---

### 1. Fix the avatar-in-the-middle bug (from screenshot)

In `PinResetTicketChat.tsx` the merchant's outgoing rows render as `flex-row-reverse` with a fixed-width avatar slot, so the avatar ends up **between** the bubble and the right edge instead of flush against the edge — that's the small person icon visible next to the "Hi" bubble.

Fix: for outgoing (merchant) messages, drop the avatar slot entirely. Outgoing bubbles get the gradient + a tail; the user already knows it's them. Admin messages keep their avatar on the left. This also reclaims ~28 px of horizontal room on the right and makes the layout match the reference.

---

### 2. Read receipts + "Seen" timestamps

Backend already has `read_by_admin` on each message but does not record **when** it was read. Add a single nullable column and surface it.

**Migration**
- `ALTER TABLE merchant_pin_reset_messages ADD COLUMN read_by_admin_at timestamptz;`
- Backfill existing read rows: `UPDATE … SET read_by_admin_at = created_at WHERE read_by_admin = true;`

**Edge function `merchant-pin-reset-chat`**
- When admin opens the ticket (already handled by the admin-side function), it sets `read_by_admin = true`. Update both spots that flip the flag to also set `read_by_admin_at = now()` (admin-side function lives in `admin-pin-reset-*` — verify and patch the same way).
- Return the new field in the `fetch` payload (already selecting `*` essentially — just add it to the explicit `select` list).

**UI changes in `PinResetTicketChat.tsx`**
- Per-message footer for the merchant's own bubbles:
  - Sending: spinner + "Sending…"
  - Sent, unread by admin: single grey check + "Sent 12:21 PM"
  - Read by admin: double cyan check + "Seen 12:23 PM" (uses `read_by_admin_at`)
- Last outgoing message also shows a subtle full-width line under the bubble: "Seen by support · 12:23 PM" so it's clearly trackable without hunting tick marks.
- Inbound (admin) bubbles show only the time.

---

### 3. Secure file attachments (images + PDF)

**Composer UI**
- Add a circular paperclip button to the left of the textarea (matches the gradient send button styling, neutral color).
- Hidden `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf">`.
- Client-side validation:
  - Allowed MIME: PNG / JPEG / WEBP / GIF / PDF
  - Max size: 5 MB (matches bucket limit)
  - On reject: toast with the reason ("Only images & PDFs", "Max 5 MB").
- Selected-file preview chip above the textarea: thumbnail (for images) or PDF icon + filename + size + "×" to remove. Disabled while uploading.

**Send flow**
- New edge-function action `attach_init` → returns a signed **upload** URL (`createSignedUploadUrl`) for a path like `<request_id>/<uuid>.<ext>` in `pin-reset-attachments`. Server validates ticket + request ownership + extension/MIME before signing.
- Client uploads the file directly to the signed URL with `fetch(PUT)`, showing a small linear progress bar in the chip.
- On success, client calls existing `send` action with `{ content, attachment: { path, mime, name, size } }`. Server validates the path lives under `<request_id>/`, the MIME is allowed, size ≤ 5 MB, and the object actually exists (HEAD via service role). Then it inserts the message row with the attachment columns populated. `content` may be empty when an attachment is present.

**Render flow**
- New action `attach_url` → returns a short-lived (5 min) signed **read** URL for a given message id. Server checks the message belongs to the request and the ticket matches.
- Bubble rendering:
  - Image attachment → fetch signed URL on first render (cached in component state), show as a rounded thumbnail (max 220×220, click to open full in a new tab).
  - PDF attachment → show file-icon card with name + size; click triggers signed-URL fetch and opens it in a new tab.
  - Caption text (if any) renders below the attachment.

**Realtime**
- Postgres `INSERT` listener already returns the new row including the new attachment columns — no schema change needed there.

---

### Technical details

**Files touched**
- `supabase/migrations/<new>.sql` — add `read_by_admin_at` + backfill.
- `supabase/functions/merchant-pin-reset-chat/index.ts` — set `read_by_admin_at` is **admin-side**, not here. Here we add: `attach_init`, `attach_url`; extend `send` to accept attachments; include `read_by_admin_at` in fetch response; add server-side MIME/size/path validation.
- `supabase/functions/admin-pin-reset-chat/index.ts` (or whichever admin endpoint flips `read_by_admin`) — also set `read_by_admin_at = now()` whenever it transitions false → true. (Will locate exact file in build mode.)
- `src/components/merchant/PinResetTicketChat.tsx`:
  - Remove avatar slot for outgoing rows.
  - New "Seen by support · HH:MM" line under last own message.
  - New `Paperclip` button + hidden file input + preview chip + upload progress.
  - New `AttachmentPreview` sub-component (signed-URL fetch on mount, image vs PDF rendering).
  - Extend `PinResetMessage` type with `attachment_path | attachment_mime | attachment_name | attachment_size | read_by_admin_at`.

**Validation rules (mirrored client + server)**
- MIME: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`
- Max size: 5 MB
- Filename sanitised server-side; storage path = `<request_id>/<uuid>.<ext>` (never trust client path).
- Signed read URLs expire in 5 minutes. Signed upload URLs expire in 2 minutes.

**No changes** to: header, bubble colors/typography, composer glass styling, counter ring, OTP/ticket flow, RLS on `merchant_pin_reset_messages`, storage bucket configuration (already locked to service-role only).

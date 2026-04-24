Plan to make the Customization Center template editor safer and fully interactive:

1. Build a richer notification template editor
- Replace the current simple preview block with a split editor/preview dialog.
- Keep fields for template key, category, title/subject, body, image URL, and enabled/disabled state.
- Add a variable helper that detects placeholders like `{{name}}`, `{{amount}}`, `{{phone}}`, `{{status}}` from the title/body.
- Show a live rendered preview as the admin types.

2. Add test recipient simulation before saving
- Add a “Test recipient” panel with editable sample values, for example name, phone, amount, transaction ID, status, date, support ticket, and app link.
- Render the title/body by replacing `{{variable}}` placeholders with the simulated recipient values.
- Show unresolved variables clearly so admins can fix them before saving.
- Add quick simulation presets such as Transaction Alert, KYC Update, Support Ticket, Merchant Approval, and Recharge Confirmation.
- Add a “Send test preview” simulation button that validates the rendered message and displays a success toast/preview state without creating real notifications.

3. Add unsaved changes indicators across the Customization Center
- Track dirty state separately for:
  - Department homepage/layout configuration
  - Brand settings
  - Notification template editor
- Add visible badges like “Unsaved changes” on tab triggers/cards/dialog headers when edits differ from the last saved or loaded values.
- Disable silent close where it would lose edits; show a lightweight confirmation path inside the dialog: Save, Keep Editing, or Discard.

4. Add draft restore so tab switching does not lose work
- Persist in-progress edits to local draft storage scoped to the admin customization center.
- Draft keys will be scoped by editor type and record identity, for example `customization:template:<id-or-name>` and `customization:brand:global`.
- When reopening a template or switching back to a tab, restore the draft automatically if it is newer than the loaded record.
- Show a “Draft restored” indicator with actions to discard draft or save it.
- Clear the relevant draft after a successful save or explicit discard.

5. Keep existing database writes compatible
- Use the current `notification_templates` fields currently used by the UI: `name`, `title`, `body`, `category`, `image_url`, and `is_active`.
- Do not require a schema change unless the current database has the newer alternate columns only; if needed, add a compatibility migration rather than changing the generated client files manually.
- Continue writing audit log entries for template, brand, and layout saves.

Technical details
- Main implementation target: `src/components/admin/AdminCommandIntelligence.tsx` inside `AdminCustomizationCenter`.
- Use existing UI primitives: `Dialog`, `Tabs`, `Input`, `Textarea`, `Badge`, `Button`, `Separator`, and existing toast/audit patterns.
- Add helper functions for stable draft keys, dirty comparison, placeholder extraction, variable rendering, and draft serialization.
- Add small local state for active customization tab, draft metadata, simulated recipient data, and close-confirmation prompts.
- Run a production build after implementation to verify TypeScript and bundling.
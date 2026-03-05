## Plan: Update Profile Name

Update the `profiles` table to set the name to "Shohan Ahmed" for the account with phone `01909709954`.

### Action

- Run a single SQL UPDATE statement against the `profiles` table:
  ```sql
  UPDATE profiles SET name = 'Shohan' WHERE phone = '01909709954';
  ```
- No code changes needed — the `useProfile` hook will automatically pick up the new name on next fetch.
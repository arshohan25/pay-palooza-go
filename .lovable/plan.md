

## Fix: Users Can't Receive OTP During Signup

**Problem**: The `send-otp` edge function generates a real OTP and stores it in the database, but only logs it to `console.log`. No SMS is sent. Users are stuck on the OTP screen with no way to get their code.

### Options

**Option A — Skip OTP during registration (simplest)**
Remove the OTP step from the registration flow entirely. Users go straight from phone entry to PIN setup. The OTP step remains only for forgot-PIN (where it's equally broken, but less frequent). This is what most MVP apps do before integrating an SMS provider.

**Option B — Return OTP in the response and display it (dev/testing mode)**
Have `send-otp` return the code in the response body. Show it to the user in a toast or info banner (e.g., "Your OTP is: 482913"). Obviously not for production, but lets the full flow work during development.

**Option C — Integrate a real SMS provider**
Connect an SMS API (e.g., Twilio, SSLWireless, BulkSMSBD) inside the `send-otp` edge function to actually deliver the code. This requires an API key and a paid account with an SMS provider.

### Recommendation

**Option A** is the most practical for now — skip OTP verification during registration since there's no SMS delivery. The registration flow becomes: Phone → PIN → Done. OTP verification can be added back when an SMS provider is integrated.

### Changes for Option A

**`src/pages/AuthPage.tsx`**:
- In `handleRegisterPhone`: after checking the phone isn't already registered, go directly to `register_pin` instead of sending an OTP and going to `register_otp`
- Remove the `registerOtpSending` state and the OTP-sending logic from the registration flow
- Keep the forgot-PIN OTP flow unchanged (it already existed before)
- Update `REGISTER_STEPS` from `["Phone", "OTP", "PIN"]` to `["Phone", "PIN"]`
- Adjust step index mapping for `register_pin` (now step 2 of 2 instead of step 3 of 3)

No edge function changes needed. The `send-otp` and `verify-otp` functions remain available for forgot-PIN and future SMS integration.


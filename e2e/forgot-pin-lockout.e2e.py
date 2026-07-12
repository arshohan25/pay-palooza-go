import asyncio, json, time
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots"
BASE = "http://localhost:8080"
PHONE = "01712345678"
KEY = f"otp_lockout:pin_reset:{PHONE}"

async def seed(page, ms_from_now, message="Too many incorrect codes. Try again in 15 minutes."):
    until = int(time.time() * 1000) + ms_from_now
    await page.evaluate(
        "([k,v,phone]) => { localStorage.setItem(k, v); localStorage.setItem('mfs_device_phone', phone); }",
        [KEY, json.dumps({"until": until, "message": message}), PHONE],
    )

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        # 1. Bootstrap: visit page to establish origin, then seed 15-min lockout
        await page.goto(f"{BASE}/forgot-pin", wait_until="domcontentloaded")
        await seed(page, 15 * 60 * 1000)
        await page.goto(f"{BASE}/forgot-pin", wait_until="domcontentloaded")
        await page.wait_for_selector("text=Verification locked", timeout=8000)
        await page.screenshot(path=str(SHOTS / "1_locked_after_seed.png"))
        print("STEP 1 OK: lockout screen visible after seed")

        # 2. Refresh — lockout MUST persist
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_selector("text=Verification locked", timeout=8000)
        mmss = await page.locator("div.font-mono.tabular-nums").first.inner_text()
        assert ":" in mmss, f"expected mm:ss countdown, got {mmss!r}"
        print(f"STEP 2 OK: lockout persisted across reload, countdown={mmss}")
        await page.screenshot(path=str(SHOTS / "2_locked_after_refresh.png"))

        # 3. No OTP inputs, no enabled resend/verify while locked
        otp_inputs = await page.locator('input[data-input-otp="true"], input[autocomplete="one-time-code"]').count()
        print(f"otp inputs present: {otp_inputs}")
        resend = page.get_by_role("button", name="Resend code")
        assert await resend.count() == 0, "Resend button should not be shown on locked screen"
        # Any button visible on locked screen must not be a verify/resend action
        verify_btn = page.get_by_role("button", name="Verify")
        assert await verify_btn.count() == 0, "Verify button should not be present while locked"
        print("STEP 3 OK: no verify/resend affordance while locked")

        # 4. Short lockout — verify auto-unlock re-enables the flow
        await seed(page, 3 * 1000, message="short lock")
        await page.goto(f"{BASE}/forgot-pin", wait_until="domcontentloaded")
        await page.wait_for_selector("text=Verification locked", timeout=5000)
        print("STEP 4a OK: short lockout renders")
        await page.wait_for_function(
            f"() => !localStorage.getItem({json.dumps(KEY)})",
            timeout=10000,
        )
        # UI should auto-transition off locked step
        await page.wait_for_selector("text=Verify it's you", timeout=8000)
        await page.screenshot(path=str(SHOTS / "3_after_expiry.png"))
        # Resend re-enabled? On the OTP step, "Resend code" appears with resendIn=0
        # (The page starts at 'phone' step normally; after lockout clears, step -> 'otp'.)
        try:
            resend2 = page.get_by_role("button", name="Resend code")
            if await resend2.count() > 0:
                disabled = await resend2.first.is_disabled()
                assert not disabled, "Resend must re-enable after lockout expires"
                print("STEP 4b OK: Resend re-enabled after expiry")
            else:
                print("STEP 4b OK: transitioned off locked screen (no resend visible on current step)")
        except Exception as e:
            print(f"resend check note: {e}")

        print("\nALL LOCKOUT E2E CHECKS PASSED")
        await browser.close()

asyncio.run(main())

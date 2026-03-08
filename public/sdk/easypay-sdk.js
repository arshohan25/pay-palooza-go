/**
 * EasyPay Merchant SDK v1.0
 * Embed payment collection on any website.
 *
 * Usage:
 *   <script src="https://pay-palooza-go.lovable.app/sdk/easypay-sdk.js"></script>
 *   <script>
 *     EasyPay.init({ apiKey: 'epk_...', endpoint: '...' });
 *     EasyPay.renderButton('#pay-btn', { amount: 500, reference: 'ORDER-1' });
 *   </script>
 */
(function () {
  "use strict";

  var config = { apiKey: null, appPassword: null, endpoint: null, mode: "redirect" };

  var STYLES = [
    ".easypay-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;",
    "padding:12px 28px;border:none;border-radius:12px;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;",
    "font-size:15px;font-weight:700;color:#fff;transition:all .2s ease;",
    "background:linear-gradient(135deg,#ea580c 0%,#dc2626 100%);box-shadow:0 4px 14px rgba(234,88,12,.35);}",
    ".easypay-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(234,88,12,.45);}",
    ".easypay-btn:active{transform:translateY(0);box-shadow:0 2px 8px rgba(234,88,12,.3);}",
    ".easypay-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;}",
    ".easypay-btn svg{width:18px;height:18px;flex-shrink:0;}",
    ".easypay-btn--loading .easypay-btn__text{opacity:0;}",
    ".easypay-btn--loading .easypay-btn__spinner{display:block;}",
    ".easypay-btn__spinner{display:none;width:18px;height:18px;border:2px solid rgba(255,255,255,.3);",
    "border-top-color:#fff;border-radius:50%;animation:easypay-spin .6s linear infinite;position:absolute;}",
    "@keyframes easypay-spin{to{transform:rotate(360deg);}}"
  ].join("");

  var LOGO_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>' +
    "</svg>";

  function injectStyles() {
    if (document.getElementById("easypay-sdk-styles")) return;
    var style = document.createElement("style");
    style.id = "easypay-sdk-styles";
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function createPayment(opts) {
    if (!config.apiKey || !config.endpoint) {
      return Promise.reject(new Error("EasyPay not initialized. Call EasyPay.init() first."));
    }
    if (!opts || !opts.amount) {
      return Promise.reject(new Error("amount is required"));
    }

    return fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey, "X-App-Password": config.appPassword || "" },
      body: JSON.stringify({
        action: "create_session",
        amount: opts.amount,
        reference: opts.reference || null,
        description: opts.description || null,
        success_url: opts.successUrl || opts.success_url || null,
        cancel_url: opts.cancelUrl || opts.cancel_url || null,
        customer_phone: opts.customerPhone || opts.customer_phone || null,
        metadata: opts.metadata || {},
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        return data;
      });
  }

  function openCheckout(checkoutUrl) {
    if (config.mode === "popup") {
      var w = 420, h = 680;
      var left = (screen.width - w) / 2, top = (screen.height - h) / 2;
      window.open(checkoutUrl, "easypay_checkout", "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top + ",toolbar=no,menubar=no");
    } else {
      window.location.href = checkoutUrl;
    }
  }

  window.EasyPay = {
    /** Initialize the SDK */
    init: function (options) {
      if (!options || !options.apiKey) throw new Error("apiKey is required");
      config.apiKey = options.apiKey;
      config.appPassword = options.appPassword || null;
      config.endpoint = options.endpoint || options.apiEndpoint || null;
      config.mode = options.mode || "redirect"; // "redirect" | "popup"
      if (!config.endpoint) {
        throw new Error("endpoint is required (your merchant-payment-api URL)");
      }
      injectStyles();
    },

    /** Create a payment session programmatically */
    createPayment: createPayment,

    /** Render a branded "Pay with EasyPay" button */
    renderButton: function (selector, paymentOptions) {
      injectStyles();
      var container = typeof selector === "string" ? document.querySelector(selector) : selector;
      if (!container) { console.error("EasyPay: container not found:", selector); return; }

      var btn = document.createElement("button");
      btn.className = "easypay-btn";
      btn.type = "button";
      btn.innerHTML =
        LOGO_SVG +
        '<span class="easypay-btn__text">Pay ৳' + (paymentOptions.amount || "") + " with EasyPay</span>" +
        '<span class="easypay-btn__spinner"></span>';

      btn.addEventListener("click", function () {
        btn.disabled = true;
        btn.classList.add("easypay-btn--loading");

        createPayment(paymentOptions)
          .then(function (data) {
            openCheckout(data.checkout_url);
          })
          .catch(function (err) {
            btn.disabled = false;
            btn.classList.remove("easypay-btn--loading");
            console.error("EasyPay error:", err.message);
            if (paymentOptions.onError) paymentOptions.onError(err);
          });
      });

      container.appendChild(btn);
      return btn;
    },

    /** Display a dynamic QR code for a payment session */
    displayQR: function (selector, sessionData, options) {
      injectStyles();
      var container = typeof selector === "string" ? document.querySelector(selector) : selector;
      if (!container) { console.error("EasyPay: container not found:", selector); return; }

      var opts = options || {};
      var qrData = typeof sessionData === "string" ? sessionData : (sessionData.qr_data || "");
      var amount = sessionData.amount || 0;
      var qrPageUrl = sessionData.qr_page_url || "";

      // Build QR display
      var wrapper = document.createElement("div");
      wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:320px;margin:0 auto;";

      var title = document.createElement("div");
      title.style.cssText = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;color:#64748b;";
      title.textContent = "Scan to Pay with EasyPay";
      wrapper.appendChild(title);

      var amountEl = document.createElement("div");
      amountEl.style.cssText = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:28px;font-weight:800;color:#0f172a;";
      amountEl.textContent = "৳" + amount;
      wrapper.appendChild(amountEl);

      // QR image (use qr_page_url as fallback for external QR generators)
      var qrImg = document.createElement("img");
      qrImg.style.cssText = "width:220px;height:220px;border-radius:12px;";
      qrImg.alt = "Payment QR Code";

      // Generate QR using a simple API or canvas
      if (typeof QRCode !== "undefined") {
        QRCode.toDataURL(qrData, { width: 220, margin: 2 }, function(err, url) {
          if (!err) qrImg.src = url;
        });
      } else {
        // Fallback: use an inline QR generator API
        qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(qrData);
      }
      wrapper.appendChild(qrImg);

      var statusEl = document.createElement("div");
      statusEl.style.cssText = "font-size:13px;color:#94a3b8;display:flex;align-items:center;gap:6px;";
      statusEl.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;animation:easypay-spin 1.5s ease-in-out infinite;"></span> Waiting for payment…';
      wrapper.appendChild(statusEl);

      container.appendChild(wrapper);

      // Poll for completion
      var pollInterval = setInterval(function () {
        if (!sessionData.session_id) return;
        EasyPay.checkStatus(sessionData.session_id).then(function (session) {
          if (session.status === "completed") {
            clearInterval(pollInterval);
            statusEl.innerHTML = '<span style="color:#16a34a;font-weight:700;">✓ Payment Received!</span>';
            if (opts.onSuccess) opts.onSuccess(session);
          } else if (session.status === "expired" || session.status === "failed") {
            clearInterval(pollInterval);
            statusEl.innerHTML = '<span style="color:#dc2626;">Session expired</span>';
            if (opts.onExpired) opts.onExpired(session);
          }
        }).catch(function () {});
      }, 3000);

      return { destroy: function () { clearInterval(pollInterval); wrapper.remove(); } };
    },

    /** Check payment status */
    checkStatus: function (sessionId) {
      if (!config.apiKey || !config.endpoint) {
        return Promise.reject(new Error("EasyPay not initialized"));
      }
      return fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey, "X-App-Password": config.appPassword || "" },
        body: JSON.stringify({ action: "check_status", session_id: sessionId }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) throw new Error(data.error);
          return data.session;
        });
    },
  };
})();

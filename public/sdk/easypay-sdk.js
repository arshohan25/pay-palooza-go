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

  var config = { apiKey: null, endpoint: null, mode: "redirect" };

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
      headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey },
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

    /** Check payment status */
    checkStatus: function (sessionId) {
      if (!config.apiKey || !config.endpoint) {
        return Promise.reject(new Error("EasyPay not initialized"));
      }
      return fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey },
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

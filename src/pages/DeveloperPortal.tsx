import { useState } from "react";
import { Link } from "react-router-dom";
import { Code2, Zap, QrCode, Copy, Check, ChevronDown, ChevronRight, ArrowRight, Shield, Globe, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ENDPOINT_URL = "https://lmgsxyzytssddijjxbzc.supabase.co/functions/v1/merchant-payment-api";
const SDK_URL = "https://pay-palooza-go.lovable.app/sdk/easypay-sdk.js";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeBlock({ code, lang = "javascript" }: { code: string; lang?: string }) {
  return (
    <div className="relative group">
      <pre className="bg-muted/60 border border-border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed font-mono text-foreground">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

function CollapsibleSection({ title, method, path, children }: { title: string; method: string; path: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const methodColor = method === "POST" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-green-500/15 text-green-700 dark:text-green-400";
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left">
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <Badge variant="outline" className={`${methodColor} font-mono text-[10px] px-1.5 py-0`}>{method}</Badge>
        <span className="font-mono text-sm text-muted-foreground">{path}</span>
        <span className="ml-auto text-sm font-medium text-foreground">{title}</span>
      </button>
      {open && <div className="border-t border-border p-4 space-y-4 bg-muted/10">{children}</div>}
    </div>
  );
}

const TAB_LANGS = ["JavaScript", "Python", "cURL"] as const;

const CODE_EXAMPLES: Record<string, string> = {
  JavaScript: `const response = await fetch("${ENDPOINT_URL}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "epk_your_api_key",
    "X-App-Password": "epp_your_app_password"
  },
  body: JSON.stringify({
    action: "create_session",
    amount: 500,
    reference: "ORDER-123",
    description: "Widget purchase",
    success_url: "https://yoursite.com/success",
    cancel_url: "https://yoursite.com/cancel"
  })
});
const data = await response.json();
console.log(data.checkout_url); // redirect customer here`,

  Python: `import requests

resp = requests.post(
    "${ENDPOINT_URL}",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": "epk_your_api_key",
        "X-App-Password": "epp_your_app_password",
    },
    json={
        "action": "create_session",
        "amount": 500,
        "reference": "ORDER-123",
        "description": "Widget purchase",
        "success_url": "https://yoursite.com/success",
        "cancel_url": "https://yoursite.com/cancel",
    },
)
data = resp.json()
print(data["checkout_url"])`,

  cURL: `curl -X POST "${ENDPOINT_URL}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: epk_your_api_key" \\
  -H "X-App-Password: epp_your_app_password" \\
  -d '{
    "action": "create_session",
    "amount": 500,
    "reference": "ORDER-123",
    "description": "Widget purchase",
    "success_url": "https://yoursite.com/success",
    "cancel_url": "https://yoursite.com/cancel"
  }'`,
};

const SDK_SNIPPET = `<!-- 1. Include the SDK -->
<script src="${SDK_URL}"></script>

<script>
  // 2. Initialize with your credentials
  EasyPay.init({
    apiKey: "epk_your_api_key",
    appPassword: "epp_your_app_password",
    endpoint: "${ENDPOINT_URL}",
    mode: "redirect"  // or "popup"
  });

  // 3. Render a Pay button
  EasyPay.renderButton("#pay-btn", {
    amount: 500,
    reference: "ORDER-123",
    onError: (err) => console.error(err)
  });
</script>

<div id="pay-btn"></div>`;

const QR_SNIPPET = `// Create a session, then display QR
const session = await EasyPay.createPayment({
  amount: 1000,
  reference: "QR-ORDER-1"
});

// Render QR code with auto-polling
EasyPay.displayQR("#qr-container", session, {
  onSuccess: (s) => alert("Paid! " + s.id),
  onExpired: (s) => alert("Session expired")
});`;

export default function DeveloperPortal() {
  const [activeTab, setActiveTab] = useState<string>("JavaScript");

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg text-primary">EasyPay</Link>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#quick-start" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Quick Start</a>
            <a href="#api-reference" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">API Reference</a>
            <a href="#sdk" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">SDK</a>
            <Link to="/"><Button size="sm" variant="outline" className="h-8 text-xs">Back to App</Button></Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-20">
        {/* Hero */}
        <section className="text-center space-y-4 pt-8">
          <Badge variant="secondary" className="mb-2">Developer Documentation</Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Build with <span className="text-primary">EasyPay</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Accept payments, generate dynamic QR codes, and manage transactions with our simple REST API and drop-in SDK.
          </p>
          <div className="flex items-center justify-center gap-3 pt-4">
            <a href="#quick-start"><Button className="gap-2"><Zap className="w-4 h-4" /> Quick Start</Button></a>
            <a href="#api-reference"><Button variant="outline" className="gap-2"><Code2 className="w-4 h-4" /> API Reference</Button></a>
          </div>
        </section>

        {/* Integration Methods */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Integration Methods</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: Code2, title: "Drop-in SDK", desc: "Add a branded Pay button to any website with one script tag. Handles UI, sessions, and redirects automatically." },
              { icon: Globe, title: "REST API", desc: "Create payment sessions, check status, and list transactions directly from your backend with simple HTTP calls." },
              { icon: QrCode, title: "QR Payments", desc: "Generate dynamic QR codes that customers scan to pay. Auto-polls for completion with real-time status updates." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border border-border rounded-xl p-6 space-y-3 hover:border-primary/40 transition-colors bg-card">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Start */}
        <section id="quick-start" className="space-y-6 scroll-mt-20">
          <h2 className="text-2xl font-bold text-foreground">Quick Start</h2>
          <div className="space-y-4">
            {[
              { step: 1, title: "Register as a Merchant", desc: "Sign up and apply for a merchant account from the app. Once approved, you'll get access to the API dashboard." },
              { step: 2, title: "Get your API Credentials", desc: "From your Merchant Dashboard → API tab, generate an API Key (epk_), Secret (eps_), and App Password (epp_)." },
              { step: 3, title: "Install the SDK or call the API", desc: "Add our SDK script tag for a drop-in button, or integrate via REST API from your backend." },
              { step: 4, title: "Accept Payments", desc: "Customers are redirected to a secure checkout page. You receive webhook notifications on payment completion." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">{step}</div>
                <div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Authentication */}
        <section className="space-y-4 scroll-mt-20">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2"><Shield className="w-5 h-5" /> Authentication</h2>
          <p className="text-muted-foreground">Every API request requires two headers:</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-border rounded-lg p-4 bg-card">
              <code className="text-xs font-mono text-primary">X-API-Key</code>
              <p className="text-sm text-muted-foreground mt-1">Your public API key starting with <code className="text-xs bg-muted px-1 rounded">epk_</code></p>
            </div>
            <div className="border border-border rounded-lg p-4 bg-card">
              <code className="text-xs font-mono text-primary">X-App-Password</code>
              <p className="text-sm text-muted-foreground mt-1">Your app password starting with <code className="text-xs bg-muted px-1 rounded">epp_</code></p>
            </div>
          </div>
        </section>

        {/* API Reference */}
        <section id="api-reference" className="space-y-6 scroll-mt-20">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2"><Terminal className="w-5 h-5" /> API Reference</h2>
          <p className="text-muted-foreground">Base endpoint: <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{ENDPOINT_URL}</code></p>

          <div className="space-y-3">
            <CollapsibleSection title="Create Payment Session" method="POST" path="action: create_session">
              <p className="text-sm text-muted-foreground">Creates a new payment session and returns a checkout URL.</p>
              <h4 className="text-sm font-semibold text-foreground mt-3">Request Body</h4>
              <div className="text-xs space-y-1 mt-2">
                {[
                  ["amount", "number", "required", "Payment amount (1–1,000,000)"],
                  ["reference", "string", "optional", "Your order reference"],
                  ["description", "string", "optional", "Payment description"],
                  ["success_url", "string", "optional", "Redirect after payment"],
                  ["cancel_url", "string", "optional", "Redirect on cancel"],
                  ["callback_url", "string", "optional", "Webhook URL override"],
                  ["customer_phone", "string", "optional", "Customer phone number"],
                  ["metadata", "object", "optional", "Custom key-value data"],
                ].map(([name, type, req, desc]) => (
                  <div key={name} className="flex gap-2 items-baseline">
                    <code className="font-mono text-primary">{name}</code>
                    <span className="text-muted-foreground">{type}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${req === "required" ? "border-destructive/50 text-destructive" : ""}`}>{req}</Badge>
                    <span className="text-muted-foreground">— {desc}</span>
                  </div>
                ))}
              </div>
              <h4 className="text-sm font-semibold text-foreground mt-4">Response</h4>
              <CodeBlock lang="json" code={`{
  "success": true,
  "session_id": "uuid",
  "checkout_url": "https://pay-palooza-go.lovable.app/checkout/uuid",
  "qr_page_url": "https://pay-palooza-go.lovable.app/pay/qr/uuid",
  "qr_data": "{ ... }",
  "amount": 500,
  "currency": "BDT",
  "reference": "ORDER-123",
  "status": "pending",
  "expires_at": "2026-03-25T12:30:00Z"
}`} />
            </CollapsibleSection>

            <CollapsibleSection title="Check Payment Status" method="POST" path="action: check_status">
              <p className="text-sm text-muted-foreground">Check the status of an existing payment session.</p>
              <h4 className="text-sm font-semibold text-foreground mt-3">Request Body</h4>
              <div className="text-xs mt-2">
                <code className="font-mono text-primary">session_id</code> <span className="text-muted-foreground">string</span> <Badge variant="outline" className="text-[9px] px-1 py-0 border-destructive/50 text-destructive">required</Badge>
              </div>
              <h4 className="text-sm font-semibold text-foreground mt-4">Response</h4>
              <CodeBlock lang="json" code={`{
  "success": true,
  "session": {
    "id": "uuid",
    "amount": 500,
    "currency": "BDT",
    "status": "completed",
    "completed_at": "2026-03-25T12:05:00Z"
  }
}`} />
            </CollapsibleSection>

            <CollapsibleSection title="List Sessions" method="POST" path="action: list_sessions">
              <p className="text-sm text-muted-foreground">Retrieve paginated list of your payment sessions.</p>
              <h4 className="text-sm font-semibold text-foreground mt-3">Request Body</h4>
              <div className="text-xs space-y-1 mt-2">
                <div><code className="font-mono text-primary">page</code> <span className="text-muted-foreground">number — default 1</span></div>
                <div><code className="font-mono text-primary">limit</code> <span className="text-muted-foreground">number — max 100, default 20</span></div>
              </div>
              <h4 className="text-sm font-semibold text-foreground mt-4">Response</h4>
              <CodeBlock lang="json" code={`{
  "success": true,
  "sessions": [ ... ],
  "total": 42,
  "page": 1,
  "limit": 20
}`} />
            </CollapsibleSection>
          </div>
        </section>

        {/* Code Examples */}
        <section className="space-y-4 scroll-mt-20">
          <h2 className="text-2xl font-bold text-foreground">Code Examples</h2>
          <div className="bg-muted/30 rounded-lg p-1 flex gap-0.5 w-fit">
            {TAB_LANGS.map(lang => (
              <button
                key={lang}
                onClick={() => setActiveTab(lang)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === lang ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {lang}
              </button>
            ))}
          </div>
          <CodeBlock code={CODE_EXAMPLES[activeTab]} lang={activeTab.toLowerCase()} />
        </section>

        {/* SDK Reference */}
        <section id="sdk" className="space-y-6 scroll-mt-20">
          <h2 className="text-2xl font-bold text-foreground">SDK Reference</h2>
          <p className="text-muted-foreground">Include our JavaScript SDK for the fastest integration — a single script tag adds a branded payment button.</p>
          <CodeBlock code={SDK_SNIPPET} lang="html" />

          <h3 className="text-lg font-semibold text-foreground mt-6">QR Code Display</h3>
          <p className="text-sm text-muted-foreground">Generate and display a dynamic QR code that auto-polls for payment completion:</p>
          <CodeBlock code={QR_SNIPPET} />

          <h3 className="text-lg font-semibold text-foreground mt-6">SDK Methods</h3>
          <div className="space-y-2">
            {[
              ["EasyPay.init(options)", "Initialize with apiKey, appPassword, endpoint, mode"],
              ["EasyPay.renderButton(selector, opts)", "Render a branded Pay button in a container"],
              ["EasyPay.createPayment(opts)", "Create a payment session (returns Promise)"],
              ["EasyPay.displayQR(selector, session, opts)", "Render QR code with auto-polling"],
              ["EasyPay.checkStatus(sessionId)", "Check payment session status (returns Promise)"],
            ].map(([method, desc]) => (
              <div key={method} className="flex items-baseline gap-3 text-sm">
                <code className="font-mono text-primary text-xs whitespace-nowrap">{method}</code>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Webhooks */}
        <section className="space-y-4 scroll-mt-20">
          <h2 className="text-2xl font-bold text-foreground">Webhooks</h2>
          <p className="text-muted-foreground text-sm">When a payment completes, EasyPay sends a POST request to your configured webhook URL (set during API key generation or per-session via <code className="bg-muted px-1 rounded text-xs">callback_url</code>).</p>
          <CodeBlock lang="json" code={`{
  "event": "payment.completed",
  "session_id": "uuid",
  "amount": 500,
  "currency": "BDT",
  "reference": "ORDER-123",
  "completed_at": "2026-03-25T12:05:00Z",
  "signature": "hmac_sha256_hash"
}`} />
          <p className="text-sm text-muted-foreground">Verify the <code className="bg-muted px-1 rounded text-xs">signature</code> header using your Secret Key (<code className="bg-muted px-1 rounded text-xs">eps_</code>) with HMAC-SHA256 to ensure authenticity.</p>
        </section>

        {/* Rate Limits */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Rate Limits</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="font-semibold text-foreground text-sm">API Requests</p>
              <p className="text-muted-foreground text-xs mt-1">30 requests per minute per API key (configurable)</p>
            </div>
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="font-semibold text-foreground text-sm">Session Creation</p>
              <p className="text-muted-foreground text-xs mt-1">100 sessions per hour per merchant</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center border border-border rounded-2xl p-10 bg-card space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Ready to get started?</h2>
          <p className="text-muted-foreground">Register as a merchant to get your API credentials and start accepting payments.</p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/"><Button className="gap-2">Become a Merchant <ArrowRight className="w-4 h-4" /></Button></Link>
            <a href="mailto:support@easypay.com"><Button variant="outline">Contact Sales</Button></a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} EasyPay. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

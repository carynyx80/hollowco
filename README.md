# HollowCo — a company with nobody in it

Speak a business idea. In about a minute an **AI founder agent** creates a brand (name, tagline, colours, logo) and opens a shop. An **AI writer agent** writes e-books (delivered instantly as PDF/Markdown after payment). An **AI designer agent** makes print-on-demand designs (shirts, mugs) — paid orders become **Printful draft orders** (never confirmed). Buyers pay with **PayPal** (JS SDK + Orders v2). After fulfilment the founder pays its staff agents with **PayPal Payouts**. Every cent lands on a **live public P&L ledger** (AG Grid).

**AI proposes, code disposes.** Prices and payouts are only *proposals*; `api/src/guardrails.ts` enforces hard limits (price $1–$60, max $5 per task, ≤30% of order revenue, $50/day cap, allowlisted recipients, USD only). Rejected proposals are logged to the ledger. Try the *"jailbreak the founder"* box on the ledger page — it always fails, visibly.

- Live demo: https://hollowco.vercel.app · API: https://api-production-692d8.up.railway.app/health
- Watches: coming soon.

## Architecture

```mermaid
flowchart LR
  U[Buyer / Visitor<br/>voice or text] --> W[web: Next.js on Vercel]
  W -->|REST| A[api: Express + TS on Railway]
  A --> F[Founder agent]
  F --> WR[Writer agent]
  F --> DE[Designer agent]
  F -.proposals.-> G{Guardrails in code}
  G -->|approved| PO[PayPal Payouts<br/>fallback: Invoicing]
  G -->|rejected| L[(Ledger)]
  W -->|PayPal JS SDK buttons| PP[PayPal Orders v2]
  A -->|create / capture| PP
  A -->|paid physical item| PF[Printful v1 POST /orders confirm=false]
  A --> DB[(Postgres)]
  PO --> L
  PF --> L
  L --> W
```

## Setup

```bash
# root .env.local (never committed)
PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... PAYPAL_ENV=sandbox
# optional: OPENAI_API_KEY or XAI_API_KEY (else deterministic mock AI), PRINTFUL_API_TOKEN (+ PRINTFUL_STORE_ID), DATABASE_URL (else in-memory)
cd api && npm i && npm run dev        # :4000
npm test                              # sandbox e2e: shop -> order -> capture path -> fulfil -> payouts -> ledger -> jailbreak
cd ../web && npm i && NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev
```

API env on Railway: `PAYPAL_*`, `DATABASE_URL`, `PUBLIC_API_URL`, `CORS_ORIGINS`, optional AI / Printful keys. Web env on Vercel: `NEXT_PUBLIC_API_URL`.

## Sandbox test buyer

- Email: `sb-vkeld53675758@personal.example.com`
- Password: get it from the PayPal Developer Dashboard → Testing Tools → Sandbox Accounts (not published here).

The same sandbox account receives the agent payouts.

## Modes

- **AI**: OpenAI (`OPENAI_API_KEY`) or xAI (`XAI_API_KEY`) via one provider abstraction; without a key a deterministic mock generates brands, books and PNG artwork so the flow still works end to end. The mock founder deliberately *obeys* jailbreak text to show the guardrails doing the work.
- **Supplier**: real Printful draft orders when `PRINTFUL_API_TOKEN` is set (store-level token, or set `PRINTFUL_STORE_ID`); otherwise a clearly labelled simulated supplier.

## AI tools used

- Grok Bot (AI agent) wrote and deployed this codebase
- LLM + image model via provider abstraction (OpenAI / xAI) or deterministic mock
- PayPal REST APIs (Orders v2, Payouts, Invoicing), PayPal JS SDK

## License

MIT

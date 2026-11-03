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

## For judges

> **Sandbox / test money only.** Everything below uses the PayPal **sandbox**; no real money moves. These are throwaway, test-only credentials, published so judges can test the project.

1. Open the hosted demo: **https://hollowco.vercel.app** (API health: https://api-production-692d8.up.railway.app/health)
2. Optional, to create your own AI shop: sign in at https://hollowco.vercel.app/signin with the demo-only app account
   - Email: `demo@hollowco.app`
   - Password: `ItpZaPUr0ApxZDIc`
3. Buy something from https://hollowco.vercel.app/marketplace and click **Pay with PayPal** (not the card button). Log in with the PayPal **sandbox** buyer:
   - Email: `sb-vkeld53675758@personal.example.com`
   - Password: `Hollowco2026`
   - Or use your own PayPal sandbox *personal* account from developer.paypal.com.
4. After capture you land on the receipt. E-books download as PDF. Shirts and mugs create a **Printful draft order** (never confirmed, nothing is printed or shipped). The AI accountant pays the staff agents via **PayPal Payouts**, checked by code guardrails. Everything shows on https://hollowco.vercel.app/ledger (AG Grid).

5. **Guest card test** (sandbox, no PayPal login): on checkout click the card button, then enter
   - Card: Visa `4032 0341 5535 1326`, any future expiry, any CVV
   - Set **Country/Region** to **United States**
   - US billing address, e.g. `123 Main St, San Jose, CA 95131`, and a US phone number
   - Turn **off** "Save info & create PayPal account"
   - Click **Pay now as guest**

## Sandbox accounts

- Buyer (customer): `sb-vkeld53675758@personal.example.com`. Buyer only, never a payee.
- Staff payee (writer/designer agents receive Payouts here): `sb-7ygua53685681@personal.example.com`, the only allowlisted recipient in `api/src/guardrails.ts`.

## Pricing and fulfilment

- E-books $7.99 to $17; tees from **$29**, mugs from **$22**. Physical price floors are enforced in code so the margin after Printful cost (about $18.61 per tee) leaves room for payouts. Payouts are based on margin, capped at 30%, and rounded to cents.
- Physical items create Printful **draft** orders only (`confirm=false`). They are never confirmed.

## Modes

- **AI**: OpenAI (`OPENAI_API_KEY`) or xAI (`XAI_API_KEY`) via one provider abstraction; without a key a deterministic mock generates brands, books and PNG artwork so the flow still works end to end. The mock founder deliberately *obeys* jailbreak text to show the guardrails doing the work.
- **Supplier**: real Printful draft orders when `PRINTFUL_API_TOKEN` is set (store-level token, or set `PRINTFUL_STORE_ID`); otherwise a clearly labelled simulated supplier.

## How HollowCo uses PayPal + AI

The AI founder acts through **PayPal's official Agent Toolkit** (`@paypal/agent-toolkit/openai`, OpenAI function calling). The model only *proposes* tool calls; every call passes code guardrails before it reaches PayPal (**the AI proposes, code approves**). Every proposed call, approved or blocked, is written to the public ledger as an `agent_tool` event (`GET /agent/calls`, shown on `/ledger` and the dashboard as "AI agent used PayPal Agent Toolkit: create_product …").

| PayPal API / tool | Used for | Where in code |
|---|---|---|
| Agent Toolkit `create_product` (Catalog Products API) | Founder registers each new store's products in the PayPal catalog when a store is built | `api/src/core.ts` `createShop` → `api/src/agent.ts` `runAgent` |
| Agent Toolkit `get_order` (Orders v2) | Founder checks the captured PayPal order before paying staff (it can only read the order being fulfilled) | `api/src/core.ts` `fulfil` |
| Agent Toolkit `create_order`, `create_invoice` | Offered to the founder in the jailbreak demo. Guardrails block them because nothing from chat is backed by a paid order | `api/src/core.ts` `jailbreak` |
| Agent Toolkit `list_products`, `show_product_details`, `list_transactions` | Enabled in the toolkit configuration (`TOOLKIT_ACTIONS`) | `api/src/agent.ts` |
| `create_payout` (custom function tool → Payouts API v1 `POST /v1/payments/payouts`) | The toolkit has no Payouts tool, so the founder pays staff with this tool, sitting beside the toolkit tools | `api/src/agent.ts` `payoutTool`, `api/src/paypal.ts` `payout` |
| Payouts API `GET /v1/payments/payouts/{batch}` | A poller (every 60s), `POST /payouts/sync`, and `PAYMENT.PAYOUTS*` webhooks rewrite ledger rows to the real status (SUCCESS / UNCLAIMED / RETURNED …) | `api/src/core.ts` `syncPayouts`, `startPayoutPoller` |
| Orders v2 create / capture / get (direct REST) | Customer checkout with one purchase unit per store. Direct REST because the toolkit's `create_order` can't set per-store `reference_id` | `api/src/paypal.ts`, `api/src/index.ts` `/orders` |
| PayPal JS SDK buttons | Buyer approval (PayPal or guest card) | `web/components/PayButton.tsx` |
| Webhooks `CHECKOUT.ORDER.*`, `PAYMENT.CAPTURE.*`, `PAYMENT.PAYOUTS*` | We re-read the order or payout from PayPal and never trust the webhook payload | `api/src/index.ts` `/paypal/webhook` |
| Invoicing v2 (direct) | Fallback record if a payout call fails | `api/src/paypal.ts` |

**Guardrails wrapped around every tool call** (`api/src/agent.ts` `baseGuard` + task guards, `api/src/guardrails.ts`):
- Each task allows only certain tools.
- Payouts: max $5 per task, at most 30% of the order's gross margin, a $50 daily cap, the staff payee allowlist (`sb-7ygua53685681@personal.example.com`), and USD only.
- Orders: item prices between $1 and $60, and an order-total cap.
- Invoices: recipient must be on the allowlist, plus an amount cap.
- A daily cap on agent write calls.

**Proof endpoints:**
- `GET /stats`: real city stats (stores, products, orders, sandbox revenue, payouts sent and succeeded, guardrail blocks, jailbreaks blocked, toolkit calls).
- `GET /agent/toolkit`: the tools that are enabled.
- `GET /agent/calls`: the founder's tool calls.
- `GET /payouts`: payout batches with their live status.
- `POST /jailbreak`: the "Try to trick the founder" demo.

## AI tools used

- Grok Bot (AI agent) wrote and deployed this codebase
- LLM + image model via provider abstraction (OpenAI / xAI) or deterministic mock
- PayPal REST APIs (Orders v2, Payouts, Invoicing), PayPal JS SDK

## License

MIT

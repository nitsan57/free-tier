# Freemium AI Agent Starter

A reference template showing how to **monetize an AI agent** by gating capabilities behind a paywall. Ship a **free tier** with limited usage to attract users, then unlock a more capable **pro agent** once they upgrade. Copy this repo to bootstrap your own freemium agent product.

## The freemium agent model

Free users get a working agent with constrained quotas and basic capabilities so they can try it out with zero friction. Pro users pay a recurring fee and get a more powerful agent: higher message caps, faster and larger models, more tools, and greater concurrency. The tier is enforced **server-side**, so clients cannot bypass limits by editing local config.

## Core concept: free tier vs pro agent

Every request carries an API key. The server resolves the key to an account, reads that account's tier, and applies the right policy before the agent runs.

| Capability        | Free tier                         | Pro agent                                  |
| ----------------- | --------------------------------- | ------------------------------------------ |
| Message cap       | 50 messages / month               | Unlimited                                  |
| Rate limit        | 5 requests / minute              | 60 requests / minute                       |
| Model quality     | Small/fast model                  | Large/frontier model                       |
| Tool access       | Basic tools (search)              | All tools (search, code exec, webhooks…)   |
| Concurrency       | 1 active session                  | 10 concurrent sessions                     |
| Priority          | Shared queue                      | Priority compute                           |
| Support           | Community                         | Email + SLA                                |

## Architecture overview

```
client ──API key──▶ gateway ──▶ tier resolver ──▶ policy check ──▶ agent
                         │             │                │
                         ▼             ▼                ▼
                    usage meter   account store    quota / rate limiter
```

- **License / API key** — every call is authenticated with a key. Anonymous or unkeyed requests default to the free tier.
- **Usage metering** — the server increments a counter per account (messages, tokens, requests) in a durable store.
- **Tier policy** — server-side rules map each tier to its caps (see table above). Limits are enforced before the agent runs.
- **Server-side checks** — clients never decide their own tier. The agent only sees what the policy allows, so free users can't reach pro-only tools.

The key principle: **never trust the client.** Tier, quotas, and feature flags are resolved and verified on the server.

## Quick start

```bash
# clone and enter the repo
git clone <your-fork-url> && cd freemium-agent-starter

# install dependencies
npm install

# copy and edit the env file
cp .env.example .env

# run locally (free tier, no payment required)
npm run dev
```

Send a request with a free key to see the limits in action:

```bash
curl -H "Authorization: Bearer $FREE_API_KEY" \
     -d '{"message": "Hello, agent"}' \
     http://localhost:3000/agent
```

When the free quota is exceeded, the API returns `402 Payment Required` with a link to upgrade.

## How monetization works

The billing flow is **framework-agnostic** — swap in any payment provider. The canonical example is a **Stripe-style checkout**:

1. User hits a free-tier limit and receives a `402` with an `upgrade_url`.
2. `upgrade_url` opens a hosted checkout session for a recurring subscription.
3. On successful payment, the payment provider calls your **webhook** with the subscription event.
4. Your webhook flips the account's tier to `pro` in the account store.
5. Subsequent requests from that account's API key now pass the pro policy checks.

```text
free agent ──(402 + upgrade_url)──▶ checkout ──(webhook)──▶ account = pro
```

Because tier is resolved from the server-side account store, no client change is needed after upgrade — the same API key simply unlocks more.

## How to unlock pro

Upgrades happen entirely **server-side**:

- The user clicks the upgrade link returned by the API (or a button in your UI).
- They complete checkout with the payment provider.
- The provider webhook updates the account tier.
- **What changes for the user:** the same API key now gets unlimited messages, a faster/larger model, all pro tools, and higher concurrency. No new key, no reinstall — just more capability.

To verify in development, you can flip a tier manually:

```bash
curl -X POST http://localhost:3000/admin/accounts/$ACCOUNT_ID/tier \
     -d '{"tier": "pro"}'   # dev-only endpoint
```

## Project structure

```text
.
├── .env.example          # template for API keys, DB, payment provider config
├── src/
│   ├── gateway/          # auth + API key validation
│   ├── billing/          # checkout session + webhook handlers
│   ├── metering/         # usage counters and quota enforcement
│   ├── policy/           # tier → capability mapping (free vs pro)
│   └── agent/            # the agent runtime (model + tools)
├── store/                # account and usage persistence
└── README.md
```

Each layer is decoupled so you can replace the payment provider, database, or agent runtime without touching the tier-enforcement logic.

## License

Released under the [MIT License](./LICENSE). Use it freely as a starting point for your own product.

## Contributing

Contributions are welcome. Open an issue to discuss changes, then submit a pull request. Please keep the freemium gating logic server-side and framework-agnostic so the template stays easy to adapt.

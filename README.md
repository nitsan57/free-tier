# Google Photos Cleaner

A Next.js 14 (App Router) + TypeScript + Tailwind app that finds and bulk-deletes
**screenshots** and **spam photos** from your Google Photos library, with a
Free/Pro billing tier.

> Scaffold foundation. Auth, detection, billing, and the review/delete UI are
> wired up as module stubs under `app/` and `lib/`.

## Feature tiers

| Capability            | Free              | Pro                      |
| --------------------- | ----------------- | ------------------------ |
| Deletions / month     | 50                | Unlimited                |
| Detection             | Screenshots       | Screenshots + advanced spam |
| Support               | Community         | Email + SLA              |

## Project structure

```text
.
├── app/
│   ├── api/
│   │   ├── auth/         # login, callback, logout (OAuth)
│   │   ├── clean/        # delete (batch delete + dry-run)
│   │   └── billing/      # checkout, webhook (Stripe)
│   ├── clean/            # review UI (list, select, delete)
│   ├── layout.tsx
│   └── page.tsx          # landing
├── components/           # UI components (PhotoCard, …)
├── lib/
│   ├── google/           # Google Photos Library API client
│   ├── detection/        # screenshot + spam heuristics
│   ├── billing/          # Stripe + usage metering
│   └── session/          # encrypted token storage + httpOnly cookies
├── .env.example
├── tailwind.config.ts
└── tsconfig.json
```

## Quick start

```bash
npm install
cp .env.example .env   # fill in Google OAuth + Stripe secrets
npm run dev
```

See the full setup docs (Google Cloud, OAuth, Stripe) for the remaining tasks.
No real secrets are committed to this repo.

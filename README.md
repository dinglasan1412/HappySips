# Happy Sips — Milk Tea Shop Management System

A login, dashboard, inventory, and point-of-sale system for a milk tea shop, built with React + Vite (frontend) and Vercel serverless functions + Upstash Redis (shared backend).

## Features

- **Login** — role-based access (Admin / Staff), verified server-side, with an approval-gated request flow for real accounts
- **Dashboard** — sales totals, low-stock alerts, category/payment breakdowns, top sellers
- **Inventory** — stock tracking for ingredients & supplies, with reorder alerts and full CRUD for Admins
- **Sales (POS)** — tap-to-order checkout with Medium/Large sizing, GCash reference tracking, and a printed-receipt-style confirmation
- **Shared data** — everyone who opens the deployed site sees the same live inventory, menu, and sales history

## How data access works

| | Read (view) | Write (add/edit/delete) |
|---|---|---|
| Sales | Anyone who opens the site | Any **verified** logged-in user |
| Inventory | Anyone who opens the site | **Verified Admin** only |
| Menu | Anyone who opens the site | **Verified Admin** only |
| Accounts | Never exposed publicly | Only via account requests (see below) |

Reads go straight through. Writes require a valid login token issued by `/api/login`, checked server-side on every request — this isn't just a hidden button, someone calling the API directly without logging in genuinely cannot write.

**"Verified" is the important word.** The two seeded `admin`/`staff` logins below are intentionally **view-only** — they let anyone browse the app's UI, but the server rejects any write attempt from them, regardless of role. Real edit access only exists for accounts that have gone through the request-and-approval flow.

## Demo accounts (view-only)

| Role  | Username | Password   |
|-------|----------|------------|
| Admin | `admin`  | `admin123` |
| Staff | `staff`  | `staff123` |

These can log in and look around, but cannot add/edit/delete anything — the Sales page shows a "view-only demo account" notice and disables checkout, and Inventory hides the edit controls entirely. This is what makes the project safe to leave with its default credentials in an open-source repo.

## Getting real access: account requests

Instead of open self-registration, anyone who wants to actually record sales or edit inventory has to submit a request from the login screen ("Request a real account"), giving their name, desired username/password, a phone number or email, and which role they want. That request:

1. Is saved to the shared database (visible only to a verified Admin)
2. Triggers an email to you (see setup below)
3. Does **nothing** until a verified Admin opens **Account Requests** in the sidebar and clicks **Approve** — only then does it become a real, working login

**Bootstrapping problem this solves:** if only a verified Admin can approve requests, something has to be the *first* verified Admin. That's what this account is for:

| Role | Username | Password |
|------|----------|----------|
| Admin (verified) | `owner` | `byTi5v2qpv` |

Log in with this once, and use it (or a request you approve for yourself) going forward — **change this password** the same way you'd change the demo ones, by editing `seedUsers()` in `lib/seed-data.js` before your first-ever deploy (seed values only apply the very first time the database is populated).

## Architecture

```
src/          React frontend (Vite) — unchanged in spirit from before
api/          Vercel serverless functions (the HTTP endpoints)
  data.js                    GET/POST for inventory, menu, sales
  login.js                   POST — verifies a password, returns a signed session token
  account-requests.js        GET (list, Admin-only) / POST (submit, public)
  account-requests-review.js POST — approve/deny a pending request (Admin-only)
lib/          Shared server-side logic, imported by api/*
  auth.js       password hashing + signed token creation/verification
  seed-data.js  first-time seed values (menu, inventory, placeholder sales, demo + owner accounts)
  store.js      Redis read/write helpers
  email.js      sends the "new account request" notification via Resend
  handlers.js   the actual request-handling logic (kept separate from api/*
                so it's testable without a real deployment)
scripts/      Local-only tooling (not deployed)
  test-api.mjs      automated tests for the auth/permission/request-approval logic
  e2e-server.mjs    a tiny local server for testing without the Vercel CLI
```

## Setting up the shared database

This is the one-time setup that makes data shared instead of per-browser. Do this **after** your project is already deployed on Vercel (see the deploy steps below if you haven't done that part yet).

**1. Link a Redis database**
- Open your project on [vercel.com](https://vercel.com), go to the **Storage** tab
- Click **Create Database** → choose **Upstash** → **Redis**
- Follow the prompts (the free tier is plenty for this)
- Vercel automatically adds the connection details as environment variables to your project — you don't need to copy/paste any keys yourself

**2. Add the session secret**
- Still in your Vercel project, go to **Settings → Environment Variables**
- Add a new variable: Name = `AUTH_SECRET`, Value = a long random string. Here's one already generated for you, ready to paste:
  ```
  bf604b4f466691529b00206a1be63dfd4c04afc19ab19e4e2dd2e270c0688830
  ```
  (Or generate your own with `openssl rand -hex 32` in a terminal.)
- Apply it to all environments (Production, Preview, Development)

**3. Redeploy**
- Environment variable changes only take effect on the *next* deploy — go to the **Deployments** tab and redeploy (or just push a new commit)
- Once that finishes, open the site — the first visitor to load any page triggers the initial seeding of inventory/menu/sales automatically

If something's misconfigured, the app shows a clear "Can't reach the shared database" message rather than failing silently — that's your signal to double check the two steps above.

## Setting up account request emails

Optional, but this is what makes account requests actually notify you instead of only showing up in the Account Requests screen next time you check it.

**1. Create a Resend account**
- Sign up at [resend.com](https://resend.com) using **lykadinglasan12@gmail.com** — the free tier (3,000 emails/month) sends immediately with no domain verification needed, as long as you're sending to the same address you signed up with, which is exactly this case
- Go to **API Keys** → **Create API Key**

**2. Add it to Vercel**
- **Settings → Environment Variables** → add `RESEND_API_KEY` with the key you just created
- (Optional) add `NOTIFY_EMAIL` if you ever want notifications to go somewhere other than lykadinglasan12@gmail.com — otherwise it defaults to that address
- Redeploy for it to take effect

Without this, account requests still work and still show up in the Account Requests screen — you just won't get an email nudge when one comes in. A phone-based (SMS) version of this notification is possible too, but needs a paid PH SMS gateway (e.g. Semaphore) rather than a free service — happy to wire that up if you want it later.

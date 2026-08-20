# Happy Sips — Milk Tea Shop Management System

A login, dashboard, inventory, and point-of-sale system for a milk tea shop, built with React + Vite (frontend) and Vercel serverless functions + Upstash Redis (shared backend).

## Features

- **Login** — role-based access (Admin / Staff), verified server-side, with an approval-gated request flow for real accounts
- **Dashboard** — sales totals, low-stock alerts, category/payment breakdowns, top sellers
- **Inventory** — stock tracking for ingredients & supplies, with reorder alerts and full CRUD for Admins
- **Sales (POS)** — tap-to-order checkout with Medium/Large sizing, GCash reference tracking, and a printed-receipt-style confirmation
- **Shared data** — everyone who opens the deployed site sees the same live inventory, menu, and sales history

## Demo accounts (view-only)

| Role  | Username | Password   |
|-------|----------|------------|
| Admin | `admin`  | `admin123` |
| Staff | `staff`  | `staff123` |

These can log in and look around, but cannot add/edit/delete anything.
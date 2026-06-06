# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FBB Stock is a **web-first** React Native (Expo) supply chain and inventory management hub for FuufoonBites. It supports two distinct role contexts — **HQ Admin** and **Store Manager** — each with a different set of tabs and operations. Designed for desktop browser use.

## Commands

```bash
npx expo start --web    # Primary dev mode (web browser)
npx expo start          # Full dev server
```

## Environment Variables

Required in `.env`:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Architecture

### Single-Screen Tab App
The entire app lives in `app/index.tsx`. Navigation is **tab-based within one screen** — no Expo Router page navigation. The active tab is state-driven (`activeTab`), and each tab renders a different component from `components/`.

### Role System
The app has a **dev-mode role switcher** in the top nav bar. Roles are stored in local state (`currentRole: RoleContext`):
- `HQ Admin` — sees: Fulfillment, Catalog, Dashboard, Stocktake, Pop-up Packing, (Production — feature flagged off)
- `Store Manager` — sees: POS, Wastage, Place Order

Stores are loaded from the Supabase `stores` table on mount.

### Feature Flag
```ts
const ENABLE_HQ_PRODUCTION = false; // Dark-launched, not visible to users
```

### Components (`components/`)
Each component is a self-contained panel rendered by the active tab:

| Component | Role | Purpose |
|---|---|---|
| `HQFulfillment` | HQ Admin | Process store orders from HQ |
| `ProductCatalog` | HQ Admin | View/manage product catalogue |
| `InventoryDashboard` | HQ Admin | Stock level overview |
| `BlindStocktake` | HQ Admin | Counted stock reconciliation |
| `MarketPacking` | HQ Admin | Transfer inventory to pop-up locations |
| `HQProduction` | HQ Admin | Production planning (feature-flagged off) |
| `StoreOrderPortal` | Store Manager | Place replenishment orders to HQ |
| `StorePOS` | Store Manager | Lightweight in-store POS |
| `StoreWastage` | Store Manager | Log wastage / spoilage |
| `DispatchComponent` | — | Handles dispatch logic |
| `ReceivingRadar` | — | Tracks incoming stock transfers |

All components receive a `key={`<name>-${refreshTrigger}`}` prop — incrementing `refreshTrigger` via the "Sync Dashboard" button force-remounts and refreshes all data.

### Data Layer (`utils/supabase.ts`)
Minimal — only exports the Supabase client. All DB queries are made directly inside each component using `supabase.from(...)`.

Key Supabase tables: `stores`, `products`, `inventory_batches`, and order/transfer tables used within components.

### Styling
NativeWind (Tailwind CSS for React Native). Dark theme with indigo/slate palette (`#0b0f19` bg, `#0f172a` nav, indigo-600 accent for HQ, emerald-600 for Store Manager).

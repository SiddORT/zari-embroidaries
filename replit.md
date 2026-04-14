# ZARI ERP Workspace

## Overview

pnpm workspace monorepo using TypeScript. Full-stack ERP authentication system for Zari Embroideries.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: JWT (jsonwebtoken) + bcrypt (bcryptjs)
- **Frontend**: React + Vite + Tailwind CSS

## Artifacts

- **ZARI ERP** (`artifacts/zari-erp`) — React frontend at `/`
- **API Server** (`artifacts/api-server`) — Express backend at `/api`

## Authentication

- JWT tokens with bcrypt password hashing
- Default admin: `admin@zarierp.com` / `Admin@123`
- Token stored in localStorage under `zarierp_token`
- Protected routes via `useGetMe` hook

## Frontend Pages & Navigation

- **Login** (`/login`) — Split-screen auth page with ZariButton (black + gold text)
- **Forgot Password** (`/forgot-password`) — 3-step: request → reset → success
- **Dashboard** (`/dashboard`) — Summary cards + recent activity
- **HSN Master** (`/masters`) — Full CRUD master module (see below)
- **TopNavbar** — Horizontal nav bar: ZARI branding left, nav links center, user+logout right
- **ZariButton** — Reusable button: primary (black bg + gold text) and secondary variants

## Reusable Master Components

Located at `artifacts/zari-erp/src/components/master/`:
- `MasterHeader` — Page title + Add button
- `MasterTable` — Data table with sortable cols, skeleton loading, empty state
- `MasterFormModal` — Centered modal with header/footer and keyboard close
- `StatusToggle` — Active/Inactive pill button
- `SearchBar` — Search input with clear button
- `ExportExcelButton` — XLSX export using the `xlsx` library

Reusable UI fields at `artifacts/zari-erp/src/components/ui/`:
- `InputField`, `TextareaField`, `SelectField` — Styled form controls with labels and inline errors

## API Routes

- `POST /api/auth/login` — Login, returns JWT
- `POST /api/auth/logout` — Logout
- `POST /api/auth/forgot-password` — Request password reset
- `POST /api/auth/reset-password` — Reset password with token
- `GET /api/auth/me` — Get current user (requires Bearer token)
- `GET /api/hsn` — List HSN records (search, page, limit query params)
- `POST /api/hsn` — Create HSN record
- `PUT /api/hsn/:id` — Update HSN record
- `PATCH /api/hsn/:id/status` — Toggle Active/Inactive
- `DELETE /api/hsn/:id` — Soft delete (marks Inactive)

## Database Schema

- `users` table: id, username, email, hashed_password, role, is_active, created_at
- `hsn_master` table: id, hsn_code (unique), gst_percentage, govt_description, remarks, is_active, created_by, created_at, updated_by, updated_at

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

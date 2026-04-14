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

## API Routes

- `POST /api/auth/login` — Login, returns JWT
- `POST /api/auth/logout` — Logout
- `POST /api/auth/forgot-password` — Request password reset
- `POST /api/auth/reset-password` — Reset password with token
- `GET /api/auth/me` — Get current user (requires Bearer token)

## Database Schema

- `users` table: id, username, email, hashed_password, role, is_active, created_at

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

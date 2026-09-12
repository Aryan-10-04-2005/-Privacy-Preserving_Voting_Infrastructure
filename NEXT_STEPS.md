# 🗺️ Next Steps — Privacy-Preserving Voting Infrastructure

> This document outlines the recommended roadmap for taking the project from MVP to production.

---

## Priority Overview

| # | Step | Priority | Effort |
|---|------|----------|--------|
| 1 | Real Database (PostgreSQL + Prisma) | 🔴 High | Medium |
| 2 | Real ZK Circuits (circom + snarkjs) | 🔴 High | High |
| 3 | Authentication & Access Control | 🟠 Medium | Medium |
| 4 | Frontend Polish & Admin Dashboard | 🟠 Medium | Medium |
| 5 | Real Blockchain Integration (MST node) | 🟠 Medium | Low |
| 6 | Rate Limiting & Security Hardening | 🟡 Pre-prod | Low |

---

## 1. 🗄️ Real Database — PostgreSQL + Prisma

**Problem:** The current data layer uses a local JSON file (`apps/api/data/store.json`). This is not thread-safe, not scalable, and not suitable for production.

**Solution:** Replace `storeService.ts` with a Prisma ORM layer backed by PostgreSQL.

### Steps
- [ ] Add `prisma` and `@prisma/client` to `apps/api`
  ```bash
  npm install prisma @prisma/client
  npx prisma init
  ```
- [ ] Define schema in `prisma/schema.prisma`:
  - `Organization` model
  - `Election` model (with `candidates` JSON field, `status`, `eligibilityConfig`)
  - `Vote` model (nullifierHash, encryptedBallot, txHash, blockNumber)
  - `BlockchainEvent` model (eventType, txHash, payloadHash)
- [ ] Implement `IDataStore` interface in a new `prismaStoreService.ts`
- [ ] Run migrations: `npx prisma migrate dev --name init`
- [ ] Update `apps/api/src/services/storeService.ts` to export the Prisma implementation
- [ ] Add `DATABASE_URL` to `.env`

### Files to change
- `apps/api/src/services/storeService.ts` → swap JSON impl for Prisma
- `apps/api/prisma/schema.prisma` → new file
- `apps/api/.env` → add `DATABASE_URL`

---

## 2. 🔐 Real ZK Circuits — circom + snarkjs

**Problem:** `ZkProofService.ts` returns mocked proof bytes (`0xproof_...`). No actual cryptographic proof is being generated or verified.

**Solution:** Write real `circom` circuits for:
1. **Membership proof** — voter holds a valid credential committed in the Merkle tree
2. **Nullifier proof** — nullifier = `Hash(identity_secret, election_id)` and hasn't been used

### Steps
- [ ] Install tooling:
  ```bash
  npm install -g circom snarkjs
  ```
- [ ] Write circuits in `apps/api/circuits/`:
  - `membership.circom` — proves commitment matches merkle root
  - `nullifier.circom` — proves nullifier derivation
- [ ] Compile circuits and generate trusted setup (Powers of Tau):
  ```bash
  circom membership.circom --r1cs --wasm
  snarkjs groth16 setup membership.r1cs pot12_final.ptau membership_0.zkey
  ```
- [ ] Export verification key: `snarkjs zkey export verificationkey`
- [ ] Update `ZkProofService.ts`:
  - Use `snarkjs.groth16.fullProve()` for generation
  - Use `snarkjs.groth16.verify()` for verification
- [ ] Store Merkle root of all issued credentials in the election object

### Files to change
- `apps/api/src/services/ZkProofService.ts`
- `apps/api/circuits/` → new directory with `.circom` files

---

## 3. 🔑 Authentication & Access Control

**Problem:** Currently, anyone can call admin routes like `POST /elections/:id/finalize` or `POST /organizations`.

**Solution:** Protect admin endpoints with JWT middleware; voters authenticate per their org type.

### Steps
- [ ] Create `src/middleware/auth.ts`:
  - `requireAdminToken(req, res, next)` — verifies `Authorization: Bearer <token>`
  - `JWT_SECRET` from `.env`
- [ ] Add `POST /api/auth/admin-login` endpoint (username + password → JWT)
- [ ] Protect routes:
  - `POST /api/organizations` — admin only
  - `POST /api/elections` — admin only
  - `POST /api/elections/:id/finalize` — admin only
- [ ] For DAO voters: verify wallet signature (`ethers.verifyMessage`) instead of plain wallet address
- [ ] For College voters: integrate OAuth/SSO or institution email OTP

### Files to change
- `apps/api/src/routes/api.ts` → add middleware to protected routes
- `apps/api/src/middleware/auth.ts` → new file

---

## 4. 🎨 Frontend Polish & Admin Dashboard

**Problem:** The current UI (`apps/web/src/App.tsx`) is functional but minimal — no admin flow, basic styling.

**Solution:** Split into two distinct UIs:

### Voter UI
- [ ] Clean multi-step wizard: Eligibility → Credential → ZK Proof → Vote → Receipt
- [ ] Dark mode, glassmorphism card style
- [ ] Real-time step status with animated transitions
- [ ] Mobile responsive layout

### Admin Dashboard (new route `/admin`)
- [ ] Login page (JWT)
- [ ] Create organization & election forms
- [ ] Live election status monitor (votes cast, time remaining)
- [ ] One-click finalize → shows ZK tally proof
- [ ] MST Blockchain ledger viewer

### Files to change
- `apps/web/src/App.tsx` → refactor into components
- `apps/web/src/pages/` → new directory (Voter, Admin, Audit)
- `apps/web/src/components/` → shared components

---

## 5. ⛓️ Real MST Blockchain Integration

**Problem:** `BlockchainService.ts` simulates the MST chain with a local counter and SHA-256 hashes. No real on-chain events are recorded.

**Solution:** Connect to a live MST node endpoint.

### Steps
- [ ] Add `BLOCKCHAIN_ENDPOINT` to `.env`
- [ ] Update `BlockchainService.ts`:
  - Replace `commitTransaction()` mock with actual MST SDK call
  - Replace `getLedgerTransactions()` with real on-chain query
- [ ] Handle transaction confirmation timeouts
- [ ] Add retry logic for failed submissions

### Files to change
- `apps/api/src/services/blockchainService.ts`
- `apps/api/.env` → add `BLOCKCHAIN_ENDPOINT`

---

## 6. 🛡️ Rate Limiting & Security Hardening

**Problem:** The API has no protection against abuse, DDoS, or injection attacks.

**Solution:** Add standard production-grade security layers.

### Steps
- [ ] Install packages:
  ```bash
  npm install helmet express-rate-limit express-validator
  ```
- [ ] Add `helmet()` middleware in `index.ts` (HTTP security headers)
- [ ] Add rate limiters:
  - `/api/eligibility/verify` — 10 req/min per IP
  - `/api/votes` — 5 req/min per IP
  - `/api/credentials/issue` — 10 req/min per IP
- [ ] Add `express-validator` input sanitization on all POST routes
- [ ] Add CORS whitelist (restrict to known frontend domains)

### Files to change
- `apps/api/src/index.ts` → add helmet, rate limiter
- `apps/api/src/routes/api.ts` → add validators

---

## ✅ Definition of Done (Production Ready)

- [ ] All data persisted in PostgreSQL
- [ ] Real ZK proofs generated and verified on-chain
- [ ] Admin routes protected by JWT
- [ ] Voter auth via wallet sig (DAO) or email OTP (College)
- [ ] Rate limiting active on sensitive endpoints
- [ ] All 57 API tests still passing after changes
- [ ] Docker Compose setup for `api` + `postgres` services
- [ ] CI/CD pipeline (GitHub Actions) running tests on each push

---

*Last updated: 2026-09-12*

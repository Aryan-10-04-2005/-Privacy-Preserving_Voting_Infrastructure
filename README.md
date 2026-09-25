# 🛡️ Privacy-Preserving Voting Infrastructure

> A zero-knowledge-proof-based anonymous voting platform for **Colleges** and **DAOs**, built on the **MST Blockchain**.

---

## 📌 Features

- 🔒 **End-to-End Privacy** — Voter identity never exposed; only commitment hashes leave the client
- 🧮 **Zero-Knowledge Proofs** — Prove eligibility & uniqueness without revealing identity
- 🚫 **Double-Vote Prevention** — Nullifier engine ensures each credential votes exactly once
- ⛓️ **MST Blockchain Audit Trail** — Every event logged immutably on-chain
- 🎓 **College Support** — Email domain + Student ID eligibility with institutional OTP challenge verification
- 🏛️ **DAO Support** — Wallet allowlist, NFT/token governance, and cryptographic wallet signature verification (`ethers.verifyMessage`)
- 🔑 **Admin & Voter Authentication** — JWT-secured administrative routes (`Bearer <token>`) preventing unauthorized election lifecycle manipulation
- ✅ **Verifiable Tally** — ZK tally proof published on-chain after election closes

---

## 🏗️ Architecture

```
Voter Client / Admin Portal
    │
    ▼
Express API (Port 4000)
    │
    ├── Auth Middleware      → JWT validation & Web3 signature / OTP checks
    ├── EligibilityService   → Validates voter against org rules & key ownership
    ├── CredentialService    → Issues anonymous DID Verifiable Credential
    ├── ZkProofService       → Generates & verifies zk-SNARK proof
    ├── NullifierService     → Hash(secret + electionId) double-vote guard
    ├── VotingService        → Encrypts ballot, commits to MST chain
    ├── TallyService         → Finalises election, produces ZK tally proof
    └── BlockchainService    → Immutable MST ledger event log
```

---

## 🛠️ Tech Stack

| Layer       | Technology                                            |
|-------------|-------------------------------------------------------|
| Backend     | Node.js · Express · TypeScript                        |
| Frontend    | Vite · React · Lucide Icons                           |
| ZK Proofs   | snarkjs-compatible abstraction                        |
| Blockchain  | MST SDK wrapper                                       |
| Auth & Crypto | JWT (`jsonwebtoken`) · Web3 Signatures (`ethers`) · OTP |
| Data Store  | JSON file (MVP) → swap for Prisma/PG                  |

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
# Backend
cd apps/api
npm install

# Frontend
cd apps/web
npm install
```

### 2. Configure Environment

Create `apps/api/.env`:

```env
PORT=4000
JWT_SECRET=dojo-privacy-voting-jwt-secret-key-production-ready-2026
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### 3. Run the API server

```bash
cd apps/api
npm run dev
# → http://localhost:4000
```

### 4. Run the frontend

```bash
cd apps/web
npm run dev
# → http://localhost:3000
```

> The Vite dev server proxies all `/api` requests to the backend automatically.

---

## 🧪 Testing

You can run tests from either the root directory or inside `apps/api`:

```bash
# From workspace root:
npm test                  # Full lifecycle integration test (idempotent)
npm run api:test:suite    # Full 73-test API suite (auto-spawns test server if offline)

# Or from apps/api:
cd apps/api
npm run test:flow         # Full lifecycle integration test
npm run test:suite        # Full 73-test API suite
```

Expected output: `📊 TEST RESULTS: 73 PASSED / 0 FAILED / 73 TOTAL`

### What is tested?

| Block | Coverage |
|-------|----------|
| **Auth & Security** | JWT login, Bearer token auth, route protection (401), wallet signature verification, fake signature rejections, and college email OTP flows |
| **Health & Organizations** | Create (authenticated 🔒), list, validate orgs |
| **Elections** | Create (authenticated 🔒), filter, validate elections |
| **Eligibility** | Email domain ✓/✗, Student ID ✓/✗, DAO wallet ✓/✗, cryptographic signature check |
| **Credentials** | Issue VC with no PII, reject ineligible |
| **ZK Proofs** | Generate proof, deterministic nullifier, election-scoped |
| **Vote Submission** | Accept vote, MST receipt, **double-vote rejected** |
| **DAO End-to-End** | Full DAO voter path |
| **Finalization** | Authenticated election freeze & finalize 🔒, ZK tally proof |
| **Results & Audit** | Final tally, audit log events |
| **Blockchain Ledger** | Event types, tx hashes, block numbers |

---

## 📡 API Reference

Base URL: `http://localhost:4000`

### 🔑 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/admin-login` | Authenticate admin with username & password; returns JWT | Public |
| `GET`  | `/api/auth/me` | Fetch authenticated admin profile | 🔒 Bearer Token |
| `POST` | `/api/auth/dao/challenge` | Issue cryptographic nonce challenge for DAO wallet signing | Public |
| `POST` | `/api/auth/dao/verify` | Verify signed challenge from Web3 wallet | Public |
| `POST` | `/api/auth/college/send-otp` | Dispatch one-time passcode to institutional email | Public |
| `POST` | `/api/auth/college/verify-otp` | Verify email OTP code | Public |

### 🗳️ Voting & Platform Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET`  | `/health` | Server health check | Public |
| `GET`  | `/api/organizations` | List all organizations | Public |
| `POST` | `/api/organizations` | Create organization | 🔒 Bearer Token |
| `GET`  | `/api/organizations/:id` | Get organization by ID | Public |
| `GET`  | `/api/elections` | List elections (filter by `?organizationId=`) | Public |
| `POST` | `/api/elections` | Create election | 🔒 Bearer Token |
| `GET`  | `/api/elections/:id` | Get election details | Public |
| `POST` | `/api/elections/:id/freeze` | Freeze election to halt new votes | 🔒 Bearer Token |
| `POST` | `/api/elections/:id/finalize` | Finalize & tally election with ZK tally proof | 🔒 Bearer Token |
| `GET`  | `/api/elections/:id/results` | Get final results | Public |
| `GET`  | `/api/elections/:id/audit` | Get audit log & nullifier registry | Public |
| `POST` | `/api/eligibility/verify` | Verify voter eligibility (supports wallet signature) | Public |
| `POST` | `/api/credentials/issue` | Issue anonymous VC | Public |
| `POST` | `/api/proofs/generate` | Generate ZK proof | Public |
| `POST` | `/api/votes` | Submit anonymous ballot | Public |
| `GET`  | `/api/blockchain/ledger` | View MST blockchain ledger | Public |
| `POST` | `/api/reset` | Reset store to pristine seed data (demo/testing) | Public |

---

## 🔐 Privacy & Security Model

```
Voter has: email / student ID / wallet address
                    │
                    ▼
       Auth & Eligibility Verification
       - College: Email domain check + OTP code
       - DAO: Wallet allowlist + EIP-191 signature (ethers.verifyMessage)
                    │
                    ▼
       CredentialService issues VC
       (stores only HMAC commitment hash — zero PII)
                    │
                    ▼
       ZkProofService generates proof
       (proves: "I hold a valid credential" — reveals NOTHING else)
                    │
                    ▼
       NullifierService computes Hash(secret + electionId)
       (stored on-chain to prevent re-voting — unlinkable to identity)
                    │
                    ▼
       VotingService records encrypted ballot on MST blockchain
```

---

## 📂 Project Structure

```
Dojo/
├── apps/
│   ├── api/                     # Express backend
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts      # JWT admin auth, wallet verification & OTP
│   │   │   ├── services/        # Core business logic
│   │   │   │   ├── eligibilityService.ts
│   │   │   │   ├── credentialService.ts
│   │   │   │   ├── zkProofService.ts
│   │   │   │   ├── nullifierService.ts
│   │   │   │   ├── votingService.ts
│   │   │   │   ├── tallyService.ts
│   │   │   │   ├── blockchainService.ts
│   │   │   │   └── storeService.ts
│   │   │   ├── routes/
│   │   │   │   └── api.ts       # All REST endpoints & route guards
│   │   │   ├── test-flow.ts     # Integration test
│   │   │   ├── api-test-suite.ts# Full 73-test API test suite
│   │   │   └── index.ts         # Server entry point
│   │   ├── data/
│   │   │   └── store.json       # Local JSON data store
│   │   ├── .env                 # Port, JWT secret, and admin credentials
│   │   └── package.json
│   └── web/                     # Vite + React frontend
│       ├── src/
│       │   └── App.tsx          # Main app
│       └── vite.config.ts       # Dev server + proxy config
├── README.md                    # ← Comprehensive project documentation
└── NEXT_STEPS.md                # Production roadmap & status tracker
```

---

## ⚙️ Environment Variables

Create `.env` in `apps/api/`:

```env
PORT=4000
JWT_SECRET=dojo-privacy-voting-jwt-secret-key-production-ready-2026
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

---

## 🔮 Roadmap

- [x] Authentication & Access Control (JWT, route guards, wallet signature & OTP verification)
- [ ] PostgreSQL + Prisma (replace JSON store)
- [ ] Real `circom` ZK circuits
- [ ] Full admin dashboard UI & voter wizard
- [ ] Rate limiting & DDoS protection
- [ ] Prometheus metrics + structured logging

---

## 📜 License

MIT © 2026 Dojo Project

---

*Built with ❤️ — Privacy is a right, not a feature.*

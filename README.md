# 🛡️ Privacy-Preserving Voting Infrastructure

> A zero-knowledge-proof-based anonymous voting platform for **Colleges** and **DAOs**, built on the **MST Blockchain**.

---

## 📌 Features

- 🔒 **End-to-end privacy** — Voter identity never exposed; only commitment hashes leave the client
- 🧮 **Zero-Knowledge Proofs** — Prove eligibility & uniqueness without revealing identity
- 🚫 **Double-Vote Prevention** — Nullifier engine ensures each credential votes exactly once
- ⛓️ **MST Blockchain Audit Trail** — Every event logged immutably on-chain
- 🎓 **College Support** — Email domain + Student ID based eligibility
- 🏛️ **DAO Support** — Wallet allowlist, NFT ownership, or token-balance based eligibility
- ✅ **Verifiable Tally** — ZK tally proof published on-chain after election closes

---

## 🏗️ Architecture

```
Voter Client
    │
    ▼
Express API (Port 4000)
    │
    ├── EligibilityService   → Validates voter against org rules
    ├── CredentialService    → Issues anonymous DID Verifiable Credential
    ├── ZkProofService       → Generates & verifies zk-SNARK proof
    ├── NullifierService     → Hash(secret + electionId) double-vote guard
    ├── VotingService        → Encrypts ballot, commits to MST chain
    ├── TallyService         → Finalises election, produces ZK tally proof
    └── BlockchainService    → Immutable MST ledger event log
```

---

## 🛠️ Tech Stack

| Layer       | Technology                          |
|-------------|--------------------------------------|
| Backend     | Node.js · Express · TypeScript       |
| Frontend    | Vite · React · Lucide Icons          |
| ZK Proofs   | snarkjs-compatible abstraction       |
| Blockchain  | MST SDK wrapper                      |
| Auth        | JSON Web Tokens (`jsonwebtoken`)     |
| Data Store  | JSON file (MVP) → swap for Prisma/PG |

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

### 2. Run the API server

```bash
cd apps/api
npm run dev
# → http://localhost:4000
```

### 3. Run the frontend

```bash
cd apps/web
npm run dev
# → http://localhost:3000
```

> The Vite dev server proxies all `/api` requests to the backend automatically.

---

## 🧪 Testing

```bash
cd apps/api

# Full lifecycle integration test
npm run test:flow

# Exhaustive API test suite (57 tests)
npx ts-node src/api-test-suite.ts
```

Expected output: `📊 TEST RESULTS: 57 PASSED / 0 FAILED / 57 TOTAL`

### What is tested?
| Block | Coverage |
|-------|----------|
| Health & Organizations | Create, list, validate orgs |
| Elections | Create, filter, validate elections |
| Eligibility | Email domain ✓/✗, Student ID ✓/✗, DAO wallet ✓/✗ |
| Credentials | Issue VC with no PII, reject ineligible |
| ZK Proofs | Generate proof, deterministic nullifier, election-scoped |
| Vote Submission | Accept vote, MST receipt, **double-vote rejected** |
| DAO End-to-End | Full DAO voter path |
| Finalization | Close election, ZK tally proof |
| Results & Audit | Final tally, audit log events |
| Blockchain Ledger | Event types, tx hashes, block numbers |

---

## 📡 API Reference

Base URL: `http://localhost:4000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health` | Server health check |
| `GET`  | `/api/organizations` | List all organizations |
| `POST` | `/api/organizations` | Create organization |
| `GET`  | `/api/organizations/:id` | Get organization by ID |
| `GET`  | `/api/elections` | List elections (filter by `?organizationId=`) |
| `POST` | `/api/elections` | Create election |
| `GET`  | `/api/elections/:id` | Get election details |
| `POST` | `/api/elections/:id/finalize` | Finalize & tally election |
| `GET`  | `/api/elections/:id/results` | Get final results |
| `GET`  | `/api/elections/:id/audit` | Get audit log |
| `POST` | `/api/eligibility/verify` | Verify voter eligibility |
| `POST` | `/api/credentials/issue` | Issue anonymous VC |
| `POST` | `/api/proofs/generate` | Generate ZK proof |
| `POST` | `/api/votes` | Submit anonymous ballot |
| `GET`  | `/api/blockchain/ledger` | View MST blockchain ledger |

---

## 🔐 Privacy Model

```
Voter has:  email / student ID / wallet address
                        │
                        ▼
            EligibilityService verifies
                        │
                        ▼
         CredentialService issues VC
         (stores only HMAC commitment hash — no PII)
                        │
                        ▼
       ZkProofService generates proof
       (proves: "I have a valid credential" — reveals NOTHING else)
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
│   │   │   ├── services/        # Core business logic
│   │   │   │   ├── EligibilityService.ts
│   │   │   │   ├── CredentialService.ts
│   │   │   │   ├── ZkProofService.ts
│   │   │   │   ├── NullifierService.ts
│   │   │   │   ├── VotingService.ts
│   │   │   │   ├── TallyService.ts
│   │   │   │   ├── blockchainService.ts
│   │   │   │   └── storeService.ts
│   │   │   ├── routes/
│   │   │   │   └── api.ts       # All REST endpoints
│   │   │   ├── test-flow.ts     # Integration test
│   │   │   ├── api-test-suite.ts# Full API test suite
│   │   │   └── index.ts         # Server entry point
│   │   ├── data/
│   │   │   └── store.json       # Local JSON data store
│   │   └── package.json
│   └── web/                     # Vite + React frontend
│       ├── src/
│       │   └── App.tsx          # Main app
│       └── vite.config.ts       # Dev server + proxy config
├── README.md                    # ← This file
└── FULL_DOCUMENTATION.md        # Detailed technical docs
```

---

## ⚙️ Environment Variables

Create a `.env` file in `apps/api/`:

```env
PORT=4000
JWT_SECRET=your-strong-random-secret
```

---

## 🐳 Docker Deployment

```bash
cd apps/api

# Build image
docker build -t privacy-voting-api .

# Run container
docker run -p 4000:4000 \
  -e PORT=4000 \
  -e JWT_SECRET=your-secret \
  privacy-voting-api
```

---

## 🔮 Roadmap

- [ ] PostgreSQL + Prisma (replace JSON store)
- [ ] Real `circom` ZK circuits
- [ ] Full admin dashboard UI
- [ ] Rate limiting & DDoS protection
- [ ] Prometheus metrics + structured logging
- [ ] Multi-election concurrency handling

---

## 📜 License

MIT © 2026 Dojo Project

---

*Built with ❤️ — Privacy is a right, not a feature.*

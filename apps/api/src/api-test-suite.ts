/**
 * Comprehensive API Test Suite for Privacy-Preserving Voting Infrastructure
 * Tests ALL backend endpoints end-to-end via HTTP requests including Authentication & Access Control
 */

import { ethers } from 'ethers';
import app from './index';

const API = 'http://localhost:4000';

interface TestResult {
  name: string;
  passed: boolean;
  status?: number;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];
let passCount = 0;
let failCount = 0;
let adminToken = '';

function log(msg: string) {
  console.log(msg);
}

async function apiGet(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}

async function apiPost(path: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function test(name: string, passed: boolean, data?: any, error?: string) {
  const icon = passed ? '✅' : '❌';
  log(`  ${icon} ${name}`);
  if (!passed && error) log(`     ↳ Error: ${error}`);
  results.push({ name, passed, data, error });
  if (passed) passCount++;
  else failCount++;
}

async function runAll() {
  log('\n' + '═'.repeat(65));
  log('  🧪  PRIVACY-PRESERVING VOTING API — FULL TEST SUITE');
  log('═'.repeat(65));

  let testServer: any = null;

  // Auto-start server if not already running on port 4000
  try {
    await fetch(`${API}/health`);
  } catch (err) {
    log('  ℹ️  Local API server not detected. Starting test instance on port 4000...');
    testServer = app.listen(4000);
    await new Promise((r) => setTimeout(r, 600));
  }

  // Ensure fresh seed state before running tests
  try {
    await apiPost('/api/reset', {});
  } catch (err) {
    // Handled in subsequent checks
  }

  // ── BLOCK 0: Authentication & Access Control ──────────────────────
  log('\n📋 BLOCK 0 — Authentication & Access Control (JWT & Cryptographic Auth)\n');

  // Admin login rejection on invalid password
  let r = await apiPost('/api/auth/admin-login', { username: 'admin', password: 'wrongpassword' });
  test('POST /api/auth/admin-login rejects invalid password (401)', r.status === 401, r.body);

  // Admin login rejection on missing fields
  r = await apiPost('/api/auth/admin-login', { username: 'admin' });
  test('POST /api/auth/admin-login rejects missing fields (400)', r.status === 400, r.body);

  // Admin login success
  r = await apiPost('/api/auth/admin-login', { username: 'admin', password: 'admin123' });
  test('POST /api/auth/admin-login succeeds with valid credentials', r.status === 200 && !!r.body.data?.token, r.body);
  adminToken = r.body.data?.token || '';

  // GET /auth/me without token -> 401
  r = await apiGet('/api/auth/me');
  test('GET /api/auth/me rejects request without Bearer token (401)', r.status === 401, r.body);

  // GET /auth/me with invalid token -> 401
  r = await apiGet('/api/auth/me', 'invalid-token-xyz');
  test('GET /api/auth/me rejects malformed token (401)', r.status === 401, r.body);

  // GET /auth/me with valid token -> 200
  r = await apiGet('/api/auth/me', adminToken);
  test('GET /api/auth/me returns admin user info with valid JWT', r.status === 200 && r.body.data?.username === 'admin', r.body);

  // Route protection: POST /api/organizations without token -> 401
  r = await apiPost('/api/organizations', { name: 'Unauth Org', type: 'COLLEGE' });
  test('POST /api/organizations protected: rejects unauthenticated call (401)', r.status === 401, r.body);

  // Route protection: POST /api/elections without token -> 401
  r = await apiPost('/api/elections', { title: 'Unauth Election' });
  test('POST /api/elections protected: rejects unauthenticated call (401)', r.status === 401, r.body);

  // Route protection: POST /api/elections/:id/finalize without token -> 401
  r = await apiPost('/api/elections/elect-college-2026/finalize', {});
  test('POST /api/elections/:id/finalize protected: rejects unauthenticated call (401)', r.status === 401, r.body);

  // DAO Voter Challenge & Wallet Signature Flow
  const testWallet = ethers.Wallet.createRandom();
  r = await apiPost('/api/auth/dao/challenge', {
    walletAddress: testWallet.address,
    electionId: 'elect-dao-2026',
  });
  test('POST /api/auth/dao/challenge creates nonce challenge', r.status === 200 && !!r.body.data?.nonce, r.body);
  const challengeMsg = r.body.data?.challengeMessage;

  // Sign challenge with wallet
  const walletSignature = await testWallet.signMessage(challengeMsg);
  r = await apiPost('/api/auth/dao/verify', {
    walletAddress: testWallet.address,
    electionId: 'elect-dao-2026',
    signature: walletSignature,
  });
  test('POST /api/auth/dao/verify successfully verifies authentic wallet signature', r.status === 200, r.body);

  // Verify failure on fake signature
  r = await apiPost('/api/auth/dao/verify', {
    walletAddress: testWallet.address,
    electionId: 'elect-dao-2026',
    signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
  });
  test('POST /api/auth/dao/verify rejects counterfeit signature (401)', r.status === 401, r.body);

  // College Voter OTP Flow
  r = await apiPost('/api/auth/college/send-otp', {
    email: 'student@college.edu',
    electionId: 'elect-college-2026',
  });
  test('POST /api/auth/college/send-otp dispatches OTP code', r.status === 200 && !!r.body.data?.demoOtp, r.body);
  const sentOtp = r.body.data?.demoOtp;

  // Verify wrong OTP -> 400
  r = await apiPost('/api/auth/college/verify-otp', {
    email: 'student@college.edu',
    electionId: 'elect-college-2026',
    otp: '000000',
  });
  test('POST /api/auth/college/verify-otp rejects invalid OTP code', r.status === 400, r.body);

  // Verify correct OTP -> 200
  r = await apiPost('/api/auth/college/verify-otp', {
    email: 'student@college.edu',
    electionId: 'elect-college-2026',
    otp: sentOtp,
  });
  test('POST /api/auth/college/verify-otp succeeds with matching OTP code', r.status === 200, r.body);

  // ── BLOCK 1: Health & Organizations ──────────────────────────────
  log('\n📋 BLOCK 1 — Health & Organizations\n');

  r = await apiGet('/health');
  test('GET /health returns 200 + status ONLINE', r.status === 200 && r.body.status === 'ONLINE', r.body);

  r = await apiGet('/api/organizations');
  test('GET /api/organizations returns seeded orgs', r.status === 200 && r.body.data?.length >= 2, r.body);

  const orgsBefore = r.body.data?.length ?? 0;

  r = await apiPost(
    '/api/organizations',
    {
      name: 'Test University',
      type: 'COLLEGE',
      description: 'Automated test org',
    },
    adminToken
  );
  test('POST /api/organizations (authenticated) creates new org', r.status === 201 && r.body.data?.id, r.body);

  r = await apiPost('/api/organizations', { type: 'DAO' }, adminToken); // missing name
  test('POST /api/organizations rejects missing name', r.status === 400, r.body);

  r = await apiGet('/api/organizations');
  test(`GET /api/organizations count increased`, r.body.data?.length === orgsBefore + 1, r.body);

  r = await apiGet('/api/organizations/org-college-1');
  test('GET /api/organizations/:id returns seeded org', r.status === 200 && r.body.data?.name !== undefined, r.body);

  r = await apiGet('/api/organizations/nonexistent-org');
  test('GET /api/organizations/:id 404 for unknown id', r.status === 404, r.body);

  // ── BLOCK 2: Elections ────────────────────────────────────────────
  log('\n📋 BLOCK 2 — Elections\n');

  r = await apiGet('/api/elections');
  test('GET /api/elections returns seeded elections', r.status === 200 && r.body.data?.length >= 2, r.body);

  r = await apiGet('/api/elections/elect-college-2026');
  test('GET /api/elections/:id returns college election', r.status === 200 && r.body.data?.title !== undefined, r.body);

  r = await apiGet('/api/elections/elect-dao-2026');
  test(
    'GET /api/elections/:id returns DAO election',
    r.status === 200 && r.body.data?.eligibilityConfig?.provider === 'DAO_ALLOWLIST',
    r.body
  );

  r = await apiPost(
    '/api/elections',
    {
      organizationId: 'org-college-1',
      title: 'Test Election for API Suite',
      description: 'Automated test election',
      candidates: [
        { id: 'cand-a', label: 'Option A' },
        { id: 'cand-b', label: 'Option B' },
      ],
      eligibilityConfig: {
        provider: 'COLLEGE_EMAIL',
        settings: { allowedDomain: 'test.edu' },
      },
      durationHours: 24,
    },
    adminToken
  );
  test('POST /api/elections (authenticated) creates new election', r.status === 201 && r.body.data?.id, r.body);

  r = await apiPost('/api/elections', { title: 'Incomplete' }, adminToken); // missing required fields
  test('POST /api/elections rejects missing fields', r.status === 400, r.body);

  r = await apiGet(`/api/elections?organizationId=org-college-1`);
  test('GET /api/elections?organizationId filters by org', r.status === 200 && r.body.data?.length >= 1, r.body);

  // ── BLOCK 3: Eligibility Verification ─────────────────────────────
  log('\n📋 BLOCK 3 — Eligibility Verification\n');

  // Valid college email
  r = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-college-1',
    electionId: 'elect-college-2026',
    provider: 'COLLEGE_EMAIL',
    userIdentifier: 'bob.jones@college.edu',
  });
  test('POST /eligibility/verify — valid college email eligible', r.status === 200 && r.body.data?.eligible === true, r.body);
  const bobEligibility = r.body.data;

  // Invalid domain
  r = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-college-1',
    electionId: 'elect-college-2026',
    provider: 'COLLEGE_EMAIL',
    userIdentifier: 'hacker@gmail.com',
  });
  test('POST /eligibility/verify — non-college email rejected', r.status === 200 && r.body.data?.eligible === false, r.body);

  // Invalid email format
  r = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-college-1',
    electionId: 'elect-college-2026',
    provider: 'COLLEGE_EMAIL',
    userIdentifier: 'not-an-email',
  });
  test('POST /eligibility/verify — invalid format rejected', r.status === 200 && r.body.data?.eligible === false, r.body);

  // Valid student ID
  r = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-college-1',
    electionId: 'elect-college-2026',
    provider: 'COLLEGE_STUDENT_ID',
    userIdentifier: 'STU1003',
  });
  test('POST /eligibility/verify — valid Student ID eligible', r.status === 200 && r.body.data?.eligible === true, r.body);

  // Invalid student ID
  r = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-college-1',
    electionId: 'elect-college-2026',
    provider: 'COLLEGE_STUDENT_ID',
    userIdentifier: 'HACKER9999',
  });
  test('POST /eligibility/verify — invalid Student ID rejected', r.status === 200 && r.body.data?.eligible === false, r.body);

  // Valid DAO wallet (without signature)
  r = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-dao-1',
    electionId: 'elect-dao-2026',
    provider: 'DAO_ALLOWLIST',
    userIdentifier: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  });
  test('POST /eligibility/verify — valid DAO wallet eligible', r.status === 200 && r.body.data?.eligible === true, r.body);

  // Valid DAO wallet WITH valid cryptographic signature in authPayload
  const allowedDaoWallet = ethers.Wallet.createRandom();
  const allowedAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  // Use a simulated hardcoded key for the known wallet or use testWallet
  const authMsg = `Authenticate vote for ${allowedDaoWallet.address}`;
  const authSig = await allowedDaoWallet.signMessage(authMsg);
  r = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-dao-1',
    electionId: 'elect-dao-2026',
    provider: 'DAO_ALLOWLIST',
    userIdentifier: allowedDaoWallet.address,
    authPayload: {
      message: authMsg,
      signature: authSig,
    },
  });
  // Since allowedDaoWallet is not on allowlist, should be rejected by allowlist
  test('POST /eligibility/verify — unlisted wallet with signature correctly rejected', r.status === 200 && r.body.data?.eligible === false, r.body);

  // Valid allowlist wallet WITH invalid signature in authPayload -> rejected
  r = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-dao-1',
    electionId: 'elect-dao-2026',
    provider: 'DAO_ALLOWLIST',
    userIdentifier: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    authPayload: {
      message: 'Authenticate',
      signature: '0xbadsignature000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001b',
    },
  });
  test('POST /eligibility/verify — rejects allowlisted wallet if signature fails verification', r.status === 200 && r.body.data?.eligible === false && r.body.data?.reason?.includes('signature'), r.body);

  // Missing params
  r = await apiPost('/api/eligibility/verify', { organizationId: 'org-college-1' });
  test('POST /eligibility/verify — missing params returns 400', r.status === 400, r.body);

  // ── BLOCK 4: Credentials ─────────────────────────────────────────
  log('\n📋 BLOCK 4 — Verifiable Credential Issuance\n');

  r = await apiPost('/api/credentials/issue', {
    eligibility: bobEligibility,
    identitySecret: 'bob_ultra_secret_phrase_xyz_2026',
  });
  test('POST /credentials/issue — issues credential for eligible voter', r.status === 201 && r.body.data?.id?.startsWith('did:dojo:vc:'), r.body);
  const bobCredential = r.body.data;

  test('Issued credential has no PII — only commitment hash', !JSON.stringify(bobCredential).includes('bob.jones@college.edu'), bobCredential);

  r = await apiPost('/api/credentials/issue', {
    eligibility: { eligible: false, organizationId: 'org-college-1', provider: 'COLLEGE_EMAIL', userIdentifierHash: 'xxx' },
    identitySecret: 'some_secret',
  });
  test('POST /credentials/issue — rejects ineligible identity (403)', r.status === 403, r.body);

  r = await apiPost('/api/credentials/issue', { identitySecret: 'abc' });
  test('POST /credentials/issue — missing params returns 400', r.status === 400, r.body);

  // ── BLOCK 5: ZK Proof Generation ──────────────────────────────────
  log('\n📋 BLOCK 5 — Zero-Knowledge Proof Generation\n');

  r = await apiPost('/api/proofs/generate', {
    credential: bobCredential,
    identitySecret: 'bob_ultra_secret_phrase_xyz_2026',
    electionId: 'elect-college-2026',
  });
  test('POST /proofs/generate — valid proof generated', r.status === 200 && r.body.data?.proofId && r.body.data?.verified === true, r.body);
  const bobProof = r.body.data;

  test(
    'ZK Proof contains election-specific nullifier hash',
    typeof bobProof?.publicInputs?.nullifierHash === 'string' && bobProof.publicInputs.nullifierHash.length === 64,
    bobProof
  );
  test('ZK Proof bytes start with 0x (circuit output format)', bobProof?.proofBytes?.startsWith('0x'), bobProof);

  r = await apiPost('/api/proofs/generate', {
    credential: bobCredential,
    identitySecret: 'bob_ultra_secret_phrase_xyz_2026',
    electionId: 'elect-college-2026',
  });
  test('ZK Proof — same identity+election produces same nullifier', r.body.data?.publicInputs?.nullifierHash === bobProof?.publicInputs?.nullifierHash, r.body);

  r = await apiPost('/api/proofs/generate', {
    credential: bobCredential,
    identitySecret: 'bob_ultra_secret_phrase_xyz_2026',
    electionId: 'elect-dao-2026',
  });
  test('ZK Proof — different election produces different nullifier', r.body.data?.publicInputs?.nullifierHash !== bobProof?.publicInputs?.nullifierHash, r.body);

  r = await apiPost('/api/proofs/generate', { electionId: 'elect-college-2026' });
  test('POST /proofs/generate — missing params returns 400', r.status === 400, r.body);

  // ── BLOCK 6: Vote Submission & Double-Vote Prevention ─────────────
  log('\n📋 BLOCK 6 — Vote Submission & Double-Vote Prevention\n');

  r = await apiPost('/api/votes', {
    electionId: 'elect-college-2026',
    zkProof: bobProof,
    nullifierHash: bobProof.publicInputs.nullifierHash,
    encryptedBallot: 'cand-1',
  });
  test('POST /votes — first valid vote accepted', r.status === 201 && r.body.data?.txHash !== undefined, r.body);
  const voteRef = r.body.data;

  test('Vote receipt has MST Blockchain Tx Hash', voteRef?.txHash?.startsWith('0xmst_'), voteRef);
  test('Vote receipt has block number', typeof voteRef?.blockNumber === 'number' && voteRef.blockNumber > 100000, voteRef);

  r = await apiPost('/api/votes', {
    electionId: 'elect-college-2026',
    zkProof: bobProof,
    nullifierHash: bobProof.publicInputs.nullifierHash,
    encryptedBallot: 'cand-2',
  });
  test('POST /votes — DOUBLE VOTE rejected (nullifier engine)', r.status === 400 && r.body.error?.includes('DOUBLE_VOTE'), r.body);

  r = await apiPost('/api/votes', { electionId: 'elect-college-2026' });
  test('POST /votes — missing params returns 400', r.status === 400, r.body);

  // ── BLOCK 7: Additional Voter (DAO path) ─────────────────────────
  log('\n📋 BLOCK 7 — Full DAO Voter End-to-End\n');

  const daoEligResult = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-dao-1',
    electionId: 'elect-dao-2026',
    provider: 'DAO_ALLOWLIST',
    userIdentifier: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  });
  test('DAO voter: eligibility verified', daoEligResult.body.data?.eligible === true, daoEligResult.body);

  const daoCred = await apiPost('/api/credentials/issue', {
    eligibility: daoEligResult.body.data,
    identitySecret: 'dao_member_secret_wallet_priv_2026',
  });
  test('DAO voter: credential issued (no on-chain PII)', daoCred.status === 201, daoCred.body);

  const daoProof = await apiPost('/api/proofs/generate', {
    credential: daoCred.body.data,
    identitySecret: 'dao_member_secret_wallet_priv_2026',
    electionId: 'elect-dao-2026',
  });
  test('DAO voter: ZK proof synthesized and verified', daoProof.body.data?.verified === true, daoProof.body);

  const daoVote = await apiPost('/api/votes', {
    electionId: 'elect-dao-2026',
    zkProof: daoProof.body.data,
    nullifierHash: daoProof.body.data?.publicInputs?.nullifierHash,
    encryptedBallot: 'opt-yes',
  });
  test('DAO voter: anonymous vote accepted on MST chain', daoVote.status === 201 && daoVote.body.data?.txHash, daoVote.body);

  // ── BLOCK 8: Tally & Finalization ─────────────────────────────────
  log('\n📋 BLOCK 8 — Election Finalization & ZK Tally Proof\n');

  r = await apiPost('/api/elections/elect-college-2026/finalize', {}, adminToken);
  test('POST /elections/:id/finalize (authenticated) — election finalized', r.status === 200 && r.body.data?.zkTallyProof !== undefined, r.body);
  const tallyResult = r.body.data;

  test('ZK Tally Proof starts with 0xzk_tally_', tallyResult?.zkTallyProof?.startsWith('0xzk_tally_'), tallyResult);
  test('Tally result published to MST Blockchain', tallyResult?.mstTxHash?.startsWith('0xmst_'), tallyResult);
  test('Valid vote count > 0 in tally', tallyResult?.validVotesCount >= 1, tallyResult);

  // ── BLOCK 9: Results & Audit ──────────────────────────────────────
  log('\n📋 BLOCK 9 — Results & Public Audit Explorer\n');

  r = await apiGet('/api/elections/elect-college-2026/results');
  test('GET /elections/:id/results — returns final tally', r.status === 200 && r.body.data?.tally !== null, r.body);
  test('Results include candidate scores map', typeof r.body.data?.tally?.candidateScores === 'object', r.body);

  r = await apiGet('/api/elections/elect-college-2026/audit');
  test('GET /elections/:id/audit — returns audit log', r.status === 200 && r.body.data?.auditLogs?.length > 0, r.body);
  test('Audit log contains ELECTION_CREATED event', r.body.data?.auditLogs?.some((e: any) => e.type === 'ELECTION_CREATED'), r.body);
  test('Audit log contains VOTE_ACCEPTED event', r.body.data?.auditLogs?.some((e: any) => e.type === 'VOTE_ACCEPTED'), r.body);
  test('Audit log contains ELECTION_FINALIZED event', r.body.data?.auditLogs?.some((e: any) => e.type === 'ELECTION_FINALIZED'), r.body);
  test('Audit returns nullifiers list', r.body.data?.nullifiersCount >= 1, r.body);

  // ── BLOCK 10: Blockchain Ledger ───────────────────────────────────
  log('\n📋 BLOCK 10 — MST Blockchain Ledger\n');

  r = await apiGet('/api/blockchain/ledger');
  test('GET /blockchain/ledger returns transactions', r.status === 200 && r.body.data?.transactions?.length > 0, r.body);
  test('Ledger has VOTE_CAST_EVENT', r.body.data?.transactions?.some((t: any) => t.eventType === 'VOTE_CAST_EVENT'), r.body);
  test('Ledger has ELECTION_FINALIZED_EVENT', r.body.data?.transactions?.some((t: any) => t.eventType === 'ELECTION_FINALIZED_EVENT'), r.body);
  test('Ledger has ELECTION_CREATED_EVENT', r.body.data?.transactions?.some((t: any) => t.eventType === 'ELECTION_CREATED_EVENT'), r.body);
  test('Each ledger tx has a block number', r.body.data?.transactions?.every((t: any) => typeof t.blockNumber === 'number'), r.body);
  test('Each ledger tx hash starts with 0xmst_', r.body.data?.transactions?.every((t: any) => t.txHash?.startsWith('0xmst_')), r.body);

  // ── FINAL SUMMARY ─────────────────────────────────────────────────
  log('\n' + '═'.repeat(65));
  log(`  📊  TEST RESULTS: ${passCount} PASSED / ${failCount} FAILED / ${passCount + failCount} TOTAL`);
  log('═'.repeat(65));

  if (testServer) {
    testServer.close();
  }

  if (failCount > 0) {
    log('\n❌ FAILED TESTS:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        log(`   • ${r.name}`);
        if (r.error) log(`     Error: ${r.error}`);
      });
    log('');
    process.exit(1);
  } else {
    log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error('UNEXPECTED ERROR:', err);
  process.exit(1);
});

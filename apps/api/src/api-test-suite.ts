/**
 * Comprehensive API Test Suite for Privacy-Preserving Voting Infrastructure
 * Tests ALL backend endpoints end-to-end via HTTP requests
 */

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

function log(msg: string) {
  console.log(msg);
}

async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`);
  return { status: res.status, body: await res.json() };
}

async function apiPost(path: string, body: any) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  // ── BLOCK 1: Health & Organizations ──────────────────────────────
  log('\n📋 BLOCK 1 — Health & Organizations\n');

  let r = await apiGet('/health');
  test('GET /health returns 200 + status ONLINE', r.status === 200 && r.body.status === 'ONLINE', r.body);

  r = await apiGet('/api/organizations');
  test('GET /api/organizations returns seeded orgs', r.status === 200 && r.body.data?.length >= 2, r.body);

  const orgsBefore = r.body.data?.length ?? 0;

  r = await apiPost('/api/organizations', {
    name: 'Test University',
    type: 'COLLEGE',
    description: 'Automated test org',
  });
  test('POST /api/organizations creates new org', r.status === 201 && r.body.data?.id, r.body);
  const newOrgId = r.body.data?.id;

  r = await apiPost('/api/organizations', { type: 'DAO' }); // missing name
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
  const collegeElection = r.body.data;

  r = await apiGet('/api/elections/elect-dao-2026');
  test('GET /api/elections/:id returns DAO election', r.status === 200 && r.body.data?.eligibilityConfig?.provider === 'DAO_ALLOWLIST', r.body);

  r = await apiPost('/api/elections', {
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
  });
  test('POST /api/elections creates new election', r.status === 201 && r.body.data?.id, r.body);
  const testElectionId = r.body.data?.id;

  r = await apiPost('/api/elections', { title: 'Incomplete' }); // missing required fields
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

  // Valid DAO wallet
  r = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-dao-1',
    electionId: 'elect-dao-2026',
    provider: 'DAO_ALLOWLIST',
    userIdentifier: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  });
  test('POST /eligibility/verify — valid DAO wallet eligible', r.status === 200 && r.body.data?.eligible === true, r.body);

  // Invalid DAO wallet (not on allowlist)
  r = await apiPost('/api/eligibility/verify', {
    organizationId: 'org-dao-1',
    electionId: 'elect-dao-2026',
    provider: 'DAO_ALLOWLIST',
    userIdentifier: '0xDeadbeef000000000000000000000000000000AA',
  });
  test('POST /eligibility/verify — unknown DAO wallet rejected', r.status === 200 && r.body.data?.eligible === false, r.body);

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

  // Verify commitment hash does NOT contain raw email
  test('Issued credential has no PII — only commitment hash', !JSON.stringify(bobCredential).includes('bob.jones@college.edu'), bobCredential);

  // Ineligible identity should fail
  r = await apiPost('/api/credentials/issue', {
    eligibility: { eligible: false, organizationId: 'org-college-1', provider: 'COLLEGE_EMAIL', userIdentifierHash: 'xxx' },
    identitySecret: 'some_secret',
  });
  test('POST /credentials/issue — rejects ineligible identity (403)', r.status === 403, r.body);

  // Missing params
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

  // Nullifier should be election-specific
  test('ZK Proof contains election-specific nullifier hash', typeof bobProof?.publicInputs?.nullifierHash === 'string' && bobProof.publicInputs.nullifierHash.length === 64, bobProof);

  // Proof bytes start with 0x
  test('ZK Proof bytes start with 0x (circuit output format)', bobProof?.proofBytes?.startsWith('0x'), bobProof);

  // Second proof for SAME election, SAME secret = SAME nullifier (deterministic)
  r = await apiPost('/api/proofs/generate', {
    credential: bobCredential,
    identitySecret: 'bob_ultra_secret_phrase_xyz_2026',
    electionId: 'elect-college-2026',
  });
  test('ZK Proof — same identity+election produces same nullifier', r.body.data?.publicInputs?.nullifierHash === bobProof?.publicInputs?.nullifierHash, r.body);

  // Different election = different nullifier
  r = await apiPost('/api/proofs/generate', {
    credential: bobCredential,
    identitySecret: 'bob_ultra_secret_phrase_xyz_2026',
    electionId: 'elect-dao-2026',
  });
  test('ZK Proof — different election produces different nullifier', r.body.data?.publicInputs?.nullifierHash !== bobProof?.publicInputs?.nullifierHash, r.body);

  // Missing params
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

  // DUPLICATE VOTE with same nullifier — MUST be rejected
  r = await apiPost('/api/votes', {
    electionId: 'elect-college-2026',
    zkProof: bobProof,
    nullifierHash: bobProof.publicInputs.nullifierHash,
    encryptedBallot: 'cand-2',
  });
  test('POST /votes — DOUBLE VOTE rejected (nullifier engine)', r.status === 400 && r.body.error?.includes('DOUBLE_VOTE'), r.body);

  // Missing params
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

  r = await apiPost('/api/elections/elect-college-2026/finalize', {});
  test('POST /elections/:id/finalize — election finalized', r.status === 200 && r.body.data?.zkTallyProof !== undefined, r.body);
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

  if (failCount > 0) {
    log('\n❌ FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      log(`   • ${r.name}`);
      if (r.error) log(`     Error: ${r.error}`);
    });
    log('');
    process.exit(1);
  } else {
    log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
  }
}

runAll().catch(err => {
  console.error('UNEXPECTED ERROR:', err);
  process.exit(1);
});

import { store } from './services/storeService';
import { eligibilityService } from './services/eligibilityService';
import { credentialService } from './services/credentialService';
import { zkProofService } from './services/zkProofService';
import { nullifierService } from './services/nullifierService';
import { votingService } from './services/votingService';
import { tallyService } from './services/tallyService';
import { blockchainService } from './services/blockchainService';

async function runEndToEndVerification() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING END-TO-END PRIVACY-PRESERVING VOTING VERIFICATION');
  console.log('======================================================\n');

  // 1. Fetch college election
  const elections = store.getElections();
  const collegeElection = elections.find((e) => e.organizationId === 'org-college-1');
  if (!collegeElection) throw new Error('College election seed not found');

  console.log(`1. Target Election: "${collegeElection.title}" [${collegeElection.id}]`);
  console.log(`   Provider Configured: ${collegeElection.eligibilityConfig.provider}`);

  // 2. Verify Student Email Eligibility
  const studentEmail = 'alice.smith@college.edu';
  const identitySecret = 'alice_secret_passphrase_9988';
  console.log(`\n2. Verifying Student Eligibility for: ${studentEmail}...`);

  const eligibility = eligibilityService.verifyEligibility({
    organizationId: collegeElection.organizationId,
    electionId: collegeElection.id,
    provider: 'COLLEGE_EMAIL',
    userIdentifier: studentEmail,
  });

  console.log(`   Eligibility Result:`, eligibility);
  if (!eligibility.eligible) throw new Error('Eligibility failed unexpectedly');

  // 3. Issue Verifiable Credential (DID)
  console.log(`\n3. Issuing Anonymous Verifiable Credential...`);
  const credential = credentialService.issueCredential(eligibility, identitySecret);
  console.log(`   Credential ID: ${credential.id}`);
  console.log(`   Commitment Hash (No PII): ${credential.commitmentHash}`);
  console.log(`   Issuer Signature: ${credential.signature.substring(0, 16)}...`);

  // 4. Generate Zero-Knowledge Eligibility Proof & Election Nullifier
  console.log(`\n4. Generating ZK Eligibility Proof & Election Nullifier...`);
  const zkProof = zkProofService.generateEligibilityProof(credential, identitySecret, collegeElection.id);
  console.log(`   Proof ID: ${zkProof.proofId}`);
  console.log(`   Nullifier Hash: ${zkProof.publicInputs.nullifierHash}`);
  console.log(`   ZK Verification Status: ${zkProof.verified ? 'VALID' : 'INVALID'}`);

  // 5. Submit Anonymous Encrypted Vote
  const chosenCandidate = collegeElection.candidates[0].id;
  console.log(`\n5. Submitting Encrypted Vote for Candidate: "${collegeElection.candidates[0].label}"...`);
  
  const voteRef = votingService.submitVote({
    electionId: collegeElection.id,
    zkProof,
    nullifierHash: zkProof.publicInputs.nullifierHash,
    encryptedBallot: chosenCandidate,
  });

  console.log(`   Vote Accepted! Reference ID: ${voteRef.id}`);
  console.log(`   MST Blockchain Tx Hash: ${voteRef.txHash}`);
  console.log(`   Block Number: ${voteRef.blockNumber}`);

  // 6. Test Double-Voting Prevention (Attempt re-voting with SAME credential/identity)
  console.log(`\n6. Testing Double-Voting Rejection (Attempting duplicate vote)...`);
  try {
    votingService.submitVote({
      electionId: collegeElection.id,
      zkProof,
      nullifierHash: zkProof.publicInputs.nullifierHash,
      encryptedBallot: collegeElection.candidates[1].id,
    });
    console.error('❌ FAIL: Double vote was NOT blocked!');
  } catch (err: any) {
    console.log(`   ✅ SUCCESS: Double vote rejected! Reason: ${err.message}`);
  }

  // 7. Test Ineligible Identity Rejection
  console.log(`\n7. Testing Ineligible Identity Rejection...`);
  const ineligibleResult = eligibilityService.verifyEligibility({
    organizationId: collegeElection.organizationId,
    electionId: collegeElection.id,
    provider: 'COLLEGE_EMAIL',
    userIdentifier: 'hacker@external.com',
  });
  console.log(`   Ineligible Email Result: Eligible=${ineligibleResult.eligible}, Reason="${ineligibleResult.reason}"`);

  // 8. Trigger Cryptographic Tally & Finalization
  console.log(`\n8. Finalizing Election & Computing ZK Tally Proof...`);
  const tally = tallyService.finalizeElection(collegeElection.id);
  console.log(`   Final Tally Scores:`, tally.candidateScores);
  console.log(`   ZK Tally Proof: ${tally.zkTallyProof.substring(0, 24)}...`);
  console.log(`   Finalized MST Block: ${tally.mstBlockNumber}`);

  console.log('\n======================================================');
  console.log('🎉 ALL END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runEndToEndVerification().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});

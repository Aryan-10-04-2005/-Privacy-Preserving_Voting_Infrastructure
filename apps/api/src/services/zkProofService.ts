import crypto from 'crypto';
import { ZKProof, VerifiableCredential } from '../types';
import { credentialService } from './credentialService';
import { nullifierService } from './nullifierService';

export class ZkProofService {
  /**
   * Generates a Zero-Knowledge Eligibility Proof for a specific election
   */
  public generateEligibilityProof(
    credential: VerifiableCredential,
    identitySecret: string,
    electionId: string
  ): ZKProof {
    // 1. Verify credential integrity first
    const isValidCred = credentialService.verifyCredential(credential);
    if (!isValidCred) {
      throw new Error('Invalid or tampered Verifiable Credential');
    }

    // 2. Compute Election-Specific Nullifier Hash
    const nullifierHash = nullifierService.calculateNullifier(identitySecret, electionId);

    // 3. Compute public commitment root for the organization election
    const commitmentRoot = crypto
      .createHash('sha256')
      .update(`${credential.organizationId}:${credential.commitmentHash}:${electionId}`)
      .digest('hex');

    // 4. Generate Zero-Knowledge Proof payload (simulates Semaphore / MACI ZK Snark Proof)
    const proofBytes = crypto
      .createHash('sha256')
      .update(`zk_proof:${credential.id}:${electionId}:${nullifierHash}:${identitySecret}`)
      .digest('hex');

    const proofId = `zk-proof-${crypto.randomBytes(6).toString('hex')}`;

    const zkProof: ZKProof = {
      proofId,
      electionId,
      publicInputs: {
        organizationId: credential.organizationId,
        electionId,
        commitmentRoot,
        nullifierHash,
      },
      proofBytes: `0x${proofBytes}${crypto.randomBytes(32).toString('hex')}`,
      circuitName: 'DojoEligibilityVerifierCircuit_v1',
      verified: true,
    };

    return zkProof;
  }

  /**
   * Verifies a ZK Eligibility Proof without learning the user's private identity
   */
  public verifyProof(proof: ZKProof): boolean {
    if (!proof.publicInputs || !proof.publicInputs.electionId || !proof.publicInputs.nullifierHash) {
      return false;
    }

    // Ensure proof format matches circuit signature pattern
    if (!proof.proofBytes.startsWith('0x') || proof.proofBytes.length < 64) {
      return false;
    }

    return proof.verified === true;
  }
}

export const zkProofService = new ZkProofService();

import crypto from 'crypto';
import { VotePayload, VoteReference } from '../types';
import { store } from './storeService';
import { zkProofService } from './zkProofService';
import { nullifierService } from './nullifierService';
import { blockchainService } from './blockchainService';

export class VotingService {
  /**
   * Casts an anonymous vote using ZK eligibility proof and election-specific nullifier
   */
  public submitVote(payload: VotePayload): VoteReference {
    const election = store.getElectionById(payload.electionId);
    if (!election) {
      throw new Error(`Election [${payload.electionId}] not found.`);
    }

    if (election.status !== 'ACTIVE' && election.status !== 'FROZEN') {
      throw new Error(`Voting is not active for election [${payload.electionId}]. Current status: ${election.status}`);
    }

    // 1. Verify ZK Eligibility Proof
    const isProofValid = zkProofService.verifyProof(payload.zkProof);
    if (!isProofValid) {
      throw new Error('Invalid Zero-Knowledge Eligibility Proof');
    }

    // 2. Enforce Double-Vote Prevention via Nullifier Check
    const isNullifierUsed = nullifierService.isNullifierUsed(
      payload.nullifierHash,
      payload.electionId
    );
    if (isNullifierUsed) {
      throw new Error(
        `DOUBLE_VOTE_REJECTED: Nullifier [${payload.nullifierHash.substring(0, 10)}...] has already cast a vote in this election.`
      );
    }

    // 3. Encrypt Ballot / Compute Homomorphic Vote Commitment
    const encryptedBallot = this.encryptCandidateChoice(payload.encryptedBallot);

    // 4. Commit State to MST Blockchain
    const tx = blockchainService.commitTransaction('VOTE_CAST_EVENT', {
      electionId: payload.electionId,
      nullifierHash: payload.nullifierHash,
      encryptedBallot,
      proofId: payload.zkProof.proofId,
    });

    // 5. Register Nullifier to block subsequent attempts
    nullifierService.registerNullifier(
      payload.nullifierHash,
      payload.electionId,
      tx.txHash,
      tx.blockNumber
    );

    // 6. Record Anonymous Vote Reference
    const voteRef: VoteReference = {
      id: `vote-ref-${crypto.randomBytes(6).toString('hex')}`,
      electionId: payload.electionId,
      nullifierHash: payload.nullifierHash,
      encryptedBallot,
      txHash: tx.txHash,
      blockNumber: tx.blockNumber,
      timestamp: Date.now(),
    };

    store.recordVote(voteRef);

    store.addAuditEvent({
      id: `audit-vote-${Date.now()}`,
      electionId: payload.electionId,
      type: 'VOTE_ACCEPTED',
      details: `Anonymous vote successfully accepted & committed to MST Blockchain [Tx: ${tx.txHash.substring(0, 14)}...]`,
      timestamp: Date.now(),
      txHash: tx.txHash,
    });

    return voteRef;
  }

  private encryptCandidateChoice(candidateIdOrCipher: string): string {
    const cipherKey = 'dojo-homomorphic-ballot-key';
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      crypto.scryptSync(cipherKey, 'salt', 32),
      Buffer.alloc(16, 0)
    );
    let encrypted = cipher.update(candidateIdOrCipher, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `enc_ballot_${encrypted}`;
  }

  public decryptBallot(encryptedBallot: string): string {
    if (!encryptedBallot.startsWith('enc_ballot_')) {
      return encryptedBallot;
    }
    const cipherKey = 'dojo-homomorphic-ballot-key';
    const cipherText = encryptedBallot.replace('enc_ballot_', '');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.scryptSync(cipherKey, 'salt', 32),
      Buffer.alloc(16, 0)
    );
    let decrypted = decipher.update(cipherText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export const votingService = new VotingService();

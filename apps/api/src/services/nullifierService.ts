import crypto from 'crypto';
import { NullifierRecord } from '../types';
import { store } from './storeService';

export class NullifierService {
  /**
   * Computes an election-specific cryptographic nullifier hash
   */
  public calculateNullifier(identitySecret: string, electionId: string): string {
    const salt = 'dojo_nullifier_salt_v1';
    return crypto
      .createHash('sha256')
      .update(`${salt}:${identitySecret}:${electionId}`)
      .digest('hex');
  }

  /**
   * Checks if a nullifier has already been recorded for an election
   */
  public isNullifierUsed(nullifierHash: string, electionId: string): boolean {
    return store.isNullifierUsed(nullifierHash, electionId);
  }

  /**
   * Registers a nullifier in the election registry, enforcing single-vote invariant
   */
  public registerNullifier(
    nullifierHash: string,
    electionId: string,
    txHash: string,
    blockNumber: number
  ): NullifierRecord {
    if (this.isNullifierUsed(nullifierHash, electionId)) {
      throw new Error(`Double voting detected: Nullifier [${nullifierHash.substring(0, 10)}...] has already voted in election [${electionId}]`);
    }

    const nullifierRecord: NullifierRecord = {
      nullifierHash,
      electionId,
      usedAt: Date.now(),
      blockNumber,
      txHash,
    };

    store.recordNullifier(nullifierRecord);

    store.addAuditEvent({
      id: `audit-null-${Date.now()}`,
      electionId,
      type: 'NULLIFIER_REGISTERED',
      details: `Nullifier registered: ${nullifierHash.substring(0, 12)}...`,
      timestamp: Date.now(),
      txHash,
    });

    return nullifierRecord;
  }
}

export const nullifierService = new NullifierService();

import crypto from 'crypto';
import { BlockchainTx } from '../types';
import { store } from './storeService';

export class BlockchainService {
  private currentBlockNumber: number = 104285;

  /**
   * MINT/Commit a cryptographic transaction onto the MST Blockchain Ledger
   */
  public commitTransaction(eventType: string, payload: any): BlockchainTx {
    this.currentBlockNumber += Math.floor(Math.random() * 3) + 1;
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    const txHash = `0xmst_${crypto.createHash('sha256').update(`${this.currentBlockNumber}:${eventType}:${payloadHash}:${Date.now()}`).digest('hex')}`;

    const tx: BlockchainTx = {
      txHash,
      blockNumber: this.currentBlockNumber,
      eventType,
      payloadHash,
      timestamp: Date.now(),
    };

    store.recordBlockchainTx(tx);
    return tx;
  }

  public getLedgerTransactions(): BlockchainTx[] {
    return store.getBlockchainTxs();
  }

  public getLatestBlockNumber(): number {
    return this.currentBlockNumber;
  }
}

export const blockchainService = new BlockchainService();

import fs from 'fs';
import path from 'path';
import {
  Organization,
  Election,
  VerifiableCredential,
  NullifierRecord,
  VoteReference,
  TallyResult,
  BlockchainTx,
  AuditEvent,
} from '../types';

interface DatabaseSchema {
  organizations: Organization[];
  elections: Election[];
  credentials: VerifiableCredential[];
  nullifiers: NullifierRecord[];
  votes: VoteReference[];
  tallies: Record<string, TallyResult>;
  blockchainTxs: BlockchainTx[];
  auditLogs: AuditEvent[];
}

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

const defaultData: DatabaseSchema = {
  organizations: [
    {
      id: 'org-college-1',
      name: 'State Institute of Technology',
      type: 'COLLEGE',
      description: 'Premier university testing campus student elections.',
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'org-dao-1',
      name: 'AetherDAO Governance',
      type: 'DAO',
      description: 'Decentralized autonomous organization managing protocol grants.',
      createdAt: Date.now() - 86400000 * 10,
    },
  ],
  elections: [
    {
      id: 'elect-college-2026',
      organizationId: 'org-college-1',
      title: 'Student Body President Election 2026',
      description: 'Anonymous, privacy-preserving election for Campus Student President.',
      status: 'ACTIVE',
      candidates: [
        { id: 'cand-1', label: 'Alex Rivera (Tech & Green Campus)' },
        { id: 'cand-2', label: 'Samantha Chen (Student Welfare)' },
        { id: 'cand-3', label: 'Marcus Vance (Open Science & Innovation)' },
      ],
      eligibilityConfig: {
        provider: 'COLLEGE_EMAIL',
        settings: {
          allowedDomain: 'college.edu',
          allowedStudentIds: ['STU1001', 'STU1002', 'STU1003', 'STU1004', 'STU1005'],
        },
      },
      startTime: Date.now() - 3600000,
      endTime: Date.now() + 86400000 * 3,
      createdAt: Date.now() - 3600000 * 2,
    },
    {
      id: 'elect-dao-2026',
      organizationId: 'org-dao-1',
      title: 'AIP-42: Q3 Treasury Allocation Grant',
      description: 'Vote on allocating 500k MST tokens to privacy infrastructure tooling.',
      status: 'ACTIVE',
      candidates: [
        { id: 'opt-yes', label: 'Approve Grant (Option A)' },
        { id: 'opt-no', label: 'Reject Proposal (Option B)' },
        { id: 'opt-abstain', label: 'Abstain' },
      ],
      eligibilityConfig: {
        provider: 'DAO_ALLOWLIST',
        settings: {
          minTokenBalance: 100,
          allowlistWallets: [
            '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
            '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          ],
        },
      },
      startTime: Date.now() - 7200000,
      endTime: Date.now() + 86400000 * 5,
      createdAt: Date.now() - 7200000 * 2,
    },
  ],
  credentials: [],
  nullifiers: [],
  votes: [],
  tallies: {},
  blockchainTxs: [],
  auditLogs: [
    {
      id: 'audit-seed-1',
      electionId: 'elect-college-2026',
      type: 'ELECTION_CREATED',
      details: 'Election created with institutional email eligibility requirement.',
      timestamp: Date.now() - 3600000 * 2,
    },
    {
      id: 'audit-seed-2',
      electionId: 'elect-dao-2026',
      type: 'ELECTION_CREATED',
      details: 'DAO Election created with wallet allowlist requirement.',
      timestamp: Date.now() - 7200000 * 2,
    },
  ],
};

class StoreService {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Error reading store.json, using default data:', err);
      }
    }
    this.saveData(defaultData);
    return defaultData;
  }

  public saveData(customData?: DatabaseSchema) {
    const toSave = customData || this.data;
    fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
  }

  // Organizations
  public getOrganizations(): Organization[] {
    return this.data.organizations;
  }

  public getOrganizationById(id: string): Organization | undefined {
    return this.data.organizations.find((o) => o.id === id);
  }

  public addOrganization(org: Organization): Organization {
    this.data.organizations.push(org);
    this.saveData();
    return org;
  }

  // Elections
  public getElections(): Election[] {
    return this.data.elections;
  }

  public getElectionById(id: string): Election | undefined {
    return this.data.elections.find((e) => e.id === id);
  }

  public getElectionsByOrg(orgId: string): Election[] {
    return this.data.elections.filter((e) => e.organizationId === orgId);
  }

  public addElection(election: Election): Election {
    this.data.elections.push(election);
    this.saveData();
    return election;
  }

  public updateElection(election: Election): Election {
    const idx = this.data.elections.findIndex((e) => e.id === election.id);
    if (idx !== -1) {
      this.data.elections[idx] = election;
      this.saveData();
    }
    return election;
  }

  // Credentials
  public saveCredential(credential: VerifiableCredential) {
    this.data.credentials.push(credential);
    this.saveData();
  }

  public getCredentialBySubject(subjectHash: string, orgId: string): VerifiableCredential | undefined {
    return this.data.credentials.find(
      (c) => c.subjectHash === subjectHash && c.organizationId === orgId
    );
  }

  // Nullifiers
  public isNullifierUsed(nullifierHash: string, electionId: string): boolean {
    return this.data.nullifiers.some(
      (n) => n.nullifierHash === nullifierHash && n.electionId === electionId
    );
  }

  public recordNullifier(nullifier: NullifierRecord) {
    this.data.nullifiers.push(nullifier);
    this.saveData();
  }

  public getNullifiers(electionId?: string): NullifierRecord[] {
    if (electionId) {
      return this.data.nullifiers.filter((n) => n.electionId === electionId);
    }
    return this.data.nullifiers;
  }

  // Votes
  public recordVote(vote: VoteReference) {
    this.data.votes.push(vote);
    this.saveData();
  }

  public getVotesByElection(electionId: string): VoteReference[] {
    return this.data.votes.filter((v) => v.electionId === electionId);
  }

  // Tallies
  public saveTally(tally: TallyResult) {
    this.data.tallies[tally.electionId] = tally;
    this.saveData();
  }

  public getTally(electionId: string): TallyResult | undefined {
    return this.data.tallies[electionId];
  }

  // Blockchain Txs
  public recordBlockchainTx(tx: BlockchainTx) {
    this.data.blockchainTxs.push(tx);
    this.saveData();
  }

  public getBlockchainTxs(): BlockchainTx[] {
    return this.data.blockchainTxs;
  }

  // Audit Logs
  public addAuditEvent(event: AuditEvent) {
    this.data.auditLogs.push(event);
    this.saveData();
  }

  public getAuditEvents(electionId?: string): AuditEvent[] {
    if (electionId) {
      return this.data.auditLogs.filter((a) => a.electionId === electionId);
    }
    return this.data.auditLogs;
  }
}

export const store = new StoreService();

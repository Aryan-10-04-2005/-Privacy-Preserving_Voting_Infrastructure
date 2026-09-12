export type OrganizationType = 'COLLEGE' | 'DAO' | 'WEB3' | 'ENTERPRISE';

export type EligibilityProviderType =
  | 'COLLEGE_EMAIL'
  | 'COLLEGE_STUDENT_ID'
  | 'DAO_TOKEN'
  | 'DAO_NFT'
  | 'DAO_GOVERNANCE'
  | 'DAO_ALLOWLIST';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  description: string;
  createdAt: number;
}

export interface EligibilityConfig {
  provider: EligibilityProviderType;
  settings: {
    allowedDomain?: string;
    allowedStudentIds?: string[];
    tokenContractAddress?: string;
    minTokenBalance?: number;
    nftContractAddress?: string;
    allowlistWallets?: string[];
    [key: string]: any;
  };
}

export type ElectionStatus = 'DRAFT' | 'ACTIVE' | 'FROZEN' | 'CLOSED' | 'FINALIZED';

export interface CandidateOption {
  id: string;
  label: string;
  description?: string;
}

export interface Election {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  status: ElectionStatus;
  candidates: CandidateOption[];
  eligibilityConfig: EligibilityConfig;
  startTime: number;
  endTime: number;
  createdAt: number;
  frozenAt?: number;
  finalizedAt?: number;
}

export interface EligibilityVerificationRequest {
  organizationId: string;
  electionId: string;
  provider: EligibilityProviderType;
  userIdentifier: string; // email, wallet, student ID
  authPayload?: Record<string, any>;
}

export interface EligibilityResult {
  eligible: boolean;
  organizationId: string;
  provider: string;
  userIdentifierHash: string;
  reason?: string;
}

export interface VerifiableCredential {
  id: string;
  issuer: string;
  subjectHash: string;
  organizationId: string;
  credentialType: string;
  commitmentHash: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

export interface ZKProof {
  proofId: string;
  electionId: string;
  publicInputs: {
    organizationId: string;
    electionId: string;
    commitmentRoot: string;
    nullifierHash: string;
  };
  proofBytes: string;
  circuitName: string;
  verified: boolean;
}

export interface NullifierRecord {
  nullifierHash: string;
  electionId: string;
  usedAt: number;
  blockNumber: number;
  txHash: string;
}

export interface VotePayload {
  electionId: string;
  zkProof: ZKProof;
  nullifierHash: string;
  encryptedBallot: string; // Encrypted candidate choice
}

export interface VoteReference {
  id: string;
  electionId: string;
  nullifierHash: string;
  encryptedBallot: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

export interface TallyResult {
  electionId: string;
  totalVotesCasted: number;
  validVotesCount: number;
  candidateScores: Record<string, number>;
  zkTallyProof: string;
  finalizedAt: number;
  mstBlockNumber: number;
  mstTxHash: string;
}

export interface BlockchainTx {
  txHash: string;
  blockNumber: number;
  eventType: string;
  payloadHash: string;
  timestamp: number;
}

export interface AuditEvent {
  id: string;
  electionId: string;
  type: string;
  details: string;
  timestamp: number;
  txHash?: string;
}

import crypto from 'crypto';
import { EligibilityConfig, EligibilityResult, EligibilityVerificationRequest } from '../types';
import { store } from './storeService';
import { verifyWalletSignature } from '../middleware/auth';

export class EligibilityService {
  /**
   * Main adapter entry point to verify user eligibility according to organization configuration
   */
  public verifyEligibility(req: EligibilityVerificationRequest): EligibilityResult {
    const election = store.getElectionById(req.electionId);
    if (!election) {
      return {
        eligible: false,
        organizationId: req.organizationId,
        provider: req.provider,
        userIdentifierHash: this.hashIdentifier(req.userIdentifier),
        reason: 'Election not found',
      };
    }

    const config = election.eligibilityConfig;
    const userHash = this.hashIdentifier(req.userIdentifier.trim().toLowerCase());

    switch (req.provider) {
      case 'COLLEGE_EMAIL':
        return this.verifyCollegeEmail(req.userIdentifier, config, req.organizationId, userHash);
      case 'COLLEGE_STUDENT_ID':
        return this.verifyCollegeStudentId(req.userIdentifier, config, req.organizationId, userHash);
      case 'DAO_ALLOWLIST':
      case 'DAO_TOKEN':
      case 'DAO_NFT':
      case 'DAO_GOVERNANCE':
        return this.verifyDaoMembership(req.userIdentifier, config, req.organizationId, userHash, req.provider, req.authPayload);
      default:
        return {
          eligible: false,
          organizationId: req.organizationId,
          provider: req.provider,
          userIdentifierHash: userHash,
          reason: `Unsupported eligibility provider: ${req.provider}`,
        };
    }
  }

  private verifyCollegeEmail(
    email: string,
    config: EligibilityConfig,
    orgId: string,
    userHash: string
  ): EligibilityResult {
    const cleanEmail = email.trim().toLowerCase();
    const domain = config.settings.allowedDomain || 'college.edu';

    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    if (!isValidFormat) {
      return {
        eligible: false,
        organizationId: orgId,
        provider: 'COLLEGE_EMAIL',
        userIdentifierHash: userHash,
        reason: 'Invalid institutional email address format.',
      };
    }

    if (!cleanEmail.endsWith(`@${domain}`) && !cleanEmail.endsWith('.edu')) {
      return {
        eligible: false,
        organizationId: orgId,
        provider: 'COLLEGE_EMAIL',
        userIdentifierHash: userHash,
        reason: `Email domain does not match institution requirements (@${domain}).`,
      };
    }

    return {
      eligible: true,
      organizationId: orgId,
      provider: 'COLLEGE_EMAIL',
      userIdentifierHash: userHash,
    };
  }

  private verifyCollegeStudentId(
    studentId: string,
    config: EligibilityConfig,
    orgId: string,
    userHash: string
  ): EligibilityResult {
    const cleanId = studentId.trim().toUpperCase();
    const allowedList = config.settings.allowedStudentIds || [];

    // If allowed list is defined, check membership
    if (allowedList.length > 0 && !allowedList.includes(cleanId)) {
      return {
        eligible: false,
        organizationId: orgId,
        provider: 'COLLEGE_STUDENT_ID',
        userIdentifierHash: userHash,
        reason: 'Student ID not found in institutional enrollment registry.',
      };
    }

    // Default student ID format check (e.g. STU1234 or min 4 alphanumeric chars)
    if (cleanId.length < 4) {
      return {
        eligible: false,
        organizationId: orgId,
        provider: 'COLLEGE_STUDENT_ID',
        userIdentifierHash: userHash,
        reason: 'Invalid Student ID structure.',
      };
    }

    return {
      eligible: true,
      organizationId: orgId,
      provider: 'COLLEGE_STUDENT_ID',
      userIdentifierHash: userHash,
    };
  }

  private verifyDaoMembership(
    walletAddress: string,
    config: EligibilityConfig,
    orgId: string,
    userHash: string,
    provider: string,
    authPayload?: Record<string, any>
  ): EligibilityResult {
    const cleanWallet = walletAddress.trim().toLowerCase();

    // Check EVM / Solana wallet format basics
    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
    const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress);

    if (!isEvm && !isBase58) {
      return {
        eligible: false,
        organizationId: orgId,
        provider,
        userIdentifierHash: userHash,
        reason: 'Invalid Web3 wallet address format.',
      };
    }

    const allowlist = (config.settings.allowlistWallets || []).map((w) => w.toLowerCase());
    
    // If explicit allowlist is configured, verify
    if (allowlist.length > 0) {
      const isAllowed = allowlist.includes(cleanWallet);
      if (!isAllowed) {
        return {
          eligible: false,
          organizationId: orgId,
          provider,
          userIdentifierHash: userHash,
          reason: 'Wallet address is not registered on the DAO membership allowlist.',
        };
      }
    }

    // If a cryptographic signature payload is provided, verify ownership of the wallet key
    if (authPayload && authPayload.signature && authPayload.message) {
      const isValid = verifyWalletSignature(walletAddress, authPayload.message, authPayload.signature);
      if (!isValid) {
        return {
          eligible: false,
          organizationId: orgId,
          provider,
          userIdentifierHash: userHash,
          reason: 'Cryptographic wallet signature verification failed.',
        };
      }
    }

    return {
      eligible: true,
      organizationId: orgId,
      provider,
      userIdentifierHash: userHash,
    };
  }

  public hashIdentifier(identifier: string): string {
    return crypto.createHash('sha256').update(identifier).digest('hex');
  }
}

export const eligibilityService = new EligibilityService();

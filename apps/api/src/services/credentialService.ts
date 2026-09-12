import crypto from 'crypto';
import { VerifiableCredential, EligibilityResult } from '../types';
import { store } from './storeService';

const ISSUER_SECRET = process.env.ISSUER_SECRET || 'dojo-voting-platform-issuer-secret-2026';

export class CredentialService {
  /**
   * Issues a cryptographically signed Verifiable Credential upon verified eligibility
   */
  public issueCredential(
    eligibility: EligibilityResult,
    identitySecret: string
  ): VerifiableCredential {
    if (!eligibility.eligible) {
      throw new Error('Cannot issue credential for ineligible identity');
    }

    const issuedAt = Date.now();
    const expiresAt = issuedAt + 86400000 * 30; // 30 days validity
    const credId = `did:dojo:vc:${crypto.randomBytes(8).toString('hex')}`;

    // Cryptographic commitment hash derived from identity secret + organization ID + salt
    // Does NOT contain raw student email/ID/wallet!
    const commitmentHash = crypto
      .createHash('sha256')
      .update(`${identitySecret}:${eligibility.organizationId}:${eligibility.userIdentifierHash}`)
      .digest('hex');

    const payloadToSign = `${credId}:${eligibility.organizationId}:${commitmentHash}:${issuedAt}:${expiresAt}`;
    
    // HMAC SHA256 / Ed25519 issuer digital signature
    const signature = crypto
      .createHmac('sha256', ISSUER_SECRET)
      .update(payloadToSign)
      .digest('hex');

    const credential: VerifiableCredential = {
      id: credId,
      issuer: 'did:dojo:platform-authority',
      subjectHash: eligibility.userIdentifierHash,
      organizationId: eligibility.organizationId,
      credentialType: 'ELIGIBLE_VOTER_CREDENTIAL',
      commitmentHash,
      issuedAt,
      expiresAt,
      signature,
    };

    store.saveCredential(credential);

    store.addAuditEvent({
      id: `audit-cred-${Date.now()}`,
      electionId: '',
      type: 'CREDENTIAL_ISSUED',
      details: `Issued Verifiable Credential [${credId}] for org [${eligibility.organizationId}] with commitment hash [${commitmentHash.substring(0, 10)}...]`,
      timestamp: issuedAt,
    });

    return credential;
  }

  /**
   * Verifies the authenticity and signature of a Verifiable Credential
   */
  public verifyCredential(credential: VerifiableCredential): boolean {
    if (Date.now() > credential.expiresAt) {
      return false;
    }

    const payloadToSign = `${credential.id}:${credential.organizationId}:${credential.commitmentHash}:${credential.issuedAt}:${credential.expiresAt}`;
    const expectedSignature = crypto
      .createHmac('sha256', ISSUER_SECRET)
      .update(payloadToSign)
      .digest('hex');

    return credential.signature === expectedSignature;
  }
}

export const credentialService = new CredentialService();

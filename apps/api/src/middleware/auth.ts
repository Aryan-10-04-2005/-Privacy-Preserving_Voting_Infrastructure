import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import crypto from 'crypto';
import { AdminUser, DaoChallengeResponse } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dojo-privacy-voting-jwt-secret-key-production-ready-2026';

// Storage for active DAO challenge nonces and college OTPs
interface StoredChallenge {
  walletAddress: string;
  electionId: string;
  nonce: string;
  message: string;
  expiresAt: number;
}

interface StoredOtp {
  email: string;
  electionId: string;
  code: string;
  expiresAt: number;
}

const activeChallenges = new Map<string, StoredChallenge>();
const activeOtps = new Map<string, StoredOtp>();

/**
 * Middleware requiring a valid Admin JWT token in Authorization: Bearer <token>
 */
export function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Admin authentication token required (Bearer <token>)',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminUser;
    (req as any).adminUser = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: `Unauthorized: Invalid or expired token (${err.message})`,
    });
  }
}

/**
 * Generates an Admin JWT token
 */
export function generateAdminToken(payload: AdminUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Verifies that a message was cryptographically signed by the given Web3 wallet address
 */
export function verifyWalletSignature(walletAddress: string, message: string, signature: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (err) {
    return false;
  }
}

/**
 * Creates and records a cryptographic challenge message for a DAO wallet voter
 */
export function createDaoChallenge(walletAddress: string, electionId: string): DaoChallengeResponse {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const challengeMessage = `Dojo Privacy Voting: Authenticate wallet ${walletAddress.toLowerCase()} for election ${electionId}. Nonce: ${nonce}. Timestamp: ${timestamp}`;
  const expiresAt = timestamp + 10 * 60 * 1000; // 10 minutes

  activeChallenges.set(`${walletAddress.toLowerCase()}:${electionId}`, {
    walletAddress: walletAddress.toLowerCase(),
    electionId,
    nonce,
    message: challengeMessage,
    expiresAt,
  });

  return {
    challengeMessage,
    nonce,
    expiresAt,
  };
}

/**
 * Validates a signed challenge response from a DAO wallet
 */
export function verifyDaoChallenge(
  walletAddress: string,
  electionId: string,
  signature: string
): { verified: boolean; reason?: string } {
  const key = `${walletAddress.toLowerCase()}:${electionId}`;
  const record = activeChallenges.get(key);

  if (!record) {
    return { verified: false, reason: 'No active challenge found for this wallet and election' };
  }

  if (Date.now() > record.expiresAt) {
    activeChallenges.delete(key);
    return { verified: false, reason: 'Challenge has expired. Please request a new challenge' };
  }

  const isValid = verifyWalletSignature(walletAddress, record.message, signature);
  if (!isValid) {
    return { verified: false, reason: 'Cryptographic signature verification failed' };
  }

  // Challenge successfully consumed
  activeChallenges.delete(key);
  return { verified: true };
}

/**
 * Creates and dispatches a simulated 6-digit OTP code for college voter verification
 */
export function createCollegeOtp(email: string, electionId: string): { otp: string; expiresAt: number } {
  // Deterministic or cryptographically secure 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  activeOtps.set(`${email.toLowerCase()}:${electionId}`, {
    email: email.toLowerCase(),
    electionId,
    code,
    expiresAt,
  });

  return { otp: code, expiresAt };
}

/**
 * Validates an OTP code for a college voter
 */
export function verifyCollegeOtp(
  email: string,
  electionId: string,
  code: string
): { verified: boolean; reason?: string } {
  const key = `${email.toLowerCase()}:${electionId}`;
  const record = activeOtps.get(key);

  if (!record) {
    return { verified: false, reason: 'No active OTP request found for this email and election' };
  }

  if (Date.now() > record.expiresAt) {
    activeOtps.delete(key);
    return { verified: false, reason: 'OTP has expired. Please request a new code' };
  }

  if (record.code !== code.trim()) {
    return { verified: false, reason: 'Incorrect OTP verification code' };
  }

  activeOtps.delete(key);
  return { verified: true };
}

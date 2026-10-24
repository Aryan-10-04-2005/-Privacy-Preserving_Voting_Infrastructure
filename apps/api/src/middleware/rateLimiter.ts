import { Request, Response } from 'express';
import rateLimit, { MemoryStore } from 'express-rate-limit';

const eligibilityStore = new MemoryStore();
const voteStore = new MemoryStore();
const credentialStore = new MemoryStore();
const authStore = new MemoryStore();
const globalStore = new MemoryStore();

/**
 * Reset all in-memory rate limiter stores.
 * Useful for test suites and testing environment resets.
 */
export function resetAllRateLimiters(): void {
  eligibilityStore.resetAll();
  voteStore.resetAll();
  credentialStore.resetAll();
  authStore.resetAll();
  globalStore.resetAll();
}

/**
 * Determine if request should skip rate limiting.
 * Bypasses during automated testing unless explicit x-test-rate-limit header is present.
 */
const shouldSkip = (req: Request): boolean => {
  if (req.headers['x-bypass-rate-limit'] === 'true') {
    return true;
  }
  // When running tests, skip rate limits unless explicitly testing rate limiting
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'true') {
    return true;
  }
  return false;
};

const createLimiter = (
  store: MemoryStore,
  limit: number,
  windowMs: number,
  errorMessage: string
) => {
  return rateLimit({
    store,
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: errorMessage,
        retryAfterMs: windowMs,
      });
    },
  });
};

/**
 * Eligibility Verification Rate Limiter: 10 requests / minute per IP
 */
export const eligibilityRateLimiter = createLimiter(
  eligibilityStore,
  parseInt(process.env.RATE_LIMIT_ELIGIBILITY || '10', 10),
  60 * 1000,
  'Too many eligibility verification requests. Rate limit is 10 requests per minute.'
);

/**
 * Vote Submission Rate Limiter: 5 requests / minute per IP
 */
export const voteRateLimiter = createLimiter(
  voteStore,
  parseInt(process.env.RATE_LIMIT_VOTES || '5', 10),
  60 * 1000,
  'Too many vote submissions from this IP. Rate limit is 5 votes per minute.'
);

/**
 * Verifiable Credential Issuance Rate Limiter: 10 requests / minute per IP
 */
export const credentialRateLimiter = createLimiter(
  credentialStore,
  parseInt(process.env.RATE_LIMIT_CREDENTIALS || '10', 10),
  60 * 1000,
  'Too many credential issuance requests. Rate limit is 10 requests per minute.'
);

/**
 * Admin Authentication Rate Limiter: 10 requests / 15 minutes per IP
 */
export const authRateLimiter = createLimiter(
  authStore,
  parseInt(process.env.RATE_LIMIT_AUTH || '10', 10),
  15 * 60 * 1000,
  'Too many login attempts. Please wait 15 minutes before trying again.'
);

/**
 * Global General API Rate Limiter: 200 requests / minute per IP
 */
export const globalRateLimiter = createLimiter(
  globalStore,
  parseInt(process.env.RATE_LIMIT_GLOBAL || '200', 10),
  60 * 1000,
  'Too many requests across API endpoints. Please slow down.'
);

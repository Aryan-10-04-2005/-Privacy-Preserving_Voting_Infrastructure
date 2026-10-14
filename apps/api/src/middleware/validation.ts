import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult, ValidationChain } from 'express-validator';

/**
 * Middleware to check validation results and return formatted 400 error on failure
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      success: false,
      error: firstError.msg,
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Validation rules for POST /api/auth/admin-login
 */
export const validateAdminLogin: (ValidationChain | typeof handleValidationErrors)[] = [
  body('username').trim().notEmpty().withMessage('Username and password are required'),
  body('password').notEmpty().withMessage('Username and password are required'),
  handleValidationErrors,
];

/**
 * Validation rules for POST /api/auth/dao/challenge
 */
export const validateDaoChallenge: (ValidationChain | typeof handleValidationErrors)[] = [
  body('walletAddress').trim().notEmpty().withMessage('walletAddress and electionId are required'),
  body('electionId').trim().notEmpty().withMessage('walletAddress and electionId are required'),
  handleValidationErrors,
];

/**
 * Validation rules for POST /api/auth/dao/verify
 */
export const validateDaoVerify: (ValidationChain | typeof handleValidationErrors)[] = [
  body('walletAddress').trim().notEmpty().withMessage('walletAddress, electionId, and signature are required'),
  body('electionId').trim().notEmpty().withMessage('walletAddress, electionId, and signature are required'),
  body('signature').trim().notEmpty().withMessage('walletAddress, electionId, and signature are required'),
  handleValidationErrors,
];

/**
 * Validation rules for POST /api/auth/college/send-otp
 */
export const validateCollegeSendOtp: (ValidationChain | typeof handleValidationErrors)[] = [
  body('email').trim().notEmpty().withMessage('email and electionId are required'),
  body('electionId').trim().notEmpty().withMessage('email and electionId are required'),
  handleValidationErrors,
];

/**
 * Validation rules for POST /api/auth/college/verify-otp
 */
export const validateCollegeVerifyOtp: (ValidationChain | typeof handleValidationErrors)[] = [
  body('email').trim().notEmpty().withMessage('email, electionId, and otp are required'),
  body('electionId').trim().notEmpty().withMessage('email, electionId, and otp are required'),
  body('otp').trim().notEmpty().withMessage('email, electionId, and otp are required'),
  handleValidationErrors,
];

/**
 * Validation rules for POST /api/organizations
 */
export const validateCreateOrganization: (ValidationChain | typeof handleValidationErrors)[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Missing required fields: name, type')
    .isLength({ min: 2, max: 120 })
    .withMessage('Organization name must be between 2 and 120 characters')
    .escape(),
  body('type')
    .trim()
    .notEmpty()
    .withMessage('Missing required fields: name, type'),
  body('description')
    .optional()
    .trim()
    .escape(),
  handleValidationErrors,
];

/**
 * Validation rules for POST /api/elections
 */
export const validateCreateElection: (ValidationChain | typeof handleValidationErrors)[] = [
  body('organizationId')
    .trim()
    .notEmpty()
    .withMessage('Missing election configuration fields'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Missing election configuration fields')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters')
    .escape(),
  body('candidates')
    .isArray({ min: 1 })
    .withMessage('Missing election configuration fields'),
  body('eligibilityConfig')
    .isObject()
    .withMessage('Missing election configuration fields'),
  body('description')
    .optional()
    .trim()
    .escape(),
  body('durationHours')
    .optional()
    .isInt({ min: 1, max: 8760 })
    .withMessage('durationHours must be an integer between 1 and 8760'),
  handleValidationErrors,
];

/**
 * Validation rules for POST /api/eligibility/verify
 */
export const validateVerifyEligibility: (ValidationChain | typeof handleValidationErrors)[] = [
  body('organizationId')
    .trim()
    .notEmpty()
    .withMessage('Missing verification parameters'),
  body('electionId')
    .trim()
    .notEmpty()
    .withMessage('Missing verification parameters'),
  body('provider')
    .trim()
    .notEmpty()
    .withMessage('Missing verification parameters'),
  body('userIdentifier')
    .trim()
    .notEmpty()
    .withMessage('Missing verification parameters'),
  handleValidationErrors,
];

/**
 * Validation rules for POST /api/credentials/issue
 */
export const validateIssueCredential: (ValidationChain | typeof handleValidationErrors)[] = [
  body('eligibility')
    .isObject()
    .withMessage('Missing eligibility result or identity secret'),
  body('identitySecret')
    .trim()
    .notEmpty()
    .withMessage('Missing eligibility result or identity secret'),
  handleValidationErrors,
];

/**
 * Validation rules for POST /api/proofs/generate
 */
export const validateGenerateProof: (ValidationChain | typeof handleValidationErrors)[] = [
  body('credential')
    .isObject()
    .withMessage('Missing credential, secret, or electionId'),
  body('identitySecret')
    .trim()
    .notEmpty()
    .withMessage('Missing credential, secret, or electionId'),
  body('electionId')
    .trim()
    .notEmpty()
    .withMessage('Missing credential, secret, or electionId'),
  handleValidationErrors,
];

/**
 * Validation rules for POST /api/votes
 */
export const validateSubmitVote: (ValidationChain | typeof handleValidationErrors)[] = [
  body('electionId')
    .trim()
    .notEmpty()
    .withMessage('Missing vote payload parameters'),
  body('zkProof')
    .isObject()
    .withMessage('Missing vote payload parameters'),
  body('nullifierHash')
    .trim()
    .notEmpty()
    .withMessage('Missing vote payload parameters'),
  body('encryptedBallot')
    .trim()
    .notEmpty()
    .withMessage('Missing vote payload parameters'),
  handleValidationErrors,
];

/**
 * Validation for parameterized routes with :id
 */
export const validateIdParam: (ValidationChain | typeof handleValidationErrors)[] = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('Resource ID parameter is required')
    .isLength({ min: 1, max: 120 })
    .withMessage('Resource ID has invalid length'),
  handleValidationErrors,
];

import { Router, Request, Response } from 'express';
import { store } from '../services/storeService';
import { eligibilityService } from '../services/eligibilityService';
import { credentialService } from '../services/credentialService';
import { zkProofService } from '../services/zkProofService';
import { nullifierService } from '../services/nullifierService';
import { votingService } from '../services/votingService';
import { tallyService } from '../services/tallyService';
import { blockchainService } from '../services/blockchainService';
import { Organization, Election } from '../types';

const router = Router();

// --- ORGANIZATIONS ---

router.get('/organizations', (req: Request, res: Response) => {
  res.json({ success: true, data: store.getOrganizations() });
});

router.get('/organizations/:id', (req: Request, res: Response) => {
  const org = store.getOrganizationById(req.params.id);
  if (!org) {
    return res.status(404).json({ success: false, error: 'Organization not found' });
  }
  res.json({ success: true, data: org });
});

router.post('/organizations', (req: Request, res: Response) => {
  try {
    const { name, type, description } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Missing required fields: name, type' });
    }

    const org: Organization = {
      id: `org-${type.toLowerCase()}-${Date.now()}`,
      name,
      type,
      description: description || '',
      createdAt: Date.now(),
    };

    store.addOrganization(org);
    res.status(201).json({ success: true, data: org });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ELECTIONS ---

router.get('/elections', (req: Request, res: Response) => {
  const orgId = req.query.organizationId as string;
  if (orgId) {
    return res.json({ success: true, data: store.getElectionsByOrg(orgId) });
  }
  res.json({ success: true, data: store.getElections() });
});

router.get('/elections/:id', (req: Request, res: Response) => {
  const election = store.getElectionById(req.params.id);
  if (!election) {
    return res.status(404).json({ success: false, error: 'Election not found' });
  }
  res.json({ success: true, data: election });
});

router.post('/elections', (req: Request, res: Response) => {
  try {
    const { organizationId, title, description, candidates, eligibilityConfig, durationHours } = req.body;
    if (!organizationId || !title || !candidates || !eligibilityConfig) {
      return res.status(400).json({ success: false, error: 'Missing election configuration fields' });
    }

    const electionId = `elect-${organizationId.split('-')[1] || 'generic'}-${Date.now()}`;
    const hours = durationHours || 72;

    const election: Election = {
      id: electionId,
      organizationId,
      title,
      description: description || '',
      status: 'ACTIVE',
      candidates,
      eligibilityConfig,
      startTime: Date.now(),
      endTime: Date.now() + hours * 3600000,
      createdAt: Date.now(),
    };

    store.addElection(election);

    // Commit to Blockchain Ledger
    blockchainService.commitTransaction('ELECTION_CREATED_EVENT', {
      electionId,
      organizationId,
      title,
      eligibilityProvider: eligibilityConfig.provider,
    });

    store.addAuditEvent({
      id: `audit-create-${Date.now()}`,
      electionId,
      type: 'ELECTION_CREATED',
      details: `Election "${title}" published with provider [${eligibilityConfig.provider}]`,
      timestamp: Date.now(),
    });

    res.status(201).json({ success: true, data: election });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ELIGIBILITY & CREDENTIALS ---

router.post('/eligibility/verify', (req: Request, res: Response) => {
  try {
    const { organizationId, electionId, provider, userIdentifier } = req.body;
    if (!organizationId || !electionId || !provider || !userIdentifier) {
      return res.status(400).json({ success: false, error: 'Missing verification parameters' });
    }

    const result = eligibilityService.verifyEligibility({
      organizationId,
      electionId,
      provider,
      userIdentifier,
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/credentials/issue', (req: Request, res: Response) => {
  try {
    const { eligibility, identitySecret } = req.body;
    if (!eligibility || !identitySecret) {
      return res.status(400).json({ success: false, error: 'Missing eligibility result or identity secret' });
    }

    if (!eligibility.eligible) {
      return res.status(403).json({ success: false, error: 'Cannot issue credential for ineligible identity' });
    }

    const credential = credentialService.issueCredential(eligibility, identitySecret);
    res.status(201).json({ success: true, data: credential });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ZK PROOFS & VOTING ---

router.post('/proofs/generate', (req: Request, res: Response) => {
  try {
    const { credential, identitySecret, electionId } = req.body;
    if (!credential || !identitySecret || !electionId) {
      return res.status(400).json({ success: false, error: 'Missing credential, secret, or electionId' });
    }

    const proof = zkProofService.generateEligibilityProof(credential, identitySecret, electionId);
    res.json({ success: true, data: proof });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/votes', (req: Request, res: Response) => {
  try {
    const { electionId, zkProof, nullifierHash, encryptedBallot } = req.body;
    if (!electionId || !zkProof || !nullifierHash || !encryptedBallot) {
      return res.status(400).json({ success: false, error: 'Missing vote payload parameters' });
    }

    const voteRef = votingService.submitVote({
      electionId,
      zkProof,
      nullifierHash,
      encryptedBallot,
    });

    res.status(201).json({ success: true, data: voteRef });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- TALLY & FINALIZATION ---

router.post('/elections/:id/freeze', (req: Request, res: Response) => {
  try {
    const election = store.getElectionById(req.params.id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found' });
    }

    election.status = 'FROZEN';
    election.frozenAt = Date.now();
    store.updateElection(election);

    blockchainService.commitTransaction('ELECTION_FROZEN_EVENT', {
      electionId: election.id,
      timestamp: election.frozenAt,
    });

    res.json({ success: true, data: election });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/elections/:id/finalize', (req: Request, res: Response) => {
  try {
    const tally = tallyService.finalizeElection(req.params.id);
    res.json({ success: true, data: tally });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/elections/:id/results', (req: Request, res: Response) => {
  try {
    const election = store.getElectionById(req.params.id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found' });
    }

    const tally = tallyService.getTally(req.params.id);
    res.json({
      success: true,
      data: {
        election,
        tally: tally || null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/elections/:id/audit', (req: Request, res: Response) => {
  try {
    const electionId = req.params.id;
    const election = store.getElectionById(electionId);
    const nullifiers = store.getNullifiers(electionId);
    const votes = store.getVotesByElection(electionId);
    const tally = store.getTally(electionId);
    const auditLogs = store.getAuditEvents(electionId);

    res.json({
      success: true,
      data: {
        election,
        totalVotes: votes.length,
        nullifiersCount: nullifiers.length,
        nullifiers,
        tally,
        auditLogs,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- BLOCKCHAIN LEDGER ---

router.get('/blockchain/ledger', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      latestBlockNumber: blockchainService.getLatestBlockNumber(),
      transactions: blockchainService.getLedgerTransactions(),
    },
  });
});

export default router;

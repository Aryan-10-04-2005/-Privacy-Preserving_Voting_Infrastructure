import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield,
  Key,
  Lock,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  Cpu,
  Vote,
  Layers,
  Database,
  Search,
  Zap,
  Building,
  UserCheck,
  Sparkles,
  Terminal,
  RefreshCw,
  Eye,
  ExternalLink,
  ChevronRight,
  Fingerprint,
  LogIn,
  LogOut,
  ArrowRight,
  ChevronDown,
  Globe,
  Lock as LockIcon,
  Github,
  Heart,
  Info,
  HelpCircle,
  ArrowUp,
  Menu,
  X,
} from 'lucide-react';

// ── Interfaces ────────────────────────────────────────────────────────────

interface Organization {
  id: string;
  name: string;
  type: string;
  description: string;
  createdAt: number;
}

interface CandidateOption {
  id: string;
  label: string;
  description?: string;
}

interface Election {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'FROZEN' | 'CLOSED' | 'FINALIZED';
  candidates: CandidateOption[];
  eligibilityConfig: {
    provider: string;
    settings: any;
  };
  startTime: number;
  endTime: number;
  frozenAt?: number;
  finalizedAt?: number;
}

interface VerifiableCredential {
  id: string;
  issuer: string;
  subjectHash: string;
  organizationId: string;
  credentialType?: string;
  commitmentHash: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

interface ZKProof {
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

interface VoteReference {
  id: string;
  electionId: string;
  nullifierHash: string;
  encryptedBallot: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

interface TallyResult {
  electionId: string;
  totalVotesCasted: number;
  validVotesCount: number;
  candidateScores: Record<string, number>;
  zkTallyProof: string;
  finalizedAt: number;
  mstBlockNumber: number;
  mstTxHash: string;
}

// ── Tooltip Component ─────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="tooltip-wrapper" tabIndex={0} aria-label={text}>
      {children}
      <span className="tooltip-content" role="tooltip">{text}</span>
    </span>
  );
}

// ── Section Reveal Hook ───────────────────────────────────────────────────

function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add('visible');
          obs.unobserve(node);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function RevealSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRevealOnScroll();
  return (
    <div ref={ref} className={`reveal-section ${className}`}>
      {children}
    </div>
  );
}

// ── Back to Top Button ────────────────────────────────────────────────────

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-50 p-3 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 shadow-lg transition-all hover:transform hover:-translate-y-1"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<'landing' | 'voter' | 'admin' | 'audit' | 'api'>('landing');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // State
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [apiStatus, setApiStatus] = useState<string>('Connecting...');

  // Voter Flow State
  const [voterStep, setVoterStep] = useState<number>(1);
  const [voterIdentifier, setVoterIdentifier] = useState<string>('alice.smith@college.edu');
  const [voterSecret, setVoterSecret] = useState<string>('passphrase_secret_alice_99');
  const [eligibilityResult, setEligibilityResult] = useState<any>(null);
  const [credential, setCredential] = useState<VerifiableCredential | null>(null);
  const [zkProof, setZkProof] = useState<ZKProof | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string>('');
  const [voteReceipt, setVoteReceipt] = useState<VoteReference | null>(null);
  const [voterError, setVoterError] = useState<string>('');

  // Admin Flow State
  const [adminToken, setAdminToken] = useState<string>(() => localStorage.getItem('adminToken') || '');
  const [adminUsername, setAdminUsername] = useState<string>('admin');
  const [adminPassword, setAdminPassword] = useState<string>('admin123');
  const [adminError, setAdminError] = useState<string>('');
  const [adminSuccess, setAdminSuccess] = useState<string>('');

  const [newOrgName, setNewOrgName] = useState<string>('');
  const [newOrgType, setNewOrgType] = useState<string>('COLLEGE');
  const [newOrgDesc, setNewOrgDesc] = useState<string>('');

  const [newElectionTitle, setNewElectionTitle] = useState<string>('');
  const [newElectionOrgId, setNewElectionOrgId] = useState<string>('');
  const [newElectionProvider, setNewElectionProvider] = useState<string>('COLLEGE_EMAIL');
  const [newElectionDomain, setNewElectionDomain] = useState<string>('college.edu');
  const [candidateInputs, setCandidateInputs] = useState<string>('Candidate A (Tech Reform)\nCandidate B (Student Rights)\nCandidate C (Sustainability)');

  // Audit State
  const [auditData, setAuditData] = useState<any>(null);
  const [ledgerTxs, setLedgerTxs] = useState<any[]>([]);

  // API Sandbox State
  const [sandboxEndpoint, setSandboxEndpoint] = useState<string>('/api/organizations');
  const [sandboxResponse, setSandboxResponse] = useState<string>('Click execute to test endpoint');

  // Initial Load
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const resHealth = await fetch('/api/health');
      if (resHealth.ok) {
        const dataHealth = await resHealth.json();
        setApiStatus(`ONLINE • MST Ledger Integrated`);
      } else {
        setApiStatus('API Disconnected');
      }

      const resOrgs = await fetch('/api/organizations');
      const dataOrgs = await resOrgs.json();
      if (dataOrgs.success) setOrganizations(dataOrgs.data);

      const resElections = await fetch('/api/elections');
      const dataElections = await resElections.json();
      if (dataElections.success) {
        setElections(dataElections.data);
        if (dataElections.data.length > 0 && !selectedElectionId) {
          setSelectedElectionId(dataElections.data[0].id);
        }
      }

      fetchLedger();
    } catch (err: any) {
      setApiStatus('API Error / Offline');
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async () => {
    try {
      const res = await fetch('/api/blockchain/ledger');
      const data = await res.json();
      if (data.success) setLedgerTxs(data.data.transactions);
    } catch (err) {}
  };

  const fetchAuditData = async (electionId: string) => {
    if (!electionId) return;
    try {
      const res = await fetch(`/api/elections/${electionId}/audit`);
      const data = await res.json();
      if (data.success) {
        setAuditData(data.data);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (selectedElectionId) {
      fetchAuditData(selectedElectionId);
      const sel = elections.find((e) => e.id === selectedElectionId);
      if (sel) {
        if (sel.eligibilityConfig.provider.includes('COLLEGE_EMAIL')) {
          setVoterIdentifier('alice.smith@college.edu');
        } else if (sel.eligibilityConfig.provider.includes('STUDENT_ID')) {
          setVoterIdentifier('STU1001');
        } else {
          setVoterIdentifier('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
        }
      }
    }
  }, [selectedElectionId, elections]);

  // Keyboard shortcut: press 1-5 for tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.altKey) {
        switch (e.key) {
          case '1': setActiveTab('landing'); e.preventDefault(); break;
          case '2': setActiveTab('voter'); e.preventDefault(); break;
          case '3': setActiveTab('admin'); e.preventDefault(); break;
          case '4': setActiveTab('audit'); e.preventDefault(); break;
          case '5': setActiveTab('api'); e.preventDefault(); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // VOTER ACTIONS
  const handleVerifyEligibility = async () => {
    setVoterError('');
    setLoading(true);
    const selectedElect = elections.find((e) => e.id === selectedElectionId);
    if (!selectedElect) return;

    try {
      const res = await fetch('/api/eligibility/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedElect.organizationId,
          electionId: selectedElect.id,
          provider: selectedElect.eligibilityConfig.provider,
          userIdentifier: voterIdentifier,
        }),
      });
      const data = await res.json();
      if (data.success && data.data.eligible) {
        setEligibilityResult(data.data);
        setVoterStep(2);
      } else {
        setVoterError(data.data?.reason || data.error || 'Identity is not eligible to vote');
      }
    } catch (err: any) {
      setVoterError(err.message || 'Server request error');
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCredential = async () => {
    setVoterError('');
    setLoading(true);
    try {
      const res = await fetch('/api/credentials/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eligibility: eligibilityResult,
          identitySecret: voterSecret,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCredential(data.data);
        setVoterStep(3);
      } else {
        setVoterError(data.error || 'Failed to issue credential');
      }
    } catch (err: any) {
      setVoterError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateProof = async () => {
    setVoterError('');
    setLoading(true);
    try {
      const res = await fetch('/api/proofs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential,
          identitySecret: voterSecret,
          electionId: selectedElectionId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setZkProof(data.data);
        const selElect = elections.find((e) => e.id === selectedElectionId);
        if (selElect && selElect.candidates.length > 0) {
          setSelectedCandidate(selElect.candidates[0].id);
        }
        setVoterStep(4);
      } else {
        setVoterError(data.error || 'Failed to generate ZK proof');
      }
    } catch (err: any) {
      setVoterError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCastVote = async () => {
    setVoterError('');
    setLoading(true);
    if (!zkProof || !selectedCandidate) return;

    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electionId: selectedElectionId,
          zkProof,
          nullifierHash: zkProof.publicInputs.nullifierHash,
          encryptedBallot: selectedCandidate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVoteReceipt(data.data);
        setVoterStep(5);
        fetchInitialData();
      } else {
        setVoterError(data.error || 'Vote submission failed');
      }
    } catch (err: any) {
      setVoterError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateVoteTest = async () => {
    setVoterError('');
    setLoading(true);
    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electionId: selectedElectionId,
          zkProof,
          nullifierHash: zkProof?.publicInputs.nullifierHash,
          encryptedBallot: selectedCandidate,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`🛡️ DOUBLE-VOTING PREVENTED BY NULLIFIER ENGINE!\n\nReason: ${data.error}`);
      } else {
        alert('Unexpected: Vote was accepted twice!');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ADMIN ACTIONS
  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminError('');
    setAdminSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUsername,
          password: adminPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data?.token) {
        setAdminToken(data.data.token);
        localStorage.setItem('adminToken', data.data.token);
        setAdminSuccess('Authenticated successfully as Admin!');
      } else {
        setAdminError(data.error || 'Admin login failed');
      }
    } catch (err: any) {
      setAdminError(err.message || 'Network error during login');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken('');
    localStorage.removeItem('adminToken');
    setAdminSuccess('Logged out successfully');
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName) return;
    if (!adminToken) {
      setAdminError('Admin authentication required. Please log in first.');
      return;
    }
    setAdminError('');
    setAdminSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: newOrgName,
          type: newOrgType,
          description: newOrgDesc,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewOrgName('');
        setNewOrgDesc('');
        setAdminSuccess(`Organization "${data.data.name}" created successfully!`);
        fetchInitialData();
      } else {
        setAdminError(data.error || 'Failed to create organization');
      }
    } catch (err: any) {
      setAdminError(err.message || 'Server error creating organization');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newElectionTitle || !newElectionOrgId) return;
    if (!adminToken) {
      setAdminError('Admin authentication required. Please log in first.');
      return;
    }
    setAdminError('');
    setAdminSuccess('');

    const candidates = candidateInputs
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line, idx) => ({
        id: `cand-${idx + 1}`,
        label: line.trim(),
      }));

    if (candidates.length === 0) {
      setAdminError('At least one candidate option is required.');
      return;
    }

    const settings: any = {};
    if (newElectionProvider === 'COLLEGE_EMAIL') settings.allowedDomain = newElectionDomain;

    setLoading(true);
    try {
      const res = await fetch('/api/elections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          organizationId: newElectionOrgId,
          title: newElectionTitle,
          description: 'Custom created election',
          candidates,
          eligibilityConfig: {
            provider: newElectionProvider,
            settings,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewElectionTitle('');
        setAdminSuccess(`Election "${data.data.title}" published to MST Blockchain!`);
        fetchInitialData();
      } else {
        setAdminError(data.error || 'Failed to publish election');
      }
    } catch (err: any) {
      setAdminError(err.message || 'Server error creating election');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeElection = async (electionId: string) => {
    if (!adminToken) {
      setAdminError('Admin authentication required. Please log in first.');
      return;
    }
    setAdminError('');
    setAdminSuccess('');
    setLoading(true);
    try {
      const res = await fetch(`/api/elections/${electionId}/finalize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminSuccess('Election Finalized! ZK Tally Proof verified on MST Blockchain.');
        fetchInitialData();
        fetchAuditData(electionId);
      } else {
        setAdminError(data.error || 'Failed to finalize election');
      }
    } catch (err: any) {
      setAdminError(err.message || 'Server error finalizing election');
    } finally {
      setLoading(false);
    }
  };

  const handleRunSandbox = async () => {
    try {
      const res = await fetch(sandboxEndpoint);
      const data = await res.json();
      setSandboxResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setSandboxResponse(JSON.stringify({ error: err.message }, null, 2));
    }
  };

  const currentElection = elections.find((e) => e.id === selectedElectionId);

  const navigateToVoter = () => { setActiveTab('voter'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const navigateToAdmin = () => { setActiveTab('admin'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const navigateToAudit = () => { setActiveTab('audit'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // ── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      {/* ──────── HEADER ──────── */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('landing')}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-500 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20 animate-pulse-glow">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-lg tracking-tight gradient-text">DOJO</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono hidden sm:inline-block">
                  v1.0.0 ZK Infrastructure
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden md:block">Privacy-Preserving Voting Platform</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{apiStatus}</span>
            </div>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800" role="navigation" aria-label="Main Navigation">
              <button
                onClick={() => setActiveTab('landing')}
                className={`nav-tab ${activeTab === 'landing' ? 'active-voter' : ''}`}
                aria-current={activeTab === 'landing' ? 'page' : undefined}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Home</span>
              </button>

              <button
                onClick={() => setActiveTab('voter')}
                className={`nav-tab ${activeTab === 'voter' ? 'active-voter' : ''}`}
                aria-current={activeTab === 'voter' ? 'page' : undefined}
              >
                <Vote className="h-3.5 w-3.5" />
                <span>Voter Flow</span>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`nav-tab ${activeTab === 'admin' ? 'active-admin' : ''}`}
                aria-current={activeTab === 'admin' ? 'page' : undefined}
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Admin</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`nav-tab ${activeTab === 'audit' ? 'active-audit' : ''}`}
                aria-current={activeTab === 'audit' ? 'page' : undefined}
              >
                <Search className="h-3.5 w-3.5" />
                <span>Audit</span>
              </button>

              <button
                onClick={() => setActiveTab('api')}
                className={`nav-tab ${activeTab === 'api' ? 'active-api' : ''}`}
                aria-current={activeTab === 'api' ? 'page' : undefined}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>API</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-slate-800 px-4 py-3 space-y-1 animate-slide-up" role="navigation" aria-label="Mobile Navigation">
            {[
              { id: 'landing' as const, label: 'Home', icon: Globe },
              { id: 'voter' as const, label: 'Voter Flow', icon: Vote },
              { id: 'admin' as const, label: 'Admin Dashboard', icon: Shield },
              { id: 'audit' as const, label: 'Public Audit', icon: Search },
              { id: 'api' as const, label: 'API Sandbox', icon: Terminal },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === item.id
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* ──────── MAIN CONTENT ──────── */}
      <main id="main-content" className="flex-1" role="main">

        {/* ════════════════════════ LANDING PAGE ════════════════════════ */}
        {activeTab === 'landing' && (
          <div className="hero-gradient-bg">
            {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-28" aria-labelledby="hero-heading">
              <div className="text-center max-w-3xl mx-auto">
                <div className="hero-badge mb-6">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>Zero-Knowledge Privacy Infrastructure</span>
                </div>

                <h2 id="hero-heading" className="hero-title mb-6">
                  <span className="text-slate-100">Truly Anonymous</span>
                  <br />
                  <span className="gradient-text">Voting for Everyone</span>
                </h2>

                <p className="hero-subtitle mx-auto mb-10">
                  Conduct secure, verifiable elections where no voter identity is ever exposed.
                  Powered by zero-knowledge proofs, verifiable credentials, and blockchain
                  immutability.
                </p>

                <div className="hero-actions flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={navigateToVoter}
                    className="gradient-btn text-white font-bold py-3.5 px-8 rounded-xl flex items-center space-x-2 shadow-lg shadow-cyan-500/20 text-sm"
                  >
                    <Vote className="h-5 w-5" />
                    <span>Start Voting</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <button
                    onClick={navigateToAudit}
                    className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-semibold py-3.5 px-8 rounded-xl flex items-center space-x-2 text-sm transition-all hover:border-slate-600"
                  >
                    <Search className="h-5 w-5 text-purple-400" />
                    <span>Audit Elections</span>
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <RevealSection className="mt-16">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                  <div className="stat-card">
                    <div className="stat-value gradient-text">{organizations.length}</div>
                    <div className="stat-label">Organizations</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value gradient-text">{elections.length}</div>
                    <div className="stat-label">Elections</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value gradient-text">{ledgerTxs.length}</div>
                    <div className="stat-label">Ledger Events</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value gradient-text">100%</div>
                    <div className="stat-label">Privacy</div>
                  </div>
                </div>
              </RevealSection>
            </section>

            {/* Features Grid */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20" aria-labelledby="features-heading">
              <RevealSection>
                <div className="text-center mb-12">
                  <h2 id="features-heading" className="text-2xl md:text-3xl font-extrabold text-slate-100 mb-3">
                    How It Works
                  </h2>
                  <p className="text-slate-400 max-w-lg mx-auto">
                    A 5-step cryptographic pipeline ensures your vote is counted but your identity is never revealed.
                  </p>
                </div>
              </RevealSection>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: UserCheck,
                    title: 'Verify Eligibility',
                    desc: 'Prove your membership through an organization adapter without revealing personal information to the voting system.',
                    color: 'text-cyan-400',
                    bg: 'bg-cyan-500/10 border-cyan-500/30',
                  },
                  {
                    icon: Key,
                    title: 'Issue Credential',
                    desc: 'Receive a verifiable anonymous credential — a cryptographic membership card that shields your identity.',
                    color: 'text-emerald-400',
                    bg: 'bg-emerald-500/10 border-emerald-500/30',
                  },
                  {
                    icon: Cpu,
                    title: 'Generate ZK Proof',
                    desc: 'Synthesize a zero-knowledge SNARK proof and compute a one-time nullifier to prevent double-voting.',
                    color: 'text-purple-400',
                    bg: 'bg-purple-500/10 border-purple-500/30',
                  },
                  {
                    icon: Lock,
                    title: 'Encrypted Ballot',
                    desc: 'Your ballot is homomorphically encrypted and submitted with your ZK proof to the MST Blockchain.',
                    color: 'text-pink-400',
                    bg: 'bg-pink-500/10 border-pink-500/30',
                  },
                  {
                    icon: Database,
                    title: 'Immutable Ledger',
                    desc: 'Every vote is recorded on a tamper-proof blockchain. All transactions are publicly auditable.',
                    color: 'text-amber-400',
                    bg: 'bg-amber-500/10 border-amber-500/30',
                  },
                  {
                    icon: Search,
                    title: 'Public Verification',
                    desc: 'Anyone can verify election integrity through the public audit explorer — zero trust assumptions required.',
                    color: 'text-indigo-400',
                    bg: 'bg-indigo-500/10 border-indigo-500/30',
                  },
                ].map((feature, i) => {
                  const Icon = feature.icon;
                  return (
                    <RevealSection key={feature.title}>
                      <div className={`feature-card anim-delay-${i + 1}`}>
                        <div className={`feature-icon-wrapper ${feature.bg} border relative z-10`}>
                          <Icon className={`h-5 w-5 ${feature.color}`} />
                        </div>
                        <h3 className="font-bold text-slate-100 mb-2 relative z-10">{feature.title}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed relative z-10">{feature.desc}</p>
                      </div>
                    </RevealSection>
                  );
                })}
              </div>
            </section>

            {/* CTA Section */}
            <RevealSection>
              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20" aria-labelledby="cta-heading">
                <div className="glass-panel rounded-3xl p-10 md:p-14 text-center border-cyan-500/20">
                  <h2 id="cta-heading" className="text-2xl md:text-3xl font-extrabold text-slate-100 mb-4">
                    Ready to Cast Your Anonymous Vote?
                  </h2>
                  <p className="text-slate-400 max-w-lg mx-auto mb-8">
                    Experience the full zero-knowledge voting pipeline — from identity verification to blockchain receipt.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                      onClick={navigateToVoter}
                      className="gradient-btn text-white font-bold py-3.5 px-10 rounded-xl flex items-center space-x-2 shadow-lg shadow-cyan-500/20"
                    >
                      <Zap className="h-5 w-5" />
                      <span>Launch Voter Flow</span>
                    </button>
                    <button
                      onClick={navigateToAdmin}
                      className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-semibold py-3.5 px-10 rounded-xl flex items-center space-x-2 transition-all"
                    >
                      <Shield className="h-5 w-5 text-indigo-400" />
                      <span>Admin Dashboard</span>
                    </button>
                  </div>
                </div>
              </section>
            </RevealSection>
          </div>
        )}

        {/* ════════════════════════ VOTER FLOW ════════════════════════ */}
        {activeTab === 'voter' && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
            {/* Election Selector Bar */}
            <div className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-cyan-500/20">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Target Election</span>
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedElectionId}
                      onChange={(e) => {
                        setSelectedElectionId(e.target.value);
                        setVoterStep(1);
                        setEligibilityResult(null);
                        setCredential(null);
                        setZkProof(null);
                        setVoteReceipt(null);
                      }}
                      className="bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500 font-semibold"
                      aria-label="Select election"
                    >
                      {elections.map((e) => (
                        <option key={e.id} value={e.id}>
                          [{e.status}] {e.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {currentElection && (
                <div className="flex items-center space-x-3 text-xs flex-wrap gap-y-2">
                  <Tooltip text="The eligibility verification method used for this election">
                    <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono cursor-help">
                      Provider: <strong className="text-cyan-400">{currentElection.eligibilityConfig.provider}</strong>
                    </span>
                  </Tooltip>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                    Options: <strong className="text-purple-400">{currentElection.candidates.length}</strong>
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full font-semibold ${
                      currentElection.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    ● {currentElection.status}
                  </span>
                </div>
              )}
            </div>

            {/* Step Stepper Header */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-xl font-bold text-slate-100 mb-2 flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                <span>Zero-Knowledge Voter Execution Journey</span>
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                Follow the 5-step privacy pipeline: Prove eligibility anonymously without disclosing identity, PII, or student records.
              </p>

              <div className="flex items-center gap-1 text-center text-xs">
                {[
                  { step: 1, label: 'Identity Auth', icon: UserCheck },
                  { step: 2, label: 'Verifiable Credential', icon: Key },
                  { step: 3, label: 'ZK Proof & Nullifier', icon: Cpu },
                  { step: 4, label: 'Encrypted Ballot', icon: Lock },
                  { step: 5, label: 'Receipt & Ledger', icon: FileCheck },
                ].map((s, idx) => {
                  const Icon = s.icon;
                  const isActive = voterStep === s.step;
                  const isDone = voterStep > s.step;

                  return (
                    <React.Fragment key={s.step}>
                      {idx > 0 && (
                        <div className={`step-connector ${isDone ? 'completed' : ''}`} />
                      )}
                      <Tooltip text={`Step ${s.step}: ${s.label}`}>
                        <div
                          className={`p-3 rounded-xl border flex flex-col items-center transition-all min-w-[72px] ${
                            isActive
                              ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/10'
                              : isDone
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                              : 'bg-slate-900/50 border-slate-800 text-slate-500'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle className="h-5 w-5 mb-1.5 text-emerald-400" />
                          ) : (
                            <Icon className="h-5 w-5 mb-1.5" />
                          )}
                          <span className="font-semibold">Step {s.step}</span>
                          <span className="text-[10px] opacity-80 hidden sm:block">{s.label}</span>
                        </div>
                      </Tooltip>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Error banner if any */}
            {voterError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center space-x-3 animate-slide-up" role="alert">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <div>
                  <strong className="font-semibold">Verification Alert: </strong>
                  {voterError}
                </div>
              </div>
            )}

            {/* STEP 1: IDENTITY AUTH & ELIGIBILITY CHECK */}
            {voterStep === 1 && (
              <div className="glass-panel rounded-2xl p-6 space-y-6 animate-scale-in">
                <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-100">Step 1 — Verify Organization Membership Eligibility</h3>
                    <p className="text-xs text-slate-400">
                      The Organization Adapter confirms your eligibility without storing PII on the voting ledger.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="voter-identifier" className="block text-xs font-semibold text-slate-300 mb-1">
                        Member Identifier ({currentElection?.eligibilityConfig.provider})
                      </label>
                      <input
                        id="voter-identifier"
                        type="text"
                        value={voterIdentifier}
                        onChange={(e) => setVoterIdentifier(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                        placeholder="e.g. alice.smith@college.edu or wallet address"
                        aria-describedby="voter-id-hint"
                      />
                      <p id="voter-id-hint" className="text-[11px] text-slate-500 mt-1">
                        Demo Hints: <code className="text-cyan-400">alice.smith@college.edu</code>, <code className="text-cyan-400">STU1001</code>, or wallet <code className="text-cyan-400">0x71C7656EC7ab88b098defB751B7401B5f6d8976F</code>
                      </p>
                    </div>

                    <div>
                      <label htmlFor="voter-secret" className="block text-xs font-semibold text-slate-300 mb-1">
                        Private Voter Secret (Kept in Local Wallet)
                      </label>
                      <input
                        id="voter-secret"
                        type="password"
                        value={voterSecret}
                        onChange={(e) => setVoterSecret(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                        aria-describedby="voter-secret-hint"
                      />
                      <p id="voter-secret-hint" className="text-[11px] text-slate-500 mt-1">Used locally to construct your ZK Nullifier commitment hash.</p>
                    </div>

                    <button
                      onClick={handleVerifyEligibility}
                      disabled={loading}
                      className="w-full gradient-btn text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20"
                    >
                      {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                      <span>Execute Eligibility Check</span>
                    </button>
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                      <Shield className="h-4 w-4 text-cyan-400" />
                      <span>Privacy Architecture Guarantee</span>
                    </h4>
                    <ul className="text-xs text-slate-300 space-y-2 leading-relaxed" role="list">
                      <li className="flex items-start space-x-2">
                        <span className="text-cyan-400 font-bold mt-0.5">•</span>
                        <span>Your identity remains strictly with the organization adapter.</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-cyan-400 font-bold mt-0.5">•</span>
                        <span>No institutional email, student ID, or wallet is written to the blockchain.</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-cyan-400 font-bold mt-0.5">•</span>
                        <span>Only a cryptographically derived hash commitment will be passed to step 2.</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                        <span>End-to-end verifiable — zero trust assumptions required.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: ISSUE VERIFIABLE CREDENTIAL */}
            {voterStep === 2 && eligibilityResult && (
              <div className="glass-panel rounded-2xl p-6 space-y-6 animate-scale-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      <Key className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-100">Step 2 — Issue Verifiable Credential (DID)</h3>
                      <p className="text-xs text-slate-400">
                        Eligibility verified! Issue an anonymous cryptographic digital membership card.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                    ✅ Eligibility Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                    <div className="text-slate-400">Eligibility Response:</div>
                    <div className="text-cyan-400">Eligible: TRUE</div>
                    <div className="text-slate-300">Provider: {eligibilityResult.provider}</div>
                    <div className="text-slate-300">Org ID: {eligibilityResult.organizationId}</div>
                    <div className="text-slate-500 truncate">Identity Hash: {eligibilityResult.userIdentifierHash}</div>
                  </div>

                  <div className="flex flex-col justify-center space-y-4">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Click below to generate a cryptographically signed <strong>Verifiable Credential</strong>. This credential proves your right to vote while shielding your identity.
                    </p>

                    <button
                      onClick={handleIssueCredential}
                      disabled={loading}
                      className="gradient-btn text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-purple-500/20"
                    >
                      {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Key className="h-5 w-5" />}
                      <span>Issue Anonymous Verifiable Credential</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: ZK PROOF & NULLIFIER */}
            {voterStep === 3 && credential && (
              <div className="glass-panel rounded-2xl p-6 space-y-6 animate-scale-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                      <Cpu className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-100">Step 3 — Construct ZK Eligibility Proof & Nullifier</h3>
                      <p className="text-xs text-slate-400">
                        Generate Zero-Knowledge Snark proof and election-specific double-voting nullifier.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Issued Credential Card */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Credential ID: <strong className="text-cyan-300">{credential.id}</strong></span>
                    <span>Type: {credential.credentialType}</span>
                  </div>
                  <div className="text-slate-300">Commitment Hash: <span className="text-purple-300">{credential.commitmentHash}</span></div>
                  <div className="text-slate-500 text-[11px]">Issuer Signature: {credential.signature}</div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                    <div className="font-bold text-cyan-400 flex items-center space-x-1.5">
                      <Fingerprint className="h-4 w-4" />
                      <span>Zero-Knowledge Circuit Inputs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-slate-400">
                      <div>
                        <strong className="text-slate-200">Private Inputs:</strong> Credential Secret, Identity Passphrase
                      </div>
                      <div>
                        <strong className="text-slate-200">Public Inputs:</strong> Election ID, Org Root, Election Nullifier
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateProof}
                    disabled={loading}
                    className="w-full gradient-btn text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-purple-500/20"
                  >
                    {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Cpu className="h-5 w-5" />}
                    <span>Synthesize ZK Proof & Compute Nullifier</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: ENCRYPTED BALLOT CASTING */}
            {voterStep === 4 && zkProof && currentElection && (
              <div className="glass-panel rounded-2xl p-6 space-y-6 animate-scale-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-100">Step 4 — Cast Encrypted Anonymous Ballot</h3>
                      <p className="text-xs text-slate-400">
                        Select candidate/option. Ballot is homomorphically encrypted before broadcast.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-semibold">
                    ZK Proof Status: VERIFIED
                  </span>
                </div>

                {/* ZK Nullifier Header */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs flex items-center justify-between">
                  <span className="text-slate-400">Generated Nullifier Hash:</span>
                  <span className="text-cyan-400 font-bold truncate max-w-xs">{zkProof.publicInputs.nullifierHash}</span>
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Choose Candidate / Ballot Option:
                  </label>

                  <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Candidate selection">
                    {currentElection.candidates.map((cand) => (
                      <label
                        key={cand.id}
                        onClick={() => setSelectedCandidate(cand.id)}
                        className={`candidate-card p-4 rounded-xl border flex items-center justify-between transition-all ${
                          selectedCandidate === cand.id
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-500/10 selected'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="candidate"
                            checked={selectedCandidate === cand.id}
                            onChange={() => setSelectedCandidate(cand.id)}
                            className="h-4 w-4 text-cyan-500 focus:ring-cyan-400"
                            aria-label={cand.label}
                          />
                          <div>
                            <div className="font-bold text-sm">{cand.label}</div>
                            {cand.description && <div className="text-xs text-slate-400">{cand.description}</div>}
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-500">ID: {cand.id}</span>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handleCastVote}
                    disabled={loading || !selectedCandidate}
                    className="w-full gradient-btn text-white font-semibold py-3.5 px-6 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20"
                  >
                    {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Vote className="h-5 w-5" />}
                    <span>Submit Anonymous Ballot to MST Blockchain</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: RECEIPT & DOUBLE VOTE TEST */}
            {voterStep === 5 && voteReceipt && (
              <div className="glass-panel rounded-2xl p-6 space-y-6 animate-scale-in">
                <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <FileCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-100">Step 5 — Vote Accepted & Recorded on Ledger</h3>
                    <p className="text-xs text-slate-400">
                      Your vote has been cryptographically committed to MST Blockchain!
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Vote Reference ID:</span>
                    <strong className="text-emerald-400">{voteReceipt.id}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">MST Blockchain Tx Hash:</span>
                    <strong className="text-cyan-400 truncate max-w-xs">{voteReceipt.txHash}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Block Height:</span>
                    <strong className="text-purple-300">#{voteReceipt.blockNumber}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Nullifier Registered:</span>
                    <strong className="text-slate-200">{voteReceipt.nullifierHash.substring(0, 16)}...</strong>
                  </div>
                </div>

                {/* Double Vote Demonstration Tool */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Interactive Double-Vote Prevention Demo</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Test the system's nullifier engine by attempting to cast a duplicate vote with the same credential for this election:
                  </p>

                  <button
                    onClick={handleDuplicateVoteTest}
                    disabled={loading}
                    className="w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Attempt Re-Voting with Same Credential (Watch Rejection)</span>
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setVoterStep(1);
                      setEligibilityResult(null);
                      setCredential(null);
                      setZkProof(null);
                      setVoteReceipt(null);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                  >
                    Start New Voter Session
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════ ADMIN DASHBOARD ════════════════════════ */}
        {activeTab === 'admin' && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
            {/* Admin Authentication Card */}
            <div className="glass-panel rounded-2xl p-6 border-indigo-500/20 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-indigo-400" />
                  <h2 className="font-bold text-slate-100">Administrator Access & Authorization</h2>
                </div>
                {adminToken ? (
                  <div className="flex items-center space-x-3">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                      ● Authenticated ({adminUsername})
                    </span>
                    <button
                      onClick={handleAdminLogout}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 transition-all"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono">
                    Admin Auth Required
                  </span>
                )}
              </div>

              {adminError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2" role="alert">
                  <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <span>{adminError}</span>
                </div>
              )}

              {adminSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2" role="status">
                  <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span>{adminSuccess}</span>
                </div>
              )}

              {!adminToken ? (
                <form onSubmit={handleAdminLogin} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs items-end">
                  <div>
                    <label htmlFor="admin-user" className="block text-slate-400 font-semibold mb-1">Username</label>
                    <input
                      id="admin-user"
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-pass" className="block text-slate-400 font-semibold mb-1">Password</label>
                    <input
                      id="admin-pass"
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="admin123"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-all"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>Login</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminUsername('admin');
                        setAdminPassword('admin123');
                        handleAdminLogin();
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold py-2 px-3 rounded-lg text-xs border border-cyan-500/30 transition-all"
                    >
                      ⚡ 1-Click Demo
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-slate-400">
                  You are authenticated with full administrative permissions to create organizations, publish new voting initiatives to the MST Blockchain, and trigger zero-knowledge election finalization.
                </p>
              )}
            </div>

            {/* Create Organization Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                  <Building className="h-5 w-5 text-indigo-400" />
                  <h3 className="font-bold text-slate-100">Register New Organization</h3>
                </div>

                <form onSubmit={handleCreateOrg} className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="org-name" className="block text-slate-400 font-semibold mb-1">Organization Name</label>
                    <input
                      id="org-name"
                      type="text"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="e.g. Stanford DAO / Oxford Tech Union"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="org-type" className="block text-slate-400 font-semibold mb-1">Type</label>
                    <select
                      id="org-type"
                      value={newOrgType}
                      onChange={(e) => setNewOrgType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                    >
                      <option value="COLLEGE">COLLEGE / UNIVERSITY</option>
                      <option value="DAO">DAO / WEB3 COMMUNITY</option>
                      <option value="ENTERPRISE">ENTERPRISE / GOVERNANCE</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="org-desc" className="block text-slate-400 font-semibold mb-1">Description</label>
                    <input
                      id="org-desc"
                      type="text"
                      value={newOrgDesc}
                      onChange={(e) => setNewOrgDesc(e.target.value)}
                      placeholder="Organization intent"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg text-xs transition-all"
                  >
                    + Register Organization
                  </button>
                </form>
              </div>

              {/* Create Election Form */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                  <Vote className="h-5 w-5 text-purple-400" />
                  <h3 className="font-bold text-slate-100">Create & Configure Election</h3>
                </div>

                <form onSubmit={handleCreateElection} className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="election-org" className="block text-slate-400 font-semibold mb-1">Target Organization</label>
                    <select
                      id="election-org"
                      value={newElectionOrgId}
                      onChange={(e) => setNewElectionOrgId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                    >
                      <option value="">Select Organization...</option>
                      {organizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="election-title" className="block text-slate-400 font-semibold mb-1">Election Title</label>
                    <input
                      id="election-title"
                      type="text"
                      value={newElectionTitle}
                      onChange={(e) => setNewElectionTitle(e.target.value)}
                      placeholder="e.g. 2026 Board Governance Vote"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="election-provider" className="block text-slate-400 font-semibold mb-1">Eligibility Provider</label>
                      <select
                        id="election-provider"
                        value={newElectionProvider}
                        onChange={(e) => setNewElectionProvider(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none"
                      >
                        <option value="COLLEGE_EMAIL">COLLEGE EMAIL</option>
                        <option value="COLLEGE_STUDENT_ID">STUDENT ID</option>
                        <option value="DAO_ALLOWLIST">DAO ALLOWLIST</option>
                      </select>
                    </div>

                    {newElectionProvider === 'COLLEGE_EMAIL' && (
                      <div>
                        <label htmlFor="election-domain" className="block text-slate-400 font-semibold mb-1">Allowed Domain</label>
                        <input
                          id="election-domain"
                          type="text"
                          value={newElectionDomain}
                          onChange={(e) => setNewElectionDomain(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="election-candidates" className="block text-slate-400 font-semibold mb-1">Candidates / Options (One per line)</label>
                    <textarea
                      id="election-candidates"
                      rows={3}
                      value={candidateInputs}
                      onChange={(e) => setCandidateInputs(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 rounded-lg text-xs transition-all"
                  >
                    Publish Election to MST Blockchain
                  </button>
                </form>
              </div>
            </div>

            {/* Active Elections Status & Tally Control */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-slate-100 flex items-center space-x-2">
                <Layers className="h-5 w-5 text-cyan-400" />
                <span>Election Finalization & Cryptographic Tally Manager</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {elections.map((e) => (
                  <div key={e.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs glass-panel-interactive">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-100 text-sm">{e.title}</strong>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">{e.status}</span>
                    </div>

                    <p className="text-slate-400">{e.description}</p>

                    <div className="flex items-center space-x-2 pt-2">
                      {e.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleFinalizeElection(e.id)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg transition-all"
                        >
                          Trigger ZK Tally & Finalize Election
                        </button>
                      )}

                      {e.status === 'FINALIZED' && (
                        <div className="w-full text-center py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold rounded-lg">
                          ✅ Finalized & ZK Tally Verified
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════ PUBLIC AUDIT EXPLORER ════════════════════════ */}
        {activeTab === 'audit' && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
            {/* Election Selector */}
            <div className="glass-panel rounded-2xl p-4 flex items-center space-x-3 border-cyan-500/20">
              <Building className="h-5 w-5 text-cyan-400" />
              <select
                value={selectedElectionId}
                onChange={(e) => setSelectedElectionId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500 font-semibold flex-1"
                aria-label="Select election to audit"
              >
                {elections.map((e) => (
                  <option key={e.id} value={e.id}>
                    [{e.status}] {e.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <Search className="h-5 w-5 text-cyan-400" />
                <h2 className="font-bold text-slate-100">Public Election Verifier & Ledger Audit</h2>
              </div>

              {auditData ? (
                <div className="space-y-6">
                  {/* Summary Header */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 glass-panel-interactive">
                      <span className="text-slate-400">Total Ballots Cast:</span>
                      <div className="text-2xl font-bold text-cyan-400 mt-1">{auditData.totalVotes}</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 glass-panel-interactive">
                      <span className="text-slate-400">Nullifiers Enforced:</span>
                      <div className="text-2xl font-bold text-purple-400 mt-1">{auditData.nullifiersCount}</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 glass-panel-interactive">
                      <span className="text-slate-400">Election Status:</span>
                      <div className="text-lg font-bold text-emerald-400 mt-2">{auditData.election?.status}</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 glass-panel-interactive">
                      <span className="text-slate-400">ZK Tally Verified:</span>
                      <div className="text-lg font-bold text-emerald-400 mt-2">
                        {auditData.tally ? 'VALID ✅' : 'PENDING ⏳'}
                      </div>
                    </div>
                  </div>

                  {/* Final Tally Card with Progress Bars */}
                  {auditData.tally && (
                    <div className="p-5 rounded-2xl bg-slate-900 border border-cyan-500/30 space-y-4">
                      <h4 className="text-sm font-bold text-cyan-300 flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        <span>Verified Final Election Tally</span>
                      </h4>

                      <div className="space-y-3">
                        {Object.entries(auditData.tally.candidateScores).map(([candId, count]) => {
                          const candObj = auditData.election?.candidates.find((c: any) => c.id === candId);
                          const label = candObj ? candObj.label : candId;
                          const total = Object.values(auditData.tally.candidateScores).reduce(
                            (sum: number, v: any) => sum + v, 0
                          ) as number;
                          const pct = total > 0 ? ((count as number) / total) * 100 : 0;

                          return (
                            <div key={candId} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-slate-200">{label}</span>
                                <span className="px-3 py-1 rounded bg-slate-800 text-cyan-400 font-bold">
                                  {count as number} Votes ({pct.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="tally-bar">
                                <div className="tally-bar-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-500 truncate">
                        ZK Tally Proof: {auditData.tally.zkTallyProof}
                      </div>
                    </div>
                  )}

                  {/* Immutable MST Blockchain Log */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      MST Blockchain Transaction Ledger ({ledgerTxs.length} Events)
                    </h4>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {ledgerTxs.map((tx, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono flex items-center justify-between glass-panel-interactive"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-400">
                              #{tx.blockNumber}
                            </span>
                            <span className="text-cyan-400 font-semibold">{tx.eventType}</span>
                          </div>
                          <span className="text-slate-400 truncate max-w-xs">{tx.txHash}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">Select an election to inspect audit logs.</div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════ API SANDBOX ════════════════════════ */}
        {activeTab === 'api' && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <Terminal className="h-5 w-5 text-cyan-400" />
                <h2 className="font-bold text-slate-100">REST API & MCP Endpoint Tester</h2>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <select
                  value={sandboxEndpoint}
                  onChange={(e) => setSandboxEndpoint(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none font-mono flex-1"
                  aria-label="Select API endpoint"
                >
                  <option value="/api/organizations">GET /api/organizations</option>
                  <option value="/api/elections">GET /api/elections</option>
                  <option value="/api/blockchain/ledger">GET /api/blockchain/ledger</option>
                  <option value={`/api/elections/${selectedElectionId}/results`}>
                    GET /api/elections/:id/results
                  </option>
                  <option value={`/api/elections/${selectedElectionId}/audit`}>
                    GET /api/elections/:id/audit
                  </option>
                </select>

                <button
                  onClick={handleRunSandbox}
                  className="gradient-btn text-white font-semibold py-2 px-4 rounded-lg text-xs"
                >
                  Execute GET
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-96">
                <pre>{sandboxResponse}</pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ──────── FOOTER ──────── */}
      <footer className="border-t border-slate-800 bg-slate-950/80 backdrop-blur-sm" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-500 p-0.5 flex items-center justify-center">
                  <div className="h-full w-full bg-slate-950 rounded-[6px] flex items-center justify-center">
                    <Shield className="h-4 w-4 text-cyan-400" />
                  </div>
                </div>
                <span className="font-extrabold gradient-text">DOJO</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                Privacy-preserving voting infrastructure powered by zero-knowledge proofs, verifiable credentials, and immutable blockchain technology.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Platform</h4>
              <div className="space-y-2">
                <button onClick={navigateToVoter} className="footer-link block">Cast Your Vote</button>
                <button onClick={navigateToAdmin} className="footer-link block">Admin Dashboard</button>
                <button onClick={navigateToAudit} className="footer-link block">Public Audit Explorer</button>
                <button onClick={() => setActiveTab('api')} className="footer-link block">API Documentation</button>
              </div>
            </div>

            {/* Technology */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Technology</h4>
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500"></span>
                  <span>Zero-Knowledge Proofs (ZK-SNARKs)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                  <span>Verifiable Credentials (DID)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span>MST Blockchain Ledger</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-500"></span>
                  <span>Nullifier Anti-Fraud Engine</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/60 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <span>© {new Date().getFullYear()} DOJO Privacy Infrastructure. All rights reserved.</span>
            <div className="flex items-center space-x-1">
              <span>Built with</span>
              <Heart className="h-3 w-3 text-pink-500" />
              <span>for privacy.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      <BackToTop />
    </div>
  );
}

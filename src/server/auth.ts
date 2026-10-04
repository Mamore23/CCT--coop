/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { CooperativeDB } from '../db/db.js';
import { User, Member, Role } from '../types.js';
import { sendPasswordResetOtpEmail } from './emailService.js';
import { verifyFirebaseIdToken, VerifiedFirebaseTokenClaims } from './firebaseAdmin.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cooperative-jwt-super-secret-key-123';
export const authRouter = Router();

// Express typing helpers
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    memberId?: string;
  };
}

// Authentication Middleware
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication token is missing or malformed' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: Role; memberId?: string };
    const db = CooperativeDB.load();
    const dbUser = db.users.find(u => u.id === decoded.id);
    if (!dbUser) {
      res.status(401).json({ error: 'User account not found or session invalidated' });
      return;
    }
    decoded.role = dbUser.role;

    if (dbUser.role === 'STAFF') {
      const staff = db.staff.find(s => s.id === dbUser.id);
      if (staff && staff.status !== 'ACTIVE') {
        res.status(403).json({ error: `Your staff account is currently ${staff.status.toLowerCase()} and cannot perform operations.` });
        return;
      }
    } else if (dbUser.role === 'MEMBER') {
      const member = db.members.find(m => m.id === dbUser.id || (dbUser.memberId && m.id === dbUser.memberId) || (dbUser.email && m.email.toLowerCase() === dbUser.email.toLowerCase()));
      if (member && (member.status === 'SUSPENDED' || member.status === 'DEACTIVATED' || member.status === 'REJECTED' || member.status === 'PENDING' || member.status === 'UNDER_REVIEW')) {
        res.status(403).json({ error: `Your member account is not active (${member.status}).` });
        return;
      }
    }

    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (e) {
    res.status(403).json({ error: 'Invalid or expired authentication token' });
  }
}

// RBAC Middleware
export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden: You do not have permission to access this resource' });
      return;
    }
    next();
  };
}

// Helper to compute effective permissions for a user
export function getUserEffectivePermissions(user: { id: string; role: Role }, db: any): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (user.role === 'ADMIN') {
    return new Proxy({}, { get: () => true });
  }

  const matrix = (db.permissions && db.permissions.length > 0) ? db.permissions : [
    { module: 'dashboard', admin: true, staff: true, member: true },
    { module: 'analytics', admin: true, staff: true, member: false },
    { module: 'verifications', admin: true, staff: true, member: false },
    { module: 'savings', admin: true, staff: true, member: true },
    { module: 'loans_apply', admin: false, staff: false, member: true },
    { module: 'loans_manage', admin: true, staff: true, member: false },
    { module: 'dividends', admin: true, staff: true, member: false },
    { module: 'inquiries', admin: true, staff: true, member: true },
    { module: 'user_management', admin: true, staff: false, member: false },
    { module: 'staff_management', admin: true, staff: false, member: false },
    { module: 'escalations_review', admin: true, staff: false, member: false },
    { module: 'reports', admin: true, staff: true, member: false },
    { module: 'permission_management', admin: true, staff: false, member: false },
    { module: 'audit_logs', admin: true, staff: false, member: false },
    { module: 'backup_restore', admin: true, staff: false, member: false },
    { module: 'sms_gateway', admin: true, staff: true, member: false },
    { module: 'system_settings', admin: true, staff: false, member: false },
    { module: 'gcash_payments', admin: true, staff: true, member: true },
    { module: 'official_receipts', admin: true, staff: true, member: true }
  ];

  const dbUser = db.users?.find((u: any) => u.id === user.id);
  const roleKey = user.role.toLowerCase() as 'admin' | 'staff' | 'member';

  for (const rule of matrix) {
    let allowed = !!rule[roleKey];
    if (dbUser?.customPermissions && typeof dbUser.customPermissions[rule.module] === 'boolean') {
      allowed = dbUser.customPermissions[rule.module];
    }
    result[rule.module] = allowed;
  }
  return result;
}

// Dynamic Module Permission Middleware
export function requirePermission(moduleKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }

    const db = CooperativeDB.load();
    const perms = getUserEffectivePermissions(user, db);

    if (perms[moduleKey] === true) {
      return next();
    }

    res.status(403).json({ error: `Permission Denied: Your account (${user.role}) does not have access to the '${moduleKey}' module.` });
  };
}

// Register Online (Members Only)
authRouter.post('/register', (req: Request, res: Response) => {
  const {
    email,
    password,
    fullName,
    phone,
    initialShareCapital,
    address,
    birthdate,
    gender,
    civilStatus,
    emergencyContact,
    occupation,
    monthlyIncome,
    govIdUrl,
    govIdFileName,
    selfieUrl,
    selfieFileName,
    supportingDocUrl,
    supportingDocFileName,
    otherRequirements
  } = req.body;

  if (!email || !password || !fullName || !phone) {
    res.status(400).json({ error: 'Please provide all required fields' });
    return;
  }

  const db = CooperativeDB.load();

  // Check if user already exists
  const userExists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (userExists) {
    res.status(400).json({ error: 'Email address is already registered' });
    return;
  }

  const salt = bcryptjs.genSaltSync(10);
  const passwordHash = bcryptjs.hashSync(password, salt);
  const userId = 'u_' + Math.random().toString(36).substring(2, 11);

  // New User
  const newUser: User = {
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    role: 'MEMBER',
    memberId: userId,
    createdAt: new Date().toISOString()
  };

  const shareAmt = Number(initialShareCapital) || 1000;

  // New Member (PENDING by default, zero share capital, unpaid initial share)
  const newMember: Member = {
    id: userId,
    email: email.toLowerCase(),
    fullName,
    phone,
    status: 'PENDING',
    shareCapital: 0,
    initialShareCapitalPledged: shareAmt,
    initialShareCapitalPaid: false,
    regularSavings: 0,
    timeDeposits: 0,
    dividendsEarned: 0,
    createdAt: new Date().toISOString(),
    address: address || '',
    birthdate: birthdate || '',
    gender: gender || '',
    civilStatus: civilStatus || '',
    emergencyContact: emergencyContact || '',
    occupation: occupation || '',
    monthlyIncome: monthlyIncome ? Number(monthlyIncome) : 0,
    govIdUrl: govIdUrl || '',
    govIdFileName: govIdFileName || (govIdUrl ? 'government_id.jpg' : ''),
    selfieUrl: selfieUrl || '',
    selfieFileName: selfieFileName || (selfieUrl ? 'selfie_photo.jpg' : ''),
    supportingDocUrl: supportingDocUrl || '',
    supportingDocFileName: supportingDocFileName || (supportingDocUrl ? 'supporting_document.pdf' : ''),
    otherRequirements: otherRequirements || '',
    hasAttendedPreMembershipSeminar: false,
    loanOrientationCompleted: false,
    complianceRecords: [
      {
        id: 'comp_' + Math.random().toString(36).substring(2, 11),
        memberId: userId,
        requirementType: 'PRE_MEMBERSHIP_SEMINAR',
        status: 'NOT_COMPLETED',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'comp_' + Math.random().toString(36).substring(2, 11),
        memberId: userId,
        requirementType: 'LOAN_ORIENTATION',
        status: 'NOT_COMPLETED',
        updatedAt: new Date().toISOString()
      }
    ]
  };

  db.users.push(newUser);
  db.members.push(newMember);

  if (!db.memberDocuments) db.memberDocuments = [];

  const nowIso = new Date().toISOString();

  if (govIdUrl) {
    const isPdf = govIdUrl.startsWith('data:application/pdf');
    db.memberDocuments.push({
      id: 'doc_' + Math.random().toString(36).substring(2, 11),
      memberId: userId,
      memberName: fullName,
      fileName: govIdFileName || (isPdf ? 'government_id.pdf' : 'government_id.jpg'),
      fileType: isPdf ? 'application/pdf' : 'image/jpeg',
      documentCategory: 'GOV_ID',
      fileDataUrl: govIdUrl,
      fileSize: Math.round(govIdUrl.length * 0.75),
      status: 'PENDING',
      uploadedAt: nowIso,
      updatedAt: nowIso
    });
  }

  if (selfieUrl) {
    const isPdf = selfieUrl.startsWith('data:application/pdf');
    db.memberDocuments.push({
      id: 'doc_' + Math.random().toString(36).substring(2, 11),
      memberId: userId,
      memberName: fullName,
      fileName: selfieFileName || (isPdf ? 'selfie_with_id.pdf' : 'selfie_photo.jpg'),
      fileType: isPdf ? 'application/pdf' : 'image/jpeg',
      documentCategory: 'SELFIE',
      fileDataUrl: selfieUrl,
      fileSize: Math.round(selfieUrl.length * 0.75),
      status: 'PENDING',
      uploadedAt: nowIso,
      updatedAt: nowIso
    });
  }

  if (supportingDocUrl) {
    const isPdf = supportingDocUrl.startsWith('data:application/pdf');
    db.memberDocuments.push({
      id: 'doc_' + Math.random().toString(36).substring(2, 11),
      memberId: userId,
      memberName: fullName,
      fileName: supportingDocFileName || (isPdf ? 'proof_of_income_billing.pdf' : 'supporting_doc.jpg'),
      fileType: isPdf ? 'application/pdf' : 'image/jpeg',
      documentCategory: 'INCOME_PROOF',
      fileDataUrl: supportingDocUrl,
      fileSize: Math.round(supportingDocUrl.length * 0.75),
      status: 'PENDING',
      uploadedAt: nowIso,
      updatedAt: nowIso
    });
  }

  // Do not record a transaction for the commitment until it is actually paid and verified.

  CooperativeDB.save(db);
  CooperativeDB.logAudit(userId, email, 'MEMBER', 'MEMBER_ONLINE_REGISTRATION', `Member registration submitted for ${fullName}. Status: PENDING.`);

  res.status(201).json({
    message: 'Registration successful! Your account is pending verification by our cooperative staff.',
    user: {
      id: userId,
      memberId: userId,
      email: newUser.email,
      role: newUser.role
    }
  });
});

// Login
authRouter.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Please provide email and password' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = CooperativeDB.load();
    const user = db.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

    console.log('[DEBUG /login] user found:', !!user, 'email:', cleanEmail);
    if (user) {
      console.log('[DEBUG /login] user.passwordHash exists:', !!user.passwordHash, 'passwordSetupPending:', user.passwordSetupPending);
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Validate Password
    if (!user.passwordHash) {
      if (user.passwordSetupPending) {
        res.status(403).json({ error: 'Please set up your password first using the invitation link or password setup screen.' });
        return;
      }
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    let isMatch = false;
    try {
      isMatch = bcryptjs.compareSync(password, user.passwordHash);
      console.log('[DEBUG /login] bcrypt match:', isMatch);
    } catch (e) {
      console.log('[DEBUG /login] bcrypt error:', e);
      isMatch = false;
    }

    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check verification status based on role
    let member: Member | undefined;
    if (user.role === 'MEMBER') {
      member = db.members.find(m => m.id === user.id || (user.email && m.email.toLowerCase() === user.email.toLowerCase()));
      if (!member) {
        res.status(403).json({ error: 'Member record not found' });
        return;
      }
      if (member.status === 'PENDING') {
        res.status(403).json({ error: 'Your account is pending verification and approval by staff. Please check back later.' });
        return;
      }
      if (member.status === 'UNDER_REVIEW') {
        res.status(403).json({ error: 'Your account application is currently under review by cooperative staff.' });
        return;
      }
      if (member.status === 'SUSPENDED') {
        res.status(403).json({ error: 'Your account is suspended. Please contact administration.' });
        return;
      }
      if (member.status === 'DEACTIVATED' || member.status === 'REJECTED') {
        res.status(403).json({ error: 'Your account is inactive or was rejected.' });
        return;
      }
    } else if (user.role === 'STAFF') {
      const staff = db.staff.find(s => s.id === user.id);
      if (!staff || staff.status !== 'ACTIVE') {
        const errorMsg = staff?.status === 'SUSPENDED' 
          ? 'Your staff account is currently suspended by management. Please contact the Cooperative Manager.' 
          : 'Your staff account has been deactivated.';
        res.status(403).json({ error: errorMsg });
        return;
      }
      staff.lastLoginAt = new Date().toISOString();
      staff.lastActivityAt = new Date().toISOString();
    }

    user.lastLoginAt = new Date().toISOString();
    user.lastActivityAt = new Date().toISOString();

    const resolvedMemberId = member ? member.id : (user.memberId || user.id);
    user.memberId = resolvedMemberId;

    // Clear passwordSetupPending if they logged in successfully
    if (user.passwordSetupPending) {
      user.passwordSetupPending = false;
    }
    CooperativeDB.save(db);

    // Generate Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, memberId: resolvedMemberId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    CooperativeDB.logAudit(user.id, user.email, user.role, 'USER_LOGIN', `Successfully logged in to the system.`);

    let fullName = 'Cooperative Administrator';
    let avatarUrl = user.avatarUrl || '';

    if (user.role === 'MEMBER') {
      if (member) {
        fullName = member.fullName;
        if (member.avatarUrl) avatarUrl = member.avatarUrl;
      }
    } else if (user.role === 'STAFF') {
      const staff = db.staff.find(s => s.id === user.id);
      if (staff) {
        fullName = staff.fullName;
        if (staff.avatarUrl) avatarUrl = staff.avatarUrl;
      }
    }

    res.json({
      token,
      memberId: resolvedMemberId,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName,
        avatarUrl,
        memberId: resolvedMemberId
      }
    });
  } catch (err: any) {
    console.error('Login Endpoint Error:', err);
    res.status(500).json({ error: 'An unexpected error occurred during login. Please try again.' });
  }
});

// ============================================================================
// FIREBASE GOOGLE AUTHENTICATION FOR EXISTING ACTIVE MEMBERS (POST /api/auth/firebase)
// ============================================================================

/**
 * Core Firebase Google authentication & account-linking enforcement:
 * - Never auto-creates User or Member accounts
 * - Trusts ONLY verified Firebase ID token claims (never browser-supplied email/role/memberId/userId)
 * - Requires verified Google email matching an existing registered MEMBER account
 * - Enforces MEMBER role and rejects PENDING, UNDER_REVIEW, REVISION_REQUESTED, SUSPENDED, DEACTIVATED, REJECTED
 * - Links firebaseUid, firebaseEmail, firebaseLinkedAt, and authProvider without touching financial balances
 * - Never stores Firebase ID tokens, passwords, or private keys in DB or audit logs
 * - Issues the existing application JWT and session payload
 */
export function authenticateFirebaseGoogleMember(claims: Partial<VerifiedFirebaseTokenClaims>): {
  status: number;
  error?: string;
  body?: any;
} {
  const rawEmail = typeof claims.email === 'string' ? claims.email.trim() : '';
  const cleanEmail = rawEmail.toLowerCase();
  const firebaseUid = typeof claims.uid === 'string' ? claims.uid.trim() : '';

  if (!cleanEmail || !firebaseUid) {
    CooperativeDB.logAudit(
      'anonymous',
      cleanEmail || 'unknown',
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_FAILED',
      'Rejected Firebase Google Sign-In: missing verified Firebase email or UID claim.'
    );
    return {
      status: 400,
      error: 'Firebase authentication failed: verified Google email and UID are required.'
    };
  }

  if (claims.email_verified === false) {
    CooperativeDB.logAudit(
      'anonymous',
      cleanEmail,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_FAILED',
      `Rejected Firebase Google Sign-In for ${cleanEmail}: Google email is not verified.`
    );
    return {
      status: 403,
      error: 'Your Google email address is not verified. Please use a verified Google account.'
    };
  }

  const db = CooperativeDB.load();

  // 1. Locate existing User and Member strictly by verified Firebase email (never auto-register)
  const user = db.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
  const memberByEmail = db.members.find(m => m.email && m.email.toLowerCase() === cleanEmail);

  if (!user && !memberByEmail) {
    CooperativeDB.logAudit(
      'anonymous',
      cleanEmail,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_UNREGISTERED_REJECTED',
      `Rejected Firebase Google Sign-In for unregistered email ${cleanEmail}. No existing member account found.`
    );
    return {
      status: 403,
      error: 'Your Google account is not registered as a cooperative member. Please register through the Member Registration form first.'
    };
  }

  if (!user) {
    CooperativeDB.logAudit(
      memberByEmail?.id || 'anonymous',
      cleanEmail,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_UNREGISTERED_REJECTED',
      `Rejected Firebase Google Sign-In for ${cleanEmail}: user credentials record not found.`
    );
    return {
      status: 403,
      error: 'Your Google account is not registered as a cooperative member. Please register through the Member Registration form first.'
    };
  }

  // 2. Confirm role === MEMBER (Staff and Admin cannot authenticate through Member Firebase endpoint)
  if (user.role !== 'MEMBER') {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      user.role,
      'FIREBASE_GOOGLE_LOGIN_FAILED',
      `Rejected Firebase Google Sign-In attempt for non-member role (${user.role}) on account ${cleanEmail}.`
    );
    return {
      status: 403,
      error: 'Firebase Google Sign-In is strictly for registered Member accounts. Staff and Administrators must sign in using their security password.'
    };
  }

  // 3. Find corresponding Member record
  const member = db.members.find(
    m => m.id === user.id || (user.memberId && m.id === user.memberId) || (m.email && m.email.toLowerCase() === cleanEmail)
  );

  if (!member) {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_UNREGISTERED_REJECTED',
      `Rejected Firebase Google Sign-In for ${cleanEmail}: corresponding Member profile record not found.`
    );
    return {
      status: 403,
      error: 'Your Google account is not registered as a cooperative member. Please register through the Member Registration form first.'
    };
  }

  // 4. Prevent conflicting Firebase UID takeover or duplicate UID linking across different accounts
  const existingLinkedUid = user.firebaseUid || member.firebaseUid;
  if (existingLinkedUid && existingLinkedUid !== firebaseUid) {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_FAILED',
      `Rejected Firebase Google Sign-In for ${cleanEmail}: account is already linked to a different Firebase UID.`
    );
    return {
      status: 403,
      error: 'Account-linking conflict: This member account is already linked to a different Google identity.'
    };
  }

  const otherUserWithSameUid = db.users.find(
    u => u.id !== user.id && u.firebaseUid === firebaseUid
  );
  const otherMemberWithSameUid = db.members.find(
    m => m.id !== member.id && m.firebaseUid === firebaseUid
  );
  if (otherUserWithSameUid || otherMemberWithSameUid) {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_FAILED',
      `Rejected Firebase Google Sign-In for ${cleanEmail}: Firebase UID is already linked to another member account.`
    );
    return {
      status: 403,
      error: 'Account-linking conflict: This Google identity is already linked to another cooperative member account.'
    };
  }

  // 5. Enforce strict Member account status rules (PENDING, UNDER_REVIEW, REVISION_REQUESTED, SUSPENDED, DEACTIVATED, REJECTED -> HTTP 403)
  if (member.status === 'PENDING') {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_PENDING_REJECTED',
      `Rejected Firebase Google Sign-In for PENDING member ${member.fullName} (${cleanEmail}). Staff approval required.`
    );
    return {
      status: 403,
      error: 'Your account is pending verification and approval by staff. Please check back later.'
    };
  }

  if (member.status === 'UNDER_REVIEW' || member.status === 'REVISION_REQUESTED') {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_PENDING_REJECTED',
      `Rejected Firebase Google Sign-In for ${member.status} member ${member.fullName} (${cleanEmail}).`
    );
    return {
      status: 403,
      error: 'Your account application is currently under review by cooperative staff.'
    };
  }

  if (member.status === 'SUSPENDED') {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_SUSPENDED_REJECTED',
      `Rejected Firebase Google Sign-In for SUSPENDED member ${member.fullName} (${cleanEmail}).`
    );
    return {
      status: 403,
      error: 'Your account is suspended. Please contact administration.'
    };
  }

  if (member.status === 'DEACTIVATED') {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_INACTIVE_REJECTED',
      `Rejected Firebase Google Sign-In for DEACTIVATED member ${member.fullName} (${cleanEmail}).`
    );
    return {
      status: 403,
      error: 'Your account has been deactivated. Please contact administration.'
    };
  }

  if (member.status === 'REJECTED') {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_INACTIVE_REJECTED',
      `Rejected Firebase Google Sign-In for REJECTED member ${member.fullName} (${cleanEmail}).`
    );
    return {
      status: 403,
      error: 'Your membership application was rejected. Please contact the cooperative office.'
    };
  }

  if (member.status !== 'ACTIVE') {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_INACTIVE_REJECTED',
      `Rejected Firebase Google Sign-In for non-active member ${member.fullName} (${cleanEmail}), status=${member.status}.`
    );
    return {
      status: 403,
      error: `Your member account is not active (${member.status}).`
    };
  }

  // 6. Member is ACTIVE: link Firebase identity if not yet linked, preserve existing User/Member IDs and role = MEMBER
  const nowIso = new Date().toISOString();
  const isFirstLink = !user.firebaseUid;

  user.firebaseUid = firebaseUid;
  user.firebaseEmail = cleanEmail;
  if (!user.firebaseLinkedAt) {
    user.firebaseLinkedAt = nowIso;
  }
  user.authProvider = user.passwordHash ? 'LOCAL+GOOGLE' : 'GOOGLE';
  user.lastLoginAt = nowIso;
  user.lastActivityAt = nowIso;
  delete (user as any).googleSub;
  delete (user as any).googleEmail;
  delete (user as any).googleLinkedAt;

  member.firebaseUid = firebaseUid;
  member.firebaseEmail = cleanEmail;
  if (!member.firebaseLinkedAt) {
    member.firebaseLinkedAt = nowIso;
  }
  member.authProvider = user.authProvider;
  delete (member as any).googleSub;
  delete (member as any).googleLinkedAt;

  const resolvedMemberId = member.id;
  user.memberId = resolvedMemberId;
  // Strictly preserve role = MEMBER
  user.role = 'MEMBER';

  CooperativeDB.save(db);

  if (isFirstLink) {
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'FIREBASE_GOOGLE_ACCOUNT_LINKED',
      `Linked verified Firebase Google identity (${cleanEmail}, uid: ${firebaseUid}) to active member ${member.fullName} (${resolvedMemberId}).`
    );
  }

  CooperativeDB.logAudit(
    user.id,
    user.email,
    'MEMBER',
    'FIREBASE_GOOGLE_LOGIN_SUCCESS',
    `Successfully authenticated active member ${member.fullName} (${cleanEmail}) via Firebase Google Sign-In.`
  );

  const token = jwt.sign(
    { id: user.id, email: user.email, role: 'MEMBER' as Role, memberId: resolvedMemberId },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const avatarUrl = member.avatarUrl || user.avatarUrl || '';

  return {
    status: 200,
    body: {
      token,
      memberId: resolvedMemberId,
      authProvider: user.authProvider,
      firebaseLinked: true,
      isFirstLink,
      user: {
        id: user.id,
        email: user.email,
        role: 'MEMBER' as Role,
        fullName: member.fullName,
        avatarUrl,
        memberId: resolvedMemberId
      }
    }
  };
}

// Backend Firebase Authentication Endpoint (POST /api/auth/firebase)
authRouter.post('/firebase', async (req: Request, res: Response) => {
  const useAuthEnvelope = req.headers['x-accept-auth-envelope'] === '1';
  const sendAuthError = (status: number, error: string) => {
    if (useAuthEnvelope) {
      res.status(200).json({ ok: false, status, error });
    } else {
      res.status(status).json({ error });
    }
  };

  try {
    // Extract ONLY the Firebase ID token. Never trust browser-supplied email, role, memberId, or userId.
    const rawBodyToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const idToken = rawBodyToken || headerToken;

    if (!idToken) {
      CooperativeDB.logAudit(
        'anonymous',
        'unknown',
        'MEMBER',
        'FIREBASE_GOOGLE_LOGIN_FAILED',
        'Rejected POST /api/auth/firebase: missing Firebase ID token.'
      );
      sendAuthError(401, 'Firebase authentication failed: missing Firebase ID token.');
      return;
    }

    const verification = await verifyFirebaseIdToken(idToken);
    if (!verification.valid || !verification.claims) {
      CooperativeDB.logAudit(
        'anonymous',
        'unknown',
        'MEMBER',
        'FIREBASE_GOOGLE_LOGIN_FAILED',
        `Rejected POST /api/auth/firebase: ${verification.error || 'invalid Firebase ID token'}.`
      );
      sendAuthError(401, verification.error || 'Firebase authentication failed: invalid or expired ID token.');
      return;
    }

    const result = authenticateFirebaseGoogleMember(verification.claims);
    if (result.status !== 200) {
      sendAuthError(result.status, result.error || 'Google authentication failed.');
      return;
    }

    res.status(200).json(result.body);
  } catch (err: any) {
    CooperativeDB.logAudit(
      'anonymous',
      'unknown',
      'MEMBER',
      'FIREBASE_GOOGLE_LOGIN_FAILED',
      'Unexpected server error during Firebase Google authentication.'
    );
    sendAuthError(500, 'An unexpected error occurred during Google Sign-In. Please try again.');
  }
});

// Setup Password for newly approved / invited members
authRouter.post('/setup-password', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Please provide email and password' });
    return;
  }

  const db = CooperativeDB.load();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    res.status(404).json({ error: 'User account not found' });
    return;
  }

  const salt = bcryptjs.genSaltSync(10);
  user.passwordHash = bcryptjs.hashSync(password, salt);
  user.passwordSetupPending = false;

  // Ensure member is active
  const member = db.members.find(m => m.id === user.id);
  if (member) {
    member.status = 'ACTIVE';
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(user.id, user.email, 'MEMBER', 'PASSWORD_SETUP_COMPLETED', `Successfully completed password setup for approved account: ${email.toLowerCase()}`);

  res.json({ message: 'Your password has been successfully set up! You may now login to the system.' });
});

// Get Current User Session (Me)
authRouter.get('/me', authenticateJWT, (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user;
  if (!tokenUser) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  const db = CooperativeDB.load();
  const user = db.users.find(u => u.id === tokenUser.id);

  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  let details: any = null;
  let memberId = user.memberId || user.id;
  if (user.role === 'MEMBER') {
    const member = db.members.find(m => m.id === user.id || (user.email && m.email.toLowerCase() === user.email.toLowerCase()));
    details = member || null;
    if (member) memberId = member.id;
  } else if (user.role === 'STAFF') {
    details = db.staff.find(s => s.id === user.id);
  } else if (user.role === 'ADMIN') {
    details = { fullName: 'Cooperative Administrator' };
  }

  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    memberId,
    createdAt: user.createdAt,
    details
  });
});

// Change Password
authRouter.post('/change-password', authenticateJWT, (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Please provide current and new passwords' });
    return;
  }

  const db = CooperativeDB.load();
  const user = db.users.find(u => u.id === tokenUser.id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const isMatch = bcryptjs.compareSync(currentPassword, user.passwordHash);
  if (!isMatch) {
    res.status(400).json({ error: 'Incorrect current password' });
    return;
  }

  const salt = bcryptjs.genSaltSync(10);
  user.passwordHash = bcryptjs.hashSync(newPassword, salt);
  CooperativeDB.save(db);

  CooperativeDB.logAudit(user.id, user.email, user.role, 'CHANGE_PASSWORD', 'Successfully updated user password.');

  res.json({ message: 'Password updated successfully!' });
});

// ============================================================================
// SECURE EMAIL OTP FORGOT PASSWORD WORKFLOW (EXISTING MEMBER ACCOUNTS ONLY)
// ============================================================================

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_RESET_REQ_PER_EMAIL = 5;
const MAX_RESET_REQ_PER_IP = process.env.NODE_ENV === 'production' ? 25 : 1000;
const MAX_VERIFY_REQ_PER_IP = process.env.NODE_ENV === 'production' ? 40 : 1000;
const GENERIC_FORGOT_PASSWORD_MSG = 'If an account is registered with this email, a verification code has been sent.';

const emailResetRequestLog = new Map<string, number[]>();
const ipResetRequestLog = new Map<string, number[]>();
const ipVerifyRequestLog = new Map<string, number[]>();

function getClientIp(req: Request): string {
  const testIp = req.headers['x-test-client-ip'];
  if (typeof testIp === 'string' && testIp.trim()) return testIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

function isRateLimited(store: Map<string, number[]>, key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (store.get(key) || []).filter(ts => now - ts < windowMs);
  if (recent.length >= maxRequests) {
    store.set(key, recent);
    return true;
  }
  recent.push(now);
  store.set(key, recent);
  return false;
}

export function validateStrongPassword(password: string): { valid: boolean; error?: string } {
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number.' };
  }
  return { valid: true };
}

// 1. Request Password Reset OTP (POST /api/auth/forgot-password)
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const cleanEmail = rawEmail.toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const clientIp = getClientIp(req);
    const ipLimit = req.headers['x-test-client-ip'] ? MAX_RESET_REQ_PER_EMAIL : MAX_RESET_REQ_PER_IP;

    if (
      isRateLimited(emailResetRequestLog, cleanEmail, MAX_RESET_REQ_PER_EMAIL, RATE_LIMIT_WINDOW_MS) ||
      isRateLimited(ipResetRequestLog, clientIp, ipLimit, RATE_LIMIT_WINDOW_MS)
    ) {
      CooperativeDB.logAudit(
        'anonymous',
        cleanEmail,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        'Rate limit exceeded for password reset OTP request.'
      );
      res.status(429).json({ error: 'Too many password reset requests. Please wait a few minutes before trying again.' });
      return;
    }

    const db = CooperativeDB.load();
    const user = db.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
    const member = db.members.find(
      m => (user && (m.id === user.id || m.id === user.memberId)) || (m.email && m.email.toLowerCase() === cleanEmail)
    );

    // Only issue OTP for existing registered MEMBER accounts. Never auto-create User or Member.
    if (!user || user.role !== 'MEMBER' || !member) {
      CooperativeDB.logAudit(
        user?.id || 'anonymous',
        cleanEmail,
        user?.role || 'MEMBER',
        'PASSWORD_RESET_REQUESTED',
        'Password reset requested for non-existent or non-member email; returned generic response without issuing OTP.'
      );
      res.status(200).json({ message: GENERIC_FORGOT_PASSWORD_MSG });
      return;
    }

    // Step 1: Generate cryptographically secure 6-digit OTP (100000 - 999999)
    const otp = String(crypto.randomInt(100000, 1000000));

    // Step 2: Hash OTP using bcrypt
    const salt = bcryptjs.genSaltSync(10);
    const otpHash = bcryptjs.hashSync(otp, salt);
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();

    // Step 3: Save reset state (store ONLY hashed OTP; preserve status, role, memberId, and financial balances)
    user.passwordReset = {
      otpHash,
      expiresAt: expiresAtIso,
      attempts: 0,
      maxAttempts: MAX_OTP_ATTEMPTS,
      verified: false,
      used: false,
      requestedAt: nowIso
    };
    CooperativeDB.save(db);

    // Step 4: Send OTP email via Nodemailer SMTP service (or mock test transport when specified in tests)
    const rawTestMode = process.env.NODE_ENV !== 'production' ? req.headers['x-test-email-transport'] : undefined;
    const testTransportMode = rawTestMode === 'mock' || rawTestMode === 'fail' ? rawTestMode : undefined;

    const deliveryResult = await sendPasswordResetOtpEmail({
      toEmail: user.email,
      fullName: member.fullName,
      otp,
      expiresAtIso,
      testTransportMode
    });

    if (deliveryResult.sent) {
      CooperativeDB.logAudit(
        user.id,
        user.email,
        'MEMBER',
        'PASSWORD_RESET_REQUESTED',
        `Password reset OTP generated and sent via ${deliveryResult.provider} for member (${member.id}).`
      );
    } else {
      // Do NOT claim internally that the email was sent if SMTP delivery failed or is unconfigured
      CooperativeDB.logAudit(
        user.id,
        user.email,
        'MEMBER',
        'PASSWORD_RESET_REQUESTED',
        `Password reset OTP generated for member (${member.id}), but email delivery failed (${deliveryResult.provider}).`
      );
      CooperativeDB.logAudit(
        user.id,
        user.email,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        `Password reset OTP email delivery failed for member (${member.id}): ${deliveryResult.error || 'Email transport failure'}`
      );
    }

    // Step 5: Return generic account-enumeration-safe response to client
    res.status(200).json({ message: GENERIC_FORGOT_PASSWORD_MSG });
  } catch (err) {
    res.status(500).json({ error: 'Unable to process password reset request at this time.' });
  }
});

// 2. Verify Password Reset OTP (POST /api/auth/verify-reset-otp)
authRouter.post('/verify-reset-otp', (req: Request, res: Response) => {
  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const cleanEmail = rawEmail.toLowerCase();
    const rawOtp = typeof req.body?.otp === 'string' || typeof req.body?.otp === 'number'
      ? String(req.body.otp).trim()
      : '';

    if (!cleanEmail || !rawOtp) {
      res.status(400).json({ error: 'Please provide your email address and 6-digit verification code.' });
      return;
    }

    const clientIp = getClientIp(req);
    if (isRateLimited(ipVerifyRequestLog, `${clientIp}:${cleanEmail}`, MAX_VERIFY_REQ_PER_IP, RATE_LIMIT_WINDOW_MS)) {
      CooperativeDB.logAudit('anonymous', cleanEmail, 'MEMBER', 'PASSWORD_RESET_FAILED', 'Rate limit exceeded during OTP verification.');
      res.status(429).json({ error: 'Too many OTP verification requests. Please try again later.' });
      return;
    }

    const db = CooperativeDB.load();
    const user = db.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
    const member = db.members.find(
      m => (user && (m.id === user.id || m.id === user.memberId)) || (m.email && m.email.toLowerCase() === cleanEmail)
    );

    if (!user || user.role !== 'MEMBER' || !member || !user.passwordReset) {
      CooperativeDB.logAudit(
        user?.id || 'anonymous',
        cleanEmail,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        'Rejected OTP verification: no active password reset request found for account.'
      );
      res.status(400).json({ error: 'Invalid or expired verification code.' });
      return;
    }

    const resetState = user.passwordReset;

    // Single-use enforcement: reject if already verified or already used
    if (resetState.used || resetState.verified || !resetState.otpHash) {
      CooperativeDB.logAudit(
        user.id,
        user.email,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        'Rejected OTP verification: verification code has already been used or invalidated.'
      );
      res.status(400).json({ error: 'This verification code has already been used. Please request a new code.' });
      return;
    }

    // Attempt limit check (max 5 attempts)
    if (resetState.attempts >= (resetState.maxAttempts || MAX_OTP_ATTEMPTS)) {
      resetState.otpHash = '';
      resetState.used = true;
      CooperativeDB.save(db);
      CooperativeDB.logAudit(
        user.id,
        user.email,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        'Rejected OTP verification: maximum verification attempts (5) exceeded.'
      );
      res.status(429).json({ error: 'Maximum verification attempts (5) exceeded. This code has been invalidated. Please request a new code.' });
      return;
    }

    // 10-minute expiration check
    const testOffsetMs = process.env.NODE_ENV !== 'production' && req.headers['x-test-time-offset-ms']
      ? Number(req.headers['x-test-time-offset-ms']) || 0
      : 0;
    const expiresMs = Date.parse(resetState.expiresAt);
    if (!Number.isFinite(expiresMs) || (Date.now() + testOffsetMs) > expiresMs) {
      resetState.otpHash = '';
      resetState.used = true;
      CooperativeDB.save(db);
      CooperativeDB.logAudit(
        user.id,
        user.email,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        'Rejected OTP verification: verification code has expired.'
      );
      res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
      return;
    }

    // Verify 6-digit OTP against stored bcrypt hash
    const isOtpValid = /^\d{6}$/.test(rawOtp) && bcryptjs.compareSync(rawOtp, resetState.otpHash);
    if (!isOtpValid) {
      resetState.attempts += 1;
      const maxAllowed = resetState.maxAttempts || MAX_OTP_ATTEMPTS;
      if (resetState.attempts >= maxAllowed) {
        resetState.otpHash = '';
        resetState.used = true;
        CooperativeDB.save(db);
        CooperativeDB.logAudit(
          user.id,
          user.email,
          'MEMBER',
          'PASSWORD_RESET_FAILED',
          `Rejected OTP verification: incorrect code on attempt ${resetState.attempts}/${maxAllowed}. OTP invalidated.`
        );
        res.status(429).json({ error: 'Maximum verification attempts (5) exceeded. This code has been invalidated. Please request a new code.' });
        return;
      }

      CooperativeDB.save(db);
      CooperativeDB.logAudit(
        user.id,
        user.email,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        `Rejected OTP verification: incorrect verification code (attempt ${resetState.attempts}/${maxAllowed}).`
      );
      res.status(400).json({ error: 'Invalid verification code. Please check your 6-digit code and try again.' });
      return;
    }

    // OTP is valid: immediately invalidate the OTP hash so it can never be reused
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = bcryptjs.hashSync(resetToken, bcryptjs.genSaltSync(10));

    resetState.otpHash = '';
    resetState.verified = true;
    resetState.verifiedAt = new Date().toISOString();
    resetState.resetTokenHash = resetTokenHash;

    CooperativeDB.save(db);
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'PASSWORD_RESET_VERIFIED',
      'Successfully verified single-use email OTP for member password reset.'
    );

    res.status(200).json({
      verified: true,
      resetToken,
      message: 'Verification code verified. You may now set your new password.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to verify code at this time.' });
  }
});

// 3. Complete Password Reset (POST /api/auth/reset-password)
authRouter.post('/reset-password', (req: Request, res: Response) => {
  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const cleanEmail = rawEmail.toLowerCase();
    const newPassword = typeof req.body?.newPassword === 'string'
      ? req.body.newPassword
      : (typeof req.body?.password === 'string' ? req.body.password : '');
    const confirmPassword = typeof req.body?.confirmPassword === 'string'
      ? req.body.confirmPassword
      : '';
    const resetToken = typeof req.body?.resetToken === 'string' ? req.body.resetToken.trim() : '';
    const rawOtp = typeof req.body?.otp === 'string' || typeof req.body?.otp === 'number'
      ? String(req.body.otp).trim()
      : '';

    if (!cleanEmail || !newPassword || !confirmPassword) {
      res.status(400).json({ error: 'Please provide your email, new password, and password confirmation.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      CooperativeDB.logAudit('anonymous', cleanEmail, 'MEMBER', 'PASSWORD_RESET_FAILED', 'Rejected password reset: password confirmation did not match.');
      res.status(400).json({ error: 'New password and confirm password do not match.' });
      return;
    }

    const strength = validateStrongPassword(newPassword);
    if (!strength.valid) {
      CooperativeDB.logAudit('anonymous', cleanEmail, 'MEMBER', 'PASSWORD_RESET_FAILED', `Rejected password reset: weak password (${strength.error}).`);
      res.status(400).json({ error: strength.error });
      return;
    }

    const db = CooperativeDB.load();
    const user = db.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
    const member = db.members.find(
      m => (user && (m.id === user.id || m.id === user.memberId)) || (m.email && m.email.toLowerCase() === cleanEmail)
    );

    if (!user || user.role !== 'MEMBER' || !member || !user.passwordReset) {
      CooperativeDB.logAudit(
        user?.id || 'anonymous',
        cleanEmail,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        'Rejected password reset: no active password reset session for account.'
      );
      res.status(400).json({ error: 'Invalid or expired password reset session.' });
      return;
    }

    const resetState = user.passwordReset;

    if (resetState.used) {
      CooperativeDB.logAudit(
        user.id,
        user.email,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        'Rejected password reset: OTP or reset session has already been used.'
      );
      res.status(400).json({ error: 'This verification code has already been used. Please request a new code.' });
      return;
    }

    const expiresMs = Date.parse(resetState.expiresAt);
    if (!Number.isFinite(expiresMs) || Date.now() > expiresMs) {
      resetState.used = true;
      resetState.verified = false;
      resetState.otpHash = '';
      resetState.resetTokenHash = '';
      CooperativeDB.save(db);
      CooperativeDB.logAudit(
        user.id,
        user.email,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        'Rejected password reset: OTP / reset session has expired.'
      );
      res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
      return;
    }

    // Authorize either via previously verified session (resetToken / verified state) or direct single-use OTP
    if (resetState.verified) {
      if (resetToken) {
        const tokenValid = Boolean(resetState.resetTokenHash && bcryptjs.compareSync(resetToken, resetState.resetTokenHash));
        if (!tokenValid) {
          CooperativeDB.logAudit(
            user.id,
            user.email,
            'MEMBER',
            'PASSWORD_RESET_FAILED',
            'Rejected password reset: invalid reset token supplied.'
          );
          res.status(400).json({ error: 'Invalid password reset verification token.' });
          return;
        }
      }
    } else if (rawOtp && resetState.otpHash) {
      if (resetState.attempts >= (resetState.maxAttempts || MAX_OTP_ATTEMPTS)) {
        resetState.otpHash = '';
        resetState.used = true;
        CooperativeDB.save(db);
        CooperativeDB.logAudit(user.id, user.email, 'MEMBER', 'PASSWORD_RESET_FAILED', 'Rejected password reset: maximum OTP attempts exceeded.');
        res.status(429).json({ error: 'Maximum verification attempts (5) exceeded. Please request a new code.' });
        return;
      }
      const isOtpValid = /^\d{6}$/.test(rawOtp) && bcryptjs.compareSync(rawOtp, resetState.otpHash);
      if (!isOtpValid) {
        resetState.attempts += 1;
        if (resetState.attempts >= (resetState.maxAttempts || MAX_OTP_ATTEMPTS)) {
          resetState.otpHash = '';
          resetState.used = true;
        }
        CooperativeDB.save(db);
        CooperativeDB.logAudit(user.id, user.email, 'MEMBER', 'PASSWORD_RESET_FAILED', 'Rejected password reset: invalid OTP supplied.');
        res.status(resetState.used ? 429 : 400).json({ error: 'Invalid verification code.' });
        return;
      }
    } else {
      CooperativeDB.logAudit(
        user.id,
        user.email,
        'MEMBER',
        'PASSWORD_RESET_FAILED',
        'Rejected password reset: OTP has not been verified yet.'
      );
      res.status(400).json({ error: 'Please verify your 6-digit email OTP before setting a new password.' });
      return;
    }

    // Hash new password using existing bcryptjs mechanism
    const salt = bcryptjs.genSaltSync(10);
    user.passwordHash = bcryptjs.hashSync(newPassword, salt);

    // Preserve Firebase identity linking fields if linked
    if (user.firebaseUid) {
      user.authProvider = 'LOCAL+GOOGLE';
      if (member) {
        member.authProvider = 'LOCAL+GOOGLE';
      }
    } else {
      user.authProvider = 'LOCAL';
      if (member) {
        member.authProvider = 'LOCAL';
      }
    }

    // Strictly preserve role = MEMBER and memberId (and do NOT touch member.status or financial balances)
    user.role = 'MEMBER';
    user.memberId = member.id;

    // Immediately invalidate reset session so it cannot be reused
    resetState.used = true;
    resetState.verified = false;
    resetState.otpHash = '';
    resetState.resetTokenHash = '';

    CooperativeDB.save(db);
    CooperativeDB.logAudit(
      user.id,
      user.email,
      'MEMBER',
      'PASSWORD_RESET_SUCCESS',
      `Successfully reset password for member ${member.id} (status preserved as ${member.status}).`
    );

    res.status(200).json({
      message: 'Password successfully changed! You may now sign in with your new password.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to reset password at this time.' });
  }
});

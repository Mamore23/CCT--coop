/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Automated Verification Suite for Firebase Google Authentication (Tests A - W)
 */

import fs from 'fs';
import jwt from 'jsonwebtoken';
import { CooperativeDB } from '../src/db/db.js';
import {
  createTestFirebaseIdToken,
  getFirebaseServerConfigStatus
} from '../src/server/firebaseAdmin.js';
import { authRouter } from '../src/server/auth.js';
import { getFirebaseWebConfigStatus } from '../src/firebase.js';

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL_OUTBOX_PATH = '/tmp/coop_email_outbox.json';

async function api(
  path: string,
  method: string = 'GET',
  body?: any,
  token?: string,
  extraHeaders?: Record<string, string>
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { status: res.status, ok: res.ok, data };
}

function getFreshDb() {
  (CooperativeDB as any).state = null;
  return CooperativeDB.load();
}

function getDispatchedOtpFromOutbox(email: string): string | null {
  if (!fs.existsSync(TEST_EMAIL_OUTBOX_PATH)) return null;
  try {
    const outbox = JSON.parse(fs.readFileSync(TEST_EMAIL_OUTBOX_PATH, 'utf-8'));
    const entry = outbox[email.toLowerCase()];
    const text = typeof entry?.text === 'string' ? entry.text : '';
    const match = text.match(/\b(\d{6})\b/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runFirebaseGoogleSignInSuite() {
  console.log('======================================================================');
  console.log('STARTING: FIREBASE GOOGLE AUTHENTICATION & SECURITY SUITE (A - W)');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // 0. VERIFY ENVIRONMENT VARIABLE REPORTING & OBSOLETE OAUTH REMOVAL
  // -------------------------------------------------------------------------
  console.log('--- 0. Firebase Configuration Validation & Obsolete OAuth Removal ---');
  const emptyWebConfig = getFirebaseWebConfigStatus({});
  check(
    'Missing VITE_FIREBASE_* web variables are clearly reported when absent',
    emptyWebConfig.configured === false &&
      emptyWebConfig.missingVars.includes('VITE_FIREBASE_API_KEY') &&
      emptyWebConfig.missingVars.includes('VITE_FIREBASE_AUTH_DOMAIN') &&
      emptyWebConfig.missingVars.includes('VITE_FIREBASE_PROJECT_ID') &&
      emptyWebConfig.missingVars.includes('VITE_FIREBASE_STORAGE_BUCKET') &&
      emptyWebConfig.missingVars.includes('VITE_FIREBASE_MESSAGING_SENDER_ID') &&
      emptyWebConfig.missingVars.includes('VITE_FIREBASE_APP_ID')
  );

  const emptyServerConfig = getFirebaseServerConfigStatus({} as any);
  check(
    'Missing VITE_FIREBASE_* server variables are clearly reported when absent',
    emptyServerConfig.configured === false &&
      emptyServerConfig.missingVars.length === 6
  );

  const registeredRoutePaths = (authRouter as any).stack
    ?.map((layer: any) => layer?.route?.path)
    .filter(Boolean)
    .flat() || [];
  check(
    'Obsolete Google OAuth routes are completely removed from authRouter and POST /api/auth/firebase is registered',
    registeredRoutePaths.includes('/firebase') &&
      !registeredRoutePaths.some((p: string) => String(p).includes('google'))
  );

  // -------------------------------------------------------------------------
  // 1. EXISTING EMAIL/PASSWORD LOGIN (Admin, Staff, Seeded Member) — TEST S
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Existing Email/Password Login Verification (TEST S) ---');
  const adminLogin = await api('/api/auth/login', 'POST', {
    email: 'admin@coop.com',
    password: 'admin123'
  });
  check('TEST S1: Existing Admin email/password login succeeds', adminLogin.ok && !!adminLogin.data?.token);
  const adminToken = adminLogin.data?.token;

  const staffLogin = await api('/api/auth/login', 'POST', {
    email: 'staff@coop.com',
    password: 'staff123'
  });
  check('TEST S2: Existing Staff email/password login succeeds', staffLogin.ok && !!staffLogin.data?.token);
  const staffToken = staffLogin.data?.token;

  const seededMemberLogin = await api('/api/auth/login', 'POST', {
    email: 'member@coop.com',
    password: 'member123'
  });
  check('TEST S3: Existing seeded Member email/password login succeeds', seededMemberLogin.ok && !!seededMemberLogin.data?.token);

  // Capture baseline financial totals before any Firebase authentication tests
  const dbBaseline = getFreshDb();
  const baselineShareCapital = dbBaseline.members.reduce((sum, m) => sum + (m.shareCapital || 0), 0);
  const baselineRegularSavings = dbBaseline.members.reduce((sum, m) => sum + (m.regularSavings || 0), 0);
  const baselineTimeDeposits = dbBaseline.members.reduce((sum, m) => sum + (m.timeDeposits || 0), 0);
  const baselineDividends = dbBaseline.members.reduce((sum, m) => sum + (m.dividendsEarned || 0), 0);
  const baselineTxCount = dbBaseline.transactions.length;
  const baselineOrCount = (dbBaseline.officialReceipts || []).length;

  // -------------------------------------------------------------------------
  // 2. UNREGISTERED GOOGLE EMAIL REJECTION & NO AUTO-REGISTRATION (TESTS B, C, D)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Unregistered Google Email Rejection & Zero Auto-Creation (TESTS B, C, D) ---');
  const dbBeforeUnreg = getFreshDb();
  const userCountBeforeUnreg = dbBeforeUnreg.users.length;
  const memberCountBeforeUnreg = dbBeforeUnreg.members.length;

  const unregEmail = `unregistered.firebase.${Date.now()}@gmail.com`;
  const unregFirebaseToken = createTestFirebaseIdToken({
    uid: `firebase-uid-unreg-${Date.now()}`,
    email: unregEmail,
    email_verified: true
  });

  const unregRes = await api('/api/auth/firebase', 'POST', {
    idToken: unregFirebaseToken
  });

  check(
    'TEST B1: Unregistered Google email is rejected with HTTP 403',
    unregRes.status === 403,
    `Got status ${unregRes.status}: ${JSON.stringify(unregRes.data)}`
  );
  check(
    'TEST B2: Unregistered Google email returns exact required message',
    unregRes.data?.error ===
      'Your Google account is not registered as a cooperative member. Please register through the Member Registration form first.',
    `Got: ${unregRes.data?.error}`
  );

  const dbAfterUnreg = getFreshDb();
  check(
    'TEST C: No User is created for an unregistered Google account',
    dbAfterUnreg.users.length === userCountBeforeUnreg &&
      !dbAfterUnreg.users.some(u => u.email.toLowerCase() === unregEmail.toLowerCase())
  );
  check(
    'TEST D: No Member is created for an unregistered Google account',
    dbAfterUnreg.members.length === memberCountBeforeUnreg &&
      !dbAfterUnreg.members.some(m => m.email.toLowerCase() === unregEmail.toLowerCase())
  );

  // -------------------------------------------------------------------------
  // 3. PENDING MEMBER REJECTION BEFORE STAFF APPROVAL (TEST E)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. PENDING Member Rejection Before Staff Approval (TEST E) ---');
  const ts = Date.now();
  const testMemberEmail = `firebase.member.${ts}@gmail.com`;
  const testMemberPass = 'MemberPass123!';
  const testFirebaseUid = `firebase-google-uid-${ts}`;

  const regRes = await api('/api/auth/register', 'POST', {
    email: testMemberEmail,
    password: testMemberPass,
    fullName: `Firebase Test Member ${ts}`,
    phone: '09171234567',
    initialShareCapital: 5000,
    address: '123 Cooperative St., Manila',
    birthdate: '1992-06-15',
    gender: 'Female',
    civilStatus: 'Single',
    occupation: 'Accountant',
    monthlyIncome: 45000
  });
  check('Normal member registration succeeds (HTTP 201)', regRes.status === 201);

  const dbAfterReg = getFreshDb();
  const registeredUser = dbAfterReg.users.find(u => u.email.toLowerCase() === testMemberEmail.toLowerCase());
  const registeredMember = dbAfterReg.members.find(m => m.email.toLowerCase() === testMemberEmail.toLowerCase());
  check(
    'Registered member starts with status = PENDING and zero financial balances',
    !!registeredUser &&
      !!registeredMember &&
      registeredMember.status === 'PENDING' &&
      registeredMember.shareCapital === 0 &&
      registeredMember.regularSavings === 0 &&
      registeredMember.timeDeposits === 0
  );

  const memberTokenPayload = createTestFirebaseIdToken({
    uid: testFirebaseUid,
    email: testMemberEmail,
    email_verified: true,
    name: `Firebase Test Member ${ts}`
  });

  const pendingLoginRes = await api('/api/auth/firebase', 'POST', {
    idToken: memberTokenPayload
  });
  check(
    'TEST E: PENDING member is rejected with HTTP 403',
    pendingLoginRes.status === 403 &&
      typeof pendingLoginRes.data?.error === 'string' &&
      pendingLoginRes.data.error.toLowerCase().includes('pending verification'),
    `Got ${pendingLoginRes.status}: ${pendingLoginRes.data?.error}`
  );

  // -------------------------------------------------------------------------
  // 4. STAFF APPROVAL -> ACTIVE -> FIREBASE LOGIN & IDENTITY LINKING (TESTS A, K, L, M, N, O, W)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. ACTIVE Member Firebase Login, Linking, UID Conflict & Token Security (TESTS A, K, L, M, N, O, W) ---');
  const approveRes = await api(
    `/api/users/verify-member/${registeredMember!.id}`,
    'POST',
    {
      action: 'APPROVE',
      reviewNotes: 'Verified for Firebase Google Sign-In test suite'
    },
    staffToken
  );
  check('Staff approval of registered member succeeds (HTTP 200)', approveRes.ok);

  const userCountBeforeLink = getFreshDb().users.length;
  const memberCountBeforeLink = getFreshDb().members.length;

  // Also test that browser-supplied spoofed email/role/memberId/userId in request body are ignored!
  const activeFirebaseLogin = await api('/api/auth/firebase', 'POST', {
    idToken: memberTokenPayload,
    email: 'admin@coop.com',
    role: 'ADMIN',
    memberId: 'spoofed-member-id',
    userId: 'spoofed-user-id'
  });

  check(
    'TEST A: Existing ACTIVE member can authenticate with Firebase Google identity (HTTP 200)',
    activeFirebaseLogin.status === 200 && !!activeFirebaseLogin.data?.token
  );
  check(
    'TEST N: Application JWT and response strictly contain role = MEMBER (browser-supplied role ignored)',
    activeFirebaseLogin.data?.user?.role === 'MEMBER'
  );
  check(
    'TEST O: Correct memberId and userId are resolved server-side (browser-supplied IDs ignored)',
    activeFirebaseLogin.data?.user?.id === registeredUser!.id &&
      activeFirebaseLogin.data?.memberId === registeredMember!.id &&
      activeFirebaseLogin.data?.user?.memberId === registeredMember!.id &&
      activeFirebaseLogin.data?.user?.email.toLowerCase() === testMemberEmail.toLowerCase()
  );

  const decodedAppJwt = jwt.decode(activeFirebaseLogin.data.token) as any;
  check(
    'Application JWT payload structure matches { id, email, role: "MEMBER", memberId }',
    decodedAppJwt?.id === registeredUser!.id &&
      decodedAppJwt?.email.toLowerCase() === testMemberEmail.toLowerCase() &&
      decodedAppJwt?.role === 'MEMBER' &&
      decodedAppJwt?.memberId === registeredMember!.id
  );

  const dbAfterLink = getFreshDb();
  const linkedUser = dbAfterLink.users.find(u => u.id === registeredUser!.id)!;
  const linkedMember = dbAfterLink.members.find(m => m.id === registeredMember!.id)!;

  check(
    'TEST K: Firebase identity links to the correct existing User and Member (firebaseUid, firebaseEmail, firebaseLinkedAt, authProvider = LOCAL+GOOGLE)',
    linkedUser.firebaseUid === testFirebaseUid &&
      linkedUser.firebaseEmail === testMemberEmail.toLowerCase() &&
      Boolean(linkedUser.firebaseLinkedAt) &&
      linkedUser.authProvider === 'LOCAL+GOOGLE' &&
      linkedMember.firebaseUid === testFirebaseUid &&
      linkedMember.firebaseEmail === testMemberEmail.toLowerCase() &&
      Boolean(linkedMember.firebaseLinkedAt) &&
      linkedMember.authProvider === 'LOCAL+GOOGLE'
  );

  // Repeat login to verify idempotent linking and no duplicate records
  const repeatFirebaseLogin = await api('/api/auth/firebase', 'POST', {
    idToken: memberTokenPayload
  });
  const dbAfterRepeat = getFreshDb();
  check(
    'TEST L1: Repeat Firebase login succeeds without creating duplicate User or Member records',
    repeatFirebaseLogin.status === 200 &&
      repeatFirebaseLogin.data?.isFirstLink === false &&
      dbAfterRepeat.users.length === userCountBeforeLink &&
      dbAfterRepeat.members.length === memberCountBeforeLink
  );

  // Test M: Conflicting Firebase UID for the same member email is rejected
  const conflictingUidToken = createTestFirebaseIdToken({
    uid: `conflicting-firebase-uid-${ts}`,
    email: testMemberEmail,
    email_verified: true
  });
  const conflictRes = await api('/api/auth/firebase', 'POST', {
    idToken: conflictingUidToken
  });
  check(
    'TEST M: Conflicting Firebase UID for already-linked member is rejected with HTTP 403',
    conflictRes.status === 403 &&
      typeof conflictRes.data?.error === 'string' &&
      conflictRes.data.error.toLowerCase().includes('conflict')
  );

  // Test W: Verify Firebase ID token is NEVER stored anywhere in the database
  const rawDbString = JSON.stringify(getFreshDb());
  check(
    'TEST W: Firebase ID token is NEVER stored in the database or audit logs',
    !rawDbString.includes(memberTokenPayload) &&
      !rawDbString.includes(conflictingUidToken) &&
      !rawDbString.includes(unregFirebaseToken)
  );

  const googleMemberJwt = activeFirebaseLogin.data.token;

  // -------------------------------------------------------------------------
  // 5. STAFF & ADMIN REJECTION ON FIREBASE ENDPOINT (TESTS I, J)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Staff and Admin Rejection on Member Firebase Endpoint (TESTS I, J) ---');
  const staffFirebaseToken = createTestFirebaseIdToken({
    uid: `firebase-staff-uid-${ts}`,
    email: 'staff@coop.com',
    email_verified: true
  });
  const staffFirebaseRes = await api('/api/auth/firebase', 'POST', {
    idToken: staffFirebaseToken
  });
  check(
    'TEST I: STAFF cannot authenticate through the MEMBER Firebase endpoint (HTTP 403)',
    staffFirebaseRes.status === 403
  );

  const adminFirebaseToken = createTestFirebaseIdToken({
    uid: `firebase-admin-uid-${ts}`,
    email: 'admin@coop.com',
    email_verified: true
  });
  const adminFirebaseRes = await api('/api/auth/firebase', 'POST', {
    idToken: adminFirebaseToken
  });
  check(
    'TEST J: ADMIN cannot authenticate through the MEMBER Firebase endpoint (HTTP 403)',
    adminFirebaseRes.status === 403
  );

  // -------------------------------------------------------------------------
  // 6. CROSS-MEMBER DATA ISOLATION & RBAC ENFORCEMENT (TEST P)
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Cross-Member Security & Server-Side RBAC Enforcement (TEST P) ---');
  const otherMember = getFreshDb().members.find(m => m.id !== registeredMember!.id)!;

  const ownSavingsRes = await api('/api/savings/ledger', 'GET', undefined, googleMemberJwt);
  check('Firebase-authenticated member can access their own savings ledger (HTTP 200)', ownSavingsRes.status === 200);

  const otherProfileRes = await api(`/api/members/${otherMember.id}`, 'GET', undefined, googleMemberJwt);
  const otherSavingsRes = await api(`/api/savings/ledger?memberId=${otherMember.id}`, 'GET', undefined, googleMemberJwt);
  const otherReceiptsRes = await api(`/api/receipts?memberId=${otherMember.id}`, 'GET', undefined, googleMemberJwt);
  const staffAnalyticsRes = await api('/api/analytics/descriptive', 'GET', undefined, googleMemberJwt);

  check(
    'TEST P: Cross-member profile, savings ledger, official receipts, and staff analytics access all return HTTP 403',
    otherProfileRes.status === 403 &&
      otherSavingsRes.status === 403 &&
      otherReceiptsRes.status === 403 &&
      staffAnalyticsRes.status === 403,
    `Statuses: profile=${otherProfileRes.status}, savings=${otherSavingsRes.status}, receipts=${otherReceiptsRes.status}, analytics=${staffAnalyticsRes.status}`
  );

  // -------------------------------------------------------------------------
  // 7. ACCOUNT STATUS ENFORCEMENT: SUSPENDED, DEACTIVATED, REJECTED (TESTS F, G, H)
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Account Status Enforcement: SUSPENDED, DEACTIVATED, REJECTED (TESTS F, G, H) ---');

  // Suspend member
  const suspendRes = await api(
    `/api/users/members/${registeredMember!.id}/status`,
    'PUT',
    { status: 'SUSPENDED' },
    adminToken
  );
  check('Admin suspends test member (HTTP 200)', suspendRes.ok);

  const suspendedFirebaseRes = await api('/api/auth/firebase', 'POST', {
    idToken: memberTokenPayload
  });
  check(
    'TEST F: SUSPENDED member is rejected with HTTP 403',
    suspendedFirebaseRes.status === 403 &&
      typeof suspendedFirebaseRes.data?.error === 'string' &&
      suspendedFirebaseRes.data.error.toLowerCase().includes('suspended')
  );

  // Deactivate member
  const deactivateRes = await api(
    `/api/users/members/${registeredMember!.id}/status`,
    'PUT',
    { status: 'DEACTIVATED' },
    adminToken
  );
  check('Admin deactivates test member (HTTP 200)', deactivateRes.ok);

  const deactivatedFirebaseRes = await api('/api/auth/firebase', 'POST', {
    idToken: memberTokenPayload
  });
  check(
    'TEST G: DEACTIVATED member is rejected with HTTP 403',
    deactivatedFirebaseRes.status === 403 &&
      typeof deactivatedFirebaseRes.data?.error === 'string' &&
      deactivatedFirebaseRes.data.error.toLowerCase().includes('deactivated')
  );

  // Register and reject a member to verify REJECTED status (TEST H)
  const rejectedEmail = `firebase.rejected.${ts}@gmail.com`;
  await api('/api/auth/register', 'POST', {
    email: rejectedEmail,
    password: 'RejectedPass123!',
    fullName: `Rejected Firebase Member ${ts}`,
    phone: '09179998888',
    initialShareCapital: 2000
  });
  const rejectedMemberRecord = getFreshDb().members.find(m => m.email.toLowerCase() === rejectedEmail.toLowerCase())!;
  await api(
    `/api/users/verify-member/${rejectedMemberRecord.id}`,
    'POST',
    { action: 'REJECT', rejectionReason: 'Incomplete requirements for test H' },
    staffToken
  );

  const rejectedFirebaseToken = createTestFirebaseIdToken({
    uid: `firebase-rejected-uid-${ts}`,
    email: rejectedEmail,
    email_verified: true
  });
  const rejectedFirebaseRes = await api('/api/auth/firebase', 'POST', {
    idToken: rejectedFirebaseToken
  });
  check(
    'TEST H: REJECTED member is rejected with HTTP 403',
    rejectedFirebaseRes.status === 403 &&
      typeof rejectedFirebaseRes.data?.error === 'string' &&
      rejectedFirebaseRes.data.error.toLowerCase().includes('rejected')
  );

  // Reactivate test member back to ACTIVE
  const reactivateRes = await api(
    `/api/users/members/${registeredMember!.id}/status`,
    'PUT',
    { status: 'ACTIVE' },
    adminToken
  );
  check('Admin reactivates test member to ACTIVE (HTTP 200)', reactivateRes.ok);

  // Verify existing email/password login still works for this Firebase-linked member (TEST S4)
  const memberPasswordLoginRes = await api('/api/auth/login', 'POST', {
    email: testMemberEmail,
    password: testMemberPass
  });
  check(
    'TEST S4: Existing email/password login still works for Firebase-linked member (HTTP 200)',
    memberPasswordLoginRes.status === 200 && !!memberPasswordLoginRes.data?.token
  );

  // -------------------------------------------------------------------------
  // 8. EXISTING FORGOT-PASSWORD OTP FLOW FOR FIREBASE-LINKED MEMBER (TEST T)
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Existing Forgot-Password OTP Flow Coexistence (TEST T) ---');
  const forgotRes = await api(
    '/api/auth/forgot-password',
    'POST',
    { email: testMemberEmail },
    undefined,
    { 'x-test-email-transport': 'mock' }
  );
  const otpFromOutbox = getDispatchedOtpFromOutbox(testMemberEmail);
  check(
    'TEST T1: Forgot-password OTP request succeeds and dispatches 6-digit OTP via email transport',
    forgotRes.status === 200 && !!otpFromOutbox && /^\d{6}$/.test(otpFromOutbox)
  );

  const verifyOtpRes = await api('/api/auth/verify-reset-otp', 'POST', {
    email: testMemberEmail,
    otp: otpFromOutbox
  });
  check(
    'TEST T2: Verify OTP succeeds and issues single-use resetToken',
    verifyOtpRes.status === 200 && !!verifyOtpRes.data?.resetToken
  );

  const newStrongPass = 'FirebaseResetPass789!';
  const resetPassRes = await api('/api/auth/reset-password', 'POST', {
    email: testMemberEmail,
    resetToken: verifyOtpRes.data.resetToken,
    newPassword: newStrongPass,
    confirmPassword: newStrongPass
  });
  check('TEST T3: Password reset completes successfully (HTTP 200)', resetPassRes.status === 200);

  const loginAfterResetRes = await api('/api/auth/login', 'POST', {
    email: testMemberEmail,
    password: newStrongPass
  });
  const firebaseAfterResetRes = await api('/api/auth/firebase', 'POST', {
    idToken: memberTokenPayload
  });
  check(
    'TEST T4: Both new password login and Firebase Google Sign-In work after password reset',
    loginAfterResetRes.status === 200 && firebaseAfterResetRes.status === 200
  );

  // -------------------------------------------------------------------------
  // 9. INVALID / TAMPERED / EXPIRED FIREBASE TOKENS REJECTED (TEST V)
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Invalid, Tampered, and Expired Firebase Token Rejection (TEST V) ---');
  const missingTokenRes = await api('/api/auth/firebase', 'POST', {});
  const malformedTokenRes = await api('/api/auth/firebase', 'POST', { idToken: 'not-a-valid-jwt' });
  const tamperedSignatureToken = memberTokenPayload.slice(0, -5) + 'abcde';
  const tamperedTokenRes = await api('/api/auth/firebase', 'POST', { idToken: tamperedSignatureToken });
  const wrongSecretToken = createTestFirebaseIdToken(
    { uid: testFirebaseUid, email: testMemberEmail, email_verified: true },
    { secretOverride: 'wrong-attacker-secret-key' }
  );
  const wrongSecretRes = await api('/api/auth/firebase', 'POST', { idToken: wrongSecretToken });
  const expiredToken = createTestFirebaseIdToken(
    { uid: testFirebaseUid, email: testMemberEmail, email_verified: true },
    { expiresInSeconds: -60 }
  );
  const expiredTokenRes = await api('/api/auth/firebase', 'POST', { idToken: expiredToken });

  check(
    'TEST V: Missing, malformed, tampered, wrong-signature, and expired Firebase ID tokens are all rejected with HTTP 401',
    missingTokenRes.status === 401 &&
      malformedTokenRes.status === 401 &&
      tamperedTokenRes.status === 401 &&
      wrongSecretRes.status === 401 &&
      expiredTokenRes.status === 401
  );

  // -------------------------------------------------------------------------
  // 10. FINANCIAL INVARIANCE & AUDIT LOGGING VERIFICATION (TESTS Q, R, U)
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Financial Invariance & Audit Logging Verification (TESTS Q, R, U) ---');
  const finalDb = getFreshDb();
  const finalShareCapital = finalDb.members.reduce((sum, m) => sum + (m.shareCapital || 0), 0);
  const finalRegularSavings = finalDb.members.reduce((sum, m) => sum + (m.regularSavings || 0), 0);
  const finalTimeDeposits = finalDb.members.reduce((sum, m) => sum + (m.timeDeposits || 0), 0);
  const finalDividends = finalDb.members.reduce((sum, m) => sum + (m.dividendsEarned || 0), 0);
  const finalTxCount = finalDb.transactions.length;
  const finalOrCount = (finalDb.officialReceipts || []).length;

  check(
    'TEST Q: Firebase login creates zero financial transactions and leaves all balances unchanged',
    finalTxCount === baselineTxCount &&
      finalShareCapital === baselineShareCapital &&
      finalRegularSavings === baselineRegularSavings &&
      finalTimeDeposits === baselineTimeDeposits &&
      finalDividends === baselineDividends
  );
  check(
    'TEST R: Firebase login creates zero Official Receipts',
    finalOrCount === baselineOrCount
  );

  const auditActions = new Set(finalDb.auditLogs.map(a => a.action));
  check(
    'TEST U: Audit log records FIREBASE_GOOGLE_LOGIN_SUCCESS, FIREBASE_GOOGLE_ACCOUNT_LINKED, FIREBASE_GOOGLE_LOGIN_UNREGISTERED_REJECTED, FIREBASE_GOOGLE_LOGIN_PENDING_REJECTED, FIREBASE_GOOGLE_LOGIN_SUSPENDED_REJECTED, FIREBASE_GOOGLE_LOGIN_INACTIVE_REJECTED, FIREBASE_GOOGLE_LOGIN_FAILED',
    auditActions.has('FIREBASE_GOOGLE_LOGIN_SUCCESS') &&
      auditActions.has('FIREBASE_GOOGLE_ACCOUNT_LINKED') &&
      auditActions.has('FIREBASE_GOOGLE_LOGIN_UNREGISTERED_REJECTED') &&
      auditActions.has('FIREBASE_GOOGLE_LOGIN_PENDING_REJECTED') &&
      auditActions.has('FIREBASE_GOOGLE_LOGIN_SUSPENDED_REJECTED') &&
      auditActions.has('FIREBASE_GOOGLE_LOGIN_INACTIVE_REJECTED') &&
      auditActions.has('FIREBASE_GOOGLE_LOGIN_FAILED')
  );

  console.log('\n======================================================================');
  console.log(`FIREBASE GOOGLE SIGN-IN SUITE SUMMARY: ${passed} / ${passed + failed} checks passed`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFirebaseGoogleSignInSuite().catch(err => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});

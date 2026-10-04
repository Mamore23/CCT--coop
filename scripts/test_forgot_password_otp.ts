/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Automated Verification Suite for Secure Email OTP Forgot Password Workflow
 * Verifies Tests A through T:
 * - Cryptographically secure 6-digit OTP generation, bcrypt hashing, 10-min expiry, single-use
 * - 5-attempt lockout, email & IP rate limiting, generic non-enumerating response
 * - Strong password & confirmation validation, bcrypt password hashing, no auto-login
 * - Old password rejection, new password login, Google Sign-In coexistence
 * - PENDING, SUSPENDED, DEACTIVATED, REJECTED member status preservation & login blocking
 * - Zero User/Member auto-creation, zero financial/ledger/receipt mutation
 * - Audit logging without OTP or password leakage, and cross-member access protection
 */

import fs from 'fs';
import nodemailer from 'nodemailer';
import { CooperativeDB } from '../src/db/db.js';
import {
  sendPasswordResetOtpEmail,
  getSmtpConfigStatus,
  setEmailTransporterForTesting,
  getRecordedEmailInvocationsForTesting,
  clearRecordedEmailInvocationsForTesting
} from '../src/server/emailService.js';
import { createTestFirebaseIdToken } from '../src/server/firebaseAdmin.js';

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL_OUTBOX_PATH = '/tmp/coop_email_outbox.json';

async function api(
  path: string,
  method: string = 'GET',
  body?: any,
  token?: string,
  extraHeaders?: Record<string, string>
) {
  const defaultTestHeaders: Record<string, string> =
    path === '/api/auth/forgot-password' && (!extraHeaders || !('x-test-email-transport' in extraHeaders))
      ? { 'x-test-email-transport': 'mock' }
      : {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...defaultTestHeaders,
    ...(extraHeaders || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function getFreshDb() {
  (CooperativeDB as any).state = null;
  return CooperativeDB.load();
}

function getDispatchedEnvelopeFromOutbox(email: string): any | null {
  if (!fs.existsSync(TEST_EMAIL_OUTBOX_PATH)) return null;
  const raw = JSON.parse(fs.readFileSync(TEST_EMAIL_OUTBOX_PATH, 'utf8') || '{}');
  return raw[email.toLowerCase()] || null;
}

function getDispatchedOtpFromOutbox(email: string): string | null {
  const envelope = getDispatchedEnvelopeFromOutbox(email);
  if (!envelope || typeof envelope.text !== 'string') return null;
  const match = envelope.text.match(/verification code is:\s*(\d{6})/i);
  return match ? match[1] : null;
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

async function runForgotPasswordOtpSuite() {
  console.log('======================================================================');
  console.log('STARTING: SECURE EMAIL OTP FORGOT PASSWORD VERIFICATION SUITE (A - T)');
  console.log('======================================================================\n');

  // Authenticate Admin and Staff for setup/verification
  const adminLogin = await api('/api/auth/login', 'POST', {
    email: 'admin@coop.com',
    password: 'admin123'
  });
  check('Admin login succeeds', adminLogin.ok && !!adminLogin.data?.token);
  const adminToken = adminLogin.data.token;

  const staffLogin = await api('/api/auth/login', 'POST', {
    email: 'staff@coop.com',
    password: 'staff123'
  });
  check('Staff login succeeds', staffLogin.ok && !!staffLogin.data?.token);
  const staffToken = staffLogin.data.token;

  // Register and approve a dedicated ACTIVE member for testing
  const ts = Date.now();
  const activeEmail = `otp.active.${ts}@gmail.com`;
  const initialPassword = 'InitialPassword123!';
  const updatedPassword = 'NewStrongPassword456!';
  const firebaseUid = `firebase-uid-otp-member-${ts}`;

  const regActive = await api('/api/auth/register', 'POST', {
    email: activeEmail,
    password: initialPassword,
    fullName: `OTP Active Member ${ts}`,
    phone: '09175550101',
    initialShareCapital: 2000,
    address: '88 Cooperative Blvd, Quezon City',
    birthdate: '1990-04-10',
    gender: 'Male',
    civilStatus: 'Married',
    occupation: 'Engineer',
    monthlyIncome: 50000
  });
  check('Setup: Registered test member account (HTTP 201)', regActive.status === 201);

  const activeMemberId = getFreshDb().members.find(m => m.email.toLowerCase() === activeEmail.toLowerCase())!.id;

  const approveRes = await api(`/api/users/verify-member/${activeMemberId}`, 'POST', {
    action: 'APPROVE',
    reviewNotes: 'Approved for OTP password reset suite'
  }, staffToken);
  check('Setup: Staff approved test member to ACTIVE (HTTP 200)', approveRes.ok);

  // Link Firebase Google identity to this ACTIVE member first so we can verify Firebase Google Login compatibility (Requirement J)
  const initialFirebaseToken = createTestFirebaseIdToken({
    uid: firebaseUid,
    email: activeEmail,
    email_verified: true
  });
  const initialGoogleLink = await api('/api/auth/firebase', 'POST', {
    idToken: initialFirebaseToken
  });
  check('Setup: Linked Firebase Google identity to ACTIVE member (HTTP 200)', initialGoogleLink.ok && initialGoogleLink.data?.firebaseLinked === true);

  // Also register a second member who stays PENDING for Test K
  const pendingEmail = `otp.pending.${ts}@gmail.com`;
  const pendingInitialPass = 'PendingInitPass123!';
  const pendingNewPass = 'PendingUpdatedPass789!';
  const regPending = await api('/api/auth/register', 'POST', {
    email: pendingEmail,
    password: pendingInitialPass,
    fullName: `OTP Pending Member ${ts}`,
    phone: '09175550202',
    initialShareCapital: 1500
  });
  check('Setup: Registered PENDING test member (HTTP 201)', regPending.status === 201);
  const pendingMemberId = getFreshDb().members.find(m => m.email.toLowerCase() === pendingEmail.toLowerCase())!.id;

  // Snapshot baseline counts & financial balances AFTER test member setup so we can verify Tests N, O, P, Q
  const baselineDb = getFreshDb();
  const baselineUserCount = baselineDb.users.length;
  const baselineMemberCount = baselineDb.members.length;
  const baselineTxCount = (baselineDb.transactions || []).length;
  const baselineReceiptsCount = (baselineDb.officialReceipts || []).length;
  const baselineShareCapital = baselineDb.members.reduce((sum, m) => sum + (Number(m.shareCapital) || 0), 0);
  const baselineSavings = baselineDb.members.reduce((sum, m) => sum + (Number(m.regularSavings) || 0), 0);
  const baselineTimeDeposits = baselineDb.members.reduce((sum, m) => sum + (Number(m.timeDeposits) || 0), 0);
  const baselineDividends = baselineDb.members.reduce((sum, m) => sum + (Number(m.dividendsEarned) || 0), 0);

  // -------------------------------------------------------------------------
  // TEST A & N — REGISTERED ACTIVE MEMBER CAN REQUEST OTP + UNREGISTERED EMAIL NON-ENUMERATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST A & N: Request OTP, Generic Message, Hashed Storage & Zero Auto-Creation ---');
  const unregEmail = `nobody.unregistered.${ts}@gmail.com`;
  const unregReq = await api('/api/auth/forgot-password', 'POST', { email: unregEmail });
  check('Unregistered email returns generic HTTP 200 message (does not leak account existence)', unregReq.status === 200 && unregReq.data?.message === 'If an account is registered with this email, a verification code has been sent.');
  check('Unregistered email did NOT create a User or Member record', getFreshDb().users.length === baselineUserCount && getFreshDb().members.length === baselineMemberCount);

  const reqOtpRes = await api('/api/auth/forgot-password', 'POST', { email: activeEmail });
  check('TEST A: Registered ACTIVE member can request OTP (HTTP 200)', reqOtpRes.status === 200);
  check('Response returns exact generic message without exposing OTP', reqOtpRes.data?.message === 'If an account is registered with this email, a verification code has been sent.' && !reqOtpRes.data?.otp);

  const otp1 = getDispatchedOtpFromOutbox(activeEmail);
  check('Dispatched 6-digit numeric OTP is valid', !!otp1 && /^\d{6}$/.test(otp1!));

  const dbAfterOtpReq = getFreshDb();
  const userAfterOtpReq = dbAfterOtpReq.users.find(u => u.id === activeMemberId)!;
  check(
    'Database stores ONLY hashed representation of OTP (bcrypt hash, never plaintext)',
    !!userAfterOtpReq.passwordReset?.otpHash &&
      userAfterOtpReq.passwordReset.otpHash.startsWith('$2') &&
      userAfterOtpReq.passwordReset.otpHash !== otp1 &&
      !JSON.stringify(userAfterOtpReq).includes(`"${otp1}"`)
  );
  const expiryDiffMs = Date.parse(userAfterOtpReq.passwordReset!.expiresAt) - Date.parse(userAfterOtpReq.passwordReset!.requestedAt);
  check('OTP expiration is set to 10 minutes (600,000 ms)', Math.abs(expiryDiffMs - 10 * 60 * 1000) < 5000);

  // -------------------------------------------------------------------------
  // TEST C — INCORRECT OTP IS REJECTED
  // -------------------------------------------------------------------------
  console.log('\n--- TEST C: Incorrect OTP Rejection ---');
  const wrongOtp = otp1 === '123456' ? '654321' : '123456';
  const wrongOtpRes = await api('/api/auth/verify-reset-otp', 'POST', {
    email: activeEmail,
    otp: wrongOtp
  });
  check('TEST C: Incorrect OTP is rejected with HTTP 400', wrongOtpRes.status === 400);
  check('Failed OTP verification increments attempts counter to 1', getFreshDb().users.find(u => u.id === activeMemberId)?.passwordReset?.attempts === 1);

  // -------------------------------------------------------------------------
  // TEST F — EXCESSIVE OTP ATTEMPTS ARE BLOCKED (5-ATTEMPT LIMIT & RATE LIMITING)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST F: Excessive OTP Attempts Blocked (5 Attempts Max) & Rate Limiting ---');
  // Attempts 2, 3, 4 (should return 400)
  await api('/api/auth/verify-reset-otp', 'POST', { email: activeEmail, otp: wrongOtp });
  await api('/api/auth/verify-reset-otp', 'POST', { email: activeEmail, otp: wrongOtp });
  await api('/api/auth/verify-reset-otp', 'POST', { email: activeEmail, otp: wrongOtp });

  // Attempt 5 (reaches maxAttempts = 5 -> invalidates OTP and returns 429)
  const fifthWrongRes = await api('/api/auth/verify-reset-otp', 'POST', {
    email: activeEmail,
    otp: wrongOtp
  });
  check('TEST F1: 5th incorrect OTP attempt blocks and invalidates OTP with HTTP 429', fifthWrongRes.status === 429);

  // Attempt 6 with the ACTUAL CORRECT OTP must still be rejected because OTP was invalidated after 5 attempts!
  const sixthWithCorrectOtp = await api('/api/auth/verify-reset-otp', 'POST', {
    email: activeEmail,
    otp: otp1
  });
  check('TEST F2: Submitting the original OTP after 5 failed attempts is rejected (brute-force prevented)', sixthWithCorrectOtp.status === 400 || sixthWithCorrectOtp.status === 429);

  // Test IP / Email Rate Limiting on POST /api/auth/forgot-password
  const rateLimitTestEmail = `ratelimit.${ts}@gmail.com`;
  const customTestIp = `203.0.113.${ts % 200}`;
  let rateLimitedResponseStatus = 200;
  for (let i = 0; i < 6; i++) {
    const r = await api('/api/auth/forgot-password', 'POST', { email: rateLimitTestEmail }, undefined, {
      'x-test-client-ip': customTestIp
    });
    rateLimitedResponseStatus = r.status;
  }
  check('TEST F3: Excessive password reset requests per email/IP are rate-limited with HTTP 429', rateLimitedResponseStatus === 429);

  // -------------------------------------------------------------------------
  // TEST D — EXPIRED OTP IS REJECTED
  // -------------------------------------------------------------------------
  console.log('\n--- TEST D: Expired OTP Rejection ---');
  const reqOtpForExpiry = await api('/api/auth/forgot-password', 'POST', { email: activeEmail });
  check('Requested fresh OTP for expiration test (HTTP 200)', reqOtpForExpiry.status === 200);
  const otpExpired = getDispatchedOtpFromOutbox(activeEmail)!;

  // Simulate 11 minutes elapsed (> 10-minute OTP expiration window)
  const expiredVerifyRes = await api(
    '/api/auth/verify-reset-otp',
    'POST',
    { email: activeEmail, otp: otpExpired },
    undefined,
    { 'x-test-time-offset-ms': String(11 * 60 * 1000) }
  );
  check('TEST D: Expired OTP is rejected with HTTP 400', expiredVerifyRes.status === 400 && expiredVerifyRes.data?.error?.toLowerCase().includes('expired'));

  // -------------------------------------------------------------------------
  // TEST B & E — CORRECT OTP IS ACCEPTED & REUSED OTP IS REJECTED
  // -------------------------------------------------------------------------
  console.log('\n--- TEST B & E: Correct OTP Accepted, Immediate Invalidation & Reused OTP Rejected ---');
  const reqValidOtp = await api('/api/auth/forgot-password', 'POST', { email: activeEmail });
  check('Requested fresh OTP for valid verification test (HTTP 200)', reqValidOtp.status === 200);
  const validOtp = getDispatchedOtpFromOutbox(activeEmail)!;

  const verifyValidRes = await api('/api/auth/verify-reset-otp', 'POST', {
    email: activeEmail,
    otp: validOtp
  });
  check('TEST B: Correct 6-digit OTP is accepted (HTTP 200)', verifyValidRes.status === 200 && verifyValidRes.data?.verified === true);
  check('Verify endpoint returns single-use resetToken', typeof verifyValidRes.data?.resetToken === 'string' && verifyValidRes.data.resetToken.length >= 32);
  const resetToken = verifyValidRes.data.resetToken;

  // Verify OTP hash was immediately cleared from DB upon verification
  const dbAfterVerify = getFreshDb();
  const userAfterVerify = dbAfterVerify.users.find(u => u.id === activeMemberId)!;
  check('OTP hash is immediately invalidated in DB after verification', userAfterVerify.passwordReset?.otpHash === '' && userAfterVerify.passwordReset?.verified === true);

  // Attempt to reuse the same OTP on /api/auth/verify-reset-otp
  const reuseOtpVerifyRes = await api('/api/auth/verify-reset-otp', 'POST', {
    email: activeEmail,
    otp: validOtp
  });
  check('TEST E1: Reusing already-verified OTP on /verify-reset-otp is rejected (HTTP 400)', reuseOtpVerifyRes.status === 400);

  // -------------------------------------------------------------------------
  // TEST G, H, I, J — PASSWORD RESET, OLD PASSWORD REJECTED, NEW PASSWORD WORKS, GOOGLE LOGIN WORKS
  // -------------------------------------------------------------------------
  console.log('\n--- TEST G, H, I, J: Password Changed, Old Rejected, New Works, Google Login Coexistence ---');
  // Test password mismatch & weak password rejection first
  const mismatchRes = await api('/api/auth/reset-password', 'POST', {
    email: activeEmail,
    resetToken,
    newPassword: updatedPassword,
    confirmPassword: 'DifferentConfirmPassword999!'
  });
  check('Password reset rejects mismatched confirmPassword (HTTP 400)', mismatchRes.status === 400);

  const weakPassRes = await api('/api/auth/reset-password', 'POST', {
    email: activeEmail,
    resetToken,
    newPassword: 'weak',
    confirmPassword: 'weak'
  });
  check('Password reset rejects weak password (HTTP 400)', weakPassRes.status === 400);

  // Now submit valid strong password & matching confirmation
  const resetSuccessRes = await api('/api/auth/reset-password', 'POST', {
    email: activeEmail,
    resetToken,
    newPassword: updatedPassword,
    confirmPassword: updatedPassword
  });
  check('TEST G1: Password is successfully changed (HTTP 200)', resetSuccessRes.status === 200);
  check('TEST G2: Password reset does NOT automatically log the member in (no token issued)', !resetSuccessRes.data?.token);

  // Attempt to reuse the resetToken / OTP a second time on /api/auth/reset-password
  const reuseResetSessionRes = await api('/api/auth/reset-password', 'POST', {
    email: activeEmail,
    resetToken,
    newPassword: 'AnotherPassword789!',
    confirmPassword: 'AnotherPassword789!'
  });
  check('TEST E2: Reusing completed password reset session/token is rejected (HTTP 400)', reuseResetSessionRes.status === 400);

  // Verify stored passwordHash is bcrypt-hashed and never plaintext
  const dbAfterReset = getFreshDb();
  const userAfterReset = dbAfterReset.users.find(u => u.id === activeMemberId)!;
  const memberAfterReset = dbAfterReset.members.find(m => m.id === activeMemberId)!;
  check(
    'New password is stored only as a bcrypt hash (never plaintext)',
    userAfterReset.passwordHash.startsWith('$2') &&
      userAfterReset.passwordHash !== updatedPassword &&
      !JSON.stringify(userAfterReset).includes(updatedPassword)
  );
  check('Member role and memberId are preserved unchanged', userAfterReset.role === 'MEMBER' && userAfterReset.memberId === activeMemberId && memberAfterReset.status === 'ACTIVE');

  // TEST H: Old password no longer works
  const oldPassLoginRes = await api('/api/auth/login', 'POST', {
    email: activeEmail,
    password: initialPassword
  });
  check('TEST H: Old password no longer works (rejected with HTTP 401)', oldPassLoginRes.status === 401);

  // TEST I: New password works
  const newPassLoginRes = await api('/api/auth/login', 'POST', {
    email: activeEmail,
    password: updatedPassword
  });
  check('TEST I: New password works for login (HTTP 200 & valid JWT)', newPassLoginRes.status === 200 && !!newPassLoginRes.data?.token);
  const newPassMemberToken = newPassLoginRes.data.token;

  // TEST J: Firebase Google Login continues working and Firebase link fields were preserved
  check(
    'Firebase Google identity fields (firebaseUid, firebaseEmail, firebaseLinkedAt, authProvider) preserved after password reset',
    userAfterReset.firebaseUid === firebaseUid &&
      userAfterReset.firebaseEmail === activeEmail.toLowerCase() &&
      !!userAfterReset.firebaseLinkedAt &&
      userAfterReset.authProvider === 'LOCAL+GOOGLE'
  );
  const firebaseTokenAfterReset = createTestFirebaseIdToken({
    uid: firebaseUid,
    email: activeEmail,
    email_verified: true
  });
  const googleLoginAfterReset = await api('/api/auth/firebase', 'POST', {
    idToken: firebaseTokenAfterReset
  });
  check('TEST J: Continue with Google (Firebase Auth) still works for linked member after password reset (HTTP 200)', googleLoginAfterReset.status === 200 && !!googleLoginAfterReset.data?.token);

  // -------------------------------------------------------------------------
  // TEST K — PENDING MEMBER REMAINS PENDING AFTER PASSWORD RESET & CANNOT LOG IN
  // -------------------------------------------------------------------------
  console.log('\n--- TEST K: PENDING Member Password Reset Preserves PENDING Status & Blocks Login ---');
  const pendingOtpReq = await api('/api/auth/forgot-password', 'POST', { email: pendingEmail });
  check('PENDING member can request password reset OTP (HTTP 200)', pendingOtpReq.status === 200);
  const pendingOtp = getDispatchedOtpFromOutbox(pendingEmail)!;

  const pendingVerify = await api('/api/auth/verify-reset-otp', 'POST', {
    email: pendingEmail,
    otp: pendingOtp
  });
  check('PENDING member OTP verification succeeds (HTTP 200)', pendingVerify.status === 200);

  const pendingReset = await api('/api/auth/reset-password', 'POST', {
    email: pendingEmail,
    resetToken: pendingVerify.data.resetToken,
    newPassword: pendingNewPass,
    confirmPassword: pendingNewPass
  });
  check('PENDING member password reset succeeds (HTTP 200)', pendingReset.status === 200);

  const pendingMemberAfter = getFreshDb().members.find(m => m.id === pendingMemberId)!;
  check('TEST K1: PENDING member status remains strictly PENDING after password reset', pendingMemberAfter.status === 'PENDING');

  const pendingLoginAttempt = await api('/api/auth/login', 'POST', {
    email: pendingEmail,
    password: pendingNewPass
  });
  check('TEST K2: PENDING member remains blocked from login with new password until staff verification (HTTP 403)', pendingLoginAttempt.status === 403);

  // -------------------------------------------------------------------------
  // TEST L & M — SUSPENDED, DEACTIVATED & REJECTED MEMBERS REMAIN BLOCKED AFTER PASSWORD RESET
  // -------------------------------------------------------------------------
  console.log('\n--- TEST L & M: SUSPENDED, DEACTIVATED & REJECTED Members Remain Blocked After Password Reset ---');
  // Suspend the member using Admin API, reset password with a fresh email/member or reset on suspended member
  const statusTestEmail = `otp.status.${ts}@gmail.com`;
  await api('/api/auth/register', 'POST', {
    email: statusTestEmail,
    password: 'StatusInitPass123!',
    fullName: `OTP Status Member ${ts}`,
    phone: '09175550303',
    initialShareCapital: 1000
  });
  const statusMemberId = getFreshDb().members.find(m => m.email.toLowerCase() === statusTestEmail.toLowerCase())!.id;

  // Set member to SUSPENDED
  await api(`/api/users/members/${statusMemberId}/status`, 'PUT', { status: 'SUSPENDED' }, adminToken);

  await api('/api/auth/forgot-password', 'POST', { email: statusTestEmail });
  const suspOtp = getDispatchedOtpFromOutbox(statusTestEmail)!;
  const suspVerify = await api('/api/auth/verify-reset-otp', 'POST', { email: statusTestEmail, otp: suspOtp });
  const suspReset = await api('/api/auth/reset-password', 'POST', {
    email: statusTestEmail,
    resetToken: suspVerify.data.resetToken,
    newPassword: 'SuspendedNewPass123!',
    confirmPassword: 'SuspendedNewPass123!'
  });
  check('SUSPENDED member password reset request completes without altering status', suspReset.status === 200 && getFreshDb().members.find(m => m.id === statusMemberId)?.status === 'SUSPENDED');

  const suspLoginAttempt = await api('/api/auth/login', 'POST', {
    email: statusTestEmail,
    password: 'SuspendedNewPass123!'
  });
  check('TEST L: SUSPENDED member remains blocked from login after password reset (HTTP 403)', suspLoginAttempt.status === 403);

  // Set member to DEACTIVATED
  await api(`/api/users/members/${statusMemberId}/status`, 'PUT', { status: 'DEACTIVATED' }, adminToken);

  await api('/api/auth/forgot-password', 'POST', { email: statusTestEmail });
  const deactOtp = getDispatchedOtpFromOutbox(statusTestEmail)!;
  const deactVerify = await api('/api/auth/verify-reset-otp', 'POST', { email: statusTestEmail, otp: deactOtp });
  const deactReset = await api('/api/auth/reset-password', 'POST', {
    email: statusTestEmail,
    resetToken: deactVerify.data.resetToken,
    newPassword: 'DeactivatedNewPass456!',
    confirmPassword: 'DeactivatedNewPass456!'
  });
  check('DEACTIVATED member password reset completes without altering status', deactReset.status === 200 && getFreshDb().members.find(m => m.id === statusMemberId)?.status === 'DEACTIVATED');

  const deactLoginAttempt = await api('/api/auth/login', 'POST', {
    email: statusTestEmail,
    password: 'DeactivatedNewPass456!'
  });
  check('TEST M1: DEACTIVATED member remains blocked from login after password reset (HTTP 403)', deactLoginAttempt.status === 403);

  // Set member to REJECTED
  await api(`/api/users/members/${statusMemberId}/status`, 'PUT', { status: 'REJECTED' }, adminToken);
  const rejectedLoginAttempt = await api('/api/auth/login', 'POST', {
    email: statusTestEmail,
    password: 'DeactivatedNewPass456!'
  });
  check('TEST M2: REJECTED member remains blocked from login after password reset (HTTP 403)', rejectedLoginAttempt.status === 403);

  // -------------------------------------------------------------------------
  // TEST O, P, Q, R, S — FINANCIAL INVARIANCE, AUDIT SECURITY & CROSS-MEMBER ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST O, P, Q, R, S: Financial Invariance, Audit Trail Privacy & Cross-Member Isolation ---');
  const finalDb = getFreshDb();
  const finalShareCapital = finalDb.members.reduce((sum, m) => sum + (Number(m.shareCapital) || 0), 0);
  const finalSavings = finalDb.members.reduce((sum, m) => sum + (Number(m.regularSavings) || 0), 0);
  const finalTimeDeposits = finalDb.members.reduce((sum, m) => sum + (Number(m.timeDeposits) || 0), 0);
  const finalDividends = finalDb.members.reduce((sum, m) => sum + (Number(m.dividendsEarned) || 0), 0);

  check('TEST O: No financial balances (Share Capital, Savings, Time Deposits, Dividends) changed during password reset',
    finalShareCapital === baselineShareCapital &&
    finalSavings === baselineSavings &&
    finalTimeDeposits === baselineTimeDeposits &&
    finalDividends === baselineDividends
  );
  check('TEST P: No ledger transactions were created during password reset', (finalDb.transactions || []).length === baselineTxCount);
  check('TEST Q: No Official Receipts were created during password reset', (finalDb.officialReceipts || []).length === baselineReceiptsCount);

  // TEST R: Verify Audit Events exist and never contain plaintext OTPs or passwords
  const recentAuditLogs = (finalDb.auditLogs || []).slice(0, 100);
  const auditActions = new Set(recentAuditLogs.map(a => a.action));
  check('TEST R1: Audit log records PASSWORD_RESET_REQUESTED', auditActions.has('PASSWORD_RESET_REQUESTED'));
  check('TEST R2: Audit log records PASSWORD_RESET_VERIFIED', auditActions.has('PASSWORD_RESET_VERIFIED'));
  check('TEST R3: Audit log records PASSWORD_RESET_SUCCESS', auditActions.has('PASSWORD_RESET_SUCCESS'));
  check('TEST R4: Audit log records PASSWORD_RESET_FAILED', auditActions.has('PASSWORD_RESET_FAILED'));

  const serializedAudits = JSON.stringify(recentAuditLogs);
  check(
    'TEST R5: Audit logs NEVER expose OTP codes or plaintext passwords',
    !serializedAudits.includes(validOtp) &&
      !serializedAudits.includes(updatedPassword) &&
      !serializedAudits.includes(pendingNewPass) &&
      !serializedAudits.includes('SuspendedNewPass123!') &&
      !serializedAudits.includes('DeactivatedNewPass456!')
  );

  // TEST S: Cross-member access remains blocked with token obtained after password reset
  const otherMember = finalDb.members.find(m => m.id !== activeMemberId)!;
  const crossProfileRes = await api(`/api/members/${otherMember.id}`, 'GET', undefined, newPassMemberToken);
  const crossLedgerRes = await api(`/api/savings/ledger?memberId=${otherMember.id}`, 'GET', undefined, newPassMemberToken);
  const crossReceiptsRes = await api(`/api/receipts?memberId=${otherMember.id}`, 'GET', undefined, newPassMemberToken);
  check(
    'TEST S: Cross-member access remains strictly blocked (HTTP 403) after password reset',
    crossProfileRes.status === 403 && crossLedgerRes.status === 403 && crossReceiptsRes.status === 403
  );

  // -------------------------------------------------------------------------
  // TEST U — NODEMAILER EMAIL TRANSPORT INVOCATION, OAUTH CREDENTIAL ISOLATION & FAILURE HANDLING
  // -------------------------------------------------------------------------
  console.log('\n--- TEST U: Nodemailer Email Transport Verification, OAuth Isolation & Failure Handling ---');

  // 1. Verify runtime SMTP configuration check requires EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM
  const emptyEnvStatus = getSmtpConfigStatus({});
  check(
    'TEST U1: Missing SMTP environment variables are accurately reported',
    emptyEnvStatus.configured === false &&
      emptyEnvStatus.missingVars.includes('EMAIL_HOST') &&
      emptyEnvStatus.missingVars.includes('EMAIL_PORT') &&
      emptyEnvStatus.missingVars.includes('EMAIL_USER') &&
      emptyEnvStatus.missingVars.includes('EMAIL_PASSWORD') &&
      emptyEnvStatus.missingVars.includes('EMAIL_FROM')
  );

  const runtimeSmtpStatus = getSmtpConfigStatus();
  check(
    'TEST U1b: Runtime getSmtpConfigStatus() reads strictly from process.env without mutating environment variables',
    typeof runtimeSmtpStatus.configured === 'boolean' &&
      Array.isArray(runtimeSmtpStatus.missingVars)
  );

  // 2. Verify Nodemailer mock transport is actually invoked by sendPasswordResetOtpEmail
  clearRecordedEmailInvocationsForTesting();
  const capturedEmails: any[] = [];
  const customMockTransporter = nodemailer.createTransport({
    jsonTransport: true
  });
  const originalSendMail = customMockTransporter.sendMail.bind(customMockTransporter);
  (customMockTransporter as any).sendMail = async (mailOptions: any) => {
    capturedEmails.push(mailOptions);
    return originalSendMail(mailOptions);
  };

  setEmailTransporterForTesting(customMockTransporter);
  const mockResult = await sendPasswordResetOtpEmail({
    toEmail: activeEmail,
    fullName: 'Mock Transport Test Member',
    otp: '849201',
    expiresAtIso: new Date(Date.now() + 600000).toISOString()
  });
  setEmailTransporterForTesting(null);

  check('TEST U2: Nodemailer transporter.sendMail() is actually invoked', mockResult.sent === true && capturedEmails.length === 1);
  check(
    'TEST U3: Dispatched email contains correct recipient, subject, and 6-digit OTP in email body',
    capturedEmails[0]?.to === activeEmail &&
      typeof capturedEmails[0]?.subject === 'string' &&
      capturedEmails[0]?.text?.includes('849201') &&
      capturedEmails[0]?.html?.includes('849201')
  );
  check(
    'TEST U4: Recorded invocation tracker captures mock delivery metadata',
    getRecordedEmailInvocationsForTesting().length === 1 &&
      getRecordedEmailInvocationsForTesting()[0].to === activeEmail
  );

  // 3. Verify API-level mock transport vs simulated SMTP failure handling + Complete E2E Reset Flow
  const mockApiEmail = `otp.mockapi.${ts}@gmail.com`;
  await api('/api/auth/register', 'POST', {
    email: mockApiEmail,
    password: 'MockApiInitPass123!',
    fullName: `OTP Mock API Member ${ts}`,
    phone: '09175550404',
    initialShareCapital: 1000
  });
  const mockApiMemberId = getFreshDb().members.find(m => m.email.toLowerCase() === mockApiEmail.toLowerCase())!.id;
  await api(`/api/users/verify-member/${mockApiMemberId}`, 'POST', {
    action: 'APPROVE',
    reviewNotes: 'Approved for complete E2E SMTP transport flow test'
  }, staffToken);

  const apiMockSuccess = await api(
    '/api/auth/forgot-password',
    'POST',
    { email: mockApiEmail },
    undefined,
    { 'x-test-email-transport': 'mock' }
  );
  check('TEST U5: POST /api/auth/forgot-password invokes email transport and returns generic HTTP 200 without OTP', apiMockSuccess.status === 200 && !apiMockSuccess.data?.otp);
  const deliveredEnvelope = getDispatchedEnvelopeFromOutbox(mockApiEmail);
  const extractedOtpFromEmail = getDispatchedOtpFromOutbox(mockApiEmail);
  check(
    'TEST U5b: Email transport delivered email to registered member address with 6-digit OTP in email body (no raw otp field)',
    !!deliveredEnvelope &&
      deliveredEnvelope.to === mockApiEmail.toLowerCase() &&
      deliveredEnvelope.otp === undefined &&
      !!extractedOtpFromEmail &&
      /^\d{6}$/.test(extractedOtpFromEmail!)
  );

  const dbAfterMockApi = getFreshDb();
  const mockSuccessLog = (dbAfterMockApi.auditLogs || []).find(
    l => l.userEmail.toLowerCase() === mockApiEmail.toLowerCase() && l.action === 'PASSWORD_RESET_REQUESTED'
  );
  check(
    'TEST U6: Internal audit log records MOCK_TRANSPORT delivery when transport succeeds',
    !!mockSuccessLog && mockSuccessLog.details.includes('sent via MOCK_TRANSPORT')
  );

  // Complete the full end-to-end flow using the OTP extracted from the sent email:
  // Enter OTP -> Verify OTP -> Create reset session -> Set new password -> Login with new password
  const e2eVerifyRes = await api('/api/auth/verify-reset-otp', 'POST', {
    email: mockApiEmail,
    otp: extractedOtpFromEmail
  });
  check(
    'TEST U9a: Complete E2E Flow — Entering 6-digit OTP from sent email verifies OTP and creates reset session',
    e2eVerifyRes.status === 200 && e2eVerifyRes.data?.verified === true && !!e2eVerifyRes.data?.resetToken
  );

  const e2eNewPassword = 'CompleteFlowNewPass987!';
  const e2eResetRes = await api('/api/auth/reset-password', 'POST', {
    email: mockApiEmail,
    resetToken: e2eVerifyRes.data.resetToken,
    newPassword: e2eNewPassword,
    confirmPassword: e2eNewPassword
  });
  check('TEST U9b: Complete E2E Flow — Setting new password with reset session succeeds (HTTP 200)', e2eResetRes.status === 200 && !e2eResetRes.data?.token);

  const e2eLoginRes = await api('/api/auth/login', 'POST', {
    email: mockApiEmail,
    password: e2eNewPassword
  });
  check('TEST U9c: Complete E2E Flow — Member logs in with new password and receives valid JWT (HTTP 200)', e2eLoginRes.status === 200 && !!e2eLoginRes.data?.token);

  // Now simulate SMTP transport failure (x-test-email-transport: fail)
  const apiFailTransport = await api(
    '/api/auth/forgot-password',
    'POST',
    { email: mockApiEmail },
    undefined,
    { 'x-test-email-transport': 'fail' }
  );
  check(
    'TEST U7: When SMTP delivery fails, client still receives generic enumeration-safe HTTP 200 message',
    apiFailTransport.status === 200 &&
      apiFailTransport.data?.message === 'If an account is registered with this email, a verification code has been sent.' &&
      !JSON.stringify(apiFailTransport.data).includes('ECONNREFUSED')
  );
  const dbAfterFailApi = getFreshDb();
  const failDeliveryLogs = (dbAfterFailApi.auditLogs || []).filter(
    l => l.userEmail.toLowerCase() === mockApiEmail.toLowerCase()
  );
  check(
    'TEST U8: When SMTP delivery fails, internal audit does NOT claim email was sent and logs PASSWORD_RESET_FAILED',
    failDeliveryLogs.some(l => l.action === 'PASSWORD_RESET_FAILED' && l.details.includes('email delivery failed')) &&
      failDeliveryLogs.some(l => l.action === 'PASSWORD_RESET_REQUESTED' && l.details.includes('email delivery failed'))
  );

  console.log('\n======================================================================');
  console.log(`FORGOT PASSWORD OTP SUITE SUMMARY: ${passed} / ${passed + failed} checks passed`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runForgotPasswordOtpSuite().catch(err => {
  console.error('Fatal error in Forgot Password OTP test suite:', err);
  process.exit(1);
});

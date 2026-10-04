/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Verification Suite for Email Notification Dual-Channel & Member Registration Staff Visibility
 */

import fs from 'fs';
import { CooperativeDB } from '../src/db/db.js';
import { getRecordedNotificationEmails, clearRecordedNotificationEmails, getSmtpConfigStatus } from '../src/server/emailService.js';

const BASE_URL = 'http://localhost:3000';

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

let passCount = 0;
let failCount = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail ? ` (${detail})` : ''}`);
    failCount++;
  }
}

async function runSuite() {
  console.log('===============================================================');
  console.log('STARTING DUAL-CHANNEL NOTIFICATION & REGISTRATION AUDIT SUITE');
  console.log('===============================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: Member Registration Visibility in Staff Account
  // -------------------------------------------------------------------------
  console.log('--- 1. Member Registration & Staff Queue Visibility Audit ---');

  const testMemberEmail = `applicant_${Date.now()}@cooptest.ph`;
  const testPassword = 'Password123!';
  const testFullName = `Test Applicant ${Date.now()}`;

  // Step 1: Member submits registration
  const regRes = await api('/api/auth/register', 'POST', {
    email: testMemberEmail,
    password: testPassword,
    fullName: testFullName,
    phone: '+639171234567',
    address: '123 Cooperative Way, Manila',
    birthdate: '1995-05-15',
    gender: 'Female',
    occupation: 'Teacher',
    initialShareCapital: 1000
  });

  check('Member registration request succeeds', regRes.status === 201, JSON.stringify(regRes.data));
  const newMemberId = regRes.data?.user?.id || regRes.data?.user?.memberId;
  check('New member record returned with ID', Boolean(newMemberId));

  // Verify status in DB is PENDING
  const dbAfterReg = CooperativeDB.load();
  const dbMember = (dbAfterReg.members || []).find(m => m.email.toLowerCase() === testMemberEmail.toLowerCase());
  check('Applicant record is persisted in DB with status PENDING', dbMember?.status === 'PENDING');

  // Step 2: Staff logs in
  const staffLoginRes = await api('/api/auth/login', 'POST', {
    email: 'staff@coop.com',
    password: 'staff123'
  });
  check('Staff login succeeds with 200 OK', staffLoginRes.status === 200);
  const staffToken = staffLoginRes.data?.token;

  // Step 3: Staff queries /api/users
  const staffUsersRes = await api('/api/users', 'GET', undefined, staffToken);
  const staffMembersList = Array.isArray(staffUsersRes.data)
    ? staffUsersRes.data
    : (staffUsersRes.data?.members || []);

  check('Staff can query /api/users', staffUsersRes.status === 200 && Array.isArray(staffMembersList));

  const foundInStaffQueue = staffMembersList.find(
    (u: any) => u.email?.toLowerCase() === testMemberEmail.toLowerCase()
  );
  check('New applicant is visible in staff verification queue', Boolean(foundInStaffQueue));
  check('Applicant status in staff response is PENDING', foundInStaffQueue?.status === 'PENDING');

  // Step 4: Staff reviews and verifies applicant
  const targetMemberId = dbMember?.id || newMemberId;
  const verifyRes = await api(`/api/users/verify-member/${targetMemberId}`, 'POST', {
    action: 'APPROVE',
    notes: 'Document review passed. Approved for membership.'
  }, staffToken);

  check('Staff can approve member via /api/users/verify-member/:id', verifyRes.status === 200);

  const dbAfterApproval = CooperativeDB.load();
  const approvedMember = (dbAfterApproval.members || []).find(m => m.email.toLowerCase() === testMemberEmail.toLowerCase());
  check('Member status updated to ACTIVE after staff approval', approvedMember?.status === 'ACTIVE');

  // Step 5: Member can now log in
  const memberLoginRes = await api('/api/auth/login', 'POST', {
    email: testMemberEmail,
    password: testPassword
  });
  check('Activated member can log in successfully', memberLoginRes.status === 200);
  const memberToken = memberLoginRes.data?.token;
  const authenticatedMemberId = memberLoginRes.data?.user?.id;

  // -------------------------------------------------------------------------
  // SECTION 2: Notification Independence & Dual Delivery (FCM & Email)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. FCM & Email Dual Delivery Independence Audit ---');

  // Clear test outboxes via API
  await api('/api/notifications/email/clear-outbox', 'POST', undefined, memberToken);

  // Test Case A: Member notification generation without Web Push
  // Requirement: Notifications delivered directly to member registered email
  const trigA = await api('/api/notifications/trigger-system-test', 'POST', {
    title: 'Important Account Security Alert',
    message: 'A new login was detected on your account. If this was not you, contact staff immediately.',
    metadata: { actionUrl: '/?tab=member-profile' }
  }, memberToken);

  check(
    'Notification stored in notification history despite no FCM token',
    trigA.status === 200 && Boolean(trigA.data?.notification?.id)
  );

  // Wait a small tick for async hook completion
  await new Promise(r => setTimeout(r, 200));

  const emailResA = await api('/api/notifications/email/outbox', 'GET', undefined, memberToken);
  const emailOutboxA: any[] = Array.isArray(emailResA.data) ? emailResA.data : [];

  check(
    'Email notification delivered to member registered email even when FCM is absent/blocked',
    emailOutboxA.some(e => (e.to || '').toLowerCase() === testMemberEmail.toLowerCase())
  );

  const deliveredEmailA = emailOutboxA.find(e => (e.to || '').toLowerCase() === testMemberEmail.toLowerCase());
  check('Email contains cooperative branding', Boolean(deliveredEmailA?.html?.includes('CCT') || deliveredEmailA?.text?.includes('CCT')));
  check('Email contains notification title', Boolean(deliveredEmailA?.subject?.includes('Important Account Security Alert') || deliveredEmailA?.title?.includes('Important Account Security Alert')));
  check('Email contains member name', deliveredEmailA?.fullName === testFullName);

  // Test Case B: Member notification dispatch
  console.log('\n--- 3. Email Notification Delivery Audit ---');
  await api('/api/notifications/email/clear-outbox', 'POST', undefined, memberToken);

  // Dispatch notification
  const trigB = await api('/api/notifications/trigger-system-test', 'POST', {
    title: 'Official Receipt Issued',
    message: 'Official Receipt OR-2026-00981 for ₱5,000.00 has been generated for your loan payment.',
    metadata: {
      referenceNumber: 'OR-2026-00981',
      amount: 5000,
      actionUrl: '/?tab=member-receipts'
    }
  }, memberToken);

  check('Notification triggered successfully', trigB.status === 200);

  await new Promise(r => setTimeout(r, 200));

  const emailResB = await api('/api/notifications/email/outbox', 'GET', undefined, memberToken);
  const emailOutboxB: any[] = Array.isArray(emailResB.data) ? emailResB.data : [];

  check('Email notification dispatched to member registered email', emailOutboxB.some(e => (e.to || '').toLowerCase() === testMemberEmail.toLowerCase()));

  const receiptEmail = emailOutboxB.find(e => (e.to || '').toLowerCase() === testMemberEmail.toLowerCase());
  check('Receipt email includes reference number', Boolean(receiptEmail?.referenceNumber === 'OR-2026-00981' || receiptEmail?.text?.includes('OR-2026-00981')));
  check('Receipt email includes formatted amount', Boolean(receiptEmail?.amount === 5000 || receiptEmail?.text?.includes('5,000')));

  // -------------------------------------------------------------------------
  // SECTION 3: Financial Non-Dependency & Failure Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Financial Non-Dependency & Resilience Audit ---');

  // Check that notification delivery failure does not roll back financial transaction
  let financialExecuted = false;
  const postResult = CooperativeDB.postFinancialTransaction({
    postingKeys: [`test_notif_resilience_${Date.now()}`],
    paymentSource: 'CASHIER_QUEUE',
    memberId: authenticatedMemberId,
    memberName: testFullName,
    amount: 2500,
    postingType: 'REGULAR_SAVINGS',
    postedBy: 'staff@coop.com',
    executePosting: (db) => {
      financialExecuted = true;
      const mem = db.members.find(m => m.id === authenticatedMemberId);
      if (mem) mem.regularSavings = (mem.regularSavings || 0) + 2500;
      return {
        ledgerTransaction: {
          id: 'tx_resil_' + Date.now(),
          type: 'SAVINGS_DEPOSIT',
          memberId: authenticatedMemberId,
          memberName: testFullName,
          amount: 2500,
          date: new Date().toISOString(),
          reference: 'RESIL_TEST',
          status: 'COMPLETED'
        } as any
      };
    }
  });

  check('Financial posting succeeds and executes cleanly', postResult.success && financialExecuted);

  // Trigger notification with simulated transport failure
  const failingNotif = await api('/api/notifications/trigger-system-test', 'POST', {
    title: 'Transport Failure Simulation',
    message: 'This notification tests that an email/fcm failure does not throw or break the caller.',
    testTransportMode: 'fail'
  }, memberToken);

  check('Notification endpoint completes without throwing even if delivery fails', failingNotif.status === 200);
  const verifyDb = CooperativeDB.load();
  const verifyMem = verifyDb.members.find(m => m.id === authenticatedMemberId);
  check('Financial state remains committed and intact', (verifyMem?.regularSavings || 0) >= 2500);

  // -------------------------------------------------------------------------
  // SECTION 4: Comprehensive Coverage of Required Email Events
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Required Email Notification Events Coverage Audit ---');

  const requiredEvents = [
    { title: 'Loan Application Submitted', msg: 'Your loan application LA-1001 for ₱50,000 has been submitted.', meta: { loanNumber: 'LA-1001', amount: 50000 } },
    { title: 'Loan Application Approved', msg: 'Your loan application LA-1001 for ₱50,000 has been approved.', meta: { loanNumber: 'LA-1001', amount: 50000 } },
    { title: 'Loan Application Rejected', msg: 'Your loan application LA-1001 was rejected.', meta: { loanNumber: 'LA-1001' } },
    { title: 'Loan Returned for Revision', msg: 'Your loan application LA-1001 requires updated documents.', meta: { loanNumber: 'LA-1001' } },
    { title: 'Loan Disbursed & Released', msg: 'Your loan proceeds of ₱48,500 have been disbursed.', meta: { loanNumber: 'LN-2001', amount: 48500 } },
    { title: 'Loan Payment Received', msg: 'Your payment submission of ₱3,500 has been received.', meta: { amount: 3500, referenceNumber: 'GCASH-789' } },
    { title: 'Loan Payment Posted', msg: 'Your loan payment of ₱3,500 has been verified and posted.', meta: { amount: 3500, referenceNumber: 'OR-4451' } },
    { title: 'Upcoming Loan Payment Due', msg: 'Reminder: Loan payment of ₱3,500 is due on 2026-10-15.', meta: { amount: 3500, dueDate: '2026-10-15' } },
    { title: 'Loan Payment Due Today', msg: 'Urgent: Loan payment of ₱3,500 is due today, 2026-10-03.', meta: { amount: 3500, dueDate: '2026-10-03' } },
    { title: 'Loan Payment Overdue', msg: 'Overdue Notice: Loan payment of ₱3,500 was due on 2026-09-25.', meta: { amount: 3500, dueDate: '2026-09-25' } },
    { title: 'Official Receipt Generated', msg: 'Official Receipt OR-9912 for ₱10,000 has been issued.', meta: { referenceNumber: 'OR-9912', amount: 10000 } },
    { title: 'Important Account Notification', msg: 'Your annual dividend share of ₱1,250 has been credited.', meta: { amount: 1250 } }
  ];

  await api('/api/notifications/email/clear-outbox', 'POST', undefined, memberToken);

  for (const evt of requiredEvents) {
    await api('/api/notifications/trigger-system-test', 'POST', {
      title: evt.title,
      message: evt.msg,
      metadata: evt.meta
    }, memberToken);
  }

  await new Promise(r => setTimeout(r, 300));

  const allRecordedRes = await api('/api/notifications/email/outbox', 'GET', undefined, memberToken);
  const allRecorded: any[] = Array.isArray(allRecordedRes.data) ? allRecordedRes.data : [];

  for (const evt of requiredEvents) {
    const found = allRecorded.find(e => e.title === evt.title || (e.subject || '').includes(evt.title));
    check(`Email event supported: "${evt.title}"`, Boolean(found));
    if (found && evt.meta.amount) {
      check(`Amount included in email payload for "${evt.title}"`, Boolean(found.amount === evt.meta.amount || found.text?.includes(String(evt.meta.amount))));
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 5: UI & Security Hygiene Verification
  // -------------------------------------------------------------------------
  console.log('\n--- 6. UI & Security Hygiene Verification ---');

  const memberDashboardContent = fs.readFileSync('src/views/MemberDashboard.tsx', 'utf8');
  check(
    'MemberDashboard has dedicated Email Notifications card',
    memberDashboardContent.includes('Email Notifications') &&
    memberDashboardContent.includes('Registered Member Email:')
  );
  check(
    'MemberDashboard explains loan due-date reminders are sent to registered email',
    memberDashboardContent.includes('Loan due-date reminders and important account notifications are sent to your registered email address.')
  );
  check(
    'MemberDashboard has no FCM push UI or fcmStatus',
    !memberDashboardContent.includes('fcmStatus') && !memberDashboardContent.includes('requestFcmToken')
  );

  const authGuideExists = fs.existsSync('FIREBASE_AUTH_DOMAIN_SETUP.md');
  check('FIREBASE_AUTH_DOMAIN_SETUP.md documentation exists', authGuideExists);

  const loginViewContent = fs.readFileSync('src/views/LoginView.tsx', 'utf8');
  check(
    'LoginView handles auth/unauthorized-domain dynamically without hardcoding',
    loginViewContent.includes('auth/unauthorized-domain') &&
    loginViewContent.includes('window.location.hostname')
  );

  console.log('\n===============================================================');
  console.log(`AUDIT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('===============================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});

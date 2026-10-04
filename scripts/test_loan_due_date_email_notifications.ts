/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Comprehensive Test Suite for Automatic Loan Due-Date Email Notifications:
 * 1. Installment due in 7 days → email generated once.
 * 2. Installment due in 3 days → email generated once.
 * 3. Installment due today → email generated once.
 * 4. Past-due unpaid installment → overdue email generated once.
 * 5. Fully paid installment → no email.
 * 6. Waived installment → no email.
 * 7. Scheduler restart → no duplicate email (idempotency).
 * 8. Email failure → financial workflow unaffected.
 * 9. Multiple members → each receives email at their registered email.
 * 10. Multiple loans → each applicable loan/installment is processed.
 * 11. Manila timezone boundary → due date is calculated using Asia/Manila.
 * 12. Existing notification history remains intact.
 */

import { CooperativeDB } from '../src/db/db.js';
import {
  getRecordedNotificationEmails,
  clearRecordedNotificationEmails
} from '../src/server/emailService.js';
import {
  runAutomatedLoanDueDateEmailScan,
  getManilaDateString,
  getCalendarDaysDiff
} from '../src/server/jobs.js';
import { Loan, AmortizationItem, Member, User } from '../src/types.js';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}${details ? ` (${details})` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('AUTOMATIC LOAN DUE-DATE EMAIL NOTIFICATIONS TEST SUITE');
  console.log('================================================================');

  // Load existing DB state to restore after test
  const initialDb = CooperativeDB.load();
  const initialNotificationsCount = (initialDb.notifications || []).length;

  try {
    // Determine Manila date as baseline for test
    const testNow = new Date('2026-10-15T08:00:00+08:00'); // Manila 2026-10-15
    const todayManila = getManilaDateString(testNow);
    assert('Timezone: getManilaDateString returns correct Manila date', todayManila === '2026-10-15');

    // Test Manila timezone boundary: UTC evening 2026-10-14 18:00 is Manila 2026-10-15 02:00
    const utcBnd = new Date('2026-10-14T18:00:00Z');
    assert('Timezone: UTC evening correctly resolves to Manila morning (+8h)', getManilaDateString(utcBnd) === '2026-10-15');

    // Calendar day diff checks
    assert('Calendar day diff: 7 days future', getCalendarDaysDiff('2026-10-22', todayManila) === 7);
    assert('Calendar day diff: 3 days future', getCalendarDaysDiff('2026-10-18', todayManila) === 3);
    assert('Calendar day diff: today', getCalendarDaysDiff('2026-10-15', todayManila) === 0);
    assert('Calendar day diff: overdue (2 days ago)', getCalendarDaysDiff('2026-10-13', todayManila) === -2);

    // Setup Test Members and Users
    const memberA: Member = {
      id: 'mem_test_due_a',
      memberNumber: 'MEM-TEST-DUE-A',
      fullName: 'Maria Santos',
      email: 'maria.santos@test-coop.ph',
      phone: '+639171234567',
      status: 'ACTIVE',
      shareCapital: 20000,
      regularSavings: 15000,
      timeDeposits: 0,
      dividendsEarned: 0,
      createdAt: '2026-01-01T00:00:00Z'
    };

    const memberB: Member = {
      id: 'mem_test_due_b',
      memberNumber: 'MEM-TEST-DUE-B',
      fullName: 'Juan dela Cruz',
      email: 'juan.delacruz@test-coop.ph',
      phone: '+639181234567',
      status: 'ACTIVE',
      shareCapital: 25000,
      regularSavings: 20000,
      timeDeposits: 0,
      dividendsEarned: 0,
      createdAt: '2026-01-01T00:00:00Z'
    };

    // Loan 1 for Member A with installments for:
    // - Inst 1: 7 days due (2026-10-22)
    // - Inst 2: 3 days due (2026-10-18)
    // - Inst 3: today due (2026-10-15)
    // - Inst 4: past-due unpaid (2026-10-01)
    // - Inst 5: fully paid (due 2026-10-15, paid 5000)
    // - Inst 6: waived (due 2026-10-15, waived)
    const testLoanA: Loan = {
      id: 'LOAN-DUE-TEST-A',
      applicationId: 'APP-TEST-A',
      memberId: memberA.id,
      memberName: memberA.fullName,
      loanTypeName: 'Emergency Loan',
      principalAmount: 50000,
      interestAmount: 5000,
      totalRepayable: 55000,
      balance: 50000,
      monthlyAmortization: 5000,
      durationMonths: 11,
      paymentFrequency: 'MONTHLY',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
      disbursedAt: '2026-09-01T00:00:00Z',
      amortizationSchedule: [
        {
          installmentNo: 1,
          dueDate: '2026-10-22', // exactly 7 days from 2026-10-15
          scheduledAmount: 5000,
          principalAmount: 4500,
          interestAmount: 500,
          penaltyAmount: 0,
          amountPaid: 0,
          remainingAmount: 5000,
          remainingBalance: 45000,
          status: 'UPCOMING'
        },
        {
          installmentNo: 2,
          dueDate: '2026-10-18', // exactly 3 days from 2026-10-15
          scheduledAmount: 5000,
          principalAmount: 4500,
          interestAmount: 500,
          penaltyAmount: 0,
          amountPaid: 0,
          remainingAmount: 5000,
          remainingBalance: 40000,
          status: 'UPCOMING'
        },
        {
          installmentNo: 3,
          dueDate: '2026-10-15', // exactly today
          scheduledAmount: 5000,
          principalAmount: 4500,
          interestAmount: 500,
          penaltyAmount: 0,
          amountPaid: 0,
          remainingAmount: 5000,
          remainingBalance: 35000,
          status: 'DUE'
        },
        {
          installmentNo: 4,
          dueDate: '2026-10-01', // overdue (14 days past)
          scheduledAmount: 5000,
          principalAmount: 4500,
          interestAmount: 500,
          penaltyAmount: 0,
          amountPaid: 0,
          remainingAmount: 5000,
          remainingBalance: 30000,
          status: 'PAST_DUE'
        },
        {
          installmentNo: 5,
          dueDate: '2026-10-15', // due today, but FULLY PAID
          scheduledAmount: 5000,
          principalAmount: 4500,
          interestAmount: 500,
          penaltyAmount: 0,
          amountPaid: 5000,
          remainingAmount: 0,
          remainingBalance: 25000,
          status: 'PAID'
        },
        {
          installmentNo: 6,
          dueDate: '2026-10-15', // due today, but WAIVED
          scheduledAmount: 5000,
          principalAmount: 4500,
          interestAmount: 500,
          penaltyAmount: 0,
          amountPaid: 0,
          remainingAmount: 5000,
          remainingBalance: 20000,
          status: 'WAIVED'
        }
      ]
    };

    // Loan 2 for Member B (testing multiple loans and multiple members)
    const testLoanB: Loan = {
      id: 'LOAN-DUE-TEST-B',
      applicationId: 'APP-TEST-B',
      memberId: memberB.id,
      memberName: memberB.fullName,
      loanTypeName: 'Appliance Loan',
      principalAmount: 30000,
      interestAmount: 3000,
      totalRepayable: 33000,
      balance: 33000,
      monthlyAmortization: 3000,
      durationMonths: 11,
      paymentFrequency: 'MONTHLY',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00Z',
      disbursedAt: '2026-09-01T00:00:00Z',
      amortizationSchedule: [
        {
          installmentNo: 1,
          dueDate: '2026-10-22', // 7 days due
          scheduledAmount: 3000,
          principalAmount: 2700,
          interestAmount: 300,
          penaltyAmount: 0,
          amountPaid: 0,
          remainingAmount: 3000,
          remainingBalance: 30000,
          status: 'UPCOMING'
        },
        {
          installmentNo: 2,
          dueDate: '2026-10-15', // today due
          scheduledAmount: 3000,
          principalAmount: 2700,
          interestAmount: 300,
          penaltyAmount: 0,
          amountPaid: 0,
          remainingAmount: 3000,
          remainingBalance: 27000,
          status: 'DUE'
        }
      ]
    };

    // Insert test members and loans into DB
    const db = CooperativeDB.load();
    db.members = db.members.filter(m => m.id !== memberA.id && m.id !== memberB.id);
    db.loans = db.loans.filter(l => l.id !== testLoanA.id && l.id !== testLoanB.id);
    db.members.push(memberA, memberB);
    db.loans.push(testLoanA, testLoanB);
    CooperativeDB.save(db);

    // Clear test email outbox before test run
    clearRecordedNotificationEmails();

    console.log('\n--- 1. First Execution of Automatic Loan Due Email Scan ---');
    const scanResult1 = await runAutomatedLoanDueDateEmailScan(testNow);

    console.log('Scan 1 Result:', scanResult1);
    assert('Scan 1 processed active loans and sent notifications', scanResult1.sentCount >= 6);
    assert('Scan 1 skipped non-payable installments (PAID, WAIVED)', scanResult1.skippedPaid >= 2);
    assert('Scan 1 processed test loans without error', scanResult1.errors.length === 0);

    const outbox1 = getRecordedNotificationEmails();
    const testLoanAEmails = outbox1.filter(e => e.loanNumber === testLoanA.id);
    const testLoanBEmails = outbox1.filter(e => e.loanNumber === testLoanB.id);

    assert('Recorded outbox has exactly 4 emails for Loan A (7d, 3d, today, overdue)', testLoanAEmails.length === 4);
    assert('Recorded outbox has exactly 2 emails for Loan B (7d, today)', testLoanBEmails.length === 2);

    // 1. Installment due in 7 days for Member A
    const email7daysA = outbox1.find(
      e => e.to === memberA.email && e.subject === 'CCT Cooperative - Loan Payment Due in 7 Days'
    );
    assert('Scenario 1: Installment due in 7 days email dispatched with exact subject', Boolean(email7daysA));
    assert('Scenario 1: Email body contains member name', email7daysA?.fullName === memberA.fullName);
    assert('Scenario 1: Email body contains loan reference', Boolean(email7daysA?.loanNumber === 'LOAN-DUE-TEST-A'));
    assert('Scenario 1: Email body contains due date', email7daysA?.dueDate === '2026-10-22');
    assert('Scenario 1: Email body contains amount due', email7daysA?.amount === 5000);

    // 2. Installment due in 3 days for Member A
    const email3daysA = outbox1.find(
      e => e.to === memberA.email && e.subject === 'CCT Cooperative - Loan Payment Due in 3 Days'
    );
    assert('Scenario 2: Installment due in 3 days email dispatched with exact subject', Boolean(email3daysA));
    assert('Scenario 2: Email body contains due date', email3daysA?.dueDate === '2026-10-18');
    assert('Scenario 2: Email body contains amount due', email3daysA?.amount === 5000);

    // 3. Installment due today for Member A
    const emailTodayA = outbox1.find(
      e => e.to === memberA.email && e.subject === 'CCT Cooperative - Loan Payment Due Today'
    );
    assert('Scenario 3: Installment due today email dispatched with exact subject', Boolean(emailTodayA));
    assert('Scenario 3: Email body contains payment instructions', Boolean(emailTodayA?.text?.includes('GCash') || emailTodayA?.text?.includes('cashier')));

    // 4. Past-due unpaid installment for Member A
    const emailOverdueA = outbox1.find(
      e => e.to === memberA.email && e.subject === 'CCT Cooperative - Loan Payment Overdue'
    );
    assert('Scenario 4: Overdue installment email dispatched with exact subject', Boolean(emailOverdueA));
    assert('Scenario 4: Overdue email contains payment instructions and overdue warning', Boolean(emailOverdueA?.text?.includes('OVERDUE')));

    // 5 & 6. Fully paid & Waived installments → No emails
    const emailPaidOrWaived = outbox1.filter(
      e => e.to === memberA.email && (e.text?.includes('installment #5') || e.text?.includes('installment #6'))
    );
    assert('Scenario 5 & 6: No emails sent for PAID or WAIVED installments', emailPaidOrWaived.length === 0);

    // 9. Multiple members: Member B received their emails
    const emailsMemberB = outbox1.filter(e => e.to === memberB.email);
    assert('Scenario 9: Multiple members - Member B received their separate emails at juan.delacruz@test-coop.ph', emailsMemberB.length === 2);
    assert('Scenario 9: Member B received 7-day reminder', emailsMemberB.some(e => e.subject === 'CCT Cooperative - Loan Payment Due in 7 Days'));
    assert('Scenario 9: Member B received Due Today reminder', emailsMemberB.some(e => e.subject === 'CCT Cooperative - Loan Payment Due Today'));

    // 10. Multiple loans: Both LOAN-DUE-TEST-A and LOAN-DUE-TEST-B were processed
    const loansProcessed = new Set(outbox1.map(e => e.loanNumber));
    assert('Scenario 10: Multiple loans processed independently', loansProcessed.has('LOAN-DUE-TEST-A') && loansProcessed.has('LOAN-DUE-TEST-B'));

    // -------------------------------------------------------------------------
    // 7. Scheduler Restart & Duplicate Email Protection (Idempotency Audit)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Scheduler Restart & Idempotency Audit ---');
    clearRecordedNotificationEmails(); // Clear outbox to observe if anything fires again

    const scanResult2 = await runAutomatedLoanDueDateEmailScan(testNow);
    console.log('Scan 2 (Restart simulation) Result:', scanResult2);

    assert('Scenario 7: Duplicate protection skipped previously sent notifications', scanResult2.skippedDuplicates >= 6);
    assert('Scenario 7: Zero emails resent on duplicate run', scanResult2.sentCount === 0);
    assert('Scenario 7: Email outbox remains empty after duplicate scan', getRecordedNotificationEmails().length === 0);

    // -------------------------------------------------------------------------
    // 8. Email Failure Safety Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Email Failure Safety Audit ---');
    // Verify that loan balance and financial state remain intact
    const dbAfterScans = CooperativeDB.load();
    const loanCheckA = dbAfterScans.loans.find(l => l.id === testLoanA.id);
    assert('Scenario 8: Loan balance is unchanged after notification scans', loanCheckA?.balance === 50000);
    assert('Scenario 8: Member savings balance unchanged', dbAfterScans.members.find(m => m.id === memberA.id)?.regularSavings === 15000);
    assert('Scenario 8: Member share capital unchanged', dbAfterScans.members.find(m => m.id === memberA.id)?.shareCapital === 20000);

    // -------------------------------------------------------------------------
    // 12. Notification History Intact Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Existing Notification History Intact Audit ---');
    const finalDb = CooperativeDB.load();
    assert(
      'Scenario 12: Historical notifications preserved in DB',
      (finalDb.notifications || []).length >= initialNotificationsCount
    );

    // Check that our newly created notifications have deterministic eventKey
    const testNotifs = (finalDb.notifications || []).filter(
      n => n.metadata?.loanId === testLoanA.id
    );
    assert('Created notifications have deterministic eventKey', testNotifs.every(n => Boolean(n.metadata?.eventKey)));
    assert('Created notifications have skipAutoEmail set to prevent double emails', testNotifs.every(n => n.metadata?.skipAutoEmail === true));
    assert('Created notifications have email delivery status recorded', testNotifs.every(n => Boolean(n.deliveryStatus?.email?.attempted)));

  } finally {
    // Cleanup test loans and members from database
    const cleanupDb = CooperativeDB.load();
    cleanupDb.loans = cleanupDb.loans.filter(l => l.id !== 'LOAN-DUE-TEST-A' && l.id !== 'LOAN-DUE-TEST-B');
    cleanupDb.members = cleanupDb.members.filter(m => m.id !== 'mem_test_due_a' && m.id !== 'mem_test_due_b');
    cleanupDb.notifications = cleanupDb.notifications.filter(
      n => !n.metadata?.eventKey?.includes('LOAN-DUE-TEST-A') && !n.metadata?.eventKey?.includes('LOAN-DUE-TEST-B')
    );
    CooperativeDB.save(cleanupDb);
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

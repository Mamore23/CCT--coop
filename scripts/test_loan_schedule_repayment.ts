import fs from 'fs';
import path from 'path';
import { CooperativeDB } from '../src/db/db';
import { Loan, AmortizationItem, LoanPayment, OfficialReceipt, Transaction } from '../src/types';

const BASE_URL = 'http://localhost:3000';

async function api(path: string, method: string = 'GET', body?: any, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
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

async function runLoanLifecycleVerification() {
  console.log('======================================================================');
  console.log('STARTING: LOAN REPAYMENT & MEMBER LOAN SCHEDULE FUNCTIONAL VERIFICATION');
  console.log('======================================================================\n');

  // 1. Authenticate Admin, Staff, and Member
  const adminLogin = await api('/api/auth/login', 'POST', {
    email: 'admin@coop.com',
    password: 'admin123'
  });
  check('Admin authenticated', adminLogin.ok && !!adminLogin.data?.token);
  const adminToken = adminLogin.data.token;

  const staffLogin = await api('/api/auth/login', 'POST', {
    email: 'staff@coop.com',
    password: 'staff123'
  });
  check('Staff authenticated', staffLogin.ok && !!staffLogin.data?.token);
  const staffToken = staffLogin.data.token;

  // Register dedicated test member
  const ts = Date.now();
  const memberEmail = `loan.test.${ts}@gmail.com`;
  const regRes = await api('/api/auth/register', 'POST', {
    email: memberEmail,
    password: 'Password123!',
    fullName: `Loan Test Member ${ts}`,
    phone: '09171234567',
    initialShareCapital: 2500
  });
  check('Member registration succeeded', regRes.status === 201);
  const memberId = regRes.data.user.id;

  // Approve member
  await api(`/api/members/${memberId}/status`, 'POST', {
    status: 'ACTIVE',
    remarks: 'Approved for loan test'
  }, staffToken);

  // Reconcile initial share
  const memberLogin = await api('/api/auth/login', 'POST', {
    email: memberEmail,
    password: 'Password123!'
  });
  check('Member authenticated', memberLogin.ok && !!memberLogin.data?.token);
  const memberToken = memberLogin.data.token;

  const prInitial = await api('/api/payments/request', 'POST', {
    paymentType: 'INITIAL_SHARE',
    amount: 5000,
    paymentMethod: 'GCASH',
    externalReference: `GC-INIT-${ts}`,
    remarks: 'Initial Share Capital Subscription'
  }, memberToken);
  if (!prInitial.ok) console.error('prInitial failed:', prInitial.status, prInitial.data);

  const initRecRes = await api(`/api/payments/reconcile/${prInitial.data.paymentRequest.id}`, 'POST', {
    action: 'APPROVE',
    notes: 'Initial share verified'
  }, staffToken);
  if (!initRecRes.ok) console.error('initRecRes failed:', initRecRes.status, initRecRes.data);

  // -------------------------------------------------------------------------
  // SECTION 1: CREATE & DISBURSE LOAN
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 1: CREATE & DISBURSE LOAN ---');
  const loanTypesRes = await api('/api/loans/types', 'GET', undefined, memberToken);
  const loanTypeId = loanTypesRes.data[0]?.id || 'loan_micro';

  // Submit loan application
  const loanAppRes = await api('/api/loans/apply', 'POST', {
    loanTypeId,
    amount: 20000,
    durationMonths: 6,
    purpose: 'Business Expansion'
  }, memberToken);
  if (!loanAppRes.ok) {
    console.error('loanAppRes failed:', loanAppRes.status, loanAppRes.data);
  }
  check('Loan application submitted', loanAppRes.status === 201);
  const loanAppId = loanAppRes.data.application.id;

  // Staff review & approve loan
  await api(`/api/loans/review/${loanAppId}`, 'POST', {
    status: 'UNDER_REVIEW',
    remarks: 'Documents verified and complete'
  }, staffToken);

  const loanApproveRes = await api(`/api/loans/approve/${loanAppId}`, 'POST', {
    action: 'APPROVE',
    remarks: 'Approved by Credit Committee'
  }, staffToken);
  check('Loan approved by staff', loanApproveRes.ok);

  // Disburse loan by Staff
  const disburseRes = await api(`/api/loans/disburse/${loanAppId}`, 'POST', {
    releaseMethod: 'CASH',
    notes: 'Released via Cashier'
  }, staffToken);
  check('Loan disbursed', disburseRes.ok);
  const loanId = disburseRes.data.loan.id;

  // -------------------------------------------------------------------------
  // SECTION 2: MEMBER LOAN DETAILS & AUTHORITATIVE SCHEDULE
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 2: LOAN DETAILS & AMORTIZATION SCHEDULE ---');
  const memberLoansRes = await api('/api/loans', 'GET', undefined, memberToken);
  check('Member can fetch their loans (GET /api/loans)', memberLoansRes.ok && memberLoansRes.data.loans.length > 0);
  const memberLoan = memberLoansRes.data.loans.find((l: any) => l.id === loanId);

  check('Loan principal visible', memberLoan && memberLoan.principalAmount === 20000);
  check('Total repayable visible', memberLoan && memberLoan.totalRepayable > 20000);
  check('Loan balance visible', memberLoan && memberLoan.balance === memberLoan.totalRepayable);
  check('Loan status is ACTIVE', memberLoan && memberLoan.status === 'ACTIVE');
  check('Loan disbursement date present', memberLoan && !!memberLoan.disbursedAt);

  // Fetch loan statement/ledger
  const ledgerRes = await api(`/api/loans/${loanId}/ledger`, 'GET', undefined, memberToken);
  check('Member can view loan statement & schedule (GET /api/loans/:id/ledger)', ledgerRes.ok);
  const schedule = ledgerRes.data.schedule;
  check('Schedule has 6 monthly installments', Array.isArray(schedule) && schedule.length === 6);

  const inst1 = schedule[0];
  check('Installment #1 has installmentNo = 1', inst1.installmentNo === 1);
  check('Installment #1 has valid authoritative dueDate (YYYY-MM-DD)', /^\d{4}-\d{2}-\d{2}$/.test(inst1.dueDate));
  check('Installment #1 has principalAmount > 0', inst1.principalAmount > 0);
  check('Installment #1 has interestAmount > 0', inst1.interestAmount > 0);
  check('Installment #1 has scheduledAmount = principal + interest', inst1.scheduledAmount === Number((inst1.principalAmount + inst1.interestAmount).toFixed(2)));
  check('Installment #1 amountPaid starts at 0', inst1.amountPaid === 0);
  check('Installment #1 status is UPCOMING or DUE', inst1.status === 'UPCOMING' || inst1.status === 'DUE');

  // Cross-member security check: Another member cannot view this loan ledger
  const otherReg = await api('/api/auth/register', 'POST', {
    email: `other.${ts}@gmail.com`,
    password: 'Password123!',
    fullName: 'Other Member',
    phone: '09179998888',
    initialShareCapital: 2500
  });
  await api(`/api/users/verify-member/${otherReg.data.user.id}`, 'POST', { action: 'APPROVE' }, staffToken);
  const otherLogin = await api('/api/auth/login', 'POST', { email: `other.${ts}@gmail.com`, password: 'Password123!' });
  const crossLedgerRes = await api(`/api/loans/${loanId}/ledger`, 'GET', undefined, otherLogin.data.token);
  check('Cross-member loan ledger access strictly blocked with HTTP 403', crossLedgerRes.status === 403);

  // -------------------------------------------------------------------------
  // SECTION 3: MEMBER LOAN PAYMENT WORKFLOW & MUTATION GUARDS
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3: PAYMENT WORKFLOW & TAMPER PREVENTION ---');
  // Attempt direct balance mutation by member
  const tamperRes = await api(`/api/loans/${loanId}/ledger`, 'POST', { balance: 0 }, memberToken);
  check('Direct loan balance mutation by member rejected (404 or 403 or method not allowed)', tamperRes.status !== 200);

  // Preview payment allocation
  const previewRes = await api(`/api/loans/${loanId}/amortization/preview-payment`, 'POST', {
    amount: inst1.scheduledAmount,
    targetInstallmentNo: 1
  }, memberToken);
  check('Payment allocation preview returns expected breakdown', previewRes.ok && previewRes.data.totalPrincipal > 0 && previewRes.data.totalInterest > 0);

  // Member submits payment request
  const payReqRes = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId,
    targetReferenceId: loanId,
    targetInstallmentNo: 1,
    amount: inst1.scheduledAmount,
    paymentMethod: 'GCASH',
    externalReference: `GC-LOAN-${ts}`,
    proofAttachmentUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  }, memberToken);
  check('Member loan payment request created with status PENDING_RECONCILIATION', payReqRes.status === 201 && payReqRes.data.paymentRequest.status === 'PENDING_RECONCILIATION');
  const payReqId = payReqRes.data.paymentRequest.id;

  // Verify loan balance is NOT reduced while payment is pending reconciliation
  const loanBeforeReconcile = (await api('/api/loans', 'GET', undefined, memberToken)).data.loans.find((l: any) => l.id === loanId);
  check('Loan balance remains unmutated while payment is PENDING_RECONCILIATION', loanBeforeReconcile.balance === memberLoan.totalRepayable);

  // -------------------------------------------------------------------------
  // SECTION 4: STAFF/ADMIN RECONCILIATION & POSTING
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 4: STAFF RECONCILIATION & POSTINGS ---');
  const reconcileRes = await api(`/api/payments/reconcile/${payReqId}`, 'POST', {
    action: 'APPROVE',
    notes: 'Verified GCash reference'
  }, staffToken);
  if (!reconcileRes.ok) {
    console.error('reconcileRes failed:', reconcileRes.status, reconcileRes.data);
  }
  check('Staff reconciled loan payment (HTTP 200)', reconcileRes.ok);

  const updatedLoan = (await api('/api/loans', 'GET', undefined, memberToken)).data.loans.find((l: any) => l.id === loanId);
  const expectedBalanceAfter = Number((memberLoan.totalRepayable - inst1.scheduledAmount).toFixed(2));
  check('Loan balance decreased by payment amount', Math.abs(updatedLoan.balance - expectedBalanceAfter) < 0.05);

  // Verify loan payment record created
  const ledgerAfterPay = (await api(`/api/loans/${loanId}/ledger`, 'GET', undefined, memberToken)).data;
  const paymentsList: LoanPayment[] = ledgerAfterPay.payments || [];
  const matchedPayment = paymentsList.find(p => p.paymentRequestId === payReqId);
  check('LoanPayment record exists with status APPROVED', !!matchedPayment && matchedPayment.status === 'APPROVED');
  check('LoanPayment has principalPaid recorded', !!matchedPayment && matchedPayment.principalPaid! > 0);
  check('LoanPayment has actual interestPaid recorded', !!matchedPayment && matchedPayment.interestPaid! > 0);

  // Verify FinancialPosting created
  const db = (CooperativeDB as any).load();
  const matchedPosting = (db.financialPostings || []).find((p: any) => p.postingKey.includes(payReqId) && p.status === 'POSTED');
  check('FinancialPosting exists with postingType LOAN_PAYMENT', !!matchedPosting && matchedPosting.postingType === 'LOAN_PAYMENT');
  check('FinancialPosting links to exact ledgerTransactionId', !!matchedPosting && !!matchedPosting.ledgerTransactionId);
  check('FinancialPosting links to exact Official Receipt', !!matchedPosting && !!matchedPosting.officialReceiptNo);

  // Verify Official Receipt created
  const matchedReceipt = (db.officialReceipts || []).find((r: any) => r.receiptNumber === matchedPosting.officialReceiptNo);
  check('OfficialReceipt exists with paymentType LOAN_PAYMENT', !!matchedReceipt && matchedReceipt.paymentType === 'LOAN_PAYMENT');
  check('OfficialReceipt transactionId points to exact Transaction', matchedReceipt?.transactionId === matchedPosting?.ledgerTransactionId);

  // Verify Schedule Item #1 is PAID and Item #2 is now the active upcoming due date
  const scheduleAfterPay = ledgerAfterPay.schedule;
  check('Installment #1 marked as PAID', scheduleAfterPay[0].status === 'PAID');
  check('Installment #1 remainingAmount is 0', scheduleAfterPay[0].remainingAmount === 0);
  check('Installment #2 remains unpaid and visible', scheduleAfterPay[1].status !== 'PAID');
  check('Loan nextDueDate updated to Installment #2 dueDate', updatedLoan.nextDueDate === scheduleAfterPay[1].dueDate);

  // -------------------------------------------------------------------------
  // SECTION 5: IDEMPOTENCY VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 5: IDEMPOTENCY GUARD ---');
  const duplicateReconcileRes = await api(`/api/payments/reconcile/${payReqId}`, 'POST', {
    action: 'APPROVE',
    notes: 'Retry reconcile duplicate attempt'
  }, staffToken);
  check('Duplicate reconciliation handled gracefully (HTTP 200 with already processed)', duplicateReconcileRes.ok);

  const loanAfterDup = (await api('/api/loans', 'GET', undefined, memberToken)).data.loans.find((l: any) => l.id === loanId);
  check('Loan balance NOT double-deducted on retry', Math.abs(loanAfterDup.balance - expectedBalanceAfter) < 0.05);

  const ledgerAfterDup = (await api(`/api/loans/${loanId}/ledger`, 'GET', undefined, memberToken)).data;
  const matchingPaymentsCount = (ledgerAfterDup.payments || []).filter((p: any) => p.paymentRequestId === payReqId).length;
  check('No duplicate LoanPayment record created', matchingPaymentsCount === 1);

  // -------------------------------------------------------------------------
  // SECTION 6: DATABASE RELOAD / RECALIBRATION
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 6: DATABASE RELOAD & PERSISTENCE ---');
  (CooperativeDB as any).state = null;
  const reloadedDb = CooperativeDB.load(true);
  const reloadedLoan = reloadedDb.loans.find(l => l.id === loanId);
  check('Loan balance preserved across DB reload', reloadedLoan && Math.abs(reloadedLoan.balance - expectedBalanceAfter) < 0.05);
  check('Amortization schedule status preserved across DB reload', reloadedLoan?.amortizationSchedule?.[0].status === 'PAID');

  // -------------------------------------------------------------------------
  // SECTION 7: OFFICIAL RECEIPT VOIDING & REVERSAL
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 7: OFFICIAL RECEIPT VOIDING & REVERSAL ---');
  const orToVoid = matchedReceipt?.receiptNumber;
  const voidRes = await api(`/api/receipts/${orToVoid}/void`, 'POST', {
    voidReason: 'Mistakenly processed loan payment'
  }, staffToken);
  check('Voiding Official Receipt succeeded (HTTP 200)', voidRes.ok);

  const receiptAfterVoid = (CooperativeDB.load(true).officialReceipts || []).find(r => r.receiptNumber === orToVoid);
  check('OfficialReceipt marked as VOIDED', receiptAfterVoid?.status === 'VOIDED');

  const postingAfterVoid = (CooperativeDB.load(true).financialPostings || []).find((p: any) => p.officialReceiptNo === orToVoid);
  check('FinancialPosting marked as VOIDED', postingAfterVoid?.status === 'VOIDED');

  const txAfterVoid = (CooperativeDB.load(true).transactions || []).find(t => t.id === matchedPosting?.ledgerTransactionId);
  check('Transaction marked as VOIDED', txAfterVoid?.status === 'VOIDED');

  // Verify second void attempt rejected
  const secondVoidRes = await api(`/api/receipts/${orToVoid}/void`, 'POST', {
    voidReason: 'Attempt duplicate void'
  }, staffToken);
  check('Second void attempt strictly rejected with HTTP 400', secondVoidRes.status === 400);

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');
}

runLoanLifecycleVerification().catch(err => {
  console.error('Fatal error running verification:', err);
  process.exit(1);
});

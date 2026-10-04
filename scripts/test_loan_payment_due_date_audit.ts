import fs from 'fs';
import path from 'path';
import { CooperativeDB } from '../src/db/db';
import { Loan, AmortizationItem, LoanPayment, OfficialReceipt, Transaction, FinancialPosting } from '../src/types';

const BASE_URL = 'http://localhost:3000';

async function api(endpoint: string, method: string = 'GET', body?: any, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

let passed = 0;
let failed = 0;
const failureDetails: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${label}`);
  } else {
    failed++;
    const errMsg = `${label}${detail ? ` — ${detail}` : ''}`;
    failureDetails.push(errMsg);
    console.error(`  ❌ FAIL: ${errMsg}`);
  }
}

async function runLoanAudit() {
  console.log('======================================================================');
  console.log('STARTING: END-TO-END LOAN PAYMENT & DUE-DATE FUNCTIONAL AUDIT (TESTS 1-14)');
  console.log('======================================================================\n');

  // Authenticate Admin & Staff
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

  // Setup Test Member
  const ts = Date.now();
  const memberEmail = `audit.member.${ts}@example.com`;
  const regRes = await api('/api/auth/register', 'POST', {
    email: memberEmail,
    password: 'Password123!',
    fullName: `Audit Loan Member ${ts}`,
    phone: '09181234567',
    initialShareCapital: 2500
  });
  check('Member registration succeeded', regRes.status === 201);
  const memberId = regRes.data.user.id;

  // Approve member status
  await api(`/api/members/${memberId}/status`, 'POST', {
    status: 'ACTIVE',
    remarks: 'Approved for audit testing'
  }, staffToken);

  const memberLogin = await api('/api/auth/login', 'POST', {
    email: memberEmail,
    password: 'Password123!'
  });
  check('Member logged in', memberLogin.ok && !!memberLogin.data?.token);
  const memberToken = memberLogin.data.token;

  // Satisfy initial share capital so member is fully eligible
  const initSharePR = await api('/api/payments/request', 'POST', {
    paymentType: 'INITIAL_SHARE',
    amount: 10000,
    paymentMethod: 'GCASH',
    externalReference: `GC-INIT-${ts}`,
    remarks: 'Initial share subscription'
  }, memberToken);
  await api(`/api/payments/reconcile/${initSharePR.data.paymentRequest.id}`, 'POST', {
    action: 'APPROVE',
    notes: 'Reconciled initial share'
  }, staffToken);

  const loanTypesRes = await api('/api/loans/types', 'GET', undefined, memberToken);
  const loanTypeId = loanTypesRes.data[0]?.id || 'loan_micro';

  // ---------------------------------------------------------------------------
  // TEST 1: Create/disburse a loan and verify first due date and complete schedule
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 1: CREATE / DISBURSE LOAN & VERIFY FIRST DUE DATE & AMORTIZATION SCHEDULE ---');
  const applyRes = await api('/api/loans/apply', 'POST', {
    loanTypeId,
    amount: 20000,
    durationMonths: 6,
    purpose: 'Audit Validation'
  }, memberToken);
  if (!applyRes.ok) {
    console.error('applyRes failed:', applyRes.status, applyRes.data);
  }
  check('TEST 1.1: Loan application submitted', applyRes.status === 201);
  const appId = applyRes.data.application.id;

  // Staff review & approve
  await api(`/api/loans/review/${appId}`, 'POST', { status: 'UNDER_REVIEW' }, staffToken);
  const approveRes = await api(`/api/loans/approve/${appId}`, 'POST', { action: 'APPROVE' }, staffToken);
  check('TEST 1.2: Loan approved by staff', approveRes.ok);

  // Disburse loan
  const disburseRes = await api(`/api/loans/disburse/${appId}`, 'POST', {
    releaseMethod: 'CASH',
    remarks: 'Disbursed for loan payment audit'
  }, staffToken);
  check('TEST 1.3: Loan disbursed', disburseRes.ok && !!disburseRes.data?.loan?.id);
  const loan1 = disburseRes.data.loan;
  const loanId1 = loan1.id;

  // Fetch loan statement & authoritative schedule
  const ledgerRes1 = await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken);
  check('TEST 1.4: Loan ledger fetched', ledgerRes1.ok);
  const sched1: AmortizationItem[] = ledgerRes1.data.schedule;
  check('TEST 1.5: Schedule has exactly 6 installments', sched1.length === 6);
  check('TEST 1.6: First installment has valid due date (YYYY-MM-DD)', /^\d{4}-\d{2}-\d{2}$/.test(sched1[0].dueDate));
  check('TEST 1.7: Loan nextDueDate matches installment #1 dueDate', ledgerRes1.data.summary.nextDueDate === sched1[0].dueDate);
  check('TEST 1.8: First installment has principal > 0 and interest > 0', sched1[0].principalAmount > 0 && sched1[0].interestAmount > 0);
  check('TEST 1.9: Installment scheduledAmount = principal + interest', Math.abs(sched1[0].scheduledAmount - (sched1[0].principalAmount + sched1[0].interestAmount)) < 0.02);
  check('TEST 1.10: First installment status starts as UPCOMING or DUE', sched1[0].status === 'UPCOMING' || sched1[0].status === 'DUE');

  // ---------------------------------------------------------------------------
  // TEST 2: Member submits GCash payment. Verify request pending & NO loan balance mutation
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: MEMBER SUBMITS GCASH PAYMENT (VERIFY PENDING & NO BALANCE MUTATION) ---');
  const openingBalance1 = ledgerRes1.data.summary.outstandingBalance;
  const gcashRef2 = `GC-AUDIT-${ts}-2`;
  const inst1Scheduled = sched1[0].scheduledAmount;

  const prRes2 = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId1,
    targetReferenceId: loanId1,
    targetInstallmentNo: 1,
    amount: inst1Scheduled,
    paymentMethod: 'GCASH',
    externalReference: gcashRef2,
    proofAttachmentUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  }, memberToken);
  check('TEST 2.1: Payment Request created', prRes2.status === 201 && !!prRes2.data?.paymentRequest?.id);
  check('TEST 2.2: Payment Request status is PENDING_RECONCILIATION', prRes2.data.paymentRequest.status === 'PENDING_RECONCILIATION');
  const prId2 = prRes2.data.paymentRequest.id;

  // Verify loan balance is completely untouched
  const loanCheck2 = await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken);
  check('TEST 2.3: Loan balance remains UNCHANGED while pending', loanCheck2.data.summary.outstandingBalance === openingBalance1);

  // ---------------------------------------------------------------------------
  // TEST 3: Staff reconciles GCash payment. Verify posting, allocation, balance, receipt, tx
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: STAFF RECONCILES GCASH PAYMENT (VERIFY POSTING & ALLOCATION) ---');
  const recRes3 = await api(`/api/payments/reconcile/${prId2}`, 'POST', {
    action: 'APPROVE',
    notes: 'Reconciled Test 3 GCash payment'
  }, staffToken);
  check('TEST 3.1: Staff reconciliation succeeded', recRes3.ok);

  const loanCheck3 = await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken);
  const expectedBalance3 = Number((openingBalance1 - inst1Scheduled).toFixed(2));
  check('TEST 3.2: Loan balance decreased accurately by payment amount', Math.abs(loanCheck3.data.summary.outstandingBalance - expectedBalance3) < 0.05);

  const dbState3 = CooperativeDB.load(true);
  const matchedPosting3 = (dbState3.financialPostings || []).find((p: any) => p.postingKey.includes(prId2) && p.status === 'POSTED');
  check('TEST 3.3: FinancialPosting exists with status POSTED', !!matchedPosting3);
  check('TEST 3.4: FinancialPosting has postingType LOAN_PAYMENT', matchedPosting3?.postingType === 'LOAN_PAYMENT');
  check('TEST 3.5: FinancialPosting has exact ledgerTransactionId', !!matchedPosting3?.ledgerTransactionId);

  const matchedTx3 = (dbState3.transactions || []).find(t => t.id === matchedPosting3?.ledgerTransactionId);
  check('TEST 3.6: Transaction exists with type LOAN_PAYMENT', !!matchedTx3 && matchedTx3.type === 'LOAN_PAYMENT');
  check('TEST 3.7: Transaction has principalPortion and interestPortion recorded', matchedTx3?.principalPortion !== undefined && matchedTx3?.interestPortion !== undefined);

  const matchedReceipt3 = (dbState3.officialReceipts || []).find(r => r.receiptNumber === matchedPosting3?.officialReceiptNo);
  check('TEST 3.8: Official Receipt exists', !!matchedReceipt3);
  check('TEST 3.9: Official Receipt transactionId matches Transaction ID exactly', matchedReceipt3?.transactionId === matchedTx3?.id);

  // ---------------------------------------------------------------------------
  // TEST 4: Member reloads dashboard. Verify payment appears, next due date, remaining balance
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: MEMBER RELOADS DASHBOARD (VERIFY SCHEDULE & NEXT DUE DATE) ---');
  const memberLoansRes4 = await api('/api/loans', 'GET', undefined, memberToken);
  const loanInDashboard = memberLoansRes4.data.loans.find((l: any) => l.id === loanId1);
  check('TEST 4.1: Member can fetch loans list', !!loanInDashboard);
  check('TEST 4.2: Remaining balance is correct', Math.abs(loanInDashboard.balance - expectedBalance3) < 0.05);

  const ledgerRes4 = await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken);
  const sched4 = ledgerRes4.data.schedule;
  check('TEST 4.3: Installment #1 is marked PAID', sched4[0].status === 'PAID');
  check('TEST 4.4: Next unpaid installment (#2) becomes nextDueDate', loanInDashboard.nextDueDate === sched4[1].dueDate);
  check('TEST 4.5: LoanPayment record visible in ledger payments', (ledgerRes4.data.payments || []).some((p: any) => p.paymentRequestId === prId2));

  // ---------------------------------------------------------------------------
  // TEST 5: Submit Bank Transfer with external ref. Attempt reuse same ref. Verify rejected.
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: BANK TRANSFER PAYMENT & DUPLICATE REFERENCE REJECTION ---');
  const bankRef5 = `BT-REF-${ts}-5`;
  const prRes5 = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId1,
    targetReferenceId: loanId1,
    targetInstallmentNo: 2,
    amount: sched4[1].scheduledAmount,
    paymentMethod: 'BANK_TRANSFER',
    externalReference: bankRef5,
    proofAttachmentUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  }, memberToken);
  check('TEST 5.1: Bank Transfer payment request created', prRes5.status === 201);

  // Reconcile the payment
  const recRes5 = await api(`/api/payments/reconcile/${prRes5.data.paymentRequest.id}`, 'POST', {
    action: 'APPROVE',
    notes: 'Approved Bank Transfer'
  }, staffToken);
  check('TEST 5.2: Bank Transfer reconciled and posted', recRes5.ok);

  // Attempt duplicate submission with the same external reference
  const duplicatePR = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId1,
    targetReferenceId: loanId1,
    targetInstallmentNo: 3,
    amount: 1000,
    paymentMethod: 'BANK_TRANSFER',
    externalReference: bankRef5
  }, memberToken);
  check('TEST 5.3: Reusing external reference rejected with HTTP 400', duplicatePR.status === 400);

  // ---------------------------------------------------------------------------
  // TEST 6: Submit Office Cash loan payment. Verify no balance mutation before staff reconcile.
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: OFFICE CASH PAYMENT (NO MUTATION BEFORE RECONCILIATION) ---');
  const balanceBeforeCash = (await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken)).data.summary.outstandingBalance;

  const cashPR = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId1,
    targetReferenceId: loanId1,
    targetInstallmentNo: 3,
    amount: 1500,
    paymentMethod: 'CASH',
    remarks: 'Office Cash payment at counter'
  }, memberToken);
  check('TEST 6.1: Office Cash payment request created', cashPR.status === 201 && cashPR.data.paymentRequest.status === 'PENDING_RECONCILIATION');

  const balanceAfterCashPR = (await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken)).data.summary.outstandingBalance;
  check('TEST 6.2: Zero loan balance mutation before cashier reconciliation', balanceAfterCashPR === balanceBeforeCash);

  // Cashier reconciles the cash payment
  const cashRec = await api(`/api/payments/reconcile/${cashPR.data.paymentRequest.id}`, 'POST', {
    action: 'APPROVE',
    notes: 'Physical cash received and verified at counter'
  }, staffToken);
  check('TEST 6.3: Cashier reconciled Office Cash payment', cashRec.ok);

  const balanceAfterCashRec = (await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken)).data.summary.outstandingBalance;
  check('TEST 6.4: Balance reduced after Cashier reconciliation', Math.abs(balanceAfterCashRec - (balanceBeforeCash - 1500)) < 0.05);

  // ---------------------------------------------------------------------------
  // TEST 7: Make a partial installment payment. Verify installment not marked fully paid.
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: PARTIAL INSTALLMENT PAYMENT ---');
  const schedBeforePartial = (await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken)).data.schedule;
  const targetInst3 = schedBeforePartial.find((s: any) => s.installmentNo === 3);
  const remainingDueInst3 = targetInst3.remainingAmount || (targetInst3.scheduledAmount - (targetInst3.amountPaid || 0));

  // Pay half of what is remaining on installment #3
  const partialAmount = Math.round((remainingDueInst3 / 2) * 100) / 100;
  const partialPR = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId1,
    targetReferenceId: loanId1,
    targetInstallmentNo: 3,
    amount: partialAmount,
    paymentMethod: 'GCASH',
    externalReference: `GC-PARTIAL-${ts}`,
    proofAttachmentUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  }, memberToken);

  await api(`/api/payments/reconcile/${partialPR.data.paymentRequest.id}`, 'POST', { action: 'APPROVE' }, staffToken);

  const schedAfterPartial = (await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken)).data.schedule;
  const inst3After = schedAfterPartial.find((s: any) => s.installmentNo === 3);
  check('TEST 7.1: Partial payment installment status is PARTIALLY_PAID (not PAID)', inst3After.status === 'PARTIALLY_PAID');
  check('TEST 7.2: Installment remainingAmount is correct', Math.abs(inst3After.remainingAmount - (remainingDueInst3 - partialAmount)) < 0.05);

  // ---------------------------------------------------------------------------
  // TEST 8: Make a full installment payment. Verify next installment becomes next due date.
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: COMPLETE INSTALLMENT PAYMENT (ADVANCE NEXT DUE DATE) ---');
  const settleInst3PR = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId1,
    targetReferenceId: loanId1,
    targetInstallmentNo: 3,
    amount: inst3After.remainingAmount,
    paymentMethod: 'GCASH',
    externalReference: `GC-SETTLE3-${ts}`,
    proofAttachmentUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  }, memberToken);

  await api(`/api/payments/reconcile/${settleInst3PR.data.paymentRequest.id}`, 'POST', { action: 'APPROVE' }, staffToken);

  const ledgerAfterInst3 = (await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken)).data;
  const schedAfterInst3 = ledgerAfterInst3.schedule;
  check('TEST 8.1: Installment #3 is now fully PAID', schedAfterInst3.find((s: any) => s.installmentNo === 3).status === 'PAID');
  check('TEST 8.2: Installment #4 becomes nextDueDate', ledgerAfterInst3.summary.nextDueDate === schedAfterInst3.find((s: any) => s.installmentNo === 4).dueDate);

  // ---------------------------------------------------------------------------
  // TEST 9: Pay final outstanding balance. Verify COMPLETED/PAID only when balance = 0.
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 9: PAY FINAL OUTSTANDING BALANCE (LOAN COMPLETION ONLY AT ZERO) ---');
  const finalBalanceBefore = ledgerAfterInst3.summary.outstandingBalance;
  check('TEST 9.1: Loan status is still ACTIVE before final payment', ledgerAfterInst3.summary.status === 'ACTIVE');

  const finalPayPR = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId1,
    targetReferenceId: loanId1,
    amount: finalBalanceBefore,
    paymentMethod: 'GCASH',
    externalReference: `GC-FINAL-${ts}`,
    proofAttachmentUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  }, memberToken);

  await api(`/api/payments/reconcile/${finalPayPR.data.paymentRequest.id}`, 'POST', { action: 'APPROVE' }, staffToken);

  const finalLedger = (await api(`/api/loans/${loanId1}/ledger`, 'GET', undefined, memberToken)).data;
  check('TEST 9.2: Final balance is exactly 0', finalLedger.summary.outstandingBalance === 0);
  check('TEST 9.3: Loan status is COMPLETED or PAID', finalLedger.summary.status === 'COMPLETED' || finalLedger.summary.status === 'PAID');

  // ---------------------------------------------------------------------------
  // TEST 10: Void a posted loan payment. Verify financial records & balance reversed correctly.
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 10: VOID POSTED LOAN PAYMENT (REVERSE FINANCIAL RECORDS & BALANCE) ---');
  // Create a second active loan for void testing
  const app2 = (await api('/api/loans/apply', 'POST', {
    loanTypeId,
    amount: 15000,
    durationMonths: 3,
    purpose: 'Void Testing'
  }, memberToken)).data.application;

  // Settle previous completed loan so member is permitted to apply
  await api(`/api/loans/review/${app2.id}`, 'POST', { status: 'UNDER_REVIEW' }, staffToken);
  await api(`/api/loans/approve/${app2.id}`, 'POST', { action: 'APPROVE' }, staffToken);
  const loan2 = (await api(`/api/loans/disburse/${app2.id}`, 'POST', { releaseMethod: 'CASH' }, staffToken)).data.loan;
  const loanId2 = loan2.id;

  const sched2 = (await api(`/api/loans/${loanId2}/ledger`, 'GET', undefined, memberToken)).data.schedule;
  const payAmt10 = sched2[0].scheduledAmount;

  const pr10 = (await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId2,
    targetReferenceId: loanId2,
    targetInstallmentNo: 1,
    amount: payAmt10,
    paymentMethod: 'GCASH',
    externalReference: `GC-VOID-TEST-${ts}`,
    proofAttachmentUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  }, memberToken)).data.paymentRequest;

  await api(`/api/payments/reconcile/${pr10.id}`, 'POST', { action: 'APPROVE' }, staffToken);

  const dbBeforeVoid = CooperativeDB.load(true);
  const posting10 = (dbBeforeVoid.financialPostings || []).find((p: any) => p.postingKey.includes(pr10.id) && p.status === 'POSTED');
  const or10 = posting10?.officialReceiptNo;
  check('TEST 10.1: Receipt exists before void', !!or10);

  // Void receipt
  const voidRes = await api(`/api/receipts/${or10}/void`, 'POST', {
    voidReason: 'Mistakenly processed installment 1'
  }, staffToken);
  check('TEST 10.2: Void endpoint returned HTTP 200', voidRes.ok);

  const dbAfterVoid = CooperativeDB.load(true);
  const receiptAfterVoid = (dbAfterVoid.officialReceipts || []).find(r => r.receiptNumber === or10);
  check('TEST 10.3: OfficialReceipt status is VOIDED', receiptAfterVoid?.status === 'VOIDED');

  const postingAfterVoid = (dbAfterVoid.financialPostings || []).find((p: any) => p.officialReceiptNo === or10);
  check('TEST 10.4: FinancialPosting status is VOIDED', postingAfterVoid?.status === 'VOIDED');

  const txAfterVoid = (dbAfterVoid.transactions || []).find(t => t.id === posting10?.ledgerTransactionId);
  check('TEST 10.5: Transaction status is VOIDED', txAfterVoid?.status === 'VOIDED');

  const loanPaymentAfterVoid = (dbAfterVoid.loanPayments || []).find(lp => lp.paymentRequestId === pr10.id);
  check('TEST 10.6: LoanPayment record status is VOIDED', loanPaymentAfterVoid?.status === 'VOIDED');

  const loanAfterVoid = (await api(`/api/loans/${loanId2}/ledger`, 'GET', undefined, memberToken)).data;
  check('TEST 10.7: Loan balance restored to original amount', loanAfterVoid.summary.outstandingBalance === loan2.totalRepayable);
  check('TEST 10.8: Installment #1 restored to unpaid status', loanAfterVoid.schedule[0].status !== 'PAID');
  check('TEST 10.9: Installment #1 amountPaid restored to 0', loanAfterVoid.schedule[0].amountPaid === 0);

  // ---------------------------------------------------------------------------
  // TEST 11: Reload/restart database. Verify balances, history, due dates identical.
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 11: DATABASE RELOAD & PERSISTENCE INTEGRITY ---');
  (CooperativeDB as any).state = null; // Clear cached state in memory
  const reloadedDb = CooperativeDB.load(true); // Force reload from disk
  const reloadedLoan = reloadedDb.loans.find(l => l.id === loanId2);

  check('TEST 11.1: Loan balance identical after DB reload', reloadedLoan?.balance === loan2.totalRepayable);
  check('TEST 11.2: Due date preserved across DB reload', reloadedLoan?.dueDate === loan2.dueDate, `reloaded=${reloadedLoan?.dueDate} vs loan2=${loan2.dueDate}`);
  check('TEST 11.3: Amortization schedule length preserved across reload', reloadedLoan?.amortizationSchedule?.length === 3);

  // ---------------------------------------------------------------------------
  // TEST 12: Create two loan payments with same amount on same date. Verify unique receipts.
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 12: TWO IDENTICAL PAYMENTS SAME DATE & UNIQUE RECEIPTS ---');
  const pr12A = (await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId2,
    targetReferenceId: loanId2,
    targetInstallmentNo: 1,
    amount: 1000,
    paymentMethod: 'GCASH',
    externalReference: `GC-IDENTICAL-A-${ts}`,
    proofAttachmentUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  }, memberToken)).data.paymentRequest;

  const pr12B = (await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: loanId2,
    targetReferenceId: loanId2,
    targetInstallmentNo: 1,
    amount: 1000,
    paymentMethod: 'GCASH',
    externalReference: `GC-IDENTICAL-B-${ts}`,
    proofAttachmentUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  }, memberToken)).data.paymentRequest;

  await api(`/api/payments/reconcile/${pr12A.id}`, 'POST', { action: 'APPROVE' }, staffToken);
  await api(`/api/payments/reconcile/${pr12B.id}`, 'POST', { action: 'APPROVE' }, staffToken);

  const db12 = CooperativeDB.load(true);
  const postingA = (db12.financialPostings || []).find((p: any) => p.postingKey.includes(pr12A.id) && p.status === 'POSTED');
  const postingB = (db12.financialPostings || []).find((p: any) => p.postingKey.includes(pr12B.id) && p.status === 'POSTED');

  check('TEST 12.1: Payment A and Payment B receive different Official Receipt numbers', postingA?.officialReceiptNo !== postingB?.officialReceiptNo);
  check('TEST 12.2: Payment A and Payment B point to distinct transaction IDs', postingA?.ledgerTransactionId !== postingB?.ledgerTransactionId);

  const orA = (db12.officialReceipts || []).find(r => r.receiptNumber === postingA?.officialReceiptNo);
  const orB = (db12.officialReceipts || []).find(r => r.receiptNumber === postingB?.officialReceiptNo);
  check('TEST 12.3: Receipt A points to Transaction A', orA?.transactionId === postingA?.ledgerTransactionId);
  check('TEST 12.4: Receipt B points to Transaction B', orB?.transactionId === postingB?.ledgerTransactionId);

  // ---------------------------------------------------------------------------
  // TEST 13: Attempt direct MEMBER financial posting. Verify HTTP 403 & 0 mutation.
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 13: DIRECT MEMBER FINANCIAL POSTING PREVENTION ---');
  const balanceBeforeDirect = (await api(`/api/loans/${loanId2}/ledger`, 'GET', undefined, memberToken)).data.summary.outstandingBalance;

  // Member attempts to directly call /api/loans/pay
  const directPayRes = await api('/api/loans/pay', 'POST', {
    loanId: loanId2,
    amount: 2000
  }, memberToken);

  check('TEST 13.1: Direct member financial posting blocked with HTTP 403 Forbidden', directPayRes.status === 403);

  const balanceAfterDirect = (await api(`/api/loans/${loanId2}/ledger`, 'GET', undefined, memberToken)).data.summary.outstandingBalance;
  check('TEST 13.2: Zero balance mutation on direct member posting attempt', balanceAfterDirect === balanceBeforeDirect);

  // ---------------------------------------------------------------------------
  // TEST 14: Overdue calculation using authoritative schedule due date
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 14: AUTHORITATIVE OVERDUE CALCULATION ---');
  // Create a loan with an overdue installment by setting past due date
  const db14 = CooperativeDB.load(true);
  const targetLoan14 = db14.loans.find(l => l.id === loanId2);
  if (targetLoan14 && targetLoan14.amortizationSchedule) {
    // Set installment 1 due date to past (30 days ago)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    targetLoan14.amortizationSchedule[0].dueDate = pastDate.toISOString().split('T')[0];
    CooperativeDB.save(db14);
  }

  const ledger14 = (await api(`/api/loans/${loanId2}/ledger`, 'GET', undefined, memberToken)).data;
  const overdueInst = ledger14.schedule.find((s: any) => s.installmentNo === 1);
  check('TEST 14.1: Installment with past due date marked PAST_DUE', overdueInst.status === 'PAST_DUE', `status=${overdueInst.status}, due=${overdueInst.dueDate}`);
  check('TEST 14.2: Due date originates authoritatively from amortizationSchedule', ledger14.summary.nextDueDate === overdueInst.dueDate);

  // Summary
  console.log('\n======================================================================');
  console.log(`AUDIT RESULTS: ${passed} passed, ${failed} failed`);
  if (failureDetails.length > 0) {
    console.log('FAILURES:');
    failureDetails.forEach(f => console.log(`  - ${f}`));
  }
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLoanAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});

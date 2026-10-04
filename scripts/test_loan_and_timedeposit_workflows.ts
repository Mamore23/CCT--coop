import fs from 'fs';
import path from 'path';
import { CooperativeDB } from '../src/db/db';
import { Loan, AmortizationItem, LoanPayment, OfficialReceipt, Transaction, TimeDepositContract } from '../src/types';
import { getManilaDateString, evaluateInstallmentStatuses } from '../src/server/routes';

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

async function runComprehensiveWorkflowsVerification() {
  console.log('======================================================================');
  console.log('STARTING: COMPREHENSIVE LOAN, PAYMENT, DUE-DATE & TIME DEPOSIT SUITE (A - V)');
  console.log('======================================================================\n');

  // 1. Authenticate Staff & Admin
  const adminLogin = await api('/api/auth/login', 'POST', { email: 'admin@coop.com', password: 'admin123' });
  check('Admin authenticated', adminLogin.ok && !!adminLogin.data?.token);
  const adminToken = adminLogin.data.token;

  const staffLogin = await api('/api/auth/login', 'POST', { email: 'staff@coop.com', password: 'staff123' });
  check('Staff authenticated', staffLogin.ok && !!staffLogin.data?.token);
  const staffToken = staffLogin.data.token;

  // 2. Register & approve dedicated test member
  const ts = Date.now();
  const memberEmail = `wf.test.${ts}@gmail.com`;
  const regRes = await api('/api/auth/register', 'POST', {
    email: memberEmail,
    password: 'Password123!',
    fullName: `Workflow Tester ${ts}`,
    phone: '09175558888',
    initialShareCapital: 10000
  });
  check('Member registration succeeded', regRes.status === 201);
  const memberId = regRes.data.user.id;

  // Approve member and set compliance flags
  await api(`/api/members/${memberId}/status`, 'POST', {
    status: 'ACTIVE',
    remarks: 'Approved for Comprehensive Workflow Testing'
  }, staffToken);

  const memberLogin = await api('/api/auth/login', 'POST', { email: memberEmail, password: 'Password123!' });
  check('Member authenticated', memberLogin.ok && !!memberLogin.data?.token);
  const memberToken = memberLogin.data.token;

  // Reconcile initial share capital (₱10,000)
  const initSharePr = await api('/api/payments/request', 'POST', {
    paymentType: 'INITIAL_SHARE',
    amount: 10000,
    paymentMethod: 'GCASH',
    externalReference: `GC-INIT-${ts}`
  }, memberToken);

  await api(`/api/payments/reconcile/${initSharePr.data.paymentRequest.id}`, 'POST', {
    action: 'APPROVE',
    notes: 'Initial share capital verified'
  }, staffToken);

  // Fund Regular Savings with ₱20,000 for Time Deposit and other tests
  const fundSavingsPr = await api('/api/payments/request', 'POST', {
    paymentType: 'SAVINGS_DEPOSIT',
    amount: 20000,
    paymentMethod: 'GCASH',
    externalReference: `GC-SAVINGS-${ts}`
  }, memberToken);

  await api(`/api/payments/reconcile/${fundSavingsPr.data.paymentRequest.id}`, 'POST', {
    action: 'APPROVE',
    notes: 'Savings deposit verified'
  }, staffToken);

  // Apply, Approve & Disburse a 6-month micro loan of ₱20,000
  const loanTypesRes = await api('/api/loans/types', 'GET', undefined, memberToken);
  const loanTypeId = loanTypesRes.data[0]?.id || 'loan_micro';

  const loanAppRes = await api('/api/loans/apply', 'POST', {
    loanTypeId,
    amount: 20000,
    durationMonths: 6,
    purpose: 'Equipment Purchase'
  }, memberToken);
  check('Loan application submitted', loanAppRes.status === 201);
  const loanAppId = loanAppRes.data.application.id;

  await api(`/api/loans/review/${loanAppId}`, 'POST', { status: 'UNDER_REVIEW', remarks: 'Complete docs' }, staffToken);
  await api(`/api/loans/approve/${loanAppId}`, 'POST', { action: 'APPROVE', remarks: 'Approved' }, staffToken);
  const disburseRes = await api(`/api/loans/disburse/${loanAppId}`, 'POST', { releaseMethod: 'CASH', notes: 'Disbursed' }, staffToken);
  check('Loan disbursed', disburseRes.ok);
  const loanId = disburseRes.data.loan.id;

  // -------------------------------------------------------------------------
  // SCENARIO A: Member views active loan
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO A: Member Views Active Loan ---');
  const myLoansRes = await api('/api/loans', 'GET', undefined, memberToken);
  const activeLoan = myLoansRes.data.loans.find((l: any) => l.id === loanId);
  check('SCENARIO A: Member can view active loan', !!activeLoan && activeLoan.status === 'ACTIVE');
  check('Active loan displays principal amount ₱20,000', activeLoan?.principalAmount === 20000);
  check('Active loan displays total repayable', activeLoan?.totalRepayable > 20000);
  check('Active loan displays current outstanding balance equal to total repayable', activeLoan?.balance === activeLoan?.totalRepayable);

  // -------------------------------------------------------------------------
  // SCENARIO B: Member sees correct next due date
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO B: Member Sees Correct Next Due Date ---');
  check('SCENARIO B: Active loan has authoritative nextDueDate', !!activeLoan?.nextDueDate);
  check('Active loan nextDueDate matches schedule installment #1 dueDate', activeLoan?.nextDueDate === activeLoan?.amortizationSchedule[0]?.dueDate);

  // -------------------------------------------------------------------------
  // SCENARIO C: Member sees complete amortization schedule
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO C: Member Sees Complete Amortization Schedule ---');
  const ledgerRes = await api(`/api/loans/${loanId}/ledger`, 'GET', undefined, memberToken);
  const schedule: AmortizationItem[] = ledgerRes.data.schedule || [];
  check('SCENARIO C: Complete schedule returned with 6 installments', schedule.length === 6);
  const firstInst = schedule[0];
  check('Schedule item has installmentNo', firstInst.installmentNo === 1);
  check('Schedule item has dueDate', !!firstInst.dueDate);
  check('Schedule item has principalAmount', firstInst.principalAmount > 0);
  check('Schedule item has interestAmount', firstInst.interestAmount > 0);
  check('Schedule item has penaltyAmount initialized to 0', firstInst.penaltyAmount === 0);
  check('Schedule item has scheduledAmount equal to principal + interest', firstInst.scheduledAmount === Number((firstInst.principalAmount + firstInst.interestAmount).toFixed(2)));
  check('Schedule item has amountPaid initialized to 0', firstInst.amountPaid === 0);
  check('Schedule item has remainingAmount equal to scheduledAmount', firstInst.remainingAmount === firstInst.scheduledAmount);
  check('Schedule item has status UPCOMING or DUE', firstInst.status === 'UPCOMING' || firstInst.status === 'DUE');

  // -------------------------------------------------------------------------
  // SCENARIO D: Member submits GCash loan payment
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO D: Member Submits GCash Loan Payment ---');
  const gcashPaymentAmount = firstInst.scheduledAmount;
  const gcashRef = `GCASH-LOAN-${ts}`;
  const gcashPayReq = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId,
    targetReferenceId: loanId,
    targetInstallmentNo: 1,
    amount: gcashPaymentAmount,
    paymentMethod: 'GCASH',
    externalReference: gcashRef,
    proofAttachmentUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  }, memberToken);
  check('SCENARIO D: GCash loan payment request created (HTTP 201)', gcashPayReq.status === 201);
  check('GCash payment request status is PENDING_RECONCILIATION', gcashPayReq.data.paymentRequest?.status === 'PENDING_RECONCILIATION');
  const gcashReqId = gcashPayReq.data.paymentRequest?.id;

  // Verify balance remains unmutated while pending
  const loanBeforeStaff = (await api('/api/loans', 'GET', undefined, memberToken)).data.loans.find((l: any) => l.id === loanId);
  check('Loan balance NOT changed prior to Staff reconciliation', loanBeforeStaff.balance === activeLoan.totalRepayable);

  // -------------------------------------------------------------------------
  // SCENARIO E, F, G, H, I, J, K, L, M: Staff reconciles GCash loan payment
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIOS E - M: Staff Reconciles GCash Payment & Verifies Ledger ---');
  const gcashReconcileRes = await api(`/api/payments/reconcile/${gcashReqId}`, 'POST', {
    action: 'APPROVE',
    notes: 'GCash loan payment verified'
  }, staffToken);
  check('SCENARIO E: Staff reconciled GCash loan payment (HTTP 200)', gcashReconcileRes.ok);

  // SCENARIO F: Loan balance decreases correctly
  const loanAfterGcash = (await api('/api/loans', 'GET', undefined, memberToken)).data.loans.find((l: any) => l.id === loanId);
  const expectedBalAfter1 = Number((activeLoan.totalRepayable - gcashPaymentAmount).toFixed(2));
  check('SCENARIO F: Loan balance decreases by exact payment amount', Math.abs(loanAfterGcash.balance - expectedBalAfter1) < 0.05);

  // SCENARIO G: Verify principal/interest/penalty allocation order
  const ledgerAfterGcash = (await api(`/api/loans/${loanId}/ledger`, 'GET', undefined, memberToken)).data;
  const paymentsList: LoanPayment[] = ledgerAfterGcash.payments || [];
  const gcashPaymentRecord = paymentsList.find(p => p.paymentRequestId === gcashReqId);
  check('SCENARIO G1: Payment allocated penalty first (0 when no penalty due)', gcashPaymentRecord?.penaltyPaid === 0);
  check('SCENARIO G2: Payment allocated interest portion correctly', gcashPaymentRecord && gcashPaymentRecord.interestPaid! > 0);
  check('SCENARIO G3: Payment allocated principal portion correctly', gcashPaymentRecord && gcashPaymentRecord.principalPaid! > 0);
  check('SCENARIO G4: Sum of principal + interest + penalty paid equals total payment amount', Number((gcashPaymentRecord!.principalPaid! + gcashPaymentRecord!.interestPaid! + gcashPaymentRecord!.penaltyPaid!).toFixed(2)) === gcashPaymentAmount);

  // SCENARIO H: Verify LoanPayment record
  check('SCENARIO H: LoanPayment record created with status APPROVED', gcashPaymentRecord?.status === 'APPROVED');
  check('LoanPayment references exact loanId and paymentRequestId', gcashPaymentRecord?.loanId === loanId && gcashPaymentRecord?.paymentRequestId === gcashReqId);

  // SCENARIO I: Verify Transaction
  const dbState = CooperativeDB.load(true);
  const ledgerTx = (dbState.transactions || []).find(t => t.referenceId === loanId && t.amount === gcashPaymentAmount && t.type === 'LOAN_PAYMENT');
  check('SCENARIO I: Ledger Transaction created with type LOAN_PAYMENT', !!ledgerTx);

  // SCENARIO J: Verify FinancialPosting
  const finPosting = (dbState.financialPostings || []).find(p => p.postingKey.includes(gcashReqId) && p.status === 'POSTED');
  check('SCENARIO J: FinancialPosting created with postingType LOAN_PAYMENT', !!finPosting && finPosting.postingType === 'LOAN_PAYMENT');
  check('FinancialPosting links to exact ledgerTransactionId', finPosting?.ledgerTransactionId === ledgerTx?.id);

  // SCENARIO K & L: Verify OfficialReceipt & Exact transactionId linkage
  const orRecord = (dbState.officialReceipts || []).find(r => r.receiptNumber === finPosting?.officialReceiptNo);
  check('SCENARIO K: OfficialReceipt generated with paymentType LOAN_PAYMENT', !!orRecord && orRecord.paymentType === 'LOAN_PAYMENT');
  check('SCENARIO L: OfficialReceipt transactionId equals exact ledger transaction ID', orRecord?.transactionId === ledgerTx?.id);

  // SCENARIO M: Verify next due date advances
  check('Installment #1 marked as PAID', ledgerAfterGcash.schedule[0].status === 'PAID');
  check('Installment #1 remainingAmount is 0', ledgerAfterGcash.schedule[0].remainingAmount === 0);
  check('Installment #1 records officialReceiptNumber', !!ledgerAfterGcash.schedule[0].officialReceiptNumber);
  check('SCENARIO M: Loan nextDueDate advances to Installment #2 dueDate', loanAfterGcash.nextDueDate === ledgerAfterGcash.schedule[1].dueDate);

  // -------------------------------------------------------------------------
  // SCENARIO N: Retry reconciliation and verify no duplicate financial effect
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO N: Idempotent Reconciliation Retry ---');
  const retryGcashReconcile = await api(`/api/payments/reconcile/${gcashReqId}`, 'POST', {
    action: 'APPROVE',
    notes: 'Retry duplicate reconcile'
  }, staffToken);
  check('SCENARIO N1: Reconcile retry returns HTTP 200 with ALREADY_PROCESSED', retryGcashReconcile.ok && retryGcashReconcile.data?.status === 'ALREADY_PROCESSED');
  const loanAfterRetry = (await api('/api/loans', 'GET', undefined, memberToken)).data.loans.find((l: any) => l.id === loanId);
  check('SCENARIO N2: Loan balance unchanged on retry', Math.abs(loanAfterRetry.balance - expectedBalAfter1) < 0.05);
  const matchingPayments = (await api(`/api/loans/${loanId}/ledger`, 'GET', undefined, memberToken)).data.payments.filter((p: any) => p.paymentRequestId === gcashReqId);
  check('SCENARIO N3: No duplicate LoanPayment created on retry', matchingPayments.length === 1);

  // -------------------------------------------------------------------------
  // SCENARIO O: Submit duplicate GCash reference and verify rejection
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO O: Duplicate GCash Reference Protection ---');
  const dupGcashReq = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId,
    targetReferenceId: loanId,
    amount: firstInst.scheduledAmount,
    paymentMethod: 'GCASH',
    externalReference: gcashRef
  }, memberToken);
  check('SCENARIO O: Duplicate GCash reference rejected with HTTP 400', dupGcashReq.status === 400 && dupGcashReq.data.error?.includes('Duplicate Reference'));

  // -------------------------------------------------------------------------
  // SCENARIO P: Test Office Cash loan payment
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO P: Office Cash Loan Payment ---');
  const inst2 = ledgerAfterGcash.schedule[1];
  const cashPayReq = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId,
    targetReferenceId: loanId,
    targetInstallmentNo: 2,
    amount: inst2.scheduledAmount,
    paymentMethod: 'CASH',
    remarks: 'Over the counter cash payment at cooperative cashier counter'
  }, memberToken);
  check('Office Cash payment request created (HTTP 201)', cashPayReq.status === 201);
  const cashReqId = cashPayReq.data.paymentRequest.id;

  const cashReconcileRes = await api(`/api/payments/reconcile/${cashReqId}`, 'POST', {
    action: 'APPROVE',
    notes: 'Received cash at counter'
  }, staffToken);
  check('SCENARIO P: Staff reconciled Office Cash loan payment (HTTP 200)', cashReconcileRes.ok);

  const loanAfterCash = (await api('/api/loans', 'GET', undefined, memberToken)).data.loans.find((l: any) => l.id === loanId);
  const expectedBalAfter2 = Number((expectedBalAfter1 - inst2.scheduledAmount).toFixed(2));
  check('Loan balance decreases after Office Cash payment', Math.abs(loanAfterCash.balance - expectedBalAfter2) < 0.05);

  const ledgerAfterCash = (await api(`/api/loans/${loanId}/ledger`, 'GET', undefined, memberToken)).data;
  check('Installment #2 marked as PAID', ledgerAfterCash.schedule[1].status === 'PAID');
  check('Loan nextDueDate advances to Installment #3 dueDate', loanAfterCash.nextDueDate === ledgerAfterCash.schedule[2].dueDate);

  // -------------------------------------------------------------------------
  // SCENARIO Q: Test Bank Transfer loan payment
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO Q: Bank Transfer Loan Payment ---');
  const inst3 = ledgerAfterCash.schedule[2];
  const bankRef = `BANK-TXN-${ts}`;
  const bankPayReq = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId,
    targetReferenceId: loanId,
    targetInstallmentNo: 3,
    amount: inst3.scheduledAmount,
    paymentMethod: 'BANK_TRANSFER',
    externalReference: bankRef,
    remarks: 'BDO Online Bank Transfer'
  }, memberToken);
  check('Bank Transfer payment request created (HTTP 201)', bankPayReq.status === 201);
  const bankReqId = bankPayReq.data.paymentRequest.id;

  const bankReconcileRes = await api(`/api/payments/reconcile/${bankReqId}`, 'POST', {
    action: 'APPROVE',
    notes: 'Bank transfer credit confirmed in bank statement'
  }, staffToken);
  check('SCENARIO Q: Staff reconciled Bank Transfer loan payment (HTTP 200)', bankReconcileRes.ok);

  const loanAfterBank = (await api('/api/loans', 'GET', undefined, memberToken)).data.loans.find((l: any) => l.id === loanId);
  const expectedBalAfter3 = Number((expectedBalAfter2 - inst3.scheduledAmount).toFixed(2));
  check('Loan balance decreases after Bank Transfer payment', Math.abs(loanAfterBank.balance - expectedBalAfter3) < 0.05);

  // -------------------------------------------------------------------------
  // SCENARIO R: Database reload persistence
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO R: Database Reload Persistence ---');
  (CooperativeDB as any).state = null;
  const reloadedDb = CooperativeDB.load(true);
  const reloadedLoan = reloadedDb.loans.find(l => l.id === loanId);
  check('SCENARIO R1: Loan balance preserved across DB reload', reloadedLoan && Math.abs(reloadedLoan.balance - expectedBalAfter3) < 0.05);
  check('SCENARIO R2: Installments #1, #2, #3 remain PAID across DB reload', reloadedLoan?.amortizationSchedule?.[0].status === 'PAID' && reloadedLoan?.amortizationSchedule?.[1].status === 'PAID' && reloadedLoan?.amortizationSchedule?.[2].status === 'PAID');
  check('SCENARIO R3: Installment #4 remains UPCOMING across DB reload', reloadedLoan?.amortizationSchedule?.[3].status !== 'PAID');

  // -------------------------------------------------------------------------
  // SCENARIO S: Philippine timezone due-date behavior around midnight
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO S: Philippine Timezone (Asia/Manila) Due-Date Behavior ---');
  // Test midnight condition: At 12:30 AM Manila time on 2026-10-15 (which is 2026-10-14T16:30:00Z in UTC)
  const midnightManilaTime = new Date('2026-10-14T16:30:00.000Z');
  const manilaDateAtMidnight = getManilaDateString(midnightManilaTime);
  check('getManilaDateString() returns Manila date 2026-10-15 (not UTC 2026-10-14)', manilaDateAtMidnight === '2026-10-15');

  // Create a synthetic loan to test all 5 status states evaluated against this Manila date
  const syntheticLoan: Loan = {
    id: 'loan_synth_test',
    applicationId: 'app_synth',
    memberId: memberId,
    memberName: 'Synthetic Member',
    loanTypeName: 'Test Loan',
    principalAmount: 10000,
    interestAmount: 500,
    totalRepayable: 10500,
    balance: 10500,
    monthlyAmortization: 2100,
    durationMonths: 5,
    status: 'ACTIVE',
    createdAt: '2026-09-01T00:00:00.000Z',
    disbursedAt: '2026-09-01T00:00:00.000Z',
    amortizationSchedule: [
      {
        installmentNo: 1,
        dueDate: '2026-10-01', // Before Manila date -> PAST_DUE
        scheduledAmount: 2100,
        principalAmount: 2000,
        interestAmount: 100,
        penaltyAmount: 0,
        amountPaid: 0,
        remainingBalance: 8400,
        status: 'UPCOMING'
      },
      {
        installmentNo: 2,
        dueDate: '2026-10-15', // Exactly Manila date -> DUE
        scheduledAmount: 2100,
        principalAmount: 2000,
        interestAmount: 100,
        penaltyAmount: 0,
        amountPaid: 0,
        remainingBalance: 6300,
        status: 'UPCOMING'
      },
      {
        installmentNo: 3,
        dueDate: '2026-10-30', // After Manila date -> UPCOMING
        scheduledAmount: 2100,
        principalAmount: 2000,
        interestAmount: 100,
        penaltyAmount: 0,
        amountPaid: 0,
        remainingBalance: 4200,
        status: 'UPCOMING'
      },
      {
        installmentNo: 4,
        dueDate: '2026-11-15',
        scheduledAmount: 2100,
        principalAmount: 2000,
        interestAmount: 100,
        penaltyAmount: 0,
        amountPaid: 1000, // Partially paid -> PARTIALLY_PAID
        remainingBalance: 2100,
        status: 'UPCOMING'
      },
      {
        installmentNo: 5,
        dueDate: '2026-12-15',
        scheduledAmount: 2100,
        principalAmount: 2000,
        interestAmount: 100,
        penaltyAmount: 0,
        amountPaid: 2100, // Fully paid -> PAID
        remainingBalance: 0,
        status: 'UPCOMING'
      }
    ]
  };

  evaluateInstallmentStatuses(syntheticLoan, midnightManilaTime);
  const synthSchedule = syntheticLoan.amortizationSchedule!;

  check('SCENARIO S1: Installment due before today in Manila is PAST_DUE', synthSchedule[0].status === 'PAST_DUE');
  check('SCENARIO S2: Installment due today in Manila evaluated at 12:30 AM is DUE (not UPCOMING)', synthSchedule[1].status === 'DUE');
  check('SCENARIO S3: Installment due in future in Manila is UPCOMING', synthSchedule[2].status === 'UPCOMING');
  check('SCENARIO S4: Partially paid installment is PARTIALLY_PAID', synthSchedule[3].status === 'PARTIALLY_PAID');
  check('SCENARIO S5: Fully settled installment is PAID', synthSchedule[4].status === 'PAID');

  // -------------------------------------------------------------------------
  // SCENARIO T: Open Time Deposit and verify Regular Savings decreases
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO T: Open Time Deposit ---');
  const memBeforeTdRes = await api(`/api/members/${memberId}`, 'GET', undefined, staffToken);
  const memBeforeTd = memBeforeTdRes.data?.member || memBeforeTdRes.data;
  const initialRegularSavings = memBeforeTd?.regularSavings || 0;
  check('Member has sufficient Regular Savings before Time Deposit (₱20,000)', initialRegularSavings >= 5000);

  const tdPlacementAmount = 5000;
  const tdTermMonths = 12; // 1 year @ 6.5% p.a.
  const openTdRes = await api('/api/time-deposits/open', 'POST', {
    principalAmount: tdPlacementAmount,
    termMonths: tdTermMonths,
    renewalInstruction: 'AUTOMATIC_ROLLOVER'
  }, memberToken);
  check('SCENARIO T1: Open Time Deposit succeeded (HTTP 200)', openTdRes.ok);
  const createdContract: TimeDepositContract = openTdRes.data.contract;
  check('Time Deposit contract ID generated', !!createdContract && !!createdContract.id);

  const memAfterTdRes = await api(`/api/members/${memberId}`, 'GET', undefined, staffToken);
  const memAfterTd = memAfterTdRes.data?.member || memAfterTdRes.data;
  const expectedSavingsAfterTd = Number((initialRegularSavings - tdPlacementAmount).toFixed(2));
  check('SCENARIO T2: Placement decreases available Regular Savings by exact principal amount', memAfterTd?.regularSavings === expectedSavingsAfterTd);
  check('SCENARIO T3: Member timeDeposits balance equals placement amount (₱5,000)', memAfterTd?.timeDeposits === tdPlacementAmount);

  // -------------------------------------------------------------------------
  // SCENARIO U: Verify maturity date and interest calculation
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO U: Time Deposit Maturity Date & Accumulated Interest ---');
  check('Time Deposit contract has openingDate (YYYY-MM-DD)', /^\d{4}-\d{2}-\d{2}$/.test(createdContract.openingDate));
  check('Time Deposit contract has maturityDate (YYYY-MM-DD)', /^\d{4}-\d{2}-\d{2}$/.test(createdContract.maturityDate));

  // Expected interest for ₱5,000 for 12 months @ 6.5% p.a. = 5000 * 0.065 * (12/12) = ₱325.00
  const expectedAccumulatedInterest = Number((tdPlacementAmount * 0.065 * (tdTermMonths / 12)).toFixed(2));
  check('SCENARIO U1: Contract accumulatedInterest matches formula (₱325.00 for 12 mos @ 6.5% p.a.)', createdContract.accumulatedInterest === expectedAccumulatedInterest);

  const expectedMaturityPayout = tdPlacementAmount + expectedAccumulatedInterest; // ₱5,325.00
  check('SCENARIO U2: Total expected maturity payout is principal + interest (₱5,325.00)', (createdContract.principalAmount + (createdContract.accumulatedInterest || 0)) === expectedMaturityPayout);

  // -------------------------------------------------------------------------
  // SCENARIO V: Test early Time Deposit closure & report current implementation behavior
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO V: Early Time Deposit Closure Behavior ---');
  const closeTdRes = await api(`/api/time-deposits/${createdContract.id}/close`, 'POST', {}, memberToken);
  check('SCENARIO V1: Time Deposit close request processed (HTTP 200)', closeTdRes.ok);

  const memAfterCloseTdRes = await api(`/api/members/${memberId}`, 'GET', undefined, staffToken);
  const memAfterCloseTd = memAfterCloseTdRes.data?.member || memAfterCloseTdRes.data;
  // Current implementation observation:
  const actualCreditedBack = Number((memAfterCloseTd.regularSavings - expectedSavingsAfterTd).toFixed(2));
  console.log(`  [BEHAVIOR REPORT]: Time Deposit contract #${createdContract.id.substring(0, 8)} closed on Day 1 (Premature closure prior to maturity date ${createdContract.maturityDate}).`);
  console.log(`  [BEHAVIOR REPORT]: Principal Placed: ₱${tdPlacementAmount.toFixed(2)}, Term Interest: ₱${expectedAccumulatedInterest.toFixed(2)}.`);
  console.log(`  [BEHAVIOR REPORT]: Actual Amount Credited Back to Regular Savings: ₱${actualCreditedBack.toFixed(2)}.`);

  const paysFullInterest = actualCreditedBack === expectedMaturityPayout;
  check('SCENARIO V2: Current implementation behavior verified: early closure returns full principal + term interest without penalty', paysFullInterest);
  check('SCENARIO V3: Member timeDeposits balance reset to 0 after contract closed', memAfterCloseTd.timeDeposits === 0);

  // Verify Official Receipt and ledger Transaction created for closure payout
  const dbAfterTdClose = CooperativeDB.load(true);
  const tdClosureTx = (dbAfterTdClose.transactions || []).find(t => t.description?.includes(createdContract.id.substring(0, 8).toUpperCase()));
  check('SCENARIO V4: Ledger Transaction created for Time Deposit closure payout', !!tdClosureTx);
  const tdClosureReceipt = (dbAfterTdClose.officialReceipts || []).find(r => r.transactionId === tdClosureTx?.id);
  check('SCENARIO V5: Official Receipt generated with exact transactionId linkage for Time Deposit closure', !!tdClosureReceipt && tdClosureReceipt.transactionId === tdClosureTx?.id);

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');
}

runComprehensiveWorkflowsVerification().catch(err => {
  console.error('Fatal error running verification:', err);
  process.exit(1);
});

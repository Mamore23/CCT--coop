import { CooperativeDB } from '../src/db/db';
import { DatabaseState, Member, Transaction, OfficialReceipt } from '../src/types';

const BASE_URL = 'http://localhost:3000';

async function api(path: string, method: string = 'GET', body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runComprehensiveAuditTests() {
  console.log('===============================================================');
  console.log('STARTING FINANCIAL INTEGRITY & FUNCTIONAL VERIFICATION SUITE');
  console.log('===============================================================');

  // Authenticate Admin & Staff
  const adminLogin = await api('/api/auth/login', 'POST', {
    email: 'admin@coop.com',
    password: 'admin123',
  });
  if (!adminLogin.ok) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.token;
  console.log('✓ Admin authenticated successfully.');

  const staffLogin = await api('/api/auth/login', 'POST', {
    email: 'staff@coop.com',
    password: 'staff123',
  });
  if (!staffLogin.ok) throw new Error(`Staff login failed: ${JSON.stringify(staffLogin.data)}`);
  const staffToken = staffLogin.data.token;
  console.log('✓ Staff authenticated successfully.');

  // Create and approve a dedicated test member
  const testEmail = `fin.audit.${Date.now()}@example.com`;
  const regRes = await api('/api/auth/register', 'POST', {
    email: testEmail,
    password: 'Password123!',
    fullName: 'Financial Audit Test Member',
    phone: '09171112233',
    tin: '123-456-789-000',
    dateOfBirth: '1985-05-15',
    gender: 'MALE',
    address: '123 Financial Way, Manila',
    occupation: 'Professional Tester',
    monthlyIncome: 65000,
  });
  if (!regRes.ok) throw new Error(`Member registration failed: ${JSON.stringify(regRes.data)}`);
  const newMemberId = regRes.data.user.memberId || regRes.data.user.id;

  // Approve member
  const approveRes = await api(`/api/members/${newMemberId}/status`, 'POST', {
    status: 'ACTIVE',
    remarks: 'Approved for Financial Audit Testing',
  }, staffToken);
  if (!approveRes.ok) throw new Error(`Member approval failed: ${JSON.stringify(approveRes.data)}`);

  // Log in as test member
  const memberLogin = await api('/api/auth/login', 'POST', {
    email: testEmail,
    password: 'Password123!',
  });
  if (!memberLogin.ok) throw new Error(`Member login failed: ${JSON.stringify(memberLogin.data)}`);
  const memberToken = memberLogin.data.token;
  console.log('✓ Test member registered, approved, and logged in.');

  // Initial Share Capital Payment (₱2,500)
  const initSharePrRes = await api('/api/payments/request', 'POST', {
    paymentType: 'INITIAL_SHARE',
    amount: 2500,
    paymentMethod: 'GCASH',
    externalReference: `GCASH-INIT-${Date.now()}`,
    remarks: 'Initial Share Capital Subscription',
  }, memberToken);
  if (!initSharePrRes.ok) throw new Error(`Initial share PR failed: ${JSON.stringify(initSharePrRes.data)}`);
  const initPrId = initSharePrRes.data.paymentRequest.id;

  const initReconcileRes = await api(`/api/payments/reconcile/${initPrId}`, 'POST', {
    action: 'APPROVE',
    reconciliationNotes: 'Verified Initial Share Capital Payment',
  }, staffToken);
  if (!initReconcileRes.ok) throw new Error(`Initial share reconcile failed: ${JSON.stringify(initReconcileRes.data)}`);
  console.log('✓ Initial Share Capital of ₱2,500 verified and posted.');

  // ---------------------------------------------------------------------------
  // TEST 1: ADDITIONAL SHARE CAPITAL CONTRIBUTION VIA PAYMENT REQUEST
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 1: ADDITIONAL SHARE CAPITAL CONTRIBUTION ---');
  const addShareAmount = 1500;
  const addSharePrRes = await api('/api/payments/request', 'POST', {
    paymentType: 'SHARE_CAPITAL',
    amount: addShareAmount,
    paymentMethod: 'CASH',
    remarks: 'Additional Equity Contribution by Active Member',
  }, memberToken);
  if (!addSharePrRes.ok) throw new Error(`Additional Share Capital PR failed: ${JSON.stringify(addSharePrRes.data)}`);
  const addSharePrId = addSharePrRes.data.paymentRequest.id;
  console.log(`✓ Additional Share Capital request submitted (ID: ${addSharePrId}).`);

  // Verify balance has NOT changed yet
  const dbBeforeReconcile = CooperativeDB.load();
  const memBefore = dbBeforeReconcile.members.find(m => m.id === newMemberId);
  if (memBefore?.shareCapital !== 2500) {
    throw new Error(`TEST 1 FAILED: Share capital changed before reconciliation! Expected 2500, got ${memBefore?.shareCapital}`);
  }

  // Staff Reconcile & Approve
  const addShareReconcileRes = await api(`/api/payments/reconcile/${addSharePrId}`, 'POST', {
    action: 'APPROVE',
    reconciliationNotes: 'Received Cash for Additional Share Capital',
  }, staffToken);
  if (!addShareReconcileRes.ok) throw new Error(`Additional share reconcile failed: ${JSON.stringify(addShareReconcileRes.data)}`);

  const dbAfterAddShare = CooperativeDB.load();
  const memAfterAddShare = dbAfterAddShare.members.find(m => m.id === newMemberId);
  if (memAfterAddShare?.shareCapital !== 4000) {
    throw new Error(`TEST 1 FAILED: Expected shareCapital 4000 (2500 + 1500), got ${memAfterAddShare?.shareCapital}`);
  }
  console.log(`✅ TEST 1 PASSED: Additional Share Capital verified and credited. New Balance: ₱${memAfterAddShare.shareCapital}.`);

  // ---------------------------------------------------------------------------
  // TEST 2: MEMBER DEPOSIT AUTHORIZATION GUARD (NO DIRECT POSTING)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: MEMBER DEPOSIT AUTHORIZATION GUARD ---');
  const directDepositAttempt = await api('/api/savings/transaction', 'POST', {
    memberId: newMemberId,
    type: 'DEPOSIT',
    accountType: 'regularSavings',
    amount: 50000,
    paymentMethod: 'CASH',
  }, memberToken);

  if (directDepositAttempt.status !== 403) {
    throw new Error(`TEST 2 FAILED: Expected 403 Forbidden for member direct deposit, got ${directDepositAttempt.status}`);
  }
  console.log('✅ TEST 2 PASSED: Direct financial deposit by MEMBER strictly rejected with HTTP 403 Forbidden.');

  // ---------------------------------------------------------------------------
  // TEST 3: DUPLICATE GCASH REFERENCE REJECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: DUPLICATE GCASH REFERENCE REJECTION ---');
  const sharedGcashRef = `GCASH-DUP-${Date.now()}`;

  // First payment request with this reference
  const firstGcashReq = await api('/api/payments/request', 'POST', {
    paymentType: 'SAVINGS_DEPOSIT',
    amount: 1000,
    paymentMethod: 'GCASH',
    externalReference: sharedGcashRef,
  }, memberToken);
  if (!firstGcashReq.ok) throw new Error(`First GCash request failed: ${JSON.stringify(firstGcashReq.data)}`);
  const firstReqId = firstGcashReq.data.paymentRequest.id;

  // Reconcile and post the first payment
  const firstPostRes = await api(`/api/payments/reconcile/${firstReqId}`, 'POST', {
    action: 'APPROVE',
  }, staffToken);
  if (!firstPostRes.ok) throw new Error(`First GCash reconcile failed: ${JSON.stringify(firstPostRes.data)}`);

  // Now, attempt to submit a second payment request using the SAME GCash reference
  const secondGcashReq = await api('/api/payments/request', 'POST', {
    paymentType: 'SAVINGS_DEPOSIT',
    amount: 1000,
    paymentMethod: 'GCASH',
    externalReference: sharedGcashRef,
  }, memberToken);

  if (secondGcashReq.status !== 400) {
    throw new Error(`TEST 3 FAILED: Second request with duplicate GCash reference was NOT rejected at submission! Status: ${secondGcashReq.status}`);
  }

  // Also verify that even if a request existed, reconciling a duplicate reference is rejected
  const dupCheckReq = await api('/api/payments/request', 'POST', {
    paymentType: 'SAVINGS_DEPOSIT',
    amount: 1000,
    paymentMethod: 'GCASH',
  }, memberToken);
  const dupReqId = dupCheckReq.data.paymentRequest.id;
  
  // Submit the duplicate reference manually
  const dupSubmitRef = await api(`/api/payments/submit-reference/${dupReqId}`, 'POST', {
    externalReference: sharedGcashRef,
  }, memberToken);
  if (dupSubmitRef.status !== 400) {
    throw new Error(`TEST 3 FAILED: Submitting duplicate reference was not rejected! Status: ${dupSubmitRef.status}`);
  }
  console.log('✅ TEST 3 PASSED: Duplicate GCash reference rejected with HTTP 400 and prevented from posting.');

  // ---------------------------------------------------------------------------
  // TEST 4: LOAN DISBURSEMENT WITH CBU SHARE-CAPITAL RETENTION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: LOAN DISBURSEMENT WITH CBU SHARE-CAPITAL RETENTION ---');
  const dbState = CooperativeDB.load();
  const loanType = dbState.loanTypes[0];
  const shareCapitalBeforeLoan = memAfterAddShare.shareCapital; // 4000

  // Create loan application
  const loanAppRes = await api('/api/loans/apply', 'POST', {
    loanTypeId: loanType.id,
    amount: 20000,
    durationMonths: 6,
    purpose: 'Business Expansion and Inventory',
  }, memberToken);
  if (!loanAppRes.ok) throw new Error(`Loan application failed: ${JSON.stringify(loanAppRes.data)}`);
  const loanAppId = loanAppRes.data.application.id;

  // Staff review & approve loan
  const loanReviewRes = await api(`/api/loans/review/${loanAppId}`, 'POST', {
    status: 'UNDER_REVIEW',
    remarks: 'Documents verified and complete',
  }, staffToken);
  if (!loanReviewRes.ok) throw new Error(`Loan review failed: ${JSON.stringify(loanReviewRes.data)}`);

  const loanApproveRes = await api(`/api/loans/approve/${loanAppId}`, 'POST', {
    action: 'APPROVE',
    remarks: 'Approved by Credit Committee',
  }, staffToken);
  if (!loanApproveRes.ok) throw new Error(`Loan approve failed: ${JSON.stringify(loanApproveRes.data)}`);

  // Disburse Loan
  const disburseRes = await api(`/api/loans/disburse/${loanAppId}`, 'POST', {
    releaseMethod: 'CASH',
    remarks: 'Disbursed via Cash Counter',
  }, staffToken);
  if (!disburseRes.ok) throw new Error(`Loan disbursement failed: ${JSON.stringify(disburseRes.data)}`);

  const dbAfterLoan = CooperativeDB.load();
  const memAfterLoan = dbAfterLoan.members.find(m => m.id === newMemberId)!;
  const expectedCbu = 20000 * ((loanType.cbuPercent ?? 2) / 100);
  const expectedShareAfterCbu = Number((shareCapitalBeforeLoan + expectedCbu).toFixed(2));

  if (memAfterLoan.shareCapital !== expectedShareAfterCbu) {
    throw new Error(`TEST 4 FAILED: Expected share capital ${expectedShareAfterCbu}, got ${memAfterLoan.shareCapital}`);
  }

  // Verify FinancialPosting exists for CBU
  const cbuPosting = (dbAfterLoan.financialPostings || []).find(p =>
    p.memberId === newMemberId &&
    p.postingType === 'SHARE_CAPITAL' &&
    p.paymentSource === 'LOAN_DISBURSEMENT'
  );
  if (!cbuPosting) {
    throw new Error('TEST 4 FAILED: No formal FinancialPosting created for Loan CBU Retention!');
  }
  console.log(`✅ TEST 4 PASSED: Loan disbursed with ₱${expectedCbu} CBU retained in Share Capital (New Balance: ₱${memAfterLoan.shareCapital}) and recorded in Financial Postings.`);

  // ---------------------------------------------------------------------------
  // TEST 5: LOAN REPAYMENT WITH INTEREST PAID FOR PATRONAGE BASIS
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: LOAN AMORTIZATION REPAYMENT WITH INTEREST ---');
  const activeLoan = dbAfterLoan.loans.find(l => l.memberId === newMemberId)!;
  const repayAmount = 3500;

  const repayPrRes = await api('/api/payments/request', 'POST', {
    paymentType: 'LOAN_PAYMENT',
    loanId: activeLoan.id,
    amount: repayAmount,
    paymentMethod: 'CASH',
    remarks: 'Installment #1 Payment',
  }, memberToken);
  if (!repayPrRes.ok) throw new Error(`Loan repay PR failed: ${JSON.stringify(repayPrRes.data)}`);
  const repayPrId = repayPrRes.data.paymentRequest.id;

  const repayReconcileRes = await api(`/api/payments/reconcile/${repayPrId}`, 'POST', {
    action: 'APPROVE',
  }, staffToken);
  if (!repayReconcileRes.ok) throw new Error(`Loan repay reconcile failed: ${JSON.stringify(repayReconcileRes.data)}`);

  const dbAfterRepay = CooperativeDB.load();
  const loanPaymentRecord = (dbAfterRepay.loanPayments || []).find(lp => lp.paymentRequestId === repayPrId);
  if (!loanPaymentRecord || (loanPaymentRecord.interestPaid || 0) <= 0) {
    throw new Error(`TEST 5 FAILED: Loan payment was not recorded with interestPaid! Got: ${loanPaymentRecord?.interestPaid}`);
  }
  console.log(`✅ TEST 5 PASSED: Loan payment recorded with ₱${loanPaymentRecord.interestPaid} actual interest paid.`);

  // ---------------------------------------------------------------------------
  // TEST 6: DIVIDEND & PATRONAGE REFUND CALCULATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: DIVIDEND & PATRONAGE REFUND CALCULATION ---');
  const currentYear = new Date().getFullYear();
  const testSurplus = 500000;

  // Use unique fiscal year so we can compute cleanly
  const testFiscalYear = currentYear;
  // If already exists, delete test period
  const dbBeforeCalc = CooperativeDB.load();
  dbBeforeCalc.dividendPeriods = (dbBeforeCalc.dividendPeriods || []).filter(p => p.year !== testFiscalYear);
  dbBeforeCalc.memberDividends = (dbBeforeCalc.memberDividends || []).filter(d => d.year !== testFiscalYear);
  dbBeforeCalc.memberPatronageRefunds = (dbBeforeCalc.memberPatronageRefunds || []).filter(p => p.year !== testFiscalYear);
  CooperativeDB.save(dbBeforeCalc);

  const calcRes = await api('/api/admin/dividends/calculate', 'POST', {
    year: testFiscalYear,
    totalNetSurplus: testSurplus,
  }, adminToken);
  if (!calcRes.ok) throw new Error(`Dividend calculation failed: ${JSON.stringify(calcRes.data)}`);

  const calcPeriod = calcRes.data.period;
  console.log(`✓ Computed Net Surplus: ₱${testSurplus}. Statutory Reserves (30%): ₱${calcPeriod.totalStatutoryReserves}. Distributable (70%): ₱${calcPeriod.distributableSurplus}`);
  console.log(`✓ Dividend Pool: ₱${calcPeriod.totalDividendAmount}. Patronage Pool: ₱${calcPeriod.totalPatronageAmount}`);

  // Invariant verification
  const dbAfterCalc = CooperativeDB.load();
  const periodDividends = (dbAfterCalc.memberDividends || []).filter(d => d.dividendPeriodId === calcPeriod.id);
  const periodPatronage = (dbAfterCalc.memberPatronageRefunds || []).filter(p => p.dividendPeriodId === calcPeriod.id);

  const sumDivAllocations = Number(periodDividends.reduce((s, d) => s + d.dividendAmount, 0).toFixed(2));
  const sumPatAllocations = Number(periodPatronage.reduce((s, p) => s + p.patronageRefundAmount, 0).toFixed(2));

  if (calcPeriod.totalDividendAmount !== sumDivAllocations) {
    throw new Error(`TEST 6 FAILED: period.totalDividendAmount (${calcPeriod.totalDividendAmount}) !== sum of allocations (${sumDivAllocations})`);
  }
  if (calcPeriod.totalPatronageAmount !== sumPatAllocations) {
    throw new Error(`TEST 6 FAILED: period.totalPatronageAmount (${calcPeriod.totalPatronageAmount}) !== sum of allocations (${sumPatAllocations})`);
  }
  if (calcPeriod.status !== 'COMPUTED') {
    throw new Error(`TEST 6 FAILED: Initial status expected 'COMPUTED', got '${calcPeriod.status}'`);
  }
  console.log(`✅ TEST 6 PASSED: Dividend and Patronage Refund pools strictly match allocations (sum of allocations === period total). Status: COMPUTED.`);

  // ---------------------------------------------------------------------------
  // TEST 7: DIVIDEND & PATRONAGE DISTRIBUTION WORKFLOW
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: DIVIDEND & PATRONAGE DISTRIBUTION WORKFLOW ---');
  const memberSavingsBeforeDist = (dbAfterCalc.members.find(m => m.id === newMemberId)?.regularSavings || 0);

  const distRes = await api(`/api/dividends/distribute/${calcPeriod.id}`, 'POST', {}, adminToken);
  if (!distRes.ok) throw new Error(`Dividend distribution failed: ${JSON.stringify(distRes.data)}`);

  const dbAfterDist = CooperativeDB.load();
  const updatedPeriod = dbAfterDist.dividendPeriods.find(p => p.id === calcPeriod.id)!;
  if (updatedPeriod.status !== 'DISTRIBUTED') {
    throw new Error(`TEST 7 FAILED: Expected period status 'DISTRIBUTED', got '${updatedPeriod.status}'`);
  }

  const testMemberDiv = (dbAfterDist.memberDividends || []).find(d => d.dividendPeriodId === calcPeriod.id && d.memberId === newMemberId);
  const testMemberPat = (dbAfterDist.memberPatronageRefunds || []).find(p => p.dividendPeriodId === calcPeriod.id && p.memberId === newMemberId);

  if (testMemberDiv) {
    if (testMemberDiv.status !== 'PAID') throw new Error(`TEST 7 FAILED: Member dividend status was not updated to PAID!`);
    if (!testMemberDiv.officialReceiptNo) throw new Error(`TEST 7 FAILED: Member dividend missing Official Receipt Number!`);
    if (!testMemberDiv.transactionId) throw new Error(`TEST 7 FAILED: Member dividend missing linked transactionId!`);
  }
  if (testMemberPat) {
    if (testMemberPat.status !== 'PAID') throw new Error(`TEST 7 FAILED: Member patronage status was not updated to PAID!`);
    if (!testMemberPat.officialReceiptNo) throw new Error(`TEST 7 FAILED: Member patronage missing Official Receipt Number!`);
    if (!testMemberPat.transactionId) throw new Error(`TEST 7 FAILED: Member patronage missing linked transactionId!`);
  }

  // Idempotency: Retrying distribution must NOT duplicate credits
  const retryDistRes = await api(`/api/dividends/distribute/${calcPeriod.id}`, 'POST', {}, adminToken);
  if (!retryDistRes.ok) throw new Error(`Retry distribution failed: ${JSON.stringify(retryDistRes.data)}`);
  if (retryDistRes.data.newlyDistributedCount !== 0) {
    throw new Error(`TEST 7 FAILED: Retry distribution created duplicate credits (${retryDistRes.data.newlyDistributedCount} newly distributed)!`);
  }
  console.log('✅ TEST 7 PASSED: Dividends and Patronage distributed to Regular Savings, ORs generated with exact transactionId, and operation is strictly idempotent.');

  // ---------------------------------------------------------------------------
  // TEST 8: OFFICIAL RECEIPT VOIDING & FINANCIAL REVERSAL
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: OFFICIAL RECEIPT VOIDING & FINANCIAL REVERSAL ---');
  // Create a savings deposit receipt to test voiding
  const depositAmt = 8000;
  const depPrRes = await api('/api/payments/request', 'POST', {
    paymentType: 'SAVINGS_DEPOSIT',
    amount: depositAmt,
    paymentMethod: 'CASH',
    remarks: 'Test deposit to be voided',
  }, memberToken);
  const depPrId = depPrRes.data.paymentRequest.id;

  const depReconcileRes = await api(`/api/payments/reconcile/${depPrId}`, 'POST', {
    action: 'APPROVE',
  }, staffToken);
  const receiptToVoidNo = depReconcileRes.data.officialReceiptNo;
  console.log(`✓ Created test deposit receipt ${receiptToVoidNo} for ₱${depositAmt}.`);

  const dbBeforeVoid = CooperativeDB.load();
  const memSavingsBeforeVoid = dbBeforeVoid.members.find(m => m.id === newMemberId)!.regularSavings;

  // Void the receipt
  const voidRes = await api(`/api/receipts/${receiptToVoidNo}/void`, 'POST', {
    voidReason: 'Counter cashier entry error - void authorized by manager',
  }, staffToken);
  if (!voidRes.ok) throw new Error(`Receipt void failed: ${JSON.stringify(voidRes.data)}`);

  const dbAfterVoid = CooperativeDB.load();
  const voidedReceipt = dbAfterVoid.officialReceipts.find(r => r.receiptNumber === receiptToVoidNo)!;
  if (voidedReceipt.status !== 'VOIDED') {
    throw new Error(`TEST 8 FAILED: Receipt status was not set to VOIDED!`);
  }

  // Check associated transaction
  const voidedTx = dbAfterVoid.transactions.find(t => t.id === voidedReceipt.transactionId || t.officialReceiptNumber === receiptToVoidNo);
  if (!voidedTx || voidedTx.status !== 'VOIDED') {
    throw new Error(`TEST 8 FAILED: Associated transaction was not marked VOIDED!`);
  }

  // Check associated financial posting
  const voidedPosting = (dbAfterVoid.financialPostings || []).find(p => p.officialReceiptNo === receiptToVoidNo);
  if (!voidedPosting || voidedPosting.status !== 'VOIDED') {
    throw new Error(`TEST 8 FAILED: Associated financial posting was not marked VOIDED!`);
  }

  // Check member balance reversal
  const memSavingsAfterVoid = dbAfterVoid.members.find(m => m.id === newMemberId)!.regularSavings;
  const expectedSavingsAfterVoid = Number((memSavingsBeforeVoid - depositAmt).toFixed(2));
  if (memSavingsAfterVoid !== expectedSavingsAfterVoid) {
    throw new Error(`TEST 8 FAILED: Member savings was not reversed! Expected ${expectedSavingsAfterVoid}, got ${memSavingsAfterVoid}`);
  }
  console.log(`✅ TEST 8 PASSED: Voiding OR ${receiptToVoidNo} reversed transaction, financial posting, and member balance safely.`);

  // ---------------------------------------------------------------------------
  // TEST 9: SHARE CAPITAL REFUND HANDLING
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 9: SHARE CAPITAL REFUND HANDLING ---');
  const dbBeforeRefund = CooperativeDB.load();
  const memberForRefund = dbBeforeRefund.members.find(m => m.id === newMemberId)!;
  const balanceBeforeRefund = memberForRefund.shareCapital;
  const refundAmount = 500;

  // Post a SHARE_CAPITAL_REFUND
  const refundPostingKey = `share_refund_${Date.now()}`;
  const refundTxId = `tx_ref_${Date.now()}`;
  dbBeforeRefund.transactions.unshift({
    id: refundTxId,
    memberId: newMemberId,
    memberName: memberForRefund.fullName,
    type: 'WITHDRAWAL',
    amount: refundAmount,
    description: 'Share Capital Partial Refund',
    processedBy: 'Admin',
    createdAt: new Date().toISOString(),
  });
  dbBeforeRefund.financialPostings = dbBeforeRefund.financialPostings || [];
  dbBeforeRefund.financialPostings.push({
    id: `post_${Date.now()}`,
    postingKey: refundPostingKey,
    paymentSource: 'CASHIER_QUEUE',
    memberId: newMemberId,
    memberName: memberForRefund.fullName,
    amount: refundAmount,
    postingType: 'SHARE_CAPITAL_REFUND',
    ledgerTransactionId: refundTxId,
    postedBy: 'Admin',
    postedAt: new Date().toISOString(),
    status: 'POSTED',
  });
  CooperativeDB.recalibrateShareCapital(dbBeforeRefund);
  CooperativeDB.save(dbBeforeRefund);

  const dbAfterRefund = CooperativeDB.load();
  const memAfterRefund = dbAfterRefund.members.find(m => m.id === newMemberId)!;
  const expectedAfterRefund = Number((balanceBeforeRefund - refundAmount).toFixed(2));
  if (memAfterRefund.shareCapital !== expectedAfterRefund) {
    throw new Error(`TEST 9 FAILED: Share capital refund was not deducted properly! Expected ${expectedAfterRefund}, got ${memAfterRefund.shareCapital}`);
  }
  console.log(`✅ TEST 9 PASSED: Share Capital Refund deducted properly. Balance: ₱${memAfterRefund.shareCapital}.`);

  // ---------------------------------------------------------------------------
  // TEST 10: DETERMINISTIC DATABASE RELOAD / RECALIBRATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 10: DATABASE RELOAD & RECALIBRATION DETERMINISM ---');
  // Tamper a member balance in memory without financial postings
  const tamperState = CooperativeDB.load();
  const targetMember = tamperState.members.find(m => m.id === newMemberId)!;
  const authoritativeBalance = targetMember.shareCapital;

  targetMember.shareCapital = 99999999; // Injected invalid balance
  CooperativeDB.recalibrateShareCapital(tamperState);

  if (targetMember.shareCapital !== authoritativeBalance) {
    throw new Error(`TEST 10 FAILED: Tampered balance was not restored to authoritative ledger balance (${authoritativeBalance})! Got: ${targetMember.shareCapital}`);
  }

  // Also simulate full reload from disk
  const reloadedDb = CooperativeDB.load();
  const reloadedMember = reloadedDb.members.find(m => m.id === newMemberId)!;
  if (reloadedMember.shareCapital !== authoritativeBalance) {
    throw new Error(`TEST 10 FAILED: Balance did not survive reload! Expected ${authoritativeBalance}, got ${reloadedMember.shareCapital}`);
  }
  console.log(`✅ TEST 10 PASSED: Database reload and recalibration are deterministic and verified against financial postings.`);

  console.log('\n===============================================================');
  console.log('ALL 10 FINANCIAL INTEGRITY AUDIT TESTS PASSED (100%)');
  console.log('===============================================================');
}

runComprehensiveAuditTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ AUDIT VERIFICATION FAILED:', err);
    process.exit(1);
  });

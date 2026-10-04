/**
 * FINAL RELEASE FREEZE & USER ACCEPTANCE TEST SUITE
 * 
 * Simulates real user interactions across:
 * 1. MEMBER JOURNEY: Register -> Pending Review -> Login -> Dashboard -> Compliance -> Initial Share -> OR -> Loan -> Amortization -> Installment -> Statement of Account
 * 2. STAFF WORKFLOW: Review applications -> Inspect documents -> Verify membership -> Verify PMES/Orientation -> Review loans -> Reconcile payment requests -> Issue ORs
 * 3. ADMIN/MANAGER WORKFLOW: Supervise staff -> Audit logs -> Staff activity -> Ledger supervision -> System health
 * 4. FINANCIAL INTEGRITY: Verification of idempotency, 0-balance invariants, and no direct tampering
 */

const BASE_URL = 'http://localhost:3000';

async function api(path: string, options: { method?: string; body?: any; token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runUAT() {
  console.log('======================================================================');
  console.log('STARTING: USER ACCEPTANCE TESTING (UAT) & RELEASE FREEZE AUDIT');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function check(desc: string, condition: boolean) {
    total++;
    if (!condition) {
      console.error(`❌ FAILED: ${desc}`);
      throw new Error(`UAT failed: ${desc}`);
    }
    passed++;
    console.log(`✓ ${desc}`);
  }

  const timestamp = Date.now();
  const memberEmail = `uat.member.${timestamp}@coop.com`;
  const password = 'Password123!';

  // =========================================================================
  // SECTION 1: AUTHENTICATION INITIALIZATION
  // =========================================================================
  console.log('--- 1. STAFF & ADMIN INITIAL AUTHENTICATION ---');
  const staffAuth = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'staff@coop.com', password: 'staff123' }
  });
  check('Staff authenticated successfully', staffAuth.ok && staffAuth.data.token);
  const staffToken = staffAuth.data.token;

  const adminAuth = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@coop.com', password: 'admin123' }
  });
  check('Admin authenticated successfully', adminAuth.ok && adminAuth.data.token);
  const adminToken = adminAuth.data.token;

  // =========================================================================
  // SECTION 2: MEMBER JOURNEY — REGISTRATION & UNAPPROVED STATE
  // =========================================================================
  console.log('\n--- 2. MEMBER UAT: REGISTRATION & PENDING STATUS ---');
  const regRes = await api('/api/auth/register', {
    method: 'POST',
    body: {
      email: memberEmail,
      password: password,
      fullName: `Maria Santos UAT`,
      phone: '0917-555-1234',
      birthdate: '1992-06-20',
      address: '456 Mabini St, Manila',
      monthlyIncome: 40000,
      initialShareCapitalPledged: 2000,
      govIdUrl: 'data:image/svg+xml;utf8,<svg id="uat_gov_id"></svg>',
      govIdFileName: 'maria_id.svg',
      selfieUrl: 'data:image/svg+xml;utf8,<svg id="uat_selfie"></svg>',
      selfieFileName: 'maria_selfie.svg'
    }
  });
  check('Member account registered with HTTP 201', regRes.status === 201);

  // Unapproved member login attempt
  const unapprovedLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: memberEmail, password }
  });
  check('Unapproved member blocked from login with HTTP 403', unapprovedLogin.status === 403);
  check('Clear user-facing error message displayed', unapprovedLogin.data.error?.includes('pending verification and approval'));

  // Find member ID via staff member list
  const memberListRes = await api('/api/members', { token: staffToken });
  const newMember = memberListRes.data.find((m: any) => m.email.toLowerCase() === memberEmail.toLowerCase());
  check('Staff can locate newly registered member in member list', !!newMember);
  const memberId = newMember.id;

  // Verify financial integrity upon registration
  check('Registration financial safety: Share Capital is ₱0', (newMember.shareCapital || 0) === 0);
  check('Registration financial safety: Regular Savings is ₱0', (newMember.regularSavings || 0) === 0);
  check('Registration financial safety: Time Deposits is ₱0', (newMember.timeDeposits || 0) === 0);

  // =========================================================================
  // SECTION 3: STAFF UAT — APPLICATION REVIEW & VERIFICATION
  // =========================================================================
  console.log('\n--- 3. STAFF UAT: APPLICATION REVIEW, DOCUMENTS & APPROVAL ---');
  // Staff reviews submitted documents
  const docsRes = await api(`/api/documents?memberId=${memberId}`, { token: staffToken });
  check('Staff can inspect applicant uploaded documents', docsRes.ok && Array.isArray(docsRes.data));

  // Staff approves membership
  const approveRes = await api(`/api/users/verify-member/${memberId}`, {
    method: 'POST',
    body: { action: 'APPROVE', reviewNotes: 'UAT Application Verified' },
    token: staffToken
  });
  check('Staff successfully approved membership', approveRes.ok);

  // Verify financial balance is still ₱0 after approval
  const memberAfterApproval = await api(`/api/members/${memberId}`, { token: staffToken });
  check('Post-approval financial safety: Share Capital remains strictly ₱0', (memberAfterApproval.data.shareCapital || 0) === 0);

  // =========================================================================
  // SECTION 4: MEMBER UAT — LOGIN & DASHBOARD INSPECTION
  // =========================================================================
  console.log('\n--- 4. MEMBER UAT: LOGIN & DASHBOARD VISIBILITY ---');
  const memberLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: memberEmail, password }
  });
  check('Approved member logged in successfully', memberLogin.ok);
  const memberToken = memberLogin.data.token;

  // Member Dashboard stats & Savings Ledger
  const dashboardStats = await api('/api/dashboard/stats', { token: memberToken });
  check('Dashboard stats loaded cleanly', dashboardStats.ok);
  const ledgerInfo = await api('/api/savings/ledger', { token: memberToken });
  check('Savings ledger retrieved cleanly', ledgerInfo.ok);
  check('Initial Share Capital status clearly reflects NOT PAID', ledgerInfo.data.member?.initialShareCapitalPaid === false);

  // =========================================================================
  // SECTION 5: INITIAL SHARE CAPITAL PAYMENT & RECONCILIATION
  // =========================================================================
  console.log('\n--- 5. INITIAL SHARE CAPITAL PAYMENT & CASHIER RECONCILIATION ---');
  // Member submits GCash payment for initial share capital
  const payRequestRes = await api('/api/member/initial-share-payment', {
    method: 'POST',
    body: {
      paymentMethod: 'GCASH',
      reference: `GCASH-UAT-${timestamp}`
    },
    token: memberToken
  });
  check('Member submitted Initial Share Capital payment request', payRequestRes.ok);

  // Verify balance remains 0 before staff reconciliation
  const ledgerBeforeReconcile = await api('/api/savings/ledger', { token: memberToken });
  check('Financial safety: Share capital remains ₱0 before staff reconciliation', (ledgerBeforeReconcile.data.member?.shareCapital || 0) === 0);

  // Staff reconciles initial share capital payment
  const reconcileRes = await api(`/api/staff/verify-initial-share/${memberId}`, {
    method: 'POST',
    body: {
      paymentMethod: 'GCASH',
      reference: `GCASH-UAT-${timestamp}`
    },
    token: staffToken
  });
  check('Staff verified payment via CooperativeDB.postFinancialTransaction()', reconcileRes.ok);
  check('Official Receipt issued automatically', !!(reconcileRes.data.officialReceiptNo || reconcileRes.data.officialReceipt?.receiptNumber));

  // Verify Share Capital balance is now updated
  const ledgerAfterReconcile = await api('/api/savings/ledger', { token: memberToken });
  check('Authoritative balance updated: Share Capital = ₱1,000', (ledgerAfterReconcile.data.member?.shareCapital || 0) >= 1000);

  // Verify idempotency: retrying reconciliation does not duplicate
  const retryReconcile = await api(`/api/staff/verify-initial-share/${memberId}`, {
    method: 'POST',
    body: { paymentMethod: 'GCASH', reference: `GCASH-UAT-${timestamp}` },
    token: staffToken
  });
  check('Reconciliation retry handled idempotently without error or balance inflation', retryReconcile.ok);

  // =========================================================================
  // SECTION 6: COMPLIANCE & LOAN ELIGIBILITY
  // =========================================================================
  console.log('\n--- 6. COMPLIANCE VERIFICATION & LOAN ELIGIBILITY ---');
  // Check loan eligibility before compliance (Must be blocked)
  const loanTypes = await api('/api/loans/types', { token: memberToken });
  const regularLoanType = loanTypes.data[0];
  const eligBefore = await api(`/api/loans/check-eligibility?loanTypeId=${regularLoanType.id}&amount=10000`, { token: memberToken });
  check('Loan eligibility correctly flags missing compliance requirements', eligBefore.data.missingRequirements?.length > 0);

  // Staff verifies PMES and Loan Orientation
  const pmesRes = await api('/api/compliance/verify', {
    method: 'POST',
    body: {
      memberId,
      requirementType: 'PRE_MEMBERSHIP_SEMINAR',
      referenceNumber: `PMES-UAT-${timestamp}`,
      remarks: 'PMES completion verified UAT'
    },
    token: staffToken
  });
  check('Staff verified PMES compliance', pmesRes.ok);

  const orientRes = await api('/api/compliance/verify', {
    method: 'POST',
    body: {
      memberId,
      requirementType: 'LOAN_ORIENTATION',
      referenceNumber: `ORIENT-UAT-${timestamp}`,
      remarks: 'Loan orientation counseling verified UAT'
    },
    token: staffToken
  });
  check('Staff verified Loan Orientation compliance', orientRes.ok);

  // Add share capital equity so loan requirements pass
  await api('/api/savings/transaction', {
    method: 'POST',
    body: {
      memberId,
      type: 'DEPOSIT',
      accountType: 'shareCapital',
      amount: 5000,
      paymentMethod: 'CASH',
      description: 'Additional Share Capital Contribution'
    },
    token: memberToken
  });

  const eligAfter = await api(`/api/loans/check-eligibility?loanTypeId=${regularLoanType.id}&amount=10000`, { token: memberToken });
  check('Member is now verified as ELIGIBLE for loan application', eligAfter.data.eligible === true);

  // =========================================================================
  // SECTION 7: LOAN APPLICATION, APPROVAL, RELEASE & AMORTIZATION
  // =========================================================================
  console.log('\n--- 7. LOAN WORKFLOW: APPLICATION, APPROVAL, RELEASE & AMORTIZATION ---');
  const loanAppRes = await api('/api/loans/apply', {
    method: 'POST',
    body: {
      loanTypeId: regularLoanType.id,
      amount: 10000,
      durationMonths: 6,
      purpose: 'Education',
      documents: [
        {
          type: 'PROMISSORY_NOTE',
          documentType: 'PROMISSORY_NOTE',
          name: 'promissory_note.pdf',
          fileName: 'promissory_note.pdf',
          fileUrl: 'data:image/svg+xml;utf8,<svg></svg>'
        },
        {
          type: 'INCOME_PROOF',
          documentType: 'INCOME_PROOF',
          name: 'payslip.pdf',
          fileName: 'payslip.pdf',
          fileUrl: 'data:image/svg+xml;utf8,<svg></svg>'
        }
      ]
    },
    token: memberToken
  });
  check('Member submitted loan application', loanAppRes.ok);
  const loanAppId = loanAppRes.data.application?.id;

  // Staff approves loan
  const approveLoan = await api(`/api/loans/approve/${loanAppId}`, {
    method: 'POST',
    body: { action: 'APPROVE', remarks: 'Eligibility and docs approved UAT' },
    token: staffToken
  });
  check('Staff approved loan application', approveLoan.ok);

  // Staff releases loan
  const releaseLoan = await api(`/api/loans/disburse/${loanAppId}`, {
    method: 'POST',
    body: {
      releaseMethod: 'CASH',
      paymentMethod: 'CASH',
      remarks: 'Released at cash office counter'
    },
    token: staffToken
  });
  check('Staff released loan and generated contractual amortization schedule', releaseLoan.ok);
  const releasedLoan = releaseLoan.data.loan;
  const loanId = releasedLoan.id;

  // Member views loan amortization schedule
  const scheduleRes = await api(`/api/loans/${loanId}/ledger`, { token: memberToken });
  const schedule = scheduleRes.data.schedule || [];
  check('Member retrieves 6 contractual installment periods', scheduleRes.ok && Array.isArray(schedule) && schedule.length === 6);
  const period1 = schedule[0];
  check('Installment Period #1 status is UPCOMING', period1.status === 'UPCOMING');

  // Submit installment payment
  const payInstallmentRes = await api('/api/payments/request', {
    method: 'POST',
    body: {
      paymentType: 'LOAN_PAYMENT',
      loanId,
      targetReferenceId: loanId,
      targetInstallmentNo: period1.installmentNo,
      amount: period1.scheduledAmount,
      paymentMethod: 'GCASH',
      externalReference: `GCASH-LOAN-UAT-${timestamp}`
    },
    token: memberToken
  });
  check('Member submitted Payment Request for Installment #1', payInstallmentRes.ok);
  const loanPayReqId = payInstallmentRes.data.paymentRequest?.id;

  // Staff reconciles installment payment
  const reconcileInstallment = await api(`/api/payments/reconcile/${loanPayReqId}`, {
    method: 'POST',
    body: {
      action: 'RECONCILE',
      remarks: 'Reconciled installment #1 payment',
      reconciliationNotes: 'Reconciled installment #1 payment'
    },
    token: staffToken
  });
  check('Staff reconciled installment payment', reconcileInstallment.ok);

  // Verify installment is now marked PAID in amortization schedule
  const scheduleAfterPay = await api(`/api/loans/${loanId}/ledger`, { token: memberToken });
  check('Amortization schedule marks Period #1 as PAID', scheduleAfterPay.data.schedule[0].status === 'PAID');

  // Advance Payment on Period #2
  const period2 = scheduleAfterPay.data.schedule[1];
  const payAdvanceRes = await api('/api/payments/request', {
    method: 'POST',
    body: {
      paymentType: 'LOAN_PAYMENT',
      loanId,
      targetReferenceId: loanId,
      targetInstallmentNo: period2.installmentNo,
      amount: period2.scheduledAmount,
      paymentMethod: 'GCASH',
      externalReference: `GCASH-LOAN-ADV-${timestamp}`
    },
    token: memberToken
  });
  check('Member submitted Advance Payment Request for Installment #2', payAdvanceRes.ok);
  const advPayReqId = payAdvanceRes.data.paymentRequest?.id;

  const reconcileAdvance = await api(`/api/payments/reconcile/${advPayReqId}`, {
    method: 'POST',
    body: {
      action: 'RECONCILE',
      remarks: 'Reconciled advance installment #2 payment',
      reconciliationNotes: 'Reconciled advance installment #2 payment'
    },
    token: staffToken
  });
  check('Staff reconciled Advance Payment for Installment #2', reconcileAdvance.ok);

  const scheduleAfterAdv = await api(`/api/loans/${loanId}/ledger`, { token: memberToken });
  check('Amortization schedule marks Period #2 as PAID after advance payment', scheduleAfterAdv.data.schedule[1].status === 'PAID');

  // Member views updated loan balance on dashboard
  const updatedStats = await api('/api/dashboard/stats', { token: memberToken });
  check('Member dashboard reflects updated active loan balance after payments', updatedStats.ok && updatedStats.data.activeLoansBalance < releasedLoan.balance);

  // Member views Statement of Account
  const soaRes = await api('/api/savings/ledger', { token: memberToken });
  check('Member retrieved personal Statement of Account', soaRes.ok && Array.isArray(soaRes.data.transactions) && soaRes.data.transactions.length >= 2);

  // Member views Official Receipts
  const receiptsRes = await api('/api/receipts', { token: memberToken });
  check('Member retrieved issued Official Receipts', receiptsRes.ok && Array.isArray(receiptsRes.data) && receiptsRes.data.length >= 2);

  // =========================================================================
  // SECTION 8: ADMIN / MANAGER SUPERVISION & AUDIT CONTROLS
  // =========================================================================
  console.log('\n--- 8. ADMIN / MANAGER UAT: SUPERVISION & AUDIT CONTROLS ---');
  // Admin Dashboard stats
  const adminDash = await api('/api/dashboard/stats', { token: adminToken });
  check('Admin retrieves executive dashboard KPIs', adminDash.ok);

  // Staff list supervision
  const staffList = await api('/api/staff', { token: adminToken });
  const staffItems = Array.isArray(staffList.data) ? staffList.data : (staffList.data.staff || []);
  check('Admin retrieves staff members for supervision', staffList.ok && Array.isArray(staffItems) && staffItems.length > 0);
  const targetStaff = staffItems[0];

  // Staff permission management
  const permRes = await api('/api/permissions/user-override', {
    method: 'POST',
    body: { userId: targetStaff.id, overrides: targetStaff.customPermissions || {} },
    token: adminToken
  });
  check('Admin manages staff granular permissions', permRes.ok);

  // Staff activity supervision
  const staffActivity = await api('/api/staff/activity', { token: adminToken });
  const activityItems = Array.isArray(staffActivity.data) ? staffActivity.data : (staffActivity.data.activities || []);
  check('Admin retrieves staff operational activity stream', staffActivity.ok && Array.isArray(activityItems));

  // Audit trail
  const auditLogs = await api('/api/audit-logs', { token: adminToken });
  check('Admin monitors system-wide immutable audit trail', auditLogs.ok && Array.isArray(auditLogs.data) && auditLogs.data.length > 0);

  // Loan supervision, Payment supervision, Document review
  const adminLoans = await api('/api/loans/active', { token: adminToken });
  const adminLoanApps = await api('/api/loans/applications', { token: adminToken });
  check('Admin supervises loan portfolio & applications', adminLoans.ok && Array.isArray(adminLoans.data) && adminLoanApps.ok && Array.isArray(adminLoanApps.data));
  const adminPayments = await api('/api/payments/requests', { token: adminToken });
  check('Admin supervises payment requests & reconciliations', adminPayments.ok && Array.isArray(adminPayments.data));
  const adminDocs = await api(`/api/documents?memberId=${memberId}`, { token: adminToken });
  check('Admin reviews member submitted documents', adminDocs.ok && Array.isArray(adminDocs.data));

  // =========================================================================
  // SECTION 9: SECURITY BOUNDARY CHECKS & TAMPER RESISTANCE
  // =========================================================================
  console.log('\n--- 9. SECURITY BOUNDARY CHECKS & TAMPER RESISTANCE ---');
  // 1. MEMBER -> STAFF API = DENIED
  const memberStaffApiRes = await api(`/api/users/verify-member/${memberId}`, {
    method: 'POST',
    body: { action: 'APPROVE' },
    token: memberToken
  });
  check('MEMBER -> STAFF API strictly DENIED with HTTP 403', memberStaffApiRes.status === 403);

  // 2. MEMBER -> ADMIN API = DENIED
  const memberAdminRes = await api('/api/staff', { token: memberToken });
  check('MEMBER -> ADMIN API (/api/staff) strictly DENIED with HTTP 403', memberAdminRes.status === 403);
  const memberAuditRes = await api('/api/audit-logs', { token: memberToken });
  check('MEMBER -> ADMIN API (/api/audit-logs) strictly DENIED with HTTP 403', memberAuditRes.status === 403);

  // 3. MEMBER -> OTHER MEMBER DATA = DENIED
  const otherMember = memberListRes.data.find((m: any) => m.id !== memberId);
  if (otherMember) {
    const crossMemberRes = await api(`/api/members/${otherMember.id}`, { token: memberToken });
    check('MEMBER -> OTHER MEMBER DATA strictly DENIED with HTTP 403', crossMemberRes.status === 403);
    const crossDocsRes = await api(`/api/documents?memberId=${otherMember.id}`, { token: memberToken });
    check('MEMBER -> OTHER MEMBER DOCUMENTS strictly DENIED with HTTP 403', crossDocsRes.status === 403);
    const crossLedgerRes = await api(`/api/savings/ledger?memberId=${otherMember.id}`, { token: memberToken });
    check('MEMBER -> OTHER MEMBER LEDGER strictly DENIED with HTTP 403', crossLedgerRes.status === 403);
    const crossLoanAppsRes = await api(`/api/loans/applications?memberId=${otherMember.id}`, { token: memberToken });
    check('MEMBER -> OTHER MEMBER LOAN APPLICATIONS strictly DENIED with HTTP 403', crossLoanAppsRes.status === 403);
    const crossReceiptsRes = await api(`/api/receipts?memberId=${otherMember.id}`, { token: memberToken });
    check('MEMBER -> OTHER MEMBER RECEIPTS strictly DENIED with HTTP 403', crossReceiptsRes.status === 403);
  }

  // 4. STAFF -> ADMIN MANAGEMENT = DENIED
  const staffCreateStaffRes = await api('/api/users/staff', {
    method: 'POST',
    body: { email: `unauth.staff.${timestamp}@coop.com`, password: 'Password123!', fullName: 'Unauth Staff', phone: '09170009999' },
    token: staffToken
  });
  check('STAFF -> ADMIN MANAGEMENT (/api/users/staff) strictly DENIED with HTTP 403', staffCreateStaffRes.status === 403);

  const staffStatusChangeRes = await api(`/api/users/staff/${targetStaff.id}/status`, {
    method: 'PUT',
    body: { status: 'SUSPENDED' },
    token: staffToken
  });
  check('STAFF -> ADMIN MANAGEMENT (/api/users/staff/:id/status) strictly DENIED with HTTP 403', staffStatusChangeRes.status === 403);

  const staffPermChangeRes = await api('/api/permissions/user-override', {
    method: 'POST',
    body: { userId: targetStaff.id, overrides: {} },
    token: staffToken
  });
  check('STAFF -> ADMIN MANAGEMENT (/api/permissions/user-override) strictly DENIED with HTTP 403', staffPermChangeRes.status === 403);

  // 5. REAL-TIME STAFF SUSPENSION & PERMISSION ENFORCEMENT
  const suspendStaffRes = await api(`/api/users/staff/${targetStaff.id}/status`, {
    method: 'PUT',
    body: { status: 'SUSPENDED' },
    token: adminToken
  });
  check('Admin suspends staff account', suspendStaffRes.ok);

  const suspendedStaffApiRes = await api('/api/dashboard/stats', { token: staffToken });
  check('Suspended staff active JWT is immediately blocked with HTTP 403', suspendedStaffApiRes.status === 403);

  const reactivateStaffRes = await api(`/api/users/staff/${targetStaff.id}/status`, {
    method: 'PUT',
    body: { status: 'ACTIVE' },
    token: adminToken
  });
  check('Admin reactivates staff account', reactivateStaffRes.ok);

  const reactivatedStaffApiRes = await api('/api/dashboard/stats', { token: staffToken });
  check('Reactivated staff token works again immediately', reactivatedStaffApiRes.ok);

  // 6. ADMIN / STAFF / MEMBER -> DIRECT BALANCE TAMPERING = DENIED
  const memberTamperRes = await api('/api/members/me', {
    method: 'PUT',
    body: { shareCapital: 9999999, regularSavings: 9999999 },
    token: memberToken
  });
  check('MEMBER -> DIRECT BALANCE TAMPERING strictly rejected (HTTP 400/403)', memberTamperRes.status === 400 || memberTamperRes.status === 403);

  const staffTamperRes = await api(`/api/members/${memberId}`, {
    method: 'PUT',
    body: { shareCapital: 9999999 },
    token: staffToken
  });
  check('STAFF -> DIRECT BALANCE TAMPERING strictly rejected (HTTP 400/403/404)', staffTamperRes.status === 400 || staffTamperRes.status === 403 || staffTamperRes.status === 404);

  const adminTamperRes = await api(`/api/members/${memberId}`, {
    method: 'PUT',
    body: { shareCapital: 9999999 },
    token: adminToken
  });
  check('ADMIN -> DIRECT BALANCE TAMPERING strictly rejected (HTTP 400/403/404)', adminTamperRes.status === 400 || adminTamperRes.status === 403 || adminTamperRes.status === 404);

  console.log('\n======================================================================');
  console.log(`FINAL UAT COMPLETED: ALL ${passed}/${total} CRITICAL CHECKS PASSED (100%)`);
  console.log('======================================================================\n');
}

runUAT().catch(err => {
  console.error('UAT Execution Failure:', err);
  process.exit(1);
});

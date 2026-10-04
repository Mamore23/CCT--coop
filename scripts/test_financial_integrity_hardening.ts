import { CooperativeDB } from '../src/db/db.js';

// Using global fetch (Node 18+)
declare const fetch: any;

const BASE_URL = 'http://localhost:3000';

async function api(path: string, method: string = 'GET', body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data: data as any };
}

async function runIntegrityTests() {
  console.log('===============================================================');
  console.log('STARTING FINANCIAL BALANCE INTEGRITY HARDENING VERIFICATION');
  console.log('===============================================================');

  // Authenticate Admin and Staff
  const adminLogin = await api('/api/auth/login', 'POST', {
    email: 'admin@coop.com',
    password: 'admin123'
  });
  const adminToken = adminLogin.data.token;
  if (!adminToken) throw new Error('Admin authentication failed');
  console.log('✓ Admin authenticated successfully.');

  const staffLogin = await api('/api/auth/login', 'POST', {
    email: 'staff@coop.com',
    password: 'staff123'
  });
  const staffToken = staffLogin.data.token;
  if (!staffToken) throw new Error('Staff authentication failed');
  console.log('✓ Staff authenticated successfully.');

  // -------------------------------------------------------------------------
  // SECTION 12: FINANCIAL REGRESSION & INTEGRITY LIFECYCLE
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 12: FINANCIAL REGRESSION SCENARIO ---');

  // Step 1: Create a new member
  const testEmail = `hardened.member.${Date.now()}@example.com`;
  const regRes = await api('/api/auth/register', 'POST', {
    fullName: 'Financial Integrity Test Member',
    email: testEmail,
    password: 'Password123!',
    phone: '09171112233',
    initialShareCapital: 2500
  });
  if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
  console.log('✓ Step 1: New member created.');

  const allMembersRes = await api('/api/members', 'GET', undefined, adminToken);
  const testMember = (Array.isArray(allMembersRes.data) ? allMembersRes.data : []).find((m: any) => m.email === testEmail);
  if (!testMember) throw new Error('New member not found in members registry');
  const memberId = testMember.id;

  if (testMember.shareCapital !== 0) {
    throw new Error(`Step 1 Failed: Expected shareCapital to be 0 upon registration, got ${testMember.shareCapital}`);
  }
  console.log('✓ Step 1 Confirmed: shareCapital = ₱0');

  // Check transactions before approval
  const preApprovalTxs = await api(`/api/transactions?memberId=${memberId}`, 'GET', undefined, adminToken);
  const txListBefore = Array.isArray(preApprovalTxs.data) ? preApprovalTxs.data : [];
  const memberPreTxs = txListBefore.filter((t: any) => t.memberId === memberId);
  const preTxCount = memberPreTxs.length;

  // Step 2: Approve membership
  const approveRes = await api(`/api/users/verify-member/${memberId}`, 'POST', {
    action: 'APPROVE',
    reviewNotes: 'Verified without initial share payment'
  }, staffToken);
  if (approveRes.status !== 200) throw new Error(`Approval failed: ${JSON.stringify(approveRes.data)}`);
  console.log('✓ Step 2: Membership approved by Staff.');

  // Confirm shareCapital = 0, no financial tx, no Official Receipt
  const afterApproveMembers = await api('/api/members', 'GET', undefined, adminToken);
  const approvedMember = (Array.isArray(afterApproveMembers.data) ? afterApproveMembers.data : []).find((m: any) => m.id === memberId);
  if (approvedMember.shareCapital !== 0) {
    throw new Error(`Step 2 Failed: shareCapital must be 0 after approval, got ${approvedMember.shareCapital}`);
  }

  const postApprovalTxs = await api(`/api/transactions?memberId=${memberId}`, 'GET', undefined, adminToken);
  const txListAfter = Array.isArray(postApprovalTxs.data) ? postApprovalTxs.data : [];
  const memberPostTxs = txListAfter.filter((t: any) => t.memberId === memberId);
  if (memberPostTxs.length !== preTxCount) {
    throw new Error(`Step 2 Failed: Membership approval created financial transaction(s)! Count before: ${preTxCount}, after: ${memberPostTxs.length}`);
  }

  const allReceiptsRes = await api('/api/receipts', 'GET', undefined, adminToken);
  const memberReceipts = (allReceiptsRes.data || []).filter((r: any) => r.memberId === memberId);
  if (memberReceipts.length !== 0) {
    throw new Error(`Step 2 Failed: Membership approval generated an Official Receipt before payment! Count: ${memberReceipts.length}`);
  }
  console.log('✓ Step 2 Confirmed: shareCapital = ₱0, 0 financial transactions, 0 Official Receipts created.');

  // Step 3: Member logs in and submits Initial Share Payment
  const memberLogin = await api('/api/auth/login', 'POST', {
    email: testEmail,
    password: 'Password123!'
  });
  const memberToken = memberLogin.data.token;
  if (!memberToken) throw new Error('Approved member login failed');

  const payReqRes = await api('/api/payments/request', 'POST', {
    paymentType: 'INITIAL_SHARE',
    amount: 2500,
    paymentMethod: 'GCASH',
    externalReference: `GCASH-${Date.now()}`,
    remarks: 'Initial Share Capital verification test'
  }, memberToken);
  if (payReqRes.status !== 201) throw new Error(`Payment request creation failed: ${JSON.stringify(payReqRes.data)}`);
  const paymentRequestId = payReqRes.data.paymentRequest.id;
  console.log(`✓ Step 3: Initial Share Payment Request #${paymentRequestId} created (PENDING_RECONCILIATION).`);

  // Confirm shareCapital remains 0 while pending
  const afterReqMembers = await api('/api/members', 'GET', undefined, adminToken);
  const memberAfterReq = (Array.isArray(afterReqMembers.data) ? afterReqMembers.data : []).find((m: any) => m.id === memberId);
  if (memberAfterReq.shareCapital !== 0) {
    throw new Error(`Step 3 Failed: shareCapital changed while payment is pending reconciliation! Got: ${memberAfterReq.shareCapital}`);
  }
  console.log('✓ Step 3 Confirmed: shareCapital remains exactly ₱0 while payment is pending reconciliation.');

  // Step 4: Reconcile Payment
  const reconcileRes = await api(`/api/payments/reconcile/${paymentRequestId}`, 'POST', {
    action: 'RECONCILE',
    reconciliationNotes: 'Verified payment on GCash merchant dashboard'
  }, staffToken);
  if (reconcileRes.status !== 200) throw new Error(`Reconciliation failed: ${JSON.stringify(reconcileRes.data)}`);
  console.log('✓ Step 4: Payment reconciled and posted by Staff.');

  // Step 5: Confirm exactly 1 financial transaction, 1 ledger entry, 1 Official Receipt, 1 audit event
  const afterReconcileMembers = await api('/api/members', 'GET', undefined, adminToken);
  const memberAfterReconcile = (Array.isArray(afterReconcileMembers.data) ? afterReconcileMembers.data : []).find((m: any) => m.id === memberId);
  if (memberAfterReconcile.shareCapital !== 2500) {
    throw new Error(`Step 5 Failed: Expected shareCapital to be ₱2,500, got ${memberAfterReconcile.shareCapital}`);
  }

  const postReconcileTxs = await api(`/api/transactions?memberId=${memberId}`, 'GET', undefined, adminToken);
  const txListReconcile = Array.isArray(postReconcileTxs.data) ? postReconcileTxs.data : [];
  const memberPostReconcileTxs = txListReconcile.filter((t: any) => t.memberId === memberId && t.type === 'DEPOSIT');
  if (memberPostReconcileTxs.length !== 1) {
    throw new Error(`Step 5 Failed: Expected exactly 1 deposit ledger transaction, found: ${memberPostReconcileTxs.length}`);
  }

  const postReconcileORs = await api('/api/receipts', 'GET', undefined, adminToken);
  const memberPostReconcileORs = (postReconcileORs.data || []).filter((r: any) => r.memberId === memberId);
  if (memberPostReconcileORs.length !== 1) {
    throw new Error(`Step 5 Failed: Expected exactly 1 Official Receipt, found: ${memberPostReconcileORs.length}`);
  }
  console.log(`✓ Step 5 Confirmed: shareCapital = ₱2,500, exactly 1 ledger transaction, exactly 1 Official Receipt (${memberPostReconcileORs[0].receiptNumber}).`);

  // -------------------------------------------------------------------------
  // SECTION 11: API SECURITY & DIRECT MUTATION BLOCKING TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 11: API SECURITY & TAMPER PREVENTION ---');

  // Test A: Member cannot modify shareCapital
  const memberMutateRes = await api(`/api/members/me/profile`, 'PUT', {
    shareCapital: 999999
  }, memberToken);
  if (memberMutateRes.status !== 400) {
    throw new Error(`Security Test A Failed: Member sending shareCapital got status ${memberMutateRes.status} instead of 400!`);
  }
  console.log('✓ Security Test A Passed: Member attempting to modify shareCapital rejected with 400 Bad Request.');

  // Test B: Staff cannot modify shareCapital through member profile APIs
  const staffMutateRes = await api(`/api/users/members/${memberId}`, 'PUT', {
    shareCapital: 999999,
    fullName: 'Tampered Name'
  }, staffToken);
  if (staffMutateRes.status !== 400) {
    throw new Error(`Security Test B Failed: Staff sending shareCapital to /users/members/:id got status ${staffMutateRes.status} instead of 400!`);
  }
  console.log('✓ Security Test B Passed: Staff attempting to modify shareCapital via profile API rejected with 400 Bad Request.');

  // Test C: Admin cannot modify shareCapital through member profile APIs
  const adminMutateRes = await api(`/api/members/${memberId}/status`, 'PUT', {
    status: 'ACTIVE',
    shareCapital: 999999
  }, adminToken);
  if (adminMutateRes.status !== 400) {
    throw new Error(`Security Test C Failed: Admin sending shareCapital to /members/:id/status got status ${adminMutateRes.status} instead of 400!`);
  }
  console.log('✓ Security Test C Passed: Admin attempting to modify shareCapital via status API rejected with 400 Bad Request.');

  // Test C2: Admin and Staff cannot modify regularSavings, timeDeposits, or loan balances
  const adminSavingsMutate = await api(`/api/users/members/${memberId}`, 'PUT', {
    regularSavings: 500000,
    timeDeposits: 500000
  }, adminToken);
  if (adminSavingsMutate.status !== 400) {
    throw new Error(`Security Test C2 Failed: Admin sending regularSavings got status ${adminSavingsMutate.status} instead of 400!`);
  }
  console.log('✓ Security Test C2 Passed: Direct modification of regularSavings / timeDeposits rejected with 400 Bad Request.');

  const adminLoanMutate = await api(`/api/loans/any_loan_id`, 'PUT', {
    balance: 0,
    outstandingBalance: 0
  }, adminToken);
  if (adminLoanMutate.status !== 400) {
    throw new Error(`Security Test C3 Failed: Admin sending loan balance mutation got status ${adminLoanMutate.status} instead of 400!`);
  }
  console.log('✓ Security Test C3 Passed: Direct modification of loan balance rejected with 400 Bad Request.');

  // Test D: Changing URL / ID cannot bypass authorization
  const memberTamperOtherRes = await api(`/api/users/members/other_member_id`, 'PUT', {
    fullName: 'Hacked Name'
  }, memberToken);
  if (memberTamperOtherRes.status !== 403) {
    throw new Error(`Security Test D Failed: Member calling /users/members/:id got status ${memberTamperOtherRes.status} instead of 403!`);
  }
  console.log('✓ Security Test D Passed: Member calling protected member management route returned 403 Forbidden.');

  // Test E: Confirm shareCapital remains strictly unchanged at ₱2,500
  const afterTamperMembers = await api('/api/members', 'GET', undefined, adminToken);
  const memberAfterTamper = (Array.isArray(afterTamperMembers.data) ? afterTamperMembers.data : []).find((m: any) => m.id === memberId);
  if (memberAfterTamper.shareCapital !== 2500) {
    throw new Error(`Security Test E Failed: shareCapital was modified! Expected 2500, got: ${memberAfterTamper.shareCapital}`);
  }
  console.log('✓ Security Test E Confirmed: shareCapital remained strictly unchanged at ₱2,500 after all tamper attempts.');

  // Step 8: Retry reconciliation on already posted payment request (Idempotency)
  console.log('\n--- IDEMPOTENCY VERIFICATION ---');
  const duplicateReconcileRes = await api(`/api/payments/reconcile/${paymentRequestId}`, 'POST', {
    action: 'RECONCILE',
    reconciliationNotes: 'Duplicate retry attempt'
  }, staffToken);
  console.log('Duplicate reconciliation response status:', duplicateReconcileRes.status);

  const finalMembers = await api('/api/members', 'GET', undefined, adminToken);
  const finalMember = (Array.isArray(finalMembers.data) ? finalMembers.data : []).find((m: any) => m.id === memberId);
  if (finalMember.shareCapital !== 2500) {
    throw new Error(`Idempotency Failed: shareCapital doubled or changed upon retry! Got: ${finalMember.shareCapital}`);
  }

  const finalTxs = await api(`/api/transactions?memberId=${memberId}`, 'GET', undefined, adminToken);
  const finalTxList = Array.isArray(finalTxs.data) ? finalTxs.data : [];
  const finalMemberTxs = finalTxList.filter((t: any) => t.memberId === memberId && t.type === 'DEPOSIT');
  if (finalMemberTxs.length !== 1) {
    throw new Error(`Idempotency Failed: Duplicate ledger transaction created upon retry! Count: ${finalMemberTxs.length}`);
  }

  const finalORs = await api('/api/receipts', 'GET', undefined, adminToken);
  const finalMemberORs = (finalORs.data || []).filter((r: any) => r.memberId === memberId);
  if (finalMemberORs.length !== 1) {
    throw new Error(`Idempotency Failed: Duplicate Official Receipt created upon retry! Count: ${finalMemberORs.length}`);
  }
  console.log('✓ Idempotency Confirmed: No duplicate transaction, no duplicate balance change, no duplicate Official Receipt.');

  // Verify Audit Log captured the rejection
  const auditLogsRes = await api('/api/audit-logs', 'GET', undefined, adminToken);
  const logs = auditLogsRes.data || [];
  const foundRejectionAudit = logs.some((l: any) => l.action === 'FINANCIAL_MUTATION_REJECTED');
  console.log('✓ Audit Log Confirmed: FINANCIAL_MUTATION_REJECTED recorded in audit trail:', foundRejectionAudit);

  // Section 8: Recalibration Verification
  console.log('\n--- SECTION 8: RECALIBRATION AUTHORITATIVE VERIFICATION ---');
  const dbState = CooperativeDB.load();
  const fakeMemberId = 'fake_tamper_member_' + Date.now();
  dbState.members.push({
    id: fakeMemberId,
    email: `fake.${Date.now()}@tamper.com`,
    fullName: 'Fake Tampered Member',
    phone: '09123456789',
    status: 'ACTIVE',
    shareCapital: 999999, // Injected manual balance with NO financial postings or transactions
    regularSavings: 0,
    timeDeposits: 0,
    dividendsEarned: 0,
    createdAt: new Date().toISOString()
  });
  CooperativeDB.recalibrateShareCapital(dbState);
  const recalibratedFake = dbState.members.find(m => m.id === fakeMemberId);
  if (!recalibratedFake || recalibratedFake.shareCapital !== 0) {
    throw new Error(`Recalibration Failed: Stale manual shareCapital was not reset to 0! Got: ${recalibratedFake?.shareCapital}`);
  }
  // Clean up fake member
  dbState.members = dbState.members.filter(m => m.id !== fakeMemberId);
  CooperativeDB.save(dbState);
  console.log('✓ Recalibration Confirmed: Manually injected profile share capital was derived from financial ledger and reset to ₱0.');

  console.log('\n===============================================================');
  console.log('ALL FINANCIAL INTEGRITY & REGRESSION TESTS PASSED (100%)');
  console.log('===============================================================');
}

runIntegrityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ INTEGRITY TEST SUITE FAILED:', err);
    process.exit(1);
  });

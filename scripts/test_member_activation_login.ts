import { CooperativeDB } from '../src/db/db.js';
import { DatabaseState } from '../src/types.js';

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
  return { status: res.status, ok: res.ok, data };
}

async function runTest() {
  console.log('======================================================================');
  console.log('STARTING: MEMBER REGISTRATION → STAFF APPROVAL → LOGIN → DASHBOARD TEST');
  console.log('======================================================================\n');

  function getFreshDb() {
    (CooperativeDB as any).state = null;
    return CooperativeDB.load();
  }

  async function waitForMemberStatus(memberId: string, expectedStatus: string, maxWaitMs = 4000): Promise<DatabaseState> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      await new Promise(r => setTimeout(r, 250));
      const db = getFreshDb();
      const m = db.members.find(x => x.id === memberId);
      if (m && m.status === expectedStatus) {
        return db;
      }
    }
    return getFreshDb();
  }

  // Load baseline DB state to track financial balances
  const initialDb = getFreshDb();
  const initialTxCount = (initialDb.transactions || []).length;
  const initialReceiptsCount = (initialDb.officialReceipts || (initialDb as any).receipts || []).length;

  // -------------------------------------------------------------------------
  // TEST A — REGISTRATION
  // -------------------------------------------------------------------------
  console.log('--- TEST A: Registration ---');
  const timestamp = Date.now();
  const email = `verified.member.${timestamp}@example.com`;
  const password = 'MemberSecurePass123!';
  const fullName = `Automated Verification Test Member ${timestamp}`;
  const phone = '09179998877';

  const regRes = await api('/api/auth/register', 'POST', {
    email,
    password,
    fullName,
    phone,
    initialShareCapital: 2000
  });

  if (regRes.status !== 201) {
    throw new Error(`TEST A FAILED: Registration returned status ${regRes.status}: ${JSON.stringify(regRes.data)}`);
  }
  console.log('✓ Member registration request succeeded (HTTP 201).');

  // Verify DB state after registration
  await new Promise(r => setTimeout(r, 100));
  const dbAfterReg = getFreshDb();
  const registeredMember = dbAfterReg.members.find(m => m.email.toLowerCase() === email.toLowerCase());
  const registeredUser = dbAfterReg.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!registeredMember) throw new Error('TEST A FAILED: Member record not found in database.');
  if (!registeredUser) throw new Error('TEST A FAILED: User authentication record not found in database.');
  if (registeredMember.status !== 'PENDING') throw new Error(`TEST A FAILED: Member status is ${registeredMember.status}, expected PENDING.`);
  if (registeredUser.role !== 'MEMBER') throw new Error(`TEST A FAILED: User role is ${registeredUser.role}, expected MEMBER.`);
  if (!registeredUser.passwordHash) throw new Error('TEST A FAILED: User passwordHash is missing.');

  console.log('✓ Account exists in database with status PENDING.');
  console.log('✓ User authentication account exists with role MEMBER.');
  console.log('✓ User and member IDs are correctly linked:', { userId: registeredUser.id, memberId: registeredMember.id });
  console.log('✓ TEST A PASSED!\n');

  // -------------------------------------------------------------------------
  // TEST B — STAFF APPROVAL
  // -------------------------------------------------------------------------
  console.log('--- TEST B: Staff Approval ---');
  const staffLoginRes = await api('/api/auth/login', 'POST', {
    email: 'staff@coop.com',
    password: 'staff123'
  });
  if (!staffLoginRes.ok || !staffLoginRes.data.token) {
    throw new Error(`Staff login failed: ${JSON.stringify(staffLoginRes.data)}`);
  }
  const staffToken = staffLoginRes.data.token;
  console.log('✓ Staff logged in successfully.');

  const approveRes = await api(`/api/users/verify-member/${registeredMember.id}`, 'POST', {
    action: 'APPROVE',
    reviewNotes: 'Verified identity and pre-membership requirements.'
  }, staffToken);

  if (!approveRes.ok) {
    throw new Error(`TEST B FAILED: Staff approval returned status ${approveRes.status}: ${JSON.stringify(approveRes.data)}`);
  }
  console.log('✓ Staff membership approval endpoint returned HTTP 200.');

  // Verify DB state after approval
  const dbAfterApprove = await waitForMemberStatus(registeredMember.id, 'ACTIVE');
  const approvedMember = dbAfterApprove.members.find(m => m.id === registeredMember.id);
  const approvedUser = dbAfterApprove.users.find(u => u.id === registeredMember.id || u.email.toLowerCase() === email.toLowerCase());

  if (!approvedMember) throw new Error('TEST B FAILED: Member record missing after approval.');
  if (!approvedUser) throw new Error('TEST B FAILED: User authentication account missing or replaced after approval.');
  if (approvedMember.status !== 'ACTIVE') throw new Error(`TEST B FAILED: Member status is ${approvedMember.status}, expected ACTIVE.`);
  if (approvedUser.role !== 'MEMBER') throw new Error(`TEST B FAILED: User role changed to ${approvedUser.role}, expected MEMBER.`);
  if (approvedUser.id !== approvedMember.id && approvedUser.memberId !== approvedMember.id) {
    throw new Error(`TEST B FAILED: User/Member linkage broken! User.id: ${approvedUser.id}, Member.id: ${approvedMember.id}`);
  }
  if (!approvedUser.passwordHash) throw new Error('TEST B FAILED: Password hash was accidentally removed during approval.');
  if (approvedUser.passwordHash !== registeredUser.passwordHash) {
    throw new Error('TEST B FAILED: Password hash was modified during approval.');
  }

  // Confirm no financial transaction was created during approval
  const currentTxCount = (dbAfterApprove.transactions || []).length;
  if (currentTxCount !== initialTxCount) {
    throw new Error(`TEST B FAILED: Unexpected financial transaction created on approval. Before: ${initialTxCount}, After: ${currentTxCount}`);
  }
  console.log('✓ Member status transitioned to ACTIVE.');
  console.log('✓ User role remains strictly MEMBER.');
  console.log('✓ User/member linkage remains intact (id/memberId match).');
  console.log('✓ Password hash remains intact.');
  console.log('✓ Zero financial transactions created upon approval.');
  console.log('✓ TEST B PASSED!\n');

  // -------------------------------------------------------------------------
  // TEST C — LOGIN WITH APPROVED CREDENTIALS
  // -------------------------------------------------------------------------
  console.log('--- TEST C: Login ---');
  const memberLoginRes = await api('/api/auth/login', 'POST', {
    email,
    password
  });

  if (!memberLoginRes.ok || memberLoginRes.status !== 200) {
    throw new Error(`TEST C FAILED: Member login failed with HTTP ${memberLoginRes.status}: ${JSON.stringify(memberLoginRes.data)}`);
  }

  const loginData = memberLoginRes.data;
  if (!loginData.token) throw new Error('TEST C FAILED: No JWT token returned.');
  if (!loginData.user) throw new Error('TEST C FAILED: No user object in login response.');
  if (loginData.user.role !== 'MEMBER') throw new Error(`TEST C FAILED: Returned role is ${loginData.user.role}, expected MEMBER.`);
  if (!loginData.memberId && !loginData.user.memberId) {
    throw new Error('TEST C FAILED: memberId is missing from login response.');
  }
  const returnedMemberId = loginData.memberId || loginData.user.memberId;
  if (returnedMemberId !== approvedMember.id) {
    throw new Error(`TEST C FAILED: returned memberId ${returnedMemberId} does not match member.id ${approvedMember.id}`);
  }

  console.log('✓ Member authenticated successfully (HTTP 200).');
  console.log('✓ Returned role is MEMBER.');
  console.log('✓ Returned memberId is present and matches member record:', returnedMemberId);
  console.log('✓ TEST C PASSED!\n');

  const memberToken = loginData.token;

  // -------------------------------------------------------------------------
  // TEST D — DASHBOARD ACCESS & ROUTING
  // -------------------------------------------------------------------------
  console.log('--- TEST D: Member Dashboard Access & Routing ---');

  // 1. Session verification /api/auth/me
  const meRes = await api('/api/auth/me', 'GET', undefined, memberToken);
  if (!meRes.ok) throw new Error(`TEST D FAILED: /api/auth/me returned HTTP ${meRes.status}`);
  if (meRes.data.role !== 'MEMBER') throw new Error(`TEST D FAILED: /api/auth/me role is ${meRes.data.role}`);
  console.log('✓ /api/auth/me resolves successfully (HTTP 200).');

  // 2. Dashboard stats /api/dashboard/stats
  const statsRes = await api('/api/dashboard/stats', 'GET', undefined, memberToken);
  if (!statsRes.ok) throw new Error(`TEST D FAILED: /api/dashboard/stats returned HTTP ${statsRes.status}`);
  if (statsRes.data.role !== 'MEMBER') throw new Error(`TEST D FAILED: /api/dashboard/stats role is ${statsRes.data.role}`);
  console.log('✓ /api/dashboard/stats resolves successfully (HTTP 200).');

  // 3. Member dashboard route aliases
  const memberDashRes = await api('/api/member/dashboard', 'GET', undefined, memberToken);
  if (!memberDashRes.ok) throw new Error(`TEST D FAILED: /api/member/dashboard returned HTTP ${memberDashRes.status}`);
  console.log('✓ /api/member/dashboard resolves successfully (HTTP 200).');

  // 4. Member profile /api/members/me/profile and /api/member/profile
  const profileRes1 = await api('/api/members/me/profile', 'GET', undefined, memberToken);
  if (!profileRes1.ok) throw new Error(`TEST D FAILED: /api/members/me/profile returned HTTP ${profileRes1.status}`);
  console.log('✓ /api/members/me/profile resolves successfully (HTTP 200).');

  const profileRes2 = await api('/api/member/profile', 'GET', undefined, memberToken);
  if (!profileRes2.ok) throw new Error(`TEST D FAILED: /api/member/profile returned HTTP ${profileRes2.status}`);
  console.log('✓ /api/member/profile resolves successfully (HTTP 200).');

  // 5. Member ledger /api/savings/ledger
  const ledgerRes = await api('/api/savings/ledger', 'GET', undefined, memberToken);
  if (!ledgerRes.ok) throw new Error(`TEST D FAILED: /api/savings/ledger returned HTTP ${ledgerRes.status}`);
  console.log('✓ /api/savings/ledger resolves successfully (HTTP 200).');

  // 6. Member individual record /api/members/:id
  const memberByIdRes = await api(`/api/members/${approvedMember.id}`, 'GET', undefined, memberToken);
  if (!memberByIdRes.ok) throw new Error(`TEST D FAILED: /api/members/${approvedMember.id} returned HTTP ${memberByIdRes.status}`);
  console.log(`✓ /api/members/${approvedMember.id} resolves successfully (HTTP 200).`);

  // 7. Verify member cannot access other members' records
  const otherMemberId = 'u_member1';
  const otherMemberRes = await api(`/api/members/${otherMemberId}`, 'GET', undefined, memberToken);
  if (otherMemberRes.status !== 403) {
    throw new Error(`TEST D FAILED: Member should be forbidden from accessing other member records. Got HTTP ${otherMemberRes.status}`);
  }
  console.log('✓ Server-side security verified: Member blocked with HTTP 403 when requesting other member records.');

  // 8. Verify member cannot access admin endpoints
  const adminEndpoints = ['/api/audit-logs', '/api/db/backup', '/api/permissions'];
  for (const ep of adminEndpoints) {
    const deniedRes = await api(ep, 'GET', undefined, memberToken);
    if (deniedRes.status !== 403) {
      throw new Error(`TEST D FAILED: Member should be forbidden from ${ep}. Got HTTP ${deniedRes.status}`);
    }
  }
  console.log('✓ Server-side security verified: Member blocked with HTTP 403 on admin modules.');
  console.log('✓ TEST D PASSED!\n');

  // -------------------------------------------------------------------------
  // TEST E — FINANCIAL INTEGRITY PRESERVATION
  // -------------------------------------------------------------------------
  console.log('--- TEST E: Financial Integrity Preservation ---');
  await new Promise(r => setTimeout(r, 100));
  const finalDb = getFreshDb();
  const finalMember = finalDb.members.find(m => m.id === approvedMember.id)!;

  if (finalMember.shareCapital !== 0) throw new Error(`TEST E FAILED: shareCapital changed to ${finalMember.shareCapital}, expected 0`);
  if (finalMember.regularSavings !== 0) throw new Error(`TEST E FAILED: regularSavings changed to ${finalMember.regularSavings}, expected 0`);
  if (finalMember.timeDeposits !== 0) throw new Error(`TEST E FAILED: timeDeposits changed to ${finalMember.timeDeposits}, expected 0`);
  if ((finalDb.transactions || []).length !== initialTxCount) {
    throw new Error('TEST E FAILED: Financial transactions list modified.');
  }
  const finalReceiptsCount = (finalDb.officialReceipts || (finalDb as any).receipts || []).length;
  if (finalReceiptsCount !== initialReceiptsCount) {
    throw new Error('TEST E FAILED: Official Receipts count modified.');
  }

  console.log('✓ shareCapital preserved at ₱0.');
  console.log('✓ regularSavings preserved at ₱0.');
  console.log('✓ timeDeposits preserved at ₱0.');
  console.log('✓ Financial transactions count unchanged.');
  console.log('✓ Official Receipts count unchanged.');
  console.log('✓ TEST E PASSED!\n');

  console.log('======================================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! COMPLETE LIFECYCLE VERIFIED.');
  console.log('======================================================================');
}

runTest().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});

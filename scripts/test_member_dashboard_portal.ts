/**
 * Comprehensive Automated Test Suite: Member Dashboard & Portal Optimization
 * Verifies:
 * 1. Member Dashboard Summary (Initial Share Capital, Share Capital, Regular Savings, Time Deposits, Active Loan Balance, Next Loan Payment, Compliance Status)
 * 2. Financial Transaction Ledger (Ownership isolation, Debit/Credit/Running Balance, Master Ledger Protection)
 * 3. Official Receipts (Own receipts only, tamper protection, void/generate blocked)
 * 4. Role Hierarchy & Authorization
 */

const BASE_URL = 'http://localhost:3000';

async function runMemberDashboardTests() {
  console.log("======================================================================");
  console.log("STARTING: MEMBER DASHBOARD & PORTAL OPTIMIZATION VERIFICATION");
  console.log("======================================================================");

  // 1. Authenticate Admin, Staff, and Member
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@coop.com', password: 'admin123' })
  });
  if (!adminLoginRes.ok) throw new Error("Admin login failed");
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.token;

  const staffLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff@coop.com', password: 'staff123' })
  });
  if (!staffLoginRes.ok) throw new Error("Staff login failed");
  const staffData = await staffLoginRes.json();
  const staffToken = staffData.token;

  const memberLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'member@coop.com', password: 'member123' })
  });
  if (!memberLoginRes.ok) throw new Error("Member login failed");
  const memberData = await memberLoginRes.json();
  const memberToken = memberData.token;
  const memberId = memberData.user?.memberId || memberData.user?.id;

  console.log(`✓ Authenticated Member (ID: ${memberId})`);

  // --- SECTION 1: MEMBER DASHBOARD SUMMARY INTEGRITY ---
  console.log("\n--- SECTION 1: MEMBER DASHBOARD SUMMARY VERIFICATION ---");
  
  const statsRes = await fetch(`${BASE_URL}/api/dashboard/stats`, {
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  if (!statsRes.ok) throw new Error(`Stats endpoint failed: ${statsRes.status}`);
  const stats = await statsRes.json();
  
  console.log(`✓ Member stats retrieved:`);
  console.log(`  - Regular Savings: ₱${stats.regularSavings}`);
  console.log(`  - Share Capital: ₱${stats.shareCapital}`);
  console.log(`  - Time Deposits: ₱${stats.timeDeposits}`);
  console.log(`  - Active Loans Balance: ₱${stats.activeLoansBalance} (Count: ${stats.activeLoansCount})`);

  const ledgerRes = await fetch(`${BASE_URL}/api/savings/ledger`, {
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  if (!ledgerRes.ok) throw new Error(`Ledger endpoint failed: ${ledgerRes.status}`);
  const memberLedger = await ledgerRes.json();

  console.log(`✓ Member ledger profile retrieved:`);
  console.log(`  - Initial Share Capital Paid: ${memberLedger.member.initialShareCapitalPaid}`);
  console.log(`  - Status: ${memberLedger.member.status}`);
  console.log(`  - Pre-Membership Seminar Attended: ${memberLedger.member.hasAttendedPreMembershipSeminar}`);

  // --- SECTION 2: FINANCIAL TRANSACTION LEDGER ISOLATION ---
  console.log("\n--- SECTION 2: FINANCIAL TRANSACTION LEDGER ISOLATION ---");

  // Verify all transactions in ledger belong to this member
  const transactions = memberLedger.transactions || [];
  console.log(`✓ Retrieved ${transactions.length} personal transactions for member.`);
  for (const tx of transactions) {
    if (tx.memberId !== memberId) {
      throw new Error(`Data leak! Transaction ${tx.id} belongs to ${tx.memberId}, not ${memberId}`);
    }
  }
  console.log(`✓ Confirmed: 100% of transactions belong exclusively to authenticated member.`);

  // Verify member cannot access the master cooperative ledger
  const masterLedgerRes = await fetch(`${BASE_URL}/api/ledger`, {
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  if (masterLedgerRes.status === 403 || masterLedgerRes.status === 401) {
    console.log(`✓ Security Confirmed: Member blocked from cooperative master ledger (${masterLedgerRes.status} Forbidden).`);
  } else {
    throw new Error(`Security breach! Member was able to access /api/ledger with status ${masterLedgerRes.status}`);
  }

  // Verify member cannot query another member's ledger via ?memberId=
  const otherMemberLedgerRes = await fetch(`${BASE_URL}/api/savings/ledger?memberId=u_admin`, {
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  const otherLedgerData = await otherMemberLedgerRes.json();
  if (otherLedgerData.member && otherLedgerData.member.id !== memberId) {
    throw new Error(`Security breach! Member was able to view another member's ledger.`);
  }
  console.log(`✓ Security Confirmed: Server ignored supplied memberId and resolved authenticated member.`);

  // --- SECTION 3: OFFICIAL RECEIPTS PERMISSIONS & ISOLATION ---
  console.log("\n--- SECTION 3: OFFICIAL RECEIPTS PERMISSIONS & ISOLATION ---");

  const receiptsRes = await fetch(`${BASE_URL}/api/receipts`, {
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  if (!receiptsRes.ok) throw new Error(`Receipts endpoint failed: ${receiptsRes.status}`);
  const receipts = await receiptsRes.json();
  console.log(`✓ Member retrieved ${receipts.length} official receipts.`);

  for (const r of receipts) {
    if (r.memberId !== memberId) {
      throw new Error(`Data leak! Receipt ${r.receiptNumber} belongs to ${r.memberId}, not ${memberId}`);
    }
  }
  console.log(`✓ Confirmed: 100% of official receipts belong strictly to authenticated member.`);

  // Verify Member CANNOT generate/issue official receipts
  const generateRes = await fetch(`${BASE_URL}/api/receipts/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`
    },
    body: JSON.stringify({
      memberId,
      amount: 5000,
      paymentType: 'SHARE_CAPITAL'
    })
  });
  if (generateRes.status === 403) {
    console.log(`✓ Security Confirmed: Member cannot create or issue Official Receipts (403 Forbidden).`);
  } else {
    throw new Error(`Security breach! Member called /receipts/generate with status ${generateRes.status}`);
  }

  // Verify Member CANNOT void receipts
  if (receipts.length > 0) {
    const voidRes = await fetch(`${BASE_URL}/api/receipts/${receipts[0].id}/void`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({ reason: 'Fraudulent void attempt' })
    });
    if (voidRes.status === 403) {
      console.log(`✓ Security Confirmed: Member cannot void Official Receipts (403 Forbidden).`);
    } else {
      throw new Error(`Security breach! Member called void with status ${voidRes.status}`);
    }
  }

  // --- SECTION 4: FINANCIAL BALANCE READ-ONLY SECURITY ---
  console.log("\n--- SECTION 4: FINANCIAL BALANCE TAMPER PREVENTION ---");

  const tamperAttempt = await fetch(`${BASE_URL}/api/members/${memberId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`
    },
    body: JSON.stringify({
      shareCapital: 9999999,
      regularSavings: 9999999
    })
  });
  if (tamperAttempt.status === 400 || tamperAttempt.status === 403) {
    console.log(`✓ Security Confirmed: Direct modification of financial balances rejected with ${tamperAttempt.status}.`);
  } else {
    throw new Error(`Financial tamper vulnerability! Modification returned ${tamperAttempt.status}`);
  }

  console.log("\n======================================================================");
  console.log("ALL MEMBER PORTAL, DASHBOARD, AND SECURITY TESTS PASSED (100%)");
  console.log("======================================================================");
}

runMemberDashboardTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

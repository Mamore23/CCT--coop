import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('   COOPERATIVE WITHDRAWAL WORKFLOW TEST SUITE      ');
  console.log('====================================================\n');

  let member1Token = '';
  let member1Id = '';
  let member2Token = '';
  let member2Id = '';
  let staffToken = '';

  // 1. Authenticate users
  console.log('1. Authenticating test users...');
  
  // Login Admin first for full staff/admin module permissions
  let res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@coop.com', password: 'admin123' })
  });
  let data: any = await res.json();
  if (!res.ok) throw new Error(`Admin login failed: ${JSON.stringify(data)}`);
  staffToken = data.token;

  // Approve Member 2 via staff so member 2 can log in
  const verifyRes = await fetch(`${BASE_URL}/api/users/verify-member/u_member2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ action: 'APPROVE' })
  });
  const verifyData = await verifyRes.json();
  console.log(`   Approve member2 result: ${verifyRes.status} ${JSON.stringify(verifyData)}`);

  // Login Member 1
  res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'member@coop.com', password: 'member123' })
  });
  data = await res.json();
  member1Token = data.token;
  member1Id = data.user.id;

  // Login Member 2
  res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pending@coop.com', password: 'pending123' })
  });
  data = await res.json();
  if (!res.ok) throw new Error(`Member 2 login failed: ${JSON.stringify(data)}`);
  member2Token = data.token;
  member2Id = data.user.id;

  console.log('   Authenticated successfully.');

  // 2. Helper to fetch member profile
  async function getMember(token: string): Promise<any> {
    const r = await fetch(`${BASE_URL}/api/members/me/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return await r.json();
  }

  // Ensure Member 1 initial share capital is verified
  await fetch(`${BASE_URL}/api/staff/verify-initial-share/u_member1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` }
  });

  // Ensure member 1 has known initial funds in Regular Savings
  console.log('\n2. Setting up test environment & initial balances...');
  // Deposit ₱10,000 into Regular Savings for Member 1 as staff
  res = await fetch(`${BASE_URL}/api/savings/transaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      memberId: member1Id,
      type: 'DEPOSIT',
      accountType: 'regularSavings',
      amount: 10000,
      paymentMethod: 'CASH',
      description: 'Test setup regular savings deposit'
    })
  });
  data = await res.json();
  console.log(`   Initial setup deposit result: ${res.status} ${data.message || data.error}`);

  // Set member 1 GCash number if missing
  await fetch(`${BASE_URL}/api/members/me/gcash-info`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${member1Token}`
    },
    body: JSON.stringify({
      gcashAccountName: 'John Doe',
      gcashNumber: '09171234567'
    })
  });

  let m1Before = await getMember(member1Token);
  console.log(`   Member 1 Initial State:`);
  console.log(`   - Share Capital: ₱${m1Before.shareCapital}`);
  console.log(`   - Regular Savings: ₱${m1Before.regularSavings}`);
  console.log(`   - GCash Number: ${m1Before.gcashNumber}`);

  const initialShareCapital = m1Before.shareCapital;
  const initialRegularSavings = m1Before.regularSavings;

  // TEST A & B: Valid ₱2,000 withdrawal request
  console.log('\n----------------------------------------------------');
  console.log('TEST A & B: Valid ₱2,000 withdrawal request...');
  const txKeyA = `TEST_KEY_A_${Date.now()}`;
  res = await fetch(`${BASE_URL}/api/savings/withdrawal-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${member1Token}`
    },
    body: JSON.stringify({
      amount: 2000,
      releaseMethod: 'OFFICE_CASH',
      remarks: 'Emergency office cash withdrawal test',
      clientTxKey: txKeyA
    })
  });
  data = await res.json();
  console.log(`   Status Code: ${res.status}`);
  console.log(`   Response Message: ${data.message}`);
  if (res.status !== 200 || !data.withdrawalRequest || data.withdrawalRequest.status !== 'PENDING') {
    throw new Error(`TEST A FAILED: Expected 200 OK with PENDING request, got ${res.status}`);
  }
  const reqAId = data.withdrawalRequest.id;
  console.log(`   [PASS] TEST A: Created pending withdrawal request #${reqAId}`);

  // Test B: Verify Regular Savings is NOT deducted while request is pending
  let m1AfterA = await getMember(member1Token);
  console.log(`   Regular Savings before request: ₱${initialRegularSavings}`);
  console.log(`   Regular Savings while request pending: ₱${m1AfterA.regularSavings}`);
  if (m1AfterA.regularSavings !== initialRegularSavings) {
    throw new Error(`TEST B FAILED: Regular savings deducted prematurely! Expected ₱${initialRegularSavings}, got ₱${m1AfterA.regularSavings}`);
  }
  console.log('   [PASS] TEST B: Regular Savings balance was NOT deducted while pending.');

  // TEST C: Insufficient balance rejected
  console.log('\n----------------------------------------------------');
  console.log('TEST C: Requesting amount exceeding Regular Savings...');
  res = await fetch(`${BASE_URL}/api/savings/withdrawal-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${member1Token}`
    },
    body: JSON.stringify({
      amount: 9999999,
      releaseMethod: 'OFFICE_CASH',
      remarks: 'Excessive amount'
    })
  });
  data = await res.json();
  console.log(`   Status Code: ${res.status}`);
  console.log(`   Error Message: ${data.error}`);
  if (res.status !== 400 || !data.error || !data.error.includes('Insufficient Regular Savings balance')) {
    throw new Error(`TEST C FAILED: Expected 400 Insufficient balance error, got ${res.status} ${JSON.stringify(data)}`);
  }
  console.log('   [PASS] TEST C: Insufficient balance correctly rejected.');

  // TEST D: Zero or negative amount rejected
  console.log('\n----------------------------------------------------');
  console.log('TEST D: Zero and negative withdrawal amounts...');
  res = await fetch(`${BASE_URL}/api/savings/withdrawal-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${member1Token}`
    },
    body: JSON.stringify({
      amount: 0,
      releaseMethod: 'OFFICE_CASH'
    })
  });
  data = await res.json();
  if (res.status !== 400) {
    throw new Error(`TEST D FAILED: Amount 0 should return 400, got ${res.status}`);
  }

  res = await fetch(`${BASE_URL}/api/savings/withdrawal-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${member1Token}`
    },
    body: JSON.stringify({
      amount: -500,
      releaseMethod: 'OFFICE_CASH'
    })
  });
  data = await res.json();
  if (res.status !== 400) {
    throw new Error(`TEST D FAILED: Negative amount should return 400, got ${res.status}`);
  }
  console.log('   [PASS] TEST D: Zero/negative amounts correctly rejected.');

  // TEST E: Member cannot withdraw another member's funds
  console.log('\n----------------------------------------------------');
  console.log('TEST E: Member 2 attempting to request withdrawal from Member 1 account...');
  res = await fetch(`${BASE_URL}/api/savings/withdrawal-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${member2Token}`
    },
    body: JSON.stringify({
      memberId: member1Id,
      amount: 1000,
      releaseMethod: 'OFFICE_CASH'
    })
  });
  data = await res.json();
  console.log(`   Status Code: ${res.status}`);
  console.log(`   Response: ${data.error || JSON.stringify(data)}`);
  if (res.status !== 403) {
    throw new Error(`TEST E FAILED: Member requesting another member's funds should return 403, got ${res.status}`);
  }
  console.log('   [PASS] TEST E: Cross-member withdrawal attempt forbidden.');

  // TEST F: Staff approval deducts balance exactly once
  console.log('\n----------------------------------------------------');
  console.log('TEST F: Staff approval of ₱2,000 withdrawal request...');
  res = await fetch(`${BASE_URL}/api/savings/withdrawal-requests/${reqAId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      requestId: reqAId
    })
  });
  data = await res.json();
  console.log(`   Status Code: ${res.status}`);
  console.log(`   Message: ${data.message}`);
  console.log(`   Official Receipt Issued: ${data.receipt?.receiptNumber}`);
  if (res.status !== 200 || !data.receipt) {
    throw new Error(`TEST F FAILED: Staff approval failed: ${JSON.stringify(data)}`);
  }

  let m1AfterApprove = await getMember(member1Token);
  const expectedSavings = initialRegularSavings - 2000;
  console.log(`   Regular Savings after approval: ₱${m1AfterApprove.regularSavings} (Expected: ₱${expectedSavings})`);
  if (m1AfterApprove.regularSavings !== expectedSavings) {
    throw new Error(`TEST F FAILED: Balance mismatch. Expected ₱${expectedSavings}, got ₱${m1AfterApprove.regularSavings}`);
  }
  console.log('   [PASS] TEST F: Staff approval deducted balance exactly once.');

  // TEST G & H: Duplicate staff approval returns ALREADY_PROCESSED & creates no duplicate entries
  console.log('\n----------------------------------------------------');
  console.log('TEST G & H: Retry staff approval for already approved request...');
  res = await fetch(`${BASE_URL}/api/savings/withdrawal-requests/${reqAId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      requestId: reqAId
    })
  });
  data = await res.json();
  console.log(`   Status Code: ${res.status}`);
  console.log(`   Status Field: ${data.status}`);
  console.log(`   Message: ${data.message}`);
  if (res.status !== 200 || data.status !== 'ALREADY_PROCESSED') {
    throw new Error(`TEST G FAILED: Duplicate approval expected 200 ALREADY_PROCESSED, got ${res.status} ${JSON.stringify(data)}`);
  }

  let m1AfterDup = await getMember(member1Token);
  if (m1AfterDup.regularSavings !== expectedSavings) {
    throw new Error(`TEST H FAILED: Balance deducted a second time! Expected ₱${expectedSavings}, got ₱${m1AfterDup.regularSavings}`);
  }
  console.log('   [PASS] TEST G & H: Duplicate staff approval returned ALREADY_PROCESSED without double deduction.');

  // TEST I: GCash release preserves registered GCash number
  console.log('\n----------------------------------------------------');
  console.log('TEST I: GCash withdrawal request & release...');
  res = await fetch(`${BASE_URL}/api/savings/withdrawal-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${member1Token}`
    },
    body: JSON.stringify({
      amount: 1500,
      releaseMethod: 'GCASH',
      remarks: 'Test GCash release'
    })
  });
  data = await res.json();
  if (res.status !== 200 || !data.withdrawalRequest) {
    throw new Error(`TEST I FAILED: GCash withdrawal submission failed: ${JSON.stringify(data)}`);
  }
  const reqIId = data.withdrawalRequest.id;
  console.log(`   GCash Request Created: #${reqIId}, Number: ${data.withdrawalRequest.gcashNumber}`);
  if (data.withdrawalRequest.gcashNumber !== '09171234567') {
    throw new Error(`TEST I FAILED: GCash number not preserved in request! Expected 09171234567, got ${data.withdrawalRequest.gcashNumber}`);
  }

  // Approve GCash Request
  res = await fetch(`${BASE_URL}/api/savings/withdrawal-requests/${reqIId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      gcashRefNumber: '1092837465'
    })
  });
  data = await res.json();
  if (res.status !== 200 || !data.receipt) {
    throw new Error(`TEST I FAILED: GCash approval failed: ${JSON.stringify(data)}`);
  }
  console.log(`   Receipt issued: ${data.receipt.receiptNumber}`);
  console.log(`   Receipt Payment Method: ${data.receipt.paymentMethod}`);
  console.log(`   Receipt GCash Ref: ${data.receipt.gcashDetails?.refNumber}`);
  if (data.receipt.paymentMethod !== 'GCASH' || data.receipt.gcashDetails?.refNumber !== '1092837465') {
    throw new Error(`TEST I FAILED: GCash details not correctly recorded in official receipt.`);
  }
  console.log('   [PASS] TEST I: GCash release preserved registered GCash number and transaction reference.');

  // TEST J: Office Cash release supported
  console.log('\n----------------------------------------------------');
  console.log('TEST J: Office Cash release verification...');
  res = await fetch(`${BASE_URL}/api/savings/withdrawal-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${member1Token}`
    },
    body: JSON.stringify({
      amount: 500,
      releaseMethod: 'OFFICE_CASH',
      remarks: 'Office Cash test'
    })
  });
  data = await res.json();
  if (res.status !== 200 || data.withdrawalRequest.releaseMethod !== 'OFFICE_CASH') {
    throw new Error(`TEST J FAILED: Office Cash release method not properly saved: ${JSON.stringify(data)}`);
  }
  console.log('   [PASS] TEST J: Office Cash release supported and verified.');

  // TEST K: Share Capital remains unchanged throughout all withdrawal operations
  console.log('\n----------------------------------------------------');
  console.log('TEST K: Verifying Share Capital integrity...');
  let m1Final = await getMember(member1Token);
  console.log(`   Initial Share Capital: ₱${initialShareCapital}`);
  console.log(`   Final Share Capital: ₱${m1Final.shareCapital}`);
  if (m1Final.shareCapital !== initialShareCapital) {
    throw new Error(`TEST K FAILED: Share Capital changed! Expected ₱${initialShareCapital}, got ₱${m1Final.shareCapital}`);
  }
  console.log('   [PASS] TEST K: Share Capital remained completely untouched.');

  console.log('\n====================================================');
  console.log('   ALL WITHDRAWAL WORKFLOW TESTS PASSED (A-K)!     ');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

/**
 * Automated Verification Suite for Descriptive Analytics & Management Interpretation
 * Verifies all 14 required analytical scenarios, live API endpoints, read-only financial safety,
 * causation discipline, and role-based access control.
 */

import {
  generateDescriptiveAnalysis,
  generateOperationalDescriptiveAnalysis
} from '../src/utils/descriptiveAnalyticsEngine.js';

const BASE_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`✓ [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`✗ [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api(path: string, options: { method?: string; token?: string; body?: any } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

function buildScenarioDataset(overrides: any = {}) {
  return {
    generatedAt: new Date().toISOString(),
    cooperativeName: 'CCT Cooperative',
    membershipAnalytics: {
      totalRegisteredMembers: 120,
      activeMembers: 100,
      pendingRegistrations: 2,
      suspendedOrDeactivatedMembers: 1,
      approvedMembers: 100,
      rejectedApplications: 0,
      membershipGrowthTrend: [
        { month: '2026-08', count: 10 },
        { month: '2026-09', count: 10 }
      ],
      ...(overrides.membershipAnalytics || {})
    },
    savingsAnalytics: {
      totalSavingsBalance: 850000,
      totalRegularSavings: 500000,
      totalTimeDeposits: 150000,
      totalDeposits: 600000,
      totalWithdrawals: 100000,
      savingsParticipationRate: 82.0,
      savingsGrowthTrend: [
        { month: '2026-08', deposits: 50000, withdrawals: 10000, netGrowth: 40000 },
        { month: '2026-09', deposits: 50000, withdrawals: 10000, netGrowth: 40000 }
      ],
      ...(overrides.savingsAnalytics || {})
    },
    shareCapitalAnalytics: {
      totalShareCapital: 200000,
      paidShareCapital: 200000,
      outstandingShareCapital: 50000,
      averageShareCapitalPerActiveMember: 2000,
      initialSharePaidCount: 98,
      initialShareUnpaidCount: 2,
      shareCapitalGrowth: [
        { month: '2026-08', amount: 20000 },
        { month: '2026-09', amount: 25000 }
      ],
      ...(overrides.shareCapitalAnalytics || {})
    },
    timeDepositAnalytics: {
      totalTimeDepositPrincipal: 150000,
      activeTimeDepositsCount: 5,
      maturedTimeDepositsCount: 1,
      newPlacementsCount: 2,
      placementTrend: [
        { period: '2026-08', value: 50000 },
        { period: '2026-09', value: 100000 }
      ],
      ...(overrides.timeDepositAnalytics || {})
    },
    loanAnalytics: {
      totalLoanApplications: 25,
      approvedLoans: 5,
      pendingLoans: 2,
      rejectedLoans: 1,
      releasedLoans: 17,
      outstandingLoanPortfolio: 420000,
      loanCollectionPerformance: 94,
      loanDelinquencyRate: 0,
      loanApprovalRate: 88,
      delinquentLoansCount: 0,
      overdueLoanBalance: 0,
      activeBorrowersCount: 17,
      totalPaymentsCollected: 180000,
      repaymentTrend: [
        { month: '2026-08', amount: 40000 },
        { month: '2026-09', amount: 42000 }
      ],
      ...(overrides.loanAnalytics || {})
    },
    financialAnalytics: {
      totalAssets: 950000,
      totalLiabilities: 650000,
      totalEquity: 300000,
      revenue: 95000,
      interestIncome: 90000,
      feeIncome: 5000,
      expenses: 0,
      netIncome: 95000,
      revenueTrend: [
        { month: '2026-08', revenue: 45000 },
        { month: '2026-09', revenue: 50000 }
      ],
      ...(overrides.financialAnalytics || {})
    },
    cashierAnalytics: {
      dailyTransactionsCount: 8,
      dailyTransactionsVolume: 35000,
      monthlyTransactionsCount: 45,
      monthlyTransactionsVolume: 210000,
      totalCollections: 30000,
      gcashTransactionsCount: 14,
      pendingPaymentRequestsCount: 1,
      transactionTrend: [
        { month: '2026-08', count: 40 },
        { month: '2026-09', count: 45 }
      ],
      ...(overrides.cashierAnalytics || {})
    },
    pricingAnalytics: {
      loanProductsCount: 3,
      averageLoanInterestRatePct: 5.0,
      costDataAvailable: false,
      ...(overrides.pricingAnalytics || {})
    },
    dividendAnalytics: {
      totalDividendsDeclared: 50000,
      dividendsDistributed: 40000,
      ...(overrides.dividendAnalytics || {})
    }
  };
}

async function runTests() {
  console.log('======================================================================');
  console.log('STARTING DESCRIPTIVE ANALYTICS & MANAGEMENT INTERPRETATION TEST SUITE');
  console.log('======================================================================');

  // --------------------------------------------------------------------------
  // SCENARIO 1: Revenue Increasing
  // --------------------------------------------------------------------------
  const revIncreasingReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      financialAnalytics: {
        revenue: 110000,
        expenses: 10000,
        netIncome: 100000,
        revenueTrend: [
          { month: '2026-08', revenue: 50000 },
          { month: '2026-09', revenue: 60000 }
        ],
        currentPeriodExpenses: 5000,
        previousPeriodExpenses: 5000
      }
    })
  );
  check(
    'Scenario 1: Revenue increasing trend & profitability interpretation',
    revIncreasingReport.domainEvaluations.revenue.trend === 'Increasing' &&
      revIncreasingReport.domainEvaluations.revenue.currentCondition.includes('increased by 20%') &&
      revIncreasingReport.domainEvaluations.profitability.currentCondition.includes(
        'improved operating performance'
      ),
    revIncreasingReport.domainEvaluations.revenue.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 2: Revenue Decreasing (with declining tx volume vs stable tx volume)
  // --------------------------------------------------------------------------
  const revDecWithTxDecReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      financialAnalytics: {
        revenue: 85000,
        revenueTrend: [
          { month: '2026-08', revenue: 50000 },
          { month: '2026-09', revenue: 40000 }
        ]
      },
      cashierAnalytics: {
        transactionTrend: [
          { month: '2026-08', count: 50 },
          { month: '2026-09', count: 35 }
        ]
      }
    })
  );
  check(
    'Scenario 2a: Revenue decreasing with declining transaction volume does not blame markup',
    revDecWithTxDecReport.domainEvaluations.revenue.trend === 'Decreasing' &&
      revDecWithTxDecReport.domainEvaluations.revenue.priority === 'ATTENTION REQUIRED' &&
      revDecWithTxDecReport.domainEvaluations.revenue.currentCondition.includes(
        'primarily associated with lower transaction activity'
      ) &&
      revDecWithTxDecReport.domainEvaluations.revenue.actionToConsider.includes(
        'The available data does not by itself establish that markup is the cause of the decline'
      ),
    revDecWithTxDecReport.domainEvaluations.revenue.actionToConsider
  );

  const revDecWithStableTxReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      financialAnalytics: {
        revenue: 85000,
        revenueTrend: [
          { month: '2026-08', revenue: 50000 },
          { month: '2026-09', revenue: 42000 }
        ]
      },
      cashierAnalytics: {
        transactionTrend: [
          { month: '2026-08', count: 50 },
          { month: '2026-09', count: 50 }
        ]
      }
    })
  );
  check(
    'Scenario 2b: Revenue decreasing with stable transaction volume recommends reviewing pricing/margins',
    revDecWithStableTxReport.domainEvaluations.pricingMarkup.actionToConsider.includes(
      'Revenue has declined while transaction volume has remained relatively stable. Review current pricing/markup levels and product margins'
    ) && !revDecWithStableTxReport.domainEvaluations.pricingMarkup.actionToConsider.includes('Increase markup.'),
    revDecWithStableTxReport.domainEvaluations.pricingMarkup.actionToConsider
  );

  // --------------------------------------------------------------------------
  // SCENARIO 3: Revenue Stable
  // --------------------------------------------------------------------------
  const revStableReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      financialAnalytics: {
        revenue: 100000,
        revenueTrend: [
          { month: '2026-08', revenue: 50000 },
          { month: '2026-09', revenue: 50500 }
        ]
      }
    })
  );
  check(
    'Scenario 3: Revenue stable trend detection',
    revStableReport.domainEvaluations.revenue.trend === 'Stable' &&
      revStableReport.domainEvaluations.revenue.currentCondition.includes('remained relatively stable'),
    revStableReport.domainEvaluations.revenue.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 4: Loan Repayments Decreasing
  // --------------------------------------------------------------------------
  const loanRepayDecReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      loanAnalytics: {
        repaymentTrend: [
          { month: '2026-08', amount: 50000 },
          { month: '2026-09', amount: 43950 }
        ]
      }
    })
  );
  check(
    'Scenario 4: Loan repayments decreasing flags collection review',
    loanRepayDecReport.domainEvaluations.loans.trend === 'Decreasing' &&
      loanRepayDecReport.domainEvaluations.loans.currentCondition.includes('Loan repayments decreased by 12.1%') &&
      loanRepayDecReport.domainEvaluations.loans.actionToConsider.includes('Review collection activity and overdue accounts'),
    loanRepayDecReport.domainEvaluations.loans.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 5: Overdue Loans Increasing
  // --------------------------------------------------------------------------
  const overdueIncReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      loanAnalytics: {
        delinquentLoansCount: 4,
        loanDelinquencyRate: 18.5,
        overdueLoanBalance: 57100,
        currentPeriodOverdueBalance: 57100,
        previousPeriodOverdueBalance: 50000,
        repaymentTrend: [
          { month: '2026-08', amount: 50000 },
          { month: '2026-09', amount: 42000 }
        ]
      }
    })
  );
  check(
    'Scenario 5: Overdue loans increasing with declining repayments classified as ATTENTION REQUIRED',
    overdueIncReport.domainEvaluations.loans.priority === 'ATTENTION REQUIRED' &&
      overdueIncReport.domainEvaluations.loans.currentCondition.includes('Overdue loan balances increased by 14.2%') &&
      overdueIncReport.domainEvaluations.loans.actionToConsider.includes('Review collection activity and overdue accounts'),
    overdueIncReport.domainEvaluations.loans.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 6: Savings Increasing
  // --------------------------------------------------------------------------
  const savIncReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      savingsAnalytics: {
        totalDeposits: 250000,
        totalWithdrawals: 40000,
        savingsGrowthTrend: [
          { month: '2026-08', deposits: 100000, withdrawals: 20000, netGrowth: 80000 },
          { month: '2026-09', deposits: 108400, withdrawals: 20000, netGrowth: 88400 }
        ]
      }
    })
  );
  check(
    'Scenario 6: Savings increasing while withdrawals remain stable',
    savIncReport.domainEvaluations.savings.trend === 'Increasing' &&
      savIncReport.domainEvaluations.savings.currentCondition.includes('Regular savings deposits increased by 8.4%') &&
      savIncReport.domainEvaluations.savings.actionToConsider.includes('Continue monitoring savings growth and member deposit activity'),
    savIncReport.domainEvaluations.savings.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 7: Savings Decreasing
  // --------------------------------------------------------------------------
  const savDecReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      savingsAnalytics: {
        totalDeposits: 80000,
        totalWithdrawals: 110000,
        savingsGrowthTrend: [
          { month: '2026-08', deposits: 50000, withdrawals: 40000, netGrowth: 10000 },
          { month: '2026-09', deposits: 30000, withdrawals: 70000, netGrowth: -40000 }
        ]
      }
    })
  );
  check(
    'Scenario 7: Savings decreasing and negative net movement flags ATTENTION REQUIRED',
    savDecReport.domainEvaluations.savings.priority === 'ATTENTION REQUIRED' &&
      savDecReport.domainEvaluations.savings.currentCondition.includes('Regular savings deposits decreased by 40%'),
    savDecReport.domainEvaluations.savings.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 8: Membership Increasing
  // --------------------------------------------------------------------------
  const memIncReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      membershipAnalytics: {
        totalRegisteredMembers: 135,
        activeMembers: 120,
        pendingRegistrations: 0,
        membershipGrowthTrend: [
          { month: '2026-08', count: 10 },
          { month: '2026-09', count: 15 }
        ]
      }
    })
  );
  check(
    'Scenario 8: Membership increasing trend detection',
    memIncReport.domainEvaluations.membership.trend === 'Increasing' &&
      memIncReport.domainEvaluations.membership.currentCondition.includes('New member registrations increased by 50%'),
    memIncReport.domainEvaluations.membership.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 9: Membership Stable
  // --------------------------------------------------------------------------
  const memStableReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      membershipAnalytics: {
        totalRegisteredMembers: 100,
        activeMembers: 95,
        pendingRegistrations: 0,
        membershipGrowthTrend: [
          { month: '2026-08', count: 10 },
          { month: '2026-09', count: 10 }
        ]
      }
    })
  );
  check(
    'Scenario 9: Membership stable trend detection',
    memStableReport.domainEvaluations.membership.trend === 'Stable' &&
      memStableReport.domainEvaluations.membership.currentCondition.includes('Active membership remained relatively stable during the selected period'),
    memStableReport.domainEvaluations.membership.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 10: Expense Growth Exceeding Revenue Growth
  // --------------------------------------------------------------------------
  const expExceedRevReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      financialAnalytics: {
        revenue: 105000,
        expenses: 45000,
        netIncome: 60000,
        revenueTrend: [
          { month: '2026-08', revenue: 50000 },
          { month: '2026-09', revenue: 52500 } // +5%
        ],
        currentPeriodExpenses: 25000,
        previousPeriodExpenses: 20000 // +25%
      }
    })
  );
  check(
    'Scenario 10: Expense growth exceeding revenue growth flags ATTENTION REQUIRED',
    expExceedRevReport.domainEvaluations.expenses.priority === 'ATTENTION REQUIRED' &&
      expExceedRevReport.domainEvaluations.expenses.currentCondition.includes('Operating expenses increased faster than revenue') &&
      expExceedRevReport.domainEvaluations.expenses.actionToConsider.includes(
        'Review the expense categories contributing to the increase and determine whether controllable operating costs require management attention'
      ),
    expExceedRevReport.domainEvaluations.expenses.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 11: Insufficient Historical Data
  // --------------------------------------------------------------------------
  const insufficientHistReport = generateDescriptiveAnalysis(
    buildScenarioDataset({
      membershipAnalytics: {
        totalRegisteredMembers: 15,
        activeMembers: 15,
        pendingRegistrations: 0,
        membershipGrowthTrend: [{ month: '2026-09', count: 15 }]
      },
      savingsAnalytics: {
        totalDeposits: 25000,
        totalWithdrawals: 0,
        savingsGrowthTrend: [{ month: '2026-09', deposits: 25000, withdrawals: 0, netGrowth: 25000 }]
      },
      financialAnalytics: {
        revenue: 5000,
        revenueTrend: [{ month: '2026-09', revenue: 5000 }]
      }
    })
  );
  check(
    'Scenario 11: Insufficient historical data explicitly reported without fabricating trends',
    insufficientHistReport.domainEvaluations.membership.trend === 'Insufficient historical data' &&
      insufficientHistReport.domainEvaluations.membership.currentCondition.includes(
        'Insufficient historical data is available to determine a reliable trend.'
      ) &&
      insufficientHistReport.dataLimitations.some(l =>
        l.includes('Historical comparison is unavailable for the selected period.')
      ),
    insufficientHistReport.domainEvaluations.membership.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 12: Missing Cost Data for Margin Analysis
  // --------------------------------------------------------------------------
  check(
    'Scenario 12: Missing cost data explicitly states margin analysis is unavailable',
    insufficientHistReport.domainEvaluations.pricingMarkup.currentCondition.includes(
      'Margin analysis is unavailable because the required cost data is not currently available.'
    ) &&
      insufficientHistReport.dataLimitations.includes(
        'Margin analysis is unavailable because the required cost data is not currently available.'
      ),
    insufficientHistReport.domainEvaluations.pricingMarkup.currentCondition
  );

  // --------------------------------------------------------------------------
  // SCENARIO 13 & 14: Live API, No Financial Mutation & Role-Based Access Control
  // --------------------------------------------------------------------------
  console.log('\n--- LIVE API, FINANCIAL IMMUTABILITY & RBAC VERIFICATION ---');

  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@coop.com', password: 'admin123' }
  });
  check('Admin login succeeded', adminLogin.ok && !!adminLogin.data?.token);
  const adminToken = adminLogin.data?.token;

  const staffLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'staff@coop.com', password: 'staff123' }
  });
  check('Staff login succeeded', staffLogin.ok && !!staffLogin.data?.token);
  const staffToken = staffLogin.data?.token;

  // Snapshot financial state BEFORE calling analytics endpoints
  const statsBefore = await api('/api/dashboard/stats', { token: adminToken });
  const membersBefore = await api('/api/members', { token: adminToken });
  const txBefore = await api('/api/savings/ledger', { token: adminToken });
  const receiptsBefore = await api('/api/receipts', { token: adminToken });

  const membersListBefore = Array.isArray(membersBefore.data) ? membersBefore.data : [];
  const txListBefore = Array.isArray(txBefore.data) ? txBefore.data : [];
  const receiptsListBefore = Array.isArray(receiptsBefore.data) ? receiptsBefore.data : (receiptsBefore.data?.receipts || []);

  const totalShareBefore = membersListBefore.reduce((s: number, m: any) => s + (m.shareCapital || 0), 0);
  const totalSavingsBefore = membersListBefore.reduce((s: number, m: any) => s + (m.regularSavings || 0), 0);
  const totalTdBefore = membersListBefore.reduce((s: number, m: any) => s + (m.timeDeposits || 0), 0);

  // Call Admin Descriptive Analytics endpoint
  const descRes = await api('/api/analytics/descriptive', { token: adminToken });
  check(
    'GET /api/analytics/descriptive returns 200 and includes descriptiveAnalysis',
    descRes.status === 200 &&
      !!descRes.data?.descriptiveAnalysis &&
      typeof descRes.data.descriptiveAnalysis.executiveSummary === 'string' &&
      Array.isArray(descRes.data.descriptiveAnalysis.keyFindings) &&
      descRes.data.descriptiveAnalysis.keyFindings.length >= 10,
    `Key findings count: ${descRes.data?.descriptiveAnalysis?.keyFindings?.length}`
  );

  // Call Staff Operational Analytics endpoint
  const opRes = await api('/api/analytics/operational', { token: staffToken });
  check(
    'GET /api/analytics/operational returns 200 for STAFF and includes operational descriptiveAnalysis',
    opRes.status === 200 &&
      !!opRes.data?.descriptiveAnalysis &&
      opRes.data.descriptiveAnalysis.roleScope === 'STAFF' &&
      Array.isArray(opRes.data.descriptiveAnalysis.keyFindings),
    opRes.data?.descriptiveAnalysis?.overallSituation?.substring(0, 90) + '...'
  );

  // Snapshot financial state AFTER calling analytics endpoints (Scenario 13)
  const statsAfter = await api('/api/dashboard/stats', { token: adminToken });
  const membersAfter = await api('/api/members', { token: adminToken });
  const txAfter = await api('/api/savings/ledger', { token: adminToken });
  const receiptsAfter = await api('/api/receipts', { token: adminToken });

  const membersListAfter = Array.isArray(membersAfter.data) ? membersAfter.data : [];
  const txListAfter = Array.isArray(txAfter.data) ? txAfter.data : [];
  const receiptsListAfter = Array.isArray(receiptsAfter.data) ? receiptsAfter.data : (receiptsAfter.data?.receipts || []);

  const totalShareAfter = membersListAfter.reduce((s: number, m: any) => s + (m.shareCapital || 0), 0);
  const totalSavingsAfter = membersListAfter.reduce((s: number, m: any) => s + (m.regularSavings || 0), 0);
  const totalTdAfter = membersListAfter.reduce((s: number, m: any) => s + (m.timeDeposits || 0), 0);

  check(
    'Scenario 13: Analytics execution caused ZERO financial mutations (Share Capital, Regular Savings, Time Deposits, Loans, Transactions, Receipts untouched)',
    totalShareBefore === totalShareAfter &&
      totalSavingsBefore === totalSavingsAfter &&
      totalTdBefore === totalTdAfter &&
      statsBefore.data?.totalOutstandingLoans === statsAfter.data?.totalOutstandingLoans &&
      txListBefore.length === txListAfter.length &&
      receiptsListBefore.length === receiptsListAfter.length
  );

  // Verify Role-Based Access Control (Scenario 14): MEMBER must receive 403 Forbidden
  const memLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'member@coop.com', password: 'member123' }
  });
  check('Member login succeeded', memLogin.ok && !!memLogin.data?.token);
  if (memLogin.ok && memLogin.data?.token) {
    const memToken = memLogin.data.token;
    const memDescRes = await api('/api/analytics/descriptive', { token: memToken });
    const memOpRes = await api('/api/analytics/operational', { token: memToken });
    check(
      'Scenario 14a: MEMBER blocked from /api/analytics/descriptive with HTTP 403 Forbidden',
      memDescRes.status === 403
    );
    check(
      'Scenario 14b: MEMBER blocked from /api/analytics/operational with HTTP 403 Forbidden',
      memOpRes.status === 403
    );
  }

  console.log('======================================================================');
  console.log(`DESCRIPTIVE ANALYTICS SUITE RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal error in descriptive analytics suite:', err);
  process.exit(1);
});

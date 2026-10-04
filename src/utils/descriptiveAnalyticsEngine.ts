/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Read-Only Descriptive Analytics & Management Interpretation Engine
 * Strictly evaluates actual cooperative metrics without fabricating data or mutating balances.
 */

export type ManagementPriority =
  | 'INFORMATION'
  | 'MONITOR'
  | 'ATTENTION REQUIRED'
  | 'REVIEW REQUIRED';

export type TrendDirection =
  | 'Increasing'
  | 'Decreasing'
  | 'Stable'
  | 'Volatile'
  | 'Requires attention'
  | 'Insufficient historical data';

export interface DomainDescriptiveFinding {
  domainKey: string;
  domainTitle: string;
  priority: ManagementPriority;
  trend: TrendDirection;
  comparisonBasis: string;
  currentCondition: string;
  contributingFactors: string;
  operationalArea: string;
  actionToConsider: string;
  percentageChange?: number | null;
  hasSufficientHistory: boolean;
  dataLimitation?: string;
}

export interface DescriptiveAnalysisReport {
  generatedAt: string;
  roleScope: 'ADMIN' | 'STAFF';
  executiveSummary: string;
  overallSituation: string;
  positiveDevelopments: string[];
  keyFindings: DomainDescriptiveFinding[];
  areasRequiringAttention: DomainDescriptiveFinding[];
  actionsToConsider: Array<{
    priority: ManagementPriority;
    area: string;
    condition: string;
    action: string;
  }>;
  dataLimitations: string[];
  domainEvaluations: Record<string, DomainDescriptiveFinding>;
}

export interface TrendComputationResult {
  direction: TrendDirection;
  percentChange: number | null;
  comparisonBasis: string;
  hasSufficientHistory: boolean;
}

const formatPHP = (val: number | undefined | null): string => {
  const num = Number(val || 0);
  return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatInt = (val: number | undefined | null): string => {
  return Number(val || 0).toLocaleString('en-US');
};

/**
 * Computes period-over-period trend direction and percentage change from a time series
 * or explicit current/previous values.
 */
export function evaluateMetricTrend(options: {
  series?: Array<{ period: string; value: number }>;
  currentValue?: number | null;
  previousValue?: number | null;
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
  stabilityThresholdPct?: number;
}): TrendComputationResult {
  const threshold = options.stabilityThresholdPct ?? 2.0;

  let curr: number | null = options.currentValue ?? null;
  let prev: number | null = options.previousValue ?? null;
  let currLabel = options.currentPeriodLabel || 'the current period';
  let prevLabel = options.previousPeriodLabel || 'the previous comparison period';

  if (options.series && options.series.length >= 2) {
    const sorted = [...options.series].sort((a, b) => a.period.localeCompare(b.period));
    const last = sorted[sorted.length - 1];
    const secondLast = sorted[sorted.length - 2];
    curr = last.value;
    prev = secondLast.value;
    currLabel = last.period;
    prevLabel = secondLast.period;

    // Check volatility if >= 3 periods exist and direction flips sharply (>25% swings in opposite directions)
    if (sorted.length >= 3) {
      const thirdLast = sorted[sorted.length - 3];
      if (thirdLast.value > 0 && secondLast.value > 0) {
        const change1 = ((secondLast.value - thirdLast.value) / thirdLast.value) * 100;
        const change2 = ((last.value - secondLast.value) / secondLast.value) * 100;
        if (Math.abs(change1) >= 25 && Math.abs(change2) >= 25 && Math.sign(change1) !== Math.sign(change2)) {
          const pct = Number(change2.toFixed(1));
          return {
            direction: 'Volatile',
            percentChange: pct,
            comparisonBasis: `compared with the previous period (${currLabel} vs ${prevLabel}, following prior swing from ${thirdLast.period})`,
            hasSufficientHistory: true
          };
        }
      }
    }
  }

  if (curr === null || prev === null || isNaN(curr) || isNaN(prev)) {
    return {
      direction: 'Insufficient historical data',
      percentChange: null,
      comparisonBasis: 'Historical comparison is unavailable for the selected period.',
      hasSufficientHistory: false
    };
  }

  const basisText =
    currLabel !== 'the current period' || prevLabel !== 'the previous comparison period'
      ? `compared with the previous period (${currLabel} vs ${prevLabel})`
      : 'compared with the previous comparison period';

  if (prev === 0) {
    if (curr === 0) {
      return {
        direction: 'Stable',
        percentChange: 0,
        comparisonBasis: basisText,
        hasSufficientHistory: true
      };
    }
    return {
      direction: curr > 0 ? 'Increasing' : 'Decreasing',
      percentChange: null,
      comparisonBasis: `${basisText} (prior period base was 0)`,
      hasSufficientHistory: true
    };
  }

  const rawPct = ((curr - prev) / Math.abs(prev)) * 100;
  const pct = Number(rawPct.toFixed(1));

  if (Math.abs(pct) <= threshold) {
    return {
      direction: 'Stable',
      percentChange: pct,
      comparisonBasis: basisText,
      hasSufficientHistory: true
    };
  }

  return {
    direction: pct > 0 ? 'Increasing' : 'Decreasing',
    percentChange: pct,
    comparisonBasis: basisText,
    hasSufficientHistory: true
  };
}

/**
 * Generates a comprehensive, read-only Descriptive Analytics & Management Interpretation report
 * from the cooperative analytics dataset.
 */
export function generateDescriptiveAnalysis(
  analyticsData: any,
  roleScope: 'ADMIN' | 'STAFF' = 'ADMIN'
): DescriptiveAnalysisReport {
  const generatedAt = analyticsData?.generatedAt || new Date().toISOString();
  const membership = analyticsData?.membershipAnalytics || {};
  const savings = analyticsData?.savingsAnalytics || {};
  const shareCap = analyticsData?.shareCapitalAnalytics || {};
  const timeDeposits = analyticsData?.timeDepositAnalytics || {};
  const loans = analyticsData?.loanAnalytics || {};
  const financials = analyticsData?.financialAnalytics || {};
  const cashier = analyticsData?.cashierAnalytics || {};
  const dividends = analyticsData?.dividendAnalytics || {};
  const pricing = analyticsData?.pricingAnalytics || {};

  const domainEvaluations: Record<string, DomainDescriptiveFinding> = {};
  const dataLimitations: string[] = [];
  const positiveDevelopments: string[] = [];

  // ============================================================================
  // A. MEMBERSHIP
  // ============================================================================
  const totalMembers = Number(membership.totalRegisteredMembers ?? 0);
  const activeMembers = Number(membership.activeMembers ?? 0);
  const pendingMembers = Number(membership.pendingRegistrations ?? 0);
  const suspendedMembers = Number(membership.suspendedOrDeactivatedMembers ?? 0);
  const rejectedMembers = Number(membership.rejectedApplications ?? 0);
  const memberGrowthSeries = Array.isArray(membership.membershipGrowthTrend)
    ? membership.membershipGrowthTrend.map((item: any) => ({
        period: String(item.month || item.period || ''),
        value: Number(item.count ?? item.value ?? 0)
      }))
    : [];

  const memTrend = evaluateMetricTrend({
    series: memberGrowthSeries.length >= 2 ? memberGrowthSeries : undefined,
    currentValue: membership.newMembersCurrentPeriod,
    previousValue: membership.newMembersPreviousPeriod,
    currentPeriodLabel: membership.currentPeriodLabel,
    previousPeriodLabel: membership.previousPeriodLabel
  });

  let memPriority: ManagementPriority = 'INFORMATION';
  let memCondition = '';
  let memFactors = '';
  let memAction = '';

  if (totalMembers === 0) {
    memCondition = 'Not enough data available for this analysis. No registered members are recorded in the selected filter scope.';
    memFactors = 'Zero member records matched the current query parameters.';
    memAction = 'Verify filter criteria or begin member registration onboarding.';
    dataLimitations.push('Membership analysis has no registered member records in the selected filter range.');
  } else {
    const activeRatio = ((activeMembers / totalMembers) * 100).toFixed(1);
    if (!memTrend.hasSufficientHistory) {
      memCondition = `Active membership stands at ${formatInt(activeMembers)} of ${formatInt(totalMembers)} registered members (${activeRatio}% active). Insufficient historical data is available to determine a reliable trend.`;
      dataLimitations.push('Membership growth trend: Historical comparison is unavailable for the selected period.');
    } else if (memTrend.direction === 'Increasing') {
      const pctText = memTrend.percentChange !== null ? ` by ${Math.abs(memTrend.percentChange)}%` : '';
      memCondition = `New member registrations increased${pctText} ${memTrend.comparisonBasis}, bringing active membership to ${formatInt(activeMembers)} (${activeRatio}% of ${formatInt(totalMembers)} total registered).`;
      positiveDevelopments.push(`New member registrations increased${pctText} ${memTrend.comparisonBasis}.`);
    } else if (memTrend.direction === 'Decreasing') {
      const pctText = memTrend.percentChange !== null ? ` by ${Math.abs(memTrend.percentChange)}%` : '';
      memCondition = `New member registrations decreased${pctText} ${memTrend.comparisonBasis}, while active membership stands at ${formatInt(activeMembers)} of ${formatInt(totalMembers)} registered members.`;
      memPriority = 'MONITOR';
    } else {
      memCondition = `Active membership remained relatively stable during the selected period (${formatInt(activeMembers)} active out of ${formatInt(totalMembers)} registered members, ${memTrend.comparisonBasis}).`;
    }

    const factorParts: string[] = [
      `${formatInt(activeMembers)} active members`,
      `${formatInt(pendingMembers)} pending applications`
    ];
    if (suspendedMembers > 0) factorParts.push(`${formatInt(suspendedMembers)} suspended/deactivated accounts`);
    if (rejectedMembers > 0) factorParts.push(`${formatInt(rejectedMembers)} rejected applications`);
    memFactors = `Current status composition includes ${factorParts.join(', ')}.`;

    if (pendingMembers > 0) {
      memPriority = pendingMembers >= 5 ? 'ATTENTION REQUIRED' : 'REVIEW REQUIRED';
      memAction = `Review and process the ${formatInt(pendingMembers)} pending membership registration(s) and verify their submitted KYC and PMES compliance documents.`;
    } else {
      memAction = 'Continue monitoring member registration onboarding and active member participation.';
    }
  }

  domainEvaluations.membership = {
    domainKey: 'membership',
    domainTitle: 'Membership',
    priority: memPriority,
    trend: pendingMembers >= 5 ? 'Requires attention' : memTrend.direction,
    comparisonBasis: memTrend.comparisonBasis,
    currentCondition: memCondition,
    contributingFactors: memFactors,
    operationalArea: 'Member Verification & Onboarding',
    actionToConsider: memAction,
    percentageChange: memTrend.percentChange,
    hasSufficientHistory: memTrend.hasSufficientHistory
  };

  // ============================================================================
  // B. SHARE CAPITAL
  // ============================================================================
  const totalShareCapital = Number(shareCap.totalShareCapital ?? 0);
  const outstandingShareCap = Number(shareCap.outstandingShareCapital ?? 0);
  const avgShareCapital =
    activeMembers > 0
      ? Number((totalShareCapital / activeMembers).toFixed(2))
      : Number(shareCap.averageShareCapitalPerActiveMember ?? 0);
  const initialSharePaidCount = Number(shareCap.initialSharePaidCount ?? activeMembers);
  const initialShareUnpaidCount = Number(shareCap.initialShareUnpaidCount ?? 0);

  const shareSeries = Array.isArray(shareCap.shareCapitalGrowth)
    ? shareCap.shareCapitalGrowth.map((item: any) => ({
        period: String(item.month || item.period || ''),
        value: Number(item.amount ?? item.value ?? 0)
      }))
    : [];

  const shareTrend = evaluateMetricTrend({
    series: shareSeries.length >= 2 ? shareSeries : undefined,
    currentValue: shareCap.currentPeriodContributions,
    previousValue: shareCap.previousPeriodContributions
  });

  let sharePriority: ManagementPriority = 'INFORMATION';
  let shareCondition = '';
  if (!shareTrend.hasSufficientHistory) {
    shareCondition = `Total paid share capital is ${formatPHP(totalShareCapital)} (averaging ${formatPHP(avgShareCapital)} per active member). Insufficient historical data is available to determine a reliable trend.`;
    dataLimitations.push('Share capital contribution velocity: Historical comparison is unavailable for the selected period.');
  } else if (shareTrend.direction === 'Increasing') {
    const pctText = shareTrend.percentChange !== null ? ` by ${Math.abs(shareTrend.percentChange)}%` : '';
    shareCondition = `Share capital contributions increased${pctText} ${shareTrend.comparisonBasis}, bringing total paid share capital to ${formatPHP(totalShareCapital)} (${formatPHP(avgShareCapital)} average per active member).`;
    positiveDevelopments.push(`Share capital contributions grew${pctText} ${shareTrend.comparisonBasis}.`);
  } else if (shareTrend.direction === 'Decreasing') {
    const pctText = shareTrend.percentChange !== null ? ` by ${Math.abs(shareTrend.percentChange)}%` : '';
    shareCondition = `Monthly share capital contributions decreased${pctText} ${shareTrend.comparisonBasis}. Total paid share capital stands at ${formatPHP(totalShareCapital)}.`;
    sharePriority = 'MONITOR';
  } else {
    shareCondition = `Share capital contributions remained relatively stable ${shareTrend.comparisonBasis}, with total paid share capital at ${formatPHP(totalShareCapital)}.`;
  }

  const shareFactors = `Paid share capital is ${formatPHP(totalShareCapital)} across ${formatInt(activeMembers)} active members (average ${formatPHP(avgShareCapital)}), with ${formatPHP(outstandingShareCap)} remaining toward minimum subscribed capital targets${initialShareUnpaidCount > 0 ? ` and ${formatInt(initialShareUnpaidCount)} active member(s) pending initial share capital settlement` : ''}.`;
  let shareAction = 'Continue monitoring member capital build-up (CBU) and initial share capital compliance.';
  if (initialShareUnpaidCount > 0) {
    sharePriority = 'REVIEW REQUIRED';
    shareAction = `Review the ${formatInt(initialShareUnpaidCount)} active member account(s) with unpaid initial share capital and reconcile any pending share capital payment requests.`;
  }

  domainEvaluations.shareCapital = {
    domainKey: 'shareCapital',
    domainTitle: 'Share Capital',
    priority: sharePriority,
    trend: shareTrend.direction,
    comparisonBasis: shareTrend.comparisonBasis,
    currentCondition: shareCondition,
    contributingFactors: shareFactors,
    operationalArea: 'Member Equity & Share Capital Registry',
    actionToConsider: shareAction,
    percentageChange: shareTrend.percentChange,
    hasSufficientHistory: shareTrend.hasSufficientHistory
  };

  // ============================================================================
  // C. SAVINGS (REGULAR SAVINGS & DEPOSITS/WITHDRAWALS)
  // ============================================================================
  const totalRegularSavings = Number(savings.totalRegularSavings ?? savings.totalSavingsBalance ?? 0);
  const totalDeposits = Number(savings.totalDeposits ?? 0);
  const totalWithdrawals = Number(savings.totalWithdrawals ?? 0);
  const netSavingsMovement = totalDeposits - totalWithdrawals;
  const savingsParticipationRate =
    savings.savingsParticipationRate !== undefined
      ? Number(savings.savingsParticipationRate)
      : null;

  const savingsDepositSeries = Array.isArray(savings.savingsGrowthTrend)
    ? savings.savingsGrowthTrend.map((item: any) => ({
        period: String(item.month || item.period || ''),
        value: Number(item.deposits ?? item.netGrowth ?? 0)
      }))
    : [];
  const savingsWithdrawalSeries = Array.isArray(savings.savingsGrowthTrend)
    ? savings.savingsGrowthTrend.map((item: any) => ({
        period: String(item.month || item.period || ''),
        value: Number(item.withdrawals ?? 0)
      }))
    : [];

  const savTrend = evaluateMetricTrend({
    series: savingsDepositSeries.length >= 2 ? savingsDepositSeries : undefined,
    currentValue: savings.currentPeriodDeposits,
    previousValue: savings.previousPeriodDeposits,
    currentPeriodLabel: savings.currentPeriodLabel,
    previousPeriodLabel: savings.previousPeriodLabel
  });

  const wdrTrend = evaluateMetricTrend({
    series: savingsWithdrawalSeries.length >= 2 ? savingsWithdrawalSeries : undefined,
    currentValue: savings.currentPeriodWithdrawals,
    previousValue: savings.previousPeriodWithdrawals
  });

  let savPriority: ManagementPriority = 'INFORMATION';
  let savCondition = '';
  let savAction = 'Continue monitoring savings growth and member deposit activity.';

  if (!savTrend.hasSufficientHistory) {
    savCondition = `Regular savings deposits total ${formatPHP(totalDeposits)} against withdrawals of ${formatPHP(totalWithdrawals)} (net movement of ${formatPHP(netSavingsMovement)}). Insufficient historical data is available to determine a reliable trend.`;
    dataLimitations.push('Savings deposit trend: Historical comparison is unavailable for the selected period.');
  } else if (savTrend.direction === 'Increasing') {
    const pctText = savTrend.percentChange !== null ? ` by ${Math.abs(savTrend.percentChange)}%` : '';
    const wdrNote =
      wdrTrend.direction === 'Stable'
        ? ' while withdrawals remained relatively stable'
        : wdrTrend.direction === 'Decreasing'
        ? ' while withdrawals declined'
        : '';
    savCondition = `Regular savings deposits increased${pctText} ${savTrend.comparisonBasis}${wdrNote}. Net savings movement is ${formatPHP(netSavingsMovement)}.`;
    positiveDevelopments.push(`Regular savings deposits increased${pctText} ${savTrend.comparisonBasis}.`);
  } else if (savTrend.direction === 'Decreasing') {
    const pctText = savTrend.percentChange !== null ? ` by ${Math.abs(savTrend.percentChange)}%` : '';
    savCondition = `Regular savings deposits decreased${pctText} ${savTrend.comparisonBasis}, with cumulative deposits of ${formatPHP(totalDeposits)} and withdrawals of ${formatPHP(totalWithdrawals)}.`;
    savPriority = netSavingsMovement < 0 ? 'ATTENTION REQUIRED' : 'REVIEW REQUIRED';
    savAction =
      netSavingsMovement < 0
        ? 'Withdrawals exceeded deposits during the observed period. Review member withdrawal requests, deposit mobilization, and cashier liquidity reserves.'
        : 'Review member deposit activity and savings mobilization trends to identify whether lower deposit volume is seasonal or broad-based.';
  } else {
    savCondition = `Regular savings deposit activity remained relatively stable ${savTrend.comparisonBasis}, with net savings movement of ${formatPHP(netSavingsMovement)}.`;
    savPriority = 'MONITOR';
  }

  if (netSavingsMovement < 0 && savPriority !== 'ATTENTION REQUIRED') {
    savPriority = 'ATTENTION REQUIRED';
    savAction = 'Net savings movement is negative (withdrawals exceeded deposits). Review withdrawal patterns and liquidity buffers.';
  }

  const savFactors = `Total deposits of ${formatPHP(totalDeposits)} vs. withdrawals of ${formatPHP(totalWithdrawals)} (net movement: ${formatPHP(netSavingsMovement)})${savingsParticipationRate !== null ? `; active member savings participation rate is ${savingsParticipationRate.toFixed(1)}%` : ''}.`;

  domainEvaluations.savings = {
    domainKey: 'savings',
    domainTitle: 'Savings',
    priority: savPriority,
    trend: netSavingsMovement < 0 ? 'Requires attention' : savTrend.direction,
    comparisonBasis: savTrend.comparisonBasis,
    currentCondition: savCondition,
    contributingFactors: savFactors,
    operationalArea: 'Savings & Cashier Operations',
    actionToConsider: savAction,
    percentageChange: savTrend.percentChange,
    hasSufficientHistory: savTrend.hasSufficientHistory
  };

  // ============================================================================
  // D. TIME DEPOSITS
  // ============================================================================
  const totalTimeDepositPrincipal = Number(
    timeDeposits.totalTimeDepositPrincipal ?? savings.totalTimeDeposits ?? 0
  );
  const activeTimeDepositsCount = Number(timeDeposits.activeTimeDepositsCount ?? 0);
  const maturedTimeDepositsCount = Number(timeDeposits.maturedTimeDepositsCount ?? 0);
  const newPlacementsCount = Number(timeDeposits.newPlacementsCount ?? 0);

  const tdTrend = evaluateMetricTrend({
    series: Array.isArray(timeDeposits.placementTrend) ? timeDeposits.placementTrend : undefined,
    currentValue: timeDeposits.currentPeriodPlacements,
    previousValue: timeDeposits.previousPeriodPlacements
  });

  let tdPriority: ManagementPriority = 'INFORMATION';
  let tdCondition = '';
  let tdAction = 'Continue monitoring time deposit placements and upcoming maturity dates.';

  if (totalTimeDepositPrincipal === 0 && activeTimeDepositsCount === 0) {
    tdCondition = 'No active time deposit placements are currently recorded in the portfolio (₱0.00 principal).';
  } else if (!tdTrend.hasSufficientHistory) {
    tdCondition = `Time deposit principal totals ${formatPHP(totalTimeDepositPrincipal)} across ${formatInt(activeTimeDepositsCount)} active placement(s) and ${formatInt(maturedTimeDepositsCount)} matured contract(s). Insufficient historical data is available to determine a reliable trend.`;
  } else if (tdTrend.direction === 'Increasing') {
    const pctText = tdTrend.percentChange !== null ? ` by ${Math.abs(tdTrend.percentChange)}%` : '';
    tdCondition = `Time deposit placements increased${pctText} ${tdTrend.comparisonBasis}, bringing total time deposit principal to ${formatPHP(totalTimeDepositPrincipal)}.`;
    positiveDevelopments.push(`Time deposit placements increased${pctText} ${tdTrend.comparisonBasis}.`);
  } else if (tdTrend.direction === 'Decreasing') {
    const pctText = tdTrend.percentChange !== null ? ` by ${Math.abs(tdTrend.percentChange)}%` : '';
    tdCondition = `Time deposit placements decreased${pctText} ${tdTrend.comparisonBasis}, with total principal at ${formatPHP(totalTimeDepositPrincipal)}.`;
    tdPriority = 'MONITOR';
  } else {
    tdCondition = `Time deposit principal remained relatively stable ${tdTrend.comparisonBasis} at ${formatPHP(totalTimeDepositPrincipal)}.`;
  }

  if (maturedTimeDepositsCount > 0) {
    tdPriority = 'REVIEW REQUIRED';
    tdAction = `Review the ${formatInt(maturedTimeDepositsCount)} matured time deposit contract(s) and process member renewal or payout-to-savings instructions.`;
  }

  domainEvaluations.timeDeposits = {
    domainKey: 'timeDeposits',
    domainTitle: 'Time Deposits',
    priority: tdPriority,
    trend: tdTrend.direction,
    comparisonBasis: tdTrend.comparisonBasis,
    currentCondition: tdCondition,
    contributingFactors: `Total principal of ${formatPHP(totalTimeDepositPrincipal)} across ${formatInt(activeTimeDepositsCount)} active contract(s), ${formatInt(newPlacementsCount)} recent placement(s), and ${formatInt(maturedTimeDepositsCount)} matured contract(s).`,
    operationalArea: 'Time Deposit Management',
    actionToConsider: tdAction,
    percentageChange: tdTrend.percentChange,
    hasSufficientHistory: tdTrend.hasSufficientHistory
  };

  // ============================================================================
  // E. LOANS & COLLECTION PERFORMANCE
  // ============================================================================
  const outstandingLoans = Number(loans.outstandingLoanPortfolio ?? 0);
  const totalLoanApps = Number(loans.totalLoanApplications ?? 0);
  const approvedLoans = Number(loans.approvedLoans ?? 0);
  const pendingLoans = Number(loans.pendingLoans ?? 0);
  const rejectedLoans = Number(loans.rejectedLoans ?? 0);
  const releasedLoans = Number(loans.releasedLoans ?? 0);
  const collectionRate = Number(loans.loanCollectionPerformance ?? 100);
  const delinquencyRate = Number(loans.loanDelinquencyRate ?? 0);
  const overdueLoansCount = Number(loans.delinquentLoansCount ?? loans.overdueLoansCount ?? 0);
  const overdueLoanBalance = Number(loans.overdueLoanBalance ?? 0);
  const activeBorrowersCount = Number(loans.activeBorrowersCount ?? releasedLoans);
  const totalRepayments = Number(loans.totalPaymentsCollected ?? 0);

  const repaymentSeries = Array.isArray(loans.repaymentTrend)
    ? loans.repaymentTrend.map((item: any) => ({
        period: String(item.month || item.period || ''),
        value: Number(item.amount ?? item.value ?? 0)
      }))
    : [];

  const repaymentTrend = evaluateMetricTrend({
    series: repaymentSeries.length >= 2 ? repaymentSeries : undefined,
    currentValue: loans.currentPeriodRepayments,
    previousValue: loans.previousPeriodRepayments,
    currentPeriodLabel: loans.currentPeriodLabel,
    previousPeriodLabel: loans.previousPeriodLabel
  });

  const overdueTrend = evaluateMetricTrend({
    currentValue: loans.currentPeriodOverdueBalance ?? (overdueLoanBalance > 0 ? overdueLoanBalance : undefined),
    previousValue: loans.previousPeriodOverdueBalance
  });

  let loanPriority: ManagementPriority = 'INFORMATION';
  let loanCondition = '';
  let loanAction = 'Continue monitoring borrower amortization schedules and loan application reviews.';

  const hasOverdueIncrease =
    overdueTrend.hasSufficientHistory && overdueTrend.direction === 'Increasing';
  const hasRepaymentDecline =
    repaymentTrend.hasSufficientHistory && repaymentTrend.direction === 'Decreasing';

  if (hasOverdueIncrease && hasRepaymentDecline) {
    const ovPct = overdueTrend.percentChange !== null ? ` by ${Math.abs(overdueTrend.percentChange)}%` : '';
    const repPct = repaymentTrend.percentChange !== null ? ` by ${Math.abs(repaymentTrend.percentChange)}%` : '';
    loanCondition = `Overdue loan balances increased${ovPct} ${overdueTrend.comparisonBasis} while loan repayment volume decreased${repPct} ${repaymentTrend.comparisonBasis}. Loan receivables require immediate collection attention.`;
    loanPriority = 'ATTENTION REQUIRED';
    loanAction = 'Review collection activity and overdue accounts, and assess whether additional collection follow-up is required.';
  } else if (hasOverdueIncrease) {
    const ovPct = overdueTrend.percentChange !== null ? ` by ${Math.abs(overdueTrend.percentChange)}%` : '';
    loanCondition = `Overdue loan balances increased${ovPct} ${overdueTrend.comparisonBasis}, with portfolio delinquency at ${delinquencyRate}% across ${formatInt(overdueLoansCount)} delinquent loan(s).`;
    loanPriority = 'ATTENTION REQUIRED';
    loanAction = 'Review overdue accounts and collection performance, and dispatch borrower repayment reminders.';
  } else if (hasRepaymentDecline) {
    const repPct = repaymentTrend.percentChange !== null ? ` by ${Math.abs(repaymentTrend.percentChange)}%` : '';
    loanCondition = `Loan repayments decreased${repPct} ${repaymentTrend.comparisonBasis}, while outstanding loan receivables stand at ${formatPHP(outstandingLoans)} (collection performance: ${collectionRate}%).`;
    loanPriority = delinquencyRate > 0 || collectionRate < 85 ? 'ATTENTION REQUIRED' : 'REVIEW REQUIRED';
    loanAction = 'Review collection activity and overdue accounts, and assess whether additional collection follow-up is required.';
  } else if (delinquencyRate > 0 || overdueLoansCount > 0) {
    loanCondition = `Outstanding loan portfolio is ${formatPHP(outstandingLoans)} with a ${delinquencyRate}% delinquency rate (${formatInt(overdueLoansCount)} overdue loan account(s)) and ${collectionRate}% collection performance.`;
    loanPriority = delinquencyRate >= 10 ? 'ATTENTION REQUIRED' : 'REVIEW REQUIRED';
    loanAction = 'Review overdue accounts and collection performance to prevent further delinquency aging.';
  } else if (repaymentTrend.hasSufficientHistory && repaymentTrend.direction === 'Increasing') {
    const repPct = repaymentTrend.percentChange !== null ? ` by ${Math.abs(repaymentTrend.percentChange)}%` : '';
    loanCondition = `Loan repayments increased${repPct} ${repaymentTrend.comparisonBasis}, supporting a ${collectionRate}% collection rate across ${formatPHP(outstandingLoans)} in outstanding loan receivables.`;
    positiveDevelopments.push(`Loan repayments increased${repPct} ${repaymentTrend.comparisonBasis}.`);
  } else {
    loanCondition = `Outstanding loan portfolio stands at ${formatPHP(outstandingLoans)} across ${formatInt(activeBorrowersCount)} active borrower(s), with a ${collectionRate}% collection rate and ${delinquencyRate}% delinquency rate.${!repaymentTrend.hasSufficientHistory ? ' Insufficient historical data is available to determine a reliable repayment trend.' : ''}`;
    if (!repaymentTrend.hasSufficientHistory) {
      dataLimitations.push('Loan repayment trend: Historical comparison is unavailable for the selected period.');
    }
  }

  if (pendingLoans > 0 && loanPriority === 'INFORMATION') {
    loanPriority = 'MONITOR';
    loanAction = `Review the ${formatInt(pendingLoans)} pending loan application(s) in the credit pipeline alongside regular collection monitoring.`;
  }

  const loanFactors = `${formatInt(totalLoanApps)} applications (${formatInt(approvedLoans)} approved, ${formatInt(pendingLoans)} pending review, ${formatInt(rejectedLoans)} rejected, ${formatInt(releasedLoans)} released); total repayments collected: ${formatPHP(totalRepayments)}; overdue accounts: ${formatInt(overdueLoansCount)}.`;

  domainEvaluations.loans = {
    domainKey: 'loans',
    domainTitle: 'Loans & Credit Portfolio',
    priority: loanPriority,
    trend:
      loanPriority === 'ATTENTION REQUIRED'
        ? 'Requires attention'
        : repaymentTrend.direction,
    comparisonBasis: repaymentTrend.comparisonBasis,
    currentCondition: loanCondition,
    contributingFactors: loanFactors,
    operationalArea: 'Loan Operations & Collections',
    actionToConsider: loanAction,
    percentageChange: repaymentTrend.percentChange,
    hasSufficientHistory: repaymentTrend.hasSufficientHistory
  };

  // ============================================================================
  // F. REVENUE / INCOME
  // ============================================================================
  const revenue = Number(financials.revenue ?? 0);
  const interestEarned = Number(financials.interestIncome ?? financials.revenue ?? 0);
  const feeIncome = Number(financials.feeIncome ?? 0);
  const revenueSeries = Array.isArray(financials.revenueTrend)
    ? financials.revenueTrend.map((item: any) => ({
        period: String(item.month || item.period || ''),
        value: Number(item.revenue ?? item.amount ?? item.value ?? 0)
      }))
    : [];

  const revTrend = evaluateMetricTrend({
    series: revenueSeries.length >= 2 ? revenueSeries : undefined,
    currentValue: financials.currentPeriodRevenue,
    previousValue: financials.previousPeriodRevenue,
    currentPeriodLabel: financials.currentPeriodLabel,
    previousPeriodLabel: financials.previousPeriodLabel
  });

  // Also check transaction volume trend to contextualize revenue without fabricating causation
  const txSeries = Array.isArray(cashier.transactionTrend)
    ? cashier.transactionTrend.map((item: any) => ({
        period: String(item.month || item.period || ''),
        value: Number(item.count ?? item.value ?? 0)
      }))
    : [];
  const txTrend = evaluateMetricTrend({
    series: txSeries.length >= 2 ? txSeries : undefined,
    currentValue: cashier.currentPeriodTransactionsCount ?? financials.currentPeriodTransactionCount,
    previousValue: cashier.previousPeriodTransactionsCount ?? financials.previousPeriodTransactionCount
  });

  let revPriority: ManagementPriority = 'INFORMATION';
  let revCondition = '';
  let revAction = 'Continue monitoring loan interest collections and fee-generating activities.';

  if (!revTrend.hasSufficientHistory) {
    revCondition = `Cumulative recorded revenue is ${formatPHP(revenue)} (composed of ${formatPHP(interestEarned)} loan interest income and ${formatPHP(feeIncome)} fees). Insufficient historical data is available to determine a reliable period-over-period revenue trend.`;
    dataLimitations.push('Revenue period-over-period comparison: Historical comparison is unavailable for the selected period.');
  } else if (revTrend.direction === 'Decreasing') {
    const pctText = revTrend.percentChange !== null ? ` by ${Math.abs(revTrend.percentChange)}%` : '';
    revPriority = 'ATTENTION REQUIRED';
    if (txTrend.hasSufficientHistory && txTrend.direction === 'Decreasing') {
      revCondition = `Revenue is currently below the previous comparison period (decreased${pctText} ${revTrend.comparisonBasis}). The decline is primarily associated with lower transaction activity (${txTrend.percentChange !== null ? `down ${Math.abs(txTrend.percentChange)}%` : 'declining volume'}).`;
      revAction = 'Review the revenue-generating products and transaction volume before changing pricing or markup. The available data does not by itself establish that markup is the cause of the decline.';
    } else if (txTrend.hasSufficientHistory && txTrend.direction === 'Stable') {
      revCondition = `Revenue decreased${pctText} ${revTrend.comparisonBasis} while transaction volume remained relatively stable.`;
      revAction = 'Review current pricing/markup levels, active loan mix, and product margins before determining whether a pricing adjustment is appropriate.';
    } else {
      revCondition = `Revenue is currently below the previous comparison period (decreased${pctText} ${revTrend.comparisonBasis}).`;
      revAction = 'Review the revenue-generating products and transaction volume before changing pricing or markup. The available data does not by itself establish that markup is the cause of the decline.';
    }
  } else if (revTrend.direction === 'Increasing') {
    const pctText = revTrend.percentChange !== null ? ` by ${Math.abs(revTrend.percentChange)}%` : '';
    revCondition = `Revenue increased${pctText} ${revTrend.comparisonBasis}, reaching ${formatPHP(revenue)} in total recorded revenue.`;
    positiveDevelopments.push(`Revenue increased${pctText} ${revTrend.comparisonBasis}.`);
  } else {
    revCondition = `Revenue remained relatively stable ${revTrend.comparisonBasis} at ${formatPHP(revenue)}.`;
    revPriority = 'MONITOR';
  }

  const revFactors = `Total revenue of ${formatPHP(revenue)} derived from ${formatPHP(interestEarned)} in loan interest earnings and ${formatPHP(feeIncome)} in fee collections across ${formatInt(releasedLoans)} released loan contract(s).`;

  domainEvaluations.revenue = {
    domainKey: 'revenue',
    domainTitle: 'Revenue / Income',
    priority: revPriority,
    trend: revTrend.direction,
    comparisonBasis: revTrend.comparisonBasis,
    currentCondition: revCondition,
    contributingFactors: revFactors,
    operationalArea: 'Revenue & Lending Operations',
    actionToConsider: revAction,
    percentageChange: revTrend.percentChange,
    hasSufficientHistory: revTrend.hasSufficientHistory
  };

  // ============================================================================
  // G. EXPENSES
  // ============================================================================
  const expenses = Number(financials.expenses ?? 0);
  const expTrend = evaluateMetricTrend({
    series: Array.isArray(financials.expenseTrend) ? financials.expenseTrend : undefined,
    currentValue: financials.currentPeriodExpenses,
    previousValue: financials.previousPeriodExpenses
  });

  let expPriority: ManagementPriority = 'INFORMATION';
  let expCondition = '';
  let expFactors = '';
  let expAction = 'Maintain operating cost discipline and expense voucher documentation.';

  if (expenses === 0 && !expTrend.hasSufficientHistory) {
    expCondition = 'Recorded operating expenses stand at ₱0.00 for the selected period. Detailed expense ledger entries are not currently populated in the database.';
    expFactors = 'No expense disbursements are recorded in the active transaction ledger.';
    expAction = 'Ensure any operational expenses are recorded when incurred so expense-to-revenue ratios remain accurate.';
    dataLimitations.push('Operating expense category breakdown is unavailable because no expense transactions are currently recorded in the ledger.');
  } else {
    const expToRevRatio = revenue > 0 ? Number(((expenses / revenue) * 100).toFixed(1)) : null;
    const expExceededRev =
      expTrend.hasSufficientHistory &&
      expTrend.direction === 'Increasing' &&
      expTrend.percentChange !== null &&
      (revTrend.percentChange === null || expTrend.percentChange > revTrend.percentChange);

    if (expExceededRev) {
      expPriority = 'ATTENTION REQUIRED';
      expCondition = `Operating expenses increased faster than revenue (expenses grew by ${Math.abs(expTrend.percentChange!)}% ${expTrend.comparisonBasis}${revTrend.percentChange !== null ? ` vs. revenue change of ${revTrend.percentChange}%` : ''}).`;
      expAction = 'Review the expense categories contributing to the increase and determine whether controllable operating costs require management attention.';
    } else if (expTrend.hasSufficientHistory && expTrend.direction === 'Increasing') {
      expPriority = 'MONITOR';
      expCondition = `Operating expenses increased by ${Math.abs(expTrend.percentChange ?? 0)}% ${expTrend.comparisonBasis} to ${formatPHP(expenses)}.`;
      expAction = 'Monitor operating expense categories relative to revenue growth.';
    } else if (expTrend.hasSufficientHistory && expTrend.direction === 'Decreasing') {
      expCondition = `Operating expenses decreased by ${Math.abs(expTrend.percentChange ?? 0)}% ${expTrend.comparisonBasis} to ${formatPHP(expenses)}.`;
      positiveDevelopments.push(`Operating expenses decreased by ${Math.abs(expTrend.percentChange ?? 0)}% ${expTrend.comparisonBasis}.`);
    } else {
      expCondition = `Operating expenses remained relatively stable ${expTrend.comparisonBasis} at ${formatPHP(expenses)}.`;
    }
    expFactors = `Total operating expenses of ${formatPHP(expenses)}${expToRevRatio !== null ? ` (${expToRevRatio}% of recorded revenue)` : ''}.`;
  }

  domainEvaluations.expenses = {
    domainKey: 'expenses',
    domainTitle: 'Expenses',
    priority: expPriority,
    trend: expPriority === 'ATTENTION REQUIRED' ? 'Requires attention' : expTrend.direction,
    comparisonBasis: expTrend.comparisonBasis,
    currentCondition: expCondition,
    contributingFactors: expFactors,
    operationalArea: 'Expense & Cost Management',
    actionToConsider: expAction,
    percentageChange: expTrend.percentChange,
    hasSufficientHistory: expTrend.hasSufficientHistory
  };

  // ============================================================================
  // H. PROFITABILITY / NET SURPLUS
  // ============================================================================
  const netIncome = Number(financials.netIncome ?? (revenue - expenses));
  const netSurplusMargin = revenue > 0 ? Number(((netIncome / revenue) * 100).toFixed(1)) : null;

  let profPriority: ManagementPriority = 'INFORMATION';
  let profCondition = '';
  let profAction = 'Continue tracking net surplus generation in preparation for annual dividend and reserve allocations.';

  if (revTrend.hasSufficientHistory && revTrend.direction === 'Increasing' && (expTrend.direction === 'Stable' || expTrend.direction === 'Decreasing' || expenses === 0)) {
    profCondition = `Revenue has increased ${revTrend.comparisonBasis}, while operating expenses have remained relatively stable. The current trend indicates improved operating performance with a net surplus of ${formatPHP(netIncome)}.`;
    positiveDevelopments.push(`Net surplus improved with revenue growth outpacing operating expenses.`);
  } else if (netIncome < 0) {
    profPriority = 'ATTENTION REQUIRED';
    profCondition = `Net surplus is currently negative (${formatPHP(netIncome)}), as recorded expenses (${formatPHP(expenses)}) exceeded revenue (${formatPHP(revenue)}).`;
    profAction = 'Review both revenue-generating lending activities and controllable operating expenses to restore positive net surplus.';
  } else if (domainEvaluations.expenses.priority === 'ATTENTION REQUIRED') {
    profPriority = 'REVIEW REQUIRED';
    profCondition = `Net surplus stands at ${formatPHP(netIncome)}${netSurplusMargin !== null ? ` (${netSurplusMargin}% surplus ratio)` : ''}, but operating expense growth exceeded revenue growth ${revTrend.comparisonBasis}.`;
    profAction = 'Review operating cost drivers and revenue collection velocity to protect net surplus margins.';
  } else {
    profCondition = `Net surplus stands at ${formatPHP(netIncome)} from ${formatPHP(revenue)} in revenue and ${formatPHP(expenses)} in recorded operating expenses${netSurplusMargin !== null ? ` (${netSurplusMargin}% net surplus ratio)` : ''}.`;
  }

  domainEvaluations.profitability = {
    domainKey: 'profitability',
    domainTitle: 'Profitability / Net Surplus',
    priority: profPriority,
    trend: netIncome < 0 ? 'Requires attention' : revTrend.direction,
    comparisonBasis: revTrend.comparisonBasis,
    currentCondition: profCondition,
    contributingFactors: `Revenue: ${formatPHP(revenue)}, Operating Expenses: ${formatPHP(expenses)}, Net Surplus: ${formatPHP(netIncome)}.`,
    operationalArea: 'Financial Management & Surplus Allocation',
    actionToConsider: profAction,
    percentageChange: revTrend.percentChange,
    hasSufficientHistory: revTrend.hasSufficientHistory
  };

  // ============================================================================
  // I. DIVIDENDS
  // ============================================================================
  const totalDividendsDeclared = Number(dividends.totalDividendsDeclared ?? 0);
  const dividendsDistributed = Number(dividends.dividendsDistributed ?? 0);
  const pendingDividendDistribution = Math.max(0, totalDividendsDeclared - dividendsDistributed);

  let divPriority: ManagementPriority = 'INFORMATION';
  let divCondition = `Declared dividend pool totals ${formatPHP(totalDividendsDeclared)}, with ${formatPHP(dividendsDistributed)} distributed to member accounts.`;
  let divAction = 'Continue monitoring net surplus accumulation and member share capital weights for dividend computation.';

  if (pendingDividendDistribution > 0) {
    divPriority = 'REVIEW REQUIRED';
    divCondition += ` An allocated balance of ${formatPHP(pendingDividendDistribution)} remains pending final distribution authorization.`;
    divAction = `Review the computed dividend allocations (${formatPHP(pendingDividendDistribution)} pending) and authorize distribution when approved by management.`;
  }

  domainEvaluations.dividends = {
    domainKey: 'dividends',
    domainTitle: 'Dividends',
    priority: divPriority,
    trend: pendingDividendDistribution > 0 ? 'Requires attention' : 'Stable',
    comparisonBasis: 'Cumulative declared vs. distributed dividend periods',
    currentCondition: divCondition,
    contributingFactors: `Declared dividends: ${formatPHP(totalDividendsDeclared)}; Distributed dividends: ${formatPHP(dividendsDistributed)}; Uncredited balance: ${formatPHP(pendingDividendDistribution)}.`,
    operationalArea: 'Dividend Computation & Distribution',
    actionToConsider: divAction,
    percentageChange: null,
    hasSufficientHistory: true
  };

  // ============================================================================
  // J. CASH / LIQUIDITY
  // ============================================================================
  const totalAssets = Number(financials.totalAssets ?? 0);
  const totalLiabilities = Number(financials.totalLiabilities ?? 0);
  const cashBalance = Math.max(0, totalAssets - outstandingLoans);
  const liquidityRatio =
    totalLiabilities > 0 ? Number(((cashBalance / totalLiabilities) * 100).toFixed(1)) : null;

  let liqPriority: ManagementPriority = 'INFORMATION';
  let liqCondition = `Estimated liquid cash position is ${formatPHP(cashBalance)} against deposit liabilities of ${formatPHP(totalLiabilities)} and outstanding loans of ${formatPHP(outstandingLoans)}${liquidityRatio !== null ? ` (cash-to-savings coverage ratio: ${liquidityRatio}%)` : ''}.`;
  let liqAction = 'Maintain balanced liquidity between member savings withdrawals and new loan disbursements.';

  if (liquidityRatio !== null && liquidityRatio < 15) {
    liqPriority = 'ATTENTION REQUIRED';
    liqAction = 'Liquid cash reserves are low relative to savings liabilities. Review upcoming loan disbursement commitments and accelerate loan repayment collections.';
  } else if (liquidityRatio !== null && liquidityRatio < 25) {
    liqPriority = 'MONITOR';
    liqAction = 'Monitor cash inflows from loan repayments and savings deposits before releasing large loan disbursements.';
  }

  domainEvaluations.liquidity = {
    domainKey: 'liquidity',
    domainTitle: 'Cash & Liquidity',
    priority: liqPriority,
    trend: liqPriority === 'ATTENTION REQUIRED' ? 'Requires attention' : 'Stable',
    comparisonBasis: 'Current balance sheet cash-to-deposit liability coverage',
    currentCondition: liqCondition,
    contributingFactors: `Liquid cash balance: ${formatPHP(cashBalance)}, Deposit liabilities (Regular + Time Deposits): ${formatPHP(totalLiabilities)}, Outstanding loan receivables: ${formatPHP(outstandingLoans)}.`,
    operationalArea: 'Treasury & Cashier Liquidity',
    actionToConsider: liqAction,
    percentageChange: null,
    hasSufficientHistory: true
  };

  // ============================================================================
  // K. TRANSACTION ACTIVITY
  // ============================================================================
  const dailyTxCount = Number(cashier.dailyTransactionsCount ?? 0);
  const dailyTxVol = Number(cashier.dailyTransactionsVolume ?? 0);
  const monthlyTxCount = Number(cashier.monthlyTransactionsCount ?? 0);
  const monthlyTxVol = Number(cashier.monthlyTransactionsVolume ?? 0);
  const totalCollections = Number(cashier.totalCollections ?? 0);
  const gcashTxCount = Number(cashier.gcashTransactionsCount ?? 0);
  const pendingReconciliations = Number(cashier.pendingPaymentRequestsCount ?? 0);

  let txPriority: ManagementPriority = 'INFORMATION';
  let txCondition = `Monthly cashier throughput stands at ${formatInt(monthlyTxCount)} transaction(s) (${formatPHP(monthlyTxVol)} volume), with ${formatInt(dailyTxCount)} transaction(s) (${formatPHP(dailyTxVol)}) recorded today.`;
  let txAction = 'Continue daily cashier reconciliation and Official Receipt verification.';

  if (txTrend.hasSufficientHistory) {
    const pctText = txTrend.percentChange !== null ? ` by ${Math.abs(txTrend.percentChange)}%` : '';
    if (txTrend.direction === 'Decreasing') {
      txCondition = `Transaction activity decreased${pctText} ${txTrend.comparisonBasis} (${formatInt(monthlyTxCount)} transactions in the current month totaling ${formatPHP(monthlyTxVol)}).`;
      txPriority = 'MONITOR';
      txAction = 'Review member transaction activity across savings deposits, loan repayments, and GCash submissions.';
    } else if (txTrend.direction === 'Increasing') {
      txCondition = `Transaction activity increased${pctText} ${txTrend.comparisonBasis} (${formatInt(monthlyTxCount)} transactions in the current month totaling ${formatPHP(monthlyTxVol)}).`;
      positiveDevelopments.push(`Transaction volume increased${pctText} ${txTrend.comparisonBasis}.`);
    }
  }

  if (pendingReconciliations > 0) {
    txPriority = 'REVIEW REQUIRED';
    txAction = `Reconcile and verify the ${formatInt(pendingReconciliations)} pending payment request(s) in the cashier/GCash queue.`;
  }

  domainEvaluations.transactionActivity = {
    domainKey: 'transactionActivity',
    domainTitle: 'Transaction Activity',
    priority: txPriority,
    trend: txTrend.direction,
    comparisonBasis: txTrend.comparisonBasis,
    currentCondition: txCondition,
    contributingFactors: `Today: ${formatInt(dailyTxCount)} txns (${formatPHP(dailyTxVol)}); Current Month: ${formatInt(monthlyTxCount)} txns (${formatPHP(monthlyTxVol)}); Counter Collections Today: ${formatPHP(totalCollections)}${gcashTxCount > 0 ? `; GCash transactions: ${formatInt(gcashTxCount)}` : ''}${pendingReconciliations > 0 ? `; Pending payment reconciliations: ${formatInt(pendingReconciliations)}` : ''}.`,
    operationalArea: 'Cashier & Payment Reconciliation',
    actionToConsider: txAction,
    percentageChange: txTrend.percentChange,
    hasSufficientHistory: txTrend.hasSufficientHistory
  };

  // ============================================================================
  // L. MARKUP / PRICING & MARGIN ANALYSIS (Section 5 & Section 8)
  // ============================================================================
  const hasCostData =
    pricing.costDataAvailable === true &&
    pricing.costAmount !== undefined &&
    pricing.costAmount !== null;
  const avgLoanRatePct =
    pricing.averageLoanInterestRatePct !== undefined
      ? Number(pricing.averageLoanInterestRatePct)
      : null;

  let pricePriority: ManagementPriority = 'INFORMATION';
  let priceCondition = '';
  let priceFactors = '';
  let priceAction = '';
  let priceLimitation: string | undefined;

  if (!hasCostData) {
    priceLimitation = 'Margin analysis is unavailable because the required cost data is not currently available.';
    dataLimitations.push(priceLimitation);
    priceCondition = `${priceLimitation} Current configured loan product interest rate average is ${avgLoanRatePct !== null ? `${avgLoanRatePct.toFixed(2)}%` : 'configured per loan product'} with recorded revenue of ${formatPHP(revenue)}.`;
    priceFactors = `Configured loan products: ${formatInt(pricing.loanProductsCount ?? 0)}; Total revenue: ${formatPHP(revenue)}; Cost of funds / base cost data: Not recorded.`;

    if (revTrend.direction === 'Decreasing') {
      pricePriority = 'REVIEW REQUIRED';
      if (txTrend.hasSufficientHistory && txTrend.direction === 'Stable') {
        priceAction = 'Revenue has declined while transaction volume has remained relatively stable. Review current pricing/markup levels and product margins before determining whether a pricing adjustment is appropriate.';
      } else {
        priceAction = 'Review the revenue-generating products and transaction volume before changing pricing or markup. The available data does not by itself establish that markup is the cause of the decline.';
      }
    } else {
      priceAction = 'Maintain current product rate configurations and record cost-of-funds benchmarks if gross margin tracking is desired.';
    }
  } else {
    const costAmt = Number(pricing.costAmount);
    const grossMargin = revenue - costAmt;
    const grossMarginPct = revenue > 0 ? Number(((grossMargin / revenue) * 100).toFixed(1)) : 0;
    const markupPct =
      pricing.currentMarkupPct !== undefined
        ? Number(pricing.currentMarkupPct)
        : costAmt > 0
        ? Number(((grossMargin / costAmt) * 100).toFixed(1))
        : 0;

    priceCondition = `Current markup/rate is ${markupPct}%, generating ${formatPHP(revenue)} in revenue against a cost base of ${formatPHP(costAmt)} (gross margin: ${formatPHP(grossMargin)} or ${grossMarginPct}%).`;
    priceFactors = `Markup: ${markupPct}%, Revenue: ${formatPHP(revenue)}, Cost Base: ${formatPHP(costAmt)}, Gross Margin: ${formatPHP(grossMargin)} (${grossMarginPct}%), Monthly Transactions: ${formatInt(monthlyTxCount)}.`;

    if (revTrend.direction === 'Decreasing' && txTrend.direction === 'Stable') {
      pricePriority = 'REVIEW REQUIRED';
      priceAction = 'Revenue has declined while transaction volume has remained relatively stable. Review current pricing/markup levels and product margins before determining whether a pricing adjustment is appropriate.';
    } else if (revTrend.direction === 'Decreasing') {
      pricePriority = 'REVIEW REQUIRED';
      priceAction = 'Review the revenue-generating products and transaction volume before changing pricing or markup. The available data does not by itself establish that markup is the cause of the decline.';
    } else {
      priceAction = 'Continue monitoring product margins and transaction volume under current pricing parameters.';
    }
  }

  domainEvaluations.pricingMarkup = {
    domainKey: 'pricingMarkup',
    domainTitle: 'Pricing, Rates & Margin Analysis',
    priority: pricePriority,
    trend: revTrend.direction,
    comparisonBasis: revTrend.comparisonBasis,
    currentCondition: priceCondition,
    contributingFactors: priceFactors,
    operationalArea: 'Product Pricing & Rate Governance',
    actionToConsider: priceAction,
    percentageChange: revTrend.percentChange,
    hasSufficientHistory: revTrend.hasSufficientHistory,
    dataLimitation: priceLimitation
  };

  // ============================================================================
  // ASSEMBLE KEY FINDINGS, AREAS REQUIRING ATTENTION & EXECUTIVE SUMMARY
  // ============================================================================
  const orderedKeys =
    roleScope === 'STAFF'
      ? ['membership', 'savings', 'shareCapital', 'timeDeposits', 'loans', 'transactionActivity', 'liquidity']
      : [
          'membership',
          'shareCapital',
          'savings',
          'timeDeposits',
          'loans',
          'revenue',
          'expenses',
          'profitability',
          'dividends',
          'liquidity',
          'transactionActivity',
          'pricingMarkup'
        ];

  const keyFindings = orderedKeys
    .map(k => domainEvaluations[k])
    .filter(Boolean);

  const areasRequiringAttention = keyFindings.filter(
    f => f.priority === 'ATTENTION REQUIRED' || f.priority === 'REVIEW REQUIRED'
  );

  const actionsToConsider = keyFindings
    .filter(f => f.priority !== 'INFORMATION' || areasRequiringAttention.length === 0)
    .map(f => ({
      priority: f.priority,
      area: f.operationalArea,
      condition: f.currentCondition,
      action: f.actionToConsider
    }));

  // Build Overall Situation & Executive Summary dynamically from actual findings
  const overallParts: string[] = [];
  overallParts.push(domainEvaluations.membership.currentCondition.split('.')[0] + '.');
  overallParts.push(domainEvaluations.savings.currentCondition.split('.')[0] + '.');
  overallParts.push(domainEvaluations.loans.currentCondition.split('.')[0] + '.');
  if (roleScope === 'ADMIN') {
    overallParts.push(domainEvaluations.revenue.currentCondition.split('.')[0] + '.');
  }
  const overallSituation = overallParts.join(' ');

  const execParts: string[] = [];
  execParts.push(overallSituation);

  if (positiveDevelopments.length > 0) {
    execParts.push(`Positive developments include: ${positiveDevelopments.slice(0, 3).join(' ')}`);
  }

  if (areasRequiringAttention.length > 0) {
    const attnSummary = areasRequiringAttention
      .map(a => `${a.domainTitle} (${a.priority}: ${a.currentCondition.split('.')[0]})`)
      .join('; ');
    execParts.push(`Areas requiring management attention: ${attnSummary}.`);
    const topActions = areasRequiringAttention
      .slice(0, 3)
      .map(a => a.actionToConsider)
      .join(' ');
    execParts.push(`Recommended actions to consider: ${topActions}`);
  } else {
    execParts.push(
      'Core cooperative operations across membership, savings, lending, and cashier activity remain stable with no critical exceptions flagged. Management should continue routine operational monitoring.'
    );
  }

  return {
    generatedAt,
    roleScope,
    executiveSummary: execParts.join(' '),
    overallSituation,
    positiveDevelopments,
    keyFindings,
    areasRequiringAttention,
    actionsToConsider,
    dataLimitations: Array.from(new Set(dataLimitations)),
    domainEvaluations
  };
}

/**
 * Generates an Operational Descriptive Analysis specifically tailored for Staff daily queues
 * in OperationalAnalytics.tsx (/api/analytics/operational).
 */
export function generateOperationalDescriptiveAnalysis(opData: any): DescriptiveAnalysisReport {
  const generatedAt = new Date().toISOString();
  const memOps = opData?.memberOperations || {};
  const loanOps = opData?.loanOperations || {};
  const cashierOps = opData?.cashierOperations || {};
  const gcashOps = opData?.gcashOperations || {};
  const daily = opData?.dailySummary || {};
  const support = opData?.memberSupport || {};

  const findings: DomainDescriptiveFinding[] = [];
  const positiveDevelopments: string[] = [];

  // 1. Member Queue
  const pendingRegs = Number(memOps.pendingRegistrations ?? 0);
  const approvedToday = Number(memOps.approvedToday ?? 0);
  const pendingInitShare = Number(memOps.pendingInitialSharePayments ?? 0);
  if (approvedToday > 0) {
    positiveDevelopments.push(`${formatInt(approvedToday)} member registration(s) approved today.`);
  }
  findings.push({
    domainKey: 'memberOperations',
    domainTitle: 'Member Verification & Onboarding Queue',
    priority: pendingRegs > 0 || pendingInitShare > 0 ? 'REVIEW REQUIRED' : 'INFORMATION',
    trend: pendingRegs > 0 ? 'Requires attention' : 'Stable',
    comparisonBasis: 'Current live operational queue vs. today completed actions',
    currentCondition: `There are ${formatInt(pendingRegs)} pending member registration(s) and ${formatInt(pendingInitShare)} active member(s) awaiting initial share capital settlement (${formatInt(approvedToday)} approved today).`,
    contributingFactors: `Pending registrations: ${formatInt(pendingRegs)}; Approved today: ${formatInt(approvedToday)}; Unpaid initial share accounts: ${formatInt(pendingInitShare)}.`,
    operationalArea: 'Member Management & Compliance',
    actionToConsider:
      pendingRegs > 0
        ? `Review submitted KYC documents and process the ${formatInt(pendingRegs)} pending registration application(s).`
        : 'Member verification queue is clear; continue monitoring new submissions.',
    hasSufficientHistory: true
  });

  // 2. Loan Queue
  const pendingLoanApps = Number(loanOps.pendingApplications ?? 0);
  const underReviewLoans = Number(loanOps.underReview ?? 0);
  const waitingRelease = Number(loanOps.waitingForRelease ?? 0);
  const releasedToday = Number(loanOps.releasedToday ?? 0);
  if (releasedToday > 0) {
    positiveDevelopments.push(`${formatInt(releasedToday)} loan contract(s) disbursed today.`);
  }
  findings.push({
    domainKey: 'loanOperations',
    domainTitle: 'Loan Processing & Disbursement Pipeline',
    priority:
      pendingLoanApps + underReviewLoans + waitingRelease > 0
        ? 'ATTENTION REQUIRED'
        : 'INFORMATION',
    trend:
      pendingLoanApps + underReviewLoans + waitingRelease > 0
        ? 'Requires attention'
        : 'Stable',
    comparisonBasis: 'Live lending workflow queue',
    currentCondition: `Loan pipeline holds ${formatInt(pendingLoanApps)} application(s) pending review, ${formatInt(underReviewLoans)} under review, and ${formatInt(waitingRelease)} approved loan(s) waiting for release (${formatInt(releasedToday)} released today).`,
    contributingFactors: `Pending: ${formatInt(pendingLoanApps)}, Under Review: ${formatInt(underReviewLoans)}, Awaiting Release: ${formatInt(waitingRelease)}, Released Today: ${formatInt(releasedToday)}.`,
    operationalArea: 'Loan Management',
    actionToConsider:
      pendingLoanApps + underReviewLoans + waitingRelease > 0
        ? 'Verify borrower PMES/Orientation eligibility and process pending loan applications and approved disbursements.'
        : 'Loan application queue is up to date; monitor active loan repayment schedules.',
    hasSufficientHistory: true
  });

  // 3. Cashier & GCash Operations
  const pendingGcash = Number(gcashOps.pendingVerifications ?? memOps.pendingGCashVerifications ?? 0);
  const totalReceivedToday = Number(daily.totalCashReceivedToday ?? 0);
  const totalReleasedToday = Number(daily.totalCashReleasedToday ?? 0);
  const totalTxToday = Number(daily.totalTransactionsToday ?? 0);

  findings.push({
    domainKey: 'cashierAndGcash',
    domainTitle: 'Cashier & GCash Verification Desk',
    priority: pendingGcash > 0 ? 'REVIEW REQUIRED' : 'INFORMATION',
    trend: pendingGcash > 0 ? 'Requires attention' : 'Stable',
    comparisonBasis: 'Daily counter and digital payment activity',
    currentCondition: `Recorded ${formatInt(totalTxToday)} transaction(s) today with ${formatPHP(totalReceivedToday)} received and ${formatPHP(totalReleasedToday)} released; ${formatInt(pendingGcash)} GCash payment verification(s) are pending.`,
    contributingFactors: `Cash deposits today: ${formatPHP(cashierOps.cashDepositsToday)}, Withdrawals today: ${formatPHP(cashierOps.withdrawalsProcessedToday)}, Official Receipts issued today: ${formatInt(daily.officialReceiptsIssuedToday)}.`,
    operationalArea: 'Cashier & GCash Reconciliation',
    actionToConsider:
      pendingGcash > 0
        ? `Verify reference numbers and proof attachments for the ${formatInt(pendingGcash)} pending GCash transaction(s).`
        : 'Continue issuing Official Receipts for verified counter and digital collections.',
    hasSufficientHistory: true
  });

  // 4. Member Support Inquiries
  const pendingInq = Number(support.pendingInquiries ?? 0);
  findings.push({
    domainKey: 'memberSupport',
    domainTitle: 'Member Support & Inquiries',
    priority: pendingInq > 0 ? 'MONITOR' : 'INFORMATION',
    trend: pendingInq > 0 ? 'Requires attention' : 'Stable',
    comparisonBasis: 'Open vs. resolved today support queue',
    currentCondition: `There are ${formatInt(pendingInq)} open member support inquiry ticket(s) (${formatInt(support.resolvedToday)} resolved today).`,
    contributingFactors: `Open/In-progress inquiries: ${formatInt(pendingInq)}; Resolved today: ${formatInt(support.resolvedToday)}.`,
    operationalArea: 'Member Inquiries & Support',
    actionToConsider:
      pendingInq > 0
        ? `Respond to the ${formatInt(pendingInq)} open member inquiry ticket(s) in the support desk.`
        : 'All member support inquiries are currently resolved.',
    hasSufficientHistory: true
  });

  const areasRequiringAttention = findings.filter(
    f => f.priority === 'ATTENTION REQUIRED' || f.priority === 'REVIEW REQUIRED'
  );

  const overallSituation = findings.map(f => f.currentCondition).join(' ');
  const executiveSummary =
    areasRequiringAttention.length > 0
      ? `${overallSituation} Operational areas requiring staff action: ${areasRequiringAttention.map(a => a.domainTitle).join(', ')}. Recommended next steps: ${areasRequiringAttention.map(a => a.actionToConsider).join(' ')}`
      : `${overallSituation} All operational verification queues are currently clear.`;

  const domainEvaluations: Record<string, DomainDescriptiveFinding> = {};
  findings.forEach(f => {
    domainEvaluations[f.domainKey] = f;
  });

  return {
    generatedAt,
    roleScope: 'STAFF',
    executiveSummary,
    overallSituation,
    positiveDevelopments,
    keyFindings: findings,
    areasRequiringAttention,
    actionsToConsider: findings.map(f => ({
      priority: f.priority,
      area: f.operationalArea,
      condition: f.currentCondition,
      action: f.actionToConsider
    })),
    dataLimitations: [],
    domainEvaluations
  };
}

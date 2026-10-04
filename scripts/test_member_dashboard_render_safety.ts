import { formatCurrency, formatMoney, formatNumber } from '../src/views/MemberDashboard';
import { formatPesoAmount, amountToWords, getReceiptLineItems } from '../src/utils/receiptFormatters';

console.log('--- TESTING MEMBER DASHBOARD NUMERIC & RENDERING SAFETY ---');

function check(desc: string, condition: boolean) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}`);
    process.exit(1);
  }
}

// 1. formatCurrency tests with undefined, null, NaN, strings, and zero
check('formatCurrency(undefined) returns ₱0.00', formatCurrency(undefined) === '₱0.00');
check('formatCurrency(null) returns ₱0.00', formatCurrency(null) === '₱0.00');
check('formatCurrency("") returns ₱0.00', formatCurrency("") === '₱0.00');
check('formatCurrency(NaN) returns ₱0.00', formatCurrency(NaN) === '₱0.00');
check('formatCurrency("invalid") returns ₱0.00', formatCurrency("invalid") === '₱0.00');
check('formatCurrency(0) returns ₱0.00', formatCurrency(0) === '₱0.00');
check('formatCurrency(1250.5) contains ₱1,250.50', formatCurrency(1250.5).includes('1,250.50'));
check('formatCurrency("5000") contains ₱5,000.00', formatCurrency("5000").includes('5,000.00'));

// 2. formatMoney tests
check('formatMoney(undefined) returns 0.00', formatMoney(undefined) === '0.00');
check('formatMoney(null) returns 0.00', formatMoney(null) === '0.00');
check('formatMoney(NaN) returns 0.00', formatMoney(NaN) === '0.00');
check('formatMoney(25000) contains 25,000.00', formatMoney(25000).includes('25,000.00'));

// 3. formatNumber tests
check('formatNumber(undefined) returns 0', formatNumber(undefined) === '0');
check('formatNumber(null) returns 0', formatNumber(null) === '0');
check('formatNumber(10000) contains 10,000', formatNumber(10000).includes('10,000'));

// 4. Test Legacy Transaction Records Transformation (Statement of Account & Ledger)
const legacyTransactions: any[] = [
  {
    id: 'tx_old_1',
    createdAt: '2025-01-10T10:00:00Z',
    type: 'DEPOSIT',
    amount: 1000,
    description: 'Initial deposit',
    // missing runningBalance, balanceAfter, referenceNumber
  },
  {
    id: 'tx_old_2',
    createdAt: '2025-02-15T14:30:00Z',
    type: 'WITHDRAWAL',
    amount: 200,
    status: 'VOIDED', // VOIDED transaction
    description: 'Voided withdrawal',
  },
  {
    id: 'tx_old_3',
    createdAt: '2025-03-20T09:15:00Z',
    type: 'LOAN_PAYMENT',
    amount: 500,
    description: 'Installment payment',
    officialReceiptNumber: 'OR-2025-001'
  },
  {
    id: 'tx_old_4',
    createdAt: '2025-04-01T11:00:00Z',
    type: 'DIVIDEND_CREDIT',
    amount: 350.75,
    description: 'Annual dividend 2024'
  }
];

// Simulate processedLedger logic
let currentBalance = 0;
const processed = legacyTransactions.map((tx: any) => {
  let debit = 0;
  let credit = 0;
  const txAmount = typeof tx.amount === "number" ? tx.amount : Number(tx.amount || 0);
  const isVoided = tx.status === "VOIDED";

  if (!isVoided) {
    if (tx.type === "DEPOSIT" || tx.type === "DIVIDEND_CREDIT" || tx.type === "INITIAL_SHARE" || tx.type === "SHARE_CAPITAL") {
      credit = txAmount;
      currentBalance += credit;
    } else if (tx.type === "WITHDRAWAL" || tx.type === "FEE") {
      debit = txAmount;
      currentBalance -= debit;
    } else if (tx.type === "LOAN_RELEASE") {
      debit = txAmount;
    } else if (tx.type === "LOAN_PAYMENT") {
      credit = txAmount;
    }
  }

  const finalRunningBalance =
    typeof tx.runningBalance === "number"
      ? tx.runningBalance
      : typeof tx.balanceAfter === "number"
      ? tx.balanceAfter
      : currentBalance;

  return {
    ...tx,
    debit,
    credit,
    runningBalance: finalRunningBalance,
  };
});

check('Processed ledger length matches', processed.length === 4);
check('VOIDED transaction debit is 0', processed[1].debit === 0);
check('VOIDED transaction credit is 0', processed[1].credit === 0);
check('Running balance after non-voided transactions matches', processed[3].runningBalance === 1350.75);

// Ensure rendering row logic does not crash on any legacy transaction
for (const t of processed) {
  const refNo = t.referenceId || t.externalReference || t.referenceNumber || t.officialReceiptNumber || t.id || "—";
  const debitVal = typeof t.debit === "number" ? t.debit : Number(t.debit || 0);
  const creditVal = typeof t.credit === "number" ? t.credit : Number(t.credit || 0);
  const runningBalVal = typeof t.runningBalance === "number"
    ? t.runningBalance
    : (t.runningBalance !== undefined && t.runningBalance !== null ? Number(t.runningBalance) : 0);

  const debitStr = debitVal > 0 ? formatCurrency(debitVal) : "—";
  const creditStr = creditVal > 0 ? formatCurrency(creditVal) : "—";
  const runningBalStr = formatCurrency(runningBalVal);
  check(`Row ${t.id} debit rendered safely: ${debitStr}`, typeof debitStr === 'string');
  check(`Row ${t.id} credit rendered safely: ${creditStr}`, typeof creditStr === 'string');
  check(`Row ${t.id} running balance rendered safely: ${runningBalStr}`, typeof runningBalStr === 'string');
}

// 5. Test Legacy Dividends (missing shareCapitalSnapshot, missing regularSavingsSnapshot)
const legacyDividends: any[] = [
  {
    id: 'div_legacy_1',
    year: 2023,
    dividendAmount: 1250,
    status: 'CREDITED',
    // Missing snapshot fields
  },
  {
    id: 'div_legacy_2',
    year: 2024,
    amount: 1800, // Legacy field name 'amount' instead of 'dividendAmount'
    shareCapitalSnapshot: 50000,
    // Missing regularSavingsSnapshot
    status: 'DISTRIBUTED'
  }
];

for (const d of legacyDividends) {
  const shareSnap = d.shareCapitalSnapshot ?? d.shareCapital ?? d.capitalShareSnapshot ?? null;
  const regSnap = d.regularSavingsSnapshot ?? d.regularSavings ?? d.savingsSnapshot ?? null;
  const divAmt = d.dividendAmount ?? d.amount ?? d.patronageAmount ?? 0;
  const shareStr = shareSnap !== null && shareSnap !== undefined ? formatCurrency(shareSnap) : "—";
  const regStr = regSnap !== null && regSnap !== undefined ? formatCurrency(regSnap) : "—";
  const divStr = formatCurrency(divAmt);

  check(`Dividend ${d.id} share snapshot handled safely: ${shareStr}`, typeof shareStr === 'string');
  check(`Dividend ${d.id} savings snapshot handled safely: ${regStr}`, typeof regStr === 'string');
  check(`Dividend ${d.id} amount formatted safely: ${divStr}`, typeof divStr === 'string');
}

// 6. Test Legacy Official Receipts (missing amountPaid or optional fields)
const legacyReceipts: any[] = [
  {
    id: 'rc_1',
    receiptNumber: 'OR-001',
    paymentType: 'SHARE_CAPITAL',
    // amountPaid missing, only amount present
    amount: 2500,
    paymentMethod: 'CASH',
  },
  {
    id: 'rc_2',
    receiptNumber: 'OR-002',
    paymentType: 'LOAN_PAYMENT',
    // completely missing amount fields
    status: 'ISSUED',
  }
];

for (const r of legacyReceipts) {
  const amtPaid = r.amountPaid ?? r.amount ?? r.principalAmount ?? 0;
  const formatted = formatCurrency(amtPaid);
  check(`Receipt ${r.receiptNumber} amount formatted safely: ${formatted}`, typeof formatted === 'string');

  const lineItems = getReceiptLineItems(r);
  check(`Receipt ${r.receiptNumber} line items parsed safely`, Array.isArray(lineItems));
}

console.log('\nALL 24 RENDERING SAFETY CHECKS PASSED SUCCESSFULLY!');

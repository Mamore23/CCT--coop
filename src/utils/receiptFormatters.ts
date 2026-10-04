import { OfficialReceipt } from '../types';

/**
 * Converts a numeric amount into formal words in uppercase (Philippine Peso standard).
 * Example: 1000 -> "ONE THOUSAND PESOS ONLY"
 * Example: 1250.50 -> "ONE THOUSAND TWO HUNDRED FIFTY PESOS & 50/100 ONLY"
 */
export function amountToWords(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'ZERO PESOS ONLY';
  }

  const units = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
    'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
  ];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
    return units[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
  };

  const pesos = Math.floor(Math.abs(amount));
  const centavos = Math.round((Math.abs(amount) - pesos) * 100);

  let result = '';

  if (pesos === 0) {
    result = 'ZERO PESOS';
  } else {
    const billions = Math.floor(pesos / 1000000000);
    const millions = Math.floor((pesos % 1000000000) / 1000000);
    const thousands = Math.floor((pesos % 1000000) / 1000);
    const remainder = pesos % 1000;

    const parts: string[] = [];
    if (billions > 0) parts.push(convertLessThanThousand(billions) + ' BILLION');
    if (millions > 0) parts.push(convertLessThanThousand(millions) + ' MILLION');
    if (thousands > 0) parts.push(convertLessThanThousand(thousands) + ' THOUSAND');
    if (remainder > 0) parts.push(convertLessThanThousand(remainder));

    result = parts.join(' ') + (pesos === 1 ? ' PESO' : ' PESOS');
  }

  if (centavos > 0) {
    result += ` & ${centavos}/100 ONLY`;
  } else {
    result += ' ONLY';
  }

  return result.trim();
}

/**
 * Formats a number to Philippine Peso standard currency format (₱X,XXX.XX)
 */
export function formatPesoAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₱0.00';
  return '₱' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export interface ReceiptLineItem {
  description: string;
  amount: number;
  subtext?: string;
  isBold?: boolean;
}

/**
 * Parses financial line items for an Official Receipt based on its payment type,
 * breakdown fields, and remarks.
 */
export function getReceiptLineItems(receipt: OfficialReceipt): ReceiptLineItem[] {
  const items: ReceiptLineItem[] = [];
  const totalPaid = receipt.amountPaid ?? (receipt as any).amount ?? 0;

  switch (receipt.paymentType) {
    case 'LOAN_PAYMENT': {
      const hasBreakdown = (receipt.principalAmount || 0) > 0 || (receipt.interestAmount || 0) > 0 || (receipt.penaltyAmount || 0) > 0;
      if (hasBreakdown) {
        if ((receipt.principalAmount || 0) > 0) {
          items.push({
            description: 'Loan Principal Amortization',
            amount: receipt.principalAmount!,
            subtext: receipt.loanTypeName ? `Product: ${receipt.loanTypeName}` : undefined
          });
        }
        if ((receipt.interestAmount || 0) > 0) {
          items.push({
            description: 'Loan Interest Payment',
            amount: receipt.interestAmount!
          });
        }
        if ((receipt.penaltyAmount || 0) > 0) {
          items.push({
            description: 'Penalty / Late Payment Surcharge',
            amount: receipt.penaltyAmount!
          });
        }
        if ((receipt.feeAmount || 0) > 0) {
          items.push({
            description: 'Processing / Administrative Fee',
            amount: receipt.feeAmount!
          });
        }
      } else {
        items.push({
          description: 'Loan Repayment / Amortization',
          amount: totalPaid,
          subtext: receipt.loanTypeName ? `Product: ${receipt.loanTypeName}` : (receipt.remarks || undefined)
        });
      }
      break;
    }

    case 'LOAN_RELEASE': {
      const approvedAmt = receipt.approvedAmount ?? totalPaid;
      const deductions = (receipt.feeAmount || 0) + (approvedAmt > totalPaid ? (approvedAmt - totalPaid) : 0);
      if (deductions > 0 && approvedAmt > totalPaid) {
        items.push({
          description: 'Approved Loan Principal Amount',
          amount: approvedAmt,
          subtext: receipt.loanTypeName ? `Product: ${receipt.loanTypeName}` : undefined
        });
        items.push({
          description: 'Less: Processing, Retention & Statutory Fees',
          amount: -deductions
        });
        items.push({
          description: 'Net Loan Proceeds Disbursed',
          amount: totalPaid,
          isBold: true
        });
      } else {
        items.push({
          description: 'Loan Disbursement Proceeds',
          amount: totalPaid,
          subtext: receipt.loanTypeName ? `Product: ${receipt.loanTypeName}` : (receipt.remarks || undefined)
        });
      }
      break;
    }

    case 'INITIAL_SHARE': {
      items.push({
        description: 'Initial Share Capital Contribution',
        amount: totalPaid,
        subtext: 'Mandatory Minimum Share Capital for Cooperative Membership'
      });
      break;
    }

    case 'SHARE_CAPITAL': {
      const isInitial = receipt.remarks?.toLowerCase().includes('initial') || totalPaid === 1000;
      items.push({
        description: isInitial ? 'Initial Share Capital Contribution' : 'Share Capital Contribution / Subscription',
        amount: totalPaid,
        subtext: receipt.remarks || 'Capital Build-Up Equity Contribution'
      });
      break;
    }

    case 'SAVINGS_DEPOSIT': {
      items.push({
        description: 'Regular Savings Deposit',
        amount: totalPaid,
        subtext: receipt.remarks || 'Member Voluntary Savings Deposit'
      });
      break;
    }

    case 'TIME_DEPOSIT': {
      items.push({
        description: 'Time Deposit Placement',
        amount: totalPaid,
        subtext: receipt.remarks || 'Fixed-term High Yield Cooperative Deposit'
      });
      break;
    }

    case 'FEE': {
      items.push({
        description: 'Cooperative Membership / Processing Fee',
        amount: totalPaid,
        subtext: receipt.remarks || 'Standard Processing Fee'
      });
      break;
    }

    default: {
      const desc = receipt.remarks || (receipt.paymentType ? receipt.paymentType.replace(/_/g, ' ') : 'Financial Payment');
      items.push({
        description: desc,
        amount: totalPaid
      });
      break;
    }
  }

  // Fallback: If no items were created, push the total
  if (items.length === 0) {
    items.push({
      description: receipt.remarks || 'Official Payment',
      amount: totalPaid
    });
  }

  return items;
}

/**
 * Returns a human-readable purpose label for the receipt
 */
export function getReceiptPurpose(receipt: OfficialReceipt): string {
  if (receipt.paymentType === 'INITIAL_SHARE') return 'Initial Share Capital';
  if (receipt.paymentType === 'SHARE_CAPITAL') {
    if (receipt.remarks?.toLowerCase().includes('initial')) return 'Initial Share Capital';
    return 'Share Capital Subscription';
  }
  if (receipt.paymentType === 'SAVINGS_DEPOSIT') return 'Regular Savings Deposit';
  if (receipt.paymentType === 'LOAN_PAYMENT') return 'Loan Repayment';
  if (receipt.paymentType === 'LOAN_RELEASE') return 'Loan Disbursement / Release';
  if (receipt.paymentType === 'TIME_DEPOSIT') return 'Time Deposit Placement';
  if (receipt.paymentType === 'FEE') return 'Membership / Administrative Fee';
  if (receipt.remarks) return receipt.remarks;
  return receipt.paymentType ? receipt.paymentType.replace(/_/g, ' ') : 'Cooperative Financial Transaction';
}

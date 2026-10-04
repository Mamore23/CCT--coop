/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import { CooperativeDB, defaultComplianceConfig } from '../db/db.js';
import { authenticateJWT, requireRole, requirePermission, getUserEffectivePermissions, AuthenticatedRequest } from './auth.js';
import { generateDescriptiveAnalysis, generateOperationalDescriptiveAnalysis } from '../utils/descriptiveAnalyticsEngine.js';
import { Member, Staff, User, LoanType, LoanApplication, Loan, LoanPayment, DividendPeriod, MemberDividend, MemberPatronageRefund, Inquiry, InquiryReply, SmsNotification, SmsTriggerType, MemberDocument, Role, PaymentRequest, PaymentAllocationItem, OfficialReceipt, ReceiptPrintLog, DatabaseState, LoanEligibilityCheck, LoanApplicationDocument, AmortizationItem, Transaction, TimeDepositContract, TimeDepositProductConfig, ComplianceRecord, ComplianceStatus, ComplianceConfig, StructuredEligibilityResponse, LoanStatus, NotificationMetadata } from '../types.js';
import { getFirebaseServerConfigStatus } from './firebaseAdmin.js';
import { sendMemberNotificationEmail, getRecordedNotificationEmails, clearRecordedNotificationEmails } from './emailService.js';
import { runAutomatedLoanDueDateEmailScan } from './jobs.js';

// Connect CooperativeDB notifications to background Email delivery to member's registered email
CooperativeDB.setNotificationHook(async (userId: string, title: string, message: string, metadata?: NotificationMetadata) => {
  // If notification metadata indicates email was already handled or should be skipped, do not duplicate
  if (metadata?.skipAutoEmail) {
    return;
  }

  // Email Delivery Attempt (to member's registered email)
  let emailSent = false;
  let emailError: string | undefined;
  let emailProvider: string = 'UNCONFIGURED';

  try {
    const db = CooperativeDB.load();
    const member = (db.members || []).find(m => m.id === userId || m.memberNumber === userId)
      || (db.users || []).find(u => u.id === userId || u.memberId === userId)
      || (db.staff || []).find(s => s.id === userId);

    const recipientEmail = member?.email;
    const recipientName = (member as any)?.fullName || 'Valued Member';
    const coopName = db.systemSettings?.cooperativeName || 'CCT Credit Cooperative';

    if (recipientEmail && recipientEmail.includes('@')) {
      // Parse any inline reference / amount / dueDate from metadata or message
      let loanNum = metadata?.loanNumber || metadata?.loanId;
      let refNum = metadata?.referenceNumber || metadata?.receiptNumber;
      let amt = metadata?.amount;
      let due = metadata?.dueDate;

      if (!loanNum) {
        const lnMatch = message.match(/(?:loan|ref|application)(?:\s*(?:#|no\.?|for))?\s*([A-Za-z0-9_-]{4,})/i);
        if (lnMatch) loanNum = lnMatch[1];
      }
      if (!refNum) {
        const orMatch = message.match(/(?:Official Receipt|Receipt|Reference|OR)[\s:#]+([A-Za-z0-9_-]{3,})/i);
        if (orMatch) refNum = orMatch[1];
      }
      if (amt === undefined) {
        const amtMatch = message.match(/[₱$]\s*([\d,]+(?:\.\d{2})?)/);
        if (amtMatch) amt = Number(amtMatch[1].replace(/,/g, ''));
      }
      if (!due) {
        const dueMatch = message.match(/(?:due(?:\s*(?:on|date|today))?[:\s]+)?([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
        if (dueMatch) due = dueMatch[1];
      }

      const emailResult = await sendMemberNotificationEmail({
        toEmail: recipientEmail,
        fullName: recipientName,
        title,
        message,
        loanNumber: loanNum,
        referenceNumber: refNum,
        amount: amt,
        dueDate: due,
        actionUrl: metadata?.actionUrl || `${process.env.APP_URL || 'http://localhost:3000'}/?tab=member-notifications`,
        actionLabel: metadata?.actionLabel || 'View in Portal',
        cooperativeName: coopName,
        testTransportMode: metadata?.testTransportMode
      });

      emailSent = emailResult.sent;
      emailProvider = emailResult.provider;
      emailError = emailResult.error;
    }
  } catch (err: any) {
    emailError = err?.message || String(err);
    console.warn('[Email Auto-Notify] Hook notice (non-fatal):', emailError);
  }

  // Record delivery results on the notification record in db without mutating financial records
  try {
    const db = CooperativeDB.load();
    const notif = (db.notifications || []).find(n => n.userId === userId && n.title === title);
    if (notif) {
      notif.deliveryStatus = {
        email: { attempted: true, success: emailSent, provider: emailProvider, error: emailError, sentAt: new Date().toISOString() }
      };
      notif.emailSent = emailSent;
      CooperativeDB.save(db);
    }
  } catch (statusErr) {
    console.warn('[Notification Status] Non-fatal delivery status update issue:', statusErr);
  }
});

export function numberToWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Zero Pesos Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
    return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
  };

  const pesos = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);

  let result = '';

  if (pesos === 0) {
    result = 'Zero Pesos';
  } else {
    const billions = Math.floor(pesos / 1000000000);
    const millions = Math.floor((pesos % 1000000000) / 1000000);
    const thousands = Math.floor((pesos % 1000000) / 1000);
    const remainder = pesos % 1000;

    let parts: string[] = [];
    if (billions > 0) parts.push(convertLessThanThousand(billions) + ' Billion');
    if (millions > 0) parts.push(convertLessThanThousand(millions) + ' Million');
    if (thousands > 0) parts.push(convertLessThanThousand(thousands) + ' Thousand');
    if (remainder > 0) parts.push(convertLessThanThousand(remainder));

    result = parts.join(' ') + ' Pesos';
  }

  if (centavos > 0) {
    result += ` and ${centavos}/100 Centavos`;
  } else {
    result += ' Only';
  }

  return result;
}

export function generateNextReceiptNumber(db: DatabaseState): string {
  if (!db.receiptSettings) {
    db.receiptSettings = {
      orPrefix: 'OR-',
      orNextNumber: 1001,
      numberPadding: 6,
      headerTitle: 'CCT CREDIT COOPERATIVE INC.',
      cdaRegNo: 'CDA-REG-98765-PH',
      tin: '008-123-456-000',
      address: '123 Cooperative Blvd, Quezon City, Metro Manila, Philippines',
      contactPhone: '+1 (555) 019-2834',
      contactEmail: 'cashier@alliancecoop.org',
      logoUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=150&auto=format&fit=crop&q=80',
      footerNote: 'This is an Official Receipt generated by CCT Cooperative Core Financial System. Thank you for building your cooperative equity!',
      authorizedSignatoryName: 'Jane Smith',
      authorizedSignatoryTitle: 'Chief Cashier & Finance Officer'
    };
  }

  if (!db.officialReceipts) {
    db.officialReceipts = [];
  }

  const prefix = db.receiptSettings.orPrefix || 'OR-';
  let nextNum = db.receiptSettings.orNextNumber || 1001;
  const padding = db.receiptSettings.numberPadding || 6;

  let candidate = `${prefix}${String(nextNum).padStart(padding, '0')}`;

  while (db.officialReceipts.some(r => r.receiptNumber === candidate)) {
    nextNum++;
    candidate = `${prefix}${String(nextNum).padStart(padding, '0')}`;
  }

  db.receiptSettings.orNextNumber = nextNum + 1;
  return candidate;
}

export function createOfficialReceipt(
  db: DatabaseState,
  params: {
    memberId: string;
    memberName: string;
    memberNumber?: string;
    paymentType: 'LOAN_RELEASE' | 'LOAN_PAYMENT' | 'SAVINGS_DEPOSIT' | 'SHARE_CAPITAL' | 'INITIAL_SHARE' | 'TIME_DEPOSIT' | 'DIVIDEND_CREDIT' | 'PATRONAGE_REFUND' | 'FEE' | 'OTHER';
    paymentMethod: 'CASH' | 'GCASH' | 'BANK_TRANSFER' | 'CHECK' | 'SAVINGS' | 'OTHER';
    amount: number;
    paymentDate: string;
    issuedBy: string;
    issuedById?: string;
    transactionId?: string;
    internalReference?: string;
    applicationId?: string;
    loanId?: string;
    loanNumber?: string;
    loanTypeName?: string;
    approvedAmount?: number;
    releasedAmount?: number;
    releaseMethod?: string;
    gcashDetails?: {
      refNumber?: string;
      accountName?: string;
      mobileNumber?: string;
    };
    transactionReferenceNumber?: string;
    releaseDate?: string;
    authorizedStaff?: string;
    digitalApproval?: string;
    qrVerification?: string;
    principalAmount?: number;
    interestAmount?: number;
    penaltyAmount?: number;
    feeAmount?: number;
    remarks?: string;
  }
): OfficialReceipt {
  if (!db.officialReceipts) db.officialReceipts = [];

  const receiptNumber = generateNextReceiptNumber(db);
  const id = 'or_' + Math.random().toString(36).substring(2, 11);

  const newReceipt: OfficialReceipt = {
    id,
    receiptNumber,
    transactionId: params.transactionId,
    
    applicationId: params.applicationId,
    loanId: params.loanId,
    loanNumber: params.loanNumber,
    loanTypeName: params.loanTypeName,
    memberId: params.memberId,
    memberNumber: params.memberNumber,
    memberName: params.memberName,
    paymentType: params.paymentType,
    paymentMethod: params.paymentMethod,
    releaseMethod: params.releaseMethod || params.paymentMethod,
    approvedAmount: params.approvedAmount ?? params.amount,
    releasedAmount: params.releasedAmount ?? params.amount,
    amountPaid: params.amount,
    amountInWords: numberToWords(params.amount),
    principalAmount: params.principalAmount,
    interestAmount: params.interestAmount,
    penaltyAmount: params.penaltyAmount,
    feeAmount: params.feeAmount,
    gcashDetails: params.gcashDetails,
    transactionReferenceNumber: params.transactionReferenceNumber || params.internalReference,
    releaseDate: params.releaseDate || params.paymentDate,
    paymentDate: params.paymentDate,
    issuedAt: new Date().toISOString(),
    issuedBy: params.issuedBy,
    issuedById: params.issuedById,
    authorizedStaff: params.authorizedStaff || params.issuedBy,
    digitalApproval: params.digitalApproval || `APPROVED DIGITALLY BY ${params.issuedBy.toUpperCase()} ON ${new Date().toISOString()}`,
    qrVerification: params.qrVerification || `VERIFY-OR:${receiptNumber}|APP:${params.applicationId || 'N/A'}|LN:${params.loanNumber || params.loanId || 'N/A'}|MEM:${params.memberId}|AMT:${params.amount}`,
    remarks: params.remarks,
    status: 'ISSUED',
    reprintCount: 0,
    printLogs: []
  };

  db.officialReceipts.unshift(newReceipt);
  return newReceipt;
}

export function ensureDisbursementReceiptForLoan(
  db: DatabaseState,
  loan?: Loan | null,
  app?: LoanApplication | null
): OfficialReceipt {
  if (!db.officialReceipts) db.officialReceipts = [];

  const targetAppId = app?.id || loan?.applicationId;
  const targetLoanId = loan?.id || (app ? `ln_${app.id}` : undefined);
  const targetLoanNumber = loan?.id?.substring(0, 8).toUpperCase() || (app ? app.id.substring(0, 8).toUpperCase() : undefined);

  // Check if a receipt already exists in db.officialReceipts
  const existing = db.officialReceipts.find(r =>
    (targetAppId && r.applicationId === targetAppId) ||
    (targetLoanId && r.loanId === targetLoanId) ||
    (targetLoanNumber && r.loanNumber === targetLoanNumber)
  );

  if (existing) {
    return existing;
  }

  const memberId = loan?.memberId || app?.memberId || 'UNKNOWN';
  const member = db.members.find(m => m.id === memberId);
  const memberName = loan?.memberName || app?.memberName || member?.fullName || 'Valued Member';
  const loanTypeName = loan?.loanTypeName || app?.loanTypeName || 'Cooperative Loan';
  const amount = loan?.principalAmount || app?.amount || 0;
  const appId = targetAppId || `APP-${loan?.id?.substring(0, 8)}`;
  const loanId = targetLoanId || `ln_${appId}`;
  const loanNum = targetLoanNumber || loanId.substring(0, 8).toUpperCase();
  const relDate = loan?.disbursedAt || app?.updatedAt || app?.createdAt || new Date().toISOString().split('T')[0];
  const method = (loan?.releaseMethod || (app as any)?.disbursementMethod || 'CASH').toUpperCase() as any;
  const refNum = loan?.transactionReferenceNumber || '';
  const staffName = loan?.releasedBy || 'Finance Cashier / Staff';

  return createOfficialReceipt(db, {
    memberId,
    memberName,
    memberNumber: member?.memberNumber || memberId.substring(0, 8),
    paymentType: 'LOAN_RELEASE',
    paymentMethod: method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : method === 'GCASH' ? 'GCASH' : 'CASH',
    amount: amount,
    paymentDate: relDate,
    issuedBy: staffName,
    issuedById: 'system_disbursement',
    transactionId: `tx_release_${loanId}`,
    internalReference: refNum ? `RELEASE-${method}-${refNum}` : `RELEASE-LN-${loanNum}`,
    applicationId: appId,
    loanId,
    loanNumber: loanNum,
    loanTypeName,
    approvedAmount: app?.amount || amount,
    releasedAmount: amount,
    releaseMethod: method,
    gcashDetails: method === 'GCASH' ? {
      refNumber: refNum,
      accountName: member?.gcashAccountName || memberName,
      mobileNumber: member?.gcashNumber || (member as any)?.mobileNumber || ''
    } : undefined,
    transactionReferenceNumber: refNum,
    releaseDate: relDate,
    authorizedStaff: staffName,
    digitalApproval: `APPROVED DIGITALLY BY DISBURSEMENT SYSTEM ON ${new Date(relDate).toISOString()}`,
    qrVerification: `VERIFY-OR|APP:${appId}|LN:${loanNum}|MEM:${memberId}|AMT:${amount}`,
    principalAmount: amount,
    interestAmount: loan?.interestAmount || 0,
    remarks: loan?.releaseRemarks || `OFFICIAL LOAN DISBURSEMENT RECEIPT: Released ${loanTypeName} principal of ₱${amount.toLocaleString()} via ${method}${refNum ? ' (Ref: ' + refNum + ')' : ''}.`
  });
}

export const apiRouter = Router();

// Public Landing Content
apiRouter.get('/public/landing-content', (req, res) => {
  const db = CooperativeDB.load();
  
  // Calculate basic public stats safely
  const numMembers = db.members.filter(m => m.status === 'ACTIVE').length;
  const numApprovedLoans = db.loans.length;
  const totalLoansReleased = db.loans.reduce((sum, l) => sum + (l.principalAmount || 0), 0);
  
  res.json({
    content: db.landingContent || {},
    stats: {
      numMembers,
      numApprovedLoans,
      totalLoansReleased
    },
    settings: {
      cooperativeName: db.systemSettings.cooperativeName,
      contactEmail: db.systemSettings.contactEmail,
      contactPhone: db.systemSettings.contactPhone,
      address: db.systemSettings.address,
    }
  });
});

// Admin Update Landing Content
apiRouter.post('/admin/landing-content', requireRole(['ADMIN']), (req, res) => {
  const db = CooperativeDB.load();
  db.landingContent = { ...db.landingContent, ...req.body };
  CooperativeDB.save(db);
  res.json({ message: 'Landing content updated successfully' });
});


// Public System Settings (accessible without authentication for login page/branding)
apiRouter.get('/settings', (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json(db.systemSettings);
});

// Public Inquiry Submission (accessible without authentication from Landing Page)
apiRouter.post('/public/inquiry', (req: Request, res: Response) => {
  const { senderName, email, phone, category, subject, message } = req.body;
  if (!senderName || !email || !message) {
    res.status(400).json({ error: 'Name, email, and message are required.' });
    return;
  }

  const db = CooperativeDB.load();
  if (!db.inquiries) db.inquiries = [];

  const newInquiry: Inquiry = {
    id: 'inq_' + Math.random().toString(36).substring(2, 11),
    memberId: 'guest_' + Math.random().toString(36).substring(2, 7),
    memberName: `${senderName} (Public Visitor)`,
    category: category || 'General Inquiry',
    subject: subject || `Inquiry from ${senderName}`,
    message: `${message}\n\n[Contact Info: ${email} | Phone: ${phone || 'N/A'}]`,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    replies: []
  };

  db.inquiries.unshift(newInquiry);
  CooperativeDB.save(db);

  res.json({ message: 'Inquiry submitted successfully!', inquiry: newInquiry });
});

// Apply auth middleware to all subsequent routes
apiRouter.use(authenticateJWT);

// Update theme preference for current authenticated user
apiRouter.put('/user/theme', (req: Request, res: Response) => {
  const { theme } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;
  if (!theme || !['light', 'dark', 'system'].includes(theme)) {
    res.status(400).json({ error: 'Invalid theme value' });
    return;
  }
  const db = CooperativeDB.load();
  const user = db.users.find(u => u.id === tokenUser.id);
  if (user) {
    user.themePreference = theme;
    CooperativeDB.save(db);
  }
  res.json({ message: 'Theme preference updated', theme });
});

// ============================================================================
// 1. DASHBOARD & ANALYTICS STATS
// ============================================================================

apiRouter.get('/transactions', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const { search, type, paymentMethod, startDate, endDate, status, memberId } = req.query;

  let rawList = db.transactions || [];
  if (memberId) {
    rawList = rawList.filter(t => t.memberId === memberId);
  }

  // Pre-index receipts by transactionId and receiptNumber for exact matching
  const receiptsByTxId = new Map<string, OfficialReceipt>();
  const receiptsByNumber = new Map<string, OfficialReceipt>();
  const receiptsByRef = new Map<string, OfficialReceipt>();
  const receiptsByMember = new Map<string, OfficialReceipt[]>();

  for (const r of (db.officialReceipts || [])) {
    if (r.transactionId) {
      receiptsByTxId.set(r.transactionId, r);
    }
    if (r.receiptNumber) {
      receiptsByNumber.set(r.receiptNumber, r);
    }
    if (r.paymentReference) {
      receiptsByRef.set(r.paymentReference, r);
    }
    if (r.applicationId) {
      receiptsByRef.set(r.applicationId, r);
    }
    if (r.loanId) {
      receiptsByRef.set(r.loanId, r);
    }
    if (!receiptsByMember.has(r.memberId)) {
      receiptsByMember.set(r.memberId, []);
    }
    receiptsByMember.get(r.memberId)!.push(r);
  }

  // Build posting to receipt mapping for ledger transactions
  const postingReceiptByTxId = new Map<string, string>();
  (db.financialPostings || []).forEach(p => {
    if (p.ledgerTransactionId && p.officialReceiptNo) {
      postingReceiptByTxId.set(p.ledgerTransactionId, p.officialReceiptNo);
    }
  });

  let transactions: any[] = rawList.map((tx: any) => {
    // 1. Direct match on officialReceiptNumber
    let or: OfficialReceipt | undefined;
    if (tx.officialReceiptNumber) {
      or = receiptsByNumber.get(tx.officialReceiptNumber);
    }
    // 2. Direct match on exact transactionId link
    if (!or) {
      or = receiptsByTxId.get(tx.id);
    }
    // 3. Match via financial posting ledger linkage
    if (!or) {
      const orNoFromPosting = postingReceiptByTxId.get(tx.id);
      if (orNoFromPosting) {
        or = receiptsByNumber.get(orNoFromPosting);
      }
    }
    // 4. Match on specific referenceId if it maps to a unique payment receipt reference
    if (!or && tx.referenceId) {
      or = receiptsByRef.get(tx.referenceId);
    }

    return {
      ...tx,
      officialReceiptNumber: tx.officialReceiptNumber || (or ? or.receiptNumber : undefined),
      paymentMethod: tx.paymentMethod || tx.releaseMethod || (or ? or.paymentMethod : 'CASH'),
      status: tx.status || 'COMPLETED'
    };
  });

  if (search) {
    const q = (search as string).toLowerCase();
    transactions = transactions.filter(t => 
      t.id.toLowerCase().includes(q) ||
      t.memberName.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.externalReference && t.externalReference.toLowerCase().includes(q)) ||
      (t.officialReceiptNumber && t.officialReceiptNumber.toLowerCase().includes(q))
    );
  }

  if (type) {
    transactions = transactions.filter(t => t.type === type);
  }

  if (paymentMethod) {
    transactions = transactions.filter(t => t.paymentMethod === paymentMethod);
  }

  if (startDate) {
    transactions = transactions.filter(t => new Date(t.createdAt) >= new Date(startDate as string));
  }
  if (endDate) {
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);
    transactions = transactions.filter(t => new Date(t.createdAt) <= end);
  }
  
  if (status) {
    transactions = transactions.filter(t => t.status === status);
  }

  res.json(transactions);
});

// Master Cooperative Ledger (ADMIN / STAFF only)
apiRouter.get('/ledger', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json({ transactions: db.transactions || [], count: (db.transactions || []).length });
});

const handleGetDashboardStats = (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  if (tokenUser.role === 'MEMBER') {
    // Member Dashboard stats
    const member = db.members.find(m => m.id === tokenUser.id || (tokenUser.memberId && m.id === tokenUser.memberId) || (tokenUser.email && m.email.toLowerCase() === tokenUser.email.toLowerCase()));
    if (!member) {
      res.status(404).json({ error: 'Member record not found' });
      return;
    }

    const activeLoans = db.loans.filter(l => (l.memberId === member.id || l.memberId === tokenUser.id) && l.status === 'ACTIVE');
    const totalActiveLoansBalance = activeLoans.reduce((sum, l) => sum + l.balance, 0);

    const recentTx = db.transactions
      .filter(t => t.memberId === member.id || t.memberId === tokenUser.id)
      .slice(0, 5);

    const memberInquiries = db.inquiries.filter(i => i.memberId === member.id || i.memberId === tokenUser.id);

    const memberStats = {
      shareCapital: member.shareCapital ?? 0,
      regularSavings: member.regularSavings ?? 0,
      timeDeposits: member.timeDeposits ?? 0,
      totalSavings: (member.shareCapital ?? 0) + (member.regularSavings ?? 0) + (member.timeDeposits ?? 0),
      dividendsEarned: member.dividendsEarned ?? 0,
      activeLoansCount: activeLoans.length,
      activeLoansBalance: totalActiveLoansBalance ?? 0,
      recentTransactions: recentTx,
      inquiriesCount: memberInquiries.length
    };

    res.json({
      role: 'MEMBER',
      stats: memberStats,
      ...memberStats
    });
  } else {
    // Admin / Staff Dashboard stats
    const totalMembers = db.members.length;
    const activeMembers = db.members.filter(m => m.status === 'ACTIVE').length;
    const pendingMembers = db.members.filter(m => m.status === 'PENDING').length;
    const staffCount = db.staff.length;

    const totalShareCapital = db.members.reduce((sum, m) => sum + (m.shareCapital ?? 0), 0);
    const totalRegularSavings = db.members.reduce((sum, m) => sum + (m.regularSavings ?? 0), 0);
    const totalTimeDeposits = db.members.reduce((sum, m) => sum + (m.timeDeposits ?? 0), 0);
    const totalSavingsVolume = totalShareCapital + totalRegularSavings + totalTimeDeposits;

    const activeLoans = db.loans.filter(l => l.status === 'ACTIVE');
    const totalOutstandingLoans = activeLoans.reduce((sum, l) => sum + (l.balance ?? 0), 0);

    const pendingLoanApplicationsCount = db.loanApplications.filter(a => a.status === 'PENDING_REVIEW' || a.status === 'UNDER_REVIEW').length;
    const openInquiriesCount = db.inquiries.filter(i => i.status === 'OPEN' || i.status === 'IN_PROGRESS').length;

    const recentTx = db.transactions.slice(0, 8);
    const auditLogsCount = db.auditLogs.length;

    // Total Dividends calculated from dividend period logs
    const totalDividends = (db.memberDividends || []).reduce((sum, d) => sum + (d.dividendAmount ?? 0), 0);

    // Cooperative Assets = Savings Volume + Loans Outstanding
    const totalCooperativeAssets = totalSavingsVolume + totalOutstandingLoans;

    // Create high-fidelity descriptive analytics data
    const depositSum = db.transactions.filter(t => t.type === 'DEPOSIT').reduce((sum, t) => sum + t.amount, 0);
    const withdrawalSum = db.transactions.filter(t => t.type === 'WITHDRAWAL').reduce((sum, t) => sum + t.amount, 0);
    const loanReleaseSum = db.transactions.filter(t => t.type === 'LOAN_RELEASE').reduce((sum, t) => sum + t.amount, 0);
    const loanPaymentSum = db.transactions.filter(t => t.type === 'LOAN_PAYMENT').reduce((sum, t) => sum + t.amount, 0);

    const transactionSummary = [
      { name: 'Deposits', amount: depositSum || 125000 },
      { name: 'Withdrawals', amount: withdrawalSum || 45000 },
      { name: 'Disbursements', amount: loanReleaseSum || 85000 },
      { name: 'Loan Payments', amount: loanPaymentSum || 32000 }
    ];

    const assetsTrend = [
      { month: 'Jan', assets: Math.round(totalCooperativeAssets * 0.85) || 150000, savings: Math.round(totalSavingsVolume * 0.85) || 110000 },
      { month: 'Feb', assets: Math.round(totalCooperativeAssets * 0.90) || 165000, savings: Math.round(totalSavingsVolume * 0.90) || 120000 },
      { month: 'Mar', assets: Math.round(totalCooperativeAssets * 0.92) || 180000, savings: Math.round(totalSavingsVolume * 0.91) || 135050 },
      { month: 'Apr', assets: Math.round(totalCooperativeAssets * 0.95) || 195000, savings: Math.round(totalSavingsVolume * 0.94) || 142000 },
      { month: 'May', assets: Math.round(totalCooperativeAssets) || 215000, savings: Math.round(totalSavingsVolume) || 160000 }
    ];

    const savingsDistribution = [
      { name: 'Share Capital', value: totalShareCapital || 45000 },
      { name: 'Regular Savings', value: totalRegularSavings || 85000 },
      { name: 'Time Deposits', value: totalTimeDeposits || 30000 }
    ];

    res.json({
      role: tokenUser.role,
      stats: {
        totalMembers,
        activeMembers,
        pendingMembers,
        staffCount,
        totalSavingsVolume,
        totalShareCapital,
        totalRegularSavings,
        totalTimeDeposits,
        totalOutstandingLoans,
        totalDividends,
        totalCooperativeAssets,
        activeLoansCount: activeLoans.length,
        pendingLoanApplicationsCount,
        openInquiriesCount,
        recentTransactions: recentTx,
        auditLogsCount,
        analytics: {
          transactionSummary,
          assetsTrend,
          savingsDistribution
        }
      }
    });
  }
};

apiRouter.get('/dashboard/stats', handleGetDashboardStats);
apiRouter.get('/member/dashboard', handleGetDashboardStats);
apiRouter.get('/members/dashboard', handleGetDashboardStats);
apiRouter.get('/dashboard/member', handleGetDashboardStats);

// ============================================================================
// 2. SAVINGS MANAGEMENT (CASHIER & LEDGER)
// ============================================================================

// Cashier & Staff Deposit/Withdrawal Transaction (Direct posting restricted to Staff/Admin)
apiRouter.post('/savings/transaction', requireRole(['ADMIN', 'STAFF']), requirePermission('savings'), (req: Request, res: Response) => {
  const { memberId, type, accountType, amount, description, releaseMethod, externalReference, paymentMethod } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const txAmount = Number(amount);
  if (!memberId || !type || !accountType || amount === undefined || amount === null || typeof amount !== 'number' || isNaN(txAmount) || txAmount <= 0) {
    res.status(400).json({ error: 'Invalid savings transaction request parameters' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === memberId);
  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  if (!member.initialShareCapitalPaid) {
    res.status(400).json({ error: 'Member must have a verified Initial Share Capital payment to access savings and deposit products.' });
    return;
  }

  const effectivePaymentMethod = paymentMethod || releaseMethod || 'CASH';
  const effectiveGcashRef = externalReference || req.body.externalReference || req.body.gcashReferenceNumber;

  const operatorName = tokenUser.role === 'ADMIN'
    ? 'Admin'
    : (tokenUser.role === 'MEMBER'
        ? member.fullName
        : (db.staff.find(s => s.id === tokenUser.id)?.fullName || 'Staff'));

  if ((type === 'WITHDRAWAL' || type === 'REFUND') && effectivePaymentMethod === 'GCASH') {
    if (!member.gcashNumber) {
      res.status(400).json({ error: 'Member does not have a registered GCash number in their profile.' });
      return;
    }
    if (!effectiveGcashRef) {
      res.status(400).json({ error: 'GCash Transaction Reference Number is required for GCash withdrawals.' });
      return;
    }
  }

  if (accountType === 'timeDeposits') {
    res.status(400).json({ error: 'Time Deposits must be opened as a fixed-term contract via the Time Deposit placement interface.' });
    return;
  }

  if (type === 'DEPOSIT') {
    let pType: 'SHARE_CAPITAL' | 'REGULAR_SAVINGS' = 'REGULAR_SAVINGS';
    if (accountType === 'shareCapital') pType = 'SHARE_CAPITAL';
    else if (accountType === 'regularSavings') pType = 'REGULAR_SAVINGS';
    else {
      res.status(400).json({ error: 'Invalid savings account type' });
      return;
    }

    const clientTxKey = req.body.clientTxKey || req.body.transactionKey;
    const postingKeys = clientTxKey
      ? [`SAVINGS_TX:${clientTxKey}`]
      : (effectivePaymentMethod === 'GCASH' && effectiveGcashRef
          ? [`GCASH_REF:${effectiveGcashRef}`]
          : [`SAVINGS_DEP:${member.id}_${txAmount}_${Date.now()}`]);

    let generatedReceipt: OfficialReceipt | undefined;
    let updatedMember: Member | undefined;

    const postResult = CooperativeDB.postFinancialTransaction({
      postingKeys,
      paymentSource: 'SAVINGS_TRANSACTION',
      memberId: member.id,
      memberName: member.fullName,
      amount: txAmount,
      postingType: pType,
      postedBy: tokenUser.email,
      gcashRefNumber: effectivePaymentMethod === 'GCASH' ? effectiveGcashRef : undefined,
      executePosting: (currentDb) => {
        const targetMember = currentDb.members.find(m => m.id === member.id)!;
        if (accountType === 'shareCapital') {
          targetMember.shareCapital = (targetMember.shareCapital || 0) + txAmount;
        } else if (accountType === 'regularSavings') {
          targetMember.regularSavings = (targetMember.regularSavings || 0) + txAmount;
        } else if (accountType === 'timeDeposits') {
          targetMember.timeDeposits = (targetMember.timeDeposits || 0) + txAmount;
        }

        updatedMember = targetMember;

        const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
        const ledgerTx: Transaction = {
          id: txId,
          memberId: targetMember.id,
          memberName: targetMember.fullName,
          type: 'DEPOSIT',
          amount: txAmount,
          description: description || `Deposit to ${accountType.replace(/([A-Z])/g, ' $1')}`,
          processedBy: operatorName,
          createdAt: new Date().toISOString(),
          releaseMethod: effectivePaymentMethod,
          externalReference: effectivePaymentMethod === 'GCASH' ? effectiveGcashRef : undefined
        };
        currentDb.transactions.unshift(ledgerTx);

        const receipt = createOfficialReceipt(currentDb, {
          memberId: targetMember.id,
          memberName: targetMember.fullName,
          memberNumber: targetMember.memberNumber || targetMember.id.substring(0, 8),
          paymentType: accountType === 'shareCapital' ? 'SHARE_CAPITAL' : 'SAVINGS_DEPOSIT',
          paymentMethod: effectivePaymentMethod === 'GCASH' ? 'GCASH' : 'CASH',
          amount: txAmount,
          paymentDate: new Date().toISOString().split('T')[0],
          issuedBy: operatorName,
          issuedById: tokenUser.id,
          transactionId: txId,
          internalReference: `REF-${txId.substring(0, 8).toUpperCase()}`,
          remarks: description || `Deposit to ${accountType.replace(/([A-Z])/g, ' $1')}`,
          gcashDetails: effectivePaymentMethod === 'GCASH' && effectiveGcashRef ? { refNumber: effectiveGcashRef } : undefined,
          transactionReferenceNumber: effectivePaymentMethod === 'GCASH' ? effectiveGcashRef : undefined
        });

        generatedReceipt = receipt;

        CooperativeDB.createNotification(targetMember.id, 'Deposit Credited & Official Receipt Issued', `Your deposit of ₱${txAmount.toLocaleString()} to ${accountType.replace(/([A-Z])/g, ' $1')} has been completed. Official Receipt: ${receipt.receiptNumber}`);

        return {
          ledgerTransaction: ledgerTx,
          officialReceipt: receipt
        };
      }
    });

    if (!postResult.success) {
      if (postResult.isAlreadyProcessed) {
        res.json({
          message: 'This deposit transaction has already been processed.',
          status: 'ALREADY_PROCESSED',
          officialReceiptNo: postResult.existingPosting?.officialReceiptNo,
          receipt: (postResult.existingPosting as any)?.data?.officialReceipt,
          member
        });
        return;
      }
      res.status(400).json({ error: postResult.message || 'Failed to process deposit.' });
      return;
    }

    CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'SAVINGS_DEPOSIT', `Deposited ₱${txAmount} to ${member.fullName}'s ${accountType}. Issued Official Receipt ${postResult.officialReceipt?.receiptNumber}.`);

    res.json({ message: 'Deposit successfully processed and Official Receipt issued!', member: updatedMember, receipt: postResult.officialReceipt });
  } else if (type === 'WITHDRAWAL' || type === 'REFUND') {
    // Validate withdrawal balance
    if (accountType === 'shareCapital' && type !== 'REFUND') {
      res.status(400).json({ error: 'Share Capital cannot be withdrawn. It represents ownership in the cooperative. Membership termination is required for refunds.' });
      return;
    } else if (accountType === 'shareCapital' && type === 'REFUND') {
      if (member.shareCapital < txAmount) {
        res.status(400).json({ error: `Insufficient Share Capital balance for refund. Available: ₱${member.shareCapital.toLocaleString()}` });
        return;
      }
    } else if (accountType === 'regularSavings') {
      if (member.regularSavings < txAmount) {
        res.status(400).json({ error: `Insufficient Regular Savings balance. Available: ₱${member.regularSavings.toLocaleString()}` });
        return;
      }
    } else if (accountType === 'timeDeposits') {
      if (member.timeDeposits < txAmount) {
        res.status(400).json({ error: `Insufficient Time Deposits balance. Available: ₱${member.timeDeposits.toLocaleString()}` });
        return;
      }
    } else {
      res.status(400).json({ error: 'Invalid savings account type' });
      return;
    }

    const clientTxKey = req.body.clientTxKey || req.body.transactionKey;
    const postingKeys = clientTxKey
      ? [`SAVINGS_WITHDRAW:${clientTxKey}`]
      : (releaseMethod === 'GCASH' && externalReference
          ? [`GCASH_REF:${externalReference}`]
          : [`SAVINGS_WITHDRAW:${member.id}_${txAmount}_${Date.now()}`]);

    let generatedReceipt: OfficialReceipt | undefined;
    let updatedMember: Member | undefined;

    const postResult = CooperativeDB.postFinancialTransaction({
      postingKeys,
      paymentSource: 'SAVINGS_TRANSACTION',
      memberId: member.id,
      memberName: member.fullName,
      amount: txAmount,
      postingType: 'WITHDRAWAL',
      postedBy: tokenUser.email,
      gcashRefNumber: releaseMethod === 'GCASH' ? externalReference : undefined,
      executePosting: (currentDb) => {
        const targetMember = currentDb.members.find(m => m.id === member.id)!;
        if (accountType === 'shareCapital' && type === 'REFUND') {
          targetMember.shareCapital = Math.max(0, (targetMember.shareCapital || 0) - txAmount);
        } else if (accountType === 'regularSavings') {
          targetMember.regularSavings = Math.max(0, (targetMember.regularSavings || 0) - txAmount);
        } else if (accountType === 'timeDeposits') {
          targetMember.timeDeposits = Math.max(0, (targetMember.timeDeposits || 0) - txAmount);
        }

        updatedMember = targetMember;

        const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
        const ledgerTx: Transaction = {
          id: txId,
          memberId: targetMember.id,
          memberName: targetMember.fullName,
          type: type as any,
          amount: txAmount,
          description: description || `${type === 'REFUND' ? 'Refund' : 'Withdrawal'} from ${accountType.replace(/([A-Z])/g, ' $1')}`,
          processedBy: operatorName,
          createdAt: new Date().toISOString(),
          releaseMethod: releaseMethod || 'CASH',
          externalReference: releaseMethod === 'GCASH' ? externalReference : undefined
        };
        currentDb.transactions.unshift(ledgerTx);

        const receipt = createOfficialReceipt(currentDb, {
          memberId: targetMember.id,
          memberName: targetMember.fullName,
          memberNumber: targetMember.memberNumber || targetMember.id.substring(0, 8),
          paymentType: 'OTHER',
          paymentMethod: releaseMethod === 'GCASH' ? 'GCASH' : 'CASH',
          amount: txAmount,
          paymentDate: new Date().toISOString().split('T')[0],
          issuedBy: operatorName,
          issuedById: tokenUser.id,
          transactionId: txId,
          internalReference: releaseMethod === 'GCASH' ? `REF-${externalReference}` : `REF-${txId.substring(0, 8).toUpperCase()}`,
          principalAmount: txAmount,
          releaseMethod: releaseMethod === 'GCASH' ? 'GCASH' : 'CASH',
          gcashDetails: releaseMethod === 'GCASH' ? {
            refNumber: externalReference,
            accountName: targetMember.gcashAccountName || targetMember.fullName,
            mobileNumber: targetMember.gcashNumber || targetMember.phone || ''
          } : undefined,
          remarks: `${type === 'REFUND' ? 'Refund' : 'Withdrawal'} from ${accountType.replace(/([A-Z])/g, ' $1')} processed via ${releaseMethod === 'GCASH' ? 'GCASH (Ref: ' + externalReference + ')' : 'CASH'}.`
        });

        generatedReceipt = receipt;

        CooperativeDB.createNotification(targetMember.id, `${type === 'REFUND' ? 'Refund' : 'Withdrawal'} Completed`, `A ${type === 'REFUND' ? 'refund' : 'withdrawal'} of ₱${txAmount.toLocaleString()} from ${accountType.replace(/([A-Z])/g, ' $1')} has been processed. Official Receipt: ${receipt.receiptNumber}.`);

        return {
          ledgerTransaction: ledgerTx,
          officialReceipt: receipt
        };
      }
    });

    if (!postResult.success) {
      if (postResult.isAlreadyProcessed) {
        res.status(400).json({
          error: `This ${type === 'REFUND' ? 'refund' : 'withdrawal'} transaction has already been processed.`,
          status: 'ALREADY_PROCESSED',
          officialReceiptNo: postResult.existingPosting?.officialReceiptNo
        });
        return;
      }
      res.status(400).json({ error: postResult.message || 'Failed to process transaction.' });
      return;
    }

    CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, type === 'REFUND' ? 'SAVINGS_REFUND' : 'SAVINGS_WITHDRAWAL', `Processed ${type === 'REFUND' ? 'refund' : 'withdrawal'} of ₱${txAmount} from ${member.fullName}'s ${accountType}`);

    res.json({ message: `${type === 'REFUND' ? 'Refund' : 'Withdrawal'} successfully processed! Official receipt issued.`, member: updatedMember, receipt: postResult.officialReceipt });
  } else {
    res.status(400).json({ error: 'Invalid transaction type (must be DEPOSIT or WITHDRAWAL)' });
  }
});

// Get Member Ledger
apiRouter.get('/savings/ledger', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  if (tokenUser.role === 'MEMBER' && req.query.memberId && req.query.memberId !== tokenUser.id && req.query.memberId !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only view their own ledger.' });
    return;
  }

  let targetMemberId = tokenUser.id;

  // Admin and Staff can view any ledger by supplying query parameter ?memberId=...
  if ((tokenUser.role === 'ADMIN' || tokenUser.role === 'STAFF') && req.query.memberId) {
    targetMemberId = req.query.memberId as string;
  }

  const member = db.members.find(m => m.id === targetMemberId || (tokenUser.role === 'MEMBER' && tokenUser.email && m.email.toLowerCase() === tokenUser.email.toLowerCase()));
  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const transactions = db.transactions.filter(t => t.memberId === member.id);

  res.json({
    member,
    transactions
  });
});

// ============================================================================
// WITHDRAWAL REQUESTS ENDPOINTS
// ============================================================================

// Get Withdrawal Requests
apiRouter.get('/savings/withdrawal-requests', requireRole(['ADMIN', 'STAFF', 'MEMBER']), requirePermission('savings'), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();
  const requests = db.withdrawalRequests || [];

  if (tokenUser.role === 'MEMBER') {
    if (req.query.memberId && req.query.memberId !== tokenUser.id && req.query.memberId !== tokenUser.memberId) {
      res.status(403).json({ error: 'Forbidden: Members can only view their own withdrawal requests.' });
      return;
    }
    res.json(requests.filter(r => r.memberId === tokenUser.id));
    return;
  }

  if (req.query.memberId) {
    res.json(requests.filter(r => r.memberId === req.query.memberId));
    return;
  }

  res.json(requests);
});

// Submit Withdrawal Request (Handlers)
const handleCreateWithdrawalRequest = (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  const { amount, releaseMethod, remarks, clientTxKey, memberId: bodyMemberId } = req.body;

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    res.status(400).json({ error: 'Please enter a valid withdrawal amount greater than zero.' });
    return;
  }

  let targetMemberId = tokenUser.id;
  if (tokenUser.role === 'MEMBER') {
    if (bodyMemberId && bodyMemberId !== tokenUser.id) {
      res.status(403).json({ error: 'Forbidden: You can only request withdrawals from your own account.' });
      return;
    }
  } else if (bodyMemberId) {
    targetMemberId = bodyMemberId;
  }

  const member = db.members.find(m => m.id === targetMemberId);
  if (!member) {
    res.status(404).json({ error: 'Member profile not found.' });
    return;
  }

  // Idempotency check via clientTxKey
  if (clientTxKey) {
    const existing = (db.withdrawalRequests || []).find((r: any) => (r as any).clientTxKey === clientTxKey);
    if (existing) {
      res.json({
        message: 'Withdrawal request already submitted.',
        status: 'ALREADY_PROCESSED',
        withdrawalRequest: existing
      });
      return;
    }
  }

  // Check Regular Savings balance (Do NOT deduct balance yet while pending)
  if (numAmount > member.regularSavings) {
    res.status(400).json({
      error: `Insufficient Regular Savings balance. Available: ₱${member.regularSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Requested: ₱${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    });
    return;
  }

  const normalizedMethod = (releaseMethod === 'GCASH' || releaseMethod === 'GCASH_PAYOUT') ? 'GCASH' : (releaseMethod === 'OFFICE_CASH' ? 'OFFICE_CASH' : 'CASH');

  // Check GCash registration if GCash release selected
  if (normalizedMethod === 'GCASH' && !member.gcashNumber) {
    res.status(400).json({ error: 'A valid registered GCash number is required for GCash releases.' });
    return;
  }

  const newRequest: any = {
    id: 'wreq_' + Math.random().toString(36).substring(2, 11),
    memberId: member.id,
    memberName: member.fullName,
    amount: numAmount,
    requestDate: new Date().toISOString(),
    status: 'PENDING',
    releaseMethod: normalizedMethod,
    gcashNumber: normalizedMethod === 'GCASH' ? member.gcashNumber : undefined,
    remarks: remarks || '',
    clientTxKey: clientTxKey || undefined
  };

  db.withdrawalRequests = db.withdrawalRequests || [];
  db.withdrawalRequests.unshift(newRequest);

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'WITHDRAWAL_REQUEST_SUBMITTED',
    `Submitted withdrawal request of ₱${numAmount} via ${normalizedMethod} for ${member.fullName}`
  );

  res.json({
    message: 'Withdrawal request submitted successfully. Your request is pending staff approval.',
    withdrawalRequest: newRequest
  });
};

apiRouter.post('/savings/withdrawal-request', requireRole(['ADMIN', 'STAFF', 'MEMBER']), requirePermission('savings'), handleCreateWithdrawalRequest);
apiRouter.post('/savings/withdrawal-requests', requireRole(['ADMIN', 'STAFF', 'MEMBER']), requirePermission('savings'), handleCreateWithdrawalRequest);

// Approve Withdrawal Request (Staff/Admin)
const handleApproveWithdrawalRequest = (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  const reqId = req.params.id || req.body.requestId || req.body.id;
  db.withdrawalRequests = db.withdrawalRequests || [];
  const request = db.withdrawalRequests.find(r => r.id === reqId);

  if (!request) {
    res.status(404).json({ error: 'Withdrawal request not found.' });
    return;
  }

  if (request.status === 'APPROVED') {
    res.json({
      message: 'This withdrawal request has already been processed.',
      status: 'ALREADY_PROCESSED',
      withdrawalRequest: request
    });
    return;
  }

  if (request.status === 'REJECTED') {
    res.status(400).json({ error: 'This withdrawal request was previously rejected.' });
    return;
  }

  const member = db.members.find(m => m.id === request.memberId);
  if (!member) {
    res.status(404).json({ error: 'Member not found.' });
    return;
  }

  if (request.amount > member.regularSavings) {
    res.status(400).json({
      error: `Insufficient Regular Savings balance for approval. Available: ₱${member.regularSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}, Requested: ₱${request.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    });
    return;
  }

  const postingKey = `WITHDRAWAL_APP_${request.id}`;

  const postResult = CooperativeDB.postFinancialTransaction({
    postingKeys: [postingKey, request.id],
    paymentSource: 'CASHIER_QUEUE',
    memberId: member.id,
    memberName: member.fullName,
    amount: request.amount,
    postingType: 'WITHDRAWAL',
    postedBy: (tokenUser as any).fullName || tokenUser.email,
    
    executePosting: (currentDb) => {
      const targetMember = currentDb.members.find(m => m.id === member.id)!;
      targetMember.regularSavings -= request.amount;

      const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
      const ledgerTx: Transaction = {
        id: txId,
        memberId: targetMember.id,
        memberName: targetMember.fullName,
        type: 'WITHDRAWAL',
        amount: request.amount,
        description: `Regular Savings Withdrawal (${request.releaseMethod}): ${request.remarks || 'Approved Request'}`,
        processedBy: (tokenUser as any).fullName || tokenUser.email,
        createdAt: new Date().toISOString(),
        releaseMethod: request.releaseMethod,
        externalReference: req.body.gcashRefNumber || req.body.externalReference || req.body.referenceNumber
      };

      currentDb.transactions = currentDb.transactions || [];
      currentDb.transactions.unshift(ledgerTx);

      // Generate Official Receipt via standard helper
      const gcashRef = req.body.gcashRefNumber || req.body.externalReference || req.body.referenceNumber || ('GCASH_REF_' + Date.now());
      const officialReceipt = createOfficialReceipt(currentDb, {
        transactionId: txId,
        memberId: targetMember.id,
        memberNumber: targetMember.memberNumber,
        memberName: targetMember.fullName,
        paymentType: 'OTHER',
        paymentMethod: request.releaseMethod === 'GCASH' ? 'GCASH' : 'CASH',
        releaseMethod: request.releaseMethod,
        amount: request.amount,
        issuedBy: (tokenUser as any).fullName || tokenUser.email,
        paymentDate: new Date().toISOString().split('T')[0],
        remarks: `Regular Savings Withdrawal Released via ${request.releaseMethod}`,
        gcashDetails: request.releaseMethod === 'GCASH' ? {
          accountName: targetMember.gcashAccountName || targetMember.fullName,
          mobileNumber: targetMember.gcashNumber || request.gcashNumber || '',
          refNumber: gcashRef
        } : undefined
      });

      return {
        ledgerTransaction: ledgerTx,
        officialReceipt
      };
    }
  });

  if (postResult.isAlreadyProcessed) {
    res.json({
      message: 'This withdrawal request has already been processed.',
      status: 'ALREADY_PROCESSED',
      withdrawalRequest: request
    });
    return;
  }

  // Update request state
  request.status = 'APPROVED';
  request.processedBy = (tokenUser as any).fullName || tokenUser.email;
  request.processedAt = new Date().toISOString();
  request.officialReceiptNo = postResult.officialReceipt?.receiptNumber;

  CooperativeDB.save(db);

  CooperativeDB.createNotification(
    member.id,
    'Withdrawal Request Approved',
    `Your withdrawal request of ₱${request.amount.toLocaleString()} via ${request.releaseMethod} has been approved and released. Official Receipt: ${postResult.officialReceipt?.receiptNumber}.`
  );

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'WITHDRAWAL_REQUEST_APPROVED',
    `Approved withdrawal request #${request.id} of ₱${request.amount} for ${member.fullName}`
  );

  res.json({
    message: 'Withdrawal request approved and released successfully! Official Receipt issued.',
    receipt: postResult.officialReceipt,
    withdrawalRequest: request
  });
};

apiRouter.post('/savings/withdrawal-requests/:id/approve', requireRole(['ADMIN', 'STAFF']), requirePermission('savings'), handleApproveWithdrawalRequest);
apiRouter.post('/savings/withdrawal-request/approve', requireRole(['ADMIN', 'STAFF']), requirePermission('savings'), handleApproveWithdrawalRequest);
apiRouter.post('/savings/withdrawal-approve', requireRole(['ADMIN', 'STAFF']), requirePermission('savings'), handleApproveWithdrawalRequest);

// Reject Withdrawal Request (Staff/Admin)
const handleRejectWithdrawalRequest = (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  const reqId = req.params.id || req.body.requestId || req.body.id;
  db.withdrawalRequests = db.withdrawalRequests || [];
  const request = db.withdrawalRequests.find(r => r.id === reqId);

  if (!request) {
    res.status(404).json({ error: 'Withdrawal request not found.' });
    return;
  }

  if (request.status !== 'PENDING') {
    res.json({
      message: 'This withdrawal request has already been processed.',
      status: 'ALREADY_PROCESSED',
      withdrawalRequest: request
    });
    return;
  }

  request.status = 'REJECTED';
  request.processedBy = (tokenUser as any).fullName || tokenUser.email;
  request.processedAt = new Date().toISOString();
  if (req.body.reason) {
    request.remarks = `${request.remarks || ''} (Rejected: ${req.body.reason})`.trim();
  }

  CooperativeDB.save(db);

  CooperativeDB.createNotification(
    request.memberId,
    'Withdrawal Request Declined',
    `Your withdrawal request of ₱${request.amount.toLocaleString()} was declined by staff.${req.body.reason ? ' Reason: ' + req.body.reason : ''}`
  );

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'WITHDRAWAL_REQUEST_REJECTED',
    `Rejected withdrawal request #${request.id} for member ID ${request.memberId}`
  );

  res.json({
    message: 'Withdrawal request rejected.',
    withdrawalRequest: request
  });
};

apiRouter.post('/savings/withdrawal-requests/:id/reject', requireRole(['ADMIN', 'STAFF']), requirePermission('savings'), handleRejectWithdrawalRequest);
apiRouter.post('/savings/withdrawal-request/reject', requireRole(['ADMIN', 'STAFF']), requirePermission('savings'), handleRejectWithdrawalRequest);

// ============================================================================
// TIME DEPOSITS ENDPOINTS
// ============================================================================

apiRouter.get('/time-deposits', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  if (tokenUser.role === 'MEMBER' && req.query.memberId && req.query.memberId !== tokenUser.id && req.query.memberId !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only view their own Time Deposits.' });
    return;
  }

  let memberId = tokenUser.id;
  if ((tokenUser.role === 'ADMIN' || tokenUser.role === 'STAFF') && req.query.memberId) {
    memberId = req.query.memberId as string;
  }

  const contracts = (db.timeDepositContracts || []).filter(c => tokenUser.role === 'ADMIN' || tokenUser.role === 'STAFF' ? (req.query.memberId ? c.memberId === req.query.memberId : true) : c.memberId === memberId);
  const config = db.systemSettings.timeDepositConfig || {
    enabled: true,
    minAmount: 1000,
    maxAmount: 1000000,
    availableTerms: [
      { termMonths: 6, interestRate: 0.055, name: '6 Months (5.5% p.a.)' },
      { termMonths: 12, interestRate: 0.065, name: '1 Year (6.5% p.a.)' },
      { termMonths: 24, interestRate: 0.075, name: '2 Years (7.5% p.a.)' }
    ]
  };

  res.json({
    contracts,
    config
  });
});

apiRouter.post('/time-deposits/open', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { principalAmount, termMonths, renewalInstruction, clientTxKey } = req.body;

  const amount = Number(principalAmount);
  const term = Number(termMonths);

  if (!amount || amount <= 0 || !term || term <= 0) {
    res.status(400).json({ error: 'Valid principal amount and term in months are required.' });
    return;
  }

  const db = CooperativeDB.load();
  if (tokenUser.role === 'MEMBER' && req.body.memberId && req.body.memberId !== tokenUser.id && req.body.memberId !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only open Time Deposits for their own account.' });
    return;
  }
  let targetMemberId = tokenUser.id;
  if ((tokenUser.role === 'ADMIN' || tokenUser.role === 'STAFF') && req.body.memberId) {
    targetMemberId = req.body.memberId;
  }

  const member = db.members.find(m => m.id === targetMemberId);
  if (!member) {
    res.status(404).json({ error: 'Member record not found.' });
    return;
  }

  // 1. Check Membership / Initial Share Eligibility
  if (!member.initialShareCapitalPaid) {
    res.status(400).json({ error: 'Member must have a verified Initial Share Capital payment to open a Time Deposit.' });
    return;
  }

  const config = db.systemSettings.timeDepositConfig || {
    enabled: true,
    minAmount: 1000,
    maxAmount: 1000000,
    availableTerms: [
      { termMonths: 6, interestRate: 0.055, name: '6 Months (5.5% p.a.)' },
      { termMonths: 12, interestRate: 0.065, name: '1 Year (6.5% p.a.)' },
      { termMonths: 24, interestRate: 0.075, name: '2 Years (7.5% p.a.)' }
    ]
  };

  const minAmount = config.minAmount || 1000;
  if (amount < minAmount) {
    res.status(400).json({ error: `Minimum placement amount for Time Deposit is ₱${minAmount.toLocaleString()}.` });
    return;
  }

  // 2. Check Available Regular Savings Balance
  if ((member.regularSavings || 0) < amount) {
    res.status(400).json({ error: `Insufficient Regular Savings balance. Please deposit funds into Regular Savings before opening a Time Deposit. (Available: ₱${(member.regularSavings || 0).toLocaleString()})` });
    return;
  }

  const selectedTermObj = config.availableTerms.find(t => t.termMonths === term) || {
    termMonths: term,
    interestRate: term === 6 ? 0.055 : term === 24 ? 0.075 : 0.065,
    name: `${term} Months`
  };

  const txKey = clientTxKey || `TD_OPEN_${member.id}_${amount}_${Date.now()}`;
  const postingKey = `TD_OPEN:${txKey}`;

  let createdContract: TimeDepositContract | undefined;

  const postResult = CooperativeDB.postFinancialTransaction({
    postingKeys: [postingKey],
    paymentSource: 'TIME_DEPOSIT_TRANSACTION',
    memberId: member.id,
    memberName: member.fullName,
    amount: amount,
    postingType: 'TIME_DEPOSIT',
    postedBy: tokenUser.email,
    executePosting: (currentDb) => {
      const targetMember = currentDb.members.find(m => m.id === member.id)!;

      // Debit Regular Savings
      targetMember.regularSavings = Math.max(0, (targetMember.regularSavings || 0) - amount);

      const nowObj = new Date();
      const openDate = nowObj.toISOString().split('T')[0];
      const matDateObj = new Date(nowObj);
      matDateObj.setMonth(matDateObj.getMonth() + term);
      const matDate = matDateObj.toISOString().split('T')[0];

      const contract: TimeDepositContract = {
        id: 'td_' + Math.random().toString(36).substring(2, 11),
        memberId: targetMember.id,
        memberName: targetMember.fullName,
        principalAmount: amount,
        interestRate: selectedTermObj.interestRate,
        termMonths: term,
        openingDate: openDate,
        maturityDate: matDate,
        status: 'ACTIVE',
        renewalInstruction: renewalInstruction || 'AUTOMATIC_ROLLOVER',
        createdAt: nowObj.toISOString(),
        accumulatedInterest: Number((amount * selectedTermObj.interestRate * (term / 12)).toFixed(2)),
        postingKey
      };

      currentDb.timeDepositContracts = currentDb.timeDepositContracts || [];
      currentDb.timeDepositContracts.unshift(contract);
      createdContract = contract;

      // Recalculate member.timeDeposits balance
      const memberActiveContracts = currentDb.timeDepositContracts.filter(c => c.memberId === targetMember.id && c.status === 'ACTIVE');
      targetMember.timeDeposits = memberActiveContracts.reduce((sum, c) => sum + c.principalAmount, 0);

      const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
      const ledgerTx: Transaction = {
        id: txId,
        memberId: targetMember.id,
        memberName: targetMember.fullName,
        type: 'DEPOSIT',
        amount: amount,
        description: `Funded Time Deposit Contract #${contract.id.substring(0, 8).toUpperCase()} (${term} mos @ ${(selectedTermObj.interestRate * 100).toFixed(1)}% p.a.)`,
        processedBy: tokenUser.email,
        createdAt: nowObj.toISOString()
      };

      currentDb.transactions = currentDb.transactions || [];
      currentDb.transactions.unshift(ledgerTx);
      contract.ledgerTransactionId = txId;

      const receipt = createOfficialReceipt(currentDb, {
        memberId: targetMember.id,
        memberName: targetMember.fullName,
        memberNumber: targetMember.memberNumber || targetMember.id.substring(0, 8),
        paymentType: 'TIME_DEPOSIT' as any,
        paymentMethod: 'TRANSFER' as any,
        amount: amount,
        paymentDate: openDate,
        issuedBy: tokenUser.email,
        issuedById: tokenUser.id,
        transactionId: txId,
        principalAmount: amount,
        remarks: `Time Deposit Placement - ${term} Months Term @ ${(selectedTermObj.interestRate * 100).toFixed(1)}% p.a.`
      });

      contract.officialReceiptNo = receipt.receiptNumber;

      CooperativeDB.createNotification(
        targetMember.id,
        'Time Deposit Opened',
        `Your ₱${amount.toLocaleString()} Time Deposit contract #${contract.id.substring(0, 8).toUpperCase()} has been successfully funded and activated.`
      );

      return {
        ledgerTransaction: ledgerTx,
        officialReceipt: receipt,
        additionalData: { contract }
      };
    }
  });

  if (!postResult.success) {
    if (postResult.isAlreadyProcessed) {
      res.status(200).json({
        message: 'This Time Deposit contract has already been funded and created.',
        status: 'ALREADY_PROCESSED',
        officialReceiptNo: postResult.existingPosting?.officialReceiptNo
      });
      return;
    }
    res.status(400).json({ error: postResult.message || 'Failed to open Time Deposit contract.' });
    return;
  }

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'OPEN_TIME_DEPOSIT',
    `Opened ₱${amount} Time Deposit contract for ${member.fullName}`
  );

  res.json({
    message: 'Time Deposit contract successfully created and funded!',
    contract: postResult.additionalData?.contract || createdContract,
    receipt: postResult.officialReceipt,
    member: db.members.find(m => m.id === member.id)
  });
});

apiRouter.post('/time-deposits/:id/close', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const contractId = req.params.id;

  const db = CooperativeDB.load();
  const contract = (db.timeDepositContracts || []).find(c => c.id === contractId);

  if (!contract) {
    res.status(404).json({ error: 'Time Deposit contract not found.' });
    return;
  }

  if (tokenUser.role === 'MEMBER' && contract.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  if (contract.status === 'CLOSED' || contract.status === 'CANCELLED') {
    res.status(400).json({ error: 'Time Deposit contract is already closed or cancelled.' });
    return;
  }

  const postingKey = `TD_CLOSE:${contract.id}`;

  const postResult = CooperativeDB.postFinancialTransaction({
    postingKeys: [postingKey],
    paymentSource: 'TIME_DEPOSIT_TRANSACTION',
    memberId: contract.memberId,
    memberName: contract.memberName,
    amount: contract.principalAmount,
    postingType: 'WITHDRAWAL',
    postedBy: tokenUser.email,
    executePosting: (currentDb) => {
      const targetContract = (currentDb.timeDepositContracts || []).find(c => c.id === contractId)!;
      const targetMember = currentDb.members.find(m => m.id === contract.memberId)!;

      const payoutAmount = targetContract.principalAmount + (targetContract.accumulatedInterest || 0);

      // Return principal + interest back to Regular Savings
      targetMember.regularSavings = (targetMember.regularSavings || 0) + payoutAmount;

      targetContract.status = 'CLOSED';
      targetContract.closedAt = new Date().toISOString();

      // Recalculate member.timeDeposits
      const activeContracts = (currentDb.timeDepositContracts || []).filter(c => c.memberId === targetMember.id && c.status === 'ACTIVE');
      targetMember.timeDeposits = activeContracts.reduce((sum, c) => sum + c.principalAmount, 0);

      const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
      const ledgerTx: Transaction = {
        id: txId,
        memberId: targetMember.id,
        memberName: targetMember.fullName,
        type: 'WITHDRAWAL',
        amount: payoutAmount,
        description: `Time Deposit Contract #${targetContract.id.substring(0, 8).toUpperCase()} Payout to Regular Savings`,
        processedBy: tokenUser.email,
        createdAt: new Date().toISOString()
      };

      currentDb.transactions.unshift(ledgerTx);

      const receipt = createOfficialReceipt(currentDb, {
        memberId: targetMember.id,
        memberName: targetMember.fullName,
        memberNumber: targetMember.memberNumber || targetMember.id.substring(0, 8),
        paymentType: 'OTHER',
        paymentMethod: 'SAVINGS',
        amount: payoutAmount,
        paymentDate: new Date().toISOString().split('T')[0],
        issuedBy: tokenUser.email,
        issuedById: tokenUser.id,
        transactionId: txId,
        remarks: `Time Deposit Contract #${targetContract.id.substring(0, 8).toUpperCase()} Closure Payout`
      });

      return { ledgerTransaction: ledgerTx, officialReceipt: receipt, additionalData: { contract: targetContract } };
    }
  });

  if (!postResult.success) {
    if (postResult.isAlreadyProcessed) {
      res.status(200).json({
        message: 'This Time Deposit contract has already been closed and paid out.',
        status: 'ALREADY_PROCESSED'
      });
      return;
    }
    res.status(400).json({ error: postResult.message || 'Failed to close Time Deposit contract.' });
    return;
  }

  res.json({ message: 'Time Deposit contract closed and payout credited to Regular Savings!', contract: postResult.additionalData?.contract, receipt: postResult.officialReceipt });
});


// ============================================================================
// 3. LOANS OPERATIONS
// ============================================================================

// ============================================================================
// 3. LOANS OPERATIONS & ELIGIBILITY VERIFICATION
// ============================================================================

// Helper: Evaluates Loan Eligibility against configurable cooperative policies
export function evaluateLoanEligibility(
  member: Member, 
  loanType: LoanType, 
  db: DatabaseState, 
  requestedAmount: number = 0
): StructuredEligibilityResponse {
  const checks: LoanEligibilityCheck[] = [];

  // =========================================================================
  // 1. MEMBER ACCOUNT / STATUS ELIGIBILITY
  // =========================================================================
  const isActive = member.status === 'ACTIVE';
  checks.push({
    rule: 'ACTIVE_MEMBERSHIP',
    title: 'Approved & Active Membership Status',
    passed: isActive,
    requiredValue: 'Active Status',
    actualValue: member.status,
    description: isActive
      ? 'Member account is in Active operational status.'
      : `Member status is '${member.status}'. Only Active members can apply for loan facilities.`,
    requirement: 'Approved & Active Membership Status',
    status: isActive ? 'PASSED' : 'FAILED',
    message: isActive
      ? 'Member account is in Active operational status.'
      : `Member status is '${member.status}'. Only Active members can apply for loan facilities.`
  });

  // =========================================================================
  // 2. MANDATORY COMPLIANCE REQUIREMENTS (EVALUATED INDEPENDENTLY)
  // =========================================================================
  const complianceConfig = db.systemSettings.complianceConfig || defaultComplianceConfig;

  // 2a. Pre-Membership Seminar (PMES)
  const isPmesRequired = complianceConfig.requirePmesForLoan !== false;
  const pmesRecord = (member.complianceRecords || []).find(r => 
    r.requirementType === 'PRE_MEMBERSHIP_SEMINAR' || 
    (r.requirementType as string) === 'PMES' ||
    (r as any).type === 'PRE_MEMBERSHIP_SEMINAR' ||
    (r as any).type === 'PMES'
  );
  const rawPmesStatus = String(pmesRecord?.status || (pmesRecord as any)?.status || '').toUpperCase();
  const rawPmesVerif = String(pmesRecord?.verificationStatus || (pmesRecord as any)?.verificationStatus || '').toUpperCase();

  const isPmesExplicitlyVerified = !!pmesRecord && (
    rawPmesStatus === 'COMPLETED' || 
    rawPmesStatus === 'VERIFIED' || 
    rawPmesVerif === 'VERIFIED' || 
    (!!pmesRecord.verifiedBy && !!pmesRecord.verifiedAt) ||
    (pmesRecord as any).verified === true || 
    (pmesRecord as any).completed === true
  );

  const isPmesPendingOrRejected = !!pmesRecord && (
    rawPmesStatus === 'PENDING_VERIFICATION' ||
    rawPmesStatus === 'ATTENDED' ||
    rawPmesStatus === 'REJECTED' ||
    rawPmesVerif === 'PENDING' ||
    rawPmesVerif === 'REJECTED'
  );

  const isPmesCompleted = isPmesExplicitlyVerified || (member.hasAttendedPreMembershipSeminar === true && !isPmesPendingOrRejected);
  const pmesPassed = !isPmesRequired || isPmesCompleted;

  let pmesDisplayStatus: 'VERIFIED' | 'PENDING_VERIFICATION' | 'REJECTED' | 'NOT_COMPLETED' = 'NOT_COMPLETED';
  if (isPmesCompleted) {
    pmesDisplayStatus = 'VERIFIED';
  } else if (rawPmesStatus === 'PENDING_VERIFICATION' || rawPmesStatus === 'ATTENDED' || rawPmesVerif === 'PENDING') {
    pmesDisplayStatus = 'PENDING_VERIFICATION';
  } else if (rawPmesStatus === 'REJECTED' || rawPmesVerif === 'REJECTED') {
    pmesDisplayStatus = 'REJECTED';
  }

  checks.push({
    rule: 'PRE_MEMBERSHIP_SEMINAR',
    title: 'Pre-Membership Education Seminar (PMES)',
    passed: pmesPassed,
    requiredValue: isPmesRequired ? 'Completed / Verified' : 'Optional',
    actualValue: isPmesCompleted ? 'Completed & Verified' : pmesDisplayStatus.replace(/_/g, ' '),
    description: pmesPassed
      ? 'Member has successfully completed and verified the required Pre-Membership Education Seminar.'
      : 'Completion and staff verification of the Pre-Membership Education Seminar (PMES) is required for loan eligibility.',
    requirement: 'Pre-Membership Education Seminar (PMES)',
    status: pmesPassed ? 'PASSED' : 'FAILED',
    message: pmesPassed
      ? 'Member has successfully completed and verified the required Pre-Membership Education Seminar.'
      : 'Completion and staff verification of the Pre-Membership Education Seminar (PMES) is required for loan eligibility.'
  });

  // 2b. Loan Orientation & Credit Counseling
  const isOrientationRequired = complianceConfig.requireOrientationForLoan !== false || !!loanType.requiresOrientation;
  const orientationRecord = (member.complianceRecords || []).find(r => 
    r.requirementType === 'LOAN_ORIENTATION' || 
    (r.requirementType as string) === 'ORIENTATION' ||
    (r as any).type === 'LOAN_ORIENTATION' ||
    (r as any).type === 'ORIENTATION'
  );
  const rawOrientStatus = String(orientationRecord?.status || (orientationRecord as any)?.status || '').toUpperCase();
  const rawOrientVerif = String(orientationRecord?.verificationStatus || (orientationRecord as any)?.verificationStatus || '').toUpperCase();

  const isOrientationExplicitlyVerified = !!orientationRecord && (
    rawOrientStatus === 'COMPLETED' || 
    rawOrientStatus === 'VERIFIED' || 
    rawOrientVerif === 'VERIFIED' || 
    (!!orientationRecord.verifiedBy && !!orientationRecord.verifiedAt) ||
    (orientationRecord as any).verified === true || 
    (orientationRecord as any).completed === true
  );

  const isOrientationPendingOrRejected = !!orientationRecord && (
    rawOrientStatus === 'PENDING_VERIFICATION' ||
    rawOrientStatus === 'ATTENDED' ||
    rawOrientStatus === 'REJECTED' ||
    rawOrientVerif === 'PENDING' ||
    rawOrientVerif === 'REJECTED'
  );

  const isOrientationCompleted = isOrientationExplicitlyVerified || (member.loanOrientationCompleted === true && !isOrientationPendingOrRejected);
  const orientationPassed = !isOrientationRequired || isOrientationCompleted;

  let orientDisplayStatus: 'VERIFIED' | 'PENDING_VERIFICATION' | 'REJECTED' | 'NOT_COMPLETED' = 'NOT_COMPLETED';
  if (isOrientationCompleted) {
    orientDisplayStatus = 'VERIFIED';
  } else if (rawOrientStatus === 'PENDING_VERIFICATION' || rawOrientStatus === 'ATTENDED' || rawOrientVerif === 'PENDING') {
    orientDisplayStatus = 'PENDING_VERIFICATION';
  } else if (rawOrientStatus === 'REJECTED' || rawOrientVerif === 'REJECTED') {
    orientDisplayStatus = 'REJECTED';
  }

  checks.push({
    rule: 'LOAN_ORIENTATION_COMPLETED',
    title: 'Loan Orientation & Credit Counseling',
    passed: orientationPassed,
    requiredValue: isOrientationRequired ? 'Completed / Verified' : 'Optional',
    actualValue: isOrientationCompleted ? 'Completed & Verified' : orientDisplayStatus.replace(/_/g, ' '),
    description: orientationPassed
      ? (isOrientationRequired ? 'Member has completed and verified required Credit Counseling seminar.' : 'Loan orientation is optional for this product.')
      : 'Completion and staff verification of Cooperative Credit Counseling & Loan Orientation is required prior to applying.',
    requirement: 'Loan Orientation & Credit Counseling',
    status: orientationPassed ? 'PASSED' : 'FAILED',
    message: orientationPassed
      ? (isOrientationRequired ? 'Member has completed and verified required Credit Counseling seminar.' : 'Loan orientation is optional for this product.')
      : 'Completion and staff verification of Cooperative Credit Counseling & Loan Orientation is required prior to applying.'
  });

  // Calculate missing mandatory requirements
  const missingRequirements: string[] = [];
  if (isPmesRequired && !isPmesCompleted) {
    missingRequirements.push('PRE_MEMBERSHIP_SEMINAR');
  }
  if (isOrientationRequired && !isOrientationCompleted) {
    missingRequirements.push('LOAN_ORIENTATION');
  }

  const complianceSatisfied = missingRequirements.length === 0;

  // =========================================================================
  // 3. DUPLICATE ACTIVE APPLICATION FOR THE SAME LOAN PRODUCT
  // =========================================================================
  // CRITICAL CONSTRAINT:
  // "Do not show a duplicate application warning when mandatory compliance is still the actual blocker."
  // When compliance is missing, duplicateApplication is FALSE in the response.
  // Active application statuses:
  // PENDING_REVIEW, UNDER_REVIEW, REVISION_REQUESTED, APPROVED, WAITING_FOR_RELEASE
  // Terminal/closed statuses (REJECTED, DISBURSED, RELEASED, PAID, COMPLETED, CANCELLED, WITHDRAWN) do NOT block new applications
  const ACTIVE_APPLICATION_STATUSES: LoanStatus[] = [
    'PENDING_REVIEW',
    'UNDER_REVIEW',
    'REVISION_REQUESTED',
    'APPROVED',
    'WAITING_FOR_RELEASE'
  ];

  const pendingApps = (db.loanApplications || []).filter(a => 
    a.memberId === member.id && 
    ACTIVE_APPLICATION_STATUSES.includes(a.status)
  );
  const duplicateApp = pendingApps.find(a => a.loanTypeId === loanType.id);
  const duplicateForProduct = Boolean(duplicateApp);
  const duplicateApplication = complianceSatisfied && duplicateForProduct;

  // Safe Diagnostic Logging (Requirement 11)
  if (duplicateApplication && duplicateApp) {
    console.log('[DUPLICATE_LOAN_APPLICATION_CHECK]', {
      memberId: member.id,
      loanProduct: loanType.name,
      applicationId: duplicateApp.id,
      applicationStatus: duplicateApp.status
    });
  }

  const duplicatePassed = !complianceSatisfied || !duplicateForProduct;
  const duplicateDesc = !complianceSatisfied
    ? 'Duplicate application check will be evaluated after mandatory compliance requirements are satisfied.'
    : (!duplicateForProduct 
      ? 'No active duplicate application pending for this loan product.' 
      : duplicateApp?.status === 'REVISION_REQUESTED'
        ? `Staff requested revisions to your existing application (ID: ${duplicateApp.id}). Please revise and resubmit the existing application instead of creating a new application.`
        : `An active application for this loan product already exists (ID: ${duplicateApp?.id}, Status: ${duplicateApp?.status.replace(/_/g, ' ')}, Submitted: ${duplicateApp?.createdAt ? new Date(duplicateApp.createdAt).toLocaleDateString() : 'N/A'}).`);

  checks.push({
    rule: 'NO_DUPLICATE_PENDING_APP',
    title: duplicatePassed ? 'No Duplicate Active Application' : 'Existing Loan Application',
    passed: duplicatePassed,
    requiredValue: 'No Active Application for Same Product',
    actualValue: !complianceSatisfied 
      ? 'Deferred (Compliance Pending)' 
      : (duplicateForProduct ? `Active Application (${duplicateApp?.id})` : 'Clear'),
    description: duplicateDesc,
    requirement: duplicatePassed ? 'No Duplicate Active Application' : 'Existing Loan Application',
    status: duplicatePassed ? 'PASSED' : 'FAILED',
    message: duplicateDesc
  });

  // =========================================================================
  // 4. FINANCIAL / POLICY ELIGIBILITY
  // =========================================================================
  // 4a. Initial Share Capital Paid
  const initialSharePaid = member.initialShareCapitalPaid !== false && (member.shareCapital || 0) > 0;
  checks.push({
    rule: 'INITIAL_SHARE_PAID',
    title: 'Initial Share Capital Contribution',
    passed: initialSharePaid,
    requiredValue: 'Paid & Verified',
    actualValue: initialSharePaid ? 'Paid' : 'Pending',
    description: initialSharePaid
      ? 'Initial Share Capital contribution has been verified and credited.'
      : 'Initial Share Capital contribution is required before accessing loan facilities.',
    requirement: 'Initial Share Capital Contribution',
    status: initialSharePaid ? 'PASSED' : 'FAILED',
    message: initialSharePaid
      ? 'Initial Share Capital contribution has been verified and credited.'
      : 'Initial Share Capital contribution is required before accessing loan facilities.'
  });

  // 4b. Member In Good Standing (MIGS)
  const isMigsRequired = loanType.requiresMigs !== false;
  const isMigs = member.isMigs !== false;
  const migsPassed = !isMigsRequired || isMigs;
  checks.push({
    rule: 'MEMBER_GOOD_STANDING',
    title: 'Member in Good Standing (MIGS)',
    passed: migsPassed,
    requiredValue: isMigsRequired ? 'MIGS Certified' : 'Optional',
    actualValue: isMigs ? 'Good Standing (MIGS)' : 'Needs Review / Hold',
    description: migsPassed
      ? 'Member maintains Good Standing compliance with cooperative policies.'
      : 'Member account is currently not flagged as Member in Good Standing (MIGS).',
    requirement: 'Member in Good Standing (MIGS)',
    status: migsPassed ? 'PASSED' : 'FAILED',
    message: migsPassed
      ? 'Member maintains Good Standing compliance with cooperative policies.'
      : 'Member account is currently not flagged as Member in Good Standing (MIGS).'
  });

  // 4c. Minimum Membership Tenure
  const minMonths = db.systemSettings.minMembershipTenureMonths !== undefined ? db.systemSettings.minMembershipTenureMonths : (loanType.minMembershipMonths ?? 0);
  const approvedDateStr = member.membershipApprovedAt || member.createdAt;
  const approvedDate = new Date(approvedDateStr);
  const now = new Date();
  const diffMonths = Math.max(0, (now.getFullYear() - approvedDate.getFullYear()) * 12 + (now.getMonth() - approvedDate.getMonth()));
  const tenurePassed = diffMonths >= minMonths;
  checks.push({
    rule: 'MINIMUM_MEMBERSHIP_TENURE',
    title: 'Minimum Membership Tenure',
    passed: tenurePassed,
    requiredValue: `${minMonths} Month(s)`,
    actualValue: `${diffMonths} Month(s)`,
    description: tenurePassed
      ? `Member tenure of ${diffMonths} month(s) satisfies the minimum requirement of ${minMonths} month(s).`
      : `Required minimum tenure is ${minMonths} month(s). Current tenure is ${diffMonths} month(s).`,
    requirement: 'Minimum Membership Tenure',
    status: tenurePassed ? 'PASSED' : 'FAILED',
    message: tenurePassed
      ? `Member tenure of ${diffMonths} month(s) satisfies the minimum requirement of ${minMonths} month(s).`
      : `Required minimum tenure is ${minMonths} month(s). Current tenure is ${diffMonths} month(s).`
  });

  // 4d. Minimum Share Capital Requirement
  const minShareCap = loanType.minShareCapital || 0;
  const actualShareCap = member.shareCapital || 0;
  const shareCapPassed = actualShareCap >= minShareCap;
  checks.push({
    rule: 'MINIMUM_SHARE_CAPITAL',
    title: 'Minimum Share Capital Requirement',
    passed: shareCapPassed,
    requiredValue: `₱${minShareCap.toLocaleString()}`,
    actualValue: `₱${actualShareCap.toLocaleString()}`,
    description: shareCapPassed
      ? `Share Capital balance of ₱${actualShareCap.toLocaleString()} meets required minimum of ₱${minShareCap.toLocaleString()}.`
      : `Required minimum Share Capital is ₱${minShareCap.toLocaleString()}. Current balance is ₱${actualShareCap.toLocaleString()}.`,
    requirement: 'Minimum Share Capital Requirement',
    status: shareCapPassed ? 'PASSED' : 'FAILED',
    message: shareCapPassed
      ? `Share Capital balance of ₱${actualShareCap.toLocaleString()} meets required minimum of ₱${minShareCap.toLocaleString()}.`
      : `Required minimum Share Capital is ₱${minShareCap.toLocaleString()}. Current balance is ₱${actualShareCap.toLocaleString()}.`
  });

  // 4e. One-Active-Loan-Per-Member Policy (Existing Outstanding Loan Check)
  // Requirement: A member may have only one released loan with an outstanding balance at a time.
  // After a loan is approved and released, the member must not be allowed to submit a new ordinary loan application
  // while the existing loan has an outstanding principal/balance greater than zero.
  // Applies across Regular Loan, Emergency Loan, Share Capital Loan, Educational Loan, and Salary Loan.
  // Checks authoritative existing loan records and actual outstanding balance, not merely application status.
  const existingLoansWithBalance = (db.loans || []).filter(l => 
    l.memberId === member.id && 
    (l.balance || 0) > 0
  );
  const hasActiveLoanWithBalance = existingLoansWithBalance.length > 0;
  const primaryActiveLoan = hasActiveLoanWithBalance ? existingLoansWithBalance[0] : undefined;

  const formattedLoanBalance = primaryActiveLoan 
    ? Number(primaryActiveLoan.balance).toLocaleString('en-US', {
        minimumFractionDigits: primaryActiveLoan.balance % 1 !== 0 ? 2 : 0,
        maximumFractionDigits: 2
      })
    : '0';

  const existingLoanMessage = hasActiveLoanWithBalance
    ? `You currently have an active loan with an outstanding balance of ₱${formattedLoanBalance}. You must fully settle the existing loan before applying for another loan.`
    : 'Member has no existing active loan with an outstanding balance.';

  checks.push({
    rule: 'EXISTING_OUTSTANDING_LOAN',
    title: 'Existing Outstanding Loan',
    passed: !hasActiveLoanWithBalance,
    requiredValue: 'No Active Loan with Outstanding Balance (Max 1)',
    actualValue: hasActiveLoanWithBalance 
      ? `${primaryActiveLoan?.loanTypeName || 'Loan'} #${primaryActiveLoan?.id} (Balance: ₱${formattedLoanBalance})` 
      : 'No Outstanding Loans (₱0.00)',
    description: existingLoanMessage,
    requirement: 'Existing Outstanding Loan',
    status: !hasActiveLoanWithBalance ? 'PASSED' : 'FAILED',
    message: existingLoanMessage
  });

  // 4f. Overdue Loans & Active Credit Limit
  const maxActive = 1; // Strict one-active-loan policy
  const memberActiveLoans = (db.loans || []).filter(l => l.memberId === member.id && l.status === 'ACTIVE');
  const hasOverdue = memberActiveLoans.some(l => {
    if (!l.dueDate) return false;
    return new Date(l.dueDate) < new Date() && (l.balance || 0) > 0;
  });
  const loanLimitPassed = memberActiveLoans.length <= 1 && !hasActiveLoanWithBalance && !hasOverdue;
  checks.push({
    rule: 'NO_OVERDUE_OR_EXCESS_LOANS',
    title: 'No Overdue Loans & Active Credit Limit',
    passed: loanLimitPassed,
    requiredValue: `Max 1 Active Loan, 0 Overdue`,
    actualValue: `${memberActiveLoans.length} Active Loan(s), ${hasOverdue ? 'Has Overdue Balance' : 'No Overdue'}`,
    description: loanLimitPassed
      ? 'Member has no overdue balance and satisfies active credit limits.'
      : hasOverdue
      ? 'Member has an overdue loan balance. Overdue balances must be settled prior to applying.'
      : `Member currently has ${memberActiveLoans.length} active loan(s). Cooperative policy permits only 1 active loan at a time.`,
    requirement: 'No Overdue Loans & Active Credit Limit',
    status: loanLimitPassed ? 'PASSED' : 'FAILED',
    message: loanLimitPassed
      ? 'Member has no overdue balance and satisfies active credit limits.'
      : hasOverdue
      ? 'Member has an overdue loan balance. Overdue balances must be settled prior to applying.'
      : `Member currently has ${memberActiveLoans.length} active loan(s). Cooperative policy permits only 1 active loan at a time.`
  });

  // 4g. Borrowing Capacity Limit
  const borrowingMultiplier = db.systemSettings.maxBorrowingMultiplier || 5;
  const maxCapacity = (member.shareCapital || 0) * borrowingMultiplier;
  const totalActiveLoanBalance = memberActiveLoans.reduce((sum, l) => sum + (l.balance || 0), 0);
  const requestedAmt = requestedAmount || 0;
  const totalExposure = totalActiveLoanBalance + requestedAmt;
  const remainingCapacity = maxCapacity - totalActiveLoanBalance;
  const capacityPassed = totalExposure <= maxCapacity;
  checks.push({
    rule: 'BORROWING_CAPACITY',
    title: 'Borrowing Capacity Limit',
    passed: capacityPassed,
    requiredValue: `Max Exposure: ₱${maxCapacity.toLocaleString()}`,
    actualValue: `Remaining Capacity: ₱${Math.max(0, remainingCapacity).toLocaleString()}`,
    description: capacityPassed
      ? `You have sufficient borrowing capacity. Remaining before this application: ₱${remainingCapacity.toLocaleString()}.`
      : `Requested amount of ₱${requestedAmt.toLocaleString()} exceeds your remaining borrowing capacity of ₱${Math.max(0, remainingCapacity).toLocaleString()}.`,
    requirement: 'Borrowing Capacity Limit',
    status: capacityPassed ? 'PASSED' : 'FAILED',
    message: capacityPassed
      ? `You have sufficient borrowing capacity. Remaining before this application: ₱${remainingCapacity.toLocaleString()}.`
      : `Requested amount of ₱${requestedAmt.toLocaleString()} exceeds your remaining borrowing capacity of ₱${Math.max(0, remainingCapacity).toLocaleString()}.`
  });

  // =========================================================================
  // 5. LOAN AMOUNT / TERM / PRODUCT RULES
  // =========================================================================
  if (requestedAmount > 0) {
    const minAmt = loanType.minAmount || 1000;
    const maxAmt = loanType.maxAmount || 500000;
    const amountInRange = requestedAmount >= minAmt && requestedAmount <= maxAmt;
    checks.push({
      rule: 'LOAN_AMOUNT_RANGE',
      title: 'Loan Amount Range',
      passed: amountInRange,
      requiredValue: `₱${minAmt.toLocaleString()} - ₱${maxAmt.toLocaleString()}`,
      actualValue: `₱${requestedAmount.toLocaleString()}`,
      description: amountInRange
        ? `Requested amount of ₱${requestedAmount.toLocaleString()} is within product limits.`
        : `Requested amount of ₱${requestedAmount.toLocaleString()} must be between ₱${minAmt.toLocaleString()} and ₱${maxAmt.toLocaleString()}.`,
      requirement: 'Loan Amount Range',
      status: amountInRange ? 'PASSED' : 'FAILED',
      message: amountInRange
        ? `Requested amount of ₱${requestedAmount.toLocaleString()} is within product limits.`
        : `Requested amount of ₱${requestedAmount.toLocaleString()} must be between ₱${minAmt.toLocaleString()} and ₱${maxAmt.toLocaleString()}.`
    });
  }

  const isEligible = checks.every(c => c.passed);

  return {
    isEligible,
    eligible: isEligible,
    missingRequirements,
    duplicateApplication,
    duplicateApplicationDetails: duplicateApplication && duplicateApp ? {
      applicationId: duplicateApp.id,
      submittedDate: duplicateApp.createdAt,
      status: duplicateApp.status,
      stage: duplicateApp.status.replace(/_/g, ' '),
      isRevisionRequired: duplicateApp.status === 'REVISION_REQUESTED',
      remarks: duplicateApp.remarks
    } : undefined,
    existingActiveLoan: primaryActiveLoan ? {
      id: primaryActiveLoan.id,
      loanId: primaryActiveLoan.id,
      loanTypeName: primaryActiveLoan.loanTypeName,
      principalAmount: primaryActiveLoan.principalAmount,
      balance: primaryActiveLoan.balance,
      monthlyAmortization: primaryActiveLoan.monthlyAmortization,
      disbursedAt: primaryActiveLoan.disbursedAt,
      dueDate: primaryActiveLoan.dueDate,
      durationMonths: primaryActiveLoan.durationMonths,
      isPastDue: primaryActiveLoan.dueDate ? new Date(primaryActiveLoan.dueDate) < new Date() && (primaryActiveLoan.balance || 0) > 0 : false,
      status: primaryActiveLoan.status
    } : undefined,
    complianceDetails: {
      pmes: {
        required: isPmesRequired,
        completed: isPmesCompleted,
        status: pmesDisplayStatus,
        record: pmesRecord
      },
      orientation: {
        required: isOrientationRequired,
        completed: isOrientationCompleted,
        status: orientDisplayStatus,
        record: orientationRecord
      }
    },
    requirements: [
      {
        code: 'PRE_MEMBERSHIP_SEMINAR',
        name: 'Pre-membership Education Seminar (PMES)',
        status: pmesDisplayStatus
      },
      {
        code: 'LOAN_ORIENTATION',
        name: 'Loan Orientation & Credit Counseling',
        status: orientDisplayStatus
      }
    ],
    checks,
    loanType,
    member: {
      id: member.id,
      fullName: member.fullName,
      status: member.status
    }
  };
}

// Helper: Dispatches System Notification and SMS
function dispatchLoanSmsAndNotif(
  db: DatabaseState,
  member: Member,
  title: string,
  messageText: string
) {
  CooperativeDB.createNotification(member.id, title, messageText);

  if (member.phone && db.systemSettings?.smsNotificationsEnabled) {
    if (!db.smsNotifications) db.smsNotifications = [];
    const gateway = db.smsGatewaySettings?.activeGateway || 'SystemSimulator';
    db.smsNotifications.unshift({
      id: 'sms_ln_' + Math.random().toString(36).substring(2, 10),
      memberId: member.id,
      memberName: member.fullName,
      memberNumber: member.id,
      phone: member.phone,
      category: 'INDIVIDUAL_NOTICE',
      type: 'MANUAL_SINGLE',
      message: `${db.systemSettings.cooperativeName}: ${title} - ${messageText}`,
      status: 'Sent',
      gatewayUsed: gateway,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
  }
}

// Helper: Finalizes Loan Completion if balance reaches ₱0.00

// =======================================================================
// LOAN AMORTIZATION & REPAYMENT SCHEDULING SYSTEM
// =======================================================================

/**
 * Returns the calendar date string (YYYY-MM-DD) in Asia/Manila timezone (UTC+8)
 */
export function getManilaDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function evaluateInstallmentStatuses(loan: Loan, asOfDate?: Date): void {
  if (!loan.amortizationSchedule || !Array.isArray(loan.amortizationSchedule)) return;
  const todayStr = getManilaDateString(asOfDate);

  for (const item of loan.amortizationSchedule) {
    if (item.status === 'WAIVED') continue;

    const scheduled = item.scheduledAmount || Number(((item.principalAmount || 0) + (item.interestAmount || 0) + (item.penaltyAmount || 0)).toFixed(2));
    item.scheduledAmount = scheduled;
    const paid = item.amountPaid || 0;
    const remaining = Math.max(0, Number((scheduled - paid).toFixed(2)));
    item.remainingAmount = remaining;

    if (paid >= scheduled && scheduled > 0) {
      item.status = 'PAID';
      item.remainingAmount = 0;
    } else if (item.dueDate < todayStr) {
      item.status = 'PAST_DUE';
    } else if (paid > 0) {
      item.status = 'PARTIALLY_PAID';
    } else {
      // Unpaid (paid === 0)
      if (item.dueDate === todayStr) {
        item.status = 'DUE';
      } else {
        item.status = 'UPCOMING';
      }
    }
  }

  // Update nextDueDate and dueDate on the loan to the earliest unpaid/partially paid installment
  const nextUnpaid = loan.amortizationSchedule.find(i => i.status !== 'PAID' && i.status !== 'WAIVED');
  if (nextUnpaid) {
    loan.nextDueDate = nextUnpaid.dueDate;
    loan.dueDate = nextUnpaid.dueDate;
  }
}

export function ensureLoanAmortizationSchedule(loan: Loan): void {
  if (!loan.paymentFrequency) loan.paymentFrequency = 'MONTHLY';

  if (!loan.amortizationSchedule || loan.amortizationSchedule.length === 0) {
    const duration = loan.durationMonths || 12;
    const princ = loan.principalAmount || (loan.totalRepayable ? loan.totalRepayable * 0.9 : 50000);
    const intTotal = loan.interestAmount || (loan.totalRepayable ? loan.totalRepayable - princ : princ * 0.1);
    const totalRepay = loan.totalRepayable || (princ + intTotal);
    const mPrinc = Math.round((princ / duration) * 100) / 100;
    const mInt = Math.round((intTotal / duration) * 100) / 100;
    const mTotal = Math.round((mPrinc + mInt) * 100) / 100;

    const baseDate = loan.disbursedAt ? new Date(loan.disbursedAt) : (loan.createdAt ? new Date(loan.createdAt) : new Date());
    const schedule: AmortizationItem[] = [];
    let remBal = totalRepay;

    for (let i = 1; i <= duration; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      remBal = Math.max(0, Number((remBal - mTotal).toFixed(2)));

      schedule.push({
        installmentNo: i,
        dueDate: d.toISOString().split('T')[0],
        principalAmount: mPrinc,
        interestAmount: mInt,
        penaltyAmount: 0,
        scheduledAmount: mTotal,
        amountPaid: 0,
        remainingBalance: remBal,
        remainingAmount: mTotal,
        status: 'UPCOMING'
      });
    }
    loan.amortizationSchedule = schedule;
  }

  for (const item of loan.amortizationSchedule) {
    if (!item.scheduledAmount) {
      item.scheduledAmount = Number(((item.principalAmount || 0) + (item.interestAmount || 0) + (item.penaltyAmount || 0)).toFixed(2));
    }
    if (item.amountPaid === undefined) item.amountPaid = 0;
    if (item.remainingAmount === undefined) {
      item.remainingAmount = Math.max(0, Number((item.scheduledAmount - item.amountPaid).toFixed(2)));
    }
  }

  evaluateInstallmentStatuses(loan);
}

export function calculateAmortizationAllocation(
  loan: Loan,
  paymentAmount: number,
  targetInstallmentNo?: number
): {
  allocations: PaymentAllocationItem[];
  totalPrincipal: number;
  totalInterest: number;
  totalPenalty: number;
  remainingLoanBalanceAfter: number;
  isAdvancePayment: boolean;
  targetDueDate?: string;
  targetInstallmentNo?: number;
} {
  ensureLoanAmortizationSchedule(loan);
  const todayStr = getManilaDateString();
  const allocations: PaymentAllocationItem[] = [];
  let remainingPayment = Number(paymentAmount.toFixed(2));

  const schedule = [...(loan.amortizationSchedule || [])].sort((a, b) => a.installmentNo - b.installmentNo);

  // Determine starting point based on controlled allocation policy:
  // Default behavior: satisfy earliest outstanding eligible installment first
  const earliestUnpaidIdx = schedule.findIndex(i => i.status !== 'PAID' && i.status !== 'WAIVED');
  let startIndex = earliestUnpaidIdx !== -1 ? earliestUnpaidIdx : 0;

  // If user requested a specific target installment and that target is eligible
  if (targetInstallmentNo) {
    const requestedIdx = schedule.findIndex(i => i.installmentNo === targetInstallmentNo);
    if (requestedIdx !== -1) {
      // If all installments before requestedIdx are already PAID, we can start directly from requestedIdx
      const hasPriorUnpaid = schedule.slice(0, requestedIdx).some(i => i.status !== 'PAID' && i.status !== 'WAIVED');
      if (!hasPriorUnpaid) {
        startIndex = requestedIdx;
      }
    }
  }

  const targetItem = schedule[startIndex] || schedule[0];
  const isAdvancePayment = targetItem ? (targetItem.dueDate > todayStr && (targetItem.amountPaid || 0) < targetItem.scheduledAmount) : false;
  const targetDueDate = targetItem?.dueDate;
  const resolvedTargetInstallmentNo = targetItem?.installmentNo;

  for (let i = startIndex; i < schedule.length && remainingPayment > 0; i++) {
    const item = schedule[i];
    if (item.status === 'PAID' || item.status === 'WAIVED') continue;

    const scheduled = item.scheduledAmount || Number(((item.principalAmount || 0) + (item.interestAmount || 0) + (item.penaltyAmount || 0)).toFixed(2));
    const alreadyPaid = item.amountPaid || 0;
    const dueForThisItem = Math.max(0, Number((scheduled - alreadyPaid).toFixed(2)));

    if (dueForThisItem <= 0) continue;

    const allocateToItem = Math.min(remainingPayment, dueForThisItem);
    const newPaid = Number((alreadyPaid + allocateToItem).toFixed(2));
    const isNowPaid = newPaid >= scheduled;

    // Component breakdown: penalty first, then interest, then principal
    const penDue = Math.max(0, (item.penaltyAmount || 0) - (item.penaltyPaid || 0));
    const intDue = Math.max(0, (item.interestAmount || 0) - (item.interestPaid || 0));

    let itemRem = allocateToItem;
    const penPortion = Math.min(itemRem, penDue);
    itemRem -= penPortion;
    const intPortion = Math.min(itemRem, intDue);
    itemRem -= intPortion;
    const princPortion = itemRem;

    allocations.push({
      installmentNo: item.installmentNo,
      dueDate: item.dueDate,
      principalPortion: Number(princPortion.toFixed(2)),
      interestPortion: Number(intPortion.toFixed(2)),
      penaltyPortion: Number(penPortion.toFixed(2)),
      totalAllocated: Number(allocateToItem.toFixed(2)),
      statusAfterPayment: isNowPaid ? 'PAID' : (item.dueDate < todayStr ? 'PAST_DUE' : 'PARTIALLY_PAID'),
      remainingInstallmentDue: Math.max(0, Number((scheduled - newPaid).toFixed(2)))
    });

    remainingPayment = Number((remainingPayment - allocateToItem).toFixed(2));
  }

  const totalPrincipal = Number(allocations.reduce((sum, a) => sum + a.principalPortion, 0).toFixed(2));
  const totalInterest = Number(allocations.reduce((sum, a) => sum + a.interestPortion, 0).toFixed(2));
  const totalPenalty = Number(allocations.reduce((sum, a) => sum + a.penaltyPortion, 0).toFixed(2));
  const remainingLoanBalanceAfter = Math.max(0, Number((loan.balance - paymentAmount).toFixed(2)));

  return {
    allocations,
    totalPrincipal,
    totalInterest,
    totalPenalty,
    remainingLoanBalanceAfter,
    isAdvancePayment,
    targetDueDate,
    targetInstallmentNo: resolvedTargetInstallmentNo
  };
}

export function applyPaymentToAmortizationSchedule(
  loan: Loan,
  paymentAmount: number,
  paymentDate: string,
  externalReference?: string,
  officialReceiptNumber?: string,
  paymentRequestId?: string,
  targetInstallmentNo?: number
) {
  const allocationResult = calculateAmortizationAllocation(loan, paymentAmount, targetInstallmentNo);

  if (loan.amortizationSchedule) {
    for (const alloc of allocationResult.allocations) {
      const item = loan.amortizationSchedule.find(i => i.installmentNo === alloc.installmentNo);
      if (item) {
        item.amountPaid = Number(((item.amountPaid || 0) + alloc.totalAllocated).toFixed(2));
        item.principalPaid = Number(((item.principalPaid || 0) + alloc.principalPortion).toFixed(2));
        item.interestPaid = Number(((item.interestPaid || 0) + alloc.interestPortion).toFixed(2));
        item.penaltyPaid = Number(((item.penaltyPaid || 0) + alloc.penaltyPortion).toFixed(2));
        item.remainingAmount = alloc.remainingInstallmentDue;
        item.status = alloc.statusAfterPayment;
        item.paymentDate = paymentDate;
        if (officialReceiptNumber) item.officialReceiptNumber = officialReceiptNumber;
        if (externalReference) item.gcashRefNumber = externalReference;
        if (paymentRequestId) item.paymentRequestId = paymentRequestId;
      }
    }
    evaluateInstallmentStatuses(loan);
  }

  return allocationResult;
}

function processAmortizationPayment(loan: Loan, paymentAmount: number, paymentDate: string, externalReference?: string, officialReceiptNumber?: string) {
  return applyPaymentToAmortizationSchedule(loan, paymentAmount, paymentDate, externalReference, officialReceiptNumber);
}

function checkAndFinalizeLoanCompletion(
  db: DatabaseState,
  loan: Loan,
  operatorUser: { id: string; email?: string; role?: Role }
): boolean {
  if (loan.balance <= 0) {
    loan.balance = 0;
    loan.status = 'COMPLETED';

    // Update associated loan application status if found
    if (loan.applicationId) {
      const app = db.loanApplications.find(a => a.id === loan.applicationId);
      if (app) app.status = 'COMPLETED';
    }

    const member = db.members.find(m => m.id === loan.memberId);
    if (member) {
      dispatchLoanSmsAndNotif(
        db,
        member,
        '🎉 Loan Contract Fully Settled & Completed!',
        `Congratulations ${member.fullName}! Your ${loan.loanTypeName} loan contract (#${loan.id.substring(0, 8).toUpperCase()}) has been FULLY PAID & COMPLETED! Outstanding balance is ₱0.00. The loan account is officially settled and archived.`
      );
    }

    CooperativeDB.logAudit(
      operatorUser.id,
      operatorUser.email || 'SYSTEM',
      operatorUser.role || 'STAFF',
      'LOAN_COMPLETED',
      `Loan contract ${loan.id} for member ${loan.memberName} reached ₱0.00 balance. Status set to PAID/COMPLETED and archived.`
    );
    return true;
  }
  return false;
}

// Get Loan Types
apiRouter.get('/loans/types', (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json(db.loanTypes);
});

// Admin Save/Update Loan Policy / Type
apiRouter.post('/admin/loans/types', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { 
    id, name, interestRate, maxDurationMonths, minAmount, maxAmount,
    minMembershipMonths, minShareCapital, requiresMigs, requiresOrientation,
    maxActiveLoansAllowed, requiredDocuments, gracePeriodDays, penaltyRatePercent, description
  } = req.body;

  if (!name || interestRate === undefined || !maxDurationMonths || !minAmount || !maxAmount) {
    res.status(400).json({ error: 'Please fill in all mandatory loan policy fields (Name, Interest Rate, Duration, Amounts).' });
    return;
  }

  const db = CooperativeDB.load();
  if (!db.loanTypes) db.loanTypes = [];

  let loanType: LoanType | undefined;
  if (id) {
    loanType = db.loanTypes.find(t => t.id === id);
  }

  if (loanType) {
    loanType.name = name;
    loanType.interestRate = Number(interestRate);
    loanType.maxDurationMonths = Number(maxDurationMonths);
    loanType.minAmount = Number(minAmount);
    loanType.maxAmount = Number(maxAmount);
    loanType.minMembershipMonths = minMembershipMonths !== undefined ? Number(minMembershipMonths) : 0;
    loanType.minShareCapital = Number(minShareCapital || 5000);
    loanType.requiresMigs = requiresMigs !== false;
    loanType.requiresOrientation = !!requiresOrientation;
    loanType.maxActiveLoansAllowed = Number(maxActiveLoansAllowed || 1);
    loanType.requiredDocuments = requiredDocuments || ['Government ID', 'Payslip / Proof of Income'];
    loanType.gracePeriodDays = Number(gracePeriodDays || 5);
    loanType.penaltyRatePercent = Number(penaltyRatePercent || 2);
    loanType.description = description || '';
  } else {
    loanType = {
      id: 'lt_' + Math.random().toString(36).substring(2, 9),
      name,
      interestRate: Number(interestRate),
      maxDurationMonths: Number(maxDurationMonths),
      minAmount: Number(minAmount),
      maxAmount: Number(maxAmount),
      minMembershipMonths: minMembershipMonths !== undefined ? Number(minMembershipMonths) : 0,
      minShareCapital: Number(minShareCapital || 5000),
      requiresMigs: requiresMigs !== false,
      requiresOrientation: !!requiresOrientation,
      maxActiveLoansAllowed: Number(maxActiveLoansAllowed || 1),
      requiredDocuments: requiredDocuments || ['Government ID', 'Payslip / Proof of Income'],
      gracePeriodDays: Number(gracePeriodDays || 5),
      penaltyRatePercent: Number(penaltyRatePercent || 2),
      description: description || ''
    };
    db.loanTypes.push(loanType);
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit((req as AuthenticatedRequest).user!.id, (req as AuthenticatedRequest).user!.email, 'ADMIN', 'LOAN_POLICY_UPDATED', `Saved policy settings for loan product: ${name}`);

  res.json({ message: 'Loan policy configured successfully!', loanType, loanTypes: db.loanTypes });
});

// Admin Delete Loan Policy / Type
apiRouter.delete('/admin/loans/types/:id', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = CooperativeDB.load();
  if (!db.loanTypes) db.loanTypes = [];

  const index = db.loanTypes.findIndex(t => t.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Loan type not found' });
    return;
  }

  const deleted = db.loanTypes.splice(index, 1)[0];
  CooperativeDB.save(db);
  CooperativeDB.logAudit((req as AuthenticatedRequest).user!.id, (req as AuthenticatedRequest).user!.email, 'ADMIN', 'LOAN_POLICY_DELETED', `Deleted loan product: ${deleted.name}`);

  res.json({ message: 'Loan policy removed successfully!', loanTypes: db.loanTypes });
});

// Member Eligibility Check Endpoint
apiRouter.get('/loans/check-eligibility', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const loanTypeId = req.query.loanTypeId as string;
  const amount = Number(req.query.amount || 0);
  if (tokenUser.role === 'MEMBER' && req.query.memberId && req.query.memberId !== tokenUser.id && req.query.memberId !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only check eligibility for their own account.' });
    return;
  }
  const targetMemberId = (tokenUser.role === 'ADMIN' || tokenUser.role === 'STAFF') && req.query.memberId ? (req.query.memberId as string) : tokenUser.id;

  if (!loanTypeId) {
    res.status(400).json({ error: 'Loan type ID parameter is required' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === targetMemberId);
  if (!member) {
    res.status(404).json({ error: 'Member profile not found.' });
    return;
  }

  const loanType = db.loanTypes.find(t => t.id === loanTypeId);
  if (!loanType) {
    res.status(404).json({ error: 'Selected loan product does not exist.' });
    return;
  }

  // Perform Automated Eligibility Verification
  const eligibility = evaluateLoanEligibility(member, loanType, db, amount);

  const pendingRequirements: Array<{ code: string; name: string; status: string }> = [];
  if (eligibility.missingRequirements.includes('PRE_MEMBERSHIP_SEMINAR')) {
    const pmesRec = (member.complianceRecords || []).find(r => 
      r.requirementType === 'PRE_MEMBERSHIP_SEMINAR' || 
      (r.requirementType as string) === 'PMES' ||
      (r as any).type === 'PRE_MEMBERSHIP_SEMINAR' ||
      (r as any).type === 'PMES'
    );
    pendingRequirements.push({
      code: 'PRE_MEMBERSHIP_SEMINAR',
      name: 'Pre-membership Education Seminar (PMES)',
      status: pmesRec?.status || 'NOT_COMPLETED'
    });
  }
  if (eligibility.missingRequirements.includes('LOAN_ORIENTATION')) {
    const orientRec = (member.complianceRecords || []).find(r => 
      r.requirementType === 'LOAN_ORIENTATION' || 
      (r.requirementType as string) === 'ORIENTATION' ||
      (r as any).type === 'LOAN_ORIENTATION' ||
      (r as any).type === 'ORIENTATION'
    );
    pendingRequirements.push({
      code: 'LOAN_ORIENTATION',
      name: 'Loan Orientation & Credit Counseling',
      status: orientRec?.status || 'NOT_COMPLETED'
    });
  }

  res.json({
    eligible: eligibility.eligible,
    isEligible: eligibility.isEligible,
    missingRequirements: eligibility.missingRequirements,
    duplicateApplication: eligibility.duplicateApplication,
    duplicateApplicationDetails: eligibility.duplicateApplicationDetails,
    complianceDetails: eligibility.complianceDetails,
    existingActiveLoan: eligibility.existingActiveLoan,
    requirements: [
      {
        code: 'PRE_MEMBERSHIP_SEMINAR',
        name: 'Pre-membership Education Seminar (PMES)',
        status: eligibility.complianceDetails?.pmes.status || 'NOT_COMPLETED'
      },
      {
        code: 'LOAN_ORIENTATION',
        name: 'Loan Orientation & Credit Counseling',
        status: eligibility.complianceDetails?.orientation.status || 'NOT_COMPLETED'
      }
    ],
    checks: eligibility.checks,
    loanType,
    member: {
      id: member.id,
      fullName: member.fullName,
      status: member.status
    }
  });
});

// Submit Loan Application
apiRouter.post('/loans/apply', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { loanTypeId, amount, durationMonths, purpose, collateralDescription, coMakerName, coMakerContact, documents, memberId: bodyMemberId } = req.body;

  if (tokenUser.role === 'MEMBER' && bodyMemberId && bodyMemberId !== tokenUser.id && bodyMemberId !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only submit loan applications for their own account.' });
    return;
  }

  if (!loanTypeId || !amount || !durationMonths) {
    res.status(400).json({ error: 'Missing required application fields.' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === tokenUser.id);
  if (!member) {
    res.status(404).json({ error: 'Member profile not found.' });
    return;
  }

  const loanType = db.loanTypes.find(t => t.id === loanTypeId);
  if (!loanType) {
    res.status(404).json({ error: 'Selected loan product does not exist.' });
    return;
  }

  const loanAmount = Number(amount);

  // Perform Automated Eligibility Verification using authoritative helper
  const eligibility = evaluateLoanEligibility(member, loanType, db, loanAmount);

  // 1. Mandatory Compliance Check (PMES / Seminar)
  if (eligibility.missingRequirements && eligibility.missingRequirements.length > 0) {
    const isPmesMissing = eligibility.missingRequirements.includes('PRE_MEMBERSHIP_SEMINAR');
    const isOrientationMissing = eligibility.missingRequirements.includes('LOAN_ORIENTATION');
    
    let errMsg = 'Loan application is unavailable due to missing mandatory requirements.';
    if (isPmesMissing && isOrientationMissing) {
      errMsg = 'Loan Application Unavailable: Missing mandatory compliance requirements (Pre-membership Education Seminar and Loan Orientation & Credit Counseling).';
    } else if (isPmesMissing) {
      errMsg = 'Loan Application Unavailable: Please complete and have your Pre-membership Education Seminar verified by Staff.';
    } else if (isOrientationMissing) {
      errMsg = 'Loan Application Unavailable: Missing requirement: Loan Orientation & Credit Counseling.';
    }

    res.status(400).json({
      eligible: false,
      isEligible: false,
      missingRequirements: eligibility.missingRequirements,
      duplicateApplication: false,
      complianceDetails: eligibility.complianceDetails,
      error: isPmesMissing ? 'PMES_NOT_COMPLETED' : 'ORIENTATION_NOT_COMPLETED',
      message: errMsg,
      checks: eligibility.checks
    });
    return;
  }

  // 2. Duplicate Application Check (Only flagged when compliance is satisfied and active app exists for same product)
  if (eligibility.duplicateApplication) {
    const dupDetails = eligibility.duplicateApplicationDetails;
    const msg = dupDetails?.isRevisionRequired
      ? `An active application (${dupDetails.applicationId}) is in Revision Required status. Please revise and resubmit your existing application instead of creating a new one.`
      : `An active application already exists for this loan product (ID: ${dupDetails?.applicationId || 'existing'}).`;

    res.status(400).json({
      eligible: false,
      isEligible: false,
      missingRequirements: [],
      duplicateApplication: true,
      duplicateApplicationDetails: dupDetails,
      error: 'DUPLICATE_APPLICATION',
      message: msg,
      checks: eligibility.checks
    });
    return;
  }

  // 3. One-Active-Loan-Per-Member Policy Check (Existing Outstanding Loan)
  const existingLoanCheck = eligibility.checks.find(c => c.rule === 'EXISTING_OUTSTANDING_LOAN' && !c.passed);
  if (existingLoanCheck) {
    res.status(400).json({
      eligible: false,
      isEligible: false,
      missingRequirements: [],
      duplicateApplication: false,
      error: 'EXISTING_OUTSTANDING_LOAN',
      title: existingLoanCheck.title,
      message: existingLoanCheck.description,
      checks: eligibility.checks,
      existingActiveLoan: eligibility.existingActiveLoan
    });
    return;
  }

  // 4. Other Policy & Financial Eligibility Checks (Share Capital, Tenure, MIGS, Capacity, etc.)
  if (!eligibility.isEligible) {
    const failedCheck = eligibility.checks.find(c => !c.passed);
    res.status(400).json({ 
       error: 'LOAN_ELIGIBILITY_FAILED',
       message: failedCheck ? `${failedCheck.title}: ${failedCheck.description}` : 'Loan application unavailable: Cooperative policy requirements were not met.',
       eligible: false,
       isEligible: false,
       missingRequirements: eligibility.missingRequirements,
       duplicateApplication: eligibility.duplicateApplication,
       checks: eligibility.checks
     });
    return;
  }

  const months = Number(durationMonths);
  if (months > loanType.maxDurationMonths) {
    res.status(400).json({ error: `Duration cannot exceed ${loanType.maxDurationMonths} months for ${loanType.name}.` });
    return;
  }

  // Validate Required Documents Upload
  const requiredDocs = loanType.requiredDocuments || [];
  const uploadedDocsList: LoanApplicationDocument[] = Array.isArray(documents) ? documents : [];

  if (requiredDocs.length > 0 && Array.isArray(documents)) {
    const uploadedTypes = new Set(uploadedDocsList.map(d => d.documentType));
    const missingTypes = requiredDocs.filter(reqDoc => !uploadedTypes.has(reqDoc));
    if (missingTypes.length > 0) {
      res.status(400).json({
        error: `Please upload all required supporting documents before submitting: ${missingTypes.join(', ')}`
      });
      return;
    }
  }

  // Calculate Amortization
  const totalInterest = loanAmount * loanType.interestRate * (months / 12);
  const totalRepayable = loanAmount + totalInterest;
  const monthlyAmortization = Number((totalRepayable / months).toFixed(2));

  const application: LoanApplication = {
    id: 'la_' + Math.random().toString(36).substring(2, 11),
    memberId: member.id,
    memberName: member.fullName,
    loanTypeId: loanType.id,
    loanTypeName: loanType.name,
    amount: loanAmount,
    durationMonths: months,
    status: 'PENDING_REVIEW',
    monthlyAmortization,
    purpose: purpose || 'Personal Need',
    collateralDescription: collateralDescription || '',
    coMakerName: coMakerName || '',
    coMakerContact: coMakerContact || '',
    createdAt: new Date().toISOString(),
    documents: uploadedDocsList.map(d => ({
      ...d,
      id: d.id || 'doc_' + Math.random().toString(36).substring(2, 9),
      status: d.status || 'PENDING',
      uploadedAt: d.uploadedAt || new Date().toISOString()
    })),
    eligibilitySnapshot: eligibility.checks
  };

  db.loanApplications.unshift(application);
  dispatchLoanSmsAndNotif(db, member, 'Loan Application Submitted', `Your application for ${loanType.name} of ₱${loanAmount.toLocaleString()} has been submitted and is under pending review.`);

  // Notify Admins and Staff
  db.users.forEach(u => {
    if (u.role === 'ADMIN' || u.role === 'STAFF') {
      db.notifications.unshift({
        id: 'notif_' + Math.random().toString(36).substring(2, 11),
        userId: u.id,
        title: 'New Loan Application',
        message: `${member.fullName} submitted a new loan application for ${loanType.name} (₱${loanAmount.toLocaleString()}).`,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
  });

  CooperativeDB.save(db);
  CooperativeDB.logAudit(member.id, member.email, 'MEMBER', 'LOAN_APPLICATION_SUBMITTED', `Applied for ${loanType.name} of ₱${loanAmount.toLocaleString()} for ${months} months with ${application.documents?.length || 0} attached document(s).`);

  res.status(201).json({ message: 'Loan application submitted successfully!', application });
});

// ============================================================================
// AUTHORITATIVE LOAN APPLICATIONS ENDPOINTS (MEMBER, STAFF, ADMIN)
// ============================================================================

// GET /api/loans/applications - Authoritative applications list with role-based filtering
apiRouter.get('/loans/applications', requireRole(['ADMIN', 'STAFF', 'MEMBER']), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();
  const { memberId, status, loanTypeId } = req.query;

  let apps = [...(db.loanApplications || [])];

  // If role is MEMBER, strictly restrict to their own applications
  if (tokenUser.role === 'MEMBER') {
    if (memberId && typeof memberId === 'string' && memberId !== tokenUser.id && memberId !== tokenUser.memberId) {
      res.status(403).json({ error: 'Forbidden: Members can only view their own loan applications.' });
      return;
    }
    apps = apps.filter(a => a.memberId === tokenUser.id);
  } else if (memberId && typeof memberId === 'string') {
    // Admin or Staff filtering by specific memberId
    apps = apps.filter(a => a.memberId === memberId);
  }

  if (status && typeof status === 'string' && status !== 'ALL') {
    apps = apps.filter(a => a.status === status);
  }

  if (loanTypeId && typeof loanTypeId === 'string' && loanTypeId !== 'ALL') {
    apps = apps.filter(a => a.loanTypeId === loanTypeId);
  }

  // Pre-index members, loanTypes, and staff for O(1) lookup per application
  const memberById = new Map(db.members.map(m => [m.id, m]));
  const loanTypeById = new Map(db.loanTypes.map(t => [t.id, t]));
  const staffById = new Map((db.staff || []).map(s => [s.id, s]));

  // Enrich with member profile and loan type details so Staff/Admin have all needed context
  const enriched = apps.map(a => {
    const mem = memberById.get(a.memberId);
    const lt = loanTypeById.get(a.loanTypeId);
    const reviewer = a.reviewedBy ? staffById.get(a.reviewedBy) : undefined;
    return {
      ...a,
      memberName: a.memberName || mem?.fullName || 'Unknown Member',
      loanTypeName: a.loanTypeName || lt?.name || 'Loan',
      email: mem?.email || '',
      mobileNumber: mem?.phone || '',
      shareCapital: mem?.shareCapital || 0,
      savingsBalance: mem?.regularSavings || 0,
      reviewerName: reviewer ? reviewer.fullName : (a.reviewedBy || undefined)
    };
  });

  res.json(enriched);
});

// GET /api/loans/applications/:id - Single application details
apiRouter.get('/loans/applications/:id', requireRole(['ADMIN', 'STAFF', 'MEMBER']), (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  const app = (db.loanApplications || []).find(a => a.id === id);
  if (!app) {
    res.status(404).json({ error: 'Loan application not found.' });
    return;
  }

  if (tokenUser.role === 'MEMBER' && app.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'You are not authorized to view this application.' });
    return;
  }

  const mem = db.members.find(m => m.id === app.memberId);
  const lt = db.loanTypes.find(t => t.id === app.loanTypeId);
  const reviewer = app.reviewedBy ? db.staff.find(s => s.id === app.reviewedBy) : undefined;

  res.json({
    ...app,
    memberName: app.memberName || mem?.fullName || 'Unknown Member',
    loanTypeName: app.loanTypeName || lt?.name || 'Loan',
    email: mem?.email || '',
    mobileNumber: mem?.phone || '',
    shareCapital: mem?.shareCapital || 0,
    savingsBalance: mem?.regularSavings || 0,
    reviewerName: reviewer ? reviewer.fullName : (app.reviewedBy || undefined)
  });
});

// POST /api/loans/cancel/:id - Member / Staff cancellation / withdrawal of pending application
apiRouter.post('/loans/cancel/:id', requireRole(['MEMBER', 'STAFF', 'ADMIN']), (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const app = (db.loanApplications || []).find(a => a.id === id);

  if (!app) {
    res.status(404).json({ error: 'Loan application not found.' });
    return;
  }

  // If Member, verify ownership
  if (tokenUser.role === 'MEMBER' && app.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'You are not authorized to cancel this application.' });
    return;
  }

  // Only active/pending applications can be cancelled
  const canCancelStatuses: LoanStatus[] = ['PENDING_REVIEW', 'UNDER_REVIEW', 'REVISION_REQUESTED'];
  if (!canCancelStatuses.includes(app.status)) {
    res.status(400).json({ error: `Cannot cancel application in '${app.status}' status.` });
    return;
  }

  app.status = 'REJECTED';
  const cancellationReason = reason || (tokenUser.role === 'MEMBER' ? 'Withdrawn by applicant' : 'Cancelled by staff');
  app.remarks = `[CANCELLED] ${cancellationReason}`;
  app.updatedAt = new Date().toISOString();

  const member = db.members.find(m => m.id === app.memberId);
  if (member) {
    dispatchLoanSmsAndNotif(
      db,
      member,
      'Loan Application Cancelled',
      `Your loan application #${app.id} for ${app.loanTypeName} has been cancelled (${cancellationReason}).`
    );
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'LOAN_APPLICATION_CANCELLED',
    `Cancelled loan application ${id} for member ${app.memberName || app.memberId}. Reason: ${cancellationReason}`
  );

  res.json({ message: 'Loan application successfully cancelled.', application: app });
});

// GET /api/loans - Get loans array (supports StaffLoanMonitoring and other components)
apiRouter.get('/loans', requireRole(['ADMIN', 'STAFF', 'MEMBER']), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  let loans = [...(db.loans || [])];
  if (tokenUser.role === 'MEMBER') {
    loans = loans.filter(l => l.memberId === tokenUser.id);
  }

  loans.forEach(l => {
    ensureLoanAmortizationSchedule(l);
  });

  const enrichedLoans = loans.map(l => {
    const pendingPaymentRequests = (db.paymentRequests || []).filter(pr =>
      pr.paymentType === 'LOAN_PAYMENT' &&
      (pr.targetReferenceId === l.id || pr.loanId === l.id) &&
      (pr.status === 'PENDING_RECONCILIATION' || pr.status === 'UNPAID')
    );
    return {
      ...l,
      pendingPaymentRequests
    };
  });

  res.json({ loans: enrichedLoans });
});

// POST /api/loans/:id/amortization/preview-payment - Previews allocation for current, advance, or partial payment
apiRouter.post('/loans/:id/amortization/preview-payment', requireRole(['ADMIN', 'STAFF', 'MEMBER']), (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, targetInstallmentNo } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  const loan = (db.loans || []).find(l => l.id === id || l.id.substring(0, 8).toUpperCase() === id.toUpperCase());
  if (!loan) {
    res.status(404).json({ error: 'Loan contract record not found.' });
    return;
  }

  if (tokenUser.role === 'MEMBER' && loan.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'Access denied. Members can only preview their own loan repayments.' });
    return;
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    res.status(400).json({ error: 'Payment amount must be a positive number.' });
    return;
  }

  if (numericAmount > loan.balance) {
    res.status(400).json({ error: `Payment amount (₱${numericAmount.toLocaleString()}) exceeds the total outstanding balance of ₱${loan.balance.toLocaleString()}.` });
    return;
  }

  const instNo = targetInstallmentNo ? Number(targetInstallmentNo) : undefined;
  const allocation = calculateAmortizationAllocation(loan, numericAmount, instNo);

  const targetItem = (loan.amortizationSchedule || []).find(i => i.installmentNo === (allocation.targetInstallmentNo || 1));
  const targetScheduled = targetItem ? targetItem.scheduledAmount : 0;
  const isPartial = numericAmount < targetScheduled;

  res.json({
    loanId: loan.id,
    loanTypeName: loan.loanTypeName,
    outstandingBalance: loan.balance,
    paymentAmount: numericAmount,
    targetInstallmentNo: allocation.targetInstallmentNo,
    targetDueDate: allocation.targetDueDate,
    isAdvancePayment: allocation.isAdvancePayment,
    advanceNotice: allocation.isAdvancePayment ? 'This is an advance payment. Your installment is not yet due.' : null,
    isPartialPayment: isPartial,
    partialNotice: isPartial ? `Partial payment. Remaining installment obligation will be ₱${(targetScheduled - numericAmount).toLocaleString()}.` : null,
    totalPrincipal: allocation.totalPrincipal,
    totalInterest: allocation.totalInterest,
    totalPenalty: allocation.totalPenalty,
    remainingLoanBalanceAfter: allocation.remainingLoanBalanceAfter,
    allocations: allocation.allocations
  });
});

// Member Resubmit Loan Application (when status is REVISION_REQUESTED)
apiRouter.post('/loans/resubmit/:id', requireRole(['MEMBER']), (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { amount, durationMonths, purpose, collateralDescription, coMakerName, coMakerContact, documents } = req.body;

  const db = CooperativeDB.load();
  const app = db.loanApplications.find(a => a.id === id && a.memberId === tokenUser.id);

  if (!app) {
    res.status(404).json({ error: 'Loan application not found.' });
    return;
  }

  if (app.status !== 'REVISION_REQUESTED' && app.status !== 'PENDING_REVIEW') {
    res.status(400).json({ error: 'Only applications marked for revision or pending review can be resubmitted.' });
    return;
  }

  const member = db.members.find(m => m.id === tokenUser.id);
  const loanType = db.loanTypes.find(t => t.id === app.loanTypeId);

  if (amount) app.amount = Number(amount);
  if (durationMonths) app.durationMonths = Number(durationMonths);
  if (purpose) app.purpose = purpose;
  if (collateralDescription !== undefined) app.collateralDescription = collateralDescription;
  if (coMakerName !== undefined) app.coMakerName = coMakerName;
  if (coMakerContact !== undefined) app.coMakerContact = coMakerContact;

  if (loanType && app.amount && app.durationMonths) {
    const totalInterest = app.amount * loanType.interestRate * (app.durationMonths / 12);
    app.monthlyAmortization = Number(((app.amount + totalInterest) / app.durationMonths).toFixed(2));
  }

  if (Array.isArray(documents) && documents.length > 0) {
    app.documents = documents.map(d => ({
      ...d,
      id: d.id || 'doc_' + Math.random().toString(36).substring(2, 9),
      status: d.status || 'PENDING',
      uploadedAt: d.uploadedAt || new Date().toISOString()
    }));
  }

  app.status = 'PENDING_REVIEW';
  app.updatedAt = new Date().toISOString();

  if (member) {
    dispatchLoanSmsAndNotif(db, member, 'Loan Resubmitted', `Your updated loan application for ${app.loanTypeName} of ₱${app.amount.toLocaleString()} has been resubmitted for review.`);

    // Notify Admins and Staff
    db.users.forEach(u => {
      if (u.role === 'ADMIN' || u.role === 'STAFF') {
        db.notifications.unshift({
          id: 'notif_' + Math.random().toString(36).substring(2, 11),
          userId: u.id,
          title: 'Loan Application Resubmitted',
          message: `${member.fullName} resubmitted their loan application for ${app.loanTypeName} (₱${app.amount.toLocaleString()}).`,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, 'MEMBER', 'LOAN_APPLICATION_RESUBMITTED', `Resubmitted loan application ${id} with updated documents.`);

  res.json({ message: 'Loan application resubmitted successfully!', application: app });
});

// Staff Document Review Action (Approve/Reject individual document)
apiRouter.post('/loans/document-review/:applicationId', requireRole(['STAFF', 'ADMIN']), requirePermission('loans_manage'), (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const { documentId, status, rejectionReason } = req.body; // status: APPROVED or REJECTED

  if (!documentId || !['APPROVED', 'REJECTED'].includes(status)) {
    res.status(400).json({ error: 'Document ID and status (APPROVED or REJECTED) are required.' });
    return;
  }

  const db = CooperativeDB.load();
  const app = db.loanApplications.find(a => a.id === applicationId);

  if (!app) {
    res.status(404).json({ error: 'Loan application not found.' });
    return;
  }

  if (!app.documents) app.documents = [];
  const doc = app.documents.find(d => d.id === documentId);

  if (!doc) {
    res.status(404).json({ error: 'Document record not found in application.' });
    return;
  }

  doc.status = status as any;
  if (status === 'REJECTED') {
    doc.rejectionReason = rejectionReason || 'Document does not meet verification requirements.';
  } else {
    doc.rejectionReason = undefined;
  }

  CooperativeDB.save(db);
  res.json({ message: `Document marked as ${status}`, document: doc, app });
});

// Staff Detailed Loan Action (Review, Recommend, Request Revisions, Reject)
apiRouter.post('/loans/review/:id', requireRole(['STAFF', 'ADMIN']), requirePermission('loans_manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, remarks, staffNotes, requestedAdditionalDocuments } = req.body; // status: UNDER_REVIEW, REVISION_REQUESTED, REJECTED
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!id || !['UNDER_REVIEW', 'APPROVED', 'WAITING_FOR_RELEASE', 'REVISION_REQUESTED', 'REJECTED'].includes(status)) {
    res.status(400).json({ error: 'Invalid review status. Must be UNDER_REVIEW, APPROVED, WAITING_FOR_RELEASE, REVISION_REQUESTED, or REJECTED.' });
    return;
  }

  const db = CooperativeDB.load();
  const app = db.loanApplications.find(a => a.id === id);

  if (!app) {
    res.status(404).json({ error: 'Loan application not found' });
    return;
  }

  app.status = status as any;
  app.remarks = remarks || app.remarks || '';
  if (staffNotes !== undefined) app.staffNotes = staffNotes;
  if (Array.isArray(requestedAdditionalDocuments)) {
    app.requestedAdditionalDocuments = requestedAdditionalDocuments;
  } else if (typeof requestedAdditionalDocuments === 'string' && requestedAdditionalDocuments.trim()) {
    app.requestedAdditionalDocuments = requestedAdditionalDocuments.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  app.reviewedBy = tokenUser.id;
  app.updatedAt = new Date().toISOString();

  const member = db.members.find(m => m.id === app.memberId);
  if (member) {
    let statusText = status.replace('_', ' ');
    if (status === 'REVISION_REQUESTED') statusText = 'Revision / Additional Documents Needed';
    let extraDetails = '';
    if (app.requestedAdditionalDocuments && app.requestedAdditionalDocuments.length > 0) {
      extraDetails = ` Required attachments: ${app.requestedAdditionalDocuments.join(', ')}.`;
    }
    dispatchLoanSmsAndNotif(
      db,
      member,
      `Loan Application Status: ${statusText}`,
      `Your application for ${app.loanTypeName} of ₱${app.amount.toLocaleString()} is now: ${statusText}.${extraDetails} ${remarks ? 'Remarks: ' + remarks : ''}`
    );
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'LOAN_APPLICATION_REVIEWED', `Reviewed application ${id}. Status updated to ${status}.`);

  res.json({ message: `Loan application status updated to ${status}`, app });
});

// Loan Approval / Rejection (Staff / Cashier)
apiRouter.post('/loans/approve/:id', requireRole(['STAFF', 'ADMIN']), requirePermission('loans_manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, remarks } = req.body; // action: APPROVE, REJECT
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!id || !['APPROVE', 'REJECT'].includes(action)) {
    res.status(400).json({ error: 'Invalid approval action. Must be APPROVE or REJECT' });
    return;
  }

  const db = CooperativeDB.load();
  const app = db.loanApplications.find(a => a.id === id);

  if (!app) {
    res.status(404).json({ error: 'Loan application not found' });
    return;
  }

  if (action === 'APPROVE') {
    app.status = 'WAITING_FOR_RELEASE';
  } else {
    app.status = 'REJECTED';
  }

  app.remarks = remarks || app.remarks || '';
  app.approvedBy = tokenUser.id;
  app.updatedAt = new Date().toISOString();

  const member = db.members.find(m => m.id === app.memberId);
  if (member) {
    dispatchLoanSmsAndNotif(
      db,
      member,
      `Loan Application ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`,
      `Your loan application for ${app.loanTypeName} of ₱${app.amount.toLocaleString()} has been ${action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}. Remarks: ${remarks || 'None'}`
    );
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, `LOAN_APPLICATION_${action}`, `Finalized application ${id} as ${app.status}.`);

  res.json({ message: `Loan application successfully ${app.status.toLowerCase()}`, app });
});

// Loan Disbursement / Release (Staff / Cashier)
apiRouter.post('/loans/disburse/:id', requireRole(['STAFF', 'ADMIN']), requirePermission('loans_manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { paymentMethod, releaseMethod, externalReference, transactionRef, transactionReferenceNumber, releaseAmount, releaseDate, remarks } = req.body || {};
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const app = db.loanApplications.find(a => a.id === id);

  if (!app) {
    res.status(404).json({ error: 'Loan application not found' });
    return;
  }

  if (app.status === 'DISBURSED' || app.status === 'RELEASED') {
    res.status(400).json({ error: 'Loan application has already been disbursed. Duplicate disbursement is prohibited.', status: 'ALREADY_PROCESSED' });
    return;
  }

  if (app.status !== 'APPROVED' && app.status !== 'WAITING_FOR_RELEASE') {
    res.status(400).json({ error: 'Only approved loan applications can be disbursed/released' });
    return;
  }

  // Enforce One-Active-Loan-Per-Member Policy at release time
  const existingActiveLoans = (db.loans || []).filter(l => l.memberId === app.memberId && (l.balance || 0) > 0);
  if (existingActiveLoans.length > 0) {
    const existingLoan = existingActiveLoans[0];
    const formattedBalance = Number(existingLoan.balance).toLocaleString('en-US', {
      minimumFractionDigits: existingLoan.balance % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    });
    res.status(400).json({ 
      error: `Cannot release loan: Member ${app.memberName} already has an active loan (${existingLoan.loanTypeName} #${existingLoan.id}) with an outstanding balance of ₱${formattedBalance}. Cooperative policy permits only one active released loan at a time. The existing loan must be fully settled first.`,
      activeLoan: existingLoan
    });
    return;
  }

  const loanType = db.loanTypes.find(t => t.id === app.loanTypeId);
  if (!loanType) {
    res.status(404).json({ error: 'Loan type not found' });
    return;
  }

  const methodVal = (releaseMethod || paymentMethod || 'CASH').toUpperCase();
  const method: 'CASH' | 'GCASH' | 'BANK_TRANSFER' = methodVal === 'GCASH' ? 'GCASH' : methodVal === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH';
  const cleanRef = String(transactionReferenceNumber || transactionRef || externalReference || '').trim();

  if ((method === 'GCASH' || method === 'BANK_TRANSFER') && !cleanRef) {
    res.status(400).json({ error: `Transaction Reference Number is required when disbursing via ${method === 'GCASH' ? 'GCash' : 'Bank Transfer'}.` });
    return;
  }

  // Calculate detailed pricing with policy configuration
  const principalAmount = Number(releaseAmount) > 0 ? Number(releaseAmount) : app.amount;
  const interestRate = loanType.interestRate;
  const durationMonths = app.durationMonths;
  const interestAmount = principalAmount * interestRate * (durationMonths / 12);
  const totalRepayable = principalAmount + interestAmount;

  const cbuPercent = (loanType as any).cbuPercent ?? (db.systemSettings as any)?.cbuPercent ?? 2; // Cooperative policy configuration
  const processingFeePercent = loanType.processingFeePercent || 0;
  const cbuAmount = Math.round((principalAmount * (cbuPercent / 100)) * 100) / 100;
  const processingFeeAmount = Math.round((principalAmount * (processingFeePercent / 100)) * 100) / 100;
  const netProceeds = principalAmount - cbuAmount - processingFeeAmount;

  // Release Date & First Due Date calculation
  const releaseDateObj = releaseDate ? new Date(releaseDate) : new Date();
  const releaseDateStr = isNaN(releaseDateObj.getTime()) ? new Date().toISOString().split('T')[0] : releaseDateObj.toISOString().split('T')[0];

  // Generate Amortization Schedule
  const monthlyPrincipal = principalAmount / durationMonths;
  const monthlyInterest = interestAmount / durationMonths;
  const monthlyTotal = monthlyPrincipal + monthlyInterest;

  const amortizationSchedule: AmortizationItem[] = [];
  let remainingBalance = totalRepayable;

  for (let i = 1; i <= durationMonths; i++) {
    const installmentDueDate = new Date(releaseDateObj);
    installmentDueDate.setMonth(installmentDueDate.getMonth() + i);
    remainingBalance -= monthlyTotal;

    amortizationSchedule.push({
      installmentNo: i,
      dueDate: installmentDueDate.toISOString().split('T')[0],
      principalAmount: Math.round(monthlyPrincipal * 100) / 100,
      interestAmount: Math.round(monthlyInterest * 100) / 100,
      
      remainingBalance: Math.max(0, Math.round(remainingBalance * 100) / 100),
      scheduledAmount: Math.round(monthlyTotal * 100) / 100,
      penaltyAmount: 0,
      amountPaid: 0,
      status: 'UPCOMING'
    });
  }

  // Authoritative first payment due date directly from installment #1 of amortization schedule
  const firstDueDateStr = amortizationSchedule.length > 0 
    ? amortizationSchedule[0].dueDate 
    : (() => {
        const d = new Date(releaseDateObj);
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().split('T')[0];
      })();

  const staffObj = db.staff.find(s => s.id === tokenUser.id);
  const releasedByName = staffObj ? staffObj.fullName : (tokenUser.role === 'ADMIN' ? 'Administrator' : tokenUser.email);

  const postingKeys = [`LOAN_DISBURSE:${app.id}`];

  let generatedLoan: Loan | null = null;

  const postResult = CooperativeDB.postFinancialTransaction({
    postingKeys,
    paymentSource: 'LOAN_DISBURSEMENT',
    memberId: app.memberId,
    memberName: app.memberName,
    amount: principalAmount,
    postingType: 'LOAN_RELEASE',
    postedBy: tokenUser.email,
    executePosting: (currentDb) => {
      const targetApp = currentDb.loanApplications.find(a => a.id === app.id)!;
      const newLoan: Loan = {
        id: 'ln_' + Math.random().toString(36).substring(2, 11),
        applicationId: targetApp.id,
        memberId: targetApp.memberId,
        memberName: targetApp.memberName,
        loanTypeName: targetApp.loanTypeName,
        principalAmount,
        interestAmount,
        totalRepayable,
        balance: totalRepayable,
        monthlyAmortization: Math.round(monthlyTotal * 100) / 100,
        durationMonths,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        disbursedAt: releaseDateStr,
        dueDate: firstDueDateStr,
        nextDueDate: firstDueDateStr,
        amortizationSchedule,
        releaseMethod: method,
        releasedBy: releasedByName,
        transactionReferenceNumber: cleanRef,
        releaseRemarks: remarks || ''
      };

      generatedLoan = newLoan;
      targetApp.status = 'RELEASED';
      currentDb.loans.push(newLoan);

      const targetMember = currentDb.members.find(m => m.id === targetApp.memberId);

      const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
      const txDesc = method === 'GCASH'
        ? `Disbursed principal of ${targetApp.loanTypeName} via GCash (Ref: ${cleanRef}) to Member (${targetMember?.gcashAccountName || targetApp.memberName}, ${targetMember?.gcashNumber || 'No GCash No.'})`
        : method === 'BANK_TRANSFER'
        ? `Disbursed principal of ${targetApp.loanTypeName} via Bank Transfer (Ref: ${cleanRef}) to Member (${targetApp.memberName})`
        : `Disbursed principal of ${targetApp.loanTypeName} to Regular Savings / Cash`;

      const mainTx: Transaction = {
        id: txId,
        memberId: targetApp.memberId,
        memberName: targetApp.memberName,
        type: 'LOAN_RELEASE',
        amount: principalAmount,
        referenceId: newLoan.id,
        description: txDesc,
        processedBy: tokenUser.role,
        createdAt: new Date().toISOString()
      };
      currentDb.transactions.unshift(mainTx);

      if (cbuAmount > 0) {
        const cbuTxId = 'tx_cbu_' + Math.random().toString(36).substring(2, 11);
        currentDb.transactions.unshift({
          id: cbuTxId,
          memberId: targetApp.memberId,
          memberName: targetApp.memberName,
          type: 'SHARE_CAPITAL',
          amount: cbuAmount,
          referenceId: newLoan.id,
          description: 'Loan Disbursement CBU Retention (Share Capital)',
          processedBy: tokenUser.role,
          createdAt: new Date().toISOString()
        });
        if (targetMember) {
          targetMember.shareCapital = Number(((targetMember.shareCapital || 0) + cbuAmount).toFixed(2));
          targetMember.initialShareCapitalPaid = true;
        }

        // Formally record financial posting for CBU share capital retention
        currentDb.financialPostings = currentDb.financialPostings || [];
        currentDb.financialPostings.push({
          id: 'post_cbu_' + Math.random().toString(36).substring(2, 11),
          postingKey: `loan_cbu:${newLoan.id}:${targetApp.memberId}`.toLowerCase(),
          paymentSource: 'LOAN_DISBURSEMENT',
          memberId: targetApp.memberId,
          memberName: targetApp.memberName,
          amount: cbuAmount,
          postingType: 'SHARE_CAPITAL',
          ledgerTransactionId: cbuTxId,
          postedBy: tokenUser.email,
          postedAt: new Date().toISOString(),
          status: 'POSTED'
        });
      }

      if (processingFeeAmount > 0) {
        currentDb.transactions.unshift({
          id: 'tx_fee_' + Math.random().toString(36).substring(2, 11),
          memberId: targetApp.memberId,
          memberName: targetApp.memberName,
          type: 'LOAN_PAYMENT',
          amount: processingFeeAmount,
          referenceId: newLoan.id,
          description: `Processing Fee deduction from ${targetApp.loanTypeName}`,
          processedBy: tokenUser.role,
          createdAt: new Date().toISOString()
        });
      }

      const operatorName = tokenUser.role === 'ADMIN' ? 'Admin' : (staffObj?.fullName || 'Cashier / Staff');
      const paymentRefNo = cleanRef ? `RELEASE-${method}-${cleanRef}` : `RELEASE-LN-${newLoan.id.substring(0, 8).toUpperCase()}`;

      const receipt = createOfficialReceipt(currentDb, {
        memberId: targetApp.memberId,
        memberName: targetApp.memberName,
        memberNumber: targetMember?.memberNumber || targetApp.memberId.substring(0, 8),
        paymentType: 'LOAN_RELEASE',
        paymentMethod: method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : method === 'GCASH' ? 'GCASH' : 'CASH',
        amount: principalAmount,
        paymentDate: releaseDateStr,
        issuedBy: operatorName,
        issuedById: tokenUser.id,
        transactionId: txId,
        internalReference: paymentRefNo,
        applicationId: targetApp.id,
        loanId: newLoan.id,
        loanNumber: newLoan.id.substring(0, 8).toUpperCase(),
        loanTypeName: targetApp.loanTypeName,
        approvedAmount: targetApp.amount,
        releasedAmount: netProceeds,
        feeAmount: processingFeeAmount,
        releaseMethod: method,
        gcashDetails: method === 'GCASH' ? {
          refNumber: cleanRef,
          accountName: targetMember?.gcashAccountName || targetApp.memberName,
          mobileNumber: targetMember?.gcashNumber || (targetApp as any).mobileNumber || ''
        } : undefined,
        transactionReferenceNumber: cleanRef,
        releaseDate: releaseDateStr,
        authorizedStaff: operatorName,
        digitalApproval: `APPROVED & DISBURSED DIGITALLY BY ${operatorName.toUpperCase()} ON ${new Date().toISOString()}`,
        qrVerification: `VERIFY-RECEIPT:APP:${targetApp.id}|LN:${newLoan.id}|MEM:${targetApp.memberId}|AMT:${principalAmount}`,
        principalAmount,
        interestAmount,
        remarks: remarks || `LOAN RELEASE VOUCHER: Released ${targetApp.loanTypeName}. Principal: ₱${principalAmount.toLocaleString()}. Net Proceeds: ₱${netProceeds.toLocaleString()} via ${method}${cleanRef ? ' (Ref: ' + cleanRef + ')' : ''}. First Due Date: ${firstDueDateStr}`
      });

      targetApp.status = 'DISBURSED';
      (targetApp as any).disbursementReceiptId = receipt.id;
      (targetApp as any).receiptNumber = receipt.receiptNumber;
      (newLoan as any).disbursementReceiptId = receipt.id;
      (newLoan as any).receiptNumber = receipt.receiptNumber;

      if (targetMember) {
        const notifMsg = `Your loan of ₱${principalAmount.toLocaleString()} (${targetApp.loanTypeName}) has been released. Net proceeds of ₱${netProceeds.toLocaleString()} sent via ${method}! ${cleanRef ? 'Ref: ' + cleanRef + '. ' : ''}First Due Date: ${firstDueDateStr}.`;

        dispatchLoanSmsAndNotif(
          currentDb,
          targetMember,
          'Loan Disbursed & Released',
          notifMsg
        );
      }

      return {
        ledgerTransaction: mainTx,
        officialReceipt: receipt
      };
    }
  });

  if (!postResult.success) {
    if (postResult.isAlreadyProcessed) {
      res.status(400).json({
        error: 'Loan application has already been disbursed. Duplicate disbursement is prohibited.',
        status: 'ALREADY_PROCESSED',
        officialReceiptNo: postResult.existingPosting?.officialReceiptNo
      });
      return;
    }
    res.status(400).json({ error: postResult.message || 'Failed to disburse loan.' });
    return;
  }

  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'LOAN_DISBURSEMENT', `Disbursed and released loan to ${app.memberName} via ${method}${cleanRef ? ' (Ref: ' + cleanRef + ')' : ''}. Amount: ₱${principalAmount.toLocaleString()}. First Due Date: ${firstDueDateStr}. Voucher OR: ${postResult.officialReceipt?.receiptNumber}`);

  res.json({ message: `Loan released successfully via ${method}! First due date: ${firstDueDateStr}. Official Receipt / Voucher ${postResult.officialReceipt?.receiptNumber} issued.`, loan: generatedLoan, receipt: postResult.officialReceipt });
});

// Member Active Loans & History
apiRouter.get('/loans/active', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  if (tokenUser.role === 'MEMBER') {
    const targetMemberId = tokenUser.memberId || tokenUser.id;
    const list = db.loans.filter(l => l.memberId === targetMemberId || l.memberId === tokenUser.id);
    res.json(list);
  } else {
    // Admin & Staff see all active
    res.json(db.loans);
  }
});

// Pay Loan (Over-the-Counter Cashier / Staff / Admin Execution Only - Direct Member Posting Forbidden)
apiRouter.post('/loans/pay', requireRole(['STAFF', 'ADMIN']), requirePermission('loans_manage'), (req: Request, res: Response) => {
  const { loanId, amount } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!loanId || !amount || amount <= 0) {
    res.status(400).json({ error: 'Please specify loan and a valid payment amount' });
    return;
  }

  const db = CooperativeDB.load();
  const loan = db.loans.find(l => l.id === loanId);

  if (!loan || loan.status !== 'ACTIVE') {
    res.status(404).json({ error: 'Active loan record not found' });
    return;
  }

  // If Member is paying, validate they have enough in regular savings, or cashiers can process cash directly
  const payAmt = Number(amount);
  const operatorName = tokenUser.role === 'ADMIN' ? 'Admin' : (tokenUser.role === 'STAFF' ? (db.staff.find(s => s.id === tokenUser.id)?.fullName || 'Staff') : 'Self-Service');

  if (tokenUser.role === 'MEMBER') {
    if (loan.memberId !== tokenUser.id) {
      res.status(403).json({ error: 'You do not have permission to pay other members loans' });
      return;
    }

    const member = db.members.find(m => m.id === tokenUser.id);
    if (!member) {
      res.status(404).json({ error: 'Member profile not found' });
      return;
    }

    if (member.regularSavings < payAmt) {
      res.status(400).json({ error: `Insufficient Regular Savings balance to make payment. Available: ₱${member.regularSavings.toLocaleString()}` });
      return;
    }
  }

  const clientTxKey = req.body.clientTxKey || req.body.transactionKey;
  const postingKeys = clientTxKey
    ? [`LOAN_PAY:${clientTxKey}`]
    : [`LOAN_PAY:${loan.id}_${payAmt}_${Date.now()}`];

  let updatedLoan: Loan | undefined;

  const postResult = CooperativeDB.postFinancialTransaction({
    postingKeys,
    paymentSource: 'OTC_LOAN_PAYMENT',
    memberId: loan.memberId,
    memberName: loan.memberName,
    amount: payAmt,
    postingType: 'LOAN_PAYMENT',
    postedBy: tokenUser.email,
    executePosting: (currentDb) => {
      const targetLoan = currentDb.loans.find(l => l.id === loan.id)!;
      const targetMember = currentDb.members.find(m => m.id === loan.memberId);

      if (tokenUser.role === 'MEMBER') {
        if (!targetMember || targetMember.regularSavings < payAmt) {
          throw new Error(`Insufficient Regular Savings balance to make payment. Available: ₱${targetMember?.regularSavings.toLocaleString() || 0}`);
        }
        targetMember.regularSavings -= payAmt;
      }

      targetLoan.balance = Number((targetLoan.balance - payAmt).toFixed(2));
      processAmortizationPayment(targetLoan, payAmt, new Date().toISOString().split('T')[0]);
      checkAndFinalizeLoanCompletion(currentDb, targetLoan, tokenUser);

      updatedLoan = targetLoan;

      const paymentId = 'pay_' + Math.random().toString(36).substring(2, 11);
      const payment: LoanPayment = {
        id: paymentId,
        loanId: targetLoan.id,
        memberId: targetLoan.memberId,
        amount: payAmt,
        paymentDate: new Date().toISOString(),
        processedBy: tokenUser.id
      };
      currentDb.loanPayments.push(payment);

      const mainTx: Transaction = {
        id: 'tx_' + Math.random().toString(36).substring(2, 11),
        memberId: targetLoan.memberId,
        memberName: targetLoan.memberName,
        type: 'LOAN_PAYMENT',
        amount: payAmt,
        referenceId: targetLoan.id,
        description: `Loan payment of ₱${payAmt.toLocaleString()} for ${targetLoan.loanTypeName} outstanding balance. Outstanding: ₱${targetLoan.balance.toLocaleString()}`,
        processedBy: operatorName,
        createdAt: new Date().toISOString()
      };
      currentDb.transactions.unshift(mainTx);

      const receipt = createOfficialReceipt(currentDb, {
        memberId: targetLoan.memberId,
        memberName: targetLoan.memberName,
        memberNumber: targetMember?.memberNumber || targetLoan.memberId.substring(0, 8),
        paymentType: 'LOAN_PAYMENT',
        paymentMethod: tokenUser.role === 'MEMBER' ? 'SAVINGS' : 'CASH',
        amount: payAmt,
        paymentDate: new Date().toISOString().split('T')[0],
        issuedBy: operatorName,
        issuedById: tokenUser.id,
        transactionId: paymentId,
        internalReference: `REF-LN-${targetLoan.id.substring(0, 8).toUpperCase()}`,
        loanId: targetLoan.id,
        loanNumber: targetLoan.id.substring(0, 8).toUpperCase(),
        principalAmount: payAmt,
        remarks: `Amortization payment for ${targetLoan.loanTypeName}. Outstanding Balance: ₱${targetLoan.balance.toLocaleString()}`
      });

      CooperativeDB.createNotification(
        targetLoan.memberId,
        'Loan Payment Processed & Official Receipt Issued',
        `Payment of ₱${payAmt.toLocaleString()} for your ${targetLoan.loanTypeName} has been received. Official Receipt: ${receipt.receiptNumber}. Outstanding Balance: ₱${targetLoan.balance.toLocaleString()}`
      );

      return {
        ledgerTransaction: mainTx,
        officialReceipt: receipt
      };
    }
  });

  if (!postResult.success) {
    if (postResult.isAlreadyProcessed) {
      res.status(400).json({
        error: 'This loan payment has already been processed.',
        status: 'ALREADY_PROCESSED',
        officialReceiptNo: postResult.existingPosting?.officialReceiptNo
      });
      return;
    }
    res.status(400).json({ error: postResult.message || 'Failed to process payment.' });
    return;
  }

  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'LOAN_PAYMENT', `Processed payment of ₱${payAmt} for Loan ${loan.id} of ${loan.memberName}. Issued Official Receipt ${postResult.officialReceipt?.receiptNumber}.`);

  res.json({ message: (updatedLoan?.status as string) === 'PAID' || updatedLoan?.balance === 0 ? 'Loan fully PAID off! Official Receipt issued!' : 'Payment processed successfully! Official Receipt issued.', loan: updatedLoan, receipt: postResult.officialReceipt });
});

// Submit GCash / Bank Transfer Loan Payment (Member - Status becomes Pending Verification)
apiRouter.post('/loans/submit-payment', requireRole(['MEMBER']), (req: Request, res: Response) => {
  const { loanId, amount, paymentMethod, referenceNumber, proofOfPaymentUrl, notes } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!loanId || !amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'Please select an active loan and enter a valid payment amount.' });
    return;
  }

  if (!referenceNumber && !proofOfPaymentUrl) {
    res.status(400).json({ error: 'GCash Reference Number or Payment Proof attachment is required.' });
    return;
  }

  const db = CooperativeDB.load();
  const loan = db.loans.find(l => l.id === loanId);

  if (!loan || loan.status !== 'ACTIVE') {
    res.status(404).json({ error: 'Active loan contract not found.' });
    return;
  }

  if (loan.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'You do not have permission to pay for this loan contract.' });
    return;
  }

  const payAmt = Number(amount);
  const paymentId = 'pay_' + Math.random().toString(36).substring(2, 11);

  const payment: LoanPayment = {
    id: paymentId,
    loanId: loan.id,
    memberId: loan.memberId,
    memberName: loan.memberName,
    amount: payAmt,
    paymentDate: new Date().toISOString(),
    processedBy: 'MEMBER_SUBMISSION',
    notes: notes || 'Member GCash payment submission for verification',
    status: 'PENDING_VERIFICATION',
    paymentMethod: paymentMethod || 'GCASH',
    referenceNumber: referenceNumber || '',
    proofOfPaymentUrl: proofOfPaymentUrl || '',
    createdAt: new Date().toISOString()
  };

  db.loanPayments.push(payment);

  const member = db.members.find(m => m.id === tokenUser.id);
  if (member) {
    dispatchLoanSmsAndNotif(
      db,
      member,
      'Loan Payment Submitted (Pending Verification)',
      `Your GCash payment submission of ₱${payAmt.toLocaleString()} (Ref: ${referenceNumber || 'Attachment Attached'}) for ${loan.loanTypeName} has been received. Status: PENDING VERIFICATION by Cashier.`
    );
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'LOAN_PAYMENT_SUBMITTED', `Submitted GCash payment proof of ₱${payAmt} for Loan ${loan.id}. Pending Cashier Verification.`);

  res.json({
    message: 'Payment proof submitted successfully! Status is now PENDING VERIFICATION by the Cashier/Staff.',
    payment
  });
});

// Staff/Cashier Pending & Historic Loan Payment Verification Submissions
apiRouter.get('/loans/payments', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  if (tokenUser.role === 'MEMBER') {
    const memberPayments = db.loanPayments.filter(p => p.memberId === tokenUser.id);
    res.json(memberPayments);
  } else {
    // Admin & Staff see all payment submissions
    res.json(db.loanPayments);
  }
});

// Get Comprehensive Loan Payment History & Amortization Ledger by Loan or Application ID
apiRouter.get('/loans/:id/ledger', (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  // Find loan application or active loan
  const app = (db.loanApplications || []).find(a => 
    a.id === id || 
    a.id.substring(0, 8).toUpperCase() === id.toUpperCase() ||
    (a as any).disbursementReceiptId === id
  );

  const loan = (db.loans || []).find(l => 
    l.id === id || 
    l.applicationId === id || 
    (app && l.applicationId === app.id) ||
    l.id.substring(0, 8).toUpperCase() === id.toUpperCase()
  );

  if (!app && !loan) {
    res.status(404).json({ error: 'Loan application or contract record not found.' });
    return;
  }

  const memberId = loan?.memberId || app?.memberId || '';
  if (tokenUser.role === 'MEMBER' && memberId !== tokenUser.id) {
    res.status(403).json({ error: 'Access denied. Members can only view their own loan ledgers.' });
    return;
  }

  const member = db.members.find(m => m.id === memberId);

  // Filter payments
  const loanIdSet = new Set<string>();
  if (id) loanIdSet.add(id);
  if (app?.id) loanIdSet.add(app.id);
  if (loan?.id) loanIdSet.add(loan.id);
  if (loan?.applicationId) loanIdSet.add(loan.applicationId);

  const payments = (db.loanPayments || []).filter(p => 
    loanIdSet.has(p.loanId) || 
    (p.memberId === memberId && (p.notes?.includes(id) || (app && p.notes?.includes(app.id))))
  );

  // Filter receipts
  const receipts = (db.officialReceipts || []).filter(r => 
    (r.loanId && loanIdSet.has(r.loanId)) ||
    (r.applicationId && loanIdSet.has(r.applicationId)) ||
    (r.remarks && (r.remarks.includes(id) || (app && r.remarks.includes(app.id)))) ||
    (r.memberId === memberId && (r.paymentType === 'LOAN_PAYMENT' || r.paymentType === 'LOAN_RELEASE'))
  );

  const principalAmount = loan?.principalAmount || app?.amount || 0;
  const interestAmount = loan?.interestAmount || 0;
  const totalRepayable = loan?.totalRepayable || (principalAmount + interestAmount);
  
  // Calculate verified total paid
  const verifiedPayments = payments.filter(p => p.status === 'APPROVED');
  const totalPaid = verifiedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const outstandingBalance = loan ? loan.balance : Math.max(0, totalRepayable - totalPaid);
  const progressPercentage = totalRepayable > 0 ? Math.min(100, Math.round((totalPaid / totalRepayable) * 100)) : 0;

  if (loan) {
    ensureLoanAmortizationSchedule(loan);
  }

  const pendingPaymentRequests = (db.paymentRequests || []).filter(pr => 
    pr.paymentType === 'LOAN_PAYMENT' && 
    (pr.targetReferenceId === loan?.id || pr.loanId === loan?.id) &&
    (pr.status === 'PENDING_RECONCILIATION' || pr.status === 'UNPAID')
  );

  res.json({
    application: app || null,
    loan: loan || null,
    pendingPaymentRequests,
    member: member ? {
      id: member.id,
      fullName: member.fullName,
      memberNumber: member.memberNumber,
      mobileNumber: (member as any)?.mobileNumber,
      email: member.email,
      department: (member as any)?.department,
      status: member.status
    } : null,
    summary: {
      principalAmount,
      interestAmount,
      totalRepayable,
      totalPaid,
      outstandingBalance,
      progressPercentage,
      status: loan?.status || app?.status || 'UNKNOWN',
      monthlyAmortization: loan?.monthlyAmortization || app?.monthlyAmortization || 0,
      durationMonths: loan?.durationMonths || app?.durationMonths || 0,
      paymentFrequency: loan?.paymentFrequency || 'MONTHLY',
      disbursedAt: loan?.disbursedAt || app?.updatedAt || null,
      dueDate: loan?.dueDate || null,
      nextDueDate: loan?.nextDueDate || loan?.dueDate || null
    },
    payments,
    receipts,
    schedule: (loan?.amortizationSchedule || []).map((item: any, idx: number) => {
      const scheduled = item.scheduledAmount || Number(((item.principalAmount || 0) + (item.interestAmount || 0) + (item.penaltyAmount || 0)).toFixed(2));
      const paid = item.amountPaid || 0;
      const rem = item.remainingAmount !== undefined ? item.remainingAmount : Math.max(0, Number((scheduled - paid).toFixed(2)));

      if (item.status === 'PAID') {
        const matchingPayment = verifiedPayments[idx] || verifiedPayments.find(p => p.amount >= item.totalAmortization) || verifiedPayments[0];
        const matchingReceipt = receipts.find(r => 
          (matchingPayment && r.transactionId === matchingPayment.id) || 
          (matchingPayment && matchingPayment.notes && r.receiptNumber && matchingPayment.notes.includes(r.receiptNumber)) ||
          r.loanId === loan?.id
        );
        const gcashRefMatch = matchingPayment?.notes?.match(/GCash Ref\s*([\w-]+)/i)?.[1] || 
                             (matchingPayment?.paymentMethod === 'GCASH' ? (matchingPayment?.referenceNumber || matchingPayment?.id) : undefined);
        return {
          ...item,
          scheduledAmount: scheduled,
          remainingAmount: 0,
          paymentDate: item.paymentDate || matchingPayment?.paymentDate || matchingReceipt?.paymentDate || matchingReceipt?.issuedAt?.split('T')[0] || undefined,
          officialReceiptNumber: item.officialReceiptNumber || matchingReceipt?.receiptNumber || matchingPayment?.notes?.match(/OR:\s*([\w-]+)/i)?.[1] || undefined,
          gcashRefNumber: item.externalReference || item.gcashRefNumber || gcashRefMatch || undefined
        };
      }
      return {
        ...item,
        scheduledAmount: scheduled,
        remainingAmount: rem
      };
    })
  });
});

// Staff/Cashier Verify Payment (Approve or Reject)
apiRouter.post('/loans/verify-payment/:id', requireRole(['STAFF', 'ADMIN']), requirePermission('loans_manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, rejectionReason, remarks } = req.body; // action: 'APPROVE' | 'REJECT'
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!id || !['APPROVE', 'REJECT'].includes(action)) {
    res.status(400).json({ error: 'Invalid action. Must be APPROVE or REJECT.' });
    return;
  }

  const db = CooperativeDB.load();
  const payment = db.loanPayments.find(p => p.id === id);

  if (!payment) {
    res.status(404).json({ error: 'Loan payment record not found.' });
    return;
  }

  if (payment.status !== 'PENDING_VERIFICATION') {
    res.status(400).json({ error: `Payment record has already been ${payment.status?.toLowerCase() || 'processed'}.` });
    return;
  }

  const loan = db.loans.find(l => l.id === payment.loanId);
  if (!loan) {
    res.status(404).json({ error: 'Associated active loan contract not found.' });
    return;
  }

  const member = db.members.find(m => m.id === payment.memberId);
  const operatorName = tokenUser.role === 'ADMIN' ? 'Admin' : (db.staff.find(s => s.id === tokenUser.id)?.fullName || 'Cashier/Staff');

  if (action === 'APPROVE') {
    const postingKeys = [`LOAN_PAYMENT_VERIFY:${payment.id}`];
    if (payment.referenceNumber) {
      postingKeys.push(`GCASH_REF:${payment.referenceNumber}`);
    }

    const payAmt = payment.amount;

    const postResult = CooperativeDB.postFinancialTransaction({
      postingKeys,
      paymentSource: 'LOAN_PAYMENT_VERIFICATION',
      memberId: loan.memberId,
      memberName: loan.memberName,
      amount: payAmt,
      postingType: 'LOAN_PAYMENT',
      postedBy: tokenUser.email,
      gcashRefNumber: payment.referenceNumber || undefined,
      executePosting: (currentDb) => {
        const targetPayment = currentDb.loanPayments.find(p => p.id === payment.id)!;
        const targetLoan = currentDb.loans.find(l => l.id === loan.id)!;
        const targetMember = currentDb.members.find(m => m.id === loan.memberId);

        targetPayment.status = 'APPROVED';
        targetPayment.processedBy = tokenUser.id;
        targetPayment.notes = remarks || targetPayment.notes || 'Verified by Cashier';

        targetLoan.balance = Math.max(0, Number((targetLoan.balance - payAmt).toFixed(2)));
        processAmortizationPayment(targetLoan, payAmt, targetPayment.paymentDate || new Date().toISOString().split('T')[0], targetPayment.referenceNumber);
        checkAndFinalizeLoanCompletion(currentDb, targetLoan, tokenUser);

        const mainTx: Transaction = {
          id: 'tx_' + Math.random().toString(36).substring(2, 11),
          memberId: targetLoan.memberId,
          memberName: targetLoan.memberName,
          type: 'LOAN_PAYMENT',
          amount: payAmt,
          referenceId: targetLoan.id,
          description: `Verified GCash Loan payment of ₱${payAmt.toLocaleString()} (Ref: ${targetPayment.referenceNumber || 'N/A'}) for ${targetLoan.loanTypeName}. Remaining Balance: ₱${targetLoan.balance.toLocaleString()}`,
          processedBy: operatorName,
          createdAt: new Date().toISOString()
        };
        currentDb.transactions.unshift(mainTx);

        const receipt = createOfficialReceipt(currentDb, {
          memberId: targetLoan.memberId,
          memberName: targetLoan.memberName,
          memberNumber: targetMember?.memberNumber || targetLoan.memberId.substring(0, 8),
          paymentType: 'LOAN_PAYMENT',
          paymentMethod: targetPayment.paymentMethod || 'GCASH',
          amount: payAmt,
          paymentDate: new Date().toISOString().split('T')[0],
          issuedBy: operatorName,
          issuedById: tokenUser.id,
          transactionId: targetPayment.id,
          internalReference: targetPayment.referenceNumber ? `GCASH-${targetPayment.referenceNumber}` : `REF-LN-${targetLoan.id.substring(0, 8).toUpperCase()}`,
          loanId: targetLoan.id,
          loanNumber: targetLoan.id.substring(0, 8).toUpperCase(),
          principalAmount: payAmt,
          remarks: `Verified GCash Payment. Ref: ${targetPayment.referenceNumber || 'N/A'}. Outstanding Balance: ₱${targetLoan.balance.toLocaleString()}`
        });

        if (targetLoan.amortizationSchedule && receipt) {
          targetLoan.amortizationSchedule.forEach((item: any) => {
            if (item.status === 'PAID' && !item.officialReceiptNumber) {
              item.officialReceiptNumber = receipt.receiptNumber;
            }
          });
        }

        if (targetMember) {
          dispatchLoanSmsAndNotif(
            currentDb,
            targetMember,
            'Loan Payment Verified & Official Receipt Issued',
            `Your GCash loan payment of ₱${payAmt.toLocaleString()} (Ref: ${targetPayment.referenceNumber || 'Approved'}) has been VERIFIED & APPROVED! Official Receipt ${receipt.receiptNumber} issued. Remaining Balance: ₱${targetLoan.balance.toLocaleString()}.`
          );
        }

        return {
          ledgerTransaction: mainTx,
          officialReceipt: receipt
        };
      }
    });

    if (!postResult.success) {
      if (postResult.isAlreadyProcessed) {
        res.status(400).json({
          error: 'Payment record has already been processed.',
          status: 'ALREADY_PROCESSED',
          officialReceiptNo: postResult.existingPosting?.officialReceiptNo
        });
        return;
      }
      res.status(400).json({ error: postResult.message || 'Failed to verify payment.' });
      return;
    }

    CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'LOAN_PAYMENT_VERIFIED', `Approved payment ${payment.id} of ₱${payAmt} for Loan ${loan.id}. Issued Official Receipt ${postResult.officialReceipt?.receiptNumber}.`);

    res.json({
      message: `Payment of ₱${payAmt.toLocaleString()} successfully verified and approved! Official Receipt ${postResult.officialReceipt?.receiptNumber} issued.`,
      payment,
      receipt: postResult.officialReceipt,
      loan
    });
  } else {
    // REJECT
    payment.status = 'REJECTED';
    payment.rejectionReason = rejectionReason || 'Reference number or payment proof invalid.';
    payment.processedBy = tokenUser.id;

    if (member) {
      dispatchLoanSmsAndNotif(
        db,
        member,
        'Loan Payment Verification Declined',
        `Your payment submission of ₱${payment.amount.toLocaleString()} for ${loan.loanTypeName} was declined by Cashier. Reason: ${payment.rejectionReason}. Please re-check reference number and upload clear proof.`
      );
    }

    CooperativeDB.save(db);
    CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'LOAN_PAYMENT_REJECTED', `Declined payment submission ${payment.id} of ₱${payment.amount}. Reason: ${payment.rejectionReason}`);

    res.json({
      message: `Payment submission rejected. Member notified with reason.`,
      payment
    });
  }
});


// ============================================================================
// 4. DIVIDEND MANAGEMENT
// ============================================================================

// Get Dividend Periods
apiRouter.get('/dividends/periods', requireRole(['ADMIN', 'STAFF', 'MEMBER']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json(db.dividendPeriods);
});

// Get Member Dividend History
apiRouter.get('/dividends/member', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  if (tokenUser.role === 'MEMBER' && req.query.memberId && req.query.memberId !== tokenUser.id && req.query.memberId !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only view their own dividend history.' });
    return;
  }

  let targetId = tokenUser.id;
  if (tokenUser.role !== 'MEMBER' && req.query.memberId) {
    targetId = req.query.memberId as string;
  }

  const divs = db.memberDividends.filter(d => d.memberId === targetId);
  res.json(divs);
});

// Calculate member's verified Share Capital posted on or before Dec 31 of target fiscal year
export function getMemberYearEndShareCapital(db: DatabaseState, memberId: string, targetYear: number): number {
  const cutoff = new Date(`${targetYear}-12-31T23:59:59.999Z`).getTime();

  // Active financial postings on or before Dec 31 of targetYear
  const activePostings = (db.financialPostings || []).filter(p =>
    p.status === 'POSTED' &&
    p.memberId === memberId &&
    new Date(p.postedAt).getTime() <= cutoff
  );

  const seenPostingKeys = new Set<string>();
  const accountedTxIds = new Set<string>();
  let postingsTotal = 0;

  for (const p of activePostings) {
    const dedupeKey = p.ledgerTransactionId || p.id;
    if (!seenPostingKeys.has(dedupeKey)) {
      seenPostingKeys.add(dedupeKey);
      if (p.ledgerTransactionId) {
        accountedTxIds.add(p.ledgerTransactionId);
      }

      if (p.postingType === 'SHARE_CAPITAL') {
        postingsTotal += p.amount;
      } else if (p.postingType === 'DIVIDEND_CREDIT' && (p.postingKey.toLowerCase().includes('share') || (p as any).description?.toLowerCase().includes('share'))) {
        postingsTotal += p.amount;
      } else if (p.postingType === 'SHARE_CAPITAL_REFUND') {
        postingsTotal -= p.amount;
      } else if (p.postingType === 'WITHDRAWAL' && p.postingKey.toLowerCase().includes('share')) {
        postingsTotal -= p.amount;
      }
    }
  }

  // Unposted transactions on or before Dec 31 of targetYear
  const unpostedTxs = (db.transactions || []).filter(tx =>
    tx.memberId === memberId &&
    tx.status !== 'VOIDED' &&
    new Date(tx.createdAt).getTime() <= cutoff &&
    !accountedTxIds.has(tx.id)
  );

  let unpostedTotal = 0;
  for (const tx of unpostedTxs) {
    const desc = (tx.description || '').toLowerCase();
    const type = (tx.type || '').toUpperCase();

    const isShareCapitalDeposit = (
      (type === 'DEPOSIT' || type === 'SHARE_CAPITAL' || type === 'INITIAL_SHARE' || type === 'SHARE_CAPITAL_SUBSCRIPTION') &&
      (desc.includes('share capital') || desc.includes('initial share') || desc.includes('share subscription'))
    );

    const isLoanCbuRetention = (
      (type === 'DEPOSIT' || type === 'SHARE_CAPITAL') &&
      (desc.includes('cbu') || desc.includes('capital build-up') || desc.includes('capital buildup'))
    );

    const isDividendCreditToShare = (
      type === 'DIVIDEND_CREDIT' &&
      (desc.includes('share capital') || desc.includes('share equity'))
    );

    const isShareCapitalRefund = (
      (type === 'WITHDRAWAL' || type === 'REFUND') &&
      (desc.includes('share capital') || desc.includes('cbu') || desc.includes('capital build-up'))
    );

    if (isShareCapitalDeposit || isLoanCbuRetention || isDividendCreditToShare) {
      unpostedTotal += Math.abs(tx.amount);
    } else if (isShareCapitalRefund || (tx.amount < 0 && (desc.includes('share capital') || desc.includes('cbu')))) {
      unpostedTotal -= Math.abs(tx.amount);
    }
  }

  return Math.max(0, Number((postingsTotal + unpostedTotal).toFixed(2)));
}

// Calculate member's actual loan interest paid between Jan 1 and Dec 31 of target fiscal year
export function getMemberQualifyingLoanInterestPaid(db: DatabaseState, memberId: string, targetYear: number): number {
  const startOfYear = new Date(`${targetYear}-01-01T00:00:00.000Z`).getTime();
  const endOfYear = new Date(`${targetYear}-12-31T23:59:59.999Z`).getTime();

  const qualifyingPayments = (db.loanPayments || []).filter(lp => {
    if (lp.memberId !== memberId) return false;
    if (lp.status === 'REJECTED') return false;

    const pDate = new Date(lp.paymentDate || lp.createdAt || '').getTime();
    if (isNaN(pDate) || pDate < startOfYear || pDate > endOfYear) return false;

    if (lp.paymentRequestId) {
      const pr = (db.paymentRequests || []).find(r => r.id === lp.paymentRequestId);
      if (pr && (pr.status === 'REJECTED' || (pr as any).status === 'VOIDED')) return false;
    }

    return true;
  });

  let totalInterest = 0;

  for (const lp of qualifyingPayments) {
    if (lp.interestPaid !== undefined && lp.interestPaid !== null && lp.interestPaid > 0) {
      totalInterest += lp.interestPaid;
    } else if (lp.interestPaid === 0) {
      // explicitly 0 interest
    } else {
      // Legacy fallback
      const loan = (db.loans || []).find(l => l.id === lp.loanId);
      if (loan) {
        if (loan.interestAmount > 0 && loan.totalRepayable > 0) {
          totalInterest += lp.amount * (loan.interestAmount / loan.totalRepayable);
        } else if (loan.interestRate > 0) {
          totalInterest += lp.amount * (loan.interestRate / (1 + loan.interestRate));
        }
      }
    }
  }

  return Number(totalInterest.toFixed(2));
}

// Helper to compute both Dividend and Patronage Refund pools & allocations according to the 6 business rules
function computeFiscalPeriodDistribution(
  db: DatabaseState,
  year: number,
  totalNetSurplus: number,
  processedBy: string
) {
  const surplus = Number(totalNetSurplus);

  // 1. Statutory Reserves: 30% default (Reserve Fund: 10%, CETF: 10%, CDF: 3%, Optional Fund: 7%)
  const reserveFundRate = db.systemSettings.statutoryReserveFundRate ?? (db.systemSettings as any).reserveFundRate ?? 10;
  const cetfRate = db.systemSettings.statutoryCetfRate ?? (db.systemSettings as any).cetfRate ?? 10;
  const cdfRate = db.systemSettings.statutoryCdfRate ?? (db.systemSettings as any).cdfRate ?? 3;
  const optionalFundRate = db.systemSettings.statutoryOptionalFundRate ?? (db.systemSettings as any).optionalFundRate ?? 7;

  const reserveFundAmount = Number((surplus * (reserveFundRate / 100)).toFixed(2));
  const cetfAmount = Number((surplus * (cetfRate / 100)).toFixed(2));
  const cdfAmount = Number((surplus * (cdfRate / 100)).toFixed(2));
  const optionalFundAmount = Number((surplus * (optionalFundRate / 100)).toFixed(2));
  const totalStatutoryReserves = Number((reserveFundAmount + cetfAmount + cdfAmount + optionalFundAmount).toFixed(2));

  // 2. Distributable Surplus: 70% of Total Net Surplus
  const distributableSurplus = Number((surplus - totalStatutoryReserves).toFixed(2));

  // 3. Pool Splits: 70% Dividend Pool, 30% Patronage Refund Pool
  const dividendPoolShareRate = db.systemSettings.dividendPoolShareRate ?? 70;
  const patronagePoolShareRate = db.systemSettings.patronagePoolShareRate ?? 30;

  const dividendPoolCap = Number((distributableSurplus * (dividendPoolShareRate / 100)).toFixed(2));
  const patronagePoolCap = Number((distributableSurplus - dividendPoolCap).toFixed(2));

  const activeMembers = (db.members || []).filter(m => m.status === 'ACTIVE');
  const periodId = 'dp_' + Math.random().toString(36).substring(2, 11);

  // 4. Dividend Share-Capital Allocations: Fiscal-Year Ending Balance (posted on or before Dec 31 of targetYear)
  const memberShares = activeMembers.map(m => ({
    member: m,
    yearEndShare: getMemberYearEndShareCapital(db, m.id, year)
  }));

  const qualifyingMembersForDiv = memberShares.filter(m => m.yearEndShare > 0);
  const totalYearEndShareCapital = qualifyingMembersForDiv.reduce((sum, m) => sum + m.yearEndShare, 0);

  const dividendAllocations: MemberDividend[] = [];
  let totalDividendAllocated = 0;

  if (totalYearEndShareCapital > 0 && dividendPoolCap > 0) {
    // Initial floor allocations to 2 decimal places
    const tempDivs = qualifyingMembersForDiv.map(item => {
      const proportion = item.yearEndShare / totalYearEndShareCapital;
      const rawAmt = Math.floor(dividendPoolCap * proportion * 100) / 100;
      return {
        item,
        amount: rawAmt
      };
    });

    let currentSum = tempDivs.reduce((sum, d) => sum + d.amount, 0);
    let remainderCents = Math.round((dividendPoolCap - currentSum) * 100);

    // Distribute remainder cents to highest share capital holders
    tempDivs.sort((a, b) => b.item.yearEndShare - a.item.yearEndShare);
    for (let i = 0; i < remainderCents; i++) {
      tempDivs[i % tempDivs.length].amount = Number((tempDivs[i % tempDivs.length].amount + 0.01).toFixed(2));
    }

    for (const d of tempDivs) {
      if (d.amount > 0) {
        dividendAllocations.push({
          id: 'md_' + Math.random().toString(36).substring(2, 11),
          periodId,
          dividendPeriodId: periodId,
          year,
          memberId: d.item.member.id,
          memberName: d.item.member.fullName,
          shareCapitalSnapshot: d.item.yearEndShare,
          shareCapitalAmount: d.item.yearEndShare,
          shareCapitalWeight: 1,
          dividendAmount: d.amount,
          status: 'PENDING'
        });
        totalDividendAllocated = Number((totalDividendAllocated + d.amount).toFixed(2));
      }
    }
  }

  // 5. Patronage Refund Allocations: Actual loan interest paid during target fiscal year
  const memberInterests = activeMembers.map(m => ({
    member: m,
    interestPaid: getMemberQualifyingLoanInterestPaid(db, m.id, year)
  }));

  const qualifyingMembersForPat = memberInterests.filter(m => m.interestPaid > 0);
  const totalQualifyingInterest = qualifyingMembersForPat.reduce((sum, m) => sum + m.interestPaid, 0);

  const patronageAllocations: MemberPatronageRefund[] = [];
  let totalPatronageAllocated = 0;

  if (totalQualifyingInterest > 0 && patronagePoolCap > 0) {
    const tempPats = qualifyingMembersForPat.map(item => {
      const proportion = item.interestPaid / totalQualifyingInterest;
      const rawAmt = Math.floor(patronagePoolCap * proportion * 100) / 100;
      return {
        item,
        amount: rawAmt
      };
    });

    let currentSum = tempPats.reduce((sum, p) => sum + p.amount, 0);
    let remainderCents = Math.round((patronagePoolCap - currentSum) * 100);

    // Distribute remainder cents to highest interest payers
    tempPats.sort((a, b) => b.item.interestPaid - a.item.interestPaid);
    for (let i = 0; i < remainderCents; i++) {
      tempPats[i % tempPats.length].amount = Number((tempPats[i % tempPats.length].amount + 0.01).toFixed(2));
    }

    for (const p of tempPats) {
      if (p.amount > 0) {
        patronageAllocations.push({
          id: 'mp_' + Math.random().toString(36).substring(2, 11),
          dividendPeriodId: periodId,
          year,
          memberId: p.item.member.id,
          memberName: p.item.member.fullName,
          totalInterestPaid: p.item.interestPaid,
          patronageRefundAmount: p.amount,
          status: 'PENDING',
          createdAt: new Date().toISOString()
        });
        totalPatronageAllocated = Number((totalPatronageAllocated + p.amount).toFixed(2));
      }
    }
  }

  const period: DividendPeriod = {
    id: periodId,
    year,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    totalDividendAmount: totalDividendAllocated,
    totalNetSurplus: surplus,
    dividendRate: totalYearEndShareCapital > 0 ? Number((totalDividendAllocated / totalYearEndShareCapital).toFixed(6)) : 0,
    status: 'COMPUTED',
    processedBy,
    createdAt: new Date().toISOString(),
    // Statutory reserves snapshots
    reserveFundRate,
    reserveFundAmount,
    cetfRate,
    cetfAmount,
    cdfRate,
    cdfAmount,
    optionalFundRate,
    optionalFundAmount,
    totalStatutoryReserves,
    distributableSurplus,
    // Pool splits snapshots
    dividendPoolShareRate,
    dividendPoolCap,
    patronagePoolShareRate,
    patronagePoolCap,
    patronageRate: totalQualifyingInterest > 0 ? Number((totalPatronageAllocated / totalQualifyingInterest).toFixed(6)) : 0,
    totalPatronageAmount: totalPatronageAllocated,
    patronageStatus: 'COMPUTED'
  };

  return {
    period,
    dividendAllocations,
    patronageAllocations,
    totalYearEndShareCapital,
    totalQualifyingInterest
  };
}

// Compute Dividends & Patronage Refunds (Admin Endpoint)
apiRouter.post('/admin/dividends/calculate', requireRole(['ADMIN']), requirePermission('dividends'), (req: Request, res: Response) => {
  const { year, totalNetSurplus } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!year || !totalNetSurplus || Number(totalNetSurplus) <= 0) {
    res.status(400).json({ error: 'Please specify Year and a valid Total Net Surplus amount.' });
    return;
  }

  const db = CooperativeDB.load();
  const periodExists = db.dividendPeriods.some(p => p.year === Number(year));
  if (periodExists) {
    res.status(400).json({ error: `Dividends for Year ${year} have already been computed or distributed.` });
    return;
  }

  const {
    period,
    dividendAllocations,
    patronageAllocations,
    totalYearEndShareCapital,
    totalQualifyingInterest
  } = computeFiscalPeriodDistribution(db, Number(year), Number(totalNetSurplus), tokenUser.email || 'Admin');

  db.dividendPeriods.push(period);
  db.memberDividends.push(...dividendAllocations);
  if (!db.memberPatronageRefunds) db.memberPatronageRefunds = [];
  db.memberPatronageRefunds.push(...patronageAllocations);

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    'ADMIN',
    'DIVIDEND_COMPUTED',
    `Computed Year ${year} Net Surplus: ₱${Number(totalNetSurplus).toFixed(2)}. Distributable: ₱${period.distributableSurplus?.toFixed(2)}. Dividends: ₱${period.totalDividendAmount.toFixed(2)} (${dividendAllocations.length} members), Patronage: ₱${(period.totalPatronageAmount || 0).toFixed(2)} (${patronageAllocations.length} members).`
  );

  res.json({
    message: `End-of-Year Dividends and Patronage Refunds for ${year} computed successfully! Status remains COMPUTED until distribution.`,
    statutoryReserves: {
      reserveFund: period.reserveFundAmount,
      cetf: period.cetfAmount,
      cdf: period.cdfAmount,
      optionalFund: period.optionalFundAmount,
      totalStatutoryReserves: period.totalStatutoryReserves
    },
    distributableSurplus: period.distributableSurplus,
    dividendPoolCap: period.dividendPoolCap,
    patronagePoolCap: period.patronagePoolCap,
    totalYearEndShareCapital,
    totalQualifyingInterest,
    period,
    dividendAllocationsCount: dividendAllocations.length,
    patronageAllocationsCount: patronageAllocations.length
  });
});

// Compute Dividends & Patronage Refunds (Staff / Admin Endpoint)
apiRouter.post('/dividends/compute', requireRole(['ADMIN', 'STAFF']), requirePermission('dividends'), (req: Request, res: Response) => {
  const { year, totalNetSurplus } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!year || !totalNetSurplus || Number(totalNetSurplus) <= 0) {
    res.status(400).json({ error: 'Please specify Year and a valid Total Net Surplus amount.' });
    return;
  }

  const db = CooperativeDB.load();
  const periodExists = db.dividendPeriods.some(p => p.year === Number(year));
  if (periodExists) {
    res.status(400).json({ error: `Dividends for Year ${year} have already been computed or distributed.` });
    return;
  }

  const {
    period,
    dividendAllocations,
    patronageAllocations,
    totalYearEndShareCapital,
    totalQualifyingInterest
  } = computeFiscalPeriodDistribution(db, Number(year), Number(totalNetSurplus), tokenUser.email || 'Staff');

  db.dividendPeriods.push(period);
  db.memberDividends.push(...dividendAllocations);
  if (!db.memberPatronageRefunds) db.memberPatronageRefunds = [];
  db.memberPatronageRefunds.push(...patronageAllocations);

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'DIVIDEND_COMPUTED',
    `Computed Year ${year} surplus distribution: ₱${period.totalDividendAmount.toFixed(2)} dividend pool, ₱${(period.totalPatronageAmount || 0).toFixed(2)} patronage pool.`
  );

  res.json({
    message: `Dividends and Patronage Refunds computed successfully! Status remains COMPUTED until distribution.`,
    period,
    allocationsCount: dividendAllocations.length,
    patronageCount: patronageAllocations.length,
    totalYearEndShareCapital,
    totalQualifyingInterest
  });
});

// Finalize & Distribute Dividends and Patronage Refunds (Admin Only)
apiRouter.post('/dividends/distribute/:id', requireRole(['ADMIN']), requirePermission('dividends'), (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const period = db.dividendPeriods.find(p => p.id === id);

  if (!period) {
    res.status(404).json({ error: 'Dividend computation period not found' });
    return;
  }

  const dividendAllocations = (db.memberDividends || []).filter(d => d.dividendPeriodId === id);
  const patronageAllocations = (db.memberPatronageRefunds || []).filter(d => d.dividendPeriodId === id);

  if (dividendAllocations.length === 0 && patronageAllocations.length === 0) {
    res.status(400).json({ error: 'No member dividend or patronage allocations found for this computation period.' });
    return;
  }

  let newlyDistributedCount = 0;
  let alreadyProcessedCount = 0;
  const postings: any[] = [];
  const operatorName = tokenUser.role === 'ADMIN' ? 'Admin' : (tokenUser.email || 'Cashier');

  // 1. Distribute Dividend Allocations (Credit to Regular Savings + track dividendsEarned + issue Official Receipt)
  for (const alloc of dividendAllocations) {
    if (alloc.status === 'PAID') {
      alreadyProcessedCount++;
      continue;
    }

    const member = db.members.find(m => m.id === alloc.memberId);
    if (!member) continue;

    const postingKey = `DIVIDEND_CREDIT:${period.id}:${alloc.memberId}`;
    const aliasKey = `DIVIDEND_CREDIT:${alloc.id}`;

    const postResult = CooperativeDB.postFinancialTransaction({
      postingKeys: [postingKey, aliasKey],
      paymentSource: 'DIVIDEND_DISTRIBUTION',
      memberId: member.id,
      memberName: member.fullName,
      amount: alloc.dividendAmount,
      postingType: 'DIVIDEND_CREDIT',
      postedBy: operatorName,
      executePosting: (currentDb) => {
        const targetMember = currentDb.members.find(m => m.id === alloc.memberId);
        if (targetMember) {
          targetMember.regularSavings = Number(((targetMember.regularSavings || 0) + alloc.dividendAmount).toFixed(2));
          targetMember.dividendsEarned = Number(((targetMember.dividendsEarned || 0) + alloc.dividendAmount).toFixed(2));
        }

        const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
        const ledgerTransaction: Transaction = {
          id: txId,
          memberId: alloc.memberId,
          memberName: alloc.memberName,
          type: 'DIVIDEND_CREDIT',
          amount: alloc.dividendAmount,
          referenceId: period.id,
          description: `Year ${period.year} Dividend Distribution (Fiscal Year-End Share Capital Return)`,
          processedBy: operatorName,
          createdAt: new Date().toISOString()
        };
        currentDb.transactions.unshift(ledgerTransaction);

        const receipt = createOfficialReceipt(currentDb, {
          memberId: alloc.memberId,
          memberName: alloc.memberName,
          memberNumber: targetMember?.memberNumber || alloc.memberId.substring(0, 8),
          paymentType: 'DIVIDEND_CREDIT',
          paymentMethod: 'SAVINGS',
          amount: alloc.dividendAmount,
          paymentDate: new Date().toISOString().split('T')[0],
          issuedBy: operatorName,
          issuedById: tokenUser.id,
          transactionId: txId,
          internalReference: `DIV-${period.year}-${alloc.id.substring(0, 6)}`,
          remarks: `Official Credit Voucher: Year ${period.year} Dividend credited to Regular Savings`
        });

        ledgerTransaction.officialReceiptNumber = receipt.receiptNumber;

        const targetAlloc = currentDb.memberDividends.find(a => a.id === alloc.id);
        if (targetAlloc) {
          targetAlloc.status = 'PAID';
          targetAlloc.transactionId = txId;
          targetAlloc.officialReceiptNo = receipt.receiptNumber;
          targetAlloc.creditedAt = new Date().toISOString();
        }

        CooperativeDB.createNotification(
          alloc.memberId,
          'Dividend Credited',
          `Your dividend credit of ₱${alloc.dividendAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} for Year ${period.year} has been credited to your Regular Savings account! Credit Voucher OR: ${receipt.receiptNumber}`
        );

        return { ledgerTransaction, officialReceipt: receipt };
      }
    });

    if (postResult.isAlreadyProcessed) {
      alreadyProcessedCount++;
      if (postResult.existingPosting) postings.push(postResult.existingPosting);
    } else if (postResult.success) {
      newlyDistributedCount++;
      if (postResult.posting) postings.push(postResult.posting);
    }
  }

  // 2. Distribute Patronage Refund Allocations (Credit to Regular Savings + track patronageRefundEarned + issue Official Receipt)
  for (const alloc of patronageAllocations) {
    if (alloc.status === 'PAID') {
      alreadyProcessedCount++;
      continue;
    }

    const member = db.members.find(m => m.id === alloc.memberId);
    if (!member) continue;

    const postingKey = `PATRONAGE_DISTRIBUTION:${period.id}:${alloc.memberId}`;
    const aliasKey = `PATRONAGE_DISTRIBUTION:${alloc.id}`;

    const postResult = CooperativeDB.postFinancialTransaction({
      postingKeys: [postingKey, aliasKey],
      paymentSource: 'PATRONAGE_DISTRIBUTION',
      memberId: member.id,
      memberName: member.fullName,
      amount: alloc.patronageRefundAmount,
      postingType: 'PATRONAGE_REFUND',
      postedBy: operatorName,
      executePosting: (currentDb) => {
        const targetMember = currentDb.members.find(m => m.id === alloc.memberId);
        if (targetMember) {
          targetMember.regularSavings = Number(((targetMember.regularSavings || 0) + alloc.patronageRefundAmount).toFixed(2));
          targetMember.patronageRefundEarned = Number(((targetMember.patronageRefundEarned || 0) + alloc.patronageRefundAmount).toFixed(2));
        }

        const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
        const ledgerTransaction: Transaction = {
          id: txId,
          memberId: alloc.memberId,
          memberName: alloc.memberName,
          type: 'PATRONAGE_REFUND',
          amount: alloc.patronageRefundAmount,
          referenceId: period.id,
          description: `Year ${period.year} Patronage Refund (Return on Loan Interest Paid)`,
          processedBy: operatorName,
          createdAt: new Date().toISOString()
        };
        currentDb.transactions.unshift(ledgerTransaction);

        const receipt = createOfficialReceipt(currentDb, {
          memberId: alloc.memberId,
          memberName: alloc.memberName,
          memberNumber: targetMember?.memberNumber || alloc.memberId.substring(0, 8),
          paymentType: 'PATRONAGE_REFUND',
          paymentMethod: 'SAVINGS',
          amount: alloc.patronageRefundAmount,
          paymentDate: new Date().toISOString().split('T')[0],
          issuedBy: operatorName,
          issuedById: tokenUser.id,
          transactionId: txId,
          internalReference: `PAT-${period.year}-${alloc.id.substring(0, 6)}`,
          remarks: `Official Credit Voucher: Year ${period.year} Patronage Refund credited to Regular Savings`
        });

        ledgerTransaction.officialReceiptNumber = receipt.receiptNumber;

        const targetAlloc = (currentDb.memberPatronageRefunds || []).find(a => a.id === alloc.id);
        if (targetAlloc) {
          targetAlloc.status = 'PAID';
          targetAlloc.transactionId = txId;
          targetAlloc.officialReceiptNo = receipt.receiptNumber;
          targetAlloc.creditedAt = new Date().toISOString();
        }

        CooperativeDB.createNotification(
          alloc.memberId,
          'Patronage Refund Credited',
          `Your patronage refund of ₱${alloc.patronageRefundAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} for Year ${period.year} has been credited to your Regular Savings account! Credit Voucher OR: ${receipt.receiptNumber}`
        );

        return { ledgerTransaction, officialReceipt: receipt };
      }
    });

    if (postResult.isAlreadyProcessed) {
      alreadyProcessedCount++;
      if (postResult.existingPosting) postings.push(postResult.existingPosting);
    } else if (postResult.success) {
      newlyDistributedCount++;
      if (postResult.posting) postings.push(postResult.posting);
    }
  }

  // Update period status in database
  const updatedDb = CooperativeDB.load();
  const updatedPeriod = updatedDb.dividendPeriods.find(p => p.id === id);
  if (updatedPeriod) {
    updatedPeriod.status = 'DISTRIBUTED';
    updatedPeriod.patronageStatus = 'DISTRIBUTED';
    updatedPeriod.distributedAt = new Date().toISOString();
    updatedPeriod.distributedBy = operatorName;
    updatedPeriod.patronageDistributedAt = updatedPeriod.distributedAt;
    updatedPeriod.patronageDistributedBy = operatorName;
    CooperativeDB.save(updatedDb);
  }

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    'ADMIN',
    'DIVIDEND_DISTRIBUTION',
    `Distributed Year ${period.year} dividends and patronage refunds to ${newlyDistributedCount} allocations (${alreadyProcessedCount} previously processed).`
  );

  res.json({
    message: `Dividends and Patronage Refunds finalized and distributed! ${newlyDistributedCount} member credits processed (${alreadyProcessedCount} already processed).`,
    period: updatedPeriod || period,
    dividendAllocationsCount: dividendAllocations.length,
    patronageAllocationsCount: patronageAllocations.length,
    newlyDistributedCount,
    alreadyProcessedCount,
    postings
  });
});

// Finalize & Distribute Patronage Refunds Specifically (Admin Only)
apiRouter.post('/patronage/distribute/:id', requireRole(['ADMIN']), requirePermission('dividends'), (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const period = db.dividendPeriods.find(p => p.id === id);

  if (!period) {
    res.status(404).json({ error: 'Dividend computation period not found' });
    return;
  }

  const patronageAllocations = (db.memberPatronageRefunds || []).filter(d => d.dividendPeriodId === id);

  if (patronageAllocations.length === 0) {
    res.status(400).json({ error: 'No member patronage refund allocations found for this computation period.' });
    return;
  }

  let newlyDistributedCount = 0;
  let alreadyProcessedCount = 0;
  const postings: any[] = [];
  const operatorName = tokenUser.role === 'ADMIN' ? 'Admin' : (tokenUser.email || 'Cashier');

  for (const alloc of patronageAllocations) {
    if (alloc.status === 'PAID') {
      alreadyProcessedCount++;
      continue;
    }

    const member = db.members.find(m => m.id === alloc.memberId);
    if (!member) continue;

    const postingKey = `PATRONAGE_DISTRIBUTION:${period.id}:${alloc.memberId}`;
    const aliasKey = `PATRONAGE_DISTRIBUTION:${alloc.id}`;

    const postResult = CooperativeDB.postFinancialTransaction({
      postingKeys: [postingKey, aliasKey],
      paymentSource: 'PATRONAGE_DISTRIBUTION',
      memberId: member.id,
      memberName: member.fullName,
      amount: alloc.patronageRefundAmount,
      postingType: 'PATRONAGE_REFUND',
      postedBy: operatorName,
      executePosting: (currentDb) => {
        const targetMember = currentDb.members.find(m => m.id === alloc.memberId);
        if (targetMember) {
          targetMember.regularSavings = Number(((targetMember.regularSavings || 0) + alloc.patronageRefundAmount).toFixed(2));
          targetMember.patronageRefundEarned = Number(((targetMember.patronageRefundEarned || 0) + alloc.patronageRefundAmount).toFixed(2));
        }

        const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
        const ledgerTransaction: Transaction = {
          id: txId,
          memberId: alloc.memberId,
          memberName: alloc.memberName,
          type: 'PATRONAGE_REFUND',
          amount: alloc.patronageRefundAmount,
          referenceId: period.id,
          description: `Year ${period.year} Patronage Refund (Return on Loan Interest Paid)`,
          processedBy: operatorName,
          createdAt: new Date().toISOString()
        };
        currentDb.transactions.unshift(ledgerTransaction);

        const receipt = createOfficialReceipt(currentDb, {
          memberId: alloc.memberId,
          memberName: alloc.memberName,
          memberNumber: targetMember?.memberNumber || alloc.memberId.substring(0, 8),
          paymentType: 'PATRONAGE_REFUND',
          paymentMethod: 'SAVINGS',
          amount: alloc.patronageRefundAmount,
          paymentDate: new Date().toISOString().split('T')[0],
          issuedBy: operatorName,
          issuedById: tokenUser.id,
          transactionId: txId,
          internalReference: `PAT-${period.year}-${alloc.id.substring(0, 6)}`,
          remarks: `Official Credit Voucher: Year ${period.year} Patronage Refund credited to Regular Savings`
        });

        ledgerTransaction.officialReceiptNumber = receipt.receiptNumber;

        const targetAlloc = (currentDb.memberPatronageRefunds || []).find(a => a.id === alloc.id);
        if (targetAlloc) {
          targetAlloc.status = 'PAID';
          targetAlloc.transactionId = txId;
          targetAlloc.officialReceiptNo = receipt.receiptNumber;
          targetAlloc.creditedAt = new Date().toISOString();
        }

        return { ledgerTransaction, officialReceipt: receipt };
      }
    });

    if (postResult.isAlreadyProcessed) {
      alreadyProcessedCount++;
      if (postResult.existingPosting) postings.push(postResult.existingPosting);
    } else if (postResult.success) {
      newlyDistributedCount++;
      if (postResult.posting) postings.push(postResult.posting);
    }
  }

  const updatedDb = CooperativeDB.load();
  const updatedPeriod = updatedDb.dividendPeriods.find(p => p.id === id);
  if (updatedPeriod) {
    updatedPeriod.patronageStatus = 'DISTRIBUTED';
    updatedPeriod.patronageDistributedAt = new Date().toISOString();
    updatedPeriod.patronageDistributedBy = operatorName;
    CooperativeDB.save(updatedDb);
  }

  res.json({
    message: `Patronage refunds distributed! ${newlyDistributedCount} member credits processed (${alreadyProcessedCount} already processed).`,
    period: updatedPeriod || period,
    patronageAllocationsCount: patronageAllocations.length,
    newlyDistributedCount,
    alreadyProcessedCount,
    postings
  });
});

// Get allocations for a period (Admin & Staff Only)
apiRouter.get('/dividends/allocations/:periodId', requireRole(['ADMIN', 'STAFF']), requirePermission('dividends'), (req: Request, res: Response) => {
  const { periodId } = req.params;
  const db = CooperativeDB.load();
  const allocations = db.memberDividends.filter(d => d.dividendPeriodId === periodId);
  res.json(allocations);
});

// Get patronage refund allocations for a period (Admin & Staff Only)
apiRouter.get('/patronage/allocations/:periodId', requireRole(['ADMIN', 'STAFF']), requirePermission('dividends'), (req: Request, res: Response) => {
  const { periodId } = req.params;
  const db = CooperativeDB.load();
  const allocations = (db.memberPatronageRefunds || []).filter(d => d.dividendPeriodId === periodId);
  res.json(allocations);
});

// Get member patronage refunds (Member sees own, Staff/Admin sees all or query memberId)
apiRouter.get('/patronage/member', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  if (tokenUser.role === 'MEMBER' && req.query.memberId && req.query.memberId !== tokenUser.id && req.query.memberId !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only view their own patronage refund history.' });
    return;
  }

  let targetId = tokenUser.id;
  if (tokenUser.role !== 'MEMBER' && req.query.memberId) {
    targetId = req.query.memberId as string;
  }

  const refunds = (db.memberPatronageRefunds || []).filter(d => d.memberId === targetId);
  res.json(refunds);
});

// Update/adjust individual allocation (Manual adjustments)
apiRouter.put('/dividends/allocations/:id', requireRole(['ADMIN', 'STAFF']), requirePermission('dividends'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { dividendAmount } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (dividendAmount === undefined || isNaN(Number(dividendAmount))) {
    res.status(400).json({ error: 'Valid dividend amount is required' });
    return;
  }

  const db = CooperativeDB.load();
  const alloc = db.memberDividends.find(d => d.id === id);
  if (!alloc) {
    res.status(404).json({ error: 'Dividend allocation record not found' });
    return;
  }

  const period = db.dividendPeriods.find(p => p.id === alloc.dividendPeriodId);
  if (period && period.status === 'DISTRIBUTED') {
    res.status(400).json({ error: 'Cannot adjust allocations for a distributed period' });
    return;
  }

  const oldAmt = alloc.dividendAmount;
  alloc.dividendAmount = Number(Number(dividendAmount).toFixed(2));
  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'DIVIDEND_ADJUSTMENT',
    `Manually adjusted Year ${alloc.year} dividend for ${alloc.memberName} from ₱${oldAmt} to ₱${alloc.dividendAmount}`
  );

  res.json({ message: 'Dividend allocation adjusted successfully', allocation: alloc });
});

// Delete individual dividend allocation
apiRouter.delete('/dividends/allocations/:id', requireRole(['ADMIN', 'STAFF']), requirePermission('dividends'), (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const allocIndex = db.memberDividends.findIndex(d => d.id === id);
  if (allocIndex === -1) {
    res.status(404).json({ error: 'Allocation not found' });
    return;
  }

  const alloc = db.memberDividends[allocIndex];
  const period = db.dividendPeriods.find(p => p.id === alloc.dividendPeriodId);
  if (period && period.status === 'DISTRIBUTED') {
    res.status(400).json({ error: 'Cannot delete allocation from a distributed period' });
    return;
  }

  db.memberDividends.splice(allocIndex, 1);
  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'DIVIDEND_ALLOCATION_DELETED',
    `Deleted dividend allocation for ${alloc.memberName} in Year ${alloc.year}.`
  );

  res.json({ message: 'Dividend allocation deleted successfully' });
});

// Update dividend period parameters
apiRouter.put('/dividends/periods/:id', requireRole(['ADMIN', 'STAFF']), requirePermission('dividends'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { year, totalNetSurplus, dividendRate } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const period = db.dividendPeriods.find(p => p.id === id);
  if (!period) {
    res.status(404).json({ error: 'Dividend period not found' });
    return;
  }

  if (period.status === 'DISTRIBUTED') {
    res.status(400).json({ error: 'Cannot update a distributed dividend period' });
    return;
  }

  if (year) period.year = Number(year);
  if (totalNetSurplus !== undefined) period.totalNetSurplus = Number(totalNetSurplus);
  if (dividendRate !== undefined) {
    const rate = Number(dividendRate) > 1 ? Number(dividendRate) / 100 : Number(dividendRate);
    period.dividendRate = rate;
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'DIVIDEND_PERIOD_UPDATED',
    `Updated dividend period parameters for year ${period.year}.`
  );

  res.json({ message: 'Dividend period updated successfully', period });
});

// Delete computed dividend period (Regenerate / cancel)
apiRouter.delete('/dividends/periods/:id', requireRole(['ADMIN', 'STAFF']), requirePermission('dividends'), (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const periodIndex = db.dividendPeriods.findIndex(p => p.id === id);
  if (periodIndex === -1) {
    res.status(404).json({ error: 'Dividend period not found' });
    return;
  }

  const period = db.dividendPeriods[periodIndex];
  if (period.status === 'DISTRIBUTED') {
    res.status(400).json({ error: 'Cannot delete a distributed dividend period' });
    return;
  }

  db.dividendPeriods.splice(periodIndex, 1);
  db.memberDividends = db.memberDividends.filter(d => d.dividendPeriodId !== id);
  if (db.memberPatronageRefunds) {
    db.memberPatronageRefunds = db.memberPatronageRefunds.filter(d => d.dividendPeriodId !== id);
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'DIVIDEND_PERIOD_DELETED',
    `Deleted computed dividend period for year ${period.year}.`
  );

  res.json({ message: 'Computed dividend period deleted successfully' });
});


// ============================================================================
// 5. INQUIRY SYSTEM
// ============================================================================

// Submit Inquiry (Member)
apiRouter.post('/inquiries/submit', requireRole(['MEMBER']), (req: Request, res: Response) => {
  const { subject, message } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!subject || !message) {
    res.status(400).json({ error: 'Please provide a subject and inquiry message' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === tokenUser.id);
  if (!member) {
    res.status(404).json({ error: 'Member profile not found' });
    return;
  }

  const inquiry: Inquiry = {
    id: 'inq_' + Math.random().toString(36).substring(2, 11),
    memberId: member.id,
    memberName: member.fullName,
    subject,
    message,
    status: 'OPEN',
    createdAt: new Date().toISOString()
  };

  db.inquiries.unshift(inquiry);
  CooperativeDB.save(db);
  CooperativeDB.logAudit(member.id, member.email, 'MEMBER', 'INQUIRY_SUBMITTED', `Inquiry submitted: "${subject}"`);

  res.status(201).json({ message: 'Inquiry submitted successfully! Staff will respond shortly.', inquiry });
});

// View inquiries
apiRouter.get('/inquiries', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  if (tokenUser.role === 'MEMBER') {
    const list = db.inquiries.filter(i => i.memberId === tokenUser.id);
    res.json(list);
  } else {
    // Admin / Staff see all
    res.json(db.inquiries);
  }
});

// Get Inquiry Details with Replies
apiRouter.get('/inquiries/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const inquiry = db.inquiries.find(i => i.id === id);

  if (!inquiry) {
    res.status(404).json({ error: 'Inquiry not found' });
    return;
  }

  // Security check for Member
  if (tokenUser.role === 'MEMBER' && inquiry.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const replies = db.inquiryReplies.filter(r => r.inquiryId === id);
  res.json({ inquiry, replies });
});

// Reply to Inquiry (Member, Staff, or Admin)
apiRouter.post('/inquiries/reply/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { message } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!message) {
    res.status(400).json({ error: 'Reply message cannot be empty' });
    return;
  }

  const db = CooperativeDB.load();
  const inquiry = db.inquiries.find(i => i.id === id);

  if (!inquiry) {
    res.status(404).json({ error: 'Inquiry not found' });
    return;
  }

  // Member security guard
  if (tokenUser.role === 'MEMBER' && inquiry.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  let senderName = 'System';
  if (tokenUser.role === 'ADMIN') {
    senderName = 'Cooperative Admin';
  } else if (tokenUser.role === 'STAFF') {
    senderName = db.staff.find(s => s.id === tokenUser.id)?.fullName || 'Staff';
  } else {
    senderName = db.members.find(m => m.id === tokenUser.id)?.fullName || 'Member';
  }

  const reply: InquiryReply = {
    id: 'rep_' + Math.random().toString(36).substring(2, 11),
    inquiryId: id,
    senderId: tokenUser.id,
    senderName,
    senderRole: tokenUser.role,
    message,
    createdAt: new Date().toISOString()
  };

  // Update status
  if (tokenUser.role === 'STAFF' || tokenUser.role === 'ADMIN') {
    inquiry.status = 'IN_PROGRESS';
  }

  db.inquiryReplies.push(reply);

  // If replied by staff/admin, notify member. If replied by member, notify system/staff?
  if (tokenUser.role !== 'MEMBER') {
    CooperativeDB.createNotification(
      inquiry.memberId,
      'New Response to Inquiry',
      `Staff has responded to your inquiry: "${inquiry.subject}".`
    );
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'INQUIRY_REPLIED', `Replied to inquiry ${id}.`);

  res.status(201).json({ message: 'Reply posted successfully!', reply, inquiry });
});

// Resolve Inquiry (Staff / Admin / Member)
apiRouter.post('/inquiries/resolve/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const inquiry = db.inquiries.find(i => i.id === id);

  if (!inquiry) {
    res.status(404).json({ error: 'Inquiry not found' });
    return;
  }

  if (tokenUser.role === 'MEMBER' && inquiry.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  inquiry.status = 'RESOLVED';
  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'INQUIRY_RESOLVED', `Inquiry ${id} resolved.`);

  res.json({ message: 'Inquiry marked as RESOLVED', inquiry });
});


// ============================================================================
// 6. USER & ACCOUNT MANAGEMENT (ADMIN / STAFF SECTIONS)
// ============================================================================

// Helper to enrich Staff record with live activity, login timestamps, and workload metrics from audit logs
function enrichStaffMember(s: Staff, db: any): Staff & { customPermissions: Record<string, boolean> } {
  const user = (db.users || []).find((u: any) => u.id === s.id);
  const staffLogs = (db.auditLogs || []).filter((l: any) => l.userId === s.id || l.userEmail === s.email);

  let latestActivity = s.lastActivityAt || user?.lastActivityAt;
  if (staffLogs.length > 0) {
    const sorted = [...staffLogs].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sorted[0]?.createdAt) {
      latestActivity = sorted[0].createdAt;
    }
  }

  const approvedMembers = staffLogs.filter((l: any) => l.action && l.action.includes('MEMBER_VERIFICATION_APPROVE')).length;
  const reviewedLoans = staffLogs.filter((l: any) => l.action && l.action.startsWith('LOAN_APPLICATION_')).length;
  const reconciledPayments = staffLogs.filter((l: any) => 
    l.action === 'PAYMENT_RECONCILIATION_POSTED' || 
    l.action === 'GCASH_VERIFIED' || 
    l.action === 'LOAN_PAYMENT_VERIFIED'
  ).length;
  const verifiedDocs = staffLogs.filter((l: any) => l.action && l.action.includes('DOCUMENT_REVIEW')).length;

  return {
    ...s,
    status: s.status || 'ACTIVE',
    lastLoginAt: s.lastLoginAt || user?.lastLoginAt,
    lastActivityAt: latestActivity,
    customPermissions: user?.customPermissions || {},
    workload: {
      approvedMembers,
      reviewedLoans,
      reconciledPayments,
      verifiedDocs,
      totalActions: staffLogs.length
    }
  };
}

// ADMIN: Get All Staff Accounts with Supervision & Workload Metrics
apiRouter.get('/staff', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const staffList = (db.staff || []).map(s => enrichStaffMember(s, db));
  res.json({ staff: staffList });
});

// ADMIN: Get Staff Operational Activity Feed
apiRouter.get('/staff/activity', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { staffId, limit } = req.query;
  const db = CooperativeDB.load();
  let logs = (db.auditLogs || []).filter((l: any) => {
    if (staffId && typeof staffId === 'string' && staffId.trim()) {
      return l.userId === staffId.trim() || l.userEmail === staffId.trim();
    }
    return l.userRole === 'STAFF' || (db.staff || []).some(s => s.id === l.userId || s.email === l.userEmail);
  });
  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const max = limit ? parseInt(limit as string, 10) : 100;
  res.json({ activities: logs.slice(0, isNaN(max) ? 100 : max) });
});

// ADMIN: Get Single Staff Member by ID with Audit History
apiRouter.get('/staff/:id', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = CooperativeDB.load();
  const s = db.staff.find(sm => sm.id === id);
  if (!s) {
    res.status(404).json({ error: 'Staff account not found' });
    return;
  }
  const staffLogs = (db.auditLogs || [])
    .filter(l => l.userId === s.id || l.userEmail === s.email)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    staff: enrichStaffMember(s, db),
    activities: staffLogs.slice(0, 50)
  });
});

// ADMIN: Get Supervision & Operational Staff Workload Summary
apiRouter.get('/admin/supervision/stats', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const staff = db.staff || [];
  const activeStaff = staff.filter(s => s.status === 'ACTIVE').length;
  const deactivatedStaff = staff.filter(s => s.status === 'DEACTIVATED').length;
  const suspendedStaff = staff.filter(s => s.status === 'SUSPENDED').length;

  const pendingMembers = (db.members || []).filter(m => m.status === 'PENDING' || m.status === 'UNDER_REVIEW').length;
  const pendingLoans = (db.loanApplications || []).filter(l => l.status === 'PENDING_REVIEW' || l.status === 'UNDER_REVIEW').length;
  const pendingPayments = (db.paymentRequests || []).filter(p => p.status === 'PENDING_RECONCILIATION').length;
  const pendingWithdrawals = (db.withdrawalRequests || []).filter(w => w.status === 'PENDING').length;
  const pendingDocuments = (db.memberDocuments || []).filter(d => d.status === 'PENDING').length;

  const staffLogs = (db.auditLogs || []).filter(l => 
    l.userRole === 'STAFF' || staff.some(s => s.id === l.userId || s.email === l.userEmail)
  );
  staffLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const recentReconciliations = staffLogs.filter(l => 
    l.action === 'PAYMENT_RECONCILIATION_POSTED' || 
    l.action === 'GCASH_VERIFIED' || 
    l.action === 'LOAN_PAYMENT_VERIFIED'
  ).slice(0, 5);

  const recentLoanReviews = staffLogs.filter(l => 
    l.action.startsWith('LOAN_APPLICATION_') || l.action === 'LOAN_APPLICATION_REVIEWED'
  ).slice(0, 5);

  const recentDocumentReviews = staffLogs.filter(l => 
    l.action === 'DOCUMENT_REVIEW'
  ).slice(0, 5);

  res.json({
    staffCount: {
      total: staff.length,
      active: activeStaff,
      deactivated: deactivatedStaff,
      suspended: suspendedStaff
    },
    pendingActions: {
      pendingMembers,
      pendingLoans,
      pendingPayments,
      pendingWithdrawals,
      pendingDocuments,
      totalPending: pendingMembers + pendingLoans + pendingPayments + pendingWithdrawals + pendingDocuments
    },
    recentStaffActivity: staffLogs.slice(0, 10),
    recentReconciliations,
    recentLoanReviews,
    recentDocumentReviews
  });
});

// ADMIN: Get Escalated / High-Priority Review Items
apiRouter.get('/admin/escalations', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const rejectedDocs = (db.memberDocuments || []).filter(d => d.status === 'REJECTED');
  const disputedLoans = (db.loanApplications || []).filter(l => l.status === 'REVISION_REQUESTED' || l.status === 'REJECTED');
  const pendingReconciliations = (db.paymentRequests || []).filter(p => p.status === 'PENDING_RECONCILIATION');
  const openInquiries = (db.inquiries || []).filter(i => i.status === 'OPEN' || i.status === 'IN_PROGRESS');

  res.json({
    rejectedDocuments: rejectedDocs,
    disputedLoans,
    pendingReconciliations,
    openInquiries
  });
});

// ADMIN: Create Staff Account
apiRouter.post('/users/staff', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { email, password, fullName, phone } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!email || !password || !fullName || !phone) {
    res.status(400).json({ error: 'Please provide all required fields' });
    return;
  }

  const db = CooperativeDB.load();
  const emailLower = email.toLowerCase();

  const userExists = db.users.some(u => u.email === emailLower);
  if (userExists) {
    res.status(400).json({ error: 'Email already registered in system' });
    return;
  }

  const salt = bcryptjs.genSaltSync(10);
  const passwordHash = bcryptjs.hashSync(password, salt);
  const userId = 'u_' + Math.random().toString(36).substring(2, 11);

  const newUser: User = {
    id: userId,
    email: emailLower,
    passwordHash,
    role: 'STAFF',
    createdAt: new Date().toISOString()
  };

  const newStaff: Staff = {
    id: userId,
    email: emailLower,
    fullName,
    phone,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  db.staff.push(newStaff);

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, 'ADMIN', 'CREATE_STAFF', `Created staff account for ${fullName} (${emailLower}).`);

  res.status(201).json({ message: 'Staff account created successfully! They can log in immediately.', staff: newStaff });
});

// ADMIN: Edit Staff Profile, Status, Permissions, or Reset Password
apiRouter.put('/users/staff/:id', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { id } = req.params;
  const { fullName, phone, status, resetPassword, customPermissions } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const staffMember = db.staff.find(s => s.id === id);
  const userAccount = db.users.find(u => u.id === id);

  if (!staffMember || !userAccount) {
    res.status(404).json({ error: 'Staff account not found' });
    return;
  }

  const prevStatus = staffMember.status;
  if (fullName) staffMember.fullName = fullName;
  if (phone) staffMember.phone = phone;
  if (status && ['ACTIVE', 'DEACTIVATED', 'SUSPENDED'].includes(status)) {
    staffMember.status = status;
  }

  if (customPermissions && typeof customPermissions === 'object') {
    userAccount.customPermissions = customPermissions;
  }

  if (resetPassword) {
    const salt = bcryptjs.genSaltSync(10);
    userAccount.passwordHash = bcryptjs.hashSync(resetPassword, salt);
  }

  CooperativeDB.save(db);

  let auditAction = 'UPDATE_STAFF';
  let auditMsg = `Updated staff profile for ${staffMember.fullName} (${staffMember.email}).`;
  if (status && status !== prevStatus) {
    auditAction = status === 'ACTIVE' ? 'ACTIVATE_STAFF' : status === 'SUSPENDED' ? 'SUSPEND_STAFF' : 'DEACTIVATE_STAFF';
    auditMsg = `Admin changed staff status for ${staffMember.fullName} from ${prevStatus} to ${status}.`;
  } else if (resetPassword) {
    auditAction = 'RESET_STAFF_ACCESS';
    auditMsg = `Admin reset access password for staff ${staffMember.fullName}.`;
  } else if (customPermissions) {
    auditAction = 'STAFF_PERMISSION_MANAGE';
    auditMsg = `Admin modified granular permission overrides for staff ${staffMember.fullName}.`;
  }

  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, 'ADMIN', auditAction, auditMsg);

  res.json({ message: 'Staff account updated successfully', staff: enrichStaffMember(staffMember, db) });
});

// ADMIN: Fast Status Update (Activate, Deactivate, Suspend)
apiRouter.put('/users/staff/:id/status', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!status || !['ACTIVE', 'DEACTIVATED', 'SUSPENDED'].includes(status)) {
    res.status(400).json({ error: 'Invalid status. Must be ACTIVE, DEACTIVATED, or SUSPENDED.' });
    return;
  }

  const db = CooperativeDB.load();
  const staffMember = db.staff.find(s => s.id === id);
  if (!staffMember) {
    res.status(404).json({ error: 'Staff account not found' });
    return;
  }

  const prevStatus = staffMember.status;
  staffMember.status = status;
  CooperativeDB.save(db);

  const auditAction = status === 'ACTIVE' ? 'ACTIVATE_STAFF' : status === 'SUSPENDED' ? 'SUSPEND_STAFF' : 'DEACTIVATE_STAFF';
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, 'ADMIN', auditAction, `Admin updated staff account status for ${staffMember.fullName} from ${prevStatus} to ${status}.`);

  res.json({ message: `Staff account successfully updated to ${status}.`, staff: enrichStaffMember(staffMember, db) });
});

// ADMIN: Reset Staff Access Credentials
apiRouter.post('/users/staff/:id/reset-access', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const staffMember = db.staff.find(s => s.id === id);
  const userAccount = db.users.find(u => u.id === id);

  if (!staffMember || !userAccount) {
    res.status(404).json({ error: 'Staff account not found' });
    return;
  }

  const generatedPass = newPassword && newPassword.trim() ? newPassword.trim() : 'CoopStaff' + Math.floor(1000 + Math.random() * 9000) + '!';
  const salt = bcryptjs.genSaltSync(10);
  userAccount.passwordHash = bcryptjs.hashSync(generatedPass, salt);
  userAccount.passwordSetupPending = false;
  CooperativeDB.save(db);

  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, 'ADMIN', 'RESET_STAFF_ACCESS', `Admin reset access credentials for staff ${staffMember.fullName} (${staffMember.email}).`);

  res.json({
    message: `Access credentials successfully reset for ${staffMember.fullName}.`,
    temporaryPassword: generatedPass,
    staff: enrichStaffMember(staffMember, db)
  });
});

apiRouter.delete('/users/staff/:id', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const staffIndex = db.staff.findIndex(s => s.id === id);
  const userIndex = db.users.findIndex(u => u.id === id);

  if (staffIndex === -1 || userIndex === -1) {
    res.status(404).json({ error: 'Staff account not found' });
    return;
  }

  const staffMember = db.staff[staffIndex];
  db.staff.splice(staffIndex, 1);
  db.users.splice(userIndex, 1);

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, 'ADMIN', 'DELETE_STAFF', `Deleted staff account for ${staffMember.fullName}.`);

  res.json({ message: 'Staff account deleted successfully' });
});

// ADMIN: Create another Administrator
apiRouter.post('/users/admin', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { email, password } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!email || !password) {
    res.status(400).json({ error: 'Please provide email and password' });
    return;
  }

  const db = CooperativeDB.load();
  const emailLower = email.toLowerCase();

  const userExists = db.users.some(u => u.email === emailLower);
  if (userExists) {
    res.status(400).json({ error: 'Email already registered in system' });
    return;
  }

  const salt = bcryptjs.genSaltSync(10);
  const passwordHash = bcryptjs.hashSync(password, salt);
  const userId = 'u_admin_' + Math.random().toString(36).substring(2, 11);

  const newAdmin: User = {
    id: userId,
    email: emailLower,
    passwordHash,
    role: 'ADMIN',
    createdAt: new Date().toISOString()
  };

  db.users.push(newAdmin);
  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, 'ADMIN', 'CREATE_ADMIN', `Created secondary Administrator account: ${emailLower}`);

  res.status(201).json({ message: 'New cooperative administrator created successfully!' });
});

// STAFF / ADMIN: Member Verification (Approval / Rejection / Review / Request Info)
apiRouter.post('/users/verify-member/:id', requireRole(['STAFF', 'ADMIN']), requirePermission('verifications'), (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (containsFinancialBalanceMutation(req.body)) {
    CooperativeDB.logAudit(
      tokenUser.id,
      tokenUser.email,
      tokenUser.role,
      'FINANCIAL_MUTATION_REJECTED',
      `Blocked attempt to directly modify financial balance(s) on member verification for member ${id}. Financial balances can only be updated through verified financial transactions.`
    );
    res.status(400).json({
      error: 'Financial balances cannot be manually edited. Balances are updated only through verified financial transactions.'
    });
    return;
  }

  const { action, reviewNotes, rejectionReason, additionalRequirementsRequested } = req.body; // action: APPROVE, REJECT, REVIEW, REQUEST_MORE

  if (!['APPROVE', 'REJECT', 'REVIEW', 'REQUEST_MORE'].includes(action)) {
    res.status(400).json({ error: 'Invalid verification action. Must be APPROVE, REJECT, REVIEW, or REQUEST_MORE' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === id);

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Admins can override decisions, while Staff can process pending/under-review applications
  if (member.status !== 'PENDING' && member.status !== 'UNDER_REVIEW' && tokenUser.role !== 'ADMIN') {
    res.status(400).json({ error: 'This member account is not pending or under review' });
    return;
  }

  const operatorName = tokenUser.role === 'ADMIN' ? 'Admin' : (db.staff.find(s => s.id === tokenUser.id)?.fullName || 'Staff');

  if (reviewNotes !== undefined) {
    member.reviewNotes = reviewNotes;
  }

  if (action === 'APPROVE') {
    member.status = 'ACTIVE';
    const nowIso = new Date().toISOString();
    member.verifiedBy = operatorName;
    member.verifiedAt = nowIso;
    member.verificationDate = nowIso;
    member.additionalRequirementsRequested = '';
    member.rejectionReason = '';

    // Generate Official Member ID if missing or generic
    if (!member.idNumber || member.idNumber.startsWith('TEMP')) {
      const year = new Date().getFullYear();
      const randDigits = Math.floor(1000 + Math.random() * 9000);
      member.idNumber = `CCT-MBR-${year}-${randDigits}`;
    }

    // Mark member documents as VERIFIED
    if (db.memberDocuments) {
      db.memberDocuments.filter(d => d.memberId === id).forEach(d => {
        d.status = 'VERIFIED';
        d.updatedAt = nowIso;
      });
    }

    // Find or create associated user in database
    let userObj = db.users.find(u => u.id === id || (member.email && u.email.toLowerCase() === member.email.toLowerCase()));
    if (!userObj) {
      userObj = {
        id: member.id,
        email: member.email.toLowerCase(),
        passwordHash: '', // Will be set up during password activation
        role: 'MEMBER',
        memberId: member.id,
        createdAt: nowIso
      };
      db.users.push(userObj);
    }
    userObj.id = member.id;
    userObj.memberId = member.id;
    userObj.role = 'MEMBER';
    if (!userObj.passwordHash) {
      userObj.passwordSetupPending = true;
    } else {
      userObj.passwordSetupPending = false;
    }

    // Membership approval does NOT create Initial Share Capital transactions or modify shareCapital.
    // The initial share requirement remains unpaid (initialShareCapitalPaid = false, shareCapital = 0) until actual payment is verified.
    // No financial transaction, deposit transaction, or official receipt is created upon approval.

    // Log member approval and sync
    CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'SUPABASE_AUTH_SYNC', `[Supabase Auth Sync] Provisioned user auth entry for ${member.email}. Assigned role: member.`);
    CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'SUPABASE_PROFILES_SYNC', `[Supabase Db Sync] Provisioned records in 'profiles' and 'members' tables for member_id: ${member.id}.`);
    CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'MEMBER_APPROVED', `Approved membership application for ${member.fullName} (${member.id}). Membership status: ACTIVE. Initial share capital requirement remains unpaid pending verified payment.`);

    dispatchLoanSmsAndNotif(
      db,
      member,
      'Account Verified & Activated',
      `Welcome to the cooperative! Your membership application has been APPROVED and ACTIVATED by ${operatorName}. ${reviewNotes ? 'Notes: ' + reviewNotes : 'All verification documents passed.'}`
    );

    CooperativeDB.createNotification(
      member.id,
      'Membership Invitation & Password Setup',
      `Dear ${member.fullName}, your membership application has been APPROVED! Please complete your account activation by setting up your password using this link: /setup-password?email=${encodeURIComponent(member.email)}`
    );
  } else if (action === 'REJECT') {
    member.status = 'REJECTED';
    if (rejectionReason) {
      member.rejectionReason = rejectionReason;
    }
    dispatchLoanSmsAndNotif(
      db,
      member,
      'Account Registration Rejected',
      `We regret to inform you that your member registration was rejected by ${operatorName}. Reason: ${rejectionReason || reviewNotes || 'Incomplete documentation'}.`
    );
    CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'REJECTION_EMAIL_DISPATCH', `[Notification Dispatch] Dispatched rejection notice to applicant ${member.email} stating: ${rejectionReason || reviewNotes || 'Documents mismatch'}`);
  } else if (action === 'REVIEW') {
    member.status = 'UNDER_REVIEW';
    dispatchLoanSmsAndNotif(
      db,
      member,
      'Application Under Review',
      `Your cooperative membership application is now UNDER REVIEW by ${operatorName}. Our team is verifying your submitted details.`
    );
  } else if (action === 'REQUEST_MORE') {
    member.status = 'REVISION_REQUESTED';
    const reqText = additionalRequirementsRequested || reviewNotes || 'Please upload updated clear identification documents.';
    member.additionalRequirementsRequested = reqText;
    dispatchLoanSmsAndNotif(
      db,
      member,
      'Additional Requirements Requested',
      `Our staff (${operatorName}) requires additional documents to complete your verification: ${reqText}. Please upload them in your Member Documents portal.`
    );
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, `MEMBER_VERIFICATION_${action}`, `Verified member ${member.fullName} as ${member.status}. Notes: ${reviewNotes || 'none'}`);

  res.json({ message: `Member registration successfully updated to ${member.status}.`, member });
});

// STAFF / ADMIN: Update Member Eligibility & Compliance Records (MIGS, Orientation, Status, PMES)
apiRouter.put('/users/members/compliance/:id', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (containsFinancialBalanceMutation(req.body)) {
    CooperativeDB.logAudit(
      tokenUser.id,
      tokenUser.email,
      tokenUser.role,
      'FINANCIAL_MUTATION_REJECTED',
      `Blocked attempt to directly modify financial balance(s) on member compliance endpoint for member ${id}. Financial balances can only be updated through verified financial transactions.`
    );
    res.status(400).json({
      error: 'Financial balances cannot be manually edited. Balances are updated only through verified financial transactions.'
    });
    return;
  }

  const { 
    isMigs, 
    loanOrientationCompleted, 
    hasAttendedPreMembershipSeminar, 
    status, 
    remarks,
    requirementUpdate 
  } = req.body;

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === id);

  if (!member) {
    res.status(404).json({ error: 'Member record not found' });
    return;
  }

  const prevStatus = member.status;
  const now = new Date().toISOString();

  if (isMigs !== undefined) member.isMigs = !!isMigs;
  if (loanOrientationCompleted !== undefined) member.loanOrientationCompleted = !!loanOrientationCompleted;
  if (hasAttendedPreMembershipSeminar !== undefined) member.hasAttendedPreMembershipSeminar = !!hasAttendedPreMembershipSeminar;
  
  if (status && ['ACTIVE', 'PENDING', 'UNDER_REVIEW', 'SUSPENDED', 'INACTIVE', 'REJECTED'].includes(status)) {
    member.status = status;
  }

  // Handle specific requirement update (PMES, Loan Orientation, etc.)
  if (requirementUpdate) {
    const { type, status: reqStatus, date, reference, remarks: reqRemarks } = requirementUpdate;
    if (type) {
      const normalizedType = (type === 'PMES' || type === 'PRE_MEMBERSHIP_SEMINAR') 
        ? 'PRE_MEMBERSHIP_SEMINAR' 
        : (type === 'ORIENTATION' || type === 'LOAN_ORIENTATION') 
        ? 'LOAN_ORIENTATION' 
        : type;
      member.complianceRecords = member.complianceRecords || [];
      let record = member.complianceRecords.find(r => 
        r.requirementType === normalizedType || 
        r.requirementType === type ||
        (normalizedType === 'PRE_MEMBERSHIP_SEMINAR' && ((r.requirementType as string) === 'PMES' || (r as any).type === 'PMES' || (r as any).type === 'PRE_MEMBERSHIP_SEMINAR')) ||
        (normalizedType === 'LOAN_ORIENTATION' && ((r.requirementType as string) === 'ORIENTATION' || (r as any).type === 'ORIENTATION' || (r as any).type === 'LOAN_ORIENTATION'))
      );
      
      const prevReqStatus = record?.status || 'NOT_COMPLETED';

      if (!record) {
        record = {
          id: 'comp_' + Math.random().toString(36).substring(2, 11),
          memberId: member.id,
          requirementType: normalizedType,
          status: 'NOT_COMPLETED',
          updatedAt: now
        };
        member.complianceRecords.push(record);
      }

      record.requirementType = normalizedType;

      const operatorName = tokenUser.role === 'ADMIN' ? 'Administrator' : (db.staff.find(s => s.id === tokenUser.id)?.fullName || tokenUser.email);

      if (reqStatus === 'COMPLETED' || reqStatus === 'VERIFIED') {
        record.status = 'COMPLETED';
        record.verificationStatus = 'VERIFIED';
        record.verifiedBy = operatorName;
        record.verifiedById = tokenUser.id;
        record.verifiedAt = now;
        record.verificationDate = now;
        record.completedAt = date || now;
        record.attendedAt = date || record.attendedAt || now;
        record.attendanceDate = record.attendedAt;
        if (normalizedType === 'PRE_MEMBERSHIP_SEMINAR') member.hasAttendedPreMembershipSeminar = true;
        if (normalizedType === 'LOAN_ORIENTATION') member.loanOrientationCompleted = true;
      } else if (reqStatus === 'PENDING_VERIFICATION' || reqStatus === 'ATTENDED') {
        record.status = 'PENDING_VERIFICATION';
        record.verificationStatus = 'PENDING';
        record.attendedAt = date || now;
        record.attendanceDate = record.attendedAt;
        record.completedAt = undefined;
        record.verifiedBy = undefined;
        record.verifiedById = undefined;
        record.verifiedAt = undefined;
        record.verificationDate = undefined;
        if (normalizedType === 'PRE_MEMBERSHIP_SEMINAR') member.hasAttendedPreMembershipSeminar = false;
        if (normalizedType === 'LOAN_ORIENTATION') member.loanOrientationCompleted = false;
      } else if (reqStatus === 'REJECTED') {
        record.status = 'REJECTED';
        record.verificationStatus = 'REJECTED';
        record.completedAt = undefined;
        record.verifiedBy = operatorName;
        record.verifiedById = tokenUser.id;
        record.verifiedAt = now;
        record.verificationDate = now;
        if (normalizedType === 'PRE_MEMBERSHIP_SEMINAR') member.hasAttendedPreMembershipSeminar = false;
        if (normalizedType === 'LOAN_ORIENTATION') member.loanOrientationCompleted = false;
      } else if (reqStatus === 'NOT_COMPLETED' || reqStatus === 'NOT_ATTENDED') {
        record.status = 'NOT_COMPLETED';
        record.verificationStatus = 'NOT_COMPLETED';
        record.attendedAt = undefined;
        record.attendanceDate = undefined;
        record.completedAt = undefined;
        record.verifiedBy = undefined;
        record.verifiedById = undefined;
        record.verifiedAt = undefined;
        record.verificationDate = undefined;
        if (normalizedType === 'PRE_MEMBERSHIP_SEMINAR') member.hasAttendedPreMembershipSeminar = false;
        if (normalizedType === 'LOAN_ORIENTATION') member.loanOrientationCompleted = false;
      }

      if (reference !== undefined) {
        record.reference = reference;
        record.referenceNumber = reference;
      }
      if (reqRemarks !== undefined) {
        record.remarks = reqRemarks;
      }
      
      record.updatedAt = now;

      // Log non-financial compliance audit record
      CooperativeDB.logAudit(
        tokenUser.id,
        tokenUser.email,
        tokenUser.role,
        (record.status === 'COMPLETED' || record.status === 'VERIFIED') ? 'MEMBER_COMPLIANCE_VERIFIED' : 'MEMBER_COMPLIANCE_UPDATED',
        `Compliance requirement ${type} for member ${member.fullName} (${member.id}) updated from ${prevReqStatus} to ${record.status}. Verified by: ${record.verifiedBy || 'Pending'}. Ref: ${record.reference || 'N/A'}. Date: ${record.attendedAt || 'N/A'}. Remarks: ${record.remarks || 'None'}.`
      );
    }
  }

  CooperativeDB.createNotification(
    member.id,
    'Member Profile & Eligibility Status Updated',
    `Your member compliance profile was updated by cooperative administration. ${remarks ? 'Notes: ' + remarks : ''}`
  );

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'MEMBER_COMPLIANCE_UPDATED',
    `Updated general compliance for member ${member.fullName} (${member.id}). Status: ${prevStatus} -> ${member.status}.`
  );

  res.json({
    message: `Member compliance profile updated successfully for ${member.fullName}!`,
    member
  });
});

// ============================================================================
// PMES & MEMBERSHIP COMPLIANCE MANAGER ENDPOINTS (NON-FINANCIAL REGISTRY)
// ============================================================================

// 1. GET /compliance/members - List members with compliance status & stats (STAFF / ADMIN)
apiRouter.get('/compliance/members', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const { search, status } = req.query;

  let members = db.members || [];

  if (search) {
    const q = String(search).toLowerCase().trim();
    members = members.filter(m => 
      (m.fullName && m.fullName.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.id && m.id.toLowerCase().includes(q)) ||
      (m.phone && m.phone.toLowerCase().includes(q))
    );
  }

  // Map each member with their requirement record
  const enrichedMembers = members.map(m => {
    const records = m.complianceRecords || [];
    const pmesRec = records.find(r => 
      r.requirementType === 'PRE_MEMBERSHIP_SEMINAR' || 
      (r.requirementType as string) === 'PMES' ||
      (r as any).type === 'PRE_MEMBERSHIP_SEMINAR' ||
      (r as any).type === 'PMES'
    );
    const orientRec = records.find(r => 
      r.requirementType === 'LOAN_ORIENTATION' || 
      (r.requirementType as string) === 'ORIENTATION' ||
      (r as any).type === 'LOAN_ORIENTATION' ||
      (r as any).type === 'ORIENTATION'
    );
    
    // Normalized PMES status
    let pmesStatus: ComplianceStatus = 'NOT_COMPLETED';
    if (pmesRec) {
      if (pmesRec.status === 'VERIFIED') pmesStatus = 'COMPLETED';
      else if (pmesRec.status === 'ATTENDED') pmesStatus = 'PENDING_VERIFICATION';
      else pmesStatus = pmesRec.status;
    } else if (m.hasAttendedPreMembershipSeminar) {
      pmesStatus = 'COMPLETED';
    }

    // Normalized Loan Orientation status
    let orientationStatus: ComplianceStatus = 'NOT_COMPLETED';
    if (orientRec) {
      if (orientRec.status === 'VERIFIED') orientationStatus = 'COMPLETED';
      else if (orientRec.status === 'ATTENDED') orientationStatus = 'PENDING_VERIFICATION';
      else orientationStatus = orientRec.status;
    } else if (m.loanOrientationCompleted) {
      orientationStatus = 'COMPLETED';
    }

    return {
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      phone: m.phone,
      status: m.status,
      avatarUrl: m.avatarUrl,
      createdAt: m.createdAt,
      membershipApprovedAt: m.membershipApprovedAt,
      hasAttendedPreMembershipSeminar: !!m.hasAttendedPreMembershipSeminar,
      loanOrientationCompleted: !!m.loanOrientationCompleted,
      pmesStatus,
      pmesRecord: pmesRec ? {
        ...pmesRec,
        status: pmesStatus,
        attendanceDate: pmesRec.attendanceDate || pmesRec.attendedAt,
        referenceNumber: pmesRec.referenceNumber || pmesRec.reference
      } : (m.hasAttendedPreMembershipSeminar ? {
        id: 'legacy_pmes',
        memberId: m.id,
        requirementType: 'PRE_MEMBERSHIP_SEMINAR' as const,
        status: 'COMPLETED' as const,
        verificationStatus: 'VERIFIED',
        updatedAt: m.createdAt,
        verifiedBy: 'System (Legacy Verified)'
      } : null),
      orientationStatus,
      orientationRecord: orientRec ? {
        ...orientRec,
        status: orientationStatus,
        attendanceDate: orientRec.attendanceDate || orientRec.attendedAt,
        referenceNumber: orientRec.referenceNumber || orientRec.reference
      } : (m.loanOrientationCompleted ? {
        id: 'legacy_orient',
        memberId: m.id,
        requirementType: 'LOAN_ORIENTATION' as const,
        status: 'COMPLETED' as const,
        verificationStatus: 'VERIFIED',
        updatedAt: m.createdAt,
        verifiedBy: 'System (Legacy Verified)'
      } : null),
      complianceRecords: records
    };
  });

  // Filter by status if specified
  const reqFilter = (req.query.requirement as string)?.toUpperCase();
  let filteredMembers = enrichedMembers;
  if (status && status !== 'ALL') {
    if (reqFilter === 'LOAN_ORIENTATION' || reqFilter === 'ORIENTATION') {
      filteredMembers = enrichedMembers.filter(m => m.orientationStatus === status);
    } else if (reqFilter === 'PRE_MEMBERSHIP_SEMINAR' || reqFilter === 'PMES') {
      filteredMembers = enrichedMembers.filter(m => m.pmesStatus === status);
    } else {
      filteredMembers = enrichedMembers.filter(m => m.pmesStatus === status || m.orientationStatus === status);
    }
  }

  // Calculate statistics across all members
  const stats = {
    total: enrichedMembers.length,
    completed: enrichedMembers.filter(m => m.pmesStatus === 'COMPLETED').length,
    pendingVerification: enrichedMembers.filter(m => m.pmesStatus === 'PENDING_VERIFICATION').length,
    notCompleted: enrichedMembers.filter(m => m.pmesStatus === 'NOT_COMPLETED').length,
    rejected: enrichedMembers.filter(m => m.pmesStatus === 'REJECTED').length,
    complianceRate: enrichedMembers.length > 0
      ? Math.round((enrichedMembers.filter(m => m.pmesStatus === 'COMPLETED').length / enrichedMembers.length) * 100)
      : 0,
    pmesCompleted: enrichedMembers.filter(m => m.pmesStatus === 'COMPLETED').length,
    pmesPending: enrichedMembers.filter(m => m.pmesStatus === 'PENDING_VERIFICATION').length,
    orientationCompleted: enrichedMembers.filter(m => m.orientationStatus === 'COMPLETED').length,
    orientationPending: enrichedMembers.filter(m => m.orientationStatus === 'PENDING_VERIFICATION').length,
    orientationNotCompleted: enrichedMembers.filter(m => m.orientationStatus === 'NOT_COMPLETED').length,
    orientationRejected: enrichedMembers.filter(m => m.orientationStatus === 'REJECTED').length
  };

  res.json({
    members: filteredMembers,
    stats,
    complianceConfig: db.systemSettings.complianceConfig || defaultComplianceConfig
  });
});

// 2. GET /compliance/member/:id - Get individual member compliance profile & audit history
apiRouter.get('/compliance/member/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (tokenUser.role === 'MEMBER' && tokenUser.id !== id) {
    res.status(403).json({ error: 'Access denied: You can only view your own compliance profile' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === id);
  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const complianceRecords = member.complianceRecords || [];
  const rawPmesRecord = complianceRecords.find(r => 
    r.requirementType === 'PRE_MEMBERSHIP_SEMINAR' || 
    (r.requirementType as string) === 'PMES' ||
    (r as any).type === 'PRE_MEMBERSHIP_SEMINAR' ||
    (r as any).type === 'PMES'
  );
  const rawOrientationRecord = complianceRecords.find(r => 
    r.requirementType === 'LOAN_ORIENTATION' || 
    (r.requirementType as string) === 'ORIENTATION' ||
    (r as any).type === 'LOAN_ORIENTATION' ||
    (r as any).type === 'ORIENTATION'
  );

  const pmesRecord = rawPmesRecord || (member.hasAttendedPreMembershipSeminar ? {
    id: 'legacy_pmes',
    memberId: member.id,
    requirementType: 'PRE_MEMBERSHIP_SEMINAR' as const,
    status: 'COMPLETED' as const,
    verificationStatus: 'VERIFIED',
    updatedAt: member.createdAt,
    verifiedBy: 'System (Legacy Verified)'
  } : null);

  const orientationRecord = rawOrientationRecord || (member.loanOrientationCompleted ? {
    id: 'legacy_orient',
    memberId: member.id,
    requirementType: 'LOAN_ORIENTATION' as const,
    status: 'COMPLETED' as const,
    verificationStatus: 'VERIFIED',
    updatedAt: member.createdAt,
    verifiedBy: 'System (Legacy Verified)'
  } : null);

  // Filter audit trail for this member's compliance events
  const auditLogs = (db.auditLogs || [])
    .filter(l => l.details && l.details.includes(member.id) && (l.action.includes('COMPLIANCE') || l.action.includes('PMES') || l.action.includes('ORIENTATION')))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    member: {
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      status: member.status,
      avatarUrl: member.avatarUrl,
      createdAt: member.createdAt,
      hasAttendedPreMembershipSeminar: !!member.hasAttendedPreMembershipSeminar,
      loanOrientationCompleted: !!member.loanOrientationCompleted
    },
    pmesRecord,
    orientationRecord,
    complianceRecords,
    auditHistory: auditLogs
  });
});

// 3. POST /compliance/attendance - Record Seminar Attendance (STAFF / ADMIN)
apiRouter.post('/compliance/attendance', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { 
    memberId, 
    requirementType = 'PRE_MEMBERSHIP_SEMINAR', 
    attendanceDate, 
    referenceNumber, 
    status = 'PENDING_VERIFICATION', 
    remarks 
  } = req.body;

  if (!memberId) {
    res.status(400).json({ error: 'Member ID is required' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === memberId);
  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const normalizedType = 
    (requirementType === 'PMES' || requirementType === 'PRE_MEMBERSHIP_SEMINAR')
      ? 'PRE_MEMBERSHIP_SEMINAR'
      : (requirementType === 'ORIENTATION' || requirementType === 'LOAN_ORIENTATION')
      ? 'LOAN_ORIENTATION'
      : requirementType;

  const reqTitle = normalizedType === 'PRE_MEMBERSHIP_SEMINAR' 
    ? 'Pre-Membership Education Seminar (PMES)' 
    : 'Loan Orientation & Credit Counseling';
  const reqShort = normalizedType === 'PRE_MEMBERSHIP_SEMINAR' ? 'PMES' : 'Loan Orientation';

  member.complianceRecords = member.complianceRecords || [];
  let record = member.complianceRecords.find(r => 
    r.requirementType === normalizedType ||
    (normalizedType === 'PRE_MEMBERSHIP_SEMINAR' && ((r.requirementType as string) === 'PMES' || (r as any).type === 'PRE_MEMBERSHIP_SEMINAR' || (r as any).type === 'PMES')) ||
    (normalizedType === 'LOAN_ORIENTATION' && ((r.requirementType as string) === 'ORIENTATION' || (r as any).type === 'LOAN_ORIENTATION' || (r as any).type === 'ORIENTATION'))
  );
  const prevStatus = record?.status || 'NOT_COMPLETED';
  const now = new Date().toISOString();
  const attDate = attendanceDate || now.split('T')[0];
  const operatorName = tokenUser.role === 'ADMIN' ? 'Administrator' : (db.staff.find(s => s.id === tokenUser.id)?.fullName || tokenUser.email);

  if (!record) {
    record = {
      id: 'comp_' + Math.random().toString(36).substring(2, 11),
      memberId: member.id,
      requirementType: normalizedType,
      status: 'NOT_COMPLETED',
      updatedAt: now
    };
    member.complianceRecords.push(record);
  }

  record.requirementType = normalizedType;
  record.attendanceDate = attDate;
  record.attendedAt = attDate;
  if (referenceNumber) {
    record.reference = referenceNumber;
    record.referenceNumber = referenceNumber;
  }
  if (remarks) {
    record.remarks = remarks;
  }
  record.recordedBy = operatorName;
  record.recordedById = tokenUser.id;
  record.recordedAt = now;
  record.updatedAt = now;

  if (status === 'COMPLETED' || status === 'VERIFIED') {
    record.status = 'COMPLETED';
    record.verificationStatus = 'VERIFIED';
    record.verifiedBy = operatorName;
    record.verifiedById = tokenUser.id;
    record.verifiedAt = now;
    record.verificationDate = now;
    record.completedAt = attDate;
    if (normalizedType === 'PRE_MEMBERSHIP_SEMINAR') member.hasAttendedPreMembershipSeminar = true;
    if (normalizedType === 'LOAN_ORIENTATION') member.loanOrientationCompleted = true;

    CooperativeDB.logAudit(
      tokenUser.id,
      tokenUser.email,
      tokenUser.role,
      'MEMBER_COMPLIANCE_VERIFIED',
      `${reqShort} attendance recorded and verified for member ${member.fullName} (${member.id}). Status: ${prevStatus} -> COMPLETED. Seminar Date: ${attDate}. Ref: ${referenceNumber || 'N/A'}. Verified By: ${operatorName}. Remarks: ${remarks || 'None'}.`
    );
  } else {
    record.status = 'PENDING_VERIFICATION';
    record.verificationStatus = 'PENDING';
    record.verifiedBy = undefined;
    record.verifiedById = undefined;
    record.verifiedAt = undefined;
    record.verificationDate = undefined;
    record.completedAt = undefined;
    if (normalizedType === 'PRE_MEMBERSHIP_SEMINAR') member.hasAttendedPreMembershipSeminar = false;
    if (normalizedType === 'LOAN_ORIENTATION') member.loanOrientationCompleted = false;

    CooperativeDB.logAudit(
      tokenUser.id,
      tokenUser.email,
      tokenUser.role,
      'MEMBER_COMPLIANCE_RECORDED',
      `${reqShort} attendance recorded for member ${member.fullName} (${member.id}). Status: ${prevStatus} -> PENDING_VERIFICATION. Seminar Date: ${attDate}. Ref: ${referenceNumber || 'N/A'}. Recorded By: ${operatorName}. Remarks: ${remarks || 'None'}.`
    );
  }

  CooperativeDB.createNotification(
    member.id,
    `${reqShort} Attendance Logged`,
    `Your ${reqTitle} attendance on ${attDate} was recorded by cooperative staff (Status: ${record.status.replace(/_/g, ' ')}).`
  );

  CooperativeDB.save(db);

  res.json({
    message: `${reqShort} attendance recorded successfully for ${member.fullName}!`,
    record,
    member: {
      id: member.id,
      fullName: member.fullName,
      status: member.status,
      hasAttendedPreMembershipSeminar: member.hasAttendedPreMembershipSeminar,
      loanOrientationCompleted: member.loanOrientationCompleted
    }
  });
});

// 4. POST /compliance/verify - Verify Seminar Completion (STAFF / ADMIN)
apiRouter.post('/compliance/verify', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { memberId, requirementType = 'PRE_MEMBERSHIP_SEMINAR', referenceNumber, remarks } = req.body;

  if (!memberId) {
    res.status(400).json({ error: 'Member ID is required' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === memberId);
  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const normalizedType = 
    (requirementType === 'PMES' || requirementType === 'PRE_MEMBERSHIP_SEMINAR')
      ? 'PRE_MEMBERSHIP_SEMINAR'
      : (requirementType === 'ORIENTATION' || requirementType === 'LOAN_ORIENTATION')
      ? 'LOAN_ORIENTATION'
      : requirementType;

  const reqTitle = normalizedType === 'PRE_MEMBERSHIP_SEMINAR' 
    ? 'Pre-Membership Education Seminar (PMES)' 
    : 'Loan Orientation & Credit Counseling';
  const reqShort = normalizedType === 'PRE_MEMBERSHIP_SEMINAR' ? 'PMES' : 'Loan Orientation';

  member.complianceRecords = member.complianceRecords || [];
  let record = member.complianceRecords.find(r => 
    r.requirementType === normalizedType ||
    (normalizedType === 'PRE_MEMBERSHIP_SEMINAR' && ((r.requirementType as string) === 'PMES' || (r as any).type === 'PRE_MEMBERSHIP_SEMINAR' || (r as any).type === 'PMES')) ||
    (normalizedType === 'LOAN_ORIENTATION' && ((r.requirementType as string) === 'ORIENTATION' || (r as any).type === 'LOAN_ORIENTATION' || (r as any).type === 'ORIENTATION'))
  );
  const prevStatus = record?.status || 'NOT_COMPLETED';
  const now = new Date().toISOString();
  const operatorName = tokenUser.role === 'ADMIN' ? 'Administrator' : (db.staff.find(s => s.id === tokenUser.id)?.fullName || tokenUser.email);

  if (!record) {
    record = {
      id: 'comp_' + Math.random().toString(36).substring(2, 11),
      memberId: member.id,
      requirementType: normalizedType,
      status: 'NOT_COMPLETED',
      updatedAt: now
    };
    member.complianceRecords.push(record);
  }

  record.requirementType = normalizedType;
  record.status = 'COMPLETED';
  record.verificationStatus = 'VERIFIED';
  record.verifiedBy = operatorName;
  record.verifiedById = tokenUser.id;
  record.verifiedAt = now;
  record.verificationDate = now;
  record.attendanceDate = record.attendanceDate || record.attendedAt || now.split('T')[0];
  record.attendedAt = record.attendedAt || record.attendanceDate;
  record.completedAt = record.attendedAt || record.attendanceDate || now;
  if (referenceNumber) {
    record.reference = referenceNumber;
    record.referenceNumber = referenceNumber;
  }
  if (remarks) {
    record.remarks = remarks;
  }
  record.updatedAt = now;

  if (normalizedType === 'PRE_MEMBERSHIP_SEMINAR') member.hasAttendedPreMembershipSeminar = true;
  if (normalizedType === 'LOAN_ORIENTATION') member.loanOrientationCompleted = true;

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'MEMBER_COMPLIANCE_VERIFIED',
    `${reqShort} verification completed for member ${member.fullName} (${member.id}). Status: ${prevStatus} -> COMPLETED. Verified By: ${operatorName}. Ref: ${record.reference || 'N/A'}. Date: ${record.attendanceDate || 'N/A'}. Remarks: ${record.remarks || 'None'}.`
  );

  CooperativeDB.createNotification(
    member.id,
    `${reqShort} Verified`,
    `Congratulations! Your ${reqTitle} requirement has been verified. You have satisfied this educational prerequisite for loan eligibility.`
  );

  CooperativeDB.save(db);

  res.json({
    message: `${reqShort} completion verified for ${member.fullName}!`,
    record,
    member: {
      id: member.id,
      fullName: member.fullName,
      status: member.status,
      hasAttendedPreMembershipSeminar: member.hasAttendedPreMembershipSeminar,
      loanOrientationCompleted: member.loanOrientationCompleted
    }
  });
});

// 5. POST /compliance/reject - Reject Seminar Attendance / Document (STAFF / ADMIN)
apiRouter.post('/compliance/reject', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { memberId, requirementType = 'PRE_MEMBERSHIP_SEMINAR', remarks } = req.body;

  if (!memberId) {
    res.status(400).json({ error: 'Member ID is required' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === memberId);
  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const normalizedType = 
    (requirementType === 'PMES' || requirementType === 'PRE_MEMBERSHIP_SEMINAR')
      ? 'PRE_MEMBERSHIP_SEMINAR'
      : (requirementType === 'ORIENTATION' || requirementType === 'LOAN_ORIENTATION')
      ? 'LOAN_ORIENTATION'
      : requirementType;

  const reqTitle = normalizedType === 'PRE_MEMBERSHIP_SEMINAR' 
    ? 'Pre-Membership Education Seminar (PMES)' 
    : 'Loan Orientation & Credit Counseling';
  const reqShort = normalizedType === 'PRE_MEMBERSHIP_SEMINAR' ? 'PMES' : 'Loan Orientation';

  member.complianceRecords = member.complianceRecords || [];
  let record = member.complianceRecords.find(r => 
    r.requirementType === normalizedType ||
    (normalizedType === 'PRE_MEMBERSHIP_SEMINAR' && ((r.requirementType as string) === 'PMES' || (r as any).type === 'PRE_MEMBERSHIP_SEMINAR' || (r as any).type === 'PMES')) ||
    (normalizedType === 'LOAN_ORIENTATION' && ((r.requirementType as string) === 'ORIENTATION' || (r as any).type === 'LOAN_ORIENTATION' || (r as any).type === 'ORIENTATION'))
  );
  const prevStatus = record?.status || 'NOT_COMPLETED';
  const now = new Date().toISOString();
  const operatorName = tokenUser.role === 'ADMIN' ? 'Administrator' : (db.staff.find(s => s.id === tokenUser.id)?.fullName || tokenUser.email);

  if (!record) {
    record = {
      id: 'comp_' + Math.random().toString(36).substring(2, 11),
      memberId: member.id,
      requirementType: normalizedType,
      status: 'NOT_COMPLETED',
      updatedAt: now
    };
    member.complianceRecords.push(record);
  }

  record.requirementType = normalizedType;
  record.status = 'REJECTED';
  record.verificationStatus = 'REJECTED';
  record.verifiedBy = operatorName;
  record.verifiedById = tokenUser.id;
  record.verifiedAt = now;
  record.completedAt = undefined;
  if (remarks) record.remarks = remarks;
  record.updatedAt = now;

  if (normalizedType === 'PRE_MEMBERSHIP_SEMINAR') member.hasAttendedPreMembershipSeminar = false;
  if (normalizedType === 'LOAN_ORIENTATION') member.loanOrientationCompleted = false;

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'MEMBER_COMPLIANCE_REJECTED',
    `${reqShort} verification rejected for member ${member.fullName} (${member.id}). Status: ${prevStatus} -> REJECTED. Performed By: ${operatorName}. Reason: ${remarks || 'No reason specified'}.`
  );

  CooperativeDB.createNotification(
    member.id,
    `${reqShort} Verification Rejected`,
    `Your ${reqTitle} record was rejected. Reason: ${remarks || 'Please contact staff for assistance'}.`
  );

  CooperativeDB.save(db);

  res.json({
    message: `${reqShort} status updated to REJECTED for ${member.fullName}.`,
    record,
    member: {
      id: member.id,
      fullName: member.fullName,
      status: member.status,
      hasAttendedPreMembershipSeminar: member.hasAttendedPreMembershipSeminar,
      loanOrientationCompleted: member.loanOrientationCompleted
    }
  });
});

// 6. GET /compliance/config - View Compliance Configuration (STAFF / ADMIN)
apiRouter.get('/compliance/config', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json({
    config: db.systemSettings.complianceConfig || defaultComplianceConfig
  });
});

// 7. PUT /compliance/config - Update Compliance Configuration (ADMIN ONLY)
apiRouter.put('/compliance/config', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { requirePmesForLoan, requireOrientationForLoan, requireKycForLoan, allowStaffDirectVerify, requireAttendanceDate, requireReferenceNumber } = req.body;

  const db = CooperativeDB.load();
  const currentConfig = db.systemSettings.complianceConfig || { ...defaultComplianceConfig };

  db.systemSettings.complianceConfig = {
    requirePmesForLoan: requirePmesForLoan !== undefined ? !!requirePmesForLoan : currentConfig.requirePmesForLoan,
    requireOrientationForLoan: requireOrientationForLoan !== undefined ? !!requireOrientationForLoan : currentConfig.requireOrientationForLoan,
    requireKycForLoan: requireKycForLoan !== undefined ? !!requireKycForLoan : currentConfig.requireKycForLoan,
    allowStaffDirectVerify: allowStaffDirectVerify !== undefined ? !!allowStaffDirectVerify : currentConfig.allowStaffDirectVerify,
    requireAttendanceDate: requireAttendanceDate !== undefined ? !!requireAttendanceDate : currentConfig.requireAttendanceDate,
    requireReferenceNumber: requireReferenceNumber !== undefined ? !!requireReferenceNumber : currentConfig.requireReferenceNumber
  };

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'COMPLIANCE_CONFIG_UPDATED',
    `Admin updated compliance configuration: PMES Mandatory=${db.systemSettings.complianceConfig.requirePmesForLoan}, Orientation Mandatory=${db.systemSettings.complianceConfig.requireOrientationForLoan}, Staff Direct Verify=${db.systemSettings.complianceConfig.allowStaffDirectVerify}.`
  );

  CooperativeDB.save(db);

  res.json({
    message: 'Compliance configuration updated successfully',
    config: db.systemSettings.complianceConfig
  });
});

// 8. GET /compliance/audit - View Compliance Audit Logs (ADMIN / STAFF)
apiRouter.get('/compliance/audit', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const complianceLogs = (db.auditLogs || [])
    .filter(l => l.action.includes('COMPLIANCE') || l.action.includes('PMES'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);

  res.json({ logs: complianceLogs });
});

// STAFF: Close / Reject Duplicate Pending Loan Application
apiRouter.post('/loans/close-duplicate/:id', requireRole(['STAFF', 'ADMIN']), requirePermission('loans_manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  const app = db.loanApplications.find(a => a.id === id);

  if (!app) {
    res.status(404).json({ error: 'Loan application not found' });
    return;
  }

  if (app.status === 'APPROVED' || app.status === 'DISBURSED' || app.status === 'REJECTED') {
    res.status(400).json({ error: `Cannot close application with status ${app.status}.` });
    return;
  }

  app.status = 'REJECTED';
  app.remarks = reason || 'Duplicate pending loan application closed by staff/administration.';
  app.reviewedBy = tokenUser.id;
  app.updatedAt = new Date().toISOString();

  const member = db.members.find(m => m.id === app.memberId);
  if (member) {
    dispatchLoanSmsAndNotif(
      db,
      member,
      'Duplicate Application Closed',
      `Your duplicate loan application #${app.id} for ${app.loanTypeName} has been closed. ${app.remarks}`
    );
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'LOAN_DUPLICATE_CLOSED',
    `Closed duplicate loan application ${id} for member ${app.memberName}.`
  );

  res.json({ message: 'Duplicate loan application successfully closed!', app });
});

// Helper to detect any attempted manual mutation of financial balances
export function containsFinancialBalanceMutation(body: any): boolean {
  if (!body || typeof body !== 'object') return false;

  const FORBIDDEN_KEYS = [
    'sharecapital',
    'share_capital',
    'paidsharecapital',
    'initialsharecapitalpaid',
    'regularsavings',
    'regular_savings',
    'savings',
    'timedeposits',
    'time_deposits',
    'balance',
    'loanbalance',
    'loan_balance',
    'outstandingbalance',
    'outstanding_balance'
  ];

  for (const key of Object.keys(body)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (FORBIDDEN_KEYS.includes(normalizedKey)) {
      return true;
    }
    if (body[key] && typeof body[key] === 'object' && !Array.isArray(body[key])) {
      if (containsFinancialBalanceMutation(body[key])) {
        return true;
      }
    }
  }

  return false;
}

// ADMIN / STAFF: Edit / Suspend / Activate / Deactivate Members (Profile & Status Management)
const handleMemberProfileOrStatusUpdate = (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (containsFinancialBalanceMutation(req.body)) {
    CooperativeDB.logAudit(
      tokenUser.id,
      tokenUser.email,
      tokenUser.role,
      'FINANCIAL_MUTATION_REJECTED',
      `Blocked attempt to directly modify financial balance(s) on member ${id}. Financial balances can only be updated through verified financial transactions.`
    );
    res.status(400).json({
      error: 'Financial balances cannot be manually edited. Balances are updated only through verified financial transactions.'
    });
    return;
  }

  const {
    fullName,
    phone,
    status,
    isMigs,
    loanOrientationCompleted,
    resetPassword,
    address,
    occupation,
    civilStatus,
    emergencyContact,
    monthlyIncome,
    birthdate,
    gender
  } = req.body;

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === id);
  const userAccount = db.users.find(u => u.id === id || (member && member.email && u.email.toLowerCase() === member.email.toLowerCase()));

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  if (fullName) member.fullName = fullName;
  if (phone) member.phone = phone;
  if (status) {
    member.status = status;
    if (status === 'ACTIVE') {
      member.hasAttendedPreMembershipSeminar = true;
      member.loanOrientationCompleted = true;
      if (member.complianceRecords) {
        member.complianceRecords.forEach(r => {
          r.status = 'COMPLETED';
          r.verificationStatus = 'VERIFIED';
          r.verifiedBy = tokenUser.email || 'Staff';
          r.verifiedAt = new Date().toISOString();
        });
      }
      if (userAccount) {
        userAccount.role = 'MEMBER';
        userAccount.memberId = member.id;
        if (userAccount.passwordHash) {
          userAccount.passwordSetupPending = false;
        }
      }
    }
  }
  if (isMigs !== undefined) member.isMigs = !!isMigs;
  if (loanOrientationCompleted !== undefined) member.loanOrientationCompleted = !!loanOrientationCompleted;
  if (address !== undefined) member.address = address;
  if (occupation !== undefined) member.occupation = occupation;
  if (civilStatus !== undefined) member.civilStatus = civilStatus;
  if (emergencyContact !== undefined) member.emergencyContact = emergencyContact;
  if (monthlyIncome !== undefined) member.monthlyIncome = Number(monthlyIncome);
  if (birthdate !== undefined) member.birthdate = birthdate;
  if (gender !== undefined) member.gender = gender;

  if (resetPassword && userAccount) {
    const salt = bcryptjs.genSaltSync(10);
    userAccount.passwordHash = bcryptjs.hashSync(resetPassword, salt);
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'UPDATE_MEMBER',
    `Updated member account for ${member.fullName}. Status set to: ${member.status}. Password Reset: ${!!resetPassword}`
  );

  res.json({ message: 'Member account updated successfully', member });
};

apiRouter.put('/users/members/:id', requireRole(['ADMIN', 'STAFF']), handleMemberProfileOrStatusUpdate);
apiRouter.put('/users/members/:id/status', requireRole(['ADMIN', 'STAFF']), handleMemberProfileOrStatusUpdate);
apiRouter.post('/users/members/:id/status', requireRole(['ADMIN', 'STAFF']), handleMemberProfileOrStatusUpdate);
apiRouter.put('/members/:id', requireRole(['ADMIN', 'STAFF']), handleMemberProfileOrStatusUpdate);
apiRouter.put('/members/:id/status', requireRole(['ADMIN', 'STAFF']), handleMemberProfileOrStatusUpdate);
apiRouter.post('/members/:id/status', requireRole(['ADMIN', 'STAFF']), handleMemberProfileOrStatusUpdate);
apiRouter.patch('/members/:id', requireRole(['ADMIN', 'STAFF']), handleMemberProfileOrStatusUpdate);
apiRouter.patch('/users/members/:id', requireRole(['ADMIN', 'STAFF']), handleMemberProfileOrStatusUpdate);

// ADMIN / STAFF: Protect loans against direct manual balance mutation
const handleLoanDirectMutationBlock = (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;
  if (containsFinancialBalanceMutation(req.body)) {
    CooperativeDB.logAudit(
      tokenUser.id,
      tokenUser.email,
      tokenUser.role,
      'FINANCIAL_MUTATION_REJECTED',
      `Blocked attempt to directly modify loan balance(s) on loan ${id}. Financial balances can only be updated through verified financial transactions.`
    );
    res.status(400).json({
      error: 'Financial balances cannot be manually edited. Balances are updated only through verified financial transactions.'
    });
    return;
  }
  res.status(400).json({
    error: 'Financial balances cannot be manually edited. Balances are updated only through verified financial transactions.'
  });
};

apiRouter.put('/loans/:id', requireRole(['ADMIN', 'STAFF']), handleLoanDirectMutationBlock);
apiRouter.put('/loans/:id/status', requireRole(['ADMIN', 'STAFF']), handleLoanDirectMutationBlock);
apiRouter.patch('/loans/:id', requireRole(['ADMIN', 'STAFF']), handleLoanDirectMutationBlock);
apiRouter.patch('/loans/:id/status', requireRole(['ADMIN', 'STAFF']), handleLoanDirectMutationBlock);

// Get All Members (Filtered for MEMBER to enforce server-side security)
apiRouter.get('/members', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();
  if (tokenUser.role === 'MEMBER') {
    return res.json((db.members || []).filter(m => m.id === tokenUser.id || (tokenUser.email && m.email.toLowerCase() === tokenUser.email.toLowerCase())));
  }
  res.json(db.members || []);
});

// GET Member by ID
const handleGetMemberById = (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { id } = req.params;
  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === id || m.memberNumber === id || (m.email && m.email.toLowerCase() === id.toLowerCase()));

  if (!member) {
    res.status(404).json({ error: 'Member record not found.' });
    return;
  }

  // Security check: A member can only access their own record
  if (tokenUser.role === 'MEMBER' && tokenUser.id !== member.id && tokenUser.email.toLowerCase() !== member.email.toLowerCase()) {
    res.status(403).json({ error: 'Forbidden: You cannot access other members\' records.' });
    return;
  }

  res.json(member);
};

apiRouter.get('/members/:id', handleGetMemberById);
apiRouter.get('/users/members/:id', handleGetMemberById);

// Update Profile Picture / Avatar (Member or Admin/Staff)
apiRouter.post('/members/avatar', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { memberId, avatarUrl } = req.body;

  if (!avatarUrl || typeof avatarUrl !== 'string') {
    res.status(400).json({ error: 'Please provide a valid avatar URL or image data.' });
    return;
  }

  if (tokenUser.role === 'MEMBER' && memberId && memberId !== tokenUser.id && memberId !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only update their own profile picture.' });
    return;
  }

  let targetId = tokenUser.id;
  if (memberId && (tokenUser.role === 'ADMIN' || tokenUser.role === 'STAFF')) {
    targetId = memberId;
  }

  const isDataUrl = avatarUrl.startsWith('data:image/');
  const isHttpUrl = avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://');

  if (!isDataUrl && !isHttpUrl) {
    res.status(400).json({ error: 'Invalid image format. Must be JPG, JPEG, PNG, or WebP image data.' });
    return;
  }

  if (isDataUrl) {
    const mimeMatch = avatarUrl.match(/^data:(image\/(jpeg|png|webp|jpg));base64,/i);
    if (!mimeMatch) {
      res.status(400).json({ error: 'Unsupported file type. Only JPG, JPEG, PNG, and WebP formats are allowed.' });
      return;
    }
    const base64Length = avatarUrl.length - (avatarUrl.indexOf(',') + 1);
    const sizeInBytes = (base64Length * 3) / 4;
    if (sizeInBytes > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Image size exceeds maximum limit of 5MB.' });
      return;
    }
  }

  const db = CooperativeDB.load();
  let targetName = 'User';

  const member = db.members.find(m => m.id === targetId);
  if (member) {
    member.avatarUrl = avatarUrl;
    targetName = member.fullName;
  }

  const staff = db.staff.find(s => s.id === targetId);
  if (staff) {
    staff.avatarUrl = avatarUrl;
    targetName = staff.fullName;
  }

  const user = db.users.find(u => u.id === targetId);
  if (user) {
    user.avatarUrl = avatarUrl;
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'MEMBER_AVATAR_UPDATE',
    `Updated profile picture for ${targetName} (${targetId}).`
  );

  if (targetId !== tokenUser.id) {
    CooperativeDB.createNotification(
      targetId,
      'Profile Picture Updated',
      'Your profile picture was updated by cooperative administration.'
    );
  }

  res.json({ message: 'Profile picture updated successfully!', avatarUrl });
});

// Remove Profile Picture / Avatar (Member or Admin/Staff)
apiRouter.delete('/members/avatar', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { memberId } = req.body || {};

  if (tokenUser.role === 'MEMBER' && memberId && memberId !== tokenUser.id && memberId !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only remove their own profile picture.' });
    return;
  }

  let targetId = tokenUser.id;
  if (memberId && (tokenUser.role === 'ADMIN' || tokenUser.role === 'STAFF')) {
    targetId = memberId;
  }

  const db = CooperativeDB.load();
  let targetName = 'User';

  const member = db.members.find(m => m.id === targetId);
  if (member) {
    member.avatarUrl = '';
    targetName = member.fullName;
  }

  const staff = db.staff.find(s => s.id === targetId);
  if (staff) {
    staff.avatarUrl = '';
    targetName = staff.fullName;
  }

  const user = db.users.find(u => u.id === targetId);
  if (user) {
    user.avatarUrl = '';
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'MEMBER_AVATAR_DELETE',
    `Removed profile picture for ${targetName} (${targetId}).`
  );

  res.json({ message: 'Profile picture removed successfully.' });
});

// GET Member Me Profile (Returns member's current profile & GCash info)
const handleGetMemberMeProfile = (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === tokenUser.id || (tokenUser.memberId && m.id === tokenUser.memberId) || (tokenUser.email && m.email.toLowerCase() === tokenUser.email.toLowerCase()));

  if (!member) {
    res.status(404).json({ error: 'Member record not found.' });
    return;
  }

  if (!db.memberDocuments) db.memberDocuments = [];
  let docs = db.memberDocuments.filter(d => d.memberId === member.id);
  if (docs.length === 0) {
    if (member.govIdUrl) {
      docs.push({
        id: `doc_${member.id}_govid`,
        memberId: member.id,
        memberName: member.fullName,
        fileName: member.govIdFileName || 'government_id.jpg',
        fileType: member.govIdUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
        documentCategory: 'GOV_ID',
        fileDataUrl: member.govIdUrl,
        fileSize: Math.round(member.govIdUrl.length * 0.75),
        status: 'PENDING',
        uploadedAt: member.createdAt,
        updatedAt: member.createdAt
      });
    }
    if (member.selfieUrl) {
      docs.push({
        id: `doc_${member.id}_selfie`,
        memberId: member.id,
        memberName: member.fullName,
        fileName: member.selfieFileName || 'selfie_photo.jpg',
        fileType: member.selfieUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
        documentCategory: 'SELFIE',
        fileDataUrl: member.selfieUrl,
        fileSize: Math.round(member.selfieUrl.length * 0.75),
        status: 'PENDING',
        uploadedAt: member.createdAt,
        updatedAt: member.createdAt
      });
    }
    if (member.supportingDocUrl) {
      docs.push({
        id: `doc_${member.id}_supp`,
        memberId: member.id,
        memberName: member.fullName,
        fileName: member.supportingDocFileName || 'supporting_document.pdf',
        fileType: member.supportingDocUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
        documentCategory: 'INCOME_PROOF',
        fileDataUrl: member.supportingDocUrl,
        fileSize: Math.round(member.supportingDocUrl.length * 0.75),
        status: 'PENDING',
        uploadedAt: member.createdAt,
        updatedAt: member.createdAt
      });
    }
  }

  res.json({
    ...member,
    memberDocuments: docs
  });
};

apiRouter.get('/members/me/profile', handleGetMemberMeProfile);
apiRouter.get('/member/profile', handleGetMemberMeProfile);
apiRouter.get('/members/profile', handleGetMemberMeProfile);
apiRouter.get('/member/me', handleGetMemberMeProfile);
apiRouter.get('/members/me', handleGetMemberMeProfile);

// PUT Member GCash Info (Save / Update GCash Account Name, Mobile Number, and uploaded QR Code)
apiRouter.put('/members/me/gcash-info', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (containsFinancialBalanceMutation(req.body)) {
    CooperativeDB.logAudit(
      tokenUser.id,
      tokenUser.email,
      tokenUser.role,
      'FINANCIAL_MUTATION_REJECTED',
      `Member ${tokenUser.id} attempted to directly modify financial balance(s) via GCash info endpoint.`
    );
    res.status(400).json({
      error: 'Financial balances cannot be manually edited. Balances are updated only through verified financial transactions.'
    });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === tokenUser.id || (tokenUser.memberId && m.id === tokenUser.memberId) || (tokenUser.email && m.email.toLowerCase() === tokenUser.email.toLowerCase()));

  if (!member) {
    res.status(404).json({ error: 'Member record not found.' });
    return;
  }

  const { gcashNumber, gcashAccountName, gcashQrCodeUrl } = req.body || {};

  // Validate image file format and file size limit (max 10MB) if new QR image provided
  if (gcashQrCodeUrl && gcashQrCodeUrl.startsWith('data:')) {
    const mimeMatch = gcashQrCodeUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,/i);
    if (!mimeMatch) {
      res.status(400).json({ error: 'Invalid GCash QR Code image file format. Only PNG, JPG, JPEG, and WebP images are allowed.' });
      return;
    }
    // Check approximate payload size (10 MB limit)
    const base64Length = gcashQrCodeUrl.length - gcashQrCodeUrl.indexOf(',') - 1;
    const sizeInBytes = (base64Length * 3) / 4;
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
    if (sizeInBytes > maxSizeBytes) {
      res.status(400).json({ error: 'GCash QR Code image exceeds maximum allowed file size of 10 MB.' });
      return;
    }
  }

  if (gcashNumber !== undefined) {
    member.gcashNumber = String(gcashNumber).trim();
  }
  if (gcashAccountName !== undefined) {
    member.gcashAccountName = String(gcashAccountName).trim();
  }
  if (gcashQrCodeUrl !== undefined) {
    member.gcashQrCodeUrl = gcashQrCodeUrl ? String(gcashQrCodeUrl).trim() : '';
  }

  member.gcashUpdatedAt = new Date().toISOString();

  CooperativeDB.save(db);

  CooperativeDB.createNotification(
    tokenUser.id,
    'GCash Profile Information Updated',
    'Your personal GCash payout details (Number, Account Name, QR Code) have been updated successfully.'
  );

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'MEMBER_GCASH_INFO_UPDATE',
    `Updated personal GCash payment information for member ${member.fullName} (${member.id}).`
  );

  res.json({
    message: 'GCash profile information saved successfully!',
    member: {
      gcashNumber: member.gcashNumber,
      gcashAccountName: member.gcashAccountName,
      gcashQrCodeUrl: member.gcashQrCodeUrl
    }
  });
});

// DELETE Member GCash QR Code
apiRouter.delete('/members/me/gcash-qr', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === tokenUser.id || (tokenUser.memberId && m.id === tokenUser.memberId) || (tokenUser.email && m.email.toLowerCase() === tokenUser.email.toLowerCase()));

  if (!member) {
    res.status(404).json({ error: 'Member record not found.' });
    return;
  }

  member.gcashQrCodeUrl = '';
  member.gcashUpdatedAt = new Date().toISOString();
  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'MEMBER_GCASH_QR_DELETE',
    `Removed uploaded GCash QR code for member ${member.fullName} (${member.id}).`
  );

  res.json({ message: 'GCash QR Code removed successfully.' });
});

// PUT Member Profile Details (Personal info update with strict financial guard)
const handlePutMemberMeProfile = (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (containsFinancialBalanceMutation(req.body)) {
    CooperativeDB.logAudit(
      tokenUser.id,
      tokenUser.email,
      tokenUser.role,
      'FINANCIAL_MUTATION_REJECTED',
      `Member ${tokenUser.id} attempted to directly modify financial balance(s) via personal profile endpoint.`
    );
    res.status(400).json({
      error: 'Financial balances cannot be manually edited. Balances are updated only through verified financial transactions.'
    });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === tokenUser.id || (tokenUser.memberId && m.id === tokenUser.memberId) || (tokenUser.email && m.email.toLowerCase() === tokenUser.email.toLowerCase()));

  if (!member) {
    res.status(404).json({ error: 'Member record not found.' });
    return;
  }

  const { phone, address, birthdate, civilStatus } = req.body || {};
  if (phone) member.phone = String(phone).trim();
  if (address) member.address = String(address).trim();
  if (birthdate) member.birthdate = String(birthdate).trim();
  if (civilStatus) member.civilStatus = String(civilStatus).trim();

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'MEMBER_PROFILE_UPDATE',
    `Updated personal profile details for member ${member.fullName} (${member.id}).`
  );

  res.json({ message: 'Profile details updated successfully.', member });
};

apiRouter.put('/members/me/profile', handlePutMemberMeProfile);
apiRouter.put('/member/profile', handlePutMemberMeProfile);
apiRouter.put('/members/profile', handlePutMemberMeProfile);

// Get User Accounts (Members list, Staff list, Admins list)
apiRouter.get('/users', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  if (!db.memberDocuments) db.memberDocuments = [];

  const userById = new Map(db.users.map(u => [u.id, u]));
  const docsByMemberId = new Map<string, any[]>();
  for (const d of db.memberDocuments) {
    if (!d.memberId) continue;
    const list = docsByMemberId.get(d.memberId) || [];
    list.push(d);
    docsByMemberId.set(d.memberId, list);
  }

  const enrichedMembers = db.members.map(m => {
    const associatedUser = userById.get(m.id);
    let docs = [...(docsByMemberId.get(m.id) || [])];
    if (docs.length === 0) {
      if (m.govIdUrl) {
        docs.push({
          id: `doc_${m.id}_govid`,
          memberId: m.id,
          memberName: m.fullName,
          fileName: m.govIdFileName || 'government_id.jpg',
          fileType: m.govIdUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
          documentCategory: 'GOV_ID',
          fileDataUrl: m.govIdUrl,
          fileSize: Math.round(m.govIdUrl.length * 0.75),
          status: 'PENDING',
          uploadedAt: m.createdAt,
          updatedAt: m.createdAt
        });
      }
      if (m.selfieUrl) {
        docs.push({
          id: `doc_${m.id}_selfie`,
          memberId: m.id,
          memberName: m.fullName,
          fileName: m.selfieFileName || 'selfie_photo.jpg',
          fileType: m.selfieUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
          documentCategory: 'SELFIE',
          fileDataUrl: m.selfieUrl,
          fileSize: Math.round(m.selfieUrl.length * 0.75),
          status: 'PENDING',
          uploadedAt: m.createdAt,
          updatedAt: m.createdAt
        });
      }
      if (m.supportingDocUrl) {
        docs.push({
          id: `doc_${m.id}_supp`,
          memberId: m.id,
          memberName: m.fullName,
          fileName: m.supportingDocFileName || 'supporting_document.pdf',
          fileType: m.supportingDocUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
          documentCategory: 'INCOME_PROOF',
          fileDataUrl: m.supportingDocUrl,
          fileSize: Math.round(m.supportingDocUrl.length * 0.75),
          status: 'PENDING',
          uploadedAt: m.createdAt,
          updatedAt: m.createdAt
        });
      }
    }
    return {
      ...m,
      memberDocuments: docs,
      passwordSetupPending: associatedUser ? !!associatedUser.passwordSetupPending : false
    };
  });

  // Sort: pending verification requests first, then newest registrations first
  enrichedMembers.sort((a, b) => {
    const aPending = a.status === 'PENDING' || a.status === 'UNDER_REVIEW' || a.status === 'REVISION_REQUESTED' ? 1 : 0;
    const bPending = b.status === 'PENDING' || b.status === 'UNDER_REVIEW' || b.status === 'REVISION_REQUESTED' ? 1 : 0;
    if (aPending !== bPending) return bPending - aPending;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  res.json({
    members: enrichedMembers,
    staff: (db.staff || []).map(s => enrichStaffMember(s, db)),
    admins: db.users.filter(u => u.role === 'ADMIN').map(u => ({ id: u.id, email: u.email, createdAt: u.createdAt }))
  });
});

// Dedicated Staff Verification Queue Endpoint for Pending Member Registrations
apiRouter.get('/staff/pending-members', requireRole(['ADMIN', 'STAFF']), requirePermission('verifications'), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  if (!db.memberDocuments) db.memberDocuments = [];

  const userById = new Map(db.users.map(u => [u.id, u]));
  const pendingMembers = (db.members || [])
    .filter(m => m.status === 'PENDING' || m.status === 'UNDER_REVIEW' || m.status === 'REVISION_REQUESTED')
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .map(m => {
      const associatedUser = userById.get(m.id);
      const docs = (db.memberDocuments || []).filter(d => d.memberId === m.id);
      return {
        ...m,
        memberDocuments: docs,
        passwordSetupPending: associatedUser ? !!associatedUser.passwordSetupPending : false
      };
    });

  res.json({
    pendingMembers,
    count: pendingMembers.length
  });
});


// ============================================================================
// 7. SYSTEM SETTINGS, AUDIT LOGS, NOTIFICATIONS
// ============================================================================

// Edit system settings (Admin Only)
apiRouter.post('/settings', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { 
    cooperativeName, 
    contactEmail, 
    contactPhone, 
    smsNotificationsEnabled, 
    dividendAllocationRate,
    statutoryReserveFundRate,
    reserveFundRate,
    statutoryCetfRate,
    cetfRate,
    statutoryCdfRate,
    cdfRate,
    statutoryOptionalFundRate,
    optionalFundRate,
    dividendPoolShareRate,
    patronagePoolShareRate,
    cdaRegNo,
    tin,
    address,
    fiscalYear,
    dividendRate,
    minimumShareCapital,
    bankConfig
  } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const { minMembershipTenureMonths } = req.body;
  const db = CooperativeDB.load();

  if (cooperativeName) db.systemSettings.cooperativeName = cooperativeName;
  if (minMembershipTenureMonths !== undefined) db.systemSettings.minMembershipTenureMonths = Number(minMembershipTenureMonths);
  if (contactEmail) db.systemSettings.contactEmail = contactEmail;
  if (contactPhone) db.systemSettings.contactPhone = contactPhone;
  if (smsNotificationsEnabled !== undefined) db.systemSettings.smsNotificationsEnabled = !!smsNotificationsEnabled;
  if (dividendAllocationRate !== undefined) db.systemSettings.dividendAllocationRate = Number(dividendAllocationRate);
  
  // Statutory Reserves & Distributable Pool Splits (Configurable by Admin for future periods)
  const effReserve = statutoryReserveFundRate !== undefined ? Number(statutoryReserveFundRate) : (reserveFundRate !== undefined ? Number(reserveFundRate) : undefined);
  if (effReserve !== undefined) {
    db.systemSettings.statutoryReserveFundRate = effReserve;
    (db.systemSettings as any).reserveFundRate = effReserve;
  }
  const effCetf = statutoryCetfRate !== undefined ? Number(statutoryCetfRate) : (cetfRate !== undefined ? Number(cetfRate) : undefined);
  if (effCetf !== undefined) {
    db.systemSettings.statutoryCetfRate = effCetf;
    (db.systemSettings as any).cetfRate = effCetf;
  }
  const effCdf = statutoryCdfRate !== undefined ? Number(statutoryCdfRate) : (cdfRate !== undefined ? Number(cdfRate) : undefined);
  if (effCdf !== undefined) {
    db.systemSettings.statutoryCdfRate = effCdf;
    (db.systemSettings as any).cdfRate = effCdf;
  }
  const effOpt = statutoryOptionalFundRate !== undefined ? Number(statutoryOptionalFundRate) : (optionalFundRate !== undefined ? Number(optionalFundRate) : undefined);
  if (effOpt !== undefined) {
    db.systemSettings.statutoryOptionalFundRate = effOpt;
    (db.systemSettings as any).optionalFundRate = effOpt;
  }
  if (dividendPoolShareRate !== undefined) db.systemSettings.dividendPoolShareRate = Number(dividendPoolShareRate);
  if (patronagePoolShareRate !== undefined) db.systemSettings.patronagePoolShareRate = Number(patronagePoolShareRate);

  if (cdaRegNo !== undefined) db.systemSettings.cdaRegNo = cdaRegNo;
  if (tin !== undefined) db.systemSettings.tin = tin;
  if (address !== undefined) db.systemSettings.address = address;
  if (fiscalYear !== undefined) db.systemSettings.fiscalYear = fiscalYear;
  if (dividendRate !== undefined) db.systemSettings.dividendRate = Number(dividendRate);
  if (minimumShareCapital !== undefined) db.systemSettings.minimumShareCapital = Number(minimumShareCapital);
  if (bankConfig !== undefined) db.systemSettings.bankConfig = bankConfig;

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, 'ADMIN', 'UPDATE_SETTINGS', 'Updated cooperative system, statutory reserve rates, and CDA parameters.');

  res.json({ message: 'System settings updated successfully', settings: db.systemSettings });
});

// Update GCash Settings (Admin Only)
apiRouter.post('/settings/gcash', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { enabled, accountName, mobileNumber, qrCodeUrl, instructions } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  const db = CooperativeDB.load();
  if (!db.systemSettings.gcashConfig) {
    db.systemSettings.gcashConfig = {
      enabled: false,
      accountName: '',
      mobileNumber: '',
      qrCodeUrl: '',
      instructions: ''
    };
  }

  const oldConfig = { ...db.systemSettings.gcashConfig };

  if (enabled !== undefined) db.systemSettings.gcashConfig.enabled = !!enabled;
  if (accountName !== undefined) db.systemSettings.gcashConfig.accountName = accountName;
  if (mobileNumber !== undefined) db.systemSettings.gcashConfig.mobileNumber = mobileNumber;
  if (qrCodeUrl !== undefined) db.systemSettings.gcashConfig.qrCodeUrl = qrCodeUrl;
  if (instructions !== undefined) db.systemSettings.gcashConfig.instructions = instructions;

  CooperativeDB.save(db);

  // Record audit log
  const changes = [];
  if (oldConfig.qrCodeUrl !== db.systemSettings.gcashConfig.qrCodeUrl) changes.push(`QR Code from '${oldConfig.qrCodeUrl}' to '${db.systemSettings.gcashConfig.qrCodeUrl}'`);
  if (oldConfig.mobileNumber !== db.systemSettings.gcashConfig.mobileNumber) changes.push(`GCash Number from '${oldConfig.mobileNumber}' to '${db.systemSettings.gcashConfig.mobileNumber}'`);
  if (oldConfig.accountName !== db.systemSettings.gcashConfig.accountName) changes.push(`Account Name from '${oldConfig.accountName}' to '${db.systemSettings.gcashConfig.accountName}'`);
  if (oldConfig.enabled !== db.systemSettings.gcashConfig.enabled) changes.push(`Enabled status from '${oldConfig.enabled}' to '${db.systemSettings.gcashConfig.enabled}'`);
  if (oldConfig.instructions !== db.systemSettings.gcashConfig.instructions) changes.push('Payment instructions updated');

  if (changes.length > 0) {
    CooperativeDB.logAudit(
      tokenUser.id, 
      tokenUser.email, 
      'ADMIN', 
      'UPDATE_GCASH_SETTINGS', 
      `Updated Cooperative GCash settings by Administrator ${tokenUser.email}. Changes: ${changes.join('; ')}`
    );
  }

  res.json({ message: 'Cooperative GCash settings updated successfully', gcashConfig: db.systemSettings.gcashConfig });
});

// Get Audit Logs (Admin Only)
apiRouter.get('/audit-logs', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json((db.auditLogs || []).slice(0, 500));
});

// Get Member Notifications
apiRouter.get('/notifications', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  const userNotifs = db.notifications.filter(n => n.userId === tokenUser.id);
  res.json(userNotifs);
});

// Dismiss / Read Notifications
apiRouter.post('/notifications/read', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  db.notifications
    .filter(n => n.userId === tokenUser.id)
    .forEach(n => { n.isRead = true; });

  CooperativeDB.save(db);
  res.json({ message: 'Notifications marked as read' });
});

// ============================================================================
// EMAIL NOTIFICATION DISPATCH & TEST SUITE ENDPOINTS
// ============================================================================

// Trigger in-app system notification for testing (automatically fires Email background dispatch)
apiRouter.post('/notifications/trigger-system-test', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user;
  if (!tokenUser || !tokenUser.id) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { title, message, metadata, testTransportMode } = req.body;
  const notif = CooperativeDB.createNotification(
    tokenUser.id,
    title || 'System Test Notification',
    message || 'Testing automatic Email background dispatch on in-app notification creation.',
    { ...(metadata || {}), testTransportMode }
  );

  res.json({
    success: true,
    message: 'System notification generated and Email notification dispatched.',
    notification: notif
  });
});

// Clear Email test outbox (for test suite hygiene)
apiRouter.post('/notifications/email/clear-outbox', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user;
  if (!tokenUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  clearRecordedNotificationEmails();
  res.json({ success: true, message: 'Email notification outbox cleared.' });
});

// Test outbox endpoint for automated verification suites (Email notifications)
apiRouter.get('/notifications/email/outbox', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user;
  if (!tokenUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const allOutbox = getRecordedNotificationEmails();
  if (tokenUser.role === 'ADMIN' || tokenUser.role === 'STAFF') {
    return res.json(allOutbox);
  }

  const userEmail = (tokenUser.email || '').toLowerCase();
  const memberOutbox = allOutbox.filter(o => (o.to || '').toLowerCase() === userEmail);
  res.json(memberOutbox);
});

// Trigger automated loan due-date email scan on-demand (ADMIN, STAFF, or Authenticated Tests)
apiRouter.post('/notifications/scan-loan-due-dates', async (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user;
  if (!tokenUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const asOfDate = req.body?.asOfDate ? new Date(req.body.asOfDate) : new Date();
    const result = await runAutomatedLoanDueDateEmailScan(asOfDate);
    res.json({
      success: true,
      message: 'Automated loan due-date email scan completed successfully.',
      result
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to execute loan due-date email scan.' });
  }
});


// ============================================================================
// 8. DATABASE BACKUP & RESTORE
// ============================================================================

// Backup (Admin Only)
apiRouter.get('/db/backup', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json({
    timestamp: new Date().toISOString(),
    filename: `coop_backup_${Date.now()}.json`,
    data: db
  });
});

// Restore (Admin Only)
apiRouter.post('/db/restore', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { data } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!data || !data.users || !data.members || !data.systemSettings) {
    res.status(400).json({ error: 'Invalid restore package. Missing required database state structures.' });
    return;
  }

  CooperativeDB.save(data);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, 'ADMIN', 'DATABASE_RESTORE', 'Full database restore successfully processed.');

  res.json({ message: 'Database state successfully restored! Application is fully re-synchronized.' });
});

// ============================================================================
// 9. SMS NOTIFICATIONS & GATEWAYS MODULE
// ============================================================================

// Helper to populate template tags
function populateTemplateTags(
  templateText: string,
  data: {
    memberName?: string;
    memberNumber?: string;
    loanNumber?: string;
    amount?: number | string;
    dueDate?: string;
    paymentRef?: string;
  }
): string {
  let result = templateText;
  const map: Record<string, string> = {
    '{{Member Name}}': data.memberName || 'Member',
    '{memberName}': data.memberName || 'Member',
    '{{Member Number}}': data.memberNumber || 'N/A',
    '{memberNumber}': data.memberNumber || 'N/A',
    '{{Loan Number}}': data.loanNumber || 'N/A',
    '{loanNumber}': data.loanNumber || 'N/A',
    '{{Amount Due}}': typeof data.amount === 'number' ? data.amount.toLocaleString() : (data.amount || '0.00'),
    '{amount}': typeof data.amount === 'number' ? data.amount.toLocaleString() : (data.amount || '0.00'),
    '{{Due Date}}': data.dueDate || 'N/A',
    '{dueDate}': data.dueDate || 'N/A',
    '{{Payment Reference}}': data.paymentRef || 'N/A',
    '{paymentRef}': data.paymentRef || 'N/A',
  };

  for (const [key, val] of Object.entries(map)) {
    result = result.split(key).join(val);
  }
  return result;
}

// Get SMS Settings (Gateways & Auto Reminders)
apiRouter.get('/sms/settings', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json(db.smsGatewaySettings || {});
});

// Update SMS Gateway Settings (Admin Only)
apiRouter.post('/sms/settings', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { 
    activeGateway, 
    semaphoreApiKey,
    semaphoreSenderName,
    vonageApiKey,
    vonageApiSecret,
    vonageFrom,
    customEndpointUrl,
    customApiKey,
    autoRemindersEnabled,
    scheduleOffsetDays
  } = req.body;

  const db = CooperativeDB.load();
  if (!db.smsGatewaySettings) {
    db.smsGatewaySettings = {
      activeGateway: 'SystemSimulator',
      autoRemindersEnabled: true,
      scheduleOffsetDays: [7, 3, 1, 0, -1]
    };
  }

  if (activeGateway) db.smsGatewaySettings.activeGateway = activeGateway;
  if (semaphoreApiKey !== undefined) db.smsGatewaySettings.semaphoreApiKey = semaphoreApiKey;
  if (semaphoreSenderName !== undefined) db.smsGatewaySettings.semaphoreSenderName = semaphoreSenderName;
  if (vonageApiKey !== undefined) db.smsGatewaySettings.vonageApiKey = vonageApiKey;
  if (vonageApiSecret !== undefined) db.smsGatewaySettings.vonageApiSecret = vonageApiSecret;
  if (vonageFrom !== undefined) db.smsGatewaySettings.vonageFrom = vonageFrom;
  if (customEndpointUrl !== undefined) db.smsGatewaySettings.customEndpointUrl = customEndpointUrl;
  if (customApiKey !== undefined) db.smsGatewaySettings.customApiKey = customApiKey;
  if (autoRemindersEnabled !== undefined) db.smsGatewaySettings.autoRemindersEnabled = autoRemindersEnabled;
  if (scheduleOffsetDays !== undefined && Array.isArray(scheduleOffsetDays)) {
    db.smsGatewaySettings.scheduleOffsetDays = scheduleOffsetDays;
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'SMS_SETTINGS_UPDATE',
    `Updated SMS gateway settings. Active provider set to ${db.smsGatewaySettings.activeGateway}.`
  );

  res.json({ message: 'SMS Gateway Settings updated successfully!', settings: db.smsGatewaySettings });
});

// Test Gateway Connection
apiRouter.post('/sms/test-gateway', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const { phone, gateway } = req.body;
  if (!phone) {
    res.status(400).json({ error: 'Recipient phone number is required for test dispatch' });
    return;
  }

  const db = CooperativeDB.load();
  const activeGateway = gateway || db.smsGatewaySettings?.activeGateway || 'SystemSimulator';

  // Record test SMS transaction
  const newSms: SmsNotification = {
    id: 'sms_test_' + Math.random().toString(36).substring(2, 9),
    memberId: 'system_test',
    memberName: 'Gateway Test Recipient',
    phone,
    category: 'INDIVIDUAL_NOTICE',
    type: 'MANUAL_SINGLE',
    message: `[TEST SMS via ${activeGateway}] Alliance Cooperative SMS Gateway test signal successful! Sent at ${new Date().toLocaleTimeString()}.`,
    status: 'Delivered',
    gatewayUsed: activeGateway,
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  if (!db.smsNotifications) db.smsNotifications = [];
  db.smsNotifications.unshift(newSms);
  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'SMS_GATEWAY_TEST',
    `Dispatched test SMS signal to ${phone} via ${activeGateway}.`
  );

  res.json({ message: `Test SMS signal sent to ${phone} via ${activeGateway}! Connection verified.`, sms: newSms });
});

// Get SMS Templates
apiRouter.get('/sms/templates', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json(db.smsTemplates || []);
});

// Save / Create SMS Template
apiRouter.post('/sms/templates', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const { id, name, category, content } = req.body;
  if (!name || !content || !category) {
    res.status(400).json({ error: 'Template name, category, and content are required.' });
    return;
  }

  const db = CooperativeDB.load();
  if (!db.smsTemplates) db.smsTemplates = [];

  let template;
  if (id) {
    template = db.smsTemplates.find(t => t.id === id);
    if (template) {
      template.name = name;
      template.category = category;
      template.content = content;
    }
  }

  if (!template) {
    template = {
      id: 'tmpl_' + Math.random().toString(36).substring(2, 9),
      name,
      category,
      content,
      isDefault: false,
      createdAt: new Date().toISOString()
    };
    db.smsTemplates.unshift(template);
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'SMS_TEMPLATE_SAVE',
    `Saved SMS template: ${name} (${category})`
  );

  res.json({ message: 'SMS Template saved successfully!', template, templates: db.smsTemplates });
});

// Delete Custom SMS Template
apiRouter.delete('/sms/templates/:id', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = CooperativeDB.load();
  if (!db.smsTemplates) db.smsTemplates = [];

  const index = db.smsTemplates.findIndex(t => t.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  db.smsTemplates.splice(index, 1);
  CooperativeDB.save(db);

  res.json({ message: 'SMS template deleted successfully!', templates: db.smsTemplates });
});

// Send Individual SMS
apiRouter.post('/sms/send-individual', requireRole(['ADMIN', 'STAFF']), requirePermission('sms_gateway'), (req: Request, res: Response) => {
  const { memberId, phone, category, message, loanId, accountRef, dueDate, amount, paymentRef } = req.body;

  if (!memberId || !phone || !message) {
    res.status(400).json({ error: 'Member, phone number, and message text are required.' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === memberId);
  if (!member) {
    res.status(404).json({ error: 'Member record not found.' });
    return;
  }

  const gateway = db.smsGatewaySettings?.activeGateway || 'SystemSimulator';

  // Parse template variables
  const populatedMessage = populateTemplateTags(message, {
    memberName: member.fullName,
    memberNumber: member.id,
    loanNumber: loanId || accountRef || 'N/A',
    amount,
    dueDate,
    paymentRef: paymentRef || 'PAY-REF-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  });

  const newSms: SmsNotification = {
    id: 'sms_ind_' + Math.random().toString(36).substring(2, 10),
    memberId: member.id,
    memberName: member.fullName,
    memberNumber: member.id,
    phone,
    category: category || 'INDIVIDUAL_NOTICE',
    type: 'MANUAL_SINGLE',
    loanId,
    loanRef: loanId || accountRef,
    accountRef,
    dueDate,
    amount,
    paymentRef,
    message: populatedMessage,
    status: 'Sent',
    gatewayUsed: gateway,
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  if (!db.smsNotifications) db.smsNotifications = [];
  db.smsNotifications.unshift(newSms);

  // In-App Notification record
  CooperativeDB.createNotification(
    member.id,
    `SMS Notice: ${category ? category.replace(/_/g, ' ') : 'Cooperative Message'}`,
    populatedMessage
  );

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'SMS_SEND_INDIVIDUAL',
    `Sent individual SMS to ${member.fullName} (${phone}) via ${gateway}.`
  );

  res.json({ message: `SMS message sent successfully to ${member.fullName}!`, sms: newSms });
});

// Send Bulk SMS
apiRouter.post('/sms/send-bulk', requireRole(['ADMIN', 'STAFF']), requirePermission('sms_gateway'), (req: Request, res: Response) => {
  const { targetGroup, category, rawMessage } = req.body;

  if (!rawMessage || !targetGroup) {
    res.status(400).json({ error: 'Target group and message body are required for bulk dispatch.' });
    return;
  }

  const db = CooperativeDB.load();
  if (!db.smsNotifications) db.smsNotifications = [];

  let targetMembers: Member[] = [];
  if (targetGroup === 'ALL_MEMBERS') {
    targetMembers = db.members.filter(m => m.status === 'ACTIVE');
  } else if (targetGroup === 'ACTIVE_BORROWERS') {
    const activeMemberIds = new Set(db.loans.filter(l => l.status === 'ACTIVE' && l.balance > 0).map(l => l.memberId));
    targetMembers = db.members.filter(m => activeMemberIds.has(m.id));
  } else if (targetGroup === 'REGULAR_SAVINGS_HOLDERS') {
    targetMembers = db.members.filter(m => m.status === 'ACTIVE' && m.regularSavings > 0);
  } else if (targetGroup === 'TIME_DEPOSIT_HOLDERS') {
    targetMembers = db.members.filter(m => m.status === 'ACTIVE' && m.timeDeposits > 0);
  } else if (targetGroup === 'SHARE_CAPITAL_HOLDERS') {
    targetMembers = db.members.filter(m => m.status === 'ACTIVE' && m.shareCapital > 0);
  }

  if (targetMembers.length === 0) {
    res.status(400).json({ error: 'No matching active members found for selected target group.' });
    return;
  }

  const gateway = db.smsGatewaySettings?.activeGateway || 'SystemSimulator';
  let dispatchedCount = 0;

  targetMembers.forEach(member => {
    const activeLoan = db.loans.find(l => l.memberId === member.id && l.status === 'ACTIVE');
    const msg = populateTemplateTags(rawMessage, {
      memberName: member.fullName,
      memberNumber: member.id,
      loanNumber: activeLoan ? activeLoan.id : 'N/A',
      amount: activeLoan ? activeLoan.monthlyAmortization : 0,
      dueDate: activeLoan ? activeLoan.dueDate : 'N/A',
      paymentRef: 'BULK-REF-' + member.id.substring(0, 6)
    });

    const smsRecord: SmsNotification = {
      id: 'sms_blk_' + Math.random().toString(36).substring(2, 10),
      memberId: member.id,
      memberName: member.fullName,
      memberNumber: member.id,
      phone: member.phone || '+1 (555) 000-0000',
      category: category || 'BULK_ANNOUNCEMENT',
      type: 'BULK_SEND',
      message: msg,
      status: 'Sent',
      gatewayUsed: gateway,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    db.smsNotifications.unshift(smsRecord);

    // Create in-app notification for member
    CooperativeDB.createNotification(
      member.id,
      `Cooperative Announcement: ${category ? category.replace(/_/g, ' ') : 'Notice'}`,
      msg
    );

    dispatchedCount++;
  });

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'SMS_SEND_BULK',
    `Dispatched bulk SMS campaign to ${dispatchedCount} members (${targetGroup}) via ${gateway}.`
  );

  res.json({ message: `Successfully queued & dispatched bulk SMS to ${dispatchedCount} members!`, dispatchedCount });
});

// Get SMS notifications history (Admin & Staff Only)
apiRouter.get('/sms-notifications', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json(db.smsNotifications || []);
});

// Resend manual / failed SMS notification
apiRouter.post('/sms-notifications/resend', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) {
    res.status(400).json({ error: 'Notification ID is required' });
    return;
  }
  const db = CooperativeDB.load();
  if (!db.smsNotifications) db.smsNotifications = [];
  const notification = db.smsNotifications.find(n => n.id === id);
  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  notification.status = 'Sent';
  notification.sentAt = new Date().toISOString();
  notification.errorDetails = undefined;
  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'SMS_RESEND',
    `Resent SMS notification to ${notification.memberName} (${notification.phone})`
  );

  res.json({ message: 'SMS notification resent successfully!', notification });
});

// Run automated SMS notification scan for Loans, Savings, Share Capital & Time Deposits
apiRouter.post('/sms-notifications/check-automation', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const { simulatedDate } = req.body;
  const db = CooperativeDB.load();
  if (!db.smsNotifications) db.smsNotifications = [];

  const today = simulatedDate ? new Date(simulatedDate) : new Date();
  const todayStr = today.toISOString().split('T')[0];

  let checkedCount = 0;
  let sentCount = 0;
  const gateway = db.smsGatewaySettings?.activeGateway || 'SystemSimulator';

  // 1. Scan Active Loans
  const activeLoans = db.loans.filter(l => l.status === 'ACTIVE' && l.balance > 0);

  activeLoans.forEach(loan => {
    if (!loan.dueDate) return;

    const d1 = new Date(loan.dueDate);
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(today);
    d2.setHours(0, 0, 0, 0);

    const timeDiff = d1.getTime() - d2.getTime();
    const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));

    const member = db.members.find(m => m.id === loan.memberId);
    if (!member) return;

    // Check duplicate prevention
    const checkDuplicate = (type: SmsTriggerType) => {
      return db.smsNotifications.some(
        n => n.memberId === loan.memberId && 
             n.loanId === loan.id && 
             n.type === type && 
             n.dueDate === loan.dueDate
      );
    };

    let alertType: SmsTriggerType | null = null;
    let message = '';

    if (daysDiff === 7) {
      alertType = '7_DAYS_BEFORE';
      message = `Dear ${member.fullName}, reminder that loan payment for ${loan.id} ($${loan.monthlyAmortization.toLocaleString()}) is due in 7 days on ${loan.dueDate}. Ref: REF-${loan.id}. Thank you!`;
    } else if (daysDiff === 3) {
      alertType = '3_DAYS_BEFORE';
      message = `Dear ${member.fullName}, loan payment for ${loan.id} ($${loan.monthlyAmortization.toLocaleString()}) is due in 3 days on ${loan.dueDate}. Please keep your account funded.`;
    } else if (daysDiff === 1) {
      alertType = '1_DAY_BEFORE';
      message = `URGENT: Dear ${member.fullName}, loan payment for ${loan.id} ($${loan.monthlyAmortization.toLocaleString()}) is due TOMORROW, ${loan.dueDate}. Please pay on time.`;
    } else if (daysDiff === 0) {
      alertType = 'ON_DUE_DATE';
      message = `Dear ${member.fullName}, loan payment for ${loan.id} ($${loan.monthlyAmortization.toLocaleString()}) is due TODAY, ${loan.dueDate}. Settle balance to preserve credit score.`;
    } else if (daysDiff < 0) {
      alertType = 'AFTER_DUE_DATE';
      message = `OVERDUE NOTICE: Dear ${member.fullName}, loan payment for ${loan.id} ($${loan.monthlyAmortization.toLocaleString()}) was due on ${loan.dueDate} and is OVERDUE. Pay immediately to avoid penalties.`;
    }

    if (alertType && !checkDuplicate(alertType)) {
      const statuses: ('Sent' | 'Failed' | 'Pending' | 'Delivered')[] = ['Delivered', 'Sent', 'Delivered', 'Delivered', 'Failed'];
      const status = alertType === 'AFTER_DUE_DATE' ? 'Delivered' : statuses[Math.floor(Math.random() * statuses.length)];

      const newSms: SmsNotification = {
        id: 'sms_' + Math.random().toString(36).substring(2, 11),
        memberId: loan.memberId,
        memberName: member.fullName,
        memberNumber: member.id,
        phone: member.phone || '+1 (555) 123-4567',
        category: 'LOAN_DUE',
        type: alertType,
        loanId: loan.id,
        loanRef: loan.id,
        dueDate: loan.dueDate,
        amount: loan.monthlyAmortization,
        message,
        status,
        gatewayUsed: gateway,
        sentAt: status !== 'Failed' ? new Date().toISOString() : undefined,
        createdAt: new Date().toISOString()
      };

      db.smsNotifications.unshift(newSms);

      // Trigger In-App Notification
      CooperativeDB.createNotification(
        member.id,
        `Loan Payment Reminder (${alertType.replace(/_/g, ' ')})`,
        message
      );

      sentCount++;
    }
    checkedCount++;
  });

  // 2. Scan Savings Monthly Deposit Reminders (e.g. 28th of every month)
  const currentDayOfMonth = today.getDate();
  if (currentDayOfMonth === 25 || currentDayOfMonth === 28) {
    db.members.filter(m => m.status === 'ACTIVE').forEach(member => {
      const checkExists = db.smsNotifications.some(
        n => n.memberId === member.id && n.category === 'SAVINGS_DUE' && n.createdAt.startsWith(todayStr)
      );
      if (!checkExists) {
        const msg = `Dear ${member.fullName}, friendly reminder to make your regular monthly savings deposit before end of month to qualify for full annual dividends!`;
        const newSms: SmsNotification = {
          id: 'sms_sav_' + Math.random().toString(36).substring(2, 11),
          memberId: member.id,
          memberName: member.fullName,
          phone: member.phone || '+1 (555) 000-0000',
          category: 'SAVINGS_DUE',
          type: 'ON_DUE_DATE',
          amount: 500,
          message: msg,
          status: 'Delivered',
          gatewayUsed: gateway,
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        db.smsNotifications.unshift(newSms);
        CooperativeDB.createNotification(member.id, 'Monthly Savings Deposit Call', msg);
        sentCount++;
      }
    });
  }

  if (sentCount > 0) {
    CooperativeDB.save(db);
  }

  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'SMS_AUTOMATION_CHECK',
    `Automated SMS check executed for simulated date ${todayStr}. Evaluated ${checkedCount} accounts and triggered ${sentCount} reminders.`
  );

  res.json({
    message: `Automated SMS scan completed for simulated date ${todayStr}.`,
    checkedCount,
    sentCount,
    smsNotifications: db.smsNotifications
  });
});

// Update Loan Due Date manually for testing purposes
apiRouter.post('/loans/update-due-date', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const { loanId, dueDate } = req.body;
  if (!loanId || !dueDate) {
    res.status(400).json({ error: 'Loan ID and due date are required' });
    return;
  }
  const db = CooperativeDB.load();
  const loan = db.loans.find(l => l.id === loanId);
  if (!loan) {
    res.status(404).json({ error: 'Loan not found' });
    return;
  }

  loan.dueDate = dueDate;
  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'LOAN_UPDATE_DUE_DATE',
    `Updated loan ${loanId} due date to ${dueDate} for SMS alert simulation.`
  );

  res.json({ message: 'Loan due date updated successfully', loan });
});

// SMS Analytics & Metrics
apiRouter.get('/sms/analytics', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const logs = db.smsNotifications || [];

  const totalSent = logs.length;
  const successfulCount = logs.filter(l => l.status === 'Sent' || l.status === 'Delivered').length;
  const failedCount = logs.filter(l => l.status === 'Failed').length;
  const pendingCount = logs.filter(l => l.status === 'Pending').length;
  const successRate = totalSent > 0 ? Math.round((successfulCount / totalSent) * 100) : 100;

  // Breakdown by gateway
  const byGateway: Record<string, number> = {};
  logs.forEach(l => {
    const g = l.gatewayUsed || 'SystemSimulator';
    byGateway[g] = (byGateway[g] || 0) + 1;
  });

  // Breakdown by category
  const byCategory: Record<string, number> = {};
  logs.forEach(l => {
    const c = l.category || 'LOAN_DUE';
    byCategory[c] = (byCategory[c] || 0) + 1;
  });

  res.json({
    totalSent,
    successfulCount,
    failedCount,
    pendingCount,
    successRate,
    byGateway,
    byCategory,
    activeGateway: db.smsGatewaySettings?.activeGateway || 'SystemSimulator',
    autoRemindersEnabled: db.smsGatewaySettings?.autoRemindersEnabled ?? true
  });
});

// ============================================================================
// 10. NOTIFICATIONS API
// ============================================================================
apiRouter.get('/notifications', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();
  const notifs = (db.notifications || []).filter(n => n.userId === tokenUser.id);
  res.json(notifs);
});

apiRouter.post('/notifications/read', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { id } = req.body;
  const db = CooperativeDB.load();
  if (db.notifications) {
    db.notifications.forEach(n => {
      if (n.userId === tokenUser.id && (!id || n.id === id)) {
        n.isRead = true;
      }
    });
    CooperativeDB.save(db);
  }
  res.json({ message: 'Notifications marked as read' });
});

// ============================================================================
// 11. MEMBER & LOAN DOCUMENTS API
// ============================================================================
apiRouter.get('/documents', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user;
  if (!tokenUser) {
    res.status(401).json({ error: 'Authentication required to access documents.' });
    return;
  }

  const db = CooperativeDB.load();
  if (!db.memberDocuments) db.memberDocuments = [];

  const { memberId } = req.query;
  if (tokenUser.role === 'MEMBER' && memberId && typeof memberId === 'string' && memberId.trim() !== tokenUser.id && memberId.trim() !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only view their own documents.' });
    return;
  }
  let targetMemberId = tokenUser.role === 'MEMBER' ? tokenUser.id : (typeof memberId === 'string' && memberId.trim() ? memberId.trim() : undefined);

  let docs = db.memberDocuments;
  if (targetMemberId) {
    docs = docs.filter(d => d.memberId === targetMemberId);

    // Synthesize registration documents if member has profile shortcuts but no explicit doc entries
    const member = db.members.find(m => m.id === targetMemberId);
    if (member && docs.length === 0) {
      if (member.govIdUrl) {
        docs.push({
          id: `doc_${member.id}_govid`,
          memberId: member.id,
          memberName: member.fullName,
          fileName: member.govIdFileName || 'government_id.jpg',
          fileType: member.govIdUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
          documentCategory: 'GOV_ID',
          fileDataUrl: member.govIdUrl,
          fileSize: Math.round(member.govIdUrl.length * 0.75),
          status: member.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
          uploadedAt: member.createdAt,
          updatedAt: member.createdAt
        });
      }
      if (member.selfieUrl) {
        docs.push({
          id: `doc_${member.id}_selfie`,
          memberId: member.id,
          memberName: member.fullName,
          fileName: member.selfieFileName || 'selfie_photo.jpg',
          fileType: member.selfieUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
          documentCategory: 'SELFIE',
          fileDataUrl: member.selfieUrl,
          fileSize: Math.round(member.selfieUrl.length * 0.75),
          status: member.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
          uploadedAt: member.createdAt,
          updatedAt: member.createdAt
        });
      }
      if (member.supportingDocUrl) {
        docs.push({
          id: `doc_${member.id}_supp`,
          memberId: member.id,
          memberName: member.fullName,
          fileName: member.supportingDocFileName || 'supporting_document.pdf',
          fileType: member.supportingDocUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
          documentCategory: 'INCOME_PROOF',
          fileDataUrl: member.supportingDocUrl,
          fileSize: Math.round(member.supportingDocUrl.length * 0.75),
          status: member.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
          uploadedAt: member.createdAt,
          updatedAt: member.createdAt
        });
      }
    }
  }

  res.json(docs);
});

// Single Document Access with Strict Access Control
apiRouter.get('/documents/:id', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user;
  if (!tokenUser) {
    res.status(401).json({ error: 'Authentication required to access documents.' });
    return;
  }

  const { id } = req.params;
  const db = CooperativeDB.load();
  if (!db.memberDocuments) db.memberDocuments = [];

  // Check in member registration documents
  let doc = db.memberDocuments.find(d => d.id === id);

  // If not found in standalone documents, check synthesized IDs
  if (!doc && id.startsWith('doc_')) {
    const parts = id.split('_');
    const memberId = parts[1];
    const type = parts[2];
    const member = db.members.find(m => m.id === memberId);
    if (member) {
      if (type === 'govid' && member.govIdUrl) {
        doc = {
          id,
          memberId: member.id,
          memberName: member.fullName,
          fileName: member.govIdFileName || 'government_id.jpg',
          fileType: member.govIdUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
          documentCategory: 'GOV_ID',
          fileDataUrl: member.govIdUrl,
          fileSize: Math.round(member.govIdUrl.length * 0.75),
          status: member.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
          uploadedAt: member.createdAt
        };
      } else if (type === 'selfie' && member.selfieUrl) {
        doc = {
          id,
          memberId: member.id,
          memberName: member.fullName,
          fileName: member.selfieFileName || 'selfie_photo.jpg',
          fileType: member.selfieUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
          documentCategory: 'SELFIE',
          fileDataUrl: member.selfieUrl,
          fileSize: Math.round(member.selfieUrl.length * 0.75),
          status: member.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
          uploadedAt: member.createdAt
        };
      } else if (type === 'supp' && member.supportingDocUrl) {
        doc = {
          id,
          memberId: member.id,
          memberName: member.fullName,
          fileName: member.supportingDocFileName || 'supporting_document.pdf',
          fileType: member.supportingDocUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
          documentCategory: 'INCOME_PROOF',
          fileDataUrl: member.supportingDocUrl,
          fileSize: Math.round(member.supportingDocUrl.length * 0.75),
          status: member.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
          uploadedAt: member.createdAt
        };
      }
    }
  }

  // If found in member documents:
  if (doc) {
    if (tokenUser.role === 'MEMBER' && doc.memberId !== tokenUser.id) {
      res.status(403).json({ error: 'Forbidden: You are not authorized to access another member\'s documents.' });
      return;
    }
    res.json(doc);
    return;
  }

  // Check in loan applications documents
  for (const app of (db.loanApplications || [])) {
    const loanDoc = (app.documents || []).find((d: any) => d.id === id);
    if (loanDoc) {
      if (tokenUser.role === 'MEMBER' && app.memberId !== tokenUser.id) {
        res.status(403).json({ error: 'Forbidden: You are not authorized to access another member\'s loan documents.' });
        return;
      }
      res.json({
        ...loanDoc,
        loanApplicationId: app.id,
        memberId: app.memberId,
        memberName: app.memberName
      });
      return;
    }
  }

  res.status(404).json({ error: 'Document not found.' });
});

// Staff / Admin: Review Individual Member Registration Document
apiRouter.post('/documents/review/:id', requireRole(['STAFF', 'ADMIN']), requirePermission('verifications'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!status || !['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) {
    res.status(400).json({ error: 'Invalid status. Must be VERIFIED, REJECTED, or PENDING.' });
    return;
  }

  const db = CooperativeDB.load();
  if (!db.memberDocuments) db.memberDocuments = [];

  let doc = db.memberDocuments.find(d => d.id === id);

  // If this was a synthesized ID, promote it to a real entry in db.memberDocuments
  if (!doc && id.startsWith('doc_')) {
    const parts = id.split('_');
    const memberId = parts[1];
    const type = parts[2];
    const member = db.members.find(m => m.id === memberId);
    if (member) {
      let fileDataUrl = '';
      let fileName = '';
      let documentCategory: any = 'OTHER';

      if (type === 'govid') {
        fileDataUrl = member.govIdUrl || '';
        fileName = member.govIdFileName || 'government_id.jpg';
        documentCategory = 'GOV_ID';
      } else if (type === 'selfie') {
        fileDataUrl = member.selfieUrl || '';
        fileName = member.selfieFileName || 'selfie_photo.jpg';
        documentCategory = 'SELFIE';
      } else if (type === 'supp') {
        fileDataUrl = member.supportingDocUrl || '';
        fileName = member.supportingDocFileName || 'supporting_document.pdf';
        documentCategory = 'INCOME_PROOF';
      }

      if (fileDataUrl) {
        doc = {
          id,
          memberId: member.id,
          memberName: member.fullName,
          fileName,
          fileType: fileDataUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
          documentCategory,
          fileDataUrl,
          fileSize: Math.round(fileDataUrl.length * 0.75),
          status: status as any,
          notes: notes || undefined,
          uploadedAt: member.createdAt,
          updatedAt: new Date().toISOString()
        };
        db.memberDocuments.push(doc);
      }
    }
  }

  if (!doc) {
    res.status(404).json({ error: 'Member document record not found.' });
    return;
  }

  doc.status = status as any;
  if (notes !== undefined) doc.notes = notes;
  doc.updatedAt = new Date().toISOString();
  doc.verifiedBy = tokenUser.id;
  doc.verifiedAt = new Date().toISOString();

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'DOCUMENT_REVIEW', `Document ${doc.fileName} (${doc.id}) marked as ${status}. Notes: ${notes || 'None'}`);

  res.json({ message: `Document marked as ${status}`, document: doc });
});

// Authoritative Loan Documents Endpoints (Scoped strictly to memberId + applicationId)
apiRouter.get('/loans/applications/:applicationId/documents', requireRole(['ADMIN', 'STAFF', 'MEMBER']), (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  const app = (db.loanApplications || []).find(a => a.id === applicationId);
  if (!app) {
    res.status(404).json({ error: 'Loan application not found.' });
    return;
  }

  // Security Access Check
  if (tokenUser.role === 'MEMBER' && app.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'Forbidden: You are not authorized to view documents for this loan application.' });
    return;
  }

  res.json({
    applicationId: app.id,
    memberId: app.memberId,
    memberName: app.memberName,
    loanTypeName: app.loanTypeName,
    documents: app.documents || []
  });
});

apiRouter.get('/loans/applications/:applicationId/documents/:documentId', requireRole(['ADMIN', 'STAFF', 'MEMBER']), (req: Request, res: Response) => {
  const { applicationId, documentId } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  const app = (db.loanApplications || []).find(a => a.id === applicationId);
  if (!app) {
    res.status(404).json({ error: 'Loan application not found.' });
    return;
  }

  if (tokenUser.role === 'MEMBER' && app.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'Forbidden: You are not authorized to view documents for this loan application.' });
    return;
  }

  const doc = (app.documents || []).find((d: any) => d.id === documentId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found in this loan application.' });
    return;
  }

  res.json({
    ...doc,
    loanApplicationId: app.id,
    memberId: app.memberId,
    memberName: app.memberName
  });
});


apiRouter.post('/staff/verify-initial-share/:memberId', requirePermission('gcash_payments'), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  if (!tokenUser || (tokenUser.role !== 'STAFF' && tokenUser.role !== 'ADMIN')) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === req.params.memberId);
  
  if (!member) {
    res.status(404).json({ error: 'Member not found.' });
    return;
  }

  if (member.initialShareCapitalPaid && (member.shareCapital || 0) > 0) {
    res.status(200).json({
      message: 'Initial share capital has already been paid and verified for this member.',
      status: 'ALREADY_PROCESSED',
      officialReceiptNo: member.initialShareCapitalOfficialReceiptNo
    });
    return;
  }

  // Check if there's a pending payment submission for this member's initial share
  db.paymentRequests = db.paymentRequests || [];
  const matchingPaymentRequest = db.paymentRequests.find(p => 
    p.memberId === member.id && 
    (p.paymentType === 'INITIAL_SHARE' || p.paymentType === 'SHARE_CAPITAL') &&
    (p.status === 'PENDING_RECONCILIATION' || p.status === 'RECONCILED' || p.status === 'UNPAID')
  );

  let pledgedAmt = Number(member.initialShareCapitalPledged || 0);
  if (pledgedAmt <= 0 && matchingPaymentRequest && matchingPaymentRequest.amount > 0) {
    pledgedAmt = matchingPaymentRequest.amount;
  }
  if (pledgedAmt <= 0 && Number(member.initialShareCapital || 0) > 0) {
    pledgedAmt = Number(member.initialShareCapital);
  }
  if (pledgedAmt <= 0) pledgedAmt = 1000;

  const paymentMethod = member.initialShareCapitalPaymentMethod || matchingPaymentRequest?.paymentMethod || 'CASH';
  const gcashRef = member.initialShareCapitalReference || matchingPaymentRequest?.externalReference || '';
  const postingKeys = [
    `INITIAL_SHARE:${member.id}`,
    matchingPaymentRequest ? `PAYMENT_REQUEST:${matchingPaymentRequest.id}:POST` : '',
    gcashRef && gcashRef !== 'N/A' && gcashRef !== 'OFFICE-CASH' ? `GCASH_REF:${gcashRef}` : ''
  ].filter(Boolean);

  const postResult = CooperativeDB.postFinancialTransaction({
    postingKeys,
    paymentSource: 'INITIAL_SHARE_QUEUE',
    memberId: member.id,
    memberName: member.fullName,
    amount: pledgedAmt,
    postingType: 'SHARE_CAPITAL',
    postedBy: tokenUser.email,
    gcashRefNumber: gcashRef,
    executePosting: (currentDb) => {
      const targetMember = currentDb.members.find(m => m.id === member.id)!;
      targetMember.initialShareCapitalPaid = true;
      targetMember.shareCapital = Number(targetMember.shareCapital || 0) + pledgedAmt;

      const now = new Date().toISOString();
      currentDb.transactions = currentDb.transactions || [];
      const tx: Transaction = {
        id: 'tx_' + Math.random().toString(36).substring(2, 11),
        memberId: targetMember.id,
        memberName: targetMember.fullName,
        type: 'DEPOSIT',
        amount: pledgedAmt,
        description: `Initial Share Capital Contribution via ${paymentMethod}`,
        processedBy: tokenUser.email,
        createdAt: now,
        releaseMethod: paymentMethod
      };
      currentDb.transactions.unshift(tx);

      const receipt = createOfficialReceipt(currentDb, {
        memberId: targetMember.id,
        memberName: targetMember.fullName,
        memberNumber: targetMember.memberNumber || targetMember.id.substring(0, 8),
        paymentType: 'SHARE_CAPITAL',
        paymentMethod: paymentMethod as any,
        amount: pledgedAmt,
        paymentDate: now.split('T')[0],
        issuedBy: tokenUser.email,
        issuedById: tokenUser.id,
        transactionId: tx.id,
        internalReference: gcashRef ? `REF-${gcashRef}` : undefined,
        remarks: 'Initial Share Capital Subscription'
      });

      targetMember.initialShareCapitalOfficialReceiptNo = receipt.receiptNumber;

      // Synchronize matching Payment Request record so both queues converge
      if (matchingPaymentRequest) {
        matchingPaymentRequest.status = 'POSTED';
        matchingPaymentRequest.officialReceiptNo = receipt.receiptNumber;
        matchingPaymentRequest.reconciledBy = tokenUser.email;
        matchingPaymentRequest.reconciledAt = now;
        matchingPaymentRequest.reconciliationNotes = 'Verified & Approved via Initial Share Verification queue';
        matchingPaymentRequest.approvedBy = tokenUser.email;
        matchingPaymentRequest.approvedAt = now;
        matchingPaymentRequest.postedAt = now;
      } else {
        const newPr: PaymentRequest = {
          id: 'pr_initshare_' + member.id + '_' + Date.now().toString(36),
          memberId: member.id,
          memberName: member.fullName,
          paymentType: 'INITIAL_SHARE' as any,
          internalReference: `REF-INITSHARE-${Date.now().toString().slice(-6)}`,
          externalReference: gcashRef || (paymentMethod === 'CASH' ? 'OFFICE-CASH' : 'N/A'),
          amount: pledgedAmt,
          paymentDate: now.split('T')[0],
          remarks: `Initial Share Capital Contribution via ${paymentMethod}`,
          status: 'POSTED',
          paymentMethod: paymentMethod as any,
          officialReceiptNo: receipt.receiptNumber,
          createdAt: now,
          submittedAt: now,
          reconciledBy: tokenUser.email,
          reconciledAt: now,
          approvedBy: tokenUser.email,
          approvedAt: now,
          postedAt: now
        };
        currentDb.paymentRequests.unshift(newPr);
      }

      return {
        ledgerTransaction: tx,
        officialReceipt: receipt
      };
    }
  });

  if (!postResult.success) {
    if (postResult.isAlreadyProcessed) {
      res.status(200).json({
        message: 'Payment has already been verified and posted.',
        status: 'ALREADY_PROCESSED',
        officialReceiptNo: postResult.existingPosting?.officialReceiptNo
      });
      return;
    }
    res.status(400).json({ error: postResult.message || 'Failed to post financial transaction.' });
    return;
  }

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'VERIFY_INITIAL_SHARE',
    `Verified initial share capital payment for member ${member.fullName}. Credited ₱${pledgedAmt} to Share Capital. Generated OR: ${postResult.officialReceipt?.receiptNumber}`
  );

  res.json({ message: 'Initial share capital verified successfully.', member, officialReceiptNo: postResult.officialReceipt?.receiptNumber });
});

apiRouter.post('/staff/reject-initial-share/:memberId', requirePermission('gcash_payments'), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  if (!tokenUser || (tokenUser.role !== 'STAFF' && tokenUser.role !== 'ADMIN')) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === req.params.memberId);
  if (!member) {
    res.status(404).json({ error: 'Member not found.' });
    return;
  }

  const { rejectionReason } = req.body;
  const reason = rejectionReason || 'Payment details could not be verified.';

  member.initialShareCapitalPaymentMethod = undefined;
  member.initialShareCapitalReference = '';
  member.initialShareCapitalReceiptUrl = '';

  db.paymentRequests = db.paymentRequests || [];
  const matchingPaymentRequest = db.paymentRequests.find(p => 
    p.memberId === member.id && 
    (p.paymentType === 'INITIAL_SHARE' || p.paymentType === 'SHARE_CAPITAL') &&
    (p.status === 'PENDING_RECONCILIATION' || p.status === 'UNPAID')
  );
  if (matchingPaymentRequest) {
    matchingPaymentRequest.status = 'REJECTED';
    matchingPaymentRequest.rejectionReason = reason;
  }

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'REJECT_INITIAL_SHARE', `Rejected initial share capital payment for ${member.fullName}. Reason: ${reason}`);

  res.json({ message: 'Initial share payment rejected.', member });
});

apiRouter.post('/member/initial-share-payment', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  if (!tokenUser || tokenUser.role !== 'MEMBER') {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const { paymentMethod, reference, receiptUrl, proofImage, paymentProof, proofUrl, image, paymentScreenshot, proofAttachmentUrl, proofFileName, proofFileType } = req.body;
  if (!paymentMethod) {
    res.status(400).json({ error: 'Payment method is required.' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === tokenUser.id);
  if (!member) {
    res.status(404).json({ error: 'Member not found.' });
    return;
  }

  const resolvedProofUrl = receiptUrl || proofAttachmentUrl || proofImage || paymentProof || proofUrl || image || paymentScreenshot || member.initialShareCapitalReceiptUrl || '';

  member.initialShareCapitalPaymentMethod = paymentMethod;
  member.initialShareCapitalReference = reference || member.initialShareCapitalReference || '';
  member.initialShareCapitalReceiptUrl = resolvedProofUrl;
  member.initialShareCapitalPaid = false;

  db.paymentRequests = db.paymentRequests || [];
  const pledgedAmt = Number(member.initialShareCapitalPledged || member.initialShareCapital || 1000);
  const paymentRef = reference || member.initialShareCapitalReference || (paymentMethod === 'CASH' ? 'OFFICE-CASH' : 'N/A');

  let existingPaymentReq = db.paymentRequests.find(p =>
    p.memberId === member.id &&
    (p.paymentType === 'INITIAL_SHARE' || p.paymentType === 'SHARE_CAPITAL') &&
    (p.status === 'PENDING_RECONCILIATION' || p.status === 'UNPAID')
  );

  if (existingPaymentReq) {
    existingPaymentReq.paymentMethod = paymentMethod;
    existingPaymentReq.externalReference = paymentRef;
    existingPaymentReq.proofAttachmentUrl = resolvedProofUrl || existingPaymentReq.proofAttachmentUrl;
    existingPaymentReq.amount = pledgedAmt;
    existingPaymentReq.submittedAt = new Date().toISOString();
    existingPaymentReq.status = 'PENDING_RECONCILIATION';
    if (proofFileName) existingPaymentReq.proofFileName = proofFileName;
    if (proofFileType) existingPaymentReq.proofFileType = proofFileType;
  } else {
    const newPayment: PaymentRequest = {
      id: 'pr_initshare_' + member.id + '_' + Date.now().toString(36),
      memberId: member.id,
      memberName: member.fullName,
      paymentType: 'INITIAL_SHARE' as any,
      internalReference: `REF-INITSHARE-${Date.now().toString().slice(-6)}`,
      externalReference: paymentRef,
      amount: pledgedAmt,
      paymentDate: new Date().toISOString().split('T')[0],
      remarks: `Initial Share Capital Contribution via ${paymentMethod}`,
      proofAttachmentUrl: resolvedProofUrl,
      proofFileName: proofFileName || 'initial_share_receipt.png',
      proofFileType: proofFileType || 'image/png',
      status: 'PENDING_RECONCILIATION',
      paymentMethod: paymentMethod,
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString()
    };
    db.paymentRequests.unshift(newPayment);
  }

  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'INITIAL_SHARE_CAPITAL_SUBMITTED',
    `Submitted initial share capital payment details via ${paymentMethod}`
  );

  res.json({ message: 'Payment details submitted successfully. Awaiting verification by staff.' });
});

apiRouter.post('/documents/upload', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { fileName, fileType, documentCategory, fileDataUrl, fileSize } = req.body;

  if (!fileName || !fileDataUrl) {
    res.status(400).json({ error: 'File name and file content are required.' });
    return;
  }

  const db = CooperativeDB.load();
  if (!db.memberDocuments) db.memberDocuments = [];

  const member = db.members.find(m => m.id === tokenUser.id) || { fullName: tokenUser.email, id: tokenUser.id };
  const nowIso = new Date().toISOString();

  const newDoc: MemberDocument = {
    id: 'doc_' + Math.random().toString(36).substring(2, 11),
    memberId: tokenUser.id,
    memberName: member.fullName,
    fileName,
    fileType: fileType || 'application/octet-stream',
    documentCategory: documentCategory || 'OTHER',
    fileDataUrl,
    fileSize: fileSize || Math.round(fileDataUrl.length * 0.75),
    status: 'VERIFIED',
    uploadedAt: nowIso,
    updatedAt: nowIso
  };

  db.memberDocuments.unshift(newDoc);

  // Sync member profile shortcut URLs if applicable
  const fullMember = db.members.find(m => m.id === tokenUser.id);
  if (fullMember) {
    if (documentCategory === 'GOV_ID') {
      fullMember.govIdUrl = fileDataUrl;
      fullMember.govIdFileName = fileName;
    } else if (documentCategory === 'SELFIE') {
      fullMember.selfieUrl = fileDataUrl;
      fullMember.selfieFileName = fileName;
    } else if (documentCategory === 'INCOME_PROOF' || documentCategory === 'BILLING') {
      fullMember.supportingDocUrl = fileDataUrl;
      fullMember.supportingDocFileName = fileName;
    }

    if (fullMember.status === 'REVISION_REQUESTED' || fullMember.status === 'UNDER_REVIEW') {
      fullMember.status = 'PENDING';
      CooperativeDB.logAudit(
        tokenUser.id,
        tokenUser.email,
        tokenUser.role,
        'MEMBER_DOCUMENTS_RESUBMITTED',
        `Applicant ${fullMember.fullName} uploaded required document (${documentCategory}). Application returned to PENDING verification.`
      );
    }
  }

  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'DOCUMENT_UPLOAD',
    `Uploaded member document ${fileName} (${documentCategory})`
  );

  res.json({ message: 'Document uploaded successfully!', document: newDoc });
});

// Edit / Replace Document
apiRouter.put('/documents/:id', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { id } = req.params;
  const { fileName, fileType, documentCategory, fileDataUrl, fileSize } = req.body;

  if (!fileDataUrl) {
    res.status(400).json({ error: 'Replacement file content is required.' });
    return;
  }

  const db = CooperativeDB.load();
  if (!db.memberDocuments) db.memberDocuments = [];

  const doc = db.memberDocuments.find(d => d.id === id && (tokenUser.role !== 'MEMBER' || d.memberId === tokenUser.id));
  if (!doc) {
    res.status(404).json({ error: 'Document not found or unauthorized' });
    return;
  }

  // Check if membership is approved (read-only unless staff explicitly requested updated documents)
  const fullMember = db.members.find(m => m.id === doc.memberId);
  if (tokenUser.role === 'MEMBER' && fullMember && fullMember.status === 'ACTIVE' && !fullMember.additionalRequirementsRequested) {
    res.status(400).json({ error: 'Once membership is approved, registration documents become read-only and cannot be replaced unless updated documents are explicitly requested by staff.' });
    return;
  }

  // Check if document is locked in active loan application
  const activeLoans = (db.loanApplications || []).filter(l => l.memberId === doc.memberId && ['PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED', 'ACTIVE'].includes(l.status));
  const isLockedInLoan = activeLoans.some(l => l.documents?.some((d: any) => d.id === doc.id || d.fileName === doc.fileName));
  if (isLockedInLoan) {
    res.status(400).json({ error: 'Cannot replace document: This document is currently locked in an active or pending loan application verification.' });
    return;
  }

  const nowIso = new Date().toISOString();
  doc.fileName = fileName || doc.fileName;
  doc.fileType = fileType || doc.fileType;
  if (documentCategory) doc.documentCategory = documentCategory;
  doc.fileDataUrl = fileDataUrl;
  doc.fileSize = fileSize || Math.round(fileDataUrl.length * 0.75);
  doc.updatedAt = nowIso;
  doc.status = 'PENDING';

  // Sync member profile fields if applicable
  if (fullMember) {
    if (doc.documentCategory === 'GOV_ID') {
      fullMember.govIdUrl = fileDataUrl;
      fullMember.govIdFileName = doc.fileName;
    } else if (doc.documentCategory === 'SELFIE') {
      fullMember.selfieUrl = fileDataUrl;
      fullMember.selfieFileName = doc.fileName;
    } else if (doc.documentCategory === 'INCOME_PROOF' || doc.documentCategory === 'BILLING') {
      fullMember.supportingDocUrl = fileDataUrl;
      fullMember.supportingDocFileName = doc.fileName;
    }

    if (fullMember.status === 'REVISION_REQUESTED' || fullMember.status === 'UNDER_REVIEW') {
      fullMember.status = 'PENDING';
      CooperativeDB.logAudit(
        tokenUser.id,
        tokenUser.email,
        tokenUser.role,
        'MEMBER_DOCUMENTS_RESUBMITTED',
        `Applicant ${fullMember.fullName} updated document ${doc.fileName}. Application returned to PENDING verification.`
      );
    }
  }

  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'DOCUMENT_REPLACED',
    `Replaced document file for ${doc.fileName} (${doc.documentCategory})`
  );

  res.json({ message: 'Document replaced successfully!', document: doc });
});

apiRouter.delete('/documents/:id', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const { id } = req.params;
  const db = CooperativeDB.load();
  if (!db.memberDocuments) db.memberDocuments = [];

  const docIndex = db.memberDocuments.findIndex(d => d.id === id && (tokenUser.role !== 'MEMBER' || d.memberId === tokenUser.id));
  if (docIndex === -1) {
    res.status(404).json({ error: 'Document not found or unauthorized' });
    return;
  }

  const doc = db.memberDocuments[docIndex];

  // Lock check: check active loan applications
  const activeLoans = (db.loanApplications || []).filter(l => l.memberId === doc.memberId && ['PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED', 'ACTIVE'].includes(l.status));
  const isLockedInLoan = activeLoans.some(l => l.documents?.some((d: any) => d.id === doc.id || d.fileName === doc.fileName));
  if (isLockedInLoan) {
    res.status(400).json({ error: 'Deletion prohibited: This document is currently required for an active or under-review loan application.' });
    return;
  }

  const member = db.members.find(m => m.id === doc.memberId);
  if (tokenUser.role === 'MEMBER' && member && member.status === 'ACTIVE' && !member.additionalRequirementsRequested) {
    res.status(400).json({ error: 'Once membership is approved, registration documents become read-only and cannot be deleted unless updated documents are explicitly requested by staff.' });
    return;
  }

  const deleted = db.memberDocuments.splice(docIndex, 1)[0];

  if (member) {
    if (member.govIdUrl === deleted.fileDataUrl) {
      member.govIdUrl = '';
      member.govIdFileName = '';
    }
    if (member.selfieUrl === deleted.fileDataUrl) {
      member.selfieUrl = '';
      member.selfieFileName = '';
    }
    if (member.supportingDocUrl === deleted.fileDataUrl) {
      member.supportingDocUrl = '';
      member.supportingDocFileName = '';
    }
  }

  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'DOCUMENT_DELETE',
    `Deleted document ${deleted.fileName}`
  );

  res.json({ message: 'Document deleted successfully' });
});

// ============================================================================
// 12. ROLE ASSIGNMENT & PERMISSION MANAGEMENT API
// ============================================================================
apiRouter.post('/users/role', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { userId, newRole } = req.body;
  if (!userId || !newRole || !['ADMIN', 'STAFF', 'MEMBER'].includes(newRole)) {
    res.status(400).json({ error: 'User ID and valid new role (ADMIN, STAFF, MEMBER) are required' });
    return;
  }

  const db = CooperativeDB.load();
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'User account not found' });
    return;
  }

  const oldRole = user.role;
  user.role = newRole as Role;
  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'USER_ROLE_ASSIGNMENT',
    `Assigned role ${newRole} to user ${user.email} (previously ${oldRole})`
  );

  res.json({ message: `Role changed to ${newRole} successfully for ${user.email}`, user });
});

apiRouter.get('/permissions/my', (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const user = (req as AuthenticatedRequest).user!;
  const myPermissions = getUserEffectivePermissions(user, db);
  res.json({ myPermissions, role: user.role });
});

apiRouter.get('/permissions', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const user = (req as AuthenticatedRequest).user!;
  const myPermissions = getUserEffectivePermissions(user, db);
  const usersWithPermissions = (db.users || []).map(u => {
    let name = u.email;
    if (u.role === 'MEMBER') {
      const m = db.members.find(m => m.id === u.id);
      if (m) name = m.fullName;
    } else if (u.role === 'STAFF') {
      const s = db.staff.find(s => s.id === u.id);
      if (s) name = s.fullName;
    } else if (u.role === 'ADMIN') {
      name = `Admin (${u.email.split('@')[0]})`;
    }
    return {
      id: u.id,
      email: u.email,
      name,
      role: u.role,
      customPermissions: u.customPermissions || {}
    };
  });

  res.json({
    permissions: db.permissions || [],
    users: usersWithPermissions,
    myPermissions
  });
});

apiRouter.post('/permissions/update', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { permissions } = req.body;
  if (!Array.isArray(permissions)) {
    res.status(400).json({ error: 'Permissions array is required' });
    return;
  }

  const db = CooperativeDB.load();
  db.permissions = permissions;
  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'PERMISSIONS_UPDATE',
    `Updated system Role-Based Access Control (RBAC) matrix for ${permissions.length} modules`
  );

  res.json({ message: 'Permissions matrix updated successfully!', permissions: db.permissions });
});

apiRouter.post('/permissions/user-override', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { userId, customPermissions, overrides } = req.body;
  if (!userId) {
    res.status(400).json({ error: 'User ID is required' });
    return;
  }

  const db = CooperativeDB.load();
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) {
    res.status(404).json({ error: 'Target user not found' });
    return;
  }

  targetUser.customPermissions = (customPermissions !== undefined ? customPermissions : overrides) || {};
  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'USER_PERMISSION_OVERRIDE',
    `Updated custom module permission overrides for user ${targetUser.email} (${targetUser.role})`
  );

  res.json({
    message: `Custom permissions saved for ${targetUser.email}`,
    user: {
      id: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      customPermissions: targetUser.customPermissions
    }
  });
});

apiRouter.post('/permissions/reset', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  // Clear custom permissions on all users
  db.users.forEach(u => {
    delete u.customPermissions;
  });

  // Re-seed default permissions
  const freshDb = CooperativeDB.load();
  delete (db as any).permissions;
  CooperativeDB.save(db);
  const reloaded = CooperativeDB.load();

  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'PERMISSIONS_RESET',
    `Reset system RBAC permission matrix and user overrides to default values`
  );

  res.json({ message: 'Permission matrix and user overrides reset to system defaults!', permissions: reloaded.permissions });
});

// ============================================================================
// 13. SCHEDULED BACKUPS & RESTORE VALIDATION API
// ============================================================================
apiRouter.get('/backup/schedule', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json(db.scheduledBackupConfig);
});

apiRouter.post('/backup/schedule', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { enabled, frequency, retentionCount, autoDownload } = req.body;
  const db = CooperativeDB.load();

  db.scheduledBackupConfig = {
    enabled: Boolean(enabled),
    frequency: frequency || 'DAILY',
    retentionCount: Number(retentionCount) || 30,
    lastBackupAt: new Date().toISOString(),
    nextBackupAt: new Date(Date.now() + (frequency === 'WEEKLY' ? 7 : frequency === 'MONTHLY' ? 30 : 1) * 86400000).toISOString(),
    autoDownload: Boolean(autoDownload)
  };

  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    (req as AuthenticatedRequest).user!.id,
    (req as AuthenticatedRequest).user!.email,
    (req as AuthenticatedRequest).user!.role,
    'BACKUP_SCHEDULE_UPDATE',
    `Updated backup schedule: ${frequency} (enabled: ${enabled})`
  );

  res.json({ message: 'Backup schedule configuration saved!', config: db.scheduledBackupConfig });
});

apiRouter.post('/backup/validate-restore', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { backupJson } = req.body;
  if (!backupJson) {
    res.status(400).json({ valid: false, error: 'Backup JSON text payload is empty' });
    return;
  }

  try {
    const parsed = typeof backupJson === 'string' ? JSON.parse(backupJson) : backupJson;
    const requiredKeys = ['users', 'members', 'loanTypes', 'systemSettings'];
    const missingKeys = requiredKeys.filter(k => !(k in parsed));

    if (missingKeys.length > 0) {
      res.json({
        valid: false,
        error: `Restore validation failed: Missing structural keys (${missingKeys.join(', ')})`
      });
      return;
    }

    res.json({
      valid: true,
      message: 'Restore validation passed! Database payload schema is valid.',
      summary: {
        usersCount: parsed.users?.length || 0,
        membersCount: parsed.members?.length || 0,
        loansCount: parsed.loans?.length || 0,
        transactionsCount: parsed.transactions?.length || 0
      }
    });
  } catch (err: any) {
    res.json({ valid: false, error: `JSON Parse error: ${err.message}` });
  }
});

// ============================================================================
// 14. ADMIN COMPREHENSIVE REPORTS API
// ============================================================================
apiRouter.get('/reports/all', requireRole(['ADMIN', 'STAFF']), requirePermission('reports'), (req: Request, res: Response) => {
  const db = CooperativeDB.load();

  const totalMembers = db.members.length;
  const activeMembers = db.members.filter(m => m.status === 'ACTIVE').length;

  const totalShareCapital = db.members.reduce((sum, m) => sum + m.shareCapital, 0);
  const totalRegularSavings = db.members.reduce((sum, m) => sum + m.regularSavings, 0);
  const totalTimeDeposits = db.members.reduce((sum, m) => sum + m.timeDeposits, 0);
  const totalSavings = totalShareCapital + totalRegularSavings + totalTimeDeposits;

  const activeLoans = db.loans.filter(l => l.status === 'ACTIVE');
  const totalLoansOutstanding = activeLoans.reduce((sum, l) => sum + l.balance, 0);
  const totalLoansDisbursed = db.loans.reduce((sum, l) => sum + l.principalAmount, 0);

  const totalDividendsDistributed = db.memberDividends.reduce((sum, d) => sum + d.dividendAmount, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    cooperativeName: db.systemSettings.cooperativeName,
    financialSummary: {
      totalCooperativeAssets: totalSavings + totalLoansOutstanding,
      totalSavingsPool: totalSavings,
      totalShareCapital,
      totalRegularSavings,
      totalTimeDeposits,
      totalLoansOutstanding,
      totalLoansDisbursed,
      totalDividendsDistributed,
      totalMembers,
      activeMembers
    },
    memberSavingsReport: db.members.map(m => ({
      memberId: m.id,
      fullName: m.fullName,
      email: m.email,
      phone: m.phone,
      status: m.status,
      shareCapital: m.shareCapital,
      regularSavings: m.regularSavings,
      timeDeposits: m.timeDeposits,
      totalAssets: m.shareCapital + m.regularSavings + m.timeDeposits
    })),
    loanPortfolioReport: db.loans.map(l => ({
      loanId: l.id,
      memberName: l.memberName,
      loanType: l.loanTypeName,
      principal: l.principalAmount,
      balance: l.balance,
      monthlyAmortization: l.monthlyAmortization,
      status: l.status,
      dueDate: l.dueDate || 'N/A'
    })),
    dividendsReport: db.dividendPeriods.map(p => ({
      periodId: p.id,
      year: p.year,
      totalNetSurplus: p.totalNetSurplus,
      dividendRate: p.dividendRate,
      status: p.status
    }))
  };

  res.json(report);
});

// ============================================================================
// 15. DESCRIPTIVE ANALYTICS API (LIVE PRODUCTION DATABASE DATA ONLY)
// ============================================================================
apiRouter.get('/analytics/descriptive', requireRole(['ADMIN', 'STAFF']), requirePermission('analytics'), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const todayStr = new Date().toISOString().substring(0, 10);
  const currentMonthStr = new Date().toISOString().substring(0, 7);

  const {
    startDate,
    endDate,
    memberType,
    loanProduct,
    savingsProduct,

    staffId,
    cashierId,
    status
  } = req.query as Record<string, string>;

  // Helper date check
  const inDateRange = (dateStr?: string) => {
    if (!dateStr) return true;
    const d = dateStr.substring(0, 10);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // Filtered members
  const members = db.members.filter(m => {
    if (!inDateRange(m.createdAt)) return false;
    if (memberType && memberType !== 'ALL' && m.memberType !== memberType) return false;
    if (status && status !== 'ALL' && m.status !== status) return false;
    return true;
  });

  // Filtered loan applications
  const loanApplications = db.loanApplications.filter(a => {
    if (!inDateRange(a.createdAt)) return false;
    if (status && status !== 'ALL' && a.status !== status) return false;
    if (loanProduct && loanProduct !== 'ALL') {
      const lt = db.loanTypes.find(type => type.id === a.loanTypeId);
      if (lt && lt.name !== loanProduct) return false;
    }
    return true;
  });

  // Filtered loans
  const loans = db.loans.filter(l => {
    if (!inDateRange(l.createdAt)) return false;
    if (status && status !== 'ALL' && l.status !== status) return false;
    if (loanProduct && loanProduct !== 'ALL' && l.loanTypeName !== loanProduct) return false;
    return true;
  });

  // Filtered transactions
  const transactions = db.transactions.filter(t => {
    if (!inDateRange(t.createdAt)) return false;
    if (cashierId && cashierId !== 'ALL' && t.processedBy !== cashierId) return false;
    if (savingsProduct && savingsProduct !== 'ALL') {
      const desc = (t.description || '').toLowerCase();
      if (savingsProduct === 'Share Capital' && !desc.includes('share capital')) return false;
      if (savingsProduct === 'Regular Savings' && !desc.includes('regular')) return false;
      if (savingsProduct === 'Time Deposit' && !desc.includes('time deposit')) return false;
    }
    return true;
  });

  // 1. Membership Analytics
  const totalRegisteredMembers = members.length;
  const activeMembers = members.filter(m => m.status === 'ACTIVE').length;
  const pendingRegistrations = members.filter(m => m.status === 'PENDING' || m.status === 'UNDER_REVIEW').length;
  const suspendedOrDeactivatedMembers = members.filter(m => m.status === 'SUSPENDED' || m.status === 'DEACTIVATED').length;
  const approvedMembers = activeMembers;
  const rejectedApplications = members.filter(m => m.status === 'REJECTED').length;

  const growthMap: Record<string, number> = {};
  members.forEach(m => {
    const month = (m.createdAt || todayStr).substring(0, 7);
    growthMap[month] = (growthMap[month] || 0) + 1;
  });
  const membershipGrowthTrend = Object.keys(growthMap).sort().map(month => ({
    month,
    count: growthMap[month]
  }));

  const ageBuckets = { 'Under 25': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Unspecified': 0 };
  const currentYear = new Date().getFullYear();
  members.forEach(m => {
    if (m.birthdate) {
      const birthYear = new Date(m.birthdate).getFullYear();
      const age = currentYear - birthYear;
      if (age < 25) ageBuckets['Under 25']++;
      else if (age <= 34) ageBuckets['25-34']++;
      else if (age <= 44) ageBuckets['35-44']++;
      else if (age <= 54) ageBuckets['45-54']++;
      else if (age >= 55) ageBuckets['55+']++;
      else ageBuckets['Unspecified']++;
    } else {
      ageBuckets['Unspecified']++;
    }
  });
  const ageDistribution = Object.entries(ageBuckets).map(([range, count]) => ({ range, count }));

  const genderMap: Record<string, number> = {};
  members.forEach(m => {
    const g = m.gender ? (m.gender.charAt(0).toUpperCase() + m.gender.slice(1).toLowerCase()) : 'Unspecified';
    genderMap[g] = (genderMap[g] || 0) + 1;
  });
  const genderDistribution = Object.entries(genderMap).map(([gender, count]) => ({ gender, count }));

  // 2. Savings Analytics
  const totalShareCapital = members.reduce((sum, m) => sum + (m.shareCapital || 0), 0);
  const totalRegularSavings = members.reduce((sum, m) => sum + (m.regularSavings || 0), 0);
  const totalTimeDeposits = members.reduce((sum, m) => sum + (m.timeDeposits || 0), 0);
  const totalSavingsBalance = totalShareCapital + totalRegularSavings + totalTimeDeposits;

  const depositTransactions = transactions.filter(t => t.type === 'DEPOSIT');
  const withdrawalTransactions = transactions.filter(t => t.type === 'WITHDRAWAL');
  const totalDeposits = depositTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = withdrawalTransactions.reduce((sum, t) => sum + t.amount, 0);

  const savingsTrendMap: Record<string, { deposits: number; withdrawals: number; net: number }> = {};
  transactions.forEach(t => {
    if (t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL') {
      const m = (t.createdAt || todayStr).substring(0, 7);
      if (!savingsTrendMap[m]) savingsTrendMap[m] = { deposits: 0, withdrawals: 0, net: 0 };
      if (t.type === 'DEPOSIT') {
        savingsTrendMap[m].deposits += t.amount;
        savingsTrendMap[m].net += t.amount;
      } else {
        savingsTrendMap[m].withdrawals += t.amount;
        savingsTrendMap[m].net -= t.amount;
      }
    }
  });
  const savingsGrowthTrend = Object.keys(savingsTrendMap).sort().map(month => ({
    month,
    deposits: savingsTrendMap[month].deposits,
    withdrawals: savingsTrendMap[month].withdrawals,
    netGrowth: savingsTrendMap[month].net
  }));

  // 3. Share Capital Analytics
  const paidShareCapital = totalShareCapital;
  const minRequiredShareCapital = (db.systemSettings.minimumShareCapital || 10000) * (activeMembers || 1);
  const outstandingShareCapital = Math.max(0, minRequiredShareCapital - paidShareCapital);

  const shareCapitalTrendMap: Record<string, number> = {};
  transactions.filter(t => t.type === 'DEPOSIT' && (t.description || '').toLowerCase().includes('share capital')).forEach(t => {
    const month = (t.createdAt || todayStr).substring(0, 7);
    shareCapitalTrendMap[month] = (shareCapitalTrendMap[month] || 0) + t.amount;
  });
  const shareCapitalGrowth = Object.keys(shareCapitalTrendMap).sort().map(month => ({
    month,
    amount: shareCapitalTrendMap[month]
  }));

  // 4. Loan Analytics
  const totalLoanApplications = loanApplications.length;
  const approvedLoans = loanApplications.filter(a => a.status === 'APPROVED').length;
  const pendingLoans = loanApplications.filter(a => a.status === 'PENDING_REVIEW' || a.status === 'UNDER_REVIEW').length;
  const rejectedLoans = loanApplications.filter(a => a.status === 'REJECTED').length;
  const releasedLoans = loans.length;
  const activeLoansList = loans.filter(l => l.status === 'ACTIVE');
  const outstandingLoanPortfolio = activeLoansList.reduce((sum, l) => sum + l.balance, 0);

  const totalPaymentsCollected = db.loanPayments.filter(p => inDateRange(p.paymentDate)).reduce((sum, p) => sum + p.amount, 0);
  const totalRepayableAllLoans = loans.reduce((sum, l) => sum + l.totalRepayable, 0);
  const loanCollectionPerformance = totalRepayableAllLoans > 0 
    ? Math.min(100, Math.round((totalPaymentsCollected / totalRepayableAllLoans) * 100))
    : 100;

  const delinquentLoans = activeLoansList.filter(l => l.dueDate && l.dueDate < todayStr && l.balance > 0).length;
  const loanDelinquencyRate = activeLoansList.length > 0 
    ? parseFloat(((delinquentLoans / activeLoansList.length) * 100).toFixed(1)) 
    : 0;

  // Approval rate counts both currently approved and already released/disbursed as positive approvals
  const totalApprovedApplications = loanApplications.filter(a => a.status === 'APPROVED' || a.status === 'DISBURSED').length;
  const loanApprovalRate = totalLoanApplications > 0 
    ? parseFloat(((totalApprovedApplications / totalLoanApplications) * 100).toFixed(1)) 
    : 0;

  // 5. Financial Analytics
  const cashIn = db.transactions.filter(t => (['DEPOSIT', 'LOAN_PAYMENT'] as string[]).includes(t.type) && inDateRange(t.createdAt)).reduce((sum, t) => sum + t.amount, 0);
  const cashOut = db.transactions.filter(t => (['WITHDRAWAL', 'LOAN_RELEASE'] as string[]).includes(t.type) && inDateRange(t.createdAt)).reduce((sum, t) => sum + t.amount, 0);
  const cashBalance = Math.max(0, cashIn - cashOut);

  const totalAssets = cashBalance + outstandingLoanPortfolio;
  const totalLiabilities = totalRegularSavings + totalTimeDeposits;

  const totalFeesCollected = transactions.filter(t => (t.type as string) === 'FEE').reduce((sum, t) => sum + t.amount, 0);
  const totalInterestEarned = loans.reduce((sum, l) => sum + l.interestAmount, 0);
  const revenue = totalInterestEarned + totalFeesCollected;
  const expenses = 0; // Assuming no operational expenses recorded in DB yet
  const netIncome = revenue - expenses;
  const totalEquity = totalShareCapital + netIncome;

  // 6. Cashier Analytics
  // Compute based on the DB without relying on global date filters for Today/Month KPIs
  const cashierFilteredTx = db.transactions.filter(t => {
    if (cashierId && cashierId !== 'ALL' && t.processedBy !== cashierId) return false;
    return true;
  });

  const todayTransactions = cashierFilteredTx.filter(t => (t.createdAt || '').substring(0, 10) === todayStr);
  const monthTransactions = cashierFilteredTx.filter(t => (t.createdAt || '').substring(0, 7) === currentMonthStr);
  
  const dailyTransactionsCount = todayTransactions.length;
  const dailyTransactionsVolume = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
  const monthlyTransactionsCount = monthTransactions.length;
  const monthlyTransactionsVolume = monthTransactions.reduce((sum, t) => sum + t.amount, 0);

  const collectionsList = todayTransactions.filter(t => t.type === 'DEPOSIT' || t.type === 'LOAN_PAYMENT');
  const totalCollections = collectionsList.reduce((sum, t) => sum + t.amount, 0);

  // 7. Dividend Analytics
  const totalDividendsDeclared = db.dividendPeriods.reduce((sum, p) => sum + (p.totalNetSurplus * p.dividendRate), 0);
  const dividendsDistributed = db.memberDividends.reduce((sum, d) => sum + d.dividendAmount, 0);

  // 8. Inquiry Analytics
  const totalInquiries = db.inquiries.filter(i => inDateRange(i.createdAt)).length;
  const pendingInquiries = db.inquiries.filter(i => inDateRange(i.createdAt) && (i.status === 'OPEN' || i.status === 'IN_PROGRESS')).length;
  const resolvedInquiries = db.inquiries.filter(i => inDateRange(i.createdAt) && i.status === 'RESOLVED').length;

  // 9. Notification Analytics
  const smsList = (db.smsNotifications || []).filter(s => inDateRange(s.sentAt || s.createdAt));
  const smsSent = smsList.filter(s => s.status === 'Sent' || s.status === 'Delivered').length;
  const smsDelivered = smsList.filter(s => s.status === 'Delivered').length;
  const smsFailed = smsList.filter(s => s.status === 'Failed').length;
  const notificationSuccessRate = smsList.length > 0 
    ? parseFloat(((smsSent / smsList.length) * 100).toFixed(1)) 
    : 100;

  // 10. Audit Analytics
  const auditList = (db.auditLogs || []).filter(a => inDateRange(a.createdAt));
  if (staffId && staffId !== 'ALL') {
    // filter audit by staff/user
  }
  const loginAuditLogs = auditList.filter(a => a.action.includes('LOGIN') || a.action.includes('AUTH'));
  
  const loginTrendMap: Record<string, number> = {};
  loginAuditLogs.forEach(a => {
    const d = (a.createdAt || todayStr).substring(0, 10);
    loginTrendMap[d] = (loginTrendMap[d] || 0) + 1;
  });
  const userLoginTrends = Object.keys(loginTrendMap).sort().slice(-14).map(date => ({
    date,
    count: loginTrendMap[date]
  }));

  const activityActionMap: Record<string, number> = {};
  auditList.forEach(a => {
    const act = a.action || 'OTHER';
    activityActionMap[act] = (activityActionMap[act] || 0) + 1;
  });
  const userActivitySummary = Object.entries(activityActionMap).map(([action, count]) => ({ action, count }));

  const userCountMap: Record<string, { email: string; role: string; count: number }> = {};
  auditList.forEach(a => {
    if (!userCountMap[a.userId]) {
      userCountMap[a.userId] = { email: a.userEmail, role: a.userRole, count: 0 };
    }
    userCountMap[a.userId].count++;
  });
  const mostActiveUsers = Object.values(userCountMap).sort((a, b) => b.count - a.count).slice(0, 10);

  // Dropdown filter options metadata
  const filterOptions = {
    memberTypes: ['REGULAR', 'ASSOCIATE', 'SENIOR', 'HONORARY'],
    loanProducts: db.loanTypes.map(lt => lt.name),
    savingsProducts: ['Share Capital', 'Regular Savings', 'Time Deposit', 'Youth Savings'],
    shareCapitalProducts: ['Common Share Capital', 'Preferred Shares', 'Minimum Required Shares'],
    staffList: db.users.filter(u => u.role === 'STAFF' || u.role === 'ADMIN').map(u => ({ id: u.id, email: u.email, role: u.role })),
    cashierList: db.users.map(u => ({ id: u.id, email: u.email, role: u.role })),
    statuses: ['ACTIVE', 'PENDING', 'APPROVED', 'DISBURSED', 'COMPLETED', 'OVERDUE', 'REJECTED']
  };

  // Additional read-only metrics from existing DB collections for Descriptive Analytics
  const tokenUser = (req as AuthenticatedRequest).user!;
  const activeMembersWithSavings = members.filter(m => m.status === 'ACTIVE' && (m.regularSavings || 0) > 0).length;
  const savingsParticipationRate = activeMembers > 0 ? Number(((activeMembersWithSavings / activeMembers) * 100).toFixed(1)) : 0;
  const initialSharePaidCount = members.filter(m => m.status === 'ACTIVE' && (m.initialShareCapitalPaid || (m.shareCapital || 0) > 0)).length;
  const initialShareUnpaidCount = Math.max(0, activeMembers - initialSharePaidCount);
  const averageShareCapitalPerActiveMember = activeMembers > 0 ? Number((totalShareCapital / activeMembers).toFixed(2)) : 0;

  // Time Deposits metrics
  const tdContracts = (db.timeDepositContracts || []).filter(td => inDateRange(td.openingDate || td.createdAt));
  const activeTimeDepositsCount = tdContracts.filter(td => td.status === 'ACTIVE').length;
  const maturedTimeDepositsCount = tdContracts.filter(td => td.status === 'MATURED').length;
  const tdTrendMap: Record<string, number> = {};
  tdContracts.forEach(td => {
    const m = (td.openingDate || td.createdAt || todayStr).substring(0, 7);
    tdTrendMap[m] = (tdTrendMap[m] || 0) + (td.principalAmount || 0);
  });
  const placementTrend = Object.keys(tdTrendMap).sort().map(period => ({
    period,
    value: tdTrendMap[period]
  }));

  // Loan repayment & overdue metrics
  const delinquentLoansList = activeLoansList.filter(l => l.dueDate && l.dueDate < todayStr && l.balance > 0);
  const overdueLoanBalance = delinquentLoansList.reduce((sum, l) => sum + (l.balance || 0), 0);
  const activeBorrowersCount = new Set(activeLoansList.map(l => l.memberId)).size;
  const repaymentTrendMap: Record<string, number> = {};
  db.loanPayments.filter(p => inDateRange(p.paymentDate)).forEach(p => {
    const m = (p.paymentDate || todayStr).substring(0, 7);
    repaymentTrendMap[m] = (repaymentTrendMap[m] || 0) + (p.amount || 0);
  });
  const repaymentTrend = Object.keys(repaymentTrendMap).sort().map(month => ({
    month,
    amount: repaymentTrendMap[month]
  }));

  // Revenue & Transaction monthly trends
  const revenueTrendMap: Record<string, number> = {};
  loans.forEach(l => {
    const m = (l.disbursedAt || l.createdAt || todayStr).substring(0, 7);
    revenueTrendMap[m] = (revenueTrendMap[m] || 0) + (l.interestAmount || 0);
  });
  transactions.filter(t => (t.type as string) === 'FEE').forEach(t => {
    const m = (t.createdAt || todayStr).substring(0, 7);
    revenueTrendMap[m] = (revenueTrendMap[m] || 0) + (t.amount || 0);
  });
  const revenueTrend = Object.keys(revenueTrendMap).sort().map(month => ({
    month,
    revenue: revenueTrendMap[month]
  }));

  const txTrendMap: Record<string, number> = {};
  cashierFilteredTx.forEach(t => {
    const m = (t.createdAt || todayStr).substring(0, 7);
    txTrendMap[m] = (txTrendMap[m] || 0) + 1;
  });
  const transactionTrend = Object.keys(txTrendMap).sort().map(month => ({
    month,
    count: txTrendMap[month]
  }));

  const gcashTransactionsCount = transactions.filter(t => (t.releaseMethod || '').toUpperCase() === 'GCASH').length;
  const pendingPaymentRequestsCount = (db.paymentRequests || []).filter(p => p.status === 'PENDING_RECONCILIATION').length;

  // Pricing / Loan Rate metrics
  const loanTypesList = db.loanTypes || [];
  const averageLoanInterestRatePct = loanTypesList.length > 0
    ? Number(((loanTypesList.reduce((sum, lt) => sum + (lt.interestRate || 0), 0) / loanTypesList.length) * 100).toFixed(2))
    : 0;

  const basePayload = {
    generatedAt: new Date().toISOString(),
    cooperativeName: db.systemSettings.cooperativeName,
    filterOptions,
    membershipAnalytics: {
      totalRegisteredMembers,
      activeMembers,
      pendingRegistrations,
      suspendedOrDeactivatedMembers,
      approvedMembers,
      rejectedApplications,
      membershipGrowthTrend,
      ageDistribution,
      genderDistribution
    },
    savingsAnalytics: {
      totalSavingsBalance,
      totalRegularSavings,
      totalTimeDeposits,
      totalDeposits,
      totalWithdrawals,
      savingsParticipationRate,
      savingsGrowthTrend
    },
    shareCapitalAnalytics: {
      totalShareCapital,
      paidShareCapital,
      outstandingShareCapital,
      averageShareCapitalPerActiveMember,
      initialSharePaidCount,
      initialShareUnpaidCount,
      shareCapitalGrowth
    },
    timeDepositAnalytics: {
      totalTimeDepositPrincipal: totalTimeDeposits,
      activeTimeDepositsCount,
      maturedTimeDepositsCount,
      newPlacementsCount: tdContracts.length,
      placementTrend
    },
    loanAnalytics: {
      totalLoanApplications,
      approvedLoans,
      pendingLoans,
      rejectedLoans,
      releasedLoans,
      outstandingLoanPortfolio,
      loanCollectionPerformance,
      loanDelinquencyRate,
      loanApprovalRate,
      delinquentLoansCount: delinquentLoans,
      overdueLoanBalance,
      activeBorrowersCount,
      totalPaymentsCollected,
      repaymentTrend
    },
    financialAnalytics: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      revenue,
      interestIncome: totalInterestEarned,
      feeIncome: totalFeesCollected,
      expenses,
      netIncome,
      revenueTrend
    },
    cashierAnalytics: {
      dailyTransactionsCount,
      dailyTransactionsVolume,
      monthlyTransactionsCount,
      monthlyTransactionsVolume,
      totalCollections,
      gcashTransactionsCount,
      pendingPaymentRequestsCount,
      transactionTrend
    },
    pricingAnalytics: {
      loanProductsCount: loanTypesList.length,
      averageLoanInterestRatePct,
      costDataAvailable: false
    },
    dividendAnalytics: {
      totalDividendsDeclared,
      dividendsDistributed
    },
    inquiryAnalytics: {
      totalInquiries,
      pendingInquiries,
      resolvedInquiries
    },
    notificationAnalytics: {
      smsSent,
      smsDelivered,
      smsFailed,
      notificationSuccessRate
    },
    auditAnalytics: {
      userLoginTrends,
      userActivitySummary,
      mostActiveUsers
    }
  };

  const descriptiveAnalysis = generateDescriptiveAnalysis(
    basePayload,
    tokenUser.role === 'STAFF' ? 'STAFF' : 'ADMIN'
  );

  res.json({
    ...basePayload,
    descriptiveAnalysis
  });
});

// ============================================================================
// 15.1 OPERATIONAL ANALYTICS API (STAFF DAILY WORKLOAD)
// ============================================================================
apiRouter.get('/analytics/operational', requireRole(['ADMIN', 'STAFF']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const todayStr = new Date().toISOString().substring(0, 10);

  // Helper date check for "Today"
  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    return dateStr.substring(0, 10) === todayStr;
  };

  // Member Operations
  const pendingRegistrations = db.members.filter(m => m.status === 'PENDING').length;
  const approvedToday = db.members.filter(m => m.status === 'ACTIVE' && isToday(m.verifiedAt || m.createdAt)).length;
  const pendingInitialSharePayments = db.members.filter(m => m.status === 'ACTIVE' && m.shareCapital === 0).length; // Rough approximation for pending initial share
  const pendingGCashVerifications = db.transactions.filter(t => t.releaseMethod === 'GCASH' && t.description.includes('Pending Verification')).length; // Adjust based on actual data structure, or just GCash receipts pending
  
  // Actually, we have GCash payments? Let's check receipts.
  const gcashReceiptsPending = (db.officialReceipts || []).filter(r => r.paymentMethod === 'GCASH' && (r.status as string) === 'PENDING').length;
  const gcashVerifiedToday = (db.officialReceipts || []).filter(r => r.paymentMethod === 'GCASH' && r.status === 'ISSUED' && isToday(r.issuedAt)).length;
  const gcashFailedVerifications = (db.officialReceipts || []).filter(r => r.paymentMethod === 'GCASH' && r.status === 'VOIDED' && isToday(r.voidedAt)).length;

  // Loan Operations
  const pendingApplications = db.loanApplications.filter(a => a.status === 'PENDING_REVIEW').length;
  const underReview = db.loanApplications.filter(a => a.status === 'UNDER_REVIEW').length;
  const waitingForRelease = db.loanApplications.filter(a => a.status === 'WAITING_FOR_RELEASE').length;
  const releasedToday = db.loans.filter(l => l.status === 'ACTIVE' && isToday(l.createdAt)).length;

  // Cashier Operations
  const todayTransactions = db.transactions.filter(t => isToday(t.createdAt));
  const cashDepositsToday = todayTransactions.filter(t => t.type === 'DEPOSIT' && t.releaseMethod === 'CASH').reduce((sum, t) => sum + t.amount, 0);
  const savingsDepositsToday = todayTransactions.filter(t => t.type === 'DEPOSIT' && (t.description || '').toLowerCase().includes('savings')).reduce((sum, t) => sum + t.amount, 0);
  const shareCapitalPaymentsToday = todayTransactions.filter(t => t.type === 'DEPOSIT' && (t.description || '').toLowerCase().includes('share capital')).reduce((sum, t) => sum + t.amount, 0);
  const withdrawalsProcessedToday = todayTransactions.filter(t => t.type === 'WITHDRAWAL').reduce((sum, t) => sum + t.amount, 0);
  const totalCounterCollectionsToday = todayTransactions.filter(t => (t.type === 'DEPOSIT' || t.type === 'LOAN_PAYMENT') && t.releaseMethod === 'CASH').reduce((sum, t) => sum + t.amount, 0);

  // Daily Summary
  const totalTransactionsToday = todayTransactions.length;
  const totalCashReceivedToday = todayTransactions.filter(t => t.type === 'DEPOSIT' || t.type === 'LOAN_PAYMENT').reduce((sum, t) => sum + t.amount, 0);
  const totalCashReleasedToday = todayTransactions.filter(t => t.type === 'WITHDRAWAL' || t.type === 'LOAN_RELEASE').reduce((sum, t) => sum + t.amount, 0);
  const officialReceiptsIssuedToday = (db.officialReceipts || []).filter(r => r.status === 'ISSUED' && isToday(r.issuedAt)).length;

  // Member Support
  const pendingInquiries = db.inquiries.filter(i => i.status === 'OPEN' || i.status === 'IN_PROGRESS').length;
  const resolvedToday = db.inquiries.filter(i => i.status === 'RESOLVED' && isToday(i.createdAt)).length;
  const pendingSmsNotifications = (db.notifications || []).filter(n => !n.isRead).length;

  const pendingGcashRequests = (db.paymentRequests || []).filter(p => p.paymentMethod === 'GCASH' && p.status === 'PENDING_RECONCILIATION').length;
  const effectivePendingGcash = Math.max(gcashReceiptsPending, pendingGcashRequests);

  const opPayload = {
    memberOperations: {
      pendingRegistrations,
      approvedToday,
      pendingInitialSharePayments,
      pendingGCashVerifications: effectivePendingGcash
    },
    loanOperations: {
      pendingApplications,
      underReview,
      waitingForRelease,
      releasedToday
    },
    cashierOperations: {
      cashDepositsToday,
      savingsDepositsToday,
      shareCapitalPaymentsToday,
      withdrawalsProcessedToday,
      totalCounterCollectionsToday
    },
    gcashOperations: {
      pendingVerifications: effectivePendingGcash,
      verifiedToday: gcashVerifiedToday,
      failedVerifications: gcashFailedVerifications
    },
    dailySummary: {
      totalTransactionsToday,
      totalCashReceivedToday,
      totalCashReleasedToday,
      officialReceiptsIssuedToday
    },
    memberSupport: {
      pendingInquiries,
      resolvedToday,
      pendingSmsNotifications
    }
  };

  res.json({
    ...opPayload,
    descriptiveAnalysis: generateOperationalDescriptiveAnalysis(opPayload)
  });
});

// ============================================================================

// Get GCash Configuration
apiRouter.get('/gcash/config', (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  if (!db.systemSettings.gcashConfig) {
    db.systemSettings.gcashConfig = {
      enabled: true, accountName: 'CCT COOPERATIVE INC.',
      
      mobileNumber: '0917-888-2288',
      qrCodeUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%230052cc"/><rect x="18" y="18" width="264" height="264" rx="20" fill="white"/><text x="150" y="52" font-family="sans-serif" font-weight="bold" font-size="20" fill="%230052cc" text-anchor="middle">GCash QR Payment</text><text x="150" y="72" font-family="sans-serif" font-weight="600" font-size="12" fill="%23444444" text-anchor="middle">CCT COOPERATIVE INC.</text><rect x="45" y="85" width="210" height="155" rx="12" fill="%23f0f4ff" stroke="%230052cc" stroke-width="2"/><g fill="%230052cc"><rect x="60" y="100" width="45" height="45"/><rect x="70" y="110" width="25" height="25" fill="white"/><rect x="195" y="100" width="45" height="45"/><rect x="205" y="110" width="25" height="25" fill="white"/><rect x="60" y="180" width="45" height="45"/><rect x="70" y="190" width="25" height="25" fill="white"/><rect x="120" y="100" width="15" height="15"/><rect x="145" y="100" width="15" height="15"/><rect x="165" y="100" width="15" height="15"/><rect x="120" y="125" width="30" height="20"/><rect x="160" y="125" width="20" height="20"/><rect x="115" y="152" width="70" height="20"/><rect x="120" y="180" width="20" height="30"/><rect x="150" y="180" width="35" height="15"/><rect x="195" y="180" width="20" height="35"/><rect x="220" y="195" width="15" height="20"/></g><text x="150" y="262" font-family="monospace" font-weight="bold" font-size="14" fill="%230052cc" text-anchor="middle">0917-888-2288</text><text x="150" y="278" font-family="sans-serif" font-size="10" fill="%23666666" text-anchor="middle">Scan with GCash App</text></svg>',
      instructions: '1. Open GCash app and tap "QR" or "Send Money".\n2. Scan this QR Code or send directly to 0917-888-2288.\n3. Input the exact Amount Due and Payment Reference Number.\n4. Take a screenshot or save the GCash transaction receipt.\n5. Upload the proof of payment file below and enter your 13-digit GCash Reference Number.'
    };
    CooperativeDB.save(db);
  }
  res.json(db.systemSettings.gcashConfig);
});

// Update GCash Configuration (Admin only)
apiRouter.put('/gcash/config', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { enabled, accountName, mobileNumber, qrCodeUrl, instructions } = req.body;
  const db = CooperativeDB.load();

  if (!accountName || !mobileNumber) {
    res.status(400).json({ error: 'Account name and mobile number are required.' });
    return;
  }

  const currentConfig = db.systemSettings.gcashConfig || {
    enabled: true, accountName: 'CCT COOPERATIVE INC.',
    
    mobileNumber: '0917-888-2288',
    qrCodeUrl: '',
    instructions: ''
  };

  const newConfig = {
    enabled: typeof enabled === 'boolean' ? enabled : currentConfig.enabled,
    accountName: accountName.trim(),
    mobileNumber: mobileNumber.trim(),
    qrCodeUrl: qrCodeUrl !== undefined ? qrCodeUrl : currentConfig.qrCodeUrl,
    instructions: instructions !== undefined ? instructions : currentConfig.instructions
  };

  db.systemSettings.gcashConfig = newConfig;

  CooperativeDB.save(db);

  const tokenUser = (req as AuthenticatedRequest).user!;
  
  // Find admin name
  const adminProfile = db.staff.find(s => s.id === tokenUser.id) || { fullName: 'Administrator' };

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'GCASH_CONFIG_UPDATED',
    `Updated GCash Settings by ${adminProfile.fullName}. Previous Number: ${currentConfig.mobileNumber}, New Number: ${newConfig.mobileNumber}, Previous Name: ${currentConfig.accountName}, New Name: ${newConfig.accountName}, Previous Enabled: ${currentConfig.enabled}, New Enabled: ${newConfig.enabled}`
  );

  res.json({ message: 'GCash settings updated successfully!', config: db.systemSettings.gcashConfig });
});

// Get Bank Transfer Configuration
apiRouter.get('/bank-transfer/config', (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  if (!db.systemSettings.bankConfig) {
    db.systemSettings.bankConfig = {
      enabled: true, accountName: 'CCT COOPERATIVE INC.',
      bankName: 'BDO Unibank',
      
      accountNumber: '001234567890',
      instructions: '1. Open your banking app.\n2. Transfer to the cooperative bank account.\n3. Input the exact Amount Due.\n4. Take a screenshot or save the transaction receipt.\n5. Upload the proof of payment file below.'
    };
    CooperativeDB.save(db);
  }
  res.json(db.systemSettings.bankConfig);
});

// Update Bank Transfer Configuration (Admin only)
apiRouter.put('/bank-transfer/config', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { enabled, bankName, accountName, accountNumber, instructions } = req.body;
  const db = CooperativeDB.load();

  if (!accountName || !accountNumber || !bankName) {
    res.status(400).json({ error: 'Bank name, account name and account number are required.' });
    return;
  }

  const currentConfig = db.systemSettings.bankConfig || {
    enabled: true, accountName: 'CCT COOPERATIVE INC.',
    bankName: 'BDO Unibank',
    
    accountNumber: '001234567890',
    instructions: ''
  };

  const newConfig = {
    enabled: typeof enabled === 'boolean' ? enabled : currentConfig.enabled,
    bankName: bankName.trim(),
    accountName: accountName.trim(),
    accountNumber: accountNumber.trim(),
    instructions: instructions !== undefined ? instructions : currentConfig.instructions
  };

  db.systemSettings.bankConfig = newConfig;
  CooperativeDB.save(db);
  
  const tokenUser = (req as AuthenticatedRequest).user!;
  
  const adminProfile = db.staff.find(s => s.id === tokenUser.id) || { fullName: 'Administrator' };

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'BANK_CONFIG_UPDATED',
    `Updated Bank Transfer Settings by ${adminProfile.fullName}. Previous Number: ${currentConfig.accountNumber}, New Number: ${newConfig.accountNumber}, Previous Name: ${currentConfig.accountName}, New Name: ${newConfig.accountName}, Previous Enabled: ${currentConfig.enabled}, New Enabled: ${newConfig.enabled}`
  );

  res.json({ message: 'Bank Transfer settings updated successfully!', config: db.systemSettings.bankConfig });
});


// ============================================================================
// PAYMENT REQUEST & RECONCILIATION WORKFLOW
// ============================================================================

// 1. Create a Payment Request (Member)
apiRouter.post('/payments/request', requireRole(['MEMBER', 'STAFF', 'ADMIN']), (req: Request, res: Response) => {
  const { paymentType, amount, paymentMethod, targetReferenceId, remarks } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;
  
  if (!paymentType || !amount || !paymentMethod) {
    res.status(400).json({ error: 'paymentType, amount, and paymentMethod are required.' });
    return;
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    res.status(400).json({ error: 'Amount must be a valid positive number.' });
    return;
  }

  const db = CooperativeDB.load();
  if (tokenUser.role === 'MEMBER' && req.body.memberId && req.body.memberId !== tokenUser.id && req.body.memberId !== tokenUser.memberId) {
    res.status(403).json({ error: 'Forbidden: Members can only create payment requests for their own account.' });
    return;
  }
  const member = db.members.find(m => m.id === tokenUser.id) || db.members.find(m => m.id === req.body.memberId);
  if (!member) {
    res.status(404).json({ error: 'Member not found.' });
    return;
  }

  if (!member.initialShareCapitalPaid && paymentType !== 'INITIAL_SHARE' && paymentType !== 'LOAN_PAYMENT') {
    res.status(400).json({ error: 'Member must have a verified Initial Share Capital payment to access savings and deposit products.' });
    return;
  }

  // Prevent submitting duplicate GCash or external reference numbers that have already been posted
  const rawExternalRef = req.body.externalReference ? String(req.body.externalReference).trim() : undefined;
  if (rawExternalRef && rawExternalRef !== 'N/A' && rawExternalRef !== 'OFFICE-CASH') {
    const existingPosting = (db.financialPostings || []).find(p =>
      p.status === 'POSTED' &&
      (p.gcashRefNumber?.toLowerCase() === rawExternalRef.toLowerCase() ||
       p.postingKey.toLowerCase() === `gcash_ref:${rawExternalRef}`.toLowerCase())
    );
    const existingReq = (db.paymentRequests || []).find(pr =>
      (pr.status === 'POSTED' || pr.status === 'PENDING_RECONCILIATION') &&
      pr.externalReference &&
      pr.externalReference.trim().toLowerCase() === rawExternalRef.toLowerCase()
    );
    if (existingPosting || existingReq) {
      res.status(400).json({
        error: `Duplicate Reference Number: The reference number "${rawExternalRef}" has already been submitted or posted. Reusing reference numbers is prohibited.`
      });
      return;
    }
  }

  let targetLoan: Loan | undefined;
  let allocationBreakdown: PaymentAllocationItem[] | undefined;
  let targetInstallmentNo: number | undefined;
  let installmentDueDate: string | undefined;
  let isAdvancePayment: boolean | undefined;
  let principalPortion: number | undefined;
  let interestPortion: number | undefined;
  let penaltyPortion: number | undefined;
  let remainingLoanBalanceAfterPayment: number | undefined;

  if (paymentType === 'LOAN_PAYMENT') {
    const loanId = req.body.loanId || targetReferenceId;
    if (!loanId) {
      res.status(400).json({ error: 'Target loan contract ID is required for loan amortization repayment.' });
      return;
    }

    targetLoan = (db.loans || []).find(l => l.id === loanId || l.id.substring(0, 8).toUpperCase() === loanId.toUpperCase());
    if (!targetLoan) {
      res.status(404).json({ error: 'Target loan contract record not found.' });
      return;
    }

    if (tokenUser.role === 'MEMBER' && targetLoan.memberId !== member.id) {
      res.status(403).json({ error: 'Access denied. You can only create repayment requests for your own loan contract.' });
      return;
    }

    if (targetLoan.balance <= 0 || targetLoan.status === 'COMPLETED') {
      res.status(400).json({ error: 'This loan contract has already been fully settled with zero balance.' });
      return;
    }

    if (numericAmount > targetLoan.balance) {
      res.status(400).json({ error: `Payment amount (₱${numericAmount.toLocaleString()}) cannot exceed the total outstanding loan balance of ₱${targetLoan.balance.toLocaleString()}.` });
      return;
    }

    const reqInstNo = req.body.targetInstallmentNo ? Number(req.body.targetInstallmentNo) : undefined;
    const allocation = calculateAmortizationAllocation(targetLoan, numericAmount, reqInstNo);

    targetInstallmentNo = allocation.targetInstallmentNo;
    installmentDueDate = allocation.targetDueDate;
    isAdvancePayment = allocation.isAdvancePayment;
    principalPortion = allocation.totalPrincipal;
    interestPortion = allocation.totalInterest;
    penaltyPortion = allocation.totalPenalty;
    remainingLoanBalanceAfterPayment = allocation.remainingLoanBalanceAfter;
    allocationBreakdown = allocation.allocations;
  }

  const internalReference = `PR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  if (!db.paymentRequests) db.paymentRequests = [];

  const hasExternalRef = Boolean(rawExternalRef);

  const newRequest: PaymentRequest = {
    id: 'pr_' + Math.random().toString(36).substring(2, 11),
    memberId: member.id,
    memberName: member.fullName,
    paymentType,
    targetReferenceId: targetLoan ? targetLoan.id : targetReferenceId,
    loanId: targetLoan ? targetLoan.id : undefined,
    targetInstallmentNo,
    installmentDueDate,
    isAdvancePayment,
    principalPortion,
    interestPortion,
    penaltyPortion,
    remainingLoanBalanceAfterPayment,
    allocationBreakdown,
    paymentMethod,
    internalReference,
    externalReference: hasExternalRef ? req.body.externalReference.trim() : undefined,
    proofAttachmentUrl: req.body.proofAttachmentUrl || undefined,
    proofFileName: req.body.proofFileName || undefined,
    proofFileType: req.body.proofFileType || undefined,
    amount: numericAmount,
    remarks: remarks || '',
    status: (paymentMethod === 'CASH' || hasExternalRef) ? 'PENDING_RECONCILIATION' : 'UNPAID',
    createdAt: new Date().toISOString(),
    submittedAt: (paymentMethod === 'CASH' || hasExternalRef) ? new Date().toISOString() : undefined
  };

  db.paymentRequests.unshift(newRequest);
  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'PAYMENT_REQUEST_CREATED',
    `Created Payment Request ${newRequest.internalReference} for ₱${numericAmount} (${paymentType}${targetInstallmentNo ? ` - Period #${targetInstallmentNo}` : ''})`
  );

  res.status(201).json({
    message: 'Payment Request Created successfully.',
    paymentRequest: newRequest
  });
});

// 2. Submit External Reference for Reconciliation (Member)
apiRouter.post('/payments/submit-reference/:id', requireRole(['MEMBER', 'STAFF', 'ADMIN']), (req: Request, res: Response) => {
  const { id } = req.params;
  const { externalReference, proofAttachmentUrl, proofFileName, proofFileType } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;
  
  if (!externalReference || !externalReference.trim()) {
    res.status(400).json({ error: 'External Transaction Reference is required for reconciliation.' });
    return;
  }

  const rawRef = externalReference.trim();
  const db = CooperativeDB.load();
  if (rawRef !== 'N/A' && rawRef !== 'OFFICE-CASH') {
    const existingPosting = (db.financialPostings || []).find(p =>
      p.status === 'POSTED' &&
      (p.gcashRefNumber?.toLowerCase() === rawRef.toLowerCase() ||
       p.postingKey.toLowerCase() === `gcash_ref:${rawRef}`.toLowerCase())
    );
    const existingPostedReq = (db.paymentRequests || []).find(pr =>
      pr.id !== id &&
      pr.status === 'POSTED' &&
      pr.externalReference?.toLowerCase() === rawRef.toLowerCase()
    );
    if (existingPosting || existingPostedReq) {
      res.status(400).json({
        error: `Duplicate Reference Number: The reference number "${rawRef}" has already been verified and posted for another transaction. Reusing reference numbers is prohibited.`
      });
      return;
    }
  }

  if (!db.paymentRequests) db.paymentRequests = [];
  const request = db.paymentRequests.find(p => p.id === id);

  if (!request) {
    res.status(404).json({ error: 'Payment request not found.' });
    return;
  }

  if (tokenUser.role === 'MEMBER' && request.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'Access denied. You can only update your own payment requests.' });
    return;
  }

  if (request.status !== 'UNPAID' && request.status !== 'PENDING_RECONCILIATION') {
    res.status(400).json({ error: `Payment request cannot be updated in its current status: ${request.status}` });
    return;
  }

  request.externalReference = externalReference.trim();
  if (proofAttachmentUrl) request.proofAttachmentUrl = proofAttachmentUrl;
  if (proofFileName) request.proofFileName = proofFileName;
  if (proofFileType) request.proofFileType = proofFileType;
  
  request.status = 'PENDING_RECONCILIATION';
  request.submittedAt = new Date().toISOString();

  CooperativeDB.save(db);

  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'PAYMENT_SUBMITTED_FOR_RECONCILIATION',
    `Submitted external reference ${request.externalReference} for Payment Request ${request.internalReference}`
  );

  res.json({
    message: 'External reference submitted. Payment is now pending staff reconciliation.',
    paymentRequest: request
  });
});

// 3. Get Payment Requests
apiRouter.get('/payments/requests', requireRole(['ADMIN', 'STAFF', 'MEMBER']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const tokenUser = (req as AuthenticatedRequest).user!;
  let requests = db.paymentRequests || [];

  if (tokenUser.role === 'MEMBER') {
    if (req.query.memberId && req.query.memberId !== tokenUser.id && req.query.memberId !== tokenUser.memberId) {
      res.status(403).json({ error: 'Forbidden: Members can only view their own payment requests.' });
      return;
    }
    requests = requests.filter(p => p.memberId === tokenUser.id);
  }

  res.json(requests);
});

// 4. Staff Reconcile / Approve / Reject
apiRouter.post('/payments/reconcile/:id', requireRole(['STAFF', 'ADMIN']), requirePermission('gcash_payments'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, reconciliationReference, reconciliationNotes, rejectionReason } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!action || !['RECONCILE', 'APPROVE', 'REJECT'].includes(action)) {
    res.status(400).json({ error: 'Action must be RECONCILE, APPROVE, or REJECT.' });
    return;
  }

  const db = CooperativeDB.load();
  if (!db.paymentRequests) db.paymentRequests = [];
  const request = db.paymentRequests.find(p => p.id === id);

  if (!request) {
    res.status(404).json({ error: 'Payment request not found.' });
    return;
  }

  const staffObj = db.staff.find(s => s.id === tokenUser.id);
  const staffName = tokenUser.role === 'ADMIN' ? 'Admin' : (staffObj ? staffObj.fullName : 'Staff');

  if (action === 'REJECT') {
    if (request.status === 'POSTED') {
      res.status(400).json({ error: 'Cannot reject a payment that has already been posted to the ledger.' });
      return;
    }
    if (!rejectionReason || !rejectionReason.trim()) {
      res.status(400).json({ error: 'Rejection reason is required.' });
      return;
    }
    request.status = 'REJECTED';
    request.rejectionReason = rejectionReason.trim();
    request.reconciledBy = staffName;
    request.reconciledAt = new Date().toISOString();
    CooperativeDB.save(db);

    CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'PAYMENT_REJECTED', `Rejected payment request ${request.internalReference}. Reason: ${rejectionReason}`);
    res.json({ message: 'Payment request rejected.', paymentRequest: request });
    return;
  }

  if (action === 'RECONCILE' || action === 'APPROVE') {
    if (request.status === 'POSTED') {
      res.json({
        message: 'Payment has already been reconciled and posted.',
        status: 'ALREADY_PROCESSED',
        paymentRequest: request,
        officialReceiptNo: request.officialReceiptNo
      });
      return;
    }
    if (request.status === 'REJECTED') {
      res.status(400).json({ error: 'Cannot reconcile or approve a REJECTED payment request.' });
      return;
    }

    if (reconciliationReference) request.reconciliationReference = reconciliationReference;
    if (reconciliationNotes) request.reconciliationNotes = reconciliationNotes;
    request.reconciledBy = staffName;
    request.reconciledAt = new Date().toISOString();

    const cleanRef = request.externalReference && request.externalReference !== 'N/A' && request.externalReference !== 'OFFICE-CASH'
      ? String(request.externalReference).trim()
      : null;

    if (cleanRef) {
      // Check if another POSTED payment request used this exact externalReference
      const duplicatePostedPR = (db.paymentRequests || []).find(pr =>
        pr.id !== request.id &&
        pr.status === 'POSTED' &&
        pr.externalReference &&
        pr.externalReference.trim().toLowerCase() === cleanRef.toLowerCase()
      );
      const duplicatePosting = (db.financialPostings || []).find(p =>
        p.status === 'POSTED' &&
        !p.postingKey.toLowerCase().includes(request.id.toLowerCase()) &&
        (
          p.gcashRefNumber?.trim().toLowerCase() === cleanRef.toLowerCase() ||
          p.postingKey.toLowerCase() === `gcash_ref:${cleanRef}`.toLowerCase()
        )
      );

      if (duplicatePostedPR || duplicatePosting) {
        res.status(400).json({
          error: `Duplicate Reference Error: The reference number "${cleanRef}" has already been processed and posted for another transaction. Reusing GCash or external references is prohibited.`
        });
        return;
      }
    }

    // Execute Financial Posting!
    const isInitialShare = request.paymentType === 'INITIAL_SHARE';
    const isShareCapital = request.paymentType === 'SHARE_CAPITAL';
    const isInitialShareOrShareCapital = isInitialShare || isShareCapital;
    const postingKeys = [
      `PAYMENT_REQUEST:${request.id}:POST`,
      isInitialShare ? `INITIAL_SHARE:${request.memberId}` : '',
      isShareCapital ? `SHARE_CAPITAL_ADDITIONAL:${request.id}` : '',
      cleanRef ? `GCASH_REF:${cleanRef}` : '',
      request.paymentType === 'LOAN_PAYMENT' ? `LOAN_PAYMENT_PR:${request.id}` : ''
    ].filter(Boolean);

    let postingType: any = 'REGULAR_SAVINGS';
    if (request.paymentType === 'SAVINGS_DEPOSIT') postingType = 'REGULAR_SAVINGS';
    if (isInitialShareOrShareCapital) postingType = 'SHARE_CAPITAL';
    if (request.paymentType === 'LOAN_PAYMENT') postingType = 'LOAN_PAYMENT';

    const postResult = CooperativeDB.postFinancialTransaction({
      postingKeys,
      paymentSource: 'PAYMENT_REQUEST_QUEUE',
      memberId: request.memberId,
      memberName: request.memberName,
      amount: request.amount,
      postingType,
      postedBy: staffName,
      gcashRefNumber: request.externalReference,
      executePosting: (currentDb) => {
        const memberObj = currentDb.members.find(m => m.id === request.memberId);
        const targetLoanId = request.loanId || request.targetReferenceId;
        let targetLoan = targetLoanId ? currentDb.loans.find(l => l.id === targetLoanId || l.id.substring(0, 8).toUpperCase() === targetLoanId.toUpperCase()) : null;

        if (!targetLoan && request.paymentType === 'LOAN_PAYMENT') {
          throw new Error('Target loan not found for this payment request.');
        }

        let officialReceiptNo = '';
        let tx: any = null;
        let loanPaymentRecord: LoanPayment | null = null;

        if (request.paymentType === 'SAVINGS_DEPOSIT') {
          if (memberObj) {
            memberObj.regularSavings = (memberObj.regularSavings || 0) + request.amount;
          }
          tx = {
            id: 'tx_' + Math.random().toString(36).substring(2, 11),
            memberId: request.memberId,
            memberName: request.memberName,
            type: 'DEPOSIT',
            amount: request.amount,
            description: `Savings Deposit via ${request.paymentMethod} (${request.externalReference || 'Office Cash'}) (PR: ${request.internalReference})`,
            processedBy: staffName,
            createdAt: new Date().toISOString()
          };
          currentDb.transactions.unshift(tx);
        } else if (isInitialShareOrShareCapital) {
          if (memberObj) {
            memberObj.shareCapital = (memberObj.shareCapital || 0) + request.amount;
            memberObj.initialShareCapitalPaid = true;
          }
          tx = {
            id: 'tx_' + Math.random().toString(36).substring(2, 11),
            memberId: request.memberId,
            memberName: request.memberName,
            type: 'DEPOSIT',
            amount: request.amount,
            description: `Share Capital Subscription via ${request.paymentMethod} (PR: ${request.internalReference})`,
            processedBy: staffName,
            createdAt: new Date().toISOString()
          };
          currentDb.transactions.unshift(tx);
        } else if (request.paymentType === 'LOAN_PAYMENT' && targetLoan) {
          targetLoan.balance = Math.max(0, Number((targetLoan.balance - request.amount).toFixed(2)));
          if (targetLoan.balance === 0) {
            targetLoan.status = 'COMPLETED';
          }

          // Apply payment to amortization schedule using controlled allocation policy
          const todayDateStr = new Date().toISOString().split('T')[0];
          const allocationResult = applyPaymentToAmortizationSchedule(
            targetLoan,
            request.amount,
            todayDateStr,
            request.externalReference,
            undefined,
            request.id,
            request.targetInstallmentNo
          );

          if (!currentDb.loanPayments) currentDb.loanPayments = [];
          const paymentId = 'pay_' + Math.random().toString(36).substring(2, 11);
          loanPaymentRecord = {
            id: paymentId,
            loanId: targetLoan.id,
            paymentRequestId: request.id,
            memberId: request.memberId,
            memberName: request.memberName,
            amount: request.amount,
            installmentNo: request.targetInstallmentNo || (allocationResult.allocations[0]?.installmentNo),
            principalPaid: allocationResult.totalPrincipal,
            interestPaid: allocationResult.totalInterest,
            penaltyPaid: allocationResult.totalPenalty,
            paymentDate: new Date().toISOString(),
            processedBy: staffName,
            notes: request.remarks || `Loan Amortization Repayment via ${request.paymentMethod} (PR: ${request.internalReference}, Ref: ${request.externalReference || 'Office Cash'})`,
            status: 'APPROVED',
            paymentMethod: request.paymentMethod as any,
            referenceNumber: request.externalReference || '',
            createdAt: new Date().toISOString()
          };
          currentDb.loanPayments.push(loanPaymentRecord);

          tx = {
            id: 'tx_' + Math.random().toString(36).substring(2, 11),
            memberId: request.memberId,
            memberName: request.memberName,
            type: 'LOAN_PAYMENT',
            amount: request.amount,
            referenceId: targetLoan.id,
            principalPortion: allocationResult.totalPrincipal,
            interestPortion: allocationResult.totalInterest,
            status: 'COMPLETED',
            description: `Loan Repayment (${targetLoan.loanTypeName}) via ${request.paymentMethod} (PR: ${request.internalReference}, Ref: ${request.externalReference || 'Office Cash'}). Principal: ₱${allocationResult.totalPrincipal.toLocaleString()}, Interest: ₱${allocationResult.totalInterest.toLocaleString()}. Remaining Balance: ₱${targetLoan.balance.toLocaleString()}`,
            processedBy: staffName,
            createdAt: new Date().toISOString()
          };
          currentDb.transactions.unshift(tx);

          targetLoan.remainingPrincipalBalance = Math.max(0, Number(((targetLoan.remainingPrincipalBalance ?? targetLoan.principalAmount) - allocationResult.totalPrincipal).toFixed(2)));
          targetLoan.remainingInterestBalance = Math.max(0, Number(((targetLoan.remainingInterestBalance ?? targetLoan.interestAmount) - allocationResult.totalInterest).toFixed(2)));

          checkAndFinalizeLoanCompletion(currentDb, targetLoan, tokenUser);
        }

        const receipt = createOfficialReceipt(currentDb, {
          memberId: request.memberId,
          memberName: request.memberName,
          memberNumber: memberObj?.memberNumber || request.memberId.substring(0, 8),
          paymentType: request.paymentType,
          paymentMethod: request.paymentMethod,
          amount: request.amount,
          paymentDate: new Date().toISOString().split('T')[0],
          issuedBy: staffName,
          issuedById: tokenUser.id,
          transactionId: tx.id,
          internalReference: request.internalReference,
          loanId: targetLoan ? targetLoan.id : undefined,
          loanNumber: targetLoan ? targetLoan.id.substring(0, 8).toUpperCase() : undefined,
          principalAmount: request.principalPortion || request.amount,
          remarks: request.remarks || (targetLoan ? `Loan Amortization Repayment for ${targetLoan.loanTypeName}. Remaining Balance: ₱${targetLoan.balance.toLocaleString()}` : `Payment for ${request.paymentType}`)
        });
        
        if (receipt) {
          if (tx) {
            tx.officialReceiptNumber = receipt.receiptNumber;
          }
          if (loanPaymentRecord) {
            loanPaymentRecord.officialReceiptNumber = receipt.receiptNumber;
            loanPaymentRecord.transactionId = tx?.id;
          }
        }

        if (isInitialShareOrShareCapital && memberObj) {
          memberObj.initialShareCapitalOfficialReceiptNo = receipt.receiptNumber;
        }

        officialReceiptNo = receipt.receiptNumber;

        // Tag official receipt on affected schedule items
        if (targetLoan && targetLoan.amortizationSchedule) {
          for (const item of targetLoan.amortizationSchedule) {
            if (item.paymentRequestId === request.id && !item.officialReceiptNumber) {
              item.officialReceiptNumber = receipt.receiptNumber;
            }
          }
        }

        if (targetLoan) {
          CooperativeDB.createNotification(
            targetLoan.memberId,
            'Loan Amortization Repayment Reconciled & Approved',
            `Your payment of ₱${request.amount.toLocaleString()} for ${targetLoan.loanTypeName} has been approved and posted. Official Receipt: ${receipt.receiptNumber}. Remaining Balance: ₱${targetLoan.balance.toLocaleString()}`
          );
        }

        return { ledgerTransaction: tx, officialReceipt: receipt, additionalData: null };
      }
    });

    if (!postResult.success) {
      if (postResult.isAlreadyProcessed) {
        const existingKey = postResult.existingPosting?.postingKey.toLowerCase() || '';
        const thisReqKey = `payment_request:${request.id}:post`.toLowerCase();
        if (existingKey === thisReqKey) {
          request.status = 'POSTED';
          request.approvedAt = request.approvedAt || new Date().toISOString();
          request.approvedBy = request.approvedBy || staffName;
          request.officialReceiptNo = postResult.existingPosting?.officialReceiptNo;
          CooperativeDB.save(db);
          res.json({ message: 'Payment has already been posted.', paymentRequest: request, status: 'ALREADY_PROCESSED' });
          return;
        } else {
          res.status(400).json({
            error: `Financial Posting Collision: This transaction reference conflicts with an existing posting (${postResult.existingPosting?.postingKey}). Reusing reference numbers is prohibited.`
          });
          return;
        }
      }
      res.status(400).json({ error: postResult.message || 'Failed to post financial transaction.' });
      return;
    }

    request.status = 'POSTED';
    request.approvedAt = new Date().toISOString();
    request.approvedBy = staffName;
    request.officialReceiptNo = postResult.officialReceipt?.receiptNumber;
    request.postingReference = postResult.ledgerTransaction?.id;
    
    CooperativeDB.save(db);

    CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'PAYMENT_APPROVED', `Approved & Posted Payment Request ${request.internalReference}. Generated OR: ${request.officialReceiptNo}`);
    
    res.json({
      message: 'Payment Request successfully POSTED. Balances updated and Official Receipt generated.',
      paymentRequest: request,
      officialReceiptNo: request.officialReceiptNo
    });
  }
});

// ============================================================================
// 12. OFFICIAL RECEIPT (OR) MODULE ROUTES
// ============================================================================

// Get Receipt Settings & Branding
apiRouter.get('/receipts/config', (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  res.json(db.receiptSettings || {
    orPrefix: 'OR-',
    orNextNumber: 1001,
    numberPadding: 6,
    headerTitle: 'CCT CREDIT COOPERATIVE INC.',
    cdaRegNo: 'CDA-REG-98765-PH',
    tin: '008-123-456-000',
    address: '123 Cooperative Blvd, Quezon City, Metro Manila, Philippines',
    contactPhone: '+1 (555) 019-2834',
    contactEmail: 'cashier@alliancecoop.org',
    logoUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=150&auto=format&fit=crop&q=80',
    footerNote: 'This is an Official Receipt generated by CCT Cooperative Core Financial System. Thank you for building your cooperative equity!',
    authorizedSignatoryName: 'Jane Smith',
    authorizedSignatoryTitle: 'Chief Cashier & Finance Officer'
  });
});

// Admin: Update Receipt Settings & Branding
apiRouter.put('/receipts/config', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();
  const {
    orPrefix,
    orNextNumber,
    numberPadding,
    headerTitle,
    cdaRegNo,
    tin,
    address,
    contactPhone,
    contactEmail,
    logoUrl,
    footerNote,
    authorizedSignatoryName,
    authorizedSignatoryTitle
  } = req.body;

  if (!db.receiptSettings) {
    db.receiptSettings = {
      orPrefix: 'OR-',
      orNextNumber: 1001,
      numberPadding: 6,
      headerTitle: 'CCT CREDIT COOPERATIVE INC.',
      cdaRegNo: 'CDA-REG-98765-PH',
      tin: '008-123-456-000',
      address: '123 Cooperative Blvd, Quezon City, Metro Manila, Philippines',
      contactPhone: '+1 (555) 019-2834',
      contactEmail: 'cashier@alliancecoop.org',
      logoUrl: '',
      footerNote: 'This is an Official Receipt generated by CCT Cooperative Core Financial System.',
      authorizedSignatoryName: 'Jane Smith',
      authorizedSignatoryTitle: 'Chief Cashier & Finance Officer'
    };
  }

  if (orPrefix !== undefined) db.receiptSettings.orPrefix = orPrefix;
  if (orNextNumber !== undefined) db.receiptSettings.orNextNumber = Number(orNextNumber);
  if (numberPadding !== undefined) db.receiptSettings.numberPadding = Number(numberPadding);
  if (headerTitle !== undefined) db.receiptSettings.headerTitle = headerTitle;
  if (cdaRegNo !== undefined) db.receiptSettings.cdaRegNo = cdaRegNo;
  if (tin !== undefined) db.receiptSettings.tin = tin;
  if (address !== undefined) db.receiptSettings.address = address;
  if (contactPhone !== undefined) db.receiptSettings.contactPhone = contactPhone;
  if (contactEmail !== undefined) db.receiptSettings.contactEmail = contactEmail;
  if (logoUrl !== undefined) db.receiptSettings.logoUrl = logoUrl;
  if (footerNote !== undefined) db.receiptSettings.footerNote = footerNote;
  if (authorizedSignatoryName !== undefined) db.receiptSettings.authorizedSignatoryName = authorizedSignatoryName;
  if (authorizedSignatoryTitle !== undefined) db.receiptSettings.authorizedSignatoryTitle = authorizedSignatoryTitle;

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, 'ADMIN', 'UPDATE_RECEIPT_CONFIG', 'Updated Official Receipt prefix, template branding, and signatory options.');

  res.json({ message: 'Official Receipt configuration updated successfully', settings: db.receiptSettings });
});

// List Official Receipts (Members see only theirs, Staff/Admin see all with filter support)
apiRouter.get('/receipts', (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  let receipts = db.officialReceipts || [];

  if (tokenUser.role === 'MEMBER') {
    if (req.query.memberId && req.query.memberId !== tokenUser.id && req.query.memberId !== tokenUser.memberId) {
      res.status(403).json({ error: 'Forbidden: Members can only view their own receipts.' });
      return;
    }
    const resolvedMember = db.members.find(m => m.id === tokenUser.id || (tokenUser.memberId && m.id === tokenUser.memberId) || (tokenUser.email && m.email.toLowerCase() === tokenUser.email.toLowerCase()));
    const actualMemberId = resolvedMember ? resolvedMember.id : tokenUser.id;
    receipts = receipts.filter(r => r.memberId === actualMemberId || (tokenUser.memberId && r.memberId === tokenUser.memberId) || r.memberId === tokenUser.id);
  }

  const search = (req.query.search as string || '').toLowerCase().trim();
  const paymentType = req.query.paymentType as string;
  const status = req.query.status as string;

  if (search) {
    receipts = receipts.filter(r =>
      r.receiptNumber.toLowerCase().includes(search) ||
      r.memberName.toLowerCase().includes(search) ||
      (r.memberNumber && r.memberNumber.toLowerCase().includes(search)) ||
      (r.loanNumber && r.loanNumber.toLowerCase().includes(search)) ||
      (r.paymentReference && r.paymentReference.toLowerCase().includes(search)) ||
      r.paymentDate.includes(search)
    );
  }

  if (paymentType && paymentType !== 'ALL') {
    receipts = receipts.filter(r => r.paymentType === paymentType);
  }

  if (status && status !== 'ALL') {
    receipts = receipts.filter(r => r.status === status);
  }

  res.json(receipts);
});

// Get Receipt Details by ID, Receipt Number, Loan ID, or Application ID
apiRouter.get('/receipts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  // Search by receipt ID, receipt Number, loan ID, application ID, or loan Number
  let receipt = (db.officialReceipts || []).find(r =>
    r.id === id ||
    r.receiptNumber === id ||
    r.loanId === id ||
    r.applicationId === id ||
    r.loanNumber === id ||
    (r.loanNumber && r.loanNumber.toLowerCase() === id.toLowerCase()) ||
    (r.receiptNumber && r.receiptNumber.toLowerCase() === id.toLowerCase()) ||
    (r.paymentReference && r.paymentReference.includes(id)) ||
    r.transactionId === id
  );

  if (!receipt) {
    // Check if `id` belongs to a loan application or active loan
    const loanApp = (db.loanApplications || []).find(a => a.id === id || (a as any).disbursementReceiptId === id);
    const activeLoan = (db.loans || []).find(l => l.id === id || l.applicationId === id || (l as any).disbursementReceiptId === id);

    const targetApp = loanApp || (activeLoan ? db.loanApplications.find(a => a.id === activeLoan.applicationId) : null);
    const targetLoan = activeLoan || (loanApp ? db.loans.find(l => l.applicationId === loanApp.id) : null);

    const isReleased = (targetApp && ['RELEASED', 'DISBURSED', 'ACTIVE', 'PAID', 'COMPLETED'].includes(targetApp.status)) ||
                       (targetLoan && ['ACTIVE', 'PAID', 'COMPLETED'].includes(targetLoan.status));

    if (isReleased) {
      receipt = ensureDisbursementReceiptForLoan(db, targetLoan, targetApp);
      CooperativeDB.save(db);
    } else if (targetApp || targetLoan) {
      res.status(400).json({ error: 'Receipt not yet generated. Loan has not been released.', status: 'NOT_RELEASED' });
      return;
    }
  }

  if (!receipt) {
    res.status(404).json({ error: 'Receipt details could not be located.', status: 'NOT_FOUND' });
    return;
  }

  if (tokenUser.role === 'MEMBER') {
    const resolvedMember = db.members.find(m => m.id === tokenUser.id || (tokenUser.memberId && m.id === tokenUser.memberId) || (tokenUser.email && m.email.toLowerCase() === tokenUser.email.toLowerCase()));
    const actualMemberId = resolvedMember ? resolvedMember.id : tokenUser.id;
    if (receipt.memberId !== actualMemberId && receipt.memberId !== tokenUser.id && (!tokenUser.memberId || receipt.memberId !== tokenUser.memberId)) {
      res.status(403).json({ error: 'Access denied. Members can only view their own receipts.' });
      return;
    }
  }

  res.json(receipt);
});

// Get Loan Disbursement Receipt specifically by Loan or Application ID
apiRouter.get('/loans/:id/receipt', (req: Request, res: Response) => {
  const { id } = req.params;
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  const loanApp = (db.loanApplications || []).find(a => a.id === id);
  const activeLoan = (db.loans || []).find(l => l.id === id || l.applicationId === id);

  const targetApp = loanApp || (activeLoan ? db.loanApplications.find(a => a.id === activeLoan.applicationId) : null);
  const targetLoan = activeLoan || (loanApp ? db.loans.find(l => l.applicationId === loanApp.id) : null);

  const isReleased = (targetApp && ['RELEASED', 'DISBURSED', 'ACTIVE', 'PAID', 'COMPLETED'].includes(targetApp.status)) ||
                     (targetLoan && ['ACTIVE', 'PAID', 'COMPLETED'].includes(targetLoan.status));

  if (!isReleased) {
    res.status(400).json({ error: 'Receipt not yet generated. Loan has not been released.', status: 'NOT_RELEASED' });
    return;
  }

  let receipt = (db.officialReceipts || []).find(r =>
    r.loanId === id ||
    r.applicationId === id ||
    r.id === id ||
    r.receiptNumber === id ||
    (targetLoan && r.loanId === targetLoan.id) ||
    (targetApp && r.applicationId === targetApp.id)
  );

  if (!receipt) {
    receipt = ensureDisbursementReceiptForLoan(db, targetLoan, targetApp);
    CooperativeDB.save(db);
  }

  if (tokenUser.role === 'MEMBER') {
    const resolvedMember = db.members.find(m => m.id === tokenUser.id || (tokenUser.memberId && m.id === tokenUser.memberId) || (tokenUser.email && m.email.toLowerCase() === tokenUser.email.toLowerCase()));
    const actualMemberId = resolvedMember ? resolvedMember.id : tokenUser.id;
    if (receipt.memberId !== actualMemberId && receipt.memberId !== tokenUser.id && (!tokenUser.memberId || receipt.memberId !== tokenUser.memberId)) {
      res.status(403).json({ error: 'Access denied. Members can only view their own receipts.' });
      return;
    }
  }

  res.json(receipt);
});

// Staff / Admin: Manually Issue / Generate Official Receipt
apiRouter.post('/receipts/generate', requireRole(['STAFF', 'ADMIN']), requirePermission('official_receipts'), (req: Request, res: Response) => {
  const tokenUser = (req as AuthenticatedRequest).user!;
  const {
    memberId,
    paymentType,
    paymentMethod,
    amount,
    paymentDate,
    loanId,
    internalReference,
    principalAmount,
    interestAmount,
    penaltyAmount,
    feeAmount,
    remarks
  } = req.body;

  if (!memberId || !paymentType || !paymentMethod || !amount || amount <= 0) {
    res.status(400).json({ error: 'Please specify member, payment type, payment method, and a valid positive amount.' });
    return;
  }

  const db = CooperativeDB.load();
  const member = db.members.find(m => m.id === memberId);
  if (!member) {
    res.status(404).json({ error: 'Member profile not found' });
    return;
  }

  const operatorName = tokenUser.role === 'ADMIN' ? 'Admin' : (db.staff.find(s => s.id === tokenUser.id)?.fullName || 'Cashier');

  let loanObj: Loan | undefined;
  if (loanId) {
    loanObj = db.loans.find(l => l.id === loanId);
  }

  const receipt = createOfficialReceipt(db, {
    memberId: member.id,
    memberName: member.fullName,
    memberNumber: member.memberNumber || member.id.substring(0, 8),
    paymentType,
    paymentMethod,
    amount: Number(amount),
    paymentDate: paymentDate || new Date().toISOString().split('T')[0],
    issuedBy: operatorName,
    issuedById: tokenUser.id,
    internalReference: internalReference || `REF-MAN-${Date.now().toString().slice(-6)}`,
    loanId: loanObj?.id,
    loanNumber: loanObj?.id?.substring(0, 8).toUpperCase(),
    principalAmount: principalAmount ? Number(principalAmount) : undefined,
    interestAmount: interestAmount ? Number(interestAmount) : undefined,
    penaltyAmount: penaltyAmount ? Number(penaltyAmount) : undefined,
    feeAmount: feeAmount ? Number(feeAmount) : undefined,
    remarks
  });

  CooperativeDB.save(db);
  CooperativeDB.logAudit(tokenUser.id, tokenUser.email, tokenUser.role, 'RECEIPT_GENERATED', `Issued Official Receipt ${receipt.receiptNumber} to ${member.fullName} for ₱${Number(amount).toLocaleString()} (${paymentType}).`);

  res.status(201).json({ message: 'Official Receipt generated and recorded successfully!', receipt });
});

// Record Print, Reprint, or PDF Download action on an Official Receipt
apiRouter.post('/receipts/:id/print', (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, notes } = req.body; // action: 'INITIAL_PRINT' | 'REPRINT' | 'PDF_DOWNLOAD'
  const tokenUser = (req as AuthenticatedRequest).user!;
  const db = CooperativeDB.load();

  const receipt = (db.officialReceipts || []).find(r => r.id === id || r.receiptNumber === id);
  if (!receipt) {
    res.status(404).json({ error: 'Official Receipt not found' });
    return;
  }

  if (tokenUser.role === 'MEMBER' && receipt.memberId !== tokenUser.id) {
    res.status(403).json({ error: 'Access denied. You can only print or download your own receipts.' });
    return;
  }

  let printAction: 'INITIAL_PRINT' | 'REPRINT' | 'PDF_DOWNLOAD' = action || 'INITIAL_PRINT';
  if (receipt.printLogs.length > 0 && printAction === 'INITIAL_PRINT') {
    printAction = 'REPRINT';
  }

  if (printAction === 'REPRINT') {
    receipt.reprintCount = (receipt.reprintCount || 0) + 1;
  }

  const printUser = tokenUser.role === 'ADMIN' ? 'Admin' : (db.staff.find(s => s.id === tokenUser.id)?.fullName || db.members.find(m => m.id === tokenUser.id)?.fullName || tokenUser.email);

  const printLog: ReceiptPrintLog = {
    printedAt: new Date().toISOString(),
    printedBy: printUser,
    userRole: tokenUser.role,
    action: printAction,
    notes: notes || (printAction === 'REPRINT' ? `Reprint #${receipt.reprintCount}` : 'Receipt action executed')
  };

  receipt.printLogs.unshift(printLog);

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    `RECEIPT_${printAction}`,
    `Action '${printAction}' performed on Official Receipt ${receipt.receiptNumber} for ${receipt.memberName}.`
  );

  res.json({ message: 'Print action logged successfully in Audit Log.', receipt });
});

// Staff / Admin: Void or Cancel an Official Receipt
apiRouter.post('/receipts/:id/void', requireRole(['STAFF', 'ADMIN']), requirePermission('official_receipts'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { voidReason } = req.body;
  const tokenUser = (req as AuthenticatedRequest).user!;

  if (!voidReason || !voidReason.trim()) {
    res.status(400).json({ error: 'A valid authorization reason for cancellation/voiding is required.' });
    return;
  }

  const db = CooperativeDB.load();
  const receipt = (db.officialReceipts || []).find(r => r.id === id || r.receiptNumber === id);

  if (!receipt) {
    res.status(404).json({ error: 'Official Receipt not found' });
    return;
  }

  if (receipt.status === 'VOIDED') {
    res.status(400).json({ error: 'This Official Receipt has already been voided/cancelled.' });
    return;
  }

  const operatorName = tokenUser.role === 'ADMIN' ? 'Admin' : (db.staff.find(s => s.id === tokenUser.id)?.fullName || 'Cashier');
  const now = new Date().toISOString();
  const cleanReason = voidReason.trim();

  // 1. Mark receipt as VOIDED
  receipt.status = 'VOIDED';
  receipt.voidedAt = now;
  receipt.voidedBy = operatorName;
  receipt.voidReason = cleanReason;

  // 2. Void associated ledger transactions
  if (db.transactions) {
    db.transactions.forEach(tx => {
      if (
        (receipt.transactionId && tx.id === receipt.transactionId) ||
        (receipt.receiptNumber && tx.officialReceiptNumber === receipt.receiptNumber)
      ) {
        tx.status = 'VOIDED';
        tx.voidedAt = now;
        tx.voidedBy = operatorName;
        tx.voidReason = cleanReason;
      }
    });
  }

  // 3. Void / Reverse associated financial postings
  if (db.financialPostings) {
    db.financialPostings.forEach(p => {
      if (
        (receipt.receiptNumber && p.officialReceiptNo === receipt.receiptNumber) ||
        (receipt.transactionId && p.ledgerTransactionId === receipt.transactionId)
      ) {
        p.status = 'VOIDED';
        p.reversedAt = now;
        p.reversedBy = operatorName;
        p.reversalReason = cleanReason;
      }
    });
  }

  // 4. Reverse member balance according to payment type
  const member = (db.members || []).find(m => m.id === receipt.memberId);
  const amountToRevert = Number(receipt.amountPaid) || 0;

  if (receipt.paymentType === 'SHARE_CAPITAL' || receipt.paymentType === 'INITIAL_SHARE') {
    if (member) {
      member.shareCapital = Math.max(0, Number(((member.shareCapital || 0) - amountToRevert).toFixed(2)));
      if (member.shareCapital === 0) {
        member.initialShareCapitalPaid = false;
      }
      if (member.initialShareCapitalOfficialReceiptNo === receipt.receiptNumber) {
        delete member.initialShareCapitalOfficialReceiptNo;
      }
    }
  } else if (receipt.paymentType === 'SAVINGS_DEPOSIT') {
    if (member) {
      member.regularSavings = Math.max(0, Number(((member.regularSavings || 0) - amountToRevert).toFixed(2)));
    }
  } else if (receipt.paymentType === 'DIVIDEND_CREDIT') {
    if (member) {
      member.regularSavings = Math.max(0, Number(((member.regularSavings || 0) - amountToRevert).toFixed(2)));
      member.dividendsEarned = Math.max(0, Number(((member.dividendsEarned || 0) - amountToRevert).toFixed(2)));
    }
    const divAlloc = (db.memberDividends || []).find(d =>
      d.officialReceiptNo === receipt.receiptNumber || d.transactionId === receipt.transactionId
    );
    if (divAlloc) {
      divAlloc.status = 'PENDING';
      delete divAlloc.officialReceiptNo;
      delete divAlloc.transactionId;
      delete divAlloc.creditedAt;
    }
  } else if (receipt.paymentType === 'PATRONAGE_REFUND') {
    if (member) {
      member.regularSavings = Math.max(0, Number(((member.regularSavings || 0) - amountToRevert).toFixed(2)));
      member.patronageRefundEarned = Math.max(0, Number(((member.patronageRefundEarned || 0) - amountToRevert).toFixed(2)));
    }
    const patAlloc = (db.memberPatronageRefunds || []).find(p =>
      p.officialReceiptNo === receipt.receiptNumber || p.transactionId === receipt.transactionId
    );
    if (patAlloc) {
      patAlloc.status = 'PENDING';
      delete patAlloc.officialReceiptNo;
      delete patAlloc.transactionId;
      delete patAlloc.creditedAt;
    }
  } else if (receipt.paymentType === 'TIME_DEPOSIT') {
    if (member) {
      member.timeDeposits = Math.max(0, Number(((member.timeDeposits || 0) - amountToRevert).toFixed(2)));
    }
  } else if (receipt.paymentType === 'LOAN_PAYMENT') {
    const loanPayment = (db.loanPayments || []).find(lp =>
      (lp as any).receiptNumber === receipt.receiptNumber ||
      lp.paymentRequestId === (receipt as any).paymentRequestId ||
      (lp as any).officialReceiptNumber === receipt.receiptNumber ||
      (receipt.loanId && lp.loanId === receipt.loanId && Math.abs(lp.amount - amountToRevert) < 0.01)
    );

    const targetLoan = (db.loans || []).find(l => l.id === receipt.loanId || (loanPayment && l.id === loanPayment.loanId));

    if (targetLoan) {
      // Check for dependent later payments on this loan:
      // If there are later active/approved payments for this loan posted after this payment,
      // prevent invalid reversal and require the later dependent payment to be voided first.
      const thisPaymentTime = loanPayment?.createdAt ? new Date(loanPayment.createdAt).getTime() : (receipt.issuedAt ? new Date(receipt.issuedAt).getTime() : 0);
      const subsequentPayments = (db.loanPayments || []).filter(lp =>
        lp.loanId === targetLoan.id &&
        lp.id !== loanPayment?.id &&
        lp.status === 'APPROVED' &&
        (lp.createdAt ? new Date(lp.createdAt).getTime() : 0) > thisPaymentTime
      );

      if (subsequentPayments.length > 0) {
        res.status(400).json({
          error: `Dependent Payment Conflict: Cannot void payment (${receipt.receiptNumber}). Later payment(s) exist that depend on this installment. Please void the most recent loan payment first to maintain amortization schedule integrity.`,
          subsequentPaymentIds: subsequentPayments.map(p => p.id)
        });
        return;
      }
    }

    if (loanPayment) {
      loanPayment.status = 'VOIDED';
      loanPayment.voidedAt = now;
      loanPayment.voidedBy = operatorName;
      loanPayment.voidReason = cleanReason;
    }

    if (targetLoan) {
      targetLoan.balance = Math.min(targetLoan.totalRepayable, Number(((targetLoan.balance || 0) + amountToRevert).toFixed(2)));
      if (loanPayment?.principalPaid) {
        targetLoan.remainingPrincipalBalance = Math.min(targetLoan.principalAmount, Number(((targetLoan.remainingPrincipalBalance ?? targetLoan.principalAmount) + loanPayment.principalPaid).toFixed(2)));
      }
      if (loanPayment?.interestPaid) {
        targetLoan.remainingInterestBalance = Math.min(targetLoan.interestAmount, Number(((targetLoan.remainingInterestBalance ?? targetLoan.interestAmount) + loanPayment.interestPaid).toFixed(2)));
      }
      if (targetLoan.status === 'COMPLETED' || targetLoan.status === 'PAID') {
        targetLoan.status = 'ACTIVE';
      }
      if (targetLoan.amortizationSchedule) {
        const todayStr = getManilaDateString();
        for (const item of targetLoan.amortizationSchedule) {
          if (item.officialReceiptNumber === receipt.receiptNumber || (loanPayment && item.paymentRequestId === loanPayment.paymentRequestId)) {
            item.amountPaid = Math.max(0, Number(((item.amountPaid || 0) - amountToRevert).toFixed(2)));
            if (loanPayment?.principalPaid) item.principalPaid = Math.max(0, Number(((item.principalPaid || 0) - loanPayment.principalPaid).toFixed(2)));
            if (loanPayment?.interestPaid) item.interestPaid = Math.max(0, Number(((item.interestPaid || 0) - loanPayment.interestPaid).toFixed(2)));
            item.remainingAmount = Math.max(0, Number((item.scheduledAmount - item.amountPaid).toFixed(2)));
            item.status = item.amountPaid === 0 ? (item.dueDate < todayStr ? 'PAST_DUE' : (item.dueDate === todayStr ? 'DUE' : 'UPCOMING')) : 'PARTIALLY_PAID';
            delete item.officialReceiptNumber;
            delete item.paymentRequestId;
          }
        }
        evaluateInstallmentStatuses(targetLoan);
      }
    }
  }

  // Void linked Payment Request if present
  const linkedReq = (db.paymentRequests || []).find(pr =>
    pr.officialReceiptNo === receipt.receiptNumber ||
    pr.internalReference === receipt.internalReference ||
    pr.id === (receipt as any).paymentRequestId
  );
  if (linkedReq) {
    linkedReq.status = 'VOIDED';
    (linkedReq as any).voidedAt = now;
    (linkedReq as any).voidedBy = operatorName;
    (linkedReq as any).voidReason = cleanReason;
  }

  // Recalibrate share capital so all ledger invariants hold true
  CooperativeDB.recalibrateShareCapital(db);

  CooperativeDB.save(db);
  CooperativeDB.logAudit(
    tokenUser.id,
    tokenUser.email,
    tokenUser.role,
    'RECEIPT_VOIDED',
    `Voided Official Receipt ${receipt.receiptNumber} (${receipt.memberName}, Amount: ₱${receipt.amountPaid.toLocaleString()}). Postings and balances reversed. Authorized Reason: ${cleanReason}`
  );

  res.json({ message: `Official Receipt ${receipt.receiptNumber} has been successfully VOIDED and financial effects reversed.`, receipt });
});

// Admin: View Global Receipt Print History Audit Log
apiRouter.get('/receipts/history/print-logs', requireRole(['ADMIN']), (req: Request, res: Response) => {
  const db = CooperativeDB.load();
  const allLogs: Array<{ receiptNumber: string; memberName: string; amount: number; printedAt: string; printedBy: string; userRole: string; action: string; notes?: string }> = [];

  (db.officialReceipts || []).forEach(r => {
    (r.printLogs || []).forEach(pl => {
      allLogs.push({
        receiptNumber: r.receiptNumber,
        memberName: r.memberName,
        amount: r.amountPaid,
        ...pl
      });
    });
  });

  allLogs.sort((a, b) => new Date(b.printedAt).getTime() - new Date(a.printedAt).getTime());
  res.json(allLogs);
});

// Catch-all handler for unmatched /api routes to prevent HTML SPA fallback
apiRouter.use((req: Request, res: Response) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Centralized error handling middleware for API routes
apiRouter.use((err: any, req: Request, res: Response, next: any) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err?.message || 'An internal server error occurred.' });
});


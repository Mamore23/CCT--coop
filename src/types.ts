/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User Roles
export type Role = 'ADMIN' | 'STAFF' | 'MEMBER';

// Member Statuses
export type MemberStatus = 'PENDING' | 'UNDER_REVIEW' | 'REVISION_REQUESTED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'REJECTED';

// Loan Statuses
export type LoanStatus = 'PENDING_REVIEW' | 'UNDER_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED' | 'WAITING_FOR_RELEASE' | 'DISBURSED' | 'RELEASED' | 'PAID' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';

// Transaction Types
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'LOAN_RELEASE' | 'LOAN_PAYMENT' | 'DIVIDEND_CREDIT';

// Inquiry Statuses
export type InquiryStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

// Database Models
export type ComplianceRequirementType = 'PRE_MEMBERSHIP_SEMINAR' | 'LOAN_ORIENTATION' | 'KYC_VERIFICATION' | 'OTHER';
export type ComplianceStatus = 'NOT_COMPLETED' | 'PENDING_VERIFICATION' | 'COMPLETED' | 'REJECTED' | 'NOT_ATTENDED' | 'ATTENDED' | 'VERIFIED';

export interface ComplianceRecord {
  id: string;
  memberId: string;
  requirementType: ComplianceRequirementType;
  status: ComplianceStatus;
  verificationStatus?: string;
  attendanceDate?: string;
  attendedAt?: string;
  completedAt?: string;
  verificationDate?: string;
  verifiedBy?: string;
  verifiedById?: string;
  verifiedAt?: string;
  recordedBy?: string;
  recordedById?: string;
  recordedAt?: string;
  remarks?: string;
  reference?: string;
  referenceNumber?: string;
  updatedAt: string;
}

export interface ComplianceConfig {
  requirePmesForLoan: boolean;
  requireOrientationForLoan: boolean;
  requireKycForLoan?: boolean;
  allowStaffDirectVerify: boolean;
  requireAttendanceDate: boolean;
  requireReferenceNumber: boolean;
}

export interface PasswordResetState {
  otpHash: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
  verified: boolean;
  verifiedAt?: string;
  resetTokenHash?: string;
  used: boolean;
  requestedAt: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  avatarUrl?: string;
  memberId?: string;
  passwordSetupPending?: boolean;
  themePreference?: 'light' | 'dark' | 'system';
  customPermissions?: { [module: string]: boolean };
  lastLoginAt?: string;
  lastActivityAt?: string;
  firebaseUid?: string;
  firebaseEmail?: string;
  firebaseLinkedAt?: string;
  authProvider?: 'LOCAL' | 'GOOGLE' | 'LOCAL+GOOGLE';
  passwordReset?: PasswordResetState;
}

export interface Member {
  id: string; // matches user.id
  email: string;
  fullName: string;
  phone: string;
  status: MemberStatus;
  avatarUrl?: string;
  firebaseUid?: string;
  firebaseEmail?: string;
  firebaseLinkedAt?: string;
  authProvider?: 'LOCAL' | 'GOOGLE' | 'LOCAL+GOOGLE';
  memberType?: string;
  memberNumber?: string;
  shareCapital: number;
  initialShareCapitalPledged?: number;
  initialShareCapitalPaid?: boolean;
  initialShareCapitalPaymentMethod?: 'CASH' | 'GCASH' | 'BANK_TRANSFER' | string;
  initialShareCapitalReference?: string;
  initialShareCapitalReceiptUrl?: string;
  initialShareCapitalOfficialReceiptNo?: string;
  regularSavings: number;
  regularSavingsStatus?: 'ACTIVE' | 'INACTIVE';
  timeDeposits: number;
  dividendsEarned: number;
  patronageRefundEarned?: number;
  createdAt: string;
  // Member GCash Information
  gcashNumber?: string;
  gcashAccountName?: string;
  gcashQrCodeUrl?: string;
  gcashUpdatedAt?: string;
  // Extended Membership Application Fields
  address?: string;
  birthdate?: string;
  gender?: string;
  civilStatus?: string;
  emergencyContact?: string;
  occupation?: string;
  monthlyIncome?: number;
  initialShareCapital?: number;
  idNumber?: string;
  govIdUrl?: string;
  govIdFileName?: string;
  selfieUrl?: string;
  selfieFileName?: string;
  supportingDocUrl?: string;
  supportingDocFileName?: string;
  otherRequirements?: string;
  memberDocuments?: MemberDocument[];
  reviewNotes?: string;
  rejectionReason?: string;
  additionalRequirementsRequested?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationDate?: string;
  // Loan Eligibility Flags
  isMigs?: boolean; // Member In Good Standing
  loanOrientationCompleted?: boolean;
  hasAttendedPreMembershipSeminar?: boolean;
  membershipApprovedAt?: string;
  complianceRecords?: ComplianceRecord[];
}

export interface Staff {
  id: string; // matches user.id
  email: string;
  fullName: string;
  phone: string;
  avatarUrl?: string;
  status: 'ACTIVE' | 'DEACTIVATED' | 'SUSPENDED';
  createdAt: string;
  lastLoginAt?: string;
  lastActivityAt?: string;
  customPermissions?: { [module: string]: boolean };
  workload?: {
    approvedMembers?: number;
    reviewedLoans?: number;
    reconciledPayments?: number;
    verifiedDocs?: number;
    totalActions?: number;
  };
}

export interface LoanType {
  id: string;
  name: string;
  interestRate: number; // e.g., 0.05 for 5%
  maxDurationMonths: number;
  minAmount: number;
  maxAmount: number;
  // Admin Configurable Loan Eligibility & Policy Rules
  minMembershipMonths?: number;
  minShareCapital?: number;
  requiresMigs?: boolean;
  requiresOrientation?: boolean;
  maxActiveLoansAllowed?: number;
  cbuPercent?: number;
  processingFeePercent?: number;
  requiredDocuments?: string[]; // e.g. ['Application Form', 'Government ID', 'Payslip', 'Proof of Billing', 'COE']
  gracePeriodDays?: number;
  penaltyRatePercent?: number;
  description?: string;
  
  // Repayment configuration
  repaymentFrequency?: 'MONTHLY' | 'SEMI_MONTHLY' | 'WEEKLY';
  // Anchors: MONTHLY (e.g., 15 for 15th), SEMI_MONTHLY (e.g., "15,30")
  anchorDate?: string;
  // Options: AFTER_X_DAYS, ALIGN_TO_ANCHOR
  firstDueDateRule?: 'AFTER_X_DAYS' | 'ALIGN_TO_ANCHOR';
  firstDueDateDays?: number; // e.g. 30 days after release
  // Handling of weekends/holidays
  dueDateAdjustment?: 'NONE' | 'NEXT_WORKING_DAY' | 'PREVIOUS_WORKING_DAY';
}

export interface LoanApplicationDocument {
  id: string;
  documentType: string; // e.g. 'Government ID', 'Payslip', 'Proof of Billing'
  fileName: string;
  fileType: string;
  fileSize: number;
  fileDataUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  uploadedAt: string;
}

export interface LoanEligibilityCheck {
  rule: string;
  title: string;
  passed: boolean;
  requiredValue: string;
  actualValue: string;
  description: string;
  requirement: string;
  status: 'PASSED' | 'FAILED';
  message: string;
}

export interface StructuredEligibilityResponse {
  eligible: boolean;
  isEligible: boolean;
  missingRequirements: string[];
  duplicateApplication: boolean;
  duplicateApplicationDetails?: {
    applicationId: string;
    submittedDate: string;
    status: string;
    stage: string;
    isRevisionRequired: boolean;
    remarks?: string;
  };
  complianceDetails?: {
    pmes: {
      required: boolean;
      completed: boolean;
      status: string;
      record?: any;
    };
    orientation: {
      required: boolean;
      completed: boolean;
      status: string;
      record?: any;
    };
  };
  requirements?: Array<{ code: string; name: string; status: string }>;
  existingActiveLoan?: {
    id: string;
    loanId: string;
    loanTypeName: string;
    principalAmount: number;
    balance: number;
    monthlyAmortization: number;
    disbursedAt?: string;
    dueDate?: string;
    durationMonths: number;
    isPastDue: boolean;
    status: string;
  };
  checks: LoanEligibilityCheck[];
  loanType?: LoanType;
  member?: {
    id: string;
    fullName: string;
    status: string;
  };
}

export interface LoanApplication {
  id: string;
  memberId: string;
  memberName: string;
  loanTypeId: string;
  loanTypeName: string;
  amount: number;
  durationMonths: number;
  status: LoanStatus;
  monthlyAmortization: number;
  purpose?: string;
  collateralDescription?: string;
  coMakerName?: string;
  coMakerContact?: string;
  remarks?: string;
  staffNotes?: string;
  createdAt: string;
  updatedAt?: string;
  reviewedBy?: string; // staff ID
  approvedBy?: string; // admin ID
  reviewerName?: string;
  email?: string;
  mobileNumber?: string;
  shareCapital?: number;
  savingsBalance?: number;
  documents?: LoanApplicationDocument[];
  requestedAdditionalDocuments?: string[];
  eligibilitySnapshot?: LoanEligibilityCheck[];
}

export interface AmortizationItem {
  installmentNo: number;
  dueDate: string;          // Original scheduled due date (YYYY-MM-DD)
  adjustedProcessingDate?: string; // Adjusted if falls on weekend/holiday
  scheduledAmount: number;  // Total installment amount (principal + interest + penalty)
  principalAmount: number;
  interestAmount: number;
  penaltyAmount: number;
  amountPaid: number;
  remainingBalance: number; // Remaining loan balance after this installment or remaining amount
  remainingAmount?: number; // Remaining unpaid amount for this installment (scheduledAmount - amountPaid)
  status: 'UPCOMING' | 'DUE' | 'PARTIALLY_PAID' | 'PAID' | 'PAST_DUE' | 'WAIVED';
  paymentDate?: string;
  officialReceiptNumber?: string;
  gcashRefNumber?: string;
  paymentRequestId?: string;
  principalPaid?: number;
  interestPaid?: number;
  penaltyPaid?: number;
}

export interface Inquiry {
  id: string;
  memberId: string;
  memberName: string;
  category?: string;
  subject: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  replies?: InquiryReply[];
}

export interface InquiryReply {
  id: string;
  inquiryId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  message: string;
  createdAt: string;
}

export interface NotificationMetadata {
  loanId?: string;
  loanNumber?: string;
  receiptNumber?: string;
  referenceNumber?: string;
  amount?: number;
  dueDate?: string;
  actionUrl?: string;
  actionLabel?: string;
  [key: string]: any;
}

export interface NotificationDeliveryStatus {
  email?: {
    attempted: boolean;
    success: boolean;
    provider?: string;
    error?: string;
    sentAt?: string;
  };
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  deliveryStatus?: NotificationDeliveryStatus;
  emailSent?: boolean;
  metadata?: NotificationMetadata;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userRole: Role;
  action: string;
  details: string;
  createdAt: string;
}

export type SmsCategory = 
  | 'LOAN_DUE' 
  | 'SAVINGS_DUE' 
  | 'SHARE_CAPITAL_DUE' 
  | 'TIME_DEPOSIT_MATURITY' 
  | 'BULK_ANNOUNCEMENT' 
  | 'INDIVIDUAL_NOTICE';

export type SmsTriggerType = 
  | '7_DAYS_BEFORE' 
  | '3_DAYS_BEFORE' 
  | '1_DAY_BEFORE' 
  | 'ON_DUE_DATE' 
  | 'AFTER_DUE_DATE' 
  | 'MANUAL_SINGLE' 
  | 'BULK_SEND';

export type SmsGatewayProvider = 'Semaphore' | 'Vonage' | 'CustomGateway' | 'SystemSimulator';

export interface SmsNotification {
  id: string;
  memberId: string;
  memberName: string;
  memberNumber?: string;
  phone: string;
  category: SmsCategory;
  type: SmsTriggerType;
  loanId?: string;
  loanRef?: string;
  accountRef?: string;
  dueDate?: string; // YYYY-MM-DD
  amount?: number;
  paymentRef?: string;
  message: string;
  status: 'Delivered' | 'Sent' | 'Failed' | 'Pending';
  gatewayUsed: SmsGatewayProvider;
  errorDetails?: string;
  cost?: number;
  sentAt?: string;
  createdAt: string;
}

export interface SmsTemplate {
  id: string;
  name: string;
  category: SmsCategory;
  content: string; // Supports placeholders: {{Member Name}}, {{Member Number}}, {{Loan Number}}, {{Amount Due}}, {{Due Date}}, {{Payment Reference}}
  isDefault?: boolean;
  createdAt: string;
}

export interface SmsGatewaySettings {
  activeGateway: SmsGatewayProvider;
  semaphoreApiKey?: string;
  semaphoreSenderName?: string;
  vonageApiKey?: string;
  vonageApiSecret?: string;
  vonageFrom?: string;
  customEndpointUrl?: string;
  customApiKey?: string;
  autoRemindersEnabled: boolean;
  scheduleOffsetDays: number[]; // e.g. [7, 3, 1, 0, -1]
  lastAutoRunAt?: string;
}

export interface LandingContent {
  aboutUs: string;
  mission: string;
  vision: string;
  services: { title: string; description: string; icon: string }[];
  announcements: { id: string; title: string; content: string; date: string }[];
  testimonials: { id: string; author: string; role: string; content: string }[];
  faqs: { question: string; answer: string }[];
  facebookUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
}

export type TimeDepositStatus = 'ACTIVE' | 'MATURED' | 'CLOSED' | 'CANCELLED';
export type TimeDepositRenewalInstruction = 'AUTOMATIC_ROLLOVER' | 'PAYOUT_TO_SAVINGS' | 'MANUAL';

export interface TimeDepositTermOption {
  termMonths: number;
  interestRate: number; // e.g. 0.065 for 6.5% p.a.
  name: string;
}

export interface TimeDepositProductConfig {
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  availableTerms: TimeDepositTermOption[];
}

export interface TimeDepositContract {
  id: string;
  memberId: string;
  memberName: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  openingDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  status: TimeDepositStatus;
  renewalInstruction: TimeDepositRenewalInstruction;
  postingKey?: string;
  ledgerTransactionId?: string;
  officialReceiptNo?: string;
  createdAt: string;
  maturedAt?: string;
  closedAt?: string;
  accumulatedInterest?: number;
}

export interface SystemSettings {
  cooperativeName: string;
  maxBorrowingMultiplier?: number;
  minMembershipTenureMonths?: number;
  contactEmail: string;
  contactPhone: string;
  smsNotificationsEnabled: boolean;
  defaultGracePeriodDays?: number;
  defaultDueDateAdjustment?: string;
  dividendAllocationRate: number; // percentage of net surplus allocated
  statutoryReserveFundRate?: number; // default 10%
  reserveFundRate?: number; // alias
  statutoryCetfRate?: number; // default 10%
  cetfRate?: number; // alias
  statutoryCdfRate?: number; // default 3%
  cdfRate?: number; // alias
  statutoryOptionalFundRate?: number; // default 7%
  optionalFundRate?: number; // alias
  dividendPoolShareRate?: number; // default 70% of Distributable Surplus
  patronagePoolShareRate?: number; // default 30% of Distributable Surplus
  cbuPercent?: number;
  cdaRegNo?: string;
  tin?: string;
  address?: string;
  fiscalYear?: string;
  dividendRate?: number;
  minimumShareCapital?: number;
  gcashConfig?: GcashConfig;
  bankConfig?: BankConfig;
  timeDepositConfig?: TimeDepositProductConfig;
  complianceConfig?: ComplianceConfig;
}

export interface BankConfig {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
}

export interface GcashConfig {
  enabled: boolean;
  accountName: string;
  mobileNumber: string;
  qrCodeUrl: string;
  instructions: string;
}

export type PaymentRequestType = 'SAVINGS_DEPOSIT' | 'LOAN_PAYMENT' | 'SHARE_CAPITAL' | 'INITIAL_SHARE' | 'OTHER';
export type PaymentRequestStatus = 'UNPAID' | 'PENDING_RECONCILIATION' | 'RECONCILED' | 'APPROVED' | 'POSTED' | 'REJECTED' | 'VOIDED';

export interface PaymentAllocationItem {
  installmentNo: number;
  dueDate: string;
  principalPortion: number;
  interestPortion: number;
  penaltyPortion: number;
  totalAllocated: number;
  statusAfterPayment: 'PAID' | 'PARTIALLY_PAID' | 'PAST_DUE';
  remainingInstallmentDue: number;
}

export interface PaymentRequest {
  id: string;
  memberId: string;
  memberName: string;
  paymentType: PaymentRequestType;
  targetReferenceId?: string;
  loanId?: string; // Authoritative loan contract ID
  targetInstallmentNo?: number; // Target period/installment number
  installmentDueDate?: string;
  isAdvancePayment?: boolean;
  principalPortion?: number;
  interestPortion?: number;
  penaltyPortion?: number;
  remainingLoanBalanceAfterPayment?: number;
  allocationBreakdown?: PaymentAllocationItem[];
  paymentMethod: 'GCASH' | 'BANK_TRANSFER' | 'CASH' | 'OTHER';
  internalReference: string;
  externalReference?: string;
  amount: number;
  paymentDate?: string;
  remarks?: string;
  proofAttachmentUrl?: string;
  proofFileName?: string;
  proofFileType?: string;
  status: PaymentRequestStatus;
  createdAt: string;
  submittedAt?: string;
  reconciledAt?: string;
  reconciledBy?: string;
  reconciliationReference?: string;
  reconciliationNotes?: string;
  approvedAt?: string;
  approvedBy?: string;
  postedAt?: string;
  postingReference?: string;
  rejectionReason?: string;
  officialReceiptNo?: string;
}

export interface MemberDocument {
  id: string;
  memberId: string;
  memberName: string;
  fileName: string;
  fileType: string;
  documentCategory: 'GOV_ID' | 'SELFIE' | 'INCOME_PROOF' | 'BILLING' | 'LOAN_AGREEMENT' | 'OTHER';
  fileDataUrl: string;
  fileSize: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  uploadedAt: string;
  updatedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface PermissionRule {
  module: string;
  name: string;
  description: string;
  admin: boolean;
  staff: boolean;
  member: boolean;
}

export type ReceiptStatus = 'ISSUED' | 'VOIDED';

export interface ReceiptPrintLog {
  printedAt: string;
  printedBy: string;
  userRole: string;
  action: 'INITIAL_PRINT' | 'REPRINT' | 'PDF_DOWNLOAD';
  notes?: string;
}

export interface OfficialReceipt {
  id: string;
  receiptNumber: string;
  transactionId?: string;
  internalReference?: string;
  paymentRequestId?: string;
  paymentReference?: string;
  applicationId?: string;
  loanId?: string;
  loanNumber?: string;
  loanTypeName?: string;
  memberId: string;
  memberNumber?: string;
  memberName: string;
  paymentType: 'LOAN_RELEASE' | 'LOAN_PAYMENT' | 'SAVINGS_DEPOSIT' | 'SHARE_CAPITAL' | 'INITIAL_SHARE' | 'TIME_DEPOSIT' | 'DIVIDEND_CREDIT' | 'PATRONAGE_REFUND' | 'FEE' | 'OTHER';
  paymentMethod: 'CASH' | 'GCASH' | 'BANK_TRANSFER' | 'CHECK' | 'SAVINGS' | 'OTHER';
  releaseMethod?: string;
  approvedAmount?: number;
  releasedAmount?: number;
  amountPaid: number;
  amountInWords?: string;
  principalAmount?: number;
  interestAmount?: number;
  penaltyAmount?: number;
  feeAmount?: number;
  gcashDetails?: {
    refNumber?: string;
    accountName?: string;
    mobileNumber?: string;
  };
  transactionReferenceNumber?: string;
  releaseDate?: string;
  paymentDate: string;
  issuedAt: string;
  issuedBy: string;
  issuedById?: string;
  authorizedStaff?: string;
  digitalApproval?: string;
  qrVerification?: string;
  remarks?: string;
  status: ReceiptStatus;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  reprintCount: number;
  printLogs: ReceiptPrintLog[];
}

export interface ReceiptSettings {
  orPrefix: string;
  orNextNumber: number;
  numberPadding: number;
  headerTitle: string;
  cdaRegNo: string;
  tin: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  logoUrl?: string;
  footerNote: string;
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
}

export interface ScheduledBackupConfig {
  enabled: boolean;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  retentionCount: number;
  lastBackupAt?: string;
  nextBackupAt?: string;
  autoDownload: boolean;
}


export type WithdrawalRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RELEASED';

export interface WithdrawalRequest {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  requestDate: string;
  status: WithdrawalRequestStatus;
  releaseMethod: 'CASH' | 'GCASH' | 'OFFICE_CASH';
  gcashNumber?: string;
  remarks?: string;
  processedBy?: string;
  processedAt?: string;
  officialReceiptNo?: string;
  clientTxKey?: string;
}

export interface FinancialPosting {
  id: string;
  postingKey: string;
  paymentSource: 'INITIAL_SHARE_QUEUE' | 'GCASH_QUEUE' | 'CASHIER_QUEUE' | 'LOAN_DISBURSEMENT' | 'LOAN_PAYMENT_VERIFICATION' | 'DIVIDEND_DISTRIBUTION' | 'PATRONAGE_DISTRIBUTION' | 'SAVINGS_TRANSACTION' | 'OTC_LOAN_PAYMENT' | 'TIME_DEPOSIT_TRANSACTION' | 'PAYMENT_REQUEST_QUEUE';
  memberId: string;
  memberName: string;
  amount: number;
  postingType: 'SHARE_CAPITAL' | 'REGULAR_SAVINGS' | 'LOAN_PAYMENT' | 'LOAN_RELEASE' | 'WITHDRAWAL' | 'DIVIDEND_CREDIT' | 'PATRONAGE_REFUND' | 'TIME_DEPOSIT' | 'SHARE_CAPITAL_REFUND';
  ledgerTransactionId: string;
  officialReceiptNo?: string;
  postedBy: string;
  postedAt: string;
  status: 'POSTED' | 'REVERSED' | 'VOIDED';
  gcashRefNumber?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
}




export interface Loan {
  id: string;
  applicationId: string;
  memberId: string;
  memberName: string;
  loanTypeName: string;
  principalAmount: number;
  interestAmount: number;
  interestRate?: number;
  totalRepayable: number;
  balance: number;
  monthlyAmortization: number;
  durationMonths: number;
  remainingPrincipalBalance?: number;
  remainingInterestBalance?: number;
  paymentFrequency?: 'WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY'; // Supported schedule frequencies
  status: 'ACTIVE' | 'PAID' | 'COMPLETED';
  createdAt: string;
  disbursedAt: string;
  dueDate?: string; // Next payment or maturity due date in YYYY-MM-DD format
  nextDueDate?: string;
  amortizationSchedule?: AmortizationItem[];
  releaseMethod?: 'CASH' | 'GCASH' | 'BANK_TRANSFER';
  releasedBy?: string;
  transactionReferenceNumber?: string;
  releaseRemarks?: string;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  paymentRequestId?: string;
  memberId: string;
  memberName?: string;
  amount: number;
  installmentNo?: number;
  principalPaid?: number;
  interestPaid?: number;
  penaltyPaid?: number;
  paymentDate: string;
  processedBy: string; // staff or admin ID or MEMBER
  notes?: string;
  status?: 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED' | 'VOIDED';
  paymentMethod?: 'GCASH' | 'BANK_TRANSFER' | 'SAVINGS' | 'CASH';
  referenceNumber?: string;
  transactionId?: string;
  officialReceiptNumber?: string;
  proofOfPaymentUrl?: string;
  rejectionReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  createdAt?: string;
}

export interface DividendPeriod {
  id: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  totalDividendAmount: number;
  totalNetSurplus?: number;
  dividendRate?: number;
  status: 'DRAFT' | 'CALCULATED' | 'DISTRIBUTED' | 'COMPUTED';
  processedBy?: string;
  createdAt: string;
  distributedAt?: string;
  distributedBy?: string;
  // Statutory Reserve & Pool Split snapshots
  reserveFundRate?: number;
  reserveFundAmount?: number;
  cetfRate?: number;
  cetfAmount?: number;
  cdfRate?: number;
  cdfAmount?: number;
  optionalFundRate?: number;
  optionalFundAmount?: number;
  totalStatutoryReserves?: number;
  distributableSurplus?: number;
  dividendPoolShareRate?: number;
  dividendPoolCap?: number;
  patronagePoolShareRate?: number;
  patronagePoolCap?: number;
  patronageRate?: number;
  totalPatronageAmount?: number;
  patronageStatus?: 'COMPUTED' | 'DISTRIBUTED';
  patronageDistributedAt?: string;
  patronageDistributedBy?: string;
}

export interface MemberDividend {
  id: string;
  periodId?: string;
  dividendPeriodId?: string;
  memberId: string;
  memberName: string;
  year?: number;
  shareCapitalSnapshot?: number;
  regularSavingsSnapshot?: number;
  shareCapitalAmount?: number;
  shareCapitalWeight?: number;
  dividendAmount: number;
  status: 'PENDING' | 'CREDITED' | 'WITHDRAWN' | 'PAID';
  transactionId?: string;
  officialReceiptNo?: string;
  creditedAt?: string;
}

export interface MemberPatronageRefund {
  id: string;
  dividendPeriodId: string;
  year: number;
  memberId: string;
  memberName: string;
  totalInterestPaid: number;
  patronageWeight?: number;
  patronageRefundAmount: number;
  status: 'PENDING' | 'CREDITED' | 'PAID';
  transactionId?: string;
  officialReceiptNo?: string;
  creditedAt?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  memberId: string;
  memberName: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'LOAN_RELEASE' | 'LOAN_PAYMENT' | 'DIVIDEND_CREDIT' | 'PATRONAGE_REFUND' | 'TIME_DEPOSIT_OPEN' | 'TIME_DEPOSIT_MATURITY' | 'TIME_DEPOSIT_ROLLOVER' | 'TIME_DEPOSIT_PAYOUT' | 'SHARE_CAPITAL_SUBSCRIPTION' | 'SHARE_CAPITAL' | 'INITIAL_SHARE' | 'SAVINGS_DEPOSIT' | 'FEE' | 'OTHER';
  amount: number;
  description: string;
  processedBy: string;
  createdAt: string;
  referenceId?: string;
  externalReference?: string;
  releaseMethod?: string;
  paymentMethod?: string;
  officialReceiptNumber?: string;
  principalPortion?: number;
  interestPortion?: number;
  status?: 'COMPLETED' | 'PENDING' | 'FAILED' | 'VOIDED';
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export interface DatabaseState {
  users: User[];
  members: Member[];
  staff: Staff[];
  loanTypes: LoanType[];
  loanApplications: LoanApplication[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  dividendPeriods: DividendPeriod[];
  memberDividends: MemberDividend[];
  memberPatronageRefunds?: MemberPatronageRefund[];
  transactions: Transaction[];
  timeDepositContracts?: TimeDepositContract[];
  withdrawalRequests?: WithdrawalRequest[];
  inquiries: Inquiry[];
  inquiryReplies: InquiryReply[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  systemSettings: SystemSettings;
  smsNotifications: SmsNotification[];
  smsTemplates?: SmsTemplate[];
  smsGatewaySettings?: SmsGatewaySettings;
  memberDocuments?: MemberDocument[];
  permissions?: PermissionRule[];
  scheduledBackupConfig?: ScheduledBackupConfig;
  paymentRequests?: PaymentRequest[];
  officialReceipts?: OfficialReceipt[];
  receiptSettings?: ReceiptSettings;
  landingContent?: LandingContent;
  financialPostings?: FinancialPosting[];
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, Wallet, HelpCircle, Check, X, AlertCircle, Send, Download, Percent, FileText, Eye, Paperclip, FileCheck, CheckCircle2, Calculator, QrCode, Smartphone, Building, Clock, History, Search, Receipt, XCircle, ZoomIn, ZoomOut, Coins, TrendingUp, FileSpreadsheet, Plus, Sparkles, Printer, ShieldAlert, RefreshCw, Trash2 , Image, AlertTriangle, Calendar } from 'lucide-react';
import { SmsManager } from '../components/SmsManager.js';
import { OperationalAnalytics } from '../components/OperationalAnalytics.js';
import { GcashModule } from '../components/GcashModule.js';
import { OfficialReceiptModal } from '../components/OfficialReceiptModal.js';
import { LoanPaymentHistoryModal } from '../components/LoanPaymentHistoryModal.js';
import { OperationalLedger } from './OperationalLedger.js';
import { StaffLoanMonitoring } from '../components/StaffLoanMonitoring.js';
import { PmesComplianceManager } from '../components/PmesComplianceManager.js';
import { OfficialReceipt } from '../types.js';
import { LoanStatusBadge, LoanWorkflowStepper, formatLoanStatusLabel } from '../components/LoanStatusWorkflow.js';
import { SubmittedDocumentsSection } from '../components/SubmittedDocumentsSection.js';
import { LoanDocumentsSection } from '../components/LoanDocumentsSection.js';
import { DocumentViewerModal } from '../components/DocumentViewerModal.js';

const formatMoney = (val: number | string | null | undefined, options: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }): string => {
  if (val === null || val === undefined || val === '') return (0).toLocaleString('en-US', options);
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return (0).toLocaleString('en-US', options);
  return num.toLocaleString('en-US', options);
};

const formatIntegerMoney = (val: number | string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US');
};


interface StaffDashboardProps {
  token: string;
  activeTab: string;
  cooperativeName: string;
  onAvatarUpdate?: (newAvatarUrl: string) => void;
  onNavigate?: (tab: string) => void;
}

export function StaffDashboard({ token, activeTab, cooperativeName, onAvatarUpdate, onNavigate }: StaffDashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loanApplications, setLoanApplications] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [activeInquiryDetails, setActiveInquiryDetails] = useState<any>(null);
  const [activeInquiryId, setActiveInquiryId] = useState<string | null>(null);

  // Cashier Form States
  const [cashierMemberId, setCashierMemberId] = useState('');
  const [cashierType, setCashierType] = useState('DEPOSIT');
  const [cashierAccountType, setCashierAccountType] = useState('regularSavings');
  const [cashierAmount, setCashierAmount] = useState('');
  const [cashierDescription, setCashierDescription] = useState('');
  const [cashierReleaseMethod, setCashierReleaseMethod] = useState<'CASH' | 'GCASH'>('CASH');
  const [cashierGcashRef, setCashierGcashRef] = useState('');

  // Loan Review States
  const [reviewAppId, setReviewAppId] = useState('');
  const [reviewStatus, setReviewStatus] = useState('UNDER_REVIEW');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [loanAdditionalDocsInput, setLoanAdditionalDocsInput] = useState('');
  const [selectedLoanForReviewModal, setSelectedLoanForReviewModal] = useState<any | null>(null);
  const [selectedReceiptForModal, setSelectedReceiptForModal] = useState<OfficialReceipt | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    category: string;
    fileName: string;
    fileType: string;
    fileDataUrl: string;
    uploadedAt?: string;
  } | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);

  // Active Loans, Payments & History States
  const [activeLoansList, setActiveLoansList] = useState<any[]>([]);
  const [loanPaymentsList, setLoanPaymentsList] = useState<any[]>([]);
  const [staffLoanStatusFilter, setStaffLoanStatusFilter] = useState<'ACTION_REQUIRED' | 'ALL' | 'PENDING_REVIEW' | 'UNDER_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED' | 'WAITING_FOR_RELEASE' | 'REJECTED' | 'CANCELLED' | 'COMPLETED'>('ACTION_REQUIRED');
  const [staffLoanSearchQuery, setStaffLoanSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [historySort, setHistorySort] = useState<'NEWEST' | 'OLDEST' | 'AMOUNT_HIGH' | 'AMOUNT_LOW'>('NEWEST');
  const [selectedLoanPaymentHistory, setSelectedLoanPaymentHistory] = useState<any | null>(null);

  // Loan Disbursement Release Modal States
  const [disburseReleaseApp, setDisburseReleaseApp] = useState<any | null>(null);
  const [disburseMethod, setDisburseMethod] = useState<'CASH' | 'GCASH' | 'BANK_TRANSFER'>('CASH');
  const [disburseRefNo, setDisburseRefNo] = useState('');
  const [releaseAmountInput, setReleaseAmountInput] = useState('');
  const [releaseDateInput, setReleaseDateInput] = useState('');
  const [releaseRemarksInput, setReleaseRemarksInput] = useState('');
  const [eSignatureInput, setESignatureInput] = useState('');

  const openLoanReleaseModal = (app: any) => {
    setDisburseReleaseApp(app);
    setDisburseMethod('CASH');
    setDisburseRefNo('');
    setReleaseAmountInput(String(app.amount || 0));
    setReleaseDateInput(new Date().toISOString().split('T')[0]);
    setReleaseRemarksInput(app.remarks || 'Loan disbursement proceeds released to member.');
    setESignatureInput('');
  };

  const handleViewReceiptByNumberOrId = async (receiptNoOrId: string) => {
    try {
      const res = await fetch(`/api/receipts/${encodeURIComponent(receiptNoOrId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const receipt = await res.json();
        setSelectedReceiptForModal(receipt);
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.status === 'NOT_RELEASED') {
          triggerToast('Receipt not yet generated. Loan has not been released yet.', 'error');
          return;
        }

        // Secondary fetch via dedicated loan receipt endpoint
        const loanRes = await fetch(`/api/loans/${encodeURIComponent(receiptNoOrId)}/receipt`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (loanRes.ok) {
          const receipt = await loanRes.json();
          setSelectedReceiptForModal(receipt);
          return;
        }

        const loanErr = await loanRes.json().catch(() => ({}));
        if (loanErr.status === 'NOT_RELEASED') {
          triggerToast('Receipt not yet generated. Loan has not been released yet.', 'error');
          return;
        }

        // Check local list status if available
        const app = loanApplications.find(a => a.id === receiptNoOrId);
        if (app && !['RELEASED', 'DISBURSED', 'ACTIVE', 'PAID', 'COMPLETED'].includes(app.status)) {
          triggerToast('Receipt not yet generated. Loan has not been released yet.', 'error');
          return;
        }

        triggerToast('Receipt not yet generated.', 'error');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Error fetching receipt details', 'error');
    }
  };

  // Dividend Processing States
  const [divYear, setDivYear] = useState('2026');
  const [divSurplus, setDivSurplus] = useState('1000000');
  const [divRate, setDivRate] = useState('8.5');
  const [dividendPeriods, setDividendPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<any | null>(null);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [editingAllocationAmount, setEditingAllocationAmount] = useState<string>('');

  // Inquiry Reply State
  const [replyText, setReplyText] = useState('');

  // Member Application Review States
  const [selectedMemberForReview, setSelectedMemberForReview] = useState<any | null>(null);
  const [reviewNotesInput, setReviewNotesInput] = useState('');
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [additionalReqsInput, setAdditionalReqsInput] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<'PENDING' | 'ALL' | 'UNDER_REVIEW' | 'REVISION_REQUESTED' | 'ACTIVE' | 'REJECTED'>('PENDING');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Notification States
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Compliance Requirement States
  const [compRequirementType, setCompRequirementType] = useState<'PRE_MEMBERSHIP_SEMINAR' | 'LOAN_ORIENTATION' | 'KYC_VERIFICATION' | 'OTHER'>('PRE_MEMBERSHIP_SEMINAR');
  const [compStatus, setCompStatus] = useState<'COMPLETED' | 'PENDING_VERIFICATION' | 'NOT_COMPLETED' | 'REJECTED'>('COMPLETED');
  const [compDate, setCompDate] = useState('');
  const [compReference, setCompReference] = useState('');
  const [compRemarks, setCompRemarks] = useState('');

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 5000);
  };

  const openRecordAttendanceForm = (reqType: 'PRE_MEMBERSHIP_SEMINAR' | 'LOAN_ORIENTATION', existingRec?: any) => {
    setCompRequirementType(reqType);
    setCompStatus(existingRec && (existingRec.status === 'COMPLETED' || existingRec.status === 'VERIFIED') ? 'COMPLETED' : 'COMPLETED');
    setCompDate(
      existingRec?.attendedAt 
        ? new Date(existingRec.attendedAt).toISOString().split('T')[0] 
        : existingRec?.attendanceDate
        ? new Date(existingRec.attendanceDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setCompReference(existingRec?.reference || existingRec?.referenceNumber || '');
    setCompRemarks(existingRec?.remarks || '');
    
    // Smooth scroll to attendance form
    setTimeout(() => {
      const el = document.getElementById('record-pmes-compliance-form');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleUpdateCompliance = async (memberId: string) => {
    if (!compRequirementType || !compStatus) {
      triggerToast('Please select requirement type and status.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/users/members/compliance/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requirementUpdate: {
            type: compRequirementType,
            status: compStatus,
            date: compDate || new Date().toISOString().split('T')[0],
            reference: compReference,
            remarks: compRemarks
          }
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      triggerToast(`Compliance record for ${compRequirementType.replace(/_/g, ' ')} set to ${compStatus}! (Non-financial audit logged)`);
      // Reset form fields
      setCompReference('');
      setCompRemarks('');
      setCompDate('');
      
      // Refresh data
      loadData();
      if (selectedMemberForReview) {
        // Find fresh member data from the updated list
        const updatedMember = data.member;
        setSelectedMemberForReview(updatedMember);
      }
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const loadData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [
        statsRes,
        usersRes,
        laRes,
        activeRes,
        paymentsRes,
        inqRes,
        divRes,
      ] = await Promise.all([
        fetch('/api/dashboard/stats', { headers }),
        fetch('/api/users', { headers }),
        fetch('/api/loans/applications', { headers }),
        fetch('/api/loans/active', { headers }),
        fetch('/api/loans/payments', { headers }),
        fetch('/api/inquiries', { headers }),
        fetch('/api/dividends/periods', { headers }),
      ]);

      // Dashboard Stats
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats);
      }

      // Member Accounts (Includes pending verification)
      if (usersRes.ok) {
        const d = await usersRes.json();
        setMembers(d.members || []);
      }

      // Loan apps
      if (laRes.ok) {
        const d = await laRes.json();
        setLoanApplications(d || []);
      }

      // Active Loans
      if (activeRes.ok) {
        const d = await activeRes.json();
        setActiveLoansList(d || []);
      }

      // Loan Payments
      if (paymentsRes.ok) {
        const d = await paymentsRes.json();
        setLoanPaymentsList(d || []);
      }

      // Inquiries
      if (inqRes.ok) {
        const d = await inqRes.json();
        setInquiries(d || []);
      }

      // Dividend Periods
      if (divRes.ok) {
        const d = await divRes.json();
        setDividendPeriods(d || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (document.hidden) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
      loadData();
    }, 15000);

    // Listen for cross-tab updates (e.g. Member submitting a loan or new registration)
    let bcLoan: BroadcastChannel | null = null;
    let bcMember: BroadcastChannel | null = null;
    try {
      bcLoan = new BroadcastChannel('coop_loan_updates');
      bcLoan.onmessage = (event) => {
        if (event.data && event.data.type === 'LOAN_SUBMITTED') {
          loadData();
        }
      };
      bcMember = new BroadcastChannel('coop_member_updates');
      bcMember.onmessage = (event) => {
        if (event.data && (event.data.type === 'MEMBER_REGISTERED' || event.data.type === 'MEMBER_UPDATED')) {
          loadData();
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported', e);
    }

    return () => {
      clearInterval(interval);
      if (bcLoan) bcLoan.close();
      if (bcMember) bcMember.close();
    };
  }, []);

  // Member Approval / Review / Request Info
  
  const [isVerifyingShare, setIsVerifyingShare] = useState(false);

  const handleVerifyInitialShare = async (memberId: string) => {
    setIsVerifyingShare(true);
    try {
      const res = await fetch(`/api/staff/verify-initial-share/${memberId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify initial share payment');
      
      triggerToast(data.message, 'success');
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    } finally {
      setIsVerifyingShare(false);
    }
  };

  const handleRejectInitialShare = async (memberId: string) => {
    const reason = window.prompt('Enter reason for rejecting this initial share payment:') || 'Payment details could not be verified.';
    try {
      const res = await fetch(`/api/staff/reject-initial-share/${memberId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rejectionReason: reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject payment');
      triggerToast('Initial share payment rejected.', 'success');
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const handleVerifyMember = async (
    id: string,
    action: 'APPROVE' | 'REJECT' | 'REVIEW' | 'REQUEST_MORE',
    opts?: { reviewNotes?: string; rejectionReason?: string; additionalRequirementsRequested?: string }
  ) => {
    try {
      const res = await fetch(`/api/users/verify-member/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          reviewNotes: opts?.reviewNotes,
          rejectionReason: opts?.rejectionReason,
          additionalRequirementsRequested: opts?.additionalRequirementsRequested
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      let actionMsg = '';
      if (action === 'APPROVE') actionMsg = 'APPROVED & ACTIVATED';
      else if (action === 'REJECT') actionMsg = 'REJECTED';
      else if (action === 'REVIEW') actionMsg = 'marked as UNDER REVIEW';
      else if (action === 'REQUEST_MORE') actionMsg = 'updated with ADDITIONAL REQUIREMENTS REQUESTED';

      triggerToast(`Member application ${actionMsg} successfully!`);
      


      // Reset modal and reload
      setSelectedMemberForReview(null);
      setReviewNotesInput('');
      setRejectionReasonInput('');
      setAdditionalReqsInput('');
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Staff Loan Review - Direct Actions
  const handleApproveLoanApplication = async (appId: string) => {
    if (!appId) return;
    try {
      const res = await fetch(`/api/loans/review/${appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'WAITING_FOR_RELEASE',
          remarks: reviewRemarks || 'Application approved by credit staff. Moved to Approved Loans Waiting for Release.'
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast('Loan application APPROVED successfully! Moved to Approved Loans Waiting for Release.');
      setReviewRemarks('');
      setLoanAdditionalDocsInput('');
      setReviewAppId('');
      setSelectedLoanForReviewModal(null);
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const handleRequestAdditionalDocsForLoan = async (appId: string) => {
    if (!appId) return;
    try {
      const res = await fetch(`/api/loans/review/${appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'REVISION_REQUESTED',
          remarks: reviewRemarks || 'Additional supporting documentation required.',
          requestedAdditionalDocuments: loanAdditionalDocsInput ? loanAdditionalDocsInput.split(',').map(s => s.trim()).filter(Boolean) : ['Updated Payslip']
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast('Revision requested! Member notified to upload requested documents.');
      setReviewRemarks('');
      setLoanAdditionalDocsInput('');
      setReviewAppId('');
      setSelectedLoanForReviewModal(null);
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const handleRejectLoanApplication = async (appId: string) => {
    if (!appId) return;
    try {
      const res = await fetch(`/api/loans/review/${appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'REJECTED',
          remarks: reviewRemarks || 'Application declined as credit criteria were not satisfied.'
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast('Loan application REJECTED.', 'error');
      setReviewRemarks('');
      setLoanAdditionalDocsInput('');
      setReviewAppId('');
      setSelectedLoanForReviewModal(null);
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const handleReviewLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const appId = reviewAppId || selectedLoanForReviewModal?.id;
    if (!appId) return;

    if (reviewStatus === 'APPROVED' || reviewStatus === 'WAITING_FOR_RELEASE') {
      await handleApproveLoanApplication(appId);
    } else if (reviewStatus === 'REVISION_REQUESTED') {
      await handleRequestAdditionalDocsForLoan(appId);
    } else if (reviewStatus === 'REJECTED') {
      await handleRejectLoanApplication(appId);
    } else {
      try {
        const res = await fetch(`/api/loans/review/${appId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            status: reviewStatus,
            remarks: reviewRemarks,
            requestedAdditionalDocuments: loanAdditionalDocsInput ? loanAdditionalDocsInput.split(',').map(s => s.trim()).filter(Boolean) : undefined
          })
        });

        const d = await res.json();
        if (!res.ok) throw new Error(d.error);

        triggerToast(`Loan application status updated to ${reviewStatus.replace('_', ' ')}.`);
        setReviewRemarks('');
        setLoanAdditionalDocsInput('');
        setReviewAppId('');
        setSelectedLoanForReviewModal(null);
        loadData();
      } catch (err: any) {
        triggerToast(err.message, 'error');
      }
    }
  };

  const handleReviewLoanDocument = async (appId: string, docId: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
    try {
      const res = await fetch(`/api/loans/document-review/${appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          documentId: docId,
          status,
          rejectionReason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      triggerToast(`Document marked as ${status}`);
      if (selectedLoanForReviewModal && selectedLoanForReviewModal.id === appId) {
        setSelectedLoanForReviewModal((prev: any) => ({
          ...prev,
          documents: (prev.documents || []).map((d: any) => d.id === docId ? { ...d, status, rejectionReason } : d)
        }));
      }
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Staff/Cashier Loan Disbursement & Release Voucher Generation
  const handleDisburseLoan = async (
    appId: string,
    releaseMethod: 'CASH' | 'GCASH' | 'BANK_TRANSFER' = 'CASH',
    transactionRef?: string,
    releaseAmountVal?: number,
    releaseDateVal?: string,
    remarksVal?: string
  ) => {
    try {
      const res = await fetch(`/api/loans/disburse/${appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          releaseMethod,
          paymentMethod: releaseMethod,
          transactionReferenceNumber: transactionRef,
          transactionRef,
          gcashRefNumber: transactionRef,
          releaseAmount: releaseAmountVal,
          releaseDate: releaseDateVal,
          remarks: remarksVal
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      triggerToast(`Loan released via ${releaseMethod} successfully! Amortization schedule generated & release voucher issued.`);
      if (data.receipt) {
        setSelectedReceiptForModal(data.receipt);
      }
      setSelectedLoanForReviewModal(null);
      setDisburseReleaseApp(null);
      setDisburseRefNo('');
      setReleaseRemarksInput('');
      setReleaseAmountInput('');
      setReleaseDateInput('');
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Savings Cashiering (Receive Deposit / Withdrawal)
  const handleCashierTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierMemberId || !cashierAmount || Number(cashierAmount) <= 0) return;

    try {
      const res = await fetch('/api/savings/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          memberId: cashierMemberId,
          type: cashierType,
          accountType: cashierAccountType,
          amount: Number(cashierAmount),
          description: cashierDescription || `Over-the-counter Cashier ${cashierType}`,
          releaseMethod: cashierReleaseMethod,
          gcashRefNumber: cashierGcashRef
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast(`${cashierType} of ₱${Number(cashierAmount).toLocaleString()} processed successfully for member!`);
      
      setCashierAmount('');
      setCashierDescription('');
      setCashierGcashRef('');
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Dividend computation pipeline
  const handleComputeDividends = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/dividends/compute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          year: Number(divYear),
          totalNetSurplus: Number(divSurplus),
          dividendRate: Number(divRate)
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast(d.message);
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Dividend allocations and manual adjustments
  const fetchAllocations = async (periodId: string) => {
    try {
      const res = await fetch(`/api/dividends/allocations/${periodId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setAllocations(d || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdjustAllocation = async (id: string, amount: number) => {
    try {
      const res = await fetch(`/api/dividends/allocations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dividendAmount: amount })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      triggerToast('Dividend allocation manually adjusted successfully!');
      setEditingAllocationId(null);
      if (selectedPeriod) {
        fetchAllocations(selectedPeriod.id);
      }
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const handleDeletePeriod = async (periodId: string) => {
    if (!window.confirm('Are you sure you want to delete this computed dividend period? This will erase all draft member allocations for this year.')) return;
    try {
      const res = await fetch(`/api/dividends/periods/${periodId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      triggerToast('Computed dividend period successfully deleted.');
      setSelectedPeriod(null);
      setAllocations([]);
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Inquiry Replies
  const fetchInquiryDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setActiveInquiryDetails(d);
        setActiveInquiryId(id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText || !activeInquiryId) return;

    try {
      const res = await fetch(`/api/inquiries/reply/${activeInquiryId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: replyText })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setReplyText('');
      fetchInquiryDetails(activeInquiryId);
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const handleResolveInquiry = async (id: string) => {
    try {
      const res = await fetch(`/api/inquiries/resolve/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        triggerToast('Inquiry marked as RESOLVED and closed.');
        fetchInquiryDetails(id);
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // CSV Report Generator Simulator
  const handleExportCSV = (reportType: string) => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `coop_report_${reportType}.csv`;

    if (reportType === 'members') {
      headers = ['Member ID', 'Full Name', 'Email', 'Phone', 'Status', 'Share Capital', 'Regular Savings', 'Time Deposits'];
      rows = members.map(m => [m.id, m.fullName, m.email, m.phone, m.status, m.shareCapital, m.regularSavings, m.timeDeposits]);
    } else if (reportType === 'loans') {
      headers = ['Application ID', 'Member ID', 'Member Name', 'Loan Program', 'Amount', 'Months', 'Status', 'Amortization'];
      rows = loanApplications.map(a => [a.id, a.memberId, a.memberName, a.loanTypeName, a.amount, a.durationMonths, a.status, a.monthlyAmortization]);
    } else if (reportType === 'transactions') {
      headers = ['Transaction ID', 'Member Name', 'Type', 'Amount', 'Authorized By', 'Date'];
      rows = stats?.recentTransactions?.map((t: any) => [t.id, t.memberName, t.type, t.amount, t.processedBy, t.createdAt]) || [];
    }

    // Convert array to CSV string
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerToast(`Compiled and downloaded ${filename} successfully!`);
  };

  if (!stats) {
    return (
      <div className="flex-1 flex justify-center items-center h-screen bg-slate-50 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold font-mono tracking-wider">LOADING COOPERATIVE STAFF PORTAL SECURELY...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-slate-50/60 text-slate-900 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto" id="staff-dashboard-view">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-xl p-4 shadow-xl border text-sm flex gap-3 items-start animate-bounce ${
          toast.type === 'success' 
            ? 'bg-white border-emerald-200 text-emerald-800 shadow-md shadow-emerald-900/5' 
            : 'bg-white border-rose-200 text-rose-800 shadow-md shadow-rose-900/5'
        }`} id="staff-action-toast">
          {toast.type === 'success' ? <Check size={18} className="mt-0.5 text-emerald-600" /> : <AlertCircle size={18} className="mt-0.5 text-rose-600" />}
          <span>{toast.text}</span>
        </div>
      )}



      {/* GCash Verification Tab */}
      {activeTab === 'staff-gcash' && (
        <GcashModule token={token} role="STAFF" onRefreshStats={loadData} />
      )}

      {/* =======================================================================
          TAB: OPERATIONAL ANALYTICS
          ====================================================================== */}
      {activeTab === 'staff-analytics' && (
        <OperationalAnalytics token={token} onNavigate={onNavigate} />
      )}

      {/* =======================================================================
          TAB: OPERATIONAL LEDGER
          ====================================================================== */}
      {activeTab === 'staff-ledger' && (
        <OperationalLedger token={token} role="STAFF" />
      )}

      {/* =======================================================================
          TAB: PMES & MEMBERSHIP COMPLIANCE MANAGER
          ======================================================================= */}
      {activeTab === 'staff-pmes' && (
        <PmesComplianceManager token={token} role="STAFF" />
      )}

      {/* =======================================================================
          TAB 1: STAFF DASHBOARD & METRICS
          ====================================================================== */}
      {activeTab === 'staff-dashboard' && (
        <div className="space-y-6 animate-fade-in" id="tab-staff-dashboard">
          {/* Operations Center Header with Quick Export Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 shadow-sm p-5 rounded-2xl">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold font-mono uppercase tracking-wider">
                  Live Operations
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1">Cooperative Operations Dashboard</h2>
              <p className="text-xs text-slate-500 mt-0.5">Real-time stats, member registration queues, lending pipelines, and automated ledger monitoring.</p>
            </div>


          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 shadow-xs p-5 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Aggregate Members</span>
              <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">{stats.totalMembers} Registered</h3>
              <p className="text-[10px] text-emerald-600 mt-1.5 font-bold">{stats.pendingMembers} verification requests</p>
            </div>

            <div className="bg-white border border-slate-200 shadow-xs p-5 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Coop Vault Liquidity</span>
              <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">₱{formatIntegerMoney(stats?.totalSavingsVolume)}</h3>
              <p className="text-[10px] text-slate-500 mt-1.5">Accumulated cash in accounts</p>
            </div>

            <div className="bg-white border border-slate-200 shadow-xs p-5 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Outstanding Lending</span>
              <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">₱{formatIntegerMoney(stats?.totalOutstandingLoans)}</h3>
              <p className="text-[10px] text-slate-500 mt-1.5">{stats?.activeLoansCount || 0} active member loan books</p>
            </div>

            <div className="bg-white border border-slate-200 shadow-xs p-5 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Filing Pipelines</span>
              <h3 className="text-2xl font-bold font-mono text-rose-600 mt-1">{stats.pendingLoanApplicationsCount} Pending Loans</h3>
              <p className="text-[10px] text-slate-500 mt-1.5">{stats.openInquiriesCount} unresolved member inquiry tickets</p>
            </div>
          </div>

          {/* Pending Alerts block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Quick Pending Members Verify */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm">Members Registration Approvals Queue</h3>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('staff-verifications')}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer hover:underline"
                  >
                    View All ({members.filter(m => m.status === 'PENDING').length}) &rarr;
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
                {members.filter(m => m.status === 'PENDING').length > 0 ? (
                  members.filter(m => m.status === 'PENDING').map(m => (
                    <div key={m.id} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <h4 className="font-semibold text-slate-800">{m.fullName}</h4>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{m.email} • {m.phone}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedMemberForReview(m);
                            setReviewNotesInput(m.reviewNotes || '');
                            setRejectionReasonInput(m.rejectionReason || '');
                            setAdditionalReqsInput(m.additionalRequirementsRequested || '');
                          }}
                          className="px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-250 hover:bg-blue-600 hover:text-white rounded-lg transition-all cursor-pointer flex items-center gap-1 font-semibold text-[11px]"
                          title="Open Application & Review Documents"
                        >
                          <FileText size={13} />
                          Review
                        </button>
                        <button
                          onClick={() => handleVerifyMember(m.id, 'APPROVE')}
                          className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-250 hover:bg-emerald-600 hover:text-white rounded-lg transition-all cursor-pointer"
                          title="Approve Member Account"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => handleVerifyMember(m.id, 'REJECT')}
                          className="p-1.5 bg-rose-50 text-rose-700 border border-rose-250 hover:bg-rose-600 hover:text-white rounded-lg transition-all cursor-pointer"
                          title="Reject Account"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-mono py-10">
                    No membership registrations pending verification.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Loan reviews list */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Loan Applications Needing Review</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
                {loanApplications.filter(a => a.status === 'PENDING_REVIEW' || a.status === 'UNDER_REVIEW').length > 0 ? (
                  loanApplications.filter(a => a.status === 'PENDING_REVIEW' || a.status === 'UNDER_REVIEW').map(a => (
                    <div key={a.id} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <h4 className="font-semibold text-slate-800">{a.memberName}</h4>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{a.loanTypeName} • <span className="text-emerald-600 font-bold">₱{formatIntegerMoney(a?.amount)}</span></p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-mono bg-amber-50 border border-amber-200 text-amber-700 font-bold uppercase animate-pulse">
                        {a.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-mono py-10">
                    No loan applications waiting for operational staff review.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: MEMBER APPROVAL PANEL
          ======================================================================= */}
      {activeTab === 'staff-verifications' && (
        <div className="space-y-6">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in" id="tab-staff-verifications">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <span>Membership Verification Registry</span>
                {members.filter(m => m.status === 'PENDING').length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    {members.filter(m => m.status === 'PENDING').length} Pending Review
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Review, activate, or return new member submissions. Pending/Under-Review applicants cannot log in until approved.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="Search name, email, phone..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-56 transition-all"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['PENDING', 'ALL', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'ACTIVE', 'REJECTED'] as const).map((filterStatus) => {
                  const count = filterStatus === 'ALL' 
                    ? members.length 
                    : members.filter(m => m.status === filterStatus).length;
                  return (
                    <button
                      key={filterStatus}
                      onClick={() => setVerificationFilter(filterStatus)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        verificationFilter === filterStatus
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {filterStatus.replace('_', ' ')} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase">
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Registration Date</th>
                  <th className="py-3 px-4">Verification Status</th>
                  <th className="py-3 px-4 text-center">Process Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const filteredMembers = members.filter(m => {
                    if (verificationFilter !== 'ALL' && m.status !== verificationFilter) return false;
                    if (memberSearchQuery.trim()) {
                      const q = memberSearchQuery.toLowerCase();
                      const name = (m.fullName || '').toLowerCase();
                      const email = (m.email || '').toLowerCase();
                      const phone = (m.phone || '').toLowerCase();
                      return name.includes(q) || email.includes(q) || phone.includes(q);
                    }
                    return true;
                  }).sort((a, b) => {
                    if (verificationFilter === 'ALL') {
                      const aPending = a.status === 'PENDING' || a.status === 'UNDER_REVIEW' || a.status === 'REVISION_REQUESTED' ? 1 : 0;
                      const bPending = b.status === 'PENDING' || b.status === 'UNDER_REVIEW' || b.status === 'REVISION_REQUESTED' ? 1 : 0;
                      if (aPending !== bPending) return bPending - aPending;
                    }
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                  });

                  if (filteredMembers.length === 0) {
                    return (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-mono">
                          No cooperative profiles match this filter ({verificationFilter}).
                        </td>
                      </tr>
                    );
                  }

                  return filteredMembers.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {m.avatarUrl ? (
                            <img
                              src={m.avatarUrl}
                              alt={m.fullName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-bold text-xs font-mono uppercase">
                              {(m.fullName || '').substring(0, 2) || 'MB'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-800">{m.fullName}</div>
                            {m.occupation && <div className="text-[10px] text-slate-400 font-medium">{m.occupation}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{m.email}</td>
                      <td className="py-3.5 px-4 text-slate-500">{m.phone}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : m.status === 'PENDING'
                            ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
                            : m.status === 'UNDER_REVIEW'
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : m.status === 'REVISION_REQUESTED'
                            ? 'bg-orange-50 border-orange-200 text-orange-700'
                            : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}>
                          {m.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedMemberForReview(m);
                              setReviewNotesInput(m.reviewNotes || '');
                              setRejectionReasonInput(m.rejectionReason || '');
                              setAdditionalReqsInput(m.additionalRequirementsRequested || '');
                            }}
                            className={`px-3 py-1.5 rounded-xl font-semibold text-xs border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                              m.status === 'PENDING' || m.status === 'UNDER_REVIEW' || m.status === 'REVISION_REQUESTED'
                                ? 'bg-emerald-50 border-indigo-200 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-indigo-600 shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <FileText size={13} />
                            {m.status === 'PENDING' || m.status === 'UNDER_REVIEW' || m.status === 'REVISION_REQUESTED' ? 'Review & Verify' : 'View Profile'}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMemberForReview(m);
                              setReviewNotesInput(m.reviewNotes || '');
                              setRejectionReasonInput(m.rejectionReason || '');
                              setAdditionalReqsInput(m.additionalRequirementsRequested || '');
                              const pmes = (m.complianceRecords || []).find((r: any) => r.requirementType === 'PRE_MEMBERSHIP_SEMINAR');
                              openRecordAttendanceForm('PRE_MEMBERSHIP_SEMINAR', pmes);
                            }}
                            className="px-2.5 py-1.5 rounded-xl font-semibold text-xs border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs"
                            title="Manage PMES & Membership Compliance"
                          >
                            <ShieldCheck size={13} />
                            Compliance
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Initial Share Capital Payment Verification Queue */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in mt-6" id="tab-staff-share-verification">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Initial Share Capital Verification Queue</h3>
              <p className="text-xs text-slate-500 mt-1">Verify payments submitted by members to unlock their loan eligibility. Active members with pending payments appear here.</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted Date</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.filter(m => m.status === 'ACTIVE' && m.initialShareCapitalPledged > 0 && !m.initialShareCapitalPaid).length > 0 ? (
                  members.filter(m => m.status === 'ACTIVE' && m.initialShareCapitalPledged > 0 && !m.initialShareCapitalPaid).map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <div>{m.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">{m.memberNumber || m.id.substring(0, 8)}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-600 font-bold">₱{formatMoney(m?.initialShareCapitalPledged || 1000)}</td>
                      <td className="py-3.5 px-4">
                        {m.initialShareCapitalPaymentMethod ? (
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border ${
                            m.initialShareCapitalPaymentMethod === 'GCASH' 
                              ? 'bg-blue-50 border-blue-200 text-blue-700' 
                              : m.initialShareCapitalPaymentMethod === 'BANK_TRANSFER'
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          }`}>
                            {m.initialShareCapitalPaymentMethod}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">Awaiting member submission...</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {m.initialShareCapitalPaymentMethod === 'GCASH' || m.initialShareCapitalPaymentMethod === 'BANK_TRANSFER' ? (
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className="font-mono text-[10px] text-slate-700 font-bold">
                              Ref: {m.initialShareCapitalReference || 'N/A'}
                            </span>
                            {m.initialShareCapitalReceiptUrl ? (
                              <div className="flex items-center gap-2">
                                {m.initialShareCapitalReceiptUrl.startsWith('data:image') && (
                                  <img
                                    src={m.initialShareCapitalReceiptUrl}
                                    alt="Proof Thumbnail"
                                    className="w-7 h-7 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() =>
                                      setPreviewDoc({
                                        title: `Initial Share Payment Receipt - ${m.fullName}`,
                                        category: 'INITIAL_SHARE_RECEIPT',
                                        fileName: `Initial_Share_Receipt_${m.fullName.replace(/\s+/g, '_')}.png`,
                                        fileType: 'image/png',
                                        fileDataUrl: m.initialShareCapitalReceiptUrl!,
                                        uploadedAt: new Date().toISOString(),
                                      })
                                    }
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDoc({
                                      title: `Initial Share Payment Receipt - ${m.fullName}`,
                                      category: 'INITIAL_SHARE_RECEIPT',
                                      fileName: `Initial_Share_Receipt_${m.fullName.replace(/\s+/g, '_')}.png`,
                                      fileType: m.initialShareCapitalReceiptUrl!.startsWith('data:application/pdf') ? 'application/pdf' : 'image/png',
                                      fileDataUrl: m.initialShareCapitalReceiptUrl!,
                                      uploadedAt: new Date().toISOString(),
                                    })
                                  }
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-700 text-emerald-600 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Eye size={11} /> View Proof
                                </button>
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-600 rounded text-[10px] font-bold inline-flex items-center gap-1">
                                <AlertCircle size={10} /> Proof Missing
                              </span>
                            )}
                          </div>
                        ) : m.initialShareCapitalPaymentMethod === 'CASH' ? (
                          <span className="text-slate-500 text-[10px]">Pay at Office (Cashier)</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border ${
                          m.initialShareCapitalPaymentMethod
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}>
                          {m.initialShareCapitalPaymentMethod ? 'PENDING RECONCILIATION' : 'UNPAID'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {m.initialShareCapitalPaymentMethod ? 'Submitted' : 'Pending Member'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleVerifyInitialShare(m.id)}
                            disabled={isVerifyingShare || !m.initialShareCapitalPaymentMethod}
                            title="Verify & Reconcile Payment"
                            className={`px-2.5 py-1.5 rounded-xl font-semibold text-xs border transition-all cursor-pointer inline-flex items-center gap-1 ${
                              !m.initialShareCapitalPaymentMethod || isVerifyingShare
                                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 shadow-sm'
                            }`}
                          >
                            <CheckCircle2 size={13} />
                            {isVerifyingShare ? 'Posting...' : 'Reconcile'}
                          </button>
                          <button
                            onClick={() => handleRejectInitialShare(m.id)}
                            disabled={isVerifyingShare || !m.initialShareCapitalPaymentMethod}
                            title="Reject Payment Details"
                            className={`px-2 py-1.5 rounded-xl font-semibold text-xs border transition-all cursor-pointer inline-flex items-center gap-1 ${
                              !m.initialShareCapitalPaymentMethod || isVerifyingShare
                                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 shadow-sm'
                            }`}
                          >
                            <X size={13} />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-mono">No pending initial share capital verifications.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: STAFF LOAN REVIEW & RELEASE MODULE (4-SECTION LIFECYCLE)
          ======================================================================= */}
      {activeTab === 'staff-loan-monitoring' && (
        <StaffLoanMonitoring token={token} />
      )}

      {activeTab === 'staff-loans' && (() => {
        const selectedReviewApp = loanApplications.find(a => a.id === reviewAppId);
        const reviewMemberProfile = members.find(m => m.id === selectedReviewApp?.memberId) || {
          fullName: selectedReviewApp?.memberName,
          email: selectedReviewApp?.email || 'N/A',
          phone: selectedReviewApp?.mobileNumber || 'N/A',
          membershipStatus: 'ACTIVE',
          regularSavings: selectedReviewApp?.savingsBalance || 0,
          shareCapital: selectedReviewApp?.shareCapital || 0
        };
        const reviewMemberActiveLoans = activeLoansList.filter(l => l.memberId === selectedReviewApp?.memberId || l.memberName === selectedReviewApp?.memberName);

        const filteredHistoryLoans = loanApplications
          .filter(a => {
            if (historySearchQuery) {
              const q = historySearchQuery.trim().toLowerCase();
              const matchName = (a.memberName || '').toLowerCase().includes(q);
              const matchId = (a.id || '').toLowerCase().includes(q);
              const matchMemberId = (a.memberId || '').toLowerCase().includes(q);
              const matchProduct = (a.loanTypeName || '').toLowerCase().includes(q);
              if (!matchName && !matchId && !matchMemberId && !matchProduct) return false;
            }
            if (historyStatusFilter !== 'ALL') {
              if (historyStatusFilter === 'PENDING_REVIEW') {
                return a.status === 'PENDING_REVIEW';
              }
              if (historyStatusFilter === 'UNDER_REVIEW') {
                return a.status === 'UNDER_REVIEW';
              }
              if (historyStatusFilter === 'REVISION_REQUESTED') {
                return a.status === 'REVISION_REQUESTED';
              }
              if (historyStatusFilter === 'APPROVED') {
                return a.status === 'APPROVED';
              }
              if (historyStatusFilter === 'WAITING_FOR_RELEASE') {
                return a.status === 'WAITING_FOR_RELEASE';
              }
              if (historyStatusFilter === 'REJECTED') {
                return a.status === 'REJECTED';
              }
              if (historyStatusFilter === 'CANCELLED') {
                return a.status === 'CANCELLED' || a.status === 'WITHDRAWN';
              }
              if (historyStatusFilter === 'COMPLETED' || historyStatusFilter === 'RELEASED') {
                return ['RELEASED', 'DISBURSED', 'ACTIVE', 'COMPLETED', 'PAID', 'CLOSED'].includes(a.status);
              }
              return a.status === historyStatusFilter;
            }
            return true;
          })
          .sort((a, b) => {
            if (historySort === 'NEWEST') {
              return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            }
            if (historySort === 'OLDEST') {
              return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            }
            if (historySort === 'AMOUNT_HIGH') {
              return (b.amount || 0) - (a.amount || 0);
            }
            if (historySort === 'AMOUNT_LOW') {
              return (a.amount || 0) - (b.amount || 0);
            }
            return 0;
          });

        const displayedPendingApps = loanApplications
          .filter(a => {
            if (staffLoanSearchQuery) {
              const q = staffLoanSearchQuery.trim().toLowerCase();
              const matchName = (a.memberName || '').toLowerCase().includes(q);
              const matchAppId = (a.id || '').toLowerCase().includes(q);
              const matchMemberId = (a.memberId || '').toLowerCase().includes(q);
              const matchProduct = (a.loanTypeName || '').toLowerCase().includes(q);
              if (!matchName && !matchAppId && !matchMemberId && !matchProduct) return false;
            }
            if (staffLoanStatusFilter === 'ACTION_REQUIRED') {
              return ['PENDING_REVIEW', 'UNDER_REVIEW', 'REVISION_REQUESTED'].includes(a.status);
            }
            if (staffLoanStatusFilter === 'ALL') {
              return true;
            }
            if (staffLoanStatusFilter === 'PENDING_REVIEW') {
              return a.status === 'PENDING_REVIEW';
            }
            if (staffLoanStatusFilter === 'UNDER_REVIEW') {
              return a.status === 'UNDER_REVIEW';
            }
            if (staffLoanStatusFilter === 'REVISION_REQUESTED') {
              return a.status === 'REVISION_REQUESTED';
            }
            if (staffLoanStatusFilter === 'APPROVED') {
              return a.status === 'APPROVED';
            }
            if (staffLoanStatusFilter === 'WAITING_FOR_RELEASE') {
              return a.status === 'WAITING_FOR_RELEASE';
            }
            if (staffLoanStatusFilter === 'REJECTED') {
              return a.status === 'REJECTED';
            }
            if (staffLoanStatusFilter === 'CANCELLED') {
              return a.status === 'CANCELLED' || a.status === 'WITHDRAWN';
            }
            if (staffLoanStatusFilter === 'COMPLETED') {
              return ['RELEASED', 'DISBURSED', 'ACTIVE', 'COMPLETED', 'PAID', 'CLOSED'].includes(a.status);
            }
            return true;
          });

        const approvedWaitingReleaseApps = loanApplications.filter(a => ['APPROVED', 'WAITING_FOR_RELEASE'].includes(a.status));

        return (
          <div className="space-y-8 animate-fade-in" id="tab-staff-loans">
            
            {/* SECTION 1 – Pending & Active Loan Applications */}
            <div className="bg-white border border-amber-200 shadow-xs rounded-2xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-amber-700 font-mono uppercase tracking-widest bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                    Section 1
                  </span>
                  <h3 className="font-extrabold text-slate-800 text-lg mt-1 flex items-center gap-2">
                    <Clock size={20} className="text-amber-500" />
                    Loan Applications Queue
                  </h3>
                  <p className="text-xs text-slate-500">
                    Authoritative queue of all active loan applications requiring staff action or review.
                  </p>
                </div>
                <span className="px-3.5 py-1 bg-amber-100 text-amber-900 font-mono text-xs font-extrabold rounded-full self-start md:self-auto">
                  {displayedPendingApps.length} Applications Shown
                </span>
              </div>

              {/* Search and Filters for Section 1 */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      id="input-staff-loan-search"
                      value={staffLoanSearchQuery}
                      onChange={(e) => setStaffLoanSearchQuery(e.target.value)}
                      placeholder="Search by Member Name, Member ID, Application ID, or Loan Product..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label htmlFor="select-staff-loan-status" className="text-xs font-bold text-slate-500 font-mono">Filter Status:</label>
                    <select
                      id="select-staff-loan-status"
                      value={staffLoanStatusFilter}
                      onChange={(e) => setStaffLoanStatusFilter(e.target.value as any)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="ACTION_REQUIRED">Action Required (Default)</option>
                      <option value="ALL">All</option>
                      <option value="PENDING_REVIEW">Pending Review</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="REVISION_REQUESTED">Revision Requested</option>
                      <option value="APPROVED">Approved</option>
                      <option value="WAITING_FOR_RELEASE">Waiting for Release</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="CANCELLED">Cancelled</option>
                      <option value="COMPLETED">Completed/Released</option>
                    </select>
                  </div>
                </div>

                {/* Quick Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold">
                  {[
                    { id: 'ACTION_REQUIRED', label: 'Action Required' },
                    { id: 'ALL', label: 'All' },
                    { id: 'PENDING_REVIEW', label: 'Pending Review' },
                    { id: 'UNDER_REVIEW', label: 'Under Review' },
                    { id: 'REVISION_REQUESTED', label: 'Revision Requested' },
                    { id: 'APPROVED', label: 'Approved' },
                    { id: 'WAITING_FOR_RELEASE', label: 'Waiting for Release' },
                    { id: 'REJECTED', label: 'Rejected' },
                    { id: 'CANCELLED', label: 'Cancelled' },
                    { id: 'COMPLETED', label: 'Completed/Released' },
                  ].map(pill => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setStaffLoanStatusFilter(pill.id as any)}
                      className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        staffLoanStatusFilter === pill.id
                          ? 'bg-emerald-600 text-white font-bold shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-3 px-4">Application ID</th>
                      <th className="py-3 px-4">Member Name & ID</th>
                      <th className="py-3 px-4">Loan Product</th>
                      <th className="py-3 px-4">Loan Amount</th>
                      <th className="py-3 px-4">Submission Date</th>
                      <th className="py-3 px-4">Status & Stage</th>
                      <th className="py-3 px-4">Reviewer</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedPendingApps.length > 0 ? (
                      displayedPendingApps.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800">#{a.id}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{a.memberName}</span>
                            <span className="font-mono text-[10px] text-slate-400">ID: {a.memberId}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 font-semibold">{a.loanTypeName}</td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-600">
                            ₱{(a.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3.5 px-4">
                            <LoanStatusBadge status={a.status} />
                            <span className="block text-[10px] text-slate-500 font-medium mt-0.5">
                              Stage: {formatLoanStatusLabel(a.status)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                            {a.reviewerName || (a.reviewedBy ? `Staff: ${a.reviewedBy}` : 'Unassigned')}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewAppId(a.id);
                                setReviewStatus(a.status === 'PENDING_REVIEW' ? 'UNDER_REVIEW' : a.status);
                                setReviewRemarks(a.remarks || '');
                                const el = document.getElementById('section-loan-review');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 mx-auto"
                            >
                              <FileCheck size={14} /> Review
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-mono bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                          No loan applications match your current filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 2 – Loan Review & Decision */}
            <div id="section-loan-review" className="bg-white border border-indigo-200 shadow-xs rounded-2xl p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-widest bg-emerald-50 border border-indigo-200 px-2.5 py-0.5 rounded-md">
                    Section 2
                  </span>
                  <h3 className="font-extrabold text-slate-800 text-lg mt-1 flex items-center gap-2">
                    <FileCheck size={20} className="text-emerald-600" />
                    Loan Review & Decision
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review member profile, financial snapshot, and uploaded documents to render a verdict.
                  </p>
                </div>

                <div className="w-full md:w-auto">
                  <select
                    value={reviewAppId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setReviewAppId(id);
                      const selected = loanApplications.find(a => a.id === id);
                      if (selected) {
                        setReviewStatus(selected.status === 'PENDING_REVIEW' ? 'UNDER_REVIEW' : selected.status);
                        setReviewRemarks(selected.remarks || '');
                      }
                    }}
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-80"
                  >
                    <option value="">-- Choose Application to Review --</option>
                    {loanApplications.map(a => (
                      <option key={a.id} value={a.id}>
                        [{a.status.replace('_', ' ')}] {a.memberName} — ₱{(a.amount || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedReviewApp ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <FileCheck size={36} className="mx-auto text-slate-300" />
                  <h4 className="font-bold text-slate-700 text-sm">No Application Selected for Review</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Click "Review" on any application in Section 1 or pick an application from the dropdown above to load borrower details and decision buttons.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Overview Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Member Profile */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-wider block">
                        Member Profile
                      </span>
                      <div className="space-y-1.5 text-xs">
                        <div className="font-extrabold text-slate-900 text-sm">{reviewMemberProfile.fullName || selectedReviewApp.memberName}</div>
                        <div className="text-slate-500 flex items-center gap-1">
                          <span className="font-mono text-[10px] bg-slate-200/60 text-slate-700 px-2 py-0.5 rounded">
                            {reviewMemberProfile.memberNumber || ('MEM-' + selectedReviewApp.memberId.substring(0, 6).toUpperCase())}
                          </span>
                        </div>
                        <div className="text-slate-600 font-mono text-[11px] pt-1 space-y-0.5">
                          <div>Email: <strong className="text-slate-800">{reviewMemberProfile.email || selectedReviewApp.email || 'N/A'}</strong></div>
                          <div>Phone: <strong className="text-slate-800">{reviewMemberProfile.phone || reviewMemberProfile.mobileNumber || selectedReviewApp.mobileNumber || 'N/A'}</strong></div>
                          <div>Status: <span className="text-emerald-700 font-bold uppercase">{reviewMemberProfile.membershipStatus || 'ACTIVE'}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Loan Details */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-wider block">
                        Loan Details
                      </span>
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="text-slate-600">Product: <strong className="text-slate-900">{selectedReviewApp.loanTypeName}</strong></div>
                        <div className="text-slate-600">Requested Amount: <strong className="text-emerald-600 text-sm">₱{(selectedReviewApp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>
                        <div className="text-slate-600">Term: <strong className="text-slate-800">{selectedReviewApp.durationMonths} Months</strong></div>
                        <div className="text-slate-600">Monthly Amortization: <strong className="text-emerald-700">₱{(selectedReviewApp.monthlyAmortization || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>
                        {selectedReviewApp.purpose && (
                          <div className="text-[11px] text-slate-500 truncate pt-0.5">Purpose: {selectedReviewApp.purpose}</div>
                        )}
                      </div>
                    </div>

                    {/* Financial Snapshot */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-wider block">
                        Savings & Share Capital Snapshot
                      </span>
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200/80">
                          <span className="text-slate-500">Savings Balance:</span>
                          <strong className="text-emerald-700 font-extrabold">
                            ₱{Number(reviewMemberProfile.regularSavings ?? reviewMemberProfile.savingsBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200/80">
                          <span className="text-slate-500">Share Capital:</span>
                          <strong className="text-emerald-600 font-extrabold">
                            ₱{Number(reviewMemberProfile.shareCapital ?? reviewMemberProfile.shareCapitalBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-600 pt-0.5">
                          <span>Existing Active Loans:</span>
                          <strong className={reviewMemberActiveLoans.some(l => (l.balance || 0) > 0) ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}>
                            {reviewMemberActiveLoans.length} active (₱{reviewMemberActiveLoans.reduce((sum, l) => sum + (l.balance || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })})
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* One-Active-Loan Policy: Member Active Loan & Repayment History Inspection */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className={reviewMemberActiveLoans.some(l => (l.balance || 0) > 0) ? "text-amber-600" : "text-emerald-600"} />
                        <span className="text-[10px] font-bold text-slate-700 uppercase font-mono tracking-wider">
                          Active Loan & Credit Policy Inspection (One-Active-Loan Rule)
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-full ${
                        reviewMemberActiveLoans.some(l => (l.balance || 0) > 0)
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      }`}>
                        {reviewMemberActiveLoans.some(l => (l.balance || 0) > 0) ? "ACTIVE LOAN DETECTED" : "COMPLIANT (NO ACTIVE LOAN)"}
                      </span>
                    </div>

                    {reviewMemberActiveLoans.length > 0 ? (
                      <div className="space-y-2.5">
                        {reviewMemberActiveLoans.map((loan: any) => {
                          const isPastDue = loan.dueDate ? new Date(loan.dueDate) < new Date() && (loan.balance || 0) > 0 : false;
                          const hasBalance = (loan.balance || 0) > 0;
                          return (
                            <div key={loan.id} className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                              hasBalance ? "bg-amber-50/70 border-amber-200" : "bg-emerald-50/50 border-emerald-200"
                            }`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="font-bold text-slate-900 font-mono text-xs">
                                    {loan.loanTypeName} (#{loan.id.substring(0, 8).toUpperCase()})
                                  </span>
                                  <span className="text-[10px] text-slate-500 block font-mono">
                                    Disbursed: {loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleDateString() : 'N/A'} • Term: {loan.durationMonths} mos
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isPastDue ? (
                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold font-mono text-[9px] rounded-md border border-rose-200">
                                      ⚠️ PAST DUE
                                    </span>
                                  ) : hasBalance ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold font-mono text-[9px] rounded-md border border-emerald-200">
                                      ✓ CURRENT
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold font-mono text-[9px] rounded-md border border-slate-200">
                                      ✓ FULLY PAID
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold font-mono text-[9px] rounded-md">
                                    {loan.status}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/60 text-[11px] font-mono">
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Outstanding Balance:</span>
                                  <strong className={`text-xs ${hasBalance ? "text-rose-700 font-extrabold" : "text-emerald-700 font-bold"}`}>
                                    ₱{Number(loan.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Original Principal:</span>
                                  <span className="text-slate-800 font-bold">₱{Number(loan.principalAmount || 0).toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Due Date:</span>
                                  <span className={`font-bold ${isPastDue ? "text-rose-700" : "text-slate-800"}`}>
                                    {loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 block">Monthly Amortization:</span>
                                  <span className="text-slate-800 font-bold">₱{Number(loan.monthlyAmortization || 0).toLocaleString()}</span>
                                </div>
                              </div>

                              <div className="pt-1 flex items-center justify-between gap-2">
                                <p className="text-[10px] text-slate-600 font-medium">
                                  {hasBalance
                                    ? "Policy note: Member has an outstanding balance on this loan. One active loan allowed at a time."
                                    : "Loan balance is ₱0.00. Account is settled and does not block new applications."}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setSelectedLoanPaymentHistory(loan)}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
                                >
                                  <Calendar size={12} className="text-amber-600" />
                                  Inspect Repayment Schedule & History
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-emerald-900 font-medium">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span>No Active Loans — Member has zero outstanding loan balances and satisfies the One-Active-Loan Policy.</span>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono rounded-full">
                          POLICY SATISFIED
                        </span>
                      </div>
                    )}
                  </div>

                  {/* LOAN DOCUMENTS Review Section */}
                  <LoanDocumentsSection
                    applicationId={selectedReviewApp.id}
                    memberId={selectedReviewApp.memberId}
                    memberName={selectedReviewApp.memberName}
                    documents={selectedReviewApp.documents || []}
                    token={token}
                    onReviewDocument={handleReviewLoanDocument}
                    canReview={true}
                  />

                  {/* Staff Remarks & Revision Input */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                        Staff Remarks / Review Notes
                      </label>
                      <textarea
                        rows={3}
                        value={reviewRemarks}
                        onChange={(e) => setReviewRemarks(e.target.value)}
                        placeholder="Record official review notes e.g., 'Passed debt-to-income check. Qualification confirmed.'"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-purple-700 uppercase font-mono mb-1.5">
                        Required Additional Documents (If Requesting Revision)
                      </label>
                      <input
                        type="text"
                        value={loanAdditionalDocsInput}
                        onChange={(e) => setLoanAdditionalDocsInput(e.target.value)}
                        placeholder="e.g. Updated Payslip, Barangay Clearance, Co-Maker ID"
                        className="w-full px-3.5 py-2.5 bg-purple-50/50 border border-purple-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Separate multiple document types with commas.</p>
                    </div>
                  </div>

                  {/* Decision Actions - Provided strictly as requested */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => handleRejectLoanApplication(selectedReviewApp.id)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <XCircle size={16} /> Reject Application
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRequestAdditionalDocsForLoan(selectedReviewApp.id)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FileText size={16} /> Request Revision
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApproveLoanApplication(selectedReviewApp.id)}
                      className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={16} /> Approve Application
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3 – Approved Loans Waiting for Release */}
            <div className="bg-white border border-emerald-200 shadow-xs rounded-2xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 font-mono uppercase tracking-widest bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                    Section 3
                  </span>
                  <h3 className="font-extrabold text-slate-800 text-lg mt-1 flex items-center gap-2">
                    <Wallet size={20} className="text-emerald-600" />
                    Approved Loans Waiting for Release
                  </h3>
                  <p className="text-xs text-slate-500">
                    Display only approved loans awaiting disbursement release.
                  </p>
                </div>
                <span className="px-3.5 py-1 bg-emerald-100 text-emerald-900 font-mono text-xs font-extrabold rounded-full self-start md:self-auto">
                  {approvedWaitingReleaseApps.length} Ready for Release
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-3 px-4">Loan Number</th>
                      <th className="py-3 px-4">Member Name</th>
                      <th className="py-3 px-4">Loan Product</th>
                      <th className="py-3 px-4">Approved Amount</th>
                      <th className="py-3 px-4">Approved Date</th>
                      <th className="py-3 px-4">Release Method</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {approvedWaitingReleaseApps.length > 0 ? (
                      approvedWaitingReleaseApps.map(a => (
                        <tr key={a.id} className="hover:bg-emerald-50/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800">#{a.id.substring(0, 10)}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">{a.memberName}</td>
                          <td className="py-3.5 px-4 text-slate-700 font-semibold">{a.loanTypeName}</td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-700 text-sm">
                            ₱{(a.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : (a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'N/A')}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-lg border border-slate-200 uppercase">
                              {a.disbursementMethod || 'CASH'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => openLoanReleaseModal(a)}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 mx-auto"
                            >
                              <Wallet size={14} /> Release Loan
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-mono bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                          No approved loans currently awaiting disbursement release.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 4 – Loan History */}
            <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-widest bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">
                    Section 4
                  </span>
                  <h3 className="font-extrabold text-slate-800 text-lg mt-1 flex items-center gap-2">
                    <History size={20} className="text-slate-600" />
                    Loan History
                  </h3>
                  <p className="text-xs text-slate-500">
                    Display every loan application regardless of status.
                  </p>
                </div>

                {/* Search, Filters, and Sorting */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      placeholder="Search member, ID, product..."
                      className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-56"
                    />
                  </div>

                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING_REVIEW">Pending Review</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="REVISION_REQUESTED">Revision Requested</option>
                    <option value="APPROVED">Approved</option>
                    <option value="WAITING_FOR_RELEASE">Waiting for Release</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="COMPLETED">Completed / Released</option>
                  </select>

                  <select
                    value={historySort}
                    onChange={(e) => setHistorySort(e.target.value as any)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="NEWEST">Newest First</option>
                    <option value="OLDEST">Oldest First</option>
                    <option value="AMOUNT_HIGH">Highest Amount</option>
                    <option value="AMOUNT_LOW">Lowest Amount</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-3 px-4">Application ID</th>
                      <th className="py-3 px-4">Member Name</th>
                      <th className="py-3 px-4">Loan Product</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Submission Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistoryLoans.length > 0 ? (
                      filteredHistoryLoans.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700">#{a.id.substring(0, 10)}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">{a.memberName}</td>
                          <td className="py-3.5 px-4 text-slate-700 font-semibold">{a.loanTypeName}</td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-slate-800">
                            ₱{(a.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3.5 px-4">
                            <LoanStatusBadge status={a.status} />
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* View Details */}
                              <button
                                type="button"
                                onClick={() => setSelectedLoanForReviewModal(a)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-700 text-emerald-600 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                title="View Details"
                              >
                                <Eye size={12} /> View Details
                              </button>

                              {/* View Receipt */}
                              {['APPROVED', 'WAITING_FOR_RELEASE', 'DISBURSED', 'RELEASED', 'ACTIVE', 'PAID', 'COMPLETED'].includes(a.status) && (
                                <button
                                  type="button"
                                  onClick={() => handleViewReceiptByNumberOrId(a.id)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                  title="View Receipt"
                                >
                                  <Receipt size={12} /> View Receipt
                                </button>
                              )}

                              {/* View Payment History */}
                              <button
                                type="button"
                                onClick={() => setSelectedLoanPaymentHistory(a)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                title="View Payment History"
                              >
                                <History size={12} /> View Payment History
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-mono bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                          No loan applications found matching your search and filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        );
      })()}

      {/* =======================================================================
          TAB 4: CASHIER (RECEIVE DEPOSIT / WITHDRAWAL)
          ======================================================================= */}
      {(activeTab === 'staff-cashier' || activeTab === 'staff-withdrawals' || activeTab === 'staff-time-deposits') && (
        <div className="space-y-6 animate-fade-in" id="tab-staff-cashier">
          
          {/* Cashier Transaction Form */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
              <Wallet size={20} className="text-emerald-600" />
              Over-the-Counter Cashier Desk
            </h3>
            <form onSubmit={handleCashierTransaction} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Member Account</label>
                  <select
                    required
                    value={cashierMemberId}
                    onChange={e => setCashierMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Member...</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.fullName} ({m.memberNumber || m.id.substring(0, 8)})</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Transaction Type</label>
                    <select
                      value={cashierType}
                      onChange={e => {
                        setCashierType(e.target.value);
                        if (e.target.value === 'DEPOSIT') setCashierReleaseMethod('CASH');
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="DEPOSIT">DEPOSIT</option>
                      <option value="WITHDRAWAL">WITHDRAWAL</option>
                      <option value="REFUND">REFUND</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Account Sub-Type</label>
                    <select
                      value={cashierAccountType}
                      onChange={e => setCashierAccountType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="regularSavings">Regular Savings</option>
                      <option value="timeDeposits">Time Deposits</option>
                      <option value="shareCapital">Share Capital</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Amount (₱)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={cashierAmount}
                    onChange={e => setCashierAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Memo / Description</label>
                  <input
                    type="text"
                    value={cashierDescription}
                    onChange={e => setCashierDescription(e.target.value)}
                    placeholder={`e.g. Over-the-counter ${cashierType}`}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {(cashierType === 'WITHDRAWAL' || cashierType === 'REFUND') && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                    <h4 className="font-bold text-slate-700 text-xs uppercase font-mono">Disbursement Method</h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCashierReleaseMethod('CASH')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${cashierReleaseMethod === 'CASH' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        <Wallet size={14} className="inline mr-1" /> CASH
                      </button>
                      <button
                        type="button"
                        onClick={() => setCashierReleaseMethod('GCASH')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${cashierReleaseMethod === 'GCASH' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        <QrCode size={14} className="inline mr-1" /> GCASH
                      </button>
                    </div>

                    {cashierReleaseMethod === 'GCASH' && (() => {
                      const tgt = members.find(m => m.id === cashierMemberId);
                      if (!tgt) return <p className="text-xs text-slate-500 italic">Select a member first.</p>;
                      
                      if (!tgt.gcashNumber) {
                        return (
                          <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-red-700 text-xs font-semibold mt-2">
                            ⚠️ This member does not have a registered GCash number in their profile. GCash disbursement cannot be processed. Please ask the member to update their profile or choose Cash.
                          </div>
                        );
                      }

                      const gcashName = tgt.gcashAccountName || tgt.fullName;
                      const gcashNum = tgt.gcashNumber;
                      
                      return (
                        <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-sm space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <span className="text-[10px] font-bold text-blue-700 uppercase font-mono">Member GCash Info</span>
                            {tgt.gcashQrCodeUrl && (
                              <a href={tgt.gcashQrCodeUrl} target="_blank" rel="noreferrer" className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 hover:bg-blue-200 transition-colors">
                                <Eye size={10} /> View QR
                              </a>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] text-slate-400 block font-mono uppercase">Account Name</span>
                              <span className="text-xs font-bold text-slate-800">{gcashName}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block font-mono uppercase">Mobile Number</span>
                              <span className="text-xs font-bold text-blue-700 font-mono">{gcashNum}</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase font-mono mb-1">GCash Transaction Ref No. *</label>
                            <input
                              type="text"
                              required
                              value={cashierGcashRef}
                              onChange={e => setCashierGcashRef(e.target.value)}
                              placeholder="e.g. 1029384756"
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                
                <div className="pt-4 mt-auto">
                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex justify-center items-center gap-2"
                  >
                    <Check size={16} />
                    Process {cashierType} & Generate Receipt
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Master recent ledger */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <h3 className="font-bold text-slate-800 text-lg mb-4">Operational Recent Transactions ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase">
                    <th className="py-3 px-4">Ref ID</th>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Memo</th>
                    <th className="py-3 px-4">Authorized Teller</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recentTransactions && stats.recentTransactions.length > 0 ? (
                    stats.recentTransactions.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono text-slate-400">{t.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{t.memberName}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                            t.type === 'DEPOSIT' || t.type === 'DIVIDEND_CREDIT' || t.type === 'LOAN_RELEASE'
                              ? 'bg-emerald-50 border border-emerald-250 text-emerald-700'
                              : 'bg-rose-50 border border-rose-250 text-rose-700'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">₱{formatIntegerMoney(t?.amount)}</td>
                        <td className="py-3 px-4 text-slate-500 max-w-[200px]">
                          <div className="truncate">{t.description}</div>
                          {t.releaseMethod === 'GCASH' && (
                            <div className="text-[9px] text-blue-600 mt-0.5 font-mono">
                              GCash: {t.gcashNumber || 'N/A'} (Ref: {t.gcashRefNumber || 'N/A'})
                            </div>
                          )}
                          {t.releaseMethod === 'CASH' && (
                            <div className="text-[9px] text-emerald-600 mt-0.5 font-mono">
                              Method: CASH
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">{t.processedBy}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 font-mono">No recent transaction posts.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* =======================================================================
          TAB 5: MEMBER INQUIRY DESK
          ======================================================================= */}
      {activeTab === 'staff-inquiries' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="tab-staff-inquiries">
          
          {/* Inquiry selection column */}
          <div className="lg:col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-lg">Member Inquiry Pipeline</h3>
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto scrollbar-thin">
              {inquiries.length > 0 ? (
                inquiries.map(i => (
                  <button
                    key={i.id}
                    onClick={() => fetchInquiryDetails(i.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                      activeInquiryId === i.id
                        ? 'bg-emerald-50 border-indigo-500 text-emerald-600 shadow-sm font-bold'
                        : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full text-[10px]">
                      <span className="font-mono text-slate-400">{i.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold font-mono uppercase ${
                        i.status === 'RESOLVED'
                          ? 'bg-emerald-50 border border-emerald-250 text-emerald-700'
                          : i.status === 'IN_PROGRESS'
                          ? 'bg-blue-50 border border-blue-250 text-blue-700'
                          : 'bg-amber-50 border border-amber-200 text-amber-700 animate-pulse'
                      }`}>
                        {i.status}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-800 text-xs truncate w-full">{i.subject}</h4>
                    <span className="text-[10px] text-slate-500 font-medium">By Member: {i.memberName}</span>
                  </button>
                ))
              ) : (
                <div className="text-center text-slate-400 text-xs font-mono py-8">
                  No member inquiry tickets submitted yet.
                </div>
              )}
            </div>
          </div>

          {/* Inquiry conversation details column */}
          <div className="lg:col-span-2">
            {activeInquiryId && activeInquiryDetails ? (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 h-full flex flex-col justify-between space-y-4">
                
                {/* Header */}
                <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Subject: {activeInquiryDetails.inquiry.subject}</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Author Member: {activeInquiryDetails.inquiry.memberName} • Ticket: {activeInquiryDetails.inquiry.id}</p>
                  </div>
                  {activeInquiryDetails.inquiry.status !== 'RESOLVED' && (
                    <button
                      onClick={() => handleResolveInquiry(activeInquiryDetails.inquiry.id)}
                      className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider font-mono bg-emerald-50 border border-emerald-250 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg transition-all cursor-pointer"
                    >
                      Close & Resolve ticket
                    </button>
                  )}
                </div>

                {/* Conversation Box */}
                <div className="flex-1 overflow-y-auto max-h-[400px] p-2 space-y-3 scrollbar-thin">
                  
                  {/* Original */}
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-emerald-600 flex-shrink-0 font-mono">
                      MB
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1 max-w-[85%]">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Member: {activeInquiryDetails.inquiry.memberName}</span>
                      <p className="text-xs text-slate-800 leading-relaxed">{activeInquiryDetails.inquiry.message}</p>
                      <span className="text-[9px] text-slate-400 font-mono block">{new Date(activeInquiryDetails.inquiry.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Replies Map */}
                  {activeInquiryDetails.replies.map((rep: any) => {
                    const isStaff = rep.senderRole === 'STAFF' || rep.senderRole === 'ADMIN';
                    return (
                      <div key={rep.id} className={`flex gap-3 items-start ${isStaff ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          isStaff ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-emerald-600'
                        }`}>
                          {isStaff ? 'ST' : 'MB'}
                        </div>
                        <div className={`p-3.5 rounded-2xl border space-y-1 max-w-[85%] ${
                          isStaff 
                            ? 'bg-emerald-50 border-indigo-150 text-emerald-600' 
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest font-mono block">
                            {rep.senderName} ({rep.senderRole})
                          </span>
                          <p className="text-xs leading-relaxed">{rep.message}</p>
                          <span className="text-[9px] text-slate-400 font-mono block">{new Date(rep.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}

                </div>

                {/* Reply Form */}
                {activeInquiryDetails.inquiry.status !== 'RESOLVED' ? (
                  <form onSubmit={handleReplySubmit} className="flex gap-2 border-t border-slate-200 pt-3">
                    <input
                      type="text"
                      required
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write operational support response to member..."
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white flex items-center justify-center transition-all cursor-pointer shadow-sm shadow-indigo-950/10"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                ) : (
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-mono">
                    This support channel thread has been resolved and locked.
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 h-full flex flex-col justify-center items-center text-slate-400 text-center py-24">
                <HelpCircle size={36} className="text-slate-300 mb-2.5" />
                <h4 className="font-bold text-slate-800">Inquiry Response Terminal</h4>
                <p className="text-xs max-w-sm mt-1 text-slate-500">Select an active customer inquiry thread from the left menu panel to view detailed chat threads and post official staff replies.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* =======================================================================
          TAB 6: DIVIDEND COMPUTATION TOOL
          ======================================================================= */}
      {activeTab === 'staff-dividends' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="tab-staff-dividends">
          
          {/* Column 1: Computation Form & History */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-slate-800 text-lg">Cooperative Yield Estimator</h3>
              <p className="text-xs text-slate-500">Formulate and compute simulated dividend allocations for the active member registry based on fiscal net returns.</p>

              <form onSubmit={handleComputeDividends} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Fiscal Calendar Year</label>
                  <input
                    type="number"
                    required
                    value={divYear}
                    onChange={(e) => setDivYear(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Net Cooperative Operational Surplus (₱)</label>
                  <input
                    type="number"
                    required
                    value={divSurplus}
                    onChange={(e) => setDivSurplus(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Dividend Yield Distribution Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={divRate}
                    onChange={(e) => setDivRate(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs text-white uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-950/10 cursor-pointer"
                >
                  Estimate & Compute Dividend allocations
                </button>
              </form>
            </div>

            {/* COMPUTED DIVIDEND PERIODS LIST */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Percent size={16} className="text-emerald-600" />
                Computation History
              </h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
                {dividendPeriods.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-mono">
                    No computed dividend periods.
                  </div>
                ) : (
                  dividendPeriods.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => {
                        setSelectedPeriod(p);
                        fetchAllocations(p.id);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                        selectedPeriod?.id === p.id 
                          ? 'bg-emerald-50/50 border-indigo-500 shadow-sm' 
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-800 text-xs">Fiscal Year {p.year}</h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">Surplus: ₱{formatMoney(p?.totalNetSurplus)}</p>
                          <p className="text-[10px] text-emerald-600 font-bold font-mono">Rate: {(((p?.dividendRate ?? 0) * 100)).toFixed(2)}%</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-mono font-bold uppercase ${
                            p.status === 'DISTRIBUTED' 
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                              : 'bg-amber-50 border border-amber-200 text-amber-700 animate-pulse'
                          }`}>
                            {p.status}
                          </span>
                          {p.status !== 'DISTRIBUTED' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePeriod(p.id);
                              }}
                              className="text-rose-600 hover:text-rose-700 text-[10px] font-bold font-mono transition-all"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Allocations, Adjustments & Guidelines */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPeriod ? (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      Member Allocations for Year {selectedPeriod.year}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Adjust individual dividend credit amounts below. Status: <span className="font-semibold text-emerald-600 font-mono uppercase text-[10px]">{selectedPeriod.status}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => { setSelectedPeriod(null); setAllocations([]); }}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </div>

                <div className="overflow-x-auto scrollbar-thin rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono text-[10px] uppercase">
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Snapshot Capital</th>
                        <th className="py-3 px-4">Snapshot Savings</th>
                        <th className="py-3 px-4">Computed Dividend</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allocations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 font-mono">No allocations found.</td>
                        </tr>
                      ) : (
                        allocations.map(a => {
                          const isEditing = editingAllocationId === a.id;
                          return (
                            <tr key={a.id} className="hover:bg-slate-50/50">
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-800 block">{a.memberName}</span>
                                <span className="text-[9px] text-slate-400 font-mono">{a.memberId}</span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-700">₱{formatMoney(a?.shareCapitalSnapshot)}</td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">₱{formatMoney(a?.regularSavingsSnapshot)}</td>
                              <td className="py-3.5 px-4">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingAllocationAmount}
                                    onChange={(e) => setEditingAllocationAmount(e.target.value)}
                                    className="w-24 px-2 py-1 bg-white border border-indigo-500 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                                  />
                                ) : (
                                  <span className="font-mono font-bold text-slate-900">₱{formatMoney(a?.dividendAmount)}</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {selectedPeriod.status === 'DISTRIBUTED' ? (
                                  <span className="text-emerald-600 text-[10px] font-mono font-semibold">DISTRIBUTED</span>
                                ) : isEditing ? (
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => handleAdjustAllocation(a.id, Number(editingAllocationAmount))}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingAllocationId(null)}
                                      className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingAllocationId(a.id);
                                      setEditingAllocationAmount(a.dividendAmount.toString());
                                    }}
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-700 text-emerald-600 rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
                                  >
                                    Adjust Amount
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col justify-center space-y-4 h-full">
                <span className="text-xs font-mono text-emerald-600 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Percent size={14} />
                  Operational Division Formula guidelines
                </span>
                <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                  <p>
                    When you click <strong>"Estimate & Compute Dividend allocations"</strong>, the backend logic scans the active membership database, snapshots each member's equity <strong>Share Capital</strong>, and allocates dividend credits computed as:
                  </p>
                  <div className="bg-emerald-50/50 p-3 rounded-2xl border border-indigo-100 font-mono text-emerald-600 text-center font-bold text-[11px]">
                    Member Allocation = Individual Share Capital × Snapshotted Rate (%)
                  </div>
                  <p>
                    These allocations are generated in <strong>"COMPUTED"</strong> status, serving as a draft ledger. The final distribution authorization remains restricted strictly to the <strong>Administrator account</strong>, who locks the calculations and credits the allocations to the members' liquid savings.
                  </p>
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[11px] text-slate-400 italic">
                      💡 Select any computation year from the History log to review individual members, modify credit amounts, or delete the computation periods.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* =======================================================================
          TAB 7: EXCEL SIMULATOR REPORTS
          ======================================================================= */}
      {activeTab === 'staff-reports' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in" id="tab-staff-reports">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Export Operational Excel Reports</h3>
            <p className="text-xs text-slate-500 mt-1">Simulate official financial audit reports, compile active files, and trigger CSV table spreadsheet exports instantly.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Box 1 */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3.5 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="p-2 w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-indigo-100 flex items-center justify-center">
                  <Users size={20} />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">Active Members Directory</h4>
                <p className="text-xs text-slate-500">Complete spreadsheet log of all registered cooperative members, contact details, and their combined savings books.</p>
              </div>
              <button
                onClick={() => handleExportCSV('members')}
                className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Download size={14} />
                Download CSV Spreadsheet
              </button>
            </div>

            {/* Box 2 */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3.5 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="p-2 w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">Loan Bookings & Processing Audit</h4>
                <p className="text-xs text-slate-500">Aggregated report of historical loan application structures, filed durations, amortizations, and outstanding borrowing states.</p>
              </div>
              <button
                onClick={() => handleExportCSV('loans')}
                className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Download size={14} />
                Download CSV Spreadsheet
              </button>
            </div>

            {/* Box 3 */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3.5 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="p-2 w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                  <Wallet size={20} />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">Vault Transactions ledger log</h4>
                <p className="text-xs text-slate-500">Snapshot audit trace log of deposits, cash withdrawals, dividend credits, and payment transaction entries on database.</p>
              </div>
              <button
                onClick={() => handleExportCSV('transactions')}
                className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Download size={14} />
                Download CSV Spreadsheet
              </button>
            </div>

          </div>

          <div className="pt-6 border-t border-slate-200">
            <OperationalAnalytics token={token} onNavigate={onNavigate} />
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB: SMS NOTIFICATIONS & REMINDERS
          ======================================================================= */}
      {activeTab === 'staff-sms' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in" id="tab-staff-sms">
          <div>
            <h3 className="font-extrabold text-slate-800 text-xl">Cooperative Automated Messaging Outbox</h3>
            <p className="text-xs text-slate-500 mt-1">Audit, monitor, and manually re-dispatch automated SMS payment alerts for upcoming, due, and overdue borrowing balances.</p>
          </div>
          <SmsManager token={token} />
        </div>
      )}

      {/* =======================================================================
          MEMBER REVIEW & VERIFICATION DETAILED MODAL
          ======================================================================= */}
      {selectedMemberForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col animate-fade-in">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3.5">
                {selectedMemberForReview.avatarUrl ? (
                  <img
                    src={selectedMemberForReview.avatarUrl}
                    alt={selectedMemberForReview.fullName}
                    className="w-11 h-11 rounded-full object-cover border border-indigo-200 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-emerald-50 border border-indigo-100 flex items-center justify-center text-emerald-600 font-extrabold text-base uppercase font-mono shadow-sm">
                    {(selectedMemberForReview.fullName || '').substring(0, 2) || 'MB'}
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-widest bg-emerald-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                    Applicant Review Hub
                  </span>
                  <h4 className="font-bold text-slate-800 text-lg mt-0.5">{selectedMemberForReview.fullName}</h4>
                </div>
              </div>
              <button
                onClick={() => setSelectedMemberForReview(null)}
                className="p-1.5 hover:bg-slate-150 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Application Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60">
                <div className="space-y-3 text-xs">
                  <h5 className="font-bold text-slate-700 text-xs border-b border-slate-200 pb-1 uppercase tracking-wider">Personal Profile</h5>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Gender</span>
                      <span className="font-semibold text-slate-800 capitalize">{selectedMemberForReview.gender || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Birthdate</span>
                      <span className="font-semibold text-slate-800 font-mono">{selectedMemberForReview.birthdate || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Civil Status</span>
                      <span className="font-semibold text-slate-800 capitalize">{selectedMemberForReview.civilStatus || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Address</span>
                      <span className="font-semibold text-slate-800">{selectedMemberForReview.address || 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <h5 className="font-bold text-slate-700 text-xs border-b border-slate-200 pb-1 uppercase tracking-wider">Financial & Economic Status</h5>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Occupation</span>
                      <span className="font-semibold text-slate-800">{selectedMemberForReview.occupation || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Monthly Income</span>
                      <span className="font-semibold text-slate-800">{selectedMemberForReview.monthlyIncome ? `₱${Number(selectedMemberForReview.monthlyIncome).toLocaleString()}` : 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Initial Share Pledged</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        ₱{Number(selectedMemberForReview.initialShareCapitalPledged || selectedMemberForReview.initialShareCapital || 2000).toLocaleString()}{' '}
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${selectedMemberForReview.initialShareCapitalPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {selectedMemberForReview.initialShareCapitalPaid ? 'PAID' : 'UNPAID'}
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Contact Details</span>
                      <span className="font-semibold text-slate-800 font-mono">{selectedMemberForReview.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Authoritative Financial Balances (Staff Read-Only View) */}
                {(() => {
                  const memberLoanBalance = (activeLoansList || [])
                    .filter((l: any) => l.memberId === selectedMemberForReview.id)
                    .reduce((sum: number, l: any) => sum + (Number(l.balance ?? l.outstandingBalance ?? 0)), 0);

                  return (
                    <div className="md:col-span-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase font-mono tracking-wider">
                          Authoritative Financial Balances
                        </span>
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-200 text-slate-600 rounded border border-slate-300">
                          READ ONLY
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                          <span className="text-[9px] uppercase font-mono text-slate-400 block">Share Capital</span>
                          <span className="text-xs font-bold text-slate-800 font-mono block mt-0.5">
                            ₱{Number(selectedMemberForReview.shareCapital || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400">[READ ONLY]</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                          <span className="text-[9px] uppercase font-mono text-slate-400 block">Regular Savings</span>
                          <span className="text-xs font-bold text-slate-800 font-mono block mt-0.5">
                            ₱{Number(selectedMemberForReview.regularSavings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400">[READ ONLY]</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                          <span className="text-[9px] uppercase font-mono text-slate-400 block">Time Deposits</span>
                          <span className="text-xs font-bold text-slate-800 font-mono block mt-0.5">
                            ₱{Number(selectedMemberForReview.timeDeposits || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400">[READ ONLY]</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                          <span className="text-[9px] uppercase font-mono text-slate-400 block">Loan Balance</span>
                          <span className="text-xs font-bold text-slate-800 font-mono block mt-0.5">
                            ₱{memberLoanBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400">[READ ONLY]</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 italic">
                        Financial balances are updated only through verified financial transactions.
                      </p>
                    </div>
                  );
                })()}

                <div className="md:col-span-2 space-y-2 text-xs border-t border-slate-200/60 pt-4">
                  <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Emergency Contact</h5>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/50 text-[11px] grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-mono">Name</span>
                      <span className="font-semibold text-slate-800">{selectedMemberForReview.emergencyContact?.name || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-mono">Relationship</span>
                      <span className="font-semibold text-slate-800">{selectedMemberForReview.emergencyContact?.relationship || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-mono">Phone</span>
                      <span className="font-semibold text-slate-800 font-mono">{selectedMemberForReview.emergencyContact?.phone || 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                {/* Member Personal GCash Information (Read-Only Reference for Staff/Admin) */}
                <div className="md:col-span-2 space-y-2 text-xs border-t border-slate-200/60 pt-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <QrCode size={14} className="text-emerald-600" />
                      Member GCash Payout Account Details (Disbursements & Refunds)
                    </h5>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-mono">
                      Staff Reference
                    </span>
                  </div>

                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-150 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">GCash Account Name</span>
                      <span className="font-bold text-slate-900 text-xs uppercase">{selectedMemberForReview.gcashAccountName || 'Not configured'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">GCash Mobile Number</span>
                      <span className="font-bold text-slate-900 text-xs font-mono">{selectedMemberForReview.gcashNumber || 'Not configured'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Last Updated</span>
                      <span className="font-bold text-slate-900 text-xs font-mono">{selectedMemberForReview.gcashUpdatedAt ? new Date(selectedMemberForReview.gcashUpdatedAt).toLocaleDateString() : 'Unknown'}</span>
                    </div>
                    <div className="text-center sm:text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-mono mb-1">GCash QR Code</span>
                      {selectedMemberForReview.gcashQrCodeUrl ? (
                        <a
                          href={selectedMemberForReview.gcashQrCodeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-xs transition-all"
                        >
                          <Eye size={12} />
                          Preview Full QR
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No QR uploaded</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SUBMITTED DOCUMENTS Section */}
              <SubmittedDocumentsSection
                memberId={selectedMemberForReview.id}
                memberName={selectedMemberForReview.fullName}
                documents={(() => {
                  let docsList = selectedMemberForReview.memberDocuments || [];
                  if (docsList.length === 0) {
                    docsList = [];
                    if (selectedMemberForReview.govIdUrl) {
                      docsList.push({
                        id: `doc_${selectedMemberForReview.id}_govid`,
                        memberId: selectedMemberForReview.id,
                        memberName: selectedMemberForReview.fullName,
                        fileName: selectedMemberForReview.govIdFileName || 'government_id.jpg',
                        fileType: selectedMemberForReview.govIdUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
                        documentCategory: 'GOV_ID',
                        fileDataUrl: selectedMemberForReview.govIdUrl,
                        fileSize: Math.round(selectedMemberForReview.govIdUrl.length * 0.75),
                        status: selectedMemberForReview.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
                        uploadedAt: selectedMemberForReview.createdAt
                      });
                    }
                    if (selectedMemberForReview.selfieUrl) {
                      docsList.push({
                        id: `doc_${selectedMemberForReview.id}_selfie`,
                        memberId: selectedMemberForReview.id,
                        memberName: selectedMemberForReview.fullName,
                        fileName: selectedMemberForReview.selfieFileName || 'selfie_photo.jpg',
                        fileType: selectedMemberForReview.selfieUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
                        documentCategory: 'SELFIE',
                        fileDataUrl: selectedMemberForReview.selfieUrl,
                        fileSize: Math.round(selectedMemberForReview.selfieUrl.length * 0.75),
                        status: selectedMemberForReview.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
                        uploadedAt: selectedMemberForReview.createdAt
                      });
                    }
                    if (selectedMemberForReview.supportingDocUrl) {
                      docsList.push({
                        id: `doc_${selectedMemberForReview.id}_supp`,
                        memberId: selectedMemberForReview.id,
                        memberName: selectedMemberForReview.fullName,
                        fileName: selectedMemberForReview.supportingDocFileName || 'proof_of_income_billing.pdf',
                        fileType: selectedMemberForReview.supportingDocUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
                        documentCategory: 'INCOME_PROOF',
                        fileDataUrl: selectedMemberForReview.supportingDocUrl,
                        fileSize: Math.round(selectedMemberForReview.supportingDocUrl.length * 0.75),
                        status: selectedMemberForReview.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
                        uploadedAt: selectedMemberForReview.createdAt
                      });
                    }
                  }
                  return docsList;
                })()}
                memberStatus={selectedMemberForReview.status}
                token={token}
                onDocumentStatusChange={(docId, status, notes) => {
                  setSelectedMemberForReview((prev: any) => {
                    if (!prev) return null;
                    const updatedDocs = (prev.memberDocuments || []).map((d: any) =>
                      d.id === docId ? { ...d, status, notes } : d
                    );
                    return {
                      ...prev,
                      memberDocuments: updatedDocs
                    };
                  });
                  loadData();
                }}
                canReview={true}
              />

              {/* Membership Compliance & Requirements */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                  <div>
                    <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-indigo-600" />
                      Membership Compliance & Requirements (PMES / Orientation)
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Non-financial verification records required for member loan eligibility.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md self-start sm:self-auto">
                    Non-Financial Module
                  </span>
                </div>

                {/* Structured Compliance Requirements Table (Section 12) */}
                {(() => {
                  const records = selectedMemberForReview.complianceRecords || [];
                  const pmesRec = records.find((r: any) => r.requirementType === 'PRE_MEMBERSHIP_SEMINAR');
                  const orientRec = records.find((r: any) => r.requirementType === 'LOAN_ORIENTATION');

                  const renderStatusBadge = (rec: any) => {
                    const status = rec?.status || 'NOT_COMPLETED';
                    if (status === 'COMPLETED' || status === 'VERIFIED') {
                      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle2 size={11} /> COMPLETED</span>;
                    }
                    if (status === 'PENDING_VERIFICATION' || status === 'ATTENDED') {
                      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200"><Clock size={11} /> ATTENDED / PENDING</span>;
                    }
                    if (status === 'REJECTED') {
                      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200"><AlertCircle size={11} /> REJECTED</span>;
                    }
                    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">NOT COMPLETED</span>;
                  };

                  return (
                    <div className="space-y-4">
                      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px] uppercase">
                              <th className="py-2.5 px-3 font-bold">Requirement</th>
                              <th className="py-2.5 px-3 font-bold">Status</th>
                              <th className="py-2.5 px-3 font-bold">Attendance Date</th>
                              <th className="py-2.5 px-3 font-bold">Verified By</th>
                              <th className="py-2.5 px-3 font-bold">Reference #</th>
                              <th className="py-2.5 px-3 font-bold text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {/* PMES */}
                            <tr className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-800 text-xs">Pre-membership Education Seminar (PMES)</div>
                                <div className="text-[10px] text-slate-400">Mandatory cooperative education requirement</div>
                              </td>
                              <td className="py-3 px-3">
                                {renderStatusBadge(pmesRec)}
                              </td>
                              <td className="py-3 px-3 text-slate-600 text-[11px] font-mono">
                                {pmesRec?.attendedAt || pmesRec?.attendanceDate 
                                  ? new Date(pmesRec.attendedAt || pmesRec.attendanceDate).toLocaleDateString() 
                                  : '—'}
                              </td>
                              <td className="py-3 px-3 text-slate-600 text-[11px]">
                                {pmesRec?.verifiedBy || '—'}
                              </td>
                              <td className="py-3 px-3 text-slate-600 text-[11px] font-mono">
                                {pmesRec?.reference || pmesRec?.referenceNumber || '—'}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {pmesRec?.status === 'COMPLETED' || pmesRec?.status === 'VERIFIED' ? (
                                  <button
                                    type="button"
                                    onClick={() => openRecordAttendanceForm('PRE_MEMBERSHIP_SEMINAR', pmesRec)}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    View / Edit
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openRecordAttendanceForm('PRE_MEMBERSHIP_SEMINAR', pmesRec)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <FileCheck size={12} /> Record PMES Attendance
                                  </button>
                                )}
                              </td>
                            </tr>

                            {/* Loan Orientation */}
                            <tr className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-800 text-xs">Loan Orientation & Credit Counseling</div>
                                <div className="text-[10px] text-slate-400">Credit counseling & borrower education</div>
                              </td>
                              <td className="py-3 px-3">
                                {renderStatusBadge(orientRec)}
                              </td>
                              <td className="py-3 px-3 text-slate-600 text-[11px] font-mono">
                                {orientRec?.attendedAt || orientRec?.attendanceDate 
                                  ? new Date(orientRec.attendedAt || orientRec.attendanceDate).toLocaleDateString() 
                                  : '—'}
                              </td>
                              <td className="py-3 px-3 text-slate-600 text-[11px]">
                                {orientRec?.verifiedBy || '—'}
                              </td>
                              <td className="py-3 px-3 text-slate-600 text-[11px] font-mono">
                                {orientRec?.reference || orientRec?.referenceNumber || '—'}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {orientRec?.status === 'COMPLETED' || orientRec?.status === 'VERIFIED' ? (
                                  <button
                                    type="button"
                                    onClick={() => openRecordAttendanceForm('LOAN_ORIENTATION', orientRec)}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    View / Edit
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openRecordAttendanceForm('LOAN_ORIENTATION', orientRec)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <FileCheck size={12} /> Record Attendance
                                  </button>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Checklist Cards & Record Attendance Form Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Detailed Compliance Records / Checklist */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Member Compliance Checklist
                            </p>
                            <span className="text-[10px] font-mono text-slate-400">
                              {records.filter((r: any) => r.status === 'COMPLETED' || r.status === 'VERIFIED').length} / 2 Verified
                            </span>
                          </div>

                          {/* PMES Card */}
                          <div className={`p-4 rounded-xl border transition-all ${
                            pmesRec?.status === 'COMPLETED' || pmesRec?.status === 'VERIFIED'
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                {pmesRec?.status === 'COMPLETED' || pmesRec?.status === 'VERIFIED' ? (
                                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                ) : (
                                  <Clock size={16} className="text-slate-400 shrink-0" />
                                )}
                                <h6 className="font-bold text-xs text-slate-800">
                                  Pre-membership Education Seminar (PMES)
                                </h6>
                              </div>
                              {renderStatusBadge(pmesRec)}
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-600 pt-2 border-t border-slate-200/60">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-mono">ATTENDANCE DATE</span>
                                <span>{pmesRec?.attendedAt || pmesRec?.attendanceDate ? new Date(pmesRec.attendedAt || pmesRec.attendanceDate).toLocaleDateString() : 'Not attended yet'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-mono">VERIFIED BY</span>
                                <span>{pmesRec?.verifiedBy || 'Pending verification'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-mono">VERIFICATION DATE</span>
                                <span>{pmesRec?.verifiedAt || pmesRec?.completedAt ? new Date(pmesRec.verifiedAt || pmesRec.completedAt).toLocaleDateString() : '—'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-mono">REFERENCE / CERT #</span>
                                <span>{pmesRec?.reference || pmesRec?.referenceNumber || 'None recorded'}</span>
                              </div>
                            </div>
                            {pmesRec?.remarks && (
                              <div className="mt-2 text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200">
                                <span className="font-semibold text-slate-700">Remarks:</span> {pmesRec.remarks}
                              </div>
                            )}
                          </div>

                          {/* Loan Orientation Card */}
                          <div className={`p-4 rounded-xl border transition-all ${
                            orientRec?.status === 'COMPLETED' || orientRec?.status === 'VERIFIED'
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                {orientRec?.status === 'COMPLETED' || orientRec?.status === 'VERIFIED' ? (
                                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                ) : (
                                  <Clock size={16} className="text-slate-400 shrink-0" />
                                )}
                                <h6 className="font-bold text-xs text-slate-800">
                                  Loan Orientation & Credit Counseling
                                </h6>
                              </div>
                              {renderStatusBadge(orientRec)}
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-600 pt-2 border-t border-slate-200/60">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-mono">ATTENDANCE DATE</span>
                                <span>{orientRec?.attendedAt || orientRec?.attendanceDate ? new Date(orientRec.attendedAt || orientRec.attendanceDate).toLocaleDateString() : 'Not attended yet'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-mono">VERIFIED BY</span>
                                <span>{orientRec?.verifiedBy || 'Pending verification'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-mono">VERIFICATION DATE</span>
                                <span>{orientRec?.verifiedAt || orientRec?.completedAt ? new Date(orientRec.verifiedAt || orientRec.completedAt).toLocaleDateString() : '—'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-mono">REFERENCE / CERT #</span>
                                <span>{orientRec?.reference || orientRec?.referenceNumber || 'None recorded'}</span>
                              </div>
                            </div>
                            {orientRec?.remarks && (
                              <div className="mt-2 text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200">
                                <span className="font-semibold text-slate-700">Remarks:</span> {orientRec.remarks}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Record PMES Attendance & Verification Form (Section 3) */}
                        <div id="record-pmes-compliance-form" className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <div>
                              <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                                Record Attendance & Verification
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Member: <strong>{selectedMemberForReview.fullName}</strong> ({selectedMemberForReview.idNumber || selectedMemberForReview.id.substring(0, 8)})
                              </p>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                              Staff Control
                            </span>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase font-mono block mb-1">
                                Requirement Type *
                              </label>
                              <select 
                                value={compRequirementType}
                                onChange={(e: any) => setCompRequirementType(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                              >
                                <option value="PRE_MEMBERSHIP_SEMINAR">Pre-membership Education Seminar (PMES)</option>
                                <option value="LOAN_ORIENTATION">Loan Orientation & Credit Counseling</option>
                                <option value="KYC_VERIFICATION">KYC Review & Member Identity Verification</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase font-mono block mb-1">
                                  Attendance Date *
                                </label>
                                <input 
                                  type="date"
                                  value={compDate}
                                  onChange={(e) => setCompDate(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase font-mono block mb-1">
                                  Verification Status *
                                </label>
                                <select 
                                  value={compStatus}
                                  onChange={(e: any) => setCompStatus(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                  <option value="COMPLETED">COMPLETED (Verified for Loan Eligibility)</option>
                                  <option value="PENDING_VERIFICATION">PENDING VERIFICATION (Attended)</option>
                                  <option value="NOT_COMPLETED">NOT COMPLETED (Reset Status)</option>
                                  <option value="REJECTED">REJECTED (Failed / Disapproved)</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase font-mono block mb-1">
                                Reference / Certificate Number
                              </label>
                              <input 
                                type="text"
                                placeholder="e.g., PMES-2026-00125 or Batch #34"
                                value={compReference}
                                onChange={(e) => setCompReference(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase font-mono block mb-1">
                                Staff Remarks / Internal Notes
                              </label>
                              <textarea 
                                placeholder="Enter attendance batch, certificate confirmation, or verification notes..."
                                value={compRemarks}
                                onChange={(e) => setCompRemarks(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none h-16 resize-none"
                              />
                            </div>

                            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
                              <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <strong>Architectural Rule:</strong> Seminar completion is recorded in the non-financial compliance registry and audit log. It does not create financial journal transactions or alter share capital/savings balances.
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUpdateCompliance(selectedMemberForReview.id)}
                              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <FileCheck size={14} /> Save & Confirm Attendance / Verification
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Status History / Logs if existing */}
              {(selectedMemberForReview.reviewNotes || selectedMemberForReview.rejectionReason || selectedMemberForReview.additionalRequirementsRequested) && (
                <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/60 space-y-2 text-xs">
                  <h5 className="font-bold text-amber-800 uppercase tracking-wider text-[11px]">Previous Action History</h5>
                  <div className="space-y-1">
                    {selectedMemberForReview.reviewNotes && (
                      <p className="text-slate-700"><strong>Review Notes:</strong> {selectedMemberForReview.reviewNotes}</p>
                    )}
                    {selectedMemberForReview.additionalRequirementsRequested && (
                      <p className="text-slate-700"><strong>Additional Requirements Requested:</strong> {selectedMemberForReview.additionalRequirementsRequested}</p>
                    )}
                    {selectedMemberForReview.rejectionReason && (
                      <p className="text-rose-700"><strong>Rejection Reason:</strong> {selectedMemberForReview.rejectionReason}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Active Processing Forms (Only if PENDING, UNDER_REVIEW, or REVISION_REQUESTED) */}
              {(selectedMemberForReview.status === 'PENDING' || selectedMemberForReview.status === 'UNDER_REVIEW' || selectedMemberForReview.status === 'REVISION_REQUESTED') && (
                <div className="border-t border-slate-200 pt-6 space-y-4">
                  <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Execute Workflow Action</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Action 1: Under Review or Request More */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase font-mono block">Review Notes</span>
                      <textarea
                        value={reviewNotesInput}
                        onChange={(e) => setReviewNotesInput(e.target.value)}
                        placeholder="Type standard internal review notes..."
                        className="w-full text-xs p-2 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 h-20"
                      />
                      <button
                        onClick={() => handleVerifyMember(selectedMemberForReview.id, 'REVIEW', { reviewNotes: reviewNotesInput })}
                        disabled={!reviewNotesInput.trim()}
                        className="w-full py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white font-semibold text-xs rounded-xl border border-indigo-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Set to Under Review
                      </button>
                    </div>

                    {/* Action 2: Request More */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <span className="text-[10px] font-bold text-amber-700 uppercase font-mono block">Request Requirements</span>
                      <textarea
                        value={additionalReqsInput}
                        onChange={(e) => setAdditionalReqsInput(e.target.value)}
                        placeholder="Specify extra document or detail needed e.g., 'Please re-upload a clear copy of your SS Card'"
                        className="w-full text-xs p-2 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 h-20"
                      />
                      <button
                        onClick={() => handleVerifyMember(selectedMemberForReview.id, 'REQUEST_MORE', {
                          reviewNotes: reviewNotesInput,
                          additionalRequirementsRequested: additionalReqsInput
                        })}
                        disabled={!additionalReqsInput.trim()}
                        className="w-full py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-600 text-amber-700 hover:text-white font-semibold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Request Requirements
                      </button>
                    </div>

                    {/* Action 3: Rejection */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <span className="text-[10px] font-bold text-rose-600 uppercase font-mono block">Decline Application</span>
                      <textarea
                        value={rejectionReasonInput}
                        onChange={(e) => setRejectionReasonInput(e.target.value)}
                        placeholder="State official reason for decline..."
                        className="w-full text-xs p-2 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 h-20"
                      />
                      <button
                        onClick={() => handleVerifyMember(selectedMemberForReview.id, 'REJECT', { rejectionReason: rejectionReasonInput })}
                        disabled={!rejectionReasonInput.trim()}
                        className="w-full py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-600 text-rose-700 hover:text-white font-semibold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject & Decline
                      </button>
                    </div>
                  </div>

                  {/* Ultimate Action: Approve */}
                  <div className="bg-emerald-50/50 border border-emerald-200/80 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
                    <div className="text-xs">
                      <h6 className="font-bold text-emerald-800 uppercase tracking-wide">Finalize & Activate Account</h6>
                      <p className="text-emerald-700 mt-0.5">This completes the background check, assigns the Member role, sends their credentials, and enables live platform access.</p>
                    </div>
                    <button
                      onClick={() => handleVerifyMember(selectedMemberForReview.id, 'APPROVE', { reviewNotes: reviewNotesInput })}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-950/10 cursor-pointer"
                    >
                      Approve & Activate Profile
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMemberForReview(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-100 transition-all cursor-pointer shadow-sm"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Loan Document Review & Verdict Inspector Modal */}
      {selectedLoanForReviewModal && (() => {
        const app = selectedLoanForReviewModal;
        const principal = app.amount || 0;
        const duration = app.durationMonths || 12;
        const interestRate = app.interestRatePerAnnum || 12;
        const monthlyPrincipal = principal / duration;
        const totalInterest = principal * (interestRate / 100) * (duration / 12);
        const monthlyInterest = totalInterest / duration;
        const monthlyTotal = monthlyPrincipal + monthlyInterest;

        // Eligibility Check Breakdown
        const check = app.eligibilityCheck;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-6 animate-scale-up">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-widest block">
                    Loan Verification Desk & Cashier Release Voucher #{app.id}
                  </span>
                  <h3 className="text-lg font-bold text-slate-800">
                    Borrower: {app.memberName} ({app.loanTypeName})
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLoanForReviewModal(null)}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Loan Workflow Dispatch Stepper */}
              <LoanWorkflowStepper 
                status={app.status} 
                updatedAt={app.updatedAt || app.createdAt} 
                remarks={app.remarks} 
                loanAmount={app.amount} 
              />

              {/* Release Loan Banner if Approved */}
              {app.status === 'APPROVED' && (
                <div className="bg-emerald-50 border border-emerald-500/80 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono bg-emerald-600 text-white">
                      Approved & Ready for Cashier Release
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">Disburse Principal & Issue Official Loan Release Voucher</h4>
                    <p className="text-xs text-slate-600">
                      Clicking release will credit funds (₱{principal.toLocaleString()}), generate the official release receipt/voucher, dispatch SMS notification, and activate repayment tracking.
                    </p>
                  </div>
                  <button
                    onClick={() => handleDisburseLoan(app.id)}
                    className="whitespace-nowrap px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center gap-2"
                  >
                    <CheckCircle2 size={18} /> Release Loan & Print OR Voucher
                  </button>
                </div>
              )}

              {/* Borrower Member Profile, Savings, Share Capital & Loan History */}
              {(() => {
                const borrower = members.find(m => m.id === app.memberId) || {
                  fullName: app.memberName,
                  email: app.email || 'N/A',
                  phone: app.phone || app.mobileNumber || 'N/A',
                  membershipStatus: 'APPROVED',
                  savingsBalance: app.savingsBalance || 0,
                  shareCapital: app.shareCapital || 0,
                  gcashNumber: app.gcashNumber || 'N/A'
                };
                const borrowerLoans = loanApplications.filter(l => l.memberId === app.memberId);

                return (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Member Profile */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase block">Borrower Profile Information</span>
                      <h4 className="font-bold text-slate-800 text-sm">{borrower.fullName || app.memberName}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">Member ID: #{app.memberId}</p>
                      <p className="text-[11px] text-slate-600 mt-1">📧 {borrower.email || 'No email registered'}</p>
                      <p className="text-[11px] text-slate-600">📱 {borrower.phone || borrower.mobileNumber || 'No phone registered'}</p>
                      <p className="text-[11px] text-slate-600 font-mono">💳 GCash: {borrower.gcashNumber || 'N/A'}</p>
                    </div>

                    {/* Capital Holdings */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">Capital Holdings & Equity</span>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Savings Account:</span>
                        <span className="font-bold text-emerald-700 font-mono">
                          ₱{Number(borrower.regularSavings ?? borrower.savingsBalance ?? borrower.balances?.savings ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Share Capital:</span>
                        <span className="font-bold text-emerald-600 font-mono">
                          ₱{Number(borrower.shareCapital ?? borrower.shareCapitalBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1">
                        <span>Status:</span>
                        <span className="font-bold text-emerald-600 uppercase">{borrower.membershipStatus || 'ACTIVE'}</span>
                      </div>
                    </div>

                    {/* Loan History */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">Borrower Loan History ({borrowerLoans.length})</span>
                      <div className="max-h-20 overflow-y-auto space-y-1 pt-0.5">
                        {borrowerLoans.length > 0 ? (
                          borrowerLoans.map(l => (
                            <div key={l.id} className="flex items-center justify-between text-[10px] font-mono border-b border-slate-100 pb-1">
                              <span className="truncate max-w-[110px] text-slate-700 font-medium">{l.loanTypeName}</span>
                              <span className="font-bold text-slate-800">₱{(l.amount || 0).toLocaleString()}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                l.status === 'PAID' || l.status === 'DISBURSED' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                              }`}>
                                {l.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">First-time applicant on record.</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Application Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Requested Principal</span>
                  <span className="font-bold text-slate-800 text-sm">₱{principal.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Monthly Amortization</span>
                  <span className="font-bold text-emerald-600 text-sm">₱{monthlyTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Repayment Term</span>
                  <span className="font-semibold text-slate-800">{duration} Months</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Current Status</span>
                  <span className="font-bold text-emerald-600 uppercase">{app.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="col-span-2 md:col-span-4">
                  <span className="text-[10px] text-slate-400 block uppercase">Stated Purpose</span>
                  <span className="font-medium text-slate-800">{app.purpose || 'Not stated'}</span>
                </div>
              </div>

              {/* Member Eligibility Assessment Grid */}
              <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  Automated Eligibility & Qualification Checklist
                </h4>

                {check ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${check.activeMembership ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                      {check.activeMembership ? <Check size={14} className="text-emerald-600 shrink-0" /> : <X size={14} className="text-rose-600 shrink-0" />}
                      <span className="truncate">Active Membership Status</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${check.memberInGoodStanding ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                      {check.memberInGoodStanding ? <Check size={14} className="text-emerald-600 shrink-0" /> : <X size={14} className="text-rose-600 shrink-0" />}
                      <span className="truncate">Member in Good Standing (MIGS)</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${check.minMembershipPeriodMet ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                      {check.minMembershipPeriodMet ? <Check size={14} className="text-emerald-600 shrink-0" /> : <X size={14} className="text-rose-600 shrink-0" />}
                      <span className="truncate">Min Membership Tenure</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${check.minShareCapitalMet ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                      {check.minShareCapitalMet ? <Check size={14} className="text-emerald-600 shrink-0" /> : <X size={14} className="text-rose-600 shrink-0" />}
                      <span className="truncate">Share Capital Ratio</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${check.noOverdueLoans ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                      {check.noOverdueLoans ? <Check size={14} className="text-emerald-600 shrink-0" /> : <X size={14} className="text-rose-600 shrink-0" />}
                      <span className="truncate">No Overdue/Default Loans</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${check.loanOrientationCompleted ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                      {check.loanOrientationCompleted ? <Check size={14} className="text-emerald-600 shrink-0" /> : <X size={14} className="text-rose-600 shrink-0" />}
                      <span className="truncate">Pre-Loan Orientation Attended</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-mono">Member meets default standing and share capital threshold requirements.</p>
                )}
              </div>

              {/* Amortization Schedule Table Preview */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wide flex items-center gap-1.5">
                  <Calculator size={15} className="text-emerald-600" />
                  Generated Monthly Amortization Schedule
                </h4>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl bg-white">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-[10px] text-slate-500 uppercase">
                      <tr>
                        <th className="py-2 px-3">Month</th>
                        <th className="py-2 px-3">Principal</th>
                        <th className="py-2 px-3">Flat Interest ({interestRate}% p.a.)</th>
                        <th className="py-2 px-3">Monthly Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Array.from({ length: duration }).map((_, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-slate-600 font-bold">Month #{idx + 1}</td>
                          <td className="py-2 px-3 text-slate-700">₱{monthlyPrincipal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="py-2 px-3 text-amber-700">₱{monthlyInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="py-2 px-3 font-bold text-emerald-700">₱{monthlyTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* LOAN DOCUMENTS Review Section */}
              <LoanDocumentsSection
                applicationId={app.id}
                memberId={app.memberId}
                memberName={app.memberName}
                documents={app.documents || []}
                token={token}
                onReviewDocument={handleReviewLoanDocument}
                canReview={true}
              />

              {/* Verdict Form */}
              <form onSubmit={handleReviewLoan} className="bg-emerald-50/40 p-4 rounded-2xl border border-indigo-100 space-y-3">
                <span className="text-[10px] font-bold text-emerald-600 uppercase font-mono block">Log Staff Review Verdict</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Status Verdict</label>
                    <select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value)}
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold"
                    >
                      <option value="APPROVED">Approve Application (Approved)</option>
                      <option value="WAITING_FOR_RELEASE">Queue for Disbursement (Waiting for Release)</option>
                      <option value="PENDING_REVIEW">Mark as Pending Review</option>
                      <option value="REVISION_REQUESTED">Request Revisions / Documents</option>
                      <option value="REJECTED">Decline / Reject Application</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Staff Remarks & Notes</label>
                    <input
                      type="text"
                      required
                      value={reviewRemarks}
                      onChange={(e) => setReviewRemarks(e.target.value)}
                      placeholder="Enter review remarks for applicant..."
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                    />
                  </div>
                </div>

                {reviewStatus === 'REVISION_REQUESTED' && (
                  <div>
                    <label className="block text-[10px] font-bold text-amber-700 uppercase font-mono mb-1">Specify Requested Additional Documents</label>
                    <input
                      type="text"
                      value={loanAdditionalDocsInput}
                      onChange={(e) => setLoanAdditionalDocsInput(e.target.value)}
                      placeholder="e.g. Updated Payslip, Barangay Clearance, Proof of Billing"
                      className="block w-full px-3 py-2 bg-amber-50/60 border border-amber-300 rounded-xl text-slate-800 text-xs"
                    />
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  {app.status === 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLoanForReviewModal(null);
                        setDisburseReleaseApp(app);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <Wallet size={14} /> Proceed to Loan Disbursement
                    </button>
                  )}
                  <div className="flex justify-end gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedLoanForReviewModal(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
                    >
                      Save & Dispatch Status
                    </button>
                  </div>
                </div>
              </form>

            </div>
          </div>
        );
      })()}

      {/* LOAN DISBURSEMENT RELEASE MODAL */}
      {disburseReleaseApp && (() => {
        const applicant = members.find(m => m.id === disburseReleaseApp.memberId) || disburseReleaseApp;
        const memberNo = applicant.memberNumber || ('MEM-' + (disburseReleaseApp.memberId || '').substring(0, 6).toUpperCase());
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl p-6 space-y-5 animate-fade-in my-8">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 font-mono uppercase tracking-widest bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                    Cashiering Release Desk
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-xl mt-1">Official Loan Release & Disbursement</h3>
                  <p className="text-xs text-slate-500">Confirm payment details, generate amortization schedule, activate loan, and issue official release voucher.</p>
                </div>
                <button onClick={() => setDisburseReleaseApp(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              {/* Loan & Borrower Identification Header Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[10px] font-bold text-emerald-600 uppercase font-mono tracking-wider block">1. Loan & Borrower Summary</span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Member Name</span>
                    <span className="font-bold text-slate-800 text-sm">{disburseReleaseApp.memberName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Member Number</span>
                    <span className="font-bold text-emerald-600 font-mono">{memberNo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Loan Application #</span>
                    <span className="font-bold text-slate-800 font-mono">#{disburseReleaseApp.id.substring(0, 8).toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Loan Product</span>
                    <span className="font-semibold text-slate-700">{disburseReleaseApp.loanTypeName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Approved Principal</span>
                    <span className="font-extrabold text-emerald-700 font-mono text-sm">₱{Number(disburseReleaseApp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Released By</span>
                    <span className="font-bold text-slate-700">Operational Cashier / Staff</span>
                  </div>
                </div>
              </div>

              {/* Release Parameters Form */}
              <form onSubmit={(e) => {
                e.preventDefault();
                handleDisburseLoan(
                  disburseReleaseApp.id,
                  disburseMethod,
                  disburseRefNo,
                  Number(releaseAmountInput),
                  releaseDateInput,
                  releaseRemarksInput ? `${releaseRemarksInput}\n\nElectronically Signed By: ${eSignatureInput}` : `Electronically Signed By: ${eSignatureInput}`
                );
              }} className="space-y-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Release Amount */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                      Release Amount (₱) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={releaseAmountInput}
                      onChange={(e) => setReleaseAmountInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Release Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                      Release Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={releaseDateInput}
                      onChange={(e) => setReleaseDateInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Release Method Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                    Release Method *
                  </label>
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setDisburseMethod('CASH')}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                        disburseMethod === 'CASH'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Wallet size={16} /> Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisburseMethod('GCASH')}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                        disburseMethod === 'GCASH'
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Smartphone size={16} /> GCash
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisburseMethod('BANK_TRANSFER')}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                        disburseMethod === 'BANK_TRANSFER'
                          ? 'bg-emerald-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Building size={16} /> Bank Transfer
                    </button>
                  </div>
                </div>

                {/* GCash Quick Reference details if GCash chosen */}
                {disburseMethod === 'GCASH' && (() => {
                  const gcashName = applicant.gcashAccountName || disburseReleaseApp.gcashAccountName || applicant.fullName || disburseReleaseApp.memberName || 'Not Configured';
                  const gcashNum = applicant.gcashNumber || disburseReleaseApp.gcashNumber || applicant.phoneNumber || applicant.phone || '09000000000';
                  const customQrUrl = applicant.gcashQrCodeUrl || disburseReleaseApp.gcashQrCodeUrl;
                  const autoQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=GCASH%3A${encodeURIComponent(gcashNum)}%20${encodeURIComponent(gcashName)}`;

                  return (
                    <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                        <span className="font-mono font-bold text-blue-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <QrCode size={15} className="text-blue-600" />
                          Member's Verified GCash Payout Destination
                        </span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-mono font-bold px-2 py-0.5 rounded-full">
                          GCash Direct Payout
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-blue-100">
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono uppercase block">GCash Account Name</span>
                          <span className="font-extrabold text-slate-800 uppercase text-sm block">
                            {gcashName}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono uppercase block">GCash Mobile Number</span>
                          <span className="font-extrabold text-blue-800 font-mono text-sm block">
                            {gcashNum}
                          </span>
                        </div>
                      </div>

                      {/* GCash QR Code Display */}
                      <div className="bg-white p-3 rounded-xl border border-blue-100 text-center space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">
                            Member GCash Scan-To-Pay QR Code
                          </span>
                          <span className="text-[9px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-full font-bold">
                            {customQrUrl ? 'Member Uploaded' : 'Generated Scan-To-Pay'}
                          </span>
                        </div>
                        
                        <div className="inline-block p-2.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                          <img
                            src={customQrUrl || autoQrUrl}
                            alt="Member GCash QR Code"
                            className="w-44 h-44 object-contain mx-auto rounded-xl"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          Scan with the GCash app to send ₱{Number(releaseAmountInput || disburseReleaseApp.amount || 0).toLocaleString()} directly to {gcashName} ({gcashNum}).
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Transaction Reference Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                    Transaction Reference Number {disburseMethod !== 'CASH' ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    required={disburseMethod !== 'CASH'}
                    placeholder={
                      disburseMethod === 'GCASH'
                        ? 'Enter GCash Ref No. (e.g. 100293848123)'
                        : disburseMethod === 'BANK_TRANSFER'
                        ? 'Enter Bank Ref/Trace No. (e.g. BDO-TRX-99812)'
                        : 'Enter Cash Voucher Ref No. (e.g. CSH-VOUCHER-001)'
                    }
                    value={disburseRefNo}
                    onChange={(e) => setDisburseRefNo(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                    Release Remarks / Voucher Notes
                  </label>
                  <textarea
                    rows={2}
                    value={releaseRemarksInput}
                    onChange={(e) => setReleaseRemarksInput(e.target.value)}
                    placeholder="Record any special disbursement notes or voucher details..."
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* E-Signature */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                    Electronic Signature *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Type your full name to electronically sign this release voucher..."
                    value={eSignatureInput}
                    onChange={(e) => setESignatureInput(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDisburseReleaseApp(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      ((disburseMethod === 'GCASH' || disburseMethod === 'BANK_TRANSFER') && !disburseRefNo.trim()) ||
                      !eSignatureInput.trim()
                    }
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check size={16} /> Confirm & Release Loan
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Official Receipt / Release Voucher Modal */}
      {selectedReceiptForModal && (
        <OfficialReceiptModal
          receipt={selectedReceiptForModal}
          member={members.find(m => m.id === selectedReceiptForModal.memberId || m.memberNumber === selectedReceiptForModal.memberNumber)}
          settings={{
            orPrefix: 'OR-',
            orNextNumber: 1001,
            numberPadding: 6,
            headerTitle: cooperativeName || 'Credit & Development Cooperative',
            address: 'Cooperative Main Office, City Hall Complex',
            tin: '123-456-789-000',
            cdaRegNo: 'CDA-REG-2024-9918',
            contactPhone: '+63 917 123 4567',
            contactEmail: 'info@coop.org.ph',
            logoUrl: '',
            footerNote: 'Official Release Receipt / Cashier Voucher. Thank you for your continued patronage.',
            authorizedSignatoryName: 'Head Cashier / Disbursing Officer',
            authorizedSignatoryTitle: 'Authorized Cashier & Finance Officer'
          }}
          userRole="STAFF"
          onClose={() => setSelectedReceiptForModal(null)}
          onRefresh={loadData}
          onViewMemberProfile={(memberId) => {
            const found = members.find(m => m.id === memberId || m.memberNumber === memberId);
            if (found) {
              setSelectedMemberForReview(found);
            } else {
              triggerToast(`Viewing profile for Member ID: ${memberId}`);
            }
          }}
          onRecordPrint={async (receiptId, action) => {
            try {
              await fetch(`/api/receipts/${receiptId}/print`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action })
              });
            } catch (err) {
              console.error('Failed to log print action:', err);
            }
          }}
        />
      )}

      {/* Loan Payment History Ledger Modal */}
      {selectedLoanPaymentHistory && (
        <LoanPaymentHistoryModal
          loan={selectedLoanPaymentHistory}
          token={token}
          cooperativeName={cooperativeName}
          onClose={() => setSelectedLoanPaymentHistory(null)}
          onViewReceipt={(receiptNoOrId) => handleViewReceiptByNumberOrId(receiptNoOrId)}
        />
      )}

      {/* Document Preview Modal for Staff */}
      <DocumentViewerModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc ? {
          fileName: previewDoc.fileName,
          fileType: previewDoc.fileType,
          fileDataUrl: previewDoc.fileDataUrl,
          documentCategory: previewDoc.category,
          documentType: previewDoc.category,
          uploadedAt: previewDoc.uploadedAt
        } : null}
        title="SUBMITTED DOCUMENT"
      />

    </div>
  );
}

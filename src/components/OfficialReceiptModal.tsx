import React, { useState, useEffect } from 'react';
import { OfficialReceipt, ReceiptSettings, Role, Member } from '../types';
import {
  Printer,
  Download,
  XCircle,
  AlertTriangle,
  History,
  QrCode,
  FileText,
  X,
  User,
  ShieldCheck,
  RotateCcw,
  ExternalLink,
  Info,
  CheckCircle2
} from 'lucide-react';
import {
  amountToWords,
  formatPesoAmount,
  getReceiptLineItems,
  getReceiptPurpose
} from '../utils/receiptFormatters';

export interface OfficialReceiptModalProps {
  receipt: OfficialReceipt;
  settings?: ReceiptSettings;
  member?: Member;
  userRole?: Role;
  onClose: () => void;
  onRefresh?: () => void;
  onRecordPrint?: (receiptId: string, action: 'INITIAL_PRINT' | 'REPRINT' | 'PDF_DOWNLOAD') => Promise<void>;
  onVoidReceipt?: (receiptId: string, reason: string) => Promise<void>;
  onViewMemberProfile?: (memberId: string) => void;
}

export const OfficialReceiptModal: React.FC<OfficialReceiptModalProps> = ({
  receipt,
  settings: propSettings,
  member: propMember,
  userRole = 'MEMBER',
  onClose,
  onRefresh,
  onRecordPrint,
  onVoidReceipt,
  onViewMemberProfile
}) => {
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMemberProfileModal, setShowMemberProfileModal] = useState(false);
  const [voidError, setVoidError] = useState('');
  const [loadedSettings, setLoadedSettings] = useState<ReceiptSettings | null>(null);
  const [loadedMember, setLoadedMember] = useState<Member | null>(propMember || null);

  // Default cooperative branding settings
  const defaultSettings: ReceiptSettings = {
    orPrefix: 'OR-',
    orNextNumber: 1001,
    numberPadding: 6,
    headerTitle: 'CCT CREDIT COOPERATIVE INC.',
    cdaRegNo: 'CDA-REG-98765-PH',
    tin: '008-123-456-000',
    address: '123 Cooperative Blvd, Quezon City, Metro Manila, Philippines',
    contactPhone: '+63 (2) 8123-4567',
    contactEmail: 'cashier@alliancecoop.org',
    logoUrl: '',
    footerNote: 'This receipt is system-generated and serves as proof of the recorded payment.',
    authorizedSignatoryName: 'Jane Smith',
    authorizedSignatoryTitle: 'Chief Cashier & Finance Officer'
  };

  const activeSettings = {
    ...defaultSettings,
    ...(propSettings || {}),
    ...(loadedSettings || {})
  };

  // Fetch live receipt config if not passed
  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/receipts/config');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data) {
            setLoadedSettings(data);
          }
        }
      } catch (err) {
        // Silently use propSettings or default
      }
    };

    if (!propSettings || !propSettings.cdaRegNo) {
      fetchConfig();
    }

    return () => {
      isMounted = false;
    };
  }, [propSettings]);

  // If member wasn't passed, optionally fetch member status
  useEffect(() => {
    if (propMember) {
      setLoadedMember(propMember);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token || !receipt.memberId) return;

    let isMounted = true;
    const fetchMember = async () => {
      try {
        const res = await fetch(`/api/members/${receipt.memberId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data) {
            setLoadedMember(data);
          }
        }
      } catch (err) {
        // Fallback gracefully
      }
    };
    fetchMember();
    return () => {
      isMounted = false;
    };
  }, [receipt.memberId, propMember]);

  // Press ESC to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = async (action: 'INITIAL_PRINT' | 'REPRINT' | 'PDF_DOWNLOAD' = 'INITIAL_PRINT') => {
    if (onRecordPrint) {
      try {
        await onRecordPrint(receipt.id, action);
      } catch (err) {
        console.error('Failed to log receipt print action:', err);
      }
    }
    window.print();
  };

  const handleConfirmVoid = async () => {
    if (!voidReason.trim()) {
      setVoidError('Please provide a valid authorization reason for voiding this receipt.');
      return;
    }

    setVoidError('');
    setIsSubmittingVoid(true);
    try {
      if (onVoidReceipt) {
        await onVoidReceipt(receipt.id, voidReason);
      }
      setShowVoidModal(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setVoidError(err.message || 'Failed to void receipt.');
    } finally {
      setIsSubmittingVoid(false);
    }
  };

  const handleMemberProfileClick = () => {
    const memberId = receipt.memberId || receipt.memberNumber || '';
    if (onViewMemberProfile && memberId) {
      onViewMemberProfile(memberId);
    } else {
      setShowMemberProfileModal(true);
    }
  };

  // Transaction Amount and Words
  const amountPaid = receipt.amountPaid ?? (receipt as any).amount ?? 0;
  const wordsRepresentation = receipt.amountInWords && receipt.amountInWords.trim() !== ''
    ? receipt.amountInWords.toUpperCase()
    : amountToWords(amountPaid);

  // Line items
  const lineItems = getReceiptLineItems(receipt);
  const purposeLabel = getReceiptPurpose(receipt);

  // Dates & Times
  const parsedDate = new Date(receipt.paymentDate || receipt.issuedAt || new Date());
  const formattedDate = parsedDate.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const parsedTime = receipt.issuedAt ? new Date(receipt.issuedAt) : parsedDate;
  const formattedTime = parsedTime.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // External Reference / Internal Transaction Reference
  const isGcash = receipt.paymentMethod === 'GCASH' || receipt.releaseMethod === 'GCASH';
  const isBankTransfer = receipt.paymentMethod === 'BANK_TRANSFER' || receipt.releaseMethod === 'BANK_TRANSFER';
  const isCash = receipt.paymentMethod === 'CASH' || receipt.releaseMethod === 'CASH';

  const externalRefNumber = receipt.gcashDetails?.refNumber ||
    receipt.transactionReferenceNumber ||
    (isGcash || isBankTransfer ? receipt.paymentReference : undefined);

  const internalTxId = receipt.transactionId || receipt.paymentReference || receipt.id;

  // Signatory & Authorizer
  const receivedByName = receipt.issuedBy || activeSettings.authorizedSignatoryName || 'Official Cashier';
  const authorizedApproverName = receipt.authorizedStaff || activeSettings.authorizedSignatoryName || 'Finance Manager';

  // Member Status
  const memberStatus = loadedMember?.status || (receipt as any).memberStatus || 'ACTIVE';
  const memberNumber = receipt.memberNumber || loadedMember?.memberNumber || receipt.memberId.substring(0, 8).toUpperCase();
  const accountNumber = receipt.loanNumber || loadedMember?.memberNumber || receipt.memberNumber || receipt.memberId;

  return (
    <div
      id="official-receipt-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4 md:p-6 overflow-y-auto backdrop-blur-xs print:p-0 print:bg-white print:static print:inset-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Modal Container */}
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:max-w-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* On-Screen Action Toolbar (Hidden when printing) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight">
                Cooperative Official Receipt
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                OR No: <span className="text-emerald-300 font-bold">{receipt.receiptNumber}</span>
              </p>
            </div>
            <span
              className={`ml-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                receipt.status === 'ISSUED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {receipt.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Print Receipt */}
            <button
              id="print-receipt-btn"
              type="button"
              onClick={() => handlePrint('INITIAL_PRINT')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              title="Print official receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>

            {/* Download PDF */}
            <button
              id="download-receipt-btn"
              type="button"
              onClick={() => handlePrint('PDF_DOWNLOAD')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              title="Download or save receipt as PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            {/* Reprint (if already printed) */}
            {receipt.printLogs && receipt.printLogs.length > 0 && (
              <button
                type="button"
                onClick={() => handlePrint('REPRINT')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                title="Reprint duplicate copy with audit stamp"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reprint</span>
              </button>
            )}

            {/* View Member Profile */}
            <button
              type="button"
              onClick={handleMemberProfileClick}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              title="View Member Record"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Member</span>
            </button>

            {/* Audit Logs Toggle */}
            {receipt.printLogs && receipt.printLogs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title="View Print History"
              >
                <History className="w-4 h-4" />
              </button>
            )}

            {/* Void Button (Admin / Staff Only) */}
            {(userRole === 'ADMIN' || userRole === 'STAFF') && receipt.status === 'ISSUED' && (
              <button
                type="button"
                onClick={() => setShowVoidModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-medium transition cursor-pointer"
                title="Void this Official Receipt"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Void</span>
              </button>
            )}

            {/* Close Modal X */}
            <button
              id="close-receipt-modal-btn"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
              aria-label="Close modal"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE RECEIPT BODY AREA */}
        <div className="p-4 sm:p-8 md:p-10 text-slate-900 overflow-y-auto grow print:overflow-visible print:p-6 print:m-0 print:w-full bg-white">
          
          {/* Authentic Document Container with Classic Border Styling */}
          <div className="border-2 border-slate-900 p-5 sm:p-8 bg-white relative print:border-2 print:border-black print:p-6">
            
            {/* VOID WATERMARK IF CANCELLED */}
            {receipt.status === 'VOIDED' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden">
                <div className="border-8 border-rose-600/30 text-rose-600/30 font-black text-5xl sm:text-7xl uppercase tracking-widest px-8 py-4 rotate-[-25deg] select-none text-center">
                  VOIDED / CANCELLED
                </div>
              </div>
            )}

            {/* SECTION 2: REQUIRED COOPERATIVE HEADER */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 text-center sm:text-left">
                
                {/* Logo & Cooperative Info */}
                <div className="flex items-center sm:items-start gap-3.5 max-w-lg">
                  {activeSettings.logoUrl ? (
                    <img
                      src={activeSettings.logoUrl}
                      alt="Cooperative Logo"
                      className="w-16 h-16 object-contain rounded shrink-0 border border-slate-300 p-0.5 print:border-black"
                    />
                  ) : (
                    /* Official Cooperative Seal Insignia */
                    <div className="w-16 h-16 rounded-full border-2 border-slate-900 flex flex-col items-center justify-center text-slate-900 shrink-0 p-1 print:border-black">
                      <div className="border border-slate-700 rounded-full w-full h-full flex flex-col items-center justify-center bg-slate-50">
                        <span className="text-[11px] font-black tracking-tighter leading-none">COOP</span>
                        <span className="text-[8px] font-bold text-emerald-800 tracking-widest mt-0.5">EST.</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight leading-snug">
                      {activeSettings.headerTitle}
                    </h1>
                    <p className="text-xs text-slate-700 leading-tight">
                      {activeSettings.address}
                    </p>
                    <div className="text-[11px] text-slate-600 pt-0.5 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-0.5 font-mono">
                      <span>Tel: <strong className="text-slate-800">{activeSettings.contactPhone}</strong></span>
                      <span>Email: <strong className="text-slate-800">{activeSettings.contactEmail}</strong></span>
                    </div>
                    <div className="text-[10px] text-slate-500 pt-0.5 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 font-mono">
                      {activeSettings.cdaRegNo && (
                        <span>CDA Reg. No.: <strong className="text-slate-700">{activeSettings.cdaRegNo}</strong></span>
                      )}
                      {activeSettings.tin && (
                        <span>TIN: <strong className="text-slate-700">{activeSettings.tin}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Document Prominent Title & OR Number Box */}
                <div className="text-center sm:text-right shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200">
                  <div className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-widest font-mono">
                    OFFICIAL RECEIPT
                  </div>
                  
                  {/* Prominent OR Number Box */}
                  <div className="mt-1.5 border-2 border-slate-900 p-2 sm:px-4 sm:py-2 bg-slate-50 inline-block text-center min-w-[180px] print:border-black print:bg-white">
                    <span className="text-[10px] text-slate-600 uppercase font-mono block font-bold tracking-wider">
                      OR Number:
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-wider font-mono">
                      {receipt.receiptNumber}
                    </span>
                  </div>

                  {receipt.reprintCount > 0 && (
                    <div className="mt-1 text-[10px] font-mono font-bold text-amber-800 border border-amber-400 bg-amber-50 px-2 py-0.5 rounded text-center inline-block">
                      REPRINT COPY #{receipt.reprintCount}
                    </div>
                  )}

                  {/* Transaction Date & Time */}
                  <div className="mt-2 text-[11px] font-mono text-slate-700 leading-tight">
                    <div><strong>Date:</strong> {formattedDate}</div>
                    <div><strong>Time:</strong> {formattedTime}</div>
                  </div>
                </div>

              </div>
            </div>

            {/* VOID REASON BANNER IF CANCELLED */}
            {receipt.status === 'VOIDED' && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-300 text-rose-900 text-xs">
                <div className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-rose-600" />
                  <span>Notice: This Official Receipt has been cancelled and voided.</span>
                </div>
                <p className="mt-1 text-[11px]">
                  <strong>Reason:</strong> {receipt.voidReason || 'Transaction invalidated by authorized officer.'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Voided on {receipt.voidedAt ? new Date(receipt.voidedAt).toLocaleString() : 'N/A'} by {receipt.voidedBy || 'Authorized Officer'}
                </p>
              </div>
            )}

            {/* SECTION 3: MEMBER INFORMATION */}
            <div className="mb-4 border border-slate-400 p-3 bg-slate-50/50 print:border-black print:bg-white">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono border-b border-slate-300 pb-1 mb-2">
                MEMBER INFORMATION
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                <div className="flex items-baseline justify-between sm:justify-start gap-2">
                  <span className="text-slate-500 font-medium min-w-[110px]">Member Name:</span>
                  <button
                    type="button"
                    onClick={handleMemberProfileClick}
                    className="font-bold text-slate-900 hover:text-emerald-700 transition text-left cursor-pointer inline-flex items-center gap-1 print:pointer-events-none"
                    title="Click to view Member Details"
                  >
                    <span>{receipt.memberName}</span>
                    <ExternalLink size={12} className="text-slate-400 print:hidden" />
                  </button>
                </div>

                <div className="flex items-baseline justify-between sm:justify-start gap-2">
                  <span className="text-slate-500 font-medium min-w-[110px]">Member ID:</span>
                  <span className="font-mono font-bold text-slate-900">{memberNumber}</span>
                </div>

                <div className="flex items-baseline justify-between sm:justify-start gap-2">
                  <span className="text-slate-500 font-medium min-w-[110px]">Account / Ref No.:</span>
                  <span className="font-mono font-semibold text-slate-800">{accountNumber}</span>
                </div>

                <div className="flex items-baseline justify-between sm:justify-start gap-2">
                  <span className="text-slate-500 font-medium min-w-[110px]">Membership Status:</span>
                  <span className="font-mono font-bold text-emerald-800 text-[11px] uppercase">
                    {memberStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 4: PAYMENT DETAILS (TABLE) */}
            <div className="mb-4 border border-slate-900 print:border-black">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-mono uppercase text-[11px] tracking-wider print:bg-slate-200 print:text-black">
                    <th className="py-2 px-3 border-r border-slate-700 print:border-black font-bold">
                      DESCRIPTION / FINANCIAL PARTICULARS
                    </th>
                    <th className="py-2 px-3 text-right font-bold w-36 sm:w-48">
                      AMOUNT (PHP)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 print:divide-black">
                  {lineItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 print:bg-white">
                      <td className="py-2.5 px-3 border-r border-slate-300 print:border-black">
                        <div className={`text-slate-900 ${item.isBold ? 'font-bold' : 'font-medium'}`}>
                          {item.description}
                        </div>
                        {item.subtext && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {item.subtext}
                          </div>
                        )}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono text-sm text-slate-900 ${item.isBold ? 'font-bold' : 'font-medium'}`}>
                        {formatPesoAmount(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-50 print:bg-white print:border-black font-mono">
                    <td className="py-2.5 px-3 font-black text-slate-900 uppercase tracking-wider text-right border-r border-slate-900 print:border-black">
                      TOTAL AMOUNT PAID
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 text-base underline decoration-double underline-offset-4">
                      {formatPesoAmount(amountPaid)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* SECTION 5: AMOUNT IN WORDS */}
            <div className="mb-4 border border-slate-400 p-2.5 bg-slate-50/60 print:border-black print:bg-white">
              <span className="text-[10px] font-bold text-slate-600 font-mono uppercase tracking-wider block">
                AMOUNT IN WORDS:
              </span>
              <p className="font-bold text-slate-900 text-xs sm:text-sm uppercase font-mono mt-0.5 tracking-tight">
                {wordsRepresentation}
              </p>
            </div>

            {/* SECTION 6 & 7: PAYMENT INFORMATION & PURPOSE */}
            <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-300 p-3 text-xs font-mono print:border-black">
              {/* Payment Information */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 pb-0.5 mb-1.5">
                  PAYMENT INFORMATION
                </div>
                <div>
                  <span className="text-slate-500">Payment Method:</span>{' '}
                  <strong className="text-slate-900 uppercase">{receipt.paymentMethod || receipt.releaseMethod || 'CASH'}</strong>
                  {isCash && <span className="text-slate-500 text-[11px]"> (Over-the-Counter)</span>}
                </div>
                {externalRefNumber && (
                  <div>
                    <span className="text-slate-500">External Reference No.:</span>{' '}
                    <strong className="text-slate-900">{externalRefNumber}</strong>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Transaction ID:</span>{' '}
                  <span className="text-slate-800">{internalTxId}</span>
                </div>
              </div>

              {/* Transaction Purpose */}
              <div className="space-y-1 border-t sm:border-t-0 pt-2 sm:pt-0 sm:border-l sm:pl-3 border-slate-200">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 pb-0.5 mb-1.5">
                  TRANSACTION PURPOSE
                </div>
                <div>
                  <span className="text-slate-500">Purpose:</span>{' '}
                  <strong className="text-slate-900">{purposeLabel}</strong>
                </div>
                {receipt.remarks && (
                  <div className="text-[11px] text-slate-600">
                    <span className="text-slate-500">Remarks:</span> {receipt.remarks}
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Posting Status:</span>{' '}
                  <strong className="text-emerald-800 font-bold">ACTUAL POSTED TRANSACTION</strong>
                </div>
              </div>
            </div>

            {/* SECTION 8 & 9: RECEIVED / VERIFIED BY & MEMBER ACKNOWLEDGMENT */}
            <div className="pt-2 pb-3 border-t-2 border-slate-900 print:border-black grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs">
              
              {/* Member Signature Line */}
              <div className="flex flex-col justify-end">
                <div className="h-12 flex items-end justify-center">
                  <div className="w-full border-b border-slate-800 print:border-black"></div>
                </div>
                <p className="font-bold text-slate-900 text-xs mt-1">
                  {receipt.memberName}
                </p>
                <p className="text-[10px] text-slate-500 uppercase font-mono">
                  Member / Payor Signature
                </p>
              </div>

              {/* Received By (Cashier / Teller) */}
              <div className="flex flex-col justify-end">
                <div className="h-12 flex items-end justify-center">
                  <div className="w-full border-b border-slate-800 print:border-black"></div>
                </div>
                <p className="font-bold text-slate-900 text-xs mt-1">
                  {receivedByName}
                </p>
                <p className="text-[10px] text-slate-500 uppercase font-mono">
                  Received By (Cashier / Teller)
                </p>
              </div>

              {/* Verified / Approved By */}
              <div className="flex flex-col justify-end">
                <div className="h-12 flex items-end justify-center">
                  <div className="w-full border-b border-slate-800 print:border-black"></div>
                </div>
                <p className="font-bold text-slate-900 text-xs mt-1">
                  {authorizedApproverName}
                </p>
                <p className="text-[10px] text-slate-500 uppercase font-mono">
                  Verified / Approved By
                </p>
              </div>

            </div>

            {/* SECTION 10: PROFESSIONAL FOOTER */}
            <div className="mt-3 pt-3 border-t border-slate-300 text-center text-[10px] text-slate-500 font-mono print:border-black space-y-0.5">
              <p className="font-semibold text-slate-700">
                This receipt is system-generated and serves as proof of the recorded payment.
              </p>
              <p>
                {activeSettings.headerTitle} &bull; {activeSettings.address} &bull; Contact: {activeSettings.contactPhone}
              </p>
              <div className="flex items-center justify-center gap-4 text-[9px] text-slate-400 pt-1">
                <span>System Security Token: {receipt.receiptNumber}-AUTH</span>
                <span>Generated: {new Date(receipt.issuedAt || receipt.paymentDate).toISOString()}</span>
              </div>
            </div>

          </div>

        </div>

        {/* Collapsible History Section for Staff/Admin */}
        {showHistory && receipt.printLogs && receipt.printLogs.length > 0 && (
          <div className="p-4 bg-slate-100 border-t border-slate-200 print:hidden text-xs space-y-2 shrink-0">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Print & PDF Audit History</span>
            </h4>
            <div className="max-h-36 overflow-y-auto space-y-1.5">
              {receipt.printLogs.map((log, idx) => (
                <div key={idx} className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{log.printedBy}</span>
                    <span className="text-slate-500 ml-1">({log.userRole})</span>
                    <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-bold">
                      {log.action}
                    </span>
                  </div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    {new Date(log.printedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STICKY BOTTOM TOOLBAR (Hidden in print) */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="hidden sm:flex items-center gap-2 text-slate-500 text-xs font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Official Cooperative Financial System Document</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
          >
            <X size={15} />
            <span>Close Receipt</span>
          </button>
        </div>

      </div>

      {/* MEMBER PROFILE FALLBACK PREVIEW MODAL */}
      {showMemberProfileModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/80 p-4 animate-fade-in print:hidden">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-800 text-base">Associated Member Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMemberProfileModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-2">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Member Full Name</span>
                  <p className="font-bold text-slate-900 text-sm">{receipt.memberName}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Member ID / Number</span>
                  <p className="font-bold text-emerald-700">{memberNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Official Receipt Number</span>
                  <p className="font-bold text-slate-800">{receipt.receiptNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Membership Status</span>
                  <p className="font-bold text-emerald-800">{memberStatus}</p>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  <span>Posted Transaction Confirmed</span>
                </p>
                <p className="text-emerald-800">
                  This transaction has been authoritatively posted in the Cooperative Core Financial System.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMemberProfileModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded transition cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID AUTHORIZATION MODAL */}
      {showVoidModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/80 p-4 print:hidden">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-rose-200">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-lg">
              <AlertTriangle className="w-6 h-6" />
              <span>Authorize Receipt Cancellation</span>
            </div>

            <p className="text-xs text-slate-600">
              You are about to <strong>VOID / CANCEL</strong> Official Receipt <span className="font-mono font-bold text-slate-900">{receipt.receiptNumber}</span> issued to <strong>{receipt.memberName}</strong> for <strong>{formatPesoAmount(amountPaid)}</strong>.
            </p>

            {voidError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-medium">
                {voidError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Authorization & Voiding Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                placeholder="e.g. Encashment error, wrong account credited, duplicate payment..."
                className="w-full text-xs p-2.5 rounded border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVoidModal(false)}
                disabled={isSubmittingVoid}
                className="px-4 py-2 rounded bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={isSubmittingVoid}
                className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingVoid ? 'Voiding...' : 'Confirm Void & Cancel OR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

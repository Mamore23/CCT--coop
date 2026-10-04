import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Receipt, 
  History, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 

  ShieldCheck, 

  FileText,
  Building,
  RefreshCw,
  LayoutDashboard,
  Download,
  Eye,
  CreditCard,
} from 'lucide-react';

interface LoanPaymentHistoryModalProps {
  loan: any;
  token: string;
  cooperativeName?: string;
  onClose: () => void;
  onViewReceipt: (receiptNoOrId: string) => void;
  onPayInstallment?: (loan: any, installment?: any) => void;
}

export const LoanPaymentHistoryModal: React.FC<LoanPaymentHistoryModalProps> = ({
  loan,
  token,
  cooperativeName = 'Credit & Development Cooperative',
  onClose,
  onViewReceipt,
  onPayInstallment
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SCHEDULE' | 'PAYMENTS' | 'RECEIPTS'>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loanId = loan?.id || loan?.applicationId || loan?.loanId;

  const fetchLedger = async () => {
    if (!loanId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/ledger`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLedgerData(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to load loan statement & amortization schedule');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [loanId]);

  const app = ledgerData?.application || loan;
  const activeLoan = ledgerData?.loan || loan;
  const member = ledgerData?.member;
  const summary = ledgerData?.summary || {};
  const rawPayments = ledgerData?.payments || [];
  const rawReceipts = ledgerData?.receipts || [];
  const schedule = ledgerData?.schedule || activeLoan?.amortizationSchedule || [];
  const pendingPaymentRequests = ledgerData?.pendingPaymentRequests || activeLoan?.pendingPaymentRequests || [];

  // Filter Payments
  const filteredPayments = rawPayments.filter((p: any) => {
    const matchSearch = searchQuery === '' || 
      (p.id && p.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.referenceNumber && p.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.paymentMethod && p.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Filter Receipts
  const filteredReceipts = rawReceipts.filter((r: any) => {
    return searchQuery === '' ||
      (r.receiptNumber && r.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.paymentType && r.paymentType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.issuedBy && r.issuedBy.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const handlePrint = () => {
    window.print();
  };

  const handleViewAndPrintReceipt = (receiptNoOrId: string) => {
    onViewReceipt(receiptNoOrId);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const formattedLoanNumber = `#${(activeLoan?.id || app?.id || loanId || '').substring(0, 8).toUpperCase()}`;
  const memberFullName = app?.memberName || activeLoan?.memberName || member?.fullName || 'Valued Member';
  const memberNoStr = member?.memberNumber ? ` (${member.memberNumber})` : '';

  // Maturity Date Calculation
  const maturityDateStr = schedule.length > 0 && schedule[schedule.length - 1]?.dueDate
    ? new Date(schedule[schedule.length - 1].dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : (activeLoan?.maturityDate ? new Date(activeLoan.maturityDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A');

  const releaseDateStr = summary.disbursedAt || activeLoan?.disbursedAt || activeLoan?.createdAt
    ? new Date(summary.disbursedAt || activeLoan?.disbursedAt || activeLoan?.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'N/A';

  const paidScheduleCount = schedule.filter((s: any) => s.status === 'PAID').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Header Bar */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800 print:bg-white print:text-slate-900 print:p-0 print:border-b-2 print:border-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 shrink-0 print:hidden">
              <FileText size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 print:border-slate-300 print:text-slate-700">
                  Loan Statement & Amortization Schedule
                </span>
                <span className="text-xs text-slate-400 font-mono print:text-slate-600">
                  Ref: {formattedLoanNumber}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1 print:text-2xl">
                Loan Statement & Amortization Schedule
              </h2>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                Member: <strong className="text-white print:text-slate-900">{memberFullName}</strong>{memberNoStr} | Product: <strong className="text-emerald-400 font-semibold">{app?.loanTypeName || activeLoan?.loanTypeName || 'Cooperative Loan'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer shadow-xs"
              title="Print entire loan statement and amortization schedule ledger"
            >
              <Printer size={14} /> Print Ledger
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-700"
              title="Close Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-600">Loading loan statement & amortization schedule...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-700 space-y-2">
              <AlertCircle size={28} className="mx-auto text-red-500" />
              <h3 className="font-bold text-base">Unable to load loan statement</h3>
              <p className="text-xs">{error}</p>
              <button
                type="button"
                onClick={fetchLedger}
                className="mt-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw size={12} /> Retry Loading
              </button>
            </div>
          ) : (
            <>
              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto print:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab('OVERVIEW')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'OVERVIEW'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <LayoutDashboard size={14} /> Overview
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('SCHEDULE')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'SCHEDULE'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <Calendar size={14} /> Amortization Schedule ({schedule.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('PAYMENTS')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'PAYMENTS'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <History size={14} /> Payment History ({rawPayments.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('RECEIPTS')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'RECEIPTS'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <Receipt size={14} /> Official Receipts ({rawReceipts.length})
                </button>
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Pending Payment Requests Alert */}
                  {pendingPaymentRequests.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-start gap-3 shadow-xs">
                      <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-extrabold text-sm text-amber-950">
                          {pendingPaymentRequests.length} Payment Request(s) Pending Staff Reconciliation
                        </div>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          Your submitted repayment(s) ({pendingPaymentRequests.map((pr: any) => `${pr.internalReference}: ₱${Number(pr.amount).toLocaleString()}`).join(', ')}) are queued for cashier verification. Official receipts and schedule balances update automatically once reconciled.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Primary Loan Information Box */}
                  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-2xl p-6 shadow-md border border-slate-800 space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 tracking-wider block">
                          Active Account Summary
                        </span>
                        <h3 className="text-xl font-black text-white mt-0.5">
                          {app?.loanTypeName || activeLoan?.loanTypeName || 'Cooperative Loan'}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          Loan Number: <span className="text-emerald-300 font-bold">{formattedLoanNumber}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-extrabold text-xs font-mono uppercase rounded-full">
                          {summary.status || activeLoan?.status || 'ACTIVE'}
                        </span>
                      </div>
                    </div>

                    {/* Overview Fields Grid - Comprehensive Authoritative Schedule Audit Fields */}
                    {(() => {
                      const interestRateVal = activeLoan?.interestRate ?? app?.interestRate ?? 0.10;
                      const interestRateDisplay = `${(interestRateVal * 100).toFixed(1)}% p.a.`;
                      const loanTermDisplay = `${summary.durationMonths || activeLoan?.durationMonths || 12} months`;
                      const paymentFrequencyDisplay = summary.paymentFrequency || activeLoan?.paymentFrequency || 'MONTHLY';
                      const firstDueDateDisplay = schedule[0]?.dueDate ? new Date(schedule[0].dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
                      const nextUnpaidInstallment = schedule.find((s: any) => s.status !== 'PAID' && s.status !== 'WAIVED');
                      const nextDueDateDisplay = nextUnpaidInstallment?.dueDate 
                        ? new Date(nextUnpaidInstallment.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : (summary.nextDueDate ? new Date(summary.nextDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Fully Settled');

                      const scheduledPrincipalVal = schedule[0]?.principalAmount || ((summary.principalAmount || 0) / (summary.durationMonths || 12)) || 0;
                      const scheduledInterestVal = schedule[0]?.interestAmount || ((summary.interestAmount || 0) / (summary.durationMonths || 12)) || 0;
                      const scheduledTotalVal = summary.monthlyAmortization || schedule[0]?.scheduledAmount || (scheduledPrincipalVal + scheduledInterestVal);

                      const totalPrincipalPaid = schedule.reduce((sum: number, s: any) => sum + (s.principalPaid || (s.status === 'PAID' ? s.principalAmount : 0) || 0), 0);
                      const remainingPrincipalBalance = Math.max(0, Number(((summary.principalAmount || 0) - totalPrincipalPaid).toFixed(2)));

                      const totalInterestPaid = schedule.reduce((sum: number, s: any) => sum + (s.interestPaid || (s.status === 'PAID' ? s.interestAmount : 0) || 0), 0);
                      const remainingInterestBalance = Math.max(0, Number(((summary.interestAmount || 0) - totalInterestPaid).toFixed(2)));

                      const overdueAmount = schedule
                        .filter((s: any) => s.status === 'PAST_DUE')
                        .reduce((sum: number, s: any) => sum + (s.remainingAmount !== undefined ? s.remainingAmount : (s.scheduledAmount - (s.amountPaid || 0))), 0);

                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Loan Reference</span>
                            <span className="text-xs font-extrabold text-emerald-400 mt-1 block font-mono">
                              {formattedLoanNumber}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Original Principal</span>
                            <span className="text-sm font-extrabold text-white mt-1 block">
                              ₱{(summary.principalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Interest Rate</span>
                            <span className="text-sm font-extrabold text-teal-300 mt-1 block">
                              {interestRateDisplay}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Loan Term</span>
                            <span className="text-sm font-extrabold text-white mt-1 block">
                              {loanTermDisplay}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Date Disbursed</span>
                            <span className="text-xs font-extrabold text-amber-300 mt-1 block">
                              {releaseDateStr}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">First Due Date</span>
                            <span className="text-xs font-extrabold text-amber-300 mt-1 block">
                              {firstDueDateDisplay}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Next Due Date</span>
                            <span className="text-xs font-extrabold text-emerald-400 mt-1 block">
                              {nextDueDateDisplay}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Payment Frequency</span>
                            <span className="text-xs font-extrabold text-white mt-1 block font-mono">
                              {paymentFrequencyDisplay}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Scheduled Principal</span>
                            <span className="text-sm font-extrabold text-white mt-1 block">
                              ₱{scheduledPrincipalVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Scheduled Interest</span>
                            <span className="text-sm font-extrabold text-teal-300 mt-1 block">
                              ₱{scheduledInterestVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Scheduled Total Payment</span>
                            <span className="text-sm font-extrabold text-emerald-400 mt-1 block">
                              ₱{scheduledTotalVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Amount Already Paid</span>
                            <span className="text-sm font-extrabold text-emerald-300 mt-1 block">
                              ₱{(summary.totalPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Remaining Principal</span>
                            <span className="text-sm font-extrabold text-rose-300 mt-1 block">
                              ₱{remainingPrincipalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Remaining Interest</span>
                            <span className="text-sm font-extrabold text-teal-200 mt-1 block">
                              ₱{remainingInterestBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Total Remaining Balance</span>
                            <span className="text-sm font-extrabold text-rose-400 mt-1 block">
                              ₱{(summary.outstandingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Loan Status</span>
                            <span className="text-xs font-extrabold text-emerald-300 mt-1 block uppercase">
                              {summary.status || activeLoan?.status || 'ACTIVE'}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Overdue Amount</span>
                            <span className={`text-sm font-extrabold mt-1 block ${overdueAmount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                              ₱{overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Payments Made</span>
                            <span className="text-sm font-extrabold text-emerald-400 mt-1 block">
                              {paidScheduleCount} payment(s)
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 font-mono">
                            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Payments Remaining</span>
                            <span className="text-sm font-extrabold text-slate-200 mt-1 block">
                              {Math.max(0, schedule.length - paidScheduleCount)} payment(s)
                            </span>
                          </div>

                          <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Repayment Progress</span>
                            <span className="text-xs font-extrabold text-emerald-400 mt-1 block font-mono">
                              {summary.progressPercentage || 0}% Settled
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Progress Card & Visualizers */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={18} className="text-emerald-600" />
                          <h4 className="font-bold text-slate-900 text-sm">Repayment Progress Visualizer</h4>
                        </div>
                        <span className="text-xs font-mono font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                          {summary.progressPercentage || 0}% Repaid
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono text-slate-600">
                          <span>Verified Total Paid: <strong>₱{(summary.totalPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                          <span>Total Repayable: <strong>₱{(summary.totalRepayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200 p-0.5">
                          <div 
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, summary.progressPercentage || 0)}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs font-mono border-t border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block font-sans">Installments Paid</span>
                          <span className="font-bold text-emerald-700">{paidScheduleCount} / {schedule.length}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block font-sans">Remaining Installments</span>
                          <span className="font-bold text-slate-800">{schedule.length - paidScheduleCount}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block font-sans">Outstanding Balance</span>
                          <span className="font-bold text-rose-600">₱{(summary.outstandingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-emerald-50/80 rounded-2xl border border-emerald-200/80 p-5 shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 tracking-wider block">
                          Next Payment Schedule
                        </span>
                        <h4 className="text-base font-extrabold text-emerald-950 mt-1">
                          Monthly Amortization Due
                        </h4>
                        <div className="text-2xl font-black text-emerald-800 font-mono mt-2">
                          ₱{(summary.monthlyAmortization || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-emerald-700 font-mono mt-1 flex items-center gap-1">
                          <Calendar size={13} /> Next Due: {summary.dueDate ? new Date(summary.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Next Cycle'}
                        </p>
                      </div>

                      <div className="text-[11px] text-emerald-800 bg-white/80 p-3 rounded-2xl border border-emerald-100">
                        Settle your monthly amortization promptly via Cashier or GCash QR Gateway to maintain good standing.
                      </div>

                      {onPayInstallment && (summary.outstandingBalance || activeLoan?.balance || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => onPayInstallment(activeLoan)}
                          className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                        >
                          <CreditCard size={15} /> Make Payment / Pay Installment
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AMORTIZATION SCHEDULE */}
              {activeTab === 'SCHEDULE' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Pending Payment Requests Alert */}
                  {pendingPaymentRequests.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-start gap-3 shadow-xs">
                      <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-extrabold text-sm text-amber-950">
                          {pendingPaymentRequests.length} Payment Request(s) Queued for Staff Reconciliation
                        </div>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          Your submitted payment(s) are awaiting staff verification before updating the schedule. Official receipt will be generated automatically once reconciled.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Amortization Schedule ({schedule.length} Installments)</h3>
                      <p className="text-xs text-slate-500">Contractual monthly schedule. Click "Pay Installment" to generate a Payment Request for staff reconciliation.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
                        Paid: {paidScheduleCount} / {schedule.length} Installments
                      </div>
                      {onPayInstallment && (summary.outstandingBalance || activeLoan?.balance || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => onPayInstallment(activeLoan)}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <CreditCard size={13} /> Pay Amortization
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-slate-700 font-bold border-b border-slate-200 z-10 font-mono text-[10px] uppercase">
                          <tr>
                            <th className="py-3 px-3.5">Inst. #</th>
                            <th className="py-3 px-3.5">Due Date</th>
                            <th className="py-3 px-3.5 text-right">Principal</th>
                            <th className="py-3 px-3.5 text-right">Interest</th>
                            <th className="py-3 px-3.5 text-right">Penalty</th>
                            <th className="py-3 px-3.5 text-right">Amount Due</th>
                            <th className="py-3 px-3.5 text-right">Amt Paid</th>
                            <th className="py-3 px-3.5 text-right">Remaining Due</th>
                            <th className="py-3 px-3.5 text-center">Status</th>
                            <th className="py-3 px-3.5">Payment Date</th>
                            <th className="py-3 px-3.5">Official Receipt #</th>
                            <th className="py-3 px-3.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {schedule.length > 0 ? (
                            schedule.map((s: any, idx: number) => {
                              const isPaid = s.status === 'PAID';
                              const instNo = s.installmentNo || idx + 1;
                              const scheduledAmt = s.scheduledAmount || ((s.principalAmount || 0) + (s.interestAmount || 0)) || 0;
                              const paidAmt = s.amountPaid || 0;
                              const remainingDue = s.remainingAmount !== undefined 
                                ? s.remainingAmount 
                                : Math.max(0, scheduledAmt - paidAmt);
                              const matchingPR = pendingPaymentRequests.find(
                                (pr: any) => pr.targetInstallmentNo === instNo
                              );

                              return (
                                <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${isPaid ? 'bg-emerald-50/20' : ''}`}>
                                  <td className="py-3 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                                    Month {instNo}
                                  </td>
                                  <td className="py-3 px-3.5 font-mono text-slate-700 whitespace-nowrap">
                                    {s.dueDate ? new Date(s.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                  </td>
                                  <td className="py-3 px-3.5 font-mono text-right text-slate-800 whitespace-nowrap">
                                    ₱{(s.principalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 px-3.5 font-mono text-right text-slate-500 whitespace-nowrap">
                                    ₱{(s.interestAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 px-3.5 font-mono text-right text-rose-500 whitespace-nowrap">
                                    ₱{(s.penaltyAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 px-3.5 font-mono font-extrabold text-right text-slate-900 whitespace-nowrap">
                                    ₱{scheduledAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 px-3.5 font-mono text-right text-emerald-600 whitespace-nowrap">
                                    ₱{paidAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 px-3.5 font-mono font-bold text-right text-slate-800 whitespace-nowrap">
                                    ₱{remainingDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                    <span className={`px-2.5 py-0.5 border font-extrabold rounded-full text-[10px] inline-flex items-center gap-1 ${s.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : s.status === 'PAST_DUE' ? 'bg-rose-100 text-rose-800 border-rose-200' : s.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800 border-amber-200' : s.status === 'DUE' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                                      {s.status === 'PAID' && <CheckCircle2 size={11} />}
                                      {s.status === 'PAST_DUE' && <AlertCircle size={11} />}
                                      {s.status === 'PARTIALLY_PAID' && <Clock size={11} />}
                                      {(s.status === 'UPCOMING' || !s.status) && <Clock size={11} />}
                                      {s.status || 'UPCOMING'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5 font-mono text-slate-700 whitespace-nowrap">
                                    {isPaid && s.paymentDate ? (
                                      new Date(s.paymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                    ) : (
                                      <span className="text-slate-400 font-sans text-[11px]">—</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
                                    {isPaid && s.officialReceiptNumber ? (
                                      <button 
                                        onClick={() => onViewReceipt(s.officialReceiptNumber)}
                                        className="hover:underline text-emerald-700 cursor-pointer inline-flex items-center gap-1"
                                        title="Click to view official receipt"
                                      >
                                        <Receipt size={12} /> {s.officialReceiptNumber}
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 font-sans font-normal text-[11px]">—</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                    {isPaid ? (
                                      <span className="text-[11px] font-bold text-emerald-700">Settled</span>
                                    ) : matchingPR ? (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[10px] font-mono font-bold inline-flex items-center gap-1" title="Payment request created, awaiting cashier reconciliation">
                                        <Clock size={10} /> Pending Verification ({matchingPR.internalReference})
                                      </span>
                                    ) : onPayInstallment ? (
                                      <button
                                        type="button"
                                        onClick={() => onPayInstallment(activeLoan, s)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs"
                                        title={`Pay Installment Period #${instNo}`}
                                      >
                                        <CreditCard size={11} /> Pay Period #{instNo}
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">Unpaid</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={12} className="py-12 text-center text-slate-400 font-mono bg-slate-50/50">
                                <Calendar size={28} className="mx-auto mb-2 text-slate-300" />
                                Amortization schedule not yet initialized for this loan.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PAYMENT HISTORY */}
              {activeTab === 'PAYMENTS' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Search and Filters */}
                  <div className="flex items-center justify-between gap-3 flex-wrap print:hidden bg-white p-3.5 rounded-2xl border border-slate-200">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search ref no, payment method..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none cursor-pointer"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="APPROVED">Verified & Approved</option>
                        <option value="PENDING_VERIFICATION">Pending Verification</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                  </div>

                  {/* Payment Table */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-slate-700 font-bold border-b border-slate-200 z-10 font-mono text-[10px] uppercase">
                          <tr>
                            <th className="py-3 px-3.5">Payment Date</th>
                            <th className="py-3 px-3.5 text-right">Amount Paid</th>
                            <th className="py-3 px-3.5">Payment Method</th>
                            <th className="py-3 px-3.5">GCash Ref Number</th>
                            <th className="py-3 px-3.5">Official Receipt #</th>
                            <th className="py-3 px-3.5">Verified By</th>
                            <th className="py-3 px-3.5">Status</th>
                            <th className="py-3 px-3.5 text-center print:hidden">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredPayments.length > 0 ? (
                            filteredPayments.map((p: any) => {
                              const orMatch = p.notes?.match(/OR:\s*([\w-]+)/i)?.[1] || (rawReceipts.find((r: any) => r.transactionId === p.id)?.receiptNumber);
                              const gcashRefStr = p.gcashRefNumber || (p.paymentMethod === 'GCASH' ? p.referenceNumber : p.notes?.match(/GCash Ref\s*([\w-]+)/i)?.[1]) || 'N/A';

                              return (
                                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-3.5 px-3.5 font-mono text-slate-700 whitespace-nowrap">
                                    {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                  </td>
                                  <td className="py-3.5 px-3.5 font-mono font-extrabold text-right text-emerald-700 text-xs whitespace-nowrap">
                                    ₱{(p.amount || p.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3.5 px-3.5 font-bold text-slate-800 whitespace-nowrap">
                                    <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-full font-mono text-[10px] text-slate-700">
                                      {p.paymentMethod || 'GCASH'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-3.5 font-mono font-bold text-blue-600 whitespace-nowrap">
                                    {gcashRefStr}
                                  </td>
                                  <td className="py-3.5 px-3.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
                                    {orMatch ? (
                                      <button
                                        onClick={() => onViewReceipt(orMatch)}
                                        className="hover:underline text-emerald-700 cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <Receipt size={12} /> {orMatch}
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 font-sans font-normal text-[11px]">N/A</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                                    {p.processedBy || p.verifierName || 'System Cashier'}
                                  </td>
                                  <td className="py-3.5 px-3.5 whitespace-nowrap">
                                    {p.status === 'APPROVED' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                                        <CheckCircle2 size={11} /> Verified
                                      </span>
                                    ) : p.status === 'REJECTED' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 font-bold text-[10px] border border-red-200">
                                        <AlertCircle size={11} /> Rejected
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">
                                        <Clock size={11} /> Pending
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-3.5 text-center print:hidden whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => onViewReceipt(orMatch || p.referenceNumber || p.id || loanId)}
                                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 border border-emerald-200"
                                    >
                                      <Receipt size={12} /> View OR
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-slate-400 font-mono bg-slate-50/50">
                                <History size={28} className="mx-auto mb-2 text-slate-300" />
                                No payment transaction records found for this loan.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: OFFICIAL RECEIPTS */}
              {activeTab === 'RECEIPTS' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Official Receipts Vault</h3>
                      <p className="text-xs text-slate-500">View, print, or download PDF receipts for all verified loan payments.</p>
                    </div>
                    <div className="relative min-w-[200px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search OR number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-slate-700 font-bold border-b border-slate-200 z-10 font-mono text-[10px] uppercase">
                          <tr>
                            <th className="py-3 px-3.5">OR Number</th>
                            <th className="py-3 px-3.5">Receipt Type</th>
                            <th className="py-3 px-3.5">Issued Date</th>
                            <th className="py-3 px-3.5 text-right">Amount</th>
                            <th className="py-3 px-3.5">Issued By</th>
                            <th className="py-3 px-3.5 text-center print:hidden">Member Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredReceipts.length > 0 ? (
                            filteredReceipts.map((r: any) => (
                              <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3.5 px-3.5 font-mono font-extrabold text-emerald-700 whitespace-nowrap">
                                  {r.receiptNumber}
                                </td>
                                <td className="py-3.5 px-3.5 font-semibold text-slate-800 whitespace-nowrap">
                                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700">
                                    {r.paymentType || 'LOAN_PAYMENT'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                                  {(r.paymentDate || r.issuedAt)
                                    ? new Date(r.paymentDate || r.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                    : 'N/A'}
                                </td>
                                <td className="py-3.5 px-3.5 font-mono font-extrabold text-right text-slate-900 whitespace-nowrap">
                                  ₱{(r.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3.5 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                                  {r.issuedBy || 'System Cashier'}
                                </td>
                                <td className="py-3.5 px-3.5 text-center print:hidden whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5 justify-center">
                                    <button
                                      type="button"
                                      onClick={() => onViewReceipt(r.receiptNumber || r.id)}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 border border-slate-200"
                                      title="View receipt on screen"
                                    >
                                      <Eye size={12} /> View
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleViewAndPrintReceipt(r.receiptNumber || r.id)}
                                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 border border-emerald-200"
                                      title="Print receipt"
                                    >
                                      <Printer size={12} /> Print
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleViewAndPrintReceipt(r.receiptNumber || r.id)}
                                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[11px] rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 border border-blue-200"
                                      title="Download receipt as PDF"
                                    >
                                      <Download size={12} /> Download PDF
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-slate-400 font-mono bg-slate-50/50">
                                <Receipt size={28} className="mx-auto mb-2 text-slate-300" />
                                No official receipts issued yet for this loan.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Building size={14} className="text-slate-400" />
            <span>{cooperativeName} Permanent Audit Ledger System</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Close Statement
          </button>
        </div>

      </div>
    </div>
  );
};

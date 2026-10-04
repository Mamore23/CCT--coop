import React, { useState, useEffect } from 'react';
import { 
  X, 
  QrCode, 
  CreditCard, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Building2, 
  Download, 
  FileText, 
  ShieldCheck, 
  Info, 
  RefreshCw,
  Wallet,
  Clock,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface LoanPaymentModalProps {
  loan: any;
  token: string;
  cooperativeName?: string;
  targetInstallment?: any;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function LoanPaymentModal({
  loan,
  token,
  cooperativeName = 'CCT CREDIT COOPERATIVE INC.',
  targetInstallment,
  onClose,
  onSuccess
}: LoanPaymentModalProps) {
  const [config, setConfig] = useState<any>(null);
  const [bankConfig, setBankConfig] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"GCASH" | "BANK_TRANSFER" | "CASH">("GCASH");
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  
  // Installment selection state
  const rawSchedule: any[] = loan?.amortizationSchedule || [];
  const unpaidInstallments = rawSchedule.filter(
    (item: any) => item.status !== 'PAID' && item.status !== 'WAIVED'
  );

  const initialInstallmentNo = targetInstallment?.installmentNo || 
    (unpaidInstallments.length > 0 ? unpaidInstallments[0].installmentNo : 1);

  const [selectedInstallmentNo, setSelectedInstallmentNo] = useState<number>(initialInstallmentNo);

  // Form State
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [gcashRefNumber, setGcashRefNumber] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');
  const [proofFileUrl, setProofFileUrl] = useState<string | null>(null);
  const [proofFileName, setProofFileName] = useState<string>('');
  const [proofFileType, setProofFileType] = useState<string>('');
  
  // Preview Allocation State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState<any | null>(null);

  // Fetch GCash Config
  useEffect(() => {
    async function fetchConfigs() {
      setIsLoadingConfig(true);
      try {
        const [gcRes, bkRes] = await Promise.all([
          fetch('/api/gcash/config', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/bank-transfer/config', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        if (gcRes.ok) setConfig(await gcRes.json());
        if (bkRes.ok) setBankConfig(await bkRes.json());
      } catch (err) {
        console.error('Failed to load configs:', err);
      } finally {
        setIsLoadingConfig(false);
      }
    }
    fetchConfigs();
  }, [token]);

  // Set default amount paid based on selected installment
  useEffect(() => {
    if (loan) {
      const currentInst = rawSchedule.find((i: any) => i.installmentNo === selectedInstallmentNo);
      let defaultAmt = 0;
      if (currentInst) {
        const rem = currentInst.remainingAmount !== undefined 
          ? currentInst.remainingAmount 
          : ((currentInst.scheduledAmount || currentInst.totalAmortization || 0) - (currentInst.amountPaid || 0));
        defaultAmt = Math.min(Math.max(0, rem), loan.balance || 0);
      } else {
        defaultAmt = Math.min(loan.monthlyAmortization || loan.balance || 0, loan.balance || 0);
      }
      setAmountPaid(defaultAmt > 0 ? String(defaultAmt) : String(loan.balance || ''));
    }
  }, [loan, selectedInstallmentNo]);

  // Fetch preview when amount or installment changes
  useEffect(() => {
    const numericAmount = parseFloat(amountPaid);
    if (!loan?.id || isNaN(numericAmount) || numericAmount <= 0) {
      setPreviewData(null);
      setPreviewError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await fetch(`/api/loans/${encodeURIComponent(loan.id)}/amortization/preview-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            amount: numericAmount,
            targetInstallmentNo: selectedInstallmentNo
          })
        });

        if (res.ok) {
          const data = await res.json();
          setPreviewData(data);
        } else {
          const errData = await res.json().catch(() => ({}));
          setPreviewError(errData.error || 'Unable to preview allocation');
          setPreviewData(null);
        }
      } catch (err: any) {
        setPreviewError('Network error connecting to preview service');
        setPreviewData(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [amountPaid, selectedInstallmentNo, loan?.id, token]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10MB limit. Please upload a smaller screenshot.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProofFileUrl(reader.result as string);
      setProofFileName(file.name);
      setProofFileType(file.type);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadQr = () => {
    if (!config?.qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = config.qrCodeUrl;
    link.download = `coop_gcash_qr_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;

    const numericAmount = parseFloat(amountPaid);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid payment amount greater than ₱0.00.');
      return;
    }

    if (numericAmount > (loan.balance || 0)) {
      setError(`Payment amount (₱${numericAmount.toLocaleString()}) cannot exceed the total outstanding balance of ₱${(loan.balance || 0).toLocaleString()}.`);
      return;
    }

    if (paymentMethod !== 'CASH') {
      if (!gcashRefNumber || gcashRefNumber.trim().length < 6) {
        setError(`Please enter a valid ${paymentMethod === 'GCASH' ? 'GCash' : 'Bank'} Reference Number.`);
        return;
      }

      if (!proofFileUrl) {
        setError('Please attach a screenshot or image of your transaction receipt.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/payments/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentType: 'LOAN_PAYMENT',
          loanId: loan.id,
          targetReferenceId: loan.id,
          targetInstallmentNo: selectedInstallmentNo,
          amount: numericAmount,
          paymentMethod,
          externalReference: paymentMethod === 'CASH' ? 'OFFICE-CASH' : gcashRefNumber.trim(),
          proofAttachmentUrl: paymentMethod === 'CASH' ? undefined : proofFileUrl,
          proofFileName: paymentMethod === 'CASH' ? undefined : proofFileName,
          proofFileType: paymentMethod === 'CASH' ? undefined : proofFileType,
          remarks: remarks ? remarks.trim() : (paymentMethod === 'CASH' ? `Office Cash Repayment for #${loan.id.substring(0, 8).toUpperCase()} - Period #${selectedInstallmentNo}` : `Loan Repayment for #${loan.id.substring(0, 8).toUpperCase()} - Period #${selectedInstallmentNo}`)
        })
      });
      
      const dataReq = await res.json();
      if (!res.ok) {
        throw new Error(dataReq.error || 'Failed to submit payment request.');
      }

      setSubmittedSuccess(dataReq.paymentRequest);
      setTimeout(() => {
        onSuccess(
          `Payment Request ${dataReq.paymentRequest?.internalReference} for ₱${numericAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} created! Status: Pending Staff Reconciliation.`
        );
        onClose();
      }, 2500);

    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!loan) return null;

  const currentSelectedInst = rawSchedule.find((s: any) => s.installmentNo === selectedInstallmentNo);
  const remainingBalance = loan.balance || 0;
  const dueDateDisplay = currentSelectedInst?.dueDate || loan.nextDueDate || loan.dueDate || 'N/A';
  const scheduledAmountDisplay = currentSelectedInst?.scheduledAmount || loan.monthlyAmortization || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 sm:p-8 space-y-6 relative max-h-[92vh] overflow-y-auto">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-all cursor-pointer z-10"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 pr-10">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-sm shrink-0">
            <CreditCard size={24} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-blue-600 uppercase flex items-center gap-1">
              <ShieldCheck size={12} /> Loan Amortization Payment Request
            </span>
            <h3 className="text-xl font-extrabold text-slate-900">
              Submit Loan Repayment
            </h3>
            <p className="text-xs text-slate-500">
              Contractual schedule payment via Payment Request workflow for {cooperativeName}
            </p>
          </div>
        </div>

        {/* Loan Target Details Summary Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-5 rounded-2xl shadow-inner space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase text-blue-400 font-bold tracking-wider">Target Loan Contract</span>
              <h4 className="text-base font-black text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                {loan.loanTypeName || 'Loan Account'}
              </h4>
            </div>
            <div className="text-left sm:text-right font-mono">
              <span className="text-[10px] uppercase text-slate-400 block font-semibold">Contract Number</span>
              <span className="text-xs font-bold text-amber-300">#{loan.id.substring(0, 8).toUpperCase()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Outstanding Balance</span>
              <span className="text-sm font-extrabold text-rose-300 font-mono">
                ₱{remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Selected Installment</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                Period #{selectedInstallmentNo}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Scheduled Amount</span>
              <span className="text-sm font-bold text-sky-300 font-mono">
                ₱{scheduledAmountDisplay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Due Date</span>
              <span className="text-xs font-bold text-amber-300 font-mono flex items-center gap-1 mt-0.5">
                <Calendar size={13} />
                {dueDateDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2 animate-shake">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Submitted Success Notice */}
        {submittedSuccess ? (
          <div className="p-8 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-center space-y-4 animate-scale-up">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <span className="px-3 py-1 bg-emerald-200 text-emerald-900 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider">
                Payment Request Created: {submittedSuccess.internalReference}
              </span>
              <h4 className="text-xl font-extrabold text-emerald-950 mt-2">Queued for Staff Reconciliation</h4>
              <p className="text-xs text-emerald-700 mt-1 max-w-md mx-auto">
                Your payment of <strong>₱{Number(amountPaid).toLocaleString()}</strong> for Installment #{selectedInstallmentNo} has been registered. Staff will reconcile your external reference number before updating the loan contract balance and issuing the Official Receipt.
              </p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-emerald-200 max-w-sm mx-auto text-left text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Status:</span>
                <span className="font-bold text-amber-700">PENDING_RECONCILIATION</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Reference:</span>
                <span className="font-bold text-slate-900">{submittedSuccess.externalReference || gcashRefNumber}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Target Installment:</span>
                <span className="font-bold text-slate-900">Period #{selectedInstallmentNo}</span>
              </div>
            </div>
            <p className="text-[11px] text-emerald-600 font-mono">
              Redirecting to your account dashboard...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Payment Details & Receiver Info (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  <Wallet size={16} className="text-slate-600" />
                  Select Payment Method
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('GCASH')}
                    className={`p-2.5 border rounded-xl flex flex-col items-center gap-1.5 transition-all cursor-pointer ${paymentMethod === 'GCASH' ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' : 'border-slate-200 bg-white text-slate-600'}`}
                  >
                    <QrCode size={18} className={paymentMethod === 'GCASH' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-[11px]">GCash QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK_TRANSFER')}
                    className={`p-2.5 border rounded-xl flex flex-col items-center gap-1.5 transition-all cursor-pointer ${paymentMethod === 'BANK_TRANSFER' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 bg-white text-slate-600'}`}
                  >
                    <Building2 size={18} className={paymentMethod === 'BANK_TRANSFER' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-[11px]">Bank Transfer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-2.5 border rounded-xl flex flex-col items-center gap-1.5 transition-all cursor-pointer ${paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-slate-200 bg-white text-slate-600'}`}
                  >
                    <Wallet size={18} className={paymentMethod === 'CASH' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className="text-[11px]">Office Cash</span>
                  </button>
                </div>

                {paymentMethod === 'GCASH' ? (
                  <>
                    <div className="bg-white p-3 rounded-2xl shadow-sm inline-block max-w-[180px] border border-slate-200 mb-2">
                      {config?.qrCodeUrl ? (
                        <img src={config.qrCodeUrl} alt="GCash QR" className="w-full h-auto rounded-lg" />
                      ) : (
                        <div className="w-32 h-32 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                          No QR
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Name</p>
                      <p className="text-sm font-extrabold text-blue-900">{config?.accountName || 'CCT COOPERATIVE'}</p>
                      <p className="text-sm font-bold text-slate-700 font-mono bg-white inline-block px-3 py-1 rounded-lg border border-slate-200 mt-1">
                        {config?.mobileNumber || '0917-888-2288'}
                      </p>
                    </div>
                  </>
                ) : paymentMethod === 'BANK_TRANSFER' ? (
                  <>
                    <div className="space-y-1.5 text-xs text-left bg-white p-4 rounded-xl border border-indigo-200">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">Bank Name</span>
                        <span className="font-extrabold text-slate-900 text-sm block">{bankConfig?.bankName || 'BDO Unibank'}</span>
                      </div>
                      <div className="mt-2">
                        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">Account Name</span>
                        <span className="font-bold text-slate-700 text-sm block">{bankConfig?.accountName || 'CCT COOPERATIVE INC.'}</span>
                      </div>
                      <div className="mt-2">
                        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">Account Number</span>
                        <span className="font-extrabold text-indigo-700 font-mono text-lg block">
                          {bankConfig?.accountNumber || '001234567890'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2 text-xs text-left bg-white p-4 rounded-xl border border-emerald-200">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                        <Wallet size={16} className="text-emerald-600" />
                        <span>Cashier Counter Payment</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        Pay over the counter directly to the Cooperative Cashier. Submitting this request creates a payment record in <strong>Pending Reconciliation</strong> status. Please proceed to the cashier counter to complete physical verification and receive your printed Official Receipt.
                      </p>
                      <div className="bg-emerald-50 text-emerald-800 text-[10.5px] p-2.5 rounded-lg border border-emerald-100 font-medium">
                        🕒 Cashier Hours: Mon–Fri, 8:00 AM – 5:00 PM
                      </div>
                    </div>
                  </>
                )}

                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-left text-[11px] text-slate-700 space-y-1 mt-4">
                  <span className="font-bold block flex items-center gap-1 text-[10px] font-mono uppercase text-slate-600">
                    <Info size={12} /> Amortization Repayment Workflow
                  </span>
                  <p className="text-[10.5px] leading-relaxed text-slate-600">
                    1. Select target installment or enter custom repayment amount.<br/>
                    2. Send payment via GCash or Bank Transfer.<br/>
                    3. Upload receipt & enter Transaction Reference.<br/>
                    4. Staff reconciles the payment, updating schedule & issuing Official Receipt.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Installment Picker, Dynamic Preview & Form (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Installment Target Selector */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Target Installment Period
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={selectedInstallmentNo}
                      onChange={(e) => setSelectedInstallmentNo(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-blue-500"
                    >
                      {rawSchedule.map((inst: any) => {
                        const rem = inst.remainingAmount !== undefined 
                          ? inst.remainingAmount 
                          : ((inst.scheduledAmount || inst.totalAmortization || 0) - (inst.amountPaid || 0));
                        return (
                          <option key={inst.installmentNo} value={inst.installmentNo}>
                            Period #{inst.installmentNo} (Due: {inst.dueDate || 'N/A'}) - {inst.status} {rem > 0 ? `(₱${rem.toLocaleString()})` : ''}
                          </option>
                        );
                      })}
                    </select>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const firstUnpaid = unpaidInstallments[0];
                          if (firstUnpaid) setSelectedInstallmentNo(firstUnpaid.installmentNo);
                        }}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex-1"
                      >
                        Earliest Due (#{unpaidInstallments[0]?.installmentNo || 1})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Payment Amount */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payment Amount (₱) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₱</span>
                      <input
                        type="number"
                        required
                        min="1"
                        max={remainingBalance}
                        step="0.01"
                        placeholder="0.00"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="w-full pl-8 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Scheduled Installment: ₱{scheduledAmountDisplay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Payment Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono text-slate-800"
                    />
                  </div>
                </div>

                {/* Real-time Allocation & Advance/Partial Notices */}
                {previewLoading && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center gap-2 font-mono">
                    <RefreshCw size={12} className="animate-spin text-blue-600" />
                    Calculating amortization breakdown & allocation preview...
                  </div>
                )}

                {previewData && !previewLoading && (
                  <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-blue-900 text-[11px] font-mono uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Sparkles size={13} className="text-blue-600" /> Payment Allocation Preview
                      </span>
                      <span>Target: Period #{previewData.targetInstallmentNo}</span>
                    </div>

                    {/* Advance Payment Notice */}
                    {previewData.isAdvancePayment && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-start gap-1.5 font-medium">
                        <Clock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Advance Payment Notice:</strong> This installment is not yet due (Due: {previewData.targetDueDate}). Your payment will be credited ahead of the scheduled due date.
                        </div>
                      </div>
                    )}

                    {/* Partial Payment Notice */}
                    {previewData.isPartialPayment && (
                      <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-[11px] flex items-start gap-1.5 font-medium">
                        <Info size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Partial Payment Notice:</strong> {previewData.partialNotice}
                        </div>
                      </div>
                    )}

                    {/* Breakdown Grid */}
                    <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-center border-t border-blue-100">
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-[9px] text-slate-400 block font-sans">Principal</span>
                        <span className="font-bold text-slate-800">₱{(previewData.totalPrincipal || 0).toLocaleString()}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-[9px] text-slate-400 block font-sans">Interest</span>
                        <span className="font-bold text-teal-700">₱{(previewData.totalInterest || 0).toLocaleString()}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-[9px] text-slate-400 block font-sans">Penalty</span>
                        <span className="font-bold text-rose-600">₱{(previewData.totalPenalty || 0).toLocaleString()}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-[9px] text-slate-400 block font-sans">Remaining Bal</span>
                        <span className="font-bold text-slate-900">₱{(previewData.remainingLoanBalanceAfter || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {previewError && (
                  <div className="text-[11px] text-rose-600 font-medium">
                    {previewError}
                  </div>
                )}

                {paymentMethod !== 'CASH' ? (
                  <>
                    {/* Reference Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {paymentMethod === 'GCASH' ? 'GCash' : 'Bank'} Transaction Reference Number *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={25}
                        placeholder="e.g. 1002345678901"
                        value={gcashRefNumber}
                        onChange={(e) => setGcashRefNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900 text-sm tracking-wide"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Exact Reference Number from your payment receipt screenshot.
                      </p>
                    </div>

                    {/* Remarks / Notes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Note to Cashier (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Monthly installment payment for period #2"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                      />
                    </div>

                    {/* File Upload Receipt Screenshot */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Upload Payment Receipt Attachment *
                      </label>

                      {proofFileUrl ? (
                        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3 overflow-hidden pr-2">
                            {proofFileType.startsWith('image/') ? (
                              <img src={proofFileUrl} alt="Receipt Screenshot" className="w-12 h-12 rounded-lg object-cover border border-blue-200 shrink-0" />
                            ) : (
                              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center shrink-0">
                                <FileText size={20} />
                              </div>
                            )}
                            <div className="truncate">
                              <p className="text-xs font-bold text-slate-800 truncate">{proofFileName}</p>
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                                Attachment Ready
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setProofFileUrl(null);
                              setProofFileName('');
                              setProofFileType('');
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-full transition-all cursor-pointer shrink-0"
                            title="Remove attachment"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 p-4 rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-1 group">
                          <Upload size={22} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                          <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">Click to Browse or Drag & Drop Payment Receipt</span>
                          <span className="text-[10px] text-slate-400">PNG, JPG, WEBP, or PDF up to 10MB</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </label>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                      <Wallet size={16} className="text-emerald-700" />
                      <span>Over-the-Counter Cashier Payment Instructions</span>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Submitting this request creates an official Loan Payment Request in <strong>Pending Reconciliation</strong> status. Please proceed directly to the Cooperative Cashier counter with your physical cash payment to complete verification and receive your printed Official Receipt.
                    </p>
                    <div className="text-[11px] text-emerald-700 bg-white/90 p-2.5 rounded-xl border border-emerald-200">
                      ✅ No external reference number or receipt screenshot required. The Cashier will verify physical cash and issue your official receipt directly.
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Note to Cashier (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Paying in person at main office counter"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                      />
                    </div>
                  </div>
                )}

                {/* Submit Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || (paymentMethod !== 'CASH' && (!proofFileUrl || !gcashRefNumber))}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Creating Payment Request...
                      </>
                    ) : (
                      <>
                        <CreditCard size={14} />
                        Submit Payment Request
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

import React from 'react';
import { 
  Clock, 
  CheckCircle2, 
  Wallet, 
  CheckCircle, 
  ShieldCheck, 
  AlertCircle,

  Sparkles
} from 'lucide-react';

export type LoanWorkflowStage = 
  | 'PENDING_REVIEW' 
  | 'UNDER_REVIEW' 
  | 'REVISION_REQUESTED' 
  | 'APPROVED' 
  | 'WAITING_FOR_RELEASE' 
  | 'DISBURSED' 
  | 'RELEASED' 
  | 'PAID' 
  | 'COMPLETED' 
  | 'REJECTED';

export function formatLoanStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING_REVIEW':
    case 'UNDER_REVIEW':
      return 'Pending Review';
    case 'APPROVED':
      return 'Approved';
    case 'WAITING_FOR_RELEASE':
      return 'Waiting for Release';
    case 'DISBURSED':
    case 'RELEASED':
      return 'Released';
    case 'PAID':
    case 'COMPLETED':
      return 'Completed';
    case 'REVISION_REQUESTED':
      return 'Revision Requested';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status ? status.replace(/_/g, ' ') : 'Pending Review';
  }
}

export function getLoanStatusBadgeStyle(status: string): { bg: string; border: string; text: string; dot: string } {
  switch (status) {
    case 'PENDING_REVIEW':
    case 'UNDER_REVIEW':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-800',
        dot: 'bg-amber-500'
      };
    case 'APPROVED':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        dot: 'bg-blue-500'
      };
    case 'WAITING_FOR_RELEASE':
      return {
        bg: 'bg-emerald-50',
        border: 'border-indigo-200',
        text: 'text-emerald-600',
        dot: 'bg-emerald-600'
      };
    case 'DISBURSED':
    case 'RELEASED':
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        dot: 'bg-emerald-500'
      };
    case 'PAID':
    case 'COMPLETED':
      return {
        bg: 'bg-teal-50',
        border: 'border-teal-300',
        text: 'text-teal-900',
        dot: 'bg-teal-600'
      };
    case 'REVISION_REQUESTED':
      return {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-800',
        dot: 'bg-purple-500'
      };
    case 'REJECTED':
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-800',
        dot: 'bg-rose-500'
      };
    default:
      return {
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        text: 'text-slate-700',
        dot: 'bg-slate-400'
      };
  }
}

export function LoanStatusBadge({ status, showDot = true, size = 'md' }: { status: string; showDot?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const label = formatLoanStatusLabel(status);
  const style = getLoanStatusBadgeStyle(status);

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-[9px]' 
    : size === 'lg' 
    ? 'px-3 py-1 text-xs' 
    : 'px-2.5 py-0.5 text-[10px]';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold font-mono border uppercase tracking-wider ${sizeClasses} ${style.bg} ${style.border} ${style.text}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${status === 'PENDING_REVIEW' || status === 'WAITING_FOR_RELEASE' ? 'animate-pulse' : ''}`} />}
      {label}
    </span>
  );
}

interface LoanWorkflowStepperProps {
  status: string;
  updatedAt?: string;
  remarks?: string;
  loanAmount?: number;
}

export function LoanWorkflowStepper({ status, updatedAt, remarks, }: LoanWorkflowStepperProps) {
  // Map internal status to active step index (1-based, 1..5)
  let currentStep = 1;
  let isRejected = false;
  let isRevision = false;

  if (status === 'PENDING_REVIEW' || status === 'UNDER_REVIEW') {
    currentStep = 1;
  } else if (status === 'REVISION_REQUESTED') {
    currentStep = 1;
    isRevision = true;
  } else if (status === 'APPROVED') {
    currentStep = 2;
  } else if (status === 'WAITING_FOR_RELEASE') {
    currentStep = 3;
  } else if (status === 'DISBURSED' || status === 'RELEASED') {
    currentStep = 4;
  } else if (status === 'PAID' || status === 'COMPLETED') {
    currentStep = 5;
  } else if (status === 'REJECTED') {
    currentStep = 2;
    isRejected = true;
  }

  const steps = [
    {
      step: 1,
      id: 'pending',
      title: 'Pending Review',
      desc: 'Credit committee / staff evaluation',
      icon: Clock
    },
    {
      step: 2,
      id: 'approved',
      title: isRejected ? 'Rejected' : 'Approved',
      desc: isRejected ? 'Application declined' : 'Credit authorization granted',
      icon: isRejected ? AlertCircle : CheckCircle
    },
    {
      step: 3,
      id: 'waiting',
      title: 'Waiting for Release',
      desc: 'Cashier queue & voucher prep',
      icon: ShieldCheck
    },
    {
      step: 4,
      id: 'released',
      title: 'Released',
      desc: 'Proceeds disbursed to borrower',
      icon: Wallet
    },
    {
      step: 5,
      id: 'completed',
      title: 'Completed',
      desc: 'Amortization fully settled',
      icon: CheckCircle2
    }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-2xl shadow-slate-100">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-wider block">
            Loan Dispatch Lifecycle Workflow
          </span>
          <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 mt-0.5">
            Current Status: <LoanStatusBadge status={status} size="lg" />
          </h4>
        </div>
        {updatedAt && (
          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
            Updated: {new Date(updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* 5-Step Pipeline Progress Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 relative">
        {steps.map((s) => {
          const isDone = !isRejected && !isRevision && s.step < currentStep;
          const isCurrent = s.step === currentStep;
//           const isUpcoming = s.step > currentStep;
          const StepIcon = s.icon;

          let stepBoxStyle = 'bg-slate-50 border-slate-200 text-slate-400';
          let iconBg = 'bg-slate-200 text-slate-500';

          if (isRejected && s.step === 2) {
            stepBoxStyle = 'bg-rose-50 border-rose-300 text-rose-900 font-bold';
            iconBg = 'bg-rose-600 text-white';
          } else if (isRevision && s.step === 1) {
            stepBoxStyle = 'bg-purple-50 border-purple-300 text-purple-900 font-bold';
            iconBg = 'bg-purple-600 text-white';
          } else if (isDone) {
            stepBoxStyle = 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-bold';
            iconBg = 'bg-emerald-600 text-white';
          } else if (isCurrent) {
            stepBoxStyle = 'bg-emerald-50 border-indigo-300 text-emerald-600 font-extrabold ring-2 ring-indigo-500/20 shadow-xs';
            iconBg = 'bg-emerald-600 text-white animate-pulse';
          }

          return (
            <div
              key={s.id}
              className={`p-3 rounded-2xl border transition-all flex flex-col justify-between space-y-2 ${stepBoxStyle}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Step 0{s.step}
                </span>
                <div className={`p-1.5 rounded-xl ${iconBg}`}>
                  <StepIcon size={14} />
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold leading-tight">{s.title}</span>
                <span className="block text-[9px] font-mono opacity-70 leading-normal mt-0.5 line-clamp-2">
                  {s.desc}
                </span>
              </div>

              {isDone && (
                <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-700 font-bold pt-1 border-t border-emerald-200/50">
                  <CheckCircle size={10} /> Cleared
                </div>
              )}
              {isCurrent && (
                <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-600 font-extrabold pt-1 border-t border-indigo-200">
                  <Sparkles size={10} className="animate-spin" /> Active Stage
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage Remarks or Memo if applicable */}
      {remarks && (
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1 font-mono">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Dispatch Notes / Remarks</span>
          <p className="text-slate-700 leading-relaxed">{remarks}</p>
        </div>
      )}
    </div>
  );
}

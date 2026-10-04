import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, ShieldAlert, BadgeCheck,
  FileText, Search, HandCoins, Send,
  Banknote, Wallet, Building, ArrowDownToLine, Receipt,
  Smartphone, ShieldCheck, XCircle,
  Activity, ArrowRightLeft, Ticket, HeadphonesIcon, BellRing, CheckCircle2
} from 'lucide-react';
import {
  generateOperationalDescriptiveAnalysis,
  DescriptiveAnalysisReport
} from '../utils/descriptiveAnalyticsEngine.js';

interface OperationalAnalyticsProps {
  token: string;
  onNavigate?: (tab: string) => void;
}

export function OperationalAnalytics({ token, onNavigate }: OperationalAnalyticsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchOperationalData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/analytics/operational', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load operational analytics');
        const json = await res.json();
        if (isMounted) setData(json);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Error communicating with analytics endpoint');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchOperationalData();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchOperationalData();
    }, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-500 font-mono">LOADING OPERATIONAL DATA...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700">
        <p className="font-bold">Error loading operational analytics</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const descriptiveReport: DescriptiveAnalysisReport =
    data.descriptiveAnalysis || generateOperationalDescriptiveAnalysis(data);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Operational Analytics Dashboard</h2>
          <p className="text-sm text-slate-500">Real-time daily workload, descriptive queue interpretation, and operational monitoring.</p>
        </div>
      </div>

      {/* Staff Operational Descriptive Analysis */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4" id="staff-descriptive-analysis">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-emerald-700 tracking-wider block">
              DESCRIPTIVE ANALYSIS • STAFF OPERATIONS
            </span>
            <h3 className="text-base font-bold text-slate-900">Operational Queue & Workload Interpretation</h3>
          </div>
          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-mono font-bold uppercase">
            Read-Only
          </span>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 text-xs text-slate-800 leading-relaxed">
          <strong className="font-mono uppercase text-[10px] text-emerald-800 block mb-1">Overall Situation:</strong>
          {descriptiveReport.executiveSummary}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-700 block">Key Operational Findings:</span>
            <ul className="space-y-1.5 text-slate-700">
              {descriptiveReport.keyFindings.map((f) => (
                <li key={f.domainKey} className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>
                    <strong>{f.domainTitle} [{f.priority}]:</strong> {f.currentCondition}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 block">Actions to Consider:</span>
            <ul className="space-y-1.5 text-slate-700">
              {descriptiveReport.actionsToConsider.map((a, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>
                    <strong>{a.area}:</strong> {a.action}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Member Operations */}
        <div onClick={() => onNavigate && onNavigate('staff-verifications')} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <Users size={24} />
            </div>
            <h3 className="font-bold text-slate-800">Member Operations</h3>
          </div>
          <div className="space-y-4">
            <MetricRow label="Pending Registrations" value={data.memberOperations.pendingRegistrations} icon={Users} color="amber" />
            <MetricRow label="Approved Today" value={data.memberOperations.approvedToday} icon={UserCheck} color="emerald" />
            <MetricRow label="Pending Initial Share" value={data.memberOperations.pendingInitialSharePayments} icon={ShieldAlert} color="amber" />
            <MetricRow label="Pending GCash Verifications" value={data.memberOperations.pendingGCashVerifications} icon={BadgeCheck} color="indigo" />
          </div>
        </div>

        {/* Loan Operations */}
        <div onClick={() => onNavigate && onNavigate('staff-loans')} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <FileText size={24} />
            </div>
            <h3 className="font-bold text-slate-800">Loan Operations</h3>
          </div>
          <div className="space-y-4">
            <MetricRow label="Pending Applications" value={data.loanOperations.pendingApplications} icon={FileText} color="amber" />
            <MetricRow label="Under Review" value={data.loanOperations.underReview} icon={Search} color="indigo" />
            <MetricRow label="Waiting for Release" value={data.loanOperations.waitingForRelease} icon={HandCoins} color="blue" />
            <MetricRow label="Loans Released Today" value={data.loanOperations.releasedToday} icon={Send} color="emerald" />
          </div>
        </div>

        {/* Cashier Operations */}
        <div onClick={() => onNavigate && onNavigate('staff-cashier')} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Banknote size={24} />
            </div>
            <h3 className="font-bold text-slate-800">Cashier Operations</h3>
          </div>
          <div className="space-y-4">
            <MetricAmountRow label="Cash Deposits Today" value={data.cashierOperations.cashDepositsToday} icon={Banknote} color="emerald" />
            <MetricAmountRow label="Savings Deposits Today" value={data.cashierOperations.savingsDepositsToday} icon={Wallet} color="emerald" />
            <MetricAmountRow label="Share Capital Today" value={data.cashierOperations.shareCapitalPaymentsToday} icon={Building} color="blue" />
            <MetricAmountRow label="Withdrawals Today" value={data.cashierOperations.withdrawalsProcessedToday} icon={ArrowDownToLine} color="rose" />
            <MetricAmountRow label="Counter Collections" value={data.cashierOperations.totalCounterCollectionsToday} icon={Receipt} color="indigo" />
          </div>
        </div>

        {/* GCash Operations */}
        <div onClick={() => onNavigate && onNavigate('staff-gcash')} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <Smartphone size={24} />
            </div>
            <h3 className="font-bold text-slate-800">GCash Operations</h3>
          </div>
          <div className="space-y-4">
            <MetricRow label="Pending Verifications" value={data.gcashOperations.pendingVerifications} icon={Smartphone} color="amber" />
            <MetricRow label="Verified Today" value={data.gcashOperations.verifiedToday} icon={ShieldCheck} color="emerald" />
            <MetricRow label="Failed Verifications" value={data.gcashOperations.failedVerifications} icon={XCircle} color="rose" />
          </div>
        </div>

        {/* Daily Transaction Summary */}
        <div onClick={() => onNavigate && onNavigate('staff-ledger')} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
              <Activity size={24} />
            </div>
            <h3 className="font-bold text-slate-800">Daily Transaction Summary</h3>
          </div>
          <div className="space-y-4">
            <MetricRow label="Total Transactions Today" value={data.dailySummary.totalTransactionsToday} icon={ArrowRightLeft} color="indigo" />
            <MetricAmountRow label="Total Cash Received" value={data.dailySummary.totalCashReceivedToday} icon={Banknote} color="emerald" />
            <MetricAmountRow label="Total Cash Released" value={data.dailySummary.totalCashReleasedToday} icon={ArrowDownToLine} color="rose" />
            <MetricRow label="Official Receipts Issued" value={data.dailySummary.officialReceiptsIssuedToday} icon={Ticket} color="blue" />
          </div>
        </div>

        {/* Member Support */}
        <div onClick={() => onNavigate && onNavigate('staff-inquiries')} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <HeadphonesIcon size={24} />
            </div>
            <h3 className="font-bold text-slate-800">Member Support</h3>
          </div>
          <div className="space-y-4">
            <MetricRow label="Pending Inquiries" value={data.memberSupport.pendingInquiries} icon={HeadphonesIcon} color="amber" />
            <MetricRow label="Resolved Today" value={data.memberSupport.resolvedToday} icon={CheckCircle2} color="emerald" />
            <MetricRow label="Pending SMS Notifications" value={data.memberSupport.pendingSmsNotifications} icon={BellRing} color="blue" />
          </div>
        </div>
        
      </div>
    </div>
  );
}

function MetricRow({ label, value, icon: Icon, color }: any) {
  const colorMap: any = {
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${colorMap[color] || 'bg-slate-50 text-slate-600'}`}>
          <Icon size={16} />
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className="font-bold text-slate-900 font-mono text-base">{value}</span>
    </div>
  );
}

function MetricAmountRow({ label, value, icon: Icon, color }: any) {
  const colorMap: any = {
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${colorMap[color] || 'bg-slate-50 text-slate-600'}`}>
          <Icon size={16} />
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className="font-bold text-slate-900 font-mono text-base">₱{(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  );
}

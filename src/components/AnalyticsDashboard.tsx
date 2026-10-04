import React, { useState, useEffect, } from 'react';
import {
  Users,
  Wallet,
  Coins,
  ShieldCheck,
  TrendingUp,
  Receipt,
  Percent,
  HelpCircle,
  MessageSquare,
  Activity,
  BarChart3,
  RefreshCw,
  Download,
  Filter,

  Clock,
  XCircle,

  PieChart as 
  SlidersHorizontal,
  FileSpreadsheet,
  FileText,
  Printer,

  X,

  RotateCcw,



  Check,
  ArrowUpRight,

} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  generateDescriptiveAnalysis,
  DescriptiveAnalysisReport,
  DomainDescriptiveFinding,
  ManagementPriority
} from '../utils/descriptiveAnalyticsEngine.js';

function PriorityBadge({ priority }: { priority: ManagementPriority }) {
  const styles: Record<ManagementPriority, string> = {
    'ATTENTION REQUIRED': 'bg-red-100 text-red-800 border-red-200',
    'REVIEW REQUIRED': 'bg-amber-100 text-amber-800 border-amber-200',
    'MONITOR': 'bg-blue-100 text-blue-800 border-blue-200',
    'INFORMATION': 'bg-emerald-100 text-emerald-800 border-emerald-200'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${styles[priority] || styles.INFORMATION}`}>
      {priority}
    </span>
  );
}

function DomainInterpretationBanner({ finding }: { finding?: DomainDescriptiveFinding }) {
  if (!finding) return null;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-slate-700 uppercase text-[10px]">
            Management Interpretation • Trend: {finding.trend}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            ({finding.comparisonBasis})
          </span>
        </div>
        <PriorityBadge priority={finding.priority} />
      </div>
      <p className="text-slate-800 font-medium leading-relaxed">{finding.currentCondition}</p>
      <p className="text-slate-600 text-[11px] leading-relaxed">
        <strong className="text-slate-700">Contributing Factors:</strong> {finding.contributingFactors}
      </p>
      <div className="pt-1.5 border-t border-slate-200/80 flex flex-wrap items-baseline gap-1.5 text-[11px]">
        <span className="font-mono font-bold text-emerald-700 uppercase text-[10px]">Action to Consider ({finding.operationalArea}):</span>
        <span className="text-slate-700 font-medium">{finding.actionToConsider}</span>
      </div>
    </div>
  );
}

interface AnalyticsDashboardProps {
  token: string;
}

interface FilterState {
  datePreset: string;
  startDate: string;
  endDate: string;
  memberType: string;
  loanProduct: string;
  savingsProduct: string;
  shareCapitalProduct: string;
  staffId: string;
  cashierId: string;
  status: string;
}

interface WidgetVisibility {
  kpiOverview: boolean;
  membership: boolean;
  savings: boolean;
  shareCapital: boolean;
  loans: boolean;
  financials: boolean;
  cashier: boolean;
  dividends: boolean;
  inquiries: boolean;
  notifications: boolean;
  audit: boolean;
}

const DEFAULT_WIDGETS: WidgetVisibility = {
  kpiOverview: true,
  membership: true,
  savings: true,
  shareCapital: true,
  loans: true,
  financials: true,
  cashier: true,
  dividends: true,
  inquiries: true,
  notifications: true,
  audit: true
};

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export function AnalyticsDashboard({ token }: AnalyticsDashboardProps) {
  const tooltipStyle = {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    color: '#0f172a',
    borderRadius: '0.75rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
  };
  const gridColor = '#f1f5f9';
  const textColor = '#64748b';

  // Data state
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(30); // seconds
  const [countdown, setCountdown] = useState<number>(30);

  // Customization & Widget Preferences
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false);
  const [widgetPrefs, setWidgetPrefs] = useState<WidgetVisibility>(() => {
    try {
      const saved = localStorage.getItem('coop_analytics_widget_prefs');
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch (e) {
      return DEFAULT_WIDGETS;
    }
  });

  // Filter Bar State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    datePreset: 'ALL_TIME',
    startDate: '',
    endDate: '',
    memberType: 'ALL',
    loanProduct: 'ALL',
    savingsProduct: 'ALL',
    shareCapitalProduct: 'ALL',
    staffId: 'ALL',
    cashierId: 'ALL',
    status: 'ALL'
  });

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);

  // Fetch Analytics Function
  const fetchAnalytics = async (silent = false) => {
    if (!silent) setLoading(true);
    setIsRefreshing(true);
    setError(null);

    try {
      // Build query string
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.memberType !== 'ALL') queryParams.append('memberType', filters.memberType);
      if (filters.loanProduct !== 'ALL') queryParams.append('loanProduct', filters.loanProduct);
      if (filters.savingsProduct !== 'ALL') queryParams.append('savingsProduct', filters.savingsProduct);
      if (filters.shareCapitalProduct !== 'ALL') queryParams.append('shareCapitalProduct', filters.shareCapitalProduct);
      if (filters.staffId !== 'ALL') queryParams.append('staffId', filters.staffId);
      if (filters.cashierId !== 'ALL') queryParams.append('cashierId', filters.cashierId);
      if (filters.status !== 'ALL') queryParams.append('status', filters.status);

      const url = `/api/analytics/descriptive?${queryParams.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to load analytical database records');

      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Error communicating with analytics endpoint');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch when filters change or when data update event is dispatched
  useEffect(() => {
    fetchAnalytics();

    const handleDataUpdated = () => {
      fetchAnalytics(true);
    };

    window.addEventListener('coop_data_updated', handleDataUpdated);
    return () => {
      window.removeEventListener('coop_data_updated', handleDataUpdated);
    };
  }, [filters, token]);

  // Handle Date Presets
  const handleDatePresetChange = (preset: string) => {
    const today = new Date();
    let start = '';
    let end = today.toISOString().substring(0, 10);

    if (preset === 'TODAY') {
      start = end;
    } else if (preset === 'THIS_WEEK') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(today.setDate(diff)).toISOString().substring(0, 10);
    } else if (preset === 'THIS_MONTH') {
      start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().substring(0, 10);
    } else if (preset === 'THIS_YEAR') {
      start = new Date(today.getFullYear(), 0, 1).toISOString().substring(0, 10);
    } else if (preset === 'ALL_TIME') {
      start = '';
      end = '';
    }

    setFilters(prev => ({
      ...prev,
      datePreset: preset,
      startDate: start,
      endDate: end
    }));
  };

  // Auto-refresh countdown timer
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    setCountdown(refreshInterval);
    const intervalId = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchAnalytics(true);
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [autoRefreshEnabled, refreshInterval, filters]);

  // Save widget preferences to localStorage
  const toggleWidget = (widgetKey: keyof WidgetVisibility) => {
    const updated = { ...widgetPrefs, [widgetKey]: !widgetPrefs[widgetKey] };
    setWidgetPrefs(updated);
    try {
      localStorage.setItem('coop_analytics_widget_prefs', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const resetWidgetPrefs = () => {
    setWidgetPrefs(DEFAULT_WIDGETS);
    try {
      localStorage.setItem('coop_analytics_widget_prefs', JSON.stringify(DEFAULT_WIDGETS));
    } catch (e) {
      console.error(e);
    }
  };

  // Clear all filters
  const resetFilters = () => {
    setFilters({
      datePreset: 'ALL_TIME',
      startDate: '',
      endDate: '',
      memberType: 'ALL',
      loanProduct: 'ALL',
      savingsProduct: 'ALL',
      shareCapitalProduct: 'ALL',
      staffId: 'ALL',
      cashierId: 'ALL',
      status: 'ALL'
    });
  };

  const activeFilterCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'datePreset') return val !== 'ALL_TIME';
    if (key === 'startDate' || key === 'endDate') return false;
    return val !== 'ALL';
  }).length;

  // EXPORT HANDLERS
  // 1. Export CSV
  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['COOPERATIVE DESCRIPTIVE ANALYTICS REPORT'],
      ['Generated At', data.generatedAt],
      ['Cooperative Name', data.cooperativeName],
      [''],
      ['CATEGORY', 'METRIC', 'VALUE'],
      ['Membership', 'Total Registered Members', data.membershipAnalytics.totalRegisteredMembers],
      ['Membership', 'Active Members', data.membershipAnalytics.activeMembers],
      ['Membership', 'Pending Registrations', data.membershipAnalytics.pendingRegistrations],
      ['Membership', 'Approved Members', data.membershipAnalytics.approvedMembers],
      ['Membership', 'Rejected Applications', data.membershipAnalytics.rejectedApplications],
      ['Savings', 'Total Savings Balance', `₱${data.savingsAnalytics.totalSavingsBalance}`],
      ['Savings', 'Total Deposits', `₱${data.savingsAnalytics.totalDeposits}`],
      ['Savings', 'Total Withdrawals', `₱${data.savingsAnalytics.totalWithdrawals}`],
      ['Share Capital', 'Total Share Capital', `₱${data.shareCapitalAnalytics.totalShareCapital}`],
      ['Share Capital', 'Paid Share Capital', `₱${data.shareCapitalAnalytics.paidShareCapital}`],
      ['Share Capital', 'Outstanding Share Capital', `₱${data.shareCapitalAnalytics.outstandingShareCapital}`],
      ['Loans', 'Total Loan Applications', data.loanAnalytics.totalLoanApplications],
      ['Loans', 'Approved Loans', data.loanAnalytics.approvedLoans],
      ['Loans', 'Pending Loans', data.loanAnalytics.pendingLoans],
      ['Loans', 'Released Loans', data.loanAnalytics.releasedLoans],
      ['Loans', 'Outstanding Loan Portfolio', `₱${data.loanAnalytics.outstandingLoanPortfolio}`],
      ['Loans', 'Loan Collection Performance %', `${data.loanAnalytics.loanCollectionPerformance}%`],
      ['Loans', 'Loan Delinquency Rate %', `${data.loanAnalytics.loanDelinquencyRate}%`],
      ['Financials', 'Total Assets', `₱${data.financialAnalytics.totalAssets}`],
      ['Financials', 'Total Liabilities', `₱${data.financialAnalytics.totalLiabilities}`],
      ['Financials', 'Total Equity', `₱${data.financialAnalytics.totalEquity}`],
      ['Financials', 'Revenue', `₱${data.financialAnalytics.revenue}`],
      ['Financials', 'Expenses', `₱${data.financialAnalytics.expenses}`],
      ['Financials', 'Net Income Surplus', `₱${data.financialAnalytics.netIncome}`],
      ['Cashier', 'Daily Transactions Count', data.cashierAnalytics.dailyTransactionsCount],
      ['Cashier', 'Daily Transactions Volume', `₱${data.cashierAnalytics.dailyTransactionsVolume}`],
      ['Cashier', 'Monthly Transactions Count', data.cashierAnalytics.monthlyTransactionsCount],
      ['Cashier', 'Monthly Transactions Volume', `₱${data.cashierAnalytics.monthlyTransactionsVolume}`],
      ['Cashier', 'Total Collections', `₱${data.cashierAnalytics.totalCollections}`],
      ['Dividends', 'Total Dividends Declared', `₱${data.dividendAnalytics.totalDividendsDeclared}`],
      ['Dividends', 'Dividends Distributed', `₱${data.dividendAnalytics.dividendsDistributed}`],
      ['Inquiries', 'Total Inquiries', data.inquiryAnalytics.totalInquiries],
      ['Inquiries', 'Pending Inquiries', data.inquiryAnalytics.pendingInquiries],
      ['Inquiries', 'Resolved Inquiries', data.inquiryAnalytics.resolvedInquiries],
      ['SMS Notifications', 'SMS Sent', data.notificationAnalytics.smsSent],
      ['SMS Notifications', 'SMS Delivered', data.notificationAnalytics.smsDelivered],
      ['SMS Notifications', 'SMS Failed', data.notificationAnalytics.smsFailed],
      ['SMS Notifications', 'Notification Success Rate %', `${data.notificationAnalytics.notificationSuccessRate}%`]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Descriptive_Analytics_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
  };

  // 2. Export Excel
  const handleExportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      { Metric: 'Total Registered Members', Value: data.membershipAnalytics.totalRegisteredMembers },
      { Metric: 'Active Members', Value: data.membershipAnalytics.activeMembers },
      { Metric: 'Total Savings Pool (₱)', Value: data.savingsAnalytics.totalSavingsBalance },
      { Metric: 'Total Share Capital (₱)', Value: data.shareCapitalAnalytics.totalShareCapital },
      { Metric: 'Total Loan Portfolio (₱)', Value: data.loanAnalytics.outstandingLoanPortfolio },
      { Metric: 'Total Cooperative Assets (₱)', Value: data.financialAnalytics.totalAssets },
      { Metric: 'Net Income Surplus (₱)', Value: data.financialAnalytics.netIncome },
      { Metric: 'Collection Performance (%)', Value: `${data.loanAnalytics.loanCollectionPerformance}%` },
      { Metric: 'SMS Success Rate (%)', Value: `${data.notificationAnalytics.notificationSuccessRate}%` }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'KPI Summary');

    // Membership Sheet
    const wsMembership = XLSX.utils.json_to_sheet([
      { Status: 'Active', Count: data.membershipAnalytics.activeMembers },
      { Status: 'Pending', Count: data.membershipAnalytics.pendingRegistrations },
      { Status: 'Rejected', Count: data.membershipAnalytics.rejectedApplications },
      { Status: 'Total Registered', Count: data.membershipAnalytics.totalRegisteredMembers }
    ]);
    XLSX.utils.book_append_sheet(wb, wsMembership, 'Membership Breakdown');

    // Savings & Loans Sheet
    const wsFinancials = XLSX.utils.json_to_sheet([
      { Category: 'Savings Deposits', Amount: data.savingsAnalytics.totalDeposits },
      { Category: 'Savings Withdrawals', Amount: data.savingsAnalytics.totalWithdrawals },
      { Category: 'Share Capital Base', Amount: data.shareCapitalAnalytics.totalShareCapital },
      { Category: 'Loan Applications', Count: data.loanAnalytics.totalLoanApplications },
      { Category: 'Released Loans', Count: data.loanAnalytics.releasedLoans },
      { Category: 'Outstanding Loan Portfolio', Amount: data.loanAnalytics.outstandingLoanPortfolio }
    ]);
    XLSX.utils.book_append_sheet(wb, wsFinancials, 'Savings & Loans');

    XLSX.writeFile(wb, `Coop_Analytics_${new Date().toISOString().substring(0, 10)}.xlsx`);
    setShowExportModal(false);
  };

  // 3. Print / PDF Handler
  const handlePrint = () => {
    window.print();
    setShowExportModal(false);
  };

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-4 shadow-sm animate-pulse">
        <RefreshCw size={40} className="mx-auto text-emerald-600 animate-spin" />
        <h3 className="text-lg font-bold text-slate-800 font-mono">Querying Live Database Analytics...</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Gathering financial balances, loan portfolios, transaction records, and user audit trails directly from the database.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-10 text-center space-y-3">
        <XCircle size={40} className="mx-auto text-red-500" />
        <h3 className="font-bold text-red-900 text-base font-mono">Analytics Engine Error</h3>
        <p className="text-xs text-red-700 max-w-lg mx-auto">{error || 'Could not load live analytics'}</p>
        <button
          onClick={() => fetchAnalytics()}
          className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
        >
          <RefreshCw size={14} /> Retry Query
        </button>
      </div>
    );
  }

  const {
    filterOptions,
    membershipAnalytics,
    savingsAnalytics,
    shareCapitalAnalytics,
    loanAnalytics,
    financialAnalytics,
    cashierAnalytics,
    dividendAnalytics,
    inquiryAnalytics,
    notificationAnalytics,
    auditAnalytics
  } = data;

  const descriptiveReport: DescriptiveAnalysisReport =
    data.descriptiveAnalysis || generateDescriptiveAnalysis(data, 'ADMIN');

  // Donut chart data for Loan Applications Status
  const loanStatusData = [
    { name: 'Approved', value: loanAnalytics.approvedLoans },
    { name: 'Pending', value: loanAnalytics.pendingLoans },
    { name: 'Released', value: loanAnalytics.releasedLoans },
    { name: 'Rejected', value: loanAnalytics.rejectedLoans || 0 }
  ].filter(item => item.value > 0);

  // Donut chart data for Inquiries
  const inquiryStatusData = [
    { name: 'Pending', value: inquiryAnalytics.pendingInquiries },
    { name: 'Resolved', value: inquiryAnalytics.resolvedInquiries }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6 animate-fade-in print:p-0 print:bg-white" id="descriptive-analytics-view">

      {/* HEADER BANNER WITH REAL-TIME UPDATES & EXPORT ACTIONS */}
      <div className="bg-white border border-slate-200 text-slate-800 p-6 sm:p-8 rounded-2xl shadow-xs space-y-6 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-700 font-mono text-xs font-bold uppercase tracking-wider">
              <BarChart3 size={16} />
              Descriptive Analytics & Business Intelligence
              {isRefreshing && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] animate-pulse">
                  <RefreshCw size={10} className="animate-spin" /> Syncing...
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Production Database Analytics</h2>
            <p className="text-xs text-slate-600 max-w-2xl">
              Comprehensive analytics module covering membership, savings, share capital, loan delinquency, cashier activity, dividends, inquiries, SMS, and audit trails.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Auto Refresh Toggle */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  autoRefreshEnabled ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {autoRefreshEnabled ? `Auto On (${countdown}s)` : 'Auto Off'}
              </button>
              {autoRefreshEnabled && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="bg-white text-slate-800 text-[11px] font-mono px-2 py-1 rounded-lg border border-slate-200 outline-none cursor-pointer"
                >
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              )}
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchAnalytics()}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                showFilters || activeFilterCount > 0
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-900 font-bold font-mono text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Personalize Layout Button */}
            <button
              onClick={() => setShowPersonalizeModal(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal size={14} />
              Customize
            </button>

            {/* Export Dropdown Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        {/* Live timestamp & active filter indicator */}
        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500 border-t border-slate-200 pt-3">
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-emerald-600" />
            Last Updated: {lastUpdated.toLocaleTimeString()}
          </div>
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 text-amber-700 font-semibold">
              <span>Active filters applied ({activeFilterCount})</span>
              <button onClick={resetFilters} className="underline text-slate-800 hover:text-amber-800 cursor-pointer">
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FILTER BAR SECTION */}
      {showFilters && (
        <div className="bg-white text-slate-800 border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 animate-fade-in print:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold font-mono text-slate-900">
              <Filter size={16} className="text-emerald-600" /> Multi-Dimensional Analytics Filter Engine
            </div>
            <button onClick={resetFilters} className="text-xs font-mono text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer font-bold">
              <RotateCcw size={12} /> Reset All Filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
            {/* Date Range Preset */}
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Date Range Preset</label>
              <select
                value={filters.datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono outline-none"
              >
                <option value="ALL_TIME">All Time</option>
                <option value="TODAY">Today</option>
                <option value="THIS_WEEK">This Week</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="THIS_YEAR">This Year</option>
              </select>
            </div>

            {/* Custom Start Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, datePreset: 'CUSTOM' }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-800 font-mono outline-none text-[11px]"
              />
            </div>

            {/* Custom End Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, datePreset: 'CUSTOM' }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-slate-800 font-mono outline-none text-[11px]"
              />
            </div>

            {/* Member Type Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Member Type</label>
              <select
                value={filters.memberType}
                onChange={(e) => setFilters(prev => ({ ...prev, memberType: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 font-mono outline-none"
              >
                <option value="ALL">All Types</option>
                {(filterOptions?.memberTypes || []).map((t: string) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Loan Product Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Loan Product</label>
              <select
                value={filters.loanProduct}
                onChange={(e) => setFilters(prev => ({ ...prev, loanProduct: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 font-mono outline-none"
              >
                <option value="ALL">All Loans</option>
                {(filterOptions?.loanProducts || []).map((lp: string) => (
                  <option key={lp} value={lp}>{lp}</option>
                ))}
              </select>
            </div>

            {/* Savings Product Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Savings Product</label>
              <select
                value={filters.savingsProduct}
                onChange={(e) => setFilters(prev => ({ ...prev, savingsProduct: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 font-mono outline-none"
              >
                <option value="ALL">All Savings</option>
                {(filterOptions?.savingsProducts || []).map((sp: string) => (
                  <option key={sp} value={sp}>{sp}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 font-mono outline-none"
              >
                <option value="ALL">All Statuses</option>
                {(filterOptions?.statuses || []).map((s: string) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* EXECUTIVE SUMMARY & DESCRIPTIVE ANALYSIS SECTION */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5" id="descriptive-management-summary">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-700 font-mono text-xs font-bold uppercase tracking-wider">
              <FileText size={15} />
              EXECUTIVE SUMMARY & DESCRIPTIVE ANALYSIS
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Management Interpretation & Actionable Insights
            </h3>
            <p className="text-xs text-slate-500">
              Read-only narrative interpretation generated strictly from live cooperative database metrics, historical comparisons, and operational queues.
            </p>
          </div>
          <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-mono font-bold uppercase self-start sm:self-center">
            Read-Only Advisory
          </span>
        </div>

        {/* Executive Summary Narrative */}
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2">
          <div className="text-[10px] font-mono font-bold uppercase text-emerald-800 tracking-wider">
            EXECUTIVE SUMMARY
          </div>
          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium" id="executive-summary-text">
            {descriptiveReport.executiveSummary}
          </p>
        </div>

        {/* Descriptive Analysis Structured Blocks */}
        <div className="space-y-4">
          <div className="text-xs font-mono font-bold uppercase text-slate-700 tracking-wider">
            DESCRIPTIVE ANALYSIS
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">
              Overall Situation:
            </span>
            <p className="text-xs text-slate-800 leading-relaxed font-medium" id="overall-situation-text">
              {descriptiveReport.overallSituation}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Key Findings */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-700 block">
                Key Findings:
              </span>
              <ul className="space-y-2 text-xs text-slate-700" id="key-findings-list">
                {descriptiveReport.keyFindings.map((f) => (
                  <li key={f.domainKey} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-emerald-600 font-bold mt-0.5">•</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-slate-900">{f.domainTitle}:</strong>
                        <PriorityBadge priority={f.priority} />
                        <span className="text-[10px] font-mono text-slate-500">
                          [{f.trend}]
                        </span>
                      </div>
                      <p className="text-slate-700">{f.currentCondition}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Areas Requiring Attention & Actions to Consider */}
            <div className="space-y-4">
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2.5">
                <span className="text-[10px] font-mono font-bold uppercase text-amber-900 block">
                  Areas Requiring Attention:
                </span>
                {descriptiveReport.areasRequiringAttention.length > 0 ? (
                  <ul className="space-y-2 text-xs text-slate-800" id="areas-requiring-attention-list">
                    {descriptiveReport.areasRequiringAttention.map((a) => (
                      <li key={a.domainKey} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-amber-600 font-bold mt-0.5">•</span>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <strong className="text-slate-900">{a.domainTitle} ({a.operationalArea})</strong>
                            <PriorityBadge priority={a.priority} />
                          </div>
                          <p>{a.currentCondition}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-600 font-mono">
                    • No critical operational or financial exceptions currently flagged for immediate escalation.
                  </p>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 block">
                  Actions to Consider:
                </span>
                <ul className="space-y-2 text-xs text-slate-700" id="actions-to-consider-list">
                  {descriptiveReport.actionsToConsider.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-emerald-600 font-bold mt-0.5">•</span>
                      <div className="flex-1">
                        <strong className="text-slate-900">{item.area}:</strong> {item.action}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {descriptiveReport.dataLimitations.length > 0 && (
                <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-600 block">
                    Data Limitations & Comparison Notes:
                  </span>
                  <ul className="space-y-1.5 text-[11px] text-slate-600" id="data-limitations-list">
                    {descriptiveReport.dataLimitations.map((lim, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-slate-400 font-bold">•</span>
                        <span>{lim}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 0. HIGH LEVEL REAL-TIME KPI CARDS */}
      {widgetPrefs.kpiOverview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">Cooperative Assets</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl"><Wallet size={18} /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 font-mono">₱{(financialAnalytics.totalAssets || 0).toLocaleString()}</p>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-mono font-bold">
              <ArrowUpRight size={14} /> Total Savings + Loans Balance
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">Active Members</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl"><Users size={18} /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 font-mono">{membershipAnalytics.activeMembers}</p>
            <div className="text-[11px] text-slate-500 font-mono">
              Out of {membershipAnalytics.totalRegisteredMembers} total registered
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">Loan Portfolio</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-2xl"><ShieldCheck size={18} /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 font-mono">₱{(loanAnalytics.outstandingLoanPortfolio || 0).toLocaleString()}</p>
            <div className="flex items-center gap-1 text-[11px] text-amber-700 font-mono font-bold">
              Collection Rate: {loanAnalytics.loanCollectionPerformance}%
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">Net Income Surplus</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={18} /></div>
            </div>
            <p className="text-2xl font-black text-slate-900 font-mono">₱{(financialAnalytics.netIncome || 0).toLocaleString()}</p>
            <div className="text-[11px] text-emerald-600 font-mono font-bold">
              Revenue: ₱{(financialAnalytics.revenue || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* 1. MEMBERSHIP ANALYTICS (KPIs, Line Chart & Pie Chart) */}
      {widgetPrefs.membership && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl"><Users size={20} /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">1. Membership Analytics</h3>
                <p className="text-xs text-slate-500">Registered member counts, active vs pending status, age & gender distribution, and registration trend line chart.</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
              {membershipAnalytics.totalRegisteredMembers} Total Members
            </span>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Total Registered</span>
              <p className="text-xl font-black text-slate-800 font-mono mt-1">{membershipAnalytics.totalRegisteredMembers}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase">Active Members</span>
              <p className="text-xl font-black text-emerald-800 font-mono mt-1">{membershipAnalytics.activeMembers}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-amber-600 font-mono uppercase">Pending Registrations</span>
              <p className="text-xl font-black text-amber-800 font-mono mt-1">{membershipAnalytics.pendingRegistrations}</p>
            </div>
            <div className="bg-emerald-50 border border-indigo-100 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase">Approved Members</span>
              <p className="text-xl font-black text-emerald-600 font-mono mt-1">{membershipAnalytics.approvedMembers}</p>
            </div>
            <div className="bg-red-50 border border-red-100 p-3.5 rounded-2xl">
              <span className="text-[10px] font-bold text-red-600 font-mono uppercase">Rejected Applications</span>
              <p className="text-xl font-black text-red-800 font-mono mt-1">{membershipAnalytics.rejectedApplications}</p>
            </div>
          </div>

          <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.membership} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Line Chart: Membership Growth Trend */}
            <div className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 font-mono uppercase">Line Chart — Membership Growth Trend</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={membershipAnalytics.membershipGrowthTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} name="Registrations" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart: Gender Distribution */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 font-mono uppercase">Pie Chart — Gender Breakdown</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={membershipAnalytics.genderDistribution}
                      dataKey="count"
                      nameKey="gender"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={(entry: any) => `${entry.gender}: ${entry.count}`}
                    >
                      {membershipAnalytics.genderDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. SAVINGS ANALYTICS (Bar Chart & Trend Chart) */}
      {widgetPrefs.savings && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl"><Wallet size={20} /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">2. Savings Analytics</h3>
                <p className="text-xs text-slate-500">Total savings pool, deposits, withdrawals, and Bar/Trend chart comparing monthly net cash flows.</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              ₱{(savingsAnalytics.totalSavingsBalance || 0).toLocaleString()} Total Savings
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Total Savings Balance</span>
              <p className="text-2xl font-black text-emerald-700 font-mono">₱{(savingsAnalytics.totalSavingsBalance || 0).toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 border border-indigo-100 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase">Total Deposits</span>
              <p className="text-2xl font-black text-emerald-600 font-mono">₱{(savingsAnalytics.totalDeposits || 0).toLocaleString()}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-amber-600 font-mono uppercase">Total Withdrawals</span>
              <p className="text-2xl font-black text-amber-900 font-mono">₱{(savingsAnalytics.totalWithdrawals || 0).toLocaleString()}</p>
            </div>
          </div>

          <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.savings} />
          <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.timeDeposits} />

          {/* Bar Chart — Deposits vs Withdrawals */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 font-mono uppercase">Bar Chart — Monthly Deposits vs Withdrawals</h4>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={savingsAnalytics.savingsGrowthTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="deposits" fill="#10b981" name="Deposits (₱)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="withdrawals" fill="#f59e0b" name="Withdrawals (₱)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 3. SHARE CAPITAL ANALYTICS (Area Chart) */}
      {widgetPrefs.shareCapital && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl"><Coins size={20} /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">3. Share Capital Analytics</h3>
                <p className="text-xs text-slate-500">Paid member capital, outstanding capital gap, and Area chart tracking cumulative share growth.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Total Share Capital</span>
              <p className="text-2xl font-black text-emerald-600 font-mono">₱{(shareCapitalAnalytics.totalShareCapital || 0).toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase">Paid Share Capital</span>
              <p className="text-2xl font-black text-emerald-900 font-mono">₱{(shareCapitalAnalytics.paidShareCapital || 0).toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Outstanding Share Capital</span>
              <p className="text-2xl font-black text-slate-800 font-mono">₱{(shareCapitalAnalytics.outstandingShareCapital || 0).toLocaleString()}</p>
            </div>
          </div>

          <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.shareCapital} />

          {/* Area Chart: Share Capital Growth */}
          {shareCapitalAnalytics.shareCapitalGrowth.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 font-mono uppercase">Area Chart — Share Capital Contribution Velocity</h4>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={shareCapitalAnalytics.shareCapitalGrowth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip />
                    <Area type="monotone" dataKey="amount" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} name="Capital Receipts (₱)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. LOAN ANALYTICS (Donut Chart & Key Metrics) */}
      {widgetPrefs.loans && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl"><ShieldCheck size={20} /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">4. Loan Portfolio Analytics</h3>
                <p className="text-xs text-slate-500">Applications, approvals, released loans, collection rates, delinquency rates, and Donut chart breakdown.</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-indigo-150">
              {loanAnalytics.totalLoanApplications} Applications
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-center">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
              <span className="text-[9px] font-bold text-slate-400 font-mono uppercase block">Applications</span>
              <p className="text-lg font-black text-slate-800 font-mono mt-1">{loanAnalytics.totalLoanApplications}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl">
              <span className="text-[9px] font-bold text-emerald-600 font-mono uppercase block">Approved</span>
              <p className="text-lg font-black text-emerald-800 font-mono mt-1">{loanAnalytics.approvedLoans}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl">
              <span className="text-[9px] font-bold text-amber-600 font-mono uppercase block">Pending</span>
              <p className="text-lg font-black text-amber-800 font-mono mt-1">{loanAnalytics.pendingLoans}</p>
            </div>
            <div className="bg-emerald-50 border border-indigo-100 p-3 rounded-2xl">
              <span className="text-[9px] font-bold text-emerald-600 font-mono uppercase block">Released</span>
              <p className="text-lg font-black text-emerald-600 font-mono mt-1">{loanAnalytics.releasedLoans}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl col-span-2">
              <span className="text-[9px] font-bold text-slate-400 font-mono uppercase block">Outstanding Portfolio</span>
              <p className="text-lg font-black text-emerald-600 font-mono mt-1">₱{(loanAnalytics.outstandingLoanPortfolio || 0).toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl">
              <span className="text-[9px] font-bold text-emerald-600 font-mono uppercase block">Collection Rate</span>
              <p className="text-lg font-black text-emerald-800 font-mono mt-1">{loanAnalytics.loanCollectionPerformance}%</p>
            </div>
            <div className="bg-red-50 border border-red-100 p-3 rounded-2xl">
              <span className="text-[9px] font-bold text-red-600 font-mono uppercase block">Delinquency Rate</span>
              <p className="text-lg font-black text-red-800 font-mono mt-1">{loanAnalytics.loanDelinquencyRate}%</p>
            </div>
          </div>

          <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.loans} />

          {/* Donut Chart: Loan Applications Breakdown */}
          {loanStatusData.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 font-mono uppercase">Donut Chart — Loan Application Status Ratio</h4>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={loanStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#4f46e5" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. FINANCIAL ANALYTICS */}
      {widgetPrefs.financials && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={20} /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">5. Financial Health & Income Statement</h3>
                <p className="text-xs text-slate-500">Assets, Liabilities, Equity, Loan Interest Revenue, Operating Expenses, and Net Surplus.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white text-slate-800 p-5 rounded-2xl space-y-2 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">Total Cooperative Assets</span>
              <p className="text-2xl font-black font-mono text-slate-900">₱{(financialAnalytics.totalAssets || 0).toLocaleString()}</p>
              <div className="text-[11px] text-slate-600 font-mono space-y-1 border-t border-slate-200 pt-2">
                <div className="flex justify-between"><span>Liabilities:</span><span>₱{(financialAnalytics.totalLiabilities || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Equity:</span><span>₱{(financialAnalytics.totalEquity || 0).toLocaleString()}</span></div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-indigo-150 p-5 rounded-2xl space-y-2">
              <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase tracking-wider block">Revenue & Interest Earned</span>
              <p className="text-2xl font-black font-mono text-emerald-600">₱{(financialAnalytics.revenue || 0).toLocaleString()}</p>
              <p className="text-xs text-emerald-600">Accumulated loan interest earnings across active borrowing portfolios.</p>
            </div>

            <div className="bg-emerald-50 border border-emerald-150 p-5 rounded-2xl space-y-2">
              <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase tracking-wider block">Net Income Surplus</span>
              <p className="text-2xl font-black font-mono text-emerald-900">₱{(financialAnalytics.netIncome || 0).toLocaleString()}</p>
              <p className="text-xs text-emerald-700">Revenue minus distributed dividend yields and operating expenses.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.revenue} />
            <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.expenses} />
            <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.profitability} />
            <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.pricingMarkup} />
          </div>
        </div>
      )}

      {/* 6. CASHIER ANALYTICS */}
      {widgetPrefs.cashier && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-slate-100 text-slate-700 rounded-2xl"><Receipt size={20} /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">6. Cashier & Counter Performance</h3>
                <p className="text-xs text-slate-500">Daily cashier throughput, monthly transaction volume, and counter deposit collections.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Daily Transactions (Today)</span>
              <p className="text-2xl font-black text-slate-800 font-mono">{cashierAnalytics.dailyTransactionsCount} txns</p>
              <p className="text-xs text-emerald-600 font-bold font-mono">₱{(cashierAnalytics.dailyTransactionsVolume || 0).toLocaleString()} volume</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Monthly Transactions</span>
              <p className="text-2xl font-black text-slate-800 font-mono">{cashierAnalytics.monthlyTransactionsCount} txns</p>
              <p className="text-xs text-emerald-600 font-bold font-mono">₱{(cashierAnalytics.monthlyTransactionsVolume || 0).toLocaleString()} volume</p>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase">Total Counter Collections</span>
              <p className="text-2xl font-black text-emerald-800 font-mono">₱{(cashierAnalytics.totalCollections || 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.transactionActivity} />
            <DomainInterpretationBanner finding={descriptiveReport.domainEvaluations?.liquidity} />
          </div>
        </div>
      )}

      {/* 7, 8, 9 DIVIDENDS, INQUIRIES, NOTIFICATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dividends */}
        {widgetPrefs.dividends && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm border-b border-slate-100 pb-3">
              <Percent size={18} className="text-emerald-600" /> 7. Dividend Analytics
            </div>
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex justify-between items-center">
                <span className="text-slate-600">Total Declared Dividends</span>
                <span className="font-bold font-mono text-slate-800">₱{(dividendAnalytics.totalDividendsDeclared || 0).toLocaleString()}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl flex justify-between items-center">
                <span className="text-emerald-700">Dividends Distributed</span>
                <span className="font-bold font-mono text-emerald-800">₱{(dividendAnalytics.dividendsDistributed || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Inquiries */}
        {widgetPrefs.inquiries && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm border-b border-slate-100 pb-3">
              <HelpCircle size={18} className="text-emerald-600" /> 8. Member Inquiry Donut
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <span className="text-[9px] text-slate-400 font-mono block">Total</span>
                <span className="font-black font-mono text-slate-800 text-base">{inquiryAnalytics.totalInquiries}</span>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl">
                <span className="text-[9px] text-amber-600 font-mono block">Pending</span>
                <span className="font-black font-mono text-amber-800 text-base">{inquiryAnalytics.pendingInquiries}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl">
                <span className="text-[9px] text-emerald-600 font-mono block">Resolved</span>
                <span className="font-black font-mono text-emerald-800 text-base">{inquiryAnalytics.resolvedInquiries}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {widgetPrefs.notifications && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm border-b border-slate-100 pb-3">
              <MessageSquare size={18} className="text-emerald-600" /> 9. SMS Notification Analytics
            </div>
            <div className="grid grid-cols-4 gap-1 text-center text-xs">
              <div className="bg-slate-50 border border-slate-200 p-2 rounded-2xl">
                <span className="text-[9px] text-slate-400 font-mono block">Sent</span>
                <span className="font-bold font-mono text-slate-800">{notificationAnalytics.smsSent}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-2xl">
                <span className="text-[9px] text-emerald-600 font-mono block">Delivered</span>
                <span className="font-bold font-mono text-emerald-800">{notificationAnalytics.smsDelivered}</span>
              </div>
              <div className="bg-red-50 border border-red-100 p-2 rounded-2xl">
                <span className="text-[9px] text-red-600 font-mono block">Failed</span>
                <span className="font-bold font-mono text-red-800">{notificationAnalytics.smsFailed}</span>
              </div>
              <div className="bg-emerald-50 border border-indigo-100 p-2 rounded-2xl">
                <span className="text-[9px] text-emerald-600 font-mono block">Rate</span>
                <span className="font-bold font-mono text-emerald-600">{notificationAnalytics.notificationSuccessRate}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 10. AUDIT ANALYTICS & TABLES */}
      {widgetPrefs.audit && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl"><Activity size={20} /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">10. Audit Analytics & Security Trail Table</h3>
                <p className="text-xs text-slate-500">User login trends line chart and most active system users data table.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Login Trends */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 font-mono uppercase">User Login & Session Trend (Last 14 Days)</h4>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={auditAnalytics.userLoginTrends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#10b981" fill="#d1fae5" strokeWidth={2} name="Logins" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Audit Table */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 font-mono uppercase">Data Table — Most Active System Accounts</h4>
              <div className="overflow-x-auto max-h-52 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="p-2">User Account</th>
                      <th className="p-2">Role</th>
                      <th className="p-2 text-right">Audit Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditAnalytics.mostActiveUsers.map((u: any, i: number) => (
                      <tr key={u.email || i} className="hover:bg-slate-100/60">
                        <td className="p-2 font-bold text-slate-800">{u.email}</td>
                        <td className="p-2 font-mono text-[10px]">
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-bold">{u.role}</span>
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-600">{u.count} actions</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PERSONALIZE / WIDGET CUSTOMIZER MODAL */}
      {showPersonalizeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={20} className="text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-lg">Personalize Dashboard</h3>
              </div>
              <button onClick={() => setShowPersonalizeModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Toggle visibility for individual analytical modules. Preferences are saved automatically to your session.
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {[
                { key: 'kpiOverview', label: 'Top KPI Cards Overview' },
                { key: 'membership', label: '1. Membership Analytics & Growth' },
                { key: 'savings', label: '2. Savings Analytics & Cash Flow' },
                { key: 'shareCapital', label: '3. Share Capital Analytics' },
                { key: 'loans', label: '4. Loan Portfolio & Delinquency' },
                { key: 'financials', label: '5. Financial Health & Income Statement' },
                { key: 'cashier', label: '6. Cashier & Counter Performance' },
                { key: 'dividends', label: '7. Dividend Declarations' },
                { key: 'inquiries', label: '8. Member Inquiries' },
                { key: 'notifications', label: '9. SMS Alerts & Delivery' },
                { key: 'audit', label: '10. Audit Trail & Security' },
              ].map((item) => {
                const k = item.key as keyof WidgetVisibility;
                const active = widgetPrefs[k];
                return (
                  <div
                    key={item.key}
                    onClick={() => toggleWidget(k)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      active ? 'bg-emerald-50/60 border-indigo-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold ${
                      active ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {active ? <Check size={14} /> : <X size={14} />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={resetWidgetPrefs}
                className="text-xs font-mono text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Reset Defaults
              </button>
              <button
                onClick={() => setShowPersonalizeModal(false)}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT OPTIONS MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Download size={20} className="text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-lg">Export Analytics Report</h3>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select your preferred format to export the live descriptive analytics data.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleExportExcel}
                className="w-full flex items-center gap-3 p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl text-emerald-900 text-left transition-all cursor-pointer"
              >
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl"><FileSpreadsheet size={20} /></div>
                <div>
                  <h4 className="font-bold text-sm">Excel Workbook (.xlsx)</h4>
                  <p className="text-[11px] text-emerald-700">Native Excel spreadsheet with multiple category sheets.</p>
                </div>
              </button>

              <button
                onClick={handleExportCSV}
                className="w-full flex items-center gap-3 p-4 bg-emerald-50 hover:bg-emerald-700 border border-indigo-200 rounded-2xl text-emerald-600 text-left transition-all cursor-pointer"
              >
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl"><FileText size={20} /></div>
                <div>
                  <h4 className="font-bold text-sm">CSV File (.csv)</h4>
                  <p className="text-[11px] text-emerald-600">Standard comma-separated text file compatible with all data tools.</p>
                </div>
              </button>

              <button
                onClick={handlePrint}
                className="w-full flex items-center gap-3 p-4 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 rounded-2xl text-left transition-all cursor-pointer"
              >
                <div className="p-2.5 bg-white/10 text-white rounded-xl"><Printer size={20} /></div>
                <div>
                  <h4 className="font-bold text-sm">PDF / Print Layout</h4>
                  <p className="text-[11px] text-slate-300">Clean, formatted executive print layout & PDF document generator.</p>
                </div>
              </button>
            </div>

            <div className="text-right pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

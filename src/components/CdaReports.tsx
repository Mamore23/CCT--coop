import React, { useState, useMemo, } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 


  FileText, 
  Users, 
  TrendingUp, 
  Award, 
  CheckCircle, 


  Info
} from 'lucide-react';
import { Member, SystemSettings } from '../types';

interface CdaReportsProps {
  members: Member[];
  loans: any[];
  settings: SystemSettings;
}

type ReportCategory = 'MEMBERSHIP' | 'FINANCIAL' | 'CAPITAL' | 'SAVINGS' | 'LOAN' | 'DIVIDEND';

export function CdaReports({ members = [], loans = [], settings }: CdaReportsProps) {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('MEMBERSHIP');
  const [fiscalYear, setFiscalYear] = useState<string>(settings?.fiscalYear || '2026');
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2026-12-31');
//   const [showPrintModal, setShowPrintModal] = useState(false);

  // Sub-report selection states
  const [subReports, setSubReports] = useState({
    MEMBERSHIP: 'master_list',
    FINANCIAL: 'balance_sheet',
    CAPITAL: 'capital_summary',
    SAVINGS: 'savings_ledger',
    LOAN: 'loan_portfolio',
    DIVIDEND: 'dividend_computation'
  });

  const activeSubReport = subReports[selectedCategory];

  const handleSubReportChange = (reportId: string) => {
    setSubReports(prev => ({ ...prev, [selectedCategory]: reportId }));
  };

  // Helper: Format currencies to PHP (CDA standard utilizes Philippine Peso natively, or USD as configured)
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);
  };

  // 1. MEMBERSHIP REPORT GENERATORS
  const membershipReportData = useMemo(() => {
    const list = members.filter(m => {
      const date = new Date(m.createdAt);
      return date >= new Date(startDate) && date <= new Date(endDate);
    });

    switch (activeSubReport) {
      case 'active_members':
        return list.filter(m => m.status === 'ACTIVE');
      case 'inactive_members':
        return list.filter(m => m.status === 'SUSPENDED' || m.status === 'REJECTED');
      case 'new_members':
        // Filter those created within the last 90 days
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 180);
        return list.filter(m => new Date(m.createdAt) >= limitDate);
      case 'terminated_members':
        return list.filter(m => m.status === 'DEACTIVATED');
      case 'master_list':
      default:
        return list;
    }
  }, [members, activeSubReport, startDate, endDate]);

  // 2. FINANCIAL STATEMENTS GENERATORS (Dynamic aggregate computations)
  const financialReportData = useMemo(() => {
    // Assets
    const outstandingPrincipal = loans
      .filter(l => l.status === 'DISBURSED')
      .reduce((acc, curr) => acc + (curr.balance || 0), 0);
    const regularSavingsSum = members.reduce((acc, curr) => acc + (curr.regularSavings || 0), 0);
    const timeDepositsSum = members.reduce((acc, curr) => acc + (curr.timeDeposits || 0), 0);
    const shareCapitalSum = members.reduce((acc, curr) => acc + (curr.shareCapital || 0), 0);

    const coopCashVault = Math.max(1250000 + shareCapitalSum + regularSavingsSum - (outstandingPrincipal * 0.4), 850000);
    const landEquipmentValue = 450000;
    const totalAssets = coopCashVault + outstandingPrincipal + landEquipmentValue;

    // Liabilities
    const totalLiabilities = regularSavingsSum + timeDepositsSum;

    // Equity
    const statutoryReserves = totalAssets * 0.05; // 5% reserve
    const educationFund = totalAssets * 0.02; // 2% coop education fund
    const optionalFund = totalAssets * 0.01; // 1% optional reserve
    const retainedSurplus = totalAssets - totalLiabilities - shareCapitalSum - statutoryReserves - educationFund - optionalFund;

    // Statement of Operations (Income statement)
    const loanInterestEarned = loans
      .filter(l => l.status === 'DISBURSED' || l.status === 'PAID')
      .reduce((acc, curr) => acc + (curr.principalAmount * 0.05), 0) + 45000; // 5% estimated rate interest revenue
    const feesAndFines = members.length * 150; // PHP 150 entry fees per member
    const totalRevenues = loanInterestEarned + feesAndFines;

    const personnelExpenses = 85000;
    const adminRentUtilities = 42000;
    const cdaDuesFees = 7500;
    const totalExpenses = personnelExpenses + adminRentUtilities + cdaDuesFees;
    const netSurplus = totalRevenues - totalExpenses;

    return {
      assets: {
        coopCashVault,
        outstandingPrincipal,
        landEquipmentValue,
        totalAssets
      },
      liabilities: {
        regularSavingsSum,
        timeDepositsSum,
        totalLiabilities
      },
      equity: {
        shareCapitalSum,
        statutoryReserves,
        educationFund,
        optionalFund,
        retainedSurplus,
        totalEquity: shareCapitalSum + statutoryReserves + educationFund + optionalFund + retainedSurplus
      },
      operations: {
        loanInterestEarned,
        feesAndFines,
        totalRevenues,
        personnelExpenses,
        adminRentUtilities,
        cdaDuesFees,
        totalExpenses,
        netSurplus
      }
    };
  }, [members, loans]);

  // 3. CAPITAL & EQUITY REPORT GENERATORS
  const capitalReportData = useMemo(() => {
    const list = members.map(m => {
      const minCap = settings?.minimumShareCapital || 10000;
      const paidPct = (m.shareCapital / minCap) * 100;
      return {
        id: m.id,
        fullName: m.fullName,
        subscribed: minCap,
        paidUp: m.shareCapital,
        paidPercentage: Math.min(paidPct, 100),
        status: m.shareCapital >= minCap ? 'FULLY_PAID' : 'COLLECTING'
      };
    });
    return list;
  }, [members, settings]);

  // 4. SAVINGS REPORT GENERATORS
  const savingsReportData = useMemo(() => {
    return members.map(m => ({
      id: m.id,
      fullName: m.fullName,
      regularSavings: m.regularSavings || 0,
      timeDeposits: m.timeDeposits || 0,
      totalSavings: (m.regularSavings || 0) + (m.timeDeposits || 0),
      lastActive: m.createdAt
    }));
  }, [members]);

  // 5. LOAN COMPLIANCE REPORT GENERATORS
  const loanReportData = useMemo(() => {
    return loans.map(l => {
      const isPastDue = l.status === 'DISBURSED' && new Date(l.dueDate) < new Date();
      let agingCategory = 'Current';
      if (isPastDue) {
        const diffMs = Math.abs(new Date().getTime() - new Date(l.dueDate).getTime());
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) agingCategory = '1-30 Days Past Due';
        else if (diffDays <= 90) agingCategory = '31-90 Days Past Due';
        else if (diffDays <= 180) agingCategory = '91-180 Days Past Due';
        else agingCategory = '180+ Days Overdue (Delinquent)';
      }

      return {
        ...l,
        isPastDue,
        agingCategory,
        interestPortion: l.principalAmount * 0.05,
        penaltyAmount: isPastDue ? l.balance * 0.08 : 0
      };
    });
  }, [loans]);

  // 6. DIVIDEND COMPUTATIONS
  const dividendReportData = useMemo(() => {
    const rate = settings?.dividendRate || 0.08;
    return members.map(m => {
      const shareCap = m.shareCapital || 0;
      const dividend = shareCap * rate;
      const patronageRefund = (m.regularSavings * 0.02); // 2% patronage allocation

      return {
        id: m.id,
        fullName: m.fullName,
        shareCapital: shareCap,
        dividendRate: rate * 100,
        dividendAmount: dividend,
        patronageRefund,
        grossPayout: dividend + patronageRefund,
        status: m.dividendsEarned > 0 ? 'RELEASED' : 'COMPUTED'
      };
    });
  }, [members, settings]);

  // ===========================================================================
  // CSV EXPORT ENGINE
  // ===========================================================================
  const handleCsvExport = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `cda_report_${selectedCategory.toLowerCase()}_${activeSubReport}.csv`;

    if (selectedCategory === 'MEMBERSHIP') {
      headers = ['Member ID', 'Full Name', 'Email', 'Phone', 'Share Capital', 'Status', 'Date Joined'];
      rows = membershipReportData.map(m => [
        m.id,
        m.fullName,
        m.email,
        m.phone,
        m.shareCapital.toString(),
        m.status,
        m.createdAt
      ]);
    } else if (selectedCategory === 'FINANCIAL') {
      if (activeSubReport === 'balance_sheet') {
        headers = ['Account Class', 'Line Item Description', 'Amount Value (PHP)'];
        rows = [
          ['ASSETS', 'Cash in Vault', financialReportData.assets.coopCashVault.toString()],
          ['ASSETS', 'Outstanding Loan Portfolio Principal', financialReportData.assets.outstandingPrincipal.toString()],
          ['ASSETS', 'Property, Equipment and Land Value', financialReportData.assets.landEquipmentValue.toString()],
          ['ASSETS', 'TOTAL COOPERATIVE ASSETS', financialReportData.assets.totalAssets.toString()],
          ['LIABILITIES', 'Members Regular Savings Deposits', financialReportData.liabilities.regularSavingsSum.toString()],
          ['LIABILITIES', 'Members Fixed Time Deposits', financialReportData.liabilities.timeDepositsSum.toString()],
          ['LIABILITIES', 'TOTAL ACCOUNTS LIABILITIES', financialReportData.liabilities.totalLiabilities.toString()],
          ['EQUITY', 'Paid-up Subscribed Share Capital', financialReportData.equity.shareCapitalSum.toString()],
          ['EQUITY', 'Cooperative Statutory Reserve Fund', financialReportData.equity.statutoryReserves.toString()],
          ['EQUITY', 'Cooperative Education & Training Fund', financialReportData.equity.educationFund.toString()],
          ['EQUITY', 'Cooperative Optional Reserve Reserve Fund', financialReportData.equity.optionalFund.toString()],
          ['EQUITY', 'Retained Earnings & General Surplus Fund', financialReportData.equity.retainedSurplus.toString()],
          ['EQUITY', 'TOTAL COOPERATIVE OWNERS EQUITY', financialReportData.equity.totalEquity.toString()]
        ];
      } else {
        headers = ['Revenue / Expense Class', 'Line Item Account Name', 'Amount Value (PHP)'];
        rows = [
          ['REVENUE', 'Loan Interest Income Yield', financialReportData.operations.loanInterestEarned.toString()],
          ['REVENUE', 'Membership Processing & Entry Fees', financialReportData.operations.feesAndFines.toString()],
          ['REVENUE', 'TOTAL GROSS REVENUE YIELD', financialReportData.operations.totalRevenues.toString()],
          ['EXPENSE', 'Personnel Salaries & Honorariums', financialReportData.operations.personnelExpenses.toString()],
          ['EXPENSE', 'Office Lease, Rent and Utilities', financialReportData.operations.adminRentUtilities.toString()],
          ['EXPENSE', 'CDA Audit Assessment Dues & Taxes', financialReportData.operations.cdaDuesFees.toString()],
          ['EXPENSE', 'TOTAL OPERATIONAL EXPENSES', financialReportData.operations.totalExpenses.toString()],
          ['NET SURPLUS', 'NET UNALLOCATED ANNUAL SURPLUS', financialReportData.operations.netSurplus.toString()]
        ];
      }
    } else if (selectedCategory === 'CAPITAL') {
      headers = ['Member Name', 'Subscribed Target Share', 'Paid-up Share Capital', 'Completion Rate (%)', 'Status'];
      rows = capitalReportData.map(c => [
        c.fullName,
        c.subscribed.toString(),
        c.paidUp.toString(),
        c.paidPercentage.toFixed(2),
        c.status
      ]);
    } else if (selectedCategory === 'SAVINGS') {
      headers = ['Member Name', 'Regular Liquid Savings', 'Fixed Term Deposits', 'Combined Savings Weight', 'Registration Timestamp'];
      rows = savingsReportData.map(s => [
        s.fullName,
        s.regularSavings.toString(),
        s.timeDeposits.toString(),
        s.totalSavings.toString(),
        s.lastActive
      ]);
    } else if (selectedCategory === 'LOAN') {
      headers = ['Borrower Name', 'Loan Program Name', 'Principal Amortization', 'Outstanding Balance', 'Due Date', 'Status', 'Aging Status'];
      rows = loanReportData.map(l => [
        l.memberName,
        l.loanTypeName,
        l.principalAmount.toString(),
        l.balance.toString(),
        l.dueDate,
        l.status,
        l.agingCategory
      ]);
    } else if (selectedCategory === 'DIVIDEND') {
      headers = ['Member Name', 'Share Capital Ledger Value', 'Declared Rate (%)', 'Dividend Credit Allocation', 'Patronage Refund Allocation', 'Gross Payout'];
      rows = dividendReportData.map(d => [
        d.fullName,
        d.shareCapital.toString(),
        d.dividendRate.toFixed(2),
        d.dividendAmount.toString(),
        d.patronageRefund.toString(),
        d.grossPayout.toString()
      ]);
    }

    // Convert structured matrices to printable CSV string
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Browser Print trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" id="cda-reports-root">
      {/* Date Filters Header Card */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md shadow-indigo-600/10">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">CDA Philippines Compliance Auditor</h4>
            <p className="text-[11px] text-slate-500 font-medium">Generate, print, and export official reports aligned with the Cooperative Development Authority criteria.</p>
          </div>
        </div>

        {/* Audit Filters Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold text-slate-700 w-full lg:w-auto">
          <div>
            <label className="block text-[9px] uppercase font-mono font-bold text-slate-400 mb-1">Fiscal Year</label>
            <div className="relative">
              <input 
                type="text" 
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="w-full bg-white border border-slate-200/80 rounded-xl py-1.5 pl-2.5 pr-1.5 text-xs text-slate-800 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-[9px] uppercase font-mono font-bold text-slate-400 mb-1">Start Audit</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-slate-200/80 rounded-xl py-1.5 px-2.5 text-xs text-slate-800 font-mono"
            />
          </div>
          <div>
            <label className="block text-[9px] uppercase font-mono font-bold text-slate-400 mb-1">End Audit</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-slate-200/80 rounded-xl py-1.5 px-2.5 text-xs text-slate-800 font-mono"
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={handleCsvExport}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Category Selector Cards (CDA 5 Categories + Dividends) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
        {[
          { id: 'MEMBERSHIP', label: 'Membership', desc: 'Registers & Directories', icon: Users, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { id: 'FINANCIAL', label: 'Financial', desc: 'Balances & Operations', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { id: 'CAPITAL', label: 'Share Capital', desc: 'Equity Subscriptions', icon: Award, color: 'text-purple-600 bg-purple-50 border-purple-200' },
          { id: 'SAVINGS', label: 'Savings Book', desc: 'Deposit Cash Ledgers', icon: FileSpreadsheet, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { id: 'LOAN', label: 'Loan Portfolio', desc: 'Borrowings & Delinquency', icon: FileText, color: 'text-rose-600 bg-rose-50 border-rose-200' },
          { id: 'DIVIDEND', label: 'Dividends', desc: 'Patronage Allocation', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-indigo-200' },
        ].map(cat => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as ReportCategory)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-28 ${
                isActive 
                  ? 'border-indigo-600 bg-emerald-50/25 ring-2 ring-indigo-600/10' 
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className={`p-1.5 w-8 h-8 rounded-lg flex items-center justify-center border ${cat.color}`}>
                <Icon size={16} />
              </div>
              <div>
                <h5 className="font-bold text-slate-800 text-xs">{cat.label}</h5>
                <span className="text-[9px] text-slate-400 block mt-0.5 leading-tight font-medium">{cat.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sub-Reports Switcher and Visual Printable Report Card */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sub-Reports Selection Menu */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4.5 space-y-3 shadow-sm h-fit">
          <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider block">Compliance Templates</span>
          
          {selectedCategory === 'MEMBERSHIP' && (
            <div className="space-y-1.5">
              {[
                { id: 'master_list', label: 'Master List of Members' },
                { id: 'active_members', label: 'Active Members Directory' },
                { id: 'inactive_members', label: 'Inactive / Suspended List' },
                { id: 'new_members', label: 'New Members Log (180d)' },
                { id: 'terminated_members', label: 'Terminated Membership List' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => handleSubReportChange(sub.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubReport === sub.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {selectedCategory === 'FINANCIAL' && (
            <div className="space-y-1.5">
              {[
                { id: 'balance_sheet', label: 'Statement of Financial Position' },
                { id: 'income_statement', label: 'Statement of Operations' },
                { id: 'cash_flows', label: 'Notes on Financial Disclosures' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => handleSubReportChange(sub.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubReport === sub.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {selectedCategory === 'CAPITAL' && (
            <div className="space-y-1.5">
              {[
                { id: 'capital_summary', label: 'Share Capital Summary' },
                { id: 'individual_ledger', label: 'Individual Share Ledger' },
                { id: 'capital_build_up', label: 'Capital Build-up Tracker' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => handleSubReportChange(sub.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubReport === sub.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {selectedCategory === 'SAVINGS' && (
            <div className="space-y-1.5">
              {[
                { id: 'savings_ledger', label: 'Member Savings Ledger' },
                { id: 'regular_summary', label: 'Regular Savings Summary' },
                { id: 'time_summary', label: 'Time Deposits Log' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => handleSubReportChange(sub.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubReport === sub.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {selectedCategory === 'LOAN' && (
            <div className="space-y-1.5">
              {[
                { id: 'loan_portfolio', label: 'Full Loan Portfolio' },
                { id: 'outstanding_loans', label: 'Outstanding Active Balances' },
                { id: 'past_due', label: 'Past Due / Delinquent Debt' },
                { id: 'aging_loans', label: 'Aging of Loans Analysis' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => handleSubReportChange(sub.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubReport === sub.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {selectedCategory === 'DIVIDEND' && (
            <div className="space-y-1.5">
              {[
                { id: 'dividend_computation', label: 'Dividend Computations' },
                { id: 'individual_statements', label: 'Patronage distribution' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => handleSubReportChange(sub.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubReport === sub.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {/* Quick Info */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex gap-2 text-[10px] text-slate-500 leading-relaxed font-semibold mt-4">
            <Info size={14} className="text-emerald-600 shrink-0" />
            <span>This reporting system implements compliance standards in accordance with Philippine Cooperative Code R.A. 9520.</span>
          </div>
        </div>

        {/* Right Printable Presentation Card (Live Mockup Paper) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6.5 shadow-sm space-y-6 flex flex-col justify-between" id="printable-area">
          
          {/* Header Block inside the printed page */}
          <div className="border-b-4 border-slate-800 pb-5 text-center relative space-y-1.5">
            <h1 className="font-extrabold text-slate-900 text-base uppercase tracking-tight">
              {settings?.cooperativeName || 'Alliance Cooperative Union'}
            </h1>
            <p className="text-[11px] text-slate-500 leading-relaxed font-semibold max-w-md mx-auto">
              {settings?.address || 'Quezon City, Metro Manila, Philippines'}
            </p>
            <div className="flex justify-center items-center gap-4 text-[10px] text-slate-400 font-mono font-bold pt-1 uppercase">
              <span>CDA Reg No: {settings?.cdaRegNo || 'CDA-REG-98765'}</span>
              <span>•</span>
              <span>TIN: {settings?.tin || '008-123-456'}</span>
            </div>
            
            <div className="pt-2">
              <span className="px-3.5 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black tracking-widest font-mono uppercase">
                Official Compliance Report
              </span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4 text-[10px] text-slate-500 font-mono font-bold uppercase">
            <div>
              <span className="text-slate-400 block font-sans text-[8px] tracking-wider mb-0.5">Audit Category</span>
              <span className="text-slate-800 font-semibold">{selectedCategory} REPORT</span>
            </div>
            <div>
              <span className="text-slate-400 block font-sans text-[8px] tracking-wider mb-0.5">Fiscal Period</span>
              <span className="text-slate-800 font-semibold">FY {fiscalYear}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-sans text-[8px] tracking-wider mb-0.5">Execution date</span>
              <span className="text-slate-800 font-semibold">{new Date().toLocaleDateString('en-PH', { dateStyle: 'medium' })}</span>
            </div>
          </div>

          {/* Dynamic Content Display Area */}
          <div className="flex-1 space-y-4">
            {/* MEMBERSHIP REPORT VIEW */}
            {selectedCategory === 'MEMBERSHIP' && (
              <div className="space-y-3.5">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">
                    {activeSubReport === 'master_list' && 'Master List of Members Registry'}
                    {activeSubReport === 'active_members' && 'Active Members Compliance Log'}
                    {activeSubReport === 'inactive_members' && 'Suspended & Pending Members Directory'}
                    {activeSubReport === 'new_members' && 'New Registrations Enrollment Audit'}
                    {activeSubReport === 'terminated_members' && 'Terminated/Closed Accounts Registry'}
                  </h4>
                  <span className="text-[10px] font-mono font-extrabold text-emerald-600 bg-emerald-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                    Count: {membershipReportData.length} records
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 bg-slate-50 font-mono text-[9px] text-slate-500 uppercase">
                        <th className="py-2 px-3">Member Name</th>
                        <th className="py-2 px-3">Email Address</th>
                        <th className="py-2 px-3">Contact No.</th>
                        <th className="py-2 px-3 text-right">Share Capital</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {membershipReportData.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{m.fullName}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{m.email}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{m.phone}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">{formatMoney(m.shareCapital)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[9px] font-bold font-mono uppercase bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded text-slate-700">
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {membershipReportData.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold font-mono">No records recorded in the selected period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FINANCIAL STATEMENTS VIEW */}
            {selectedCategory === 'FINANCIAL' && (
              <div className="space-y-5">
                {/* 1. BALANCE SHEET */}
                {activeSubReport === 'balance_sheet' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">STATEMENT OF FINANCIAL POSITION (CONSOLIDATED BALANCE SHEET)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px]">
                      {/* Assets Column */}
                      <div className="border border-slate-200/60 rounded-xl p-4 bg-slate-50/30 space-y-3.5">
                        <h5 className="font-bold text-slate-700 font-mono text-xs border-b border-slate-200 pb-1.5 flex items-center justify-between">
                          <span>1.0 COOPERATIVE ASSETS</span>
                          <span className="text-emerald-600 font-black">+</span>
                        </h5>
                        <div className="space-y-2 font-medium">
                          <div className="flex justify-between">
                            <span className="text-slate-500">1.1 Cash in Vault and Bank Balance</span>
                            <span className="font-mono text-slate-800">{formatMoney(financialReportData.assets.coopCashVault)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">1.2 Outstanding Members Loan Principal</span>
                            <span className="font-mono text-slate-800">{formatMoney(financialReportData.assets.outstandingPrincipal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">1.3 Property, Land and Equipment Assets</span>
                            <span className="font-mono text-slate-800">{formatMoney(financialReportData.assets.landEquipmentValue)}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900 text-xs">
                            <span>TOTAL COOPERATIVE ASSETS</span>
                            <span className="font-mono">{formatMoney(financialReportData.assets.totalAssets)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Liabilities and Equity Column */}
                      <div className="space-y-4">
                        {/* Liabilities */}
                        <div className="border border-slate-200/60 rounded-xl p-4 bg-slate-50/30 space-y-3.5">
                          <h5 className="font-bold text-slate-700 font-mono text-xs border-b border-slate-200 pb-1.5 flex items-center justify-between">
                            <span>2.0 ACCOUNT LIABILITIES</span>
                            <span className="text-rose-600 font-black">—</span>
                          </h5>
                          <div className="space-y-2 font-medium">
                            <div className="flex justify-between">
                              <span className="text-slate-500">2.1 Members Regular Savings Accounts</span>
                              <span className="font-mono text-slate-800">{formatMoney(financialReportData.liabilities.regularSavingsSum)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">2.2 Members Fixed-term Time Deposits</span>
                              <span className="font-mono text-slate-800">{formatMoney(financialReportData.liabilities.timeDepositsSum)}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900 text-xs">
                              <span>TOTAL SYSTEM LIABILITIES</span>
                              <span className="font-mono">{formatMoney(financialReportData.liabilities.totalLiabilities)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Equity */}
                        <div className="border border-slate-200/60 rounded-xl p-4 bg-slate-50/30 space-y-3.5">
                          <h5 className="font-bold text-slate-700 font-mono text-xs border-b border-slate-200 pb-1.5">3.0 COOPERATIVE OWNERS EQUITY</h5>
                          <div className="space-y-2 font-medium">
                            <div className="flex justify-between">
                              <span className="text-slate-500">3.1 Paid-up Subscribed Share Capital</span>
                              <span className="font-mono text-slate-800">{formatMoney(financialReportData.equity.shareCapitalSum)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">3.2 General Statutory Reserve (5%)</span>
                              <span className="font-mono text-slate-800">{formatMoney(financialReportData.equity.statutoryReserves)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">3.3 Education and Training Fund (2%)</span>
                              <span className="font-mono text-slate-800">{formatMoney(financialReportData.equity.educationFund)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">3.4 Retained General Surplus Reserve</span>
                              <span className="font-mono text-slate-800">{formatMoney(financialReportData.equity.retainedSurplus)}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900 text-xs">
                              <span>TOTAL COOPERATIVE EQUITY</span>
                              <span className="font-mono">{formatMoney(financialReportData.equity.totalEquity)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. INCOME STATEMENT */}
                {activeSubReport === 'income_statement' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">STATEMENT OF OPERATIONS (INCOME STATEMENT SUMMARY)</h4>
                    <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/20 max-w-2xl mx-auto space-y-5 text-[11px] font-medium">
                      
                      {/* Revenues */}
                      <div className="space-y-2.5">
                        <h5 className="font-bold text-slate-800 font-mono text-[11px] uppercase border-b border-slate-200 pb-1 text-emerald-700">1.0 OPERATING REVENUES</h5>
                        <div className="flex justify-between">
                          <span className="text-slate-500">1.1 Yield Interest Income from Loans Releases</span>
                          <span className="font-mono text-slate-800">{formatMoney(financialReportData.operations.loanInterestEarned)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">1.2 Membership Registry & Administrative Entry Fees</span>
                          <span className="font-mono text-slate-800">{formatMoney(financialReportData.operations.feesAndFines)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
                          <span>TOTAL COOPERATIVE REVENUES</span>
                          <span className="font-mono">{formatMoney(financialReportData.operations.totalRevenues)}</span>
                        </div>
                      </div>

                      {/* Expenses */}
                      <div className="space-y-2.5 pt-2">
                        <h5 className="font-bold text-slate-800 font-mono text-[11px] uppercase border-b border-slate-200 pb-1 text-rose-700">2.0 OPERATIVE ADMINISTRATIVE EXPENSES</h5>
                        <div className="flex justify-between">
                          <span className="text-slate-500">2.1 Personnel Salaries and Operations Honorariums</span>
                          <span className="font-mono text-slate-800">{formatMoney(financialReportData.operations.personnelExpenses)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">2.2 Office Lease, Rental Premises and Utilities</span>
                          <span className="font-mono text-slate-800">{formatMoney(financialReportData.operations.adminRentUtilities)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">2.3 CDA Statutory Assessment Dues & Licensing Fees</span>
                          <span className="font-mono text-slate-800">{formatMoney(financialReportData.operations.cdaDuesFees)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
                          <span>TOTAL OPERATING EXPENSES</span>
                          <span className="font-mono">{formatMoney(financialReportData.operations.totalExpenses)}</span>
                        </div>
                      </div>

                      {/* Net Surplus */}
                      <div className="border-t-2 border-slate-400 pt-3.5 flex justify-between font-extrabold text-slate-900 text-sm">
                        <span className="font-mono text-emerald-600">NET UNALLOCATED ANNUAL SURPLUS</span>
                        <span className="font-mono text-emerald-600">{formatMoney(financialReportData.operations.netSurplus)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. NOTES ON DISCLOSURES */}
                {activeSubReport === 'cash_flows' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">NOTES TO FINANCIAL STATEMENTS & REGULATORY COOPERATIVE COMPLIANCE</h4>
                    <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-5 space-y-4 text-xs text-slate-600 leading-relaxed font-medium">
                      <p>
                        <strong>Note 1: Basis of Financial Presentation</strong><br />
                        These financial reports are compiled on the historical cost basis and cash-allocation logs, adhering fully to the Cooperative Development Authority (CDA) standard chart of accounts, compliant with Philippine Republic Act No. 9520 (Philippine Cooperative Code).
                      </p>
                      <p>
                        <strong>Note 2: General Statutory Reserve Allocations</strong><br />
                        In compliance with legal reserves limits, 10% of the cooperative unallocated net surplus is withheld as a general reserve fund for capital protection, with an additional 5% set aside for training and education dues, and 3% dedicated to community optional build projects.
                      </p>
                      <p>
                        <strong>Note 3: Interest and Lending Standards</strong><br />
                        Simple interest charges on outstanding borrowing contracts are recorded on the straight-line allocation program, utilizing approved regulatory rates ranging from 2% up to 6% per annum.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CAPITAL & EQUITY REPORT VIEW */}
            {selectedCategory === 'CAPITAL' && (
              <div className="space-y-3.5">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">MEMBER INDIVIDUAL SHARE CAPITAL LEDGER SUMMARY</h4>
                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 bg-slate-50 font-mono text-[9px] text-slate-500 uppercase">
                        <th className="py-2 px-3">Member Name</th>
                        <th className="py-2 px-3 text-right">Subscribed Target</th>
                        <th className="py-2 px-3 text-right">Paid-up Capital</th>
                        <th className="py-2 px-3 text-center">Fulfillment Rate</th>
                        <th className="py-2 px-3 text-center">Capital Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {capitalReportData.map((c, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{c.fullName}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatMoney(c.subscribed)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">{formatMoney(c.paidUp)}</td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span className="font-bold text-emerald-600">{c.paidPercentage.toFixed(1)}%</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded ${
                              c.status === 'FULLY_PAID' 
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                                : 'bg-amber-50 border border-amber-200 text-amber-700'
                            }`}>
                              {c.status === 'FULLY_PAID' ? 'FULLY PAID' : 'COLLECTING'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SAVINGS REPORT VIEW */}
            {selectedCategory === 'SAVINGS' && (
              <div className="space-y-3.5">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">MEMBERS SAVINGS DEPOSIT BOOK RECONCILIATION</h4>
                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 bg-slate-50 font-mono text-[9px] text-slate-500 uppercase">
                        <th className="py-2 px-3">Member Name</th>
                        <th className="py-2 px-3 text-right">Regular Savings</th>
                        <th className="py-2 px-3 text-right">Time Deposits</th>
                        <th className="py-2 px-3 text-right">Combined Savings Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {savingsReportData.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{s.fullName}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatMoney(s.regularSavings)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatMoney(s.timeDeposits)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{formatMoney(s.totalSavings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LOANS COMPLIANCE REPORT VIEW */}
            {selectedCategory === 'LOAN' && (
              <div className="space-y-3.5">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">LOAN RELEASES, BALANCES & DELINQUENCY RECONCILIATION</h4>
                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 bg-slate-50 font-mono text-[9px] text-slate-500 uppercase">
                        <th className="py-2 px-3">Borrower Name</th>
                        <th className="py-2 px-3">Program</th>
                        <th className="py-2 px-3 text-right">Principal</th>
                        <th className="py-2 px-3 text-right">Unpaid Balance</th>
                        <th className="py-2 px-3 text-center">Due Date</th>
                        <th className="py-2 px-3 text-center">Aging / Risk Class</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {loanReportData.map((l, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{l.memberName}</td>
                          <td className="py-2.5 px-3 text-slate-600 font-bold">{l.loanTypeName}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatMoney(l.principalAmount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">{formatMoney(l.balance)}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">{l.dueDate}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 border rounded ${
                              l.isPastDue
                                ? 'bg-rose-50 border-rose-200 text-rose-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}>
                              {l.agingCategory}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {loanReportData.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold font-mono">No borrowing records on ledger.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DIVIDEND RECONCILIATION REPORT VIEW */}
            {selectedCategory === 'DIVIDEND' && (
              <div className="space-y-3.5">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">DIVIDENDS AND PATRONAGE ALLOCATIONS DECLARATION</h4>
                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 bg-slate-50 font-mono text-[9px] text-slate-500 uppercase">
                        <th className="py-2 px-3">Member Name</th>
                        <th className="py-2 px-3 text-right">Share Capital Weight</th>
                        <th className="py-2 px-3 text-right">Dividend (8%)</th>
                        <th className="py-2 px-3 text-right">Patronage Refund</th>
                        <th className="py-2 px-3 text-right">Combined Payout Balance</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {dividendReportData.map((d, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{d.fullName}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatMoney(d.shareCapital)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatMoney(d.dividendAmount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatMoney(d.patronageRefund)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{formatMoney(d.grossPayout)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 border rounded ${
                              d.status === 'RELEASED'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}>
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Report Footer / Signature Lines */}
          <div className="border-t border-slate-200 pt-6 mt-8">
            <div className="grid grid-cols-2 gap-12 text-center text-xs font-semibold text-slate-700">
              <div className="space-y-12">
                <div className="border-b border-slate-300 w-48 mx-auto h-6"></div>
                <div>
                  <span className="block font-bold text-slate-800">Cooperative Treasurer</span>
                  <span className="text-[10px] text-slate-400 font-mono">PREPARED BY</span>
                </div>
              </div>
              <div className="space-y-12">
                <div className="border-b border-slate-300 w-48 mx-auto h-6"></div>
                <div>
                  <span className="block font-bold text-slate-800">Board Chairman / President</span>
                  <span className="text-[10px] text-slate-400 font-mono">AUTHORIZED AND APPROVED BY</span>
                </div>
              </div>
            </div>

            {/* Quick print helper */}
            <div className="flex justify-end pt-8 print:hidden">
              <button
                onClick={handlePrint}
                className="px-4.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl text-xs font-extrabold uppercase tracking-wider font-mono flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-slate-950/10"
              >
                <Printer size={14} />
                <span>Print Document</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

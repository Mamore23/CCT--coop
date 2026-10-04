import React, { useState, useEffect } from 'react';
import { ShieldCheck, Activity, Search, Filter, Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Loan } from '../types';

interface Props {
  token: string;
  role?: 'STAFF' | 'ADMIN';
}

export const StaffLoanMonitoring: React.FC<Props> = ({ token, role = 'STAFF' }) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, DUE_TODAY, DUE_SOON, PAST_DUE, PARTIALLY_PAID
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      const res = await fetch('/api/loans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLoans(data.loans || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const processLoansForMonitoring = () => {
    let result = [];
    const today = new Date().toISOString().split('T')[0];
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 7);
    const soonStr = soonDate.toISOString().split('T')[0];

    for (const loan of loans) {
      if (loan.status === 'COMPLETED' && statusFilter !== 'COMPLETED') continue;
      if (!loan.amortizationSchedule || loan.amortizationSchedule.length === 0) continue;

      // Find the currently active installment
      const activeItem = loan.amortizationSchedule.find(i => 
        i.status === 'DUE' || i.status === 'PAST_DUE' || i.status === 'PARTIALLY_PAID' || i.status === 'UPCOMING'
      ) || loan.amortizationSchedule[loan.amortizationSchedule.length - 1];

      const itemStatus = activeItem.status;
      
      let computedCategory = 'UPCOMING';
      if (itemStatus === 'PAST_DUE') computedCategory = 'PAST_DUE';
      else if (itemStatus === 'PARTIALLY_PAID') computedCategory = 'PARTIALLY_PAID';
      else if (activeItem.dueDate === today) computedCategory = 'DUE_TODAY';
      else if (activeItem.dueDate <= soonStr && activeItem.dueDate > today) computedCategory = 'DUE_SOON';
      else if (itemStatus === 'PAID') computedCategory = 'FULLY_PAID';

      if (statusFilter !== 'ALL' && computedCategory !== statusFilter) continue;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!loan.memberName.toLowerCase().includes(q) && !loan.id.toLowerCase().includes(q)) {
          continue;
        }
      }
      
      let daysPastDue = 0;
      if (itemStatus === 'PAST_DUE' && activeItem.dueDate) {
        const due = new Date(activeItem.dueDate);
        const curr = new Date(today);
        const diffTime = Math.abs(curr.getTime() - due.getTime());
        daysPastDue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      result.push({
        ...loan,
        activeInstallment: activeItem,
        computedCategory,
        daysPastDue
      });
    }
    
    // Sort: Past Due first, then Due Today, then Due Soon
    return result.sort((a, b) => {
      const catOrder: Record<string, number> = { 'PAST_DUE': 0, 'DUE_TODAY': 1, 'DUE_SOON': 2, 'PARTIALLY_PAID': 3, 'UPCOMING': 4, 'FULLY_PAID': 5 };
      return (catOrder[a.computedCategory] || 99) - (catOrder[b.computedCategory] || 99);
    });
  };

  const displayLoans = processLoansForMonitoring();

  
  const pastDueLoans = displayLoans.filter(l => l.computedCategory === 'PAST_DUE');
  const pastDueAmount = pastDueLoans.reduce((sum, l) => {
    const inst = l.activeInstallment;
    return sum + (inst.scheduledAmount || 0) + (inst.penaltyAmount || 0) - (inst.amountPaid || 0);
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {role === 'ADMIN' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 font-bold uppercase mb-1">Total Upcoming</div>
            <div className="text-xl font-extrabold text-slate-800">{displayLoans.filter(l => l.computedCategory === 'UPCOMING').length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm">
            <div className="text-xs text-blue-600 font-bold uppercase mb-1">Due Today</div>
            <div className="text-xl font-extrabold text-blue-900">{displayLoans.filter(l => l.computedCategory === 'DUE_TODAY').length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
            <div className="text-xs text-rose-600 font-bold uppercase mb-1">Total Past Due</div>
            <div className="text-xl font-extrabold text-rose-900">{pastDueLoans.length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm bg-rose-50">
            <div className="text-xs text-rose-700 font-bold uppercase mb-1">Past Due Amount</div>
            <div className="text-xl font-extrabold text-rose-900">₱{pastDueAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-2xl">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Activity size={20} className="text-indigo-600" />
          Loan Repayment Monitoring
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search member name or loan ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="ALL">All Active Installments</option>
            <option value="DUE_TODAY">Due Today</option>
            <option value="DUE_SOON">Due Soon (Next 7 Days)</option>
            <option value="PAST_DUE">Past Due</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 font-mono text-[11px] uppercase">
              <tr>
                <th className="px-4 py-3">Member & Loan</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-right">Scheduled Amt</th>
                <th className="px-4 py-3 text-right">Amt Paid</th>
                <th className="px-4 py-3 text-right">Remaining Inst.</th>
                <th className="px-4 py-3 text-right">Total Loan Bal</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">Loading schedules...</td>
                </tr>
              ) : displayLoans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-slate-300" />
                    No loans matching the current filter.
                  </td>
                </tr>
              ) : (
                displayLoans.map((loan, idx) => {
                  const inst = loan.activeInstallment;
                  const remainingInst = (inst.scheduledAmount || 0) + (inst.penaltyAmount || 0) - (inst.amountPaid || 0);
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{loan.memberName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{loan.loanTypeName} • {loan.id.substring(0,8)}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {inst.dueDate}
                        {loan.computedCategory === 'DUE_TODAY' && <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">TODAY</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-slate-700">
                        ₱{((inst.scheduledAmount || 0) + (inst.penaltyAmount || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-emerald-600">
                        ₱{(inst.amountPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-right text-rose-600">
                        ₱{Math.max(0, remainingInst).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-slate-500">
                        ₱{loan.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1
                          ${loan.computedCategory === 'PAST_DUE' ? 'bg-rose-100 text-rose-800' :
                           loan.computedCategory === 'DUE_TODAY' ? 'bg-blue-100 text-blue-800' :
                           loan.computedCategory === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800' :
                           'bg-slate-100 text-slate-700'}`}
                        >
                          {loan.computedCategory === 'PAST_DUE' ? <AlertCircle size={12}/> : <Clock size={12}/>}
                          {loan.computedCategory.replace('_', ' ')}
                        </span>
                        {loan.daysPastDue > 0 && <div className="text-[10px] text-rose-500 font-semibold mt-1">{loan.daysPastDue} Days Late</div>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

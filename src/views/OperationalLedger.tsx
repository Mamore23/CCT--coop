import React, { useState, useEffect } from 'react';
import { Search, Filter, Printer, Download, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { Transaction } from '../types.js';

interface OperationalLedgerProps {
  token: string;
  role: 'ADMIN' | 'STAFF';
}

export function OperationalLedger({ token, role }: OperationalLedgerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        search, type, paymentMethod, startDate, endDate, status
      });
      
      const res = await fetch(`/api/transactions?${query.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [search, type, paymentMethod, startDate, endDate, status]);

  const handlePrintReceipt = (receiptNumber: string) => {
    window.open(`/api/receipts/${receiptNumber}/pdf?token=${token}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in" id="operational-ledger-tab">
      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <BookOpen className="text-emerald-600" size={20} />
              {role === 'ADMIN' ? 'Financial Ledger' : 'Operational Transaction Ledger'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Centralized registry of all financial transactions {role === 'ADMIN' ? '(Read-Only Monitor)' : ''}
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search tx ID, member, OR #..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button 
              className="p-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
              onClick={() => { /* Handle CSV export if needed */ }}
            >
              <Download size={18} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Date From</label>
            <input type="date" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Date To</label>
            <input type="date" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Type</label>
            <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm" value={type} onChange={e => setType(e.target.value)}>
              <option value="">All Types</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="LOAN_RELEASE">Loan Disbursement</option>
              <option value="LOAN_PAYMENT">Loan Payment</option>
              <option value="DIVIDEND_CREDIT">Dividend Credit</option>
              <option value="FEE">Fee/Charge</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Method</label>
            <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="GCASH">GCash</option>
              <option value="SAVINGS">Savings Deduction</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Status</label>
            <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-mono text-[10px] uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Date / Time</th>
                <th className="px-4 py-3 font-semibold">Tx ID</th>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold text-right">Amount</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">OR #</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    <Clock className="mx-auto mb-2 text-slate-300 animate-spin" size={24} />
                    Loading ledger records...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    <AlertCircle className="mx-auto mb-2 text-slate-300" size={24} />
                    No transactions found matching criteria.
                  </td>
                </tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-700">{new Date(tx.createdAt).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-500">{new Date(tx.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">
                      {tx.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {tx.memberName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.type === 'DEPOSIT' || tx.type === 'LOAN_RELEASE' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {tx.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      (tx.type as string) === 'WITHDRAWAL' || (tx.type as string) === 'FEE' ? 'text-rose-600' : 'text-slate-800'
                    }`}>
                      {(tx.type as string) === 'WITHDRAWAL' || (tx.type as string) === 'FEE' ? '-' : ''}
                      ₱{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {(tx as any).paymentMethod || (tx as any).releaseMethod || 'CASH'}
                    </td>
                    <td className="px-4 py-3">
                      {(tx as any).officialReceiptNumber ? (
                        <span className="font-mono text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                          {(tx as any).officialReceiptNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        (!(tx as any).status || (tx as any).status === 'COMPLETED') ? 'bg-emerald-50 text-emerald-700' :
                        (tx as any).status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                        'bg-rose-50 text-rose-700'
                      }`}>
                        {!(tx as any).status ? 'COMPLETED' : (tx as any).status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(tx as any).officialReceiptNumber && (
                        <button
                          onClick={() => handlePrintReceipt((tx as any).officialReceiptNumber!)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Print Receipt"
                        >
                          <Printer size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

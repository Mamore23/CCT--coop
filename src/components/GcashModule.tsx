/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Wallet, 
  CreditCard,
  Building2
} from 'lucide-react';
import { PaymentRequest } from '../types.js';

interface GcashModuleProps {
  token: string;
  role: 'MEMBER' | 'STAFF' | 'ADMIN';
  activeLoans?: any[];
  onRefreshStats?: () => void;
}

export function GcashModule({ token, role, activeLoans = [], onRefreshStats }: GcashModuleProps) {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Member Creation State
  const [newType, setNewType] = useState<string>('SAVINGS_DEPOSIT');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newMethod, setNewMethod] = useState<string>('GCASH');
  const [newLoanId, setNewLoanId] = useState<string>('');
  
  // Submit Reference State
  const [refInputs, setRefInputs] = useState<Record<string, string>>({});

  // Staff Reconcile State
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [reconcileRef, setReconcileRef] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [token]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/payments/requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch payments');
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
    fetchRequests();
    if (onRefreshStats) onRefreshStats();
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const res = await fetch('/api/payments/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentType: newType,
          amount: Number(newAmount),
          paymentMethod: newMethod,
          targetReferenceId: newType === 'LOAN_PAYMENT' ? newLoanId : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerSuccess(data.message);
      setNewAmount('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmitRef = async (id: string) => {
    const ref = refInputs[id];
    if (!ref) {
      setError('Please enter the external reference number.');
      return;
    }
    try {
      setError(null);
      const res = await fetch(`/api/payments/submit-reference/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ externalReference: ref })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerSuccess(data.message);
      setRefInputs(prev => ({ ...prev, [id]: '' }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStaffAction = async (id: string, action: 'RECONCILE' | 'APPROVE' | 'REJECT') => {
    try {
      setError(null);
      const res = await fetch(`/api/payments/reconcile/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          reconciliationReference: reconcileRef,
          reconciliationNotes: reconcileNotes,
          rejectionReason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerSuccess(data.message);
      setActiveActionId(null);
      setReconcileRef('');
      setReconcileNotes('');
      setRejectionReason('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200 text-sm font-semibold flex items-center gap-2">
          <XCircle size={18} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {role === 'MEMBER' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-emerald-600" /> Make a Payment
          </h2>
          <form onSubmit={handleCreateRequest} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Type</label>
              <select 
                value={newType} 
                onChange={e => setNewType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="SAVINGS_DEPOSIT">Regular Savings</option>
                <option value="INITIAL_SHARE">Initial Share Capital</option>
                <option value="SHARE_CAPITAL">Share Capital Contribution</option>
                <option value="LOAN_PAYMENT">Loan Repayment</option>
              </select>
            </div>
            {newType === 'LOAN_PAYMENT' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Loan</label>
                <select 
                  value={newLoanId} 
                  onChange={e => setNewLoanId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">-- Select Loan --</option>
                  {activeLoans.map(l => (
                    <option key={l.id} value={l.id}>{l.loanTypeName} - ₱{Number(l.remainingBalance ?? l.balance ?? 0).toLocaleString()}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Amount</label>
              <input 
                type="number" 
                value={newAmount} 
                onChange={e => setNewAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
                min="1"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Method</label>
              <select 
                value={newMethod} 
                onChange={e => setNewMethod(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="GCASH">GCash Transfer</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Office Cash</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <button 
                type="submit"
                className="w-full bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-emerald-700"
              >
                Create Payment Request
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" />
            {role === 'MEMBER' ? 'My Payment Requests' : 'Payment Reconciliations'}
          </h2>
          <button onClick={fetchRequests} className="text-slate-500 hover:text-slate-800">
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-slate-200">Request Ref</th>
                {role !== 'MEMBER' && <th className="p-4 font-bold border-b border-slate-200">Member</th>}
                <th className="p-4 font-bold border-b border-slate-200">Type / Method</th>
                <th className="p-4 font-bold border-b border-slate-200">Amount</th>
                <th className="p-4 font-bold border-b border-slate-200">Status</th>
                <th className="p-4 font-bold border-b border-slate-200">External Ref</th>
                <th className="p-4 font-bold border-b border-slate-200">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-semibold">
                    No payment requests found.
                  </td>
                </tr>
              ) : requests.map(req => (
                <tr key={req.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-mono font-medium text-slate-800">{req.internalReference}</td>
                  {role !== 'MEMBER' && <td className="p-4 font-medium text-slate-800">{req.memberName}</td>}
                  <td className="p-4">
                    <div className="font-bold text-slate-800">
                      {req.paymentType === 'LOAN_PAYMENT' ? 'Loan Repayment' : req.paymentType.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                      <span>{req.paymentMethod}</span>
                      {req.targetInstallmentNo && (
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-mono text-[10px] font-bold">
                          Period #{req.targetInstallmentNo}
                        </span>
                      )}
                      {(req.principalPortion !== undefined || req.allocationBreakdown?.length) && (
                        <span className="text-[10px] font-mono text-slate-500">
                          (P: ₱{(req.principalPortion ?? req.allocationBreakdown?.[0]?.principalPortion ?? 0).toLocaleString()} | I: ₱{(req.interestPortion ?? req.allocationBreakdown?.[0]?.interestPortion ?? 0).toLocaleString()})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-bold text-slate-900">₱{req.amount.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full ${
                      req.status === 'POSTED' ? 'bg-emerald-100 text-emerald-800' :
                      req.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                      req.status === 'UNPAID' ? 'bg-slate-200 text-slate-700' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {req.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    {req.externalReference ? (
                      <span className="font-mono text-xs">{req.externalReference}</span>
                    ) : role === 'MEMBER' && req.status === 'UNPAID' && req.paymentMethod !== 'CASH' ? (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Ext. Ref #" 
                          value={refInputs[req.id] || ''}
                          onChange={e => setRefInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                          className="w-24 text-xs border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500"
                        />
                        <button 
                          onClick={() => handleSubmitRef(req.id)}
                          className="bg-indigo-600 text-white text-[10px] font-bold px-2 rounded hover:bg-indigo-700"
                        >
                          Submit
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">N/A</span>
                    )}
                  </td>
                  <td className="p-4">
                    {role !== 'MEMBER' && req.status === 'PENDING_RECONCILIATION' && (
                      <div className="flex gap-2">
                         <button 
                          onClick={() => setActiveActionId(activeActionId === req.id ? null : req.id)}
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-bold"
                        >
                          Action
                        </button>
                      </div>
                    )}
                    {req.officialReceiptNo && (
                      <div className="text-xs font-bold text-emerald-600">
                        OR: {req.officialReceiptNo}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Staff Action Modal (Inline Expansion) */}
      {role !== 'MEMBER' && activeActionId && (() => {
        const activeReq = requests.find(r => r.id === activeActionId);
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="font-bold text-lg mb-2">Reconcile / Approve Payment Request</h3>

              {activeReq && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Member:</span>
                    <span className="font-bold text-slate-900">{activeReq.memberName || activeReq.memberId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Request Ref:</span>
                    <span className="font-mono font-bold text-slate-800">{activeReq.internalReference}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Type / Method:</span>
                    <span className="font-semibold text-slate-800">{activeReq.paymentType.replace(/_/g, ' ')} ({activeReq.paymentMethod})</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">External Ref:</span>
                    <span className="font-mono text-slate-700">{activeReq.externalReference || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Amount:</span>
                    <span className="font-mono font-extrabold text-emerald-700 text-sm">₱{activeReq.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Current Status:</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold uppercase">{activeReq.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              )}
              
              {activeReq?.paymentType === 'LOAN_PAYMENT' && (
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl mb-4 text-xs space-y-1 font-mono">
                  <div className="font-bold text-blue-900 font-sans text-xs">
                    Loan Repayment (Target: Period #{activeReq.targetInstallmentNo || 'Earliest'})
                  </div>
                  {(activeReq.principalPortion !== undefined || activeReq.allocationBreakdown?.length) ? (
                    <div className="text-slate-600 text-[11px] grid grid-cols-3 gap-1 pt-1 border-t border-blue-100">
                      <div>Principal: <strong>₱{(activeReq.principalPortion ?? activeReq.allocationBreakdown?.[0]?.principalPortion ?? 0).toLocaleString()}</strong></div>
                      <div>Interest: <strong>₱{(activeReq.interestPortion ?? activeReq.allocationBreakdown?.[0]?.interestPortion ?? 0).toLocaleString()}</strong></div>
                      <div>Penalty: <strong>₱{(activeReq.penaltyPortion ?? activeReq.allocationBreakdown?.[0]?.penaltyPortion ?? 0).toLocaleString()}</strong></div>
                    </div>
                  ) : null}
                  <p className="text-[10px] text-slate-500 font-sans mt-1">
                    Approving will update the amortization schedule, reduce loan balance, and issue an Official Receipt.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reconciliation Notes</label>
                  <input 
                    type="text" 
                    value={reconcileNotes}
                    onChange={e => setReconcileNotes(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    placeholder="e.g. Matched in cooperative bank account"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleStaffAction(activeActionId, 'RECONCILE')}
                    className="bg-indigo-100 text-indigo-800 text-sm font-bold px-4 py-2 rounded-xl flex-1 hover:bg-indigo-200 cursor-pointer"
                  >
                    Mark Reconciled
                  </button>
                  <button 
                    onClick={() => handleStaffAction(activeActionId, 'APPROVE')}
                    className="bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl flex-1 hover:bg-emerald-700 cursor-pointer"
                  >
                    Approve & Post
                  </button>
                </div>
                <hr className="my-2 border-slate-100" />
                <div>
                  <label className="block text-xs font-bold text-rose-700 mb-1">Rejection Reason</label>
                  <input 
                    type="text" 
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className="w-full border border-rose-200 rounded-lg p-2 text-sm"
                    placeholder="Reason for rejection"
                  />
                </div>
                <button 
                  onClick={() => handleStaffAction(activeActionId, 'REJECT')}
                  className="w-full bg-rose-100 text-rose-800 text-sm font-bold px-4 py-2 rounded-xl hover:bg-rose-200 cursor-pointer"
                >
                  Reject
                </button>
                <button 
                  onClick={() => setActiveActionId(null)}
                  className="w-full text-slate-500 text-sm font-bold mt-2 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

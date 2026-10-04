import React, { useState } from 'react';
import { 
  UserCircle, LogOut, Banknote, Wallet, AlertCircle, 
  CheckCircle, Clock, Search, FileText, Image as ImageIcon,
  Send, UserPlus, CreditCard, Receipt
} from 'lucide-react';

export function StaffWorkspace() {
  const [activeTab, setActiveTab] = useState('gcash');
  
  // Mock State
  const [pendingGcash, setPendingGcash] = useState([
    { id: '1', memberName: 'Juan Dela Cruz', allocation: 'Share Capital', amount: 3000, gcashRef: '1002003004005' },
    { id: '2', memberName: 'Maria Clara', allocation: 'Loan Repayment', amount: 1500, gcashRef: '1002003004006' }
  ]);
  
  const [readyLoans, setReadyLoans] = useState([
    { id: 'L-001', memberName: 'Jose Rizal', principal: 10000, cbu: 200, processingFee: 100, netRelease: 9700 }
  ]);
  
  const [pendingKyc, setPendingKyc] = useState([
    { id: 'M-001', memberName: 'Andres Bonifacio', pmesAttended: false, orientationAttended: false }
  ]);

  const [shiftLogs, setShiftLogs] = useState([
    { id: '1', time: '08:30 AM', type: 'SYSTEM', message: 'Shift Started (Initial Cash: ₱5,000.00)', receiptNo: null }
  ]);

  const [drawerStats, setDrawerStats] = useState({
    otcCash: 5000,
    gcashVerified: 12500
  });

  const [isOtcModalOpen, setIsOtcModalOpen] = useState(false);

  // Handlers
  const handleApproveGcash = (payment: any) => {
    const orNumber = `OR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setShiftLogs(prev => [
      { id: Date.now().toString(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), type: 'GCASH_APPROVED', message: `Verified GCash (Ref: ${payment.gcashRef}) for ${payment.memberName}`, receiptNo: orNumber },
      ...prev
    ]);
    setDrawerStats(prev => ({ ...prev, gcashVerified: prev.gcashVerified + payment.amount }));
    setPendingGcash(prev => prev.filter(p => p.id !== payment.id));
  };

  const handleRejectGcash = (id: string) => {
    setPendingGcash(prev => prev.filter(p => p.id !== id));
  };

  const handleDisburseLoan = (loan: any) => {
    setShiftLogs(prev => [
      { id: Date.now().toString(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), type: 'LOAN_DISBURSED', message: `Disbursed Loan ${loan.id} to ${loan.memberName} (Net: ₱${loan.netRelease.toLocaleString()})`, receiptNo: null },
      ...prev
    ]);
    setReadyLoans(prev => prev.filter(l => l.id !== loan.id));
  };

  const handleToggleKyc = (id: string, field: 'pmesAttended' | 'orientationAttended') => {
    setPendingKyc(prev => prev.map(k => k.id === id ? { ...k, [field]: !k[field] } : k));
  };

  const handleActivateAccount = (kyc: any) => {
    if (!kyc.pmesAttended || !kyc.orientationAttended) {
      alert('Member must attend PMES and Loan Orientation before activation.');
      return;
    }
    setShiftLogs(prev => [
      { id: Date.now().toString(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), type: 'MEMBER_ACTIVATED', message: `Activated Member Account for ${kyc.memberName}`, receiptNo: null },
      ...prev
    ]);
    setPendingKyc(prev => prev.filter(k => k.id !== kyc.id));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Top Shift & Drawer Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <UserCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900 leading-tight">Elena Santos</h1>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-gray-500 font-medium">STF-2026-004</span>
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold text-[10px]">LOAN OFFICER</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex space-x-6 text-sm">
                <div className="flex flex-col items-end">
                  <span className="text-gray-500 text-xs font-medium">OTC Cash Drawer</span>
                  <span className="font-bold text-emerald-600">₱{drawerStats.otcCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-gray-500 text-xs font-medium">GCash Verified</span>
                  <span className="font-bold text-blue-600">₱{drawerStats.gcashVerified.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <button className="flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <LogOut className="h-4 w-4" />
                <span>Close Shift</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col space-y-6">
        
        {/* High-Priority Action Counters (Hero Section) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => setActiveTab('gcash')} className={`p-4 rounded-xl border flex items-center space-x-4 transition-all ${activeTab === 'gcash' ? 'bg-emerald-50 border-indigo-200 ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
            <div className="bg-blue-100 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-gray-500">Pending GCash</p>
              <h3 className="text-2xl font-bold text-gray-900">{pendingGcash.length}</h3>
            </div>
          </button>
          
          <button onClick={() => setActiveTab('loans')} className={`p-4 rounded-xl border flex items-center space-x-4 transition-all ${activeTab === 'loans' ? 'bg-emerald-50 border-indigo-200 ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <Banknote className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-gray-500">Ready for Release</p>
              <h3 className="text-2xl font-bold text-gray-900">{readyLoans.length}</h3>
            </div>
          </button>
          
          <button onClick={() => setActiveTab('kyc')} className={`p-4 rounded-xl border flex items-center space-x-4 transition-all ${activeTab === 'kyc' ? 'bg-emerald-50 border-indigo-200 ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
            <div className="bg-amber-100 p-3 rounded-lg">
              <UserPlus className="h-6 w-6 text-amber-600" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-gray-500">Pending KYC</p>
              <h3 className="text-2xl font-bold text-gray-900">{pendingKyc.length}</h3>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Main Operational Work Queues */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
            <div className="flex border-b border-gray-200 bg-gray-50/50">
              <button 
                onClick={() => setActiveTab('gcash')}
                className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'gcash' ? 'border-indigo-600 text-emerald-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                GCash Verifications
              </button>
              <button 
                onClick={() => setActiveTab('loans')}
                className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'loans' ? 'border-indigo-600 text-emerald-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                Loan Disbursements
              </button>
              <button 
                onClick={() => setActiveTab('kyc')}
                className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'kyc' ? 'border-indigo-600 text-emerald-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                Member Onboarding
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
              {activeTab === 'gcash' && (
                <div className="divide-y divide-gray-200">
                  {pendingGcash.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No pending GCash payments to verify.</div>
                  ) : (
                    pendingGcash.map(payment => (
                      <div key={payment.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <button className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 text-gray-500 transition-colors" title="View Screenshot">
                            <ImageIcon className="h-5 w-5" />
                          </button>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900">{payment.memberName}</h4>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{payment.allocation}</span>
                              <span className="text-xs text-gray-500">Ref: {payment.gcashRef}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <span className="block text-sm font-bold text-gray-900">₱{payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex space-x-2">
                            <button onClick={() => handleApproveGcash(payment)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors">
                              Approve & Issue OR
                            </button>
                            <button onClick={() => handleRejectGcash(payment.id)} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors">
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'loans' && (
                <div className="divide-y divide-gray-200">
                  {readyLoans.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No loans ready for disbursement.</div>
                  ) : (
                    readyLoans.map(loan => (
                      <div key={loan.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">{loan.memberName}</h4>
                          <span className="text-xs text-gray-500">App ID: {loan.id}</span>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className="flex space-x-4 text-xs text-right">
                            <div>
                              <span className="text-gray-500 block">Principal</span>
                              <span className="font-semibold text-gray-900">₱{loan.principal.toLocaleString()}</span>
                            </div>
                            <div className="text-red-600">
                              <span className="block opacity-80">Less CBU (2%)</span>
                              <span className="font-semibold">-₱{loan.cbu.toLocaleString()}</span>
                            </div>
                            <div className="text-red-600">
                              <span className="block opacity-80">Proc. Fee</span>
                              <span className="font-semibold">-₱{loan.processingFee.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="text-right bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">Net Release</span>
                            <span className="text-base font-bold text-emerald-700">₱{loan.netRelease.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <button onClick={() => handleDisburseLoan(loan)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center space-x-1">
                            <Send className="h-4 w-4" />
                            <span>Disburse Funds</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'kyc' && (
                <div className="divide-y divide-gray-200">
                  {pendingKyc.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No pending member applications.</div>
                  ) : (
                    pendingKyc.map(kyc => (
                      <div key={kyc.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">{kyc.memberName}</h4>
                          <span className="text-xs text-gray-500">ID: {kyc.id}</span>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className="flex space-x-4">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={kyc.pmesAttended}
                                onChange={() => handleToggleKyc(kyc.id, 'pmesAttended')}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                              />
                              <span className={kyc.pmesAttended ? 'text-gray-900 font-medium' : 'text-gray-500'}>PMES Attended</span>
                            </label>
                            <label className="flex items-center space-x-2 text-sm cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={kyc.orientationAttended}
                                onChange={() => handleToggleKyc(kyc.id, 'orientationAttended')}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                              />
                              <span className={kyc.orientationAttended ? 'text-gray-900 font-medium' : 'text-gray-500'}>Loan Orientation</span>
                            </label>
                          </div>
                          <button 
                            onClick={() => handleActivateAccount(kyc)}
                            disabled={!kyc.pmesAttended || !kyc.orientationAttended}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                          >
                            Activate Account
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: OTC & Daily Logs */}
          <div className="flex flex-col space-y-6">
            
            {/* OTC Panel */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center space-x-2">
                <Wallet className="h-4 w-4 text-gray-400" />
                <span>OTC Actions</span>
              </h3>
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search walk-in member..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
                <button 
                  onClick={() => setIsOtcModalOpen(true)}
                  className="w-full flex justify-center items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  <Banknote className="h-4 w-4" />
                  <span>Accept Cash Payment</span>
                </button>
              </div>
            </div>

            {/* Shift Processing Log */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[300px]">
              <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span>Shift Processing Log</span>
                </h3>
                <span className="text-xs text-gray-500 font-medium">{shiftLogs.length} entries</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {shiftLogs.map((log) => (
                  <div key={log.id} className="flex space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-indigo-400"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{log.message}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-500">{log.time}</span>
                        {log.receiptNo && (
                          <span className="inline-flex items-center space-x-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded cursor-pointer hover:bg-emerald-700 transition-colors">
                            <Receipt className="h-3 w-3" />
                            <span>{log.receiptNo}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* OTC Cashier Modal (Simple Mock) */}
      {isOtcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Banknote className="h-5 w-5 mr-2 text-emerald-600" />
              Accept OTC Cash Payment
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Member Name or ID</label>
                <input type="text" className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment For</label>
                <select className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm">
                  <option>Share Capital</option>
                  <option>Regular Savings</option>
                  <option>Loan Repayment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱)</label>
                <input type="number" className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm font-bold text-lg" />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setIsOtcModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500">
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShiftLogs(prev => [
                    { id: Date.now().toString(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), type: 'OTC_PAYMENT', message: 'Accepted OTC Cash Payment (₱1,000.00) from Walk-in', receiptNo: `OR-2026-${Math.floor(1000 + Math.random() * 9000)}` },
                    ...prev
                  ]);
                  setDrawerStats(prev => ({ ...prev, otcCash: prev.otcCash + 1000 }));
                  setIsOtcModalOpen(false);
                }}
                className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Accept & Print OR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

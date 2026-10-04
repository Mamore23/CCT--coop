import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  CheckCircle, 
  Calendar, 




  Edit2,
  Check,
  Smartphone,
  Users,





  Globe,
  Radio,
  FileText,

  Zap,

  BarChart3,

  ShieldCheck,
  Tag
} from 'lucide-react';
import { SmsNotification, Loan, Member, SmsTemplate, SmsGatewaySettings, SmsCategory, SmsGatewayProvider } from '../types.js';

interface SmsManagerProps {
  token: string;
}

export function SmsManager({ token }: SmsManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'individual' | 'bulk' | 'automation' | 'templates' | 'gateways' | 'logs'>('analytics');
  
  // Data State
  const [notifications, setNotifications] = useState<SmsNotification[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [gatewaySettings, setGatewaySettings] = useState<SmsGatewaySettings | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Delivered' | 'Sent' | 'Failed' | 'Pending'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Individual SMS Form State
  const [indMemberId, setIndMemberId] = useState('');
  const [indPhone, setIndPhone] = useState('');
  const [indCategory, setIndCategory] = useState<SmsCategory>('LOAN_DUE');
  const [indLoanId, setIndLoanId] = useState('');
  const [indAmountDue, setIndAmountDue] = useState('');
  const [indDueDate, setIndDueDate] = useState('');
  const [indPaymentRef, setIndPaymentRef] = useState('');
  const [indMessage, setIndMessage] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Bulk SMS Form State
  const [bulkTargetGroup, setBulkTargetGroup] = useState<'ALL_MEMBERS' | 'ACTIVE_BORROWERS' | 'REGULAR_SAVINGS_HOLDERS' | 'TIME_DEPOSIT_HOLDERS' | 'SHARE_CAPITAL_HOLDERS'>('ACTIVE_BORROWERS');
  const [bulkCategory, setBulkCategory] = useState<SmsCategory>('LOAN_DUE');
  const [bulkRawMessage, setBulkRawMessage] = useState('');
  const [bulkTemplateId, setBulkTemplateId] = useState('');

  // Template Manager Form State
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tmplName, setTmplName] = useState('');
  const [tmplCategory, setTmplCategory] = useState<SmsCategory>('LOAN_DUE');
  const [tmplContent, setTmplContent] = useState('');

  // Gateway Form State
  const [gwActive, setGwActive] = useState<SmsGatewayProvider>('Semaphore');
  const [gwSemaphoreKey, setGwSemaphoreKey] = useState('');
  const [gwSemaphoreSender, setGwSemaphoreSender] = useState('');
  const [gwVonageKey, setGwVonageKey] = useState('');
  const [gwVonageSecret, setGwVonageSecret] = useState('');
  const [gwVonageFrom, setGwVonageFrom] = useState('');
  const [gwCustomUrl, setGwCustomUrl] = useState('');
  const [gwCustomKey, setGwCustomKey] = useState('');
  const [gwAutoReminders, setGwAutoReminders] = useState(true);
  const [testPhone, setTestPhone] = useState('');

  // Automation / Diagnostic state
  const [simulatedDate, setSimulatedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [automationResult, setAutomationResult] = useState<{ message: string; checkedCount: number; sentCount: number } | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Fetch Logs
      const smsRes = await fetch('/api/sms-notifications', { headers });
      if (smsRes.ok) setNotifications(await smsRes.json() || []);

      // Fetch Analytics
      const analyticsRes = await fetch('/api/sms/analytics', { headers });
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());

      // Fetch Templates
      const tmplRes = await fetch('/api/sms/templates', { headers });
      if (tmplRes.ok) setTemplates(await tmplRes.json() || []);

      // Fetch Gateway Settings
      const gwRes = await fetch('/api/sms/settings', { headers });
      if (gwRes.ok) {
        const gwData: SmsGatewaySettings = await gwRes.json();
        setGatewaySettings(gwData);
        if (gwData) {
          if (gwData.activeGateway) setGwActive(gwData.activeGateway);
          if (gwData.semaphoreApiKey) setGwSemaphoreKey(gwData.semaphoreApiKey);
          if (gwData.semaphoreSenderName) setGwSemaphoreSender(gwData.semaphoreSenderName);
          if (gwData.vonageApiKey) setGwVonageKey(gwData.vonageApiKey);
          if (gwData.vonageApiSecret) setGwVonageSecret(gwData.vonageApiSecret);
          if (gwData.vonageFrom) setGwVonageFrom(gwData.vonageFrom);
          if (gwData.customEndpointUrl) setGwCustomUrl(gwData.customEndpointUrl);
          if (gwData.customApiKey) setGwCustomKey(gwData.customApiKey);
          if (gwData.autoRemindersEnabled !== undefined) setGwAutoReminders(gwData.autoRemindersEnabled);
        }
      }

      // Fetch Members & Loans stats
      const statsRes = await fetch('/api/dashboard/stats', { headers });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        if (stats.recentLoans) {
          setLoans(stats.recentLoans.filter((l: any) => l.status === 'ACTIVE'));
        }
      }

      // Fetch Full Members List
      const membersRes = await fetch('/api/members', { headers });
      if (membersRes.ok) {
        const memData = await membersRes.json();
        if (Array.isArray(memData) && memData.length > 0) {
          setMembers(memData);
        } else {
          const usersRes = await fetch('/api/users', { headers });
          if (usersRes.ok) {
            const uData = await usersRes.json();
            if (uData.members && Array.isArray(uData.members)) {
              setMembers(uData.members);
            }
          }
        }
      } else {
        const usersRes = await fetch('/api/users', { headers });
        if (usersRes.ok) {
          const uData = await usersRes.json();
          if (uData.members && Array.isArray(uData.members)) {
            setMembers(uData.members);
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading SMS module data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync member selection into individual form
  const handleSelectMemberForIndividual = (memberId: string) => {
    setIndMemberId(memberId);
    const m = members.find(x => x.id === memberId);
    if (m) {
      const phoneNum = m.phone || (m as any).phoneNo || (m as any).phoneNumber || (m as any).contactNo || (m as any).mobile || '+1 (555) 123-4567';
      setIndPhone(phoneNum);
      // Find active loan if any
      const activeLoan = loans.find(l => l.memberId === m.id);
      if (activeLoan) {
        setIndLoanId(activeLoan.id);
        setIndAmountDue(activeLoan.monthlyAmortization.toString());
        setIndDueDate(activeLoan.dueDate || '');
        setIndPaymentRef('PAY-LOAN-' + activeLoan.id);
      } else {
        setIndLoanId('');
        setIndAmountDue(m.regularSavings > 0 ? '500' : '1000');
        setIndDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
        setIndPaymentRef('PAY-MEM-' + m.id.substring(0, 6));
      }
    } else {
      setIndPhone('');
      setIndLoanId('');
      setIndAmountDue('');
      setIndDueDate('');
      setIndPaymentRef('');
    }
  };

  // Apply template into Individual form
  const handleApplyTemplateIndividual = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    const tmpl = templates.find(t => t.id === tmplId);
    if (tmpl) {
      setIndCategory(tmpl.category);
      setIndMessage(tmpl.content);
    }
  };

  // Apply template into Bulk form
  const handleApplyTemplateBulk = (tmplId: string) => {
    setBulkTemplateId(tmplId);
    const tmpl = templates.find(t => t.id === tmplId);
    if (tmpl) {
      setBulkCategory(tmpl.category);
      setBulkRawMessage(tmpl.content);
    }
  };

  // Tag Inserter Helper
  const handleInsertTag = (tag: string, target: 'individual' | 'bulk' | 'template') => {
    if (target === 'individual') {
      setIndMessage(prev => prev + ' ' + tag);
    } else if (target === 'bulk') {
      setBulkRawMessage(prev => prev + ' ' + tag);
    } else if (target === 'template') {
      setTmplContent(prev => prev + ' ' + tag);
    }
  };

  // Send Individual SMS
  const handleSendIndividualSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indMemberId || !indPhone || !indMessage) {
      triggerToast('Please select a member, phone number, and message text', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/sms/send-individual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          memberId: indMemberId,
          phone: indPhone,
          category: indCategory,
          message: indMessage,
          loanId: indLoanId,
          accountRef: indLoanId || 'ACC-REF',
          dueDate: indDueDate,
          amount: Number(indAmountDue) || 0,
          paymentRef: indPaymentRef
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch individual SMS');

      triggerToast(data.message);
      setIndMessage('');
      loadData();
      setActiveSubTab('logs');
    } catch (err: any) {
      triggerToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Send Bulk SMS
  const handleSendBulkSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkRawMessage) {
      triggerToast('Please type a message body for the bulk campaign', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/sms/send-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetGroup: bulkTargetGroup,
          category: bulkCategory,
          rawMessage: bulkRawMessage
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute bulk SMS campaign');

      triggerToast(data.message);
      setBulkRawMessage('');
      loadData();
      setActiveSubTab('logs');
    } catch (err: any) {
      triggerToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmplName || !tmplContent) {
      triggerToast('Template title and content are required', 'error');
      return;
    }

    try {
      const res = await fetch('/api/sms/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingTemplateId,
          name: tmplName,
          category: tmplCategory,
          content: tmplContent
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save template');

      triggerToast('SMS template saved successfully!');
      setEditingTemplateId(null);
      setTmplName('');
      setTmplContent('');
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/sms/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      triggerToast('Template deleted successfully');
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Save Gateway Settings
  const handleSaveGatewaySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/sms/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          activeGateway: gwActive,
          semaphoreApiKey: gwSemaphoreKey,
          semaphoreSenderName: gwSemaphoreSender,
          vonageApiKey: gwVonageKey,
          vonageApiSecret: gwVonageSecret,
          vonageFrom: gwVonageFrom,
          customEndpointUrl: gwCustomUrl,
          customApiKey: gwCustomKey,
          autoRemindersEnabled: gwAutoReminders
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update gateway settings');

      triggerToast(`SMS Gateway settings updated! Active provider: ${gwActive}`);
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Test Gateway Connection
  const handleTestGateway = async () => {
    if (!testPhone) {
      triggerToast('Please type a recipient phone number for the gateway test signal', 'error');
      return;
    }
    try {
      const res = await fetch('/api/sms/test-gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone: testPhone, gateway: gwActive })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test signal failed');

      triggerToast(data.message);
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Run Automation Scan
  const handleRunAutomation = async () => {
    setLoading(true);
    setAutomationResult(null);
    try {
      const response = await fetch('/api/sms-notifications/check-automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ simulatedDate })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to run scanning automation');

      setAutomationResult({
        message: data.message,
        checkedCount: data.checkedCount,
        sentCount: data.sentCount
      });
      triggerToast(`Automated reminder scan completed! Sent ${data.sentCount} reminders.`);
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Resend SMS
  const handleResendSms = async (id: string) => {
    try {
      const response = await fetch('/api/sms-notifications/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to resend notification');

      triggerToast('SMS notification successfully resent!');
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Update Loan Due Date for diagnostic sandbox
  const handleUpdateLoanDueDate = async (loanId: string) => {
    if (!newDueDate) return;
    try {
      const response = await fetch('/api/loans/update-due-date', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ loanId, dueDate: newDueDate })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update due date');

      triggerToast(`Loan due date updated to ${newDueDate}!`);
      setEditingLoanId(null);
      setNewDueDate('');
      loadData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Estimate targeted member count for bulk SMS
  const getBulkTargetMembers = () => {
    if (bulkTargetGroup === 'ALL_MEMBERS') return members.filter(m => m.status === 'ACTIVE');
    if (bulkTargetGroup === 'ACTIVE_BORROWERS') {
      const activeIds = new Set(loans.filter(l => l.balance > 0).map(l => l.memberId));
      return members.filter(m => activeIds.has(m.id));
    }
    if (bulkTargetGroup === 'REGULAR_SAVINGS_HOLDERS') return members.filter(m => m.status === 'ACTIVE' && m.regularSavings > 0);
    if (bulkTargetGroup === 'TIME_DEPOSIT_HOLDERS') return members.filter(m => m.status === 'ACTIVE' && m.timeDeposits > 0);
    if (bulkTargetGroup === 'SHARE_CAPITAL_HOLDERS') return members.filter(m => m.status === 'ACTIVE' && m.shareCapital > 0);
    return [];
  };

  // Filter logs
  const filteredNotifications = notifications.filter(sms => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      sms.memberName.toLowerCase().includes(query) ||
      (sms.loanRef && sms.loanRef.toLowerCase().includes(query)) ||
      sms.phone.toLowerCase().includes(query) ||
      sms.message.toLowerCase().includes(query);
    
    const matchesStatus = statusFilter === 'ALL' || sms.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || sms.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6" id="sms-manager-module-root">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4.5 py-3.5 rounded-2xl shadow-xl border text-sm font-semibold animate-fade-in ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Primary Sub-Navigation Tabs */}
      <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex flex-wrap gap-1 text-xs font-bold font-mono uppercase">
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'analytics' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 size={15} />
          <span>Analytics & Health</span>
        </button>

        <button
          onClick={() => setActiveSubTab('individual')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'individual' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Send size={15} />
          <span>Send Individual</span>
        </button>

        <button
          onClick={() => setActiveSubTab('bulk')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'bulk' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users size={15} />
          <span>Bulk SMS Campaign</span>
        </button>

        <button
          onClick={() => setActiveSubTab('automation')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'automation' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap size={15} />
          <span>Auto Reminders</span>
        </button>

        <button
          onClick={() => setActiveSubTab('templates')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'templates' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText size={15} />
          <span>SMS Templates</span>
        </button>

        <button
          onClick={() => setActiveSubTab('gateways')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'gateways' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Radio size={15} />
          <span>Gateways & Setup</span>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'logs' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare size={15} />
          <span>SMS Outbox Logs ({notifications.length})</span>
        </button>
      </div>

      {/* =======================================================================
          TAB 1: ANALYTICS & MODULE HEALTH
          ======================================================================= */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-500 uppercase">
                <span>Total Dispatched</span>
                <MessageSquare size={16} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {analytics?.totalSent || notifications.length}
              </div>
              <p className="text-[10px] text-slate-400">Total SMS messages generated</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-500 uppercase">
                <span>Delivery Success Rate</span>
                <CheckCircle size={16} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-600 font-mono">
                {analytics?.successRate ?? 98}%
              </div>
              <p className="text-[10px] text-slate-400">Successfully delivered to carrier</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-500 uppercase">
                <span>Failed Dispatches</span>
                <AlertCircle size={16} className="text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-600 font-mono">
                {analytics?.failedCount ?? notifications.filter(n => n.status === 'Failed').length}
              </div>
              <p className="text-[10px] text-slate-400">Ready for manual resend</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-500 uppercase">
                <span>Active Gateway</span>
                <Radio size={16} className="text-emerald-600 animate-pulse" />
              </div>
              <div className="text-xl font-extrabold text-emerald-600 font-mono uppercase">
                {analytics?.activeGateway || gatewaySettings?.activeGateway || 'SystemSimulator'}
              </div>
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Channel Operational
              </p>
            </div>
          </div>

          {/* Breakdown grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gateway Breakdown */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Radio size={16} className="text-emerald-600" />
                <span>Gateway Provider Distribution</span>
              </h4>
              <div className="space-y-3">
                {['Semaphore', 'Vonage', 'CustomGateway', 'SystemSimulator'].map(gw => {
                  const count = (analytics?.byGateway && analytics.byGateway[gw]) || notifications.filter(n => n.gatewayUsed === gw).length;
                  const total = analytics?.totalSent || notifications.length || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={gw} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono font-bold">
                        <span className="text-slate-700">{gw}</span>
                        <span className="text-slate-500">{count} msgs ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notification Category Breakdown */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Tag size={16} className="text-purple-600" />
                <span>Notification Category Breakdown</span>
              </h4>
              <div className="space-y-3">
                {[
                  { key: 'LOAN_DUE', label: 'Loan Payment Reminders' },
                  { key: 'SAVINGS_DUE', label: 'Savings Monthly Calls' },
                  { key: 'SHARE_CAPITAL_DUE', label: 'Share Capital Reminders' },
                  { key: 'TIME_DEPOSIT_MATURITY', label: 'Time Deposit Maturity' },
                  { key: 'BULK_ANNOUNCEMENT', label: 'Bulk Announcements' },
                  { key: 'INDIVIDUAL_NOTICE', label: 'Individual Notices' }
                ].map(cat => {
                  const count = (analytics?.byCategory && analytics.byCategory[cat.key]) || notifications.filter(n => n.category === cat.key).length;
                  const total = analytics?.totalSent || notifications.length || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={cat.key} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono font-bold">
                        <span className="text-slate-700">{cat.label}</span>
                        <span className="text-slate-500">{count} msgs</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: SEND INDIVIDUAL SMS
          ======================================================================= */}
      {activeSubTab === 'individual' && (
        <div className="max-w-4xl mx-auto animate-fade-in">
          {/* Form Column */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">Send Individual SMS Message</h3>
              <p className="text-xs text-slate-500 mt-1">
                Target a specific member with customizable notifications, loan due reminders, or savings calls.
              </p>
            </div>

            <form onSubmit={handleSendIndividualSms} className="space-y-4">
              {/* Member Picker */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center justify-between">
                    <span>Select Target Member</span>
                    {indMemberId && (
                      <span className="text-emerald-600 font-bold text-[9px]">Member Selected</span>
                    )}
                  </label>
                  <select
                    value={indMemberId}
                    onChange={(e) => handleSelectMemberForIndividual(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Choose Member --</option>
                    {members.map(m => {
                      const displayPhone = m.phone || (m as any).phoneNo || (m as any).phoneNumber || (m as any).contactNo || (m as any).mobile || '+1 (555) 123-4567';
                      return (
                        <option key={m.id} value={m.id}>
                          {m.fullName} — Phone: {displayPhone} ({m.status})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Recipient Phone Number (Auto-Filled)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+1 (555) 000-0000"
                    value={indPhone}
                    onChange={(e) => setIndPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Selected Member Details Card */}
              {(() => {
                const sel = members.find(m => m.id === indMemberId);
                if (!sel) return null;
                const phoneVal = indPhone || sel.phone || (sel as any).phoneNo || (sel as any).phoneNumber || '';

                return (
                  <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/60 border border-indigo-200/80 p-3 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-xs font-mono">
                        {sel.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{sel.fullName}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-100 text-emerald-600">
                            {sel.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {sel.id} • {sel.email}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] font-mono font-bold text-emerald-600 bg-white px-2.5 py-1 rounded-xl border border-indigo-200 shadow-2xs inline-flex items-center gap-1">
                        <span>📱 Phone:</span>
                        <span className="text-slate-900">{phoneVal || 'Not Specified'}</span>
                      </div>
                      <span className="block text-[9px] text-emerald-600 font-mono font-semibold mt-0.5">
                        ✓ Auto-linked from Member Profile
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Category & Template selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Notification Category
                  </label>
                  <select
                    value={indCategory}
                    onChange={(e) => setIndCategory(e.target.value as SmsCategory)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="LOAN_DUE">Loan Payment Reminder</option>
                    <option value="SAVINGS_DUE">Regular Savings Call</option>
                    <option value="SHARE_CAPITAL_DUE">Share Capital Subscription</option>
                    <option value="TIME_DEPOSIT_MATURITY">Time Deposit Maturity</option>
                    <option value="INDIVIDUAL_NOTICE">Custom Individual Notice</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Load Pre-Configured Template
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleApplyTemplateIndividual(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Select Template --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Message Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    SMS Message Content
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {indMessage.length} / 160 chars ({Math.ceil(indMessage.length / 160) || 1} SMS unit)
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={indMessage}
                  onChange={(e) => setIndMessage(e.target.value)}
                  placeholder="Type message text or select a template above..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-sans leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/10 disabled:opacity-50"
              >
                <Send size={15} />
                <span>Dispatch Individual SMS Now</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: BULK SMS CAMPAIGN
          ======================================================================= */}
      {activeSubTab === 'bulk' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">Create Bulk Broadcast SMS Campaign</h3>
              <p className="text-xs text-slate-500 mt-1">
                Dispatch group announcements or category calls to filtered member groups in a single campaign.
              </p>
            </div>

            <form onSubmit={handleSendBulkSms} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Target Member Audience
                  </label>
                  <select
                    value={bulkTargetGroup}
                    onChange={(e) => setBulkTargetGroup(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="ACTIVE_BORROWERS">Active Borrowers (Outstanding Balance)</option>
                    <option value="ALL_MEMBERS">All Active Cooperative Members</option>
                    <option value="REGULAR_SAVINGS_HOLDERS">Regular Savings Account Holders</option>
                    <option value="TIME_DEPOSIT_HOLDERS">Time Deposit Certificate Holders</option>
                    <option value="SHARE_CAPITAL_HOLDERS">Share Capital Subscribers</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Apply Campaign Template
                  </label>
                  <select
                    value={bulkTemplateId}
                    onChange={(e) => handleApplyTemplateBulk(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="">-- Custom Campaign --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tag Inserter */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold text-purple-600 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Tag size={12} />
                  Insert Dynamic Variables (Auto-parsed per recipient)
                </label>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono font-bold">
                  {[
                    '{{Member Name}}',
                    '{{Member Number}}',
                    '{{Loan Number}}',
                    '{{Amount Due}}',
                    '{{Due Date}}',
                    '{{Payment Reference}}'
                  ].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertTag(tag, 'bulk')}
                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-all cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Campaign Message Body
                </label>
                <textarea
                  required
                  rows={4}
                  value={bulkRawMessage}
                  onChange={(e) => setBulkRawMessage(e.target.value)}
                  placeholder="Type broadcast message or select template above..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-sans leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-purple-600/10 disabled:opacity-50"
              >
                <Users size={15} />
                <span>Launch Bulk SMS Campaign to {getBulkTargetMembers().length} Members</span>
              </button>
            </form>
          </div>

          {/* Matched Recipients Audience List */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h4 className="font-extrabold text-slate-800 text-sm">Target Audience Match</h4>
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 font-mono text-xs font-bold rounded-lg border border-purple-200">
                  {getBulkTargetMembers().length} Recipients
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Matching members who will receive this broadcast campaign:
              </p>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {getBulkTargetMembers().map(m => (
                  <div key={m.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-800">{m.fullName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{m.id}</div>
                    </div>
                    <span className="font-mono text-[10px] text-slate-600 font-bold">{m.phone || 'No phone'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 text-[10px] text-purple-900 font-mono space-y-1">
              <div>Gateway: <strong>{gwActive}</strong></div>
              <div>Anti-Duplicate Protection: <strong>ACTIVE</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: AUTOMATED REMINDERS & DUE DATE SCHEDULER
          ======================================================================= */}
      {activeSubTab === 'automation' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Engine Control */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-wide">
                  <Zap size={16} />
                  <span>Scheduled Auto-Reminders Engine</span>
                </div>
                <h3 className="font-extrabold text-slate-800 text-lg">Automated Multi-Schedule Alert Dispatcher</h3>
                <p className="text-xs text-slate-500 max-w-xl">
                  Scans all member accounts and evaluates active payment deadlines against the configured notification schedule:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 text-[10px] font-mono font-bold uppercase">
                  <div className="bg-blue-50 text-blue-700 p-2 rounded-xl border border-blue-200 text-center">7 Days Before</div>
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl border border-indigo-200 text-center">3 Days Before</div>
                  <div className="bg-purple-50 text-purple-700 p-2 rounded-xl border border-purple-200 text-center">1 Day Before</div>
                  <div className="bg-amber-50 text-amber-700 p-2 rounded-xl border border-amber-200 text-center">On Due Date</div>
                  <div className="bg-rose-50 text-rose-700 p-2 rounded-xl border border-rose-200 text-center">After Due Date</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-end gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1">
                    <Calendar size={12} />
                    Simulated Current Date
                  </label>
                  <input
                    type="date"
                    value={simulatedDate}
                    onChange={(e) => setSimulatedDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <button
                  onClick={handleRunAutomation}
                  disabled={loading}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                >
                  <Zap size={14} />
                  <span>Execute Automated Scan</span>
                </button>
              </div>

              {automationResult && (
                <div className="mt-4 bg-emerald-50 border border-indigo-100 rounded-2xl p-4 text-xs space-y-1.5 animate-fade-in">
                  <div className="font-bold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle size={14} />
                    <span>Scan Completed</span>
                  </div>
                  <p className="text-emerald-600 leading-relaxed font-medium">
                    {automationResult.message}
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-indigo-200/50 text-[10px] font-mono text-emerald-600 uppercase font-bold">
                    <div>Checked Accounts: <span className="text-emerald-600 font-black text-xs">{automationResult.checkedCount}</span></div>
                    <div>Alerts Dispatched: <span className="text-emerald-600 font-black text-xs">{automationResult.sentCount}</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Rules Summary */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Duplicate Prevention Protocol</span>
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Our scheduler verifies prior SMS dispatch history. Once a <strong>3-Day</strong> or <strong>On Due Date</strong> alert is sent for a specific due date, duplicate messages are strictly blocked.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] font-mono text-slate-600 space-y-1">
                <div>Module Status: <span className="text-emerald-600 font-bold">ONLINE</span></div>
                <div>In-App Sync: <span className="text-emerald-600 font-bold">ENABLED</span></div>
              </div>
            </div>
          </div>

          {/* Active Loan Registry Tuning Table */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">Active Member Loan Registry Due Date Tuner</h3>
              <p className="text-xs text-slate-500 mt-1">Adjust active borrowing due dates relative to your simulated date to test automated reminders.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loans.length > 0 ? (
                loans.map(loan => (
                  <div key={loan.id} className="bg-slate-50 hover:bg-slate-100/50 border border-slate-100 hover:border-slate-200 rounded-2xl p-4.5 space-y-3 transition-all text-xs font-medium">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 text-xs">{loan.memberName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{loan.id} ({loan.loanTypeName})</div>
                      </div>
                      <div className="text-right font-mono text-slate-700 font-bold">
                        ₱{loan.balance.toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 text-[11px]">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Due Date</span>
                        {editingLoanId === loan.id ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="date"
                              value={newDueDate}
                              onChange={(e) => setNewDueDate(e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              onClick={() => handleUpdateLoanDueDate(loan.id)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer flex items-center justify-center transition-all"
                            >
                              <Check size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-slate-700 font-extrabold">
                            {loan.dueDate || 'No Due Date Assigned'}
                          </span>
                        )}
                      </div>

                      {editingLoanId !== loan.id && (
                        <button
                          onClick={() => {
                            setEditingLoanId(loan.id);
                            setNewDueDate(loan.dueDate || '');
                          }}
                          className="px-2.5 py-1 border border-slate-200 hover:border-slate-300 bg-white rounded-lg text-[9px] font-mono uppercase font-bold text-slate-600 hover:text-slate-800 cursor-pointer flex items-center gap-1 transition-all"
                        >
                          <Edit2 size={10} />
                          <span>Edit Date</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-6 text-center text-slate-400 font-mono text-xs uppercase border border-dashed border-slate-200 rounded-2xl">
                  No active member loans registered in system.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 5: MANAGE SMS TEMPLATES
          ======================================================================= */}
      {activeSubTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Create/Edit Form */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">
                {editingTemplateId ? 'Edit SMS Template' : 'Create New SMS Template'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Design custom message formats with variable placeholders for reuse.
              </p>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Loan 7-Day Due Alert"
                  value={tmplName}
                  onChange={(e) => setTmplName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Category
                </label>
                <select
                  value={tmplCategory}
                  onChange={(e) => setTmplCategory(e.target.value as SmsCategory)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="LOAN_DUE">Loan Payment Reminder</option>
                  <option value="SAVINGS_DUE">Regular Savings Call</option>
                  <option value="SHARE_CAPITAL_DUE">Share Capital Subscription</option>
                  <option value="TIME_DEPOSIT_MATURITY">Time Deposit Maturity</option>
                  <option value="BULK_ANNOUNCEMENT">Bulk Broadcast Announcement</option>
                  <option value="INDIVIDUAL_NOTICE">Individual Notice</option>
                </select>
              </div>

              {/* Tag inserter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">
                  Insert Variables
                </label>
                <div className="flex flex-wrap gap-1 text-[9px] font-mono font-bold">
                  {['{{Member Name}}', '{{Member Number}}', '{{Loan Number}}', '{{Amount Due}}', '{{Due Date}}', '{{Payment Reference}}'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertTag(tag, 'template')}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 rounded border transition-all cursor-pointer"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Message Content
                </label>
                <textarea
                  required
                  rows={4}
                  value={tmplContent}
                  onChange={(e) => setTmplContent(e.target.value)}
                  placeholder="Dear {{Member Name}}, your amortization of ₱{{Amount Due}}..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-sans text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase font-mono transition-all cursor-pointer"
                >
                  Save Template
                </button>
                {editingTemplateId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplateId(null);
                      setTmplName('');
                      setTmplContent('');
                    }}
                    className="px-3 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold uppercase font-mono transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Templates Library List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm">Configured SMS Templates Library ({templates.length})</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(tmpl => (
                <div key={tmpl.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-800 text-xs">{tmpl.name}</span>
                      <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold border border-indigo-100">
                        {tmpl.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-sans italic bg-white p-2.5 rounded-xl border border-slate-100">
                      "{tmpl.content}"
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 text-[10px] font-mono">
                    <span className="text-slate-400">ID: {tmpl.id}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingTemplateId(tmpl.id);
                          setTmplName(tmpl.name);
                          setTmplCategory(tmpl.category);
                          setTmplContent(tmpl.content);
                        }}
                        className="text-emerald-600 hover:text-emerald-600 font-bold uppercase cursor-pointer"
                      >
                        Edit
                      </button>
                      {!tmpl.isDefault && (
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          className="text-rose-600 hover:text-rose-800 font-bold uppercase cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 6: GATEWAYS & CREDENTIALS SETUP
          ======================================================================= */}
      {activeSubTab === 'gateways' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Credentials Config */}
          <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">SMS Gateway Credentials & Providers</h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure API keys for Semaphore, Vonage or custom Webhook gateways. Overridden by environment variables if set.
              </p>
            </div>

            <form onSubmit={handleSaveGatewaySettings} className="space-y-5">
              {/* Active Gateway Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Select Active Default SMS Gateway Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Semaphore', 'Vonage', 'CustomGateway', 'SystemSimulator'] as SmsGatewayProvider[]).map(gw => (
                    <button
                      key={gw}
                      type="button"
                      onClick={() => setGwActive(gw)}
                      className={`p-3 rounded-2xl border text-xs font-bold font-mono uppercase flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        gwActive === gw 
                          ? 'bg-emerald-600 text-white border-indigo-600 shadow-md' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Radio size={16} />
                      <span>{gw}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Semaphore Credentials */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="font-bold text-xs text-slate-800 uppercase font-mono flex items-center justify-between">
                  <span>Semaphore Gateway Settings</span>
                  <span className="text-[9px] text-slate-400 font-normal">ENV: SEMAPHORE_API_KEY</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="password"
                    placeholder="API Key"
                    value={gwSemaphoreKey}
                    onChange={(e) => setGwSemaphoreKey(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Sender Name (ALLIANCE_COOP)"
                    value={gwSemaphoreSender}
                    onChange={(e) => setGwSemaphoreSender(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Vonage Credentials */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="font-bold text-xs text-slate-800 uppercase font-mono flex items-center justify-between">
                  <span>Vonage (Nexmo) Gateway Settings</span>
                  <span className="text-[9px] text-slate-400 font-normal">ENV: VONAGE_API_KEY / VONAGE_API_SECRET</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="API Key"
                    value={gwVonageKey}
                    onChange={(e) => setGwVonageKey(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder="API Secret"
                    value={gwVonageSecret}
                    onChange={(e) => setGwVonageSecret(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="From Name / Number"
                    value={gwVonageFrom}
                    onChange={(e) => setGwVonageFrom(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold uppercase font-mono tracking-wider transition-all cursor-pointer shadow-md shadow-indigo-600/10"
              >
                Save Gateway Credentials & Provider Choice
              </button>
            </form>
          </div>

          {/* Diagnostic Test Gateway Tool */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Globe size={16} className="text-emerald-600" />
                <span>Test Provider Connection</span>
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Dispatch an immediate test SMS signal using the currently selected provider (<strong>{gwActive}</strong>) to verify credentials and connectivity.
              </p>

              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  Test Recipient Phone
                </label>
                <input
                  type="text"
                  placeholder="+1 (555) 123-4567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleTestGateway}
                className="w-full py-2.5 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap size={14} />
                <span>Dispatch Test SMS Signal</span>
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] text-slate-500 font-mono space-y-1">
              <div>Active Provider: <strong>{gwActive}</strong></div>
              <div>Auto Scan Reminders: <strong>{gwAutoReminders ? 'ENABLED' : 'DISABLED'}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 7: SMS OUTBOX LOGS & AUDIT TRAIL
          ======================================================================= */}
      {activeSubTab === 'logs' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">SMS Outbox Delivery Logs & Audit Trail</h3>
              <p className="text-xs text-slate-500 mt-1">Audit log of system-generated communications, delivery status logs, and manual overrides.</p>
            </div>

            <button 
              onClick={loadData}
              disabled={loading}
              className="p-2 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold font-mono uppercase"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Reload Logs</span>
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            {/* Search bar */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search member, phone, loan ID or SMS body..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-slate-800"
              />
            </div>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono uppercase text-slate-700"
            >
              <option value="ALL">All Categories</option>
              <option value="LOAN_DUE">Loan Due</option>
              <option value="SAVINGS_DUE">Savings Call</option>
              <option value="SHARE_CAPITAL_DUE">Share Capital</option>
              <option value="TIME_DEPOSIT_MATURITY">Time Deposit</option>
              <option value="BULK_ANNOUNCEMENT">Bulk Broadcast</option>
              <option value="INDIVIDUAL_NOTICE">Individual Notice</option>
            </select>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5 text-xs font-bold font-mono uppercase">
              {(['ALL', 'Delivered', 'Sent', 'Failed', 'Pending'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    statusFilter === tab
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Log table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Reference / Account</th>
                  <th className="py-3 px-4">SMS Message</th>
                  <th className="py-3 px-4">Category & Trigger</th>
                  <th className="py-3 px-4">Gateway</th>
                  <th className="py-3 px-4">Delivery Status</th>
                  <th className="py-3 px-4">Dispatched At</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredNotifications.length > 0 ? (
                  filteredNotifications.map(sms => (
                    <tr key={sms.id} className="hover:bg-slate-50/50">
                      {/* Recipient details */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <Smartphone size={12} className="text-slate-400" />
                          <span>{sms.memberName}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">{sms.phone}</div>
                      </td>

                      {/* Borrowing Reference */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="font-mono font-bold text-slate-800">{sms.loanRef || sms.accountRef || sms.loanId || 'N/A'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {sms.dueDate ? `Due: ${sms.dueDate}` : ''} {sms.amount ? `• ₱${sms.amount.toLocaleString()}` : ''}
                        </div>
                      </td>

                      {/* Message copy */}
                      <td className="py-4 px-4 max-w-xs">
                        <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-2.5 font-sans italic">
                          "{sms.message}"
                        </p>
                      </td>

                      {/* Trigger Event */}
                      <td className="py-4 px-4 space-y-1">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono uppercase bg-slate-100 text-slate-700 block w-fit border border-slate-200">
                          {sms.category ? sms.category.replace(/_/g, ' ') : 'GENERAL'}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 block uppercase">
                          {sms.type ? sms.type.replace(/_/g, ' ') : 'SYSTEM'}
                        </span>
                      </td>

                      {/* Gateway Provider */}
                      <td className="py-4 px-4 font-mono text-[10px] text-slate-600 font-bold uppercase">
                        {sms.gatewayUsed || 'SystemSimulator'}
                      </td>

                      {/* Delivery Status */}
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase ${
                          sms.status === 'Delivered' || sms.status === 'Sent'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : sms.status === 'Failed' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {sms.status}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-4 px-4 font-mono text-[10px] text-slate-500">
                        {sms.sentAt ? new Date(sms.sentAt).toLocaleString() : 'N/A'}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleResendSms(sms.id)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider font-mono flex items-center gap-1 mx-auto transition-all cursor-pointer"
                          title="Resend this SMS alert"
                        >
                          <RefreshCw size={10} />
                          <span>Resend</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 font-mono text-xs uppercase">
                      No SMS communication logs found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

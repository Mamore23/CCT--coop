import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  UserCheck,
  UserX,
  Lock,
  Key,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  FileText,
  DollarSign,
  ChevronRight,
  X,
  Check,
  ExternalLink,
  Ban,
  ArrowRight,
  Shield,
  Phone,
  Mail,
  Calendar,
  Layers,
  HelpCircle,
  History
} from 'lucide-react';
import { Staff, PermissionRule } from '../types';

interface StaffSupervisionModuleProps {
  token: string;
  onNavigateTab?: (tab: string) => void;
  onRefreshParent?: () => void;
}

export const StaffSupervisionModule: React.FC<StaffSupervisionModuleProps> = ({
  token,
  onNavigateTab,
  onRefreshParent
}) => {
  const [subTab, setSubTab] = useState<'directory' | 'activity' | 'escalations' | 'create'>('directory');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [supervisionStats, setSupervisionStats] = useState<any>(null);
  const [escalations, setEscalations] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [permissionsMatrix, setPermissionsMatrix] = useState<PermissionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DEACTIVATED' | 'SUSPENDED'>('ALL');
  const [activityFilterStaff, setActivityFilterStaff] = useState<string>('ALL');

  // Modals state
  const [viewingStaff, setViewingStaff] = useState<Staff | null>(null);
  const [staffPersonalLogs, setStaffPersonalLogs] = useState<any[]>([]);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'DEACTIVATED' | 'SUSPENDED'>('ACTIVE');
  const [editPassword, setEditPassword] = useState('');

  // Permission management modal state
  const [managingPermStaff, setManagingPermStaff] = useState<Staff | null>(null);
  const [staffPermOverrides, setStaffPermOverrides] = useState<Record<string, boolean>>({});

  // Reset Access modal state
  const [resettingStaff, setResettingStaff] = useState<Staff | null>(null);
  const [resetResultPassword, setResetResultPassword] = useState<string | null>(null);

  // New staff form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Toast feedback
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4500);
  };

  const fetchStaffData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [staffRes, statsRes, escRes, permRes] = await Promise.all([
        fetch('/api/staff', { headers }),
        fetch('/api/admin/supervision/stats', { headers }),
        fetch('/api/admin/escalations', { headers }),
        fetch('/api/permissions', { headers }),
      ]);

      // 1. Fetch staff with workload metrics
      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffList(data.staff || []);
      }

      // 2. Fetch supervision dashboard stats
      if (statsRes.ok) {
        const data = await statsRes.json();
        setSupervisionStats(data);
      }

      // 3. Fetch escalations
      if (escRes.ok) {
        const data = await escRes.json();
        setEscalations(data);
      }

      // 4. Fetch permissions matrix
      if (permRes.ok) {
        const data = await permRes.json();
        setPermissionsMatrix(Array.isArray(data) ? data : data.permissions || []);
      }
    } catch (err) {
      console.error('Failed to load staff supervision data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffActivity = async (staffId?: string) => {
    try {
      const url = staffId && staffId !== 'ALL'
        ? `/api/staff/activity?staffId=${encodeURIComponent(staffId)}&limit=100`
        : '/api/staff/activity?limit=100';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data.activities || []);
      }
    } catch (err) {
      console.error('Failed to fetch staff activity:', err);
    }
  };

  useEffect(() => {
    fetchStaffData();
    fetchStaffActivity();
  }, [token]);

  useEffect(() => {
    if (subTab === 'activity') {
      fetchStaffActivity(activityFilterStaff);
    }
  }, [subTab, activityFilterStaff]);

  // Open single staff details modal
  const handleOpenStaffDetails = async (staff: Staff) => {
    setViewingStaff(staff);
    try {
      const res = await fetch(`/api/staff/${staff.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStaffPersonalLogs(data.activities || []);
      }
    } catch (err) {
      console.error('Failed to load staff details:', err);
    }
  };

  // Open edit modal
  const handleOpenEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setEditFullName(staff.fullName);
    setEditPhone(staff.phone);
    setEditStatus(staff.status || 'ACTIVE');
    setEditPassword('');
  };

  // Save edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      const payload: any = {
        fullName: editFullName,
        phone: editPhone,
        status: editStatus
      };
      if (editPassword.trim()) {
        payload.resetPassword = editPassword.trim();
      }

      const res = await fetch(`/api/users/staff/${editingStaff.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        triggerToast(`Staff account for ${editFullName} updated successfully.`);
        setEditingStaff(null);
        fetchStaffData();
        if (onRefreshParent) onRefreshParent();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to update staff account', 'error');
      }
    } catch (err) {
      triggerToast('Network error while updating staff account', 'error');
    }
  };

  // Quick Status Toggle
  const handleQuickStatusToggle = async (staff: Staff, targetStatus: 'ACTIVE' | 'DEACTIVATED' | 'SUSPENDED') => {
    try {
      const res = await fetch(`/api/users/staff/${staff.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });

      if (res.ok) {
        triggerToast(`Staff ${staff.fullName} marked as ${targetStatus}.`);
        fetchStaffData();
        if (onRefreshParent) onRefreshParent();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to update status', 'error');
      }
    } catch (err) {
      triggerToast('Error updating staff status', 'error');
    }
  };

  // Open Permission Override Modal
  const handleOpenPermissions = (staff: Staff) => {
    setManagingPermStaff(staff);
    setStaffPermOverrides(staff.customPermissions || {});
  };

  // Save Permission Overrides for Staff Member
  const handleSaveStaffPermissions = async () => {
    if (!managingPermStaff) return;
    try {
      const res = await fetch('/api/permissions/user-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: managingPermStaff.id,
          overrides: staffPermOverrides
        })
      });

      if (res.ok) {
        triggerToast(`Permissions for ${managingPermStaff.fullName} saved.`);
        setManagingPermStaff(null);
        fetchStaffData();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to save permissions', 'error');
      }
    } catch (err) {
      triggerToast('Error saving permissions', 'error');
    }
  };

  // Reset Staff Access
  const handleResetAccess = async (staff: Staff) => {
    try {
      const res = await fetch(`/api/users/staff/${staff.id}/reset-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      if (res.ok) {
        const data = await res.json();
        setResettingStaff(staff);
        setResetResultPassword(data.temporaryPassword);
        fetchStaffData();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to reset access credentials', 'error');
      }
    } catch (err) {
      triggerToast('Network error while resetting staff access', 'error');
    }
  };

  // Create New Staff Account
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newFullName || !newPhone) {
      triggerToast('Please complete all required fields.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/users/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          fullName: newFullName.trim(),
          phone: newPhone.trim()
        })
      });

      if (res.ok) {
        triggerToast(`Staff account for ${newFullName} created successfully!`);
        setNewEmail('');
        setNewPassword('');
        setNewFullName('');
        setNewPhone('');
        setSubTab('directory');
        fetchStaffData();
        if (onRefreshParent) onRefreshParent();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to create staff account', 'error');
      }
    } catch (err) {
      triggerToast('Network error creating staff account', 'error');
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery);
    const matchesStatus = statusFilter === 'ALL' || (s.status || 'ACTIVE') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in" id="staff-supervision-module">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-bold animate-in slide-in-from-bottom-5 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
              : 'bg-rose-950 text-rose-200 border-rose-800'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-rose-400" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header & Role Hierarchy Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-indigo-200 rounded-full text-xs font-mono font-extrabold uppercase flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              COOPERATIVE MANAGER / SUPERVISORY ROLE
            </span>
            <span className="text-xs font-mono text-slate-400">
              Role Hierarchy: <strong>ADMIN / MANAGER</strong> → <strong>STAFF</strong> → <strong>MEMBERS</strong>
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Staff Operations Supervision & Management
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Supervise cooperative operations officers, review staff operational decisions, audit transactions, manage permission delegations, and handle escalations while preserving the authoritative financial posting engine.
          </p>
        </div>

        {/* Quick Navigation Action Hub */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSubTab('directory')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'directory'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Users size={14} />
            <span>Manage Staff</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('activity')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'activity'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Activity size={14} />
            <span>Staff Activity</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('escalations')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
              subTab === 'escalations'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ShieldAlert size={14} />
            <span>Escalated Cases</span>
            {escalations && (escalations.rejectedDocuments?.length > 0 || escalations.disputedLoans?.length > 0 || escalations.pendingReconciliations?.length > 0) && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>

          {onNavigateTab && (
            <>
              <button
                type="button"
                onClick={() => onNavigateTab('admin-logs')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="View complete system audit logs"
              >
                <History size={14} />
                <span>Audit Logs</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('admin-permissions')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Configure global RBAC matrix"
              >
                <Lock size={14} />
                <span>Permission Management</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setSubTab('create')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 transition-all flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
          >
            <UserPlus size={14} />
            <span>New Staff Account</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total Staff */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Total Staff</span>
            <div className="p-2 bg-indigo-50 text-emerald-600 rounded-xl">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-slate-800">
              {supervisionStats?.staffCount?.total ?? staffList.length}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Assigned Operations Officers</p>
          </div>
        </div>

        {/* Metric 2: Active Staff */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Active Staff</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-emerald-600">
              {supervisionStats?.staffCount?.active ?? staffList.filter(s => s.status === 'ACTIVE').length}
            </span>
            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Authorized for Operations</p>
          </div>
        </div>

        {/* Metric 3: Inactive / Suspended Staff */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Inactive / Suspended</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Ban size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-amber-600">
              {(supervisionStats?.staffCount?.deactivated ?? 0) + (supervisionStats?.staffCount?.suspended ?? 0)}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {supervisionStats?.staffCount?.suspended || 0} Suspended • {supervisionStats?.staffCount?.deactivated || 0} Deactivated
            </p>
          </div>
        </div>

        {/* Metric 4: Pending Operational Actions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Pending Staff Actions</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-rose-600">
              {supervisionStats?.pendingActions?.totalPending ?? 0}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {supervisionStats?.pendingActions?.pendingMembers || 0} Members • {supervisionStats?.pendingActions?.pendingLoans || 0} Loans
            </p>
          </div>
        </div>

        {/* Metric 5: Payment Reconciliations Pending */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Pending Reconciliations</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-emerald-600">
              {supervisionStats?.pendingActions?.pendingPayments ?? 0}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">GCash & OTC Queues</p>
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: STAFF DIRECTORY & MANAGEMENT */}
      {subTab === 'directory' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                Staff Accounts Directory & Supervision Controls
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect operational workload, modify permissions, activate, deactivate, or suspend staff access credentials.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full sm:w-56"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUSPENDED">Suspended Only</option>
                <option value="DEACTIVATED">Deactivated Only</option>
              </select>

              <button
                type="button"
                onClick={fetchStaffData}
                disabled={loading}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
                title="Refresh staff records"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Staff Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-3">Contact & Account</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Operational Workload</th>
                  <th className="py-3 px-3">Last Activity / Login</th>
                  <th className="py-3 px-4 text-right">Supervisory Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.length > 0 ? (
                  filteredStaff.map((s) => {
                    const status = s.status || 'ACTIVE';
                    const workload = s.workload || { approvedMembers: 0, reviewedLoans: 0, reconciledPayments: 0, verifiedDocs: 0, totalActions: 0 };
                    const activePermCount = s.customPermissions ? Object.values(s.customPermissions).filter(Boolean).length : 0;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Name & Avatar */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-3">
                            {s.avatarUrl ? (
                              <img
                                src={s.avatarUrl}
                                alt={s.fullName}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 border border-indigo-200 flex items-center justify-center font-bold text-xs font-mono">
                                {s.fullName.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="block text-slate-900 font-extrabold text-sm">{s.fullName}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-600">
                                  ID: {s.id}
                                </span>
                                {activePermCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-50 text-emerald-600 border border-indigo-100">
                                    {activePermCount} Custom Perms
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact & Email */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-0.5 font-mono text-[11px]">
                            <div className="text-slate-700 flex items-center gap-1">
                              <Mail size={11} className="text-slate-400" />
                              <span>{s.email}</span>
                            </div>
                            <div className="text-slate-500 flex items-center gap-1">
                              <Phone size={11} className="text-slate-400" />
                              <span>{s.phone}</span>
                            </div>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase inline-flex items-center gap-1 ${
                              status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : status === 'SUSPENDED'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {status === 'ACTIVE' ? (
                              <CheckCircle2 size={11} />
                            ) : status === 'SUSPENDED' ? (
                              <AlertCircle size={11} />
                            ) : (
                              <Ban size={11} />
                            )}
                            {status}
                          </span>
                        </td>

                        {/* Workload Stats */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 font-mono text-[10px]">
                            <span title="Members Verified">👥 {workload.approvedMembers || 0}</span>
                            <span>•</span>
                            <span title="Loans Processed">📋 {workload.reviewedLoans || 0}</span>
                            <span>•</span>
                            <span title="Payments Reconciled">💰 {workload.reconciledPayments || 0}</span>
                            <span>•</span>
                            <span title="Total Audit Actions" className="font-bold text-slate-800">
                              ⚡ {workload.totalActions || 0}
                            </span>
                          </div>
                        </td>

                        {/* Activity Timestamps */}
                        <td className="py-3.5 px-3">
                          <div className="text-[11px] font-mono text-slate-500 space-y-0.5">
                            <div>
                              <span className="text-slate-400">Active: </span>
                              <span className="text-slate-700 font-semibold">
                                {s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleDateString() : 'None recorded'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Created: </span>
                              <span>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Initial Setup'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* [VIEW] */}
                            <button
                              type="button"
                              onClick={() => handleOpenStaffDetails(s)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="View full staff profile & audit history"
                            >
                              <Eye size={12} className="text-slate-500" />
                              <span>VIEW</span>
                            </button>

                            {/* [EDIT] */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(s)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Edit staff details and profile"
                            >
                              <Edit2 size={12} className="text-slate-500" />
                              <span>EDIT</span>
                            </button>

                            {/* [MANAGE PERMISSIONS] */}
                            <button
                              type="button"
                              onClick={() => handleOpenPermissions(s)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-emerald-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              title="Assign custom permissions"
                            >
                              <Lock size={12} className="text-emerald-600" />
                              <span>PERMS</span>
                            </button>

                            {/* Status Actions: [ACTIVATE] / [DEACTIVATE] / [SUSPEND] */}
                            {status !== 'ACTIVE' && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusToggle(s, 'ACTIVE')}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                title="Activate staff account"
                              >
                                ACTIVATE
                              </button>
                            )}

                            {status === 'ACTIVE' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusToggle(s, 'SUSPENDED')}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                  title="Suspend staff account"
                                >
                                  SUSPEND
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusToggle(s, 'DEACTIVATED')}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                  title="Deactivate staff account"
                                >
                                  DEACTIVATE
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-mono">
                      No staff accounts found matching your search and filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: STAFF OPERATIONAL ACTIVITY AUDIT */}
      {subTab === 'activity' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Activity size={18} className="text-emerald-600" />
                Staff Operational Activity Trace
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative record of member verifications, document reviews, loan actions, payment reconciliations, and cashier transactions performed by staff.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-500 font-mono">Filter by Staff:</label>
              <select
                value={activityFilterStaff}
                onChange={(e) => setActivityFilterStaff(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Operations Staff</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-mono text-[9px] uppercase tracking-wider sticky top-0 bg-white z-10">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-3">Action Type</th>
                  <th className="py-3 px-4">Operational Memo & Reference</th>
                  <th className="py-3 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activityLogs.length > 0 ? (
                  activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] font-mono">
                            {(log.userEmail || 'ST').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-mono text-xs">{log.userEmail}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-emerald-700 border border-indigo-100">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-mono text-xs max-w-md truncate" title={log.details}>
                        {log.details}
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 font-mono">
                      No operational activities recorded for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: MANAGEMENT ESCALATIONS & REVIEWS */}
      {subTab === 'escalations' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldAlert size={18} className="text-rose-600" />
              Management Review & Escalation Workspace
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Supervise rejected documents, disputed loan files, and pending reconciliations flagged for supervisor oversight.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rejected Documents Queue */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <FileText size={16} className="text-rose-600" />
                  Rejected Member Documents ({escalations?.rejectedDocuments?.length || 0})
                </h4>
                <span className="text-[10px] font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-bold">
                  Requires Staff/Manager Follow-up
                </span>
              </div>

              {escalations?.rejectedDocuments && escalations.rejectedDocuments.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {escalations.rejectedDocuments.map((doc: any) => (
                    <div key={doc.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-800">{doc.fileName}</span>
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-mono text-[9px] font-bold">
                          REJECTED
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Member: <strong>{doc.memberName || doc.memberId}</strong> • Category: <span className="font-mono">{doc.documentCategory}</span>
                      </p>
                      {doc.notes && (
                        <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-100">
                          <strong>Rejection Reason:</strong> {doc.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center font-mono">
                  No member documents currently under rejected status.
                </p>
              )}
            </div>

            {/* Disputed / Revision Loans */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <ShieldCheck size={16} className="text-amber-600" />
                  Loan Applications Requiring Review ({escalations?.disputedLoans?.length || 0})
                </h4>
                <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold">
                  Revision / Appeals
                </span>
              </div>

              {escalations?.disputedLoans && escalations.disputedLoans.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {escalations.disputedLoans.map((app: any) => (
                    <div key={app.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-800">
                          {app.memberName} — ₱{app.amount?.toLocaleString()}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[9px] font-bold">
                          {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Product: <strong>{app.loanTypeName}</strong> • App #{app.id}
                      </p>
                      {app.remarks && (
                        <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-100">
                          <strong>Staff Notes:</strong> {app.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center font-mono">
                  No disputed loan applications requiring supervisory escalation.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: REGISTER NEW STAFF */}
      {subTab === 'create' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <UserPlus size={20} className="text-emerald-600" />
              Provision New Cooperative Operations Staff Account
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Create an operational officer account. The staff account will be authorized to process member verifications, loan reviews, and payment reconciliations.
            </p>
          </div>

          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                Staff Full Name *
              </label>
              <input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="e.g., Maria Santos"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Staff Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="officer@cooperative.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Mobile Phone *
                </label>
                <input
                  type="text"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+63 917 555 1234"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                Initial Login Password *
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSubTab('directory')}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <UserCheck size={14} />
                <span>Create & Authorize Staff</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =======================================================================
          MODAL: VIEW STAFF PROFILE & AUDIT LOGS
          ======================================================================= */}
      {viewingStaff && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingStaff(null);
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold font-mono text-sm">
                  {viewingStaff.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">{viewingStaff.fullName}</h3>
                  <p className="text-xs text-slate-400 font-mono">{viewingStaff.email} • ID: {viewingStaff.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Profile Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Status</span>
                  <span className="font-bold text-slate-800">{viewingStaff.status || 'ACTIVE'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Phone</span>
                  <span className="font-semibold text-slate-800 font-mono">{viewingStaff.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Created Date</span>
                  <span className="font-mono text-slate-800">
                    {viewingStaff.createdAt ? new Date(viewingStaff.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Last Activity</span>
                  <span className="font-mono text-slate-800">
                    {viewingStaff.lastActivityAt ? new Date(viewingStaff.lastActivityAt).toLocaleString() : 'None'}
                  </span>
                </div>
              </div>

              {/* Workload Metric Cards */}
              <div>
                <h4 className="font-bold text-xs uppercase font-mono text-slate-500 mb-2">Operational Contributions</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <span className="text-xl font-bold font-mono text-emerald-700 block">
                      {viewingStaff.workload?.approvedMembers || 0}
                    </span>
                    <span className="text-[10px] text-emerald-800 font-medium">Members Verified</span>
                  </div>
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <span className="text-xl font-bold font-mono text-emerald-700 block">
                      {viewingStaff.workload?.reviewedLoans || 0}
                    </span>
                    <span className="text-[10px] text-emerald-800 font-medium">Loans Processed</span>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <span className="text-xl font-bold font-mono text-emerald-700 block">
                      {viewingStaff.workload?.reconciledPayments || 0}
                    </span>
                    <span className="text-[10px] text-emerald-800 font-medium">Reconciliations</span>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="text-xl font-bold font-mono text-amber-700 block">
                      {viewingStaff.workload?.verifiedDocs || 0}
                    </span>
                    <span className="text-[10px] text-amber-800 font-medium">Docs Reviewed</span>
                  </div>
                </div>
              </div>

              {/* Personal Audit History */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase font-mono text-slate-500">
                  Recent Audit Actions ({staffPersonalLogs.length})
                </h4>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs">
                  {staffPersonalLogs.length > 0 ? (
                    staffPersonalLogs.map((log) => (
                      <div key={log.id} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50/50">
                        <div>
                          <span className="font-mono font-bold text-emerald-600 block text-[11px]">{log.action}</span>
                          <p className="text-slate-600 text-xs mt-0.5">{log.details}</p>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="p-6 text-center text-slate-400 font-mono">No audit logs on record for this staff member.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleResetAccess(viewingStaff)}
                className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Key size={13} />
                <span>Reset Access Password</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: EDIT STAFF PROFILE
          ======================================================================= */}
      {editingStaff && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingStaff(null);
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Edit2 size={16} className="text-emerald-400" />
                Edit Staff Profile: {editingStaff.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">Phone</label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE (Authorized to log in & review)</option>
                  <option value="SUSPENDED">SUSPENDED (Temporary lock)</option>
                  <option value="DEACTIVATED">DEACTIVATED (Account closed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Reset Password (Leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Optional new password"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  Save Profile Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: MANAGE GRANULAR PERMISSIONS FOR STAFF MEMBER
          ======================================================================= */}
      {managingPermStaff && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setManagingPermStaff(null);
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Lock size={16} className="text-emerald-400" />
                  Staff Permission Overrides: {managingPermStaff.fullName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Toggle specific module permissions for this staff user.</p>
              </div>
              <button
                type="button"
                onClick={() => setManagingPermStaff(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {permissionsMatrix.map((rule) => {
                  const isOverridden = typeof staffPermOverrides[rule.module] === 'boolean';
                  const isAllowed = isOverridden ? staffPermOverrides[rule.module] : rule.staff;

                  return (
                    <div key={rule.module} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-xs">{rule.name}</span>
                          <span className="font-mono text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {rule.module}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{rule.description}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setStaffPermOverrides((prev) => ({
                            ...prev,
                            [rule.module]: !isAllowed
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isAllowed
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isAllowed ? 'Allowed' : 'Restricted'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setManagingPermStaff(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStaffPermissions}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: RESET CREDENTIALS RESULT
          ======================================================================= */}
      {resettingStaff && resetResultPassword && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
              <Key size={24} />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">Temporary Credentials Generated</h3>
            <p className="text-xs text-slate-500">
              Access credentials for <strong>{resettingStaff.fullName}</strong> ({resettingStaff.email}) have been reset by management.
            </p>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Temporary Password:</span>
              <span className="text-base font-mono font-extrabold text-emerald-700 select-all tracking-wider block">
                {resetResultPassword}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setResettingStaff(null);
                setResetResultPassword(null);
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Done / Copied
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

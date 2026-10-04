/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { 
  GraduationCap, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar, 
  FileText, 
  ShieldCheck, 
  User, 
  Eye, 
  Edit3, 
  Check, 
  X, 
  Sliders, 
  History, 
  Info,
  ChevronRight,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { Role, ComplianceStatus, ComplianceConfig } from '../types.js';

interface EnrichedMemberCompliance {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  avatarUrl?: string;
  createdAt: string;
  hasAttendedPreMembershipSeminar?: boolean;
  loanOrientationCompleted?: boolean;
  pmesStatus: ComplianceStatus;
  pmesRecord?: {
    id: string;
    memberId: string;
    requirementType: string;
    status: ComplianceStatus;
    attendedAt?: string;
    attendanceDate?: string;
    completedAt?: string;
    verifiedBy?: string;
    verifiedById?: string;
    verifiedAt?: string;
    reference?: string;
    referenceNumber?: string;
    remarks?: string;
    recordedBy?: string;
    recordedAt?: string;
    updatedAt?: string;
  } | null;
  orientationStatus: ComplianceStatus;
  orientationRecord?: {
    id: string;
    memberId: string;
    requirementType: string;
    status: ComplianceStatus;
    attendedAt?: string;
    attendanceDate?: string;
    completedAt?: string;
    verifiedBy?: string;
    verifiedById?: string;
    verifiedAt?: string;
    reference?: string;
    referenceNumber?: string;
    remarks?: string;
    recordedBy?: string;
    recordedAt?: string;
    updatedAt?: string;
  } | null;
  complianceRecords?: any[];
}

interface ComplianceStats {
  total: number;
  completed: number;
  pendingVerification: number;
  notCompleted: number;
  rejected: number;
  complianceRate: number;
  pmesCompleted?: number;
  pmesPending?: number;
  orientationCompleted?: number;
  orientationPending?: number;
}

interface PmesComplianceManagerProps {
  token: string;
  role: Role;
}

export function PmesComplianceManager({ token, role }: PmesComplianceManagerProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'config' | 'audit'>('roster');
  const [members, setMembers] = useState<EnrichedMemberCompliance[]>([]);
  const [stats, setStats] = useState<ComplianceStats>({
    total: 0,
    completed: 0,
    pendingVerification: 0,
    notCompleted: 0,
    rejected: 0,
    complianceRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComplianceStatus>('ALL');
  const [reqTypeFilter, setReqTypeFilter] = useState<'ALL' | 'PMES' | 'ORIENTATION'>('ALL');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Configuration state
  const [config, setConfig] = useState<ComplianceConfig>({
    requirePmesForLoan: true,
    requireOrientationForLoan: true,
    requireKycForLoan: false,
    allowStaffDirectVerify: true,
    requireAttendanceDate: true,
    requireReferenceNumber: false
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Requirement selection state for modals
  const [selectedReqType, setSelectedReqType] = useState<'PRE_MEMBERSHIP_SEMINAR' | 'LOAN_ORIENTATION'>('PRE_MEMBERSHIP_SEMINAR');

  // Modal: Record Attendance
  const [recordModalMember, setRecordModalMember] = useState<EnrichedMemberCompliance | null>(null);
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attRef, setAttRef] = useState('');
  const [attStatus, setAttStatus] = useState<'PENDING_VERIFICATION' | 'COMPLETED'>('PENDING_VERIFICATION');
  const [attRemarks, setAttRemarks] = useState('');
  const [attSubmitting, setAttSubmitting] = useState(false);

  // Modal: Quick Verify
  const [verifyModalMember, setVerifyModalMember] = useState<EnrichedMemberCompliance | null>(null);
  const [verifyRef, setVerifyRef] = useState('');
  const [verifyRemarks, setVerifyRemarks] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  // Modal: Reject Attendance
  const [rejectModalMember, setRejectModalMember] = useState<EnrichedMemberCompliance | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Drawer / Modal: View Member Detail & Compliance History
  const [detailMember, setDetailMember] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Member Compliance Roster & Stats
  const fetchComplianceRoster = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/compliance/members', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        if (data.stats) setStats(data.stats);
        if (data.complianceConfig) setConfig(data.complianceConfig);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to load member compliance records', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error fetching compliance data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/compliance/audit', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchComplianceRoster();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  // Filtered Members
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = 
        m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.phone && m.phone.includes(searchQuery));
      
      let matchesStatus = true;
      if (statusFilter !== 'ALL') {
        if (reqTypeFilter === 'PMES') {
          matchesStatus = m.pmesStatus === statusFilter;
        } else if (reqTypeFilter === 'ORIENTATION') {
          matchesStatus = m.orientationStatus === statusFilter;
        } else {
          matchesStatus = m.pmesStatus === statusFilter || m.orientationStatus === statusFilter;
        }
      }
      return matchesSearch && matchesStatus;
    });
  }, [members, searchQuery, statusFilter, reqTypeFilter]);

  // Open Record Attendance Modal for either requirement
  const openRecordModal = (member: EnrichedMemberCompliance, reqType: 'PRE_MEMBERSHIP_SEMINAR' | 'LOAN_ORIENTATION' = 'PRE_MEMBERSHIP_SEMINAR') => {
    setSelectedReqType(reqType);
    setRecordModalMember(member);
    const targetRec = reqType === 'PRE_MEMBERSHIP_SEMINAR' ? member.pmesRecord : member.orientationRecord;
    setAttDate(targetRec?.attendanceDate || targetRec?.attendedAt || new Date().toISOString().split('T')[0]);
    setAttRef(targetRec?.referenceNumber || targetRec?.reference || '');
    setAttStatus(config.allowStaffDirectVerify ? 'COMPLETED' : 'PENDING_VERIFICATION');
    setAttRemarks(targetRec?.remarks || '');
  };

  // Handle Record Attendance Submit
  const handleRecordAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordModalMember) return;
    setAttSubmitting(true);

    const reqLabel = selectedReqType === 'PRE_MEMBERSHIP_SEMINAR' ? 'PMES' : 'Loan Orientation';

    try {
      const res = await fetch('/api/compliance/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          memberId: recordModalMember.id,
          requirementType: selectedReqType,
          attendanceDate: attDate,
          referenceNumber: attRef.trim() || undefined,
          status: attStatus,
          remarks: attRemarks.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to record ${reqLabel} attendance`);

      showToast(data.message || `${reqLabel} attendance logged successfully!`);
      setRecordModalMember(null);
      fetchComplianceRoster();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAttSubmitting(false);
    }
  };

  // Open Quick Verify Modal for either requirement
  const openVerifyModal = (member: EnrichedMemberCompliance, reqType: 'PRE_MEMBERSHIP_SEMINAR' | 'LOAN_ORIENTATION' = 'PRE_MEMBERSHIP_SEMINAR') => {
    setSelectedReqType(reqType);
    setVerifyModalMember(member);
    const targetRec = reqType === 'PRE_MEMBERSHIP_SEMINAR' ? member.pmesRecord : member.orientationRecord;
    setVerifyRef(targetRec?.referenceNumber || targetRec?.reference || '');
    setVerifyRemarks('');
  };

  // Handle Quick Verify Submit
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyModalMember) return;
    setVerifySubmitting(true);

    const reqLabel = selectedReqType === 'PRE_MEMBERSHIP_SEMINAR' ? 'PMES' : 'Loan Orientation';

    try {
      const res = await fetch('/api/compliance/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          memberId: verifyModalMember.id,
          requirementType: selectedReqType,
          referenceNumber: verifyRef.trim() || undefined,
          remarks: verifyRemarks.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to verify ${reqLabel}`);

      showToast(data.message || `${reqLabel} verified successfully!`);
      setVerifyModalMember(null);
      fetchComplianceRoster();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setVerifySubmitting(false);
    }
  };

  // Open Reject Modal for either requirement
  const openRejectModal = (member: EnrichedMemberCompliance, reqType: 'PRE_MEMBERSHIP_SEMINAR' | 'LOAN_ORIENTATION' = 'PRE_MEMBERSHIP_SEMINAR') => {
    setSelectedReqType(reqType);
    setRejectModalMember(member);
    setRejectReason('');
  };

  // Handle Reject Submit
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalMember) return;
    setRejectSubmitting(true);

    const reqLabel = selectedReqType === 'PRE_MEMBERSHIP_SEMINAR' ? 'PMES' : 'Loan Orientation';

    try {
      const res = await fetch('/api/compliance/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          memberId: rejectModalMember.id,
          requirementType: selectedReqType,
          remarks: rejectReason.trim() || 'Did not meet compliance criteria'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to reject ${reqLabel}`);

      showToast(data.message || `${reqLabel} record marked as rejected`);
      setRejectModalMember(null);
      fetchComplianceRoster();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setRejectSubmitting(false);
    }
  };

  // View Member Detail & Audit History
  const handleViewDetails = async (memberId: string) => {
    setDetailLoading(true);
    setDetailMember(null);
    try {
      const res = await fetch(`/api/compliance/member/${memberId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDetailMember(data);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to load member profile', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  // Save Config (Admin Only)
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'ADMIN') return;
    setIsSavingConfig(true);

    try {
      const res = await fetch('/api/compliance/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update configuration');

      showToast(data.message || 'Compliance configuration updated successfully!');
      if (data.config) setConfig(data.config);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: ComplianceStatus) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            <span>Completed & Verified</span>
          </span>
        );
      case 'PENDING_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={13} className="text-amber-600 shrink-0" />
            <span>Pending Verification</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={13} className="text-rose-600 shrink-0" />
            <span>Rejected / Retake</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <AlertCircle size={13} className="text-slate-400 shrink-0" />
            <span>Not Completed</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" id="pmes-compliance-manager">
      {/* Toast Alert */}
      {toast && (
        <div 
          className={`fixed top-4 right-4 z-50 max-w-md rounded-xl p-4 shadow-xl border text-sm flex gap-3 items-start animate-fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
          id="compliance-toast-message"
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{toast.message}</div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <GraduationCap size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  PMES & Membership Compliance Manager
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {role} Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Staff and Administrative workspace for recording Pre-Membership Education Seminar (PMES) attendance, 
                verifying member educational compliance, and enforcing cooperative loan eligibility criteria.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('roster')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'roster' 
                    ? 'bg-white text-emerald-700 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                id="btn-tab-roster"
              >
                <User size={14} />
                <span>Member Roster</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'config' 
                    ? 'bg-white text-emerald-700 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                id="btn-tab-config"
              >
                <Sliders size={14} />
                <span>Policies & Rules</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'audit' 
                    ? 'bg-white text-emerald-700 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                id="btn-tab-audit"
              >
                <History size={14} />
                <span>Audit Logs</span>
              </button>
            </div>

            <button
              type="button"
              onClick={fetchComplianceRoster}
              disabled={loading}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition-all cursor-pointer"
              title="Refresh Data"
              id="btn-refresh-compliance"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Non-Financial Architectural Notice */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500">
          <Info size={15} className="text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Non-Financial Governance Record:</strong> PMES compliance records are strictly educational and regulatory. 
            Logging seminar attendance does <em>not</em> post financial ledger transactions, does not alter member share capital or savings balances, 
            and operates independently of the payment request and official receipt pipelines.
          </span>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 shadow-xs p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Members</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</h3>
          <p className="text-[10px] text-slate-500 mt-1">Enrolled in cooperative</p>
        </div>

        <div className="bg-white border border-slate-200 shadow-xs p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed & Verified</span>
          <h3 className="text-2xl font-bold text-emerald-700 mt-1">{stats.completed}</h3>
          <p className="text-[10px] text-emerald-600 mt-1 font-semibold">{stats.complianceRate}% compliance rate</p>
        </div>

        <div className="bg-white border border-slate-200 shadow-xs p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Verification</span>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingVerification}</h3>
          <p className="text-[10px] text-amber-600 mt-1 font-medium">Awaiting staff review</p>
        </div>

        <div className="bg-white border border-slate-200 shadow-xs p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Not Completed</span>
          <h3 className="text-2xl font-bold text-slate-600 mt-1">{stats.notCompleted}</h3>
          <p className="text-[10px] text-slate-500 mt-1">Loan application blocked</p>
        </div>

        <div className="bg-white border border-slate-200 shadow-xs p-4 rounded-2xl col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rejected / Retake</span>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">{stats.rejected}</h3>
          <p className="text-[10px] text-rose-600 mt-1">Requires follow-up</p>
        </div>
      </div>

      {/* TAB 1: MEMBER ROSTER */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Filters & Search Bar */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search member name, email, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                id="input-compliance-search"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs text-slate-400 font-semibold px-2 shrink-0">Filter:</span>
              {(['ALL', 'NOT_COMPLETED', 'PENDING_VERIFICATION', 'COMPLETED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                  id={`btn-filter-${st.toLowerCase()}`}
                >
                  {st === 'ALL' ? 'All Members' : st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4 w-72">Member Name & ID</th>
                    <th className="py-3.5 px-4">Mandatory Compliance Requirement</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Attendance Date</th>
                    <th className="py-3.5 px-4">Reference / Cert #</th>
                    <th className="py-3.5 px-4">Verified By</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-emerald-600" />
                        <span>Loading member compliance records...</span>
                      </td>
                    </tr>
                  ) : filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <GraduationCap size={28} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">No matching member records found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Try clearing or adjusting your search filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const pmesRec = m.pmesRecord;
                      const orientationRec = m.orientationRecord;
                      const isPmesCompleted = m.pmesStatus === 'COMPLETED';
                      const isPmesPending = m.pmesStatus === 'PENDING_VERIFICATION';
                      const isOrientCompleted = m.orientationStatus === 'COMPLETED';
                      const isOrientPending = m.orientationStatus === 'PENDING_VERIFICATION';

                      return (
                        <Fragment key={m.id}>
                          {/* Row 1: PMES Requirement */}
                          <tr className="hover:bg-slate-50/70 transition-colors" id={`row-member-${m.id}-pmes`}>
                            {/* Member Info (Spans 2 rows) */}
                            <td rowSpan={2} className="py-3.5 px-4 align-top border-r border-slate-100 bg-white">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-600 shrink-0 mt-0.5">
                                  {m.fullName.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{m.fullName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span>ID: {m.id}</span>
                                    <span>•</span>
                                    <span>{m.email}</span>
                                  </div>
                                  <div className="mt-2.5 flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleViewDetails(m.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                                      title="View Member Compliance Profile & Audit History"
                                      id={`btn-details-${m.id}`}
                                    >
                                      <Eye size={12} />
                                      <span>Compliance Profile</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* PMES Requirement Title */}
                            <td className="py-3 px-4 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="p-1 rounded-md bg-emerald-50 text-emerald-700">
                                  <GraduationCap size={15} />
                                </span>
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">Pre-membership Education Seminar (PMES)</div>
                                  <div className="text-[10px] text-slate-400">Prerequisite for cooperative membership & borrowing</div>
                                </div>
                              </div>
                            </td>

                            {/* PMES Status */}
                            <td className="py-3 px-4 border-b border-slate-100">
                              {renderStatusBadge(m.pmesStatus)}
                            </td>

                            {/* PMES Attendance Date */}
                            <td className="py-3 px-4 text-slate-600 border-b border-slate-100">
                              {pmesRec?.attendanceDate || pmesRec?.attendedAt ? (
                                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                  <Calendar size={12} className="text-slate-400" />
                                  <span>{new Date(pmesRec.attendanceDate || pmesRec.attendedAt!).toLocaleDateString()}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Not recorded</span>
                              )}
                            </td>

                            {/* PMES Reference Number */}
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600 border-b border-slate-100">
                              {pmesRec?.referenceNumber || pmesRec?.reference ? (
                                <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                  {pmesRec.referenceNumber || pmesRec.reference}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </td>

                            {/* PMES Verified By */}
                            <td className="py-3 px-4 border-b border-slate-100">
                              {pmesRec?.verifiedBy ? (
                                <div>
                                  <div className="font-semibold text-slate-800 text-[11px]">{pmesRec.verifiedBy}</div>
                                  {pmesRec.verifiedAt && (
                                    <div className="text-[9px] text-slate-400 font-mono">
                                      {new Date(pmesRec.verifiedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-amber-600 text-[11px] font-medium">Pending Verification</span>
                              )}
                            </td>

                            {/* PMES Actions */}
                            <td className="py-3 px-4 text-right border-b border-slate-100">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openRecordModal(m, 'PRE_MEMBERSHIP_SEMINAR')}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Record PMES Attendance"
                                  id={`btn-record-pmes-${m.id}`}
                                >
                                  <Edit3 size={12} />
                                  <span>Record PMES Attendance</span>
                                </button>

                                {!isPmesCompleted && (
                                  <button
                                    type="button"
                                    onClick={() => openVerifyModal(m, 'PRE_MEMBERSHIP_SEMINAR')}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                    title="Verify PMES Completion"
                                    id={`btn-verify-pmes-${m.id}`}
                                  >
                                    <Check size={12} />
                                    <span>Verify</span>
                                  </button>
                                )}

                                {isPmesPending && (
                                  <button
                                    type="button"
                                    onClick={() => openRejectModal(m, 'PRE_MEMBERSHIP_SEMINAR')}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="Reject PMES Record"
                                    id={`btn-reject-pmes-${m.id}`}
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Row 2: Loan Orientation Requirement */}
                          <tr className="hover:bg-slate-50/70 transition-colors bg-slate-50/20" id={`row-member-${m.id}-orientation`}>
                            {/* Loan Orientation Requirement Title */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="p-1 rounded-md bg-blue-50 text-blue-700">
                                  <BookOpen size={15} />
                                </span>
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">Loan Orientation & Credit Counseling</div>
                                  <div className="text-[10px] text-slate-400">Mandatory prerequisite for loan facilities & credit evaluation</div>
                                </div>
                              </div>
                            </td>

                            {/* Loan Orientation Status */}
                            <td className="py-3 px-4">
                              {renderStatusBadge(m.orientationStatus)}
                            </td>

                            {/* Loan Orientation Attendance Date */}
                            <td className="py-3 px-4 text-slate-600">
                              {orientationRec?.attendanceDate || orientationRec?.attendedAt ? (
                                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                  <Calendar size={12} className="text-slate-400" />
                                  <span>{new Date(orientationRec.attendanceDate || orientationRec.attendedAt!).toLocaleDateString()}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Not recorded</span>
                              )}
                            </td>

                            {/* Loan Orientation Reference Number */}
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                              {orientationRec?.referenceNumber || orientationRec?.reference ? (
                                <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                  {orientationRec.referenceNumber || orientationRec.reference}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </td>

                            {/* Loan Orientation Verified By */}
                            <td className="py-3 px-4">
                              {orientationRec?.verifiedBy ? (
                                <div>
                                  <div className="font-semibold text-slate-800 text-[11px]">{orientationRec.verifiedBy}</div>
                                  {orientationRec.verifiedAt && (
                                    <div className="text-[9px] text-slate-400 font-mono">
                                      {new Date(orientationRec.verifiedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-amber-600 text-[11px] font-medium">Pending Verification</span>
                              )}
                            </td>

                            {/* Loan Orientation Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openRecordModal(m, 'LOAN_ORIENTATION')}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Record Loan Orientation Attendance"
                                  id={`btn-record-orientation-${m.id}`}
                                >
                                  <Edit3 size={12} />
                                  <span>Record Loan Orientation</span>
                                </button>

                                {!isOrientCompleted && (
                                  <button
                                    type="button"
                                    onClick={() => openVerifyModal(m, 'LOAN_ORIENTATION')}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                    title="Verify Loan Orientation Completion"
                                    id={`btn-verify-orientation-${m.id}`}
                                  >
                                    <Check size={12} />
                                    <span>Verify</span>
                                  </button>
                                )}

                                {isOrientPending && (
                                  <button
                                    type="button"
                                    onClick={() => openRejectModal(m, 'LOAN_ORIENTATION')}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="Reject Loan Orientation Record"
                                    id={`btn-reject-orientation-${m.id}`}
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: POLICIES & CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Sliders size={18} className="text-emerald-600" />
                <span>Cooperative Compliance Policies & Rules</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure membership educational prerequisites and loan eligibility gating policies.
              </p>
            </div>
            {role !== 'ADMIN' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Read-Only (Admin Managed)
              </span>
            )}
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mandatory PMES for Loans */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
                <div>
                  <label className="font-bold text-xs text-slate-900 block">
                    Mandatory PMES for Loan Application
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    When active, members who have not completed and verified their Pre-Membership Education Seminar 
                    will be blocked from applying for loans with a clear policy explanation.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.requirePmesForLoan}
                  disabled={role !== 'ADMIN'}
                  onChange={(e) => setConfig({ ...config, requirePmesForLoan: e.target.checked })}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                  id="chk-require-pmes"
                />
              </div>

              {/* Mandatory Loan Orientation */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
                <div>
                  <label className="font-bold text-xs text-slate-900 block">
                    Mandatory Loan Orientation
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    When active, loans configured with borrower orientation will check and verify 
                    orientation compliance before application submission.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.requireOrientationForLoan}
                  disabled={role !== 'ADMIN'}
                  onChange={(e) => setConfig({ ...config, requireOrientationForLoan: e.target.checked })}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                  id="chk-require-orientation"
                />
              </div>

              {/* Allow Staff Direct Verify */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
                <div>
                  <label className="font-bold text-xs text-slate-900 block">
                    Allow Staff Direct Verification
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Permits cooperative staff members to mark seminar attendance as directly "Completed & Verified" 
                    in a single operation when recording attendance.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.allowStaffDirectVerify}
                  disabled={role !== 'ADMIN'}
                  onChange={(e) => setConfig({ ...config, allowStaffDirectVerify: e.target.checked })}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                  id="chk-staff-direct-verify"
                />
              </div>

              {/* Require Attendance Date */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
                <div>
                  <label className="font-bold text-xs text-slate-900 block">
                    Require Attendance Date
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Requires staff to record the specific seminar date when logging PMES compliance.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.requireAttendanceDate}
                  disabled={role !== 'ADMIN'}
                  onChange={(e) => setConfig({ ...config, requireAttendanceDate: e.target.checked })}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                  id="chk-require-date"
                />
              </div>
            </div>

            {role === 'ADMIN' && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  id="btn-save-compliance-config"
                >
                  <Check size={14} />
                  <span>{isSavingConfig ? 'Saving...' : 'Save Policy Changes'}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <History size={16} className="text-emerald-600" />
                <span>PMES & Compliance Audit Trail</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Immutable audit records of all compliance status updates, verifications, and policy modifications.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAuditLogs}
              disabled={auditLoading}
              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} className={auditLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {auditLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">Loading audit logs...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-mono">
                No compliance-specific audit log records logged yet.
              </div>
            ) : (
              auditLogs.map((log: any) => (
                <div key={log.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-800 font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.createdAt || log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed pt-1">
                    {log.details}
                  </p>
                  <div className="text-[10px] text-slate-400 font-mono pt-1">
                    Operator: <strong>{log.userEmail}</strong> ({log.userRole})
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: RECORD PMES / LOAN ORIENTATION ATTENDANCE */}
      {recordModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-scale-in">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedReqType === 'PRE_MEMBERSHIP_SEMINAR' 
                    ? 'bg-emerald-50 text-emerald-700' 
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {selectedReqType === 'PRE_MEMBERSHIP_SEMINAR' ? <GraduationCap size={22} /> : <BookOpen size={22} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {selectedReqType === 'PRE_MEMBERSHIP_SEMINAR' 
                      ? 'Record PMES Attendance' 
                      : 'Record Loan Orientation Attendance'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {recordModalMember.fullName} ({recordModalMember.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecordModalMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordAttendanceSubmit} className="space-y-4 text-xs">
              {/* Requirement Type */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Requirement Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReqType('PRE_MEMBERSHIP_SEMINAR')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedReqType === 'PRE_MEMBERSHIP_SEMINAR'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-1 ring-emerald-400'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold block text-xs">PMES Seminar</span>
                    <span className="text-[10px] text-slate-500 block">Pre-membership Education</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedReqType('LOAN_ORIENTATION')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedReqType === 'LOAN_ORIENTATION'
                        ? 'bg-blue-50 border-blue-300 text-blue-900 ring-1 ring-blue-400'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold block text-xs">Loan Orientation</span>
                    <span className="text-[10px] text-slate-500 block">Credit Counseling</span>
                  </button>
                </div>
              </div>

              {/* Attendance Date */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {selectedReqType === 'PRE_MEMBERSHIP_SEMINAR' ? 'Seminar Attendance Date' : 'Orientation Attendance Date'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={attDate}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  id="input-att-date"
                />
              </div>

              {/* Certificate / Reference Number */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Certificate / Batch Reference Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder={
                    selectedReqType === 'PRE_MEMBERSHIP_SEMINAR'
                      ? 'e.g. PMES-2026-BATCH-04 or Cert #1042'
                      : 'e.g. ORIENTATION-2026-01 or Ref #5021'
                  }
                  value={attRef}
                  onChange={(e) => setAttRef(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  id="input-att-ref"
                />
              </div>

              {/* Status Outcome Choice */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Compliance Status Gating
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAttStatus('PENDING_VERIFICATION')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      attStatus === 'PENDING_VERIFICATION'
                        ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-400'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold block text-xs">Pending Verification</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Logs attendance; requires secondary verification</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttStatus('COMPLETED')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      attStatus === 'COMPLETED'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-1 ring-emerald-400'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold block text-xs">Direct Verify & Complete</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Immediately satisfies prerequisite</span>
                  </button>
                </div>
              </div>

              {/* Staff Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Staff Remarks / Session Notes
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    selectedReqType === 'PRE_MEMBERSHIP_SEMINAR'
                      ? 'e.g. Attended 4-hour cooperative governance and financial literacy seminar.'
                      : 'e.g. Completed loan guidelines and credit counseling session.'
                  }
                  value={attRemarks}
                  onChange={(e) => setAttRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  id="input-att-remarks"
                />
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 space-y-1">
                <span className="font-bold block">Non-Financial Recording</span>
                <span>Recording compliance updates the member's educational records and will NOT generate financial transactions, ledger entries, or official receipts.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRecordModalMember(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={attSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  id="btn-submit-record-attendance"
                >
                  <Check size={14} />
                  <span>{attSubmitting ? 'Saving...' : 'Save Compliance Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK VERIFY */}
      {verifyModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {selectedReqType === 'PRE_MEMBERSHIP_SEMINAR'
                    ? 'Verify PMES Completion'
                    : 'Verify Loan Orientation Completion'}
                </h3>
                <p className="text-xs text-slate-500">
                  Member: <strong>{verifyModalMember.fullName}</strong> ({verifyModalMember.id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVerifyModalMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Confirming verification will transition the member's {selectedReqType === 'PRE_MEMBERSHIP_SEMINAR' ? 'PMES' : 'Loan Orientation'} status to 
                <strong className="text-emerald-700"> COMPLETED & VERIFIED</strong> and satisfy this prerequisite 
                for borrowing and loan facilities.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Certificate / Reference Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. CERT-2026-089"
                  value={verifyRef}
                  onChange={(e) => setVerifyRef(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  id="input-verify-ref"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Verification Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Certificate verified via training coordinator roster."
                  value={verifyRemarks}
                  onChange={(e) => setVerifyRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  id="input-verify-remarks"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVerifyModalMember(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifySubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  id="btn-confirm-verify"
                >
                  <Check size={14} />
                  <span>{verifySubmitting ? 'Verifying...' : 'Confirm Verification'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT ATTENDANCE */}
      {rejectModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm text-rose-600">
                  {selectedReqType === 'PRE_MEMBERSHIP_SEMINAR'
                    ? 'Reject PMES Record'
                    : 'Reject Loan Orientation Record'}
                </h3>
                <p className="text-xs text-slate-500">
                  Member: <strong>{rejectModalMember.fullName}</strong> ({rejectModalMember.id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Rejecting this record will mark the {selectedReqType === 'PRE_MEMBERSHIP_SEMINAR' ? 'PMES' : 'Loan Orientation'} requirement as <strong className="text-rose-600">REJECTED</strong>. 
                The member will be notified with your feedback to reschedule attendance.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Incomplete seminar attendance / Certificate verification failed."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                  id="input-reject-reason"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModalMember(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  id="btn-confirm-reject"
                >
                  <XCircle size={14} />
                  <span>{rejectSubmitting ? 'Rejecting...' : 'Confirm Rejection'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL: MEMBER COMPLIANCE DETAIL & AUDIT HISTORY */}
      {detailMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-sm">
                  {detailMember.member?.fullName?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {detailMember.member?.fullName}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                    <span>ID: {detailMember.member?.id}</span>
                    <span>•</span>
                    <span>{detailMember.member?.email}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* PMES Profile Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                    <GraduationCap size={16} />
                  </span>
                  <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    Pre-Membership Education Seminar (PMES)
                  </span>
                </div>
                {renderStatusBadge(
                  detailMember.pmesRecord?.status || 
                  (detailMember.member?.hasAttendedPreMembershipSeminar ? 'COMPLETED' : 'NOT_COMPLETED')
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono pt-2 border-t border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Attendance Date</span>
                  <span className="font-semibold text-slate-800">
                    {detailMember.pmesRecord?.attendanceDate || detailMember.pmesRecord?.attendedAt || 'Not recorded'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Certificate Ref</span>
                  <span className="font-semibold text-slate-800">
                    {detailMember.pmesRecord?.referenceNumber || detailMember.pmesRecord?.reference || 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Verified By</span>
                  <span className="font-semibold text-slate-800">
                    {detailMember.pmesRecord?.verifiedBy || 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Verified At</span>
                  <span className="font-semibold text-slate-800">
                    {detailMember.pmesRecord?.verifiedAt ? new Date(detailMember.pmesRecord.verifiedAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              {detailMember.pmesRecord?.remarks && (
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700">
                  <span className="font-bold block text-[10px] text-slate-400 uppercase">Staff Remarks:</span>
                  <span>{detailMember.pmesRecord.remarks}</span>
                </div>
              )}
            </div>

            {/* Loan Orientation Profile Card */}
            {(() => {
              const orientRec = (detailMember.complianceRecords || []).find(
                (r: any) => r.requirementType === 'LOAN_ORIENTATION'
              ) || (detailMember.member?.complianceRecords || []).find(
                (r: any) => r.requirementType === 'LOAN_ORIENTATION'
              );

              return (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-blue-100 text-blue-700">
                        <BookOpen size={16} />
                      </span>
                      <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                        Loan Orientation & Credit Counseling
                      </span>
                    </div>
                    {renderStatusBadge(orientRec?.status || 'NOT_COMPLETED')}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Attendance Date</span>
                      <span className="font-semibold text-slate-800">
                        {orientRec?.attendanceDate || orientRec?.attendedAt || 'Not recorded'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Reference</span>
                      <span className="font-semibold text-slate-800">
                        {orientRec?.referenceNumber || orientRec?.reference || 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Verified By</span>
                      <span className="font-semibold text-slate-800">
                        {orientRec?.verifiedBy || 'Pending'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Verified At</span>
                      <span className="font-semibold text-slate-800">
                        {orientRec?.verifiedAt ? new Date(orientRec.verifiedAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {orientRec?.remarks && (
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700">
                      <span className="font-bold block text-[10px] text-slate-400 uppercase">Staff Remarks:</span>
                      <span>{orientRec.remarks}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Member's Specific Compliance Audit Trail */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <History size={14} className="text-emerald-600" />
                <span>Member Audit Trail History</span>
              </h4>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(!detailMember.auditHistory || detailMember.auditHistory.length === 0) ? (
                  <p className="text-xs text-slate-400 font-mono py-4 text-center">
                    No compliance history entries recorded for this member.
                  </p>
                ) : (
                  detailMember.auditHistory.map((item: any) => (
                    <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                        <span className="font-bold text-slate-700 uppercase">{item.action}</span>
                        <span>{new Date(item.createdAt || item.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-800 text-xs leading-relaxed">
                        {item.details}
                      </p>
                      <div className="text-[10px] text-slate-500 font-mono">
                        By: {item.userEmail} ({item.userRole})
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailMember(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

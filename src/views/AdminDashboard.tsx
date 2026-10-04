/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LoanStatusBadge } from '../components/LoanStatusWorkflow.js';
import { SubmittedDocumentsSection } from '../components/SubmittedDocumentsSection.js';
import { LoanDocumentsSection } from '../components/LoanDocumentsSection.js';
import { ShieldAlert, Users, Settings, Database, History, Check, X, Percent, AlertCircle, Download, UserPlus, Trash2, Lock, Search, RefreshCw, Shield, FileText, MessageSquare, Activity, UserCheck, FileSpreadsheet, Edit3, Plus, Eye, ShieldCheck, FileCheck, CheckCircle2, Info, Upload, Coins, TrendingUp, PiggyBank, Briefcase, Award, Bell, Landmark, ChevronRight, ArrowUpRight, ArrowDownLeft, Smartphone, XCircle, CreditCard, QrCode, Building2 } from 'lucide-react';
import { SmsManager } from '../components/SmsManager.js';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard.js';
import { GcashModule } from '../components/GcashModule.js';
import { AdminLandingCMS } from './AdminLandingCMS.js';
import { StaffLoanMonitoring } from '../components/StaffLoanMonitoring.js';
import { OperationalLedger } from './OperationalLedger.js';
import { PmesComplianceManager } from '../components/PmesComplianceManager.js';
import { StaffSupervisionModule } from '../components/StaffSupervisionModule.js';
import {
  ResponsiveContainer,
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
  Legend
} from 'recharts';


interface AdminDashboardProps {
  token: string;
  activeTab: string;
  setActiveTab?: (tab: string) => void;
  cooperativeName: string;
  onSettingsUpdate: (newName: string) => void;
  onAvatarUpdate?: (newAvatarUrl: string) => void;
}

export function AdminDashboard({ token, activeTab, setActiveTab, onSettingsUpdate, cooperativeName, onAvatarUpdate }: AdminDashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [supervisionStats, setSupervisionStats] = useState<any>(null);
  const [loanApplications, setLoanApplications] = useState<any[]>([]);
  const [activeLoansList, setActiveLoansList] = useState<any[]>([]);
  const [selectedLoanForDetails, setSelectedLoanForDetails] = useState<any | null>(null);
  const [loanPipelineFilter, setLoanPipelineFilter] = useState<string>('ALL');
  const [loanSearchQuery, setLoanSearchQuery] = useState<string>('');
  const [dividendPeriods, setDividendPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<any | null>(null);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [editingAllocationAmount, setEditingAllocationAmount] = useState<string>('');

  // Dividend Edit/Compute States
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editPeriodYear, setEditPeriodYear] = useState<string>('');
  const [editPeriodNetSurplus, setEditPeriodNetSurplus] = useState<string>('');
  const [editPeriodRate, setEditPeriodRate] = useState<string>('');

  const [showComputeForm, setShowComputeForm] = useState(false);
  const [computeYear, setComputeYear] = useState(new Date().getFullYear().toString());
  const [computeNetSurplus, setComputeNetSurplus] = useState('');
  const [computeDividendRate, setComputeDividendRate] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);

  // New Admin Module States
  const [permissions, setPermissions] = useState<any[]>([]);
  const [usersPermissionsList, setUsersPermissionsList] = useState<any[]>([]);
  const [permSubTab, setPermSubTab] = useState<'matrix' | 'overrides' | 'logs'>('matrix');
  const [permSearchQuery, setPermSearchQuery] = useState('');
  const [selectedOverrideUserId, setSelectedOverrideUserId] = useState<string>('');
  const [userOverrideMap, setUserOverrideMap] = useState<Record<string, boolean>>({});
  const [userOverrideFilter, setUserOverrideFilter] = useState('');
  const [backupSchedule, setBackupSchedule] = useState<any>({ enabled: true, frequency: 'DAILY', retentionCount: 30, autoDownload: false });
  const [reportsData, setReportsData] = useState<any>(null);
  const [restoreValidationResult, setRestoreValidationResult] = useState<any>(null);

  // Search/Filters
  const [auditSearch, setAuditSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  // Form Fields: Staff Creation
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffFullName, setNewStaffFullName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');

  // Form Fields: Admin Creation
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // Form Fields: Edit Member
  const [editingMemberId, setEditingMemberId] = useState('');
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberPhone, setEditMemberPhone] = useState('');
  const [editMemberStatus, setEditMemberStatus] = useState('ACTIVE');
  const [editMemberAddress, setEditMemberAddress] = useState('');
  const [editMemberOccupation, setEditMemberOccupation] = useState('');
  const [editMemberCivilStatus, setEditMemberCivilStatus] = useState('');
  const [editMemberEmergencyContact, setEditMemberEmergencyContact] = useState('');
  const [editMemberResetPassword, setEditMemberResetPassword] = useState('');

  // Member Application Verification States
  const [selectedMemberForReview, setSelectedMemberForReview] = useState<any | null>(null);
  const [reviewNotesInput, setReviewNotesInput] = useState('');
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [additionalReqsInput, setAdditionalReqsInput] = useState('');

  // Form Fields: Edit Staff
  const [editingStaffId, setEditingStaffId] = useState('');
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffStatus, setEditStaffStatus] = useState('ACTIVE');
  const [editStaffResetPassword, setEditStaffResetPassword] = useState('');

  // Database Restore JSON Text
  const [restoreJsonText, setRestoreJsonText] = useState('');

  // Notification States
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 5000);
  };

  const loadAllAdminData = async (isBackgroundPoll = false) => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [
        statsRes,
        usersRes,
        supRes,
        laRes,
        alRes,
        dpRes,
        auditRes,
        repRes,
      ] = await Promise.all([
        fetch('/api/dashboard/stats', { headers }),
        fetch('/api/users', { headers }),
        fetch('/api/admin/supervision/stats', { headers }),
        fetch('/api/loans/applications', { headers }),
        fetch('/api/loans/active', { headers }),
        fetch('/api/dividends/periods', { headers }),
        fetch('/api/audit-logs', { headers }),
        fetch('/api/reports/all', { headers }),
      ]);

      // Stats
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats);
      }

      // Users registries
      if (usersRes.ok) {
        const d = await usersRes.json();
        setMembers(d.members || []);
        setStaff(d.staff || []);
        setAdmins(d.admins || []);
      }

      // Staff Supervision stats
      if (supRes.ok) {
        const d = await supRes.json();
        setSupervisionStats(d);
      }

      // Loan apps
      if (laRes.ok) {
        const d = await laRes.json();
        setLoanApplications(d || []);
      }

      // Active Loans list for portfolio monitoring
      if (alRes.ok) {
        const d = await alRes.json();
        setActiveLoansList(d || []);
      }

      // Dividend Periods
      if (dpRes.ok) {
        const d = await dpRes.json();
        setDividendPeriods(d || []);
      }

      // Audit Logs
      if (auditRes.ok) {
        const d = await auditRes.json();
        setAuditLogs(d || []);
      }

      // Reports All Data
      if (repRes.ok) {
        const d = await repRes.json();
        setReportsData(d);
      }

      if (!isBackgroundPoll) {
        const [settingsRes, permRes, backupRes] = await Promise.all([
          fetch('/api/settings', { headers }),
          fetch('/api/permissions', { headers }),
          fetch('/api/backup/schedule', { headers }),
        ]);

        // System Settings
        if (settingsRes.ok) {
          const d = await settingsRes.json();
          setSystemSettings(d);
        }

        // Permissions RBAC
        if (permRes.ok) {
          const d = await permRes.json();
          if (Array.isArray(d)) {
            setPermissions(d);
          } else if (d && d.permissions) {
            setPermissions(d.permissions || []);
            if (d.users) setUsersPermissionsList(d.users || []);
          }
        }

        // Scheduled Backups Config
        if (backupRes.ok) {
          const d = await backupRes.json();
          setBackupSchedule(d);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAllAdminData(false);
    const interval = setInterval(() => {
      if (document.hidden) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
      loadAllAdminData(true);
    }, 15000);

    // Listen for cross-tab updates (e.g. Member submitting a loan)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('coop_loan_updates');
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'LOAN_SUBMITTED') {
          loadAllAdminData();
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported', e);
    }

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
    };
  }, []);

  // Reassign User Role
  const handleRoleAssignment = async (userId: string, newRole: 'ADMIN' | 'STAFF' | 'MEMBER') => {
    try {
      const res = await fetch('/api/users/role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerToast(data.message || `User role updated to ${newRole}`);
      loadAllAdminData();
    } catch (err: any) {
      triggerToast('Failed to assign role: ' + err.message, 'error');
    }
  };

  // Toggle Permission Rule in Matrix
  const handleTogglePermission = (moduleKey: string, roleKey: 'admin' | 'staff' | 'member') => {
    setPermissions(prev => prev.map(p => {
      if (p.module === moduleKey) {
        return { ...p, [roleKey]: !p[roleKey] };
      }
      return p;
    }));
  };

  // Save Permission Rules Matrix
  const handleSavePermissions = async () => {
    try {
      const res = await fetch('/api/permissions/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ permissions })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerToast(data.message || 'Permissions matrix updated successfully!');
      loadAllAdminData();
    } catch (err: any) {
      triggerToast('Error saving permissions: ' + err.message, 'error');
    }
  };

  // Apply Presets to Matrix
  const handleApplyPreset = (preset: 'grant_all_staff' | 'restrict_staff' | 'grant_all_member') => {
    setPermissions(prev => prev.map(p => {
      if (preset === 'grant_all_staff') {
        return { ...p, staff: true };
      } else if (preset === 'restrict_staff') {
        const adminOnly = ['user_management', 'permission_management', 'system_settings', 'backup_restore', 'audit_logs'];
        return { ...p, staff: !adminOnly.includes(p.module) };
      } else if (preset === 'grant_all_member') {
        const memberAllowed = ['dashboard', 'savings', 'loans_apply', 'inquiries', 'dividends'];
        return { ...p, member: memberAllowed.includes(p.module) };
      }
      return p;
    }));
    triggerToast(`Applied matrix preset: ${preset.replace(/_/g, ' ')}`);
  };

  // Reset Permissions Matrix & Overrides to Factory Defaults
  const handleResetPermissions = async () => {
    if (!window.confirm('Are you sure you want to reset all RBAC permissions and user custom overrides to factory defaults?')) {
      return;
    }
    try {
      const res = await fetch('/api/permissions/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerToast(data.message || 'Permissions reset to system defaults!');
      setSelectedOverrideUserId('');
      setUserOverrideMap({});
      loadAllAdminData();
    } catch (err: any) {
      triggerToast('Error resetting permissions: ' + err.message, 'error');
    }
  };

  // Select User for Overrides
  const handleSelectUserForOverride = (userId: string) => {
    setSelectedOverrideUserId(userId);
    const target = usersPermissionsList.find(u => u.id === userId);
    if (target) {
      setUserOverrideMap(target.customPermissions || {});
    } else {
      setUserOverrideMap({});
    }
  };

  // Set individual override state for a user: true (granted), false (revoked), undefined (inherit default)
  const handleSetUserModuleOverride = (moduleKey: string, val: boolean | undefined) => {
    setUserOverrideMap(prev => {
      const copy = { ...prev };
      if (val === undefined) {
        delete copy[moduleKey];
      } else {
        copy[moduleKey] = val;
      }
      return copy;
    });
  };

  // Save User Permissions Overrides
  const handleSaveUserOverride = async () => {
    if (!selectedOverrideUserId) {
      triggerToast('Please select a user first', 'error');
      return;
    }
    try {
      const res = await fetch('/api/permissions/user-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: selectedOverrideUserId,
          customPermissions: userOverrideMap
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerToast(data.message || 'Custom user permissions saved successfully!');
      loadAllAdminData();
    } catch (err: any) {
      triggerToast('Error saving user permissions: ' + err.message, 'error');
    }
  };

  // Save Backup Schedule
  const handleSaveBackupSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/backup/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(backupSchedule)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerToast('Scheduled backup configuration updated!');
      loadAllAdminData();
    } catch (err: any) {
      triggerToast('Error saving backup schedule: ' + err.message, 'error');
    }
  };

  // Validate Restore Payload
  const handleValidateRestorePayload = async () => {
    if (!restoreJsonText) {
      triggerToast('Please paste a JSON backup payload to validate.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/backup/validate-restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ backupJson: restoreJsonText })
      });
      const data = await res.json();
      setRestoreValidationResult(data);
      if (data.valid) {
        triggerToast('Restore validation passed! Payload structure is correct.');
      } else {
        triggerToast('Validation error: ' + data.error, 'error');
      }
    } catch (err: any) {
      triggerToast('Validation exception: ' + err.message, 'error');
    }
  };

  // Export CSV Report
  const handleExportCSV = (reportType: 'financial' | 'savings' | 'loans' | 'dividends' | 'audit') => {
    if (!reportsData) {
      triggerToast('Report data is still loading...', 'error');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    let fileName = `cooperative_${reportType}_report.csv`;

    if (reportType === 'financial') {
      const f = reportsData.financialSummary;
      csvContent += `Metric,Amount\n`;
      csvContent += `Total Cooperative Assets,$${f.totalCooperativeAssets}\n`;
      csvContent += `Total Savings Pool,$${f.totalSavingsPool}\n`;
      csvContent += `Total Share Capital,$${f.totalShareCapital}\n`;
      csvContent += `Total Regular Savings,$${f.totalRegularSavings}\n`;
      csvContent += `Total Time Deposits,$${f.totalTimeDeposits}\n`;
      csvContent += `Total Loans Outstanding,$${f.totalLoansOutstanding}\n`;
      csvContent += `Total Loans Disbursed,$${f.totalLoansDisbursed}\n`;
      csvContent += `Total Dividends Distributed,$${f.totalDividendsDistributed}\n`;
      csvContent += `Total Members,${f.totalMembers}\n`;
      csvContent += `Active Members,${f.activeMembers}\n`;
    } else if (reportType === 'savings') {
      csvContent += `Member ID,Full Name,Email,Phone,Status,Share Capital,Regular Savings,Time Deposits,Total Assets\n`;
      (reportsData.memberSavingsReport || []).forEach((m: any) => {
        csvContent += `"${m.memberId}","${m.fullName}","${m.email}","${m.phone}","${m.status}",${m.shareCapital},${m.regularSavings},${m.timeDeposits},${m.totalAssets}\n`;
      });
    } else if (reportType === 'loans') {
      csvContent += `Loan ID,Member Name,Loan Type,Principal Amount,Balance,Monthly Amortization,Status,Due Date\n`;
      (reportsData.loanPortfolioReport || []).forEach((l: any) => {
        csvContent += `"${l.loanId}","${l.memberName}","${l.loanType}",${l.principal},${l.balance},${l.monthlyAmortization},"${l.status}","${l.dueDate}"\n`;
      });
    } else if (reportType === 'dividends') {
      csvContent += `Period ID,Fiscal Year,Total Net Surplus,Dividend Rate,Status\n`;
      (reportsData.dividendsReport || []).forEach((d: any) => {
        csvContent += `"${d.periodId}",${d.year},${d.totalNetSurplus},${d.dividendRate},"${d.status}"\n`;
      });
    } else if (reportType === 'audit') {
      csvContent += `Log ID,Timestamp,User Email,User Role,Action,Details\n`;
      auditLogs.forEach((log: any) => {
        csvContent += `"${log.id}","${log.createdAt}","${log.userEmail}","${log.userRole}","${log.action}","${log.details.replace(/"/g, '""')}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(`Exported ${fileName} successfully!`);
  };

  // Dividend Distribution Release
  const handleDistributeDividends = async (id: string) => {
    try {
      const confirmAction = window.confirm('Are you sure you want to release these computed dividends to all active members? This action cannot be undone and will credit all member regular savings accounts.');
      if (!confirmAction) return;

      const res = await fetch(`/api/dividends/distribute/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast(`Dividends credited and distributed to all member accounts!`);
      setSelectedPeriod(null);
      setAllocations([]);
      loadAllAdminData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Dividend allocations and manual adjustments
  const fetchAllocations = async (periodId: string) => {
    try {
      const res = await fetch(`/api/dividends/allocations/${periodId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setAllocations(d || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdjustAllocation = async (id: string, amount: number) => {
    try {
      const res = await fetch(`/api/dividends/allocations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dividendAmount: amount })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      triggerToast('Dividend allocation manually adjusted successfully!');
      setEditingAllocationId(null);
      if (selectedPeriod) {
        fetchAllocations(selectedPeriod.id);
      }
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const handleDeletePeriod = async (periodId: string) => {
    if (!window.confirm('Are you sure you want to delete this computed dividend period? This will erase all draft member allocations for this year.')) return;
    try {
      const res = await fetch(`/api/dividends/periods/${periodId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      triggerToast('Computed dividend period successfully deleted.');
      setSelectedPeriod(null);
      setAllocations([]);
      loadAllAdminData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const handleComputeDividends = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/dividends/compute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          year: Number(computeYear),
          totalNetSurplus: Number(computeNetSurplus),
          dividendRate: Number(computeDividendRate)
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      triggerToast(d.message || 'Dividends computed successfully!');
      setShowComputeForm(false);
      setComputeNetSurplus('');
      setComputeDividendRate('');
      loadAllAdminData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const handleUpdatePeriod = async (id: string) => {
    try {
      const res = await fetch(`/api/dividends/periods/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          year: Number(editPeriodYear),
          totalNetSurplus: Number(editPeriodNetSurplus),
          dividendRate: Number(editPeriodRate)
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      triggerToast('Dividend period updated successfully!');
      setEditingPeriodId(null);
      loadAllAdminData();
      if (selectedPeriod && selectedPeriod.id === id) {
        setSelectedPeriod({ ...selectedPeriod, year: Number(editPeriodYear), totalNetSurplus: Number(editPeriodNetSurplus), dividendRate: Number(editPeriodRate) / 100 });
      }
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  const handleDeleteAllocation = async (allocId: string) => {
    if (!window.confirm('Are you sure you want to delete this member dividend allocation?')) return;
    try {
      const res = await fetch(`/api/dividends/allocations/${allocId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      triggerToast('Member dividend allocation deleted!');
      if (selectedPeriod) {
        fetchAllocations(selectedPeriod.id);
      }
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Create Staff Account
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newStaffEmail,
          password: newStaffPassword,
          fullName: newStaffFullName,
          phone: newStaffPhone
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast(`Staff account for ${newStaffFullName} created successfully!`);
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffFullName('');
      setNewStaffPhone('');
      loadAllAdminData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Update Member Account Details
  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/users/members/${editingMemberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: editMemberName,
          phone: editMemberPhone,
          status: editMemberStatus,
          address: editMemberAddress || undefined,
          occupation: editMemberOccupation || undefined,
          civilStatus: editMemberCivilStatus || undefined,
          emergencyContact: editMemberEmergencyContact || undefined,
          resetPassword: editMemberResetPassword || undefined
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast(`Member profile updated successfully!`);
      setEditingMemberId('');
      setEditMemberResetPassword('');
      setEditMemberAddress('');
      setEditMemberOccupation('');
      setEditMemberCivilStatus('');
      setEditMemberEmergencyContact('');
      loadAllAdminData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Member Application Verification Handler
  const handleVerifyMember = async (
    id: string,
    action: 'APPROVE' | 'REJECT' | 'REVIEW' | 'REQUEST_MORE',
    opts?: { reviewNotes?: string; rejectionReason?: string; additionalRequirementsRequested?: string }
  ) => {
    try {
      const res = await fetch(`/api/users/verify-member/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          reviewNotes: opts?.reviewNotes,
          rejectionReason: opts?.rejectionReason,
          additionalRequirementsRequested: opts?.additionalRequirementsRequested
        })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      let actionMsg = '';
      if (action === 'APPROVE') actionMsg = 'APPROVED & ACTIVATED';
      else if (action === 'REJECT') actionMsg = 'REJECTED';
      else if (action === 'REVIEW') actionMsg = 'marked as UNDER REVIEW';
      else if (action === 'REQUEST_MORE') actionMsg = 'updated with ADDITIONAL REQUIREMENTS REQUESTED';

      triggerToast(`Member verification ${actionMsg} successfully!`);
      setSelectedMemberForReview(null);
      setReviewNotesInput('');
      setRejectionReasonInput('');
      setAdditionalReqsInput('');
      loadAllAdminData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Delete Staff Member
  const handleDeleteStaff = async (id: string) => {
    try {
      const confirmDelete = window.confirm('Are you sure you want to permanently delete this staff account?');
      if (!confirmDelete) return;

      const res = await fetch(`/api/users/staff/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }

      triggerToast('Staff account successfully removed from registry.');
      loadAllAdminData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Create secondary Admin account
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: newAdminEmail, password: newAdminPassword })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast(`Administrator account ${newAdminEmail} successfully provisioned!`);
      setNewAdminEmail('');
      setNewAdminPassword('');
      loadAllAdminData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Update System Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(systemSettings)
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast('Cooperative parameters updated successfully!');
      onSettingsUpdate(systemSettings.cooperativeName);
      loadAllAdminData();
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Database Backup (JSON Export)
  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/db/backup', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to generate state dump');
      const d = await res.json();

      const jsonStr = JSON.stringify(d.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', d.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerToast('Full relational database snapshot exported successfully!');
    } catch (err: any) {
      triggerToast(err.message, 'error');
    }
  };

  // Database Restore (JSON Import)
  const handleUploadRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreJsonText) return;

    try {
      const parsedData = JSON.parse(restoreJsonText);
      const res = await fetch('/api/db/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ data: parsedData })
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      triggerToast('Database re-synchronized and restored successfully!');
      setRestoreJsonText('');
      loadAllAdminData();
    } catch (err: any) {
      triggerToast('Failed to restore. Please ensure the JSON is valid and matches the Cooperative database schema format.', 'error');
    }
  };

  // Audit filter search
  const filteredAuditLogs = auditLogs.filter(log => {
    const search = auditSearch.toLowerCase();
    return (
      log.userEmail.toLowerCase().includes(search) ||
      log.action.toLowerCase().includes(search) ||
      log.details.toLowerCase().includes(search) ||
      log.id.toLowerCase().includes(search)
    );
  });

  // Members filter search
  const filteredMembers = members.filter(m => {
    const search = memberSearch.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(search) ||
      m.email.toLowerCase().includes(search) ||
      m.phone.includes(search)
    );
  });

  if (!stats || !systemSettings) {
    return (
      <div className="flex-1 flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium font-mono">LOADING COOPERATIVE MASTER CONTROL DECK...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-slate-50/60 text-slate-900 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto" id="admin-dashboard-view">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-xl p-4 shadow-2xl border text-sm flex gap-3 items-start animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' 
            : 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
        }`} id="admin-action-toast">
          {toast.type === 'success' ? <Check size={18} className="mt-0.5 text-emerald-600" /> : <AlertCircle size={18} className="mt-0.5 text-rose-600" />}
          <span>{toast.text}</span>
        </div>
      )}



      {/* GCash QR Config & Account Management Tab */}
      {activeTab === 'admin-gcash' && (
        <GcashModule token={token} role="ADMIN" onRefreshStats={loadAllAdminData} />
      )}

      {/* =======================================================================
          TAB: DESCRIPTIVE ANALYTICS MODULE
          ======================================================================= */}
      {activeTab === 'admin-analytics' && (
        <AnalyticsDashboard token={token} />
      )}

      {/* =======================================================================
          TAB: OPERATIONAL LEDGER
          ====================================================================== */}
      {activeTab === 'admin-ledger' && (
        <OperationalLedger token={token} role="ADMIN" />
      )}

      {/* =======================================================================
          TAB: PMES & MEMBERSHIP COMPLIANCE MANAGER
          ======================================================================= */}
      {activeTab === 'admin-pmes' && (
        <PmesComplianceManager token={token} role="ADMIN" />
      )}

      {/* =======================================================================
          TAB 1: ADMIN DASHBOARD STATS & ANALYTICS
          ======================================================================= */}
      {activeTab === 'admin-dashboard' && (
        <div className="space-y-6 animate-fade-in" id="tab-admin-dashboard">
          
          {/* Actionable Operations Alerts / Notifications Banner (Component 10) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.pendingMembers > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start text-xs font-medium text-amber-850 animate-pulse">
                <AlertCircle className="text-amber-600 shrink-0" size={18} />
                <div>
                  <h4 className="font-bold text-amber-900 uppercase tracking-wide">Pending Verifications</h4>
                  <p className="mt-0.5 text-amber-800 leading-relaxed">
                    There are <strong>{stats.pendingMembers}</strong> membership applications awaiting staff review and authorization checks.
                  </p>
                </div>
              </div>
            )}
            {stats.pendingLoanApplicationsCount > 0 && (
              <div className="bg-emerald-50 border border-indigo-200 rounded-2xl p-4 flex gap-3 items-start text-xs font-medium text-emerald-600">
                <ShieldAlert className="text-emerald-600 shrink-0" size={18} />
                <div>
                  <h4 className="font-bold text-emerald-600 uppercase tracking-wide">Credit Authorizations</h4>
                  <p className="mt-0.5 text-emerald-600 leading-relaxed">
                    There are <strong>{stats.pendingLoanApplicationsCount}</strong> active borrowing applications waiting for Admin/Staff review.
                  </p>
                </div>
              </div>
            )}
            {stats.openInquiriesCount > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 items-start text-xs font-medium text-emerald-850">
                <MessageSquare className="text-emerald-600 shrink-0" size={18} />
                <div>
                  <h4 className="font-bold text-emerald-900 uppercase tracking-wide">Active Support Inquiries</h4>
                  <p className="mt-0.5 text-emerald-800 leading-relaxed">
                    Members have filed <strong>{stats.openInquiriesCount}</strong> help inquiries that are open or currently in progress.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Grid (Components 1 to 8) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Component 8: Total Cooperative Assets */}
            <div className="col-span-2 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 border border-indigo-950 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[9px] font-bold text-emerald-600 font-mono uppercase tracking-widest block">Total Consolidated Assets</span>
                <h3 className="text-3xl font-extrabold font-mono tracking-tight mt-1">
                  ₱{(stats.totalCooperativeAssets || 0).toLocaleString()}
                </h3>
              </div>
              <div className="flex justify-between items-center text-[10px] text-emerald-600 font-mono pt-4 border-t border-indigo-800/40">
                <span>Total Savings + Borrowing Receivables</span>
                <span className="bg-emerald-500/20 px-2.5 py-0.5 rounded-full text-[9px] text-emerald-600 font-bold border border-indigo-500/30">Active Portfolio</span>
              </div>
            </div>

            {/* Component 4: Total Savings */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Total Savings Pool</span>
                <h3 className="text-xl font-bold font-mono text-slate-800 mt-1">
                  ₱{(stats.totalSavingsVolume || 0).toLocaleString()}
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-mono border-t border-slate-100 pt-2">
                Share Capital + Regular + Time
              </p>
            </div>

            {/* Component 5: Total Loans outstanding */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Loans Receivable Book</span>
                <h3 className="text-xl font-bold font-mono text-rose-600 mt-1">
                  ₱{(stats.totalOutstandingLoans || 0).toLocaleString()}
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-mono border-t border-slate-100 pt-2">
                {stats.activeLoansCount} active member loan accounts
              </p>
            </div>

            {/* Component 6: Total Share Capital */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Total Share Capital</span>
                <h3 className="text-xl font-bold font-mono text-emerald-600 mt-1">
                  ₱{(stats.totalShareCapital || 0).toLocaleString()}
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-mono border-t border-slate-100 pt-2">
                Primary equity ownership pool
              </p>
            </div>

            {/* Component 7: Total Dividends allocated */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Total Dividends Computed</span>
                <h3 className="text-xl font-bold font-mono text-amber-600 mt-1">
                  ₱{(stats.totalDividends || 0).toLocaleString()}
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-mono border-t border-slate-100 pt-2">
                Total surplus payout yield
              </p>
            </div>

            {/* Component 1 & 2: Total & Active Members */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Membership Strength</span>
                <h3 className="text-xl font-bold font-mono text-slate-800 mt-1">
                  {stats.totalMembers} Members
                </h3>
              </div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-3 border-t border-slate-100 pt-2">
                ● {stats.activeMembers} active verified files
              </p>
            </div>

            {/* Component 3: Staff Count */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Operations Team</span>
                <h3 className="text-xl font-bold font-mono text-slate-800 mt-1">
                  {stats.staffCount || 0} Staff
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 font-mono border-t border-slate-100 pt-2">
                Authorized cashier / review staff
              </p>
            </div>

          </div>

          {/* =======================================================================
              STAFF MANAGEMENT & OPERATIONS SUPERVISION AREA
              ======================================================================= */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 shadow-xl text-white space-y-6 border border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-400" />
                    STAFF MANAGEMENT & SUPERVISION
                  </span>
                  <span className="text-[11px] font-mono text-slate-300">
                    Supervisory Oversight Tier
                  </span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">
                  Cooperative Operations Staff Oversight
                </h3>
                <p className="text-xs text-slate-300 max-w-xl">
                  Monitor real-time staff workload, review operational verifications, inspect payment reconciliations, and supervise day-to-day cashier execution.
                </p>
              </div>

              {/* Quick Navigation Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTab && setActiveTab('admin-staff')}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Users size={14} />
                  <span>Manage Staff</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab && setActiveTab('admin-staff')}
                  className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Activity size={14} />
                  <span>Staff Activity</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab && setActiveTab('admin-logs')}
                  className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <History size={14} />
                  <span>Audit Logs</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab && setActiveTab('admin-permissions')}
                  className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock size={14} />
                  <span>Permission Management</span>
                </button>
              </div>
            </div>

            {/* Real-Time Supervision KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-2xl">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">Active Operations Staff</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {staff.filter((s: any) => s.status === 'ACTIVE').length} / {staff.length}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Authorized officers</span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-2xl">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase block">Inactive / Suspended</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {staff.filter((s: any) => s.status !== 'ACTIVE').length}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Locked or deactivated</span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-2xl">
                <span className="text-[10px] font-mono text-rose-400 font-bold uppercase block">Pending Staff Actions</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {(stats.pendingMembers || 0) + (stats.pendingLoanApplicationsCount || 0) + (supervisionStats?.pendingActions?.pendingPayments || 0)}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Awaiting officer review</span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-2xl">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase block">Reconciliations Queue</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">
                  {supervisionStats?.pendingActions?.pendingPayments ?? 0}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Pending financial audit</span>
              </div>
            </div>

            {/* Activity Feeds: Recent Staff Activity & Supervision Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
              {/* Recent Staff Operational Actions */}
              <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-3 lg:col-span-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-extrabold text-xs text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Activity size={14} className="text-emerald-400" />
                    Recent Staff Operational Activity
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">Live Audit Logs</span>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {(() => {
                    const recentStaffLogs = (auditLogs || []).filter((l: any) => 
                      l.userRole === 'STAFF' || (staff || []).some((s: any) => s.id === l.userId || s.email === l.userEmail)
                    ).slice(0, 5);

                    if (recentStaffLogs.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 py-4 text-center font-mono">
                          No recent operational staff actions logged.
                        </p>
                      );
                    }

                    return recentStaffLogs.map((log: any) => (
                      <div key={log.id} className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white font-mono text-[11px] truncate">{log.userEmail}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {log.action}
                            </span>
                          </div>
                          <p className="text-slate-300 text-[11px] mt-0.5 truncate">{log.details}</p>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Staff Operations Breakdown */}
              <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="font-extrabold text-xs text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      Supervisory Quick Status
                    </h4>
                  </div>

                  <div className="space-y-2.5 mt-3 text-xs font-mono">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Members Under Review:</span>
                      <strong className="text-white">{stats.pendingMembers || 0}</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Loan Applications:</span>
                      <strong className="text-white">{stats.pendingLoanApplicationsCount || 0}</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Payment Requests:</span>
                      <strong className="text-white">{supervisionStats?.pendingActions?.pendingPayments || 0}</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Cashier Receipts Issued:</span>
                      <strong className="text-emerald-400">{stats.recentTransactions?.length || 0}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab && setActiveTab('admin-staff')}
                  className="w-full py-2 bg-indigo-600/80 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open Staff Supervision Workspace</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Component 11: Analytics Charts Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Area Chart: Asset and Savings Growth Trends */}
            <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Consolidated Growth Ledger Trend</h4>
                <p className="text-xs text-slate-400">Relative growth of total cooperative assets vs liquid savings reserves</p>
              </div>
              <div className="h-[260px] w-full text-xs">
                {stats.analytics && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.analytics.assetsTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip formatter={(value: any) => [`₱${value.toLocaleString()}`, undefined]} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area name="Cooperative Assets" type="monotone" dataKey="assets" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAssets)" />
                      <Area name="Savings Volume" type="monotone" dataKey="savings" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSavings)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Donut Chart: Savings Composition */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Savings Capital Distribution</h4>
                <p className="text-xs text-slate-400">Asset composition ratios in member savings registry</p>
              </div>
              <div className="h-[210px] w-full flex items-center justify-center relative text-xs">
                {stats.analytics && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.analytics.savingsDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        <Cell fill="#6366f1" />
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip formatter={(value: any) => [`₱${value.toLocaleString()}`, undefined]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                {/* Center metric */}
                <div className="absolute text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Total Cash</span>
                  <span className="text-sm font-extrabold text-slate-800 font-mono">₱{(stats.totalSavingsVolume || 0).toLocaleString()}</span>
                </div>
              </div>
              {/* Custom Legend */}
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-center text-slate-500 font-semibold border-t border-slate-100 pt-3">
                <div className="space-y-0.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                  <span>Share</span>
                </div>
                <div className="space-y-0.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                  <span>Regular</span>
                </div>
                <div className="space-y-0.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
                  <span>Time</span>
                </div>
              </div>
            </div>

            {/* Bar Chart: Transaction summary metrics */}
            <div className="lg:col-span-3 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm font-sans flex items-center gap-2">
                  <Activity size={16} className="text-emerald-600" />
                  Operational Liquidity Turnover Overview
                </h4>
                <p className="text-xs text-slate-400">Total processed volume on record by transaction category type</p>
              </div>
              <div className="h-[240px] w-full text-xs">
                {stats.analytics && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.analytics.transactionSummary} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip formatter={(value: any) => [`₱${value.toLocaleString()}`, undefined]} />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={45}>
                        {stats.analytics.transactionSummary.map((entry: any, index: number) => {
                          const colors = ['#6366f1', '#f43f5e', '#a855f7', '#10b981'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Quick Backups & Parameters Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Disaster recovery backups */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <Database size={16} className="text-emerald-600" />
                  Disaster Recovery Backups
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Generate structural cooperative state backup payloads offline. Download an encrypted database JSON state file to restore user parameters and ledger logs in critical situations.
                </p>
              </div>
              <button
                onClick={handleDownloadBackup}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-md shadow-indigo-900/10 flex items-center justify-center gap-2 cursor-pointer w-full mt-4 sm:w-auto"
              >
                <Download size={14} />
                <span>Export Database Backup Snapshot</span>
              </button>
            </div>

            {/* Quick settings params */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <Settings size={16} className="text-emerald-600" />
                Active Cooperative Union Parameters
              </h3>
              <div className="space-y-3 text-xs font-mono pt-1">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Cooperative Union Brand:</span>
                  <span className="text-slate-800 font-extrabold">{systemSettings.cooperativeName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">System Support Email:</span>
                  <span className="text-slate-800 font-extrabold">{systemSettings.contactEmail}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Fiscal Calendar Year:</span>
                  <span className="text-slate-800 font-extrabold">{systemSettings.fiscalYear || '2026'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Surplus Dividend Allocation:</span>
                  <span className="text-emerald-600 font-bold">{(systemSettings.dividendAllocationRate || 0)}% pool</span>
                </div>
              </div>
            </div>

          </div>

          {/* Component 9: Recent Transactions Feed */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Cooperative Recent Transactions Feed</h3>
                <p className="text-xs text-slate-400 mt-0.5">Audit log of latest deposits, withdrawals, loan releases and payments</p>
              </div>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold uppercase">
                Real-Time Ledger
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-mono text-[9px] uppercase">
                    <th className="py-2 px-3">Transaction ID</th>
                    <th className="py-2 px-3">Member Name</th>
                    <th className="py-2 px-3">Transaction Type</th>
                    <th className="py-2 px-3">Processed Description</th>
                    <th className="py-2 px-3">Volume Amount</th>
                    <th className="py-2 px-3">Authorized By</th>
                    <th className="py-2 px-3">Dispatched Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {stats.recentTransactions && stats.recentTransactions.length > 0 ? (
                    stats.recentTransactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">{tx.id}</td>
                        <td className="py-3 px-3 font-bold text-slate-800">{tx.memberName}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold font-mono uppercase ${
                            tx.type === 'DEPOSIT' || tx.type === 'SAVINGS_DEPOSIT' || tx.type === 'DIVIDEND_DISTRIBUTION'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : tx.type === 'WITHDRAWAL' || tx.type === 'SAVINGS_WITHDRAWAL'
                              ? 'bg-rose-50 text-rose-700 border border-rose-100'
                              : tx.type === 'LOAN_RELEASE' || tx.type === 'LOAN_DISBURSEMENT'
                              ? 'bg-emerald-50 text-emerald-600 border border-indigo-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {tx.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-xs">
                          <div className="truncate">{tx.description}</div>
                          {tx.releaseMethod === 'GCASH' && (
                            <div className="text-[10px] text-blue-600 mt-1 font-mono font-bold bg-blue-50 inline-block px-1.5 py-0.5 rounded border border-blue-100">
                              GCash: {tx.gcashNumber || 'N/A'} (Ref: {tx.gcashRefNumber || 'N/A'})
                            </div>
                          )}
                          {tx.releaseMethod === 'CASH' && (
                            <div className="text-[10px] text-emerald-600 mt-1 font-mono font-bold bg-emerald-50 inline-block px-1.5 py-0.5 rounded border border-emerald-100">
                              Method: CASH
                            </div>
                          )}
                        </td>
                        <td className={`py-3 px-3 font-bold font-mono ${
                          tx.type === 'DEPOSIT' || tx.type === 'SAVINGS_DEPOSIT' || tx.type === 'DIVIDEND_DISTRIBUTION'
                            ? 'text-emerald-600'
                            : 'text-slate-800'
                        }`}>
                          ₱{tx.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{tx.processedBy}</td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-slate-400 font-mono uppercase">
                        No transactions filed on database record.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* =======================================================================
          TAB 2: LOAN MONITORING & PIPELINE OVERVIEW (READ-ONLY)
          ======================================================================= */}
      {activeTab === 'admin-loan-monitoring' && (
        <StaffLoanMonitoring token={token} role="ADMIN" />
      )}
      
      {activeTab === 'admin-loans' && (
        <div className="space-y-6 animate-fade-in" id="tab-admin-loans">
          {/* Header & Compliance Banner */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Loan Monitoring & Pipeline Overview
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                  This page provides a read-only overview of all loan applications, approvals, disbursements, and repayments. Operational loan processing is performed exclusively by Staff/Cashier. Administrators monitor transactions for reporting, auditing, and compliance purposes.
                </p>
              </div>
              <span className="px-3.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-bold shrink-0 self-start sm:self-auto flex items-center gap-1.5 shadow-2xs">
                <Eye className="w-4 h-4 text-amber-600" />
                Read-Only Monitoring Mode
              </span>
            </div>

            {/* Pipeline Overview Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider block">Total Pipeline Apps</span>
                <p className="text-xl font-black text-slate-800 font-mono mt-0.5">{loanApplications.length}</p>
                <span className="text-[10px] text-slate-500 font-medium">All recorded applications</span>
              </div>
              <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold text-amber-700 uppercase font-mono tracking-wider block">In Review / Pending</span>
                <p className="text-xl font-black text-amber-900 font-mono mt-0.5">
                  {loanApplications.filter(a => ['PENDING_REVIEW', 'UNDER_REVIEW', 'REVISION_REQUESTED'].includes(a.status)).length}
                </p>
                <span className="text-[10px] text-amber-700 font-medium">Under Staff Assessment</span>
              </div>
              <div className="bg-emerald-50/60 border border-indigo-200/60 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold text-emerald-600 uppercase font-mono tracking-wider block">Approved & Awaiting</span>
                <p className="text-xl font-black text-emerald-600 font-mono mt-0.5">
                  {loanApplications.filter(a => a.status === 'APPROVED').length}
                </p>
                <span className="text-[10px] text-emerald-600 font-medium">Ready for Cashier Release</span>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold text-emerald-700 uppercase font-mono tracking-wider block">Disbursed / Active</span>
                <p className="text-xl font-black text-emerald-900 font-mono mt-0.5">
                  {loanApplications.filter(a => a.status === 'DISBURSED').length}
                </p>
                <span className="text-[10px] text-emerald-700 font-medium">Active Borrowing Accounts</span>
              </div>
              <div className="bg-blue-50/60 border border-blue-200/60 rounded-2xl p-3.5 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-blue-700 uppercase font-mono tracking-wider block">Total Outstanding Balance</span>
                <p className="text-xl font-black text-blue-900 font-mono mt-0.5">
                  ₱{activeLoansList.reduce((sum, l) => sum + (l.balance || 0), 0).toLocaleString()}
                </p>
                <span className="text-[10px] text-blue-700 font-medium">Active Portfolio Principal</span>
              </div>
            </div>
          </div>

          {/* Search & Pipeline Filter Controls */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Borrower Name, Application ID, or Loan Program..."
                  value={loanSearchQuery}
                  onChange={(e) => setLoanSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {[
                  { id: 'ALL', label: 'All Applications' },
                  { id: 'PENDING_REVIEW', label: 'Pending' },
                  { id: 'UNDER_REVIEW', label: 'Under Review' },
                  { id: 'APPROVED', label: 'Approved' },
                  { id: 'DISBURSED', label: 'Disbursed' },
                  { id: 'REJECTED', label: 'Rejected' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLoanPipelineFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      loanPipelineFilter === f.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Loan Applications Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                    <th className="py-3 px-4">App ID</th>
                    <th className="py-3 px-4">Borrower Name</th>
                    <th className="py-3 px-4">Loan Program</th>
                    <th className="py-3 px-4">Principal Amount</th>
                    <th className="py-3 px-4">Repayment Term</th>
                    <th className="py-3 px-4">Process Pipeline Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const filtered = loanApplications.filter(a => {
                      const matchesStatus = loanPipelineFilter === 'ALL' || a.status === loanPipelineFilter;
                      const q = loanSearchQuery.toLowerCase().trim();
                      const matchesQuery = !q || 
                        (a.id && a.id.toLowerCase().includes(q)) ||
                        (a.memberName && a.memberName.toLowerCase().includes(q)) ||
                        (a.loanTypeName && a.loanTypeName.toLowerCase().includes(q));
                      return matchesStatus && matchesQuery;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 font-mono">
                            No loan applications match the current filter criteria.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-600">{a.id}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{a.memberName}</td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{a.loanTypeName}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">₱{(a.amount || 0).toLocaleString()}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{a.durationMonths} months</td>
                        <td className="py-3.5 px-4">
                          <LoanStatusBadge status={a.status} />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedLoanForDetails(a)}
                            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-700 text-emerald-600 font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 border border-indigo-200/80 shadow-2xs"
                          >
                            <Eye size={13} />
                            View Details
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: DIVIDENDS MANAGEMENT (DISTRIBUTE RELEASE)
          ======================================================================= */}
      {activeTab === 'admin-dividends' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="tab-admin-dividends">
          
          {/* Column 1: Computation History */}
          <div className="lg:col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Annual Dividend Distribution</h3>
                <p className="text-xs text-slate-500 mt-1">Review computed fiscal drafts, edit parameters, delete unreleased periods, or authorize final payouts.</p>
              </div>
              <button
                onClick={() => setShowComputeForm(!showComputeForm)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus size={14} />
                {showComputeForm ? 'Close' : 'Generate Dividend Draft'}
              </button>
            </div>

            {/* Compute New Form */}
            {showComputeForm && (
              <form onSubmit={handleComputeDividends} className="bg-emerald-50/70 border border-indigo-100 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-emerald-600 text-xs flex items-center gap-1.5">
                  <Percent size={14} className="text-emerald-600" />
                  Generate New Dividend Draft
                </h4>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase font-mono mb-1">Fiscal Year</label>
                  <input
                    type="number"
                    required
                    value={computeYear}
                    onChange={(e) => setComputeYear(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase font-mono mb-1">Total Net Surplus (₱)</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="e.g., 500000"
                    value={computeNetSurplus}
                    onChange={(e) => setComputeNetSurplus(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase font-mono mb-1">Dividend Rate (%)</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="e.g., 8.5"
                    value={computeDividendRate}
                    onChange={(e) => setComputeDividendRate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Generate Pool
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowComputeForm(false)}
                    className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4 max-h-[500px] overflow-y-auto scrollbar-thin">
              {dividendPeriods.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-mono">
                  No dividend computation records waiting. Click "Generate Dividend Draft" above to generate a draft.
                </div>
              ) : (
                dividendPeriods.map(p => {
                  const isEditingPeriod = editingPeriodId === p.id;
                  return (
                    <div 
                      key={p.id}
                      onClick={() => {
                        setSelectedPeriod(p);
                        fetchAllocations(p.id);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPeriod?.id === p.id 
                          ? 'bg-emerald-50/50 border-indigo-500 shadow-sm' 
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {isEditingPeriod ? (
                        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                            <span className="font-bold text-emerald-600 text-xs">Review Draft Computation</span>
                            <span className="text-[9px] font-mono text-emerald-600 uppercase font-semibold">{p.status === 'COMPUTED' ? 'Draft' : p.status === 'DISTRIBUTED' ? 'Approved & Released' : p.status}</span>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase font-mono mb-1">Fiscal Year</label>
                            <input
                              type="number"
                              value={editPeriodYear}
                              onChange={(e) => setEditPeriodYear(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase font-mono mb-1">Total Net Surplus (₱)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editPeriodNetSurplus}
                              onChange={(e) => setEditPeriodNetSurplus(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase font-mono mb-1">Dividend Rate (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editPeriodRate}
                              onChange={(e) => setEditPeriodRate(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-mono"
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleUpdatePeriod(p.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Save Updates
                            </button>
                            <button
                              onClick={() => setEditingPeriodId(null)}
                              className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm">Fiscal Year {p.year}</h4>
                              <p className="text-[10px] text-slate-500 font-mono mt-1">Net Surplus: ₱{p.totalNetSurplus.toLocaleString()}</p>
                              <p className="text-[10px] text-emerald-600 font-bold font-mono mt-0.5">Rate: {(p.dividendRate * 100).toFixed(2)}%</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-bold font-mono uppercase ${
                              p.status === 'DISTRIBUTED'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-amber-50 border border-amber-200 text-amber-700 animate-pulse'
                            }`}>
                              {p.status === 'COMPUTED' ? 'Draft' : p.status === 'DISTRIBUTED' ? 'Approved & Released' : p.status}
                            </span>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2 justify-between items-center flex-wrap">
                            {p.status === 'COMPUTED' ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDistributeDividends(p.id);
                                  }}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider font-mono rounded-lg transition-all"
                                >
                                  Finalize & Release
                                </button>
                                <div className="flex gap-2 items-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingPeriodId(p.id);
                                      setEditPeriodYear(p.year.toString());
                                      setEditPeriodNetSurplus(p.totalNetSurplus.toString());
                                      setEditPeriodRate((p.dividendRate * 100).toString());
                                    }}
                                    className="text-emerald-600 hover:text-emerald-600 text-[10px] font-bold font-mono transition-all flex items-center gap-1"
                                  >
                                    <Edit3 size={11} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePeriod(p.id);
                                    }}
                                    className="text-rose-600 hover:text-rose-700 text-[10px] font-bold font-mono transition-all flex items-center gap-1"
                                  >
                                    <Trash2 size={11} />
                                    Delete
                                  </button>
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">Released & Saved to savings ledger</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Allocations, Adjustments & Release Guide */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPeriod ? (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4">
                  <div className="w-full relative">
                    <button 
                      onClick={() => { setSelectedPeriod(null); setAllocations([]); }}
                      className="absolute right-0 top-0 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                    >
                      Clear Selection
                    </button>
                    <h3 className="font-bold text-slate-800 text-base">
                      Distribution Summary for Year {selectedPeriod.year}
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-[10px] font-mono text-slate-500 uppercase">Fiscal Year</p>
                        <p className="font-semibold text-slate-800 text-sm">{selectedPeriod.year}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono text-slate-500 uppercase">Net Surplus</p>
                        <p className="font-semibold text-slate-800 text-sm">₱{selectedPeriod.totalNetSurplus.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono text-slate-500 uppercase">Dividend Rate</p>
                        <p className="font-semibold text-emerald-600 text-sm">{(selectedPeriod.dividendRate * 100).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono text-slate-500 uppercase">Eligible Members</p>
                        <p className="font-semibold text-slate-800 text-sm">{allocations.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono text-slate-500 uppercase">Total Allocation</p>
                        <p className="font-semibold text-emerald-600 text-sm">
                          ₱{allocations.reduce((sum, a) => sum + a.dividendAmount, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono text-slate-500 uppercase">Status</p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase ${
                          selectedPeriod.status === 'DISTRIBUTED'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-amber-50 border border-amber-200 text-amber-700'
                        }`}>
                          {selectedPeriod.status === 'COMPUTED' ? 'Draft' : 'Approved & Released'}
                        </span>
                      </div>
                    </div>
                    {selectedPeriod.status === 'DISTRIBUTED' && (() => {
                      const releaseLog = auditLogs.find(log => log.action === 'DIVIDEND_DISTRIBUTION' && log.details.includes(`year ${selectedPeriod.year}`));
                      if (releaseLog) {
                        return (
                          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <p className="text-[10px] font-mono text-slate-500 uppercase">Released By</p>
                              <p className="font-semibold text-slate-800 text-xs">{releaseLog.userEmail}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-mono text-slate-500 uppercase">Release Date</p>
                              <p className="font-semibold text-slate-800 text-xs">{new Date(releaseLog.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-mono text-slate-500 uppercase">Release Time</p>
                              <p className="font-semibold text-slate-800 text-xs">{new Date(releaseLog.createdAt).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                <div className="overflow-x-auto scrollbar-thin rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono text-[10px] uppercase">
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Snapshot Capital</th>
                        <th className="py-3 px-4">Snapshot Savings</th>
                        <th className="py-3 px-4">Computed Dividend</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allocations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 font-mono">No allocations found.</td>
                        </tr>
                      ) : (
                        allocations.map(a => {
                          const isEditing = editingAllocationId === a.id;
                          return (
                            <tr key={a.id} className="hover:bg-slate-50/50">
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-800 block">{a.memberName}</span>
                                <span className="text-[9px] text-slate-400 font-mono">{a.memberId}</span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-700">₱{a.shareCapitalSnapshot.toLocaleString()}</td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">₱{a.regularSavingsSnapshot.toLocaleString()}</td>
                              <td className="py-3.5 px-4">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingAllocationAmount}
                                    onChange={(e) => setEditingAllocationAmount(e.target.value)}
                                    className="w-24 px-2 py-1 bg-white border border-indigo-500 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                                  />
                                ) : (
                                  <span className="font-mono font-bold text-slate-900">₱{a.dividendAmount.toLocaleString()}</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {selectedPeriod.status === 'DISTRIBUTED' ? (
                                  <span className="text-emerald-600 text-[10px] font-mono font-semibold">APPROVED & RELEASED</span>
                                ) : isEditing ? (
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => handleAdjustAllocation(a.id, Number(editingAllocationAmount))}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingAllocationId(null)}
                                      className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingAllocationId(a.id);
                                        setEditingAllocationAmount(a.dividendAmount.toString());
                                      }}
                                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-700 text-emerald-600 rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
                                    >
                                      Adjust Amount
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAllocation(a.id)}
                                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                      title="Delete Allocation"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col justify-center space-y-4 h-full">
                <span className="text-xs font-mono text-emerald-600 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Percent size={14} />
                  Cooperative Capital Yield Guidelines
                </span>
                <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                  <p>
                    As an <strong>Administrator</strong>, you have full fiduciary control over releasing annual cooperative dividends to members. 
                  </p>
                  <p>
                    Before you authorize the final payout using the <strong>"Finalize & Release"</strong> button, you can click on any computed year draft in the registry to audit member-level dividend credits. You can adjust individual dividend credits manually or delete draft periods if computation rate parameters need to be revised.
                  </p>
                  <div className="bg-emerald-50/50 p-3 rounded-2xl border border-indigo-100 font-mono text-emerald-600 text-center font-bold text-[11px]">
                    Dividends are credited directly to member liquid Regular Savings accounts upon distribution release.
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[11px] text-slate-400 italic">
                      💡 Select a computation period from the Annual Dividend Distribution log on the left panel to begin your final audit.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* =======================================================================
          TAB 4: USER & ACCOUNT MANAGEMENT
          ======================================================================= */}
      {activeTab === 'admin-users' && (
        <div className="space-y-6 animate-fade-in" id="tab-admin-users">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Create Staff Account Form */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus size={18} className="text-emerald-600" />
                  Register Staff Account
                </h3>
                <p className="text-xs text-slate-500">Create cooperative operational officers. Staff accounts bypass online verification and can log in immediately.</p>

                <form onSubmit={handleCreateStaff} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Staff Email</label>
                    <input
                      type="email"
                      required
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="officer@coop.com"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Staff Full Name</label>
                    <input
                      type="text"
                      required
                      value={newStaffFullName}
                      onChange={(e) => setNewStaffFullName(e.target.value)}
                      placeholder="e.g., Alice Johnson"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Staff Mobile Phone</label>
                    <input
                      type="text"
                      required
                      value={newStaffPhone}
                      onChange={(e) => setNewStaffPhone(e.target.value)}
                      placeholder="+1 (555) 444-5555"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Login Password</label>
                    <input
                      type="password"
                      required
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-indigo-900/10 cursor-pointer"
                  >
                    Authorize Staff Registration
                  </button>
                </form>
              </div>

              {/* Create Admin secondary */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus size={18} className="text-emerald-600" />
                  Provision Administrator
                </h3>
                <p className="text-xs text-slate-500">Only an Administrator can provision another security Administrator account.</p>

                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Admin Email</label>
                    <input
                      type="email"
                      required
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="admin2@coop.com"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Admin Password</label>
                    <input
                      type="password"
                      required
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer border border-slate-200"
                  >
                    Authorize Admin Provisioning
                  </button>
                </form>
              </div>

            </div>

            {/* List members and staff */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Member Accounts List */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="font-bold text-slate-800">Cooperative Members List</h3>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search member..."
                      className="pl-8 pr-3 py-1.5 w-48 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-mono text-[9px] uppercase">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Email / Phone</th>
                        <th className="py-2.5 px-3">Share Capital</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Manage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMembers.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-bold text-slate-800">
                            <div className="flex items-center gap-2.5">
                              {m.avatarUrl ? (
                                <img
                                  src={m.avatarUrl}
                                  alt={m.fullName}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-bold text-xs font-mono uppercase">
                                  {(m.fullName || '').substring(0, 2) || 'MB'}
                                </div>
                              )}
                              <span>{m.fullName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500 text-[11px] leading-relaxed">
                            {m.email}<br />{m.phone}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">₱{m.shareCapital.toLocaleString()}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase ${
                              m.status === 'ACTIVE'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : m.status === 'PENDING'
                                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                                : 'bg-rose-50 border border-rose-200 text-rose-700'
                            }`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedMemberForReview(m);
                                  setReviewNotesInput(m.reviewNotes || '');
                                  setRejectionReasonInput(m.rejectionReason || '');
                                  setAdditionalReqsInput(m.additionalRequirementsRequested || '');
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                  m.status === 'PENDING' || m.status === 'UNDER_REVIEW'
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-bold'
                                    : 'bg-emerald-50 border border-indigo-200 text-emerald-600 hover:bg-emerald-700'
                                }`}
                                title="Review member government ID and selfie verification"
                              >
                                <FileText size={11} />
                                {m.status === 'PENDING' || m.status === 'UNDER_REVIEW' ? 'View Identity Details' : 'View Verification'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMemberId(m.id);
                                  setEditMemberName(m.fullName);
                                  setEditMemberPhone(m.phone);
                                  setEditMemberStatus(m.status);
                                  setEditMemberAddress(m.address || '');
                                  setEditMemberOccupation(m.occupation || '');
                                  setEditMemberCivilStatus(m.civilStatus || '');
                                  setEditMemberEmergencyContact(typeof m.emergencyContact === 'string' ? m.emergencyContact : (m.emergencyContact?.name ? `${m.emergencyContact.name} (${m.emergencyContact.phone || ''})` : ''));
                                  setEditMemberResetPassword('');
                                }}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-[10px] font-semibold cursor-pointer"
                              >
                                Edit Profile
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Inline Editing Modal/Box */}
                {editingMemberId && (() => {
                  const targetMember = members.find(m => m.id === editingMemberId);
                  const memberLoanBalance = (activeLoansList || [])
                    .filter((l: any) => l.memberId === editingMemberId)
                    .reduce((sum: number, l: any) => sum + (Number(l.balance ?? l.outstandingBalance ?? 0)), 0);

                  return (
                    <form onSubmit={handleUpdateMember} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-xs font-bold text-emerald-600 font-mono uppercase">Edit Member Account ({editingMemberId})</span>
                        <button type="button" onClick={() => setEditingMemberId('')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                          <X size={16} />
                        </button>
                      </div>

                      {/* Legitimate Non-Financial Profile Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-mono mb-1">Full Name</label>
                          <input
                            type="text"
                            required
                            value={editMemberName}
                            onChange={(e) => setEditMemberName(e.target.value)}
                            className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-mono mb-1">Phone / Contact</label>
                          <input
                            type="text"
                            required
                            value={editMemberPhone}
                            onChange={(e) => setEditMemberPhone(e.target.value)}
                            className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-mono mb-1">Address</label>
                          <input
                            type="text"
                            value={editMemberAddress}
                            onChange={(e) => setEditMemberAddress(e.target.value)}
                            placeholder="Home or Provincial Address"
                            className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-mono mb-1">Occupation</label>
                          <input
                            type="text"
                            value={editMemberOccupation}
                            onChange={(e) => setEditMemberOccupation(e.target.value)}
                            placeholder="Employment / Profession"
                            className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-mono mb-1">Civil Status</label>
                          <input
                            type="text"
                            value={editMemberCivilStatus}
                            onChange={(e) => setEditMemberCivilStatus(e.target.value)}
                            placeholder="Single / Married / Widowed"
                            className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-mono mb-1">Emergency Contact</label>
                          <input
                            type="text"
                            value={editMemberEmergencyContact}
                            onChange={(e) => setEditMemberEmergencyContact(e.target.value)}
                            placeholder="Name & Contact number"
                            className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-mono mb-1">Account Status</label>
                          <select
                            value={editMemberStatus}
                            onChange={(e) => setEditMemberStatus(e.target.value)}
                            className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="PENDING">PENDING (Application submitted)</option>
                            <option value="UNDER_REVIEW">UNDER_REVIEW (In processing)</option>
                            <option value="ACTIVE">ACTIVE (Authorized to log in)</option>
                            <option value="REJECTED">REJECTED (Declined application)</option>
                            <option value="SUSPENDED">SUSPENDED (Temporary lock)</option>
                            <option value="DEACTIVATED">DEACTIVATED (Account closed)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 uppercase font-mono mb-1">Reset Password (optional)</label>
                          <input
                            type="password"
                            value={editMemberResetPassword}
                            onChange={(e) => setEditMemberResetPassword(e.target.value)}
                            placeholder="Leave blank to preserve"
                            className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                          />
                        </div>

                        {/* Read-Only Authoritative Financial Balances Protection */}
                        <div className="col-span-1 sm:col-span-2 bg-slate-100/90 p-4 rounded-xl border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                            <div>
                              <span className="text-[11px] font-bold text-slate-700 uppercase font-mono tracking-wider">Authoritative Financial Balances</span>
                              <p className="text-[10px] text-slate-500 italic mt-0.5">Financial balances are updated only through verified financial transactions.</p>
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 rounded-md border border-slate-300">READ ONLY</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                              <span className="block text-[9px] text-slate-400 uppercase font-mono font-semibold">Share Capital</span>
                              <span className="text-xs font-bold text-slate-800 font-mono">
                                ₱{Number(targetMember?.shareCapital || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="block text-[8px] text-slate-400 mt-0.5 font-mono">[READ ONLY]</span>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                              <span className="block text-[9px] text-slate-400 uppercase font-mono font-semibold">Regular Savings</span>
                              <span className="text-xs font-bold text-slate-800 font-mono">
                                ₱{Number(targetMember?.regularSavings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="block text-[8px] text-slate-400 mt-0.5 font-mono">[READ ONLY]</span>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                              <span className="block text-[9px] text-slate-400 uppercase font-mono font-semibold">Time Deposits</span>
                              <span className="text-xs font-bold text-slate-800 font-mono">
                                ₱{Number(targetMember?.timeDeposits || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="block text-[8px] text-slate-400 mt-0.5 font-mono">[READ ONLY]</span>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                              <span className="block text-[9px] text-slate-400 uppercase font-mono font-semibold">Loan Balance</span>
                              <span className="text-xs font-bold text-slate-800 font-mono">
                                ₱{memberLoanBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="block text-[8px] text-slate-400 mt-0.5 font-mono">[READ ONLY]</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer">
                        Save Profile Updates
                      </button>
                    </form>
                  );
                })()}
              </div>

              {/* Staff Accounts List */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Cooperative Operations Staff Directory</h3>
                  {setActiveTab && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('admin-staff')}
                      className="px-3 py-1 bg-indigo-50 hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck size={13} className="text-emerald-600" />
                      <span>Full Staff Supervision Workspace</span>
                      <ChevronRight size={13} />
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-mono text-[9px] uppercase">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Email Address</th>
                        <th className="py-2.5 px-3">Mobile Phone</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Manage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staff.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-bold text-slate-800">{s.fullName}</td>
                          <td className="py-3 px-3 font-mono text-slate-500">{s.email}</td>
                          <td className="py-3 px-3 text-slate-500">{s.phone}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase ${
                              s.status === 'ACTIVE'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : s.status === 'SUSPENDED'
                                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                                : 'bg-slate-100 border border-slate-200 text-slate-600'
                            }`}>
                              {s.status || 'ACTIVE'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {setActiveTab && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('admin-staff')}
                                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold cursor-pointer"
                                  title="Open staff in supervision workspace"
                                >
                                  Supervise
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteStaff(s.id)}
                                className="p-1 text-rose-500 hover:text-white hover:bg-rose-600/10 rounded-lg transition-all cursor-pointer"
                                title="Delete Staff Account"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* =======================================================================
          TAB: STAFF OPERATIONS MANAGEMENT & SUPERVISION MODULE
          ======================================================================= */}
      {activeTab === 'admin-staff' && (
        <StaffSupervisionModule
          token={token}
          onNavigateTab={setActiveTab}
          onRefreshParent={loadAllAdminData}
        />
      )}

      {/* =======================================================================
          TAB 5: SYSTEM AUDIT LOGS
          ======================================================================= */}
      {activeTab === 'admin-logs' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4 animate-fade-in" id="tab-admin-logs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">System Activity Audit Log Trace</h3>
              <p className="text-xs text-slate-500 mt-1">Read-only historical security logs containing user accounts access and transactional authorizations.</p>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit actions..."
                className="pl-8 pr-3 py-1.5 w-48 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-mono text-[9px] uppercase">
                  <th className="py-2.5 px-3">Log ID</th>
                  <th className="py-2.5 px-3">Actor / Account</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Action logged</th>
                  <th className="py-2.5 px-3">Details / audit Memo</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuditLogs.length > 0 ? (
                  filteredAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">{log.id}</td>
                      <td className="py-3 px-3 font-medium text-slate-700">{log.userEmail}</td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[10px]">{log.userRole}</td>
                      <td className="py-3 px-3 font-bold text-emerald-600 text-[11px] font-mono">{log.action}</td>
                      <td className="py-3 px-3 text-slate-600 truncate max-w-[250px]" title={log.details}>{log.details}</td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 font-mono">No matching audit logs trace found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB: FINANCIAL REPORTS & EXPORT
          ======================================================================= */}
      {activeTab === 'admin-reports' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in" id="tab-admin-reports">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-emerald-600" />
                Financial Reports & Audit Statement Exports
              </h3>
              <p className="text-xs text-slate-500 mt-1">Generate, audit, and download official cooperative ledger CSV reports for regulatory compliance.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleExportCSV('financial')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Download size={13} /> Export Financial Summary
              </button>
              <button
                onClick={() => handleExportCSV('savings')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Download size={13} /> Export Member Savings
              </button>
              <button
                onClick={() => handleExportCSV('loans')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Download size={13} /> Export Loan Portfolio
              </button>
            </div>
          </div>

          {/* Reports Summary Metric Cards */}
          {reportsData && reportsData.financialSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Total Asset Volume</span>
                <p className="text-xl font-black text-slate-800 font-mono">₱{(reportsData.financialSummary.totalCooperativeAssets || 0).toLocaleString()}</p>
                <span className="text-[10px] text-emerald-600 font-semibold">Savings + Loans Receivable</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Total Savings Capital</span>
                <p className="text-xl font-black text-emerald-600 font-mono">₱{(reportsData.financialSummary.totalSavingsPool || 0).toLocaleString()}</p>
                <span className="text-[10px] text-slate-500 font-mono">Share Capital + Regular + Time</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Loans Portfolio Outstanding</span>
                <p className="text-xl font-black text-slate-800 font-mono">₱{(reportsData.financialSummary.totalLoansOutstanding || 0).toLocaleString()}</p>
                <span className="text-[10px] text-amber-600 font-semibold">Active Loan Balances</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Dividends Distributed</span>
                <p className="text-xl font-black text-emerald-700 font-mono">₱{(reportsData.financialSummary.totalDividendsDistributed || 0).toLocaleString()}</p>
                <span className="text-[10px] text-slate-500 font-mono">Surplus Disbursed</span>
              </div>
            </div>
          )}

          {/* Member Savings Breakdown Table */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-sm font-mono uppercase tracking-wide">Member Capital & Savings Breakdown Report</h4>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                    <th className="p-3">Member ID</th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Share Capital</th>
                    <th className="p-3">Regular Savings</th>
                    <th className="p-3">Time Deposits</th>
                    <th className="p-3">Total Equity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportsData && reportsData.memberSavingsReport ? (
                    reportsData.memberSavingsReport.map((m: any) => (
                      <tr key={m.memberId} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-slate-500 text-[11px]">{m.memberId}</td>
                        <td className="p-3 font-bold text-slate-800">{m.fullName}</td>
                        <td className="p-3 font-mono font-medium text-slate-700">₱{(m.shareCapital || 0).toLocaleString()}</td>
                        <td className="p-3 font-mono font-medium text-slate-700">₱{(m.regularSavings || 0).toLocaleString()}</td>
                        <td className="p-3 font-mono font-medium text-slate-700">₱{(m.timeDeposits || 0).toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold text-emerald-600">₱{(m.totalAssets || 0).toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 font-mono">Loading reports...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB: PERMISSION MANAGEMENT (RBAC & USER ACCESS CONTROL)
          ======================================================================= */}
      {activeTab === 'admin-permissions' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in" id="tab-admin-permissions">
          
          {/* Header & Title Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Lock size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">
                    Role-Based Access Control (RBAC) & Permission Engine
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage global module matrix rules for Admin, Staff, and Member tiers, plus granular individual user permission overrides.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleResetPermissions}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                title="Reset matrix & user overrides to factory defaults"
              >
                <RefreshCw size={14} /> Reset Defaults
              </button>
              {permSubTab === 'matrix' && (
                <button
                  onClick={handleSavePermissions}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-900/10 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} /> Save Permission Matrix
                </button>
              )}
              {permSubTab === 'overrides' && (
                <button
                  onClick={handleSaveUserOverride}
                  disabled={!selectedOverrideUserId}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-900/10 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={14} /> Save User Overrides
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">System Modules</span>
                <span className="text-xl font-bold font-mono text-slate-800">{permissions.length} Modules</span>
              </div>
              <div className="p-2.5 bg-indigo-100 text-emerald-600 rounded-xl">
                <Lock size={18} />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Role Tiers</span>
                <span className="text-xl font-bold font-mono text-slate-800">3 Tiers</span>
              </div>
              <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                <Users size={18} />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">User Overrides</span>
                <span className="text-xl font-bold font-mono text-emerald-600">
                  {usersPermissionsList.filter(u => Object.keys(u.customPermissions || {}).length > 0).length} Accounts
                </span>
              </div>
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                <UserCheck size={18} />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">RBAC Engine</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Enforced
                </span>
              </div>
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <Shield size={18} />
              </div>
            </div>
          </div>

          {/* Sub-Tab Navigation Switcher */}
          <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
            <button
              onClick={() => setPermSubTab('matrix')}
              className={`pb-3 border-b-2 cursor-pointer flex items-center gap-2 transition-all ${
                permSubTab === 'matrix'
                  ? 'border-indigo-600 text-emerald-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Lock size={15} /> Global Role Matrix
            </button>
            <button
              onClick={() => setPermSubTab('overrides')}
              className={`pb-3 border-b-2 cursor-pointer flex items-center gap-2 transition-all ${
                permSubTab === 'overrides'
                  ? 'border-indigo-600 text-emerald-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck size={15} /> User Access Overrides
              {usersPermissionsList.some(u => Object.keys(u.customPermissions || {}).length > 0) && (
                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                  {usersPermissionsList.filter(u => Object.keys(u.customPermissions || {}).length > 0).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setPermSubTab('logs')}
              className={`pb-3 border-b-2 cursor-pointer flex items-center gap-2 transition-all ${
                permSubTab === 'logs'
                  ? 'border-indigo-600 text-emerald-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History size={15} /> Permission Audit Logs
            </button>
          </div>

          {/* SUB-TAB 1: GLOBAL ROLE MATRIX */}
          {permSubTab === 'matrix' && (
            <div className="space-y-4">
              {/* Toolbar & Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="relative flex-1 max-w-sm">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={permSearchQuery}
                    onChange={(e) => setPermSearchQuery(e.target.value)}
                    placeholder="Search module or action..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold mr-1">Presets:</span>
                  <button
                    onClick={() => handleApplyPreset('grant_all_staff')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-indigo-300 text-slate-700 text-[11px] rounded-lg font-medium transition-all cursor-pointer"
                  >
                    Grant All Staff
                  </button>
                  <button
                    onClick={() => handleApplyPreset('restrict_staff')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-indigo-300 text-slate-700 text-[11px] rounded-lg font-medium transition-all cursor-pointer"
                  >
                    Restrict Staff Admin
                  </button>
                  <button
                    onClick={() => handleApplyPreset('grant_all_member')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-indigo-300 text-slate-700 text-[11px] rounded-lg font-medium transition-all cursor-pointer"
                  >
                    Standard Member
                  </button>
                </div>
              </div>

              {/* Table Matrix */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                      <th className="p-3 w-1/3">System Module / Action</th>
                      <th className="p-3 w-1/3">Description & Scope</th>
                      <th className="p-3 text-center w-28">ADMINISTRATOR</th>
                      <th className="p-3 text-center w-28">STAFF OFFICER</th>
                      <th className="p-3 text-center w-28">MEMBER USER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {permissions
                      .filter(rule => 
                        !permSearchQuery || 
                        rule.name.toLowerCase().includes(permSearchQuery.toLowerCase()) || 
                        rule.module.toLowerCase().includes(permSearchQuery.toLowerCase()) || 
                        rule.description.toLowerCase().includes(permSearchQuery.toLowerCase())
                      )
                      .map((rule: any) => (
                        <tr key={rule.module} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-800 text-[12px]">{rule.name}</div>
                            <div className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                              {rule.module}
                            </div>
                          </td>
                          <td className="p-3 text-slate-500 text-xs leading-relaxed">{rule.description}</td>
                          
                          {/* Admin Toggle */}
                          <td className="p-3 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={rule.admin}
                                onChange={() => handleTogglePermission(rule.module, 'admin')}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                              />
                            </label>
                          </td>

                          {/* Staff Toggle */}
                          <td className="p-3 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={rule.staff}
                                onChange={() => handleTogglePermission(rule.module, 'staff')}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                              />
                            </label>
                          </td>

                          {/* Member Toggle */}
                          <td className="p-3 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={rule.member}
                                onChange={() => handleTogglePermission(rule.module, 'member')}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                              />
                            </label>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 text-slate-600 font-mono text-[11px] font-bold">
                      <td colSpan={2} className="p-3">Active Modules Count:</td>
                      <td className="p-3 text-center text-emerald-600">
                        {permissions.filter(p => p.admin).length} / {permissions.length}
                      </td>
                      <td className="p-3 text-center text-emerald-600">
                        {permissions.filter(p => p.staff).length} / {permissions.length}
                      </td>
                      <td className="p-3 text-center text-emerald-600">
                        {permissions.filter(p => p.member).length} / {permissions.length}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: USER ACCESS OVERRIDES */}
          {permSubTab === 'overrides' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Pane: User Selector */}
              <div className="md:col-span-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-xs uppercase font-mono tracking-wider">Select Account</h4>
                  <p className="text-[11px] text-slate-500">Choose a user to view or override their individual module access permissions.</p>
                </div>

                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={userOverrideFilter}
                    onChange={(e) => setUserOverrideFilter(e.target.value)}
                    placeholder="Search accounts by name/email..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {usersPermissionsList
                    .filter(u => 
                      !userOverrideFilter || 
                      u.name?.toLowerCase().includes(userOverrideFilter.toLowerCase()) || 
                      u.email.toLowerCase().includes(userOverrideFilter.toLowerCase()) || 
                      u.role.toLowerCase().includes(userOverrideFilter.toLowerCase())
                    )
                    .map(u => {
                      const overrideCount = Object.keys(u.customPermissions || {}).length;
                      const isSelected = selectedOverrideUserId === u.id;
                      return (
                        <div
                          key={u.id}
                          onClick={() => handleSelectUserForOverride(u.id)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-indigo-600 shadow-md shadow-indigo-900/10'
                              : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div>
                            <div className="font-bold truncate max-w-[170px]">{u.name || u.email}</div>
                            <div className={`text-[10px] font-mono ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {u.email}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 text-[9px] font-bold font-mono rounded-full block ${
                              isSelected
                                ? 'bg-indigo-800 text-emerald-600'
                                : u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800'
                                : u.role === 'STAFF' ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {u.role}
                            </span>
                            {overrideCount > 0 && (
                              <span className={`text-[9px] font-mono block mt-1 ${isSelected ? 'text-amber-200' : 'text-amber-600 font-bold'}`}>
                                {overrideCount} Overrides
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right Pane: Selected User Permission Inspector & Override Panel */}
              <div className="md:col-span-8 space-y-4">
                {selectedOverrideUserId ? (
                  (() => {
                    const activeUser = usersPermissionsList.find(u => u.id === selectedOverrideUserId);
                    if (!activeUser) return null;
                    const roleKey = activeUser.role.toLowerCase() as 'admin' | 'staff' | 'member';

                    return (
                      <div className="space-y-4">
                        {/* User Summary Banner */}
                        <div className="bg-emerald-50/60 border border-indigo-100 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800 text-sm">{activeUser.name || activeUser.email}</h4>
                              <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded-full bg-emerald-600 text-white">
                                {activeUser.role}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{activeUser.email} • ID: {activeUser.id}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setUserOverrideMap({})}
                              className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
                              title="Clear custom overrides to inherit role defaults"
                            >
                              Reset to Role Default
                            </button>
                            <button
                              onClick={handleSaveUserOverride}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm shadow-emerald-900/10 flex items-center gap-1"
                            >
                              <Check size={13} /> Save User Overrides
                            </button>
                          </div>
                        </div>

                        {/* Modules Override Inspector Table */}
                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                                <th className="p-3">Module Name</th>
                                <th className="p-3 text-center">Role Default ({activeUser.role})</th>
                                <th className="p-3 text-center">Override Action</th>
                                <th className="p-3 text-center">Effective Access</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {permissions.map(rule => {
                                const defaultAllowed = !!rule[roleKey];
                                const overrideVal = userOverrideMap[rule.module]; // true, false, or undefined
                                const effectiveAllowed = overrideVal !== undefined ? overrideVal : defaultAllowed;

                                return (
                                  <tr key={rule.module} className="hover:bg-slate-50/70">
                                    <td className="p-3">
                                      <div className="font-bold text-slate-800">{rule.name}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">{rule.module}</div>
                                    </td>

                                    <td className="p-3 text-center font-mono text-[11px]">
                                      {defaultAllowed ? (
                                        <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Allowed</span>
                                      ) : (
                                        <span className="text-rose-500 font-semibold bg-rose-50 px-2 py-0.5 rounded">Denied</span>
                                      )}
                                    </td>

                                    <td className="p-3 text-center">
                                      <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200 text-[10px] font-mono">
                                        <button
                                          type="button"
                                          onClick={() => handleSetUserModuleOverride(rule.module, undefined)}
                                          className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                                            overrideVal === undefined
                                              ? 'bg-white text-emerald-600 shadow-sm'
                                              : 'text-slate-500 hover:text-slate-800'
                                          }`}
                                          title="Inherit default rule for user's role"
                                        >
                                          Inherit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSetUserModuleOverride(rule.module, true)}
                                          className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                                            overrideVal === true
                                              ? 'bg-emerald-600 text-white shadow-sm'
                                              : 'text-slate-500 hover:text-emerald-600'
                                          }`}
                                          title="Explicitly grant access for this user"
                                        >
                                          Grant
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSetUserModuleOverride(rule.module, false)}
                                          className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                                            overrideVal === false
                                              ? 'bg-rose-600 text-white shadow-sm'
                                              : 'text-slate-500 hover:text-rose-600'
                                          }`}
                                          title="Explicitly revoke access for this user"
                                        >
                                          Revoke
                                        </button>
                                      </div>
                                    </td>

                                    <td className="p-3 text-center">
                                      {effectiveAllowed ? (
                                        <span className="px-2.5 py-1 text-[10px] font-bold font-mono rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                                          <Check size={11} />
                                          {overrideVal !== undefined ? 'Custom Granted' : 'Granted'}
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-1 text-[10px] font-bold font-mono rounded-full bg-rose-100 text-rose-800 inline-flex items-center gap-1">
                                          <X size={11} />
                                          {overrideVal !== undefined ? 'Custom Blocked' : 'Blocked'}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500 space-y-2">
                    <UserCheck size={32} className="mx-auto text-slate-400" />
                    <h4 className="font-bold text-slate-700 text-sm">No User Account Selected</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">Select a staff officer, member, or administrator account from the left pane to configure custom permission overrides.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: PERMISSION AUDIT LOGS */}
          {permSubTab === 'logs' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Security audit trails recording all Role-Based Access Control changes, user permission overrides, and matrix resets.
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Actor Email / Role</th>
                      <th className="p-3">Action Type</th>
                      <th className="p-3">Event Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {auditLogs
                      .filter(log => 
                        log.action.includes('PERMISSION') || 
                        log.action.includes('ROLE') || 
                        log.details.toLowerCase().includes('permission') || 
                        log.details.toLowerCase().includes('rbac')
                      )
                      .slice(0, 25)
                      .map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="p-3 text-slate-500 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800">{log.userEmail}</span>
                            <span className="text-[9px] ml-1.5 px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                              {log.userRole}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-50 text-emerald-600 border border-indigo-100">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 font-sans text-xs">
                            {log.details}
                          </td>
                        </tr>
                      ))}

                    {auditLogs.filter(log => log.action.includes('PERMISSION') || log.action.includes('ROLE') || log.details.toLowerCase().includes('permission')).length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400 font-mono">
                          No RBAC permission audit logs recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =======================================================================
          TAB 6: DATABASE BACKUP & RESTORE
          ======================================================================= */}
      {activeTab === 'admin-backup' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in" id="tab-admin-backup">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Database size={18} className="text-emerald-600" />
              Relational Database Backups & Restore Portal
            </h3>
            <p className="text-xs text-slate-500 mt-1">Export complete database states, schedule automated backups, and validate/restore backup payloads.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left export & Scheduled Backups */}
            <div className="space-y-6">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-widest block">Backup snapshot</span>
                  <h4 className="font-bold text-slate-800 text-sm">Download offline database (JSON Format)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Generates a fully complete structural data payload containing all users, member ledgers, active borrowing agreements, audit trails, and security hashes.</p>
                </div>
                <button
                  onClick={handleDownloadBackup}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-900/10 cursor-pointer"
                >
                  <Download size={15} />
                  Generate & Export Backup Snapshot
                </button>
              </div>

              {/* Scheduled Backups Config Form */}
              <form onSubmit={handleSaveBackupSchedule} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="font-bold text-slate-800 text-sm font-mono uppercase tracking-wide">Automated Scheduled Backups Configuration</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-700 font-medium">Enable Automatic Backups</span>
                    <input
                      type="checkbox"
                      checked={backupSchedule.enabled}
                      onChange={(e) => setBackupSchedule({ ...backupSchedule, enabled: e.target.checked })}
                      className="rounded text-emerald-600 h-4 w-4 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Backup Frequency</label>
                    <select
                      value={backupSchedule.frequency}
                      onChange={(e: any) => setBackupSchedule({ ...backupSchedule, frequency: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                    >
                      <option value="DAILY">Daily (Every 24 hours)</option>
                      <option value="WEEKLY">Weekly (Every 7 days)</option>
                      <option value="MONTHLY">Monthly (Every 30 days)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Retention Count (Max Snapshots Keep)</label>
                    <input
                      type="number"
                      value={backupSchedule.retentionCount}
                      onChange={(e) => setBackupSchedule({ ...backupSchedule, retentionCount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Save Backup Schedule Settings
                  </button>
                </div>
              </form>
            </div>

            {/* Right Import & Restore Validation */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-widest block">System Recovery</span>
                <h4 className="font-bold text-slate-800 text-sm">Restore database state (JSON Injection)</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Paste an offline database JSON state payload below. You can validate the JSON schema before performing a restore.</p>
              </div>

              <div className="space-y-3">
                <textarea
                  required
                  rows={5}
                  value={restoreJsonText}
                  onChange={(e) => setRestoreJsonText(e.target.value)}
                  placeholder="Paste backup JSON payload state here..."
                  className="block w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-[10px]"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleValidateRestorePayload}
                    className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-700 text-emerald-600 text-xs font-semibold rounded-xl border border-indigo-200 transition-all cursor-pointer"
                  >
                    Validate Restore Payload
                  </button>
                  <button
                    type="button"
                    onClick={handleUploadRestore}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Authorize & Overwrite State
                  </button>
                </div>

                {restoreValidationResult && (
                  <div className={`p-3 rounded-xl border text-xs font-mono space-y-1 ${
                    restoreValidationResult.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    <p className="font-bold">{restoreValidationResult.message || restoreValidationResult.error}</p>
                    {restoreValidationResult.summary && (
                      <p className="text-[10px] text-emerald-700">
                        Payload Summary: Users: {restoreValidationResult.summary.usersCount}, Members: {restoreValidationResult.summary.membersCount}, Loans: {restoreValidationResult.summary.loansCount}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 7: SYSTEM SETTINGS
          ======================================================================= */}
      
      {/* TAB: LANDING PAGE CMS */}
      {activeTab === 'admin-landing' && (
        <AdminLandingCMS token={token} />
      )}

      {(activeTab === 'admin-settings' || activeTab === 'admin-savings') && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in" id="tab-admin-settings">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Settings size={18} className="text-emerald-600" />
              Configure Cooperative Parameters
            </h3>
            <p className="text-xs text-slate-500 mt-1">Configure global operational cooperative parameters, support addresses, SMS alert parameters, and dividend distributions allocations.</p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 max-w-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Cooperative Union Brand Name</label>
                <input
                  type="text"
                  required
                  value={systemSettings.cooperativeName}
                  onChange={(e) => setSystemSettings({ ...systemSettings, cooperativeName: e.target.value })}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Customer Support Email</label>
                <input
                  type="email"
                  required
                  value={systemSettings.contactEmail}
                  onChange={(e) => setSystemSettings({ ...systemSettings, contactEmail: e.target.value })}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Support Contact Phone</label>
                <input
                  type="text"
                  required
                  value={systemSettings.contactPhone}
                  onChange={(e) => setSystemSettings({ ...systemSettings, contactPhone: e.target.value })}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">Dividend Allocation Surplus Pool (%)</label>
                <input
                  type="number"
                  required
                  value={systemSettings.dividendAllocationRate}
                  onChange={(e) => setSystemSettings({ ...systemSettings, dividendAllocationRate: Number(e.target.value) })}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                />
              </div>
            </div>

            
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-4">
              <h4 className="text-xs font-bold text-amber-900 font-mono uppercase tracking-wide mb-3 flex items-center gap-2">
                <ShieldCheck size={16} /> Loan System & Repayment Policies
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-amber-800 uppercase font-mono mb-1.5">Weekend/Holiday Adjustment Rule</label>
                  <select
                    value={systemSettings.defaultDueDateAdjustment || 'NEXT_WORKING_DAY'}
                    onChange={(e) => setSystemSettings({ ...systemSettings, defaultDueDateAdjustment: e.target.value as any })}
                    className="block w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                  >
                    <option value="NONE">No Adjustment (Keep exact date)</option>
                    <option value="NEXT_WORKING_DAY">Move to Next Working Day</option>
                    <option value="PREVIOUS_WORKING_DAY">Move to Previous Working Day</option>
                  </select>
                  <p className="text-[10px] text-amber-700 mt-1">If a due date falls on a weekend, how should it be processed?</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-800 uppercase font-mono mb-1.5">Default Grace Period (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={systemSettings.defaultGracePeriodDays || 0}
                    onChange={(e) => setSystemSettings({ ...systemSettings, defaultGracePeriodDays: Number(e.target.value) })}
                    className="block w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                  />
                  <p className="text-[10px] text-amber-700 mt-1">Number of days before a PAST DUE penalty is applied.</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 font-mono uppercase tracking-wide">SMS Alerts & Reminders Engine</h4>
                <p className="text-[11px] text-slate-500 mt-1">If enabled, the system automatically triggers automated payment reminders for member loans.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemSettings.smsNotificationsEnabled}
                  onChange={(e) => setSystemSettings({ ...systemSettings, smsNotificationsEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white peer-checked:after:border-transparent"></div>
              </label>
            </div>

            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200">
              <h4 className="text-xs font-bold text-indigo-900 font-mono uppercase tracking-wide mb-3 flex items-center gap-2">
                <Building2 size={16} /> Official Bank Account Details
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-indigo-700 uppercase font-mono mb-1">Bank Name</label>
                  <input
                    type="text"
                    required
                    value={systemSettings.bankConfig?.bankName || ''}
                    onChange={(e) => setSystemSettings({ ...systemSettings, bankConfig: { ...systemSettings.bankConfig, bankName: e.target.value } })}
                    className="block w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    placeholder="e.g. BDO Unibank"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-700 uppercase font-mono mb-1">Account Name</label>
                  <input
                    type="text"
                    required
                    value={systemSettings.bankConfig?.accountName || ''}
                    onChange={(e) => setSystemSettings({ ...systemSettings, bankConfig: { ...systemSettings.bankConfig, accountName: e.target.value } })}
                    className="block w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    placeholder="e.g. CCT COOPERATIVE INC."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-700 uppercase font-mono mb-1">Account Number</label>
                  <input
                    type="text"
                    required
                    value={systemSettings.bankConfig?.accountNumber || ''}
                    onChange={(e) => setSystemSettings({ ...systemSettings, bankConfig: { ...systemSettings.bankConfig, accountNumber: e.target.value } })}
                    className="block w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                    placeholder="e.g. 001234567890"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-900/10 cursor-pointer"
            >
              Commit System Parameters Update
            </button>
          </form>
        </div>
      )}

      {/* =======================================================================
          TAB: SMS NOTIFICATIONS & REMINDERS
          ======================================================================= */}
      {activeTab === 'admin-sms' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6 animate-fade-in" id="tab-admin-sms">
          <div>
            <h3 className="font-extrabold text-slate-800 text-xl">Cooperative Automated Messaging Outbox</h3>
            <p className="text-xs text-slate-500 mt-1">Audit, monitor, and manually re-dispatch automated SMS payment alerts for upcoming, due, and overdue borrowing balances.</p>
          </div>
          <SmsManager token={token} />
        </div>
      )}

      {/* =======================================================================
          MEMBER IDENTITY VERIFICATION REVIEW MODAL
          ======================================================================= */}
      {selectedMemberForReview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 text-slate-800">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                    selectedMemberForReview.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : selectedMemberForReview.status === 'PENDING'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {selectedMemberForReview.status}
                  </span>
                  <span className="text-xs font-mono text-slate-400">ID: {selectedMemberForReview.id}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  Member Verification Details: {selectedMemberForReview.fullName}
                </h3>
                <p className="text-xs text-slate-500">
                  Registered: {new Date(selectedMemberForReview.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedMemberForReview(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Profile Information Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Email Address</span>
                <span className="font-semibold text-slate-800 break-all">{selectedMemberForReview.email}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Mobile Phone</span>
                <span className="font-semibold text-slate-800">{selectedMemberForReview.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Date of Birth</span>
                <span className="font-semibold text-slate-800">{selectedMemberForReview.birthdate || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Gender / Civil Status</span>
                <span className="font-semibold text-slate-800">{selectedMemberForReview.gender || 'N/A'} / {selectedMemberForReview.civilStatus || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Occupation</span>
                <span className="font-semibold text-slate-800">{selectedMemberForReview.occupation || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Monthly Income</span>
                <span className="font-semibold text-slate-800">₱{(selectedMemberForReview.monthlyIncome || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Emergency Contact</span>
                <span className="font-semibold text-slate-800">{selectedMemberForReview.emergencyContact || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Initial Share Pledged</span>
                <span className="font-bold text-slate-800 font-mono">
                  ₱{Number(selectedMemberForReview.initialShareCapitalPledged || selectedMemberForReview.initialShareCapital || 2000).toLocaleString()}{' '}
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${selectedMemberForReview.initialShareCapitalPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {selectedMemberForReview.initialShareCapitalPaid ? 'PAID' : 'UNPAID'}
                  </span>
                </span>
                <span className="text-[10px] text-emerald-700 font-mono block mt-0.5">
                  Credited Equity: ₱{(selectedMemberForReview.shareCapital || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* SUBMITTED DOCUMENTS Section */}
            <SubmittedDocumentsSection
              memberId={selectedMemberForReview.id}
              memberName={selectedMemberForReview.fullName}
              documents={(() => {
                let docsList = selectedMemberForReview.memberDocuments || [];
                if (docsList.length === 0) {
                  docsList = [];
                  if (selectedMemberForReview.govIdUrl) {
                    docsList.push({
                      id: `doc_${selectedMemberForReview.id}_govid`,
                      memberId: selectedMemberForReview.id,
                      memberName: selectedMemberForReview.fullName,
                      fileName: selectedMemberForReview.govIdFileName || 'government_id.jpg',
                      fileType: selectedMemberForReview.govIdUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
                      documentCategory: 'GOV_ID',
                      fileDataUrl: selectedMemberForReview.govIdUrl,
                      fileSize: Math.round(selectedMemberForReview.govIdUrl.length * 0.75),
                      status: selectedMemberForReview.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
                      uploadedAt: selectedMemberForReview.createdAt
                    });
                  }
                  if (selectedMemberForReview.selfieUrl) {
                    docsList.push({
                      id: `doc_${selectedMemberForReview.id}_selfie`,
                      memberId: selectedMemberForReview.id,
                      memberName: selectedMemberForReview.fullName,
                      fileName: selectedMemberForReview.selfieFileName || 'selfie_photo.jpg',
                      fileType: selectedMemberForReview.selfieUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
                      documentCategory: 'SELFIE',
                      fileDataUrl: selectedMemberForReview.selfieUrl,
                      fileSize: Math.round(selectedMemberForReview.selfieUrl.length * 0.75),
                      status: selectedMemberForReview.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
                      uploadedAt: selectedMemberForReview.createdAt
                    });
                  }
                  if (selectedMemberForReview.supportingDocUrl) {
                    docsList.push({
                      id: `doc_${selectedMemberForReview.id}_supp`,
                      memberId: selectedMemberForReview.id,
                      memberName: selectedMemberForReview.fullName,
                      fileName: selectedMemberForReview.supportingDocFileName || 'proof_of_income_billing.pdf',
                      fileType: selectedMemberForReview.supportingDocUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg',
                      documentCategory: 'INCOME_PROOF',
                      fileDataUrl: selectedMemberForReview.supportingDocUrl,
                      fileSize: Math.round(selectedMemberForReview.supportingDocUrl.length * 0.75),
                      status: selectedMemberForReview.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
                      uploadedAt: selectedMemberForReview.createdAt
                    });
                  }
                }
                return docsList;
              })()}
              memberStatus={selectedMemberForReview.status}
              token={token}
              canReview={true}
            />

            {/* Action History if present */}
            {(selectedMemberForReview.reviewNotes || selectedMemberForReview.rejectionReason || selectedMemberForReview.additionalRequirementsRequested) && (
              <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/60 space-y-2 text-xs">
                <h5 className="font-bold text-amber-800 uppercase tracking-wider text-[11px]">Previous Action History</h5>
                <div className="space-y-1">
                  {selectedMemberForReview.reviewNotes && (
                    <p className="text-slate-700"><strong>Review Notes:</strong> {selectedMemberForReview.reviewNotes}</p>
                  )}
                  {selectedMemberForReview.additionalRequirementsRequested && (
                    <p className="text-slate-700"><strong>Additional Requirements Requested:</strong> {selectedMemberForReview.additionalRequirementsRequested}</p>
                  )}
                  {selectedMemberForReview.rejectionReason && (
                    <p className="text-rose-700"><strong>Rejection Reason:</strong> {selectedMemberForReview.rejectionReason}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          READ-ONLY LOAN DETAILS & PIPELINE MONITORING MODAL
          ======================================================================= */}
      {selectedLoanForDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex justify-between items-start shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-emerald-500/30 text-emerald-600 font-mono font-bold text-[10px] rounded-md border border-indigo-500/40 uppercase">
                    Read-Only Audit Inspector
                  </span>
                  <LoanStatusBadge status={selectedLoanForDetails.status} />
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">
                  {selectedLoanForDetails.memberName} — {selectedLoanForDetails.loanTypeName}
                </h3>
                <p className="text-xs font-mono text-slate-400">
                  Application ID: <span className="text-emerald-600 font-bold">{selectedLoanForDetails.id}</span> | Applied: {selectedLoanForDetails.createdAt ? new Date(selectedLoanForDetails.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLoanForDetails(null)}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {/* Operational Compliance Note */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs">Read-Only Monitoring Mode</p>
                  <p className="text-[11px] text-amber-800/90 mt-0.5">
                    Operational loan processing (review, approval, rejection, and fund disbursement) is performed exclusively by Staff/Cashier. Administrators monitor these details for compliance, reporting, and audit purposes.
                  </p>
                </div>
              </div>

              {/* Application Summary Grid */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase font-mono tracking-wider text-emerald-600 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Loan Application Parameters
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Principal Amount</span>
                    <span className="font-black text-slate-900 text-sm font-mono">₱{(selectedLoanForDetails.amount || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Repayment Term</span>
                    <span className="font-bold text-slate-800 font-mono">{selectedLoanForDetails.durationMonths} Months</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Monthly Amortization</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      ₱{(selectedLoanForDetails.monthlyAmortization || Math.round((selectedLoanForDetails.amount || 0) / (selectedLoanForDetails.durationMonths || 1))).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Interest Rate / Fee</span>
                    <span className="font-bold text-slate-800 font-mono">{selectedLoanForDetails.interestRate ? `${selectedLoanForDetails.interestRate}%` : 'Standard Policy'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Stated Purpose</span>
                    <p className="text-slate-800 font-medium italic mt-0.5">{selectedLoanForDetails.purpose || 'None specified.'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Co-Maker / Guarantor</span>
                    <p className="text-slate-800 font-medium mt-0.5">{selectedLoanForDetails.coMakerName ? `${selectedLoanForDetails.coMakerName} (${selectedLoanForDetails.coMakerPhone || 'No contact'})` : 'No co-maker required'}</p>
                  </div>
                </div>
              </div>

              {/* Staff Processing Audit & Remarks */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase font-mono tracking-wider text-emerald-600 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-emerald-600" />
                  Staff Review & Audit Remarks
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Staff Review Notes</span>
                    <p className="text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 mt-1 font-mono text-[11px]">
                      {selectedLoanForDetails.remarks || selectedLoanForDetails.staffNotes || 'No reviewer notes recorded yet.'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Rejection / Revision Reason</span>
                    <p className="text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 mt-1 font-mono text-[11px]">
                      {selectedLoanForDetails.rejectionReason || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* LOAN DOCUMENTS Review Section */}
              <LoanDocumentsSection
                applicationId={selectedLoanForDetails.id}
                memberId={selectedLoanForDetails.memberId}
                memberName={selectedLoanForDetails.memberName}
                documents={selectedLoanForDetails.documents || []}
                token={token}
                canReview={false}
              />

              {/* Disbursement & Active Account Record */}
              {(() => {
                const activeAccount = activeLoansList.find(l => l.applicationId === selectedLoanForDetails.id || l.id === selectedLoanForDetails.id || l.id === selectedLoanForDetails.loanId);
                const isDisbursed = selectedLoanForDetails.status === 'DISBURSED' || activeAccount;

                if (!isDisbursed) return null;

                const balance = activeAccount ? activeAccount.balance : selectedLoanForDetails.balance;
                const schedule = activeAccount?.amortizationSchedule || selectedLoanForDetails.amortizationSchedule || [];

                return (
                  <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                      <h4 className="font-extrabold text-emerald-950 text-xs uppercase font-mono tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Disbursement Record & Active Account
                      </h4>
                      <span className="px-2.5 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                        Active Account
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase">Disbursed Date</span>
                        <span className="font-bold text-slate-800 font-mono">
                          {selectedLoanForDetails.disbursedAt ? new Date(selectedLoanForDetails.disbursedAt).toLocaleDateString() : 'Recorded'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase">Release Method</span>
                        <span className="font-bold text-slate-800 font-mono">
                          {selectedLoanForDetails.disburseMethod || selectedLoanForDetails.releaseMethod || 'CASH / GCASH'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase">Reference / Voucher No.</span>
                        <span className="font-bold text-blue-700 font-mono">
                          {selectedLoanForDetails.transactionRef || selectedLoanForDetails.gcashRefNumber || 'REF-DISBURSED'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase">Outstanding Balance</span>
                        <span className="font-black text-rose-700 font-mono text-sm">
                          ₱{(balance !== undefined ? balance : selectedLoanForDetails.amount || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Amortization Schedule */}
                    {schedule && schedule.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-emerald-200/60">
                        <span className="text-[11px] font-bold text-slate-700 block uppercase font-mono">
                          Amortization Schedule & Payment History ({schedule.length} Periods)
                        </span>
                        <div className="max-h-48 overflow-y-auto border border-emerald-200/80 rounded-xl bg-white">
                          <table className="w-full text-left text-[11px]">
                            <thead>
                              <tr className="bg-emerald-100/60 text-slate-700 font-mono text-[9px] uppercase border-b border-emerald-200">
                                <th className="p-2">Period</th>
                                <th className="p-2">Due Date</th>
                                <th className="p-2">Amt Due</th>
                                <th className="p-2">Amt Paid</th>
                                <th className="p-2">Bal</th>
                                <th className="p-2 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {schedule.map((item: any, idx: number) => {
                                const due = item.totalAmortization || item.amount || item.dueAmount || 0;
                                const paid = item.amountPaid || 0;
                                const bal = due - paid;
                                return (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="p-2 font-mono font-bold text-slate-600">#{item.installmentNo || idx + 1}</td>
                                  <td className="p-2 font-mono text-slate-800">{item.dueDate}</td>
                                  <td className="p-2 font-mono font-bold text-slate-900">₱{due.toLocaleString()}</td>
                                  <td className="p-2 font-mono text-emerald-600">₱{paid.toLocaleString()}</td>
                                  <td className="p-2 font-mono text-amber-600">₱{bal.toLocaleString()}</td>
                                  <td className="p-2 text-right">
                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                                      item.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                                      item.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800' :
                                      item.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {item.status || 'PENDING'}
                                    </span>
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium italic flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                Read-Only Monitoring Access
              </span>
              <button
                type="button"
                onClick={() => setSelectedLoanForDetails(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

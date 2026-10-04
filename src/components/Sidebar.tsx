/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  Coins, 
  HelpCircle, 
  User as UserIcon, 
  LogOut, 
  Users, 
  ShieldCheck,
  Activity, 
  Database, 
  Settings, 
  History, 
  Menu, 
  X,
  CreditCard, ArrowDownCircle, Clock,
  Percent,
  CheckCircle,
  TrendingUp,
  FileSpreadsheet,
  MessageSquare,
  LockKeyhole,
  BarChart3,
  PieChart,
  QrCode,
  Receipt,
  Globe,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  GraduationCap,
  Bell
} from 'lucide-react';
import { Role } from '../types.js';

interface SidebarProps {
  role: Role;
  fullName: string;
  email: string;
  avatarUrl?: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  cooperativeName: string;
}

export function Sidebar({ 
  role, 
  fullName, 
  avatarUrl,
  activeTab, 
  setActiveTab, 
  onLogout,
  cooperativeName
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Ensure the active tab's parent group is expanded by default
  useEffect(() => {
    const groups = getTabs();
    const newExpanded = { ...expandedGroups };
    let hasChanges = false;

    groups.forEach(group => {
      if (group.items.some(item => item.id === activeTab)) {
        if (!newExpanded[group.section]) {
          newExpanded[group.section] = true;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setExpandedGroups(newExpanded);
    }
  }, [activeTab, role]);

  const toggleGroup = (section: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Define grouped tabs based on role
  const getTabs = () => {
    switch (role) {
      case 'ADMIN':
        return [
          {
            section: 'Admin Dashboard',
            icon: LayoutDashboard,
            items: [
              { id: 'admin-dashboard', label: 'Admin Dashboard', icon: LayoutDashboard }
            ]
          },
          {
            section: 'Users & Members',
            icon: Users,
            items: [
              { id: 'admin-users', label: 'Member & User Management', icon: Users },
              { id: 'admin-staff', label: 'Staff Management', icon: ShieldCheck },
              { id: 'admin-pmes', label: 'PMES & Compliance', icon: GraduationCap },
              { id: 'admin-permissions', label: 'Permission Management', icon: LockKeyhole }
            ]
          },
          {
            section: 'Financial Management',
            icon: Wallet,
            items: [
              { id: 'admin-ledger', label: 'Financial Ledger', icon: BookOpen },
              { id: 'admin-savings', label: 'Savings Management', icon: Wallet },
              { id: 'admin-gcash', label: 'GCash Management', icon: QrCode },
              { id: 'admin-dividends', label: 'Dividend Management', icon: Percent }
            ]
          },
          {
            section: 'Loans',
            icon: ShieldCheck,
            items: [
              { id: 'admin-loans', label: 'Loan Management', icon: ShieldCheck },
              { id: 'admin-loan-monitoring', label: 'Repayment Monitoring', icon: Activity }
            ]
          },
          {
            section: 'Reports & Analytics',
            icon: PieChart,
            items: [
              { id: 'admin-analytics', label: 'Analytics', icon: PieChart },
              { id: 'admin-reports', label: 'Reports', icon: BarChart3 }
            ]
          },
          {
            section: 'Security & Audit',
            icon: ShieldCheck,
  Activity,
            items: [
              { id: 'admin-logs', label: 'Audit Logs', icon: History },
              { id: 'admin-backup', label: 'Backup & Restore', icon: Database }
            ]
          },
          {
            section: 'System Settings',
            icon: Settings,
            items: [
              { id: 'admin-settings', label: 'System Settings', icon: Settings },
              { id: 'admin-sms', label: 'SMS / Notifications', icon: MessageSquare },
              { id: 'admin-landing', label: 'Landing Page / CMS', icon: Globe }
            ]
          }
        ];
      case 'STAFF':
        return [
          {
            section: 'Staff Dashboard',
            icon: LayoutDashboard,
            items: [
              { id: 'staff-dashboard', label: 'Staff Dashboard', icon: LayoutDashboard }
            ]
          },
          {
            section: 'Members',
            icon: Users,
            items: [
              { id: 'staff-verifications', label: 'Member Management', icon: Users },
              { id: 'staff-pmes', label: 'PMES & Compliance', icon: GraduationCap }
            ]
          },
          {
            section: 'Transactions',
            icon: Wallet,
            items: [
              { id: 'staff-gcash', label: 'GCash Verification', icon: QrCode },
              { id: 'staff-cashier', label: 'Savings & Cashier', icon: Wallet },
              { id: 'staff-withdrawals', label: 'Withdrawal Requests', icon: ArrowDownCircle }
            ]
          },
          {
            section: 'Loans',
            icon: ShieldCheck,
            items: [
              { id: 'staff-loans', label: 'Loan Management', icon: ShieldCheck }
            ]
          },
          {
            section: 'Time Deposits',
            icon: Clock,
            items: [
              { id: 'staff-time-deposits', label: 'Time Deposit Management', icon: Clock }
            ]
          },
          {
            section: 'Reports & Ledger',
            icon: BookOpen,
            items: [
              { id: 'staff-ledger', label: 'Operational Ledger', icon: BookOpen },
              { id: 'staff-reports', label: 'Reports', icon: FileSpreadsheet },
              { id: 'staff-dividends', label: 'Dividend Operations', icon: Percent }
            ]
          },
          {
            section: 'Communication',
            icon: MessageSquare,
            items: [
              { id: 'staff-inquiries', label: 'Member Inquiries', icon: HelpCircle },
              { id: 'staff-sms', label: 'SMS / Notifications', icon: MessageSquare }
            ]
          }
        ];
      case 'MEMBER':
      default:
        return [
          {
            section: 'Dashboard',
            icon: LayoutDashboard,
            items: [
              { id: 'member-dashboard', label: 'Dashboard', icon: LayoutDashboard }
            ]
          },
          {
            section: 'Financial Products',
            icon: Wallet,
            items: [
              { id: 'member-savings', label: 'My Savings', icon: Wallet },
              { id: 'member-share-capital', label: 'Share Capital', icon: Coins },
              { id: 'member-payments', label: 'GCash Payments', icon: QrCode },
              { id: 'member-loans', label: 'Loans', icon: CreditCard }
            ]
          },
          {
            section: 'Transactions & Records',
            icon: Receipt,
            items: [
              { id: 'member-loan-receipts', label: 'My Receipts', icon: Receipt },
              { id: 'member-dividends', label: 'My Dividends', icon: Percent },
              { id: 'member-ledger', label: 'Statement of Account', icon: BookOpen }
            ]
          },
          {
            section: 'Account & Support',
            icon: UserIcon,
            items: [
              { id: 'member-profile', label: 'Profile & Documents', icon: UserIcon },
              { id: 'member-notifications', label: 'Email Notifications', icon: Bell },
              { id: 'member-inquiries', label: 'Support', icon: HelpCircle }
            ]
          }
        ];
    }
  };

  const groupedTabs = getTabs();

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="md:hidden bg-slate-50 text-slate-900 p-4 flex justify-between items-center shadow-xs border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-1.5 rounded-lg text-white">
            <Coins size={20} className="text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-900 truncate max-w-[200px]">
            {cooperativeName}
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-slate-700 hover:text-slate-900 p-1 rounded-lg focus:outline-none cursor-pointer"
          id="btn-sidebar-mobile-toggle"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 bg-slate-50 border-r border-slate-200 text-slate-800 flex flex-col justify-between transform transition-all duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0 w-64' : '-translate-x-full'
        } md:static md:h-screen ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
        id="sidebar-container"
      >
        {/* Top brand header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-xs shrink-0">
              <Coins size={24} />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden whitespace-nowrap transition-opacity duration-300 opacity-100">
                <h1 className="font-bold text-slate-900 tracking-tight text-base truncate">
                  {cooperativeName}
                </h1>
                <span className="text-xs text-slate-500 font-mono uppercase tracking-widest block mt-0.5 font-semibold">
                  Portal v1.2
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer shrink-0"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-thin overflow-x-hidden">
          {groupedTabs.map((group, groupIdx) => {
            const isExpanded = expandedGroups[group.section] && !isCollapsed;
            const hasActiveItem = group.items.some(item => item.id === activeTab);
            const isSingleItem = group.items.length === 1;

            if (isSingleItem) {
              const item = group.items[0];
              const isActive = activeTab === item.id;
              const IconComponent = item.icon;
              return (
                <div key={item.id} className="mb-1">
                  <button
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'} py-2 rounded-xl text-sm font-semibold transition-all group cursor-pointer ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                    id={`sidebar-tab-${item.id}`}
                  >
                    <IconComponent
                      size={18}
                      className={`shrink-0 transition-colors ${
                        isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-700'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
                  </button>
                </div>
              );
            }

            return (
              <div key={group.section} className="mb-1 space-y-1">
                <button
                  onClick={() => {
                    if (isCollapsed) {
                      setIsCollapsed(false);
                      if (!expandedGroups[group.section]) {
                        toggleGroup(group.section);
                      }
                    } else {
                      toggleGroup(group.section);
                    }
                  }}
                  title={isCollapsed ? group.section : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                    hasActiveItem ? 'text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <group.icon 
                      size={18} 
                      className={`shrink-0 ${hasActiveItem ? 'text-emerald-600' : 'text-slate-400'}`} 
                    />
                    {!isCollapsed && <span className="truncate whitespace-nowrap">{group.section}</span>}
                  </div>
                  {!isCollapsed && (
                    isExpanded ? (
                      <ChevronDown size={16} className={`shrink-0 ${hasActiveItem ? 'text-emerald-600' : 'text-slate-400'}`} />
                    ) : (
                      <ChevronRight size={16} className={`shrink-0 ${hasActiveItem ? 'text-emerald-600' : 'text-slate-400'}`} />
                    )
                  )}
                </button>
                
                {isExpanded && !isCollapsed && (
                  <div className="pl-9 pr-2 space-y-1 mt-1 transition-all duration-300">
                    {group.items.map(item => {
                      const IconComponent = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleTabClick(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-800 shadow-xs border border-emerald-200/50'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                          }`}
                          id={`sidebar-tab-${item.id}`}
                        >
                          <IconComponent
                            size={16}
                            className={`shrink-0 transition-colors ${
                              isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-700'
                            }`}
                          />
                          <span className="truncate whitespace-nowrap">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Profile details & Logout */}
        <div className="p-4 border-t border-slate-200 bg-slate-100/60 overflow-hidden">
          <div className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 mb-2 rounded-xl bg-white border border-slate-200 shadow-xs`}>
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={fullName} 
                className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 font-bold font-mono text-xs uppercase shrink-0">
                {(fullName || '').substring(0, 2) || 'US'}
              </div>
            )}
            {!isCollapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h4 className="text-xs font-bold text-slate-900 truncate">{fullName || 'User'}</h4>
                <p className="text-[10px] text-slate-500 uppercase font-mono mt-0.5 tracking-wider truncate font-semibold">
                  Role: {role}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={onLogout}
            title={isCollapsed ? "Sign Out" : undefined}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 transition-all cursor-pointer`}
            id="btn-sidebar-logout"
          >
            <LogOut size={16} className="text-red-500 shrink-0" />
            {!isCollapsed && <span className="text-red-600 whitespace-nowrap">Sign Out Session</span>}
          </button>
        </div>
      </aside>
    </>
  );
}


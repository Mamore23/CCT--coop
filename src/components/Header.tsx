/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Check, 
  CheckCircle2, 
  X, 

  LogOut, 
  User as 
  Sparkles,
  Shield,


  ChevronRight
} from 'lucide-react';
import { Role } from '../types.js';

interface HeaderProps {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    avatarUrl?: string;
  };
  token: string;
  cooperativeName: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function Header({
  user,
  token,

  activeTab,
  setActiveTab,
  onLogout
}: HeaderProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [selectedNotifDetail, setSelectedNotifDetail] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch Notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }
    } catch (err) {
      console.error('Error fetching header notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchNotifications();
    }, 15000);
    return () => clearInterval(interval);
  }, [token, activeTab]);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark notification read
  const handleMarkRead = async (id?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.isRead) {
      handleMarkRead(n.id);
    }
    setSelectedNotifDetail(n);
  };

  const handleProfileClick = () => {
    if (user.role === 'MEMBER') {
      setActiveTab('member-profile');
    } else if (user.role === 'ADMIN') {
      setActiveTab('admin-settings');
    } else if (user.role === 'STAFF') {
      setActiveTab('staff-verifications');
    }
  };

  const handleNavigateToFullNotifications = () => {
    setIsDropdownOpen(false);
    if (user.role === 'MEMBER') {
      setActiveTab('member-notifications');
    } else {
      setShowFullModal(true);
    }
  };

  // Helper for tab titles
  const getTabTitle = () => {
    switch (activeTab) {
      case 'admin-dashboard': return 'Financial Monitoring Dashboard';
      case 'admin-analytics': return 'Analytics';
      case 'admin-ledger': return 'Financial Ledger';
      case 'admin-users': return 'User & Member Accounts';
      case 'admin-loans': return 'Loan Monitoring & Pipeline Overview';
      case 'admin-gcash': return 'GCash QR Management';
      case 'admin-dividends': return 'Dividend Management';
      case 'admin-reports': return 'Reports';
      case 'admin-sms': return 'SMS Reminders';
      case 'admin-permissions': return 'Permission Management';
      case 'admin-logs': return 'Audit Logs';
      case 'admin-backup': return 'Backup & Restore';
      case 'admin-settings': return 'System Settings';

      case 'staff-dashboard': return 'Staff Overview';
      case 'staff-analytics': return 'Operational Analytics';
      case 'staff-ledger': return 'Operational Transaction Ledger';
      case 'staff-verifications': return 'Member Approvals';
      case 'staff-loans': return 'Loan Reviews';
      case 'staff-gcash': return 'GCash Verification';
      case 'staff-sms': return 'SMS Reminders';
      case 'staff-cashier': return 'Savings Cashier';
      case 'staff-inquiries': return 'Member Inquiries';
      case 'staff-dividends': return 'Dividend Tool';
      case 'staff-reports': return 'Reports & Export';

      case 'member-dashboard': return 'Dashboard';
      case 'member-savings': return 'My Savings';
      case 'member-share-capital': return 'Share Capital';
      case 'member-payments': return 'Payment Request';
      case 'member-gcash': return 'Payment Request';
      case 'member-loans': return 'Loans';
      case 'member-loan-receipts': return 'My Receipts';
      case 'member-dividends': return 'My Dividends';
      case 'member-ledger': return 'Statement of Account';
      case 'member-inquiries': return 'Support';
      case 'member-notifications': return 'Notifications';
      case 'member-profile': return 'Profile & Documents';
      default: return 'Portal Workspace';
    }
  };

  // Time Formatter
  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <>
      <header className="bg-slate-50 text-slate-900 border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 transition-colors shadow-xs">
        
        {/* Left Side: Navigation Context / Portal Title */}
        <div className="flex items-center gap-3">
          {user.role === 'MEMBER' ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Welcome back, {user.fullName}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
                <Sparkles size={10} className="text-emerald-600" />
                Member Self-Service
              </span>
            </div>
          ) : user.role === 'STAFF' ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Staff Administrative Console
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
                <Sparkles size={10} className="text-emerald-600" />
                Operations Office
              </span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Administrator Master Deck
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
                <Shield size={10} className="text-emerald-600" />
                Security Level 3
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Notifications Button & User Widget */}
        <div className="flex items-center gap-3">
          
          {/* Top-Right Notifications Button Container */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setIsDropdownOpen(!isDropdownOpen);
                fetchNotifications();
              }}
              className={`relative p-2.5 rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer border ${
                isDropdownOpen
                  ? 'bg-slate-200 text-slate-900 border-slate-300 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
              id="btn-top-notifications-toggle"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={18} className={unreadCount > 0 && !isDropdownOpen ? 'animate-wiggle' : ''} />
              
              {/* Notification Badge with Unread Count */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[20px] h-[20px] flex items-center justify-center border border-slate-50 shadow-xs animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Popover */}
            {isDropdownOpen && (
              <div 
                className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-top-2 duration-200"
                id="popover-top-notifications"
              >
                
                {/* Popover Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Notifications</h3>
                    {unreadCount > 0 ? (
                      <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold font-mono rounded-full border border-rose-200 dark:border-rose-800">
                        {unreadCount} Unread
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold font-mono rounded-full border border-emerald-200 dark:border-emerald-800">
                        All Read
                      </span>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <button
                      onClick={(e) => handleMarkRead(undefined, e)}
                      className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Mark all notifications as read"
                    >
                      <CheckCircle2 size={13} />
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Popover Notifications Body List */}
                <div className="max-h-80 sm:max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
                  {notifications.length > 0 ? (
                    notifications.slice(0, 10).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-4 transition-all cursor-pointer flex items-start gap-3 group relative ${
                          !n.isRead
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        {/* Unread Accent Dot */}
                        {!n.isRead && (
                          <span className="absolute left-1.5 top-5 w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse"></span>
                        )}

                        <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                          !n.isRead 
                            ? 'bg-emerald-600 text-white dark:bg-emerald-500' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          <Bell size={14} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`text-xs font-bold truncate ${
                              !n.isRead ? 'text-emerald-950 dark:text-emerald-200' : 'text-slate-800 dark:text-slate-200'
                            }`}>
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex-shrink-0">
                              {formatTimeAgo(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>

                          {!n.isRead && (
                            <button
                              onClick={(e) => handleMarkRead(n.id, e)}
                              className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              <Check size={11} /> Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-mono space-y-2">
                      <Bell size={28} className="mx-auto text-slate-300 dark:text-slate-700" />
                      <p>No notifications found.</p>
                    </div>
                  )}
                </div>

                {/* Popover Footer */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button
                    onClick={handleNavigateToFullNotifications}
                    className="w-full py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    id="btn-view-all-notifications"
                  >
                    <span>View All Notifications Page</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* User Profile Quick Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <button
              onClick={handleProfileClick}
              className="flex items-center gap-2.5 p-1.5 -mx-1.5 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer text-left group"
              title="View Profile & Documents"
              id="btn-header-profile"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs group-hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs font-mono flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  {(user.fullName || 'U').substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="hidden lg:block text-left">
                <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 block leading-tight truncate max-w-[140px] transition-colors">
                  {user.fullName}
                </span>
              </div>
            </button>

            {/* Logout Shortcut Button */}
            <button
              onClick={onLogout}
              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
              title="Logout session"
              id="btn-header-logout"
            >
              <LogOut size={16} className="text-red-500" />
            </button>
          </div>

        </div>

      </header>

      {/* =======================================================================
          DETAIL MODAL: VIEW SPECIFIC NOTIFICATION
          ======================================================================= */}
      {selectedNotifDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-full max-w-md p-6 space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950 text-emerald-600 dark:text-emerald-600 rounded-xl">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{selectedNotifDetail.title}</h3>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {new Date(selectedNotifDetail.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotifDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              {selectedNotifDetail.message}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedNotifDetail(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          FULL NOTIFICATIONS MODAL (FOR ADMIN & STAFF)
          ======================================================================= */}
      {showFullModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col p-6 space-y-4 text-slate-800 dark:text-slate-100">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-emerald-600 dark:text-emerald-600" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  System Notifications Center
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => handleMarkRead()}
                    className="px-3 py-1.5 bg-emerald-50 dark:bg-indigo-950 text-emerald-600 dark:text-emerald-600 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle2 size={13} />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowFullModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 rounded-2xl my-2 transition-all cursor-pointer flex items-start gap-3.5 border ${
                      !n.isRead
                        ? 'bg-emerald-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                      !n.isRead ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      <Bell size={16} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-bold ${!n.isRead ? 'text-emerald-600 dark:text-emerald-600' : 'text-slate-800 dark:text-slate-200'}`}>
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{n.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-slate-400 font-mono text-xs space-y-2">
                  <Bell size={32} className="mx-auto text-slate-300 dark:text-slate-700" />
                  <p>Your notification inbox is clear. No unread alerts!</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end">
              <button
                onClick={() => setShowFullModal(false)}
                className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

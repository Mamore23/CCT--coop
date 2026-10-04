/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { LandingPage } from './views/LandingPage.js';
import { LoginView } from './views/LoginView.js';
import { MemberDashboard } from './views/MemberDashboard.js';
import { StaffDashboard } from './views/StaffDashboard.js';
import { AdminDashboard } from './views/AdminDashboard.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

interface UserSession {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'STAFF' | 'MEMBER';
  memberId?: string;
  avatarUrl?: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('login');
  const [unauthView, setUnauthView] = useState<'landing' | 'login' | 'register'>('landing');
  const [cooperativeName, setCooperativeName] = useState<string>('CCT Cooperative');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and check for existing session
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Fetch Public Cooperative Settings to load name
        const settingsRes = await fetch('/api/settings');
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings?.cooperativeName) {
            setCooperativeName(settings.cooperativeName);
          }
        }

        // Check local storage session
        const storedToken = localStorage.getItem('coop_auth_token');
        const storedUser = localStorage.getItem('coop_auth_user');

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);

          // Verify with /api/auth/me to get fresh details
          const meRes = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });

          if (meRes.ok) {
            const freshData = await meRes.json();
            const freshUser: UserSession = {
              id: freshData.id,
              email: freshData.email,
              role: freshData.role,
              memberId: freshData.memberId || freshData.details?.id || parsedUser.memberId,
              fullName: freshData.details?.fullName || parsedUser.fullName || 'User',
              avatarUrl: freshData.details?.avatarUrl || freshData.avatarUrl || parsedUser.avatarUrl || ''
            };

            // Update local storage and React state
            localStorage.setItem('coop_auth_user', JSON.stringify(freshUser));
            setToken(storedToken);
            setUser(freshUser);

            // Set active tab based on URL param or role
            const urlTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
            const normalizedRole = (freshUser.role || '').toUpperCase();
            if (urlTab) {
              setActiveTab(urlTab);
            } else if (normalizedRole === 'ADMIN') {
              setActiveTab('admin-dashboard');
            } else if (normalizedRole === 'STAFF') {
              setActiveTab('staff-dashboard');
            } else {
              setActiveTab('member-dashboard');
            }
          } else {
            // Token is invalid/expired
            localStorage.removeItem('coop_auth_token');
            localStorage.removeItem('coop_auth_user');
            setToken(null);
            setUser(null);
            setActiveTab('login');
          }
        }
      } catch (err) {
        console.error('Session initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();
  }, []);

  const handleLoginSuccess = (newToken: string, loginUser: any) => {
    // Save to local storage
    localStorage.setItem('coop_auth_token', newToken);
    localStorage.setItem('coop_auth_user', JSON.stringify(loginUser));

    setToken(newToken);
    setUser(loginUser);

    // Route to home tab based on role
    const normalizedRole = (loginUser?.role || '').toUpperCase();
    if (normalizedRole === 'ADMIN') {
      setActiveTab('admin-dashboard');
    } else if (normalizedRole === 'STAFF') {
      setActiveTab('staff-dashboard');
    } else {
      setActiveTab('member-dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('coop_auth_token');
    localStorage.removeItem('coop_auth_user');
    setToken(null);
    setUser(null);
    setActiveTab('login');
    setUnauthView('landing');
  };

  const handleAvatarUpdate = (newAvatarUrl: string) => {
    if (user) {
      const updatedUser = { ...user, avatarUrl: newAvatarUrl };
      setUser(updatedUser);
      localStorage.setItem('coop_auth_user', JSON.stringify(updatedUser));
    }
  };

  // Switch renderer for main workspace panels
  const renderWorkspace = () => {
    if (!token || !user) return null;

    switch ((user.role || '').toUpperCase()) {
      case 'MEMBER':
        return (
          <ErrorBoundary fallbackTitle="Member Dashboard Interface Error">
            <MemberDashboard 
              token={token} 
              activeTab={activeTab} 
              cooperativeName={cooperativeName} 
              onAvatarUpdate={handleAvatarUpdate}
              onNavigate={setActiveTab}
            />
          </ErrorBoundary>
        );
      case 'STAFF':
        return (
          <ErrorBoundary fallbackTitle="Staff Dashboard Interface Error">
            <StaffDashboard 
              token={token} 
              activeTab={activeTab} 
              cooperativeName={cooperativeName} 
              onAvatarUpdate={handleAvatarUpdate}
              onNavigate={setActiveTab}
            />
          </ErrorBoundary>
        );
      case 'ADMIN':
        return (
          <ErrorBoundary fallbackTitle="Admin Dashboard Interface Error">
            <AdminDashboard 
              token={token} 
              activeTab={activeTab} 
              setActiveTab={setActiveTab}
              cooperativeName={cooperativeName} 
              onSettingsUpdate={(newName) => setCooperativeName(newName)}
              onAvatarUpdate={handleAvatarUpdate}
            />
          </ErrorBoundary>
        );
      default:
        return (
          <div className="flex-1 flex justify-center items-center h-screen bg-slate-950 text-slate-400">
            <p className="font-mono text-sm">ACCESS EXHAUSTED OR REJECTED. ROLE NOT AUTHORIZED.</p>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-slate-50 text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold font-mono">ESTABLISHING ENCRYPTED COOPERATIVE HANDSHAKE...</p>
        </div>
      </div>
    );
  }

  // Not Authenticated flow
  if (!token || !user) {
    if (unauthView === 'landing') {
      return (
        <LandingPage 
          cooperativeName={cooperativeName} 
          onNavigateToLogin={() => setUnauthView('login')} 
          onNavigateToRegister={() => setUnauthView('register')} 
        />
      );
    }

    return (
      <LoginView 
        key={unauthView}
        initialMode={unauthView === 'register' ? 'REGISTER' : 'LOGIN'}
        onLoginSuccess={handleLoginSuccess} 
        cooperativeName={cooperativeName} 
        onBackToLanding={() => setUnauthView('landing')}
      />
    );
  }

  // Authenticated flow
  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <Sidebar 
        role={user.role} 
        fullName={user.fullName} 
        email={user.email} 
        avatarUrl={user.avatarUrl}
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        cooperativeName={cooperativeName}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {token && (
          <Header
            user={user}
            token={token}
            cooperativeName={cooperativeName}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onLogout={handleLogout}
          />
        )}
        <div className="flex-1 overflow-y-auto">
          {renderWorkspace()}
        </div>
      </div>
    </div>
  );
}

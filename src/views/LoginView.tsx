/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Phone, Coins, Key, Shield, HelpCircle, CheckCircle, ArrowRight, ArrowLeft, MapPin, Calendar, Briefcase, UploadCloud, FileText, Check, DollarSign, Save, RotateCcw, Trash2, Camera, ShieldCheck, AlertCircle } from 'lucide-react';
import { signInWithFirebaseGoogle } from '../firebase';

interface LoginViewProps {
  key?: React.Key;
  onLoginSuccess: (token: string, user: { id: string; email: string; role: 'ADMIN' | 'STAFF' | 'MEMBER' }) => void;
  cooperativeName: string;
  initialMode?: Mode;
  onBackToLanding?: () => void;
}

type Mode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

export function LoginView({ onLoginSuccess, cooperativeName, initialMode = 'LOGIN', onBackToLanding }: LoginViewProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000'); // default $10,000 share capital

  // Extended Application Fields
  const [address, setAddress] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('Male');
  const [civilStatus, setCivilStatus] = useState('Single');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [occupation, setOccupation] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('30000');
  const [govIdUrl, setGovIdUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [otherRequirements, setOtherRequirements] = useState('');
  const [dragOverGovId, setDragOverGovId] = useState(false);
  const [dragOverSelfie, setDragOverSelfie] = useState(false);
  const [govIdFileName, setGovIdFileName] = useState('');
  const [selfieFileName, setSelfieFileName] = useState('');

  // Wizard & Draft States
  const [regStep, setRegStep] = useState<number>(1);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [supportingDocUrl, setSupportingDocUrl] = useState<string>('');
  const [supportingDocFileName, setSupportingDocFileName] = useState<string>('');
  const [dragOverDoc, setDragOverDoc] = useState<boolean>(false);
  
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    return !!localStorage.getItem('coop_member_registration_draft');
  });
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(() => {
    const raw = localStorage.getItem('coop_member_registration_draft');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed.savedAt || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });


  // Forgot Password OTP States
  const [forgotStep, setForgotStep] = useState<'REQUEST_OTP' | 'VERIFY_OTP' | 'RESET_PASSWORD'>('REQUEST_OTP');
  const [resetOtp, setResetOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    if (newMode === 'FORGOT_PASSWORD') {
      setForgotStep('REQUEST_OTP');
      setResetOtp('');
      setResetToken('');
      setNewResetPassword('');
      setConfirmResetPassword('');
    }
  };

  // Draft handlers
  const handleSaveDraft = () => {
    const draftData = {
      fullName,
      email,
      password,
      phone,
      birthdate,
      gender,
      civilStatus,
      address,
      occupation,
      monthlyIncome,
      initialCapital,
      emergencyContact,
      otherRequirements,
      govIdUrl,
      govIdFileName,
      selfieUrl,
      selfieFileName,
      supportingDocUrl,
      supportingDocFileName,
      step: regStep,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    localStorage.setItem('coop_member_registration_draft', JSON.stringify(draftData));
    setHasDraft(true);
    setDraftSavedAt(draftData.savedAt);
    setSuccess(`Registration draft saved successfully at ${draftData.savedAt}! You can resume it anytime.`);
  };

  const handleResumeDraft = () => {
    const raw = localStorage.getItem('coop_member_registration_draft');
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (draft.fullName) setFullName(draft.fullName);
      if (draft.email) setEmail(draft.email);
      if (draft.password) setPassword(draft.password);
      if (draft.phone) setPhone(draft.phone);
      if (draft.birthdate) setBirthdate(draft.birthdate);
      if (draft.gender) setGender(draft.gender);
      if (draft.civilStatus) setCivilStatus(draft.civilStatus);
      if (draft.address) setAddress(draft.address);
      if (draft.occupation) setOccupation(draft.occupation);
      if (draft.monthlyIncome) setMonthlyIncome(draft.monthlyIncome);
      if (draft.initialCapital) setInitialCapital(draft.initialCapital);
      if (draft.emergencyContact) setEmergencyContact(draft.emergencyContact);
      if (draft.otherRequirements) setOtherRequirements(draft.otherRequirements);
      if (draft.govIdUrl) setGovIdUrl(draft.govIdUrl);
      if (draft.govIdFileName) setGovIdFileName(draft.govIdFileName);
      if (draft.selfieUrl) setSelfieUrl(draft.selfieUrl);
      if (draft.selfieFileName) setSelfieFileName(draft.selfieFileName);
      if (draft.supportingDocUrl) setSupportingDocUrl(draft.supportingDocUrl);
      if (draft.supportingDocFileName) setSupportingDocFileName(draft.supportingDocFileName);
      if (draft.step) setRegStep(draft.step);

      setSuccess(`Draft loaded successfully! Resumed at Step ${draft.step || 1}.`);
    } catch (e) {
      setError('Failed to parse saved draft data.');
    }
  };

  const handleClearDraft = () => {
    localStorage.removeItem('coop_member_registration_draft');
    setHasDraft(false);
    setDraftSavedAt(null);
    setSuccess('Saved draft cleared.');
  };

  // File upload and validation helper
  const processUploadedFile = (file: File, type: 'govId' | 'selfie' | 'supportingDoc') => {
    setError(null);
    // 15MB validation
    if (file.size > 15 * 1024 * 1024) {
      setError(`File "${file.name}" exceeds the 15MB size limit. Please upload a smaller file.`);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError(`File "${file.name}" has an invalid file format. Accepted formats: JPG, PNG, WebP, PDF.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (type === 'govId') {
        setGovIdUrl(result);
        setGovIdFileName(file.name);
      } else if (type === 'selfie') {
        setSelfieUrl(result);
        setSelfieFileName(file.name);
      } else if (type === 'supportingDoc') {
        setSupportingDocUrl(result);
        setSupportingDocFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const validateStep = (step: number): boolean => {
    setError(null);
    if (step === 1) {
      if (!fullName.trim()) { setError('Full Name is required.'); return false; }
      if (!email.trim() || !email.includes('@')) { setError('Valid Email address is required.'); return false; }
      if (!password || password.length < 6) { setError('Password must be at least 6 characters long.'); return false; }
      if (!phone.trim()) { setError('Mobile Phone number is required.'); return false; }
      if (!birthdate) { setError('Birthdate is required.'); return false; }
      if (!address.trim()) { setError('Complete address is required.'); return false; }
      return true;
    }
    if (step === 2) {
      if (!occupation.trim()) { setError('Occupation is required.'); return false; }
      if (!monthlyIncome || Number(monthlyIncome) <= 0) { setError('Valid Monthly Income is required.'); return false; }
      if (!initialCapital || Number(initialCapital) < 0) { setError('Initial Share Capital contribution is required.'); return false; }
      return true;
    }
    if (step === 3) {
      if (!govIdUrl) { setError('Please upload your Government Issued ID to proceed.'); return false; }
      return true;
    }
    if (step === 4) {
      if (!acceptedTerms) { setError('You must accept the Cooperative By-Laws and Privacy Policy to submit your registration.'); return false; }
      return true;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(regStep)) {
      setRegStep(prev => Math.min(prev + 1, 4));
      setError(null);
    }
  };

  const handlePrevStep = () => {
    setRegStep(prev => Math.max(prev - 1, 1));
    setError(null);
  };

  const safeParseJson = async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      if (!response.ok) {
        throw new Error(`Server request failed (${response.status} ${response.statusText}).`);
      }
      throw new Error('Received invalid server response format.');
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPass })
      });

      const data = await safeParseJson(response);
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await safeParseJson(response);
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueWithGoogle = async () => {
    setError(null);
    setSuccess(null);
    setIsGoogleLoading(true);
    try {
      const { idToken } = await signInWithFirebaseGoogle();

      const response = await fetch('/api/auth/firebase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Accept-Auth-Envelope': '1'
        },
        body: JSON.stringify({ idToken })
      });

      const data = await safeParseJson(response);
      if (!response.ok || data?.ok === false || data?.error) {
        throw new Error(data?.error || 'Google authentication failed.');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : '';
      const rawMessage = typeof err?.message === 'string' ? err.message : '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Google authentication was cancelled before completion. Please try again.');
      } else if (code === 'auth/popup-blocked') {
        setError('Google Sign-In popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (code === 'auth/unauthorized-domain') {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'your-app-domain';
        const projectId = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || 'your-firebase-project';
        setError(
          `This domain (${currentDomain}) is not authorized in your Firebase project (${projectId}). To enable Google Sign-In, go to Firebase Console → Authentication → Settings → Authorized domains, click "Add domain" and add: ${currentDomain}`
        );
      } else if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
        setError('Google Sign-In is not enabled in your Firebase project. Please enable the Google provider in Firebase Console → Authentication → Sign-in method.');
      } else if (code === 'auth/network-request-failed' || rawMessage.toLowerCase().includes('failed to fetch') || rawMessage.toLowerCase().includes('networkerror')) {
        setError('Network failure while connecting to Google Sign-In. Please check your internet connection and try again.');
      } else if (code.startsWith('auth/')) {
        setError('Firebase Google authentication failed. Please try again.');
      } else {
        setError(rawMessage || 'Unable to complete Google Sign-In. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          phone,
          initialShareCapital: Number(initialCapital),
          address,
          birthdate,
          gender,
          civilStatus,
          emergencyContact,
          occupation,
          monthlyIncome: Number(monthlyIncome) || 0,
          govIdUrl,
          govIdFileName,
          selfieUrl,
          selfieFileName,
          supportingDocUrl,
          supportingDocFileName,
          otherRequirements
        })
      });

      const data = await safeParseJson(response);
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess('Account submitted successfully! Status: PENDING verification. You cannot log in until our cooperative staff approves and activates your membership account.');
      
      // Notify active staff dashboard sessions via broadcast channel
      try {
        const bc = new BroadcastChannel('coop_member_updates');
        bc.postMessage({ type: 'MEMBER_REGISTERED' });
        setTimeout(() => bc.close(), 1000);
      } catch {}

      // Clear local draft and inputs
      localStorage.removeItem('coop_member_registration_draft');
      setHasDraft(false);
      setDraftSavedAt(null);
      setRegStep(1);
      setAcceptedTerms(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setPassword('');
      setInitialCapital('10000');
      setAddress('');
      setBirthdate('');
      setGender('Male');
      setCivilStatus('Single');
      setEmergencyContact('');
      setOccupation('');
      setMonthlyIncome('30000');
      setGovIdUrl('');
      setGovIdFileName('');
      setSelfieUrl('');
      setSelfieFileName('');
      setSupportingDocUrl('');
      setSupportingDocFileName('');
      setOtherRequirements('');
      setMode('LOGIN'); // direct back to login with success banner
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail })
      });

      const data = await safeParseJson(response);
      if (!response.ok) {
        throw new Error(data.error || 'Unable to request password reset code.');
      }

      setResetOtp('');
      setResetToken('');
      setSuccess(data.message || 'If an account is registered with this email, a verification code has been sent.');
      setForgotStep('VERIFY_OTP');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedOtp = resetOtp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: trimmedOtp })
      });

      const data = await safeParseJson(response);
      if (!response.ok) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }

      setResetToken(data.resetToken || '');
      setSuccess(data.message || 'Verification code verified. Please set your new password.');
      setForgotStep('RESET_PASSWORD');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newResetPassword !== confirmResetPassword) {
      setError('New password and confirm password do not match.');
      return;
    }
    if (newResetPassword.length < 8 || !/[A-Z]/.test(newResetPassword) || !/[a-z]/.test(newResetPassword) || !/[0-9]/.test(newResetPassword)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          resetToken,
          newPassword: newResetPassword,
          confirmPassword: confirmResetPassword
        })
      });

      const data = await safeParseJson(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setResetOtp('');
      setResetToken('');
      setNewResetPassword('');
      setConfirmResetPassword('');
      setPassword('');
      setForgotStep('REQUEST_OTP');
      setMode('LOGIN');
      setSuccess(data.message || 'Password successfully changed! You may now sign in with your new password.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden" id="login-view-container">
      {/* Dynamic Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {onBackToLanding && (
          <div className="flex justify-center mb-4">
            <button
              onClick={onBackToLanding}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-600" />
              Back to Home / Landing Page
            </button>
          </div>
        )}

        {/* Brand Icon */}
        <div className="flex justify-center">
          <div className="bg-emerald-600 p-3.5 rounded-xl text-white shadow-xs flex items-center justify-center shrink-0 w-16 h-16">
            <Coins size={36} className="text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
          {cooperativeName}
        </h2>
        <p className="mt-2.5 text-center text-xs text-slate-500 tracking-wide font-mono uppercase">
          Cooperative Portal Gateway
        </p>
      </div>

      <div className={`mt-8 sm:mx-auto sm:w-full transition-all duration-300 relative z-10 ${mode === 'REGISTER' ? 'sm:max-w-4xl' : 'sm:max-w-md'}`} id="login-box-wrapper">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-2xl border border-slate-200">
          
          {/* Header Message / Errors */}
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2.5 items-start text-xs text-rose-800">
              <Shield size={16} className="mt-0.5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2.5 items-start text-xs text-emerald-800" id="login-success-banner">
              <CheckCircle size={16} className="mt-0.5 text-emerald-600 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* 1. LOGIN MODE */}
          {mode === 'LOGIN' && (
            <div className="space-y-5">
              <form onSubmit={handleLogin} className="space-y-5" id="form-login">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono mb-2">
                  System Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    placeholder="e.g., admin@coop.com"
                    id="input-login-email"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                    Security Password
                  </label>
                  <button
                    type="button"
                    onClick={() => handleModeChange('FORGOT_PASSWORD')}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-600"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    placeholder="••••••••"
                    id="input-login-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 focus:ring-emerald-500 transition-all shadow-lg shadow-indigo-900/10 disabled:opacity-55 disabled:cursor-not-allowed"
                id="btn-login-submit"
              >
                {isLoading ? 'Verifying Credentials...' : 'Access Portal Securely'}
                <ArrowRight size={16} />
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-slate-400 font-mono uppercase tracking-wider text-[10px]">
                    Or for Active Registered Members
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleContinueWithGoogle}
                disabled={isLoading || isGoogleLoading}
                className="w-full flex justify-center items-center gap-3 py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                id="btn-google-login"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.49 12.275c0-.85-.075-1.675-.215-2.475H12v4.69h6.455c-.28 1.485-1.125 2.745-2.39 3.59v2.98h3.865c2.265-2.085 3.56-5.155 3.56-8.785z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.955-1.075 7.94-2.91l-3.865-2.98c-1.075.72-2.45 1.15-4.075 1.15-3.135 0-5.79-2.115-6.74-4.96H1.26v3.08C3.235 21.305 7.3 24 12 24z" />
                  <path fill="#FBBC05" d="M5.26 14.3c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3V6.62H1.26C.46 8.225 0 10.055 0 12s.46 3.775 1.26 5.38l4-3.08z" />
                  <path fill="#EA4335" d="M12 4.74c1.765 0 3.35.605 4.595 1.795l3.44-3.44C17.95 1.16 15.235 0 12 0 7.3 0 3.235 2.695 1.26 6.62l4 3.08c.95-2.845 3.605-4.96 6.74-4.96z" />
                </svg>
                <span>{isGoogleLoading ? 'Connecting with Google...' : 'Continue with Google'}</span>
              </button>

              <div className="mt-6 border-t border-slate-100 pt-6 text-center">
                <p className="text-sm text-slate-500">
                  Are you a Member?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('REGISTER')}
                    className="font-medium text-emerald-600 hover:text-emerald-600 underline underline-offset-4"
                  >
                    Register Online Now
                  </button>
                </p>
              </div>
            </form>
          </div>
          )}

          {/* 2. REGISTRATION MODE: MULTI-STEP ONBOARDING WIZARD */}
          {mode === 'REGISTER' && (
            <div className="space-y-6" id="form-register">
              {/* Draft Resume Alert */}
              {hasDraft && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Save size={18} className="text-amber-600 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-amber-950 block">Incomplete Registration Draft Found</span>
                      <span className="text-amber-700">Saved on {draftSavedAt || 'earlier session'}. Would you like to resume?</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleResumeDraft}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                    >
                      <RotateCcw size={12} />
                      Resume Draft
                    </button>
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold rounded-lg text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Trash2 size={12} />
                      Discard
                    </button>
                  </div>
                </div>
              )}

              {/* Notice Banner */}
              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-indigo-100 text-xs text-emerald-600 leading-relaxed flex gap-3">
                <HelpCircle size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-emerald-600 mb-0.5">Cooperative Membership Onboarding Wizard</span>
                  <span>
                    Follow the 4-step wizard to complete your application. Applications are saved with <strong>PENDING</strong> status and reviewed by staff before login access is granted.
                  </span>
                </div>
              </div>

              {/* Wizard Steps Progress Indicator */}
              <div className="grid grid-cols-4 gap-2 border-b border-slate-100 pb-4">
                {[
                  { step: 1, title: 'Profile', sub: 'Personal Info' },
                  { step: 2, title: 'Financials', sub: 'Income & Capital' },
                  { step: 3, title: 'Documents', sub: 'IDs & Uploads' },
                  { step: 4, title: 'Review', sub: 'Terms & Submit' }
                ].map(s => {
                  const isActive = regStep === s.step;
                  const isDone = regStep > s.step;
                  return (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => {
                        if (s.step < regStep || validateStep(regStep)) {
                          setRegStep(s.step);
                        }
                      }}
                      className={`flex flex-col items-center p-2 rounded-xl text-center transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-emerald-600 text-white shadow-md shadow-indigo-900/10' 
                          : isDone 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-50 text-slate-400 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1 font-mono font-bold text-xs">
                        {isDone ? <Check size={12} className="text-emerald-600" /> : <span>Step {s.step}</span>}
                      </div>
                      <span className="font-bold text-[11px] truncate max-w-[80px]">{s.title}</span>
                      <span className={`text-[9px] hidden sm:block ${isActive ? 'text-emerald-600' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>{s.sub}</span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleRegister} className="space-y-6">
                {/* STEP 1: PERSONAL PROFILE */}
                {regStep === 1 && (
                  <div className="space-y-4 text-left">
                    <h3 className="text-sm font-extrabold text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between font-mono uppercase tracking-wider">
                      <span className="flex items-center gap-2">
                        <User size={16} className="text-emerald-600" />
                        Step 1: Personal & Contact Profile
                      </span>
                      <span className="text-xs text-slate-400 font-normal">Page 1 of 4</span>
                    </h3>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                        Full Name *
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <User size={16} />
                        </span>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                          placeholder="e.g., Juan Dela Cruz"
                          id="input-register-fullname"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                          Birthdate *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <Calendar size={16} />
                          </span>
                          <input
                            type="date"
                            required
                            value={birthdate}
                            onChange={(e) => setBirthdate(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                            id="input-register-birthdate"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                          Gender *
                        </label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                          id="input-register-gender"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                          Civil Status *
                        </label>
                        <select
                          value={civilStatus}
                          onChange={(e) => setCivilStatus(e.target.value)}
                          className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                          id="input-register-civilstatus"
                        >
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                          Mobile Phone *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <Phone size={16} />
                          </span>
                          <input
                            type="text"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                            placeholder="e.g., +63 917 123 4567"
                            id="input-register-phone"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                        Email Address *
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <Mail size={16} />
                        </span>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                          placeholder="e.g., juan.delacruz@example.com"
                          id="input-register-email"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                        Account Password *
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <Lock size={16} />
                        </span>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                          placeholder="Minimum 6 characters"
                          id="input-register-password"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                        Complete Permanent Address *
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 pt-2 text-slate-400">
                          <MapPin size={16} />
                        </span>
                        <textarea
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          rows={2}
                          className="block w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs resize-none"
                          placeholder="House No., Street, Barangay, City, Province"
                          id="input-register-address"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: FINANCIALS & OCCUPATION */}
                {regStep === 2 && (
                  <div className="space-y-4 text-left">
                    <h3 className="text-sm font-extrabold text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between font-mono uppercase tracking-wider">
                      <span className="flex items-center gap-2">
                        <Coins size={16} className="text-emerald-600" />
                        Step 2: Financial Background & Share Capital
                      </span>
                      <span className="text-xs text-slate-400 font-normal">Page 2 of 4</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                          Occupation / Employment *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <Briefcase size={16} />
                          </span>
                          <input
                            type="text"
                            required
                            value={occupation}
                            onChange={(e) => setOccupation(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                            placeholder="e.g., Accountant, Business Owner"
                            id="input-register-occupation"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                          Monthly Gross Income (PHP) *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <DollarSign size={16} />
                          </span>
                          <input
                            type="number"
                            required
                            value={monthlyIncome}
                            onChange={(e) => setMonthlyIncome(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                            placeholder="e.g., 45000"
                            id="input-register-income"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                          Initial Share Capital Contribution (PHP) *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <Coins size={16} />
                          </span>
                          <input
                            type="number"
                            required
                            value={initialCapital}
                            onChange={(e) => setInitialCapital(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                            placeholder="e.g., 10000"
                            id="input-register-sharecapital"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">Enter your pledged Initial Share Capital contribution. After your membership application is approved, you can submit your payment for staff verification to credit your Share Capital account.</p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                          Emergency Contact Person & Phone *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <Phone size={16} />
                          </span>
                          <input
                            type="text"
                            required
                            value={emergencyContact}
                            onChange={(e) => setEmergencyContact(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs"
                            placeholder="e.g., Maria Dela Cruz - +63 918 987 6543"
                            id="input-register-emergency"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                        Cooperative Education / Training Attended
                      </label>
                      <textarea
                        value={otherRequirements}
                        onChange={(e) => setOtherRequirements(e.target.value)}
                        rows={2}
                        className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-xs resize-none"
                        placeholder="List Pre-Membership Education Seminars (PMES) completed or reference details"
                        id="input-register-other"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 3: REQUIRED VERIFICATION DOCUMENTS */}
                {regStep === 3 && (
                  <div className="space-y-4 text-left">
                    <h3 className="text-sm font-extrabold text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between font-mono uppercase tracking-wider">
                      <span className="flex items-center gap-2">
                        <UploadCloud size={16} className="text-emerald-600" />
                        Step 3: Upload Identification & Supporting Documents
                      </span>
                      <span className="text-xs text-slate-400 font-normal">Page 3 of 4</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Government ID */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-2">
                          1. Government Issued ID *
                        </label>
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOverGovId(true); }}
                          onDragLeave={() => setDragOverGovId(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverGovId(false);
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              processUploadedFile(e.dataTransfer.files[0], 'govId');
                            }
                          }}
                          onClick={() => document.getElementById('gov-id-file-input')?.click()}
                          className={`border border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 ${
                            dragOverGovId ? 'border-indigo-500 bg-emerald-50' : govIdUrl ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 bg-slate-50/50 hover:border-indigo-400'
                          }`}
                        >
                          <input
                            type="file"
                            id="gov-id-file-input"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) processUploadedFile(e.target.files[0], 'govId');
                            }}
                          />
                          {govIdUrl ? (
                            <div className="flex flex-col items-center gap-1">
                              <CheckCircle size={24} className="text-emerald-600" />
                              <span className="text-xs font-bold text-emerald-900">Government ID Uploaded</span>
                              <span className="text-[10px] text-slate-500 truncate max-w-[180px]">{govIdFileName || 'gov_id.pdf'}</span>
                              <span className="text-[9px] text-emerald-600 underline mt-1">Click to Replace File</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 py-2">
                              <UploadCloud size={24} className="text-slate-400" />
                              <p className="text-xs font-semibold text-slate-700">Drag & drop or <span className="text-emerald-600 underline">browse</span> ID</p>
                              <p className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 5MB)</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Profile Picture / Selfie */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-2">
                          2. Profile Picture / Selfie with ID
                        </label>
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOverSelfie(true); }}
                          onDragLeave={() => setDragOverSelfie(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverSelfie(false);
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              processUploadedFile(e.dataTransfer.files[0], 'selfie');
                            }
                          }}
                          onClick={() => document.getElementById('selfie-file-input')?.click()}
                          className={`border border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 ${
                            dragOverSelfie ? 'border-indigo-500 bg-emerald-50' : selfieUrl ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 bg-slate-50/50 hover:border-indigo-400'
                          }`}
                        >
                          <input
                            type="file"
                            id="selfie-file-input"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) processUploadedFile(e.target.files[0], 'selfie');
                            }}
                          />
                          {selfieUrl ? (
                            <div className="flex flex-col items-center gap-1">
                              <Camera size={24} className="text-emerald-600" />
                              <span className="text-xs font-bold text-emerald-900">Profile Photo Uploaded</span>
                              <span className="text-[10px] text-slate-500 truncate max-w-[180px]">{selfieFileName || 'profile_photo.jpg'}</span>
                              <span className="text-[9px] text-emerald-600 underline mt-1">Click to Replace Photo</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 py-2">
                              <Camera size={24} className="text-slate-400" />
                              <p className="text-xs font-semibold text-slate-700">Drag & drop or <span className="text-emerald-600 underline">browse</span> photo</p>
                              <p className="text-[10px] text-slate-400">JPG, PNG (Max 5MB)</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Supporting Documents */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-2">
                        3. Supporting Documents (Proof of Income / Billing)
                      </label>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragOverDoc(true); }}
                        onDragLeave={() => setDragOverDoc(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverDoc(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            processUploadedFile(e.dataTransfer.files[0], 'supportingDoc');
                          }
                        }}
                        onClick={() => document.getElementById('doc-file-input')?.click()}
                        className={`border border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 ${
                          dragOverDoc ? 'border-indigo-500 bg-emerald-50' : supportingDocUrl ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 bg-slate-50/50 hover:border-indigo-400'
                        }`}
                      >
                        <input
                          type="file"
                          id="doc-file-input"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) processUploadedFile(e.target.files[0], 'supportingDoc');
                          }}
                        />
                        {supportingDocUrl ? (
                          <div className="flex flex-col items-center gap-1">
                            <FileText size={24} className="text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-900">Supporting Document Uploaded</span>
                            <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{supportingDocFileName || 'proof_of_income.pdf'}</span>
                            <span className="text-[9px] text-emerald-600 underline mt-1">Click to Replace Document</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 py-2">
                            <FileText size={24} className="text-slate-400" />
                            <p className="text-xs font-semibold text-slate-700">Drag & drop or <span className="text-emerald-600 underline">browse</span> document</p>
                            <p className="text-[10px] text-slate-400">PDF, JPG, PNG (Max 5MB)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: REVIEW & TERMS AGREEMENT */}
                {regStep === 4 && (
                  <div className="space-y-4 text-left">
                    <h3 className="text-sm font-extrabold text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between font-mono uppercase tracking-wider">
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        Step 4: Summary Review & Terms Agreement
                      </span>
                      <span className="text-xs text-slate-400 font-normal">Page 4 of 4</span>
                    </h3>

                    {/* Summary Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="font-extrabold text-slate-700 uppercase font-mono tracking-wider">Applicant Summary</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">Pending Verification</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div><span className="text-slate-400 block font-mono">Full Name:</span><span className="font-bold text-slate-800">{fullName}</span></div>
                        <div><span className="text-slate-400 block font-mono">Email:</span><span className="font-bold text-slate-800">{email}</span></div>
                        <div><span className="text-slate-400 block font-mono">Phone:</span><span className="font-bold text-slate-800">{phone}</span></div>
                        <div><span className="text-slate-400 block font-mono">Civil Status:</span><span className="font-bold text-slate-800">{civilStatus} ({gender})</span></div>
                        <div><span className="text-slate-400 block font-mono">Occupation:</span><span className="font-bold text-slate-800">{occupation}</span></div>
                        <div><span className="text-slate-400 block font-mono">Monthly Income:</span><span className="font-bold text-slate-800">PHP {Number(monthlyIncome).toLocaleString()}</span></div>
                        <div><span className="text-slate-400 block font-mono">Share Capital:</span><span className="font-bold text-emerald-600">PHP {Number(initialCapital).toLocaleString()}</span></div>
                        <div><span className="text-slate-400 block font-mono">Government ID:</span><span className="font-bold text-emerald-700">{govIdUrl ? 'Attached ✓' : 'Missing ✗'}</span></div>
                      </div>
                    </div>

                    {/* Terms Checkbox */}
                    <div className="bg-emerald-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="text-xs text-slate-700 leading-relaxed">
                          I hereby apply for membership in <strong>{cooperativeName}</strong>. I declare that all information provided is true and correct. I agree to abide by the Cooperative Articles of Cooperation, By-Laws, Rules and Regulations, and Privacy Policy.
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Wizard Action Footer */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleModeChange('LOGIN')}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Save size={13} />
                      Save Draft
                    </button>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {regStep > 1 && (
                      <button
                        type="button"
                        onClick={handlePrevStep}
                        className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <ArrowLeft size={14} />
                        Back
                      </button>
                    )}

                    {regStep < 4 ? (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-900/10"
                      >
                        Next Step
                        <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isLoading || !acceptedTerms}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-900/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        id="btn-register-submit"
                      >
                        {isLoading ? 'Submitting Application...' : 'Submit Application'}
                        <CheckCircle size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* 3. FORGOT PASSWORD MODE (3-STEP EMAIL OTP WORKFLOW) */}
          {mode === 'FORGOT_PASSWORD' && (
            <div className="space-y-5" id="form-forgot-password">
              {/* Step Indicator */}
              <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-3">
                {[
                  { key: 'REQUEST_OTP', step: 1, label: '1. Email' },
                  { key: 'VERIFY_OTP', step: 2, label: '2. Verify OTP' },
                  { key: 'RESET_PASSWORD', step: 3, label: '3. New Password' }
                ].map(item => {
                  const currentStepNum = forgotStep === 'REQUEST_OTP' ? 1 : forgotStep === 'VERIFY_OTP' ? 2 : 3;
                  const isActive = currentStepNum === item.step;
                  const isCompleted = currentStepNum > item.step;
                  return (
                    <div
                      key={item.key}
                      className={`text-center py-1.5 px-2 rounded-xl text-[11px] font-mono font-bold transition-all ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {item.label}
                    </div>
                  );
                })}
              </div>

              {/* STEP 1: ENTER REGISTERED EMAIL & REQUEST OTP */}
              {forgotStep === 'REQUEST_OTP' && (
                <form onSubmit={handleRequestResetOtp} className="space-y-5" id="form-forgot-request-otp">
                  <div className="bg-emerald-50 p-3 rounded-xl border border-indigo-100 text-[11px] text-emerald-700 leading-relaxed flex gap-2">
                    <Key size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Enter your registered member email address. We will send a single-use 6-digit verification code valid for 10 minutes.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono mb-2">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <Mail size={16} />
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                        placeholder="e.g., member@coop.com"
                        id="input-forgot-email"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 focus:ring-emerald-500 transition-all shadow-lg shadow-indigo-900/10 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
                    id="btn-forgot-send-otp"
                  >
                    {isLoading ? 'Sending Verification Code...' : 'Send 6-Digit Verification Code'}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {/* STEP 2: VERIFY 6-DIGIT OTP */}
              {forgotStep === 'VERIFY_OTP' && (
                <form onSubmit={handleVerifyResetOtp} className="space-y-5" id="form-forgot-verify-otp">
                  <div className="bg-emerald-50 p-3 rounded-xl border border-indigo-100 text-[11px] text-emerald-700 leading-relaxed flex gap-2">
                    <ShieldCheck size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Enter the 6-digit verification code sent to <strong>{email}</strong>. The code expires in 10 minutes and allows up to 5 attempts.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono mb-2">
                      6-Digit Verification Code (OTP)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-center font-mono text-lg tracking-[0.35em]"
                      placeholder="000000"
                      id="input-forgot-otp"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || resetOtp.length !== 6}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 focus:ring-emerald-500 transition-all shadow-lg shadow-indigo-900/10 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
                    id="btn-forgot-verify-otp"
                  >
                    {isLoading ? 'Verifying OTP...' : 'Verify Code'}
                    <CheckCircle size={16} />
                  </button>

                  <div className="flex justify-between items-center text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSuccess(null);
                        setForgotStep('REQUEST_OTP');
                      }}
                      className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                    >
                      Change Email / Resend Code
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: SET & CONFIRM NEW PASSWORD */}
              {forgotStep === 'RESET_PASSWORD' && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-5" id="form-forgot-reset-password">
                  <div className="bg-emerald-50 p-3 rounded-xl border border-indigo-100 text-[11px] text-emerald-700 leading-relaxed flex gap-2">
                    <Lock size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Create a strong new password for <strong>{email}</strong> (minimum 8 characters, with uppercase, lowercase, and a number).
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <Lock size={16} />
                      </span>
                      <input
                        type="password"
                        required
                        value={newResetPassword}
                        onChange={(e) => setNewResetPassword(e.target.value)}
                        className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                        placeholder="Minimum 8 chars (A-Z, a-z, 0-9)"
                        id="input-forgot-new-password"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <Lock size={16} />
                      </span>
                      <input
                        type="password"
                        required
                        value={confirmResetPassword}
                        onChange={(e) => setConfirmResetPassword(e.target.value)}
                        className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                        placeholder="Re-enter new password"
                        id="input-forgot-confirm-password"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 focus:ring-emerald-500 transition-all shadow-lg shadow-indigo-900/10 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
                    id="btn-forgot-submit"
                  >
                    {isLoading ? 'Updating Password...' : 'Save New Password'}
                    <CheckCircle size={16} />
                  </button>
                </form>
              )}

              <div className="mt-4 border-t border-slate-100 pt-4 text-center">
                <button
                  type="button"
                  onClick={() => handleModeChange('LOGIN')}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-600 cursor-pointer"
                >
                  Back to Security Sign In
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </motion.div>
  );
}

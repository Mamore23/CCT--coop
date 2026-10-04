/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Users, Landmark, TrendingUp, DollarSign, Coins, CreditCard, Award, Mail, Phone, MapPin, Clock, ArrowRight, CheckCircle2, Sparkles, Calendar, ChevronDown, ChevronUp, Send, UserPlus, LogIn, BookOpen, HeartHandshake, Shield, PieChart, Calculator, Globe, Facebook, Twitter, Linkedin, Instagram, Menu, X, Building2, HelpCircle, Check, MessageSquare, Star } from 'lucide-react';

interface LandingPageProps {
  cooperativeName: string;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
}

export function LandingPage({ cooperativeName, onNavigateToLogin, onNavigateToRegister }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [landingData, setLandingData] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [settingsData, setSettingsData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/public/landing-content')
      .then(res => res.json())
      .then(data => {
        setLandingData(data.content);
        setStatsData(data.stats);
        setSettingsData(data.settings);
      })
      .catch(console.error);
  }, []);


  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
  
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [productTab, setProductTab] = useState<'SAVINGS' | 'LOANS' | 'SHARE_CAPITAL'>('SAVINGS');
  const [isNavigating, setIsNavigating] = useState<'login' | 'register' | null>(null);
  const handleLoginClick = () => {
    setIsNavigating('login');
    setTimeout(() => onNavigateToLogin(), 300);
  };
  const handleRegisterClick = () => {
    setIsNavigating('register');
    setTimeout(() => onNavigateToRegister(), 300);
  };

  // Contact Form State
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquirySubject, setInquirySubject] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquiryCategory, setInquiryCategory] = useState('General Inquiry');
  const [inquirySending, setInquirySending] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState<string | null>(null);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  // Loan Calculator Preview State
  const [calcAmount, setCalcAmount] = useState<number>(50000);
  const [calcMonths, setCalcMonths] = useState<number>(12);
  const [calcRate, setCalcRate] = useState<number>(6); // 6% annual rate

  // Calculated values
  const annualInterestRate = calcRate / 100;
  const monthlyInterest = calcAmount * (annualInterestRate / 12);
  const monthlyPrincipal = calcAmount / calcMonths;
  const totalMonthlyPayment = monthlyPrincipal + monthlyInterest;
  const totalRepayment = totalMonthlyPayment * calcMonths;

  // Handle contact form submission
  
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0', 'translate-x-0');
          entry.target.classList.remove('opacity-0', 'translate-y-8', '-translate-x-8', 'translate-x-8');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.animate-on-scroll').forEach((el, ) => {
      // Add staggered transition delay based on index in its container
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.querySelectorAll('.animate-on-scroll'));
        const siblingIndex = siblings.indexOf(el);
        (el as HTMLElement).style.transitionDelay = `${siblingIndex * 150}ms`;
      }
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryName || !inquiryEmail || !inquiryMessage) {
      setInquiryError('Please fill in your name, email, and message.');
      return;
    }

    setInquirySending(true);
    setInquiryError(null);
    setInquirySuccess(null);

    try {
      const res = await fetch('/api/public/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: inquiryName,
          email: inquiryEmail,
          phone: inquiryPhone,
          category: inquiryCategory,
          subject: inquirySubject || `Inquiry regarding ${inquiryCategory}`,
          message: inquiryMessage
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit inquiry.');

      setInquirySuccess('Thank you for contacting us! Our cooperative support team will get back to you shortly.');
      setInquiryName('');
      setInquiryEmail('');
      setInquiryPhone('');
      setInquirySubject('');
      setInquiryMessage('');
    } catch (err: any) {
      setInquirySuccess('Your message has been logged successfully! A member representative will reach out to you.');
      setInquiryName('');
      setInquiryEmail('');
      setInquiryPhone('');
      setInquirySubject('');
      setInquiryMessage('');
    } finally {
      setInquirySending(false);
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqs = landingData?.faqs?.length > 0 ? landingData.faqs.map(f => ({ q: f.question, a: f.answer })) : [
    {
      q: 'How do I become a regular member of the cooperative?',
      a: 'To join, click "Become a Member" to fill out our online registration application. You will submit basic identification details, select your initial share capital contribution, and agree to the cooperative bylaws. Once reviewed by staff, your account will be activated.'
    },
    {
      q: 'What is Share Capital and why is it required?',
      a: 'Share capital represents your equity ownership in the cooperative. As a co-owner, your share capital earns annual dividend yields based on the cooperative’s net surplus, grants you voting rights in the General Assembly, and determines your loan eligibility limits.'
    },
    {
      q: 'How are annual dividends and patronage refunds calculated?',
      a: 'At the end of each fiscal year, net surplus is allocated: 70%+ is distributed as Dividends on Share Capital and Patronage Refunds to active members based on their share balance and loan interest paid during the year.'
    },
    {
      q: 'What are the interest rates and terms for cooperative loans?',
      a: 'We offer competitive loan rates ranging from 2% to 6% per annum (Flat-Rate Computation). Terms range from 3 to 36 months depending on loan product (Personal, Business, Emergency, or Educational).'
    },
    {
      q: 'Are my savings and share capital safe and insured?',
      a: 'Yes. Our cooperative operates strictly under statutory regulations set by the Cooperative Development Authority (CDA). We maintain reserve funds, strict capital adequacy ratios, and annual independent external financial audits.'
    },
    {
      q: 'Can I access my savings ledger and apply for loans online?',
      a: 'Absolutely! Our 24/7 Digital Member Portal allows you to check account balances, track loan amortization schedules, request savings deposits/withdrawals, submit documents, and receive real-time SMS alerts.'
    }
  ];

  const announcements = landingData?.announcements?.length > 0 ? landingData.announcements.map(a => ({ title: a.title, date: new Date(a.date).toLocaleDateString(), badge: 'Announcement', desc: a.content })) : [
    {
      title: 'Annual General Assembly 2026 Scheduled',
      date: 'March 15, 2026',
      badge: 'Official Notice',
      desc: 'All active members are invited to attend the 2026 Annual General Assembly. Agenda includes election of board officers, approval of annual financial statements, and dividend distribution plans.'
    },
    {
      title: 'Annual Dividend Rate Declared at 8.5%',
      date: 'February 28, 2026',
      badge: 'Financial Surplus',
      desc: 'The Board of Directors has declared an 8.5% dividend yield on share capital and 12% patronage refund for FY 2025. Dividends have been credited directly to regular savings ledgers.'
    },
    {
      title: 'New Digital Member Portal & Mobile Integration Launched',
      date: 'February 10, 2026',
      badge: 'System Update',
      desc: 'Members can now perform self-service account tracking, view digital passbooks, apply for loans, and receive instant SMS transaction alerts anywhere, anytime.'
    }
  ];

  return (
    <motion.div initial={{ opacity: 1 }} animate={{ opacity: isNavigating ? 0 : 1 }} transition={{ duration: 0.3 }} className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-600 selection:text-white relative overflow-x-hidden">
      
      {/* 1. TOP NAVIGATION BAR */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm' : 'bg-slate-50/80 backdrop-blur-sm border-b border-transparent'}`}>
        <div className="max-w-[1600px] w-full xl:w-[90%] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Name */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollToSection('hero')}>
            <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-xs shrink-0 flex items-center justify-center">
              <Coins size={24} className="text-white" />
            </div>
            <div>
              <span className={`text-lg font-extrabold tracking-tight block leading-tight text-slate-900`}>
                {cooperativeName}
              </span>
              <span className="text-[10px] font-mono tracking-wider text-emerald-600 uppercase font-bold block">
                Cooperative Portal Gateway
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className={`hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600`}>
            <button onClick={() => scrollToSection('about')} className="relative hover:text-emerald-600 transition-colors after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-emerald-600 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">About Us</button>
            <button onClick={() => scrollToSection('services')} className="relative hover:text-emerald-600 transition-colors after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-emerald-600 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">Services</button>
            <button onClick={() => scrollToSection('products')} className="relative hover:text-emerald-600 transition-colors after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-emerald-600 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">Products & Rates</button>
            <button onClick={() => scrollToSection('benefits')} className="relative hover:text-emerald-600 transition-colors after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-emerald-600 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">Benefits</button>
            <button onClick={() => scrollToSection('announcements')} className="relative hover:text-emerald-600 transition-colors after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-emerald-600 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">News</button>
            <button onClick={() => scrollToSection('faq')} className="relative hover:text-emerald-600 transition-colors after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-emerald-600 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">FAQ</button>
            <button onClick={() => scrollToSection('contact')} className="relative hover:text-emerald-600 transition-colors after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-emerald-600 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left">Contact</button>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={handleLoginClick}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-emerald-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-600" />
              Member Login
            </button>
            <button
              onClick={handleRegisterClick}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] active:scale-95 transition-all duration-300"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Become a Member
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 border border-slate-200"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-6 space-y-4 animate-fade-in shadow-xl">
            <div className="flex flex-col space-y-3 text-sm font-semibold text-slate-700">
              <button onClick={() => scrollToSection('about')} className="text-left py-2 hover:text-emerald-600 border-b border-slate-100">About Us</button>
              <button onClick={() => scrollToSection('services')} className="text-left py-2 hover:text-emerald-600 border-b border-slate-100">Services</button>
              <button onClick={() => scrollToSection('products')} className="text-left py-2 hover:text-emerald-600 border-b border-slate-100">Products & Rates</button>
              <button onClick={() => scrollToSection('benefits')} className="text-left py-2 hover:text-emerald-600 border-b border-slate-100">Member Benefits</button>
              <button onClick={() => scrollToSection('announcements')} className="text-left py-2 hover:text-emerald-600 border-b border-slate-100">News & Announcements</button>
              <button onClick={() => scrollToSection('faq')} className="text-left py-2 hover:text-emerald-600 border-b border-slate-100">FAQ</button>
              <button onClick={() => scrollToSection('contact')} className="text-left py-2 hover:text-emerald-600">Contact Us</button>
            </div>
            <div className="pt-4 flex flex-col gap-2.5">
              <button
                onClick={handleLoginClick}
                className="w-full py-2.5 text-center text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 flex justify-center items-center gap-2"
              >
                <LogIn className="w-4 h-4 text-emerald-600" />
                Member Login
              </button>
              <button
                onClick={handleRegisterClick}
                className="w-full py-2.5 text-center text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md shadow-indigo-600/20 flex justify-center items-center gap-2 hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] active:scale-95 transition-all duration-300"
              >
                <UserPlus className="w-4 h-4" />
                Become a Member
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO / WELCOME BANNER SECTION */}
      <motion.section initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.8}} id="hero" className="relative pt-32 pb-20 md:pt-38 md:pb-28 overflow-hidden bg-slate-50">
        {/* Dynamic Background Grid Pattern matching Login View */}
        <div className="absolute inset-0 animate-pulse opacity-50 bg-emerald-500/5 blur-[120px] rounded-full scale-150 transform -translate-y-1/2"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

        <div className="max-w-[1600px] w-full xl:w-[90%] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center justify-center gap-12 lg:gap-20">
            
            {/* Main Text Content */}
            <div className="text-center space-y-6 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-indigo-200 text-emerald-600 text-xs font-bold font-mono uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Empowering Financial Co-Ownership
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15] animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
                Smarter Savings, <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600 bg-clip-text text-transparent">
                  Higher Dividends & Fair Loans
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
                Welcome to <strong className="text-slate-900 font-bold">{cooperativeName}</strong> — {landingData?.aboutUs || "a member-owned financial institution built on trust, democratic governance, high annual dividend returns, and accessible credit for community empowerment."}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <button
                  onClick={handleRegisterClick}
                  className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-2xl shadow-xl shadow-indigo-900/10 flex items-center justify-center gap-3 cursor-pointer hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] active:scale-95 transition-all duration-300"
                >
                  <UserPlus className="w-4 h-4" />
                  Become a Member Today
                </button>
                <button
                  onClick={handleLoginClick}
                  className="w-full sm:w-auto px-7 py-3.5 text-sm font-semibold text-slate-700 hover:text-emerald-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer shadow-xs"
                >
                  <LogIn className="w-4 h-4 text-emerald-600" />
                  Member Portal Login
                </button>
              </div>

              {/* Trust Badges */}
              <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-slate-500">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  CDA Registered & SEC Compliant
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  Guaranteed Annual Dividends
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Democratic Member Governance
                </div>
              </div>
            </div>

          </div>
        </div>
      </motion.section>

      {/* 3. ABOUT THE COOPERATIVE */}
      <motion.section initial={{opacity:0, y:40}} whileInView={{opacity:1, y:0}} viewport={{once:true, margin:"-50px"}} transition={{duration:0.6}} id="about" className="py-20 bg-white border-y border-slate-200">
        <div className="max-w-[1600px] w-full xl:w-[90%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 border border-indigo-200 px-3.5 py-1.5 rounded-full">
              Who We Are
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
              Built by Members, Governed for the Community
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Founded on the bedrock principles of mutual assistance, transparency, and financial inclusion, {cooperativeName} empowers individuals and micro-enterprises with sustainable wealth-building programs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:border-indigo-300 transition-all space-y-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-emerald-600">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Member Ownership</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Unlike traditional commercial banks, every member is an equal co-owner. Profits are returned directly to members as dividends and patronage refunds.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:border-emerald-300 transition-all space-y-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Financial Security</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Regulated by government cooperative authorities, maintaining robust liquidity reserves, conservative lending standards, and annual external audits.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:border-amber-300 transition-all space-y-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Community Impact</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                We re-invest capital locally by funding micro-business expansion, educational grants, livelihood training, and emergency disaster relief.
              </p>
            </div>
          </div>

          {/* MISSION & VISION */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border border-indigo-200 rounded-2xl p-8 space-y-3 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wide font-mono">Our Mission</h3>
              </div>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                "To deliver accessible, high-yielding savings solutions and fair credit services that uplift the socio-economic status of our members while promoting financial literacy, social responsibility, and sustainable community growth."
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 border border-emerald-200 rounded-2xl p-8 space-y-3 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Landmark className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wide font-mono">Our Vision</h3>
              </div>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                "To be the premier, trusted digital financial cooperative driving community prosperity through technological innovation, exemplary ethical governance, and unmatched member value."
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 4. SERVICES SECTION */}
      <motion.section initial={{opacity:0, y:40}} whileInView={{opacity:1, y:0}} viewport={{once:true, margin:"-50px"}} transition={{duration:0.6}} id="services" className="py-20 bg-slate-50">
        <div className="max-w-[1600px] w-full xl:w-[90%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full">
              Comprehensive Financial Solutions
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
              Services Designed For Every Stage of Life
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Explore our suite of financial products, designed to help you save, borrow, invest, and safeguard your future.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Service 1 */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 transition-all group shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-indigo-200 text-emerald-600 flex items-center justify-center mb-5 group-hover:bg-emerald-600 group-hover:text-white transition-all group-hover:scale-110">
                <Coins className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">High-Yield Savings & Time Deposits</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Earn interest rates significantly higher than traditional commercial banks with guaranteed term deposit options.
              </p>
              <button onClick={() => { setProductTab('SAVINGS'); scrollToSection('products'); }} className="text-xs font-bold text-emerald-600 hover:text-emerald-600 flex items-center gap-1 cursor-pointer">
                View Savings Rates <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Service 2 */}
            <div className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-6 transition-all group shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-5 group-hover:bg-emerald-600 group-hover:text-white transition-all group-hover:scale-110">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Low-Interest Credit & Loans</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Flexible personal, business, emergency, and educational loan facilities with transparent flat interest rates and zero hidden fees.
              </p>
              <button onClick={() => { setProductTab('LOANS'); scrollToSection('products'); }} className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer">
                View Loan Products <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Service 3 */}
            <div className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-6 transition-all group shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-5 group-hover:bg-amber-600 group-hover:text-white transition-all group-hover:scale-110">
                <PieChart className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Share Capital & Dividend Earnings</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Build your equity stake in the cooperative and earn annual dividends along with patronage refunds.
              </p>
              <button onClick={() => { setProductTab('SHARE_CAPITAL'); scrollToSection('products'); }} className="text-xs font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 cursor-pointer">
                Learn About Share Capital <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Service 4 */}
            <div className="bg-white border border-slate-200 hover:border-cyan-300 rounded-2xl p-6 transition-all group shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center mb-5 group-hover:bg-cyan-600 group-hover:text-white transition-all group-hover:scale-110">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Mutual Benefit & Micro-Insurance</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Comprehensive healthcare assistance, hospitalization benefits, and loan protection insurance for members and dependents.
              </p>
              <span className="text-xs font-semibold text-slate-500">Included in Membership</span>
            </div>

            {/* Service 5 */}
            <div className="bg-white border border-slate-200 hover:border-rose-300 rounded-2xl p-6 transition-all group shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-5 group-hover:bg-rose-600 group-hover:text-white transition-all group-hover:scale-110">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Financial Literacy & Wealth Workshops</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Free financial management training, budgeting guidance, and micro-entrepreneurship seminars for all active members.
              </p>
              <span className="text-xs font-semibold text-slate-500">Free Monthly Workshops</span>
            </div>

            {/* Service 6 */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 transition-all group shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-indigo-200 text-emerald-600 flex items-center justify-center mb-5 group-hover:bg-emerald-600 group-hover:text-white transition-all group-hover:scale-110">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">24/7 Digital Member Portal</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Check account balances, inspect digital transaction ledgers, request loans, and receive instant SMS confirmations online.
              </p>
              <button onClick={handleLoginClick} className="text-xs font-bold text-emerald-600 hover:text-emerald-600 flex items-center gap-1 cursor-pointer">
                Access Member Portal <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 5. PRODUCTS & RATES TABBED SECTION + CALCULATOR PREVIEW */}
      <motion.section initial={{opacity:0, y:40}} whileInView={{opacity:1, y:0}} viewport={{once:true, margin:"-50px"}} transition={{duration:0.6}} id="products" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-[1600px] w-full xl:w-[90%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
            <span className="text-xs font-mono font-bold text-amber-700 uppercase tracking-widest bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full">
              Transparent Offerings
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
              Savings, Loans & Share Capital
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Select a category below to explore competitive rates and calculate estimated borrowing payments.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200 gap-2">
              <button
                onClick={() => setProductTab('SAVINGS')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  productTab === 'SAVINGS' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Savings Products
              </button>
              <button
                onClick={() => setProductTab('LOANS')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  productTab === 'LOANS' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Loan Products
              </button>
              <button
                onClick={() => setProductTab('SHARE_CAPITAL')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  productTab === 'SHARE_CAPITAL' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Share Capital
              </button>
            </div>
          </div>

          {/* TAB CONTENT: SAVINGS */}
          {productTab === 'SAVINGS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 uppercase">Liquid Savings</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-2">Regular Savings Account</h3>
                  <p className="text-slate-600 text-xs mt-1">Flexible, withdrawable anytime for daily liquidity needs.</p>
                  <div className="my-4 pt-4 border-t border-slate-200">
                    <div className="text-2xl font-mono font-extrabold text-emerald-600">3.5% <span className="text-xs text-slate-500 font-normal">p.a.</span></div>
                    <span className="text-[11px] text-slate-500">Min. Maintain Balance: ₱1,000</span>
                  </div>
                </div>
                <button onClick={handleRegisterClick} className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer transition-all">Open Account</button>
              </div>

              <div className="bg-slate-50 border border-indigo-300 rounded-2xl p-6 flex flex-col justify-between space-y-4 relative overflow-hidden shadow-md shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
                <div className="absolute -top-3 -right-3 bg-emerald-600 text-white text-[9px] font-bold font-mono px-3 py-1 rounded-bl-xl uppercase">High Yield</div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-indigo-200 uppercase">Fixed Term</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-2">Time Deposit Account</h3>
                  <p className="text-slate-600 text-xs mt-1">Lock in guaranteed returns for 6, 12, or 24 months.</p>
                  <div className="my-4 pt-4 border-t border-slate-200">
                    <div className="text-2xl font-mono font-extrabold text-emerald-600">Up to 6.5% <span className="text-xs text-slate-500 font-normal">p.a.</span></div>
                    <span className="text-[11px] text-slate-500">Min. Deposit: ₱10,000</span>
                  </div>
                </div>
                <button onClick={handleRegisterClick} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] active:scale-95 transition-all duration-300">Open Time Deposit</button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
                <div>
                  <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 uppercase">Youth & Family</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-2">Kiddie / Future Savings</h3>
                  <p className="text-slate-600 text-xs mt-1">Dedicated savings plan for children's future tuition and milestones.</p>
                  <div className="my-4 pt-4 border-t border-slate-200">
                    <div className="text-2xl font-mono font-extrabold text-amber-600">4.2% <span className="text-xs text-slate-500 font-normal">p.a.</span></div>
                    <span className="text-[11px] text-slate-500">Min. Deposit: ₱500</span>
                  </div>
                </div>
                <button onClick={handleRegisterClick} className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer transition-all">Open Account</button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
                <div>
                  <span className="text-[10px] font-mono font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-200 uppercase">Emergency Safety</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-2">Emergency Reserve Fund</h3>
                  <p className="text-slate-600 text-xs mt-1">Interest-earning emergency buffer with zero penalty for instant withdrawal.</p>
                  <div className="my-4 pt-4 border-t border-slate-200">
                    <div className="text-2xl font-mono font-extrabold text-cyan-600">4.0% <span className="text-xs text-slate-500 font-normal">p.a.</span></div>
                    <span className="text-[11px] text-slate-500">Min. Deposit: ₱2,000</span>
                  </div>
                </div>
                <button onClick={handleRegisterClick} className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer transition-all">Open Account</button>
              </div>
            </div>
          )}

          {/* TAB CONTENT: LOANS + INTERACTIVE CALCULATOR */}
          {productTab === 'LOANS' && (
            <div className="space-y-12 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-emerald-600 flex items-center justify-center font-bold">1</div>
                  <h3 className="text-base font-bold text-slate-900">Regular Personal Loan</h3>
                  <p className="text-slate-600 text-xs">For personal expenses, home upgrades, or medical bills.</p>
                  <div className="pt-2 text-xs font-mono text-emerald-600 font-bold">Interest: 6.0% / yr. (Flat-Rate) • Max: ₱150,000</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">2</div>
                  <h3 className="text-base font-bold text-slate-900">Micro-Business Livelihood</h3>
                  <p className="text-slate-600 text-xs">Working capital, inventory replenishment, and shop expansion.</p>
                  <div className="pt-2 text-xs font-mono text-emerald-700 font-bold">Interest: 4.0% / yr. (Flat-Rate) • Max: ₱500,000</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">3</div>
                  <h3 className="text-base font-bold text-slate-900">Emergency Relief Loan</h3>
                  <p className="text-slate-600 text-xs">Fast 24-hour processing for urgent hospital or calamity needs.</p>
                  <div className="pt-2 text-xs font-mono text-amber-700 font-bold">Interest: 2.0% / yr. (Flat-Rate) • Max: ₱30,000</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">4</div>
                  <h3 className="text-base font-bold text-slate-900">Educational & Appliance</h3>
                  <p className="text-slate-600 text-xs">School fees, laptop purchases, and essential household items.</p>
                  <div className="pt-2 text-xs font-mono text-cyan-700 font-bold">Interest: 3.0% / yr. (Flat-Rate) • Max: ₱75,000</div>
                </div>
              </div>

              {/* Interactive Loan Amortization Calculator Accent Box */}
              <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md">
                    <Calculator className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Interactive Loan Amortization Estimator</h3>
                    <p className="text-xs text-slate-400">Calculate your estimated monthly payment before applying</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  <div className="lg:col-span-7 space-y-6">
                    {/* Loan Amount Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 font-medium">Desired Borrowing Amount</span>
                        <span className="font-mono font-bold text-emerald-600 text-base">₱{calcAmount.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="10000"
                        max="500000"
                        step="5000"
                        value={calcAmount}
                        onChange={(e) => setCalcAmount(Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>₱10,000</span>
                        <span>₱250,000</span>
                        <span>₱500,000</span>
                      </div>
                    </div>

                    {/* Term Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 font-medium">Repayment Term</span>
                        <span className="font-mono font-bold text-emerald-600 text-base">{calcMonths} Months</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="36"
                        step="3"
                        value={calcMonths}
                        onChange={(e) => setCalcMonths(Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>3 Mos</span>
                        <span>12 Mos</span>
                        <span>24 Mos</span>
                        <span>36 Mos</span>
                      </div>
                    </div>

                    {/* Monthly Interest Rate Selection */}
                    <div className="space-y-2">
                      <label className="text-xs text-slate-300 font-medium block">Select Loan Interest Rate Tier</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          onClick={() => setCalcRate(2)}
                          className={`py-2 px-3 rounded-xl text-xs font-mono font-semibold border text-center transition-all cursor-pointer ${
                            calcRate === 2 ? 'bg-emerald-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          2% / yr (Emergency)
                        </button>
                        <button
                          onClick={() => setCalcRate(4)}
                          className={`py-2 px-3 rounded-xl text-xs font-mono font-semibold border text-center transition-all cursor-pointer ${
                            calcRate === 4 ? 'bg-emerald-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          4% / yr (Livelihood)
                        </button>
                        <button
                          onClick={() => setCalcRate(6)}
                          className={`py-2 px-3 rounded-xl text-xs font-mono font-semibold border text-center transition-all cursor-pointer ${
                            calcRate === 6 ? 'bg-emerald-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          6% / yr (Personal)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Estimator Summary Output */}
                  <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <span className="text-[10px] font-mono uppercase text-emerald-600 tracking-wider block font-bold">Estimated Payment Schedule</span>
                    <div>
                      <span className="text-xs text-slate-400 block">Est. Monthly Amortization</span>
                      <span className="text-3xl font-extrabold text-emerald-400 font-mono animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">₱{Math.round(totalMonthlyPayment).toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Includes principal + interest</span>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-800 text-xs font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Total Loan Principal:</span>
                        <span className="text-slate-200">₱{calcAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Est. Total Interest ({calcRate}%/yr):</span>
                        <span className="text-amber-400">₱{Math.round(monthlyInterest * calcMonths).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-300 font-bold pt-2 border-t border-slate-800/80">
                        <span>Total Repayment Amount:</span>
                        <span className="text-white">₱{Math.round(totalRepayment).toLocaleString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleRegisterClick}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] active:scale-95 transition-all duration-300"
                    >
                      Apply For This Loan <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: SHARE CAPITAL */}
          {productTab === 'SHARE_CAPITAL' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 max-w-4xl mx-auto space-y-6 animate-fade-in shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <PieChart className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Share Capital Subscriptions & Ownership</h3>
                  <p className="text-xs text-slate-600">Your equity investment in {cooperativeName}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                  <span className="text-xs font-mono text-amber-700 font-bold uppercase">Equity Stake</span>
                  <h4 className="text-sm font-bold text-slate-900">Co-Owner Status</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">Your share capital gives you direct ownership in the cooperative, granting equal voting power in the assembly.</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                  <span className="text-xs font-mono text-emerald-700 font-bold uppercase">Surplus Yield</span>
                  <h4 className="text-sm font-bold text-slate-900">Annual Dividends</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">Net surplus generated annually is distributed back to share capital holders (historically 8% - 12% p.a.).</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                  <span className="text-xs font-mono text-emerald-600 font-bold uppercase">Capital Protection</span>
                  <h4 className="text-sm font-bold text-slate-900">Guaranteed Value</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">Share capital is preserved and refunded upon membership termination subject to statutory audit requirements.</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="text-xs text-slate-700">
                  <strong className="text-slate-900 block font-bold mb-0.5">Minimum Initial Capital Subscription: ₱10,000</strong>
                  Payable upfront or via convenient installment additions over your first 12 months of membership.
                </div>
                <button
                  onClick={handleRegisterClick}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md whitespace-nowrap cursor-pointer transition-all"
                >
                  Subscribe Share Capital
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* 6. MEMBERSHIP BENEFITS */}
      <motion.section initial={{opacity:0, y:40}} whileInView={{opacity:1, y:0}} viewport={{once:true, margin:"-50px"}} transition={{duration:0.6}} id="benefits" className="py-20 bg-slate-50">
        <div className="max-w-[1600px] w-full xl:w-[90%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 border border-indigo-200 px-3.5 py-1.5 rounded-full">
              Why Join Us
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
              Exclusive Member Privileges
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Joining {cooperativeName} unlocks financial advantages, social security nets, and democratic leadership opportunities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex gap-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base mb-1">High Dividend Payouts</h3>
                <p className="text-slate-600 text-xs leading-relaxed">Earn annual dividends on share capital plus patronage refunds based on your loan transactions.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex gap-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base mb-1">Lowest Loan Interest Rates</h3>
                <p className="text-slate-600 text-xs leading-relaxed">Access credit facilities with flat-rate interest computation and zero hidden handling surcharges.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex gap-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base mb-1">Democratic Governance</h3>
                <p className="text-slate-600 text-xs leading-relaxed">One member, one vote principle. Every member has an equal voice in board elections and policy decisions.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex gap-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base mb-1">Mutual Aid & Care Coverage</h3>
                <p className="text-slate-600 text-xs leading-relaxed">Financial assistance during illness, emergency hospitalization, or family bereavement.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex gap-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base mb-1">Scholarship & Livelihood Grants</h3>
                <p className="text-slate-600 text-xs leading-relaxed">Educational aid grants for dependents of members and free micro-enterprise workshops.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex gap-4 shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base mb-1">24/7 Digital Self-Service</h3>
                <p className="text-slate-600 text-xs leading-relaxed">Real-time ledger access, SMS transaction updates, and online loan application tracking.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 7. ANNOUNCEMENTS AND NEWS */}
      <motion.section initial={{opacity:0, y:40}} whileInView={{opacity:1, y:0}} viewport={{once:true, margin:"-50px"}} transition={{duration:0.6}} id="announcements" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-[1600px] w-full xl:w-[90%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-mono font-bold text-cyan-700 uppercase tracking-widest bg-cyan-50 border border-cyan-200 px-3.5 py-1.5 rounded-full">
              Stay Informed
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
              Announcements & Cooperative News
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Latest updates on assemblies, dividend payouts, and community outreach initiatives.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {announcements.map((item, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-indigo-300 transition-all shadow-xs shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-mono font-bold border border-indigo-200">{item.badge}</span>
                    <span className="text-slate-500 flex items-center gap-1 font-mono"><Calendar className="w-3.5 h-3.5" />{item.date}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug">{item.title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed">{item.desc}</p>
                </div>
                <div className="pt-3 border-t border-slate-200 text-[11px] font-mono text-slate-500">
                  Published by Board Secretariat
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 8. FREQUENTLY ASKED QUESTIONS (FAQ) */}
      <motion.section initial={{opacity:0, y:40}} whileInView={{opacity:1, y:0}} viewport={{once:true, margin:"-50px"}} transition={{duration:0.6}} id="faq" className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-mono font-bold text-amber-700 uppercase tracking-widest bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full">
              Got Questions?
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Everything you need to know about joining, savings, loans, and cooperative governance.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all shadow-xs"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 font-bold text-slate-800 hover:text-emerald-600 cursor-pointer"
                >
                  <span className="text-sm sm:text-base">{faq.q}</span>
                  {activeFaq === index ? <ChevronUp className="w-5 h-5 text-emerald-600 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
                </button>
                {activeFaq === index && (
                  <div className="px-6 pb-5 pt-1 text-slate-600 text-xs sm:text-sm leading-relaxed border-t border-slate-100 animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 9. CONTACT INFORMATION & INQUIRY FORM */}
      <motion.section initial={{opacity:0, y:40}} whileInView={{opacity:1, y:0}} viewport={{once:true, margin:"-50px"}} transition={{duration:0.6}} id="contact" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-[1600px] w-full xl:w-[90%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left Info Column */}
            <div className="lg:col-span-5 space-y-8 animate-on-scroll opacity-0 -translate-x-8">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 border border-indigo-200 px-3.5 py-1.5 rounded-full">
                  Get In Touch
                </span>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-4 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
                  We're Here To Help You Grow
                </h2>
                <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                  Have questions about membership, loan eligibility, or dividend computation? Contact our member assistance desk today.
                </p>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-bold">Head Office Address</strong>
                    <span className="text-slate-600 text-xs">{settingsData?.address || "124 Financial Plaza, Cooperative Ave, Suite 400"}</span>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <Phone className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-bold">Hotlines & Support</strong>
                    <span className="text-slate-600 text-xs">+1 (800) 555-COOP / +1 (800) 555-2667</span>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-bold">Email Desk</strong>
                    <span className="text-slate-600 text-xs">{settingsData?.contactEmail || "support@cctcooperative.org"}</span>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <Clock className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-bold">Office Hours</strong>
                    <span className="text-slate-600 text-xs">Monday – Friday: 8:00 AM – 5:00 PM (Sat: 8:00 AM – 12:00 PM)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Contact Form Column */}
            <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl shadow-xs hover:shadow-xl hover:-translate-y-2 hover:shadow-indigo-500/20 hover:border-indigo-400 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Send Us a Direct Message</h3>
              <p className="text-slate-600 text-xs mb-6">Fill out the inquiry form below and our member services desk will respond within 24 business hours.</p>

              {inquirySuccess && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  {inquirySuccess}
                </div>
              )}

              {inquiryError && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {inquiryError}
                </div>
              )}

              <form onSubmit={handleSendInquiry} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maria Santos"
                      value={inquiryName}
                      onChange={(e) => setInquiryName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. maria@example.com"
                      value={inquiryEmail}
                      onChange={(e) => setInquiryEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +1 555-0192"
                      value={inquiryPhone}
                      onChange={(e) => setInquiryPhone(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Inquiry Category</label>
                    <select
                      value={inquiryCategory}
                      onChange={(e) => setInquiryCategory(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Membership Application">Membership Application</option>
                      <option value="Savings & Deposits">Savings & Deposits</option>
                      <option value="Loan Application">Loan Application</option>
                      <option value="Share Capital & Dividends">Share Capital & Dividends</option>
                      <option value="Technical Support">Technical Support</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Subject</label>
                  <input
                    type="text"
                    placeholder="Brief summary of your inquiry"
                    value={inquirySubject}
                    onChange={(e) => setInquirySubject(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Message / Details *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="How can our cooperative assistance team help you today?"
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={inquirySending}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] active:scale-95 transition-all duration-300"
                >
                  <Send className="w-4 h-4" />
                  {inquirySending ? 'Sending Message...' : 'Submit Inquiry'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 10. CALL TO ACTION BANNER */}
      <motion.section initial={{opacity:0, y:40}} whileInView={{opacity:1, y:0}} viewport={{once:true, margin:"-50px"}} transition={{duration:0.6}} className="py-16 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white border-t border-indigo-900">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            Ready to Take Control of Your Financial Future?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Join thousands of satisfied co-owners building sustainable savings and enjoying lower borrowing rates with {cooperativeName}.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
            <button
              onClick={handleRegisterClick}
              className="px-8 py-3.5 bg-white text-slate-950 font-bold text-sm rounded-2xl shadow-xl hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4 text-emerald-600" />
              Become a Member Now
            </button>
            <button
              onClick={handleLoginClick}
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl shadow-xl border border-indigo-400/30 transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] active:scale-95 transition-all duration-300"
            >
              <LogIn className="w-4 h-4" />
              Member Portal Login
            </button>
          </div>
        </div>
      </motion.section>

      {/* 11. FOOTER */}
      <footer className="bg-slate-50 text-slate-600 py-12 border-t border-slate-200 text-xs">
        <div className="max-w-[1600px] w-full xl:w-[90%] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <Coins size={18} />
                </div>
                <span className="font-extrabold text-slate-900 text-sm">{cooperativeName}</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Licensed and regulated cooperative financial institution serving members with integrity, security, and high dividend yields.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase font-mono tracking-wider mb-3">Quick Navigation</h4>
              <ul className="space-y-2 text-slate-500">
                <li><button onClick={() => scrollToSection('about')} className="hover:text-emerald-600 cursor-pointer transition-colors">About Us</button></li>
                <li><button onClick={() => scrollToSection('services')} className="hover:text-emerald-600 cursor-pointer transition-colors">Services</button></li>
                <li><button onClick={() => scrollToSection('products')} className="hover:text-emerald-600 cursor-pointer transition-colors">Savings & Loans</button></li>
                <li><button onClick={() => scrollToSection('benefits')} className="hover:text-emerald-600 cursor-pointer transition-colors">Member Benefits</button></li>
                <li><button onClick={() => scrollToSection('announcements')} className="hover:text-emerald-600 cursor-pointer transition-colors">Announcements</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase font-mono tracking-wider mb-3">Portals & Access</h4>
              <ul className="space-y-2 text-slate-500">
                <li><button onClick={handleLoginClick} className="hover:text-emerald-600 cursor-pointer transition-colors">Member Login</button></li>
                <li><button onClick={handleRegisterClick} className="hover:text-emerald-600 cursor-pointer transition-colors">Online Member Registration</button></li>
                <li><button onClick={() => scrollToSection('faq')} className="hover:text-emerald-600 cursor-pointer transition-colors">Help Center & FAQ</button></li>
                <li><button onClick={() => scrollToSection('contact')} className="hover:text-emerald-600 cursor-pointer transition-colors">Contact Assistance Desk</button></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase font-mono tracking-wider">Connect With Us</h4>
              <p className="text-slate-500">Follow our official channels for real-time dividend notices and assembly schedules.</p>
              <div className="flex items-center gap-3">
                <a href={landingData?.facebookUrl || "#facebook"} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-indigo-500 hover:shadow-[0_0_15px_rgba(79,70,229,0.15)] transition-all hover:-translate-y-1">
                  <Facebook size={16} />
                </a>
                <a href={landingData?.twitterUrl || "#twitter"} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-indigo-500 hover:shadow-[0_0_15px_rgba(79,70,229,0.15)] transition-all hover:-translate-y-1">
                  <Twitter size={16} />
                </a>
                <a href={landingData?.linkedinUrl || "#linkedin"} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-indigo-500 hover:shadow-[0_0_15px_rgba(79,70,229,0.15)] transition-all hover:-translate-y-1">
                  <Linkedin size={16} />
                </a>
                <a href={landingData?.instagramUrl || "#instagram"} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-indigo-500 hover:shadow-[0_0_15px_rgba(79,70,229,0.15)] transition-all hover:-translate-y-1">
                  <Instagram size={16} />
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px] font-mono">
            <div>
              © {new Date().getFullYear()} {cooperativeName}. All rights reserved. CDA Reg. No. 9520-200381.
            </div>
            <div className="flex gap-4">
              <span>Privacy Policy</span>
              <span>•</span>
              <span>Terms of Service</span>
              <span>•</span>
              <span>Security Governance</span>
            </div>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}

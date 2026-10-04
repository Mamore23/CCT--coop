-- ============================================================================
-- SUPABASE / POSTGRESQL DATABASE SCHEMA & MIGRATIONS
-- Project: Cooperative Financial Management System (CDA Philippines Compliant)
-- Created At: 2026-07-19
-- ============================================================================

-- Enable pgcrypto extension for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS & ROLES DEFINITIONS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF', 'MEMBER');
CREATE TYPE member_status AS ENUM ('PENDING', 'UNDER_REVIEW', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'REJECTED');
CREATE TYPE loan_status AS ENUM ('PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'PAID');
CREATE TYPE transaction_type AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'LOAN_RELEASE', 'LOAN_PAYMENT', 'DIVIDEND_CREDIT');
CREATE TYPE inquiry_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- ============================================================================
-- 2. CORE SYSTEM TABLES
-- ============================================================================

-- Cooperative Global Settings
CREATE TABLE IF NOT EXISTS cooperative_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cooperative_name VARCHAR(255) NOT NULL,
    cda_registration_number VARCHAR(100) UNIQUE,
    tin VARCHAR(50) UNIQUE,
    address TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    fiscal_year VARCHAR(10) NOT NULL DEFAULT '2026',
    dividend_allocation_rate NUMERIC(5, 2) NOT NULL DEFAULT 70.00, -- 70% to dividends
    default_dividend_rate NUMERIC(5, 2) NOT NULL DEFAULT 8.00,     -- 8% per annum
    minimum_share_capital NUMERIC(15, 2) NOT NULL DEFAULT 10000.00,
    sms_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User Roles Table (to map user emails to system roles)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'MEMBER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles Table (for core user details)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Membership Applications Table
CREATE TABLE IF NOT EXISTS membership_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    gender VARCHAR(20),
    birthdate DATE,
    civil_status VARCHAR(50),
    address TEXT,
    occupation VARCHAR(100),
    monthly_income NUMERIC(15, 2),
    status member_status NOT NULL DEFAULT 'PENDING',
    review_notes TEXT,
    rejection_reason TEXT,
    additional_requirements_requested TEXT,
    gov_id_url TEXT,
    selfie_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Members Table (operational record linked to profiles)
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    membership_number VARCHAR(100) UNIQUE,
    status member_status NOT NULL DEFAULT 'ACTIVE',
    share_capital NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    regular_savings NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    time_deposits NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    dividends_earned NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    employee_number VARCHAR(100) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 3. SAVINGS TABLES
-- ============================================================================

-- Savings Accounts Configuration / Ledger details
CREATE TABLE IF NOT EXISTS savings_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    account_type VARCHAR(50) NOT NULL, -- 'REGULAR_SAVINGS', 'TIME_DEPOSIT', 'SHARE_CAPITAL'
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_member_account UNIQUE(member_id, account_type)
);

-- Savings and Equity Transactions Log
CREATE TABLE IF NOT EXISTS savings_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- 'regularSavings', 'timeDeposits', 'shareCapital'
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    processed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reference_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Share Capital Ledger
CREATE TABLE IF NOT EXISTS share_capital (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES savings_transactions(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount <> 0),
    cumulative_balance NUMERIC(15, 2) NOT NULL,
    fiscal_year VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 4. LOANS TABLES
-- ============================================================================

-- Loan Types Configuration
CREATE TABLE IF NOT EXISTS loan_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    interest_rate NUMERIC(5, 4) NOT NULL, -- e.g. 0.0500 for 5%
    max_duration_months INTEGER NOT NULL,
    min_amount NUMERIC(15, 2) NOT NULL,
    max_amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Loans Table
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    loan_type_id UUID NOT NULL REFERENCES loan_types(id),
    principal_amount NUMERIC(15, 2) NOT NULL,
    interest_amount NUMERIC(15, 2) NOT NULL,
    total_repayable NUMERIC(15, 2) NOT NULL,
    balance NUMERIC(15, 2) NOT NULL,
    monthly_amortization NUMERIC(15, 2) NOT NULL,
    duration_months INTEGER NOT NULL,
    due_date DATE NOT NULL,
    status loan_status NOT NULL DEFAULT 'PENDING_REVIEW',
    approved_by_id UUID REFERENCES auth.users(id),
    disbursed_by_id UUID REFERENCES auth.users(id),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Loan Payments Table
CREATE TABLE IF NOT EXISTS loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amount_paid NUMERIC(15, 2) NOT NULL CHECK (amount_paid > 0),
    interest_portion NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    principal_portion NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    processed_by_id UUID REFERENCES auth.users(id),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'SAVINGS_DEDUCTION',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 5. DIVIDENDS TABLES
-- ============================================================================

-- Dividend Distributions Periods
CREATE TABLE IF NOT EXISTS dividend_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year VARCHAR(10) NOT NULL UNIQUE,
    net_surplus NUMERIC(15, 2) NOT NULL,
    dividend_rate NUMERIC(5, 4) NOT NULL, -- e.g. 0.0800 for 8%
    total_distributed NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPUTED', -- 'COMPUTED', 'DISTRIBUTED'
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Individual Dividends Computed
CREATE TABLE IF NOT EXISTS dividends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_period_id UUID NOT NULL REFERENCES dividend_distributions(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    share_capital_snapshotted NUMERIC(15, 2) NOT NULL,
    dividend_amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPUTED', -- 'COMPUTED', 'PAID'
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 6. SYSTEM UTILITIES, NOTIFICATIONS, AUDIT LOGS, REPORTS
-- ============================================================================

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_role user_role,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Generated CDA Compliance Reports Archives
CREATE TABLE IF NOT EXISTS generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'MEMBERSHIP', 'FINANCIAL', 'CAPITAL', 'SAVINGS', 'LOAN', 'DIVIDEND'
    fiscal_year VARCHAR(10) NOT NULL,
    generated_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    filter_start_date DATE,
    filter_end_date DATE,
    payload JSONB NOT NULL, -- Full report contents snapshot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 7. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_roles_user_id ON roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_savings_trans_member ON savings_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_dividends_member ON dividends(member_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_generated_reports_category ON generated_reports(category);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_capital ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividend_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooperative_settings ENABLE ROW LEVEL SECURITY;

-- Create Security Helper Function to check current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM roles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 8.1 PROFILES POLICIES
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins and Staff can view any profile" ON profiles
    FOR SELECT USING (get_user_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE USING (get_user_role() = 'ADMIN');

-- 8.2 MEMBERS POLICIES
CREATE POLICY "Members can view their own record" ON members
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Staff and Admins can view and manage all member records" ON members
    FOR ALL USING (get_user_role() IN ('ADMIN', 'STAFF'));

-- 8.3 MEMBERSHIP APPLICATIONS POLICIES
CREATE POLICY "Applicants can view their own application status via email matching" ON membership_applications
    FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Staff and Admins can manage all applications" ON membership_applications
    FOR ALL USING (get_user_role() IN ('ADMIN', 'STAFF'));

-- 8.4 SAVINGS ACCOUNTS & TRANSACTIONS POLICIES
CREATE POLICY "Members can view their own savings account balances" ON savings_accounts
    FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY "Staff and Admins can manage savings accounts" ON savings_accounts
    FOR ALL USING (get_user_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Members can view their own transaction history" ON savings_transactions
    FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY "Staff and Admins can view and create savings transactions" ON savings_transactions
    FOR ALL USING (get_user_role() IN ('ADMIN', 'STAFF'));

-- 8.5 LOANS & PAYMENTS POLICIES
CREATE POLICY "Members can view their own loans" ON loans
    FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY "Members can apply for loans" ON loans
    FOR INSERT WITH CHECK (auth.uid() = member_id AND get_user_role() = 'MEMBER');

CREATE POLICY "Staff and Admins can manage all loans" ON loans
    FOR ALL USING (get_user_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Members can view their own loan payments" ON loan_payments
    FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY "Staff and Admins can record loan payments" ON loan_payments
    FOR ALL USING (get_user_role() IN ('ADMIN', 'STAFF'));

-- 8.6 DIVIDENDS POLICIES
CREATE POLICY "Members can view their own dividends" ON dividends
    FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY "Admins have full access to dividend distributions" ON dividend_distributions
    FOR ALL USING (get_user_role() = 'ADMIN');

CREATE POLICY "Staff can view dividend distributions" ON dividend_distributions
    FOR SELECT USING (get_user_role() = 'STAFF');

CREATE POLICY "Admins can manage computed dividends" ON dividends
    FOR ALL USING (get_user_role() = 'ADMIN');

CREATE POLICY "Staff can view computed dividends" ON dividends
    FOR SELECT USING (get_user_role() = 'STAFF');

-- 8.7 NOTIFICATIONS POLICIES
CREATE POLICY "Users can manage their own notifications" ON notifications
    FOR ALL USING (auth.uid() = user_id);

-- 8.8 AUDIT LOGS POLICIES
CREATE POLICY "Only Admins can view audit logs" ON audit_logs
    FOR SELECT USING (get_user_role() = 'ADMIN');

-- 8.9 REPORTS POLICIES
CREATE POLICY "Admins and Staff can view generated compliance reports" ON generated_reports
    FOR SELECT USING (get_user_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Admins can generate and store reports" ON generated_reports
    FOR ALL USING (get_user_role() = 'ADMIN');

-- 8.10 COOPERATIVE SETTINGS POLICIES
CREATE POLICY "Anyone can view cooperative public settings" ON cooperative_settings
    FOR SELECT USING (true);

CREATE POLICY "Only Admins can update settings" ON cooperative_settings
    FOR ALL USING (get_user_role() = 'ADMIN');

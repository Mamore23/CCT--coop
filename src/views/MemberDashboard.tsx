/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  LoanStatusBadge,
  LoanWorkflowStepper,
} from "../components/LoanStatusWorkflow.js";
import { DocumentViewerModal } from "../components/DocumentViewerModal.js";
import {
  TrendingUp,
  Wallet,
  CreditCard,
  Coins,
  Check,
  AlertCircle,
  Send,
  Calculator,
  Lock,
  MessageSquare,
  Bell,
  FileText,
  Upload,
  Trash2,
  Download,
  CheckCircle2,
  Paperclip,
  Eye,
  QrCode,
  Shield,
  X,
  Receipt,
  Calendar,
  Clock,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Search,
  FileCheck,
  HelpCircle,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Sparkles,
  Printer,
  DollarSign,
  Mail,
  ListOrdered,
  Building2,
  ShieldCheck,
  XCircle,
  BookOpen,
  GraduationCap,
  AlertTriangle
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import { GcashModule } from "../components/GcashModule.js";
import { OfficialReceiptModal } from "../components/OfficialReceiptModal.js";
import { LoanPaymentHistoryModal } from "../components/LoanPaymentHistoryModal.js";
import { LoanPaymentModal } from "../components/LoanPaymentModal.js";
import { OfficialReceipt, TimeDepositContract, TimeDepositProductConfig } from "../types.js";

/**
 * Safe financial currency and number formatters that handle null, undefined, or missing numeric values
 * by defaulting safely to standard formats while preserving Philippine Peso currency accuracy.
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
): string {
  if (value === null || value === undefined || value === "") {
    return `₱${(0).toLocaleString("en-PH", options)}`;
  }
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) {
    return `₱${(0).toLocaleString("en-PH", options)}`;
  }
  return `₱${num.toLocaleString("en-PH", options)}`;
}

export const formatMoney = (
  val: number | string | null | undefined,
  options: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
): string => {
  if (val === null || val === undefined || val === "") return (0).toLocaleString("en-PH", options);
  const num = typeof val === "number" ? val : Number(val);
  if (isNaN(num)) return (0).toLocaleString("en-PH", options);
  return num.toLocaleString("en-PH", options);
};

export const formatNumber = (
  val: number | string | null | undefined,
  options?: Intl.NumberFormatOptions
): string => {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "number" ? val : Number(val);
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-PH", options);
};

interface MemberDashboardProps {
  token: string;
  activeTab: string;
  cooperativeName: string;
  onAvatarUpdate?: (newAvatarUrl: string) => void;
  onNavigate?: (tab: string) => void;
}

export function MemberDashboard({
  token,
  activeTab,
  cooperativeName,
  onAvatarUpdate,
  onNavigate,
}: MemberDashboardProps) {
  // Overall state
  const [stats, setStats] = useState<any>(null);
  const [savingsData, setSavingsData] = useState<any>({
    member: null,
    transactions: [],
  });
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [loanApplications, setLoanApplications] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [dividends, setDividends] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [activeInquiryId, setActiveInquiryId] = useState<string | null>(null);
  const [activeInquiryDetails, setActiveInquiryDetails] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<OfficialReceipt[]>([]);
  const [selectedReceiptForModal, setSelectedReceiptForModal] =
    useState<OfficialReceipt | null>(null);
  const [selectedLoanForScheduleModal, setSelectedLoanForScheduleModal] =
    useState<any | null>(null);
  const [selectedLoanForPayModal, setSelectedLoanForPayModal] = useState<
    any | null
  >(null);
  const [selectedTargetInstallment, setSelectedTargetInstallment] = useState<any | null>(null);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptsViewMode, setReceiptsViewMode] = useState<"ALL" | "LOANS">("ALL");

  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalMethod, setWithdrawalMethod] = useState<"CASH" | "GCASH">(
    "GCASH",
  );
  const [withdrawalRemarks, setWithdrawalRemarks] = useState("");
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);

  const [timeDepositContracts, setTimeDepositContracts] = useState<TimeDepositContract[]>([]);
  const [tdConfig, setTdConfig] = useState<TimeDepositProductConfig | null>(null);
  const [openTdModalOpen, setOpenTdModalOpen] = useState(false);
  const [tdAmount, setTdAmount] = useState("");
  const [tdTerm, setTdTerm] = useState("12");
  const [tdRenewal, setTdRenewal] = useState<"AUTOMATIC_ROLLOVER" | "PAYOUT_TO_SAVINGS" | "MANUAL">("AUTOMATIC_ROLLOVER");

  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositAmountInput, setDepositAmountInput] = useState("");
  const [depositMethod, setDepositMethod] = useState<"CASH" | "GCASH" | "BANK_TRANSFER">("GCASH");
  const [depositGcashRef, setDepositGcashRef] = useState("");

  const fetchWithdrawalRequests = async () => {
    try {
      const res = await fetch("/api/savings/withdrawal-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setWithdrawalRequests(
              savingsData.member?.id ? data.filter((r: any) => r.memberId === savingsData.member?.id) : data
            );
          }
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (savingsData.member?.id) {
      fetchWithdrawalRequests();
    }
  }, [savingsData.member?.id, activeTab]);

  const submitWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(withdrawalAmount);
    if (!withdrawalAmount || isNaN(amt) || amt <= 0) {
      triggerMessage("Please enter a valid withdrawal amount.", "error");
      return;
    }

    if (withdrawalMethod === "GCASH" && !savingsData.member?.gcashNumber) {
      triggerMessage("A valid registered GCash number is required for GCash releases.", "error");
      return;
    }

    try {
      const clientTxKey = `WITHDRAW_REQ_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const res = await fetch("/api/savings/withdrawal-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amt,
          releaseMethod: withdrawalMethod === "CASH" ? "OFFICE_CASH" : withdrawalMethod,
          gcashNumber:
            withdrawalMethod === "GCASH"
              ? savingsData.member?.gcashNumber || ""
              : undefined,
          remarks: withdrawalRemarks,
          clientTxKey,
        }),
      });

      const contentType = res.headers.get("content-type");
      let data: any = {};
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned non-JSON response (${res.status}): ${text.substring(0, 80)}`);
      }

      if (!res.ok) {
        triggerMessage(data.error || "Failed to submit request.", "error");
      } else {
        if (data.status === 'ALREADY_PROCESSED') {
          triggerMessage("Withdrawal request already submitted.", "success");
        } else {
          triggerMessage(
            data.message || "Withdrawal request submitted successfully. Your request is pending staff approval.",
            "success"
          );
        }
        setWithdrawalModalOpen(false);
        setWithdrawalAmount("");
        setWithdrawalRemarks("");
        fetchData();
        fetchWithdrawalRequests();
      }
    } catch (err: any) {
      triggerMessage(err.message || "Withdrawal request failed", "error");
    }
  };

  // Avatar Profile Picture Upload State
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Personal GCash Payout Info state
  const [memberGcashName, setMemberGcashName] = useState("");
  const [memberGcashNum, setMemberGcashNum] = useState("");
  const [memberGcashQr, setMemberGcashQr] = useState("");
  const [isSavingMemberGcash, setIsSavingMemberGcash] = useState(false);
  const [qrZoomModal, setQrZoomModal] = useState<string | null>(null);

  // Sync GCash payout info when member data updates
  useEffect(() => {
    if (savingsData.member) {
      setMemberGcashName(savingsData.member.gcashAccountName || "");
      setMemberGcashNum(savingsData.member.gcashNumber || "");
      setMemberGcashQr(savingsData.member.gcashQrCodeUrl || "");
    }
  }, [savingsData.member?.id, savingsData.member?.gcashNumber, savingsData.member?.gcashAccountName]);

  // Document Upload & Preview State
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadCategory, setUploadCategory] = useState<
    | "GOV_ID"
    | "SELFIE"
    | "INCOME_PROOF"
    | "BILLING"
    | "LOAN_AGREEMENT"
    | "OTHER"
  >("GOV_ID");
  const [uploadFileData, setUploadFileData] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    category: string;
    fileName: string;
    fileType: string;
    fileDataUrl: string;
    uploadedAt?: string;
    updatedAt?: string;
  } | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);

  // Forms states

  const [depositAmount, setDepositAmount] = useState("");
  const [depositAccount, setDepositAccount] = useState("regularSavings");
  const [loanTypeId, setLoanTypeId] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanDuration, setLoanDuration] = useState("12");
  const [loanPurpose, setLoanPurpose] = useState("Personal Need");
  const [collateralDescription, setCollateralDescription] = useState("");
  const [coMakerName, setCoMakerName] = useState("");
  const [coMakerContact, setCoMakerContact] = useState("");
  const [loanAppDocs, setLoanAppDocs] = useState<
    Array<{
      documentType: string;
      fileName: string;
      fileDataUrl: string;
      fileSize: number;
    }>
  >([]);
  const [eligibilityData, setEligibilityData] = useState<{
    eligible?: boolean;
    isEligible: boolean;
    missingRequirements?: string[];
    duplicateApplication?: boolean;
    duplicateApplicationDetails?: {
      applicationId: string;
      loanTypeId: string;
      loanTypeName: string;
      status: string;
      stage: string;
      submittedDate: string;
      isRevisionRequired: boolean;
      reviewerRemarks?: string;
    };
    complianceDetails?: {
      pmes: {
        completed: boolean;
        status: string;
        attendedAt?: string;
        verifiedBy?: string;
        reference?: string;
      };
      orientation: {
        completed: boolean;
        status: string;
        attendedAt?: string;
        verifiedBy?: string;
        reference?: string;
      };
    };
    requirements?: any[];
    existingActiveLoan?: {
      id: string;
      loanId: string;
      loanTypeName: string;
      principalAmount: number;
      balance: number;
      monthlyAmortization: number;
      disbursedAt?: string;
      dueDate?: string;
      durationMonths: number;
      isPastDue: boolean;
      status: string;
    };
    checks: any[];
    member?: any;
    loanType?: any;
  } | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [selectedAppForModal, setSelectedAppForModal] = useState<any | null>(
    null,
  );

  const [payLoanId, setPayLoanId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [inquirySubject, setInquirySubject] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [replyText, setReplyText] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // General Notification / Success State
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const triggerMessage = (
    text: string,
    type: "success" | "error" = "success",
  ) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 6000);
  };

  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [gcashConfig, setGcashConfig] = useState<any>(null);
  const [bankConfig, setBankConfig] = useState<any>(null);
  const [accountLoadError, setAccountLoadError] = useState<string | null>(null);

  // 1. Fetch Stats & Data
  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Configs (parallel)
      try {
        const [sysRes, gcRes, bcRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/gcash/config"),
          fetch("/api/bank-transfer/config"),
        ]);
        if (sysRes.ok) setSystemSettings(await sysRes.json());
        if (gcRes.ok) setGcashConfig(await gcRes.json());
        if (bcRes.ok) setBankConfig(await bcRes.json());
      } catch (e) {
        console.error("Error fetching configs", e);
      }

      const [
        statsRes,
        ledgerRes,
        ltRes,
        laRes,
        alRes,
        divRes,
        inqRes,
        notifRes,
        docRes,
        rcRes,
        tdRes,
      ] = await Promise.all([
        fetch("/api/dashboard/stats", { headers }),
        fetch("/api/savings/ledger", { headers }),
        fetch("/api/loans/types", { headers }),
        fetch("/api/loans/applications", { headers }),
        fetch("/api/loans/active", { headers }),
        fetch("/api/dividends/member", { headers }),
        fetch("/api/inquiries", { headers }),
        fetch("/api/notifications", { headers }),
        fetch("/api/documents", { headers }),
        fetch("/api/receipts", { headers }),
        fetch("/api/time-deposits", { headers }),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats);
      }

      if (ledgerRes.ok) {
        const d = await ledgerRes.json();
        setSavingsData(d);
      }

      if (statsRes.ok || ledgerRes.ok) {
        setAccountLoadError(null);
      } else {
        setAccountLoadError("We couldn't load your account information. Please try again or contact the cooperative.");
      }

      if (ltRes.ok) {
        const d = await ltRes.json();
        setLoanTypes(d);
        if (d.length > 0) {
          setLoanTypeId(prev => prev || d[0].id);
        }
      }

      if (laRes.ok) {
        setLoanApplications(await laRes.json());
      }

      if (alRes.ok) {
        setActiveLoans(await alRes.json());
      }

      if (divRes.ok) {
        setDividends(await divRes.json());
      }

      if (inqRes.ok) {
        setInquiries(await inqRes.json());
      }

      if (notifRes.ok) {
        setNotifications(await notifRes.json());
      }

      if (docRes.ok) {
        setDocuments(await docRes.json());
      }

      if (rcRes.ok) {
        setReceipts(await rcRes.json());
      }

      if (tdRes.ok) {
        const d = await tdRes.json();
        setTimeDepositContracts(d.contracts || []);
        if (d.config) setTdConfig(d.config);
      }
    } catch (e) {
      console.error("Error fetching member data", e);
      setAccountLoadError("We couldn't load your account information. Please try again or contact the cooperative.");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (document.hidden) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;
      fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Eligibility evaluation call
  const fetchEligibility = async (typeId: string, amount: string = "") => {
    if (!typeId) return;
    setEligibilityLoading(true);
    try {
      const res = await fetch(
        `/api/loans/check-eligibility?loanTypeId=${typeId}&amount=${amount}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const d = await res.json();
        setEligibilityData(d);
      }
    } catch (err) {
      console.error("Error checking loan eligibility:", err);
    } finally {
      setEligibilityLoading(false);
    }
  };

  useEffect(() => {
    let timeoutId: any;
    if (
      loanTypeId &&
      (activeTab === "member-loans" || activeTab === "member-dashboard")
    ) {
      timeoutId = setTimeout(() => {
        fetchEligibility(loanTypeId, loanAmount);
      }, 300);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loanTypeId, loanAmount, activeTab]);

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("coop_loan_updates");
      bc.onmessage = () => {
        fetchData();
        if (loanTypeId) {
          fetchEligibility(loanTypeId, loanAmount);
        }
      };
    } catch (e) {
      // BroadcastChannel fallback
    }
    return () => {
      try {
        bc?.close();
      } catch (e) {}
    };
  }, [loanTypeId, loanAmount]);

  const [initialSharePaymentMethod, setInitialSharePaymentMethod] = useState<
    "CASH" | "GCASH" | "BANK_TRANSFER" | ""
  >("");
  const [initialShareReference, setInitialShareReference] = useState("");
  const [initialShareReceiptFile, setInitialShareReceiptFile] =
    useState<File | null>(null);
  const [isSubmittingInitialShare, setIsSubmittingInitialShare] =
    useState(false);

  // Filters for Financial Transaction Ledger and Official Receipts
  const [ledgerFilter, setLedgerFilter] = useState("ALL");
  const [receiptsFilter, setReceiptsFilter] = useState("ALL");

  
  const handleInitialSharePayment = async () => {
    if (!initialSharePaymentMethod) {
      triggerMessage("Please select a payment method.", "error");
      return;
    }

    if (initialSharePaymentMethod === "GCASH" && !initialShareReference) {
      triggerMessage("GCash reference number is required.", "error");
      return;
    }

    if (initialSharePaymentMethod === "BANK_TRANSFER" && !initialShareReference) {
      triggerMessage("Bank Transfer reference number is required.", "error");
      return;
    }

    setIsSubmittingInitialShare(true);
    let receiptUrl = "";

    if ((initialSharePaymentMethod === "GCASH" || initialSharePaymentMethod === "BANK_TRANSFER") && initialShareReceiptFile) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(initialShareReceiptFile);
        });
        const fileDataUrl = await base64Promise;
        receiptUrl = fileDataUrl;

        const uploadRes = await fetch("/api/documents/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fileName: initialShareReceiptFile.name,
            fileType: initialShareReceiptFile.type,
            documentCategory: 'OTHER',
            fileSize: initialShareReceiptFile.size,
            fileDataUrl
          }),
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.fileDataUrl) {
            receiptUrl = uploadData.fileDataUrl;
          }
        }
      } catch (err) {
        console.error("File upload failed", err);
      }
    }

    try {
      const res = await fetch("/api/member/initial-share-payment", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentMethod: initialSharePaymentMethod,
          reference: initialShareReference,
          receiptUrl,
          proofAttachmentUrl: receiptUrl,
          proofFileName: initialShareReceiptFile?.name || 'initial_share_receipt.png',
          proofFileType: initialShareReceiptFile?.type || 'image/png'
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit payment");

      triggerMessage(data.message, "success");
      fetchData();
    } catch (err: any) {
      triggerMessage(err.message, "error");
    } finally {
      setIsSubmittingInitialShare(false);
    }
  };

  const handleLoanDocUpload = (docType: string, file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      triggerMessage("File size exceeds maximum 10MB limit.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLoanAppDocs((prev) => {
        const filtered = prev.filter((d) => d.documentType !== docType);
        return [
          ...filtered,
          {
            documentType: docType,
            fileName: file.name,
            fileDataUrl: dataUrl,
            fileSize: file.size,
          },
        ];
      });
      triggerMessage(`Attached ${file.name} for ${docType.replace(/_/g, " ")}`);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLoanDoc = (docType: string) => {
    setLoanAppDocs((prev) => prev.filter((d) => d.documentType !== docType));
  };

  const [missingLoanDocs, setMissingLoanDocs] = useState<
    Array<{
      documentType: string;
      fileName: string;
      fileDataUrl: string;
      fileSize: number;
    }>
  >([]);

  const handleMissingLoanDocUpload = (docType: string, file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      triggerMessage("File size exceeds maximum 10MB limit.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setMissingLoanDocs((prev) => {
        const filtered = prev.filter((d) => d.documentType !== docType);
        return [
          ...filtered,
          {
            documentType: docType,
            fileName: file.name,
            fileDataUrl: dataUrl,
            fileSize: file.size,
          },
        ];
      });
      triggerMessage(`Attached ${file.name} for ${docType.replace(/_/g, " ")}`);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveMissingLoanDoc = (docType: string) => {
    setMissingLoanDocs((prev) =>
      prev.filter((d) => d.documentType !== docType),
    );
  };

  const handleResubmitLoan = async (appId: string) => {
    if (missingLoanDocs.length === 0) {
      triggerMessage(
        "Please upload at least one requested document before resubmitting.",
        "error",
      );
      return;
    }
    try {
      const res = await fetch(`/api/loans/resubmit/${appId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documents: missingLoanDocs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      triggerMessage(
        "Missing documents submitted. Application is back under pending review.",
      );
      setMissingLoanDocs([]);
      setSelectedAppForModal(null);
      try {
        const bc = new BroadcastChannel("coop_loan_updates");
        bc.postMessage({ type: "LOAN_RESUBMITTED", timestamp: Date.now() });
        bc.close();
      } catch (e) {}
      fetchData();
      if (loanTypeId) fetchEligibility(loanTypeId, loanAmount);
    } catch (err: any) {
      triggerMessage(err.message, "error");
    }
  };

  // Cancel or Withdraw Application
  const handleCancelApplication = async (appId: string) => {
    if (!window.confirm("Are you sure you want to withdraw/cancel this loan application?")) return;
    try {
      const res = await fetch(`/api/loans/cancel/${appId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: "Withdrawn by applicant" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      triggerMessage("Loan application cancelled successfully.");
      setSelectedAppForModal(null);
      try {
        const bc = new BroadcastChannel("coop_loan_updates");
        bc.postMessage({ type: "LOAN_CANCELLED", timestamp: Date.now() });
        bc.close();
      } catch (e) {}
      fetchData();
      if (loanTypeId) fetchEligibility(loanTypeId, loanAmount);
    } catch (err: any) {
      triggerMessage(err.message, "error");
    }
  };

  // Mark notification read
  const markNotificationRead = async (id?: string) => {
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle local file selection -> Data URL conversion
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadFileData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit document upload
  const handleDocumentUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName || !uploadFileData) {
      triggerMessage("Please select a valid document file to upload.", "error");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: uploadFileName,
          fileType: "application/pdf",
          documentCategory: uploadCategory,
          fileDataUrl: uploadFileData,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        triggerMessage(data.message || "Document uploaded successfully!");
        setUploadFileName("");
        setUploadFileData(null);
        fetchData();
      } else {
        triggerMessage(data.error || "Failed to upload document", "error");
      }
    } catch (err: any) {
      triggerMessage("Error uploading document: " + err.message, "error");
    } finally {
      setUploading(false);
    }
  };

  // Delete document
  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to remove this document attachment?"))
      return;
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        triggerMessage(data.message || "Document removed");
        fetchData();
      } else {
        triggerMessage(data.error || "Failed to delete document", "error");
      }
    } catch (err: any) {
      triggerMessage("Error deleting document: " + err.message, "error");
    }
  };

  // Replace / Edit Document
  const handleReplaceDocument = async (
    docId: string,
    file: File,
    category?: string,
  ) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      triggerMessage(
        "File size exceeds 15 MB limit. Please select a smaller file.",
        "error",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const fileDataUrl = reader.result as string;
      try {
        setUploading(true);
        const res = await fetch(`/api/documents/${docId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            documentCategory: category,
            fileDataUrl,
            fileSize: file.size,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          triggerMessage(
            data.message || "Document file replaced successfully!",
          );
          fetchData();
        } else {
          triggerMessage(data.error || "Failed to replace document", "error");
        }
      } catch (err: any) {
        triggerMessage("Error replacing document: " + err.message, "error");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Fetch individual inquiry with replies
  const fetchInquiryDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setActiveInquiryDetails(d);
        setActiveInquiryId(id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 2. Action Handlers
  const handleOpenTimeDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tdAmount || Number(tdAmount) <= 0) {
      triggerMessage("Please enter a valid placement amount.", "error");
      return;
    }

    const availableSavings = savingsData.member?.regularSavings || 0;
    if (Number(tdAmount) > availableSavings) {
      triggerMessage(
        `Insufficient Regular Savings balance. Please deposit funds into Regular Savings before opening a Time Deposit. (Available: ${formatCurrency(availableSavings)})`,
        "error"
      );
      return;
    }

    try {
      const res = await fetch("/api/time-deposits/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          principalAmount: Number(tdAmount),
          termMonths: Number(tdTerm),
          renewalInstruction: tdRenewal,
          clientTxKey: `TD_OPEN_${Date.now()}`
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open Time Deposit contract");

      triggerMessage(
        `Time Deposit contract #${(data.contract?.id || "").substring(0, 8).toUpperCase()} opened and funded with ${formatCurrency(tdAmount)}!`,
      );
      setTdAmount("");
      setOpenTdModalOpen(false);
      fetchData();
    } catch (err: any) {
      triggerMessage(err.message, "error");
    }
  };

  
  const handleRegularSavingsDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const depositAmt = Number(depositAmountInput);
    if (!depositAmountInput || isNaN(depositAmt) || depositAmt <= 0) {
      triggerMessage("Please enter a valid deposit amount.", "error");
      return;
    }

    const pType = depositAccount === 'shareCapital' ? 'SHARE_CAPITAL' : 'SAVINGS_DEPOSIT';
    const accountLabel = depositAccount === 'shareCapital' ? 'Share Capital' : 'Regular Savings';

    if (depositMethod === "GCASH" || depositMethod === "BANK_TRANSFER") {
      if (!depositGcashRef) {
        triggerMessage(`Please enter the ${depositMethod === 'GCASH' ? 'GCash' : 'Bank'} reference number.`, "error");
        return;
      }
      try {
        const res = await fetch("/api/payments/request", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            paymentType: pType,
            amount: depositAmt,
            paymentMethod: depositMethod,
            externalReference: depositGcashRef.trim(),
            remarks: `${accountLabel} Deposit via ${depositMethod}`
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to submit deposit request");

        triggerMessage(`Deposit request of ${formatCurrency(depositAmt)} submitted successfully! Awaiting staff verification and reconciliation.`, "success");
        setDepositAmountInput("");
        setDepositGcashRef("");
        setDepositModalOpen(false);
        fetchData();
      } catch (err: any) {
        triggerMessage(err.message || "Deposit request failed", "error");
      }
      return;
    }

    // Office Cash flow: Submits Payment Request for cashier reconciliation
    try {
      const res = await fetch("/api/payments/request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          paymentType: pType,
          amount: depositAmt,
          paymentMethod: "CASH",
          remarks: `${accountLabel} Deposit via Office Cash`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit deposit request");
      
      triggerMessage(`Deposit request of ${formatCurrency(depositAmt)} submitted successfully! Please proceed to the Cashier for physical verification and receipting.`, "success");
      setDepositAmountInput("");
      setDepositGcashRef("");
      setDepositModalOpen(false);
      fetchData();
    } catch (err: any) {
      triggerMessage(err.message || "Deposit request failed", "error");
    }
  };

  const handleCloseTimeDeposit = async (contractId: string) => {
    if (!confirm("Are you sure you want to close this Time Deposit contract and return the funds to your Regular Savings account?")) return;

    try {
      const res = await fetch(`/api/time-deposits/${contractId}/close`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to close Time Deposit contract");

      triggerMessage(data.message || "Time Deposit closed and paid out to Regular Savings.");
      fetchData();
    } catch (err: any) {
      triggerMessage(err.message, "error");
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || Number(depositAmount) <= 0) return;

    const pType = depositAccount === 'shareCapital' ? 'SHARE_CAPITAL' : 'SAVINGS_DEPOSIT';
    const accountLabel = depositAccount === 'shareCapital' ? 'Share Capital' : 'Regular Savings';

    try {
      const res = await fetch("/api/payments/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentType: pType,
          amount: Number(depositAmount),
          paymentMethod: 'CASH',
          remarks: `${accountLabel} Deposit Request`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      triggerMessage(
        `Deposit request of ${formatCurrency(depositAmount)} submitted for ${accountLabel}! Please proceed to Cashier for payment reconciliation.`,
        "success"
      );
      setDepositAmount("");
      fetchData();
    } catch (err: any) {
      triggerMessage(err.message, "error");
    }
  };

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanAmount || Number(loanAmount) <= 0) {
      triggerMessage("Please enter a valid loan principal amount.", "error");
      return;
    }

    const selectedTypeObj = loanTypes.find((t) => t.id === loanTypeId);
    const requiredDocTypes: string[] = selectedTypeObj?.requiredDocuments || [];
    if (requiredDocTypes.length > 0) {
      const uploadedDocTypes = new Set(loanAppDocs.map((d) => d.documentType));
      const missing = requiredDocTypes.filter(
        (dt) => !uploadedDocTypes.has(dt),
      );
      if (missing.length > 0) {
        triggerMessage(
          `Missing required supporting document(s): ${missing.map((m) => m.replace(/_/g, " ")).join(", ")}. Please upload attachments below.`,
          "error",
        );
        return;
      }
    }

    try {
      const res = await fetch("/api/loans/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          loanTypeId,
          amount: Number(loanAmount),
          durationMonths: Number(loanDuration),
          purpose: loanPurpose,
          collateralDescription,
          coMakerName,
          coMakerContact,
          documents: loanAppDocs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.checks) {
          setEligibilityData({
            eligible: false,
            isEligible: false,
            missingRequirements: data.missingRequirements || [],
            duplicateApplication: !!data.duplicateApplication,
            complianceDetails: data.complianceDetails,
            requirements: data.requirements,
            checks: data.checks,
            loanType: eligibilityData?.loanType,
            member: eligibilityData?.member
          });
        }
        if (data.missingRequirements && data.missingRequirements.length > 0) {
          if (data.missingRequirements.includes("PRE_MEMBERSHIP_SEMINAR")) {
            throw new Error("Loan Application Unavailable: Please complete and have your Pre-membership Education Seminar verified by Staff.");
          }
          if (data.missingRequirements.includes("LOAN_ORIENTATION")) {
            throw new Error("Loan Application Unavailable: Missing requirement: Loan Orientation & Credit Counseling.");
          }
        }
        if (data.duplicateApplication) {
          throw new Error("No Duplicate Pending Application: An active application for this loan product is already under review.");
        }
        throw new Error(data.message || data.error || 'Failed to submit loan application.');
      }

      // Notify other tabs (Admin/Staff) to refresh immediately
      try {
        const bc = new BroadcastChannel("coop_loan_updates");
        bc.postMessage({ type: "LOAN_SUBMITTED", timestamp: Date.now() });
        bc.close();
      } catch (e) {
        console.warn("BroadcastChannel not supported", e);
      }

      triggerMessage(
        `Loan application for ${data.application.loanTypeName} of ${formatCurrency(loanAmount)} submitted successfully! Status: PENDING_REVIEW.`,
      );
      setLoanAmount("");
      setLoanPurpose("Personal Need");
      setCollateralDescription("");
      setCoMakerName("");
      setCoMakerContact("");
      setLoanAppDocs([]);
      fetchData();
      if (loanTypeId) fetchEligibility(loanTypeId);
    } catch (err: any) {
      triggerMessage(err.message, "error");
    }
  };

  const handlePayLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const loanToPay =
      payLoanId || activeLoans.find((l) => l.status === "ACTIVE")?.id;
    if (!loanToPay || !payAmount || Number(payAmount) <= 0) return;

    try {
      const res = await fetch("/api/loans/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          loanId: loanToPay,
          amount: Number(payAmount),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      triggerMessage(data.message);
      setPayAmount("");
      fetchData();
    } catch (err: any) {
      triggerMessage(err.message, "error");
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquirySubject || !inquiryMessage) return;

    try {
      const res = await fetch("/api/inquiries/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: inquirySubject,
          message: inquiryMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      triggerMessage(
        "Inquiry successfully logged! Our cooperative officers have been notified.",
      );
      setInquirySubject("");
      setInquiryMessage("");
      fetchData();
    } catch (err: any) {
      triggerMessage(err.message, "error");
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText || !activeInquiryId) return;

    try {
      const res = await fetch(`/api/inquiries/reply/${activeInquiryId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: replyText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReplyText("");
      fetchInquiryDetails(activeInquiryId);
    } catch (err: any) {
      triggerMessage(err.message, "error");
    }
  };

  const handleInquiryResolve = async (id: string) => {
    try {
      const res = await fetch(`/api/inquiries/resolve/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerMessage("Inquiry closed successfully!");
        if (activeInquiryId === id) {
          fetchInquiryDetails(id);
        }
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openReceiptForLoan = async (loan: any) => {
    if (!loan) return;
    const targetId = loan.id || loan.applicationId;
    try {
      const res = await fetch(`/api/receipts/${encodeURIComponent(targetId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const receipt = await res.json();
        setSelectedReceiptForModal(receipt);
        return;
      }

      // Try dedicated loan endpoint
      const loanRes = await fetch(
        `/api/loans/${encodeURIComponent(targetId)}/receipt`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (loanRes.ok) {
        const receipt = await loanRes.json();
        setSelectedReceiptForModal(receipt);
        return;
      }

      const errData = await loanRes.json().catch(() => ({}));
      if (errData.status === "NOT_RELEASED") {
        triggerMessage(
          "Receipt not yet generated. Loan has not been released yet.",
          "error",
        );
        return;
      }

      // Fallback search in receipts array
      const found = receipts.find(
        (r) =>
          r.loanId === targetId ||
          r.applicationId === targetId ||
          r.transactionId === targetId ||
          r.loanNumber === targetId,
      );

      if (found) {
        setSelectedReceiptForModal(found);
      } else {
        triggerMessage("Receipt not yet generated.", "error");
      }
    } catch (e) {
      console.error("Error fetching loan receipt:", e);
      triggerMessage("Error fetching receipt details.", "error");
    }
  };

  const extractGcashRefNumber = (rc: any, loan?: any) => {
    if (loan?.transactionReferenceNumber)
      return loan.transactionReferenceNumber;
    if (rc?.paymentReference) {
      if (rc.paymentReference.includes("GCASH")) {
        const parts = rc.paymentReference.split("-");
        if (parts.length >= 3) return parts.slice(2).join("-");
      }
      return rc.paymentReference;
    }
    if (rc?.remarks) {
      const match = rc.remarks.match(/Ref:\s*([A-Z0-9-]+)/i);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      triggerMessage("Your security password has been changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      triggerMessage(err.message, "error");
    }
  };

  // Personal GCash Payout Information Handlers
  const handleSaveMemberGcash = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMemberGcash(true);
    try {
      const res = await fetch("/api/members/me/gcash-info", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gcashNumber: memberGcashNum,
          gcashAccountName: memberGcashName,
          gcashQrCodeUrl: memberGcashQr,
        }),
      });
      const d = await res.json();
      if (!res.ok)
        throw new Error(d.error || "Failed to save GCash payout details.");

      if (d.member) {
        setMemberGcashName(d.member.gcashAccountName || memberGcashName);
        setMemberGcashNum(d.member.gcashNumber || memberGcashNum);
        setMemberGcashQr(
          d.member.gcashQrCodeUrl !== undefined
            ? d.member.gcashQrCodeUrl
            : memberGcashQr,
        );
      }
      triggerMessage("Personal GCash payout details saved successfully!");
      fetchData();
    } catch (err: any) {
      triggerMessage(err.message, "error");
    } finally {
      setIsSavingMemberGcash(false);
    }
  };

  const handleMemberQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i)) {
      triggerMessage(
        "Invalid image format. Only PNG, JPG, JPEG, and WebP are allowed.",
        "error",
      );
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      triggerMessage(
        "File size exceeds 15 MB. Please select a smaller image.",
        "error",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawResult = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 1000;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          setMemberGcashQr(compressed);
        } else {
          setMemberGcashQr(rawResult);
        }
      };
      img.onerror = () => {
        setMemberGcashQr(rawResult);
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveMemberQr = async () => {
    setMemberGcashQr("");
    try {
      const res = await fetch("/api/members/me/gcash-qr", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerMessage("Uploaded GCash QR Code removed successfully.");
        fetchData();
      }
    } catch (err) {
      console.error("Failed to delete member QR:", err);
    }
  };

  // Profile Picture Handlers
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      triggerMessage(
        "Invalid image format. Please select a JPG, JPEG, PNG, or WebP file.",
        "error",
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      triggerMessage(
        "File is too large. Maximum size allowed is 10MB.",
        "error",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/webp", 0.85);
          setAvatarPreview(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = async () => {
    if (!avatarPreview) return;
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/members/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarUrl: avatarPreview }),
      });

      const d = await res.json();
      if (!res.ok)
        throw new Error(d.error || "Failed to update profile picture");

      triggerMessage("Profile picture updated successfully!");
      if (onAvatarUpdate) onAvatarUpdate(d.avatarUrl);
      setAvatarPreview(null);
      fetchData();
    } catch (err: any) {
      triggerMessage(err.message, "error");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (
      !window.confirm("Are you sure you want to remove your profile picture?")
    )
      return;
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/members/avatar", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const d = await res.json();
      if (!res.ok)
        throw new Error(d.error || "Failed to remove profile picture");

      triggerMessage("Profile picture removed successfully.");
      if (onAvatarUpdate) onAvatarUpdate("");
      setAvatarPreview(null);
      fetchData();
    } catch (err: any) {
      triggerMessage(err.message, "error");
    } finally {
      setAvatarUploading(false);
    }
  };

  // Helper loan type mapping to show dynamically
  const selectedLoanTypeObj = loanTypes.find((t) => t.id === loanTypeId);

  // Simple Area Chart Mock History
  const ledgerHistoryChart = stats?.recentTransactions
    ? [...stats.recentTransactions].reverse().map((t: any, index: number) => ({
        name: t.createdAt
          ? new Date(t.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : `Tx ${index + 1}`,
        Amount:
          t.type === "DEPOSIT" ||
          t.type === "DIVIDEND_CREDIT" ||
          t.type === "LOAN_RELEASE"
            ? t.amount
            : -t.amount,
      }))
    : [];

  // --------------------------------------------------------
  // FINANCIAL LEDGER COMPUTATION (Running Balance & Filters)
  // --------------------------------------------------------
  const processedLedger = useMemo(() => {
    if (!savingsData?.transactions) return [];

    // 1. Sort from oldest to newest to compute running balance
    const sortedTx = [...savingsData.transactions].sort((a: any, b: any) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });

    let currentBalance = 0;

    const withBalance = sortedTx.map((tx: any) => {
      let debit = 0;
      let credit = 0;
      const txAmount = typeof tx.amount === "number" ? tx.amount : Number(tx.amount || 0);
      const isVoided = tx.status === "VOIDED";

      // If transaction is VOIDED, it must not affect running balance or active credit/debit
      if (!isVoided) {
        // Define what affects the Member's Savings/Equity Balance
        if (
          tx.type === "DEPOSIT" ||
          tx.type === "DIVIDEND_CREDIT" ||
          tx.type === "INITIAL_SHARE" ||
          tx.type === "SHARE_CAPITAL"
        ) {
          credit = txAmount;
          currentBalance += credit;
        } else if (tx.type === "WITHDRAWAL" || tx.type === "FEE") {
          debit = txAmount;
          currentBalance -= debit;
        } else {
          // For LOAN_RELEASE or LOAN_PAYMENT, it doesn't affect savings balance
          // We show the amount in Debit or Credit based on cash flow
          if (tx.type === "LOAN_RELEASE") {
            debit = txAmount; // Outflow
          } else if (tx.type === "LOAN_PAYMENT") {
            credit = txAmount; // Inflow
          }
        }
      }

      // Prefer authoritative stored running balance if present on transaction record
      const finalRunningBalance =
        typeof tx.runningBalance === "number"
          ? tx.runningBalance
          : typeof tx.balanceAfter === "number"
          ? tx.balanceAfter
          : currentBalance;

      return {
        ...tx,
        debit,
        credit,
        runningBalance: finalRunningBalance,
      };
    });

    // 2. Reverse back to newest first for display
    return withBalance.reverse();
  }, [savingsData?.transactions]);

  const filteredLedger = useMemo(() => {
    if (ledgerFilter === "ALL") return processedLedger;

    return processedLedger.filter((tx) => {
      const desc = tx.description?.toLowerCase() || "";
      if (ledgerFilter === "SHARE_CAPITAL") return desc.includes("share capital") || tx.type === "INITIAL_SHARE";
      if (ledgerFilter === "REGULAR_SAVINGS") return desc.includes("savings") && tx.type === "DEPOSIT";
      if (ledgerFilter === "TIME_DEPOSITS") return desc.includes("time deposit");
      if (ledgerFilter === "LOANS") return tx.type === "LOAN_RELEASE";
      if (ledgerFilter === "LOAN_PAYMENTS") return tx.type === "LOAN_PAYMENT";
      if (ledgerFilter === "DIVIDENDS") return tx.type === "DIVIDEND_CREDIT";
      if (ledgerFilter === "WITHDRAWALS") return tx.type === "WITHDRAWAL";
      return true;
    });
  }, [processedLedger, ledgerFilter]);

  // --------------------------------------------------------
  // RECEIPTS COMPUTATION (Filters)
  // --------------------------------------------------------
  const filteredReceipts = useMemo(() => {
    let baseReceipts = receipts;
    if (receiptsFilter !== "ALL") {
      baseReceipts = receipts.filter((r) => {
        if (receiptsFilter === "SHARE_CAPITAL") return r.paymentType === "SHARE_CAPITAL";
        if (receiptsFilter === "SAVINGS") return r.paymentType === "SAVINGS_DEPOSIT";
        if (receiptsFilter === "LOANS") return r.paymentType === "LOAN_PAYMENT" || r.paymentType === "LOAN_RELEASE";
        if (receiptsFilter === "WITHDRAWALS") return (r.paymentType as string) === "WITHDRAWAL" || r.paymentType === "OTHER";
        if (receiptsFilter === "GCASH") return r.paymentMethod === "GCASH";
        return true;
      });
    }
    return baseReceipts;
  }, [receipts, receiptsFilter]);

  const searchedReceipts = useMemo(() => {
    let list = filteredReceipts;
    if (receiptSearch.trim()) {
      const term = receiptSearch.toLowerCase().trim();
      list = list.filter((r) => {
        const rcNo = (r.receiptNumber || "").toLowerCase();
        const pType = (r.paymentType || "").toLowerCase();
        const pMethod = (r.paymentMethod || r.releaseMethod || "").toLowerCase();
        const ref = (r.paymentReference || r.transactionId || (r as any).reference || (r as any).referenceNumber || "").toLowerCase();
        return rcNo.includes(term) || pType.includes(term) || pMethod.includes(term) || ref.includes(term);
      });
    }
    return list;
  }, [filteredReceipts, receiptSearch]);

  // Active Loan & Next Payment computation for authoritative member overview
  const primaryActiveLoan = useMemo(() => {
    return (activeLoans || []).find((l: any) => l.status === "ACTIVE" && (l.balance || 0) > 0) || (activeLoans || [])[0] || null;
  }, [activeLoans]);

  const nextAmortizationItem = useMemo(() => {
    if (!primaryActiveLoan || !primaryActiveLoan.amortizationSchedule) return null;
    return primaryActiveLoan.amortizationSchedule.find((item: any) => item.status !== "PAID") || null;
  }, [primaryActiveLoan]);

  const nextPaymentStatus = useMemo(() => {
    if (!nextAmortizationItem) return null;
    if (nextAmortizationItem.status === "PAID") return "PAID";
    if (nextAmortizationItem.status === "PAST_DUE") return "OVERDUE";
    if (nextAmortizationItem.status === "DUE") return "DUE";
    if (nextAmortizationItem.dueDate) {
      const manilaTodayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());

      if (nextAmortizationItem.dueDate < manilaTodayStr) return "OVERDUE";
      if (nextAmortizationItem.dueDate === manilaTodayStr) return "DUE";

      const due = new Date(nextAmortizationItem.dueDate + 'T00:00:00+08:00');
      const today = new Date(manilaTodayStr + 'T00:00:00+08:00');
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
      if (diffDays <= 7) return "DUE";
    }
    return nextAmortizationItem.status || "UPCOMING";
  }, [nextAmortizationItem]);

  // Authoritative Compliance Status Helpers
  const pmesComplianceStatus = useMemo(() => {
    const mem = savingsData?.member;
    if (!mem) return "NOT_COMPLETED";
    if (mem.hasAttendedPreMembershipSeminar) return "COMPLETED";
    const rec = (mem.complianceRecords || []).find((r: any) => 
      r.requirementType === "PRE_MEMBERSHIP_SEMINAR" || 
      r.requirementType === "PMES" || 
      r.type === "PRE_MEMBERSHIP_SEMINAR" || 
      r.type === "PMES"
    );
    if (rec?.status === "COMPLETED" || rec?.status === "VERIFIED") return "COMPLETED";
    if (rec?.status === "PENDING" || rec?.status === "PENDING_VERIFICATION") return "PENDING_VERIFICATION";
    return (eligibilityData?.complianceDetails?.pmes?.status) || "NOT_COMPLETED";
  }, [savingsData?.member, eligibilityData]);

  const orientationComplianceStatus = useMemo(() => {
    const mem = savingsData?.member;
    if (!mem) return "NOT_COMPLETED";
    if (mem.loanOrientationCompleted) return "COMPLETED";
    const rec = (mem.complianceRecords || []).find((r: any) => 
      r.requirementType === "LOAN_ORIENTATION" || 
      r.requirementType === "ORIENTATION" || 
      r.type === "LOAN_ORIENTATION" || 
      r.type === "ORIENTATION"
    );
    if (rec?.status === "COMPLETED" || rec?.status === "VERIFIED") return "COMPLETED";
    if (rec?.status === "PENDING" || rec?.status === "PENDING_VERIFICATION") return "PENDING_VERIFICATION";
    return (eligibilityData?.complianceDetails?.orientation?.status) || "NOT_COMPLETED";
  }, [savingsData?.member, eligibilityData]);

  const initialShareStatus = useMemo(() => {
    const mem = savingsData?.member;
    if (!mem) return "NOT PAID";
    if (mem.initialShareCapitalPaid) return "VERIFIED / PAID";
    if (mem.initialShareCapitalPaymentMethod || mem.initialShareCapitalReference) return "PENDING VERIFICATION";
    return "NOT PAID";
  }, [savingsData?.member]);

  if (!stats || !savingsData.member) {
    return (
      <div className="flex-1 flex justify-center items-center h-screen bg-slate-50 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold font-mono tracking-wider">
            LOADING COOPERATIVE VAULT SECURELY...
          </p>
        </div>
      </div>
    );
  }

  const memberInfo = savingsData.member;

  if (!savingsData.member) {
    return (
      <div className="flex-1 min-h-[400px] flex items-center justify-center p-8 text-center" id="member-dashboard-loading">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-500 font-mono">LOADING MEMBER ACCOUNT SNAPSHOT...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 min-h-screen bg-slate-50/60 text-slate-900 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto"
      id="member-dashboard-view"
    >
      {/* Floating Status / Error Messages */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm rounded-xl p-4 shadow-xl border text-sm flex gap-3 items-start animate-bounce ${
            message.type === "success"
              ? "bg-white border-emerald-200 text-emerald-800 shadow-md shadow-emerald-900/5"
              : "bg-white border-rose-200 text-rose-800 shadow-md shadow-rose-900/5"
          }`}
          id="member-action-toast"
        >
          {message.type === "success" ? (
            <Check size={18} className="mt-0.5 text-emerald-600" />
          ) : (
            <AlertCircle size={18} className="mt-0.5 text-rose-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* GCash QR Payment Tab */}
      {(activeTab === "member-payments" || activeTab === "member-gcash" || activeTab === "payments") && (
        <GcashModule
          token={token}
          role="MEMBER"
          activeLoans={activeLoans}
          onRefreshStats={fetchData}
        />
      )}

      {/* =======================================================================
          TAB 1: MEMBER DASHBOARD
          ======================================================================= */}
      {(activeTab === "member-dashboard" || activeTab === "dashboard") && (
        <div className="space-y-6 animate-fade-in" id="tab-member-dashboard">
          {/* Friendly Error Notice */}
          {accountLoadError && (
            <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <span>{accountLoadError}</span>
              </div>
              <button
                onClick={() => {
                  setAccountLoadError(null);
                  fetchData();
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shrink-0 cursor-pointer transition-colors shadow-2xs"
              >
                Retry
              </button>
            </div>
          )}

          {/* =======================================================================
              1. MEMBERSHIP STATUS
              ======================================================================= */}
          <div className="bg-white border border-slate-200/90 shadow-xs rounded-2xl p-5 md:p-6 transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl border ${
                  savingsData.member?.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                    : savingsData.member?.status === "PENDING"
                    ? "bg-amber-50 text-amber-700 border-amber-200/70"
                    : "bg-rose-50 text-rose-700 border-rose-200/70"
                }`}>
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                      Welcome, {savingsData.member?.fullName || "Member"}
                    </h2>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono tracking-wider uppercase border ${
                      savingsData.member?.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : savingsData.member?.status === "PENDING"
                        ? "bg-amber-100 text-amber-800 border-amber-200"
                        : "bg-rose-100 text-rose-800 border-rose-200"
                    }`}>
                      {savingsData.member?.status === "ACTIVE"
                        ? "ACTIVE MEMBER"
                        : savingsData.member?.status === "PENDING"
                        ? "PENDING VERIFICATION"
                        : (savingsData.member?.status || "INACTIVE")}
                    </span>
                    {savingsData.member?.status === "ACTIVE" && savingsData.member?.isMigs !== false && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-teal-50 text-teal-700 border border-teal-200">
                        ✓ Member in Good Standing
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono mt-1.5">
                    <span>Member ID: <strong>{savingsData.member?.idNumber || savingsData.member?.id || "—"}</strong></span>
                    <span>•</span>
                    <span>Registered: {savingsData.member?.createdAt ? new Date(savingsData.member.createdAt).toLocaleDateString() : "—"}</span>
                    {savingsData.member?.membershipApprovedAt && (
                      <>
                        <span>•</span>
                        <span>Approved: {new Date(savingsData.member.membershipApprovedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto">
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("member-profile")}
                    className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <User size={14} /> Profile & Documents
                  </button>
                )}
              </div>
            </div>

            {/* Reassuring notice for pending members */}
            {savingsData.member?.status === "PENDING" && (
              <div className="mt-4 p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-3">
                <Clock className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-amber-900 space-y-0.5">
                  <p className="font-bold">Membership Verification in Progress</p>
                  <p className="text-amber-800 leading-relaxed">
                    Your membership application and submitted credentials are under review by cooperative staff. You will receive access to full savings deposits and loan products once your account has been approved.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* =======================================================================
              2. INITIAL SHARE CAPITAL PAYMENT STATUS
              ======================================================================= */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 md:p-6 transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">
                    Initial Share Capital Payment Status
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mandatory initial membership equity contribution. Distinguished from current cumulative Share Capital balance.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold font-mono tracking-wider uppercase border ${
                  initialShareStatus === "VERIFIED / PAID"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : initialShareStatus === "PENDING VERIFICATION"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-rose-100 text-rose-800 border-rose-200"
                }`}>
                  {initialShareStatus === "VERIFIED / PAID"
                    ? "✓ VERIFIED / PAID"
                    : initialShareStatus === "PENDING VERIFICATION"
                    ? "⏳ PENDING VERIFICATION"
                    : "NOT PAID"}
                </span>
              </div>
            </div>

            {/* Display State Details */}
            {initialShareStatus === "VERIFIED / PAID" ? (
              <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 font-mono">
                      Initial Share Capital: ₱{formatMoney(
                        savingsData?.member?.initialShareCapitalPledged ||
                        savingsData?.member?.initialShareCapital ||
                        2000
                      )}
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Your initial share capital contribution has been verified by staff and is officially credited to your Share Capital equity balance.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold font-mono text-emerald-700 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0 self-start sm:self-auto">
                  Authoritative Equity Credited
                </span>
              </div>
            ) : initialShareStatus === "PENDING VERIFICATION" ? (
              <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-3">
                <div className="flex items-start gap-3">
                  <Clock size={22} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-amber-950 font-mono">
                      Initial Share Capital: ₱{formatMoney(savingsData?.member?.initialShareCapitalPledged || 2000)} — Awaiting Verification
                    </h4>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Your payment details have been submitted and are queued for staff reconciliation. The amount will be officially credited to your Share Capital balance upon verification.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/60 font-mono text-xs text-amber-900 bg-white/70 p-3 rounded-lg">
                  <div>
                    <span className="text-[10px] text-amber-700 uppercase font-sans font-bold block">Payment Method</span>
                    <strong>{savingsData?.member?.initialShareCapitalPaymentMethod || "GCASH / CASH"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 uppercase font-sans font-bold block">Reference Number</span>
                    <strong>{savingsData?.member?.initialShareCapitalReference || "Submitted via Payment Request"}</strong>
                  </div>
                </div>
              </div>
            ) : (
              /* NOT PAID State with payment options */
              <div className="space-y-4">
                <div className="p-4 bg-rose-50/80 border border-rose-200/80 rounded-xl flex items-start gap-3">
                  <AlertCircle size={22} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-950 font-mono">
                      Initial Share Capital: ₱{formatMoney(savingsData?.member?.initialShareCapitalPledged || 2000)} (Not Paid)
                    </h4>
                    <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
                      To complete membership compliance and access cooperative loan and savings products, please submit your initial share capital contribution below.
                    </p>
                  </div>
                </div>

                {savingsData.member?.status === "ACTIVE" && (
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">
                      Select Payment Method:
                    </h4>
                    <div className="flex flex-wrap gap-4 text-xs font-medium">
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-500">
                        <input
                          type="radio"
                          name="initialSharePayment"
                          value="CASH"
                          checked={initialSharePaymentMethod === "CASH"}
                          onChange={() => setInitialSharePaymentMethod("CASH")}
                          className="text-emerald-600"
                        />
                        <span>Pay Cash at Cooperative Office</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-500">
                        <input
                          type="radio"
                          name="initialSharePayment"
                          value="GCASH"
                          checked={initialSharePaymentMethod === "GCASH"}
                          onChange={() => setInitialSharePaymentMethod("GCASH")}
                          className="text-emerald-600"
                        />
                        <span>Pay via GCash</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-500">
                        <input
                          type="radio"
                          name="initialSharePayment"
                          value="BANK_TRANSFER"
                          checked={initialSharePaymentMethod === "BANK_TRANSFER"}
                          onChange={() => setInitialSharePaymentMethod("BANK_TRANSFER")}
                          className="text-emerald-600"
                        />
                        <span>Bank Transfer</span>
                      </label>
                    </div>

                    {initialSharePaymentMethod === "GCASH" && (
                      <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 space-y-3">
                        <div className="flex flex-col text-sm text-sky-900 bg-white p-3 rounded-lg border border-sky-200">
                          <span className="font-bold text-[10px] text-slate-500 uppercase">Official Cooperative GCash Account:</span>
                          <span className="font-extrabold text-blue-700 font-mono text-base">{gcashConfig?.mobileNumber || "0917-888-2288"}</span>
                          <span className="text-xs text-slate-600">{gcashConfig?.accountName || "CCT COOPERATIVE INC."}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              GCash Reference Number *
                            </label>
                            <input
                              type="text"
                              value={initialShareReference}
                              onChange={(e) => setInitialShareReference(e.target.value)}
                              className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono bg-white"
                              placeholder="e.g. 10001234567"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Receipt Screenshot (Optional)
                            </label>
                            <input
                              type="file"
                              onChange={(e) => setInitialShareReceiptFile(e.target.files?.[0] || null)}
                              className="w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-100 file:text-sky-700"
                              accept="image/*"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {initialSharePaymentMethod === "BANK_TRANSFER" && (
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3">
                        <div className="flex flex-col text-sm text-indigo-900 bg-white p-3 rounded-lg border border-indigo-200">
                          <span className="font-bold text-[10px] text-slate-500 uppercase">Official Cooperative Bank Account:</span>
                          <span className="font-extrabold text-indigo-700 text-sm">{bankConfig?.bankName || "BDO Unibank"} — {bankConfig?.accountNumber || "001234567890"}</span>
                          <span className="text-xs text-slate-600">{bankConfig?.accountName || "CCT COOPERATIVE INC."}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Bank Reference / Trx No. *
                            </label>
                            <input
                              type="text"
                              value={initialShareReference}
                              onChange={(e) => setInitialShareReference(e.target.value)}
                              className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono bg-white"
                              placeholder="e.g. BDO-987654321"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Deposit Slip / Transfer Proof
                            </label>
                            <input
                              type="file"
                              onChange={(e) => setInitialShareReceiptFile(e.target.files?.[0] || null)}
                              className="w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700"
                              accept="image/*,application/pdf"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {initialSharePaymentMethod && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleInitialSharePayment}
                          disabled={isSubmittingInitialShare}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {isSubmittingInitialShare ? "Submitting..." : "Submit Payment Details"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-3 font-mono">
              Note: Only a financially posted and verified payment is credited to your authoritative Share Capital equity balance. Submitting a payment request creates a pending reconciliation record until verified by staff.
            </p>
          </div>

          {/* =======================================================================
              3. FINANCIAL BALANCES
              ======================================================================= */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm uppercase font-mono tracking-wider">
                Financial Balances
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                Authoritative Real-Time Cooperative Records
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Share Capital Balance */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-38 relative overflow-hidden group">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-500">
                      Share Capital
                    </span>
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded border border-slate-200">
                      READ ONLY
                    </span>
                  </div>
                  <div className="p-2 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200/60">
                    <Coins size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900">
                    ₱{formatMoney(stats?.shareCapital)}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    Member equity ownership balance
                  </p>
                </div>
              </div>

              {/* Regular Savings Balance */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-38 relative overflow-hidden group">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-500">
                      Regular Savings
                    </span>
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded border border-slate-200">
                      READ ONLY
                    </span>
                  </div>
                  <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                    <Wallet size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900">
                    ₱{formatMoney(stats?.regularSavings)}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Available withdrawable deposit balance
                  </p>
                </div>
              </div>

              {/* Time Deposits Balance */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-38 relative overflow-hidden group">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-500">
                      Time Deposits
                    </span>
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded border border-slate-200">
                      READ ONLY
                    </span>
                  </div>
                  <div className="p-2 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200/60">
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900">
                    ₱{formatMoney(stats?.timeDeposits)}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                    {timeDepositContracts.length > 0
                      ? `${timeDepositContracts.length} active contract(s)`
                      : "Fixed-term interest deposits"}
                  </p>
                </div>
              </div>

              {/* Active Loan Balance */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between h-38 relative overflow-hidden group">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-500">
                      Active Loan Balance
                    </span>
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded border border-slate-200">
                      READ ONLY
                    </span>
                  </div>
                  <div className={`p-2 rounded-2xl border ${
                    (stats?.activeLoansBalance || 0) > 0
                      ? "bg-rose-50 text-rose-600 border-rose-200/60"
                      : "bg-slate-50 text-slate-500 border-slate-200/60"
                  }`}>
                    <CreditCard size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900">
                    ₱{formatMoney(stats?.activeLoansBalance || 0)}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                    {(stats?.activeLoansBalance || 0) > 0 ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        {stats?.activeLoansCount || 1} active loan contract(s) outstanding
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Zero outstanding loan liability
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* =======================================================================
              4. ACTIVE LOAN / NEXT PAYMENT
              ======================================================================= */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 md:p-6 transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Active Loan & Repayment Schedule
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Amortization Management
              </span>
            </div>

            {/* Empty State vs Active Loan Details */}
            {!primaryActiveLoan || (stats?.activeLoansBalance || 0) <= 0 ? (
              <div className="p-8 bg-slate-50/70 border border-slate-200 rounded-xl text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-base">No Active Loan</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    You currently have no released loan. Explore cooperative loan programs with affordable interest rates, flexible terms, and automated amortization schedules.
                  </p>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("member-loans")}
                    className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    Explore Loan Programs →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Loan Contract Overview */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500">
                        Loan Contract
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold font-mono uppercase bg-emerald-100 text-emerald-800">
                        {primaryActiveLoan.status || "ACTIVE"}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">
                        {primaryActiveLoan.loanTypeName || primaryActiveLoan.type || "Cooperative Loan"}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Ref: {primaryActiveLoan.id}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Outstanding Balance</span>
                        <span className="text-sm font-bold text-rose-600 font-mono">
                          ₱{formatMoney(primaryActiveLoan.balance || stats?.activeLoansBalance)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Principal Released</span>
                        <span className="text-sm font-bold text-slate-800 font-mono">
                          ₱{formatMoney(primaryActiveLoan.amount || primaryActiveLoan.principalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Next Installment Details */}
                  <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-emerald-800">
                          Next Installment Schedule
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold font-mono uppercase ${
                          nextPaymentStatus === "OVERDUE"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : nextPaymentStatus === "DUE"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-sky-100 text-sky-800 border border-sky-200"
                        }`}>
                          {nextPaymentStatus || "UPCOMING"}
                        </span>
                      </div>

                      {nextAmortizationItem ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs font-bold text-slate-700">
                              Installment #{nextAmortizationItem.installmentNo}
                            </span>
                            <span className="text-xl font-bold font-mono text-slate-900">
                              ₱{formatMoney(
                                nextAmortizationItem.remainingAmount !== undefined
                                  ? nextAmortizationItem.remainingAmount
                                  : (nextAmortizationItem.scheduledAmount - (nextAmortizationItem.amountPaid || 0))
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-600 font-mono pt-1">
                            <span>Due Date:</span>
                            <strong>
                              {nextAmortizationItem.dueDate ? new Date(nextAmortizationItem.dueDate).toLocaleDateString() : "—"}
                            </strong>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-emerald-800 font-medium">
                          All current installments have been settled. No pending installment due.
                        </div>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-emerald-200/60">
                      <button
                        onClick={() => setSelectedLoanForScheduleModal(primaryActiveLoan)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Calendar size={13} /> View Amortization
                      </button>
                      {nextAmortizationItem && (
                        <button
                          onClick={() => {
                            setSelectedLoanForPayModal(primaryActiveLoan);
                            setSelectedTargetInstallment(nextAmortizationItem);
                          }}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                        >
                          <CreditCard size={13} /> Pay Installment
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Workflow Notice:</strong> Loan Amortization represents your contractual repayment schedule. Submitting an installment payment creates a Payment Request that is verified and reconciled by staff before updating your schedule and issuing your Official Receipt.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* =======================================================================
              5. COMPLIANCE & LOAN ELIGIBILITY
              ======================================================================= */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 md:p-6 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <GraduationCap size={18} className="text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">
                    Loan Eligibility & Compliance Checklist
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Understand all cooperative requirements for loan applications. Transparent policy verification ensures equitable credit access.
                </p>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("member-loans")}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline self-start sm:self-auto cursor-pointer"
                >
                  Explore Loan Programs →
                </button>
              )}
            </div>

            {/* Checklist of 10 Requirements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 1. Active Membership */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                savingsData.member?.status === "ACTIVE"
                  ? "bg-emerald-50/50 border-emerald-200/70"
                  : "bg-rose-50/50 border-rose-200/70"
              }`}>
                {savingsData.member?.status === "ACTIVE" ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Active Membership</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {savingsData.member?.status === "ACTIVE" ? "PASSED" : "PENDING"}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    {savingsData.member?.status === "ACTIVE"
                      ? "Member account is approved and in active status."
                      : "Account verification by staff is required before applying."}
                  </p>
                </div>
              </div>

              {/* 2. Pre-Membership Seminar (PMES) */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                pmesComplianceStatus === "COMPLETED"
                  ? "bg-emerald-50/50 border-emerald-200/70"
                  : pmesComplianceStatus === "PENDING_VERIFICATION"
                  ? "bg-amber-50/50 border-amber-200/70"
                  : "bg-rose-50/50 border-rose-200/70"
              }`}>
                {pmesComplianceStatus === "COMPLETED" ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : pmesComplianceStatus === "PENDING_VERIFICATION" ? (
                  <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Pre-Membership Education Seminar (PMES)</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {pmesComplianceStatus === "COMPLETED" ? "PASSED" : pmesComplianceStatus === "PENDING_VERIFICATION" ? "PENDING REVIEW" : "REQUIRED"}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    {pmesComplianceStatus === "COMPLETED"
                      ? "Mandatory cooperative PMES seminar attended & verified."
                      : pmesComplianceStatus === "PENDING_VERIFICATION"
                      ? "Attendance submitted, currently awaiting staff verification."
                      : "Mandatory seminar required prior to loan application."}
                  </p>
                </div>
              </div>

              {/* 3. Loan Orientation & Credit Counseling */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                orientationComplianceStatus === "COMPLETED"
                  ? "bg-emerald-50/50 border-emerald-200/70"
                  : orientationComplianceStatus === "PENDING_VERIFICATION"
                  ? "bg-amber-50/50 border-amber-200/70"
                  : "bg-rose-50/50 border-rose-200/70"
              }`}>
                {orientationComplianceStatus === "COMPLETED" ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : orientationComplianceStatus === "PENDING_VERIFICATION" ? (
                  <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Loan Orientation & Credit Counseling</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {orientationComplianceStatus === "COMPLETED" ? "PASSED" : orientationComplianceStatus === "PENDING_VERIFICATION" ? "PENDING REVIEW" : "REQUIRED"}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    {orientationComplianceStatus === "COMPLETED"
                      ? "Credit counseling & loan orientation verified."
                      : orientationComplianceStatus === "PENDING_VERIFICATION"
                      ? "Attendance submitted, awaiting staff review."
                      : "Required counseling seminar before loan release."}
                  </p>
                </div>
              </div>

              {/* 4. Minimum Membership Tenure */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Minimum Membership Tenure</span>
                    <span className="font-mono text-[10px] text-slate-500">SATISFIED</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    Account satisfies cooperative duration guidelines for loan applications.
                  </p>
                </div>
              </div>

              {/* 5. Minimum Share Capital */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                (stats?.shareCapital || 0) >= 2000
                  ? "bg-emerald-50/50 border-emerald-200/70"
                  : "bg-rose-50/50 border-rose-200/70"
              }`}>
                {(stats?.shareCapital || 0) >= 2000 ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Minimum Share Capital</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {(stats?.shareCapital || 0) >= 2000 ? "PASSED" : "INSUFFICIENT"}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    {(stats?.shareCapital || 0) >= 2000
                      ? `Current balance: ₱${formatMoney(stats?.shareCapital)}. Required minimum equity maintained.`
                      : `Current balance: ₱${formatMoney(stats?.shareCapital)}. Minimum ₱2,000 share capital equity required.`}
                  </p>
                </div>
              </div>

              {/* 6. Member in Good Standing (MIGS) */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                savingsData.member?.isMigs !== false
                  ? "bg-emerald-50/50 border-emerald-200/70"
                  : "bg-rose-50/50 border-rose-200/70"
              }`}>
                {savingsData.member?.isMigs !== false ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Member in Good Standing (MIGS)</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {savingsData.member?.isMigs !== false ? "PASSED" : "FLAGGED"}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    {savingsData.member?.isMigs !== false
                      ? "Account in good standing with zero disciplinary holds."
                      : "Account has pending review holds."}
                  </p>
                </div>
              </div>

              {/* 7. No Overdue Loan */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                nextPaymentStatus !== "OVERDUE"
                  ? "bg-emerald-50/50 border-emerald-200/70"
                  : "bg-rose-50/50 border-rose-200/70"
              }`}>
                {nextPaymentStatus !== "OVERDUE" ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>No Overdue Loan</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {nextPaymentStatus !== "OVERDUE" ? "PASSED" : "PAST DUE"}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    {nextPaymentStatus !== "OVERDUE"
                      ? "No delinquent or past-due installments on record."
                      : "Past-due installment detected. Must be settled before new loans."}
                  </p>
                </div>
              </div>

              {/* 8. Borrowing Capacity */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Borrowing Capacity</span>
                    <span className="font-mono text-[10px] text-slate-500">CALCULATED</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    Computed based on proof of income and cooperative debt-to-income limits.
                  </p>
                </div>
              </div>

              {/* 9. No Duplicate Active Application */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                !eligibilityData?.duplicateApplication
                  ? "bg-emerald-50/50 border-emerald-200/70"
                  : "bg-amber-50/50 border-amber-200/70"
              }`}>
                {!eligibilityData?.duplicateApplication ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>No Duplicate Active Application</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {!eligibilityData?.duplicateApplication ? "PASSED" : "ACTIVE APP"}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    {!eligibilityData?.duplicateApplication
                      ? "No conflicting applications under review."
                      : "An application is already currently pending review."}
                  </p>
                </div>
              </div>

              {/* 10. One Active Outstanding Loan Policy */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                (stats?.activeLoansBalance || 0) <= 0
                  ? "bg-emerald-50/50 border-emerald-200/70"
                  : "bg-slate-50 border-slate-200"
              }`}>
                {(stats?.activeLoansBalance || 0) <= 0 ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Clock size={18} className="text-slate-500 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>No Active Outstanding Loan</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {(stats?.activeLoansBalance || 0) <= 0 ? "PASSED" : "LOAN ACTIVE"}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    {(stats?.activeLoansBalance || 0) <= 0
                      ? "Zero active loans. Fully eligible for new loan applications."
                      : `Active ${primaryActiveLoan?.loanTypeName || "loan"} with balance ₱${formatMoney(stats?.activeLoansBalance)}. Existing loan must be fully paid prior to applying for new released loans.`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* =======================================================================
              6. RECENT TRANSACTIONS (RECENT ACTIVITY)
              ======================================================================= */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 md:p-6 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Recent Activity & Transactions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Your recent deposits, capital contributions, loan payments, and withdrawals.
                  </p>
                </div>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("member-ledger")}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                >
                  View Full Statement →
                </button>
              )}
            </div>

            {/* Compact Transactions List */}
            {processedLedger.length === 0 ? (
              <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <Receipt size={28} className="text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No savings transactions yet.</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transactions will appear here once deposits or contributions are posted.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-mono text-[10px] uppercase font-bold">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processedLedger.slice(0, 6).map((t: any) => {
                      const isVoid = t.status === "VOIDED";
                      const debitVal = typeof t.debit === "number" ? t.debit : Number(t.debit || 0);
                      const creditVal = typeof t.credit === "number" ? t.credit : Number(t.credit || 0);
                      const isCredit = creditVal > 0;
                      const refNo = t.referenceId || t.externalReference || t.referenceNumber || t.officialReceiptNumber || t.id || "—";
                      return (
                        <tr key={t.id} className={`hover:bg-slate-50/60 transition-colors ${isVoid ? "opacity-60 bg-rose-50/30" : ""}`}>
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                              isVoid ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-slate-100 border border-slate-200 text-slate-700"
                            }`}>
                              {t.type || "TRANSACTION"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {t.description || "Financial Transaction"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {refNo}
                          </td>
                          <td className={`py-2.5 px-3 font-mono font-bold text-right whitespace-nowrap ${
                            isVoid ? "text-slate-400 line-through" : isCredit ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {isVoid
                              ? formatCurrency(t.amount || 0)
                              : isCredit
                              ? `+${formatCurrency(creditVal)}`
                              : `-${formatCurrency(debitVal)}`}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                              isVoid ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>
                              {t.status || "POSTED"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* =======================================================================
              7. RECENT OFFICIAL RECEIPTS
              ======================================================================= */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 md:p-6 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Recent Official Receipts
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official receipts issued for your deposits, payments, and capital contributions. Read-only for member security.
                  </p>
                </div>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("member-loan-receipts")}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                >
                  Receipts Vault →
                </button>
              )}
            </div>

            {receipts.length === 0 ? (
              <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <Receipt size={28} className="text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Official Receipts</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official receipts will appear here after a financial transaction is successfully posted.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase bg-slate-50/80">
                      <th className="py-2.5 px-3">Receipt #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipts.slice(0, 5).map((r, idx) => {
                      const amtPaid = r.amountPaid ?? (r as any).amount ?? (r as any).principalAmount ?? 0;
                      const ref = r.paymentReference || r.transactionId || (r as any).reference || (r as any).referenceNumber || "—";
                      return (
                        <tr key={r.id || r.receiptNumber || `rcpt-rec-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {r.receiptNumber || "N/A"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono whitespace-nowrap">
                            {r.paymentDate || (r as any).issuedAt?.split("T")[0] || "—"}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                            {r.paymentType === "SAVINGS_DEPOSIT"
                              ? "Savings Deposit"
                              : r.paymentType === "SHARE_CAPITAL"
                              ? "Share Capital"
                              : r.paymentType === "LOAN_PAYMENT"
                              ? "Loan Payment"
                              : r.paymentType === "LOAN_RELEASE"
                              ? "Loan Release"
                              : r.paymentType || "Transaction"}
                          </td>
                          <td className="py-2.5 px-3 font-bold font-mono text-emerald-700 text-right whitespace-nowrap">
                            {formatCurrency(amtPaid)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-semibold border border-slate-200">
                              {r.paymentMethod || r.releaseMethod || "CASH"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {ref}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => setSelectedReceiptForModal(r)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[10px] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye size={11} /> View / Print
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* =======================================================================
              8. QUICK ACTIONS
              ======================================================================= */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 md:p-6 transition-all">
            <div className="mb-3">
              <h3 className="font-bold text-slate-900 text-sm uppercase font-mono tracking-wider">
                Quick Actions
              </h3>
              <p className="text-xs text-slate-500">
                Shortcuts tailored to your current account status and cooperative activities.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Contextual Action: Initial Share Not Paid */}
              {initialShareStatus === "NOT PAID" && (
                <button
                  onClick={() => {
                    const el = document.getElementById("tab-member-dashboard");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-left transition-colors cursor-pointer flex flex-col justify-between"
                >
                  <ShieldCheck size={18} className="text-rose-600 mb-1" />
                  <span className="text-xs font-bold text-rose-900">Pay Initial Share</span>
                  <span className="text-[10px] text-rose-700">Activate account</span>
                </button>
              )}

              {/* Contextual Action: Initial Share Pending Verification */}
              {initialShareStatus === "PENDING VERIFICATION" && (
                <button
                  onClick={() => {
                    const el = document.getElementById("tab-member-dashboard");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-left transition-colors cursor-pointer flex flex-col justify-between"
                >
                  <Clock size={18} className="text-amber-600 mb-1" />
                  <span className="text-xs font-bold text-amber-900">View Payment Status</span>
                  <span className="text-[10px] text-amber-700">Pending verification</span>
                </button>
              )}

              {/* Contextual Action: Active Loan vs Explore Loan Programs */}
              {primaryActiveLoan && (stats?.activeLoansBalance || 0) > 0 ? (
                <>
                  <button
                    onClick={() => setSelectedLoanForScheduleModal(primaryActiveLoan)}
                    className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-left transition-colors cursor-pointer flex flex-col justify-between"
                  >
                    <Calendar size={18} className="text-emerald-600 mb-1" />
                    <span className="text-xs font-bold text-emerald-900">View Amortization</span>
                    <span className="text-[10px] text-emerald-700">Repayment schedule</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedLoanForPayModal(primaryActiveLoan);
                      setSelectedTargetInstallment(nextAmortizationItem);
                    }}
                    className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-left transition-colors cursor-pointer flex flex-col justify-between"
                  >
                    <CreditCard size={18} className="text-emerald-600 mb-1" />
                    <span className="text-xs font-bold text-emerald-900">Pay Installment</span>
                    <span className="text-[10px] text-emerald-700">Monthly loan due</span>
                  </button>
                </>
              ) : (
                onNavigate && (
                  <button
                    onClick={() => onNavigate("member-loans")}
                    className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-left transition-colors cursor-pointer flex flex-col justify-between"
                  >
                    <CreditCard size={18} className="text-emerald-600 mb-1" />
                    <span className="text-xs font-bold text-emerald-900">Explore Loan Programs</span>
                    <span className="text-[10px] text-emerald-700">Apply for credit</span>
                  </button>
                )
              )}

              {/* Make Payment Request */}
              {onNavigate && (
                <button
                  onClick={() => onNavigate("member-payments")}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors cursor-pointer flex flex-col justify-between"
                >
                  <Send size={18} className="text-slate-700 mb-1" />
                  <span className="text-xs font-bold text-slate-800">Make Payment Request</span>
                  <span className="text-[10px] text-slate-500">GCash / bank transfer</span>
                </button>
              )}

              {/* View Savings */}
              {onNavigate && (
                <button
                  onClick={() => onNavigate("member-savings")}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors cursor-pointer flex flex-col justify-between"
                >
                  <Wallet size={18} className="text-slate-700 mb-1" />
                  <span className="text-xs font-bold text-slate-800">View Savings</span>
                  <span className="text-[10px] text-slate-500">Savings & deposits</span>
                </button>
              )}

              {/* View Statement */}
              {onNavigate && (
                <button
                  onClick={() => onNavigate("member-ledger")}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors cursor-pointer flex flex-col justify-between"
                >
                  <FileText size={18} className="text-slate-700 mb-1" />
                  <span className="text-xs font-bold text-slate-800">View Statement</span>
                  <span className="text-[10px] text-slate-500">Statement of Account</span>
                </button>
              )}

              {/* View Receipts */}
              {onNavigate && (
                <button
                  onClick={() => onNavigate("member-loan-receipts")}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors cursor-pointer flex flex-col justify-between"
                >
                  <Receipt size={18} className="text-slate-700 mb-1" />
                  <span className="text-xs font-bold text-slate-800">View Receipts</span>
                  <span className="text-[10px] text-slate-500">Official receipts</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: MEMBER SAVINGS
          ======================================================================= */}
      {(activeTab === "member-savings" || activeTab === "member-share-capital") && (
        <div className="space-y-6 animate-fade-in" id="tab-member-savings">
          {/* Card detailing three Savings accounts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Share Capital */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="bg-purple-50 text-purple-600 p-2.5 rounded-2xl border border-purple-100">
                  <Coins size={22} />
                </div>
                <span className="text-[10px] font-bold text-purple-750 bg-purple-50 border border-purple-150 px-2 py-0.5 rounded-full uppercase tracking-widest font-mono">
                  Share Capital
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold font-mono tracking-tight text-slate-800">
                  ₱
                  {formatMoney(savingsData?.member?.shareCapital)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  This represents your equity ownership in the cooperative
                  union. It acts as collateral for loans and earns annual
                  dividends computed from net surplus.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <div>
                  <span>Withdrawable:</span>
                  <span className="text-rose-500 font-bold ml-1">
                    Membership Cessation Only
                  </span>
                </div>
                {savingsData.member.initialShareCapitalPaid && (
                  <button
                    type="button"
                    onClick={() => {
                      setDepositAccount("shareCapital");
                      setDepositModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowDownLeft size={13} /> Add Share Capital
                  </button>
                )}
              </div>
            </div>

            {/* Regular Savings */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl border border-emerald-100">
                  <Wallet size={22} />
                </div>
                {savingsData.member.initialShareCapitalPaid ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-widest font-mono">
                    Open for Deposits
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-widest font-mono">
                    Pending Membership
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-2xl font-bold font-mono tracking-tight text-slate-800">
                  ₱
                  {formatMoney(savingsData?.member?.regularSavings)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Your core liquid interest-bearing account.
                  {savingsData.member.initialShareCapitalPaid ? " Active and ready for instant deposits and withdrawals." : " Requires verified Initial Share Capital payment to activate."}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                <div className="text-[10px] text-slate-400 font-mono">
                  <span>Withdrawable:</span>
                  <span className="text-emerald-600 font-bold ml-1">
                    Instant Liquid
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDepositModalOpen(true)}
                    disabled={!savingsData.member.initialShareCapitalPaid}
                    className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => setWithdrawalModalOpen(true)}
                    disabled={!savingsData.member.initialShareCapitalPaid || (savingsData.member.regularSavings || 0) <= 0}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-700 disabled:opacity-40 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            </div>

            {/* Time Deposits */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="bg-sky-50 text-sky-600 p-2.5 rounded-2xl border border-sky-100">
                  <TrendingUp size={22} />
                </div>
                {timeDepositContracts.filter(c => c.status === 'ACTIVE').length > 0 ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-widest font-mono">
                    {timeDepositContracts.filter(c => c.status === 'ACTIVE').length} Active Contract(s)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full uppercase tracking-widest font-mono">
                    Available to Open
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-2xl font-bold font-mono tracking-tight text-slate-800">
                  ₱
                  {formatMoney(savingsData?.member?.timeDeposits)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  High-yield fixed term placement product. Generates up to 7.5% p.a. guaranteed returns.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                <div className="text-[10px] text-slate-400 font-mono">
                  <span>Withdrawable:</span>
                  <span className="text-amber-600 font-bold ml-1">
                    At Maturity
                  </span>
                </div>
                <button
                  onClick={() => setOpenTdModalOpen(true)}
                  disabled={!savingsData.member.initialShareCapitalPaid}
                  className="px-3 py-1.5 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus size={12} />
                  Open Time Deposit
                </button>
              </div>
            </div>
          </div>

          {/* Time Deposit Contracts Section */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">
                  Time Deposit Contracts
                </h3>
                <p className="text-xs text-slate-500">
                  Manage your active and completed high-yield fixed placements.
                </p>
              </div>
              <button
                onClick={() => setOpenTdModalOpen(true)}
                disabled={!savingsData?.member?.initialShareCapitalPaid}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                Open New Placement
              </button>
            </div>

            {timeDepositContracts.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center">
                <TrendingUp size={32} className="mx-auto text-purple-400 mb-2" />
                <h4 className="font-bold text-slate-700 text-sm mb-1">No Active Time Deposit Contracts</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  {savingsData?.member?.initialShareCapitalPaid
                    ? "You have no open Time Deposit contracts. Open a fixed-term placement starting at ₱1,000 funded directly from your Regular Savings."
                    : "Complete and verify your Initial Share Capital payment first to become eligible for Time Deposit placements."}
                </p>
                {savingsData?.member?.initialShareCapitalPaid && (
                  <button
                    onClick={() => setOpenTdModalOpen(true)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    Open Time Deposit Contract
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-3">Contract ID</th>
                      <th className="py-3 px-3">Principal</th>
                      <th className="py-3 px-3">Term / Rate</th>
                      <th className="py-3 px-3">Opening Date</th>
                      <th className="py-3 px-3">Maturity Date</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-mono">
                    {timeDepositContracts.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-800">
                          #{c.id.substring(0, 8).toUpperCase()}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {formatCurrency(c.principalAmount ?? (c as any).amount ?? 0)}
                        </td>
                        <td className="py-3 px-3 text-purple-700 font-bold">
                          {c.termMonths} Mos @ {(c.interestRate * 100).toFixed(1)}% p.a.
                        </td>
                        <td className="py-3 px-3 text-slate-600">{c.openingDate}</td>
                        <td className="py-3 px-3 text-slate-600">{c.maturityDate}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              c.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : c.status === "MATURED"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {c.status === "ACTIVE" || c.status === "MATURED" ? (
                            <button
                              onClick={() => handleCloseTimeDeposit(c.id)}
                              className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Close / Payout
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Settled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Interactive Balance Sheet */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <h3 className="font-bold text-slate-800 mb-4">
              Total Liquid Savings Visual Breakdown
            </h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: "Regular Savings",
                      Balance: savingsData.member.regularSavings,
                    },
                    {
                      name: "Share Capital",
                      Balance: savingsData.member.shareCapital,
                    },
                    {
                      name: "Time Deposits",
                      Balance: savingsData.member.timeDeposits,
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#e2e8f0",
                      color: "#1e293b",
                    }}
                  />
                  <Bar
                    dataKey="Balance"
                    fill="#4f46e5"
                    radius={[10, 10, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: MEMBER LOANS (APPLY & ELIGIBILITY CENTER)
          ======================================================================= */}
      {activeTab === "member-loans" && (
        <div className="space-y-6 animate-fade-in" id="tab-member-loans">
          {loanTypeId && eligibilityData && (
            <div
              className={`bg-white border ${eligibilityData.isEligible ? "border-green-200 shadow-green-100" : "border-red-200 shadow-red-100"} shadow-sm rounded-2xl p-6 mb-6 space-y-4`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                    <ShieldCheck
                      size={18}
                      className={
                        eligibilityData.isEligible
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    />
                    Pre-Application Eligibility Summary
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Real-time assessment against cooperative policies.
                  </p>
                </div>
                <div
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${eligibilityData.isEligible ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
                >
                  {eligibilityData.isEligible
                    ? "Eligible to Apply"
                    : "Not Eligible"}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {eligibilityData.checks.map((check: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border ${check.passed ? "border-slate-100 bg-slate-50" : "border-red-100 bg-red-50"}`}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      {check.passed ? (
                        <CheckCircle2
                          size={14}
                          className="text-green-600 mt-0.5 shrink-0"
                        />
                      ) : (
                        <XCircle
                          size={14}
                          className="text-red-600 mt-0.5 shrink-0"
                        />
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-700">
                          {check.title}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                          {check.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculator & Application Form */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                  <Calculator size={18} className="text-emerald-600" />
                  Loan Program Application & Amortization Calculator
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a loan product, enter borrowing parameters, and upload
                  required supporting documents. Applications transition
                  immediately to <strong>Pending Review</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                <QrCode size={14} className="text-blue-600" />
                <span>
                  Looking to repay a loan? Use <strong>GCash QR Payment</strong>{" "}
                  in sidebar
                </span>
              </div>
            </div>

            <form onSubmit={handleApplyLoan} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                {/* Select Loan Product Dropdown */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                    Select Loan Product
                  </label>
                  <select
                    value={loanTypeId}
                    onChange={(e) => {
                      setLoanTypeId(e.target.value);
                      const selected = loanTypes.find(
                        (t) => t.id === e.target.value,
                      );
                      if (selected && selected.maxDurationMonths) {
                        setLoanDuration(selected.maxDurationMonths.toString());
                      }
                    }}
                    className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-semibold"
                  >
                    {loanTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({(t.interestRate * 100).toFixed(1)}% int. • Max ₱
                        {formatNumber(t.maxAmount || 0)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Desired Amount */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                    Desired Loan Principal Amount (₱)
                  </label>
                  <input
                    type="number"
                    required
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="e.g., 25000"
                    className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono font-bold"
                  />
                  {selectedLoanTypeObj && (
                    <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                      Product Limits: Min ₱
                      {formatNumber(selectedLoanTypeObj.minAmount || 0)} •
                      Max ₱
                      {formatNumber(selectedLoanTypeObj.maxAmount || 0)}
                    </span>
                  )}
                </div>

                {/* Purpose */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                    Purpose of Loan Application
                  </label>
                  <select
                    value={loanPurpose}
                    onChange={(e) => setLoanPurpose(e.target.value)}
                    className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  >
                    <option value="Personal Need">Personal Need</option>
                    <option value="Emergency Expense">
                      Emergency Expense / Medical
                    </option>
                    <option value="Business Expansion">
                      Micro-Business Expansion
                    </option>
                    <option value="Educational / Tuition">
                      Educational / Tuition Fees
                    </option>
                    <option value="Home Improvement">
                      Home Improvement / Repair
                    </option>
                    <option value="Appliance Purchase">
                      Appliance / Vehicle Purchase
                    </option>
                    <option value="Agricultural Inputs">
                      Agricultural / Farm Inputs
                    </option>
                  </select>
                </div>

                {/* Co-Maker Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                    Co-Maker Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={coMakerName}
                    onChange={(e) => setCoMakerName(e.target.value)}
                    placeholder="Full name of guarantor member"
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  />
                </div>

                {/* Co-Maker Contact */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                    Co-Maker Contact Phone / Email
                  </label>
                  <input
                    type="text"
                    value={coMakerContact}
                    onChange={(e) => setCoMakerContact(e.target.value)}
                    placeholder="Phone number or email"
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  />
                </div>
              </div>

              {/* Live Amortization Computation Summary Box */}
              {selectedLoanTypeObj && loanAmount && Number(loanAmount) > 0 && (
                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 space-y-2.5 font-mono text-xs">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Live Amortization Computation Schedule
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">
                        Interest Rate
                      </span>
                      <span className="font-bold text-slate-900">
                        {((selectedLoanTypeObj?.interestRate || 0) * 100).toFixed(1)}% flat
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">
                        Total Borrowing Interest
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(
                          Number(loanAmount || 0) *
                          (selectedLoanTypeObj?.interestRate || 0) *
                          (Number(loanDuration || 1) / 12)
                        )}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">
                        Total Repayable Balance
                      </span>
                      <span className="font-bold text-emerald-800">
                        {formatCurrency(
                          Number(loanAmount || 0) +
                          Number(loanAmount || 0) *
                            (selectedLoanTypeObj?.interestRate || 0) *
                            (Number(loanDuration || 1) / 12)
                        )}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">
                        Monthly Installment
                      </span>
                      <span className="font-bold text-emerald-600 text-sm">
                        {formatCurrency(
                          Number(loanDuration) > 0
                            ? (Number(loanAmount || 0) +
                                Number(loanAmount || 0) *
                                  (selectedLoanTypeObj?.interestRate || 0) *
                                  (Number(loanDuration || 1) / 12)) /
                              Number(loanDuration)
                            : 0
                        )}{" "}
                        / mo
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Required Documents Upload Section */}
              {selectedLoanTypeObj && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wide flex items-center gap-1.5">
                      <Paperclip size={14} className="text-emerald-600" />
                      Required Supporting Verification Documents (
                      {selectedLoanTypeObj.name})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Please attach all required documents below. Your
                      application cannot be submitted until all listed document
                      requirements are attached.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(selectedLoanTypeObj.requiredDocuments || []).map(
                      (docType: string) => {
                        const attachedDoc = loanAppDocs.find(
                          (d) => d.documentType === docType,
                        );
                        return (
                          <div
                            key={docType}
                            className={`p-4 rounded-2xl border transition-all text-xs space-y-2 ${
                              attachedDoc
                                ? "bg-emerald-50/50 border-emerald-200"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                                {docType.replace(/_/g, " ")}
                              </span>
                              {attachedDoc ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                  <Check size={10} /> Attached
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-amber-100 text-amber-800">
                                  Required
                                </span>
                              )}
                            </div>

                            {attachedDoc ? (
                              <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-emerald-200 text-xs">
                                <div className="truncate max-w-[200px]">
                                  <span className="font-medium text-slate-800 block truncate">
                                    {attachedDoc.fileName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {(attachedDoc.fileSize / 1024).toFixed(1)}{" "}
                                    KB
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLoanDoc(docType)}
                                  className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-all cursor-pointer"
                                  title="Remove document"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <label className="border border-dashed border-slate-300 hover:border-indigo-400 bg-white p-3 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                                <Upload
                                  size={16}
                                  className="text-slate-400 mb-1"
                                />
                                <span className="text-[11px] font-semibold text-emerald-600">
                                  Click to upload document
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  PDF, PNG, JPG (Max 10MB)
                                </span>
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                      handleLoanDocUpload(docType, file);
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {/* 1. Account Status Requirement */}
              {savingsData.member && savingsData.member.status !== "ACTIVE" && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-1.5" id="loan-account-status-warning">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wider text-rose-800">
                        Account Status Ineligible
                      </h5>
                      <p className="text-xs text-rose-700 mt-0.5">
                        Member account status is currently &lsquo;{savingsData.member.status}&rsquo;. Only active, approved cooperative members can submit loan applications.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Mandatory Compliance Checklist (Evaluated Independently) */}
              {eligibilityData && (
                <div 
                  className={`border rounded-xl p-4 space-y-3 ${
                    eligibilityData.missingRequirements && eligibilityData.missingRequirements.length > 0 
                      ? "bg-amber-50/70 border-amber-200" 
                      : "bg-emerald-50/50 border-emerald-200"
                  }`} 
                  id="loan-compliance-checklist"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap 
                        size={16} 
                        className={
                          eligibilityData.missingRequirements && eligibilityData.missingRequirements.length > 0 
                            ? "text-amber-600" 
                            : "text-emerald-600"
                        } 
                      />
                      <h5 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                        {eligibilityData.missingRequirements && eligibilityData.missingRequirements.length > 0 
                          ? "Mandatory membership and educational requirements are incomplete." 
                          : "Mandatory Membership & Educational Compliance Satisfied"}
                      </h5>
                    </div>
                    <span 
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        eligibilityData.missingRequirements && eligibilityData.missingRequirements.length > 0 
                          ? "bg-amber-100 text-amber-800" 
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {eligibilityData.missingRequirements && eligibilityData.missingRequirements.length > 0 
                        ? `${eligibilityData.missingRequirements.length} Pending Requirement${eligibilityData.missingRequirements.length > 1 ? 's' : ''}` 
                        : "All Requirements Satisfied"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {/* PMES Item */}
                    {(() => {
                      const pmesInfo = eligibilityData.complianceDetails?.pmes;
                      const isMissing = eligibilityData.missingRequirements?.includes("PRE_MEMBERSHIP_SEMINAR");
                      const isVerified = pmesInfo?.completed || (!isMissing && pmesInfo?.status === 'VERIFIED');
                      const isPending = pmesInfo?.status === 'PENDING_VERIFICATION';
                      const isRejected = pmesInfo?.status === 'REJECTED';

                      return (
                        <div className={`p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          isVerified 
                            ? "bg-emerald-50/80 border-emerald-200 text-emerald-900" 
                            : isPending 
                            ? "bg-amber-50 border-amber-200 text-amber-900" 
                            : isRejected 
                            ? "bg-rose-50 border-rose-200 text-rose-900" 
                            : "bg-slate-50 border-slate-200 text-slate-700"
                        }`}>
                          <div className="flex items-start gap-2">
                            {isVerified ? (
                              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                            ) : isPending ? (
                              <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-bold flex items-center gap-1.5 flex-wrap">
                                <span>Pre-membership Education Seminar (PMES)</span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  isVerified 
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300" 
                                    : isPending 
                                    ? "bg-amber-100 text-amber-800 border-amber-300" 
                                    : isRejected 
                                    ? "bg-rose-100 text-rose-800 border-rose-300" 
                                    : "bg-slate-200 text-slate-700 border-slate-300"
                                }`}>
                                  {isVerified ? "Completed & Verified" : isPending ? "Pending Verification" : isRejected ? "Rejected / Retake" : "Not Completed"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {isVerified
                                  ? `Verified by: ${pmesInfo?.verifiedBy || 'Staff'} ${pmesInfo?.reference ? `(Ref: ${pmesInfo.reference})` : ''} ${pmesInfo?.attendedAt ? `• Attended: ${pmesInfo.attendedAt}` : ''}`
                                  : isPending
                                  ? `Attended on ${pmesInfo?.attendedAt || 'recently'} — Awaiting staff verification in PMES Manager`
                                  : isRejected
                                  ? 'Attendance was rejected by cooperative staff. Please contact administration.'
                                  : 'Mandatory cooperative membership seminar required prior to loan application.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Loan Orientation Item */}
                    {(() => {
                      const orientInfo = eligibilityData.complianceDetails?.orientation;
                      const isMissing = eligibilityData.missingRequirements?.includes("LOAN_ORIENTATION");
                      const isVerified = orientInfo?.completed || (!isMissing && orientInfo?.status === 'VERIFIED');
                      const isPending = orientInfo?.status === 'PENDING_VERIFICATION';
                      const isRejected = orientInfo?.status === 'REJECTED';

                      return (
                        <div className={`p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          isVerified 
                            ? "bg-emerald-50/80 border-emerald-200 text-emerald-900" 
                            : isPending 
                            ? "bg-amber-50 border-amber-200 text-amber-900" 
                            : isRejected 
                            ? "bg-rose-50 border-rose-200 text-rose-900" 
                            : "bg-slate-50 border-slate-200 text-slate-700"
                        }`}>
                          <div className="flex items-start gap-2">
                            {isVerified ? (
                              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                            ) : isPending ? (
                              <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-bold flex items-center gap-1.5 flex-wrap">
                                <span>Loan Orientation &amp; Credit Counseling</span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  isVerified 
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300" 
                                    : isPending 
                                    ? "bg-amber-100 text-amber-800 border-amber-300" 
                                    : isRejected 
                                    ? "bg-rose-100 text-rose-800 border-rose-300" 
                                    : "bg-slate-200 text-slate-700 border-slate-300"
                                }`}>
                                  {isVerified ? "Completed & Verified" : isPending ? "Pending Verification" : isRejected ? "Rejected / Retake" : "Not Completed"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {isVerified
                                  ? `Verified by: ${orientInfo?.verifiedBy || 'Staff'} ${orientInfo?.reference ? `(Ref: ${orientInfo.reference})` : ''} ${orientInfo?.attendedAt ? `• Attended: ${orientInfo.attendedAt}` : ''}`
                                  : isPending
                                  ? `Attended on ${orientInfo?.attendedAt || 'recently'} — Awaiting staff verification`
                                  : isRejected
                                  ? 'Orientation was rejected. Please contact cooperative administration.'
                                  : 'Cooperative policy requires Credit Counseling before loan application submission.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {eligibilityData.missingRequirements && eligibilityData.missingRequirements.length > 0 && onNavigate && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigate("member-profile")}
                        className="text-xs font-semibold text-amber-900 underline hover:text-amber-950 flex items-center gap-1.5 cursor-pointer py-1"
                        id="btn-view-compliance-requirements"
                      >
                        <GraduationCap size={14} />
                        <span>View Compliance Requirements</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Genuine Duplicate Application Warning (Only shown when compliance is verified) */}
              {eligibilityData && (!eligibilityData.missingRequirements || eligibilityData.missingRequirements.length === 0) && eligibilityData.duplicateApplication && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3" id="loan-duplicate-application-warning">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-blue-600 mt-0.5 shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div>
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest font-mono block">
                          Existing Loan Application
                        </span>
                        <h5 className="font-bold text-xs uppercase tracking-wider text-blue-900 mt-0.5">
                          An active application for this loan product already exists.
                        </h5>
                        {eligibilityData.duplicateApplicationDetails?.status === 'REVISION_REQUESTED' ? (
                          <p className="text-xs text-blue-800 mt-1 font-medium">
                            Staff requested revisions to your existing application. Please revise and resubmit the existing application instead of creating a new application.
                          </p>
                        ) : (eligibilityData.duplicateApplicationDetails?.status === 'PENDING_REVIEW' || eligibilityData.duplicateApplicationDetails?.status === 'UNDER_REVIEW') ? (
                          <p className="text-xs text-blue-700 mt-1">
                            Your application is currently being reviewed by Staff.
                          </p>
                        ) : (
                          <p className="text-xs text-blue-700 mt-1">
                            An active application for this loan product is already in progress ({eligibilityData.duplicateApplicationDetails?.status?.replace(/_/g, ' ') || 'ACTIVE'}). You cannot submit a duplicate application while an active application exists.
                          </p>
                        )}
                      </div>

                      {/* Application Details Summary */}
                      {eligibilityData.duplicateApplicationDetails && (
                        <div className="bg-white/90 border border-blue-100 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-mono">Application ID</span>
                            <span className="font-mono font-bold text-slate-800">#{eligibilityData.duplicateApplicationDetails.applicationId}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-mono">Loan Product</span>
                            <span className="font-bold text-slate-800">{eligibilityData.duplicateApplicationDetails.loanTypeName}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-mono">Date Submitted</span>
                            <span className="font-bold text-slate-800">
                              {eligibilityData.duplicateApplicationDetails.submittedDate
                                ? new Date(eligibilityData.duplicateApplicationDetails.submittedDate).toLocaleDateString()
                                : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-mono">Current Status</span>
                            <span className="font-bold text-blue-700">
                              {eligibilityData.duplicateApplicationDetails.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-mono">Workflow Stage</span>
                            <span className="font-bold text-slate-800">
                              {eligibilityData.duplicateApplicationDetails.stage}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Direct CTA button to inspect / revise the existing application */}
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const targetApp = loanApplications.find(a => a.id === eligibilityData.duplicateApplicationDetails?.applicationId);
                            if (targetApp) {
                              setSelectedAppForModal(targetApp);
                            } else {
                              const el = document.getElementById('my-loan-applications-table');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Eye size={14} />
                          {eligibilityData.duplicateApplicationDetails?.status === 'REVISION_REQUESTED' ? 'View / Revise Existing Application' : 'View Application'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. One-Active-Loan-Per-Member Policy: Existing Outstanding Loan Callout */}
              {eligibilityData && (!eligibilityData.missingRequirements || eligibilityData.missingRequirements.length === 0) && eligibilityData.checks?.some((c: any) => c.rule === 'EXISTING_OUTSTANDING_LOAN' && !c.passed) && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4.5 space-y-3 shadow-xs" id="loan-existing-outstanding-warning">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={22} className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div>
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest font-mono block">
                          Policy: One Active Loan Per Member
                        </span>
                        <h5 className="font-bold text-sm uppercase tracking-wider text-amber-950 mt-0.5">
                          Existing Outstanding Loan
                        </h5>
                        <p className="text-xs text-amber-900 mt-1 font-medium leading-relaxed">
                          {eligibilityData.checks.find((c: any) => c.rule === 'EXISTING_OUTSTANDING_LOAN')?.description ||
                            `You currently have an active loan with an outstanding balance of ${formatCurrency(eligibilityData.existingActiveLoan?.balance || 0)}. You must fully settle the existing loan before applying for another loan.`}
                        </p>
                      </div>

                      {/* Active Loan Details Card */}
                      {eligibilityData.existingActiveLoan && (
                        <div className="bg-white/95 border border-amber-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs shadow-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-mono">Active Contract</span>
                            <span className="font-mono font-bold text-slate-900 block truncate">
                              #{eligibilityData.existingActiveLoan.id?.substring(0, 8).toUpperCase()}
                            </span>
                            <span className="text-[11px] text-slate-600 font-semibold truncate block">
                              {eligibilityData.existingActiveLoan.loanTypeName}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-mono">Outstanding Balance</span>
                            <strong className="text-rose-700 text-sm block">
                              {formatCurrency(eligibilityData.existingActiveLoan.balance)}
                            </strong>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Principal: {formatCurrency(eligibilityData.existingActiveLoan.principalAmount ?? (eligibilityData.existingActiveLoan as any).principal ?? 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-mono">Next / Due Date</span>
                            <span className="font-bold text-slate-800 block">
                              {eligibilityData.existingActiveLoan.dueDate ? new Date(eligibilityData.existingActiveLoan.dueDate).toLocaleDateString() : 'N/A'}
                            </span>
                            {eligibilityData.existingActiveLoan.isPastDue ? (
                              <span className="inline-block px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold font-mono text-[9px] rounded mt-0.5">
                                ⚠️ PAST DUE
                              </span>
                            ) : (
                              <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-700 font-bold font-mono text-[9px] rounded mt-0.5">
                                ✓ CURRENT
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-mono">Amortization / Term</span>
                            <span className="font-bold text-slate-800 block">
                              {formatCurrency(eligibilityData.existingActiveLoan.monthlyAmortization || 0)} / mo
                            </span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              {eligibilityData.existingActiveLoan.durationMonths} months
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Direct Action Buttons to view Schedule and Pay */}
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const matchedLoan = activeLoans.find(l => l.id === eligibilityData.existingActiveLoan?.id);
                            if (matchedLoan) {
                              setSelectedLoanForScheduleModal(matchedLoan);
                            } else if (activeLoans.length > 0) {
                              setSelectedLoanForScheduleModal(activeLoans[0]);
                            } else if (onNavigate) {
                              onNavigate('loans');
                            }
                          }}
                          className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Calendar size={14} />
                          View Repayment Schedule & Payment History
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const matchedLoan = activeLoans.find(l => l.id === eligibilityData.existingActiveLoan?.id);
                            if (matchedLoan) {
                              setSelectedLoanForPayModal(matchedLoan);
                            } else if (onNavigate) {
                              onNavigate('gcash');
                            }
                          }}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <CreditCard size={14} />
                          Pay / Settle Outstanding Loan
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Other Policy / Financial Eligibility Checks Failed (e.g. Share Capital, Capacity, Tenure) */}
              {eligibilityData && !eligibilityData.isEligible && (!eligibilityData.missingRequirements || eligibilityData.missingRequirements.length === 0) && !eligibilityData.duplicateApplication && !eligibilityData.checks?.some((c: any) => c.rule === 'EXISTING_OUTSTANDING_LOAN' && !c.passed) && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2" id="loan-policy-checks-warning">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wider text-rose-800">
                        Loan Application Policy Requirements
                      </h5>
                      <p className="text-xs text-rose-700 mt-0.5">
                        Please review the following cooperative policy criteria before applying:
                      </p>
                    </div>
                  </div>
                  <div className="pl-7 space-y-1 text-xs">
                    {eligibilityData.checks.filter((c: any) => !c.passed).map((failedCheck: any, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-rose-900">
                        <XCircle size={13} className="text-rose-500 shrink-0 mt-0.5" />
                        <span><strong>{failedCheck.title}:</strong> {failedCheck.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unpaid Initial Share Capital Message */}
              {savingsData.member.initialShareCapitalPledged > 0 &&
                !savingsData.member.initialShareCapitalPaid && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>
                      Loan applications are unavailable until your Initial Share
                      Capital contribution has been verified.
                    </p>
                  </div>
                )}

              {/* Submit Application Button */}
              <button
                type="submit"
                disabled={
                  (eligibilityData && !eligibilityData.isEligible) ||
                  (savingsData.member.initialShareCapitalPledged > 0 &&
                    !savingsData.member.initialShareCapitalPaid)
                }
                className={`w-full py-3.5 font-bold text-xs tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${(eligibilityData && !eligibilityData.isEligible) || (savingsData.member.initialShareCapitalPledged > 0 && !savingsData.member.initialShareCapitalPaid) ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-900/10 cursor-pointer"}`}
              >
                <Send size={15} />
                Submit Loan Application (Pending Review)
              </button>
            </form>
          </div>

          {/* Historic Loan Applications Tracker Ledger */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">
              Member Loan Applications Ledger & Status Pipeline
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse" id="my-loan-applications-table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase">
                    <th className="py-3 px-4">Application ID</th>
                    <th className="py-3 px-4">Loan Program</th>
                    <th className="py-3 px-4">Principal Requested</th>
                    <th className="py-3 px-4">Term</th>
                    <th className="py-3 px-4">Amortization / Month</th>
                    <th className="py-3 px-4">Application Status</th>
                    <th className="py-3 px-4">Staff Review Note</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loanApplications.length > 0 ? (
                    loanApplications.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                          {a.id}
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 font-bold">
                          {a.loanTypeName}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-800 font-bold">
                          {formatCurrency(a.amount || 0)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {a.durationMonths} months
                        </td>
                        <td className="py-3.5 px-4 font-mono text-emerald-600 font-bold">
                          {formatCurrency(a.monthlyAmortization || 0)}
                        </td>
                        <td className="py-3.5 px-4">
                          <LoanStatusBadge status={a.status} />
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 truncate max-w-[180px]">
                          {a.remarks || "No notes yet."}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedAppForModal(a)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-700 text-emerald-600 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 mx-auto"
                          >
                            <Eye size={12} /> View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-slate-400 font-mono"
                      >
                        No loan filings submitted yet.
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
          TAB: LOAN DISBURSEMENT RECEIPTS & PAYMENT SCHEDULE
          ======================================================================= */}
      {activeTab === "member-loan-receipts" && (
        <div
          className="space-y-6 animate-fade-in"
          id="tab-member-loan-receipts"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
              <Receipt size={240} />
            </div>
            <div className="relative z-10 max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-semibold border border-emerald-500/30">
                <Receipt size={14} />
                Authoritative Receipts Vault & Audit Trail
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                My Official Receipts
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Access official cooperative receipts for all your transactions (Share Capital, Regular Savings, Loan Repayments, Disbursements, and Withdrawals). Official receipts originate from the authoritative financial process and remain strictly read-only.
              </p>
            </div>
          </div>

          {/* Sub-navigation View Switcher */}
          <div className="flex border-b border-slate-200 gap-6">
            <button
              type="button"
              onClick={() => setReceiptsViewMode("ALL")}
              className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 -mb-px ${
                receiptsViewMode === "ALL"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Receipt size={16} />
              <span>All Official Receipts</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 text-slate-600">
                {receipts.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setReceiptsViewMode("LOANS")}
              className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 -mb-px ${
                receiptsViewMode === "LOANS"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <CreditCard size={16} />
              <span>Loan Disbursements & Schedules</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 text-slate-600">
                {activeLoans.length}
              </span>
            </button>
          </div>

          {/* Quick Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-400 block mb-1">
                Total Receipts Issued
              </span>
              <h3 className="text-2xl font-bold font-mono text-emerald-600">
                {receipts.length} Vouchers
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Archived on production ledger
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-400 block mb-1">
                Total Receipted Volume
              </span>
              <h3 className="text-2xl font-bold font-mono text-slate-900">
                ₱
                {formatMoney(
                  receipts.reduce((sum, r) => sum + (r.amountPaid ?? (r as any).amount ?? 0), 0)
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Cumulative across transactions
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-400 block mb-1">
                Disbursed Loan Contracts
              </span>
              <h3 className="text-2xl font-bold font-mono text-sky-600">
                {activeLoans.length} Active
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Direct credit / electronic release
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-400 block mb-1">
                Outstanding Loan Balance
              </span>
              <h3 className="text-2xl font-bold font-mono text-rose-600">
                ₱{formatMoney(stats?.activeLoansBalance)}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Remaining principal + interest
              </p>
            </div>
          </div>

          {receiptsViewMode === "ALL" ? (
            /* ALL OFFICIAL RECEIPTS VIEW */
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <FileCheck className="text-emerald-600" size={18} />
                    Official Receipts Registry
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select any receipt to view its BIR/CDA compliant layout, inspect security QR hash, or print/download PDF.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <select
                    value={receiptsFilter}
                    onChange={(e) => setReceiptsFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-emerald-500 focus:border-emerald-500 p-2 font-semibold"
                  >
                    <option value="ALL">All Transaction Types</option>
                    <option value="SHARE_CAPITAL">Share Capital Receipts</option>
                    <option value="SAVINGS">Savings Deposit Receipts</option>
                    <option value="LOANS">Loan Repayment / Release Receipts</option>
                    <option value="WITHDRAWALS">Withdrawal Receipts</option>
                    <option value="GCASH">GCash Receipts</option>
                  </select>

                  <div className="relative w-full sm:w-64">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Search OR #, reference, type..."
                      value={receiptSearch}
                      onChange={(e) => setReceiptSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {searchedReceipts.length === 0 ? (
                <div className="p-12 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                  <Receipt size={36} className="text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">
                    No Official Receipts Found
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Receipts will appear here once financial transactions are posted by staff.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase font-bold bg-slate-50/80">
                        <th className="py-3 px-4">Receipt Number</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Transaction Type</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4">Payment Method</th>
                        <th className="py-3 px-4">Reference</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {searchedReceipts.map((r, idx) => {
                        const amtPaid = r.amountPaid ?? (r as any).amount ?? (r as any).principalAmount ?? 0;
                        const ref = r.paymentReference || r.transactionId || (r as any).reference || (r as any).referenceNumber || "—";
                        const status = r.status || "POSTED";
                        return (
                          <tr
                            key={r.id || r.receiptNumber || `rcpt-all-${idx}`}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Receipt size={14} className="text-emerald-600" />
                                <span>{r.receiptNumber || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-mono whitespace-nowrap">
                              {r.paymentDate || (r as any).issuedAt?.split('T')[0] || 'N/A'}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-700 whitespace-nowrap">
                              {r.paymentType === "SAVINGS_DEPOSIT"
                                ? "Savings Deposit"
                                : r.paymentType === "SHARE_CAPITAL"
                                ? "Share Capital"
                                : (r.paymentType as string) === "WITHDRAWAL" || (r as any).transactionType === "SAVINGS_WITHDRAWAL"
                                ? "Savings Withdrawal"
                                : r.paymentType === "LOAN_PAYMENT"
                                ? "Loan Payment"
                                : r.paymentType === "LOAN_RELEASE"
                                ? "Loan Release"
                                : r.paymentType || "Cooperative Transaction"}
                            </td>
                            <td className="py-3.5 px-4 font-bold font-mono text-emerald-700 text-right whitespace-nowrap">
                              {formatCurrency(amtPaid)}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold border border-slate-200">
                                {r.paymentMethod || r.releaseMethod || 'CASH'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {ref}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => setSelectedReceiptForModal(r)}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <Eye size={12} />
                                <span>View / Print</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* LOAN DISBURSEMENTS & REPAYMENT SCHEDULES VIEW */
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <FileCheck className="text-emerald-600" size={18} />
                    My Disbursed Loans & Official Release Receipts
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select any released loan to inspect official receipts, GCash references, or repayment schedules.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Search receipt #, loan ID..."
                    value={receiptSearch}
                    onChange={(e) => setReceiptSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* List / Table of Loan Receipts */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase font-bold bg-slate-50/80">
                      <th className="py-3.5 px-4">Receipt Number</th>
                      <th className="py-3.5 px-4">Loan Reference</th>
                      <th className="py-3.5 px-4">Product Name</th>
                      <th className="py-3.5 px-4">Amount Disbursed</th>
                      <th className="py-3.5 px-4">Release Method & Ref</th>
                      <th className="py-3.5 px-4">Release Date</th>
                      <th className="py-3.5 px-4">Loan Status</th>
                      <th className="py-3.5 px-4">Payment Progress</th>
                      <th className="py-3.5 px-4 text-center">
                        Receipt & Schedule Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeLoans.length > 0 ? (
                      activeLoans
                        .filter((l) => {
                          if (!receiptSearch) return true;
                          const term = receiptSearch.toLowerCase();
                          const gcashRef = (
                            l.transactionReferenceNumber || ""
                          ).toLowerCase();
                          const loanId = l.id.toLowerCase();
                          const typeName = (l.loanTypeName || "").toLowerCase();
                          return (
                            loanId.includes(term) ||
                            gcashRef.includes(term) ||
                            typeName.includes(term)
                          );
                        })
                        .map((loan) => {
                          const matchingRc = receipts.find(
                            (r) =>
                              r.loanId === loan.id || r.transactionId === loan.id,
                          );
                          const gcashRef = extractGcashRefNumber(
                            matchingRc,
                            loan,
                          );
                          const receiptNo =
                            matchingRc?.receiptNumber ||
                            `OR-${loan.id.substring(0, 8).toUpperCase()}`;

                          return (
                            <tr
                              key={loan.id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                                <div className="flex items-center gap-1.5">
                                  <Receipt
                                    size={14}
                                    className="text-emerald-600"
                                  />
                                  <span>{receiptNo}</span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono text-slate-700 font-semibold">
                                #{loan.id}
                              </td>

                              <td className="py-3.5 px-4 font-bold text-slate-800">
                                {loan.loanTypeName}
                              </td>

                              <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 text-sm">
                                {formatCurrency(loan.principalAmount ?? (loan as any).principal ?? (loan as any).amount ?? 0)}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="flex flex-col gap-1">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono w-fit ${
                                      loan.releaseMethod === "GCASH"
                                        ? "bg-sky-50 text-sky-700 border border-sky-200"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}
                                  >
                                    {loan.releaseMethod === "GCASH" && (
                                      <QrCode size={11} />
                                    )}
                                    {loan.releaseMethod || "CASH"}
                                  </span>
                                  {gcashRef && (
                                    <span className="font-mono text-[10px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 w-fit">
                                      Ref: {gcashRef}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono text-slate-500">
                                {loan.disbursedAt
                                  ? new Date(loan.disbursedAt).toLocaleDateString(
                                      undefined,
                                      {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )
                                  : loan.createdAt
                                    ? new Date(
                                        loan.createdAt,
                                      ).toLocaleDateString()
                                    : "N/A"}
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-1 rounded-full font-extrabold text-[10px] font-mono uppercase inline-block ${
                                    loan.status === "COMPLETED"
                                      ? "bg-indigo-100 text-emerald-600"
                                      : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {loan.status || "ACTIVE"}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {(() => {
                                  const loanPrincipal = loan.principalAmount ?? (loan as any).principal ?? (loan as any).amount ?? 0;
                                  const loanBal = loan.balance ?? loanPrincipal;
                                  const pctPaid = loanPrincipal > 0
                                    ? Math.round(Math.min(100, Math.max(0, ((loanPrincipal - loanBal) / loanPrincipal) * 100)))
                                    : 100;
                                  return (
                                    <>
                                      <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className="bg-emerald-500 h-full rounded-full"
                                          style={{ width: `${pctPaid}%` }}
                                        ></div>
                                      </div>
                                      <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                                        {pctPaid}% Paid
                                      </span>
                                    </>
                                  );
                                })()}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openReceiptForLoan(loan)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                                    title="View official disbursement receipt, print, or download PDF"
                                  >
                                    <Receipt size={13} />
                                    View Receipt
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedLoanForScheduleModal(loan)
                                    }
                                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-700 text-emerald-600 border border-indigo-200 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                                    title="Inspect complete monthly payment schedule & due dates"
                                  >
                                    <Calendar size={13} />
                                    Statement & Schedule
                                  </button>

                                  {(loan.balance || 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedTargetInstallment(null);
                                        setSelectedLoanForPayModal(loan);
                                      }}
                                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                                      title="Create payment request for this loan"
                                    >
                                      <CreditCard size={13} />
                                      Pay Installment
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    ) : (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-12 text-center text-slate-400 font-mono"
                        >
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Receipt size={32} className="text-slate-300" />
                            <p className="text-xs font-semibold">
                              No disbursed loan receipts found for this account.
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Once your loan application is approved and released
                              by the cashier, official release vouchers will
                              appear here.
                            </p>
                          </div>
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
          TAB 4: MEMBER DIVIDENDS
          ======================================================================= */}
      {activeTab === "member-dividends" && (
        <div className="space-y-6 animate-fade-in" id="tab-member-dividends">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex items-center gap-5">
              <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 border border-indigo-100">
                <Coins size={36} />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-widest text-slate-450 uppercase font-mono block">
                  Aggregate Dividends Credited
                </span>
                <h3 className="text-3xl font-extrabold font-mono text-slate-800 tracking-tight mt-1">
                  {formatCurrency(savingsData?.member?.dividendsEarned ?? stats?.dividendsEarned ?? 0)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Automatically credited to your Regular Savings account during
                  distribution cycles.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col justify-center">
              <span className="text-xs font-mono text-emerald-600 uppercase tracking-widest font-semibold block mb-1">
                Cooperative Yield Rules
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dividends are computed annually by dividing the allocated
                portion of net operational surplus by the aggregate share
                capital of active verified members. The bigger your{" "}
                <strong>Share Capital</strong> balance, the bigger your dividend
                yield shares.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <h3 className="font-bold text-slate-800 mb-4">
              My Annual Dividend Yield Statements
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase">
                    <th className="py-3 px-4">Statement Reference</th>
                    <th className="py-3 px-4">Financial Year</th>
                    <th className="py-3 px-4">Share Capital Snapshot</th>
                    <th className="py-3 px-4">Regular Savings Snapshot</th>
                    <th className="py-3 px-4">Dividend Credited Amount</th>
                    <th className="py-3 px-4">Disbursed Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dividends.length > 0 ? (
                    dividends.map((d: any) => {
                      const shareSnap = d.shareCapitalSnapshot ?? d.shareCapital ?? d.capitalShareSnapshot ?? null;
                      const regSnap = d.regularSavingsSnapshot ?? d.regularSavings ?? d.savingsSnapshot ?? null;
                      const divAmt = d.dividendAmount ?? d.amount ?? d.patronageAmount ?? 0;
                      const orNo = d.officialReceiptNo || d.receiptNumber || d.officialReceiptNumber || d.referenceNo || "";
                      const fiscalYr = d.year || d.fiscalYear || d.periodYear || "—";
                      return (
                        <tr key={d.id || `div-stmt-${fiscalYr}`} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {d.id || "—"}
                            {orNo && (
                              <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                                OR: {orNo}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                            {fiscalYr}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {shareSnap !== null && shareSnap !== undefined ? formatCurrency(shareSnap) : "—"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {regSnap !== null && regSnap !== undefined ? formatCurrency(regSnap) : "—"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-emerald-600 font-bold">
                            {formatCurrency(divAmt)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-emerald-50 border border-emerald-200 text-emerald-700">
                              {d.status || "CREDITED"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-slate-400 font-mono"
                      >
                        No dividend record is currently available.
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
          TAB 5: SAVINGS LEDGER
          ======================================================================= */}

      {activeTab === "member-ledger" && (
        <div className="space-y-6 animate-fade-in" id="tab-member-ledger">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
              <BookOpen size={240} />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-semibold border border-emerald-500/30">
                  <FileText size={14} />
                  Authoritative Statement of Account
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Financial Statement of Account
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  Official financial transaction ledger for {savingsData.member?.fullName || "Member"} (ID: {savingsData.member?.idNumber || savingsData.member?.id || "—"}). All entries are permanently recorded from the cooperative financial ledger.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-mono tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Print Statement</span>
                </button>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-500 block mb-1">
                Regular Savings Balance
              </span>
              <h3 className="text-2xl font-bold font-mono text-emerald-600">
                {formatCurrency(stats?.regularSavings ?? savingsData?.member?.regularSavings ?? 0)}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Current authoritative savings
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-500 block mb-1">
                Share Capital Balance
              </span>
              <h3 className="text-2xl font-bold font-mono text-purple-600">
                {formatCurrency(stats?.shareCapital ?? savingsData?.member?.shareCapital ?? 0)}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Total member equity contribution
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-500 block mb-1">
                Total Inflows (Credits)
              </span>
              <h3 className="text-2xl font-bold font-mono text-slate-900">
                {formatCurrency(processedLedger.reduce((sum: number, t: any) => sum + (t.status === 'VOIDED' ? 0 : (t.credit || 0)), 0))}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Accumulated deposits & credits
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-500 block mb-1">
                Total Outflows (Debits)
              </span>
              <h3 className="text-2xl font-bold font-mono text-rose-600">
                {formatCurrency(processedLedger.reduce((sum: number, t: any) => sum + (t.status === 'VOIDED' ? 0 : (t.debit || 0)), 0))}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Accumulated withdrawals & releases
              </p>
            </div>
          </div>

          {/* Financial Transaction Ledger Table */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Transaction History & Running Ledger
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chronological audit ledger of all debits, credits, and resulting balances. Read-only financial record.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                    Filter:
                  </span>
                  <select
                    value={ledgerFilter}
                    onChange={(e) => setLedgerFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-2 font-semibold"
                  >
                    <option value="ALL">All Transactions</option>
                    <option value="SHARE_CAPITAL">Share Capital</option>
                    <option value="REGULAR_SAVINGS">Regular Savings</option>
                    <option value="TIME_DEPOSITS">Time Deposits</option>
                    <option value="LOANS">Loans</option>
                    <option value="LOAN_PAYMENTS">Loan Payments</option>
                    <option value="DIVIDENDS">Dividends</option>
                    <option value="WITHDRAWALS">Withdrawals</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-mono text-[10px] uppercase font-bold">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Transaction Type</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Reference Number</th>
                    <th className="py-3.5 px-4 text-right">Debit</th>
                    <th className="py-3.5 px-4 text-right">Credit</th>
                    <th className="py-3.5 px-4 text-right">Running Balance</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedger.length > 0 ? (
                    filteredLedger.map((t: any) => {
                      const refNo = t.referenceId || t.externalReference || t.referenceNumber || t.officialReceiptNumber || t.id || "—";
                      const txStatus = t.status || "POSTED";
                      const isVoid = txStatus === "VOIDED";
                      const debitVal = typeof t.debit === "number" ? t.debit : Number(t.debit || 0);
                      const creditVal = typeof t.credit === "number" ? t.credit : Number(t.credit || 0);
                      const runningBalVal = typeof t.runningBalance === "number"
                        ? t.runningBalance
                        : (t.runningBalance !== undefined && t.runningBalance !== null ? Number(t.runningBalance) : 0);
                      return (
                        <tr
                          key={t.id || `stmt-${t.createdAt}-${refNo}`}
                          className={`hover:bg-slate-50/80 transition-colors ${isVoid ? "opacity-60 bg-rose-50/30" : ""}`}
                        >
                          <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {t.createdAt
                              ? new Date(t.createdAt).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                              isVoid ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-slate-100 border border-slate-200 text-slate-700"
                            }`}>
                              {t.type || "TRANSACTION"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {t.description || "Cooperative Transaction"}
                            {t.officialReceiptNumber && (
                              <span className="ml-2 font-mono text-[10px] text-emerald-700 font-bold">
                                (OR: {t.officialReceiptNumber})
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                            {refNo}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-rose-600 font-semibold text-right whitespace-nowrap">
                            {debitVal > 0 ? formatCurrency(debitVal) : "—"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-emerald-600 font-semibold text-right whitespace-nowrap">
                            {creditVal > 0 ? formatCurrency(creditVal) : "—"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-900 font-bold text-right whitespace-nowrap">
                            {formatCurrency(runningBalVal)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                              isVoid
                                ? "bg-rose-100 text-rose-700 border border-rose-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>
                              {txStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-slate-400 font-mono"
                      >
                        No transaction events found for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending & Recent Withdrawal Requests Section */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Withdrawal Requests & Disbursement Log
                </h3>
                <p className="text-xs text-slate-500">
                  Track the status of your cash and GCash withdrawal submissions.
                </p>
              </div>
              <button
                onClick={() => setWithdrawalModalOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowDownLeft size={14} />
                <span>Request Withdrawal</span>
              </button>
            </div>

            {withdrawalRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase bg-slate-50/80">
                      <th className="py-3 px-4">Request Date</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Release Method</th>
                      <th className="py-3 px-4">Destination / Account</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Processed By</th>
                      <th className="py-3 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {withdrawalRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">
                          {new Date(r.requestDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-bold font-mono text-slate-800 whitespace-nowrap">
                          ₱{formatMoney(r.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold border border-slate-200">
                            {r.releaseMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {r.gcashNumber || "Cooperative Cashier"}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold font-mono uppercase ${
                              r.status === "PENDING"
                                ? "bg-amber-100 text-amber-800"
                                : r.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {r.processedBy || "Awaiting Review"}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                          {r.remarks || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 font-mono text-xs">
                No withdrawal requests on record.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 6: INQUIRY CENTER
          ======================================================================= */}
      {activeTab === "member-inquiries" && (
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in"
          id="tab-member-inquiries"
        >
          {/* List of inquiries & Submit form */}
          <div className="lg:col-span-1 space-y-6">
            {/* Submit Inquiry Box */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-slate-800">
                Submit Customer Inquiry
              </h3>
              <form onSubmit={handleInquirySubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                    Subject Heading
                  </label>
                  <input
                    type="text"
                    required
                    value={inquirySubject}
                    onChange={(e) => setInquirySubject(e.target.value)}
                    placeholder="e.g., Question about Loan Interest"
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                    Detailed Inquiry Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    placeholder="Describe your inquiry or support issue completely..."
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-950/10 cursor-pointer"
                >
                  Send Inquiry to Staff
                </button>
              </form>
            </div>

            {/* Inquiries Thread List */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-slate-800">
                Support Inquiry Tickets
              </h3>
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                {inquiries.length > 0 ? (
                  inquiries.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => fetchInquiryDetails(i.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                        activeInquiryId === i.id
                          ? "bg-emerald-50 border-indigo-250 text-emerald-600"
                          : "bg-slate-50/50 border-slate-200 text-slate-500 hover:border-indigo-500/20"
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[10px] font-mono text-slate-400 font-bold">
                          {i.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[8px] font-bold font-mono ${
                            i.status === "RESOLVED"
                              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                              : i.status === "IN_PROGRESS"
                                ? "bg-blue-50 border border-blue-200 text-blue-700"
                                : "bg-amber-50 border border-amber-200 text-amber-700"
                          }`}
                        >
                          {i.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-xs truncate w-full">
                        {i.subject}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        Filed:{" "}
                        {i.createdAt
                          ? new Date(i.createdAt).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="text-center text-slate-400 text-xs font-mono py-8">
                    No support tickets filed yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Chat/Replies Thread */}
          <div className="lg:col-span-2">
            {activeInquiryId && activeInquiryDetails ? (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 h-full flex flex-col justify-between space-y-4">
                {/* Thread Header */}
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      {activeInquiryDetails.inquiry.subject}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Ticket ID: {activeInquiryDetails.inquiry.id}
                    </p>
                  </div>
                  {activeInquiryDetails.inquiry.status !== "RESOLVED" && (
                    <button
                      onClick={() =>
                        handleInquiryResolve(activeInquiryDetails.inquiry.id)
                      }
                      className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider font-mono bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all cursor-pointer"
                    >
                      Resolve & Close Ticket
                    </button>
                  )}
                </div>

                {/* Messages Panel */}
                <div className="flex-1 overflow-y-auto max-h-[400px] p-2 space-y-3 scrollbar-thin">
                  {/* Original Inquiry Message */}
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center font-bold text-xs text-emerald-600 flex-shrink-0">
                      ME
                    </div>
                    <div className="bg-emerald-50/40 p-3.5 rounded-2xl border border-indigo-100 space-y-1.5 max-w-[85%]">
                      <p className="text-xs text-slate-800 leading-relaxed">
                        {activeInquiryDetails.inquiry.message}
                      </p>
                      <span className="text-[9px] text-slate-400 font-mono block">
                        {activeInquiryDetails.inquiry.createdAt
                          ? new Date(activeInquiryDetails.inquiry.createdAt).toLocaleString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Replies Map */}
                  {activeInquiryDetails.replies.map((rep: any) => {
                    const isStaff =
                      rep.senderRole === "STAFF" || rep.senderRole === "ADMIN";
                    return (
                      <div
                        key={rep.id}
                        className={`flex gap-3 items-start ${isStaff ? "flex-row-reverse" : ""}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            isStaff
                              ? "bg-emerald-600 text-white"
                              : "bg-emerald-50 text-emerald-600"
                          }`}
                        >
                          {isStaff ? "ST" : "ME"}
                        </div>
                        <div
                          className={`p-3.5 rounded-2xl border space-y-1.5 max-w-[85%] ${
                            isStaff
                              ? "bg-slate-50 border-slate-200 text-slate-800"
                              : "bg-emerald-50/40 border-indigo-100 text-slate-800"
                          }`}
                        >
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest font-mono block">
                            {rep.senderName} ({rep.senderRole})
                          </span>
                          <p className="text-xs leading-relaxed">
                            {rep.message}
                          </p>
                          <span className="text-[9px] text-slate-400 font-mono block">
                            {rep.createdAt ? new Date(rep.createdAt).toLocaleString() : "N/A"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Form */}
                {activeInquiryDetails.inquiry.status !== "RESOLVED" ? (
                  <form
                    onSubmit={handleReplySubmit}
                    className="flex gap-2 border-t border-slate-100 pt-3"
                  >
                    <input
                      type="text"
                      required
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your message reply to support staff..."
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                ) : (
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-205 text-center text-slate-400 text-xs font-mono py-4">
                    This inquiry support ticket is closed and resolved.
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 h-full flex flex-col justify-center items-center text-slate-500 text-center py-24">
                <MessageSquare size={36} className="text-slate-350 mb-2.5" />
                <h4 className="font-bold text-slate-700">
                  Inquiry Conversation Threads
                </h4>
                <p className="text-xs max-w-sm mt-1 text-slate-400">
                  Select an active inquiry ticket on the left pane to view
                  conversation threads and reply history.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 7: MEMBER PROFILE
          ======================================================================= */}
      {activeTab === "member-profile" && (
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in"
          id="tab-member-profile"
        >
          {/* Profile Card */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4 md:col-span-1">
            <div className="text-center space-y-3 py-4">
              <div className="relative group w-24 h-24 mx-auto">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="w-24 h-24 rounded-full object-cover border border-amber-500 shadow-md mx-auto"
                  />
                ) : savingsData.member.avatarUrl ? (
                  <img
                    src={savingsData.member.avatarUrl}
                    alt={savingsData.member.fullName}
                    className="w-24 h-24 rounded-full object-cover border border-indigo-200 shadow-md mx-auto"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-emerald-50 border border-indigo-100 flex items-center justify-center text-emerald-600 font-extrabold text-3xl uppercase font-mono shadow-sm mx-auto">
                    {(savingsData.member.fullName || "").substring(0, 2) ||
                      "MB"}
                  </div>
                )}

                <label
                  htmlFor="member-avatar-upload"
                  className="absolute bottom-0 right-0 p-2 bg-emerald-600 text-white rounded-full shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
                  title="Upload / Change Profile Picture"
                >
                  <Upload size={14} />
                  <input
                    id="member-avatar-upload"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarFileSelect}
                    disabled={avatarUploading}
                  />
                </label>
              </div>

              {avatarPreview ? (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 inline-block">
                    Image Preview Ready
                  </span>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveAvatar}
                      disabled={avatarUploading}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Check size={13} />
                      {avatarUploading ? "Saving..." : "Save Photo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarPreview(null)}
                      disabled={avatarUploading}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : savingsData.member.avatarUrl ? (
                <div className="flex justify-center gap-2 pt-1">
                  <label
                    htmlFor="member-avatar-upload"
                    className="px-3 py-1 bg-emerald-50 hover:bg-emerald-700 text-emerald-600 border border-indigo-200 text-[11px] font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Replace Photo
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarUploading}
                    className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Upload profile photo (JPG, PNG, WebP)
                </p>
              )}

              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  {savingsData.member.fullName || "Member"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Cooperative Regular Member
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">System ID:</span>
                <span className="text-slate-700 font-semibold text-right">
                  {savingsData.member.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="text-slate-700 font-semibold text-right truncate max-w-[150px]">
                  {savingsData.member.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone:</span>
                <span className="text-slate-700 font-semibold text-right">
                  {savingsData.member.phone}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Joined On:</span>
                <span className="text-slate-700 font-semibold text-right">
                  {new Date(savingsData.member.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status Code:</span>
                <span className="text-emerald-600 font-bold uppercase text-right">
                  {savingsData.member.status}
                </span>
              </div>
            </div>
          </div>

          {/* MEMBERSHIP COMPLIANCE STATUS (PMES, Orientation) */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5 md:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Membership Compliance & Mandatory Requirements
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mandatory seminar attendance & verification status for loan eligibility
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full self-start sm:self-auto">
                Non-Financial Compliance Registry
              </span>
            </div>

            {(() => {
              const compRecs = savingsData?.member?.complianceRecords || [];
              const pmes = compRecs.find((r: any) => r.requirementType === 'PRE_MEMBERSHIP_SEMINAR');
              const orient = compRecs.find((r: any) => r.requirementType === 'LOAN_ORIENTATION');

              const isPmesDone = pmes?.status === 'COMPLETED' || pmes?.status === 'VERIFIED' || !!savingsData?.member?.hasAttendedPreMembershipSeminar;
              const isOrientDone = orient?.status === 'COMPLETED' || orient?.status === 'VERIFIED' || !!savingsData?.member?.loanOrientationCompleted;

              const renderBadge = (isDone: boolean, rec: any) => {
                if (isDone) {
                  return (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 size={12} /> COMPLETED & VERIFIED
                    </span>
                  );
                }
                if (rec?.status === 'PENDING_VERIFICATION' || rec?.status === 'ATTENDED') {
                  return (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                      <Clock size={12} /> ATTENDED / PENDING VERIFICATION
                    </span>
                  );
                }
                if (rec?.status === 'REJECTED') {
                  return (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                      <AlertCircle size={12} /> REJECTED
                    </span>
                  );
                }
                return (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                    <Clock size={12} /> NOT COMPLETED
                  </span>
                );
              };

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {/* PMES Card */}
                    <div className={`p-4 rounded-xl border space-y-2 ${isPmesDone ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-800">Pre-membership Education Seminar (PMES)</p>
                          <p className="text-[10px] text-slate-500">Mandatory requirement for cooperative membership & loans</p>
                        </div>
                        {renderBadge(isPmesDone, pmes)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-200/60 font-mono">
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Attendance Date</span>
                          <span>{pmes?.attendedAt || pmes?.attendanceDate ? new Date(pmes.attendedAt || pmes.attendanceDate).toLocaleDateString() : 'Not attended'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Verified By</span>
                          <span>{pmes?.verifiedBy || 'Pending'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Reference #</span>
                          <span>{pmes?.reference || pmes?.referenceNumber || 'None'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Loan Eligibility</span>
                          <span className={isPmesDone ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                            {isPmesDone ? 'Eligible' : 'Required to apply'}
                          </span>
                        </div>
                      </div>
                      {pmes?.remarks && (
                        <p className="text-[10px] text-slate-500 bg-white/70 p-2 rounded border border-slate-200 mt-1">
                          <strong>Staff Note:</strong> {pmes.remarks}
                        </p>
                      )}
                    </div>

                    {/* Loan Orientation Card */}
                    <div className={`p-4 rounded-xl border space-y-2 ${isOrientDone ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-800">Loan Orientation & Credit Counseling</p>
                          <p className="text-[10px] text-slate-500">Borrower education on rights and obligations</p>
                        </div>
                        {renderBadge(isOrientDone, orient)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-200/60 font-mono">
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Attendance Date</span>
                          <span>{orient?.attendedAt || orient?.attendanceDate ? new Date(orient.attendedAt || orient.attendanceDate).toLocaleDateString() : 'Not attended'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Verified By</span>
                          <span>{orient?.verifiedBy || 'Pending'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Reference #</span>
                          <span>{orient?.reference || orient?.referenceNumber || 'None'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Status</span>
                          <span className={isOrientDone ? 'text-emerald-700 font-bold' : 'text-slate-500 font-bold'}>
                            {isOrientDone ? 'Satisfied' : 'Pending'}
                          </span>
                        </div>
                      </div>
                      {orient?.remarks && (
                        <p className="text-[10px] text-slate-500 bg-white/70 p-2 rounded border border-slate-200 mt-1">
                          <strong>Staff Note:</strong> {orient.remarks}
                        </p>
                      )}
                    </div>
                    
                    <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-900 leading-relaxed">
                      <strong>How to fulfill requirements:</strong> Attend the scheduled Pre-membership Education Seminar (PMES) and Loan Orientation. Cooperative staff will record attendance and verify your record in this registry.
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Detailed Verification History</p>
                    {compRecs.length > 0 ? (
                      <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {compRecs.map((rec: any) => (
                          <div key={rec.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs shadow-xs space-y-1">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-800 text-[11px]">{rec.requirementType.replace(/_/g, ' ')}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                rec.status === 'COMPLETED' || rec.status === 'VERIFIED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : rec.status === 'PENDING_VERIFICATION' || rec.status === 'ATTENDED'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {rec.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 font-mono">
                              <span className="flex items-center gap-1">
                                <Clock size={10} /> Attended: {rec.attendedAt || rec.attendanceDate ? new Date(rec.attendedAt || rec.attendanceDate).toLocaleDateString() : 'N/A'}
                              </span>
                              {rec.verifiedBy && (
                                <span className="flex items-center gap-1 text-emerald-700">
                                  <ShieldCheck size={10} /> Verified by {rec.verifiedBy}
                                </span>
                              )}
                              {rec.reference && (
                                <span>Ref: {rec.reference}</span>
                              )}
                            </div>
                            {rec.remarks && (
                              <p className="text-[10px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded border border-slate-100">{rec.remarks}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        <p className="text-xs text-slate-400 italic">No historical records available</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Change Security password box */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4 md:col-span-2">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Lock size={18} className="text-emerald-600" />
              Change Security Password
            </h3>
            <p className="text-xs text-slate-500">
              Update your account credentials to maintain secure transactions
              access.
            </p>

            <form
              onSubmit={handleChangePassword}
              className="space-y-4 max-w-md"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                  New Security Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  placeholder="Create new strong password"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-950/10 cursor-pointer"
              >
                Commit Password Update
              </button>
            </form>
          </div>

          {/* MEMBER PERSONAL GCASH PAYOUT INFORMATION CARD */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5 md:col-span-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    My Personal GCash Payout Info
                  </h3>
                  <p className="text-xs text-slate-500">
                    For Loan Disbursements, Dividends & Refunds
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-mono">
                Payout Details
              </span>
            </div>

            <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-xs text-blue-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-[11px] uppercase font-mono text-blue-800">
                <Shield className="w-4 h-4 text-blue-600" />
                Cooperative Payout Purpose
              </span>
              <p className="text-[11px] leading-relaxed text-blue-950">
                Your uploaded GCash QR code and saved account details are used
                only when the cooperative sends money to you (Loan
                Disbursements, Dividend Yields, Savings Withdrawals & Refunds).
              </p>
            </div>

            <form
              onSubmit={handleSaveMemberGcash}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GCash Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JUAN DELA CRUZ"
                    value={memberGcashName}
                    onChange={(e) => setMemberGcashName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-medium uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GCash Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 09171234567"
                    value={memberGcashNum}
                    onChange={(e) => setMemberGcashNum(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-mono font-bold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingMemberGcash}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  <Check className="w-4 h-4" />
                  {isSavingMemberGcash
                    ? "Saving Payout Info..."
                    : "Save GCash Payout Information"}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Personal GCash QR Code Image
                </label>

                {memberGcashQr ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
                    <div className="relative inline-block bg-white p-3 rounded-xl border border-slate-200 shadow-xs max-w-[180px]">
                      <img
                        src={memberGcashQr}
                        alt="Personal GCash QR Code"
                        className="w-full h-auto rounded-lg object-contain mx-auto max-h-[160px]"
                      />
                      <button
                        type="button"
                        onClick={() => setQrZoomModal(memberGcashQr)}
                        className="absolute top-1 right-1 p-1 bg-slate-900/70 text-white rounded-lg hover:bg-slate-900 transition-all cursor-pointer"
                        title="Zoom / Fullscreen Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex justify-center gap-2">
                      <label className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5" />
                        Replace QR
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={handleMemberQrFileUpload}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRemoveMemberQr}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Remove QR
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50 hover:bg-white rounded-2xl p-6 text-center transition-all">
                    <label className="cursor-pointer block space-y-2">
                      <QrCode className="w-10 h-10 text-slate-400 mx-auto" />
                      <span className="text-xs font-semibold text-emerald-700 block">
                        Click to upload personal GCash QR Code
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        PNG, JPG, JPEG, WebP (Max 15 MB)
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={handleMemberQrFileUpload}
                      />
                    </label>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Document Upload & Verification Section */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4 md:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText size={18} className="text-emerald-600" />
                  Member Documents & Verification Attachments
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Upload Government ID, Income Proof, Billing Statements, and
                  Loan Attachments for verification.
                </p>
              </div>
              <span className="text-xs font-mono px-3 py-1 bg-emerald-50 text-emerald-600 border border-indigo-100 rounded-full w-fit">
                {documents.length} File(s) Uploaded
              </span>
            </div>

            {/* Document Upload Form */}
            <form
              onSubmit={handleDocumentUploadSubmit}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">
                    Document Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e: any) => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="GOV_ID">Government ID</option>
                    <option value="SELFIE">Selfie Photo with ID</option>
                    <option value="INCOME_PROOF">
                      Proof of Income / Payslip
                    </option>
                    <option value="BILLING">Proof of Billing</option>
                    <option value="LOAN_AGREEMENT">
                      Loan Application Attachment
                    </option>
                    <option value="OTHER">Other Requirement Document</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">
                    Select File (PDF / Image)
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 px-3 py-2 bg-white border border-dashed border-slate-300 hover:border-indigo-400 rounded-xl text-xs text-slate-600 flex items-center gap-2 cursor-pointer transition-all">
                      <Upload size={14} className="text-emerald-600" />
                      <span className="truncate">
                        {uploadFileName || "Choose or drag file here..."}
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={uploading || !uploadFileData}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                    >
                      <Paperclip size={14} />
                      {uploading ? "Uploading..." : "Upload Document"}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Documents List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-mono bg-slate-50/50">
                    <th className="p-3">File Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Uploaded / Updated</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.length > 0 ? (
                    documents.map((doc: any) => {
                      const isPdf =
                        doc.fileType === "application/pdf" ||
                        doc.fileDataUrl?.startsWith("data:application/pdf") ||
                        doc.fileName?.endsWith(".pdf");
                      const isApprovedMember =
                        savingsData.member?.status === "ACTIVE";
                      const isReadOnly =
                        isApprovedMember &&
                        !savingsData.member?.additionalRequirementsRequested;
                      const categoryLabels: Record<string, string> = {
                        GOV_ID: "Government ID",
                        SELFIE: "Selfie Verification",
                        INCOME_PROOF: "Proof of Income",
                        BILLING: "Proof of Billing",
                        LOAN_AGREEMENT: "Loan Attachment",
                        OTHER: "Other Document",
                      };
                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="p-3 font-semibold text-slate-800">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                                <FileText size={16} />
                              </div>
                              <div>
                                <span className="block font-bold text-slate-800 text-xs">
                                  {doc.fileName}
                                </span>
                                {doc.fileSize && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {(doc.fileSize / 1024).toFixed(1)} KB
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-slate-700 font-semibold font-mono text-[11px]">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                              {categoryLabels[doc.documentCategory] ||
                                doc.documentCategory ||
                                "OTHER"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">
                            <div>
                              <span>
                                {doc.uploadedAt
                                  ? new Date(
                                      doc.uploadedAt,
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </span>
                              {doc.updatedAt &&
                                doc.updatedAt !== doc.uploadedAt && (
                                  <span className="text-[9px] text-emerald-600 block">
                                    Updated:{" "}
                                    {new Date(
                                      doc.updatedAt,
                                    ).toLocaleDateString()}
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                doc.status === "VERIFIED"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {doc.status || "PENDING"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Button */}
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewDoc({
                                    title:
                                      categoryLabels[doc.documentCategory] ||
                                      doc.documentCategory,
                                    category: doc.documentCategory,
                                    fileName: doc.fileName,
                                    fileType: isPdf
                                      ? "application/pdf"
                                      : "image/jpeg",
                                    fileDataUrl: doc.fileDataUrl,
                                    uploadedAt: doc.uploadedAt,
                                    updatedAt: doc.updatedAt,
                                  })
                                }
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 border border-indigo-100 rounded-lg inline-flex items-center gap-1 transition-all cursor-pointer text-xs font-semibold"
                                title="View / Preview File"
                              >
                                <Eye size={14} /> View
                              </button>

                              {/* Download Button */}
                              <a
                                href={doc.fileDataUrl}
                                download={doc.fileName}
                                className="p-1.5 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg inline-flex items-center gap-1 transition-all text-xs font-semibold"
                                title="Download File"
                              >
                                <Download size={14} />
                              </a>

                              {/* Replace / Edit Button */}
                              {!isReadOnly ? (
                                <label
                                  className="p-1.5 text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg inline-flex items-center gap-1 transition-all cursor-pointer text-xs font-semibold"
                                  title="Replace / Edit Document File"
                                >
                                  <RefreshCw size={14} />
                                  <span className="hidden sm:inline">
                                    Replace
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={(e: any) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleReplaceDocument(
                                          doc.id,
                                          e.target.files[0],
                                          doc.documentCategory,
                                        );
                                      }
                                    }}
                                  />
                                </label>
                              ) : (
                                <span
                                  className="p-1.5 text-slate-400 bg-slate-50 border border-slate-200 rounded-lg inline-flex items-center gap-1 text-[10px] font-mono"
                                  title="Document is locked because membership is active and verified"
                                >
                                  <Lock size={12} /> Locked
                                </span>
                              )}

                              {/* Delete Button */}
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg inline-flex items-center gap-1 transition-all cursor-pointer"
                                  title="Delete Document"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-6 text-center text-slate-400 font-mono text-xs"
                      >
                        No member verification documents uploaded yet.
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
          TAB 8: MEMBER NOTIFICATIONS
          ======================================================================= */}
      {activeTab === "member-notifications" && (
        <div
          className="space-y-6 animate-fade-in"
          id="tab-member-notifications"
        >
          {/* Email Notification Channel Card */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Mail size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-lg">
                      Email Notifications
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 size={12} />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Loan due-date reminders and important account notifications are sent to your registered email address.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                      <span className="text-slate-400 font-sans font-medium">Registered Member Email:</span>
                      <span className="font-semibold text-slate-900">{savingsData?.member?.email || 'epraimmamore71@gmail.com'}</span>
                    </div>
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl font-medium">
                      ✓ Automatic Loan Due Reminders (7d, 3d, Today, Overdue)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* In-App Notification Inbox */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Bell size={20} className="text-emerald-600" />
                  Notifications & Member In-App Inbox
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Real-time alerts regarding loan due dates, SMS reminders,
                  savings deposit confirmations, and dividends.
                </p>
              </div>
              <button
                onClick={() => markNotificationRead()}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-700 text-emerald-600 border border-indigo-150 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 w-fit"
              >
                <CheckCircle2 size={14} />
                Mark All as Read
              </button>
            </div>

            {/* Notification items list */}
            <div className="divide-y divide-slate-100 mt-4">
              {notifications.length > 0 ? (
                notifications.map((n: any) => (
                  <div
                    key={n.id}
                    onClick={() => !n.isRead && markNotificationRead(n.id)}
                    className={`p-4 rounded-2xl my-2 transition-all cursor-pointer flex items-start gap-3.5 border ${
                      !n.isRead
                        ? "bg-emerald-50/50 border-indigo-150 shadow-xs"
                        : "bg-white border-slate-150"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl flex-shrink-0 ${!n.isRead ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}
                    >
                      <Bell size={16} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4
                          className={`text-xs font-bold ${!n.isRead ? "text-emerald-600" : "text-slate-800"}`}
                        >
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {n.createdAt ? new Date(n.createdAt).toLocaleString() : "N/A"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-slate-400 font-mono text-xs space-y-2">
                  <Bell size={32} className="mx-auto text-slate-300" />
                  <p>Your notification inbox is clear. No unread alerts!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loan Application Details Inspector Modal */}
      {selectedAppForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-6 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase tracking-widest block">
                  Application Inspection #{selectedAppForModal.id}
                </span>
                <h3 className="text-lg font-bold text-slate-800">
                  {selectedAppForModal.loanTypeName} Filing Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedAppForModal(null)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Status Steps Pipeline */}
            <LoanWorkflowStepper
              status={selectedAppForModal.status}
              updatedAt={
                selectedAppForModal.updatedAt || selectedAppForModal.createdAt
              }
              remarks={selectedAppForModal.remarks}
              loanAmount={selectedAppForModal.amount}
            />

            {/* Application Overview Details */}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">
                  Requested Principal
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {formatCurrency(selectedAppForModal.amount || 0)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase">
                  Monthly Amortization
                </span>
                <span className="font-bold text-emerald-600 text-sm">
                  {formatCurrency(selectedAppForModal.monthlyAmortization || 0)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase">
                  Repayment Duration
                </span>
                <span className="font-semibold text-slate-800">
                  {selectedAppForModal.durationMonths} Months
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase">
                  Filing Date
                </span>
                <span className="font-semibold text-slate-800">
                  {new Date(selectedAppForModal.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] text-slate-400 block uppercase">
                  Stated Loan Purpose
                </span>
                <span className="font-medium text-slate-800">
                  {selectedAppForModal.purpose || "Personal / General Use"}
                </span>
              </div>

              {selectedAppForModal.coMakerName && (
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block uppercase">
                    Co-Maker / Guarantor
                  </span>
                  <span className="font-medium text-slate-800">
                    {selectedAppForModal.coMakerName} (
                    {selectedAppForModal.coMakerContact || "No phone"})
                  </span>
                </div>
              )}

              {selectedAppForModal.collateralDescription && (
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block uppercase">
                    Collateral Reference
                  </span>
                  <span className="font-medium text-slate-800">
                    {selectedAppForModal.collateralDescription}
                  </span>
                </div>
              )}
            </div>

            {/* Attached Verification Documents List */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">
                Uploaded Verification Documents (
                {selectedAppForModal.documents?.length || 0})
              </span>
              {selectedAppForModal.documents &&
              selectedAppForModal.documents.length > 0 ? (
                <div className="space-y-2">
                  {selectedAppForModal.documents.map((doc: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-emerald-600" />
                        <div>
                          <span className="font-bold text-slate-800 block">
                            {doc.fileName || doc.documentType}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono uppercase">
                            {doc.documentType}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                            doc.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : doc.status === "REJECTED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {doc.status || "PENDING"}
                        </span>
                        {doc.fileDataUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                title: doc.documentType || "Loan Document",
                                category: doc.documentType || "Loan Document",
                                fileName: doc.fileName || `${doc.documentType}.pdf`,
                                fileType: doc.fileType || (doc.fileDataUrl.startsWith("data:application/pdf") ? "application/pdf" : "image/jpeg"),
                                fileDataUrl: doc.fileDataUrl,
                                uploadedAt: doc.uploadedAt
                              })
                            }
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-all cursor-pointer"
                            title="Preview Document"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        {doc.fileDataUrl && (
                          <a
                            href={doc.fileDataUrl}
                            download={doc.fileName || "Document.pdf"}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-all"
                            title="Download Document"
                          >
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-mono italic">
                  No supporting documents attached to this application record.
                </p>
              )}
            </div>

            {/* Staff / Admin Remarks */}
            {selectedAppForModal.remarks && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs space-y-1">
                <span className="font-bold text-amber-900 font-mono text-[10px] uppercase block">
                  Staff Reviewer Remarks
                </span>
                <p className="text-amber-800">{selectedAppForModal.remarks}</p>
              </div>
            )}

            {/* Resubmit Missing Documents */}
            {selectedAppForModal.status === "REVISION_REQUESTED" &&
              selectedAppForModal.requestedAdditionalDocuments && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl space-y-4">
                  <div>
                    <h4 className="font-bold text-orange-900 text-xs font-mono uppercase">
                      Upload Requested Documents
                    </h4>
                    <p className="text-[11px] text-orange-800">
                      Please provide the following additional documents
                      requested by the credit committee.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {selectedAppForModal.requestedAdditionalDocuments.map(
                      (docType: string) => {
                        const attachedDoc = missingLoanDocs.find(
                          (d) => d.documentType === docType,
                        );
                        return (
                          <div
                            key={docType}
                            className={`p-3 rounded-xl border transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                              attachedDoc
                                ? "bg-white border-emerald-200"
                                : "bg-white border-orange-200"
                            }`}
                          >
                            <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                              {docType.replace(/_/g, " ")}
                            </span>

                            {attachedDoc ? (
                              <div className="flex items-center gap-3">
                                <span className="truncate max-w-[150px] font-medium text-slate-600">
                                  {attachedDoc.fileName}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveMissingLoanDoc(docType)
                                  }
                                  className="text-rose-600 hover:text-rose-700 text-[10px] font-bold uppercase font-mono px-2 py-1 bg-rose-50 rounded cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer transition-all border border-indigo-100 text-[11px] font-bold">
                                <Upload size={14} /> Attach File
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                      handleMissingLoanDocUpload(docType, file);
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => handleResubmitLoan(selectedAppForModal.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      Submit Missing Documents
                    </button>
                  </div>
                </div>
              )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {['PENDING_REVIEW', 'UNDER_REVIEW', 'REVISION_REQUESTED'].includes(selectedAppForModal.status) ? (
                <button
                  type="button"
                  onClick={() => handleCancelApplication(selectedAppForModal.id)}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-rose-200 flex items-center gap-1.5"
                >
                  <XCircle size={14} /> Withdraw Application
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setSelectedAppForModal(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold font-mono uppercase rounded-xl transition-all cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          PAYMENT SCHEDULE / LEDGER MODAL FOR MEMBERS
          ======================================================================= */}
      {selectedLoanForScheduleModal && (
        <LoanPaymentHistoryModal
          loan={selectedLoanForScheduleModal}
          token={token}
          cooperativeName={cooperativeName}
          onClose={() => setSelectedLoanForScheduleModal(null)}
          onViewReceipt={(receiptNoOrId) =>
            openReceiptForLoan({ id: receiptNoOrId })
          }
          onPayInstallment={(loanToPay, installment) => {
            setSelectedLoanForScheduleModal(null);
            setSelectedTargetInstallment(installment || null);
            setSelectedLoanForPayModal(loanToPay);
          }}
        />
      )}

      {/* =======================================================================
          GCASH LOAN PAYMENT MODAL FOR MEMBERS
          ======================================================================= */}
      {selectedLoanForPayModal && (
        <LoanPaymentModal
          loan={selectedLoanForPayModal}
          token={token}
          cooperativeName={cooperativeName}
          targetInstallment={selectedTargetInstallment}
          onClose={() => {
            setSelectedLoanForPayModal(null);
            setSelectedTargetInstallment(null);
          }}
          onSuccess={(msg) => {
            triggerMessage(msg);
            fetchData();
          }}
        />
      )}

      {/* Official Receipt Modal Rendered for Member */}
      {selectedReceiptForModal && (
        <OfficialReceiptModal
          receipt={selectedReceiptForModal}
          member={savingsData.member || undefined}
          settings={{
            orPrefix: "OR-",
            orNextNumber: 1001,
            numberPadding: 6,
            headerTitle: cooperativeName || "Credit & Development Cooperative",
            address: "Cooperative Main Office, City Hall Complex",
            tin: "123-456-789-000",
            cdaRegNo: "CDA-REG-2024-9918",
            contactPhone: "+63 917 123 4567",
            contactEmail: "info@coop.org.ph",
            logoUrl: "",
            footerNote:
              "Official Release Receipt / Cashier Voucher. Thank you for your continued patronage.",
            authorizedSignatoryName: "Head Cashier / Disbursing Officer",
            authorizedSignatoryTitle: "Authorized Cashier & Finance Officer",
          }}
          userRole="MEMBER"
          onClose={() => setSelectedReceiptForModal(null)}
          onRefresh={fetchData}
          onRecordPrint={async (receiptId, action) => {
            try {
              await fetch(`/api/receipts/${receiptId}/print`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ action }),
              });
            } catch (err) {
              console.error("Failed to log print action:", err);
            }
          }}
        />
      )}

      {/* Document Preview Modal */}
      <DocumentViewerModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={
          previewDoc
            ? {
                fileName: previewDoc.fileName,
                fileType: previewDoc.fileType,
                fileDataUrl: previewDoc.fileDataUrl,
                documentCategory: previewDoc.category,
                documentType: previewDoc.category,
                uploadedAt: previewDoc.uploadedAt,
                status: "Submitted",
              }
            : null
        }
        title="SUBMITTED DOCUMENT"
      />

      {/* QR Code Zoom Preview Modal */}
      {qrZoomModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setQrZoomModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQrZoomModal(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-600" />
              Personal GCash QR Code
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <img
                src={qrZoomModal}
                alt="GCash QR Code Zoomed"
                className="w-full h-auto rounded-xl max-h-[350px] object-contain mx-auto"
              />
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              Scan or save this QR code for cooperative loan payouts & dividend
              distributions.
            </p>
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {withdrawalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-6 relative">
            <button
              onClick={() => setWithdrawalModalOpen(false)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Request Withdrawal
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Your request will be reviewed before your savings balance is deducted.
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Current Savings Balance:</span>
                <span className="font-mono font-bold text-slate-800">₱{formatMoney(savingsData.member?.regularSavings || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Maintaining Balance:</span>
                <span className="font-mono font-bold text-slate-800">₱500.00</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                <span className="font-bold text-slate-800">Available to Withdraw:</span>
                <span className="font-mono font-bold text-emerald-600">₱{formatMoney(Math.max(0, (savingsData.member?.regularSavings || 0) - 500))}</span>
              </div>
            </div>

            <form onSubmit={submitWithdrawalRequest} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                  Requested Amount
                </label>
                <input
                  type="number"
                  min="100"
                  max={Math.max(0, (savingsData.member?.regularSavings || 0) - 500)}
                  required
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. 5000"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                  Release Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all ${withdrawalMethod === "GCASH" ? "border-blue-500 bg-blue-50/50" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <input
                      type="radio"
                      name="wmethod"
                      value="GCASH"
                      checked={withdrawalMethod === "GCASH"}
                      onChange={() => setWithdrawalMethod("GCASH")}
                      className="sr-only"
                    />
                    <QrCode
                      className={`w-6 h-6 ${withdrawalMethod === "GCASH" ? "text-blue-600" : "text-slate-400"}`}
                    />
                    <span
                      className={`text-xs font-bold ${withdrawalMethod === "GCASH" ? "text-blue-700" : "text-slate-600"}`}
                    >
                      GCash
                    </span>
                  </label>
                  <label
                    className={`border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all ${withdrawalMethod === "CASH" ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <input
                      type="radio"
                      name="wmethod"
                      value="CASH"
                      checked={withdrawalMethod === "CASH"}
                      onChange={() => setWithdrawalMethod("CASH")}
                      className="sr-only"
                    />
                    <Wallet
                      className={`w-6 h-6 ${withdrawalMethod === "CASH" ? "text-emerald-600" : "text-slate-400"}`}
                    />
                    <span
                      className={`text-xs font-bold ${withdrawalMethod === "CASH" ? "text-emerald-700" : "text-slate-600"}`}
                    >
                      Office Cash
                    </span>
                  </label>
                </div>
              </div>

              {withdrawalMethod === "GCASH" && (
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-800 mb-1">
                    Funds will be sent to your registered GCash number:
                  </p>
                  <p className="font-mono font-bold text-blue-900">
                    {savingsData.member?.gcashNumber ||
                      "No GCash number registered"}
                  </p>
                  {!savingsData.member?.gcashNumber && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1">
                      Please update your profile with a GCash number first.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                  Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={withdrawalRemarks}
                  onChange={(e) => setWithdrawalRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="Purpose of withdrawal"
                />
              </div>

              <button
                type="submit"
                disabled={
                  !withdrawalAmount ||
                  (withdrawalMethod === "GCASH" &&
                    !savingsData.member?.gcashNumber)
                }
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl cursor-pointer disabled:opacity-50 transition-colors mt-2"
              >
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Open Time Deposit Modal */}
      {openTdModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-6 relative">
            <button
              onClick={() => setOpenTdModalOpen(false)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Open Time Deposit Contract
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Use available Regular Savings funds to open a fixed-term deposit.
            </p>

            <form onSubmit={handleOpenTimeDeposit} className="space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-slate-500 font-medium">Available Regular Savings:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(savingsData?.member?.regularSavings || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center font-mono pt-1.5 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium">Maximum Available Placement:</span>
                  <span className="font-bold text-purple-700">
                    {formatCurrency(Math.max(0, savingsData?.member?.regularSavings || 0))}
                  </span>
                </div>
              </div>

              {(savingsData?.member?.regularSavings || 0) < 1000 && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Insufficient Regular Savings Balance</p>
                    <p className="mt-0.5 text-[11px] font-sans text-amber-700">
                      You need at least ₱1,000.00 in Regular Savings to fund a Time Deposit. Please deposit funds into Regular Savings first. Share Capital cannot be used to fund Time Deposits.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                  Placement Principal Amount (₱)
                </label>
                <input
                  type="number"
                  min="1000"
                  max={savingsData?.member?.regularSavings || 0}
                  required
                  value={tdAmount}
                  onChange={(e) => setTdAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-purple-500"
                  placeholder="Min ₱1,000"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                  Contract Term & Yield
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { term: "6", label: "6 Mos", rate: "5.5%" },
                    { term: "12", label: "1 Year", rate: "6.5%" },
                    { term: "24", label: "2 Years", rate: "7.5%" }
                  ].map((t) => (
                    <button
                      key={t.term}
                      type="button"
                      onClick={() => setTdTerm(t.term)}
                      className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                        tdTerm === t.term
                          ? "border-purple-600 bg-purple-50 text-purple-900 shadow-xs"
                          : "border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <div className="font-bold text-xs">{t.label}</div>
                      <div className="text-[10px] text-purple-700 font-mono font-bold mt-0.5">{t.rate} p.a.</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                  Maturity Instruction
                </label>
                <select
                  value={tdRenewal}
                  onChange={(e: any) => setTdRenewal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500"
                >
                  <option value="AUTOMATIC_ROLLOVER">Automatic Principal & Interest Rollover</option>
                  <option value="PAYOUT_TO_SAVINGS">Payout Principal & Interest to Regular Savings</option>
                  <option value="MANUAL">Hold Upon Maturity (Manual Instruction)</option>
                </select>
              </div>

              {Number(tdAmount) >= 1000 && (
                <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-100 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-purple-900">
                    <span>Annualized Rate:</span>
                    <span className="font-bold">{tdTerm === "6" ? "5.50%" : tdTerm === "24" ? "7.50%" : "6.50%"} p.a.</span>
                  </div>
                  <div className="flex justify-between text-purple-900">
                    <span>Term Duration:</span>
                    <span>{tdTerm} Months</span>
                  </div>
                  <div className="flex justify-between text-purple-900">
                    <span>Maturity Date:</span>
                    <span>
                      {new Date(new Date().setMonth(new Date().getMonth() + Number(tdTerm))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-purple-900">
                    <span>Est. Interest for {tdTerm} Mos:</span>
                    <strong className="font-bold text-emerald-700">
                      +{formatCurrency(
                        Number(tdAmount) *
                        (tdTerm === "6" ? 0.055 : tdTerm === "24" ? 0.075 : 0.065) *
                        (Number(tdTerm) / 12)
                      )}
                    </strong>
                  </div>
                  <div className="pt-1.5 border-t border-purple-200/60 flex justify-between text-purple-950 font-bold">
                    <span>Total Maturity Payout:</span>
                    <span className="text-purple-700">
                      {formatCurrency(
                        Number(tdAmount) +
                        Number(tdAmount) *
                          (tdTerm === "6" ? 0.055 : tdTerm === "24" ? 0.075 : 0.065) *
                          (Number(tdTerm) / 12)
                      )}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  (savingsData.member?.regularSavings || 0) < 1000 ||
                  !tdAmount ||
                  Number(tdAmount) < 1000 ||
                  Number(tdAmount) > (savingsData.member?.regularSavings || 0)
                }
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                Confirm & Fund Placement
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Regular Savings Deposit Modal */}
      {depositModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-6 relative">
            <button
              onClick={() => setDepositModalOpen(false)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Wallet size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {depositAccount === "shareCapital" ? "Contribute to Share Capital" : "Deposit to Regular Savings"}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Submit your payment details and reference. Your {depositAccount === "shareCapital" ? "share capital" : "savings"} balance will be updated after staff verification.
            </p>

            <form onSubmit={handleRegularSavingsDeposit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                  Deposit Amount (₱)
                </label>
                <input
                  type="number"
                  min="10"
                  required
                  value={depositAmountInput}
                  onChange={(e) => setDepositAmountInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. 1000"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setDepositMethod("GCASH")}
                    className={`border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      depositMethod === "GCASH" ? "border-blue-500 bg-blue-50/50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <QrCode className={`w-5 h-5 ${depositMethod === "GCASH" ? "text-blue-600" : "text-slate-400"}`} />
                    <span className={`text-[10px] font-bold ${depositMethod === "GCASH" ? "text-blue-700" : "text-slate-600"}`}>
                      GCash
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMethod("BANK_TRANSFER")}
                    className={`border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      depositMethod === "BANK_TRANSFER" ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <BookOpen className={`w-5 h-5 ${depositMethod === "BANK_TRANSFER" ? "text-indigo-600" : "text-slate-400"}`} />
                    <span className={`text-[10px] font-bold ${depositMethod === "BANK_TRANSFER" ? "text-indigo-700" : "text-slate-600"}`}>
                      Bank Transfer
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMethod("CASH")}
                    className={`border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      depositMethod === "CASH" ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Wallet className={`w-5 h-5 ${depositMethod === "CASH" ? "text-emerald-600" : "text-slate-400"}`} />
                    <span className={`text-[10px] font-bold ${depositMethod === "CASH" ? "text-emerald-700" : "text-slate-600"}`}>
                      Office Cash
                    </span>
                  </button>
                </div>
              </div>

              {depositMethod === "GCASH" && (
                <div className="bg-sky-50 p-3 rounded-lg border border-sky-100 mb-3 space-y-2 text-xs">
                  <div className="flex flex-col text-sky-900 bg-white p-2 rounded border border-sky-200">
                    <span className="font-bold text-[10px] text-slate-500 uppercase">Official GCash Number:</span>
                    <span className="font-extrabold text-blue-700 font-mono text-sm">{gcashConfig?.mobileNumber || '0917-888-2288'}</span>
                    <span className="text-[10px]">{gcashConfig?.accountName || 'CCT COOPERATIVE INC.'}</span>
                  </div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                    GCash Reference Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={depositGcashRef}
                    onChange={(e) => setDepositGcashRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                    placeholder="13-digit reference number"
                  />
                </div>
              )}

              {depositMethod === "BANK_TRANSFER" && (
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-3 space-y-2 text-xs">
                  <div className="flex flex-col text-indigo-900 bg-white p-2 rounded border border-indigo-200">
                    <span className="font-bold text-[10px] text-slate-500 uppercase">Official Bank Account:</span>
                    <span className="font-extrabold text-indigo-700 text-sm">{bankConfig?.bankName || 'BDO Unibank'}</span>
                    <span className="font-extrabold font-mono text-sm">{bankConfig?.accountNumber || '001234567890'}</span>
                    <span className="text-[10px]">{bankConfig?.accountName || 'CCT COOPERATIVE INC.'}</span>
                  </div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1.5">
                    Bank Reference Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={depositGcashRef}
                    onChange={(e) => setDepositGcashRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                    placeholder="Transaction Reference"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={!depositAmountInput || Number(depositAmountInput) <= 0}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl cursor-pointer disabled:opacity-50 transition-colors mt-2"
              >Submit Deposit</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

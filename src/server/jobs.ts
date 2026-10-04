import fs from 'fs';
import path from 'path';
import { CooperativeDB } from '../db/db.js';
import { SmsNotification, SmsTriggerType, Loan, AmortizationItem } from '../types.js';
import { sendMemberNotificationEmail } from './emailService.js';

// In-memory set of processed notification keys for the active runtime session
const sessionProcessedKeys = new Set<string>();

/**
 * Returns the calendar date string (YYYY-MM-DD) in Asia/Manila timezone (UTC+8)
 */
export function getManilaDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Calculates calendar day difference between two YYYY-MM-DD dates in a timezone-independent manner.
 * Positive return value means targetDate is in the future.
 * Negative return value means targetDate is in the past (overdue).
 */
export function getCalendarDaysDiff(targetDateStr: string, baseDateStr: string): number {
  const [y1, m1, d1] = targetDateStr.split('-').map(Number);
  const [y2, m2, d2] = baseDateStr.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24));
}

export function startBackgroundJobs() {
  console.log('[Jobs] Starting background scheduled jobs (Automatic Loan Due Email Notifications & Backup)...');
  
  // Run checks every hour
  setInterval(() => {
    runScheduledBackup();
    runAutomatedSmsScan();
    runAutomatedLoanDueDateEmailScan().catch(err =>
      console.error('[Jobs] Hourly loan due email scan error (non-fatal):', err?.message || err)
    );
  }, 1000 * 60 * 60);

  // Run on startup after 3 seconds
  setTimeout(() => {
    runScheduledBackup();
    runAutomatedSmsScan();
    runAutomatedLoanDueDateEmailScan().catch(err =>
      console.error('[Jobs] Startup loan due email scan error (non-fatal):', err?.message || err)
    );
  }, 3000);
}

function runScheduledBackup() {
  try {
    const db = CooperativeDB.load();
    if (!db.scheduledBackupConfig?.enabled) return;

    const nextBackupAt = new Date(db.scheduledBackupConfig.nextBackupAt).getTime();
    const now = Date.now();

    if (now >= nextBackupAt) {
      console.log('[Jobs] Executing scheduled backup...');
      
      // Ensure backups directory exists
      const backupsDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const backupFilename = `coop_backup_auto_${now}.json`;
      const backupPath = path.join(backupsDir, backupFilename);
      
      // Save backup file
      fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), 'utf8');

      // Update next backup schedule
      db.scheduledBackupConfig.lastBackupAt = new Date().toISOString();
      const frequency = db.scheduledBackupConfig.frequency;
      const daysToAdd = frequency === 'WEEKLY' ? 7 : frequency === 'MONTHLY' ? 30 : 1;
      db.scheduledBackupConfig.nextBackupAt = new Date(now + daysToAdd * 86400000).toISOString();
      
      CooperativeDB.save(db);
      console.log(`[Jobs] Scheduled backup completed: ${backupFilename}`);
    }
  } catch (err) {
    console.error('[Jobs] Failed to run scheduled backup:', err);
  }
}

function runAutomatedSmsScan() {
  try {
    const db = CooperativeDB.load();
    if (!db.smsNotifications) db.smsNotifications = [];
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let checkedCount = 0;
    let sentCount = 0;
    const gateway = db.smsGatewaySettings?.activeGateway || 'SystemSimulator';

    if (!db.systemSettings) {
      (db as any).systemSettings = { cooperativeName: 'CCT Cooperative' };
    }
    if ((db.systemSettings as any).lastAutomatedSmsScan === todayStr) {
      return; 
    }

    console.log('[Jobs] Running automated SMS scan for overdue loans/savings...');

    // 1. Scan Active Loans
    const activeLoans = db.loans.filter((l: any) => l.status === 'ACTIVE' && l.balance > 0);
    
    activeLoans.forEach((loan: any) => {
      if (!loan.dueDate) return;
    
      const d1 = new Date(loan.dueDate);
      d1.setHours(0, 0, 0, 0);
      const d2 = new Date(today);
      d2.setHours(0, 0, 0, 0);
    
      const timeDiff = d1.getTime() - d2.getTime();
      const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
    
      const member = db.members.find((m: any) => m.id === loan.memberId);
      if (!member) return;
    
      const checkDuplicate = (type: SmsTriggerType) => {
        return db.smsNotifications.some(
          (n: any) => n.memberId === loan.memberId && 
               n.loanId === loan.id && 
               n.type === type && 
               n.dueDate === loan.dueDate
        );
      };
    
      let alertType: SmsTriggerType | null = null;
      let alertTitle = 'Upcoming Loan Payment Due';
      let message = '';
    
      if (daysDiff === 7) {
        alertType = '7_DAYS_BEFORE';
        alertTitle = 'Upcoming Loan Payment Due (7 Days)';
        message = `Dear ${member.fullName}, reminder that loan payment for ${loan.id} (₱${loan.monthlyAmortization.toLocaleString()}) is due in 7 days on ${loan.dueDate}. Ref: REF-${loan.id}. Thank you!`;
      } else if (daysDiff === 3) {
        alertType = '3_DAYS_BEFORE';
        alertTitle = 'Upcoming Loan Payment Due (3 Days)';
        message = `Dear ${member.fullName}, loan payment for ${loan.id} (₱${loan.monthlyAmortization.toLocaleString()}) is due in 3 days on ${loan.dueDate}. Please keep your account funded.`;
      } else if (daysDiff === 1) {
        alertType = '1_DAY_BEFORE';
        alertTitle = 'Upcoming Loan Payment Due Tomorrow';
        message = `URGENT: Dear ${member.fullName}, loan payment for ${loan.id} (₱${loan.monthlyAmortization.toLocaleString()}) is due TOMORROW, ${loan.dueDate}. Please pay on time.`;
      } else if (daysDiff === 0) {
        alertType = 'ON_DUE_DATE';
        alertTitle = 'Loan Payment Due Today';
        message = `Dear ${member.fullName}, loan payment for ${loan.id} (₱${loan.monthlyAmortization.toLocaleString()}) is due TODAY, ${loan.dueDate}. Settle balance to preserve credit score.`;
      } else if (daysDiff < 0) {
        alertType = 'AFTER_DUE_DATE';
        alertTitle = 'Loan Payment Overdue';
        message = `OVERDUE NOTICE: Dear ${member.fullName}, loan payment for ${loan.id} (₱${loan.monthlyAmortization.toLocaleString()}) was due on ${loan.dueDate} and is OVERDUE. Pay immediately to avoid penalties.`;
      }
    
      if (alertType && !checkDuplicate(alertType)) {
        const statuses: ('Sent' | 'Failed' | 'Pending' | 'Delivered')[] = ['Delivered', 'Sent', 'Delivered', 'Delivered', 'Failed'];
        const status = alertType === 'AFTER_DUE_DATE' ? 'Delivered' : statuses[Math.floor(Math.random() * statuses.length)];
    
        const newSms: SmsNotification = {
          id: 'sms_' + Math.random().toString(36).substring(2, 11),
          memberId: loan.memberId,
          memberName: member.fullName,
          memberNumber: member.id,
          phone: member.phone || '+1 (555) 123-4567',
          category: 'LOAN_DUE',
          type: alertType,
          loanId: loan.id,
          loanRef: loan.id,
          dueDate: loan.dueDate,
          amount: loan.monthlyAmortization,
          message,
          status,
          gatewayUsed: gateway,
          sentAt: status !== 'Failed' ? new Date().toISOString() : undefined,
          createdAt: new Date().toISOString()
        };
    
        db.smsNotifications.unshift(newSms);
    
        CooperativeDB.createNotification(
          member.id,
          alertTitle,
          message,
          {
            loanId: loan.id,
            loanNumber: loan.id,
            amount: loan.monthlyAmortization,
            dueDate: loan.dueDate,
            actionUrl: `${process.env.APP_URL || 'http://localhost:3000'}/?tab=member-loans`
          }
        );
    
        sentCount++;
      }
      checkedCount++;
    });

    const currentDayOfMonth = today.getDate();
    if (currentDayOfMonth === 25 || currentDayOfMonth === 28) {
      db.members.filter((m: any) => m.status === 'ACTIVE').forEach((member: any) => {
        const checkExists = db.smsNotifications.some(
          (n: any) => n.memberId === member.id && n.category === 'SAVINGS_DUE' && n.createdAt.startsWith(todayStr)
        );
        if (!checkExists) {
          const msg = `Dear ${member.fullName}, friendly reminder to make your regular monthly savings deposit before end of month to qualify for full annual dividends!`;
          const newSms: SmsNotification = {
            id: 'sms_sav_' + Math.random().toString(36).substring(2, 11),
            memberId: member.id,
            memberName: member.fullName,
            phone: member.phone || '+1 (555) 000-0000',
            category: 'SAVINGS_DUE',
            type: 'ON_DUE_DATE',
            amount: 500,
            message: msg,
            status: 'Delivered',
            gatewayUsed: gateway,
            sentAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          db.smsNotifications.unshift(newSms);
          CooperativeDB.createNotification(member.id, 'Monthly Savings Deposit Call', msg);
          sentCount++;
        }
      });
    }

    if (sentCount > 0) {
      (db.systemSettings as any).lastAutomatedSmsScan = todayStr;
      CooperativeDB.save(db);
      console.log(`[Jobs] Completed SMS scan. Sent ${sentCount} notifications.`);
    }
  } catch (err) {
    console.error('[Jobs] Failed to run automated SMS scan:', err);
  }
}

export interface LoanDueDateScanResult {
  asOfDate: string;
  checkedLoans: number;
  evaluatedInstallments: number;
  sentCount: number;
  skippedDuplicates: number;
  skippedPaid: number;
  errors: string[];
}

/**
 * Scans active loan amortization schedules and automatically sends email notifications
 * for installments due in 7 days, 3 days, today, or overdue.
 *
 * Implements deterministic idempotency to guarantee zero duplicate emails across server restarts.
 * Never mutates loans, ledger, payments, balances, or financial records.
 */
export async function runAutomatedLoanDueDateEmailScan(
  asOfDate: Date = new Date()
): Promise<LoanDueDateScanResult> {
  const todayManilaStr = getManilaDateString(asOfDate);
  const result: LoanDueDateScanResult = {
    asOfDate: todayManilaStr,
    checkedLoans: 0,
    evaluatedInstallments: 0,
    sentCount: 0,
    skippedDuplicates: 0,
    skippedPaid: 0,
    errors: []
  };

  try {
    const db = CooperativeDB.load();
    const coopName = db.systemSettings?.cooperativeName || 'CCT Cooperative';
    const activeLoans = (db.loans || []).filter(
      (l: any) => l.status === 'ACTIVE' && ((l.balance || 0) > 0 || (l.totalRepayable && l.totalRepayable > (l.totalPaid || 0)))
    );

    result.checkedLoans = activeLoans.length;

    for (const loan of activeLoans) {
      // 1. Resolve registered member email
      const member = (db.members || []).find((m: any) => m.id === loan.memberId || m.memberNumber === loan.memberId);
      const user = (db.users || []).find(
        (u: any) => u.memberId === loan.memberId || u.id === loan.memberId || (member && u.email === member.email)
      );

      const recipientEmail = (member?.email || user?.email || '').trim();
      const recipientName = member?.fullName || (user as any)?.fullName || 'Valued Member';

      if (!recipientEmail || !recipientEmail.includes('@')) {
        continue;
      }

      // 2. Resolve loan type display name
      const loanTypeName = loan.loanTypeName || (loan as any).loanType || 'Cooperative Loan';

      // 3. Inspect authoritative amortization schedule
      const schedule: AmortizationItem[] = loan.amortizationSchedule || [];

      for (const item of schedule) {
        result.evaluatedInstallments++;

        // Never notify paid or waived installments
        const scheduled = item.scheduledAmount || Number(((item.principalAmount || 0) + (item.interestAmount || 0) + (item.penaltyAmount || 0)).toFixed(2));
        const paid = item.amountPaid || 0;
        const remaining = typeof item.remainingAmount === 'number'
          ? item.remainingAmount
          : Math.max(0, Number((scheduled - paid).toFixed(2)));

        if (item.status === 'PAID' || item.status === 'WAIVED' || paid >= scheduled || remaining <= 0) {
          result.skippedPaid++;
          continue;
        }

        // Calculate calendar days difference in Manila time
        const daysDiff = getCalendarDaysDiff(item.dueDate, todayManilaStr);

        let eventKey: string | null = null;
        let subject: string = '';
        let title: string = '';
        let message: string = '';

        if (daysDiff === 7) {
          eventKey = `LOAN_DUE_7DAYS:${loan.id}:${item.installmentNo}:${item.dueDate}`;
          subject = 'CCT Cooperative - Loan Payment Due in 7 Days';
          title = 'Loan Payment Due in 7 Days';
          message = `Dear ${recipientName}, this is an official reminder that installment #${item.installmentNo} for your ${loanTypeName} (${loan.id}) in the amount of ₱${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} is scheduled for payment on ${item.dueDate} (in 7 days). Total outstanding loan balance is ₱${(loan.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}. Please ensure your account has sufficient funds or prepare your payment before the due date.`;
        } else if (daysDiff === 3) {
          eventKey = `LOAN_DUE_3DAYS:${loan.id}:${item.installmentNo}:${item.dueDate}`;
          subject = 'CCT Cooperative - Loan Payment Due in 3 Days';
          title = 'Loan Payment Due in 3 Days';
          message = `Dear ${recipientName}, this is an urgent reminder that installment #${item.installmentNo} for your ${loanTypeName} (${loan.id}) in the amount of ₱${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} is due in 3 days on ${item.dueDate}. Total outstanding loan balance is ₱${(loan.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}. Please prepare your payment to keep your loan in good standing.`;
        } else if (daysDiff === 0) {
          eventKey = `LOAN_DUE_TODAY:${loan.id}:${item.installmentNo}:${item.dueDate}`;
          subject = 'CCT Cooperative - Loan Payment Due Today';
          title = 'Loan Payment Due Today';
          message = `Dear ${recipientName}, installment #${item.installmentNo} for your ${loanTypeName} (${loan.id}) in the amount of ₱${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} is due TODAY, ${item.dueDate}. Total outstanding loan balance is ₱${(loan.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}. Payment Instructions: You can settle this payment via GCash online through the member portal, bank transfer, or at the CCT Cooperative cashier desk. Settle today to avoid overdue interest and maintain a pristine credit rating.`;
        } else if (daysDiff < 0) {
          eventKey = `LOAN_OVERDUE:${loan.id}:${item.installmentNo}:${item.dueDate}`;
          subject = 'CCT Cooperative - Loan Payment Overdue';
          title = 'Loan Payment Overdue';
          message = `OVERDUE NOTICE: Dear ${recipientName}, installment #${item.installmentNo} for your ${loanTypeName} (${loan.id}) with remaining amount of ₱${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} was due on ${item.dueDate} and is now OVERDUE. Current status: Past Due. Payment Instructions: Please settle your overdue payment immediately via GCash through the Member Portal or visit the cooperative office to avoid additional default penalties and preserve your credit standing.`;
        }

        // If not a target notification day, skip
        if (!eventKey) {
          continue;
        }

        // 4. Duplicate protection: Check persisted database records and active session set
        const alreadyDispatched = (db.notifications || []).some(
          (n: any) => n.metadata?.eventKey === eventKey
        );

        if (alreadyDispatched || sessionProcessedKeys.has(eventKey)) {
          result.skippedDuplicates++;
          continue;
        }

        // 5. Dispatch email notification safely
        try {
          const emailResult = await sendMemberNotificationEmail({
            toEmail: recipientEmail,
            fullName: recipientName,
            title,
            subjectOverride: subject,
            message,
            loanNumber: loan.id,
            referenceNumber: loan.id,
            amount: remaining,
            dueDate: item.dueDate,
            actionUrl: `${process.env.APP_URL || 'http://localhost:3000'}/?tab=member-loans`,
            actionLabel: 'Access Member Portal',
            cooperativeName: coopName
          });

          // Mark in session set
          sessionProcessedKeys.add(eventKey);

          // 6. Create in-app notification record with deterministic key
          const notif = CooperativeDB.createNotification(
            member?.id || user?.id || loan.memberId,
            title,
            message,
            {
              eventKey,
              loanId: loan.id,
              loanNumber: loan.id,
              loanType: loanTypeName,
              installmentNo: item.installmentNo,
              dueDate: item.dueDate,
              amount: remaining,
              remainingBalance: loan.balance,
              actionUrl: '/?tab=member-loans',
              actionLabel: 'View Loan Details',
              skipAutoEmail: true // Prevents duplicate email dispatch from generic notification hook
            }
          );

          // Update delivery status on notification record
          const currentDb = CooperativeDB.load();
          const savedNotif = (currentDb.notifications || []).find((n: any) => n.id === notif.id);
          if (savedNotif) {
            savedNotif.deliveryStatus = {
              email: {
                attempted: true,
                success: emailResult.sent,
                provider: emailResult.provider,
                error: emailResult.error,
                sentAt: new Date().toISOString()
              }
            };
            savedNotif.emailSent = emailResult.sent;
            CooperativeDB.save(currentDb);
          }

          result.sentCount++;
        } catch (dispatchErr: any) {
          const errString = dispatchErr?.message || String(dispatchErr);
          result.errors.push(`${loan.id} #${item.installmentNo}: ${errString}`);
          console.error(`[Jobs] Failed to send loan due email for ${loan.id} to ${recipientEmail}:`, errString);
          // Never modify loan balances, repayments, or ledger!
        }
      }
    }
  } catch (scanErr: any) {
    console.error('[Jobs] Error executing loan due-date email scan:', scanErr?.message || scanErr);
    result.errors.push(scanErr?.message || String(scanErr));
  }

  return result;
}

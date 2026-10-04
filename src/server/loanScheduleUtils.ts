import { LoanType, SystemSettings, AmortizationItem } from '../types.js';

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isHoliday(date: Date, holidays: string[]): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return holidays.includes(dateStr);
}

export function adjustDueDate(
  originalDueDate: Date,
  adjustmentRule: 'NONE' | 'NEXT_WORKING_DAY' | 'PREVIOUS_WORKING_DAY' | undefined,
  holidays: string[]
): Date {
  if (!adjustmentRule || adjustmentRule === 'NONE') {
    return originalDueDate;
  }
  
  let adjustedDate = new Date(originalDueDate);
  let step = adjustmentRule === 'NEXT_WORKING_DAY' ? 1 : -1;
  
  while (isWeekend(adjustedDate) || isHoliday(adjustedDate, holidays)) {
    adjustedDate.setDate(adjustedDate.getDate() + step);
  }
  return adjustedDate;
}

export function generateAmortizationSchedule(
  principalAmount: number,
  interestAmount: number,
  durationMonths: number,
  releaseDateObj: Date,
  loanType: LoanType,
  systemSettings: any
): { schedule: AmortizationItem[], firstDueDateStr: string } {
  const totalRepayable = principalAmount + interestAmount;
  
  const frequency = loanType.repaymentFrequency || 'MONTHLY';
  const anchorDateStr = loanType.anchorDate;
  const firstDueDateRule = loanType.firstDueDateRule || 'AFTER_X_DAYS';
  const firstDueDateDays = loanType.firstDueDateDays || 30;
  
  let numberOfInstallments = durationMonths;
  if (frequency === 'SEMI_MONTHLY') {
    numberOfInstallments = durationMonths * 2;
  } else if (frequency === 'WEEKLY') {
    // Approx 4 weeks per month
    numberOfInstallments = durationMonths * 4;
  }
  
  const principalPerInstallment = principalAmount / numberOfInstallments;
  const interestPerInstallment = interestAmount / numberOfInstallments;
  const totalPerInstallment = principalPerInstallment + interestPerInstallment;
  
  const schedule: AmortizationItem[] = [];
  let remainingBalance = totalRepayable;
  
  const holidays = systemSettings?.holidays || [];
  const adjustmentRule = loanType.dueDateAdjustment || systemSettings?.defaultDueDateAdjustment || 'NONE';
  
  let currentDueDate = new Date(releaseDateObj);
  
  if (firstDueDateRule === 'AFTER_X_DAYS') {
    currentDueDate.setDate(currentDueDate.getDate() + firstDueDateDays);
  } else if (firstDueDateRule === 'ALIGN_TO_ANCHOR' && anchorDateStr) {
    if (frequency === 'MONTHLY') {
      const anchorDay = parseInt(anchorDateStr);
      if (!isNaN(anchorDay)) {
        currentDueDate.setDate(anchorDay);
        if (currentDueDate <= releaseDateObj) {
          currentDueDate.setMonth(currentDueDate.getMonth() + 1);
        }
      } else {
        currentDueDate.setDate(currentDueDate.getDate() + 30);
      }
    } else if (frequency === 'SEMI_MONTHLY') {
       const anchors = anchorDateStr.split(',').map(s => parseInt(s.trim()));
       if (anchors.length === 2 && !isNaN(anchors[0]) && !isNaN(anchors[1])) {
         // Find next closest anchor
         const nextAnchor1 = new Date(currentDueDate);
         nextAnchor1.setDate(anchors[0]);
         if (nextAnchor1 <= releaseDateObj) nextAnchor1.setMonth(nextAnchor1.getMonth() + 1);
         
         const nextAnchor2 = new Date(currentDueDate);
         nextAnchor2.setDate(anchors[1]);
         if (nextAnchor2 <= releaseDateObj) nextAnchor2.setMonth(nextAnchor2.getMonth() + 1);
         
         currentDueDate = nextAnchor1 < nextAnchor2 ? nextAnchor1 : nextAnchor2;
       } else {
         currentDueDate.setDate(currentDueDate.getDate() + 15);
       }
    } else if (frequency === 'WEEKLY') {
       // if anchorDate is a weekday 0-6
       const anchorDayOfWeek = parseInt(anchorDateStr);
       if (!isNaN(anchorDayOfWeek) && anchorDayOfWeek >= 0 && anchorDayOfWeek <= 6) {
         let daysUntilNext = (anchorDayOfWeek - currentDueDate.getDay() + 7) % 7;
         if (daysUntilNext === 0) daysUntilNext = 7; // Next week if today is anchor
         currentDueDate.setDate(currentDueDate.getDate() + daysUntilNext);
       } else {
         currentDueDate.setDate(currentDueDate.getDate() + 7);
       }
    }
  } else {
     // Default fallback
     if (frequency === 'SEMI_MONTHLY') {
       currentDueDate.setDate(currentDueDate.getDate() + 15);
     } else if (frequency === 'WEEKLY') {
       currentDueDate.setDate(currentDueDate.getDate() + 7);
     } else {
       currentDueDate.setDate(currentDueDate.getDate() + 30);
     }
  }
  
  let firstDueDateStr = currentDueDate.toISOString().split('T')[0];

  for (let i = 1; i <= numberOfInstallments; i++) {
    const originalDueDateStr = currentDueDate.toISOString().split('T')[0];
    const adjustedDate = adjustDueDate(currentDueDate, adjustmentRule, holidays);
    const adjustedDateStr = adjustedDate.toISOString().split('T')[0];
    
    remainingBalance -= totalPerInstallment;
    
    schedule.push({
      installmentNo: i,
      dueDate: originalDueDateStr,
      adjustedProcessingDate: adjustedDateStr,
      scheduledAmount: Math.round(totalPerInstallment * 100) / 100,
      principalAmount: Math.round(principalPerInstallment * 100) / 100,
      interestAmount: Math.round(interestPerInstallment * 100) / 100,
      penaltyAmount: 0,
      amountPaid: 0,
      remainingBalance: Math.max(0, Math.round(remainingBalance * 100) / 100),
      status: 'UPCOMING'
    });
    
    // Calculate next due date
    if (frequency === 'MONTHLY') {
      currentDueDate.setMonth(currentDueDate.getMonth() + 1);
    } else if (frequency === 'SEMI_MONTHLY') {
       if (firstDueDateRule === 'ALIGN_TO_ANCHOR' && anchorDateStr) {
         const anchors = anchorDateStr.split(',').map(s => parseInt(s.trim()));
         if (anchors.length === 2 && !isNaN(anchors[0]) && !isNaN(anchors[1])) {
            const currentDay = currentDueDate.getDate();
            if (currentDay === anchors[0]) {
               currentDueDate.setDate(anchors[1]);
            } else {
               currentDueDate.setMonth(currentDueDate.getMonth() + 1);
               currentDueDate.setDate(anchors[0]);
            }
         } else {
            currentDueDate.setDate(currentDueDate.getDate() + 15);
         }
       } else {
         currentDueDate.setDate(currentDueDate.getDate() + 15);
       }
    } else if (frequency === 'WEEKLY') {
      currentDueDate.setDate(currentDueDate.getDate() + 7);
    }
  }
  
  return { schedule, firstDueDateStr };
}

export function evaluateInstallmentStatus(
  installment: AmortizationItem,
  currentDateStr: string,
  gracePeriodDays: number = 0
): AmortizationItem['status'] {
  // If it's already fully paid or waived, leave it
  if (installment.amountPaid >= installment.scheduledAmount) return 'PAID';
  if (installment.status === 'WAIVED') return 'WAIVED';
  
  if (installment.amountPaid > 0 && installment.amountPaid < installment.scheduledAmount) {
     return 'PARTIALLY_PAID';
  }
  
  const targetDateStr = installment.adjustedProcessingDate || installment.dueDate;
  
  // Is it due today?
  if (currentDateStr === targetDateStr) {
     return 'DUE';
  }
  
  // Is it past due?
  const targetDate = new Date(targetDateStr);
  const currentDate = new Date(currentDateStr);
  
  const daysDiff = (currentDate.getTime() - targetDate.getTime()) / (1000 * 3600 * 24);
  
  if (daysDiff > gracePeriodDays) {
    return 'PAST_DUE';
  } else if (daysDiff > 0 && daysDiff <= gracePeriodDays) {
    // Within grace period. We can consider it DUE
    return 'DUE';
  }
  
  return 'UPCOMING';
}

export function updateLoanScheduleStatuses(
  loan: any, // or Loan
  currentDateStr: string,
  loanType: LoanType,
  systemSettings: SystemSettings
) {
  if (!loan.amortizationSchedule || loan.amortizationSchedule.length === 0) return;
  
  const gracePeriod = loanType.gracePeriodDays ?? systemSettings.defaultGracePeriodDays ?? 0;
  
  for (let i = 0; i < loan.amortizationSchedule.length; i++) {
    const item = loan.amortizationSchedule[i];
    item.status = evaluateInstallmentStatus(item, currentDateStr, gracePeriod);
  }
}

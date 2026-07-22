import { DashboardRepository } from './dashboard.repository';
import { LoanStatus } from '@prisma/client';
import { DateTime } from 'luxon';

export class DashboardService {
  private repo: DashboardRepository;

  constructor() {
    this.repo = new DashboardRepository();
  }

  async getDashboardMetrics() {
    const nowKigali = DateTime.now().setZone('Africa/Kigali');
    const startOfDay = nowKigali.startOf('day').toJSDate();
    const endOfDay = nowKigali.endOf('day').toJSDate();

    // 1. Fetch counts from repo
    const totalBorrowers = await this.repo.getBorrowerCount();
    const activeLoans = await this.repo.getActiveLoanCount();
    const notificationsSentToday = await this.repo.getNotificationCountToday(startOfDay, endOfDay);
    const allLoans = await this.repo.getAllLoansWithSchedules();

    let dueToday = 0;
    let dueThisWeek = 0;
    let overdueLoans = 0;

    const loansWithStatusBadges = allLoans.map((loan) => {
      const todayKigali = nowKigali.startOf('day');
      
      // Determine unpaid installments
      const unpaidSchedules = loan.repaymentSchedules.filter((s) => s.amountPaid < s.amountDue);

      let badge = 'GREEN';
      let hasInstallmentDueToday = false;
      let hasInstallmentDueThisWeek = false;
      let hasInstallmentOverdue = false;

      if (loan.status === LoanStatus.PAID) {
        badge = 'GREEN';
      } else if (loan.status === LoanStatus.DEFAULTED) {
        badge = 'RED';
        overdueLoans++;
      } else {
        // Find closest unpaid installment
        if (unpaidSchedules.length > 0) {
          // Find due dates relative to today
          unpaidSchedules.forEach((s) => {
            const dueKigali = DateTime.fromJSDate(s.dueDate).setZone('Africa/Kigali').startOf('day');
            const diffDays = Math.round(dueKigali.diff(todayKigali, 'days').days);

            if (diffDays < 0) {
              hasInstallmentOverdue = true;
            } else if (diffDays === 0) {
              hasInstallmentDueToday = true;
            } else if (diffDays > 0 && diffDays <= 7) {
              hasInstallmentDueThisWeek = true;
            }
          });

          // Determine badge based on priorities
          if (loan.status === LoanStatus.OVERDUE || hasInstallmentOverdue) {
            badge = 'RED';
            overdueLoans++;
          } else if (hasInstallmentDueToday) {
            badge = 'ORANGE'; // Due today / tomorrow is ORANGE
            dueToday++;
          } else if (hasInstallmentDueThisWeek) {
            // Find closest diff
            const minDiff = Math.min(...unpaidSchedules.map(s => {
              const dueKigali = DateTime.fromJSDate(s.dueDate).setZone('Africa/Kigali').startOf('day');
              return Math.round(dueKigali.diff(todayKigali, 'days').days);
            }).filter(d => d > 0));

            if (minDiff === 1) {
              badge = 'ORANGE'; // Tomorrow is ORANGE
              dueToday++;
            } else if (minDiff > 1 && minDiff <= 7) {
              badge = 'YELLOW'; // 2-7 days is YELLOW
              dueThisWeek++;
            } else {
              badge = 'GREEN';
            }
          } else {
            badge = 'GREEN';
          }
        } else {
          badge = 'GREEN';
        }
      }

      return {
        id: loan.id,
        loanNumber: loan.loanNumber,
        borrowerName: loan.borrower.fullName,
        principalAmount: loan.principalAmount,
        totalPayable: loan.totalPayable,
        remainingBalance: loan.remainingBalance,
        status: loan.status,
        badge,
      };
    });

    // Calculate PAR30, PAR60, PAR90
    // PARn = (sum of remainingBalance of loans with any unpaid installment overdue by >= n days) / (sum of remainingBalance of all active/overdue/defaulted loans) * 100
    let totalPortfolioBalance = 0;
    let par30Balance = 0;
    let par60Balance = 0;
    let par90Balance = 0;

    // Calculate Collection Efficiency Rate
    // collectionRate = (total repayments paid this month) / (total due this month) * 100
    const startOfMonth = nowKigali.startOf('month').toJSDate();
    const endOfMonth = nowKigali.endOf('month').toJSDate();

    let totalDueThisMonth = 0;
    let totalPaidThisMonth = 0;

    allLoans.forEach((loan) => {
      if (loan.status !== LoanStatus.PAID) {
        totalPortfolioBalance += loan.remainingBalance;

        // Check overdue installments
        const unpaidSchedules = loan.repaymentSchedules.filter((s) => s.amountPaid < s.amountDue);
        let maxOverdueDays = 0;

        unpaidSchedules.forEach((s) => {
          const dueKigali = DateTime.fromJSDate(s.dueDate).setZone('Africa/Kigali').startOf('day');
          const diffDays = Math.round(nowKigali.startOf('day').diff(dueKigali, 'days').days);
          if (diffDays > maxOverdueDays) {
            maxOverdueDays = diffDays;
          }
        });

        if (maxOverdueDays >= 90) {
          par90Balance += loan.remainingBalance;
          par60Balance += loan.remainingBalance;
          par30Balance += loan.remainingBalance;
        } else if (maxOverdueDays >= 60) {
          par60Balance += loan.remainingBalance;
          par30Balance += loan.remainingBalance;
        } else if (maxOverdueDays >= 30) {
          par30Balance += loan.remainingBalance;
        }
      }

      // Sum collection figures for the current calendar month
      loan.repaymentSchedules.forEach((s) => {
        const scheduleDate = new Date(s.dueDate);
        if (scheduleDate >= startOfMonth && scheduleDate <= endOfMonth) {
          totalDueThisMonth += s.amountDue;
          totalPaidThisMonth += s.amountPaid;
        }
      });
    });

    const par30 = totalPortfolioBalance > 0 ? Math.round((par30Balance / totalPortfolioBalance) * 10000) / 100 : 0;
    const par60 = totalPortfolioBalance > 0 ? Math.round((par60Balance / totalPortfolioBalance) * 10000) / 100 : 0;
    const par90 = totalPortfolioBalance > 0 ? Math.round((par90Balance / totalPortfolioBalance) * 10000) / 100 : 0;
    
    // Fallback if no schedules due this month
    const collectionRate = totalDueThisMonth > 0 ? Math.round((totalPaidThisMonth / totalDueThisMonth) * 10000) / 100 : 100;

    return {
      metrics: {
        totalBorrowers,
        activeLoans,
        dueToday,
        dueThisWeek,
        overdueLoans,
        notificationsSentToday,
        par30,
        par65: par60, // UI maps to standard metric labels
        par60,
        par90,
        collectionRate,
        totalPortfolioBalance,
      },
      loans: loansWithStatusBadges,
    };
  }
}

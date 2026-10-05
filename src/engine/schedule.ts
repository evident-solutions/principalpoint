import type {
  MonthRow,
  ResolvedExtraWindow,
  ResolvedLoan,
  ResolvedLump,
  ResolvedOriginal,
  ResolvedRange,
  ScheduleCase,
} from '../types.ts'
import {
  addMonths,
  compareYearMonth,
  formatLong,
  formatSlash,
  isInInclusiveRange,
  yearMonthKey,
  type YearMonth,
} from './dates.ts'
import { centsToDollars, monthlyInterestCents } from './money.ts'

export const MAX_SCHEDULE_MONTHS = 600

export interface ScheduleOptions extends ResolvedLoan {
  ranges: ResolvedRange[]
  extraWindows: ResolvedExtraWindow[]
  lumps: ResolvedLump[]
  applyExtras: boolean
  maxMonths?: number
  balloonAtMax?: boolean
}

interface InternalRow {
  date: YearMonth
  beginningBalanceCents: number
  scheduledPaymentCents: number
  scheduledPiCents: number
  escrowCents: number
  extraPaymentCents: number
  totalPaymentCents: number
  interestCents: number
  principalCents: number
  endingBalanceCents: number
  cumulativeInterestCents: number
  cumulativeExtraPrincipalCents: number
  caseApplied: ScheduleCase
  isPayoff: boolean
}

function findWindow<T extends { start: YearMonth; end: YearMonth }>(
  date: YearMonth,
  windows: T[],
): T | null {
  for (const window of windows) {
    if (isInInclusiveRange(date, window.start, window.end)) return window
  }
  return null
}

function lumpMap(lumps: ResolvedLump[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const lump of lumps) {
    map.set(yearMonthKey(lump.month), lump.amountCents)
  }
  return map
}

/**
 * Month-by-month amortization using P&I only for principal.
 * Escrow is added to cash out the door and never reduces principal.
 *
 * Cases, first match wins:
 * A target + lump, B target, F extra-$ + lump, E extra-$, C lump, D scheduled.
 */
export function computeSchedule(options: ScheduleOptions): MonthRow[] {
  const {
    balanceCents,
    annualRatePercent,
    scheduledPiCents,
    escrowCents,
    nextPayment,
    ranges,
    extraWindows,
    lumps,
    applyExtras,
    maxMonths = MAX_SCHEDULE_MONTHS,
    balloonAtMax = false,
  } = options

  const lumpsByMonth = applyExtras ? lumpMap(lumps) : new Map<string, number>()
  const activeRanges = applyExtras ? ranges : []
  const activeExtras = applyExtras ? extraWindows : []
  const scheduledPitiCents = scheduledPiCents + escrowCents

  const rows: InternalRow[] = []
  let balance = balanceCents
  let cumulativeInterest = 0
  let cumulativeExtra = 0

  for (let i = 0; i < maxMonths && balance > 0; i++) {
    const date = addMonths(nextPayment, i)
    const isMaxMonth = i === maxMonths - 1
    const interest = monthlyInterestCents(balance, annualRatePercent)
    const target = findWindow(date, activeRanges)
    const extraWindow = findWindow(date, activeExtras)
    const lump = lumpsByMonth.get(yearMonthKey(date)) ?? 0
    const recurringExtra = extraWindow?.extraAmountCents ?? 0

    let caseApplied: ScheduleCase
    let userDesiredPrincipal: number

    if (target && lump > 0) {
      caseApplied = 'A'
      userDesiredPrincipal = target.targetPrincipalCents + lump
    } else if (target) {
      caseApplied = 'B'
      userDesiredPrincipal = target.targetPrincipalCents
    } else if (recurringExtra > 0 && lump > 0) {
      caseApplied = 'F'
      userDesiredPrincipal = scheduledPiCents - interest + recurringExtra + lump
    } else if (recurringExtra > 0) {
      caseApplied = 'E'
      userDesiredPrincipal = scheduledPiCents - interest + recurringExtra
    } else if (lump > 0) {
      caseApplied = 'C'
      userDesiredPrincipal = scheduledPiCents - interest + lump
    } else {
      caseApplied = 'D'
      userDesiredPrincipal = scheduledPiCents - interest
    }

    const scheduledPrincipal = scheduledPiCents - interest
    let appliedUserPrincipal = Math.min(userDesiredPrincipal, balance)
    if (balloonAtMax && isMaxMonth && appliedUserPrincipal < balance) {
      appliedUserPrincipal = balance
    }

    const principal = appliedUserPrincipal
    const endingBalance = balance - principal
    const isPayoff = endingBalance <= 0
    const totalPayment = interest + principal + escrowCents

    const scheduledPrincipalApplied = Math.min(
      Math.max(0, scheduledPrincipal),
      balance,
    )
    const extraPayment = Math.max(
      0,
      appliedUserPrincipal - scheduledPrincipalApplied,
    )

    cumulativeInterest += interest
    cumulativeExtra += extraPayment

    rows.push({
      date,
      beginningBalanceCents: balance,
      scheduledPaymentCents: scheduledPitiCents,
      scheduledPiCents,
      escrowCents,
      extraPaymentCents: extraPayment,
      totalPaymentCents: totalPayment,
      interestCents: interest,
      principalCents: principal,
      endingBalanceCents: isPayoff ? 0 : endingBalance,
      cumulativeInterestCents: cumulativeInterest,
      cumulativeExtraPrincipalCents: cumulativeExtra,
      caseApplied,
      isPayoff,
    })

    balance = isPayoff ? 0 : endingBalance
  }

  return rows.map(toMonthRow)
}

function toMonthRow(row: InternalRow): MonthRow {
  return {
    date: row.date,
    dateLabel: formatLong(row.date),
    slashDate: formatSlash(row.date),
    beginningBalance: centsToDollars(row.beginningBalanceCents),
    scheduledPayment: centsToDollars(row.scheduledPaymentCents),
    scheduledPi: centsToDollars(row.scheduledPiCents),
    escrow: centsToDollars(row.escrowCents),
    extraPayment: centsToDollars(row.extraPaymentCents),
    totalPayment: centsToDollars(row.totalPaymentCents),
    interest: centsToDollars(row.interestCents),
    principal: centsToDollars(row.principalCents),
    endingBalance: centsToDollars(row.endingBalanceCents),
    cumulativeInterest: centsToDollars(row.cumulativeInterestCents),
    cumulativeExtraPrincipal: centsToDollars(row.cumulativeExtraPrincipalCents),
    caseApplied: row.caseApplied,
    isPayoff: row.isPayoff,
  }
}

export function summarizeSchedules(
  baseline: MonthRow[],
  modified: MonthRow[],
): {
  totalInterestBaseline: number
  totalInterestModified: number
  interestSaved: number
  monthsShortened: number
  totalExtraPrincipal: number
  returnPerDollar: number | null
  returnPercent: number | null
  baselinePayoff: YearMonth | null
  modifiedPayoff: YearMonth | null
  remainingMonths: number
  remainingInterest: number
} {
  const lastBaseline = baseline[baseline.length - 1]
  const lastModified = modified[modified.length - 1]
  const totalInterestBaseline = lastBaseline?.cumulativeInterest ?? 0
  const totalInterestModified = lastModified?.cumulativeInterest ?? 0
  const interestSaved = totalInterestBaseline - totalInterestModified
  const monthsShortened = Math.max(0, baseline.length - modified.length)
  const totalExtraPrincipal = lastModified?.cumulativeExtraPrincipal ?? 0
  const hasExtra = totalExtraPrincipal > 0
  const returnPerDollar = hasExtra ? interestSaved / totalExtraPrincipal : null
  const returnPercent = hasExtra
    ? (interestSaved / totalExtraPrincipal) * 100
    : null

  return {
    totalInterestBaseline,
    totalInterestModified,
    interestSaved,
    monthsShortened,
    totalExtraPrincipal,
    returnPerDollar,
    returnPercent,
    baselinePayoff: lastBaseline?.date ?? null,
    modifiedPayoff: lastModified?.date ?? null,
    remainingMonths: baseline.length,
    remainingInterest: totalInterestBaseline,
  }
}

export function compareToOriginal(
  loan: ResolvedLoan,
  original: ResolvedOriginal,
): {
  elapsedPayments: number
  originalRemainingMonths: number
  originalRemainingBalance: number
  originalRemainingInterest: number
  originalPayoff: YearMonth | null
  principalAhead: number
  remainingSchedule: MonthRow[]
} | { error: string } {
  const elapsed = compareYearMonth(loan.nextPayment, original.firstPayment)
  if (elapsed < 0) {
    return {
      error:
        'First payment must be on or before the next scheduled payment.',
    }
  }

  const originalFull = computeSchedule({
    balanceCents: original.originalPrincipalCents,
    annualRatePercent: loan.annualRatePercent,
    scheduledPiCents: loan.scheduledPiCents,
    escrowCents: loan.escrowCents,
    nextPayment: original.firstPayment,
    ranges: [],
    extraWindows: [],
    lumps: [],
    applyExtras: false,
    maxMonths: original.originalTermMonths,
    balloonAtMax: true,
  })

  if (elapsed === 0) {
    const remainingInterest =
      originalFull[originalFull.length - 1]?.cumulativeInterest ?? 0
    return {
      elapsedPayments: 0,
      originalRemainingMonths: originalFull.length,
      originalRemainingBalance: centsToDollars(original.originalPrincipalCents),
      originalRemainingInterest: remainingInterest,
      originalPayoff: originalFull[originalFull.length - 1]?.date ?? null,
      principalAhead: centsToDollars(original.originalPrincipalCents) -
        centsToDollars(loan.balanceCents),
      remainingSchedule: originalFull,
    }
  }

  if (elapsed >= originalFull.length) {
    return {
      elapsedPayments: elapsed,
      originalRemainingMonths: 0,
      originalRemainingBalance: 0,
      originalRemainingInterest: 0,
      originalPayoff: originalFull[originalFull.length - 1]?.date ?? null,
      principalAhead: 0 - centsToDollars(loan.balanceCents),
      remainingSchedule: [],
    }
  }

  const remainingRows = originalFull.slice(elapsed)
  const interestBefore = originalFull[elapsed - 1].cumulativeInterest
  const remainingSchedule = remainingRows.map((row) => ({
    ...row,
    cumulativeInterest: row.cumulativeInterest - interestBefore,
    cumulativeExtraPrincipal: 0,
  }))

  const snapshotBalance = originalFull[elapsed].beginningBalance
  const remainingInterest =
    remainingSchedule[remainingSchedule.length - 1]?.cumulativeInterest ?? 0

  return {
    elapsedPayments: elapsed,
    originalRemainingMonths: remainingSchedule.length,
    originalRemainingBalance: snapshotBalance,
    originalRemainingInterest: remainingInterest,
    originalPayoff: remainingSchedule[remainingSchedule.length - 1]?.date ?? null,
    principalAhead: snapshotBalance - centsToDollars(loan.balanceCents),
    remainingSchedule,
  }
}

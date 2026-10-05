import type { YearMonth } from './engine/dates.ts'

export type ScheduleCase = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export type RecurringMode = 'payment' | 'goal'

export interface RecurringWindowInput {
  id: string
  mode: RecurringMode
  start: string
  end: string
  extraAmount: string
  targetPrincipal: string
}

export interface LumpSumInput {
  id: string
  month: string
  amount: string
}

export interface FormState {
  balance: string
  annualRatePercent: string
  scheduledPayment: string
  escrow: string
  nextPayment: string
  originalPrincipal: string
  originalTermYears: string
  firstPayment: string
  recurring: RecurringWindowInput[]
  lumps: LumpSumInput[]
}

export interface StrategyInput {
  id: string
  name: string
  recurring: RecurringWindowInput[]
  lumps: LumpSumInput[]
}

export interface PlannerState {
  balance: string
  annualRatePercent: string
  scheduledPayment: string
  escrow: string
  nextPayment: string
  originalPrincipal: string
  originalTermYears: string
  firstPayment: string
  strategies: StrategyInput[]
  activeStrategyId: string
}

export interface ResolvedRange {
  id: string
  start: YearMonth
  end: YearMonth
  targetPrincipalCents: number
}

export interface ResolvedExtraWindow {
  id: string
  start: YearMonth
  end: YearMonth
  extraAmountCents: number
}

export interface ResolvedLump {
  id: string
  month: YearMonth
  amountCents: number
}

export interface ResolvedLoan {
  balanceCents: number
  annualRatePercent: number
  scheduledPiCents: number
  escrowCents: number
  nextPayment: YearMonth
}

export interface ResolvedOriginal {
  originalPrincipalCents: number
  originalTermMonths: number
  firstPayment: YearMonth
}

export interface MonthRow {
  date: YearMonth
  dateLabel: string
  slashDate: string
  beginningBalance: number
  scheduledPayment: number
  scheduledPi: number
  escrow: number
  extraPayment: number
  totalPayment: number
  interest: number
  principal: number
  endingBalance: number
  cumulativeInterest: number
  cumulativeExtraPrincipal: number
  caseApplied: ScheduleCase
  isPayoff: boolean
}

export interface OriginalComparison {
  elapsedPayments: number
  originalRemainingMonths: number
  originalRemainingBalance: number
  originalRemainingInterest: number
  originalPayoff: YearMonth | null
  principalAhead: number
  remainingSchedule: MonthRow[]
}

export interface CalculationResult {
  baseline: MonthRow[]
  modified: MonthRow[]
  original: OriginalComparison | null
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
}

export interface RecurringWindowErrors {
  id: string
  start?: string
  end?: string
  extraAmount?: string
  targetPrincipal?: string
  overlap?: string
}

export interface LumpErrors {
  id: string
  month?: string
  amount?: string
  duplicate?: string
}

export interface ValidationResult {
  loanErrors: {
    balance?: string
    annualRatePercent?: string
    scheduledPayment?: string
    escrow?: string
    nextPayment?: string
    originalPrincipal?: string
    originalTermYears?: string
    firstPayment?: string
  }
  recurringErrors: RecurringWindowErrors[]
  lumpErrors: LumpErrors[]
  loanOk: boolean
  extrasOk: boolean
  ok: boolean
}

export interface Analysis {
  validation: ValidationResult
  result: CalculationResult | null
}

export interface StrategyColumn {
  id: string
  name: string
  hasPlan: boolean
  validation: ValidationResult
  result: CalculationResult | null
}

export interface StrategyComparison {
  loanErrors: ValidationResult['loanErrors']
  loanOk: boolean
  baselinePayoff: YearMonth | null
  columns: StrategyColumn[]
}

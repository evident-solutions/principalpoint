import type {
  CalculationResult,
  FormState,
  LumpErrors,
  LumpSumInput,
  MonthRow,
  OriginalComparison,
  RecurringWindowErrors,
  RecurringWindowInput,
  ResolvedExtraWindow,
  ResolvedLoan,
  ResolvedLump,
  ResolvedOriginal,
  ResolvedRange,
  StrategyColumn,
  StrategyComparison,
  StrategyInput,
  ValidationResult,
} from '../types.ts'
import {
  addMonths,
  compareYearMonth,
  isInInclusiveRange,
  parseYearMonth,
  yearMonthKey,
  type YearMonth,
} from './dates.ts'
import { dollarsToCents, monthlyInterestCents } from './money.ts'
import {
  compareToOriginal,
  computeSchedule,
  MAX_SCHEDULE_MONTHS,
  summarizeSchedules,
} from './schedule.ts'

function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return n
}

function parsePositiveInt(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, '').trim()
  if (!cleaned) return null
  if (!/^\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

function parseRate(value: string): number | null {
  const cleaned = value.replace(/%/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return n
}

function windowsOverlap(
  a: { start: YearMonth; end: YearMonth },
  b: { start: YearMonth; end: YearMonth },
): boolean {
  return (
    isInInclusiveRange(a.start, b.start, b.end) ||
    isInInclusiveRange(a.end, b.start, b.end) ||
    isInInclusiveRange(b.start, a.start, a.end)
  )
}

function isBlankRecurring(window: RecurringWindowInput): boolean {
  return (
    window.start.trim() === '' &&
    window.end.trim() === '' &&
    window.extraAmount.trim() === '' &&
    window.targetPrincipal.trim() === ''
  )
}

function isBlankLump(lump: FormState['lumps'][number]): boolean {
  return lump.month.trim() === '' && lump.amount.trim() === ''
}

function isBlankOriginal(form: FormState): boolean {
  return (
    form.originalPrincipal.trim() === '' &&
    form.originalTermYears.trim() === '' &&
    form.firstPayment.trim() === ''
  )
}

export function validateLoan(form: FormState): {
  errors: ValidationResult['loanErrors']
  loan: ResolvedLoan | null
  original: ResolvedOriginal | null
} {
  const errors: ValidationResult['loanErrors'] = {}

  const balance = parseMoney(form.balance)
  if (balance === null) {
    errors.balance = 'Enter the remaining principal from your latest statement.'
  } else if (balance <= 0) {
    errors.balance = 'Remaining principal must be greater than $0.'
  }

  const annualRatePercent = parseRate(form.annualRatePercent)
  if (annualRatePercent === null) {
    errors.annualRatePercent = 'Enter the annual interest rate.'
  } else if (annualRatePercent <= 0) {
    errors.annualRatePercent = 'Interest rate must be greater than 0%.'
  }

  const scheduledPayment = parseMoney(form.scheduledPayment)
  if (scheduledPayment === null) {
    errors.scheduledPayment = 'Enter the scheduled monthly payment (P&I + escrow).'
  } else if (scheduledPayment <= 0) {
    errors.scheduledPayment = 'Scheduled payment must be greater than $0.'
  }

  const escrow = parseMoney(form.escrow)
  if (escrow === null) {
    errors.escrow = 'Enter the monthly escrow amount (use 0 if none).'
  } else if (escrow < 0) {
    errors.escrow = 'Escrow cannot be negative.'
  }

  if (
    scheduledPayment !== null &&
    scheduledPayment > 0 &&
    escrow !== null &&
    escrow >= 0 &&
    escrow >= scheduledPayment
  ) {
    errors.escrow = 'Escrow must be less than the scheduled monthly payment.'
  }

  const nextPayment = parseYearMonth(form.nextPayment)
  if (!nextPayment) {
    errors.nextPayment = 'Enter the next scheduled payment as month/year.'
  }

  const piCents =
    scheduledPayment !== null && escrow !== null && escrow >= 0
      ? dollarsToCents(scheduledPayment) - dollarsToCents(escrow)
      : null

  if (
    balance !== null &&
    balance > 0 &&
    annualRatePercent !== null &&
    annualRatePercent > 0 &&
    piCents !== null &&
    piCents > 0
  ) {
    const firstInterest = monthlyInterestCents(
      dollarsToCents(balance),
      annualRatePercent,
    )
    if (firstInterest >= piCents) {
      errors.scheduledPayment =
        'P&I (scheduled payment minus escrow) must be greater than the first month’s interest.'
    }
  }

  let original: ResolvedOriginal | null = null
  if (!isBlankOriginal(form)) {
    const originalPrincipal = parseMoney(form.originalPrincipal)
    if (originalPrincipal === null || originalPrincipal <= 0) {
      errors.originalPrincipal = 'Enter the original loan amount.'
    }

    const originalTermYears = parsePositiveInt(form.originalTermYears)
    if (originalTermYears === null) {
      errors.originalTermYears = 'Enter the original term in whole years (e.g. 30).'
    } else if (originalTermYears * 12 > MAX_SCHEDULE_MONTHS) {
      errors.originalTermYears = 'Original term cannot exceed 50 years.'
    }

    const firstPayment = parseYearMonth(form.firstPayment)
    if (!firstPayment) {
      errors.firstPayment = 'Enter the first scheduled payment month/year.'
    } else if (nextPayment && compareYearMonth(firstPayment, nextPayment) > 0) {
      errors.firstPayment =
        'First payment must be on or before the next scheduled payment.'
    }

    if (
      originalPrincipal !== null &&
      originalPrincipal > 0 &&
      originalTermYears !== null &&
      originalTermYears * 12 <= MAX_SCHEDULE_MONTHS &&
      firstPayment &&
      !(nextPayment && compareYearMonth(firstPayment, nextPayment) > 0)
    ) {
      original = {
        originalPrincipalCents: dollarsToCents(originalPrincipal),
        originalTermMonths: originalTermYears * 12,
        firstPayment,
      }
    }
  }

  if (
    !nextPayment ||
    balance === null ||
    balance <= 0 ||
    annualRatePercent === null ||
    annualRatePercent <= 0 ||
    scheduledPayment === null ||
    scheduledPayment <= 0 ||
    escrow === null ||
    escrow < 0 ||
    piCents === null ||
    piCents <= 0 ||
    errors.balance ||
    errors.annualRatePercent ||
    errors.scheduledPayment ||
    errors.escrow ||
    errors.nextPayment
  ) {
    return { errors, loan: null, original }
  }

  return {
    errors,
    loan: {
      balanceCents: dollarsToCents(balance),
      annualRatePercent,
      scheduledPiCents: piCents,
      escrowCents: dollarsToCents(escrow),
      nextPayment,
    },
    original,
  }
}

function validateDateWindow(
  startValue: string,
  endValue: string,
  first: YearMonth,
  last: YearMonth,
): { start: YearMonth | null; end: YearMonth | null; startError?: string; endError?: string } {
  const start = parseYearMonth(startValue)
  const end = parseYearMonth(endValue)
  let startError: string | undefined
  let endError: string | undefined

  if (!start) startError = 'Enter a valid start month/year.'
  if (!end) endError = 'Enter a valid end month/year.'

  if (start && end && compareYearMonth(end, start) < 0) {
    endError = 'End month must be on or after the start month.'
  }
  if (start && compareYearMonth(start, first) < 0) {
    startError = `Start must be on or after the next payment (${first.month}/${first.year}).`
  }
  if (end && compareYearMonth(end, last) > 0) {
    endError = `End must be on or before the computed payoff (${last.month}/${last.year}).`
  }
  if (start && compareYearMonth(start, last) > 0) {
    startError = `Start must fall within the remaining schedule (through ${last.month}/${last.year}).`
  }

  return { start, end, startError, endError }
}

function goalTargetError(
  target: number,
  start: YearMonth,
  end: YearMonth,
  baselinePrincipalByMonth: Map<string, number>,
): string | null {
  let cursor = start
  let maxBaselinePrincipal = 0
  while (compareYearMonth(cursor, end) <= 0) {
    const baselinePrincipal = baselinePrincipalByMonth.get(yearMonthKey(cursor))
    if (baselinePrincipal === undefined) {
      return 'This window extends past the baseline payoff. Shorten the end month.'
    }
    maxBaselinePrincipal = Math.max(maxBaselinePrincipal, baselinePrincipal)
    cursor = addMonths(cursor, 1)
  }
  if (dollarsToCents(target) <= dollarsToCents(maxBaselinePrincipal)) {
    return `Must be higher than the contractual principal already scheduled in every month of this window (highest is $${maxBaselinePrincipal.toFixed(2)}).`
  }
  return null
}

export function validateExtras(
  form: FormState,
  loan: ResolvedLoan,
  baselinePrincipalByMonth: Map<string, number>,
  baselineLast: YearMonth,
): {
  recurringErrors: RecurringWindowErrors[]
  lumpErrors: LumpErrors[]
  ranges: ResolvedRange[]
  extraWindows: ResolvedExtraWindow[]
  lumps: ResolvedLump[]
  extrasOk: boolean
} {
  const first = loan.nextPayment
  const last = baselineLast
  const recurringErrors: RecurringWindowErrors[] = []
  const resolvedRecurring: {
    range: ResolvedRange | null
    extra: ResolvedExtraWindow | null
    errors: RecurringWindowErrors
  }[] = []

  for (const window of form.recurring) {
    if (isBlankRecurring(window)) {
      resolvedRecurring.push({
        range: null,
        extra: null,
        errors: { id: window.id },
      })
      continue
    }

    const errors: RecurringWindowErrors = { id: window.id }
    const dates = validateDateWindow(window.start, window.end, first, last)
    if (dates.startError) errors.start = dates.startError
    if (dates.endError) errors.end = dates.endError
    const datesOk = Boolean(
      dates.start && dates.end && !dates.startError && !dates.endError,
    )

    let range: ResolvedRange | null = null
    let extra: ResolvedExtraWindow | null = null

    if (window.mode === 'goal') {
      const target = parseMoney(window.targetPrincipal)
      if (target === null) {
        errors.targetPrincipal = 'Enter a target total principal reduction per month.'
      } else if (target <= 0) {
        errors.targetPrincipal = 'Target principal reduction must be greater than $0.'
      } else if (datesOk && dates.start && dates.end) {
        const targetError = goalTargetError(
          target,
          dates.start,
          dates.end,
          baselinePrincipalByMonth,
        )
        if (targetError) errors.targetPrincipal = targetError
      }
      if (
        !errors.start &&
        !errors.end &&
        !errors.targetPrincipal &&
        dates.start &&
        dates.end &&
        target !== null
      ) {
        range = {
          id: window.id,
          start: dates.start,
          end: dates.end,
          targetPrincipalCents: dollarsToCents(target),
        }
      }
    } else {
      const extraAmount = parseMoney(window.extraAmount)
      if (extraAmount === null) {
        errors.extraAmount = 'Enter the extra principal to pay each month.'
      } else if (extraAmount <= 0) {
        errors.extraAmount = 'Extra monthly amount must be greater than $0.'
      }
      if (
        !errors.start &&
        !errors.end &&
        !errors.extraAmount &&
        dates.start &&
        dates.end &&
        extraAmount !== null
      ) {
        extra = {
          id: window.id,
          start: dates.start,
          end: dates.end,
          extraAmountCents: dollarsToCents(extraAmount),
        }
      }
    }

    resolvedRecurring.push({ range, extra, errors })
  }

  const completeWindows = resolvedRecurring.flatMap((entry) => {
    const window = entry.range ?? entry.extra
    return window ? [window] : []
  })

  for (let i = 0; i < completeWindows.length; i++) {
    for (let j = i + 1; j < completeWindows.length; j++) {
      if (!windowsOverlap(completeWindows[i], completeWindows[j])) continue
      const message = 'Recurring prepayment windows cannot overlap.'
      const a = resolvedRecurring.find((entry) => entry.errors.id === completeWindows[i].id)
      const b = resolvedRecurring.find((entry) => entry.errors.id === completeWindows[j].id)
      if (a) a.errors.overlap = message
      if (b) b.errors.overlap = message
    }
  }

  for (const entry of resolvedRecurring) {
    if (
      entry.errors.start ||
      entry.errors.end ||
      entry.errors.extraAmount ||
      entry.errors.targetPrincipal ||
      entry.errors.overlap
    ) {
      recurringErrors.push(entry.errors)
    }
  }

  const lumpErrors: LumpErrors[] = []
  const resolvedLumps: ResolvedLump[] = []
  const monthCounts = new Map<string, string[]>()

  for (const lump of form.lumps) {
    if (isBlankLump(lump)) continue

    const errors: LumpErrors = { id: lump.id }
    const month = parseYearMonth(lump.month)
    const amount = parseMoney(lump.amount)

    if (!month) {
      errors.month = 'Enter a valid payment month/year.'
    } else if (compareYearMonth(month, first) < 0 || compareYearMonth(month, last) > 0) {
      errors.month = `Must fall within the remaining schedule (${first.month}/${first.year}–${last.month}/${last.year}).`
    } else if (!baselinePrincipalByMonth.has(yearMonthKey(month))) {
      errors.month = 'This month is after the baseline payoff.'
    }

    if (amount === null) {
      errors.amount = 'Enter a lump-sum amount.'
    } else if (amount <= 0) {
      errors.amount = 'Lump-sum amount must be greater than $0.'
    }

    if (month) {
      const key = yearMonthKey(month)
      const ids = monthCounts.get(key) ?? []
      ids.push(lump.id)
      monthCounts.set(key, ids)
    }

    if (errors.month || errors.amount) {
      lumpErrors.push(errors)
    } else if (month && amount !== null) {
      resolvedLumps.push({
        id: lump.id,
        month,
        amountCents: dollarsToCents(amount),
      })
    }
  }

  for (const ids of monthCounts.values()) {
    if (ids.length < 2) continue
    for (const id of ids) {
      const existing = lumpErrors.find((entry) => entry.id === id)
      if (existing) {
        existing.duplicate = 'Only one lump sum per month is allowed.'
      } else {
        lumpErrors.push({
          id,
          duplicate: 'Only one lump sum per month is allowed.',
        })
      }
    }
  }

  const extrasOk =
    recurringErrors.length === 0 &&
    lumpErrors.filter((e) => e.month || e.amount || e.duplicate).length === 0

  return {
    recurringErrors,
    lumpErrors,
    ranges: extrasOk
      ? resolvedRecurring.flatMap((entry) => (entry.range ? [entry.range] : []))
      : [],
    extraWindows: extrasOk
      ? resolvedRecurring.flatMap((entry) => (entry.extra ? [entry.extra] : []))
      : [],
    lumps: extrasOk ? resolvedLumps : [],
    extrasOk,
  }
}

export function strategyHasPlan(strategy: {
  recurring: RecurringWindowInput[]
  lumps: LumpSumInput[]
}): boolean {
  const filledRecurring = strategy.recurring.some(
    (window) =>
      window.start.trim() !== '' ||
      window.end.trim() !== '' ||
      window.extraAmount.trim() !== '' ||
      window.targetPrincipal.trim() !== '',
  )
  const filledLump = strategy.lumps.some(
    (lump) => lump.month.trim() !== '' || lump.amount.trim() !== '',
  )
  return filledRecurring || filledLump
}

interface ReadyLoan {
  loanErrors: ValidationResult['loanErrors']
  loan: ResolvedLoan
  baseline: MonthRow[]
  originalComparison: OriginalComparison | null
  baselinePrincipalByMonth: Map<string, number>
  baselineLast: YearMonth
}

function loanFailure(
  loanErrors: ValidationResult['loanErrors'],
): { validation: ValidationResult; result: null } {
  return {
    validation: {
      loanErrors,
      recurringErrors: [],
      lumpErrors: [],
      loanOk: false,
      extrasOk: false,
      ok: false,
    },
    result: null,
  }
}

function prepareLoan(
  form: FormState,
): { ok: false; failure: { validation: ValidationResult; result: null } } | { ok: true; ready: ReadyLoan } {
  const { errors: loanErrors, loan, original } = validateLoan(form)
  if (!loan) return { ok: false, failure: loanFailure(loanErrors) }

  const baseline = computeSchedule({
    ...loan,
    ranges: [],
    extraWindows: [],
    lumps: [],
    applyExtras: false,
  })

  const lastBaseline = baseline[baseline.length - 1]
  if (!lastBaseline || lastBaseline.endingBalance > 0) {
    return {
      ok: false,
      failure: loanFailure({
        ...loanErrors,
        scheduledPayment: 'P&I is too low to pay off the loan within 600 months.',
      }),
    }
  }

  let originalComparison: OriginalComparison | null = null
  if (original) {
    const compared = compareToOriginal(loan, original)
    if ('error' in compared) {
      return {
        ok: false,
        failure: loanFailure({
          ...loanErrors,
          firstPayment: compared.error,
        }),
      }
    }
    originalComparison = compared
  }

  const baselinePrincipalByMonth = new Map<string, number>()
  for (const row of baseline) {
    const scheduledPrincipalPortion = Math.max(0, row.scheduledPi - row.interest)
    baselinePrincipalByMonth.set(yearMonthKey(row.date), scheduledPrincipalPortion)
  }

  return {
    ok: true,
    ready: {
      loanErrors,
      loan,
      baseline,
      originalComparison,
      baselinePrincipalByMonth,
      baselineLast: lastBaseline.date,
    },
  }
}

function analyzeStrategy(
  ready: ReadyLoan,
  input: { recurring: RecurringWindowInput[]; lumps: LumpSumInput[] },
): { validation: ValidationResult; result: CalculationResult } {
  const extras = validateExtras(
    { ...emptyLoanFields(), ...input },
    ready.loan,
    ready.baselinePrincipalByMonth,
    ready.baselineLast,
  )
  const validation: ValidationResult = {
    loanErrors: ready.loanErrors,
    recurringErrors: extras.recurringErrors,
    lumpErrors: extras.lumpErrors,
    loanOk: true,
    extrasOk: extras.extrasOk,
    ok: extras.extrasOk,
  }

  if (!extras.extrasOk) {
    const summary = summarizeSchedules(ready.baseline, ready.baseline)
    return {
      validation,
      result: {
        baseline: ready.baseline,
        modified: [],
        original: ready.originalComparison,
        ...summary,
        interestSaved: 0,
        monthsShortened: 0,
        totalExtraPrincipal: 0,
        returnPerDollar: null,
        returnPercent: null,
        modifiedPayoff: null,
      },
    }
  }

  const modified = computeSchedule({
    ...ready.loan,
    ranges: extras.ranges,
    extraWindows: extras.extraWindows,
    lumps: extras.lumps,
    applyExtras: true,
  })

  return {
    validation,
    result: {
      baseline: ready.baseline,
      modified,
      original: ready.originalComparison,
      ...summarizeSchedules(ready.baseline, modified),
    },
  }
}

function emptyLoanFields(): FormState {
  return {
    balance: '',
    annualRatePercent: '',
    scheduledPayment: '',
    escrow: '',
    nextPayment: '',
    originalPrincipal: '',
    originalTermYears: '',
    firstPayment: '',
    recurring: [],
    lumps: [],
  }
}

export function analyzeMortgage(form: FormState): {
  validation: ValidationResult
  result: CalculationResult | null
} {
  const prepared = prepareLoan(form)
  if (!prepared.ok) return prepared.failure
  return analyzeStrategy(prepared.ready, form)
}

export function compareStrategies(
  form: FormState,
  strategies: StrategyInput[],
): StrategyComparison {
  const prepared = prepareLoan(form)
  if (!prepared.ok) {
    return {
      loanErrors: prepared.failure.validation.loanErrors,
      loanOk: false,
      baselinePayoff: null,
      columns: [],
    }
  }

  const columns: StrategyColumn[] = strategies.map((strategy) => {
    const analyzed = analyzeStrategy(prepared.ready, strategy)
    return {
      id: strategy.id,
      name: strategy.name,
      hasPlan: strategyHasPlan(strategy),
      validation: analyzed.validation,
      result: analyzed.result,
    }
  })

  return {
    loanErrors: prepared.ready.loanErrors,
    loanOk: true,
    baselinePayoff: prepared.ready.baselineLast,
    columns,
  }
}

import { describe, expect, it } from 'vitest'
import { defaultForm } from '../defaults.ts'
import type { FormState, RecurringWindowInput, ResolvedLoan, StrategyInput } from '../types.ts'
import {
  addMonths,
  composeMonthYearInput,
  lastPaymentMonth,
  parseYearMonth,
  splitMonthYearInput,
} from './dates.ts'
import { dollarsToCents, monthlyInterestCents, monthlyPiPaymentCents } from './money.ts'
import { compareToOriginal, computeSchedule, summarizeSchedules } from './schedule.ts'
import { strategyScheduleFilename } from './csv.ts'
import { analyzeMortgage, compareStrategies } from './validate.ts'

const JAN_2026 = { year: 2026, month: 1 }

function loan(overrides: Partial<ResolvedLoan> = {}): ResolvedLoan {
  return {
    balanceCents: dollarsToCents(10_000),
    annualRatePercent: 6,
    scheduledPiCents: dollarsToCents(500),
    escrowCents: 0,
    nextPayment: JAN_2026,
    ...overrides,
  }
}

function cents(dollars: number): number {
  return dollarsToCents(dollars)
}

function run(
  extras: {
    ranges?: Parameters<typeof computeSchedule>[0]['ranges']
    extraWindows?: Parameters<typeof computeSchedule>[0]['extraWindows']
    lumps?: Parameters<typeof computeSchedule>[0]['lumps']
    applyExtras?: boolean
  } = {},
  loanOverrides: Partial<ResolvedLoan> = {},
) {
  return computeSchedule({
    ...loan(loanOverrides),
    ranges: extras.ranges ?? [],
    extraWindows: extras.extraWindows ?? [],
    lumps: extras.lumps ?? [],
    applyExtras: extras.applyExtras ?? false,
  })
}

describe('money: monthly interest rounding', () => {
  it('rounds half-up to the nearest cent', () => {
    expect(monthlyInterestCents(cents(10_000), 6)).toBe(cents(50))
    expect(monthlyInterestCents(cents(9_550), 6)).toBe(cents(47.75))
    expect(monthlyInterestCents(cents(9_097.75), 6)).toBe(cents(45.49))
  })
})

describe('baseline schedule (all Case D)', () => {
  it('matches independent hand-calculated first three months', () => {
    const rows = run()

    expect(rows[0]).toMatchObject({
      slashDate: '1/2026',
      beginningBalance: 10_000,
      interest: 50,
      principal: 450,
      extraPayment: 0,
      scheduledPi: 500,
      escrow: 0,
      totalPayment: 500,
      endingBalance: 9_550,
      caseApplied: 'D',
    })
    expect(rows[1]).toMatchObject({
      beginningBalance: 9_550,
      interest: 47.75,
      principal: 452.25,
      endingBalance: 9_097.75,
    })
    expect(rows[2]).toMatchObject({
      beginningBalance: 9_097.75,
      interest: 45.49,
      principal: 454.51,
      endingBalance: 8_643.24,
    })
  })

  it('pays escrow on top of P&I without changing principal', () => {
    const without = run()
    const withEscrow = run({}, { escrowCents: cents(125) })

    expect(withEscrow).toHaveLength(without.length)
    expect(withEscrow[0].principal).toBe(without[0].principal)
    expect(withEscrow[0].interest).toBe(without[0].interest)
    expect(withEscrow[0].endingBalance).toBe(without[0].endingBalance)
    expect(withEscrow[0].scheduledPayment).toBe(625)
    expect(withEscrow[0].totalPayment).toBe(625)
    expect(withEscrow[0].escrow).toBe(125)
    expect(withEscrow[withEscrow.length - 1].endingBalance).toBe(0)
  })

  it('computes remaining months until payoff instead of using a stated term', () => {
    const rows = run()
    expect(rows.length).toBeGreaterThan(3)
    expect(rows[rows.length - 1].endingBalance).toBe(0)
    expect(rows[rows.length - 1].isPayoff).toBe(true)
    expect(rows[0].beginningBalance).toBe(10_000)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      expect(row.endingBalance).toBeCloseTo(row.beginningBalance - row.principal, 6)
      expect(row.totalPayment).toBeCloseTo(
        row.interest + row.principal + row.escrow,
        6,
      )
      if (i > 0) expect(row.beginningBalance).toBe(rows[i - 1].endingBalance)
    }
  })
})

describe('modified schedule cases', () => {
  it('Case B: target principal is total principal for the month', () => {
    const rows = run({
      applyExtras: true,
      ranges: [
        {
          id: 'r1',
          start: JAN_2026,
          end: JAN_2026,
          targetPrincipalCents: cents(1_000),
        },
      ],
    })

    expect(rows[0]).toMatchObject({
      caseApplied: 'B',
      interest: 50,
      principal: 1_000,
      totalPayment: 1_050,
      extraPayment: 550,
      endingBalance: 9_000,
    })
  })

  it('Case A: range + lump in the same month', () => {
    const rows = run({
      applyExtras: true,
      ranges: [
        {
          id: 'r1',
          start: JAN_2026,
          end: JAN_2026,
          targetPrincipalCents: cents(1_000),
        },
      ],
      lumps: [{ id: 'l1', month: JAN_2026, amountCents: cents(500) }],
    })

    expect(rows[0]).toMatchObject({
      caseApplied: 'A',
      principal: 1_500,
      extraPayment: 1_050,
      endingBalance: 8_500,
    })
  })

  it('Case E: recurring extra dollars on top of scheduled P&I', () => {
    const rows = run({
      applyExtras: true,
      extraWindows: [
        {
          id: 'e1',
          start: JAN_2026,
          end: { year: 2026, month: 2 },
          extraAmountCents: cents(100),
        },
      ],
    })

    expect(rows[0]).toMatchObject({
      caseApplied: 'E',
      interest: 50,
      principal: 550,
      extraPayment: 100,
      totalPayment: 600,
      endingBalance: 9_450,
    })
    expect(rows[1]).toMatchObject({
      caseApplied: 'E',
      extraPayment: 100,
    })
    expect(rows[2].caseApplied).toBe('D')
    expect(rows[2].extraPayment).toBe(0)
    expect(rows[2].principal).toBeGreaterThan(454.51)
  })

  it('Case F: recurring extra plus lump in the same month', () => {
    const rows = run({
      applyExtras: true,
      extraWindows: [
        {
          id: 'e1',
          start: JAN_2026,
          end: JAN_2026,
          extraAmountCents: cents(100),
        },
      ],
      lumps: [{ id: 'l1', month: JAN_2026, amountCents: cents(400) }],
    })

    expect(rows[0]).toMatchObject({
      caseApplied: 'F',
      principal: 950,
      extraPayment: 500,
      endingBalance: 9_050,
    })
  })

  it('Case C: lump outside a target or extra window', () => {
    const rows = run({
      applyExtras: true,
      lumps: [
        { id: 'l1', month: { year: 2026, month: 2 }, amountCents: cents(1_000) },
      ],
    })

    expect(rows[0].caseApplied).toBe('D')
    expect(rows[1]).toMatchObject({
      caseApplied: 'C',
      principal: 1_452.25,
      extraPayment: 1_000,
      endingBalance: 8_097.75,
    })
  })

  it('applies continuation after a target range ends', () => {
    const baseline = run()
    const modified = run({
      applyExtras: true,
      ranges: [
        {
          id: 'r1',
          start: JAN_2026,
          end: JAN_2026,
          targetPrincipalCents: cents(1_000),
        },
      ],
    })

    expect(modified[1].caseApplied).toBe('D')
    expect(modified[1].extraPayment).toBe(0)
    expect(modified[1].principal).toBeGreaterThan(baseline[1].principal)
    expect(modified[1].principal).toBe(455)
    expect(modified[1].interest).toBe(45)
  })
})

describe('termination and caps', () => {
  it('stops at the first zero-balance month and ignores later extras', () => {
    const modified = run({
      applyExtras: true,
      ranges: [
        {
          id: 'r1',
          start: JAN_2026,
          end: { year: 2026, month: 6 },
          targetPrincipalCents: cents(5_000),
        },
      ],
    })

    expect(modified).toHaveLength(2)
    expect(modified[1].endingBalance).toBe(0)
    expect(modified[1].cumulativeExtraPrincipal).toBe(9_075)
  })

  it('caps a lump that exceeds remaining principal', () => {
    const rows = run(
      {
        applyExtras: true,
        lumps: [{ id: 'l1', month: JAN_2026, amountCents: cents(10_000) }],
      },
      { balanceCents: cents(500), scheduledPiCents: cents(100) },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].principal).toBe(500)
    expect(rows[0].interest).toBe(2.5)
    expect(rows[0].totalPayment).toBe(502.5)
    expect(rows[0].extraPayment).toBe(402.5)
  })
})

describe('summary metrics', () => {
  it('computes interest saved going forward vs the current baseline', () => {
    const baseline = run()
    const modified = run({
      applyExtras: true,
      extraWindows: [
        {
          id: 'e1',
          start: JAN_2026,
          end: { year: 2026, month: 6 },
          extraAmountCents: cents(200),
        },
      ],
    })
    const summary = summarizeSchedules(baseline, modified)
    expect(summary.monthsShortened).toBeGreaterThan(0)
    expect(summary.interestSaved).toBeGreaterThan(0)
    expect(summary.totalExtraPrincipal).toBeGreaterThan(0)
    expect(summary.remainingMonths).toBe(baseline.length)
  })
})

describe('standard amortizing loan payoff', () => {
  it('pays off a 30-year fixed loan from the computed P&I', () => {
    const principal = 300_000
    const annualRatePercent = 6.5
    const n = 360
    const paymentCents = monthlyPiPaymentCents(
      dollarsToCents(principal),
      annualRatePercent,
      n,
    )

    const rows = computeSchedule({
      balanceCents: dollarsToCents(principal),
      annualRatePercent,
      scheduledPiCents: paymentCents,
      escrowCents: 0,
      nextPayment: JAN_2026,
      ranges: [],
      extraWindows: [],
      lumps: [],
      applyExtras: false,
    })

    expect(rows.length).toBeLessThanOrEqual(n + 1)
    expect(rows.length).toBeGreaterThan(n - 3)
    expect(rows[rows.length - 1].endingBalance).toBe(0)
  })
})

describe('original schedule comparison', () => {
  it('reports remaining original months and principal ahead as of next payment', () => {
    const originalPrincipal = dollarsToCents(12_000)
    const annualRatePercent = 12
    const originalTermMonths = 12
    const pi = monthlyPiPaymentCents(
      originalPrincipal,
      annualRatePercent,
      originalTermMonths,
    )

    const compared = compareToOriginal(
      {
        balanceCents: dollarsToCents(5_000),
        annualRatePercent,
        scheduledPiCents: pi,
        escrowCents: 0,
        nextPayment: { year: 2026, month: 7 },
      },
      {
        originalPrincipalCents: originalPrincipal,
        originalTermMonths,
        firstPayment: JAN_2026,
      },
    )

    expect('error' in compared).toBe(false)
    if ('error' in compared) return
    expect(compared.elapsedPayments).toBe(6)
    expect(compared.originalRemainingMonths).toBeGreaterThan(0)
    expect(compared.originalRemainingBalance).toBeGreaterThan(5_000)
    expect(compared.principalAhead).toBeCloseTo(
      compared.originalRemainingBalance - 5_000,
      6,
    )
  })
})

function recurringWindow(
  input: Pick<RecurringWindowInput, 'id' | 'mode' | 'start' | 'end'> &
    Partial<Pick<RecurringWindowInput, 'extraAmount' | 'targetPrincipal'>>,
): RecurringWindowInput {
  return {
    extraAmount: '',
    targetPrincipal: '',
    ...input,
  }
}

describe('analyzeMortgage validation', () => {
  const baseForm = (): FormState => ({
    balance: '10000',
    annualRatePercent: '6',
    scheduledPayment: '500',
    escrow: '0',
    nextPayment: '2026-01',
    originalPrincipal: '',
    originalTermYears: '',
    firstPayment: '',
    recurring: [],
    lumps: [],
  })

  it('rejects a rate of 0%', () => {
    const { validation, result } = analyzeMortgage({
      ...baseForm(),
      annualRatePercent: '0',
    })
    expect(validation.loanOk).toBe(false)
    expect(result).toBeNull()
  })

  it('derives P&I from scheduled payment minus escrow', () => {
    const withEscrow = analyzeMortgage({
      ...baseForm(),
      scheduledPayment: '625',
      escrow: '125',
    })
    const without = analyzeMortgage(baseForm())
    expect(withEscrow.validation.loanOk).toBe(true)
    expect(withEscrow.result?.remainingMonths).toBe(without.result?.remainingMonths)
    expect(withEscrow.result?.baseline[0].principal).toBe(
      without.result?.baseline[0].principal,
    )
    expect(withEscrow.result?.baseline[0].escrow).toBe(125)
  })

  it('rejects escrow that is not less than the scheduled payment', () => {
    const { validation } = analyzeMortgage({
      ...baseForm(),
      scheduledPayment: '500',
      escrow: '500',
    })
    expect(validation.loanOk).toBe(false)
    expect(validation.loanErrors.escrow).toMatch(/less than/)
  })

  it('rejects overlapping recurring windows of either mode', () => {
    const { validation } = analyzeMortgage({
      ...baseForm(),
      recurring: [
        recurringWindow({
          id: 'a',
          mode: 'goal',
          start: '2026-01',
          end: '2026-06',
          targetPrincipal: '1000',
        }),
        recurringWindow({
          id: 'e',
          mode: 'payment',
          start: '2026-06',
          end: '2026-08',
          extraAmount: '100',
        }),
      ],
    })
    expect(validation.ok).toBe(false)
    expect(validation.recurringErrors.filter((e) => e.overlap)).toHaveLength(2)
  })

  it('allows a payment-driven window adjacent to a goal-driven window', () => {
    const { validation, result } = analyzeMortgage({
      ...baseForm(),
      recurring: [
        recurringWindow({
          id: 'a',
          mode: 'goal',
          start: '2026-01',
          end: '2026-03',
          targetPrincipal: '1000',
        }),
        recurringWindow({
          id: 'e',
          mode: 'payment',
          start: '2026-04',
          end: '2026-06',
          extraAmount: '75',
        }),
      ],
    })
    expect(validation.ok).toBe(true)
    expect(result?.modified[0].caseApplied).toBe('B')
    expect(result?.modified[3].caseApplied).toBe('E')
  })

  it('rejects a goal-driven target at or below contractual principal in any month of the window', () => {
    const { validation } = analyzeMortgage({
      ...baseForm(),
      recurring: [
        recurringWindow({
          id: 'a',
          mode: 'goal',
          start: '2026-01',
          end: '2026-02',
          targetPrincipal: '451',
        }),
      ],
    })
    expect(validation.ok).toBe(false)
    expect(validation.recurringErrors[0]?.targetPrincipal).toMatch(/highest is \$452\.25/)
  })

  it('computes remaining months without a remaining-months input', () => {
    const { validation, result } = analyzeMortgage(baseForm())
    expect(validation.loanOk).toBe(true)
    expect(result?.remainingMonths).toBeGreaterThan(0)
    expect(result?.baseline[result.baseline.length - 1].endingBalance).toBe(0)
  })

  it('still computes remaining term when origination fields are incomplete', () => {
    const { validation, result } = analyzeMortgage({
      ...baseForm(),
      originalPrincipal: '12000',
    })
    expect(result?.remainingMonths).toBeGreaterThan(0)
    expect(validation.loanErrors.originalTermYears).toBeTruthy()
    expect(result?.original).toBeNull()
  })

  it('reports actual extra paid when payoff happens mid-range', () => {
    const { result } = analyzeMortgage({
      ...baseForm(),
      recurring: [
        recurringWindow({
          id: 'a',
          mode: 'goal',
          start: '2026-01',
          end: '2026-06',
          targetPrincipal: '5000',
        }),
      ],
    })
    expect(result?.modified).toHaveLength(2)
    expect(result?.totalExtraPrincipal).toBe(9_075)
  })

  it('analyzes the default statement-style example', () => {
    const { validation, result } = analyzeMortgage(defaultForm())
    expect(validation.ok).toBe(true)
    expect(result?.original).not.toBeNull()
    expect(result?.remainingMonths).toBeGreaterThan(0)
    expect(result!.modified.length).toBeLessThan(result!.baseline.length)
    const may = result!.modified.find((row) => row.slashDate === '5/2027')
    expect(may?.caseApplied).toBe('F')
    const jul = result!.modified.find((row) => row.slashDate === '7/2027')
    expect(jul?.caseApplied).toBe('B')
  })
})

describe('dates', () => {
  it('parses month/year and YYYY-MM', () => {
    expect(parseYearMonth('8/2026')).toEqual({ year: 2026, month: 8 })
    expect(parseYearMonth('2026-08')).toEqual({ year: 2026, month: 8 })
  })

  it('round-trips month/year form values while the year is being edited', () => {
    expect(composeMonthYearInput(1, '2027')).toBe('2027-01')
    expect(splitMonthYearInput(composeMonthYearInput(6, '20'))).toEqual({
      month: 6,
      yearText: '20',
    })
  })

  it('adds months across year boundaries', () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({
      year: 2027,
      month: 2,
    })
    expect(lastPaymentMonth({ year: 2026, month: 8 }, 120)).toEqual({
      year: 2036,
      month: 7,
    })
  })
})

describe('strategy comparison', () => {
  const loan = (): FormState => ({
    balance: '10000',
    annualRatePercent: '6',
    scheduledPayment: '500',
    escrow: '0',
    nextPayment: '2026-01',
    originalPrincipal: '',
    originalTermYears: '',
    firstPayment: '',
    recurring: [],
    lumps: [],
  })

  function strategy(
    input: Pick<StrategyInput, 'id' | 'name'> &
      Partial<Pick<StrategyInput, 'recurring' | 'lumps'>>,
  ): StrategyInput {
    return { recurring: [], lumps: [], ...input }
  }

  it('keeps a valid strategy when another strategy fails validation', () => {
    const comparison = compareStrategies(loan(), [
      strategy({
        id: 'bad',
        name: 'Too low',
        recurring: [
          recurringWindow({
            id: 'g',
            mode: 'goal',
            start: '2026-01',
            end: '2026-02',
            targetPrincipal: '100',
          }),
        ],
      }),
      strategy({
        id: 'ok',
        name: 'Extra',
        recurring: [
          recurringWindow({
            id: 'p',
            mode: 'payment',
            start: '2026-01',
            end: '2026-03',
            extraAmount: '200',
          }),
        ],
      }),
    ])

    expect(comparison.loanOk).toBe(true)
    expect(comparison.columns[0].validation.extrasOk).toBe(false)
    expect(comparison.columns[0].result?.modifiedPayoff).toBeNull()
    expect(comparison.columns[1].validation.extrasOk).toBe(true)
    expect(comparison.columns[1].result?.interestSaved).toBeGreaterThan(0)
    expect(comparison.baselinePayoff).toEqual(comparison.columns[1].result?.baselinePayoff ?? null)
  })

  it('reports a shorter payoff and more interest saved for the larger extra', () => {
    const comparison = compareStrategies(loan(), [
      strategy({
        id: 'small',
        name: 'Small',
        recurring: [
          recurringWindow({
            id: 's',
            mode: 'payment',
            start: '2026-01',
            end: '2026-06',
            extraAmount: '50',
          }),
        ],
      }),
      strategy({
        id: 'large',
        name: 'Large',
        recurring: [
          recurringWindow({
            id: 'l',
            mode: 'payment',
            start: '2026-01',
            end: '2026-06',
            extraAmount: '400',
          }),
        ],
      }),
    ])
    const small = comparison.columns[0].result!
    const large = comparison.columns[1].result!
    expect(large.interestSaved).toBeGreaterThan(small.interestSaved)
    expect(large.monthsShortened).toBeGreaterThanOrEqual(small.monthsShortened)
    expect(large.totalExtraPrincipal).toBeGreaterThan(small.totalExtraPrincipal)
    expect(large.returnPerDollar).not.toBeNull()
    expect(small.modifiedPayoff).not.toBeNull()
  })

  it('names a strategy schedule file from the strategy name', () => {
    expect(strategyScheduleFilename('Pay $300 extra')).toBe('pay-300-extra-schedule.csv')
    expect(strategyScheduleFilename('   ')).toBe('strategy-schedule.csv')
  })
})

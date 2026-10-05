import { centsToDollars, dollarsToCents, monthlyPiPaymentCents } from './engine/money.ts'
import type { FormState, PlannerState } from './types.ts'

export function createId(): string {
  return crypto.randomUUID()
}

export function defaultForm(): FormState {
  const originalPrincipal = 420_000
  const termMonths = 360
  const rate = 6.5
  const escrow = 450
  const pi = centsToDollars(
    monthlyPiPaymentCents(dollarsToCents(originalPrincipal), rate, termMonths),
  )

  return {
    balance: '340000',
    annualRatePercent: String(rate),
    scheduledPayment: (pi + escrow).toFixed(2),
    escrow: String(escrow),
    nextPayment: '2026-09',
    originalPrincipal: String(originalPrincipal),
    originalTermYears: '30',
    firstPayment: '2016-09',
    recurring: [
      {
        id: createId(),
        mode: 'payment',
        start: '2027-01',
        end: '2027-06',
        extraAmount: '300',
        targetPrincipal: '',
      },
      {
        id: createId(),
        mode: 'goal',
        start: '2027-07',
        end: '2027-12',
        extraAmount: '',
        targetPrincipal: '2000',
      },
    ],
    lumps: [
      {
        id: createId(),
        month: '2027-05',
        amount: '10000',
      },
    ],
  }
}

export function defaultPlanner(): PlannerState {
  const form = defaultForm()
  const id = createId()
  return {
    balance: form.balance,
    annualRatePercent: form.annualRatePercent,
    scheduledPayment: form.scheduledPayment,
    escrow: form.escrow,
    nextPayment: form.nextPayment,
    originalPrincipal: form.originalPrincipal,
    originalTermYears: form.originalTermYears,
    firstPayment: form.firstPayment,
    activeStrategyId: id,
    strategies: [
      {
        id,
        name: 'Strategy 1',
        recurring: form.recurring,
        lumps: form.lumps,
      },
    ],
  }
}

/** Convert dollars to integer cents, rounding half away from .xxx5 via banker's? No — standard half-up via Math.round. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function centsToDollars(cents: number): number {
  return cents / 100
}

/**
 * Monthly interest, rounded to the nearest cent.
 * monthlyRate = annualPercent / 100 / 12, so interestCents = round(balanceCents * annualPercent / 1200).
 */
export function monthlyInterestCents(
  balanceCents: number,
  annualRatePercent: number,
): number {
  if (balanceCents <= 0) return 0
  return Math.round((balanceCents * annualRatePercent) / 1200)
}

/** Standard fixed-payment amount in cents for a fully amortizing loan. */
export function monthlyPiPaymentCents(
  principalCents: number,
  annualRatePercent: number,
  n: number,
): number {
  if (n <= 0) return 0
  const principal = centsToDollars(principalCents)
  const monthlyRate = annualRatePercent / 100 / 12
  if (monthlyRate === 0) return dollarsToCents(principal / n)
  const factor = (1 + monthlyRate) ** n
  return dollarsToCents((principal * (monthlyRate * factor)) / (factor - 1))
}

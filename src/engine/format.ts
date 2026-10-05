export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatRatio(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

export function formatMonthsShortened(totalMonths: number): string {
  if (totalMonths <= 0) return '0 months'
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const yearPart =
    years === 0 ? '' : years === 1 ? '1 year' : `${years} years`
  const monthPart =
    months === 0 ? '' : months === 1 ? '1 month' : `${months} months`
  if (yearPart && monthPart) return `${yearPart}, ${monthPart}`
  return yearPart || monthPart
}

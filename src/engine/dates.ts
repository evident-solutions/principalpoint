export interface YearMonth {
  year: number
  month: number
}

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export function isValidYearMonth(ym: YearMonth): boolean {
  return (
    Number.isInteger(ym.year) &&
    Number.isInteger(ym.month) &&
    ym.year >= 1900 &&
    ym.year <= 2200 &&
    ym.month >= 1 &&
    ym.month <= 12
  )
}

/** Parse HTML month input (YYYY-MM) or requirement format M/YYYY, MM/YYYY. */
export function parseYearMonth(value: string): YearMonth | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const iso = /^(\d{4})-(\d{1,2})$/.exec(trimmed)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const ym = { year, month }
    return isValidYearMonth(ym) ? ym : null
  }

  const slash = /^(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (slash) {
    const month = Number(slash[1])
    const year = Number(slash[2])
    const ym = { year, month }
    return isValidYearMonth(ym) ? ym : null
  }

  return null
}

export function toInputValue(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, '0')}`
}

/** Read a form value that may still be incomplete while the year is being typed. */
export function splitMonthYearInput(value: string): {
  month: number | null
  yearText: string
} {
  const trimmed = value.trim()
  if (!trimmed) return { month: null, yearText: '' }

  const parsed = parseYearMonth(trimmed)
  if (parsed) return { month: parsed.month, yearText: String(parsed.year) }

  const loose = /^(\d{0,4})-(\d{1,2})$/.exec(trimmed)
  if (!loose) return { month: null, yearText: '' }

  const monthNum = Number(loose[2])
  const yearRaw = loose[1]
  return {
    yearText: yearRaw === '0000' ? '' : yearRaw,
    month: monthNum >= 1 && monthNum <= 12 ? monthNum : null,
  }
}

export function composeMonthYearInput(
  month: number | null,
  yearText: string,
): string {
  const year = yearText.replace(/\D/g, '').slice(0, 4)
  if (month === null && year === '') return ''
  if (month !== null && /^\d{4}$/.test(year)) {
    return toInputValue({ year: Number(year), month })
  }
  const monthPart = month === null ? '00' : String(month).padStart(2, '0')
  return `${year || '0000'}-${monthPart}`
}

/** Requirement display format: <month>/<year> */
export function formatSlash(ym: YearMonth): string {
  return `${ym.month}/${ym.year}`
}

export function formatLong(ym: YearMonth): string {
  return `${MONTH_NAMES[ym.month - 1]} ${ym.year}`
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const total = ym.year * 12 + (ym.month - 1) + n
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  return { year, month }
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

export function isSameMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month
}

export function isInInclusiveRange(
  ym: YearMonth,
  start: YearMonth,
  end: YearMonth,
): boolean {
  return compareYearMonth(ym, start) >= 0 && compareYearMonth(ym, end) <= 0
}

export function yearMonthKey(ym: YearMonth): string {
  return toInputValue(ym)
}

export function lastPaymentMonth(
  nextPayment: YearMonth,
  remainingMonths: number,
): YearMonth {
  return addMonths(nextPayment, remainingMonths - 1)
}

import type { MonthRow } from '../types.ts'

function csvEscape(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function money(n: number): string {
  return n.toFixed(2)
}

export function scheduleToCsv(rows: MonthRow[]): string {
  const header = [
    'Date',
    'Beginning Balance',
    'Scheduled Payment',
    'P&I',
    'Escrow',
    'Extra Payment',
    'Total Payment',
    'Interest',
    'Principal',
    'Ending Balance',
  ]

  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        csvEscape(row.slashDate),
        money(row.beginningBalance),
        money(row.scheduledPayment),
        money(row.scheduledPi),
        money(row.escrow),
        money(row.extraPayment),
        money(row.totalPayment),
        money(row.interest),
        money(row.principal),
        money(row.endingBalance),
      ].join(','),
    ),
  ]

  return `${lines.join('\n')}\n`
}

export function strategyScheduleFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'strategy'}-schedule.csv`
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

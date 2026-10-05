import { useEffect, useState } from 'react'
import {
  composeMonthYearInput,
  MONTH_NAMES,
  parseYearMonth,
  splitMonthYearInput,
} from '../engine/dates.ts'

interface MonthYearInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}

export function MonthYearInput({
  id,
  value,
  onChange,
  invalid,
}: MonthYearInputProps) {
  const parts = splitMonthYearInput(value)
  const [yearText, setYearText] = useState(parts.yearText)

  useEffect(() => {
    if (value === '' || parseYearMonth(value)) {
      setYearText(splitMonthYearInput(value).yearText)
    }
  }, [value])

  const commit = (month: number | null, nextYear: string) => {
    onChange(composeMonthYearInput(month, nextYear))
  }

  return (
    <div className="month-year">
      <select
        id={id}
        value={parts.month ?? ''}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => {
          const nextMonth =
            event.target.value === '' ? null : Number(event.target.value)
          commit(nextMonth, yearText)
        }}
      >
        <option value="">Month</option>
        {MONTH_NAMES.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
      <input
        id={`${id}-year`}
        aria-label="Year"
        inputMode="numeric"
        autoComplete="off"
        placeholder="YYYY"
        maxLength={4}
        value={yearText}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => {
          const nextYear = event.target.value.replace(/\D/g, '').slice(0, 4)
          setYearText(nextYear)
          if (nextYear.length === 4 || nextYear.length === 0) {
            commit(parts.month, nextYear)
          }
        }}
        onBlur={() => commit(parts.month, yearText)}
      />
    </div>
  )
}

import { compareYearMonth, formatLong, yearMonthKey, type YearMonth } from '../engine/dates.ts'
import {
  formatMoney,
  formatMonthsShortened,
  formatRatio,
} from '../engine/format.ts'
import type { StrategyColumn } from '../types.ts'

interface StrategyComparisonProps {
  baselinePayoff: YearMonth | null
  columns: StrategyColumn[]
  activeStrategyId: string
}

function ready(column: StrategyColumn): boolean {
  return Boolean(column.validation.extrasOk && column.hasPlan && column.result?.modifiedPayoff)
}

export function StrategyComparison({
  baselinePayoff,
  columns,
  activeStrategyId,
}: StrategyComparisonProps) {
  const comparable = columns.filter(ready)
  const payoffKeys = new Set(
    comparable.map((column) => yearMonthKey(column.result!.modifiedPayoff!)),
  )
  const savedAmounts = comparable.map((column) => column.result!.interestSaved)
  const earliestKey =
    payoffKeys.size > 1
      ? comparable.reduce((best, column) =>
          compareYearMonth(column.result!.modifiedPayoff!, best.result!.modifiedPayoff!) < 0
            ? column
            : best,
        ).result!.modifiedPayoff!
      : null
  const mostSaved =
    savedAmounts.length > 1 && Math.min(...savedAmounts) !== Math.max(...savedAmounts)
      ? Math.max(...savedAmounts)
      : null

  const payoffText = (column: StrategyColumn): string => {
    if (!column.validation.extrasOk) return 'Fix this strategy'
    if (!column.hasPlan) return 'No prepayment yet'
    return column.result?.modifiedPayoff ? formatLong(column.result.modifiedPayoff) : '—'
  }

  const metric = (column: StrategyColumn, value: string | null): string => {
    if (!ready(column)) return '—'
    return value ?? '—'
  }

  return (
    <section className="panel" aria-labelledby="compare-heading">
      <div className="panel-header">
        <h2 id="compare-heading">Compare strategies</h2>
        <p>
          Each column is one prepayment plan against paying only the scheduled P&amp;I. Earliest payoff and most interest saved are marked when the strategies differ.
        </p>
      </div>
      <div className="compare-scroll">
        <table className="compare-table">
          <caption className="sr-only">
            Baseline and each strategy by payoff date, months shortened, interest saved, extra dollars, and interest saved per extra dollar
          </caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Baseline</th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={column.id === activeStrategyId ? 'is-active' : undefined}
                >
                  {column.name.trim() || 'Untitled strategy'}
                  {column.id === activeStrategyId ? (
                    <span className="compare-note">Editing</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Payoff date</th>
              <td>{baselinePayoff ? formatLong(baselinePayoff) : '—'}</td>
              {columns.map((column) => {
                const earliest =
                  earliestKey != null &&
                  column.result?.modifiedPayoff != null &&
                  compareYearMonth(column.result.modifiedPayoff, earliestKey) === 0 &&
                  ready(column)
                return (
                  <td
                    key={column.id}
                    className={cellClass(column.id === activeStrategyId, earliest)}
                  >
                    {payoffText(column)}
                    {earliest ? <span className="compare-note">Earliest payoff</span> : null}
                  </td>
                )
              })}
            </tr>
            <tr>
              <th scope="row">Months shortened</th>
              <td>—</td>
              {columns.map((column) => (
                <td key={column.id} className={cellClass(column.id === activeStrategyId, false)}>
                  {metric(
                    column,
                    column.result ? formatMonthsShortened(column.result.monthsShortened) : null,
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Interest saved</th>
              <td>—</td>
              {columns.map((column) => {
                const most =
                  mostSaved != null && ready(column) && column.result!.interestSaved === mostSaved
                return (
                  <td key={column.id} className={cellClass(column.id === activeStrategyId, most)}>
                    {metric(column, column.result ? formatMoney(column.result.interestSaved) : null)}
                    {most ? <span className="compare-note">Most interest saved</span> : null}
                  </td>
                )
              })}
            </tr>
            <tr>
              <th scope="row">Extra dollars paid</th>
              <td>{formatMoney(0)}</td>
              {columns.map((column) => (
                <td key={column.id} className={cellClass(column.id === activeStrategyId, false)}>
                  {metric(
                    column,
                    column.result ? formatMoney(column.result.totalExtraPrincipal) : null,
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Interest saved per extra dollar</th>
              <td>—</td>
              {columns.map((column) => (
                <td key={column.id} className={cellClass(column.id === activeStrategyId, false)}>
                  {metric(
                    column,
                    column.result?.returnPerDollar == null
                      ? null
                      : `${formatRatio(column.result.returnPerDollar)} per $1.00`,
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function cellClass(active: boolean, best: boolean): string | undefined {
  const names = [active ? 'is-active' : '', best ? 'is-best' : ''].filter(Boolean)
  return names.length > 0 ? names.join(' ') : undefined
}

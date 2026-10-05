import { formatLong } from '../engine/dates.ts'
import {
  formatMoney,
  formatMonthsShortened,
  formatRatio,
} from '../engine/format.ts'
import type { CalculationResult } from '../types.ts'

interface SummaryProps {
  result: CalculationResult
  extrasOk: boolean
  hasPlan: boolean
  strategyName: string
}

export function Summary({ result, extrasOk, hasPlan, strategyName }: SummaryProps) {
  const name = strategyName.trim() || 'This strategy'
  const sooner = formatMonthsShortened(result.monthsShortened)

  return (
    <section className="panel" aria-labelledby="plan-heading">
      <div className="panel-header">
        <h2 id="plan-heading">What this plan changes</h2>
        <p>
          {name} compared with paying only the scheduled P&amp;I from the next payment on — not versus the original note.
        </p>
      </div>
      {!extrasOk ? (
        <div className="banner banner-warn">
          Fix the highlighted extras to see interest that will be saved, payoff acceleration, and the interest savings ratio.
        </div>
      ) : !hasPlan ? (
        <div className="banner">
          Add a recurring prepayment or lump sum to compare against paying only the scheduled P&amp;I.
        </div>
      ) : (
        <div className="summary-grid summary-grid-plan">
          <article className="stat-card">
            <p className="stat-kicker">Debt-free sooner</p>
            <p className="stat-value">{sooner}</p>
            <p className="stat-copy">
              {result.monthsShortened === 0
                ? 'Payoff month stays the same on this plan.'
                : `You’ll be debt-free ${sooner} sooner.`}
              {result.modifiedPayoff
                ? ` Modified payoff: ${formatLong(result.modifiedPayoff)}.`
                : ''}
            </p>
          </article>
          <article className="stat-card stat-card-save">
            <p className="stat-kicker">Interest that will be saved</p>
            <p className="stat-value">{formatMoney(result.interestSaved)}</p>
            <p className="stat-copy">
              You’ll save {formatMoney(result.interestSaved)} in interest
              {result.baselinePayoff
                ? `, versus paying through ${formatLong(result.baselinePayoff)}.`
                : '.'}
            </p>
          </article>
          <article className="stat-card">
            <p className="stat-kicker">Extra Principal Paid</p>
            <p className="stat-value">{formatMoney(result.totalExtraPrincipal)}</p>
            <p className="stat-copy">
              Additional principal this plan applies beyond the scheduled payment.
            </p>
          </article>
          <article className="stat-card stat-card-return">
            <p className="stat-kicker">Interest Savings Ratio</p>
            <p className="stat-value">
              {result.returnPerDollar === null
                ? '—'
                : `${formatRatio(result.returnPerDollar)} per $1.00`}
            </p>
            <p className="stat-copy">
              {result.returnPerDollar === null
                ? 'No extra principal was applied.'
                : `Every extra $1.00 paid saves ${formatRatio(result.returnPerDollar)} in future interest.`}
            </p>
          </article>
        </div>
      )}
    </section>
  )
}

import { formatLong } from '../engine/dates.ts'
import { formatMoney, formatMonthsShortened } from '../engine/format.ts'
import type { CalculationResult } from '../types.ts'

interface CurrentPositionProps {
  result: CalculationResult
}

export function CurrentPosition({ result }: CurrentPositionProps) {
  const original = result.original

  return (
    <section className="panel" aria-labelledby="position-heading">
      <div className="panel-header">
        <h2 id="position-heading">Where you stand</h2>
        <p>
          If you pay only the scheduled P&I from the next payment on, with no more extras. Escrow is cash you still send; it does not change this term.
        </p>
      </div>
      <div className="summary-grid summary-grid-stand">
        <article className="stat-card">
          <p className="stat-kicker">Payments left</p>
          <p className="stat-value">{result.remainingMonths}</p>
          <p className="stat-copy">
            {formatMonthsShortened(result.remainingMonths)} of scheduled P&I
            {result.baselinePayoff
              ? `, paying off in ${formatLong(result.baselinePayoff)}.`
              : '.'}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-kicker">Interest left</p>
          <p className="stat-value">{formatMoney(result.remainingInterest)}</p>
          <p className="stat-copy">
            Interest remaining if you make no more extra principal payments.
          </p>
        </article>
        <article className="stat-card stat-card-save">
          <p className="stat-kicker">Vs original schedule</p>
          {original ? (
            <>
              <p className="stat-value">{original.originalRemainingMonths}</p>
              <p className="stat-copy">
                Original remaining payments as of the next due date
                {original.originalPayoff
                  ? ` (original payoff ${formatLong(original.originalPayoff)})`
                  : ''}
                . You are {formatMoney(Math.abs(original.principalAhead))}{' '}
                {original.principalAhead >= 0 ? 'ahead' : 'behind'} in principal.
              </p>
            </>
          ) : (
            <>
              <p className="stat-value">—</p>
              <p className="stat-copy">
                Add original loan amount, term, and first payment to compare with the original amortization.
              </p>
            </>
          )}
        </article>
      </div>
    </section>
  )
}

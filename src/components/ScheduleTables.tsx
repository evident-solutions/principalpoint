import { useState } from 'react'
import { downloadCsv, scheduleToCsv, strategyScheduleFilename } from '../engine/csv.ts'
import { formatMoney } from '../engine/format.ts'
import type { CalculationResult, MonthRow } from '../types.ts'

type TableKind = 'baseline' | 'modified'

interface ScheduleTablesProps {
  result: CalculationResult
  showModified: boolean
  strategyName: string
}

function moneyCell(value: number): string {
  return formatMoney(value)
}

function ScheduleTable({ rows, caption }: { rows: MonthRow[]; caption: string }) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Beginning balance</th>
            <th>Scheduled payment</th>
            <th>P&I</th>
            <th>Escrow</th>
            <th>Extra payment</th>
            <th>Total payment</th>
            <th>Interest</th>
            <th>Principal</th>
            <th>Ending balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slashDate} data-extra={row.extraPayment > 0 ? 'true' : undefined}>
              <td>{row.slashDate}</td>
              <td>{moneyCell(row.beginningBalance)}</td>
              <td>{moneyCell(row.scheduledPayment)}</td>
              <td>{moneyCell(row.scheduledPi)}</td>
              <td>{moneyCell(row.escrow)}</td>
              <td>{moneyCell(row.extraPayment)}</td>
              <td>{moneyCell(row.totalPayment)}</td>
              <td>{moneyCell(row.interest)}</td>
              <td>{moneyCell(row.principal)}</td>
              <td>{moneyCell(row.endingBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ScheduleTables({ result, showModified, strategyName }: ScheduleTablesProps) {
  const scheduleLabel = strategyName.trim() || 'Strategy'
  const [kind, setKind] = useState<TableKind>('modified')
  const active: TableKind = showModified ? kind : 'baseline'
  const rows = active === 'modified' ? result.modified : result.baseline

  return (
    <section className="panel" aria-labelledby="tables-heading">
      <div className="panel-header panel-header-row">
        <div>
          <h2 id="tables-heading">Month-by-month schedule</h2>
          <p>Every payment until payoff. Extra-payment months are highlighted.</p>
        </div>
        <div className="table-toolbar">
          <div className="segmented" role="tablist" aria-label="Schedule to display">
            <button
              type="button"
              role="tab"
              aria-selected={active === 'baseline'}
              onClick={() => setKind('baseline')}
            >
              Baseline
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={active === 'modified'}
              disabled={!showModified}
              onClick={() => setKind('modified')}
            >
              {scheduleLabel}
            </button>
          </div>
          <button
            type="button"
            className="ghost-btn"
            onClick={() =>
              downloadCsv(
                active === 'modified'
                  ? strategyScheduleFilename(scheduleLabel)
                  : 'baseline-schedule.csv',
                scheduleToCsv(rows),
              )
            }
          >
            Download CSV
          </button>
        </div>
      </div>
      <ScheduleTable
        rows={rows}
        caption={
          active === 'modified'
            ? `${scheduleLabel} mortgage schedule`
            : 'Baseline mortgage schedule'
        }
      />
    </section>
  )
}

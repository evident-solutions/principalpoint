import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { compareYearMonth, yearMonthKey } from '../engine/dates.ts'
import { formatMoney } from '../engine/format.ts'
import type { CalculationResult, MonthRow } from '../types.ts'

interface ChartPoint {
  key: string
  label: string
  slashDate: string
  baselineBalance: number
  modifiedBalance: number | null
  originalBalance: number | null
  baselineCumInterest: number
  modifiedCumInterest: number | null
  extraCum: number | null
}

function buildChartData(result: CalculationResult, showModified: boolean): ChartPoint[] {
  const originalRows = result.original?.remainingSchedule ?? []
  const axis = originalRows.length > result.baseline.length ? originalRows : result.baseline

  const baselineByKey = new Map<string, MonthRow>()
  for (const row of result.baseline) baselineByKey.set(yearMonthKey(row.date), row)
  const modifiedByKey = new Map<string, MonthRow>()
  for (const row of result.modified) modifiedByKey.set(yearMonthKey(row.date), row)
  const originalByKey = new Map<string, MonthRow>()
  for (const row of originalRows) originalByKey.set(yearMonthKey(row.date), row)

  const lastBaseline = result.baseline[result.baseline.length - 1]
  const paidOff = showModified && result.modified.length > 0
  let lastExtra = 0
  let lastModInterest = 0

  return axis.map((row) => {
    const key = yearMonthKey(row.date)
    const baseline = baselineByKey.get(key)
    const mod = modifiedByKey.get(key)
    const original = originalByKey.get(key)
    if (mod) {
      lastExtra = mod.cumulativeExtraPrincipal
      lastModInterest = mod.cumulativeInterest
    }

    const afterBaseline =
      lastBaseline != null && compareYearMonth(row.date, lastBaseline.date) > 0

    return {
      key,
      label: row.dateLabel,
      slashDate: row.slashDate,
      baselineBalance: baseline?.endingBalance ?? (afterBaseline ? 0 : row.endingBalance),
      modifiedBalance: mod
        ? mod.endingBalance
        : paidOff
          ? 0
          : null,
      originalBalance: original
        ? original.endingBalance
        : originalRows.length
          ? 0
          : null,
      baselineCumInterest: baseline?.cumulativeInterest ?? lastBaseline?.cumulativeInterest ?? 0,
      modifiedCumInterest: mod
        ? mod.cumulativeInterest
        : paidOff
          ? lastModInterest
          : null,
      extraCum: mod ? mod.cumulativeExtraPrincipal : paidOff ? lastExtra : null,
    }
  })
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: ChartPoint }[]
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-date">{point.label}</p>
      <dl>
        {point.originalBalance !== null ? (
          <div>
            <dt>Original schedule</dt>
            <dd>{formatMoney(point.originalBalance)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Baseline balance</dt>
          <dd>{formatMoney(point.baselineBalance)}</dd>
        </div>
        {point.modifiedBalance !== null ? (
          <div>
            <dt>Modified balance</dt>
            <dd>{formatMoney(point.modifiedBalance)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Cumulative interest (baseline)</dt>
          <dd>{formatMoney(point.baselineCumInterest)}</dd>
        </div>
        {point.modifiedCumInterest !== null ? (
          <div>
            <dt>Cumulative interest (modified)</dt>
            <dd>{formatMoney(point.modifiedCumInterest)}</dd>
          </div>
        ) : null}
        {point.extraCum !== null ? (
          <div>
            <dt>Cumulative extra principal</dt>
            <dd>{formatMoney(point.extraCum)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

function compactMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

interface BalanceChartProps {
  result: CalculationResult
  showModified: boolean
}

export function BalanceChart({ result, showModified }: BalanceChartProps) {
  const data = buildChartData(result, showModified)
  const showOriginal = result.original != null

  return (
    <section className="panel chart-panel" aria-labelledby="chart-heading">
      <div className="panel-header">
        <h2 id="chart-heading">Balance over time</h2>
        <p>
          Baseline is scheduled P&I from today. The original line is where the note schedule would still be. Hover a month for balances, interest, and extra principal.
        </p>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid stroke="rgba(26, 35, 50, 0.08)" vertical={false} />
            <XAxis
              dataKey="label"
              interval="equidistantPreserveStart"
              minTickGap={28}
              tick={{ fill: '#5c564c', fontSize: 11 }}
              axisLine={{ stroke: '#ddd4c4' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={compactMoney}
              width={64}
              tick={{ fill: '#5c564c', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 13, color: '#1a2332' }}
              iconType="plainline"
            />
            {showOriginal ? (
              <Line
                type="monotone"
                dataKey="originalBalance"
                name="Original"
                stroke="#b85c38"
                strokeDasharray="5 4"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="baselineBalance"
              name="Baseline"
              stroke="#8a7d6b"
              fill="#8a7d6b"
              fillOpacity={0.14}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            {showModified ? (
              <Area
                type="monotone"
                dataKey="modifiedBalance"
                name="Modified"
                stroke="#1d4f4a"
                fill="#1d4f4a"
                fillOpacity={0.22}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

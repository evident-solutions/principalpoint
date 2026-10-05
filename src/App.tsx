import { useMemo, useState } from 'react'
import { BalanceChart } from './components/BalanceChart.tsx'
import { CurrentPosition } from './components/CurrentPosition.tsx'
import { ExtraPlans } from './components/ExtraPlans.tsx'
import { LoanInputs } from './components/LoanInputs.tsx'
import { ScheduleTables } from './components/ScheduleTables.tsx'
import { Strategies } from './components/Strategies.tsx'
import { StrategyComparison } from './components/StrategyComparison.tsx'
import { Summary } from './components/Summary.tsx'
import { createId, defaultPlanner } from './defaults.ts'
import { compareStrategies } from './engine/validate.ts'
import type { FormState, PlannerState, StrategyInput, ValidationResult } from './types.ts'
import './App.css'

const loanFields = [
  'balance',
  'annualRatePercent',
  'scheduledPayment',
  'escrow',
  'nextPayment',
  'originalPrincipal',
  'originalTermYears',
  'firstPayment',
] as const

function activeStrategy(planner: PlannerState): StrategyInput {
  return (
    planner.strategies.find((strategy) => strategy.id === planner.activeStrategyId) ??
    planner.strategies[0]
  )
}

function loanForm(planner: PlannerState, strategy: StrategyInput): FormState {
  return {
    balance: planner.balance,
    annualRatePercent: planner.annualRatePercent,
    scheduledPayment: planner.scheduledPayment,
    escrow: planner.escrow,
    nextPayment: planner.nextPayment,
    originalPrincipal: planner.originalPrincipal,
    originalTermYears: planner.originalTermYears,
    firstPayment: planner.firstPayment,
    recurring: strategy.recurring,
    lumps: strategy.lumps,
  }
}

function nextStrategyName(strategies: StrategyInput[]): string {
  const used = strategies.map((strategy) => {
    const match = /^Strategy (\d+)$/.exec(strategy.name.trim())
    return match ? Number(match[1]) : 0
  })
  return `Strategy ${Math.max(0, ...used) + 1}`
}

function clonePieces(strategy: StrategyInput): Pick<StrategyInput, 'recurring' | 'lumps'> {
  return {
    recurring: strategy.recurring.map((window) => ({ ...window, id: createId() })),
    lumps: strategy.lumps.map((lump) => ({ ...lump, id: createId() })),
  }
}

export default function App() {
  const [planner, setPlanner] = useState<PlannerState>(defaultPlanner)
  const selected = activeStrategy(planner)
  const comparison = useMemo(
    () => compareStrategies(loanForm(planner, selected), planner.strategies),
    [planner, selected],
  )
  const activeColumn =
    comparison.columns.find((column) => column.id === selected.id) ?? comparison.columns[0]
  const form = loanForm(planner, selected)
  const showModified = Boolean(
    activeColumn?.result && activeColumn.validation.extrasOk && activeColumn.hasPlan,
  )
  const extrasValidation: ValidationResult = activeColumn?.validation ?? {
    loanErrors: comparison.loanErrors,
    recurringErrors: [],
    lumpErrors: [],
    loanOk: comparison.loanOk,
    extrasOk: false,
    ok: false,
  }

  const patchForm = (patch: Partial<FormState>) => {
    setPlanner((current) => {
      const next: PlannerState = { ...current, strategies: current.strategies }
      for (const key of loanFields) {
        if (patch[key] !== undefined) next[key] = patch[key]
      }
      if (patch.recurring !== undefined || patch.lumps !== undefined) {
        next.strategies = current.strategies.map((strategy) => {
          if (strategy.id !== current.activeStrategyId) return strategy
          const updated: StrategyInput = { ...strategy }
          if (patch.recurring !== undefined) updated.recurring = patch.recurring
          if (patch.lumps !== undefined) updated.lumps = patch.lumps
          return updated
        })
      }
      return next
    })
  }

  const selectStrategy = (id: string) => {
    setPlanner((current) => ({ ...current, activeStrategyId: id }))
  }

  const renameStrategy = (id: string, name: string) => {
    setPlanner((current) => ({
      ...current,
      strategies: current.strategies.map((strategy) =>
        strategy.id === id ? { ...strategy, name } : strategy,
      ),
    }))
  }

  const addStrategy = () => {
    setPlanner((current) => {
      const strategy: StrategyInput = {
        id: createId(),
        name: nextStrategyName(current.strategies),
        recurring: [],
        lumps: [],
      }
      return {
        ...current,
        strategies: [...current.strategies, strategy],
        activeStrategyId: strategy.id,
      }
    })
  }

  const duplicateStrategy = (id: string) => {
    setPlanner((current) => {
      const source = current.strategies.find((strategy) => strategy.id === id)
      if (!source) return current
      const copy: StrategyInput = {
        id: createId(),
        name: `${source.name.trim() || 'Strategy'} copy`,
        ...clonePieces(source),
      }
      const index = current.strategies.findIndex((strategy) => strategy.id === id)
      const strategies = [...current.strategies]
      strategies.splice(index + 1, 0, copy)
      return { ...current, strategies, activeStrategyId: copy.id }
    })
  }

  const removeStrategy = (id: string) => {
    setPlanner((current) => {
      if (current.strategies.length < 2) return current
      const strategies = current.strategies.filter((strategy) => strategy.id !== id)
      return {
        ...current,
        strategies,
        activeStrategyId:
          current.activeStrategyId === id ? strategies[0].id : current.activeStrategyId,
      }
    })
  }

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Fixed-rate · P&amp;I + escrow</p>
        <h1>Mortgage paydown planner</h1>
        <p className="lede">
          See how many scheduled payments you have left from today’s balance, compare with the original note, then model recurring prepayments and lump sums. Add a second strategy to compare payoff date, interest saved, and extra dollars side by side.
        </p>
      </header>

      <div className="layout">
        <form className="sidebar" onSubmit={(event) => event.preventDefault()}>
          <LoanInputs form={form} errors={comparison.loanErrors} onChange={patchForm} />
          <Strategies
            strategies={planner.strategies}
            activeStrategyId={selected.id}
            onSelect={selectStrategy}
            onRename={renameStrategy}
            onAdd={addStrategy}
            onDuplicate={duplicateStrategy}
            onRemove={removeStrategy}
          />
          <ExtraPlans
            form={form}
            validation={extrasValidation}
            result={showModified ? activeColumn?.result ?? null : null}
            onChange={patchForm}
          />
        </form>

        <main className="results">
          {comparison.loanOk && activeColumn?.result ? (
            <>
              <CurrentPosition result={activeColumn.result} />
              {comparison.columns.length >= 2 ? (
                <StrategyComparison
                  baselinePayoff={comparison.baselinePayoff}
                  columns={comparison.columns}
                  activeStrategyId={selected.id}
                />
              ) : null}
              <Summary
                result={activeColumn.result}
                extrasOk={activeColumn.validation.extrasOk}
                hasPlan={activeColumn.hasPlan}
                strategyName={selected.name}
              />
              <BalanceChart result={activeColumn.result} showModified={showModified} />
              <ScheduleTables
                result={activeColumn.result}
                showModified={showModified}
                strategyName={selected.name}
              />
            </>
          ) : (
            <div className="banner banner-warn">
              Enter a valid current loan position to generate the remaining schedule.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

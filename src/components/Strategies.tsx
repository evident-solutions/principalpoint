import type { StrategyInput } from '../types.ts'

interface StrategiesProps {
  strategies: StrategyInput[]
  activeStrategyId: string
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onAdd: () => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
}

export function Strategies({
  strategies,
  activeStrategyId,
  onSelect,
  onRename,
  onAdd,
  onDuplicate,
  onRemove,
}: StrategiesProps) {
  return (
    <section className="panel" aria-labelledby="strategies-heading">
      <div className="panel-header">
        <h2 id="strategies-heading">Strategies</h2>
        <p>
          Same loan, different prepayments. Select one to edit its recurring payments and lump sums.
        </p>
      </div>
      <div className="card-list" role="list">
        {strategies.map((strategy) => {
          const selected = strategy.id === activeStrategyId
          return (
            <article
              className={selected ? 'plan-card strategy-card is-selected' : 'plan-card strategy-card'}
              key={strategy.id}
              role="listitem"
              onClick={() => onSelect(strategy.id)}
            >
              <div className="strategy-row">
                <input
                  aria-label="Strategy name"
                  value={strategy.name}
                  onFocus={() => onSelect(strategy.id)}
                  onChange={(event) => onRename(strategy.id, event.target.value)}
                />
                <button
                  type="button"
                  className="text-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDuplicate(strategy.id)
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="link-btn"
                  disabled={strategies.length < 2}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(strategy.id)
                  }}
                >
                  Remove
                </button>
              </div>
              {selected ? <p className="field-hint">Editing this strategy.</p> : null}
            </article>
          )
        })}
      </div>
      <button type="button" className="ghost-btn" onClick={onAdd}>
        Add strategy
      </button>
    </section>
  )
}

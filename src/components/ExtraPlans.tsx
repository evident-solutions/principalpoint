import { Field } from './Field.tsx'
import { MonthYearInput } from './MonthYearInput.tsx'
import { createId } from '../defaults.ts'
import { isSameMonth, parseYearMonth } from '../engine/dates.ts'
import { formatMoney } from '../engine/format.ts'
import type {
  CalculationResult,
  FormState,
  LumpSumInput,
  RecurringWindowInput,
  ValidationResult,
} from '../types.ts'

interface ExtraPlansProps {
  form: FormState
  validation: ValidationResult
  result: CalculationResult | null
  onChange: (patch: Partial<FormState>) => void
}

function recurringError(validation: ValidationResult, id: string) {
  return validation.recurringErrors.find((entry) => entry.id === id)
}

function lumpError(validation: ValidationResult, id: string) {
  return validation.lumpErrors.find((entry) => entry.id === id)
}

function extraHint(
  result: CalculationResult | null,
  window: RecurringWindowInput,
): string | undefined {
  if (window.mode !== 'goal' || !result?.modified.length) return undefined
  const start = parseYearMonth(window.start)
  if (!start) return undefined
  const row = result.modified.find((item) => isSameMonth(item.date, start))
  if (!row || row.extraPayment <= 0) return undefined
  return `Extra required in ${row.dateLabel}: ${formatMoney(row.extraPayment)} (this amount changes as interest falls).`
}

export function ExtraPlans({ form, validation, result, onChange }: ExtraPlansProps) {
  const updateRecurring = (id: string, patch: Partial<RecurringWindowInput>) => {
    onChange({
      recurring: form.recurring.map((window) =>
        window.id === id ? { ...window, ...patch } : window,
      ),
    })
  }

  const updateLump = (id: string, patch: Partial<LumpSumInput>) => {
    onChange({
      lumps: form.lumps.map((lump) => (lump.id === id ? { ...lump, ...patch } : lump)),
    })
  }

  return (
    <>
      <section className="panel" aria-labelledby="recurring-heading">
        <div className="panel-header">
          <h2 id="recurring-heading">Recurring prepayments</h2>
          <p>
            Each window is one monthly stream. Payment-driven is a fixed extra each month. Goal-driven is the total principal applied each month, contractual plus extra.
          </p>
        </div>
        <div className="card-list">
          {form.recurring.map((window, index) => {
            const errors = recurringError(validation, window.id)
            const hint = extraHint(result, window)
            return (
              <article className="plan-card" key={window.id}>
                <div className="plan-card-top">
                  <h3>Window {index + 1}</h3>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() =>
                      onChange({
                        recurring: form.recurring.filter((item) => item.id !== window.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
                <div
                  className="segmented segmented-stretch"
                  role="radiogroup"
                  aria-label={`How to state window ${index + 1}`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={window.mode === 'payment'}
                    onClick={() => updateRecurring(window.id, { mode: 'payment' })}
                  >
                    Payment-driven
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={window.mode === 'goal'}
                    onClick={() => updateRecurring(window.id, { mode: 'goal' })}
                  >
                    Goal-driven
                  </button>
                </div>
                <div className="field-grid field-grid-stack">
                  <Field label="Start" htmlFor={`${window.id}-start`} error={errors?.start}>
                    <MonthYearInput
                      id={`${window.id}-start`}
                      value={window.start}
                      onChange={(start) => updateRecurring(window.id, { start })}
                      invalid={Boolean(errors?.start)}
                    />
                  </Field>
                  <Field label="End" htmlFor={`${window.id}-end`} error={errors?.end}>
                    <MonthYearInput
                      id={`${window.id}-end`}
                      value={window.end}
                      onChange={(end) => updateRecurring(window.id, { end })}
                      invalid={Boolean(errors?.end)}
                    />
                  </Field>
                  {window.mode === 'payment' ? (
                    <Field
                      label="Extra principal / month"
                      htmlFor={`${window.id}-amount`}
                      error={errors?.extraAmount}
                    >
                      <div className="input-prefix">
                        <span aria-hidden="true">$</span>
                        <input
                          id={`${window.id}-amount`}
                          inputMode="decimal"
                          value={window.extraAmount}
                          onChange={(e) =>
                            updateRecurring(window.id, { extraAmount: e.target.value })
                          }
                          aria-invalid={errors?.extraAmount ? true : undefined}
                          autoComplete="off"
                        />
                      </div>
                    </Field>
                  ) : (
                    <Field
                      label="Target principal / month"
                      htmlFor={`${window.id}-target`}
                      error={errors?.targetPrincipal}
                      hint={hint}
                    >
                      <div className="input-prefix">
                        <span aria-hidden="true">$</span>
                        <input
                          id={`${window.id}-target`}
                          inputMode="decimal"
                          value={window.targetPrincipal}
                          onChange={(e) =>
                            updateRecurring(window.id, { targetPrincipal: e.target.value })
                          }
                          aria-invalid={errors?.targetPrincipal ? true : undefined}
                          autoComplete="off"
                        />
                      </div>
                    </Field>
                  )}
                </div>
                {errors?.overlap ? (
                  <p className="field-error" role="alert">
                    {errors.overlap}
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() =>
            onChange({
              recurring: [
                ...form.recurring,
                {
                  id: createId(),
                  mode: 'payment',
                  start: '',
                  end: '',
                  extraAmount: '',
                  targetPrincipal: '',
                },
              ],
            })
          }
        >
          Add recurring prepayment
        </button>
      </section>

      <section className="panel" aria-labelledby="lumps-heading">
        <div className="panel-header">
          <h2 id="lumps-heading">One-time lump sums</h2>
          <p>Applied entirely to principal in the chosen month, on top of that month’s other payments.</p>
        </div>
        <div className="card-list">
          {form.lumps.map((lump, index) => {
            const errors = lumpError(validation, lump.id)
            return (
              <article className="plan-card" key={lump.id}>
                <div className="plan-card-top">
                  <h3>Lump sum {index + 1}</h3>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() =>
                      onChange({
                        lumps: form.lumps.filter((item) => item.id !== lump.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="field-grid field-grid-stack">
                  <Field
                    label="Month"
                    htmlFor={`${lump.id}-month`}
                    error={errors?.month ?? errors?.duplicate}
                  >
                    <MonthYearInput
                      id={`${lump.id}-month`}
                      value={lump.month}
                      onChange={(month) => updateLump(lump.id, { month })}
                      invalid={Boolean(errors?.month || errors?.duplicate)}
                    />
                  </Field>
                  <Field label="Amount" htmlFor={`${lump.id}-amount`} error={errors?.amount}>
                    <div className="input-prefix">
                      <span aria-hidden="true">$</span>
                      <input
                        id={`${lump.id}-amount`}
                        inputMode="decimal"
                        value={lump.amount}
                        onChange={(e) => updateLump(lump.id, { amount: e.target.value })}
                        aria-invalid={errors?.amount ? true : undefined}
                        autoComplete="off"
                      />
                    </div>
                  </Field>
                </div>
              </article>
            )
          })}
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() =>
            onChange({
              lumps: [...form.lumps, { id: createId(), month: '', amount: '' }],
            })
          }
        >
          Add lump sum
        </button>
      </section>
    </>
  )
}

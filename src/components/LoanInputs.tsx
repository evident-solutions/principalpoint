import { Field } from './Field.tsx'
import { MonthYearInput } from './MonthYearInput.tsx'
import type { FormState, ValidationResult } from '../types.ts'

interface LoanInputsProps {
  form: FormState
  errors: ValidationResult['loanErrors']
  onChange: (patch: Partial<FormState>) => void
}

export function LoanInputs({ form, errors, onChange }: LoanInputsProps) {
  return (
    <>
      <section className="panel" aria-labelledby="loan-heading">
        <div className="panel-header">
          <h2 id="loan-heading">Current loan</h2>
          <p>
            From your latest statement. Remaining months are calculated from the current balance and P&I.
          </p>
        </div>
        <div className="field-grid">
          <Field label="Remaining principal" htmlFor="balance" error={errors.balance}>
            <div className="input-prefix">
              <span aria-hidden="true">$</span>
              <input
                id="balance"
                inputMode="decimal"
                value={form.balance}
                onChange={(e) => onChange({ balance: e.target.value })}
                aria-invalid={errors.balance ? true : undefined}
                autoComplete="off"
              />
            </div>
          </Field>
          <Field
            label="Annual interest rate"
            htmlFor="annualRatePercent"
            error={errors.annualRatePercent}
          >
            <div className="input-suffix">
              <input
                id="annualRatePercent"
                inputMode="decimal"
                value={form.annualRatePercent}
                onChange={(e) => onChange({ annualRatePercent: e.target.value })}
                aria-invalid={errors.annualRatePercent ? true : undefined}
                autoComplete="off"
              />
              <span aria-hidden="true">%</span>
            </div>
          </Field>
          <Field
            label="Scheduled monthly payment"
            htmlFor="scheduledPayment"
            hint="P&I + escrow — the amount drafted each month."
            error={errors.scheduledPayment}
          >
            <div className="input-prefix">
              <span aria-hidden="true">$</span>
              <input
                id="scheduledPayment"
                inputMode="decimal"
                value={form.scheduledPayment}
                onChange={(e) => onChange({ scheduledPayment: e.target.value })}
                aria-invalid={errors.scheduledPayment ? true : undefined}
                autoComplete="off"
              />
            </div>
          </Field>
          <Field
            label="Monthly escrow"
            htmlFor="escrow"
            hint="Taxes and insurance. Use 0 if none."
            error={errors.escrow}
          >
            <div className="input-prefix">
              <span aria-hidden="true">$</span>
              <input
                id="escrow"
                inputMode="decimal"
                value={form.escrow}
                onChange={(e) => onChange({ escrow: e.target.value })}
                aria-invalid={errors.escrow ? true : undefined}
                autoComplete="off"
              />
            </div>
          </Field>
          <Field
            label="Next scheduled payment"
            htmlFor="nextPayment"
            error={errors.nextPayment}
          >
            <MonthYearInput
              id="nextPayment"
              value={form.nextPayment}
              onChange={(nextPayment) => onChange({ nextPayment })}
              invalid={Boolean(errors.nextPayment)}
            />
          </Field>
        </div>
      </section>

      <section className="panel" aria-labelledby="original-heading">
        <div className="panel-header">
          <h2 id="original-heading">Original loan</h2>
          <p>
            Optional. Fill this in to compare today’s remaining term with the original amortization. Leave blank to skip.
          </p>
        </div>
        <div className="field-grid">
          <Field
            label="Original principal"
            htmlFor="originalPrincipal"
            error={errors.originalPrincipal}
          >
            <div className="input-prefix">
              <span aria-hidden="true">$</span>
              <input
                id="originalPrincipal"
                inputMode="decimal"
                value={form.originalPrincipal}
                onChange={(e) => onChange({ originalPrincipal: e.target.value })}
                aria-invalid={errors.originalPrincipal ? true : undefined}
                autoComplete="off"
              />
            </div>
          </Field>
          <Field
            label="Original term"
            htmlFor="originalTermYears"
            hint="Whole years, e.g. 30."
            error={errors.originalTermYears}
          >
            <div className="input-suffix">
              <input
                id="originalTermYears"
                inputMode="numeric"
                value={form.originalTermYears}
                onChange={(e) => onChange({ originalTermYears: e.target.value })}
                aria-invalid={errors.originalTermYears ? true : undefined}
                autoComplete="off"
              />
              <span aria-hidden="true">years</span>
            </div>
          </Field>
          <Field
            label="First scheduled payment"
            htmlFor="firstPayment"
            error={errors.firstPayment}
          >
            <MonthYearInput
              id="firstPayment"
              value={form.firstPayment}
              onChange={(firstPayment) => onChange({ firstPayment })}
              invalid={Boolean(errors.firstPayment)}
            />
          </Field>
        </div>
      </section>
    </>
  )
}

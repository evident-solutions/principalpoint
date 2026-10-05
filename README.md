# PrincipalPoint

Mortgage paydown planner for fixed-rate, fully amortizing loans.

From your **current** position (balance, rate, contractual P&I), PrincipalPoint rebuilds the remaining schedule, then lets you simulate and compare extra principal strategies.

## Why

Servicers rarely reissue a full amortization schedule after extra principal payments. Borrowers who have prepaid—or who are considering prepayment—often cannot answer: *from here, how many payments remain?*

## Success criteria (MVP)

1. **Current position clarity** — Enter balance, rate, and contractual P&I → see payments remaining, projected payoff date, and total interest from today with no extras (baseline).
2. **Strategy simulation** — Model recurring extras (payment-driven or goal-driven with per-month validation) and/or lump sums → see new payoff date, months shortened, interest saved, and interest saved per extra dollar.
3. **Strategy comparison** — Compare two or more strategies side by side against the baseline on payoff date, months shortened, interest saved, total extra dollars, and interest saved per extra dollar.

## Scope

- Fixed-rate, fully amortizing mortgages
- Informational only — not financial, tax, or legal advice

## Status

Repository bootstrap. Application code coming from the local Mortgage Paydown Planner codebase.

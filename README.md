# Fin Tracker — Local Cash Flow & Debt Runway Engine

Forward-looking, chronological running-balance ledger: payroll cutoffs (with absence math), side income, loan installments, and credit-card statement vs. due dates. Shows the wallet balance after every event so a mid-month shortfall is visible weeks ahead.

Local-first: Next.js (App Router) + `better-sqlite3`. No auth, no cloud.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

`finance.db` (WAL mode) is created at the project root and seeded with the Oct 17, 2026 state on first run.

| Script | Purpose |
| --- | --- |
| `npm test` | Ledger arithmetic tests (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build |

## Layout

```
lib/domain/   Pure business rules (no I/O) — shared by server and client
  calendar.ts     Timezone-free ISO date math (Asia/Manila "today")
  money.ts        Integer-centavo arithmetic, ₱ formatting (en-PH)
  payroll.ts      Net pay = gross − fixed deductions − absences × rate
  loans.ts        Installment schedule, remaining balance, payoff dates
  creditCard.ts   Statement day (₱0 info) vs. due day (cash out)
  ledger.ts       Running-balance engine (cycle month + 2 months)
  insights.ts     KPIs: safe daily spend, debt service, liberation, spend ceiling
lib/db.ts     SQLite schema, seed-on-empty, parameterized queries
lib/seed.ts   Oct 17, 2026 seed data
app/actions.ts  Server Actions (all mutations → revalidatePath('/'))
app/page.tsx    Dashboard (server component)
components/     KPI cards, panels, ledger (client components where interactive)
```

## Rules

- **Completed items** (`received_this_month` / `paid_this_month`) are listed as done and never re-applied to the starting wallet balance.
- **Overdue items**: an unpaid cycle-month item whose date has passed is rolled onto today and flagged.
- **Absences** deduct only when entered (> 0), in 0.5-day steps, per cutoff (current and next month).
- **Credit card**: the statement day is an info row; cash leaves on the next due day. The current bill is `statement_balance` (or the projected spend if higher and the statement hasn't cut yet). Later bills use *Next month projected spend*. Paying a statement zeroes it and remembers the amount for undo.
- **Received/Paid toggles** ask whether to move the wallet balance too, so a manually synced wallet is never double counted.
- **Start New Month Cycle** clears received/paid flags, keeps installment counts, and moves next-month absences into the current month.
- **Backup Database** writes an online copy to `./backups/`.

# ExpenseShare (Splitwise-style, Frontend-only)

A zero-build React app you can open directly in the browser. All state is stored in LocalStorage. Add groups, record expenses with flexible split logic, view simplified dues, and settle up.

## Quick Start
- Open `index.html` in your browser (Chrome recommended). No build tools required.
- Create a group, add members, then start adding expenses.

## Tech (pure stack)
- HTML + CSS + JavaScript
- React 18 (UMD via CDN, no Babel, no JSX)
- No Tailwind, no Chart.js
- LocalStorage persistence

## Key Features
- Group management (create, list, select)
- Expense modal with split types:
  - Split equally
  - Split by exact amounts (must sum to total)
  - Split by percentage (must sum to 100%)
  - Split by shares (auto-proportional)
- Debt simplification using min-cash-flow approach to minimize transactions
- Settle Up actions (records settlement as a payment expense)
- Group chart: Who paid the most (custom SVG pie, animated by browser rendering)
- Export group data to JSON
- Reset: per-group and global



## Notes
- Currency is displayed as INR via `toLocaleString('en-IN', { currency: 'INR' })`.
- Overall header shows total unsettled volume across groups (not user-specific).
- Settlements are stored as expenses of type `exact` with `description` like `Settlement: A -> B`.

## Files
- `index.html` — loads React UMD, `styles.css`, and `app.js`.
- `styles.css` — custom modern styling (no frameworks).
- `app.js` — React components using `React.createElement` (no JSX).

## Customization
- Change currency by editing `currency()` in `app.js`.
- Tweak theme colors via CSS variables in `styles.css`.


#### Yo
## Possible Enhancements
- Personalize balances per current user identity.
- Add categories for expenses and a category pie chart.
- Entrance animations for list insertions with CSS keyframes.

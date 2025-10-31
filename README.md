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

## Data Model (LocalStorage)
- Key: `expenseshare_v1`
- Shape:
```json
{
  "groups": [
    {
      "id": "string",
      "name": "Trip to Goa",
      "members": ["Alice", "Bob"],
      "expenses": [
        {
          "id": "string",
          "description": "Dinner",
          "amount": 100,
          "payer": "Alice",
          "splitType": "equal|exact|percent|shares",
          "splits": [{ "member": "Bob", "amount": 50 }],
          "createdAt": 1710000000000
        }
      ]
    }
  ]
}
```

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

## Theming & Appearance
- Light and Dark modes with persistence (`expenseshare_theme`).
- Optional pastel look on Group pages (light theme only) for an airy feel.
- Animated background blobs, aurora, floating coins, and confetti (toggleable).

## Navigation & UX
- Landing/Home page with CTAs: Enter Dashboard, Create First Group.
- Sticky header with navigation (Home, Dashboard, Settings).
- Zoom controls for the dashboard (scales the main container smoothly).
- Quick actions: Add Demo Data, Import JSON (hidden file input).
- Recent Activity and Leaderboard sections to fill empty space usefully.
- Global footer with brand and helpful links.

## Import/Export & Demo
- Export: per-group JSON from Group page.
- Import: Dashboard → Quick actions → Import JSON. Supports `{ group }` or `{ groups }`.
- Add Demo Data: instantly creates a sample group to try features.

## Persistence
- All data is stored in LocalStorage under key `expenseshare_v1`.
- The "seen landing" flag uses `expenseshare_seen_landing`.

## Accessibility & Performance
- High-contrast text and components across themes.
- Respects `prefers-reduced-motion` for ambient animations.
- React hooks + memoization for lists, stats, and computed views.

## Keyboard Tips
- In modals, Enter can add members; Esc closes.

## Possible Enhancements
- Personalize balances per current user identity.
- Categories for expenses and a category pie chart.
- Always-on landing option or onboarding guide.
- Filters: by member, date range, amount range on Dashboard.
- Keyboard shortcuts (e.g., N = New Group, A = Add Expense in group).

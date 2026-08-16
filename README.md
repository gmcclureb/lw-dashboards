# Little Wonders Dashboards

A lightweight operating dashboard for Little Wonders Learning Group, beginning with a CEO view across Orono Montessori School and Alpine Montessori.

## Live site

GitHub Pages is configured at `https://gmcclureb.github.io/lw-dashboards/`.

## V1 CEO Dashboard

- Little Wonders consolidated / Orono / Alpine scope switching
- Headline FTE enrollment, occupancy, net adds, lead conversion, collection rate, and staff leverage
- Enrollment and capacity trend with forecast
- School performance table with a recalculated consolidated Total column
- Admissions funnel and lead-source mix
- Billing / collections KPIs and trend
- Student-hours-per-staff-hour labor efficiency
- CEO attention / exception list
- Classroom capacity drill-down
- Responsive desktop and mobile layout

All current values are illustrative demo data.

## Playground integration posture

The UI is deliberately source-agnostic. `config.js` contains a configurable mapping layer for Playground concepts and `demo-data.js` supplies the current adapter data.

Planned read pulls include CRM leads/bookings, rosters, programs, classrooms, capacity/FTE enrollment, student attendance, staff attendance, charges, payments, discounts, and subsidies.

The production Playground connector should be **read-only** and should sit behind a small authenticated server-side proxy. Do not place a Playground API key in this public GitHub Pages frontend.

No Playground write methods are implemented in this repository.

## Files

- `index.html` — app shell and dashboard markup
- `styles.css` — visual system and responsive layout
- `config.js` — school, target, source, and future API mapping configuration
- `demo-data.js` — illustrative Orono and Alpine operating data
- `app.js` — consolidated calculations, interactions, charts, and drill-down behavior
- `.github/workflows/pages.yml` — GitHub Pages deployment workflow

# Apply the approved vibrant theme — release 2.2

This update implements the approved dashboard preview as responsive CSS and scalable icons. It does not use the generated preview image as a dashboard background, and does not replace real dashboard values with illustrative numbers.

## Included pages

Donor, recipient, hospital, and admin dashboards; public home; sign-in; registration; password reset; modals; tables; settings; evidence review; appointments; notifications; and admin tools.

## Apply to your existing v2.1 project

Back up your current frontend source. Copy these files from this ZIP into the same paths in your current project:

- `frontEnd/src/theme.css` (new shared theme)
- `frontEnd/src/components/ui/CareEmblem.jsx` (new decorative heart/shield effect)
- `frontEnd/src/components/ui/StatCard.jsx`
- `frontEnd/src/pages/PortalDashboard.css`
- `frontEnd/src/pages/PortalDashboard.jsx`
- `frontEnd/src/pages/HomePage.jsx`
- `frontEnd/src/index.jsx` (imports the shared theme after base styles)
- `frontEnd/index.html` (updates browser theme color)

For the extra browser checks, also copy `frontEnd/e2e/workflow.spec.js`.

Keep your existing backend `.env`, database, uploaded documents, and passwords. No database migration or new dependency is required for this visual update.

In a terminal inside `frontEnd`:

```bash
npm run dev
```

For a production frontend build:

```bash
npm run build
```

If Vite is already running, the source changes should refresh automatically. If old colors remain, restart Vite and hard-refresh the browser (Ctrl+Shift+R).

## Palette and implementation

| Use | Color |
| --- | --- |
| Sidebar | Navy `#0C2449` |
| Primary action | Cobalt `#2563EB` |
| Hero and active navigation | Cobalt-to-violet gradient |
| Violet accent | `#7C3AED` |
| Cyan glow | `#06B6D4` |
| Verified/completed | Emerald `#059669` |
| Attention | Orange `#EA580C` |
| Primary text | Navy `#111E46` |
| Canvas | Cool white-blue `#F2F7FF` |

`src/theme.css` owns the shared palette, component colors, and responsive refinements. The base layout remains in `PortalDashboard.css`. Hover effects are subtle, focus outlines stay visible, and reduced-motion preferences disable transitions.

## Verification on 25 October 2026

- 11 frontend unit tests passed.
- 6 Playwright browser tests passed, covering all four role workspaces, the complete multi-user care journey, and public home/sign-in/registration.
- Production frontend build passed.
- Desktop and mobile screens were visually inspected; browser checks verify no document-wide horizontal overflow at 390px.
- No backend behavior or external infrastructure was modified by this visual release. Existing deployment and clinical launch requirements still apply.

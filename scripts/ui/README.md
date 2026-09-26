# Browser suites

These drive a real browser against a running copy of the app. They exist because
a screenshot proves nothing on its own: each one measures something and fails
loudly when it regresses.

| Script | What it proves |
| --- | --- |
| `audit-screens.cjs` | No screen overflows, hides a control under 34px, drops below contrast, or throws. Four viewports, every route, all three roles. |
| `checkout-overlap.cjs` | The renew totals bar never covers the pay options, measured as pixel overlap on six screen sizes. |
| `navigation.cjs` | Tab switches add no history, Back returns where it came from, and every bottom-bar destination opens. |
| `alerts.cjs` | Seeds real alerts, then checks grouping, stacking, filtering, and that read state survives a reload. |
| `member-records.cjs` | Staff can correct a member record and it persists; a member can keep their own contact details but not their name. |

Accounts come from `.env.local` (`TEST_ADMIN`, `TEST_DESK`, `TEST_MEMBER`,
`TEST_PASSWORD`), never from the source.

```
npm i -D playwright && npx playwright install chromium
APP_URL=http://127.0.0.1:3000 node scripts/ui/audit-screens.cjs
```

Leave `APP_URL` off to run against production.

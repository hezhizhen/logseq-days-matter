# Days Matter — Logseq plugin

Show birthday / anniversary / countdown reminders **from page properties** in your
Logseq journal. Add a date property to a page and it surfaces automatically — no
`SCHEDULED` markers, no per-page setup.

> File-based (Markdown) graphs.

## What it does

- Reads configured **date page-properties** (default `birthday::`, `deathday::`).
- Computes the **next occurrence** (rolling yearly/monthly/weekly/every-N-days, or a one-off countdown) and the age / Nth anniversary / days-since.
- Auto-injects a **"📅 Days Matter" section at the bottom of the journal view**, listing entries inside each type's lead window.

## Usage

On any page (e.g. a person's page), add a property in the first block:

```
birthday:: 1990-01-01
```

Both forms work:

- ISO: `birthday:: 1990-01-01` (or `--01-01` when the year is unknown)
- Date page ref: `birthday:: [[1990-01-01 Monday]]` (parsed via your *preferred date format*)

That's it — open today's journal and the section appears when the date is within the lead window.

Optional: drop `{{renderer :days-matter}}` in any block to render the same list there.

## Configuration

Open **Settings → Plugins → Days Matter**. The panel has native controls for the
two built-in types — **Birthday** and **Death anniversary** — each with:

- **Enabled** (toggle)
- **Icon** (emoji)
- **Recurrence** — `yearly` / `monthly` / `weekly` / `none`
- **Lead days** — days before to start showing
- **Show** — `age` / `ordinal` / `daysUntil` / `daysSince` / `none`

### Adding more types

Under **Advanced — custom types**, add a JSON array of extra types:

```json
[
  { "property": "wedding", "label": "Wedding", "icon": "💍", "recurrence": "yearly", "leadDays": 7, "show": "ordinal" },
  { "property": "exam", "label": "Exam", "icon": "📝", "recurrence": "none", "leadDays": 30, "show": "daysUntil" }
]
```

Each entry: `property`, `label`, `icon`, `recurrence`
(`yearly` | `monthly` | `weekly` | `none` | `{"everyDays":N}`),
`leadDays` (number, or `null` = use `:scheduled/future-days`),
`show` (`age` | `ordinal` | `daysUntil` | `daysSince` | `none`).

The default lead window for `leadDays: null` is read from your graph's
`:scheduled/future-days` (default 7).

## Develop

```bash
npm install
npm test          # unit tests for the pure date logic
npm run build     # type-check + bundle to dist/
```

Load in Logseq: enable Developer mode → **Load unpacked plugin** → select this folder
(after `npm run build`, since `main` is `dist/index.html`).

## License

[MIT](./LICENSE) © 2026 Zhizhen He

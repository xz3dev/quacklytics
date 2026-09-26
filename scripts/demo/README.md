# Orbit development data

Orbit is a fictional team project-management product. The generator sends real HTTP batches through `/api/ingest`, exercising validation, SQLite persistence, schema inference and Parquet export. It never writes databases directly.

Start the local application with `bun run dev` and register your administrator in the browser first.

## Create a project and chart playground

Use your existing local administrator credentials. The password is read from an environment variable so it need not appear in command arguments:

```sh
read -s 'QUACKLYTICS_PASSWORD?Local admin password: '
export QUACKLYTICS_PASSWORD
bun run seed:dev --email you@example.com
unset QUACKLYTICS_PASSWORD
```

The `read` example uses zsh, the development workspace's shell. Alternatively set `QUACKLYTICS_PASSWORD` in your shell/environment before running the command.

This creates a **new Orbit demo project**, sends its events, creates six configured insights, and sets the **Chart playground** dashboard as its home. The project automatically loads all generated months into browser queries. The command prints the dashboard URL. It does not register or modify administrator accounts.

## Development dashboard template

While running `bun run dev`, open **Dashboards → Chart playground (dev)** to create a dashboard with all six chart types, including mixed line/bar trend series. Empty dashboards also offer **Apply chart playground (dev)**. These use the same Orbit recipes as this command, with a 365-day range (30 days for revenue).

Use the existing-project ingestion-key command below to populate its charts. Creating the template saves chart configurations; it does not generate events or replace your home dashboard. You can edit or delete it like any other dashboard. The template controls are omitted from production builds, and the server rejects template requests unless `NODE_ENV=development`. Already saved dashboards remain ordinary persisted dashboards.

Run template coverage against both environments with `bun run test:e2e tests/e2e/dashboard-templates.spec.ts` (after building) and `E2E_DEV=1 bun run test:e2e tests/e2e/dashboard-templates.spec.ts tests/e2e/seed-dev.spec.ts`.

## Send into an existing project

Create an ingestion key in that project's Settings:

```sh
QUACKLYTICS_API_KEY=your-local-key bun run seed:dev
```

This mode only sends events. All historical months are available to queries. Configure charts using the recipes below, then open or reload your project to query the latest data.

## Customize

```sh
bun run seed:dev --help
QUACKLYTICS_API_KEY=your-local-key bun run seed:dev --url http://127.0.0.1:3000 --users 300 --days 90 --seed 123
```

Defaults: **250 fictional users per chart family**, **365 complete UTC days ending yesterday**, random seed **42**. Bounds: 20–1000 users, 14–365 days. Use at least 60 days to compare this month's revenue with the prior month. Match `--url` to your application's configured origin. Only loopback origins are accepted.

The defaults generate roughly 130,000 events (about 350 per day), similar daily volume to the previous 200-user, 60-day defaults. Actual counts vary with the calendar and seed.

A fixed seed reproduces the activity distribution for the same date/users/days. IDs are fresh each run: repeated runs intentionally add separate datasets, rather than silently overwriting or deleting existing events. Every event has `demo_product: "Orbit"`, `demo_run` (printed by the command), and `chart_target`. Chart families use separate actor identities so navigation and funnel sequences remain independent. Within each family, users keep stable identities across days and sessions.

## Filterable profiles

Every event includes a stable user profile sampled with its own weighted distribution:

| Property                | Approximate share of users                                                     |
| ----------------------- | ------------------------------------------------------------------------------ |
| `plan`                  | starter 35%, team 50%, business 15%                                            |
| `country`               | Germany 32%, United States 27%, United Kingdom 18%, France 14%, Netherlands 9% |
| `source`                | organic 42%, direct 28%, referral 19%, paid_search 11%                         |
| `browser`               | Chrome 54%, Safari 32%, Firefox 8%, Edge 6%                                    |
| `os`                    | Windows 36%, macOS 26%, iOS 20%, Android 10%, Linux 8%                         |
| `device` / `deviceType` | desktop 70%, mobile 25%, tablet 5%                                             |
| `userAgent`             | Eight matching browser/OS/device combinations, with weights from 5% to 30%     |

These are fictional traffic targets. Sampling varies with `--seed` and user count; small runs may omit rare profiles. Event shares also reflect how active each user is. Browser, OS, device and user-agent values agree with one another and remain stable across a user's events. `deviceType` matches the tracker property name; `device` remains available for existing charts.

Try filtering `browser = Safari`, combining `country = Germany` with `plan = team`, or grouping a breakdown by `os` or `userAgent`. Scenario constants such as currency and trial length keep their existing meaning.

## Chart recipes

Set the date range to include the generated history (default last 365 days). Filter by the event names below; add a `demo_run` filter if you sent multiple datasets into one project.

Calendar ranges such as Last 30 days include complete UTC days ending yesterday. The value comparison uses the preceding, equally long period with no shared boundary events. Use Today or Last 24 hours to include live activity.

| Chart     | Events / configuration                                                                                                           | What to expect                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Trend     | Two series counting `demo.trend.workspace_opened` and `demo.trend.task_completed`, bucket Daily                                  | Growing adoption, quieter weekends, a short campaign bump, more completed tasks than visits                                            |
| Value     | `SUM(amount)` where event type is `demo.value.invoice_paid`, last 30 days                                                        | EUR subscription revenue at €9/€29/€79, monthly renewals, some churn and upgrades; previous-period comparison with 60+ days            |
| Breakdown | Count `demo.breakdown.feature_used`, group by property `feature`                                                                 | Board dominates; larger plans favor Reports and Automations. Also try `plan`, `country`, `device`, `source`                            |
| Funnel    | `demo.funnel.pricing_viewed` → `demo.funnel.trial_started` → `demo.funnel.teammate_invited` → `demo.funnel.subscription_started` | Sequential drop-off, roughly 100% → 76% → 49% → 31%, with timestamps ten minutes apart                                                 |
| Retention | Activation: `demo.retention.workspace_created`; return: `demo.retention.workspace_active`; daily cohorts; 14 periods             | Guaranteed activation-day activity, loyal teams, decaying casual usage and quieter weekends; recent cohorts have fewer elapsed periods |
| Path      | Anchor `demo.path.home`; step field `event_type`; forward, five steps                                                            | Branches through project_list → board → task_detail, reports → export, and settings → help; includes backtracking                      |

Percentages vary with the seed and sample size. All events occur in the past. The script sends timestamp-ordered batches of 1,000 using the tracker client's existing stable-payload retry behavior. Bulk batches defer new Parquet snapshots until the final batch; if ingestion stops, the delay expires 10 seconds after the last committed batch and the next catalog refresh or background export publishes the data. SQLite commits retain WAL and `synchronous=FULL` durability throughout. The command reports ingestion time and events per second. If a command is interrupted, committed batches remain; rerunning starts a new dataset. No cleanup is performed.

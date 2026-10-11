# Orbit development data

Orbit is a fictional team project-management product with a marketing website and a web app at `https://orbit.example`. The generator simulates its traffic as the Quacklytics SDKs would record it and sends it in the SDK's versioned wire format (`protocolVersion: 1`) through `/api/backfill`, exercising validation, identity linking, SQLite persistence, schema inference and Parquet export. It never writes databases directly.

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

This creates a **new Orbit demo project**, sends its events, creates six configured insights, and sets the **Chart playground** dashboard as its home. The project's default **Web Analytics Overview** dashboard fills from the same data. The project automatically loads all generated months into browser queries. The command prints the dashboard URL. It does not register or modify administrator accounts.

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

Defaults: **250 users who sign up**, plus ten times as many website visitors who never do, over **365 complete UTC days ending yesterday**, random seed **42**. Bounds: 20–1000 users, 14–365 days. Use at least 60 days to compare this month's revenue with the prior month. Match `--url` to your application's configured origin. Only loopback origins are accepted.

The defaults generate roughly 140,000 events (about 380 per day), growing over the year. Actual counts vary with the calendar and seed.

A fixed seed reproduces the activity distribution for the same date/users/days. IDs are fresh each run: repeated runs intentionally add separate datasets, rather than silently overwriting or deleting existing events. Like real SDK traffic, events carry no demo-specific markers; use `--email` to keep a dataset in its own project.

## What the SDK would send

The site is instrumented like the documentation recommends: `autocapture: true` and `allowedQueryParameters: ["utm_source", "utm_medium", "utm_campaign"]`. Every browser event has the SDK's `$context` (`sdk`, `page` with `url`, `path`, `title`, `referrer`, `pageViewId` and, for in-app navigation, `previousUrl`; `browser`, `os`, `deviceType`, `language`, `timezone`, `viewport`) and the `$country` that ingestion derives from the visitor's address.

- **Visitors** arrive from search (Google, Bing, DuckDuckGo), direct traffic, referrals (Hacker News, Product Hunt, Reddit, GitHub, G2), social networks, a Google Ads campaign and a newsletter (the latter two with UTM parameters), landing on the home page, pricing, features, blog posts or docs. Most bounce or browse a few pages; some return on later days. Each browser keeps one `anonymousId` and starts a new `sessionId` per visit.
- **Sign-ups** research the site, view pricing, then sign up. `identify(userId, traits)` links their earlier anonymous browsing (traits: `name`, `email`, `plan`, `company_size`, `signup_method`); from then on the browser's events carry `userId`. Some later log in on a phone, which identifies a second browser as the same user.
- **The app** (`/app`, a single-page application) is loaded directly, from email notifications or Slack links. Users open project boards and tasks, and record custom events. Engaged teams keep returning; casual users fade, and unconverted trials stop after 14 days.
- **Billing** events come from Orbit's server: `invoice_paid` and failed-renewal `subscription_cancelled` carry `userId` and a context with only `sdk` — no page, session or country.
- **Clicks** (`$click`) record `tagName`, `attributes` (`role`, `type`, `data-ql-id`) and, for links, `href`. The home page's sign-up button uses `data-ql-event`, so its click is named `signup_cta_clicked`.

| Custom event             | Properties                                                     |
| ------------------------ | -------------------------------------------------------------- |
| `pricing_plan_selected`  | `plan`, `billing_cycle`                                        |
| `newsletter_subscribed`  | `location`                                                     |
| `signed_up`              | `method` (email, google, github)                               |
| `workspace_created`      | `template`                                                     |
| `teammate_invited`       | `role`, `invites`, `location`                                  |
| `task_created`           | `source`, `task_kind`                                          |
| `task_completed`         | `task_kind`, `via`                                             |
| `comment_added`          | `mentions`                                                     |
| `search_performed`       | `results`                                                      |
| `feature_used`           | `feature`, `plan`                                              |
| `report_exported`        | `format`                                                       |
| `automation_created`     | `trigger`                                                      |
| `subscription_started`   | `plan`, `billing_cycle`, `amount`, `currency` (EUR)            |
| `invoice_paid` (server)  | `amount`, `currency`, `plan`, `billing_cycle`, `upgraded_from` |
| `subscription_cancelled` | `plan`, `reason`                                               |

Prices are €9/€29/€79 per month for starter/team/business, or ten months' price per year. Visitors come from 15 countries, led by Germany and the United States, with matching languages, timezones and local activity hours. Browsers, operating systems, devices and viewports agree with each browser's user agent and stay stable per browser. Declined consent (`anonymous: true`) is not simulated: the server derives those visitors from the importer's own address.

## Chart recipes

Set the date range to include the generated history (default last 365 days). Property paths into the context use JSON paths, e.g. `$."$context".page.path` or `$."$context".browser`.

Calendar ranges such as Last 30 days include complete UTC days ending yesterday. The value comparison uses the preceding, equally long period with no shared boundary events. Use Today or Last 24 hours to include live activity.

| Chart     | Events / configuration                                                                                                           | What to expect                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Trend     | Count `$pageview` (line) and `task_completed` (bar), bucket Daily                                                                | Growing traffic, quieter weekends, a short paid campaign bump                                                   |
| Value     | `SUM(amount)` where event type is `invoice_paid`, last 30 days                                                                   | EUR subscription revenue with renewals, churn and upgrades; previous-period comparison with 60+ days            |
| Breakdown | Count `feature_used`, group by property `feature`                                                                                | Board dominates; larger plans use Reports and Automations more. Also try `plan`                                 |
| Funnel    | `$pageview` with `$."$context".page.path` = `/pricing` → `signed_up` → `teammate_invited` → `subscription_started`, unique users | Most pricing visitors never sign up; engaged teams invite colleagues and subscribe                              |
| Retention | Activation `workspace_created`; return `$pageview` with page path `LIKE /app%`; daily cohorts; 14 periods                        | Loyal teams keep returning, casual users decay, expired trials drop out after two weeks                         |
| Path      | Anchor `$pageview` on `/`; step field `$."$context".page.path`; forward, five steps                                              | Visitors move to pricing, features, blog posts and sign-up. Clicks share their page's path, so pages can repeat |

The default Web Analytics Overview dashboard shows visitors, pageviews, sessions, countries, top pages, referrers, custom events, devices, browsers and operating systems from the same events.

Percentages vary with the seed and sample size. All events occur in the past. The script sends timestamp-ordered SDK batches of 1,000 operations, retrying with the same request ID like the SDK does. Each `identify` is sent no later than the events it attributes. SQLite commits retain WAL and `synchronous=FULL` durability throughout. The command reports ingestion time and operations per second. If a command is interrupted, committed batches remain; rerunning starts a new dataset. No cleanup is performed.

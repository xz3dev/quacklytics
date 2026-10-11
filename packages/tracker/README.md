# @quacklytics/client

First-party TypeScript analytics for Quacklytics.

```ts
import { createClient } from '@quacklytics/client'

const analytics = createClient({
  hostname: 'https://analytics.example.com',
  apiKey: 'public-project-ingestion-key',
  autocapture: true,
})

// Start from your consent UI. Before a decision, events are buffered locally.
analytics.setConsent('granted')
await analytics.track('signup', { plan: 'pro' })
await analytics.identify('account-123', { plan: 'pro' })
await analytics.flush()

// On logout, before tracking activity for a new account:
analytics.reset()
```

Add the exact site origin to the project's allowed origins. Browser ingestion keys are public, ingestion-only credentials; never use an administrative credential. Always specify a full HTTPS service URL in production. Bare hostnames default to HTTPS.

## Events and autocapture

`$pageview` is collected after permission, on initial load and on pushState, replaceState, back/forward, and Astro page-load navigation. Query strings and fragments are removed by default; changing only a removed parameter is not a new pageview. Set `allowedQueryParameters: ['utm_source', 'utm_campaign']` to retain approved campaign fields. Referrers and captured link URLs always omit query/fragment and URL credentials. Paths and titles may themselves contain private information; redact them with `beforeSend` as appropriate.

`page(properties?)` is the manual router adapter. For TanStack Router, call it from an `onResolved` subscription and set `autoTrackPageviews: false`. Subscribe once and unsubscribe when disposing the integration. Repeated calls for the same sanitized URL are deduplicated. `pageViewId` associates subsequent events with the current page. Automatic collectors install once; a second client for the same service/key throws rather than double-counting.

`autocapture: true` collects `$click` from links, buttons, role=button/link, and elements with `data-ql-event`. It records tagName, sanitized link URL, and only role/type/data-ql-id attributes. It never reads text, input values, arbitrary data attributes, element IDs, or CSS classes.

```html
<button data-ql-event="trial_started" data-ql-id="hero-trial">Start trial</button>
<div data-ql-ignore><button>Private action</button></div>
```

Use `data-ql-ignore` on an element or ancestor to exclude the subtree. Consent-banner clicks are excluded. Custom names cannot start with `$`; `$pageview` and `$click` are reserved built-ins with validated payloads. `enableClickAutotracking({ client, selectors })` is available for manually installed collection, returning `stop()`; do not also enable built-in autocapture.

## Identity and consent

The SDK maintains an anonymous visitor UUID and a session UUID, rotating the latter after 30 minutes of inactivity. Identity and consent use localStorage scoped by service endpoint and project key and synchronize across tabs. Storage failures fall back to in-memory identity. `sessionTimeoutMs` changes the inactivity window.

`identify(userId, traits?)` durably links the current anonymous visitor's history across sessions to the application user, then sets that user on subsequent events. It is a control operation, excluded from event counts. Multiple visitors/devices can identify as the same user. A visitor cannot change users without `reset()`. Reset creates a new anonymous/session identity on the next event; already queued events retain their original capture identity. Person traits merge per key using timestamp/event ID ordering.

The service resolves SDK actors as `anonymous:<id>` and `user:<id>` in its existing person_id analytical column. Legacy first-party person IDs remain unchanged. Identity changes republish affected historical Parquet partitions that are not yet archived; a committed identification can therefore precede updated browser reports. Archived months (seven days after a month ends) keep their original attribution.

Default consent is `required`. Three modes follow from the visitor's decision:

- **Undecided:** nothing is sent. Captures (including `identify`) are buffered in localStorage, survive reloads, and return `{ status: 'buffered' }`. The buffer is bounded by `maxQueueSize`, `maxQueueBytes` and `maxQueueAgeMs`.
- **Granted:** buffered captures are released with the persistent visitor/session identity, in order, so pre-consent activity and any buffered `identify` are attributed normally. Collection continues with full identity.
- **Denied:** buffered events are released anonymously and collection continues in anonymous mode. Events are sent with `anonymous: true` and no identifiers; nothing about the visitor is stored. The service derives a `daily:<hash>` visitor from HMAC-SHA-256 over the project, client IP and user agent, keyed with a random salt per UTC day. Salts older than yesterday are deleted the next time a declined visitor's event is processed, after which an ID can no longer be linked back to anyone. These visitors appear as `anonymous:daily:<hash>` in SQL. A visit continues one session until 30 minutes of inactivity, including across midnight. `identify`/`reset` are disabled and buffered `identify` calls are discarded. Visitors behind the same IP with the same browser are counted as one.

`setConsent('denied')` after granting clears the visitor identity and pending outbox, cancels delivery, persists the choice and switches to anonymous mode. Already sent data cannot be recalled. Each identity change records the current page once. `consent: 'granted'` explicitly opts into immediate collection, but a persisted denial still takes precedence.

Optional UI:

```ts
import { createCookieConsent } from '@quacklytics/client/consent'
const banner = createCookieConsent({ client: analytics })
banner.showBanner()
```

The banner is presentation only; the client always enforces collection state. It follows the page's CSS `color-scheme` (falling back to the visitor's OS preference), so it switches to dark mode with your site. Pass `css` in the banner options to restyle it; scope selectors with `[data-quacklytics-cookie-banner]` and target `.ql-banner`, `.ql-text`, `.ql-actions`, `.ql-primary` or `.ql-secondary`. `/consent` imports Preact; the core and server entrypoints do not. Custom `textHtml` must be trusted application-authored markup.

## Delivery and lifecycle

- `track`/`page` resolve to `{status: 'queued', id}`, `disabled`, or `dropped`. Queued means accepted locally, not committed. `beforeSend(event)` may redact or return null; identity, timestamp and ID are immutable. Invalid payloads/overflow reject the promise.
- `identify` waits for the flush containing the control operation. `flush()` resolves only after every batch it drains receives a validated commit acknowledgment. Failures reject; uncertain/transient deliveries remain queued.
- Automatic browser batching flushes every 5 seconds, at 20 pending operations, and on hidden/pagehide. Envelopes remain below 55 KB for keepalive delivery. Lifecycle delivery is best-effort; a browser can terminate without sending.
- Network failures, timeouts, 429, and 5xx are attempted up to 3 times per flush (`maxAttempts`) with exponential jitter and Retry-After (capped at 60 seconds); batches that still fail stay queued for the next flush. Other HTTP errors drop the rejected batch and reject flush without retry. Request timeout defaults to 10 seconds. Exact request/event IDs and serialized bodies survive retries and reloads.
- The bounded outbox uses **per-tab sessionStorage**: survives reloads and temporary outages, not closing the tab. Tabs do not overwrite each other's outboxes. Storage failures leave a memory-only queue. Defaults: 1,000 operations, 1 MB serialized queue, 48 KB per operation, 24-hour retention. Expiry reports through onError; overflow rejects rather than silently evicting older data. `maxQueueSize`, `maxQueueBytes`, `maxEventBytes`, `maxQueueAgeMs`, `batchSize`, `flushIntervalMs`, `maxAttempts`, `retryDelayMs`, and `requestTimeoutMs` configure these bounds.
- `destroy()` removes collectors/timers and cancels in-flight delivery; it retains the outbox for a future permitted client. Call `await flush()` before `destroy()` when a committed shutdown is required.
- Automatic failures call `onError`; application-triggered track/flush/identify failures reject their promises.

Typed application events:

```ts
interface Events {
  signup: { plan: string }
  purchase: { amount: number; currency: string }
}
const client = createClient<Events>({ hostname, apiKey })
await client.track('purchase', { amount: 42, currency: 'EUR' })
```

## Server and existing first-party callers

```ts
import { createServerClient } from '@quacklytics/client/server'
const client = createServerClient({ hostname, apiKey })
await client.track('invoice_paid', { amount: 42 }, { userId: 'account-123' })
await client.flush()
await client.destroy()
```

Server `send`/`sendBatch` preserve the existing first-party importer protocol, including `deferExport`, `backfill` (for archived months) and AbortSignal. They acknowledge committed batches and never collect browser context or create identities. Use `personId: 'user:account-123'` when intentionally joining a server event to the SDK's resolved user actor. `track()` uses the versioned queue and requires an explicit `flush()` in server runtimes. Browser `send`/`sendBatch` are convenience capture-and-flush methods and may split into multiple transactions; a later invalid event can leave earlier events queued. Explicit browser identity fields, `personProperties`, AbortSignal, `deferExport` and `backfill` are rejected: use identify/reset for browser identity and the server importer for explicit batches. The legacy cookie-wrapper API has been replaced; rejection now means no collection.

The `/protocol` entrypoint exports Zod schemas and inferred types for versioned events and identify operations. Keep protocol changes backward compatible or introduce a new version.


## Upgrading from 0.1

This is a breaking browser API release. Replace the old consent wrapper with `createClient` plus `setConsent` (or the presentation-only banner). Identity no longer uses the old `ql_person_id`/`ql_session_id` cookies; remove those legacy cookies in your application if you previously deployed them, including any configured parent-domain copies. Old consent does not silently authorize the new collector. Replace `includeText`/DOM-path capture with explicit `data-ql-id` and `data-ql-event` instrumentation. Page context now lives under `$context`; use the Website traffic template for new SDK reports. Existing generic dashboards, stored legacy events, and the first-party server importer remain supported. The public client is version 0.2.0; its new wire protocol is version 1.

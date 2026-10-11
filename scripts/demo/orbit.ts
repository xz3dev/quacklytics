import { randomUUID } from "node:crypto";
import {
  SDK_VERSION,
  sdkOperation,
  type EventProperties,
  type SdkOperation,
} from "../../packages/tracker/src/protocol";
import {
  describeUserAgent,
  sanitizeUrl,
} from "../../packages/tracker/src/context";
import { orbitEvents } from "../../packages/contracts/src/orbit";
export { orbitInsights } from "../../packages/contracts/src/orbit";

const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;
const day = 24 * hour;
const origin = "https://orbit.example";
// The site keeps campaign parameters, as the SDK documentation recommends.
const allowedQueryParameters = ["utm_source", "utm_medium", "utm_campaign"];
/** Website visitors who never sign up, per user who does. */
export const visitorsPerSignup = 10;
const sdk = { name: "@quacklytics/client", version: SDK_VERSION } as const;

type Random = () => number;
// A reproducible random stream gives coherent distributions without a new dependency.
function randomStream(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function pick<T>(values: readonly T[], random: Random): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) throw new Error("Cannot choose from an empty list");
  return value;
}
// Relative weights describe fictional traffic, not real-world market shares.
function weighted<T>(
  choices: readonly (readonly [T, number])[],
  random: Random,
): T {
  let remaining =
    random() * choices.reduce((total, [, weight]) => total + weight, 0);
  for (const [value, weight] of choices) {
    remaining -= weight;
    if (remaining < 0) return value;
  }
  throw new Error("Cannot choose from an empty distribution");
}
const between = (min: number, max: number, random: Random) =>
  min + Math.floor(random() * (max - min + 1));

const userAgents = [
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    30,
  ],
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    14,
  ],
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    12,
  ],
  ["Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0", 5],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
    3,
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    6,
  ],
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    15,
  ],
  [
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    10,
  ],
  [
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    5,
  ],
] as const;
const viewports: Record<
  "desktop" | "mobile" | "tablet",
  readonly (readonly [number, number])[]
> = {
  desktop: [
    [1920, 969],
    [1536, 730],
    [1440, 789],
    [1366, 657],
    [2560, 1305],
  ],
  mobile: [
    [390, 664],
    [393, 727],
    [412, 773],
    [430, 739],
  ],
  tablet: [
    [820, 1106],
    [1024, 1292],
  ],
};
// Language and timezone follow the visitor's country; `$country` is what
// ingestion derives from the visitor's address.
const countries: readonly (readonly [
  country: string,
  weight: number,
  language: string,
  zones: readonly (readonly [timezone: string, utcOffset: number])[],
])[] = [
  ["DE", 24, "de-DE", [["Europe/Berlin", 1]]],
  [
    "US",
    22,
    "en-US",
    [
      ["America/New_York", -5],
      ["America/Chicago", -6],
      ["America/Los_Angeles", -8],
    ],
  ],
  ["GB", 12, "en-GB", [["Europe/London", 0]]],
  ["FR", 8, "fr-FR", [["Europe/Paris", 1]]],
  ["NL", 6, "nl-NL", [["Europe/Amsterdam", 1]]],
  ["CA", 4, "en-CA", [["America/Toronto", -5]]],
  ["IN", 4, "en-IN", [["Asia/Kolkata", 5.5]]],
  ["AT", 3, "de-AT", [["Europe/Vienna", 1]]],
  ["CH", 3, "de-CH", [["Europe/Zurich", 1]]],
  ["ES", 3, "es-ES", [["Europe/Madrid", 1]]],
  ["SE", 3, "sv-SE", [["Europe/Stockholm", 1]]],
  ["PL", 3, "pl-PL", [["Europe/Warsaw", 1]]],
  ["BR", 2, "pt-BR", [["America/Sao_Paulo", -3]]],
  ["AU", 2, "en-AU", [["Australia/Sydney", 10]]],
  ["JP", 1, "ja-JP", [["Asia/Tokyo", 9]]],
];

type Page = { path: string; title: string };
const marketing = {
  home: { path: "/", title: "Orbit — Project management for focused teams" },
  features: { path: "/features", title: "Features · Orbit" },
  pricing: { path: "/pricing", title: "Pricing · Orbit" },
  blog: { path: "/blog", title: "Blog · Orbit" },
  docs: { path: "/docs", title: "Documentation · Orbit" },
  changelog: { path: "/changelog", title: "Changelog · Orbit" },
  signup: { path: "/signup", title: "Create your account · Orbit" },
  login: { path: "/login", title: "Log in · Orbit" },
} satisfies Record<string, Page>;
const blogPosts: Page[] = [
  [
    "planning-sprints-without-overhead",
    "Planning sprints without the overhead",
  ],
  ["kanban-vs-scrum", "Kanban vs. Scrum: choosing for your team"],
  ["async-standups", "Async standups people actually read"],
  ["orbit-2-0", "Introducing Orbit 2.0"],
  ["estimating-work", "Why your estimates are always wrong"],
].map(([slug, title]) => ({
  path: `/blog/${slug}`,
  title: `${title} · Orbit Blog`,
}));
const docPages: Page[] = [
  ["getting-started", "Getting started"],
  ["boards", "Boards"],
  ["automations", "Automations"],
  ["integrations", "Integrations"],
  ["api", "API reference"],
].map(([slug, title]) => ({
  path: `/docs/${slug}`,
  title: `${title} · Orbit Docs`,
}));
const projects = [
  ["website-redesign", "Website redesign"],
  ["mobile-app", "Mobile app"],
  ["q3-roadmap", "Q3 roadmap"],
  ["customer-onboarding", "Customer onboarding"],
  ["marketing-launch", "Marketing launch"],
  ["platform-migration", "Platform migration"],
] as const;
const app = {
  home: { path: "/app", title: "Home · Orbit" },
  onboarding: { path: "/app/onboarding", title: "Welcome to Orbit" },
  projects: { path: "/app/projects", title: "Projects · Orbit" },
  reports: { path: "/app/reports", title: "Reports · Orbit" },
  automations: { path: "/app/automations", title: "Automations · Orbit" },
  members: {
    path: "/app/settings/members",
    title: "Members · Settings · Orbit",
  },
  billing: {
    path: "/app/settings/billing",
    title: "Billing · Settings · Orbit",
  },
} satisfies Record<string, Page>;
const board = ([slug, name]: (typeof projects)[number]): Page => ({
  path: `/app/projects/${slug}/board`,
  title: `${name} · Board · Orbit`,
});
const task = ([slug, name]: (typeof projects)[number], key: number): Page => ({
  path: `/app/projects/${slug}/tasks/${key}`,
  title: `ORB-${key} · ${name} · Orbit`,
});

type Source = {
  name: string;
  referrer: () => string;
  landing: () => Page;
  query?: (campaign: boolean) => string;
};
function sources(random: Random): Source[] {
  const blogOrDocs = () =>
    random() < 0.7 ? pick(blogPosts, random) : pick(docPages, random);
  return [
    {
      name: "organic",
      referrer: () =>
        weighted(
          [
            ["https://www.google.com/", 80],
            ["https://www.bing.com/", 12],
            ["https://duckduckgo.com/", 8],
          ],
          random,
        ),
      landing: () =>
        weighted<() => Page>(
          [
            [() => marketing.home, 30],
            [blogOrDocs, 55],
            [() => marketing.features, 10],
            [() => marketing.pricing, 5],
          ],
          random,
        )(),
    },
    {
      name: "direct",
      referrer: () => "",
      landing: () =>
        weighted(
          [
            [marketing.home, 75],
            [marketing.pricing, 15],
            [marketing.features, 10],
          ],
          random,
        ),
    },
    {
      name: "referral",
      referrer: () =>
        weighted(
          [
            ["https://news.ycombinator.com/", 35],
            ["https://www.producthunt.com/", 25],
            ["https://www.reddit.com/", 20],
            ["https://github.com/", 12],
            ["https://www.g2.com/", 8],
          ],
          random,
        ),
      landing: () => (random() < 0.55 ? marketing.home : blogOrDocs()),
    },
    {
      name: "social",
      referrer: () =>
        weighted(
          [
            ["https://www.linkedin.com/", 50],
            ["https://t.co/", 35],
            ["https://www.youtube.com/", 15],
          ],
          random,
        ),
      landing: () =>
        random() < 0.6 ? pick(blogPosts, random) : marketing.home,
    },
    {
      name: "paid",
      // Search engines send only their origin as the referrer.
      referrer: () => "https://www.google.com/",
      landing: () =>
        weighted(
          [
            [marketing.pricing, 40],
            [marketing.home, 40],
            [marketing.features, 20],
          ],
          random,
        ),
      query: (campaign) =>
        `utm_source=google&utm_medium=cpc&utm_campaign=${campaign ? "launch_week" : "project_management"}`,
    },
    {
      name: "newsletter",
      referrer: () => "",
      landing: () =>
        random() < 0.5 ? marketing.changelog : (blogPosts[3] ?? marketing.blog),
      query: () =>
        "utm_source=newsletter&utm_medium=email&utm_campaign=orbit_2_0",
    },
  ];
}
const sourceWeights: Record<string, number> = {
  organic: 38,
  direct: 24,
  referral: 14,
  social: 9,
  paid: 10,
  newsletter: 5,
};

type Device = {
  anonymousId: string;
  userAgent: string;
  viewport: { width: number; height: number };
  /** Set once the visitor identifies; the SDK keeps it until reset(). */
  userId?: string;
};
type Visitor = {
  country: string;
  language: string;
  timezone: string;
  offsetHours: number;
};
type Plan = "starter" | "team" | "business";
const monthlyPrice: Record<Plan, number> = {
  starter: 9,
  team: 29,
  business: 79,
};
const firstNames = [
  "Ada",
  "Ben",
  "Chloé",
  "Daniel",
  "Elif",
  "Finn",
  "Grace",
  "Hiro",
  "Ines",
  "Jonas",
  "Kira",
  "Lena",
  "Mateo",
  "Noor",
  "Oskar",
  "Priya",
  "Rosa",
  "Sam",
  "Tariq",
  "Uma",
  "Vera",
  "Wen",
  "Yusuf",
  "Zoe",
];
const lastNames = [
  "Andersen",
  "Becker",
  "Costa",
  "Dubois",
  "Eriksson",
  "Fischer",
  "García",
  "Hughes",
  "Ivanova",
  "Jansen",
  "Kowalski",
  "Lopez",
  "Meyer",
  "Nakamura",
  "Okafor",
  "Patel",
  "Rossi",
  "Schmidt",
  "Tanaka",
  "Weber",
];

/**
 * Simulates Orbit's website and web app as the browser SDK observes them, with
 * `autocapture: true`, plus billing events sent by Orbit's server SDK.
 * Operations use the SDK's versioned wire format, so ingestion stores them
 * exactly as it would store real SDK traffic: `$context`, anonymous visitors,
 * identify links, sessions and pageview ids included.
 */
export function generateOrbit({
  users,
  days,
  seed,
  runId,
  now = new Date(),
}: {
  users: number;
  days: number;
  seed: number;
  runId: string;
  now?: Date;
}) {
  const random = randomStream(seed);
  // Profiles do not consume the activity random stream.
  const profileRandom = randomStream(seed ^ 0x9e3779b9);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const beginning = today - days * day;
  const operations: SdkOperation[] = [];
  const trafficSources = sources(random);
  const campaign = (time: number) =>
    time >= today - 14 * day && time < today - 10 * day;

  function newVisitor(): Visitor {
    const [country, , language, zones] = weighted(
      countries.map((entry) => [entry, entry[1]] as const),
      profileRandom,
    );
    const [timezone, offsetHours] = pick(zones, profileRandom);
    return { country, language, timezone, offsetHours };
  }
  function newDevice(mobile?: boolean): Device {
    const userAgent = weighted(
      userAgents.filter(
        ([agent]) =>
          mobile === undefined ||
          (describeUserAgent(agent).deviceType !== "desktop") === mobile,
      ),
      profileRandom,
    );
    const [width, height] = pick(
      viewports[describeUserAgent(userAgent).deviceType],
      profileRandom,
    );
    return {
      anonymousId: randomUUID(),
      userAgent,
      viewport: { width, height },
    };
  }
  /** A day in the range, favoring recent weekdays and a short paid campaign. */
  function arrivalDay(first: number, last = days - 1) {
    for (;;) {
      const offset = between(first, last, random);
      const time = beginning + offset * day;
      const weekday = new Date(time).getUTCDay();
      const weight =
        (0.45 + (0.55 * offset) / days) *
        (weekday === 0 || weekday === 6 ? 0.6 : 1) *
        (campaign(time) ? 1.6 : 1);
      if (random() < weight / 1.6) return offset;
    }
  }
  /** UTC time for a local hour on a day of the range. */
  function localTime(visitor: Visitor, offset: number, localHour: number) {
    return (
      beginning +
      offset * day +
      (localHour - visitor.offsetHours) * hour +
      Math.floor(random() * hour)
    );
  }
  function push(operation: SdkOperation) {
    operations.push(sdkOperation.parse(operation));
  }
  function serverEvent(
    userId: string,
    time: number,
    eventType: string,
    properties: EventProperties,
  ) {
    // Server runtimes attach only the SDK to the context; ingestion adds no country.
    push({
      kind: "event",
      id: randomUUID(),
      timestamp: new Date(time).toISOString(),
      eventType,
      userId,
      properties,
      context: { sdk },
    });
  }

  /**
   * One visit: the SDK's 30-minute session on a device. Each full page load
   * starts a fresh SDK instance, so `previousUrl` restarts and `referrer` is
   * the page the browser came from; in-app navigation keeps both.
   */
  function visit(visitor: Visitor, device: Device, start: number) {
    let time = start;
    const sessionId = randomUUID();
    let referrer = "";
    let page: Page | undefined;
    let url = "";
    let pageViewId: string | undefined;
    let previousUrl: string | undefined;
    const pageContext = () =>
      page && {
        url,
        path: page.path,
        title: page.title,
        referrer,
        ...(pageViewId ? { pageViewId } : {}),
      };
    function event(eventType: string, properties: EventProperties = {}) {
      time += between(200, 1500, random);
      const current = pageContext();
      push({
        kind: "event",
        id: randomUUID(),
        timestamp: new Date(time).toISOString(),
        eventType,
        anonymousId: device.anonymousId,
        sessionId,
        ...(device.userId ? { userId: device.userId } : {}),
        // Browser events gain the visitor's country at ingestion.
        properties: { ...properties, $country: visitor.country },
        context: {
          sdk,
          ...(current ? { page: current } : {}),
          ...describeUserAgent(device.userAgent),
          language: visitor.language,
          timezone: visitor.timezone,
          viewport: device.viewport,
        },
      });
    }
    function pageview(next: Page, query = "") {
      const nextUrl = sanitizeUrl(
        `${origin}${next.path}${query ? `?${query}` : ""}`,
        allowedQueryParameters,
      );
      // The SDK ignores navigation that keeps the same sanitized URL.
      if (nextUrl === url) return;
      time += between(150, 900, random);
      const previous = url;
      page = next;
      url = nextUrl;
      pageViewId = randomUUID();
      previousUrl = previous || undefined;
      const current = pageContext();
      if (!current) throw new Error("Pageviews require a page");
      push({
        kind: "event",
        id: randomUUID(),
        timestamp: new Date(time).toISOString(),
        eventType: "$pageview",
        anonymousId: device.anonymousId,
        sessionId,
        ...(device.userId ? { userId: device.userId } : {}),
        properties: { $country: visitor.country },
        context: {
          sdk,
          page: { ...current, ...(previousUrl ? { previousUrl } : {}) },
          ...describeUserAgent(device.userAgent),
          language: visitor.language,
          timezone: visitor.timezone,
          viewport: device.viewport,
        },
      });
    }
    const session = {
      get time() {
        return time;
      },
      get path() {
        return page?.path;
      },
      /** Time spent reading or working on the current page. */
      dwell(min = 8, max = 150) {
        time += between(min, max, random) * second;
      },
      /** A full page load, e.g. opening a link or redirecting between apps. */
      load(next: Page, from: string, query = "") {
        referrer = sanitizeUrl(from);
        url = "";
        pageViewId = undefined;
        pageview(next, query);
      },
      /**
       * Client-side navigation; autocapture records the link that was clicked,
       * named by its `data-ql-event` attribute if it has one.
       */
      go(next: Page, attributes: EventProperties = {}, eventType = "$click") {
        if (eventType !== "$click" || random() < 0.9)
          event(eventType, {
            tagName: "a",
            attributes,
            href: sanitizeUrl(`${origin}${next.path}`),
          });
        pageview(next);
      },
      /** Back/forward navigation fires a pageview without a click. */
      back(next: Page) {
        pageview(next);
      },
      click(
        tagName: string,
        attributes: EventProperties = {},
        eventType = "$click",
      ) {
        event(eventType, { tagName, attributes });
      },
      track: event,
      identify(userId: string, traits: EventProperties) {
        time += between(100, 600, random);
        // The SDK attaches the user once the identify acknowledgment returns.
        push({
          kind: "identify",
          id: randomUUID(),
          timestamp: new Date(time).toISOString(),
          anonymousId: device.anonymousId,
          userId,
          traits,
        });
        device.userId = userId;
        time += between(100, 400, random);
      },
      url: () => url,
    };
    return session;
  }
  type Session = ReturnType<typeof visit>;

  /** Marketing-site browsing; returns whether the visitor reached pricing. */
  function browse(session: Session, pages: number) {
    for (let index = 0; index < pages; index++) {
      session.dwell(10, 120);
      const from = session.path;
      const next = weighted<Page>(
        [
          [marketing.pricing, from === marketing.pricing.path ? 0 : 30],
          [marketing.features, 18],
          [marketing.home, from === "/" ? 0 : 10],
          [marketing.blog, 8],
          [pick(blogPosts, random), 12],
          [marketing.docs, 5],
          [pick(docPages, random), 8],
          [marketing.changelog, 4],
        ],
        random,
      );
      if (random() < 0.15 && from !== "/") session.back(next);
      else
        session.go(
          next,
          next === marketing.pricing ? { "data-ql-id": "nav-pricing" } : {},
        );
      if (next === marketing.blog && random() < 0.08) {
        session.dwell();
        session.track("newsletter_subscribed", { location: "blog" });
      }
    }
  }
  function landing(visitor: Visitor, device: Device, time: number) {
    const source = weighted(
      trafficSources.map(
        (entry) =>
          [
            entry,
            (sourceWeights[entry.name] ?? 0) *
              (entry.name === "paid" && campaign(time) ? 4 : 1),
          ] as const,
      ),
      random,
    );
    const session = visit(visitor, device, time);
    session.load(
      source.landing(),
      source.referrer(),
      source.query?.(campaign(time)) ?? "",
    );
    return session;
  }

  // Visitors who browse the marketing site and never sign up.
  for (let index = 0; index < users * visitorsPerSignup; index++) {
    const visitor = newVisitor();
    const device = newDevice();
    let offset = arrivalDay(0);
    const visits = weighted(
      [
        [1, 70],
        [2, 20],
        [3, 10],
      ],
      random,
    );
    for (let count = 0; count < visits && offset < days; count++) {
      const session = landing(
        visitor,
        device,
        localTime(visitor, offset, between(7, 22, random)),
      );
      if (random() > 0.45)
        browse(
          session,
          weighted(
            [
              [1, 35],
              [2, 30],
              [3, 20],
              [5, 15],
            ],
            random,
          ),
        );
      // Some reach the sign-up form, then leave.
      if (session.path === marketing.pricing.path && random() < 0.15) {
        session.dwell();
        session.go(marketing.signup, { "data-ql-id": "pricing-signup" });
      }
      offset += between(1, 20, random);
    }
  }

  // Visitors who sign up and use the app.
  for (let user = 0; user < users; user++) {
    const visitor = newVisitor();
    const desktop = newDevice(random() < 0.85 ? false : undefined);
    const phone = random() < 0.2 ? newDevice(true) : undefined;
    const userId = `usr_${runId.slice(0, 8)}_${String(user + 1).padStart(4, "0")}`;
    const first = pick(firstNames, profileRandom);
    const last = pick(lastNames, profileRandom);
    let plan = weighted<Plan>(
      [
        ["starter", 35],
        ["team", 50],
        ["business", 15],
      ],
      profileRandom,
    );
    const loyal = random() < 0.35;
    // Not on the last day: local evenings there can fall on today in UTC.
    const signupDay = arrivalDay(1, days - 2);

    // Earlier anonymous research on the same browser, linked by identify().
    for (
      let earlier = weighted(
        [
          [0, 50],
          [1, 35],
          [2, 15],
        ],
        random,
      );
      earlier > 0;
      earlier--
    ) {
      const offset = signupDay - between(1, 10, random);
      if (offset < 0) continue;
      const session = landing(
        visitor,
        desktop,
        localTime(visitor, offset, between(8, 21, random)),
      );
      browse(session, between(1, 3, random));
    }

    const signup = landing(
      visitor,
      desktop,
      localTime(visitor, signupDay, between(8, 18, random)),
    );
    if (signup.path !== marketing.pricing.path && random() < 0.8) {
      browse(signup, between(0, 2, random));
      if (signup.path !== marketing.pricing.path) {
        signup.dwell();
        signup.go(marketing.pricing, { "data-ql-id": "nav-pricing" });
      }
    }
    signup.dwell(20, 120);
    if (signup.path === marketing.pricing.path) {
      const cycle = random() < 0.25 ? "annual" : "monthly";
      signup.track("pricing_plan_selected", { plan, billing_cycle: cycle });
      signup.go(marketing.signup, { "data-ql-id": `plan-${plan}` });
    } else
      signup.go(
        marketing.signup,
        { "data-ql-id": "hero-signup" },
        "signup_cta_clicked",
      );
    signup.dwell(25, 90);
    const method = weighted(
      [
        ["email", 60],
        ["google", 30],
        ["github", 10],
      ],
      random,
    );
    signup.click(
      "button",
      method === "email"
        ? { type: "submit" }
        : { "data-ql-id": `${method}-signin` },
    );
    const signupPage = signup.url();
    signup.identify(userId, {
      name: `${first} ${last}`,
      email: `${first}.${last}.${user + 1}@example.com`.toLowerCase(),
      plan: "trial",
      company_size: weighted(
        [
          ["1-10", 45],
          ["11-50", 35],
          ["51-200", 15],
          ["201+", 5],
        ],
        random,
      ),
      signup_method: method,
    });
    signup.track(orbitEvents.signedUp, { method });
    // The app is a separate single-page application.
    signup.load(
      app.onboarding,
      method === "google"
        ? "https://accounts.google.com/"
        : method === "github"
          ? "https://github.com/"
          : signupPage,
    );
    signup.dwell(15, 60);
    const remaining = [...projects];
    const workspaceProjects = Array.from(
      { length: between(1, 3, random) },
      () =>
        remaining.splice(Math.floor(random() * remaining.length), 1)[0] ??
        projects[0],
    );
    const mainProject = workspaceProjects[0] ?? projects[0];
    signup.click("button", { type: "submit" });
    signup.track(orbitEvents.workspaceCreated, {
      template: weighted(
        [
          ["kanban", 55],
          ["scrum", 25],
          ["blank", 20],
        ],
        random,
      ),
    });
    let invited = false;
    const invite = (session: Session, location: string) => {
      session.click("button", { "data-ql-id": "invite-teammates" });
      session.dwell(10, 45);
      session.track(orbitEvents.teammateInvited, {
        role: weighted(
          [
            ["member", 80],
            ["admin", 12],
            ["guest", 8],
          ],
          random,
        ),
        invites: between(1, plan === "business" ? 8 : 4, random),
        location,
      });
      invited = true;
    };
    if (random() < (plan === "starter" ? 0.25 : 0.55))
      invite(signup, "onboarding");
    signup.go(board(mainProject));
    let taskKey = 0;
    for (let count = between(1, 4, random); count > 0; count--) {
      signup.dwell(10, 60);
      signup.click("button", { "data-ql-id": "new-task" });
      signup.track(orbitEvents.taskCreated, {
        source: "onboarding",
        task_kind: "feature",
      });
      taskKey++;
    }

    // Trials last 14 days. Engaged teams subscribe; the rest stop after expiry.
    const trialEnd = signupDay + 14;
    const converts = random() < (loyal ? 0.8 : 0.25);
    const convertDay = signupDay + between(7, 14, random);
    const annual = random() < 0.2;
    let subscribed = false;
    let cancelled = false;
    let nextInvoice = 0;
    let activeUntil = days;
    const subscribe = (session: Session) => {
      session.go(app.billing);
      session.dwell(15, 60);
      session.click("button", { "data-ql-id": `upgrade-${plan}` });
      session.load(app.billing, "https://checkout.stripe.com/");
      const amount = monthlyPrice[plan] * (annual ? 10 : 1);
      const billing_cycle = annual ? "annual" : "monthly";
      session.track(orbitEvents.subscriptionStarted, {
        plan,
        billing_cycle,
        amount,
        currency: "EUR",
      });
      session.identify(userId, { plan });
      serverEvent(
        userId,
        session.time + between(2, 20, random) * second,
        orbitEvents.invoicePaid,
        {
          amount,
          currency: "EUR",
          plan,
          billing_cycle,
        },
      );
      subscribed = true;
      nextInvoice = session.time + (annual ? 365 : 30) * day;
    };

    for (let offset = signupDay + 1; offset < activeUntil; offset++) {
      // Server-side renewals happen whether or not the team visits that day.
      while (
        subscribed &&
        !cancelled &&
        nextInvoice < beginning + (offset + 1) * day
      ) {
        if (random() < (loyal ? 0.04 : 0.12)) {
          cancelled = true;
          serverEvent(userId, nextInvoice, "subscription_cancelled", {
            plan,
            reason: "renewal_failed",
          });
          activeUntil = Math.min(days, offset + between(1, 10, random));
          break;
        }
        const upgrade = plan === "starter" && random() < 0.15;
        if (upgrade) plan = "team";
        serverEvent(userId, nextInvoice, orbitEvents.invoicePaid, {
          amount: monthlyPrice[plan] * (annual ? 10 : 1),
          currency: "EUR",
          plan,
          billing_cycle: annual ? "annual" : "monthly",
          ...(upgrade ? { upgraded_from: "starter" } : {}),
        });
        nextInvoice += (annual ? 365 : 30) * day;
      }
      if (!subscribed && offset > trialEnd + 2) break;
      const elapsed = offset - signupDay;
      const weekday = new Date(beginning + offset * day).getUTCDay();
      const weekend = weekday === 0 || weekday === 6;
      const chance =
        (loyal ? 0.62 : 0.55 * Math.exp(-elapsed / 21)) *
        (weekend ? 0.3 : 1) *
        (plan === "business" ? 1.1 : 1);
      if (
        random() > chance &&
        !(converts && !subscribed && offset === convertDay)
      )
        continue;
      const visits = random() < 0.2 ? 2 : 1;
      for (let count = 0; count < visits; count++) {
        const mobile = phone && random() < 0.3 ? phone : undefined;
        const device = mobile ?? desktop;
        const session = visit(
          visitor,
          device,
          localTime(
            visitor,
            offset,
            count ? between(14, 19, random) : between(8, 12, random),
          ),
        );
        if (!device.userId) {
          // First use of a second device: log in, then the app loads.
          session.load(marketing.login, "");
          session.dwell(15, 40);
          session.click("button", { type: "submit" });
          session.identify(userId, {});
          session.load(app.home, `${origin}${marketing.login.path}`);
        } else {
          const entry = weighted(
            [
              ["direct", 70],
              ["email", 15],
              ["slack", 10],
              ["site", 5],
            ],
            random,
          );
          if (entry === "direct") session.load(app.home, "");
          else if (entry === "site") {
            session.load(marketing.home, "");
            session.dwell(3, 15);
            session.click("a", { "data-ql-id": "nav-open-app" });
            session.load(app.home, `${origin}/`);
          } else
            session.load(
              task(
                pick(workspaceProjects, random),
                between(1, Math.max(1, taskKey), random),
              ),
              entry === "email"
                ? "https://mail.google.com/"
                : "https://app.slack.com/",
            );
        }
        const used = new Set<string>();
        const feature = (name: string) => {
          if (used.has(name)) return;
          used.add(name);
          session.track(orbitEvents.featureUsed, { feature: name, plan });
        };
        const project = pick(workspaceProjects, random);
        if (session.path !== board(project).path) {
          session.dwell(3, 20);
          session.go(board(project));
        }
        feature("Board");
        const actions = between(2, loyal ? 7 : 5, random) + (mobile ? -1 : 0);
        for (let action = 0; action < actions; action++) {
          session.dwell(10, 90);
          const kind = weighted(
            [
              ["task", 34],
              ["create", 26],
              ["complete", 12],
              ["search", 10],
              ["reports", plan === "starter" ? 3 : 9],
              ["automations", plan === "business" ? 8 : 1],
              ["invite", invited ? 0.2 : 1],
            ],
            random,
          );
          if (kind === "task" && taskKey > 0) {
            const detail = task(project, between(1, taskKey, random));
            session.go(detail);
            session.dwell(15, 120);
            if (random() < 0.45) {
              session.click("button", { type: "submit" });
              session.track("comment_added", {
                mentions: between(0, 2, random),
              });
              feature("Comments");
            }
            if (random() < 0.4) {
              session.click("button", { "data-ql-id": "complete-task" });
              session.track(orbitEvents.taskCompleted, {
                task_kind: pick(
                  ["bug", "feature", "review", "documentation"],
                  random,
                ),
                via: "detail",
              });
            }
            session.back(board(project));
          } else if (kind === "create" || kind === "task") {
            const shortcut = random() < 0.3;
            if (!shortcut)
              session.click("button", { "data-ql-id": "new-task" });
            session.track(orbitEvents.taskCreated, {
              source: shortcut ? "shortcut" : "board",
              task_kind: pick(
                ["bug", "feature", "review", "documentation"],
                random,
              ),
            });
            taskKey++;
          } else if (kind === "complete") {
            for (
              let done = between(1, plan === "business" ? 3 : 2, random);
              done > 0;
              done--
            ) {
              session.track(orbitEvents.taskCompleted, {
                task_kind: pick(
                  ["bug", "feature", "review", "documentation"],
                  random,
                ),
                via: "board",
              });
              session.dwell(2, 20);
            }
          } else if (kind === "search") {
            session.click("button", { "data-ql-id": "search" });
            session.dwell(3, 12);
            session.track("search_performed", {
              results: weighted(
                [
                  [0, 10],
                  [between(1, 5, random), 60],
                  [between(6, 40, random), 30],
                ],
                random,
              ),
            });
            feature("Search");
          } else if (kind === "reports") {
            session.go(app.reports);
            feature("Reports");
            session.dwell(20, 120);
            if (random() < 0.3) {
              const format = pick(["csv", "pdf"], random);
              session.click("button", { "data-ql-id": `export-${format}` });
              session.track("report_exported", { format });
              feature("Export");
            }
            session.go(board(project));
          } else if (kind === "automations") {
            session.go(app.automations);
            feature("Automations");
            session.dwell(20, 90);
            if (random() < 0.25) {
              session.click("button", { type: "submit" });
              session.track("automation_created", {
                trigger: pick(
                  ["task_moved", "due_date", "label_added"],
                  random,
                ),
              });
            }
            session.go(board(project));
          } else if (kind === "invite") {
            session.go(app.members);
            invite(session, "settings");
            session.go(board(project));
          }
        }
        if (
          converts &&
          !subscribed &&
          offset >= convertDay &&
          offset <= trialEnd
        )
          subscribe(session);
        if (subscribed && !cancelled && !annual && random() < 0.002) {
          session.go(app.billing);
          session.click("button", { "data-ql-id": "cancel-subscription" });
          session.track("subscription_cancelled", {
            plan,
            reason: pick(
              ["too_expensive", "switched_tool", "team_disbanded"],
              random,
            ),
          });
          cancelled = true;
          activeUntil = Math.min(days, offset + between(1, 10, random));
        }
      }
    }
  }

  // Simulated activity can run past yesterday or start before the range.
  const end = today - 1;
  const kept = operations.filter((operation) => {
    const time = Date.parse(operation.timestamp);
    return time >= beginning && time <= end;
  });
  const counts = new Map<string, number>();
  for (const operation of kept) {
    const name = operation.kind === "event" ? operation.eventType : "identify";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  kept.sort(
    (a, b) =>
      a.timestamp.localeCompare(b.timestamp) ||
      // Identify must commit before the events it attributes.
      (a.kind === b.kind ? 0 : a.kind === "identify" ? -1 : 1) ||
      a.id.localeCompare(b.id),
  );
  return {
    operations: kept,
    counts,
    from: new Date(beginning).toISOString(),
    to: new Date(end).toISOString(),
  };
}

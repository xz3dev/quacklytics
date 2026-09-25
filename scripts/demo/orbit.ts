import { randomUUID } from "node:crypto";
import {
  type EventInput,
  type JsonValue,
} from "../../packages/contracts/src/index";
import { eventNames } from "../../packages/contracts/src/orbit";
export { eventNames, orbitInsights } from "../../packages/contracts/src/orbit";

const dayMs = 86400000;

type Properties = Record<string, JsonValue>;
// A reproducible random stream gives coherent distributions without a new dependency.
function randomStream(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function pick<T>(values: readonly T[], random: () => number): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) throw new Error("Cannot choose from an empty list");
  return value;
}

// Relative weights describe fictional traffic, not real-world market shares.
function weighted<T>(
  choices: readonly (readonly [T, number])[],
  random: () => number,
): T {
  let remaining =
    random() * choices.reduce((total, [, weight]) => total + weight, 0);
  for (const [value, weight] of choices) {
    remaining -= weight;
    if (remaining < 0) return value;
  }
  throw new Error("Cannot choose from an empty distribution");
}

const clients = [
  {
    browser: "Chrome",
    os: "Windows",
    device: "desktop",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  },
  {
    browser: "Chrome",
    os: "macOS",
    device: "desktop",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  },
  {
    browser: "Safari",
    os: "macOS",
    device: "desktop",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  },
  {
    browser: "Firefox",
    os: "Linux",
    device: "desktop",
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
  },
  {
    browser: "Edge",
    os: "Windows",
    device: "desktop",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  },
  {
    browser: "Safari",
    os: "iOS",
    device: "mobile",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  },
  {
    browser: "Chrome",
    os: "Android",
    device: "mobile",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  },
  {
    browser: "Safari",
    os: "iOS",
    device: "tablet",
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  },
] as const;
const clientWeights = [30, 14, 12, 8, 6, 15, 10, 5];

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
  // Profile sampling does not consume the activity random stream.
  const profileRandom = randomStream(seed ^ 0x9e3779b9);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const beginning = today - days * dayMs;
  const events: (EventInput & { personId: string; sessionId: string })[] = [];
  const counts = new Map<string, number>();
  function add(
    group: string,
    eventType: string,
    user: number,
    time: number,
    props: Properties = {},
    session = "main",
  ) {
    const personId = `orbit:${runId}:${group}:user-${user}`;
    events.push({
      id: randomUUID(),
      eventType,
      timestamp: new Date(time).toISOString(),
      personId,
      sessionId: `${personId}:${session}`,
      properties: {
        demo_product: "Orbit",
        demo_run: runId,
        chart_target: group,
        ...props,
      },
      personProperties: { name: `Orbit teammate ${user + 1}`, demo: true },
    });
    counts.set(eventType, (counts.get(eventType) ?? 0) + 1);
  }
  for (let user = 0; user < users; user++) {
    const plan = weighted(
      [
        ["starter", 35],
        ["team", 50],
        ["business", 15],
      ],
      profileRandom,
    );
    const country = weighted(
      [
        ["Germany", 32],
        ["United States", 27],
        ["United Kingdom", 18],
        ["France", 14],
        ["Netherlands", 9],
      ],
      profileRandom,
    );
    const source = weighted(
      [
        ["organic", 42],
        ["direct", 28],
        ["referral", 19],
        ["paid_search", 11],
      ],
      profileRandom,
    );
    const client = weighted(
      clients.map((value, index): readonly [typeof value, number] => [
        value,
        clientWeights[index] ?? 0,
      ]),
      profileRandom,
    );
    const props = {
      plan,
      country,
      source,
      ...client,
      deviceType: client.device,
    };
    const price = plan === "starter" ? 9 : plan === "team" ? 29 : 79;
    // All cohorts have an activation day; early cohorts have time to churn or return.
    const signupDay = Math.floor(random() * (days - 7));
    const activation =
      beginning + signupDay * dayMs + (8 + Math.floor(random() * 8)) * 3600000;
    add("retention", eventNames.retention[0], user, activation, props);
    const loyal = random() < 0.35;
    for (let offset = 0; signupDay + offset < days; offset++) {
      const time = activation + offset * dayMs;
      const weekday = new Date(time).getUTCDay();
      const weekend = weekday === 0 || weekday === 6;
      const returnChance =
        offset === 0
          ? 1
          : (loyal ? 0.85 : 0.72 * Math.exp(-offset / 18)) *
            (weekend ? 0.5 : 1) *
            (plan === "business" ? 1.15 : 1);
      if (random() < returnChance)
        add(
          "retention",
          eventNames.retention[1],
          user,
          time + 1800000,
          props,
          `day-${offset}`,
        );
    }
    // Funnel actors have monotonic, timestamp-ordered stages with real drop-off.
    const depth = random();
    const thresholds = [1, 0.76, 0.49, 0.31];
    eventNames.funnel.forEach((name, index) => {
      if (depth < (thresholds[index] ?? 0))
        add("funnel", name, user, activation + index * 600000, {
          ...props,
          trial_days: 14,
        });
    });
    // Paying teams renew monthly; some cancel, and later invoices can upgrade.
    if (depth < 0.31) {
      for (
        let invoiceDay = signupDay + 3;
        invoiceDay < days;
        invoiceDay += 30
      ) {
        if (invoiceDay > signupDay + 3 && random() < 0.18) break;
        const upgrade =
          invoiceDay > signupDay + 3 && plan === "starter" && random() < 0.3;
        add(
          "value",
          eventNames.value[0],
          user,
          beginning + invoiceDay * dayMs + 12 * 3600000,
          {
            ...props,
            amount: upgrade ? 29 : price,
            currency: "EUR",
            billing_cycle: "monthly",
            upgraded: upgrade,
          },
        );
      }
    }
    // Each path actor has one journey, isolated from other chart families.
    const routes = [
      [0, 1, 2, 3, 2, 4, 5],
      [0, 1, 2, 3, 2],
      [0, 4, 5],
      [0, 6, 7],
      [0, 1, 7],
      [0, 1, 2, 3, 2, 3],
    ];
    pick(routes, random).forEach((step, index) => {
      const name = eventNames.path[step];
      if (name)
        add("path", name, user, activation + index * 90000, {
          ...props,
          page: name.replace("demo.path.", "/"),
          duration_seconds: 20 + Math.floor(random() * 160),
        });
    });
    for (let day = signupDay; day < days; day++) {
      const date = beginning + day * dayMs;
      const weekday = new Date(date).getUTCDay();
      const weekend = weekday === 0 || weekday === 6;
      const campaign = day >= days - 14 && day < days - 10 ? 1.3 : 1;
      const adoption = 0.38 + (0.35 * day) / days;
      if (random() > adoption * (weekend ? 0.4 : 1) * campaign) continue;
      const time =
        date +
        (8 + Math.floor(random() * 11)) * 3600000 +
        Math.floor(random() * 3600000);
      add("trend", eventNames.trend[0], user, time, props, `day-${day}`);
      const tasks = 1 + Math.floor(random() * (plan === "business" ? 6 : 4));
      for (let task = 0; task < tasks; task++)
        add(
          "trend",
          eventNames.trend[1],
          user,
          time + (task + 1) * 120000,
          {
            ...props,
            task_kind: pick(
              ["bug", "feature", "review", "documentation"],
              random,
            ),
          },
          `day-${day}`,
        );
      const feature = pick(
        plan === "business"
          ? ["Board", "Reports", "Reports", "Automations", "Export"]
          : ["Board", "Board", "Board", "Search", "Comments", "Reports"],
        random,
      );
      add(
        "breakdown",
        eventNames.breakdown[0],
        user,
        time + 900000,
        { ...props, feature, duration_ms: 200 + Math.floor(random() * 1800) },
        `day-${day}`,
      );
    }
  }
  events.sort(
    (a, b) =>
      a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id),
  );
  return {
    events,
    counts,
    from: new Date(beginning).toISOString(),
    to: new Date(today - 1).toISOString(),
  };
}

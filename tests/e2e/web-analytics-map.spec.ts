import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  catalogAccess,
  dashboard,
  insight,
} from "../../packages/contracts/src/index";
import { countryDatabase } from "../support/mmdb";
import { withServer } from "../support/server";

test("the default web analytics dashboard maps SDK visitors by country", async ({
  page,
}) => {
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-map-"));
  const database = join(directory, "countries.mmdb");
  writeFileSync(
    database,
    countryDatabase({
      "8.8.8.0/24": "US",
      "203.0.113.0/24": "DE",
      // Singapore is too small for the map's 1:110m outlines.
      "192.0.2.0/24": "SG",
    }),
  );
  try {
    await withServer(
      4180,
      {
        GEOIP: "on",
        GEOIP_DB_PATH: database,
        // Test requests arrive over loopback, standing in for a reverse proxy.
        TRUSTED_PROXIES: "loopback",
      },
      async (origin) => {
        const api = page.request;
        const headers = { Origin: origin };
        expect(
          z
            .object({ geoip: z.string() })
            .parse(await (await api.get(`${origin}/api/setup`)).json()).geoip,
        ).toBe("custom");
        expect(
          (
            await api.post(`${origin}/api/auth/sign-up/email`, {
              headers,
              data: {
                email: "map@example.com",
                password: "Map-password-123",
                name: "Map",
              },
            })
          ).ok(),
        ).toBeTruthy();
        const project = z.object({ id: z.string() }).parse(
          await (
            await api.post(`${origin}/api/projects`, {
              headers,
              data: { name: "Map" },
            })
          ).json(),
        );
        await api.post(`${origin}/api/${project.id}/settings`, {
          headers,
          data: [{ key: "cors_origins", value: origin }],
        });
        const key = z
          .array(z.object({ key: z.string() }))
          .parse(
            await (
              await api.post(`${origin}/api/${project.id}/apikeys`, { headers })
            ).json(),
          )
          .at(-1)?.key;
        if (!key) throw new Error("Missing key");

        // Anonymous SDK visitors are distinguished by address and user agent.
        const pageview = async (address: string, path: string) => {
          const response = await api.post(`${origin}/api/ingest`, {
            headers: {
              ...headers,
              "X-API-KEY": key,
              "X-Forwarded-For": address,
            },
            data: {
              protocolVersion: 1,
              requestId: crypto.randomUUID(),
              operations: [
                {
                  kind: "event",
                  id: crypto.randomUUID(),
                  // "Last 30 days" covers complete days, ending yesterday.
                  timestamp: new Date(Date.now() - 86400000).toISOString(),
                  eventType: "$pageview",
                  properties: {},
                  context: {
                    sdk: { name: "@quacklytics/client", version: "0.2.0" },
                    page: {
                      url: `${origin}${path}`,
                      path,
                      title: "Page",
                      referrer: "",
                      pageViewId: crypto.randomUUID(),
                    },
                    browser: "Firefox",
                    os: "Linux",
                    deviceType: "desktop",
                  },
                  anonymous: true,
                },
              ],
            },
          });
          expect(response.ok(), await response.text()).toBeTruthy();
        };
        await pageview("203.0.113.5", "/");
        await pageview("203.0.113.5", "/pricing");
        await pageview("203.0.113.6", "/");
        await pageview("8.8.8.8", "/");
        await pageview("192.0.2.1", "/");
        await pageview("198.51.100.7", "/");

        const exported = await api.post(
          `${origin}/api/${project.id}/events/catalog/gen`,
          { headers },
        );
        expect(exported.ok(), await exported.text()).toBeTruthy();
        const file = catalogAccess
          .array()
          .parse(await exported.json())
          .at(0);
        if (!file) throw new Error("Missing country events export");
        const range = await api.get(file.url, {
          headers: { Origin: origin, Range: "bytes=0-3" },
        });
        expect(range.status()).toBe(206);
        expect(range.headers()["access-control-allow-origin"]).toBe(origin);

        const [home] = dashboard
          .array()
          .parse(
            await (
              await api.get(`${origin}/api/${project.id}/dashboards`)
            ).json(),
          );
        expect(home?.name).toBe("Web Analytics Overview");
        expect(home?.home).toBe(true);
        expect(
          home?.insights.map((item) => `${item.type}: ${item.name}`),
        ).toEqual([
          "Value: Visitors",
          "Value: Pageviews",
          "Value: Sessions",
          "Trend: Visitors and pageviews",
          "Map: Visitors by country",
          "Breakdown: Top pages",
          "Breakdown: Referrers",
          "Breakdown: Custom events",
          "Breakdown: Devices",
          "Breakdown: Browsers",
          "Breakdown: Operating systems",
        ]);
        expect(home?.layout?.find((item) => item.w === 12)?.insightId).toBe(
          home?.insights[3]?.id,
        );

        // The browser also reaches the server through the "proxy".
        await page.route(`${origin}/**`, (route) =>
          route.continue({
            headers: {
              ...route.request().headers(),
              "x-forwarded-for": "8.8.4.4",
            },
          }),
        );
        await page.goto(`${origin}/app/${project.id}/dashboards/${home?.id}`);
        const map = page.getByRole("img", {
          name: "Visitors by country",
          exact: true,
        });
        await expect(map).toBeVisible();
        await expect(page.getByTestId("map-legend")).toContainText("2 users");
        await expect(
          page.getByText("Not on the map: 🇸🇬 Singapore (1), Unknown (1)"),
        ).toBeVisible();
        // The credit is only required for the bundled DB-IP database.
        await expect(page.getByText("IP Geolocation by DB-IP")).toHaveCount(0);

        // Germany has the most visitors, so it carries the darkest fill.
        const germany = map.locator('path[fill="hsl(var(--chart-1) / 1)"]');
        await expect(germany).toHaveCount(1);
        await germany.scrollIntoViewIfNeeded();
        const box = await germany.boundingBox();
        if (!box) throw new Error("Germany has no outline");
        const tooltip = page.locator(".analytics-tooltip:visible");
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await expect(tooltip).toContainText("Germany");
        await expect(tooltip).toContainText("2 users");
        await expect(tooltip).toContainText("40%");
        // Poland borders Germany to the east: outlined, but without visitors.
        await page.mouse.move(box.x + box.width + 4, box.y + box.height / 2);
        await expect(tooltip).toContainText("Poland");
        await expect(tooltip).toContainText("No data");
        const usa = map.locator('path[fill="hsl(var(--chart-1) / 0.22)"]');
        await expect(usa).toHaveCount(1);
        const usaBox = await usa.boundingBox();
        if (!usaBox) throw new Error("The United States have no outline");
        // The North Atlantic is within reach of Ireland's centre, but it is
        // not part of any country's outline.
        await page.mouse.move(
          (usaBox.x + usaBox.width + box.x) / 2,
          box.y + box.height / 2,
        );
        await expect(tooltip).toHaveCount(0);

        const mapInsight = insight.parse(home?.insights[4]);
        await page.goto(
          `${origin}/app/${project.id}/insights/${mapInsight.id}`,
        );
        const rows = page.getByRole("row");
        await expect(rows).toHaveText([
          /Country\s*Users\s*Share/,
          /🇩🇪 Germany\s*2\s*40%/,
          /(🇺🇸 United States|🇸🇬 Singapore|Unknown)\s*1\s*20%/,
          /(🇺🇸 United States|🇸🇬 Singapore|Unknown)\s*1\s*20%/,
          /(🇺🇸 United States|🇸🇬 Singapore|Unknown)\s*1\s*20%/,
        ]);
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

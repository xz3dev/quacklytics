import { useQuery } from "@tanstack/react-query";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import { z } from "zod";
import countriesUrl from "world-atlas/countries-110m.json?url";

// Natural Earth 1:110m outlines (public domain) via world-atlas. Smaller
// countries such as Singapore or Malta are not part of this resolution.
const position = z.array(z.number());
const polygon = z.object({
  type: z.literal("Polygon"),
  arcs: z.array(z.array(z.number())),
  id: z.string().optional(),
  properties: z.object({ name: z.string() }),
});
const multiPolygon = polygon.extend({
  type: z.literal("MultiPolygon"),
  arcs: z.array(z.array(z.array(z.number()))),
});
const topology = z.object({
  type: z.literal("Topology"),
  arcs: z.array(z.array(position)),
  transform: z.object({
    scale: z.tuple([z.number(), z.number()]),
    translate: z.tuple([z.number(), z.number()]),
  }),
  objects: z.object({
    countries: z.object({
      type: z.literal("GeometryCollection"),
      geometries: z.array(
        z.discriminatedUnion("type", [polygon, multiPolygon]),
      ),
    }),
  }),
});

export type CountryShape = Feature<
  Geometry,
  { name: string; code: string | null }
>;

/** ISO 3166-1 numeric (world-atlas ids) to the alpha-2 codes stored in `$country`. */
const alpha2 = new Map<string, string>(
  Object.entries({
    "004": "AF",
    "008": "AL",
    "010": "AQ",
    "012": "DZ",
    "024": "AO",
    "031": "AZ",
    "032": "AR",
    "036": "AU",
    "040": "AT",
    "044": "BS",
    "050": "BD",
    "051": "AM",
    "056": "BE",
    "064": "BT",
    "068": "BO",
    "070": "BA",
    "072": "BW",
    "076": "BR",
    "084": "BZ",
    "090": "SB",
    "096": "BN",
    "100": "BG",
    "104": "MM",
    "108": "BI",
    "112": "BY",
    "116": "KH",
    "120": "CM",
    "124": "CA",
    "140": "CF",
    "144": "LK",
    "148": "TD",
    "152": "CL",
    "156": "CN",
    "158": "TW",
    "170": "CO",
    "178": "CG",
    "180": "CD",
    "188": "CR",
    "191": "HR",
    "192": "CU",
    "196": "CY",
    "203": "CZ",
    "204": "BJ",
    "208": "DK",
    "214": "DO",
    "218": "EC",
    "222": "SV",
    "226": "GQ",
    "231": "ET",
    "232": "ER",
    "233": "EE",
    "238": "FK",
    "242": "FJ",
    "246": "FI",
    "250": "FR",
    "260": "TF",
    "262": "DJ",
    "266": "GA",
    "268": "GE",
    "270": "GM",
    "275": "PS",
    "276": "DE",
    "288": "GH",
    "300": "GR",
    "304": "GL",
    "320": "GT",
    "324": "GN",
    "328": "GY",
    "332": "HT",
    "340": "HN",
    "348": "HU",
    "352": "IS",
    "356": "IN",
    "360": "ID",
    "364": "IR",
    "368": "IQ",
    "372": "IE",
    "376": "IL",
    "380": "IT",
    "384": "CI",
    "388": "JM",
    "392": "JP",
    "398": "KZ",
    "400": "JO",
    "404": "KE",
    "408": "KP",
    "410": "KR",
    "414": "KW",
    "417": "KG",
    "418": "LA",
    "422": "LB",
    "426": "LS",
    "428": "LV",
    "430": "LR",
    "434": "LY",
    "440": "LT",
    "442": "LU",
    "450": "MG",
    "454": "MW",
    "458": "MY",
    "466": "ML",
    "478": "MR",
    "484": "MX",
    "496": "MN",
    "498": "MD",
    "499": "ME",
    "504": "MA",
    "508": "MZ",
    "512": "OM",
    "516": "NA",
    "524": "NP",
    "528": "NL",
    "540": "NC",
    "548": "VU",
    "554": "NZ",
    "558": "NI",
    "562": "NE",
    "566": "NG",
    "578": "NO",
    "586": "PK",
    "591": "PA",
    "598": "PG",
    "600": "PY",
    "604": "PE",
    "608": "PH",
    "616": "PL",
    "620": "PT",
    "624": "GW",
    "626": "TL",
    "630": "PR",
    "634": "QA",
    "642": "RO",
    "643": "RU",
    "646": "RW",
    "682": "SA",
    "686": "SN",
    "688": "RS",
    "694": "SL",
    "703": "SK",
    "704": "VN",
    "705": "SI",
    "706": "SO",
    "710": "ZA",
    "716": "ZW",
    "724": "ES",
    "728": "SS",
    "729": "SD",
    "732": "EH",
    "740": "SR",
    "748": "SZ",
    "752": "SE",
    "756": "CH",
    "760": "SY",
    "762": "TJ",
    "764": "TH",
    "768": "TG",
    "780": "TT",
    "784": "AE",
    "788": "TN",
    "792": "TR",
    "795": "TM",
    "800": "UG",
    "804": "UA",
    "807": "MK",
    "818": "EG",
    "826": "GB",
    "834": "TZ",
    "840": "US",
    "854": "BF",
    "858": "UY",
    "860": "UZ",
    "862": "VE",
    "887": "YE",
    "894": "ZM",
  }),
);
// Kosovo has no numeric ISO code; GeoIP databases report it as XK.
const unnumbered = new Map([["Kosovo", "XK"]]);
const ANTARCTICA = "010";

async function loadCountries(): Promise<CountryShape[]> {
  const response = await fetch(countriesUrl);
  if (!response.ok) throw new Error(`Map outlines: HTTP ${response.status}`);
  const world = topology.parse(await response.json());
  return feature(world, world.objects.countries)
    .features.filter((country) => country.id !== ANTARCTICA)
    .map((country) => ({
      type: "Feature",
      geometry: country.geometry,
      properties: {
        name: country.properties.name,
        code:
          (typeof country.id === "string"
            ? alpha2.get(country.id)
            : undefined) ??
          unnumbered.get(country.properties.name) ??
          null,
      },
    }));
}

export function useCountryShapes() {
  return useQuery({
    queryKey: ["country-shapes"],
    queryFn: loadCountries,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

const regionNames = new Intl.DisplayNames(undefined, { type: "region" });

/** Localised country name with its flag, e.g. "🇩🇪 Germany". */
export function countryLabel(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  const flag = String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
  let name = code;
  try {
    name = regionNames.of(code) ?? code;
  } catch {
    // Unknown codes keep their raw value.
  }
  return `${flag} ${name}`;
}

// Stamps the @quacklytics/client version into package.json and SDK_VERSION before publishing.
//   release: version comes from RELEASE_TAG (vX.Y.Z or vX.Y.Z-prerelease).
//   nightly: <next patch>-nightly.<sha>, where the base is the newer of the latest
//            vX.Y.Z tag and package.json. Requires tags to be fetched.
// Prints the version and npm dist-tag to GITHUB_OUTPUT when available.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

const packagePath = "packages/tracker/package.json";
const protocolPath = "packages/tracker/src/protocol.ts";
const semver = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function parse(version: string): [number, number, number] {
  const match = semver.exec(version);
  if (!match) throw new Error(`Invalid version ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function newer(a: string, b: string): string {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return (x[i] ?? 0) > (y[i] ?? 0) ? a : b;
  }
  return a;
}

const manifest = z
  .looseObject({ version: z.string() })
  .parse(JSON.parse(readFileSync(packagePath, "utf8")));
const mode = z.enum(["release", "nightly"]).parse(process.argv[2]);

let version: string;
let distTag: string;
if (mode === "release") {
  const tag = z.string().parse(process.env.RELEASE_TAG);
  const match = /^v(.+)$/.exec(tag);
  if (!match?.[1] || !semver.test(match[1])) {
    throw new Error(
      `Release tag ${tag} must look like vX.Y.Z or vX.Y.Z-prerelease`,
    );
  }
  version = match[1];
  distTag = version.includes("-") ? "next" : "latest";
} else {
  const sha = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const latestTag = execFileSync(
    "git",
    ["tag", "--list", "v*.*.*", "--sort=-v:refname"],
    {
      encoding: "utf8",
    },
  )
    .split("\n")
    .map((tag) => tag.slice(1))
    .find((tag) => semver.test(tag) && !tag.includes("-"));
  const [major, minor, patch] = parse(
    latestTag ? newer(latestTag, manifest.version) : manifest.version,
  );
  // "sha" keeps the identifier alphanumeric; an all-digit SHA with a leading zero is invalid semver.
  version = `${major}.${minor}.${patch + 1}-nightly.sha-${sha}`;
  distTag = "nightly";
}

writeFileSync(
  packagePath,
  JSON.stringify({ ...manifest, version }, null, 2) + "\n",
);
const protocol = readFileSync(protocolPath, "utf8");
const sdkVersion = /export const SDK_VERSION = "[^"]*";/;
if (!sdkVersion.test(protocol))
  throw new Error(`SDK_VERSION not found in ${protocolPath}`);
writeFileSync(
  protocolPath,
  protocol.replace(sdkVersion, `export const SDK_VERSION = "${version}";`),
);

console.log(`@quacklytics/client ${version} (${distTag})`);
const output = process.env.GITHUB_OUTPUT;
if (output) appendFileSync(output, `version=${version}\ndist-tag=${distTag}\n`);

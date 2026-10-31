import { readdir, readFile } from "node:fs/promises";
import { join, resolve, relative, sep } from "node:path";
import { builtinModules } from "node:module";
import ts from "typescript";

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter((entry) => entry.name !== "node_modules")
        .map((entry) =>
          entry.isDirectory()
            ? files(join(dir, entry.name))
            : Promise.resolve([join(dir, entry.name)]),
        ),
    )
  ).flat();
}
const root = resolve("apps/web/src");
const server = join(root, "server") + sep;
const contracts = resolve("packages/contracts/src") + sep;
// The Start server entry hands API requests to the gateway; it never ships to browsers.
const serverEntry = join(root, "server.ts");
const native = new Set([
  ...builtinModules,
  "bun",
  "bun:sqlite",
  "better-auth",
  "@duckdb/node-api",
]);
const config = ts.getParsedCommandLineOfConfigFile(
  resolve("apps/web/tsconfig.json"),
  {},
  {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );
    },
  },
);
if (!config || config.errors.length)
  throw new Error("Unable to read web compiler configuration");
const compilerOptions = config.options;
const sources = [
  ...(await files(root)),
  ...(await files("packages/contracts/src")),
  ...(await files("packages/tracker/src")),
];
for (const file of sources) {
  if (!/\.tsx?$/.test(file) || file.endsWith("routeTree.gen.ts")) continue;
  const path = resolve(file);
  const source = ts.createSourceFile(
    file,
    await readFile(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function inspect(node: ts.Node) {
    let specifier: ts.Node | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      specifier = node.moduleSpecifier;
    else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    )
      specifier = node.moduleReference.expression;
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      specifier = node.argument.literal;
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      specifier = node.arguments[0];
      if (
        !path.startsWith(server) &&
        (!specifier || !ts.isStringLiteralLike(specifier))
      ) {
        throw new Error(
          `${file}: browser imports must use literal module names`,
        );
      }
    }
    if (specifier && ts.isStringLiteralLike(specifier)) {
      const name = specifier.text;
      const target = ts.resolveModuleName(name, path, compilerOptions, ts.sys)
        .resolvedModule?.resolvedFileName;
      const entryGateway =
        path === serverEntry && target === join(root, "server", "gateway.ts");
      if (
        !path.startsWith(server) &&
        !entryGateway &&
        (target?.startsWith(server) ||
          native.has(name) ||
          name.startsWith("node:") ||
          name.startsWith("bun:") ||
          name.startsWith("better-auth/") ||
          name.startsWith("@duckdb/node-api/"))
      )
        throw new Error(
          `${file}: server import "${name}" is not allowed in browser/shared code`,
        );
      if (target?.startsWith(server)) {
        const sourceLayer = relative(server, path).split(sep)[0];
        const targetLayer = relative(server, target).split(sep)[0];
        if (
          (sourceLayer === "repositories" &&
            ["domain", "handlers"].includes(targetLayer ?? "")) ||
          (sourceLayer === "domain" &&
            (targetLayer === "handlers" || targetLayer === "http.ts"))
        )
          throw new Error(
            `${file}: ${sourceLayer} must not depend on ${targetLayer}`,
          );
      }
      if (path.startsWith(contracts) && target?.startsWith(root))
        throw new Error(
          `${file}: contracts must not depend on application code`,
        );
      if (
        path.startsWith(server) &&
        target?.startsWith(root) &&
        /^(client|app|components|hooks|services|data)\//.test(
          relative(root, target),
        )
      )
        throw new Error(
          `${file}: server code must not import browser module "${name}"`,
        );
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}
console.log("Source import boundaries verified");
if (!process.argv.includes("--source-only")) {
  for (const path of await files("apps/web/dist/client")) {
    if (!path.endsWith(".js")) continue;
    const text = await readFile(path, "utf8");
    if (
      /bun:sqlite|S3_SECRET_ACCESS_KEY|S3_ACCESS_KEY_ID|AUTH_SECRET|single_admin/.test(
        text,
      )
    )
      throw new Error(`Server implementation leaked into ${path}`);
  }
  console.log("Browser bundle boundaries verified");
}

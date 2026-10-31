import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const exec = promisify(execFile);
const source = resolve("apps/web/src/server/db");
const cli = resolve("apps/web/dist/migrate.js");
async function bun(code: string, ...args: string[]) {
  const result = await exec("bun", ["-e", code, ...args]);
  return result.stdout.trim();
}
async function sql(file: string, statement: string) {
  return bun(
    'import { Database } from "bun:sqlite"; const db=new Database(process.argv[1]); console.log(JSON.stringify(db.query(process.argv[2]).all())); db.close();',
    file,
    statement,
  );
}
async function command(...args: string[]) {
  return (await exec("bun", [cli, ...args])).stdout;
}

test("migration CLI applies, reports and rolls back each database scope independently", async () => {
  const root = mkdtempSync(join(tmpdir(), "migrations-cli-"));
  const app = join(root, "app.sqlite");
  const project = join(root, "project.sqlite");
  try {
    writeFileSync(app, "");
    writeFileSync(project, "");
    expect(await command("up", "app", app)).toContain('"applied": true');
    await command("up", "project", project);
    await sql(
      app,
      "INSERT INTO projects(id,name) VALUES('kept','Existing project') RETURNING id",
    );
    await sql(
      project,
      "UPDATE settings SET value='42' WHERE key='revision' RETURNING value",
    );
    // Concurrent runners serialize, and applied migrations never run again.
    await Promise.all([command("up", "app", app), command("up", "app", app)]);
    expect(JSON.parse(await sql(app, "SELECT name FROM projects"))).toEqual([
      { name: "Existing project" },
    ]);
    expect(
      JSON.parse(
        await sql(app, "SELECT count(*) AS count FROM schema_migrations"),
      ),
    ).toEqual([{ count: 2 }]);
    expect(await command("status", "app", app)).toContain('"applied": true');
    // Rolling back the app database leaves project databases untouched.
    await command("down", "app", app, "0");
    expect(
      JSON.parse(
        await sql(
          app,
          "SELECT name FROM sqlite_master WHERE name IN ('projects','user','mcp_tokens')",
        ),
      ),
    ).toEqual([]);
    expect(await command("status", "app", app)).toContain('"applied": false');
    expect(
      JSON.parse(
        await sql(project, "SELECT value FROM settings WHERE key='revision'"),
      ),
    ).toEqual([{ value: "42" }]);
    await command("up", "app", app);
    await command("down", "project", project, "0");
    await command("up", "project", project);
    expect(
      JSON.parse(
        await sql(project, "SELECT value FROM settings WHERE key='revision'"),
      ),
    ).toEqual([{ value: "0" }]);
    await expect(command("up", "app", app, "999")).rejects.toThrow(
      "Unknown target",
    );
    await sql(
      app,
      "UPDATE schema_migrations SET checksum='changed' WHERE version=1 RETURNING version",
    );
    await expect(command("up", "app", app)).rejects.toThrow(
      "checksum mismatch",
    );
    expect(
      JSON.parse(
        await sql(app, "SELECT count(*) AS count FROM schema_migrations"),
      ),
    ).toEqual([{ count: 2 }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Failure injection needs SQL fixtures unavailable through the application's HTTP/UI flows.
// Execute in separate Bun processes to assert rollback and ledger durability after reopen.
test("failed SQL up/down rolls back schema, data, and migration history together", async () => {
  const root = mkdtempSync(join(tmpdir(), "migrations-failure-"));
  const file = join(root, "test.sqlite");
  const migrations = join(root, "migrations");
  cpSync(join(source, "migrations"), migrations, { recursive: true });
  const run = (direction: string) =>
    bun(
      `import { openDatabase } from ${JSON.stringify(join(source, "connection.ts"))}; import { loadMigrations,migrate } from ${JSON.stringify(join(source, "migrations.ts"))}; const db=openDatabase(process.argv[1]); try { await migrate(db,loadMigrations("project",process.argv[2]),process.argv[3]); } finally { db.close(); }`,
      file,
      migrations,
      direction,
    );
  try {
    await run("up");
    await sql(
      file,
      "UPDATE settings SET value='42' WHERE key='revision' RETURNING value",
    );
    const up = join(migrations, "project/0002_failure.up.sql");
    const down = join(migrations, "project/0002_failure.down.sql");
    writeFileSync(
      up,
      "CREATE TABLE example(id INTEGER); INSERT INTO example VALUES(7); INSERT INTO missing VALUES(1);",
    );
    writeFileSync(down, "DROP TABLE example; INSERT INTO missing VALUES(1);");
    await expect(run("up")).rejects.toThrow();
    expect(
      JSON.parse(
        await sql(file, "SELECT name FROM sqlite_master WHERE name='example'"),
      ),
    ).toEqual([]);
    expect(
      JSON.parse(
        await sql(file, "SELECT count(*) AS count FROM schema_migrations"),
      ),
    ).toEqual([{ count: 1 }]);
    writeFileSync(
      up,
      "CREATE TABLE example(id INTEGER); INSERT INTO example VALUES(7);",
    );
    await run("up");
    expect(
      JSON.parse(
        await sql(file, "SELECT value FROM settings WHERE key='revision'"),
      ),
    ).toEqual([{ value: "42" }]);
    await expect(run("down")).rejects.toThrow();
    expect(JSON.parse(await sql(file, "SELECT id FROM example"))).toEqual([
      { id: 7 },
    ]);
    expect(
      JSON.parse(
        await sql(file, "SELECT count(*) AS count FROM schema_migrations"),
      ),
    ).toEqual([{ count: 2 }]);
    writeFileSync(down, "DROP TABLE example;");
    await expect(run("down")).rejects.toThrow("checksum mismatch");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dev lifecycle migrates fresh and existing databases before starting Vite and stops on failure", async () => {
  const root = mkdtempSync(join(tmpdir(), "migrations-predev-"));
  const app = join(root, "app.sqlite");
  const project = join(root, "projects", "existing", "project.sqlite");
  const dev = () =>
    exec("bun", ["run", "dev", "--help"], {
      cwd: resolve("."),
      env: { ...process.env, DATA_DIR: root },
    });
  try {
    expect((await dev()).stdout).toContain(
      "Migrations complete: app database and 0 project database(s).",
    );
    expect(
      JSON.parse(
        await sql(app, "SELECT max(version) AS version FROM schema_migrations"),
      ),
    ).toEqual([{ version: 2 }]);
    await sql(
      app,
      "INSERT INTO projects(id,name) VALUES('existing','Retained project') RETURNING id",
    );
    expect((await dev()).stdout).toContain(
      "Migrations complete: app database and 1 project database(s).",
    );
    await sql(
      project,
      "UPDATE settings SET value='37' WHERE key='revision' RETURNING value",
    );
    await dev();
    expect(
      JSON.parse(
        await sql(app, "SELECT max(version) AS version FROM schema_migrations"),
      ),
    ).toEqual([{ version: 2 }]);
    expect(JSON.parse(await sql(app, "SELECT name FROM projects"))).toEqual([
      { name: "Retained project" },
    ]);
    expect(
      JSON.parse(
        await sql(project, "SELECT value FROM settings WHERE key='revision'"),
      ),
    ).toEqual([{ value: "37" }]);
    await sql(
      project,
      "UPDATE schema_migrations SET checksum='invalid' RETURNING version",
    );
    await expect(dev()).rejects.toMatchObject({
      stdout: expect.not.stringContaining("vite/"),
      stderr: expect.stringContaining("checksum mismatch"),
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

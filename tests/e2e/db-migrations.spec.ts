import { parseJson } from "../../packages/contracts/src/index";
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

test("migration CLI upgrades legacy databases, persists data, and rolls versions down and up independently", async () => {
  const root = mkdtempSync(join(tmpdir(), "migrations-cli-"));
  const app = join(root, "app.sqlite");
  const project = join(root, "project.sqlite");
  try {
    for (const [scope, file] of [
      ["app", app],
      ["project", project],
    ]) {
      if (!scope || !file) throw new Error("Missing fixture");
      await bun(
        `import { openDatabase } from ${JSON.stringify(join(source, "connection.ts"))}; import { loadMigrations } from ${JSON.stringify(join(source, "migrations.ts"))}; const db=openDatabase(process.argv[1]); const first=loadMigrations(process.argv[2])[0]; db.exec(first.up); db.exec("CREATE TABLE migration(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL)"); db.query("INSERT INTO migration VALUES(1,?)").run(first.checksum); db.close();`,
        file,
        scope,
      );
    }
    await sql(
      app,
      "INSERT INTO projects(id,name) VALUES('kept','Existing project') RETURNING id",
    );
    await sql(
      project,
      "UPDATE settings SET value='42' WHERE key='revision' RETURNING value",
    );
    // The previous startup created auth and secret tables outside its version-1 ledger.
    await bun(
      `import { openDatabase } from ${JSON.stringify(join(source, "connection.ts"))}; import { loadMigrations } from ${JSON.stringify(join(source, "migrations.ts"))}; const db=openDatabase(process.argv[1]); for (const migration of loadMigrations("app").filter((migration) => migration.version > 1 && migration.version <= 3)) db.exec(migration.up); db.exec("INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES('admin','Existing admin','admin@example.com',1,0,0); INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES('account','admin','credential','admin','existing-password-hash',0,0); INSERT INTO api_keys(id,project,digest,prefix,created_at) VALUES(1,'kept','digest','prefix',0); INSERT INTO api_key_secrets VALUES(1,'existing-secret');"); db.close();`,
      app,
    );
    expect(await command("up", "app", app)).toContain('"version": 5');
    await command("up", "project", project);
    await Promise.all([command("up", "app", app), command("up", "app", app)]);
    expect(JSON.parse(await sql(app, "SELECT password FROM account"))).toEqual([
      { password: "existing-password-hash" },
    ]);
    expect(
      JSON.parse(await sql(app, "SELECT value FROM api_key_secrets")),
    ).toEqual([{ value: "existing-secret" }]);
    expect(
      JSON.parse(
        await sql(app, "SELECT count(*) AS count FROM schema_migrations"),
      ),
    ).toEqual([{ count: 5 }]);
    expect(JSON.parse(await sql(app, "SELECT name FROM projects"))).toEqual([
      { name: "Existing project" },
    ]);
    expect(await command("status", "app", app)).toContain('"applied": true');
    await command("down", "app", app, "1");
    expect(
      JSON.parse(
        await sql(
          app,
          "SELECT name FROM sqlite_master WHERE name IN ('user','api_key_secrets')",
        ),
      ),
    ).toEqual([]);
    expect(JSON.parse(await sql(app, "SELECT name FROM projects"))).toEqual([
      { name: "Existing project" },
    ]);
    expect(
      JSON.parse(
        await sql(project, "SELECT value FROM settings WHERE key='revision'"),
      ),
    ).toEqual([{ value: "42" }]);
    await command("up", "app", app);
    await command("down", "app", app);
    expect(
      JSON.parse(
        await sql(app, "SELECT max(version) AS version FROM schema_migrations"),
      ),
    ).toEqual([{ version: 4 }]);
    await command("down", "app", app, "0");
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
    ).toEqual([{ count: 5 }]);
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
    const up = join(migrations, "project/0005_failure.up.sql");
    const down = join(migrations, "project/0005_failure.down.sql");
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
    ).toEqual([{ count: 4 }]);
    writeFileSync(
      up,
      "CREATE TABLE example(id INTEGER); INSERT INTO example VALUES(7);",
    );
    await run("up");
    await expect(run("down")).rejects.toThrow();
    expect(JSON.parse(await sql(file, "SELECT id FROM example"))).toEqual([
      { id: 7 },
    ]);
    expect(
      JSON.parse(
        await sql(file, "SELECT count(*) AS count FROM schema_migrations"),
      ),
    ).toEqual([{ count: 5 }]);
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
    ).toEqual([{ version: 5 }]);
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
    await command("down", "app", app, "1");
    await dev();
    expect(
      JSON.parse(
        await sql(app, "SELECT max(version) AS version FROM schema_migrations"),
      ),
    ).toEqual([{ version: 5 }]);
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

test("dashboard membership migration preserves order and layout across downgrade and reopen", async () => {
  const root = mkdtempSync(join(tmpdir(), "dashboard-membership-"));
  const file = join(root, "project.sqlite");
  const definitions = [
    {
      id: 1,
      type: "Value",
      name: "First",
      favorite: false,
      config: { value: { duration: "P7D", series: { query: {} } } },
    },
    {
      id: 2,
      type: "Value",
      name: "Second",
      favorite: false,
      config: { value: { duration: "P7D", series: { query: {} } } },
    },
  ];
  const layout = [
    { insightId: 2, x: 0, y: 0, w: 6, h: 6 },
    { insightId: 1, x: 6, y: 0, w: 6, h: 6 },
  ];
  try {
    await bun(
      `import { insight, dashboardLayout, parseJson } from ${JSON.stringify(resolve("packages/contracts/src/index.ts"))}; import { openDatabase } from ${JSON.stringify(join(source, "connection.ts"))}; import { loadMigrations,migrate } from ${JSON.stringify(join(source, "migrations.ts"))}; const db=openDatabase(process.argv[1]); await migrate(db,loadMigrations("project"),"up",1); const definitions=insight.array().parse(parseJson(process.argv[2])); for (const value of definitions) db.query("INSERT INTO insights(id,json) VALUES(?,?)").run(value.id,JSON.stringify(value)); db.query("INSERT INTO dashboards(id,json) VALUES(1,?)").run(JSON.stringify({id:1,name:"Existing dashboard",favorite:true,home:true,insights:[definitions[1],definitions[0],definitions[1],{...definitions[0],id:999}],layout:dashboardLayout.parse(parseJson(process.argv[3]))})); db.close();`,
      file,
      JSON.stringify(definitions),
      JSON.stringify(layout),
    );
    for (let cycle = 0; cycle < 2; cycle++) {
      await command("up", "project", file);
      expect(
        await sql(
          file,
          "SELECT insight_id FROM dashboard_insights ORDER BY position",
        ),
      ).toBe('[{"insight_id":2},{"insight_id":1}]');
      expect(
        await sql(
          file,
          "SELECT json_extract(json,'$.insights') AS embedded FROM dashboards",
        ),
      ).toBe('[{"embedded":null}]');
      expect(
        await sql(
          file,
          "SELECT json_extract(json,'$.id') AS embedded FROM insights",
        ),
      ).toBe('[{"embedded":null},{"embedded":null}]');
      await command("down", "project", file, "1");
      const expected = {
        id: 1,
        name: "Existing dashboard",
        favorite: true,
        home: true,
        insights: [definitions[1], definitions[0]],
        layout,
      };
      const restored = await bun(
        'import { z } from "zod"; import { Database } from "bun:sqlite"; const db=new Database(process.argv[1]); console.log(z.object({json:z.string()}).parse(db.query("SELECT json FROM dashboards WHERE id=1").get()).json); db.close();',
        file,
      );
      // Compare parsed objects without depending on JSON key ordering.
      expect(parseJson(restored)).toEqual(expected);
    }
    await command("up", "project", file);
    await bun(
      `import { openDatabase } from ${JSON.stringify(join(source, "connection.ts"))}; const db=openDatabase(process.argv[1]); db.query("DELETE FROM insights WHERE id=2").run(); db.close();`,
      file,
    );
    expect(
      await sql(
        file,
        "SELECT insight_id FROM dashboard_insights ORDER BY position",
      ),
    ).toBe('[{"insight_id":1}]');
    expect(await sql(file, "PRAGMA foreign_key_check")).toBe("[]");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

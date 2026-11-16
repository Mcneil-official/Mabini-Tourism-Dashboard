import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

test("Security: vercel.json must not have the XSS vulnerability bypass flag", () => {
  const vercelJsonPath = path.join(rootDir, "vercel.json");
  const content = fs.readFileSync(vercelJsonPath, "utf-8");
  assert.doesNotMatch(
    content,
    /DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS/,
    "vercel.json must not deploy with the vulnerable TanStack Start XSS flag"
  );
});

test("Security: public/sw.js must not cache authenticated HTML navigation responses", () => {
  const swPath = path.join(rootDir, "public", "sw.js");
  const content = fs.readFileSync(swPath, "utf-8");
  // Inspect only the navigate handler block
  const navigateStart = content.indexOf('request.mode === "navigate"');
  const navigateEnd = content.indexOf("// 3. Static assets");
  const navigateBlock = content.slice(navigateStart, navigateEnd);
  assert.doesNotMatch(
    navigateBlock,
    /cache\.put/,
    "Service worker must not persist HTML navigation responses into CacheStorage"
  );
});

test("Security: 063_secure_analytics_functions.sql enforces is_to_staff() on all endpoints", () => {
  const migrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "063_secure_analytics_functions.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "Migration 063 must exist");
  const sql = fs.readFileSync(migrationPath, "utf-8");
  assert.match(
    sql,
    /revoke execute on function public\._to_establishment/i,
    "Must revoke direct execute on _to_establishment"
  );
  assert.match(
    sql,
    /revoke execute on function public\._to_operator/i,
    "Must revoke direct execute on _to_operator"
  );
  assert.match(
    sql,
    /revoke execute on function public\._to_overview/i,
    "Must revoke direct execute on _to_overview"
  );
  assert.match(
    sql,
    /if not public\.is_to_staff\(\) then/i,
    "Must enforce public.is_to_staff() check in function bodies"
  );
});

test("Data Integrity: useLiveList does not fall back to demo mock data on query errors", () => {
  const queriesPath = path.join(rootDir, "src", "lib", "queries.ts");
  const content = fs.readFileSync(queriesPath, "utf-8");
  assert.doesNotMatch(
    content,
    /const usingDemo = !isLive \|\| \(query\.isError && query\.data === undefined\);/,
    "Live mode must not mask query errors with fake demo rows"
  );
  assert.match(
    content,
    /const usingDemo = !isLive;/,
    "usingDemo must strictly be !isLive"
  );
});

test("Atomicity: createStaffAccount rolls back auth user creation if staff row insert fails", () => {
  const staffFnPath = path.join(rootDir, "src", "lib", "create-staff-fn.ts");
  const content = fs.readFileSync(staffFnPath, "utf-8");
  assert.match(
    content,
    /admin\.auth\.admin\.deleteUser\(created\.user\.id\)/,
    "Must roll back created auth user if to_staff insert fails"
  );
});

test("Atomicity: resetStaffPassword arms must_change_password before touching credentials", () => {
  const resetFnPath = path.join(rootDir, "src", "lib", "reset-staff-password-fn.ts");
  const content = fs.readFileSync(resetFnPath, "utf-8");
  const flagIdx = content.indexOf("Could not arm password change requirement");
  const updateIdx = content.indexOf("Could not set the new password");
  assert.ok(
    flagIdx !== -1 && updateIdx !== -1 && flagIdx < updateIdx,
    "must_change_password flag update must be armed before password is changed"
  );
});

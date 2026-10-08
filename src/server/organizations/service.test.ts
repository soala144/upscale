import assert from "node:assert/strict";
import test from "node:test";

import { isOrganizationSlugConflict } from "./service";

test("recognizes a PostgreSQL slug conflict wrapped by Drizzle", () => {
  const postgresError = Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint: "organizations_slug_uidx",
  });
  const drizzleError = new Error("Failed query", { cause: postgresError });

  assert.equal(isOrganizationSlugConflict(drizzleError), true);
});

test("does not misclassify other database errors as slug conflicts", () => {
  const postgresError = Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint: "members_organization_user_uidx",
  });
  const drizzleError = new Error("Failed query", { cause: postgresError });

  assert.equal(isOrganizationSlugConflict(drizzleError), false);
  assert.equal(isOrganizationSlugConflict(new Error("connection failed")), false);
});

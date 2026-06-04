import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "app/Services/passwordService.ts";

Deno.test("hashPassword and verifyPassword work", async () => {
  const pw = "my-secret-pw";
  const hash = await hashPassword(pw, 4);

  assert.ok(hash.length > 0);

  const ok = await verifyPassword(pw, hash);
  assert.equal(ok, true);

  const nok = await verifyPassword("wrong", hash);
  assert.equal(nok, false);
});

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import cloudControlPlaneRouter from "../src/routes/cloudControlPlane";
import uniliveV1Router from "../src/routes/uniliveV1";

async function withEnv(overrides, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withServer(router, fn) {
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err?.message || "test_server_error" });
  });

  const server = await new Promise((resolve) => {
    const listener = http.createServer(app).listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function postJson(baseUrl, path, body, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("platform RTC token mint is disabled publicly when no production internal secret is configured", async () => {
  await withEnv({ NODE_ENV: "production", INTERNAL_API_SECRET: null }, async () => {
    await withServer(uniliveV1Router, async (baseUrl) => {
      const res = await postJson(baseUrl, "/v1/rtc/tokens", {
        canonicalUserId: "attacker",
        roomId: "ic-stream-victim",
        role: "host",
      });

      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: "internal_api_disabled" });
    });
  });
});

test("platform RTC token mint rejects callers without the internal secret", async () => {
  await withEnv({ NODE_ENV: "development", INTERNAL_API_SECRET: "test-internal-secret" }, async () => {
    await withServer(uniliveV1Router, async (baseUrl) => {
      const res = await postJson(baseUrl, "/v1/rtc/tokens", {
        canonicalUserId: "attacker",
        roomId: "ic-stream-victim",
        role: "host",
      });

      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { error: "unauthorized" });
    });
  });
});

test("cloud control-plane health stays public but mutations require the internal secret", async () => {
  await withEnv({ NODE_ENV: "production", INTERNAL_API_SECRET: null }, async () => {
    await withServer(cloudControlPlaneRouter, async (baseUrl) => {
      const health = await fetch(`${baseUrl}/v1/cloud/health`);
      assert.equal(health.status, 200);
      assert.equal((await health.json()).ok, true);

      const createOrg = await postJson(baseUrl, "/v1/cloud/organizations", {
        name: "spoofed",
        actorId: "victim-admin",
      });
      assert.equal(createOrg.status, 503);
      assert.deepEqual(await createOrg.json(), { error: "internal_api_disabled" });
    });
  });
});

test("cloud control-plane rejects spoofed actor requests without the internal secret", async () => {
  await withEnv({ NODE_ENV: "development", INTERNAL_API_SECRET: "test-internal-secret" }, async () => {
    await withServer(cloudControlPlaneRouter, async (baseUrl) => {
      const res = await postJson(
        baseUrl,
        "/v1/cloud/organizations",
        { name: "spoofed", actorId: "victim-admin" },
        { "x-internal-secret": "wrong-secret", "x-unilive-actor": "victim-admin" },
      );

      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { error: "unauthorized" });
    });
  });
});

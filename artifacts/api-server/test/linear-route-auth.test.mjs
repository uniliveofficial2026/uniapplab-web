import assert from "node:assert/strict";
import test from "node:test";
import app from "../dist/app.mjs";

function setEnv(updates) {
  const previous = {};
  for (const [key, value] of Object.entries(updates)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function listen() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1");
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

test("POST /api/linear/issues is unavailable without a route secret", async () => {
  const restore = setEnv({
    LINEAR_API_KEY: "lin_api_dummy",
    LINEAR_ISSUE_CREATE_SECRET: undefined,
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
  });
  const server = await listen();
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/linear/issues`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "public write" }),
    });

    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, "linear_issue_secret_not_configured");
  } finally {
    await close(server);
    restore();
  }
});

test("POST /api/linear/issues rejects requests without the bearer secret", async () => {
  const restore = setEnv({
    LINEAR_API_KEY: "lin_api_dummy",
    LINEAR_ISSUE_CREATE_SECRET: "route-secret",
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
  });
  const server = await listen();
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/linear/issues`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "public write", teamId: "attacker-team" }),
    });

    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, "invalid_linear_issue_secret");
  } finally {
    await close(server);
    restore();
  }
});

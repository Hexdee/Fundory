const BASE_URL = (process.env.INDEXER_BASE_URL || "http://127.0.0.1:8081").replace(/\/$/, "");

const fail = (message, extra) => {
  const details = extra ? `\n${JSON.stringify(extra, null, 2)}` : "";
  throw new Error(`${message}${details}`);
};

const expect = (condition, message, extra) => {
  if (!condition) fail(message, extra);
};

const getJson = async (path) => {
  const res = await fetch(`${BASE_URL}${path}`);
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
};

const main = async () => {
  const health = await getJson("/health");
  expect(health.status === 200, "GET /health should return 200", health);
  expect(health.body?.ok === true, "GET /health should report ok=true", health.body);

  const status = await getJson("/status");
  expect(status.status === 200, "GET /status should return 200", status);
  expect(typeof status.body?.factoryConfigured === "boolean", "status.factoryConfigured missing", status.body);
  expect(typeof status.body?.vaults === "number", "status.vaults missing", status.body);
  expect(typeof status.body?.agent?.enabled === "boolean", "status.agent.enabled missing", status.body);

  const activity = await getJson("/activity?limit=2");
  expect(activity.status === 200, "GET /activity should return 200", activity);
  expect(Array.isArray(activity.body?.activities), "activity.activities should be array", activity.body);

  const badVault = await getJson("/activity?vaults=not-an-address");
  expect(badVault.status === 400, "Invalid vault filter should return 400", badVault);

  const agentStatus = await getJson("/agent/status");
  expect(agentStatus.status === 200, "GET /agent/status should return 200", agentStatus);
  expect(Array.isArray(agentStatus.body?.strategies), "agent.status.strategies should be array", agentStatus.body);

  const decision = await getJson("/agent/decision");
  expect(decision.status === 200, "GET /agent/decision should return 200", decision);
  expect(typeof decision.body?.decision?.action === "string", "decision.action missing", decision.body);

  const invalidExec = await fetch(`${BASE_URL}/agent/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ executor: "invalid-executor" }),
  });
  expect(invalidExec.status === 400 || invalidExec.status === 401, "Invalid executor should return 400 or 401", {
    status: invalidExec.status,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: BASE_URL,
        checks: [
          "/health",
          "/status",
          "/activity",
          "/activity?vaults=not-an-address",
          "/agent/status",
          "/agent/decision",
          "POST /agent/execute invalid executor",
        ],
      },
      null,
      2
    )
  );
};

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

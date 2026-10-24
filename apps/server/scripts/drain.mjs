// preStop hook for rolling deploys (Kubernetes): drains this instance before
// it gets SIGTERM. Switches the server to draining (GET /health/ready turns
// 503, so new connections go to the new instance), then waits until no game
// runs here any more — open sockets of running games keep being served — or
// DRAIN_MAX_SECONDS have passed. Needs a terminationGracePeriodSeconds above
// DRAIN_MAX_SECONDS.
//
//   lifecycle: { preStop: { exec: { command: ["node", "apps/server/scripts/drain.mjs"] } } }

const port = process.env.PORT || 3001;
const maxMs = Number(process.env.DRAIN_MAX_SECONDS || 3 * 60 * 60) * 1000;
// Even with nothing to wait for: the load balancer needs a moment to drop
// this instance before it stops answering.
const MIN_MS = 5_000;
const POLL_MS = 10_000;
const MAX_FAILURES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const started = Date.now();
let failures = 0;

for (;;) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health/drain`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { games } = await res.json();
    failures = 0;
    if (games.length === 0) break;
  } catch {
    // A server that doesn't answer has nothing left to drain.
    if (++failures >= MAX_FAILURES) break;
  }
  if (Date.now() - started >= maxMs) break;
  await sleep(POLL_MS);
}

const waited = Date.now() - started;
if (waited < MIN_MS) await sleep(MIN_MS - waited);

import assert from "node:assert/strict";
import test from "node:test";

const { createLatestJobRunner } = await import(
  new URL("../app/detection/job-queue.ts", import.meta.url).href
);

test("detection jobs run serially and replace an in-flight job with the newest request", async () => {
  const events = [];
  let releaseFirst;
  let firstStarted;
  let resolveSecond;

  const firstStartedPromise = new Promise((resolve) => {
    firstStarted = resolve;
  });
  const firstReleasePromise = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const secondFinishedPromise = new Promise((resolve) => {
    resolveSecond = resolve;
  });

  const runner = createLatestJobRunner(async (payload, isCancelled) => {
    events.push(`start:${payload}`);
    if (payload === "old") {
      firstStarted();
      await firstReleasePromise;
      events.push(`cancelled:${isCancelled()}`);
      return;
    }
    events.push(`cancelled:${isCancelled()}`);
    resolveSecond();
  });

  runner.enqueue(1, "old");
  await firstStartedPromise;
  runner.enqueue(2, "new");

  assert.deepEqual(events, ["start:old"]);
  releaseFirst();
  await secondFinishedPromise;

  assert.deepEqual(events, ["start:old", "cancelled:true", "start:new", "cancelled:false"]);
});

test("cancelling a queued detection job prevents it from starting", async () => {
  const events = [];
  let releaseFirst;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => {
    firstStarted = resolve;
  });
  const firstReleasePromise = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const runner = createLatestJobRunner(async (payload) => {
    events.push(`start:${payload}`);
    firstStarted();
    await firstReleasePromise;
  });

  runner.enqueue(1, "active");
  await firstStartedPromise;
  runner.enqueue(2, "queued");
  runner.cancel(2);
  releaseFirst();

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["start:active"]);
});

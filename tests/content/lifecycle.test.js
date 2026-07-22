"use strict";

const assert = require("node:assert/strict");
const lifecycleApi = require("../../src/content/lifecycle.js");

class EventTargetFixture {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }
  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ type });
  }
}

class ObserverFixture {
  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    this.disconnected = false;
    ObserverFixture.instances.push(this);
  }
  observe(value) {
    this.observed.push(value);
  }
  disconnect() {
    this.disconnected = true;
  }
}
ObserverFixture.instances = [];

(async () => {
  const documentObject = new EventTargetFixture();
  const windowObject = new EventTargetFixture();
  const main = { id: "main" };
  const menu = { hidden: false };
  documentObject.body = { id: "body" };
  documentObject.querySelector = (selector) => selector === "main" ? main : null;
  documentObject.getElementById = (id) => id === "ghdn-menu" ? menu : null;

  const timers = new Map();
  const frames = new Map();
  let timerId = 0;
  let frameId = 0;
  const runTimers = async () => {
    const callbacks = [...timers.values()];
    timers.clear();
    for (const callback of callbacks) callback();
    await Promise.resolve();
  };
  const runFrames = async () => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback();
    await Promise.resolve();
  };

  let mounts = 0;
  let prefetches = 0;
  let positioned = 0;
  const repositoryContext = {
    parse: () => ({ parts: ["owner", "repo", "releases"] }),
    isReleasesRoute: () => true
  };
  const lifecycle = lifecycleApi.create({
    documentObject,
    windowObject,
    MutationObserverClass: ObserverFixture,
    ResizeObserverClass: ObserverFixture,
    requestAnimationFrameFn(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrameFn(id) { frames.delete(id); },
    setTimeoutFn(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeoutFn(id) { timers.delete(id); },
    repositoryContext,
    mount: async () => { mounts += 1; },
    refreshLayout: async () => { mounts += 10; },
    loadRelease: async () => { prefetches += 1; },
    positionMenu: () => { positioned += 1; }
  });

  lifecycle.start();
  assert.equal(ObserverFixture.instances.length, 1);
  assert.deepEqual(ObserverFixture.instances[0].observed, [main]);
  await runTimers();
  assert.equal(mounts, 1);

  documentObject.dispatch("turbo:load");
  await runTimers();
  assert.equal(mounts, 2);

  lifecycle.schedulePrefetch();
  lifecycle.schedulePrefetch();
  await runTimers();
  assert.equal(prefetches, 1);

  const layoutHost = { id: "toolbar" };
  lifecycle.observeLayoutHost(layoutHost);
  assert.equal(ObserverFixture.instances.length, 2);
  ObserverFixture.instances[1].callback();
  await runFrames();
  assert.equal(mounts, 12);

  windowObject.dispatch("scroll");
  await runFrames();
  await runTimers();
  assert.equal(positioned, 1);
  assert.equal(mounts, 13);

  lifecycle.stop();
  assert.equal(ObserverFixture.instances.every((observer) => observer.disconnected), true);
  documentObject.dispatch("turbo:load");
  await runTimers();
  assert.equal(mounts, 13);

  console.log("content lifecycle tests: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

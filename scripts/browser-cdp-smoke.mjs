const args = process.argv.slice(2);
const argument = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const endpoint = (argument("--endpoint") ?? "http://127.0.0.1:9222").replace(/\/$/, "");
const expectCanvas = args.includes("--expect-canvas");
const expectText = argument("--expect-text");
const maxConsoleEvents = Number(argument("--max-console-events") ?? 100);
const reload = !args.includes("--no-reload");
const urlPrefix = argument("--url-prefix");
const waitMs = Number(argument("--wait-ms") ?? 8_000);
if (!urlPrefix) throw new Error("--url-prefix is required");
if (!Number.isInteger(waitMs) || waitMs < 0 || waitMs > 60_000) {
  throw new Error("--wait-ms must be an integer between 0 and 60000");
}
if (!Number.isInteger(maxConsoleEvents) || maxConsoleEvents < 1 || maxConsoleEvents > 1_000) {
  throw new Error("--max-console-events must be an integer between 1 and 1000");
}

const targets = await fetch(`${endpoint}/json`).then((response) => {
  if (!response.ok) throw new Error(`CDP target request failed with ${response.status}`);
  return response.json();
});
const target = targets.find((candidate) =>
  candidate.type === "page" && candidate.url.startsWith(urlPrefix));
if (!target?.webSocketDebuggerUrl) {
  throw new Error(`No CDP page starts with ${urlPrefix}`);
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const consoleEvents = [];
const consoleErrors = [];
const consoleCounts = {};
const exceptions = [];
let consoleErrorCount = 0;
let droppedConsoleEvents = 0;
let messageId = 0;
let sampledLogs = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id !== undefined) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
    else request.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.consoleAPICalled") {
    recordConsole({
      level: message.params.type,
      text: message.params.args.map(remoteValueText).join(" "),
    });
  }
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params.exceptionDetails;
    exceptions.push({
      column: details.columnNumber,
      line: details.lineNumber,
      text: details.exception?.description
        ?? details.exception?.value
        ?? details.text
        ?? "Unknown page exception",
      url: details.url,
    });
  }
  if (message.method === "Log.entryAdded") {
    recordConsole({
      level: message.params.entry.level,
      text: message.params.entry.text,
    });
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", () => reject(new Error("CDP websocket failed")), {
    once: true,
  });
});

await send("Page.enable");
await send("Runtime.enable");
await send("Page.bringToFront");
try {
  await send("Log.enable");
} catch {
  // Log.enable is optional on older Chromium; Runtime events still cover JS errors.
}
// Runtime.enable may replay exceptions from the page that existed before this probe.
consoleEvents.length = 0;
consoleErrors.length = 0;
for (const key of Object.keys(consoleCounts)) delete consoleCounts[key];
exceptions.length = 0;
consoleErrorCount = 0;
droppedConsoleEvents = 0;
sampledLogs = 0;
if (reload) await send("Page.reload", { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, waitMs));

const evaluation = await send("Runtime.evaluate", {
  expression: `(() => ({
    bodyText: document.body && document.body.innerText
      ? document.body.innerText.slice(0, 2000)
      : "",
    buttons: Array.from(document.querySelectorAll("button"))
      .map((button) => button.textContent ? button.textContent.trim() : "")
      .filter(Boolean),
    canvasCount: document.querySelectorAll("canvas").length,
    readyState: document.readyState,
    rootChildren: document.querySelector("#root")
      ? document.querySelector("#root").childElementCount
      : 0,
    title: document.title,
    url: location.href,
    userAgent: navigator.userAgent,
  }))()`,
  returnByValue: true,
});
const state = evaluation.result?.value;
const assertionFailures = [];
if (expectCanvas && (!state || state.canvasCount < 1)) {
  assertionFailures.push("Expected at least one canvas");
}
if (expectText && (!state || !state.bodyText.includes(expectText))) {
  assertionFailures.push(`Expected body text containing ${expectText}`);
}
const report = {
  assertionFailures,
  console: consoleEvents,
  consoleCounts,
  consoleErrorCount,
  droppedConsoleEvents,
  errors: consoleErrors,
  exceptions,
  state,
  target: { id: target.id, title: target.title, url: target.url },
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
socket.close();
if (
  assertionFailures.length > 0
  || consoleErrorCount > 0
  || exceptions.length > 0
  || !state
  || state.readyState !== "complete"
) {
  process.exitCode = 1;
}

function send(method, params = {}) {
  const id = ++messageId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, 15_000);
    pending.set(id, {
      method,
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

function remoteValueText(value) {
  if (value.value !== undefined) return String(value.value);
  return value.description ?? value.type ?? "unknown";
}

function recordConsole(event) {
  consoleCounts[event.level] = (consoleCounts[event.level] ?? 0) + 1;
  if (event.level === "error" || event.level === "assert") {
    consoleErrorCount += 1;
    if (consoleErrors.length < 1_000) consoleErrors.push(event);
  }
  const lowPriority = event.level === "log" || event.level === "debug" || event.level === "info";
  if (lowPriority && sampledLogs >= 20) {
    droppedConsoleEvents += 1;
    return;
  }
  if (consoleEvents.length >= maxConsoleEvents) {
    droppedConsoleEvents += 1;
    return;
  }
  if (lowPriority) sampledLogs += 1;
  consoleEvents.push(event);
}

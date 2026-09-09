let isConverting = false;
const USAGE_ENDPOINT = "https://sudokupad-to-penpa-log.cyddrdrd.workers.dev/log";
const APP_VERSION = "0.2.1";

function beginUsage(inputUrl, noSolutionCheck) {
  const eventId = globalThis.crypto && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2);
  return {eventId, startedAt: new Date().toISOString(), inputUrl, noSolutionCheck,
    outputUrl: null, inputFormat: null, error: null, version: APP_VERSION};
}

async function recordUsage(event) {
  // Logging must not delay conversion or close a successfully opened puzzle.
  // Retrying the same event ID cannot create duplicate rows in the Worker.
  const body = JSON.stringify(event);
  const keepalive = new TextEncoder().encode(body).length < 60000;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(USAGE_ENDPOINT, {method: "POST", credentials: "omit",
        headers: {"Content-Type": "application/json"}, body, keepalive, signal: controller.signal});
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) return;
    } catch (_) {
      // Network errors are retried below without changing the conversion result.
    } finally {
      clearTimeout(timer);
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  console.warn("Usage logging is temporarily unavailable.");
}

function setBusy(busy) {
  isConverting = busy;
  for (const id of ["convertOpenButton", "convertButton", "copyButton", "noSolutionCheck"]) {
    document.getElementById(id).disabled = busy;
  }
  document.getElementById("inputUrl").readOnly = busy;
}

function setStatus(message, type) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = "status " + type;
}

function clearOutput() {
  document.getElementById("outputUrl").value = "";
  setStatus("", "");
}

async function convertOnly() {
  if (isConverting) return null;
  const input = document.getElementById("inputUrl").value.trim();
  const output = document.getElementById("outputUrl");
  const noSolutionCheck = document.getElementById("noSolutionCheck").checked;
  const usage = beginUsage(input, noSolutionCheck);

  output.value = "";

  if (!input) {
    const message = "Please paste a SudokuPad link first.";
    setStatus(message, "error");
    void recordUsage({...usage, status: "error", error: message});
    return null;
  }

  setBusy(true);
  try {
    setStatus("Converting...", "success");

    const result = await convertSudokuPadUrlDetailed(input, { noSolutionCheck });

    output.value = result.url;
    const solutionStatus = result.includedSolution ? "Answer check included." : "No solution check included.";
    const warnings = Array.isArray(result.warnings) ? result.warnings.filter(Boolean) : [];
    setStatus(["Converted successfully.", solutionStatus, ...warnings].join(" "), "success");

    void recordUsage({...usage, status: "success", outputUrl: result.url, inputFormat: result.format || null});

    return result.url;
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    setStatus("Error: " + message, "error");
    void recordUsage({...usage, status: "error", error: message.slice(0, 4000)});
    return null;
  } finally {
    setBusy(false);
  }
}

async function convertAndOpen() {
  if (isConverting) return;
  // Start the window within the user's click, before any asynchronous work.
  let openedWindow = null;
  if (document.getElementById("inputUrl").value.trim()) {
    try {
      openedWindow = window.open("about:blank", "_blank");
      if (openedWindow) openedWindow.opener = null;
    } catch (err) {
      openedWindow = null;
    }
  }
  const result = await convertOnly();
  if (!result) {
    if (openedWindow && !openedWindow.closed) openedWindow.close();
    return;
  }
  if (openedWindow && !openedWindow.closed) {
    try {
      openedWindow.location.replace(result);
    } catch (err) {
      openedWindow.close();
      console.warn("Could not open the result. The generated URL is available to copy.", err);
    }
  }
}

async function copyOutput() {
  if (isConverting) return;
  const output = document.getElementById("outputUrl").value.trim();

  if (!output) {
    setStatus("No output link to copy.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(output);
    setStatus("Output URL copied to clipboard.", "success");
  } catch (err) {
    setStatus("Could not copy automatically. Please copy it manually.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("inputUrl").addEventListener("input", clearOutput);
  document.getElementById("noSolutionCheck").addEventListener("change", clearOutput);

  document
    .getElementById("convertOpenButton")
    .addEventListener("click", convertAndOpen);

  document
    .getElementById("convertButton")
    .addEventListener("click", convertOnly);

  document
    .getElementById("copyButton")
    .addEventListener("click", copyOutput);
});

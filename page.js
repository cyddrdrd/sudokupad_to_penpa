let isConverting = false;

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

  output.value = "";

  if (!input) {
    setStatus("Please paste a SudokuPad link first.", "error");
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

    return result.url;
  } catch (err) {
    setStatus("Error: " + (err && err.message ? err.message : String(err)), "error");
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

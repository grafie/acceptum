function saveOptions(e) {
  e.preventDefault();
  browser.storage.local.set({
    captureArea: document.querySelector("#captureAreaSetting").value
  });
}

function restoreOptions() {

  function setCurrentChoice(result) {
    document.querySelector("#captureAreaSetting").value = result.captureArea || "full";
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  browser.storage.local.get("captureArea").then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("#settings").addEventListener("submit", saveOptions);

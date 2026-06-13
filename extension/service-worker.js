chrome.runtime.onMessage.addListener((message) => {
  if (message?.source !== "specminer-extension") {
    return;
  }

  chrome.storage.local.get({ events: [] }, ({ events }) => {
    const nextEvents = [...events, message].slice(-1000);
    chrome.storage.local.set({ events: nextEvents });
  });
});

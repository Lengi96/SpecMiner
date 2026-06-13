(() => {
  if (window.__specminerExtensionInstalled) {
    return;
  }
  window.__specminerExtensionInstalled = true;

  function cleanText(value) {
    const cleaned = value?.replace(/\s+/g, " ").trim();
    return cleaned || undefined;
  }

  function selectorFor(element) {
    if (element.id) {
      return `${element.tagName.toLowerCase()}#${CSS.escape(element.id)}`;
    }
    const name = element.getAttribute("name");
    if (name) {
      return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
    }
    return element.tagName.toLowerCase();
  }

  function emit(type, target, extra = {}) {
    chrome.runtime.sendMessage({
      source: "specminer-extension",
      type,
      url: location.href,
      title: document.title,
      selector: target ? selectorFor(target) : undefined,
      text: target ? cleanText(target.textContent) : undefined,
      timestamp: new Date().toISOString(),
      ...extra
    });
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest("a,button,[role=button],input,select,textarea") : null;
      if (target) {
        emit("click", target);
      }
    },
    true
  );

  document.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (target && "value" in target) {
        emit("change", target, { valuePresent: Boolean(target.value) });
      }
    },
    true
  );
})();

(() => {
  const DEFAULT_SETTINGS = {
    openAiBaseUrl: "https://demo-ai.copypaste.hk/v1/",
    openAiApiKey: "",
    openAiModel: "deepseek-chat",
    autoPass: true
  };

  const statusEl = document.getElementById("popup-status");
  const formEl = document.getElementById("settings-form");
  const baseUrlEl = document.getElementById("baseUrl");
  const apiKeyEl = document.getElementById("apiKey");
  const modelEl = document.getElementById("model");
  const autoPassEl = document.getElementById("autoPass");
  const restoreBtn = document.getElementById("restore-defaults");

  const setStatus = (text, tone = "success") => {
    statusEl.textContent = text;
    statusEl.style.color =
      tone === "error" ? "#ff7878" : tone === "warning" ? "#ffd97f" : "#9bffb8";
  };

  const fillForm = settings => {
    baseUrlEl.value = settings.openAiBaseUrl || "";
    apiKeyEl.value = settings.openAiApiKey || "";
    modelEl.value = settings.openAiModel || "";
    autoPassEl.checked = Boolean(settings.autoPass);
  };

  const loadSettings = () => {
    chrome.runtime.sendMessage({ type: "getSettings" }, response => {
      if (response?.status === "ok") {
        fillForm(response.settings);
        setStatus("已加载当前配置", "success");
      } else {
        fillForm(DEFAULT_SETTINGS);
        setStatus("无法读取设置，已加载默认值", "warning");
      }
    });
  };

  const saveSettings = newSettings => {
    chrome.runtime.sendMessage(
      { type: "saveSettings", settings: newSettings },
      response => {
        if (response?.status === "ok") {
          setStatus("保存成功", "success");
        } else {
          setStatus("保存失败，请重试", "error");
        }
      }
    );
  };

  formEl.addEventListener("submit", event => {
    event.preventDefault();
    const newSettings = {
      openAiBaseUrl: baseUrlEl.value.trim(),
      openAiApiKey: apiKeyEl.value.trim(),
      openAiModel: modelEl.value.trim() || DEFAULT_SETTINGS.openAiModel,
      autoPass: autoPassEl.checked
    };
    saveSettings(newSettings);
  });

  restoreBtn.addEventListener("click", () => {
    fillForm(DEFAULT_SETTINGS);
    setStatus("默认值已恢复，请点击保存", "info");
  });

  document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
  });
})();

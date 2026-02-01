const DEFAULT_SETTINGS = {
  openAiBaseUrl: "https://demo-ai.copypaste.hk/v1/",
  openAiApiKey: "",
  openAiModel: "deepseek-chat",
  autoPass: true
};

const ensureDefaults = () => {
  chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), stored => {
    const missing = {};
    Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
      if (stored[key] === undefined) {
        missing[key] = value;
      }
    });
    if (Object.keys(missing).length) {
      chrome.storage.local.set(missing);
    }
  });
};

ensureDefaults();

const getSettings = () =>
  new Promise(resolve => {
    chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), stored => {
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });

const sanitizeUrl = url => url.replace(/\/+$/, "");

const buildPrompt = challenge => {
  const promptLines = [
    "You are a trusted agent that helps Clawptcha verify its bot-only challenges.",
    `Challenge Name: ${challenge.name || "Unknown"}`,
    `Description: ${challenge.description || "N/A"}`,
    `HTML snippet:\n${challenge.htmlSnippet || challenge.content || "N/A"}`,
    "Return ONLY a JSON object with the schema {\"answer\":\"...\",\"explanation\":\"optional text\"}.",
    "The answer field should be the exact value we can inject back into the challenge input.",
    "If the challenge is not textual (e.g., timing), reply with {\"answer\":\"\",\"explanation\":\"Manual timing required\"}."
  ];
  return promptLines.join("\n");
};

const extractJsonPayload = raw => {
  if (!raw) {
    return null;
  }
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(candidate.trim());
  } catch (error) {
    return null;
  }
};

const callLLM = async (challenge, settings) => {
  const baseUrl = sanitizeUrl(settings.openAiBaseUrl);
  const endpoint = `${baseUrl}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openAiApiKey}`
    },
    body: JSON.stringify({
      model: settings.openAiModel,
      messages: [
        {
          role: "system",
          content:
            "You solve verification challenges by returning the minimal answer string or an empty string if you cannot solve it."
        },
        {
          role: "user",
          content: buildPrompt(challenge)
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `LLM 请求失败 (${response.status}): ${body?.slice(0, 400) || "empty response"}`
    );
  }
  const data = await response.json();
  const rawMessage = data?.choices?.[0]?.message?.content || "";
  const payload = extractJsonPayload(rawMessage);
  return {
    raw: rawMessage,
    answer: payload?.answer?.toString().trim() || rawMessage.trim(),
    explanation: payload?.explanation || "",
    parsed: payload
  };
};

const handleSolveRequest = async (challenge, sendResponse) => {
  try {
    const settings = await getSettings();
    if (!settings.openAiBaseUrl || !settings.openAiApiKey) {
      sendResponse({
        status: "error",
        reason: "请先在弹出页中配置 OpenAI 基础地址和 API Key",
        autoPass: settings.autoPass
      });
      return;
    }
    const solution = await callLLM(challenge, settings);
    sendResponse({
      status: "ok",
      solution,
      autoPass: settings.autoPass
    });
  } catch (error) {
    sendResponse({
      status: "error",
      reason: error.message || "LLM 请求失败",
      autoPass: true
    });
  }
};

const handleSaveSettings = (payload, sendResponse) => {
  const updated = payload.settings || {};
  chrome.storage.local.set(updated, () => {
    sendResponse({ status: "ok" });
  });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "solveChallenge") {
    handleSolveRequest(message.challenge, sendResponse);
    return true;
  }
  if (message?.type === "getSettings") {
    getSettings().then(settings => sendResponse({ status: "ok", settings }));
    return true;
  }
  if (message?.type === "saveSettings") {
    handleSaveSettings(message, sendResponse);
    return true;
  }
});

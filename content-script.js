(() => {
  const STATUS_ID = "clawptcha-agent-status";
  const STATUS_STYLE_ID = "clawptcha-agent-style";

  const STATUS_COLORS = {
    idle: "#101317",
    working: "rgba(70, 130, 255, 0.9)",
    success: "rgba(0, 150, 120, 0.9)",
    warning: "rgba(255, 170, 0, 0.9)",
    error: "rgba(200, 40, 40, 0.95)",
    info: "rgba(90, 90, 90, 0.9)"
  };

  const waitForSelector = (selector, timeout = 3000) =>
    new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }
      const observer = new MutationObserver(() => {
        const match = document.querySelector(selector);
        if (match) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(match);
        }
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`等待元素超时：${selector}`));
      }, timeout);
    });

  const waitForCondition = (
    predicate,
    { timeout = 3000, interval = 20 } = {}
  ) =>
    new Promise(resolve => {
      const start = performance.now();
      const check = () => {
        try {
          if (predicate()) {
            resolve(true);
            return;
          }
        } catch {}
        if (performance.now() - start >= timeout) {
          resolve(false);
          return;
        }
        setTimeout(check, interval);
      };
      check();
    });

  const ensureStatusNode = () => {
    const existing = document.getElementById(STATUS_ID);
    if (existing) {
      return existing;
    }
    if (!document.getElementById(STATUS_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STATUS_STYLE_ID;
      style.textContent = `
        #${STATUS_ID} {
          position: fixed;
          bottom: 16px;
          right: 16px;
          z-index: 2147483647;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          color: #ffffff;
          background: rgba(15, 15, 15, 0.8);
          box-shadow: 0 0 16px rgba(0, 0, 0, 0.3);
          pointer-events: none;
          transition: background 0.2s ease;
        }
        #${STATUS_ID}[data-state="success"] {
          background: rgba(0, 150, 120, 0.9);
        }
        #${STATUS_ID}[data-state="warning"] {
          background: rgba(255, 170, 0, 0.9);
        }
        #${STATUS_ID}[data-state="error"] {
          background: rgba(200, 40, 40, 0.95);
        }
        #${STATUS_ID}[data-state="working"] {
          background: rgba(70, 130, 255, 0.9);
        }
        #${STATUS_ID}[data-state="info"] {
          background: rgba(90, 90, 90, 0.9);
        }
      `;
      document.head.appendChild(style);
    }
    const node = document.createElement("div");
    node.id = STATUS_ID;
    node.dataset.state = "idle";
    node.textContent = "Clawptcha Agent 准备中";
    document.body.appendChild(node);
    return node;
  };

  const setStatus = (text, state = "idle") => {
    const node = ensureStatusNode();
    node.textContent = text;
    node.dataset.state = state in STATUS_COLORS ? state : "idle";
  };

  const sha256Hex = async value => {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const factorizeBigInt = value => {
    let target = BigInt(value);
    if (target <= 1n) {
      return [];
    }
    const factors = [];
    while (target % 2n === 0n) {
      factors.push(2n);
      target /= 2n;
    }
    let divisor = 3n;
    const maxLoop = 1000000;
    let loops = 0;
    while (divisor * divisor <= target) {
      if (loops++ > maxLoop) {
        break;
      }
      if (target % divisor === 0n) {
        factors.push(divisor);
        target /= divisor;
      } else {
        divisor += 2n;
      }
    }
    if (target > 1n) {
      factors.push(target);
    }
    return factors;
  };

  const solveReactionChallenge = async () => {
    const zone = document.getElementById("reaction-zone");
    const startBtn = await waitForSelector("#reaction-start", 4000);
    const targetPromise = new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        const target = document.getElementById("reaction-target");
        if (target) {
          observer.disconnect();
          clearTimeout(timeoutId);
          target.click();
          resolve({ successMessage: "成功点击 Reaction Time 按钮" });
        }
      });
      observer.observe(zone || startBtn.parentElement, {
        childList: true,
        subtree: true
      });
      const timeoutId = setTimeout(() => {
        observer.disconnect();
        reject(new Error("未能在 1 秒内看到 CLICK NOW 按钮"));
      }, 1400);
    });
    startBtn.click();
    return targetPromise;
  };

  const solvePrecisionTiming = async () => {
    const startBtn = await waitForSelector("#timing-start", 4000);
    const display = await waitForSelector("#timing-display", 4000);
    const targetButton = await waitForSelector("#timing-click", 4000);
    return new Promise((resolve, reject) => {
      let completed = false;
      const observer = new MutationObserver(() => {
        if (completed) {
          return;
        }
        const textValue = display.textContent || "";
        const parsed = parseFloat(textValue);
        if (!Number.isFinite(parsed)) {
          return;
        }
        if (parsed >= 4.998 && parsed <= 5.002) {
          completed = true;
          observer.disconnect();
          clearTimeout(timeoutId);
          targetButton.click();
          resolve({ successMessage: `Precision Timing 点击 ${parsed.toFixed(3)}s` });
        }
      });
      observer.observe(display, {
        characterData: true,
        childList: true,
        subtree: true
      });
      startBtn.click();
      const timeoutId = setTimeout(() => {
        if (completed) {
          return;
        }
        completed = true;
        observer.disconnect();
        reject(new Error("Precision Timing 超时"));
      }, 9000);
    });
  };

  const solveVisualHash = async () => {
    const answerInput = await waitForSelector("#hash-answer", 4000);
    const submitBtn = document.getElementById("hash-submit");
    const display = document.querySelector("#challenge-content .hash-display");
    const text = display?.textContent
      ?.replace(/Hash this:/i, "")
      .trim();
    if (!text) {
      return { fallback: true };
    }
    const digest = await sha256Hex(text);
    const answer = digest.slice(0, 16);
    answerInput.value = answer;
    answerInput.dispatchEvent(new Event("input", { bubbles: true }));
    submitBtn?.click();
    return { successMessage: `计算出哈希前 16 位：${answer}` };
  };

  const solveCryptoChain = async () => {
    const answerInput = await waitForSelector("#crypto-answer", 4000);
    const submitBtn = document.getElementById("crypto-submit");
    const display = document.getElementById("crypto-input");
    const resultNode = document.getElementById("challenge-result");
    if (!display || !submitBtn) {
      throw new Error("未找到链式挑战的输入或按钮");
    }
    let previousHash = "";
    let steps = 0;
    while (steps < 7) {
      await waitForCondition(
        () => display.textContent?.includes("Hash:"),
        { timeout: 800, interval: 20 }
      );
      const text = display.textContent || "";
      const candidate = text.split("Hash:")[1]?.trim();
      if (!candidate || candidate === previousHash) {
        break;
      }
      previousHash = candidate;
      steps++;
      const digest = await sha256Hex(candidate);
      answerInput.value = digest;
      answerInput.dispatchEvent(new Event("input", { bubbles: true }));
      submitBtn.click();
      await waitForCondition(
        () => (display.textContent || "") !== text,
        { timeout: 300, interval: 10 }
      );
      if (resultNode && !resultNode.classList.contains("hidden")) {
        break;
      }
    }
    return { successMessage: `链式哈希共执行 ${steps} 步` };
  };

  const solvePrimeChallenge = async () => {
    const answerInput = await waitForSelector("#prime-answer", 4000);
    const submitBtn = document.getElementById("prime-submit");
    const questionEl = document.querySelector("#challenge-content .hash-display");
    const text = questionEl?.textContent || "";
    const matches = Array.from(text.matchAll(/\d+/g)).map(match => match[0]);
    if (!matches.length) {
      return { fallback: true };
    }
    const payload = matches[matches.length - 1];
    const value = BigInt(payload);
    const factors = factorizeBigInt(value);
    if (!factors.length) {
      return { fallback: true };
    }
    const answer = factors.map(f => f.toString()).join(",");
    answerInput.value = answer;
    answerInput.dispatchEvent(new Event("input", { bubbles: true }));
    submitBtn?.click();
    return { successMessage: `质因数分解：${answer}` };
  };

  const directSolvers = [
    {
      matcher: name => /reaction/i.test(name),
      solve: solveReactionChallenge,
      allowFallbackOnError: false
    },
    {
      matcher: name => /precision/i.test(name) || /timing/i.test(name),
      solve: solvePrecisionTiming,
      allowFallbackOnError: false
    },
    {
      matcher: name => /visual hash/i.test(name) || /hash/i.test(name),
      solve: solveVisualHash,
      allowFallbackOnError: true
    },
    {
      matcher: name => /cryptographic chain/i.test(name) || /chain/i.test(name),
      solve: solveCryptoChain,
      allowFallbackOnError: false
    },
    {
      matcher: name => /prime/i.test(name) || /factorization/i.test(name),
      solve: solvePrimeChallenge,
      allowFallbackOnError: false
    }
  ];

  const runDirectSolver = async (solver, challenge) => {
    setStatus(`尝试自动完成 ${challenge.name || "挑战"}`, "working");
    try {
      const outcome = await solver.solve(challenge);
      if (!outcome) {
        setStatus("自动解题未识别详情，交由代理处理", "warning");
        requestSolution(challenge);
        return;
      }
      if (outcome.fallback) {
        setStatus("自动解析失败，交给 LLM 返回答案", "warning");
        requestSolution(challenge);
        return;
      }
      setStatus(outcome.successMessage || "自动解题完成", "success");
    } catch (error) {
      setStatus(
        `自动解题失败：${error?.message || "未知错误"}`,
        solver.allowFallbackOnError ? "warning" : "error"
      );
      if (solver.allowFallbackOnError) {
        requestSolution(challenge);
      }
    }
  };

  const STEP_RULES = [
    {
      matcher: name => /hash/i.test(name),
      input: "#hash-answer",
      button: "#hash-submit"
    },
    {
      matcher: name => /crypto/i.test(name) || /chain/i.test(name),
      input: "#crypto-answer",
      button: "#crypto-submit"
    },
    {
      matcher: name => /prime/i.test(name) || /factorization/i.test(name),
      input: "#prime-answer",
      button: "#prime-submit"
    }
  ];

  const runAutoSubmit = async (challengeName, solution) => {
    const rule = STEP_RULES.find(rule => rule.matcher(challengeName));
    if (!rule) {
      setStatus(`当前挑战 ${challengeName} 不在自动支持列表`, "info");
      return;
    }
    try {
      const input = await waitForSelector(rule.input, 2200);
      input.value = solution;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const button = document.querySelector(rule.button);
      button?.click();
      setStatus(`自动填写 / 递交：${challengeName}`, "success");
    } catch (error) {
      setStatus(`自动提交失败：${error.message}`, "error");
    }
  };

  const requestSolution = challenge => {
    setStatus(`@LLM 请求内容：${challenge.name || "未知挑战"}`, "working");
    chrome.runtime.sendMessage(
      {
        type: "solveChallenge",
        challenge
      },
      response => {
        if (!response) {
          setStatus("后台未响应，请确保插件已启用", "error");
          return;
        }
        if (response.status !== "ok") {
          setStatus(`LLM 错误：${response.reason || "未知错误"}`, "error");
          return;
        }
        const answer = response.solution?.answer || "";
        if (!answer) {
          setStatus("LLM 未生成有效答案，请手动处理", "warning");
          return;
        }
        setStatus(
          response.autoPass
            ? `自动答案准备：${answer}`
            : `LLM 结果：${answer}（未自动递交）`,
          response.autoPass ? "success" : "info"
        );
        if (response.autoPass) {
          runAutoSubmit(challenge.name, answer);
        }
      }
    );
  };

  const grabChallenge = () => {
    const popup = document.getElementById("challenge-popup");
    if (!popup || popup.classList.contains("hidden")) {
      return null;
    }
    const name = document.getElementById("challenge-name")?.textContent?.trim() || "";
    const description =
      document.getElementById("challenge-desc")?.textContent?.trim() || "";
    const contentEl = document.getElementById("challenge-content");
    const content = contentEl?.textContent?.trim() || "";
    const htmlSnippet = contentEl?.innerHTML || "";
    const key = `${name}|${description}|${content}`;
    if (!name || key === lastChallengeKey) {
      return null;
    }
    lastChallengeKey = key;
    return {
      name,
      description,
      content,
      htmlSnippet
    };
  };

  const handleChallenge = challenge => {
    if (!challenge) {
      return;
    }
    const solver =
      directSolvers.find(entry => entry.matcher(challenge.name || "")) || null;
    if (solver) {
      runDirectSolver(solver, challenge);
      return;
    }
    requestSolution(challenge);
  };

  let lastChallengeKey = "";

  const startObserving = () => {
    const popup = document.getElementById("challenge-popup");
    if (!popup) {
      setTimeout(startObserving, 500);
      return;
    }
    const observer = new MutationObserver(() => {
      const challenge = grabChallenge();
      if (challenge) {
        handleChallenge(challenge);
      }
    });
    observer.observe(popup, {
      attributes: true,
      childList: true,
      subtree: true
    });
    const initial = grabChallenge();
    if (initial) {
      handleChallenge(initial);
    }
  };

  const init = () => {
    setStatus("准备监听 Clawptcha 挑战", "idle");
    startObserving();
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();

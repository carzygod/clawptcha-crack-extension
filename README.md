## 项目概述
这个 Chrome 扩展通过在 `https://clawptcha.com` 的挑战页面上注入内容脚本，捕获官方 “Impossible Challenges” 弹窗，并结合本地解题器 + LLM 调用的方式，尝试自动完成验证流程，再交由验证器获得通过结果。整个流程包括：后台保存 OpenAI 配置、内容脚本观察挑战并触发直接解决或让 agent 求助、以及一个 popup UI 用于设置参数和开关“是否自动通过”。

## 支持的挑战与我的理解
- **Reaction Time（点击反应）**：脚本会先点击“Start Challenge”，然后监听首次出现的 “CLICK NOW” 目标按钮，在限定时间内模拟点击，模拟 bot 精准速率。
- **Precision Timing（精确时刻）**：通过观察界面上的计时器数值，在它自然播到 4.998~5.002 秒时触发提交按钮；这个策略可以同步挑战自带的计时器，从而提高通过率。若失败会退回 LLM。
- **Visual Hash（哈希识别）**：解析提示文本中的字符串，利用 Web Crypto API 计算 SHA-256，取前 16 个字符输入，直接提交。
- **Cryptographic Chain（链式哈希）**：循环读取界面的上一次 hash，计算下一轮的 SHA-256，再自动输入提交，一共执行多步即可通过。
- **Prime Factorization（质因数分解）**：抓取题目里的数字，做简单的 trial division 并返回逗号分隔的质因数；若总循环超载则回退 LLM。
- **LLM 作为后备**：在直接解析失败或无法识别 challenge 时，通过后台的 OpenAI / deepseek-chat 调用，构造 JSON 格式答复，再交由内容脚本决定是否自动填入、是否依赖 agent 提示。

## 配置与使用
1. 打开 `chrome://extensions`，开启开发者模式后“加载已解压的扩展”，选择本项目根目录。
2. 点击扩展弹出页，确认或修改以下配置项（默认只填了 Base URL/模型，需要自己输入 API Key）：  
   - `openAiBaseUrl`：API 根地址
   - `openAiApiKey`：LLM 密钥
   - `openAiModel`：如 `deepseek-chat`
   - `autoPass`：启用后自动将 LLM 返回的答案填入并提交
3. 配置保存后访问 `https://clawptcha.com/try/`，内容脚本会显示状态徽章，提示直接自动解题或正在向 agent 请求。

## 我的理解
这个扩展不再只是“绕过 CAPTCHA”，而是在 Clawptcha 所设计的“反 UX”挑战之上搭建了一个多层代理架构：先用浏览器本身能做的精确计时 + SHA/因数分解逻辑完成直接验证；当挑战随机走向新形式或需要语义理解时，转而调用 LLM 产生结构化答案，再决定是否自动提交。Popup/Background 建立了一个配置闭环，让用户可以在不改动源码的情况下，换用不同的模型或关闭自动化；状态浮层则用于提供可靠的可观测性。我理解这个流程的目标是“让 agent 验证 agent 功能”，在官方页面里用自动化合规地向 bot 证明我是 bot，而非破坏性地绕过人类验证。

## 资源结构
- `manifest.json`：声明权限、图标、content script、背景 worker 与 popup。
- `background.js`：管理配置、构造 prompt、调用 OpenAI、提供 RPC 接口。
- `content-script.js`：侦测挑战、执行 solver、显示状态 badge、与 background 通讯。
- `popup.*`：页面 UI + 样式 + 脚本，用于保存配置与自动通过开关。
- `icons/`：提供 Chrome 扩展管理器所需的多分辨率 logo。

## 建议
- 若想调整精度，可在 `content-script.js` 中修改 Precision Timing 的窗口宽度或 Hash Solver 的步数。
- 如果计划替换 LLM，可在 popup 中设置新 API 地址/Key（后台会自动持久化）。
- 测试时建议打开 Chrome DevTools 控制台查看内容脚本的状态提示与任何异常，以便快速调优。

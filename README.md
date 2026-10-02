> **重做进行中（R1：清场 + 新壳）**：本仓库正在重做为《机匠 WRIGHT》（浏览器里的机甲维修工坊）。当前分支只保留空舞台与新主题壳，旧的全息 HUD / 地球 / 战甲 / 高德地图等功能已移除；下方内容是旧版说明，将在 R9 整体重写。重做方案见 `docs/` 之外的设计笔记。

# J.A.R.V.I.S. Holographic Interface

本仓库是 [xxjun9527/jarvis-holographic](https://github.com/xxjun9527/jarvis-holographic) 的 fork 焕新版。这个 fork 完成了安全加固与依赖升级（秘密 Key 只在服务端代理）、`App.tsx` 拆分重构与命令解析单测、去 CDN 的资源本地化与 GLB 压缩，以及 README 与 CI。fork 维护：**50pac**；原作者：**xxjun9527**。

## 简介与特性

这是一个受钢铁侠 HUD 启发的交互演示：摄像头画面与 MediaPipe 手势识别驱动 3D 地球和战术地形，叠加全息 HUD、扫描与情报面板。还支持语音或键盘文字命令、DeepSeek 对话、高德地图及钢铁侠战甲模型。场景由 React、React Three Fiber（R3F）和 three.js 渲染，音效与朗读由浏览器提供。

## 截图

截图待补充。请将图片放入 `docs/screenshots/`；命名和 README 引用方式见 [截图约定](docs/README.md)。此处暂不引用尚不存在的图片。

## 快速开始

需要 **Node.js >=20.12** 和 npm。首次安装可用 `npm install`；CI 或按锁文件可复现安装用 `npm ci`。

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local，按需填写 LLM 与高德配置
npm run dev
```

`npm run dev` 用 `concurrently` 同时启动 Vite 前端（http://localhost:3000）和 Node 代理（默认 http://localhost:8787）。首次进入需要允许浏览器访问摄像头；语音识别建议使用 Chrome，并确保浏览器能连接其语音服务。

生产构建与本地运行：

```bash
npm run build
npm start
# 默认访问 http://localhost:8787
```

`npm start` 由 `server/index.js` 托管构建后的 `dist/` 和 `/api`，因此要先构建。其他脚本：

| 脚本 | 用途 |
| --- | --- |
| `npm run dev:web` | 只启动 Vite 前端；API 仍需另开代理 |
| `npm run dev:server` | 只启动 Node 代理 |
| `npm run preview` | 用 Vite 预览已有构建产物 |
| `npm run typecheck` | TypeScript 静态检查 |
| `npm test` | 运行 Vitest 命令解析单测 |

## 架构

```text
浏览器：React + Vite + R3F + MediaPipe
  ├─ 本地摄像头、手势、3D/HUD、Web Speech API
  ├─ /api/*、/_AMapService/* ──> server/index.js（Express 5）
  │                              ├─ /api/health：健康检查
  │                              ├─ /api/config：高德 JS Key 与配置状态
  │                              ├─ /api/llm：代理 DeepSeek 对话
  │                              └─ /_AMapService：附加高德安全码
  └─ webapi.amap.com：高德 JS API 与地图资源
```

`LLM_API_KEY` 和 `AMAP_SECURITY_CODE` 只在服务端使用，不写入浏览器 bundle。`AMAP_KEY` 是 Web 端 JS API Key，会经 `/api/config` 下发到浏览器；它本来就是公开 Key，必须在高德控制台设置域名白名单。开发时 Vite 将 `/api` 和 `/_AMapService` 转发至 Node 服务；生产时 Node 同时托管前端与 API。

## 目录结构

以下依据本仓库 `git ls-files` 中的文件整理；`public/` 的二进制资源按用途概括。

```text
.
├─ commands/                 命令解析器与 Vitest 单测
│  ├─ commandParser.ts        唤醒词、定位与命令优先级
│  └─ commandParser.test.ts   命令解析测试
├─ armors/                   战甲注册表、循环/存储/主题/快捷键纯函数及测试
├─ hooks/                    启动、键盘输入、语音识别/会话、换装状态和打字效果
│  ├─ useVoiceCommands.ts     命令执行、会话状态与场景控制
│  ├─ useSpeechRecognition.ts 浏览器语音识别生命周期
│  └─ useCommandInput.ts      Enter/Esc 键盘命令框
├─ components/               摄像头、3D 场景、HUD、地图、战甲与交互界面
│  ├─ VideoFeed.tsx           摄像头采集与手势状态
│  ├─ HolographicEarth.tsx    3D 地球与战术地形
│  ├─ HUDOverlay.tsx          HUD 与 GEO_INTEL 情报面板
│  ├─ AMapView.tsx            高德地图与手势平移/缩放
│  ├─ HolographicSuit.tsx     战甲 GLB / 程序化机甲与交互特效
│  └─ armor/                  ArmorPicker 战甲库面板、ProceduralMech 程序化机甲
├─ services/                 MediaPipe 资源/识别、LLM、物体/人脸检测和音效
│  ├─ mediapipeAssets.ts      本地 WASM 和模型的路径
│  └─ llmService.ts           同源 /api/llm 请求与错误提示
├─ server/index.js           Express 代理与 dist 静态托管
├─ public/                   原样发布的 MediaPipe WASM 与模型
│  ├─ mediapipe/wasm/        与 tasks-vision 版本配套的 WASM
│  └─ models/                手势、人脸、物体检测模型
├─ assets/                   构建时导入的地球贴图和战甲 GLB
│  ├─ img/                   地球纹理
│  └─ modules/ironman.glb    战甲模型
├─ types/                    Web Speech API 类型；根目录 types.ts 为交互类型
├─ docs/                     文档、screenshots/ 截图目录与 ci.yml.example（CI 工作流示例）
├─ App.tsx                   启动与主界面编排
├─ index.tsx / index.html    React 入口与页面模板
├─ index.css                 自定义样式
├─ postcss.config.js         PostCSS（Tailwind、Autoprefixer）
├─ tsconfig.json / vite-env.d.ts  TypeScript 配置与 Vite 类型声明
├─ metadata.json / prompt.md 原项目的应用元数据与初版提示词（保留）
├─ LICENSE                   MIT 许可证
├─ tailwind.config.js        Tailwind 扫描范围与主题
├─ vite.config.ts            Vite 开发代理与构建配置
├─ .env.example              环境变量模板
└─ package.json              脚本、Node 要求与依赖
```

## 手势与语音命令

手势数据来自 `components/VideoFeed.tsx`；地球、情报面板和地图的响应分别在对应组件中实现。距离使用摄像头画面归一化坐标。

| 手势 | 效果 |
| --- | --- |
| 右手移动 | 以 `landmarks[9]` 相对画面中心的水平/垂直位置控制地球旋转/倾斜速度；各轴绝对值 `>0.1` 才覆盖该轴默认速度。 |
| 左手拇指尖与食指尖距离 | 将捏合距离按 `0.02–0.18` 归一化为 `expansionFactor`；地球逐渐淡出、战术地形逐渐显现，平滑后的值 `>0.55` 触发地形模式切换音效。 |
| 右手捏合 `<0.05` | 在语音空闲且未显示战甲时弹出 `GEO_INTEL_LIVE` 情报面板；松开隐藏。 |
| 地图中右手强捏合 `<0.045` | 非飞行状态下，移动食指拖拽平移地图。 |
| 地图中左手 `expansionFactor <0.25` 持续 500 ms | 放大一级；保持同一姿势只触发一次。 |
| 地图中左手 `expansionFactor >0.6` 持续 500 ms | 缩小一级；保持同一姿势只触发一次。 |

语音和文字都交给 `commands/commandParser.ts` 解析。英文触发词大小写不敏感，关键词使用词边界，词间空白宽松：`scan   off` 可用；`discover`、`island` 不会误触发，`discover the map` 仍会打开地图。定位城市名保留原始大小写，清理后至少要有 2 个字符。

| 命令触发词（英文 / 中文） | 效果 |
| --- | --- |
| `scan off`、`stop scan` / `关闭扫描` | 关闭物体扫描 |
| `eye off` / `关闭右眼标记` | 关闭右眼标记 |
| `mark off`、`off mark`、`close mark` / `关闭 mark` | 隐藏战甲标记 |
| `map off`、`close map` / `关闭地图`、`关闭 map` | 关闭地图 |
| `over` | 结束唤醒会话，并关闭扫描、右眼标记、战甲标记与地图 |
| `locate to X` / `定位到 X` | 打开地图并定位城市 `X`；如 `locate to Paris`、`定位到北京` |
| `show mark` | 显示战甲标记与地图 |
| `stop`、`reset`、`land` / `landing`、`fly` | 分别停止、复位、降落、飞行的战甲动作；`fly` 同时显示地图 |
| `map` / `地图` | 打开地图并隐藏战甲标记 |
| `scan` / `扫描` | 开启扫描，关闭地图与战甲标记 |
| `eye` / `右眼` | 开启右眼标记 |
| `zoom in` / `放大`；`zoom out` / `缩小` | 地图放大 / 缩小一级 |

匹配优先级是 **关闭类 > `over` > 定位 > `show mark` > 战甲切换（`next/previous armor`、`下一套`/`上一套`、具体战甲名） > 战甲库（`换装`/`armor`…，且句中没有 `stop`/`reset`/`land`/`fly`） > `stop` / `reset` / `land(ing)` / `fly` > 地图 > 扫描 > 右眼 > 缩放**。同一战甲动作组内按 `stop`、`reset`、`land(ing)`、`fly` 匹配；缩放同时出现时先匹配放大。

唤醒词包括 `hello jarvis`、`hey jarvis`、`你好 jarvis`、`jarvis`；`isWakeWord` 用 `includes` 检查，因此包含 `jarvis` 的句子也可唤醒。唤醒会话为 **60 秒**，会话内非命令内容发送给 DeepSeek；`over` 可提前结束。语音识别的 `lang` 固定为 `en-US`，所以中文命令更适合键盘输入：按 **Enter** 打开命令框，再按 Enter 提交；按 **Esc** 关闭。

## 战甲库

按 `show mark` 显示战甲后，可在“战甲库”里一键换装。所有战甲定义集中在 `armors/armorRegistry.ts`，全部靠代码与现有 `ironman.glb` 实现，**没有新增任何模型/二进制资源，不依赖外部下载**。

| id | 名称 | 实现方式 | 语音/文字关键词 |
| --- | --- | --- | --- |
| `mark-85` | Mark 85 / 马克85 | 原 `ironman.glb`，保持原样 | `mark 85`、`mark85`、`马克85` |
| `mark-3` | Mark 3 红金经典 | 复用同一 glb，材质覆盖（红金 + 暖橙发光） | `mark 3`、`mark3`、`马克3`、`红金` |
| `mark-42` | Mark 42 流线 | 复用同一 glb，材质覆盖（亮金红 + 冰蓝发光） | `mark 42`、`mark42`、`马克42`、`流线` |
| `stealth` | 夜行者 Stealth（黑金） | 复用同一 glb，材质覆盖（近黑 + 暗金 + 琥珀发光） | `stealth`、`夜行者`、`黑金` |
| `hulkbuster` | Hulkbuster 重型机甲 | `components/armor/ProceduralMech.tsx` 用基础几何体程序化生成 | `hulkbuster`、`反浩克`、`反浩克装甲`、`重型机甲` |
| `atlas` | 原创机甲 Atlas | 同上，参数不同（修长、四推进器） | `atlas`、`阿特拉斯`、`原创机甲` |

每套战甲带自己的 HUD 主题色（`theme`：主色 / 次色 / 发光色 / 扫描线色），切换时写入 CSS 变量 `--hud-primary`、`--hud-primary-rgb`、`--hud-secondary`、`--hud-glow`、`--hud-scanline`，HUD 主色与扫描线随之变化。当前战甲 id 存在 `localStorage`（键 `jarvis.armorId`），刷新后保持；`VITE_STATIC_DEMO=true` 的静态演示下同样可用。

**命令**（文字命令框或语音，经 `commands/commandParser.ts` 解析）：

| 命令 | 效果 |
| --- | --- |
| `换装`、`换甲`、`armor`、`suit up`、`战甲库` | 打开战甲库面板 |
| `mark 85`、`mark 3`、`mark 42`、`stealth`、`hulkbuster`、`atlas` 或中文名 | 直接切换到该战甲 |
| `next armor`、`下一套` / `previous armor`、`上一套` | 循环切换下一套 / 上一套 |

注意 `mark` 的关系：`show mark`（显示战甲）和 `mark off` / `close mark`（隐藏战甲）优先级更高；单独的 `mark` 不会被当作战甲，`mark 3` 才是 Mark 3。

**快捷键**：`A` 开关战甲库；面板打开时 `←` / `→` 切换，`Enter` 确认并关闭，`Esc` 关闭；也可直接点击卡片。命令输入框或其它输入框聚焦时快捷键不生效。

**换装动效**：约 1.2 秒。程序化机甲为“零件飞入组装”；glb 战甲为主题色扫描环 + 粒子汇聚 + 展开。同时播放合成音效（参数取自战甲的 `sound`），J.A.R.V.I.S. 以字幕和 TTS 播报 “Armor switched to Mark 3”。

**如何新增一套战甲**：往 `armors/armorRegistry.ts` 的 `builtIns` 数组里加一项 `ArmorDef`（`id`、`nameEn`/`nameZh`、`aliases`、`kind: 'glb' | 'procedural'`、`materialOverride` 或 `mech`、`theme`、`sound`、`description`、`stats`），别名在全部小写、去空白后不得与其它战甲的 id/名称/别名重复（`armors/armorRegistry.test.ts` 会检查）。运行时也可以调用 `registerArmor(def)` 追加条目（战甲库和语音命令会立即识别，为用户自带 glb 预留），`unregisterArmor(id)` 删除（内置六套不可删）。

## 配置说明

复制 `.env.example` 为 `.env.local`。`server/index.js` 依次用 `process.loadEnvFile` 读取 `.env.local` 和 `.env`；已存在的进程环境变量优先，先读取的 `.env.local` 值也优先于 `.env`。真实 Key 不要提交到仓库。

| 变量 | 用途与默认值 |
| --- | --- |
| `PORT` | Node 服务端口，默认 `8787` |
| `HOST` | 可选，Node 监听地址，默认 `0.0.0.0` |
| `LLM_BASE_URL` | LLM API 根地址，默认 `https://api.deepseek.com` |
| `LLM_API_KEY` | 服务端 DeepSeek API Key；留空时 LLM 不可用 |
| `LLM_MODEL` | 模型名，默认 `deepseek-chat` |
| `AMAP_KEY` | 高德 Web 端（JS API）Key，通过 `/api/config` 下发 |
| `AMAP_SECURITY_CODE` | 高德安全码，仅服务端代理使用 |

DeepSeek 请求由服务端非流式 `POST {LLM_BASE_URL}/v1/chat/completions` 发送；`/api/llm` 会校验消息角色、数量与长度（最多 20 条、单条 8000 字符、合计 24000 字符，JSON 请求体上限 32 KB）。未设置 `LLM_API_KEY` 时返回 503，界面显示 **“Systems offline.”**

高德 JS Key 经 `/api/config` 下发，浏览器从 `webapi.amap.com` 加载 JS API；高德安全码由 `/_AMapService` 代理附加为 `jscode`，不要放进前端。在高德开放平台为 Web 端（JS API）Key 配置域名白名单，包含本地 `localhost` 和实际部署域名。

## 静态资源与模型

`public/mediapipe/wasm/` 和 `public/models/` 随站点本地发布。升级 `@mediapipe/tasks-vision` 时，要把**同版本**的 WASM 文件重新复制到 `public/mediapipe/wasm/`：

```bash
cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/wasm/
```

战甲模型位于 `assets/modules/ironman.glb`。第 4 步用 meshopt + WebP 将其从约 **68.2 MB 压到 12.3 MB**，保留原三角面；当时使用的参数如下（重新压缩时将输入/输出路径替换为实际文件）：

```bash
npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --simplify false
```

模型由 `useLoader(GLTFLoader)` 配合 `MeshoptDecoder` 加载。避免改用 drei `useGLTF` 的默认 Draco 配置，它会请求 `gstatic`。WebP 贴图需要现代浏览器。Tailwind CSS 在构建期生成；新增源码目录时，确保 `tailwind.config.js` 的 `content` 覆盖它。当前扫描 `./index.html` 与 `./**/*.{ts,tsx}`，排除 `node_modules/`、`dist/`。

**模型许可需自行核对。**原版 README 称钢铁侠模型“仅用于演示与交互，不得用于商业用途”；当前 GLB 内嵌元数据则标注标题 **Iron Man Mark 85**、作者 [LLIypuk](https://sketchfab.com/LLIypuk)、许可 **CC-BY-4.0**、[Sketchfab 来源](https://sketchfab.com/3d-models/iron-man-mark-85-8da781aa74024366844b36444c650d69)。两处表述并列保留；商用或再分发前请以 Sketchfab 页面当前许可为准自行核对，至少按 CC-BY 要求署名。`gesture_recognizer`、`face_landmarker`、`efficientdet_lite0` 来自 Google MediaPipe 模型库；商用前请逐一核对模型卡片许可。

高德地图需要联网访问 `webapi.amap.com`，DeepSeek 对话也需要服务端访问其 API；其余前端静态资源均在本地，不依赖运行时 CDN。

## 已知限制

- 尚未在真实摄像头与 GPU 上完整实测手势识别和战甲交互；此前用假摄像头、软件渲染和独立 GLB 页面做过冒烟验证。
- 高德地图需要联网；语音识别依赖浏览器支持（建议 Chrome）及其在线语音服务，语言固定为 `en-US`。
- 仓库 Git 历史仍保留原始约 68 MB GLB；`public/` 中的 WASM 与模型二进制约 37 MB。
- WebP 贴图需要现代浏览器；troika 的 Unicode 字体目录目前没有实际文件，非 ASCII 的 3D 文字可能缺字。
- 在非根路径部署开发或生产站点时，需要设置合适的 Vite `base`，并检查同源 API 路径。

## 常见问题

| 现象 | 检查方式 |
| --- | --- |
| 摄像头没有画面 | 检查浏览器/系统权限、是否被其他应用占用，以及 HTTPS 或 `localhost` 安全上下文。 |
| 没有声音或 TTS | 先点击初始化按钮以解锁浏览器音频；确认系统音量、浏览器语音合成和可用语音。 |
| 语音不识别 | 使用 Chrome，允许麦克风，并确认其语音服务可访问；识别语言为 `en-US`，中文可改用键盘文字输入。 |
| 高德地图空白 | 检查 `AMAP_KEY`、`AMAP_SECURITY_CODE`、JS Key 域名白名单及与高德服务的网络连接。 |
| LLM 显示 `Systems offline.` | 服务端未配置 `LLM_API_KEY`；填写 `.env.local` 后重启 Node 服务。 |
| 端口冲突 | 用 `PORT` 修改 Node 端口，同时设置同值 `PROXY_PORT` 让 Vite 指向它；Vite 前端默认使用 3000。 |
| 安装时提示 Node 引擎警告 | 检查 `node --version`，使用 Node >=20.12。 |
| `npm start` 后白屏 | 先执行 `npm run build`，确认 `dist/` 已生成。 |

## 开发与 CI

本地提交前可运行 `npm run typecheck`、`npm test`、`npm run build`。

CI 工作流示例在 [docs/ci.yml.example](docs/ci.yml.example)：Node 20，`actions/checkout` 与带 npm 缓存的 `actions/setup-node`，依次执行 `npm ci`、类型检查、单测、构建和生产依赖高危及以上漏洞审计（`npm audit --omit=dev --audit-level=high`）。由于推送用令牌没有 `workflow` 权限，它暂未放在 `.github/workflows/`；有权限的维护者启用方式：

```bash
mkdir -p .github/workflows
cp docs/ci.yml.example .github/workflows/ci.yml
```

## 部署

本地/局域网、Docker、Fly.io / Render / Nginx 反代 + HTTPS，以及纯静态演示（无后端时 LLM 与高德不可用）的步骤、环境变量与示例配置见 [docs/DEPLOY.md](docs/DEPLOY.md)。摄像头与麦克风要求 HTTPS 或 localhost。

## 许可证

仓库代码按 [MIT 许可证](LICENSE) 发布。第三方模型、地图服务与素材遵循各自条款，参见上文模型许可说明。

## 致谢

- 上游项目：[xxjun9527/jarvis-holographic](https://github.com/xxjun9527/jarvis-holographic)。
- 战甲模型：[LLIypuk 的 YouTube](https://www.youtube.com/@LLIypuk) 与 [Sketchfab 模型页面](https://sketchfab.com/3d-models/iron-man-mark-85-8da781aa74024366844b36444c650d69)。
- 3D 与界面：[three.js](https://threejs.org/)、[react-three-fiber](https://github.com/pmndrs/react-three-fiber)、[drei](https://github.com/pmndrs/drei)、[Tailwind CSS](https://tailwindcss.com/)、[Vite](https://vite.dev/)。
- 识别与服务：[MediaPipe Tasks Vision](https://developers.google.com/mediapipe)、[DeepSeek](https://www.deepseek.com/)、[高德开放平台](https://lbs.amap.com/)、[Express](https://expressjs.com/)。
- 字体：[Fontsource Orbitron](https://fontsource.org/fonts/orbitron)、[Fontsource Rajdhani](https://fontsource.org/fonts/rajdhani)。
- 声效与 HUD 视觉灵感来自科幻 UI 与开源社区。

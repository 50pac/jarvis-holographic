# 部署指南

本文说明如何把本仓库跑到生产环境（Docker / Compose / 反代）或纯静态演示站。**本仓库本身没有已部署的线上实例**——请自行选择托管平台并按下方示例配置。

摄像头与麦克风只能在 **HTTPS** 或 **localhost** 下使用；公网部署务必开 HTTPS。

## 快速：Docker 构建与运行

```bash
# 1. 准备环境变量（勿提交真实密钥）
cp .env.example .env
# 编辑 .env：填入 LLM_API_KEY、AMAP_KEY、AMAP_SECURITY_CODE 等

# 2. 构建并启动（默认宿主机 8787 → 容器 8787）
docker compose up -d --build

# 健康检查
curl -s http://127.0.0.1:8787/api/health
# 期望：{"ok":true}
```

常用 Compose 变量：

| 变量 | 含义 | 默认 |
|------|------|------|
| `HOST_PORT` | 宿主机对外端口（映射到容器 `8787`） | `8787` |
| `env_file` | Compose 读取 `.env` | `.env` |

仅本机访问、前面还有 Nginx 时，建议把 `ports` 改成 `127.0.0.1:${HOST_PORT:-8787}:8787`（见 `docker-compose.yml` 注释）。

也可以不用 Compose，直接：

```bash
docker build -t jarvis-holographic .
docker run --rm -p 8787:8787 --env-file .env \
  -e HOST=0.0.0.0 -e PORT=8787 jarvis-holographic
```

镜像为多阶段构建：构建阶段 `npm ci` + `npm run build`；运行阶段只装生产依赖，以 `node` 用户跑 `server/index.js`，并对 `/api/health` 做 HEALTHCHECK。

## 关键环境变量

### 代理服务端（`server/`，运行时）

| 变量 | 说明 |
|------|------|
| `HOST` | 监听地址；容器内一般为 `0.0.0.0` |
| `PORT` | 监听端口，默认 `8787` |
| `TRUST_PROXY` | 是否信任 `X-Forwarded-*`。默认不信任（防伪造 IP 绕过限流）。反代后建议设为跳数，如 `1`；也可 `true`/`false` 或子网列表 |
| `ALLOWED_ORIGIN` | 可选，逗号分隔的浏览器 Origin 白名单；作用于 `/api/llm` 与 `/_AMapService`。带 Origin 且不在名单 → `403 origin_not_allowed`；无 Origin（curl/同源）放行 |
| `RATE_LIMIT_LLM_PER_MIN` / `RATE_LIMIT_LLM_BURST` | LLM 令牌桶：每分钟补给 / 突发容量；默认 `20` / `10`；任一为 `0` 则禁用 |
| `RATE_LIMIT_AMAP_PER_MIN` / `RATE_LIMIT_AMAP_BURST` | 高德代理限流；默认 `600` / `120` |
| `HSTS` | `1` 时仅在 HTTPS 请求（`req.secure`，依赖 trust proxy）上发 HSTS |
| `CSP_REPORT_ONLY` | `1` 时发 `Content-Security-Policy-Report-Only`，便于联调观察 |
| `CSP_SCRIPT_UNSAFE_EVAL` | `1` 时给 CSP `script-src` 追加 `'unsafe-eval'`（仅当确认高德脚本需要时打开） |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | DeepSeek（OpenAI 兼容）上游 |
| `AMAP_KEY` / `AMAP_SECURITY_CODE` | 高德 JS Key（经 `/api/config` 下发）与安全码（仅服务端，经 `/_AMapService` 注入） |

完整注释见仓库根 `.env.example`。

### 构建时（Vite，不进 Node 进程）

| 变量 | 说明 |
|------|------|
| `VITE_STATIC_DEMO` | `true` 时打出无后端静态演示包：LLM/高德走占位提示，不请求 `/api/*` |
| `VITE_BASE` | 子路径前缀，如 `/jarvis-holographic/`（GitHub Pages）；默认 `/` |

示例：

```bash
VITE_STATIC_DEMO=true VITE_BASE=/jarvis-holographic/ \
  npx vite build --outDir /tmp/dist-static --emptyOutDir
```

把 `/tmp/dist-static` 丢到任意静态托管即可（无 Node、无 LLM/高德）。

## 安全模型（简要）

实现集中在 `server/security.js`，由 `server/index.js` 接线：

1. **Origin 白名单**（可选）：先于限流；只拦带 `Origin` 且不匹配的浏览器跨域请求。
2. **按 IP 令牌桶限流**：`/api/llm` 与 `/_AMapService`；`/api/health`、`/api/config` 不限流。超限 `429` + `Retry-After`。
3. **安全响应头**：CSP、`X-Content-Type-Options`、`X-Frame-Options`、`Permissions-Policy`（camera/mic 仅 self）、`Referrer-Policy: strict-origin-when-cross-origin`。
   - **不要**改成 `no-referrer`：高德控制台域名白名单依赖 Referer。
   - CSP 已允许 `https://webapi.amap.com`、`'wasm-unsafe-eval'`、`blob:` worker 等；真机联调可先 `CSP_REPORT_ONLY=1`。
4. **TRUST_PROXY 陷阱**：错误设为 `true` 且直接暴露公网时，客户端可伪造 `X-Forwarded-For`，限流按假 IP 计数。只信任你控制的反代跳数（如 Nginx/Fly/Render 前的 `1`）。反代应用真实客户端 IP **覆盖**（不要追加）`X-Forwarded-For`。
5. **静态缓存**：带 hash 的 `dist/assets/*` 用长期 immutable；`index.html` 用 `no-cache`。

密钥只放服务端环境变量 / 平台 Secrets，**不要**写进前端包或仓库。

## 平台选项（示例配置，需自行复制启用）

以下文件只是**示例**，放在 `docs/` 以免误触发平台自动部署。选用后请复制到仓库根并按注释改名、改域名与密钥：

| 平台 | 示例文件 | 用法摘要 |
|------|----------|----------|
| Fly.io | [docs/fly.toml.example](./fly.toml.example) | 复制为根目录 `fly.toml` → `fly secrets set …` → `fly deploy`；示例设 `TRUST_PROXY=1`、`force_https` |
| 自有机 + Nginx | [docs/nginx.conf.example](./nginx.conf.example) | Node/Compose 只听 `127.0.0.1:8787`；Nginx 终止 TLS 并反代；Node 设 `TRUST_PROXY=1`、`ALLOWED_ORIGIN`、`HSTS=1`。**不要**在 Nginx 再叠一份 CSP |
| Render | [docs/render.yaml.example](./render.yaml.example) | 复制为根目录 `render.yaml`，控制台 New → Blueprint；密钥 `sync: false` 在面板填写 |

任选其一或其它 PaaS（只要能跑 Docker 或 `node server/index.js` + 静态 `dist/`）。部署后请在高德控制台把 JS Key 的域名白名单改成你的正式域名。

## 纯静态演示路径

适合 GitHub Pages、对象存储静态站等、**不需要**后端的场合：

```bash
VITE_STATIC_DEMO=true VITE_BASE=/你的子路径/ npm run build
# 或指定 outDir，避免覆盖默认 dist/
```

行为：

- LLM：返回 JARVIS 风格英文提示，说明静态演示无后端。
- 高德：不请求 `/api/config`，界面显示「静态演示模式：无后端，高德地图不可用」。
- 手势/战甲/本地 MediaPipe 资源仍可用（同源静态文件）。

需要完整 LLM + 高德时，请用上文 Docker / Node 部署，而不是静态演示包。

## 本地非 Docker 生产启动

```bash
npm ci
npm run build
cp .env.example .env   # 填密钥
npm start              # node server/index.js，托管 dist/
```

开发联调仍用 `npm run dev`（Vite :3000，代理到代理服务）。

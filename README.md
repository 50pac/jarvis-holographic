<div align="center">
  <img width="1200" height="475" alt="JARVIS Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# J.A.R.V.I.S. Holographic Interface

一个受钢铁侠 HUD 启发的未来感 AR/3D 交互界面。通过摄像头与手势识别控制全息地球、数据面板与科幻音效，适合创意展示、科普演示或人机交互原型。

> 语言：中文（界面与文案） | 技术栈：React + Vite + Three.js + MediaPipe

## 功能亮点

- 全息地球：可旋转、倾斜、线框与云层叠加的发光地球效果（`components/HolographicEarth.tsx`）
- 战术地形：左手“展开”手势切换到战术地形视图与目标标记动画
- 手势控制：
  - 右手水平移动控制旋转，垂直移动控制倾斜（`components/VideoFeed.tsx:94-103`）
  - 右手捏合显示/隐藏情报面板（`components/HUDOverlay.tsx:266-278`）
  - 左手张开程度控制缩放/展开（`components/VideoFeed.tsx:82-88`）
- 摄像头与骨骼绘制：Canvas 渲染双手骨架与动态指尖/手掌指示（`components/HUDOverlay.tsx`）
- 启动序列与语音：系统引导动画与 TTS 声音提示（`components/JarvisIntro.tsx`、`services/soundService.ts`）
- 科幻 HUD：尾迹/扫描线/仪表盘/数据源列表等多层叠加的 UI（`components/HUDOverlay.tsx`）

## 技术栈

- `React 18`、`TypeScript`、`Vite 6`
- `three`、`@react-three/fiber`、`@react-three/drei`、`@react-three/postprocessing`
- `@mediapipe/tasks-vision`（手势识别，WASM 加载包含主/备 CDN）
- `TailwindCSS`（通过 CDN 在 `index.html` 注入样式与动画）

## 快速开始

**环境要求**

- Node.js（建议 LTS）
- 现代浏览器（Chrome/Edge），需支持 WebGL、WebAudio、SpeechSynthesis 与摄像头权限

**安装与运行**

1. 安装依赖：
   
   ```bash
   npm install
   ```

2. 开发运行（默认 `http://localhost:3000`）：
   
   ```bash
   npm run dev
   ```

3. 生产构建与本地预览：
   
   ```bash
   npm run build
   npm run preview
   ```

**可选：环境变量**

- 如需集成 Gemini API，可在项目根目录创建 `.env.local` 并设置：
  
  ```env
  GEMINI_API_KEY=your_api_key_here
  ```
  
- Vite 会在 `vite.config.ts:14-16` 中注入 `process.env.GEMINI_API_KEY`，当前仓库代码未直接使用该变量，属后续扩展预留。

## 手势交互说明

- 右手旋转/倾斜：将右手在画面中水平移动控制地球自转，垂直移动控制整体倾斜（`components/VideoFeed.tsx:94-103`、`components/HolographicEarth.tsx:320-347`）
- 右手捏合：拇指与食指靠近触发捏合，显示/隐藏情报面板（`components/HUDOverlay.tsx:266-278`）
- 左手展开：张开程度映射为扩展因子，控制缩放并在阈值后进入战术地形模式（`components/VideoFeed.tsx:82-88`、`components/HolographicEarth.tsx:349-391`）

## 项目结构

```
├─ components/
│  ├─ VideoFeed.tsx         # 摄像头采集与 MediaPipe 手势识别
│  ├─ HolographicEarth.tsx  # Three.js 全息地球与战术地形
│  ├─ HUDOverlay.tsx        # HUD 叠加层与情报面板、骨架绘制
│  └─ JarvisIntro.tsx       # 启动序列动画
├─ services/
│  ├─ mediapipeService.ts   # WASM 加载与 GestureRecognizer 初始化
│  └─ soundService.ts       # WebAudio 音效与 TTS
├─ index.html               # Tailwind CDN、字体与 importmap
├─ index.tsx                # React 挂载入口
├─ App.tsx                  # 应用状态/层级组合
├─ types.ts                 # 类型与枚举（区域名等）
├─ package.json             # 脚本与依赖
├─ vite.config.ts           # Vite 配置与环境变量注入
└─ tsconfig.json            # TypeScript 编译配置
```

## 开发与构建

- 开发端口与主机在 `vite.config.ts:8-11` 配置（`3000`、`0.0.0.0`）
- Tailwind 使用 CDN 注入，如需按需编译可改为本地 PostCSS/Tailwind 集成
- Three.js 纹理资源来自官方示例仓库，网络不佳时可替换为本地资源（见 `components/HolographicEarth.tsx:299-303`）

## 部署建议

- 任何静态托管均可（Vercel、Netlify、GitHub Pages 等）：
  - 构建产物在 `dist/`，上传即可
  - 如开启跨域或使用自定义 CDN，确保 MediaPipe WASM 与纹理资源可访问

## 权限与隐私

- 本项目需要摄像头权限以进行手势识别，权限声明见 `metadata.json:4-6`
- 摄像头画面仅在本地浏览器处理，不会上传到任何服务器
- 音频播放与语音合成可能需要用户交互以激活（浏览器策略）

## 浏览器兼容与注意事项

- 初次访问可能因自动播放策略导致视频/音频需要点击触发（`components/VideoFeed.tsx:31-43`、`services/soundService.ts:6-16`）
- 若 MediaPipe 主 CDN 加载失败，代码会自动回退到备用 CDN（`services/mediapipeService.ts:17-28`）
- 请在光线充足且背景干净的环境下进行手势识别以获得最佳效果

## 常见问题

- 无法获取摄像头：检查浏览器权限设置，或在 HTTPS 环境下访问
- 声音无法播放：进行至少一次点击以启用 `AudioContext`（浏览器自动播放限制）
- 性能较低：降低分辨率或在高性能设备/桌面浏览器运行；关闭其他占用 GPU 的页面

## 许可

- 建议为仓库添加开源许可（例如 MIT）。如未提供单独的 `LICENSE`，默认以 README 为说明文档，不构成法律许可义务。

## 联系方式:

- 微信：xxjun9527
# YouTube 字幕下载器 Web 应用

这是一个基于 Next.js 和 TypeScript 构建的 YouTube 字幕下载器 Web 应用，可以帮助您轻松下载 YouTube 视频的字幕文件。

## 功能特点

- 支持下载 YouTube 自动生成的英文字幕和手动添加的英文字幕
- 提供多种字幕格式选择（VTT、SRT 和 TXT）
- 支持一键粘贴视频链接
- 响应式设计，适配各种设备
- 简洁易用的界面

## 技术栈

- **前端框架**: Next.js 14
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **HTTP 客户端**: Axios
- **XML 解析**: xml-js

## 系统要求

- **Node.js**: 18.17.0 或更高版本
- **npm**: 9.0.0 或更高版本

## 开发环境设置

1. 确保您的 Node.js 版本符合要求:




















































































































































































   ```
   node -v  # 应该是 v18.17.0 或更高版本
   ```
   如果您使用 nvm，可以运行:
   ```
   nvm use
   ```

2. 克隆仓库:
   ```
   git clone https://github.com/yourusername/youtube-subtitle-downloader.git
   cd youtube-subtitle-downloader/web
   ```

3. 安装依赖:
   ```
   npm install
   ```

4. 启动开发服务器:
   ```
   npm run dev
   ```

5. 在浏览器中访问 `http://localhost:3000`

## 构建生产版本

```
npm run build
```

构建完成后，可以使用以下命令启动生产服务器:

```
npm run start
```

## 项目结构

```
web/
├── public/              - 静态资源文件
├── src/                 - 源代码
│   ├── app/             - Next.js App Router 页面
│   ├── components/      - React 组件
│   ├── services/        - 服务层
│   │   ├── subtitleService.ts    - 字幕处理服务
│   │   ├── youtubeApiService.ts  - YouTube API 交互服务
│   ├── types/           - TypeScript 类型定义
│   └── utils/           - 实用工具
│       └── urlUtils.ts  - URL 处理工具
├── .eslintrc.json      - ESLint 配置
├── next.config.js      - Next.js 配置
├── package.json        - 项目依赖
├── postcss.config.js   - PostCSS 配置
├── tailwind.config.js  - Tailwind CSS 配置
└── tsconfig.json       - TypeScript 配置
```

## 使用方法

1. 在输入框中粘贴 YouTube 视频链接
2. 选择字幕类型（自动生成或手动添加的英文字幕）
3. 选择输出格式（VTT、SRT 或 TXT）
4. 点击"下载字幕"按钮
5. 字幕文件将自动下载到您的计算机

## 注意事项

- 仅支持 YouTube 网站的视频
- 视频必须包含字幕才能下载
- 目前仅支持英文字幕

## 许可证

MIT License
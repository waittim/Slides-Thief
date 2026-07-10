# Slides Thief Web

Slides Thief Web 是 Slides Thief 的网页版。普通用户可以直接打开：

[https://www.zekun.blog/Slides-Thief/](https://www.zekun.blog/Slides-Thief/)

它会在浏览器本地处理照片、调整幻灯片角点并生成 PDF，不需要安装软件，也不会把原始照片上传到服务器。

## 用户功能

- 支持 JPEG、PNG、WebP、HEIC 和 HEIF 图片。
- HEIC/HEIF 会先在浏览器里转换成 JPEG，再进入现有幻灯片处理流程。
- 在 Web Worker 中自动识别幻灯片边界，页面不会被长时间卡住。
- 支持在画布上拖动四个角点进行手动修正。
- 使用 `pdf-lib` 在浏览器本地生成 PDF。
- 没有服务器存储，也没有上传接口。

大批量 HEIC/HEIF 照片可能会启动得慢一些，因为浏览器端使用的是 JavaScript/WASM 转换器，不是系统原生图片解码器。

## 本地开发

使用 Node.js 22.13 或更新版本。第一次开发前安装依赖：

```bash
npm ci
```

本地预览使用 Vinext/Cloudflare/Vite 应用栈。GitHub Pages 发布使用 `pages/` 里的专用静态 Vite 构建入口。

```bash
npm run dev
npm run build
npm run build:pages
npm run preview:pages
npm test
```

## 发布到 GitHub Pages

GitHub Pages 使用静态构建：

```bash
npm run build:pages
```

生成文件会写入 `dist-pages/`。当前仓库默认使用 `/Slides-Thief/` 作为 base path；在 GitHub Actions 中会根据 `GITHUB_REPOSITORY` 自动推导。测试用户或组织主页站点时，可以用 `GITHUB_PAGES_BASE=/` 覆盖。

发布由 `.github/workflows/deploy-pages.yml` 处理。GitHub 仓库中保持 Settings -> Pages -> Build and deployment -> Source 为 GitHub Actions，然后 push 到 `main` 即可。

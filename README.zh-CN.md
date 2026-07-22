# Slides Thief · PPT捕手

[![Website](https://img.shields.io/badge/Website-slidesthief.com-brightgreen)](https://slidesthief.com/) [![Blog](https://img.shields.io/badge/Blog-zekun.blog-blue)](https://www.zekun.blog/2026/07/13/slides-thief/) [![Python 3.9+](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/downloads/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md)

Slides Thief · PPT捕手 可以批量把拍歪的演示文稿照片拉正，并合成为一个干净的 PDF。它适合会议室、讲座、课堂、展会等场景：只要你拍到了投影屏幕或显示器里的幻灯片，就可以快速整理成可阅读、可分享的文件。

## 在线使用

打开网页版：

[https://slidesthief.com/](https://slidesthief.com/)

不需要安装软件。照片处理和 PDF 生成都在你的浏览器本地完成，网页不会把原始照片上传到服务器。

## 使用方法

1. 打开网页，选择或拖入照片。
2. 点击“自动校正”，自动识别幻灯片四个角。
3. 检查左侧缩略图和主预览。
4. 如果某一页不准，拖动画布上的四个角点手动修正。
5. 点击“生成 PDF”。
6. 点击“下载 PDF”保存结果。

## 支持文件

| 格式 | 网页版 | CLI |
| --- | --- | --- |
| JPEG / JPG | 支持 | 支持 |
| PNG | 支持 | 支持 |
| WebP | 支持 | 不支持 |
| TIFF | 不支持 | 支持 |
| HEIC / HEIF | 支持 | 支持 |

HEIC 和 HEIF 会先转换为 JPEG 再处理：网页版在浏览器内转换，CLI 使用 macOS `sips`。大批量 HEIC/HEIF 照片可能会比 JPEG 慢一些。

## 适合场景

- 屏幕或投影画面被拍歪了。
- 有很多页幻灯片照片，希望合成为一个 PDF。
- 自动识别整体正确，但有少数页面需要手动修正角点。
- 希望避免把原始照片上传到第三方服务。

## 主要功能

- 自动识别幻灯片边界。
- 手动四角修正。
- 支持 16:9、4:3、ISO A4/A3（横向与纵向）与 US Letter（横向与纵向）输出比例；纸张预设会自动以白色填充边距。
- 支持自定义输出宽度、质量、可选清晰增强模式和填充色。
- 支持浅色/深色主题，以及九种界面语言：简体中文、繁体中文、English、Español、Français、Deutsch、日本語、한국어、Português。
- 在浏览器本地生成 PDF。

CLI 额外支持 A5 纸张预设和任意自定义比例（如 `16:10`）。

## 本地命令行

在线网页版是默认推荐的交互流程。Python CLI 保留给高级本地使用：命令行批处理、保存中间文件、检测 overlay、接触表、机器可读报告，以及可复现的手动角点二次处理。

```bash
slides-thief ~/Downloads \
  --output-dir outputs/my_deck \
  --ratio 16:9 \
  --width 2400 \
  --pdf-name flattened_slides.pdf
```

主要输出：

- `flattened_slides.pdf`：合成后的 PDF。
- `corrected_images/`：每页一张拉正后的 JPEG。
- `detection_overlays/`：带自动识别四边形标记的原图。
- `corrected_contact_sheet.jpg`：快速检查拉正页面的接触表。
- `detection_contact_sheet.jpg`：快速检查识别角点的接触表。
- `manual_review.html`：用于拖动角点的浏览器页面。
- `manual_review_data.json`：手动校正页面使用的数据文件。
- `slide_lens_report.json`：包含角点和置信度的机器可读报告。

常用 CLI 选项（示例之外）：

- `--enhancement {original,clean,high-contrast,bw}`：校正后的可选可读性增强。
- `--height`：可选输出高度（像素），会覆盖由比例推算的高度。
- `--jpeg-quality`：校正图像的 JPEG 质量（默认 `92`）。
- `--work-dir`：中间工作目录（默认 `work/slide_lens_runtime`）。
- `--clean-converted`：运行结束后删除中间转换的 JPEG。

默认输出宽度为 `2200` 像素。完整选项列表请运行 `slides-thief --help`，详见 [docs/cli.md](docs/cli.md)。

### 手动修正后二次处理

自动识别是第一遍处理。当少数页面需要修正时，打开 `manual_review.html`，拖动编号角点修正问题页面，然后导出 `manual_quads.json`。

使用手动角点重新处理：

```bash
slides-thief ~/Downloads \
  --output-dir outputs/my_deck_refined \
  --manual outputs/my_deck/manual_quads.json \
  --ratio 16:9 \
  --width 2400
```

手动 JSON 会把每个源文件名映射到四个点，顺序如下：

```json
{
  "IMG_5995.HEIC": [[76.16, 549.26], [3796.73, 349.28], [3285.14, 2599.3], [76.16, 2276.4]]
}
```

点的顺序是左上、右上、右下、左下。

## 使用提示

当幻灯片的真实边界清晰可见时，自动识别效果最好。内部图表线条、屏幕边缘被裁切、手部遮挡、观众头部等仍然可能干扰识别。推荐流程是：先自动识别，检查结果，只修正异常页面，然后重新生成 PDF。

## 开发

安装 Python 开发依赖：

```bash
python -m pip install -e ".[dev]"
```

运行 Python 测试：

```bash
python -m pytest
```

网页工作区需要 Node.js 22.13 或更高版本：

```bash
cd site
npm ci
npm run dev          # Vinext/Cloudflare 开发服务器
npm run build        # 服务端渲染应用构建
npm run build:pages  # GitHub Pages 静态构建（输出到 dist-pages/）
npm test             # 构建两个目标并运行测试
```

Pages 基础路径与部署说明见 [site/README.md](site/README.md)。

## 项目结构

```text
src/slides_thief/       # Python CLI 与图像处理流水线
site/                   # React 网页应用；浏览器工作区与 Pages 构建
docs/                   # 面向人类与代理的稳定 Markdown 文档
schemas/                # CLI 输入与报告的 JSON Schema 契约
tests/                  # Python 回归测试
site/tests/             # 网页构建与渲染回归测试
pyproject.toml          # Python 构建、运行时与开发配置
```

生成任务、中间文件和包构建产物不会进入源码管理，通常位于 `outputs/`、`work/`、`dist/`、`*.egg-info/` 等已忽略路径下。
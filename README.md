# Slides Thief

Slides Thief 可以把手机或相机拍歪的演示文稿照片拉正，并合成为一个干净的 PDF。适合会议、课堂、讲座、展会等场景：只要你拍到了投影屏幕或显示器里的幻灯片，就可以用它快速整理成可阅读、可分享的文件。

## 在线使用

打开网页版：

[https://www.zekun.blog/Slides-Thief/](https://www.zekun.blog/Slides-Thief/)

网页版不需要安装软件。图片处理和 PDF 生成都在你的浏览器本地完成，照片不会上传到服务器。

## 使用步骤

1. 打开网页，拖入或选择照片。
2. 点击“自动拉伸”，让工具自动识别每张幻灯片的四个角。
3. 检查左侧缩略图和中间预览。
4. 如果某一页不准，拖动画布上的四个角点手动调整。
5. 点击“生成 PDF”。
6. 点击“下载pdf”保存文件。

## 支持格式

网页版支持：

- JPEG / JPG
- PNG
- WebP
- HEIC / HEIF

HEIC/HEIF 会先在浏览器里转换成 JPEG，再进入幻灯片拉伸流程。大批量 HEIC/HEIF 照片可能会比 JPEG 慢一些。

## 适合什么情况

- 拍摄角度歪了，幻灯片有透视变形。
- 一次拍了很多页，希望整理成一个 PDF。
- 自动识别大体正确，但有几页需要手动微调。
- 不想把照片上传到第三方服务器。

## 主要功能

- 自动识别幻灯片边界。
- 支持拖动四个角点进行人工修正。
- 支持 16:9 和 4:3 输出比例。
- 支持自定义导出宽度、质量、灰度、填充色。
- 支持浅色/深色主题和中文/英文界面。
- 在浏览器中直接生成 PDF。

## 本地版

如果你需要命令行批处理、保存中间结果、生成检测报告，或者希望使用原来的本地工作流，可以运行 Python 版。

## 本地使用

### 本地网页

启动本地网页：

```bash
slides-thief-web
```

然后打开：

```text
http://127.0.0.1:8765
```

在本地网页中可以：

- 拖入或选择所有源图片。
- 按文件名排序。
- 自动识别幻灯片边界。
- 在画布中检查每一页。
- 拖动四个编号角点进行手动修正。
- 使用修正后的角点生成 PDF。
- 打开或下载 PDF、接触表、报告和角点 JSON。
- 让界面自动跟随系统主题和浏览器语言，或在工具栏中手动选择亮色/深色和中文/英文。

本地网页任务默认写入 `outputs/web_jobs/`。每个任务会保留上传图片、自动处理结果、手动角点 JSON 和二次修正结果。

也可以修改服务地址或输出目录：

```bash
slides-thief-web --host 127.0.0.1 --port 8765 --jobs-dir outputs/web_jobs
```

### 命令行

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
- `corrected_contact_sheet.jpg`：快速检查拉正结果的接触表。
- `detection_contact_sheet.jpg`：快速检查识别角点的接触表。
- `manual_review.html`：用于拖动角点的本地审核页面。
- `slide_lens_report.json`：包含角点和置信度的机器可读报告。

### 手动修正后二次处理

自动识别只是第一遍。如果有少数页面需要修正，打开 `manual_review.html`，拖动编号角点调整问题页面，然后导出 `manual_quads.json`。

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

当幻灯片真实边界清晰可见时，自动识别效果通常更好。内部图表线条、屏幕被裁切、手部遮挡、观众头部等仍然可能干扰识别。推荐流程是：先自动处理，检查结果，只修正少数异常页面，然后用手动角点重新生成。

## 开发

安装测试和开发依赖：

```bash
python -m pip install -e ".[dev]"
```

运行 Python 测试：

```bash
python -m pytest
```

运行网页版测试：

```bash
cd site
npm ci
npm test
```

## 项目结构

```text
src/slides_thief/
  cli.py                  # image processing pipeline and command-line entry
  web.py                  # local HTTP workflow
  templates/app.html      # packaged web UI
site/                     # browser-only workspace and static Pages build
tests/                    # focused regression tests
pyproject.toml            # build, runtime, and development configuration
```

生成任务、中间文件和构建产物不会进入源码管理，通常位于 `outputs/`、`work/`、`dist/`、`*.egg-info/` 等已忽略路径下。

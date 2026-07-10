# Slides Thief · PPT捕手

[English](README.md)

Slides Thief · PPT捕手 可以把拍歪的演示文稿照片拉正，并合成为一个干净的 PDF。它适合会议室、讲座、课堂、展会等场景：只要你拍到了投影屏幕或显示器里的幻灯片，就可以快速整理成可阅读、可分享的文件。

## 在线使用

打开网页版：

[https://www.zekun.blog/Slides-Thief/](https://www.zekun.blog/Slides-Thief/)

不需要安装软件。照片处理和 PDF 生成都在你的浏览器本地完成，网页不会把原始照片上传到服务器。

## 使用方法

1. 打开网页，选择或拖入照片。
2. 点击“自动拉伸”，自动识别幻灯片四个角。
3. 检查左侧缩略图和主预览。
4. 如果某一页不准，拖动画布上的四个角点手动修正。
5. 点击“生成 PDF”。
6. 点击“下载 PDF”保存结果。

## 支持文件

网页版支持：

- JPEG / JPG
- PNG
- WebP
- HEIC / HEIF

HEIC 和 HEIF 文件会先在浏览器里转换为 JPEG，再进入幻灯片修正流程。大批量 HEIC/HEIF 照片可能会比 JPEG 慢一些。

## 适合场景

- 屏幕或投影画面被拍歪了。
- 有很多页幻灯片照片，希望合成为一个 PDF。
- 自动识别整体正确，但有少数页面需要手动修正角点。
- 希望避免把原始照片上传到第三方服务。

## 主要功能

- 自动识别幻灯片边界。
- 手动四角修正。
- 支持 16:9 和 4:3 输出比例。
- 支持自定义输出宽度、质量、灰度模式和填充色。
- 支持浅色/深色主题和中文/英文界面。
- 在浏览器本地生成 PDF。

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
- `slide_lens_report.json`：包含角点和置信度的机器可读报告。

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

运行网页版测试：

```bash
cd site
npm ci
npm test
```

## 项目结构

```text
src/slides_thief/
  cli.py                  # local batch pipeline and command-line entry
site/                     # browser-only workspace and static Pages build
tests/                    # focused regression tests
pyproject.toml            # build, runtime, and development configuration
```

生成任务、中间文件和包构建产物不会进入源码管理，通常位于 `outputs/`、`work/`、`dist/`、`*.egg-info/` 等已忽略路径下。

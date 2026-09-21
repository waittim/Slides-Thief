import { test, expect } from "@playwright/experimental-ct-react";
import { ExportArtifactCard } from "../../app/components/ExportArtifactCard";
import { copy } from "../../app/i18n";

test("desktop PDF card renders download link with download attribute and no iOS hint", async ({ mount }) => {
  const component = await mount(
    <div className="links">
      <ExportArtifactCard
        format="pdf"
        url="blob:http://localhost/test.pdf"
        filename="test.pdf"
        byteLength={10240}
        isIOS={false}
        text={copy.en}
      />
    </div>,
  );

  const link = component.getByRole("link", { name: /Download PDF/i });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("download", "test.pdf");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(component.getByText("10.0 KB")).toBeVisible();
  await expect(component.getByText("In the new tab, tap Share → Save to Files")).toHaveCount(0);
});

test("iOS PDF card renders Open PDF title without download attribute and shows share hint", async ({ mount }) => {
  const component = await mount(
    <div className="links">
      <ExportArtifactCard
        format="pdf"
        url="blob:http://localhost/test.pdf"
        filename="test.pdf"
        byteLength={10240}
        isIOS={true}
        text={copy.en}
      />
    </div>,
  );

  const link = component.getByRole("link", { name: /Open PDF/i });
  await expect(link).toBeVisible();
  await expect(link).not.toHaveAttribute("download");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(component.getByText("In the new tab, tap Share → Save to Files")).toBeVisible();
});

test("iOS single JPG card renders Open JPG title and share hint in zh-CN", async ({ mount }) => {
  const component = await mount(
    <div className="links">
      <ExportArtifactCard
        format="jpg"
        url="blob:http://localhost/slide.jpg"
        filename="slide.jpg"
        byteLength={20480}
        isIOS={true}
        multiSlideJpg={false}
        text={copy["zh-CN"]}
      />
    </div>,
  );

  const link = component.getByRole("link", { name: /打开 JPG/i });
  await expect(link).toBeVisible();
  await expect(link).not.toHaveAttribute("download");
  await expect(component.getByText("在打开的页面点击分享 → 存储到文件")).toBeVisible();
});

test("iOS multi-slide JPG card renders Download JPGs without inline tab share hint", async ({ mount }) => {
  const component = await mount(
    <div className="links">
      <ExportArtifactCard
        format="jpg"
        url="blob:http://localhost/deck-jpgs.zip"
        filename="deck-jpgs.zip"
        byteLength={51200}
        isIOS={true}
        multiSlideJpg={true}
        text={copy.en}
      />
    </div>,
  );

  const link = component.getByRole("link", { name: /Download JPGs/i });
  await expect(link).toBeVisible();
  await expect(link).not.toHaveAttribute("download");
  await expect(component.getByText("In the new tab, tap Share → Save to Files")).toHaveCount(0);
});

test("stale artifact card renders stale badge and stale hint", async ({ mount }) => {
  const component = await mount(
    <div className="links">
      <ExportArtifactCard
        format="pdf"
        url="blob:http://localhost/test.pdf"
        filename="test.pdf"
        isStale={true}
        isIOS={true}
        text={copy.en}
      />
    </div>,
  );

  await expect(component.getByText("Outdated")).toBeVisible();
  await expect(component.locator(".artifactCard--stale")).toBeVisible();
  await expect(component.locator("a")).toHaveAttribute("title", "Settings changed; re-generate to update");
});

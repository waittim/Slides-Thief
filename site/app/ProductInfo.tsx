import { PRODUCT_METADATA } from "./product-metadata";

const webInputLabels = PRODUCT_METADATA.input_formats.filter((item) => item.web).map((item) => item.label);
const webSourceLabels = PRODUCT_METADATA.ratios.web_source_base_formats
  .filter((item) => item.kind !== "custom")
  .map((item) => ("label" in item ? item.label : item.id));
const webPaperFamilies = [...new Set(PRODUCT_METADATA.ratios.paper.filter((item) => item.web).map((item) => item.family))];

export function ProductInfo() {
  return (
    <section className="productInfo" aria-hidden="true" inert>
      <div>
        <p className="productInfoEyebrow">Browser-local slide and document correction</p>
        <h2 id="product-info-title">Convert angled slide or document photos into a clean PDF</h2>
        <p>
          Slides Thief detects source boundaries, corrects perspective distortion, and combines the corrected
          slides or document pages into one PDF. Photos stay on your device while you use the web app.
        </p>
      </div>
      <div className="productInfoGrid">
        <article>
          <h3>Supported images</h3>
          <p>
            {webInputLabels.join(", ")}. The source format defaults to {webSourceLabels[0]}, with {webSourceLabels.slice(1).join(", ")}, and custom alternatives; PDF paper output includes {webPaperFamilies.join(", ")}.
          </p>
        </article>
        <article>
          <h3>Automatic and manual correction</h3>
          <p>Detect four corners automatically, then drag any handle that needs adjustment.</p>
        </article>
        <article>
          <h3>Private by design</h3>
          <p>Image correction and PDF generation run locally in your browser without uploading source photos.</p>
        </article>
        <article>
          <h3>Keyboard shortcuts</h3>
          <p>Navigate with J/K, delete with Delete/Backspace, undo/redo with Cmd+Z/Cmd+Shift+Z, export PDF with Cmd+Enter, and fine-tune corners with Arrow keys (+Shift).</p>
        </article>
        <article>
          <h3>Optional readability enhancement</h3>
          <p>
            Keep original colors by default, or choose Clean, High contrast, or Black &amp; white to
            lift gray projector backgrounds before PDF export.
          </p>
        </article>
        <article>
          <h3>CLI and machine-readable reports</h3>
          <p>
            Batch jobs can produce corrected images, review pages, and JSON reports. See the{" "}
            <a href={`${PRODUCT_METADATA.repository}#local-cli`}>CLI documentation</a>.
          </p>
        </article>
      </div>
    </section>
  );
}

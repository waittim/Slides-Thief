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
          <p>JPEG, PNG, WebP, HEIC, and HEIF. The source format defaults to 16:9, with 4:3, 16:10, A4, Letter, and custom alternatives.</p>
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
            <a href="https://github.com/waittim/Slides-Thief#local-cli">CLI documentation</a>.
          </p>
        </article>
      </div>
    </section>
  );
}

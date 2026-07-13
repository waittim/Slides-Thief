export function ProductInfo() {
  return (
    <section className="productInfo" aria-hidden="true" inert>
      <div>
        <p className="productInfoEyebrow">Browser-local slide photo correction</p>
        <h2 id="product-info-title">Convert angled presentation photos into a clean PDF</h2>
        <p>
          Slides Thief detects slide boundaries, corrects perspective distortion, and combines the corrected
          images into one PDF. Photos stay on your device while you use the web app.
        </p>
      </div>
      <div className="productInfoGrid">
        <article>
          <h3>Supported images</h3>
          <p>JPEG, PNG, WebP, HEIC, and HEIF, with 16:9 and 4:3 output.</p>
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

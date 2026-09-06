import { useRef, useState } from "react";
import { copy } from "../../app/i18n";
import { AboutModal } from "../../app/components/AboutModal";

export function AboutModalHarness() {
  const [isInfoOpen, setIsInfoOpen] = useState(true);
  const infoModalRef = useRef<HTMLDivElement | null>(null);
  const closeInfoButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div style={{ width: "800px", minHeight: "600px", padding: "20px", background: "var(--bg)" }}>
      <AboutModal
        isInfoOpen={isInfoOpen}
        setIsInfoOpen={setIsInfoOpen}
        infoModalRef={infoModalRef}
        closeInfoButtonRef={closeInfoButtonRef}
        text={copy["zh-CN"]}
        appVersion="2.3.0"
      />
    </div>
  );
}

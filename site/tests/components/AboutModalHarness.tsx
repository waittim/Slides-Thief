import { useRef, useState } from "react";
import { analyticsConsentCopy, copy } from "../../app/i18n";
import { AboutModal } from "../../app/components/AboutModal";

export function AboutModalHarness() {
  const [isInfoOpen, setIsInfoOpen] = useState(true);
  const [telemetry, setTelemetry] = useState(true);
  const infoModalRef = useRef<HTMLDivElement | null>(null);
  const closeInfoButtonRef = useRef<HTMLButtonElement | null>(null);
  const zhConsent = analyticsConsentCopy["zh-CN"];

  return (
    <div style={{ width: "800px", minHeight: "600px", padding: "20px", background: "var(--bg)" }}>
      <AboutModal
        isInfoOpen={isInfoOpen}
        setIsInfoOpen={setIsInfoOpen}
        infoModalRef={infoModalRef}
        closeInfoButtonRef={closeInfoButtonRef}
        text={copy["zh-CN"]}
        locale="zh-CN"
        appVersion="3.0.0"
        telemetryEnabled={telemetry}
        setTelemetryEnabled={setTelemetry}
        googlePolicyLabel={zhConsent.googlePolicy}
        privacyNoticeLabel={zhConsent.privacyNotice}
        privacyContactLabel={zhConsent.privacyContact}
        backToAboutLabel={zhConsent.backToAbout}
        openExternalLabel={zhConsent.openExternal}
        privacyNoticeUpdatedLabel={zhConsent.privacyNoticeUpdated}
      />
    </div>
  );
}

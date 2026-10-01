import React from "react";

export interface PrivacyNoticeContentProps {
  standaloneUrl?: string;
  authorAboutUrl?: string;
  googlePolicyUrl?: string;
}

interface PrivacySection {
  title: string;
  paragraphs: React.ReactNode[];
}

export function PrivacyNoticeContent({
  standaloneUrl = "./privacy.html",
  authorAboutUrl = "https://www.zekun.blog/about/",
  googlePolicyUrl = "https://policies.google.com/privacy",
}: PrivacyNoticeContentProps) {
  const sections: PrivacySection[] = [
    {
      title: "Who operates this site and how to contact us",
      paragraphs: [
        <>
          Slides Thief is an independent project by Zekun Wang. For privacy questions or requests, use the private contact method on the{" "}
          <a href={authorAboutUrl} target="_blank" rel="noopener noreferrer">
            author&apos;s About page
          </a>
          . Please do not post personal information in public GitHub issues.
        </>,
      ],
    },
    {
      title: "Photos and PDFs",
      paragraphs: [
        <>
          The web app processes selected photos and creates PDFs locally in your browser. It does not upload source photos or generated PDFs to our servers. The Python CLI processes local files on your device.
        </>,
      ],
    },
    {
      title: "Usage analytics",
      paragraphs: [
        <>
          We use Google Analytics to understand use of the website and improve the product. Before it loads, the app asks an edge service whether analytics may be enabled by default for the visitor&apos;s country. The service returns only a yes or no policy decision; the app does not store the country or IP address. For visitors in the United States, Australia, and New Zealand, analytics is enabled by default unless they opt out. In other or unknown locations, or when the service is unavailable, analytics remains off until the visitor accepts. An existing opt-out always takes precedence.
        </>,
        <>
          When enabled, we send page views and app events for image import counts (including whether an import contains HEIC/HEIF), export page counts, download starts, corner adjustments, and fixed processing error codes. We do not send file names, file sizes, raw error messages, photo pixels, or PDFs as app event parameters. A download-start event means an attempted download or open action, not a confirmed saved file.
        </>,
        <>
          Google Analytics may also process browser, device, and network information and set analytics cookies. Google describes its processing in the{" "}
          <a href={googlePolicyUrl} target="_blank" rel="noopener noreferrer">
            Google Privacy Policy
          </a>
          . The site&apos;s Google Analytics data stream has enhanced measurement limited to page views; automatic file-download, site-search, form, outbound-click, scroll, and video events are disabled.
        </>,
      ],
    },
    {
      title: "Your choice and retention",
      paragraphs: [
        <>
          You can change the analytics setting at any time in the app&apos;s <strong>About</strong> dialog. Your choice and its timestamp are saved in this browser&apos;s local storage for 180 days (6 months), after which the app prompts for a renewed decision, or until you change the choice or clear site data. Turning analytics off stops subsequent app events and deletes accessible Google Analytics cookies on this site. A script already loaded on the current page stays present until reload; it is not requested on a later visit while analytics is off.
        </>,
        <>
          Our Google Analytics property currently retains event data for 2 months and user data for 14 months; new user activity resets the user-data retention period. These settings do not affect most aggregate reports. Google&apos;s separate processing is described in its privacy policy above. Contact us through the About page above to ask about retention or request access or deletion where applicable.
        </>,
      ],
    },
    {
      title: "Your rights",
      paragraphs: [
        <>
          Depending on your location, you may have rights to access, correct, delete, or restrict processing of personal data, to object to processing, and to withdraw consent where consent applies. Contact us privately using the link above to make a request. Where applicable, you may also complain to your local data protection authority.
        </>,
      ],
    },
  ];

  return (
    <article className="modalPrivacyArticle" lang="en">
      <header className="modalPrivacyArticleHeader">
        <p className="modalPrivacyUpdated">Last updated: September 27, 2026.</p>
        <a
          href={standaloneUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="modalPrivacyOpenExternal"
        >
          <span>Open in new window</span>
          <span aria-hidden="true"> ↗</span>
        </a>
      </header>

      <div className="modalPrivacySections">
        {sections.map((section, idx) => (
          <section key={idx} className="modalPrivacySection">
            <h4 className="modalPrivacySectionTitle">{section.title}</h4>
            {section.paragraphs.map((p, pIdx) => (
              <p key={pIdx} className="modalPrivacySectionText">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}

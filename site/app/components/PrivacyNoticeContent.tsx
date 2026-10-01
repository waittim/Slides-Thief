import React from "react";
import type { LocaleValue } from "../i18n";

export interface PrivacyNoticeContentProps {
  locale?: LocaleValue;
  updatedLabel?: string;
  openExternalLabel?: string;
  standaloneUrl?: string;
  authorAboutUrl?: string;
  googlePolicyUrl?: string;
}

interface PrivacySection {
  title: string;
  paragraphs: React.ReactNode[];
}

export function PrivacyNoticeContent({
  locale = "en",
  updatedLabel,
  openExternalLabel = "Open in new window",
  standaloneUrl = "./privacy.html",
  authorAboutUrl = "https://www.zekun.blog/about/",
  googlePolicyUrl = "https://policies.google.com/privacy",
}: PrivacyNoticeContentProps) {
  const isZhCn = locale === "zh-CN";
  const isZhTw = locale === "zh-TW";
  const isChinese = isZhCn || isZhTw;

  const defaultUpdated = isZhTw
    ? "最後更新：2026年9月27日"
    : isZhCn
      ? "最后更新：2026年9月27日"
      : "Last updated: September 27, 2026.";

  const effectiveUpdated = updatedLabel || defaultUpdated;

  let sections: PrivacySection[];

  if (isZhTw) {
    sections = [
      {
        title: "營運方與聯絡方式",
        paragraphs: [
          <>
            Slides Thief 是王澤坤（Zekun Wang）的獨立開源專案。如有隱私相關疑問或權利請求，請使用
            <a href={authorAboutUrl} target="_blank" rel="noopener noreferrer">
              作者關於頁面
            </a>
            上的私人聯絡方式。切勿在公開的 GitHub Issue 中發布個人資訊。
          </>,
        ],
      },
      {
        title: "相片與 PDF 處理",
        paragraphs: [
          <>
            本 Web 應用完全在您的瀏覽器本機處理所選相片並產生 PDF，絕不會將原始相片或產生的 PDF 上傳到我們的伺服器。Python CLI 同樣只在您的本機裝置上處理檔案。
          </>,
        ],
      },
      {
        title: "使用統計",
        paragraphs: [
          <>
            我們使用 Google Analytics 了解網站的使用情況以改進產品。在載入前，應用會向邊緣服務查詢訪客所在國家/地區是否可預設開啟統計。該服務僅返回是否允許的政策結果，不會記錄訪客的國家或 IP 位址。對於美國、澳洲和紐西蘭的訪客，預設啟用統計（可隨時停用）；在其他地區、未知位置或服務不可用時，統計預設保持關閉，直至訪客明確同意。任何已儲存的拒絕記錄始終優先。
          </>,
          <>
            啟用後，我們會傳送頁面瀏覽以及圖片匯入數量（含是否含 HEIC/HEIF）、匯出頁數、下載觸發、角點微調及固定錯誤碼。應用程式事件不會包含檔案名稱、檔案大小、原始錯誤文字、相片像素或 PDF。下載觸發僅代表嘗試下載或開啟，並不確認檔案已儲存。
          </>,
          <>
            Google Analytics 可能會處理瀏覽器、裝置和網路資訊並設定分析 Cookie，詳情請見
            <a href={googlePolicyUrl} target="_blank" rel="noopener noreferrer">
              Google 隱私權政策
            </a>
            。本站的資料串流僅啟用了基礎頁面瀏覽測量，自動檔案下載、站內搜尋、表單、外部點擊、滾動及影片事件均已停用。
          </>,
        ],
      },
      {
        title: "您的選擇與保存期限",
        paragraphs: [
          <>
            您可以在應用的「關於」彈窗中隨時更改使用統計設定。您的選擇及時間戳記將在本機儲存中保存 180 天（6 個月），期滿後應用會再次提示確認；您也可以隨時修改或清除網站資料。停用統計將停止後續應用程式事件並清除本站可存取的 Google Analytics Cookie。目前頁面已載入的指令碼將在重新整理後不再請求。
          </>,
          <>
            我們的 Google Analytics 資源目前將事件資料保留 2 個月，使用者資料保留 14 個月；新的使用者活動會重置該期限。如需查詢或請求存取、刪除，請透過上述關於頁面聯絡我們。
          </>,
        ],
      },
      {
        title: "您的權利",
        paragraphs: [
          <>
            根據您所在的地區，您可能擁有存取、更正、刪除或限制處理個人資料的權利，以及反對處理或撤回同意的權利。請使用上方的私密聯絡方式提出請求；如適用，您也可向當地資料保護機構投訴。
          </>,
        ],
      },
    ];
  } else if (isZhCn) {
    sections = [
      {
        title: "运营方与联系方式",
        paragraphs: [
          <>
            Slides Thief 是王泽坤（Zekun Wang）的独立开源项目。如有隐私相关疑问或权利请求，请使用
            <a href={authorAboutUrl} target="_blank" rel="noopener noreferrer">
              作者关于页面
            </a>
            上的私人联系方式。切勿在公开的 GitHub Issue 中发布个人信息。
          </>,
        ],
      },
      {
        title: "照片与 PDF 处理",
        paragraphs: [
          <>
            本 Web 应用完全在您的浏览器本地处理所选照片并生成 PDF，绝不会将原始照片或生成的 PDF 上传到我们的服务器。Python CLI 同样只在您的本地设备上处理文件。
          </>,
        ],
      },
      {
        title: "使用统计",
        paragraphs: [
          <>
            我们使用 Google Analytics 了解网站的使用情况以改进产品。在加载前，应用会向边缘服务查询访问者所在国家/地区是否可默认开启统计。该服务仅返回是否允许的策略结果，不会记录访问者的国家或 IP 地址。对于美国、澳大利亚和新西兰的访问者，默认启用统计（可随时停用）；在其他地区、未知位置或服务不可用时，统计默认保持关闭，直至访问者明确同意。任何已保存的拒绝记录始终优先。
          </>,
          <>
            启用后，我们会发送页面浏览以及图片导入数量（含是否含 HEIC/HEIF）、导出页数、下载触发、角点微调及固定错误码。应用事件不会包含文件名、文件大小、原始错误文本、照片像素或 PDF。下载触发仅代表尝试下载或打开，并不确认文件已保存。
          </>,
          <>
            Google Analytics 可能会处理浏览器、设备和网络信息并设置分析 Cookie，详情请见
            <a href={googlePolicyUrl} target="_blank" rel="noopener noreferrer">
              Google 隐私政策
            </a>
            。本站的数据流仅启用了基础页面浏览测量，自动文件下载、站内搜索、表单、外部点击、滚动及视频事件均已禁用。
          </>,
        ],
      },
      {
        title: "您的选择与保存期限",
        paragraphs: [
          <>
            您可以在应用的“关于”弹窗中随时更改使用统计设置。您的选择及时间戳将在本地存储中保存 180 天（6 个月），期满后应用会再次提示确认；您也可以随时修改或清除站点数据。停用统计将停止后续应用事件并清除本站可访问的 Google Analytics Cookie。当前页面已加载的脚本将在刷新后不再请求。
          </>,
          <>
            我们的 Google Analytics 媒体资源目前将事件数据保留 2 个月，用户数据保留 14 个月；新的用户活动会重置该期限。如需查询或请求访问、删除，请通过上述关于页面联系我们。
          </>,
        ],
      },
      {
        title: "您的权利",
        paragraphs: [
          <>
            根据您所在的地区，您可能拥有访问、更正、删除或限制处理个人数据的权利，以及反对处理或撤回同意的权利。请使用上方的私密联系方式提出请求；如适用，您也可向当地数据保护机构投诉。
          </>,
        ],
      },
    ];
  } else {
    sections = [
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
  }

  return (
    <article className="modalPrivacyArticle" lang={isChinese ? (isZhTw ? "zh-TW" : "zh-CN") : "en"}>
      <header className="modalPrivacyArticleHeader">
        <p className="modalPrivacyUpdated">{effectiveUpdated}</p>
        <a
          href={standaloneUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="modalPrivacyOpenExternal"
        >
          <span>{openExternalLabel}</span>
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

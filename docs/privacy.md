# Privacy

The public privacy notice is available at
[slidesthief.com/privacy.html](https://slidesthief.com/privacy.html). Slides Thief
is an independent project by Zekun Wang. For privacy questions or requests,
use the private contact method on the [author's About page](https://www.zekun.blog/about/).
Do not post personal information in public GitHub issues.

The web app processes selected photos and creates PDFs locally in the browser.
It does not upload source photos or generated PDFs to a server. The Python CLI
also processes local files. Integrations should preserve this source-image
boundary.

The website asks a dedicated edge service whether usage analytics may be on by
default in the visitor's country. The service returns only a yes/no policy
decision and does not store the visitor's country or IP address in application
storage. Default-on analytics is currently limited to the United States,
Australia, and New Zealand. In other or unknown locations, and whenever the
service is unavailable, Google Analytics stays unloaded until the visitor
explicitly accepts. An existing opt-out always wins. Previous releases' saved
`telemetry: true` value is not treated as consent because it may have been the
default.

When enabled, the app sends page views and app events: image import counts and whether
an import includes HEIC/HEIF, export page counts, download-start counts,
corner-adjustment events, and fixed processing error codes. The app's event
parameters are restricted to these values; they do not include file names,
file sizes, raw error messages, image pixels, or generated PDFs. A download-start
event records an attempted browser download or open action, not confirmation
that the file was saved. It has no event parameters, so Google Analytics counts
these actions by the number of events received.

Google Analytics may process browser, device, and network information and may
set analytics cookies when enabled. Its separate processing is described in
the [Google Privacy Policy](https://policies.google.com/privacy).
The current GA4 property retains event data for 2 months and user data for 14
months, with user-data retention reset by new activity. These settings do not
affect most aggregate reports.

An explicit choice and its timestamp are saved only in browser local storage
and can be changed at any time in **About**. Turning analytics off suppresses
subsequent Google Analytics events and deletes accessible Google Analytics
cookies on this site. The script already loaded during an enabled session
remains in that page until reload; it is not requested on a subsequent visit
while analytics is disabled. Saved opt-outs from older versions remain disabled.

Google Analytics can also generate events outside the app's event whitelist.
For the `slidesthief.com` data stream (`G-74RGGMV3PH`), **Enhanced measurement**
is configured to keep only page views enabled. File downloads, site search,
form interactions, outbound clicks, scrolls, and video engagement are disabled.
In particular, Google's automatic file-download event can include a `file_name` parameter,
and its site-search event can include a URL query value. These stream settings
are managed in Google Analytics rather than this repository and must be checked
again before each release or if the stream is replaced.

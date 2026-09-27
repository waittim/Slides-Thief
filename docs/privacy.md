# Privacy

The web app processes selected photos and creates PDFs locally in the browser.
It does not upload source photos or generated PDFs to a server. The Python CLI
also processes local files. Integrations should preserve this source-image
boundary.

Usage analytics is on by default. After checking saved preferences, the website
loads Google Analytics unless you have turned it off in the web app's **About**
dialog. The app sends page views and app events: image import counts and whether
an import includes HEIC/HEIF, export page counts, download-start counts,
corner-adjustment events, and fixed processing error codes. The app's event
parameters are restricted to these values; they do not include file names,
file sizes, raw error messages, image pixels, or generated PDFs. A download-start
event records an attempted browser download or open action, not confirmation
that the file was saved. It has no event parameters, so Google Analytics counts
these actions by the number of events received.

The choice is saved in browser local storage and can be changed at any time.
Turning analytics off suppresses subsequent Google Analytics events. The script
already loaded during an enabled session remains in that page until reload; it
is not requested on a subsequent visit while analytics is disabled. Saved opt-outs
from older versions remain disabled.

Google Analytics can also generate events outside the app's event whitelist.
For the `slidesthief.com` data stream (`G-74RGGMV3PH`), **Enhanced measurement**
is configured to keep only page views enabled. File downloads, site search,
form interactions, outbound clicks, scrolls, and video engagement are disabled.
In particular, Google's automatic file-download event can include a `file_name` parameter,
and its site-search event can include a URL query value. These stream settings
are managed in Google Analytics rather than this repository and must be checked
again before each release or if the stream is replaced.

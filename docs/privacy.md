# Privacy

The web app processes selected photos and creates PDFs locally in the browser.
It does not upload source photos or generated PDFs to a server. The Python CLI
also processes local files. Integrations should preserve this source-image
boundary.

Usage analytics is on by default. After checking saved preferences, the website
loads Google Analytics unless you have turned it off in the web app's **About**
dialog. The app sends page views and app events: image import counts and whether
an import includes HEIC/HEIF, export page counts and file sizes, corner-adjustment
events, and fixed processing error codes. The app's event parameters are restricted
to these values; they do not include file names, raw error messages, image pixels,
or generated PDFs.

The choice is saved in browser local storage and can be changed at any time.
Turning analytics off suppresses subsequent Google Analytics events. The script
already loaded during an enabled session remains in that page until reload; it
is not requested on a subsequent visit while analytics is disabled. Saved opt-outs
from older versions remain disabled.

Google Analytics can also generate events outside the app's event whitelist.
Its enhanced file-download measurement can include a `file_name` parameter.
Before deploying default-on analytics, the owner of the Google Analytics web
data stream must disable **File downloads** under **Enhanced measurement** and
verify that no other automatic event sends file names or user-provided content.
That stream setting is managed in Google Analytics, not in this repository.

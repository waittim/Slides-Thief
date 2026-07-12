# Privacy

The web app processes selected photos and creates the PDF locally in the browser. It does not upload source photos to a server. The Python CLI likewise operates on local files.

This privacy guarantee is an architectural invariant: integrations should not add source-image uploads by default.


# Analytics region policy

This Cloudflare Worker gives the browser a binary decision before any Google
Analytics tag loads. It returns `{"version":1,"defaultAllowed":boolean}`
without a country code. Only `US`, `AU`, and `NZ` currently return `true`;
unknown locations return `false`. The web app fails closed if this service is
unavailable or its response is invalid.

The Worker must be deployed before the 3.0.0 web release. The included Wrangler
configuration uses a `workers.dev` subdomain, so it does not require moving the
existing `slidesthief.com` DNS or GitHub Pages origin. Set GitHub Actions
repository variable `ANALYTICS_POLICY_URL` to the deployed `https://...workers.dev/v1`
URL before building GitHub Pages. Set `VITE_ANALYTICS_POLICY_URL` to that URL
for any Sites/SSR build. The web app's fallback URL is
`https://analytics-policy.slidesthief.com/v1`; until a service exists there,
an unset variable safely requires consent everywhere.

From this directory, after authenticating Wrangler to the owning account:

```bash
npx wrangler deploy
node --test worker.test.mjs
```

Verify the production response from at least one `US` and one EEA/UK/CH
network, including its CORS and `Cache-Control: no-store` headers. Local
`wrangler dev` and the Cloudflare dashboard preview do not provide a real
`request.cf.country` value. Check the browser network panel for zero Google
requests before acceptance in a consent-required region and no Google tag after
rejection or a policy outage. The consent banner's **View details** button
opens the app's About dialog; the choice can be changed there later.

If any origin or country is added to the allowlists, review the privacy
implications first and update this file, the worker tests, and
`docs/privacy.md` together. The country decision is based on the network
location reported by Cloudflare and may differ from a visitor's residence.

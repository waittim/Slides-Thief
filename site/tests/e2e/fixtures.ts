import { test as base, expect, type Page } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, run) => {
    // Keep release tests from contributing page views to the production GA property.
    await page.route(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?.*/, (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
    );
    await page.route(/https:\/\/(?:[a-z0-9-]+\.)?google-analytics\.com\//, (route) =>
      route.fulfill({ status: 204, body: "" }),
    );
    await run(page);
  },
});

export async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(".app")).toHaveAttribute("data-hydrated", "true");
}

export { expect };

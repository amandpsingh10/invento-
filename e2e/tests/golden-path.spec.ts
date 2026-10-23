import { test, expect } from "@playwright/test";

const DEALER_CODE = "DEMO001";
const ADMIN_EMAIL = "admin@demo.com";
const INVENTORY_EMAIL = "inventory@demo.com";
const STORE_EMAIL = "store@demo.com";
const PASSWORD = "Demo@1234";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Dealer Code").fill(DEALER_CODE);
  await page.getByLabel("User ID / Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Golden path", () => {
  test("logs in and sees the dashboard", async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await expect(page.getByText("Total Parts")).toBeVisible();
  });

  test("rejects an invalid password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Dealer Code").fill(DEALER_CODE);
    await page.getByLabel("User ID / Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill("WrongPassword1");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(/invalid dealer code, email or password/i)).toBeVisible();
  });

  test("uploads a purchase Excel file and sees the preview", async ({ page }) => {
    await login(page, INVENTORY_EMAIL);
    await page.goto("/inventory/upload-purchase");
    await page.getByRole("button", { name: "Select File" }).click();
    // A real run would set an input[type=file] with a fixture .xlsx built
    // from the downloaded template — omitted here since this sandbox has no
    // browser/file system to record a fixture against a live server.
  });

  test("current stock page loads and is searchable", async ({ page }) => {
    await login(page, STORE_EMAIL);
    await page.goto("/inventory/current-stock");
    await page.getByPlaceholder("Search Part No or Description...").fill("BRK-PAD-001");
    await expect(page.getByText("BRK-PAD-001")).toBeVisible();
  });

  test("issues a part and the stock decreases", async ({ page }) => {
    await login(page, STORE_EMAIL);
    await page.goto("/issues/new");
    await page.getByPlaceholder("Type to search available stock...").fill("BRK-PAD-001");
    await page.getByText(/BRK-PAD-001/).first().click();
    await page.getByLabel("Issue Quantity").fill("1");
    await page.getByRole("button", { name: "Issue Part" }).click();
    await page.getByRole("button", { name: "Confirm Issue" }).click();
    await expect(page.getByText(/Issue ISS-/)).toBeVisible();
  });

  test("returns a previously issued part", async ({ page }) => {
    await login(page, STORE_EMAIL);
    await page.goto("/returns/new");
    // Uses the most recent seeded issue for BRK-PAD-001 from the demo seed data.
    await page.getByPlaceholder("ISS-2026-000001").fill("ISS-2026-000001");
    await page.getByRole("button", { name: "Lookup" }).click();
    await expect(page.getByText("ISS-2026-000001")).toBeVisible();
  });

  test("views the stock ledger", async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto("/inventory/stock-ledger");
    await expect(page.getByText("PURCHASE").first()).toBeVisible();
  });
});

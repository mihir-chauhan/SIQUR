import { test, expect } from "@playwright/test";

test.describe("V2 Boot Flow", () => {
  test("boot → title appears", async ({ page }) => {
    await page.goto("/v2");
    await expect(page.locator("h1")).toContainText("Watchman", { timeout: 8000 });
  });

  test("click start → globe appears", async ({ page }) => {
    await page.goto("/v2");
    await page.waitForTimeout(6000);
    await page.getByText("click to start").click();
    await expect(page.getByText("GLOBAL_OVERSEER")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Globe Page (standalone)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/globe");
    await page.waitForTimeout(2000);
  });

  test("globe renders with mapbox canvas", async ({ page }) => {
    await expect(page.locator("canvas.mapboxgl-canvas")).toBeVisible({ timeout: 5000 });
  });

  test("HUD elements visible", async ({ page }) => {
    await expect(page.getByText("GLOBAL_OVERSEER")).toBeVisible();
    await expect(page.getByText("SAT-LINK ONLINE")).toBeVisible();
  });

  test("markers are present", async ({ page }) => {
    await page.waitForTimeout(2000);
    const markers = page.locator(".mapbox-pulse-marker");
    const count = await markers.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("click globe triggers flyTo", async ({ page }) => {
    await page.locator("canvas.mapboxgl-canvas").click();
    await page.waitForTimeout(3000);
    await expect(page.getByText("TARGET ACQUIRED")).toBeVisible({ timeout: 5000 });
  });

  test("location panel appears after flyTo", async ({ page }) => {
    await page.locator("canvas.mapboxgl-canvas").click();
    await expect(page.getByText("Hall of Data Science")).toBeVisible({ timeout: 15000 });
  });

  test("enter building button visible", async ({ page }) => {
    await page.locator("canvas.mapboxgl-canvas").click();
    await expect(page.getByText("ENTER BUILDING")).toBeVisible({ timeout: 15000 });
  });

  test("close panel resumes rotation", async ({ page }) => {
    await page.locator("canvas.mapboxgl-canvas").click();
    await expect(page.getByText("Hall of Data Science")).toBeVisible({ timeout: 15000 });
    // Close the panel
    await page.locator("button:has(svg)").first().click();
    await page.waitForTimeout(1000);
    // Status should revert
    await expect(page.getByText("AWAITING TARGET")).toBeVisible({ timeout: 5000 });
  });

  test("page fills viewport", async ({ page }) => {
    const viewport = page.viewportSize()!;
    const box = await page.locator("div").first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 1);
  });
});

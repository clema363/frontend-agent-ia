import { test, expect } from "@playwright/test";
let browserErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
});
test.afterEach(() => expect(browserErrors).toEqual([]));
test("every page and project tab renders without browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [path, title] of [
    ["/", "Dashboard"],
    ["/projects", "Projects"],
    ["/projects/p-6804", "6804-cashgpt"],
    ["/projects/p-6804/members", "6804-cashgpt"],
    ["/projects/p-6804/fields", "6804-cashgpt"],
    ["/projects/p-6804/context", "6804-cashgpt"],
    ["/kanban", "Kanban"],
    ["/kanban/us-118", "US-118"],
    ["/kanban/us-109", "US-109"],
    ["/journal", "Journal"],
    ["/settings", "Settings"],
    ["/profile", "Profile"],
    ["/login", "Welcome back"],
    ["/missing", "Page not found"],
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveText(title);
    await page.waitForTimeout(200);
  }
  expect(errors).toEqual([]);
});
test("project search, card view and creating a project keep the list reactive", async ({
  page,
}) => {
  await page.goto("/projects");
  await expect(page.getByText("6804-cashgpt", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Filter projects…").fill("treasury");
  await expect(page.getByText("6804-cashgpt", { exact: true })).toHaveCount(0);
  await page.getByPlaceholder("Filter projects…").fill("");
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(
    page.getByText("sent to AI", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Vue QA Project");
  await page.getByLabel("Project key", { exact: true }).fill("VUEQA");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.locator("h1")).toHaveText("Vue QA Project");
});
test("kanban URL filters, role and view changes update the screen", async ({
  page,
}) => {
  await page.goto("/kanban");
  await expect(
    page.getByText("Notify treasurers when a payment is rejected", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page).toHaveURL(/view=list/);
  await page.getByRole("combobox", { name: "Project", exact: true }).click();
  await page.getByRole("option", { name: "7120-treasury-portal" }).click();
  await expect(page).toHaveURL(/project=p-7120/);
  await expect(
    page.getByText("Notify treasurers when a payment is rejected", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByText("Notify treasurers when a payment is rejected", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "View as", exact: true }).click();
  await page.getByRole("option", { name: "DEV", exact: true }).click();
  await expect(page.getByText("Signed in: Admin (demo) · ADMIN")).toBeVisible();
});
test("approval requires confirmation and advances the ticket", async ({
  page,
}) => {
  await page.goto("/kanban/us-118");
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  await expect(
    page.getByText("Refinement agent", { exact: true }).first(),
  ).toBeVisible();
});
test("theme persists and sidebar works at mobile width", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("radio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(
    page.getByRole("link", { name: "Dashboard", exact: true }),
  ).toBeVisible();
});
test("creating a story and editing its generated document work", async ({
  page,
}) => {
  await page.goto("/kanban");
  await page.getByRole("button", { name: "New US", exact: true }).click();
  await page
    .getByLabel("What do you want?", { exact: true })
    .fill(
      "Generate a quarterly reconciliation attachment with supplier cost allocations and approval history for the treasury team.",
    );
  await page
    .getByRole("button", { name: "Create and send to the authoring agent" })
    .click();
  await expect(page).toHaveURL(/\/kanban\/us-/);
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Document in Markdown" })
    .fill("## Vue edited document\n\nValidated locally by the reviewer.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Vue edited document" }),
  ).toBeVisible();
});
test("Jira field selection saves and context validation refreshes", async ({
  page,
}) => {
  await page.goto("/projects/p-6804/fields");
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await page.locator("[role=checkbox]:not([disabled])").first().click();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await page.goto("/projects/p-6804/context");
  await page
    .getByLabel("Content (editable)")
    .fill("# Updated Vue context\n\nTreasury operating rules.");
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(
    page.getByText("Map validated — injected into US production."),
  ).toBeVisible();
  await expect(page.getByLabel("Content (editable)")).toHaveValue(
    "# Updated Vue context\n\nTreasury operating rules.",
  );
});
test("project deletion stays locked until the project name is confirmed", async ({
  page,
}) => {
  await page.goto("/projects/p-7120");
  await expect(page.locator("h1")).toHaveText("7120-treasury-portal");
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Delete project", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Delete permanently" }),
  ).toBeDisabled();
  await page
    .getByPlaceholder("7120-treasury-portal")
    .fill("7120-treasury-portal");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.getByText("7120-treasury-portal", { exact: true }),
  ).toHaveCount(0);
});
test("journal analysis follows the URL and retains its filters", async ({
  page,
}) => {
  await page.goto("/journal?project=p-6804");
  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  await expect(page).toHaveURL(/view=analysis/);
  await expect(page.getByText("Tokens used", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/project=p-6804/);
  await page.getByRole("tab", { name: "Events", exact: true }).click();
  await expect(page.getByText("Tokens used", { exact: true })).toHaveCount(0);
});

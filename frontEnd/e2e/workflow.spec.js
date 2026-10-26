import { test, expect } from "@playwright/test";
const password = "TestPass123!";
async function login(browser, email, role) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .waitFor();
  await page.getByLabel("Loading workspace").waitFor({ state: "detached" });
  return { context, page, role };
}
async function nav(page, label) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.getByLabel("Loading workspace").waitFor({ state: "detached" });
}
async function save(page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save & continue" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Loading workspace").waitFor({ state: "detached" });
}
async function confirm(page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Loading workspace").waitFor({ state: "detached" });
}
for (const role of ["donor", "recipient", "hospital", "admin"])
  test(`${role} desktop navigation and mobile layout`, async ({
    browser,
  }, testInfo) => {
    const { context, page } = await login(
      browser,
      `${role}@example.test`,
      role,
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.screenshot({
      path: testInfo.outputPath(`${role}-desktop.png`),
      fullPage: true,
    });
    const buttons = page.getByRole("navigation").getByRole("button");
    for (let i = 0; i < (await buttons.count()); i++) {
      await buttons.nth(i).click();
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Overview", exact: true })
      .click();
    await expect.poll(()=>page.locator('.care-sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: testInfo.outputPath(`${role}-mobile.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
test("registration → hospital verification → evidence → consent → allocation → scheduling → cancellation", async ({
  browser,
}) => {
  const contexts = [];
  try {
    async function register(role, fullName, email) {
      const context = await browser.newContext(),
        page = await context.newPage();
      contexts.push(context);
      await page.goto("/");
      await page.getByRole("button", { name: "Create an account" }).click();
      await page
        .getByRole("group", { name: "Account role" })
        .getByRole("button", { name: role, exact: true })
        .click();
      await page
        .getByLabel(role === "hospital" ? "Hospital name" : "Full name", {
          exact: true,
        })
        .fill(fullName);
      await page.getByLabel("Indian mobile number").fill("9876543210");
      await page.getByLabel("Email address").fill(email);
      if (role === "hospital")
        await page
          .getByLabel("Hospital registration / licence number")
          .fill("TEST-NEW-HOSPITAL");
      else {
        await page.getByLabel("Blood group (self-reported)").selectOption("O+");
        await page
          .getByLabel(role === "donor" ? "Organ of interest" : "Organ required")
          .selectOption("Kidney");
      }
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Confirm password").fill(password);
      await page.getByRole("checkbox").check();
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    }
    await register(
      "hospital",
      "Workflow Test Hospital",
      "workflow-hospital@example.test",
    );
    const admin = await login(browser, "admin@example.test", "admin");
    contexts.push(admin.context);
    await nav(admin.page, "Hospital verification");
    const hospitalRow = admin.page
      .getByRole("row")
      .filter({ hasText: "Workflow Test Hospital" });
    await hospitalRow
      .getByRole("button", { name: "Verify credentials" })
      .click();
    await confirm(admin.page);
    await expect(hospitalRow).toContainText("Verified");
    const hospital = await login(
      browser,
      "workflow-hospital@example.test",
      "hospital",
    );
    contexts.push(hospital.context);
    await register("donor", "Workflow Donor", "workflow-donor@example.test");
    await register(
      "recipient",
      "Workflow Recipient",
      "workflow-recipient@example.test",
    );
    const donor = await login(browser, "workflow-donor@example.test", "donor"),
      recipient = await login(
        browser,
        "workflow-recipient@example.test",
        "recipient",
      );
    contexts.push(donor.context, recipient.context);
    for (const actor of [donor, recipient]) {
      await nav(actor.page, "Care settings");
      await actor.page
        .getByRole("button", { name: "Choose a hospital" })
        .click();
      await actor.page
        .getByLabel("Verified care hospital")
        .selectOption({ label: "Workflow Test Hospital" });
      await save(actor.page);
      await nav(actor.page, "Medical documents");
      await actor.page.getByRole("button", { name: "Upload document" }).click();
      await actor.page
        .getByLabel("Medical document", { exact: true })
        .setInputFiles({
          name: "synthetic-report.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from(
            "%PDF-1.4\nSynthetic test evidence, blood group O+.\n%%EOF",
          ),
        });
      await save(actor.page);
      await expect(actor.page.getByRole("table")).toContainText("Pending");
    }
    await nav(hospital.page, "Document review");
    await hospital.page
      .getByRole("button", { name: "Refresh workspace" })
      .click();
    await hospital.page
      .getByLabel("Loading workspace")
      .waitFor({ state: "detached" });
    for (let i = 0; i < 2; i++) {
      await hospital.page
        .getByRole("button", { name: "Review evidence" })
        .first()
        .click();
      await hospital.page
        .getByLabel("Blood group confirmed from original")
        .selectOption("O+");
      await hospital.page
        .getByLabel("Review notes")
        .fill("Synthetic evidence reviewed for automated workflow test.");
      await hospital.page.getByRole("dialog").getByRole("checkbox").check();
      await hospital.page.getByRole("button", { name: "Save review" }).click();
      await expect(hospital.page.getByRole("dialog")).toHaveCount(0);
      await hospital.page
        .getByLabel("Loading workspace")
        .waitFor({ state: "detached" });
    }
    await donor.page
      .getByRole("button", { name: "New pledge", exact: true })
      .click();
    await save(donor.page);
    await nav(hospital.page, "Screening workspace");
    await hospital.page
      .getByRole("button", { name: "Refresh workspace" })
      .click();
    await hospital.page
      .getByRole("button", { name: "Run basic screening" })
      .click();
    await hospital.page
      .getByRole("button", { name: "Recommend", exact: true })
      .click();
    await confirm(hospital.page);
    await nav(recipient.page, "Recommendations");
    await recipient.page
      .getByRole("button", { name: "Refresh workspace" })
      .click();
    await recipient.page
      .getByRole("button", { name: "Request donor consent" })
      .click();
    await confirm(recipient.page);
    await nav(donor.page, "Consent requests");
    await donor.page.getByRole("button", { name: "Refresh workspace" }).click();
    await donor.page.getByRole("button", { name: "Review & accept" }).click();
    await confirm(donor.page);
    await nav(hospital.page, "Care cases");
    await hospital.page
      .getByRole("button", { name: "Refresh workspace" })
      .click();
    await hospital.page.getByRole("button", { name: "Start review" }).click();
    await confirm(hospital.page);
    await hospital.page
      .getByRole("button", { name: "Schedule", exact: true })
      .click();
    await hospital.page.getByLabel("Appointment date").fill("2030-08-15");
    await hospital.page.getByLabel("Appointment time · IST").fill("11:00");
    await hospital.page.getByLabel("Responsible clinician").fill("Dr Workflow");
    await hospital.page.getByRole("dialog").getByRole("checkbox").check();
    await hospital.page.getByLabel("Duration (minutes)").selectOption("90");
    await save(hospital.page);
    for (const actor of [donor, recipient]) {
      await nav(actor.page, "Appointments");
      await actor.page
        .getByRole("button", { name: "Refresh workspace" })
        .click();
      await expect(actor.page.getByRole("table")).toContainText("Dr Workflow");
      await expect(actor.page.getByRole("table")).toContainText("90 minutes");
    }
    await nav(hospital.page, "Appointments");
    await hospital.page
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await hospital.page
      .getByLabel("Cancellation reason")
      .fill("Further clinical assessment required.");
    await save(hospital.page);
    await expect(hospital.page.getByRole("table")).toContainText("canceled");
    await nav(donor.page, "My pledges");
    await donor.page.getByRole("button", { name: "Refresh workspace" }).click();
    await expect(donor.page.getByRole("table")).toContainText("Withdrawn");
  } finally {
    for (const context of contexts) await context.close();
  }
});

test("public home, sign-in and registration share the vibrant responsive theme", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(page.locator(".care-entry-story")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await page.locator(".care-entry .care-brand").click();
  await expect(
    page.getByRole("heading", { name: /Bring every step/ }),
  ).toBeVisible();
  await expect(page.locator(".care-home-feature-icon")).toHaveCount(3);
  await expect(
    page.locator(".care-home-visual .care-orbit-heart"),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("home-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("home-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(
    page.getByRole("heading", { name: "Join your care network." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".care-button")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});

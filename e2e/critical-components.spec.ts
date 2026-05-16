import { expect, type Page, test } from "@playwright/test";
import { rmSync } from "fs";
import { resolve } from "path";

test.describe.configure({ mode: "serial" });

function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

function tomorrowDateInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function openPersonalWorkspace(page: Page) {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
}

async function chooseSubject(page: Page, subjectName: string, level: "HL" | "SL") {
  const subjectRow = page.getByText(subjectName, { exact: true }).locator("..");
  await subjectRow.getByRole("button", { name: level, exact: true }).click();
}

async function mockTaskCreate(page: Page, title: string, dueDate: string) {
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        task: {
          id: `task-${Date.now()}`,
          title,
          description: null,
          due_date: dueDate,
          due_time: null,
          priority: "high",
          completed: false,
          subject_id: null,
          created_at: new Date().toISOString(),
        },
      }),
    });
  });
}

async function mockResourceUpload(page: Page) {
  await page.route("**/api/resources/upload", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        resource: {
          id: `resource-${Date.now()}`,
          title: "Synapse E2E Resource",
          type: "other",
          tags: ["e2e"],
          subject_id: null,
          file_size: 128,
          created_at: new Date().toISOString(),
        },
      }),
    });
  });
}

async function mockSearch(page: Page) {
  await page.route("**/api/search?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            id: "search-result-1",
            source_type: "resource",
            source_id: "resource-1",
            content_text:
              "Equilibrium links Chemistry reversible reactions, Economics market balance, and Physics force systems.",
            metadata: {
              title: "Cross-subject equilibrium notes",
              subject_name: "Chemistry",
              subject_level: "HL",
            },
            similarity: 0.91,
          },
        ],
      }),
    });
  });
}

async function mockChat(page: Page) {
  await page.route("**/api/chat/history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(route.request().method() === "DELETE" ? { success: true } : { messages: [] }),
    });
  });

  await page.route("**/api/chat", async (route) => {
    const stream = [
      { type: "tool_start", name: "list_resources" },
      { type: "tool_result", name: "list_resources" },
      { type: "text", text: "I found your resources and can connect them to your study goals." },
      { type: "done" },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n`)
      .join("");

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: stream,
    });
  });
}

async function mockFlashcards(page: Page) {
  await page.route("**/api/flashcards**", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        flashcards: [
          {
            id: "flashcard-1",
            subject_id: null,
            resource_id: null,
            front: "What does equilibrium mean across IB subjects?",
            back: "A balanced state where opposing forces or incentives offset one another.",
            tags: ["equilibrium"],
            confidence: 0,
            next_review: new Date(Date.now() - 60_000).toISOString(),
            created_at: new Date().toISOString(),
          },
          {
            id: "flashcard-2",
            subject_id: null,
            resource_id: null,
            front: "Which Synapse feature surfaces cross-subject links?",
            back: "Semantic search across the student's own resource library.",
            tags: ["search"],
            confidence: 1,
            next_review: new Date(Date.now() - 60_000).toISOString(),
            created_at: new Date().toISOString(),
          },
        ],
      }),
    });
  });
}

test.describe("critical Synapse components", () => {
  test("opens personal workspace without an auth challenge", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toHaveCount(0);
  });

  test("stress-tests onboarding subject rules for the personal profile", async ({ page }) => {
    rmSync(resolve(process.cwd(), ".synapse-data"), { recursive: true, force: true });
    await page.goto("/onboarding");

    await test.step("select an exam session", async () => {
      await expect(page.getByRole("heading", { name: "When are your exams?" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
      await page.getByRole("button", { name: "May 2026" }).click();
      await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
      await page.getByRole("button", { name: "Continue" }).click();
    });

    await test.step("select exactly three HL and three SL subjects", async () => {
      await expect(page.getByRole("heading", { name: "Choose your 6 subjects" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Review" })).toBeDisabled();

      await chooseSubject(page, "Language A: Literature", "HL");
      await chooseSubject(page, "Economics", "HL");
      await chooseSubject(page, "Chemistry", "HL");
      await chooseSubject(page, "English B", "SL");
      await chooseSubject(page, "Mathematics: Analysis and Approaches (AA)", "SL");
      await chooseSubject(page, "Visual Arts", "SL");

      await expect(page.getByText("3/3 HL")).toBeVisible();
      await expect(page.getByText("3/3 SL")).toBeVisible();
      await expect(page.getByText("6/6 total")).toBeVisible();
      await expect(page.getByRole("button", { name: "Review" })).toBeEnabled();
      await page.getByRole("button", { name: "Review" }).click();
    });

    await test.step("review and build selected workspace", async () => {
      await expect(page.getByRole("heading", { name: "Your workspace is ready" })).toBeVisible();
      await expect(page.getByText("Synapse will generate IA folders")).toBeVisible();
      await expect(page.getByRole("button", { name: "Build my workspace" })).toBeEnabled();
      await page.getByRole("button", { name: "Build my workspace" }).click();
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test("stress-tests authenticated workspace shell and core interactions", async ({ page }) => {
    const taskTitle = uniqueTitle("E2E stress task");
    const dueDate = tomorrowDateInput();
    const resourceTitle = uniqueTitle("Synapse E2E Resource");

    await mockTaskCreate(page, taskTitle, dueDate);
    await mockResourceUpload(page);
    await mockSearch(page);
    await mockChat(page);
    await mockFlashcards(page);

    await test.step("open the personal workspace", async () => {
      await openPersonalWorkspace(page);
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole("heading", { name: /Good|Welcome|Hello|Morning|Afternoon|Evening/i })).toBeVisible();
    });

    await test.step("stress desktop sidebar navigation and collapse persistence", async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByLabel("Collapse sidebar").click();
      await expect(page.getByLabel("Expand sidebar")).toBeVisible();
      await expect(page.evaluate(() => localStorage.getItem("synapse-sidebar-collapsed"))).resolves.toBe("true");
      await page.getByLabel("Expand sidebar").click();
      await expect(page.getByLabel("Collapse sidebar")).toBeVisible();

      for (const route of [
        { link: "Dashboard", heading: /Good|Welcome|Hello|Morning|Afternoon|Evening/i },
        { link: "Calendar & Tasks", heading: "Calendar & Tasks" },
        { link: "Resource Library", heading: "Resource Library" },
        { link: "Search", heading: "Search" },
        { link: "AI Chat", heading: "Synapse AI" },
        { link: "Flashcards", heading: "Flashcards" },
        { link: "Subjects", heading: "Subjects" },
        { link: "The Core", heading: "The Core" },
        { link: "IA Manager", heading: "IA Manager" },
        { link: "Settings", heading: "Settings" },
      ] as const) {
        await page.getByRole("link", { name: route.link }).click();
        await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      }
    });

    await test.step("stress mobile navigation drawer", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/dashboard");
      await page.getByLabel("Open navigation").click();
      await expect(page.getByLabel("Close navigation")).toBeVisible();
      await page.getByRole("link", { name: "Search" }).click();
      await expect(page).toHaveURL(/\/search/);
      await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await test.step("create a calendar task through the modal", async () => {
      await page.goto("/calendar");
      await page.getByRole("button", { name: "Add Task" }).click();
      await expect(page.getByText("New Task")).toBeVisible();
      await page.getByPlaceholder("e.g. Finish Chemistry IA draft").fill(taskTitle);
      await page.locator('input[type="date"]').fill(dueDate);
      await page.getByRole("button", { name: "High" }).click();
      await page.getByRole("button", { name: "Create Task" }).click();
      await expect(page.getByText(taskTitle)).toBeVisible();
    });

    await test.step("exercise resource upload controls", async () => {
      await page.goto("/resources");
      await page.getByRole("button", { name: "Upload" }).click();
      await expect(page.getByRole("heading", { name: "Upload Resource" })).toBeVisible();
      await page.locator('input[type="file"]').setInputFiles({
        name: "synapse-e2e-resource.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Equilibrium\nCross-subject stress fixture."),
      });
      await page.getByPlaceholder("Resource title").fill(resourceTitle);
      await Promise.all([
        page.waitForResponse("**/api/resources/upload"),
        page.getByRole("button", { name: "Upload Resource" }).click(),
      ]);
      await expect(page.getByRole("button", { name: "Upload" })).toBeVisible();
    });

    await test.step("render deterministic semantic search results", async () => {
      await page.goto("/search");
      await page.getByRole("button", { name: "Equilibrium" }).click();
      await expect(page.getByText("1 result found across your workspace")).toBeVisible();
      await expect(page.getByText("Cross-subject equilibrium notes")).toBeVisible();
      await expect(page.getByText("91%")).toBeVisible();
    });

    await test.step("render deterministic AI chat streaming response", async () => {
      await page.goto("/chat");
      await expect(page.getByText("Synapse AI")).toBeVisible();
      await page.getByPlaceholder("Ask about your resources...").fill("List my resources");
      await page.keyboard.press("Enter");
      await expect(page.getByText("List my resources")).toBeVisible();
      await expect(page.getByText("I found your resources and can connect them to your study goals.")).toBeVisible();
    });

    await test.step("study mocked flashcards through the summary screen", async () => {
      await page.goto("/flashcards");
      await expect(page.getByRole("heading", { name: "Flashcards" })).toBeVisible();
      await page.getByRole("button", { name: "Study All" }).click();
      await expect(page.getByText("QUESTION")).toBeVisible();
      await page.getByText("Tap to reveal answer").click();
      await expect(page.getByText("ANSWER", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Good" }).click();
      await expect(page.getByText("Which Synapse feature surfaces cross-subject links?")).toBeVisible();
      await page.getByText("Tap to reveal answer").click();
      await page.getByRole("button", { name: "Perfect" }).click();
      await expect(page.getByText("Excellent!")).toBeVisible();
      await expect(page.getByText("You reviewed 2 of 2 cards")).toBeVisible();
    });
  });
});

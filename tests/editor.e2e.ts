import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { db } from "../lib/db";
config({ quiet: true });
const origin = process.env.EDITOR_ORIGIN || "http://localhost:3011";
test.beforeEach(async ({ page }) => {
  await page.goto(`${origin}/login`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.EDITOR_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
});
test("editor saves headings and equations, pastes images, and recovers revisions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.request.post(`${origin}/api/posts`, {
    headers: { Origin: origin },
    data: {
      title: "Browser test draft",
      slug: `browser-test-${Date.now()}`,
      summary: "Temporary verification",
      category: "Tests",
      cover: "",
      blocks: [
        {
          id: "test-heading",
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Engineering test", styles: {} }],
        },
        { id: "test-math", type: "mathBlock", content: "E=mc^2" },
        {
          id: "test-paragraph",
          type: "paragraph",
          content: [{ type: "text", text: "Paste image below.", styles: {} }],
        },
      ],
    },
  });
  expect(response.status()).toBe(201);
  const post = await response.json();
  try {
    await page.goto(`${origin}/`);
    await expect(
      page.getByRole("textbox", { name: "Article title" }),
    ).toHaveValue("Browser test draft");
    await expect(page.locator(".bn-editor")).toBeVisible();
    await expect(page.locator(".bn-editor math").first()).toBeVisible();
    await page
      .getByRole("textbox", { name: "Article title" })
      .fill("Browser test saved");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved · revision");
    const body = page.locator(".bn-editor [contenteditable=true]").last();
    const target = (await body.count()) ? body : page.locator(".bn-editor");
    await target.click();
    await page.evaluate(() => {
      const bytes = Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JQUAAAAASUVORK5CYII=",
        ),
        (c) => c.charCodeAt(0),
      );
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([bytes], "pasted-test.png", { type: "image/png" }),
      );
      document.querySelector(".bn-editor")!.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer,
        }),
      );
    });
    await expect(page.locator('.bn-editor img[src^="/media/"]')).toHaveCount(
      1,
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved · revision");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.locator(".prose img")).toHaveCount(1);
    await expect(page.locator(".prose .katex")).toBeVisible();
    await page.getByRole("button", { name: "History", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Restore r1", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Article title" }),
    ).toHaveValue("Browser test draft");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved · revision");
    await page.screenshot({
      path: ".local/editor-browser-check.png",
      fullPage: true,
    });
    await page
      .getByRole("textbox", { name: "Article title" })
      .fill("Saved on sign out");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL("**/login");
    expect(
      (await db().query("SELECT title FROM posts WHERE id=$1", [post.id]))
        .rows[0].title,
    ).toBe("Saved on sign out");
    expect((await page.request.get(`${origin}/api/posts`)).status()).toBe(401);
    expect(errors).toEqual([]);
  } finally {
    await db().query("DELETE FROM posts WHERE id=$1", [post.id]);
  }
});
test.afterAll(async () => {
  await db().end();
  delete (globalThis as {pbPool?: unknown}).pbPool;
});

import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { createPost } from "../lib/posts";
import { createTag } from "../lib/tags";
import { demo } from "../shared/demo";
if (!process.env.DATABASE_URL?.endsWith("/publish_test"))
  throw new Error("Use isolated publish_test database");
const origin = process.env.EDITOR_ORIGIN!;
test.use({ actionTimeout: 8000 });
test("search, tag filtering, visible history, and publication progress survive reload", async ({
  page,
}) => {
  const tag = await createTag("Test robotics " + randomUUID().slice(0, 6));
  const second = await createPost({
    ...demo,
    title: "Thermal fixture",
    summary: "Temperature control study",
    slug: "test-" + randomUUID(),
    blocks: [],
    cover: "",
    tags: [],
  });
  const post = await createPost({
    ...demo,
    title: "Searchable motor fixture",
    summary: "Calibration bench",
    slug: "test-" + randomUUID(),
    blocks: [],
    cover: "",
    tags: [tag],
  });
  try {
    await db().query(
      "INSERT INTO publisher_state(id,heartbeat_at) VALUES(true,now()) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()",
    );
    await page.goto(origin + "/login");
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.EDITOR_PASSWORD!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Article title" }),
    ).toHaveValue(post.title);
    const search = page.getByRole("searchbox", { name: "Search articles" });
    await search.fill("temperature");
    await expect(page.locator(".article-list > button")).toHaveCount(1);
    await expect(page.locator(".article-list > button")).toContainText(
      second.title,
    );
    await search.fill(tag.name);
    await expect(page.locator(".article-list > button")).toHaveCount(1);
    await expect(page.locator(".article-list > button")).toContainText(
      post.title,
    );
    await search.fill("not-a-match");
    await expect(
      page.getByText("No articles match your search."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page
      .getByRole("combobox", { name: "Filter by tag" })
      .selectOption(tag.id);
    await expect(page.locator(".article-list > button")).toHaveCount(1);
    const signout = await page
      .getByRole("button", { name: "Sign out", exact: true })
      .boundingBox();
    expect(signout!.y).toBeLessThan(110);
    await page.route("**/revisions", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "History temporarily unavailable" }),
      }),
    );
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Revision history" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Revision history" }).getByRole("alert"),
    ).toContainText("History temporarily unavailable");
    await page.getByRole("button", { name: "Close history" }).click();
    await page.unroute("**/revisions");
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(
      page.getByText("Revision 1 ·", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close history" }).click();
    await page.locator(".article-settings > summary").click();
    await page
      .getByRole("textbox", { name: "Entry date", exact: true })
      .fill("2018-03-07");
    await page
      .getByRole("textbox", { name: "Article title" })
      .fill("Motor fixture ready for publication");
    await page
      .getByRole("button", { name: "Publish to website", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Website publishing" }),
    ).toContainText("Waiting for publisher");
    const job = (
      await db().query("SELECT * FROM publication_jobs WHERE post_id=$1", [
        post.id,
      ])
    ).rows[0];
    expect(job.articles.find((item: any) => item.id === post.id).title).toBe(
      "Motor fixture ready for publication",
    );
    expect(
      job.articles.find((item: any) => item.id === post.id).entryDate,
    ).toBe("2018-03-07");
    expect(job.articles.some((item: any) => item.id === second.id)).toBe(false);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Publishing…", exact: true }),
    ).toBeDisabled();
    await db().query(
      "UPDATE publication_jobs SET state='succeeded',message='Published to website',finished_at=now() WHERE id=$1",
      [job.id],
    );
    await expect(
      page.getByRole("region", { name: "Website publishing" }),
    ).toContainText("Published to website", { timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Publish to website", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("region", { name: "Website publishing" }),
    ).toHaveCount(0, { timeout: 12000 });
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Article title" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Website publishing" }),
    ).toHaveCount(0);
    await page.screenshot({
      path: ".local/publisher-editor-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/publisher-editor-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL("**/login");
    expect(
      (await page.request.get(origin + "/api/publications")).status(),
    ).toBe(401);
  } finally {
    await db().query("DELETE FROM publication_jobs WHERE post_id=$1", [
      post.id,
    ]);
    await db().query("DELETE FROM posts WHERE id=ANY($1::uuid[])", [
      [post.id, second.id],
    ]);
    await db().query("DELETE FROM tags WHERE id=$1", [tag.id]);
  }
});
test.afterAll(async () => {
  await db().end();
  delete (globalThis as { pbPool?: unknown }).pbPool;
});

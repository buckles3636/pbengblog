import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
if (!process.env.DATABASE_URL?.endsWith("/publish_test"))
  throw Error("Use isolated publish_test database");
const origin = process.env.EDITOR_ORIGIN!;
test("private ideas support reusable tags, details, completion, conflicts and deletion", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", e => browserErrors.push(e.message));
  const title = `Desk sensor ${randomUUID().slice(0, 8)}`;
  let id = "";
  try {
    expect((await page.request.get(origin + "/api/ideas")).status()).toBe(401);
    await page.goto(origin + "/ideas");
    await expect(page).toHaveURL(/\/login$/);
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.EDITOR_PASSWORD!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("button", { name: "Project ideas", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Project ideas" }),
    ).toBeVisible();
    await page.getByLabel("Project title", { exact: true }).fill(title);
    await page
      .getByLabel("Details (optional)")
      .fill(
        "Measure the workshop temperature.\nUse an enclosure from the parts bin.",
      );
    await page.getByLabel("Server", { exact: true }).check();
    await page.getByRole("button", { name: "Add idea", exact: true }).click();
    const row = page.locator(".ideas-list li").filter({ hasText: title });
    await expect(row).toBeVisible();
    let items = await (await page.request.get(origin + "/api/ideas")).json();
    const idea = items.find((i: any) => i.title === title);
    id = idea.id;
    expect(idea.tags[0].name).toBe("Server");
    expect(idea.details).toContain("parts bin");
    expect(
      (
        await page.request.post(origin + "/api/ideas", {
          headers: { Origin: "https://wrong.example" },
          data: { title: "Do not create" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(origin + "/api/ideas", {
          headers: { Origin: origin },
          data: { title: " " },
        })
      ).status(),
    ).toBe(400);
    await page.reload();
    await expect(row).toBeVisible();
    await page
      .getByLabel("Filter ideas by tag")
      .selectOption({ label: "Hardware" });
    await expect(row).toHaveCount(0);
    await page
      .getByLabel("Filter ideas by tag")
      .selectOption({ label: "Server" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Details (optional)").fill("Keep this unsaved note");
    // A newer write must not be silently overwritten by this tab.
    const newer = await page.request.put(origin + "/api/ideas/" + id, {
      headers: { Origin: origin },
      data: { ...idea, details: "Saved in another tab" },
    });
    expect(newer.status()).toBe(200);
    await page.getByRole("button", { name: "Save idea", exact: true }).click();
    await expect(page.locator(".idea-form [role=alert]")).toContainText(
      "another tab",
    );
    await expect(page.getByLabel("Details (optional)")).toHaveValue(
      "Keep this unsaved note",
    );
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Reload list", exact: true })
      .click();
    await expect(page.locator(".idea-form [role=alert]")).toHaveCount(0);
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Details (optional)").fill("Final project notes");
    await page.getByLabel("Hardware", { exact: true }).check();
    await page.getByRole("button", { name: "Save idea", exact: true }).click();
    await expect(page.getByLabel("Project title", { exact: true })).toHaveValue(
      "",
    );
    await row.getByRole("checkbox").click();
    await expect(row).toHaveCount(0);
    await page.getByRole("combobox", { name: /^Show/ }).selectOption("done");
    await expect(row.getByRole("checkbox")).toBeChecked();
    await page.reload();
    await page.getByRole("combobox", { name: /^Show/ }).selectOption("done");
    await expect(row.getByRole("checkbox")).toBeChecked();
    await row.getByText("Details", { exact: true }).click();
    await expect(row).toContainText("Final project notes");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await row.getByRole("checkbox").click();
    await page.getByRole("combobox", { name: /^Show/ }).selectOption("open");
    await expect(row).toBeVisible();
    const posts = await (await page.request.get(origin + "/api/posts")).json();
    expect(posts.some((p: any) => p.title === title)).toBe(false);
    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get(origin + "/api/ideas")).status()).toBe(401);
    expect(browserErrors).toEqual([]);
  } finally {
    if (id) await db().query("DELETE FROM project_ideas WHERE id=$1", [id]);
  }
});
test.afterAll(async () => {
  await db().end();
  delete (globalThis as { pbPool?: unknown }).pbPool;
});

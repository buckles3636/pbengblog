import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { createPost } from "../lib/posts";
import { demo } from "../shared/demo";
if (!process.env.DATABASE_URL?.endsWith("/publish_test"))
  throw Error("Use isolated publish_test database");
const origin = process.env.EDITOR_ORIGIN!;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JQUAAAAASUVORK5CYII=",
  "base64",
);
test("password-only studio uploads and removes covers, preserves failed replacements, and stays readable in dark OS mode", async ({
  page,
}) => {
  const post = await createPost({
    ...demo,
    title: "A small idea, taking shape",
    summary: "A fictional bench experiment, with room for the next iteration.",
    slug: "test-" + randomUUID(),
    tags: [],
    cover: "",
    blocks: [],
  });
  try {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(origin + "/login");
    await expect(page.getByLabel("Username", { exact: true })).toHaveCount(0);
    const missing = await page.request.post(origin + "/api/auth/login", {
      headers: { Origin: origin },
      data: {},
    });
    expect(missing.status()).toBe(401);
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.EDITOR_PASSWORD!);
    const login = page.waitForRequest((r) =>
      r.url().endsWith("/api/auth/login"),
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    expect(Object.keys((await login).postDataJSON())).toEqual(["password"]);
    await expect(
      page.getByRole("textbox", { name: "Article title" }),
    ).toHaveValue(post.title);
    await expect(
      page.getByRole("region", { name: "Website publishing" }),
    ).toHaveCount(0);
    const filter = page.getByRole("combobox", { name: "Filter by tag" });
    const colors = await filter.evaluate((e) => ({
      color: getComputedStyle(e).color,
      background: getComputedStyle(e).backgroundColor,
      scheme: getComputedStyle(e).colorScheme,
    }));
    expect(colors).toEqual({
      color: "rgb(23, 23, 23)",
      background: "rgb(255, 255, 255)",
      scheme: "light",
    });
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload cover", exact: true }).click();
    await (await chooser).setFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
    const preview = page.getByAltText("Article cover preview");
    await expect(preview).toBeVisible();
    const cover = await preview.getAttribute("src");
    expect(cover).toMatch(/^\/media\/.*\.png$/);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.locator(".save-status")).toContainText(
      "Saved · revision",
    );
    await page.reload();
    await expect(preview).toHaveAttribute("src", cover!);
    await page
      .getByLabel("Choose cover image")
      .setInputFiles({
        name: "bad.png",
        mimeType: "image/png",
        buffer: Buffer.from("This is not an image"),
      });
    await expect(page.locator(".cover-editor [role=alert]")).toContainText(
      "Use a PNG",
    );
    await expect(preview).toHaveAttribute("src", cover!);
    await page
      .getByRole("button", { name: "Remove cover", exact: true })
      .click();
    await expect(preview).toHaveCount(0);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.locator(".save-status")).toContainText(
      "Saved · revision",
    );
    expect(
      (await (await page.request.get(origin + "/api/posts/" + post.id)).json())
        .cover,
    ).toBe("");
    await page.screenshot({
      path: ".local/studio-fictional-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/studio-fictional-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL("**/login");
    expect((await page.request.get(origin + "/api/posts")).status()).toBe(401);
  } finally {
    await db().query("DELETE FROM posts WHERE id=$1", [post.id]);
  }
});
test.afterAll(async () => {
  await db().end();
  delete (globalThis as { pbPool?: unknown }).pbPool;
});

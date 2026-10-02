import { z } from "zod";

export type Inline =
  | string
  | {
      type: string;
      text?: string;
      content?: Inline[] | string;
      href?: string;
      styles?: Record<string, boolean | string>;
    };
export type TableCell =
  | Inline[]
  | { type: "tableCell"; content: Inline[]; props?: Record<string, unknown> };
export type Block = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?:
    | Inline[]
    | string
    | {
        type: "tableContent";
        rows: { cells: TableCell[] }[];
        columnWidths?: (number | undefined)[];
        headerRows?: number;
        headerCols?: number;
      };
  children?: Block[];
};
export type Tag = { id: string; name: string };
export const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[^\x00-\x1f\x7f]+$/, "Tag names cannot contain control characters");
export const tagSchema = z.object({ id: z.uuid(), name: tagNameSchema });
export type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags?: Tag[];
  cover: string;
  blocks: Block[];
  version: number;
  updatedAt: string;
  entryDate?: string;
};
export type Post = Article & {
  published: Article | null;
  notionId?: string | null;
};
const reserved = new Set([
  "api",
  "media",
  "_next",
  "robots",
  "sitemap",
  "admin",
]);
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,159}$/)
  .refine((v) => !reserved.has(v), "This URL is reserved.");
export function safeUrl(value: unknown, image = false): string | undefined {
  if (typeof value !== "string" || !value || /[\\\x00-\x20]/.test(value))
    return undefined;
  if (/^\/(?!\/)/.test(value)) return value;
  if (value.startsWith("#") && !image) return value;
  try {
    const url = new URL(value);
    return (image
      ? ["https:", "http:"]
      : ["https:", "http:", "mailto:"]
    ).includes(url.protocol)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
const inlineSchema: z.ZodType<Inline> = z.lazy(() =>
  z.union([
    z.string().max(200000),
    z
      .object({
        type: z.literal("text"),
        text: z.string().max(200000),
        styles: z
          .record(
            z.string().max(50),
            z.union([z.boolean(), z.string().max(200)]),
          )
          .optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("link"),
        href: z
          .string()
          .max(4000)
          .refine((v) => !!safeUrl(v)),
        content: z.array(inlineSchema).max(20000),
      })
      .strict(),
    z
      .object({
        type: z.literal("math"),
        content: z.string().max(50000),
        props: z.object({}).optional(),
      })
      .strict(),
  ]),
);
const propsSchema = z.record(
  z.string().max(100),
  z.union([
    z.string().max(10000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(z.number().finite()).max(500),
  ]),
);
const tableSchema = z.object({
  type: z.literal("tableContent"),
  columnWidths: z
    .array(z.number().nonnegative().optional())
    .max(100)
    .optional(),
  headerRows: z.number().int().min(0).max(1000).optional(),
  headerCols: z.number().int().min(0).max(100).optional(),
  rows: z
    .array(
      z.object({
        cells: z
          .array(
            z.union([
              z.array(inlineSchema),
              z.object({
                type: z.literal("tableCell"),
                content: z.array(inlineSchema),
                props: propsSchema.optional(),
              }),
            ]),
          )
          .max(100),
      }),
    )
    .max(1000),
});
const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z
    .object({
      id: z
        .string()
        .min(1)
        .max(200)
        .regex(/^[a-zA-Z0-9_-]+$/),
      type: z.enum([
        "paragraph",
        "heading",
        "bulletListItem",
        "numberedListItem",
        "checkListItem",
        "toggleListItem",
        "quote",
        "codeBlock",
        "mathBlock",
        "image",
        "file",
        "video",
        "audio",
        "table",
        "divider",
      ]),
      props: propsSchema.optional(),
      content: z
        .union([
          z.array(inlineSchema).max(20000),
          z.string().max(200000),
          tableSchema,
        ])
        .optional(),
      children: z.array(blockSchema).max(10000).optional(),
    })
    .strict()
    .superRefine((b, ctx) => {
      if (
        b.type === "heading" &&
        b.props?.level !== undefined &&
        ![1, 2, 3, 4, 5, 6].includes(Number(b.props.level))
      )
        ctx.addIssue({ code: "custom", message: "Invalid heading level" });
      if (b.props?.url && !safeUrl(b.props.url, true))
        ctx.addIssue({ code: "custom", message: "Invalid attachment URL" });
      if (
        b.type === "table" &&
        (!b.content ||
          Array.isArray(b.content) ||
          typeof b.content === "string")
      )
        ctx.addIssue({ code: "custom", message: "Table content is required" });
      if (
        b.type !== "table" &&
        b.content &&
        !Array.isArray(b.content) &&
        typeof b.content !== "string"
      )
        ctx.addIssue({ code: "custom", message: "Unexpected table content" });
    }),
);
// Bound recursion before parsing nested editor documents.
function bounded(value: unknown): boolean {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (depth > 50 || ++nodes > 250000) return false;
    if (value && typeof value === "object")
      for (const child of Object.values(value))
        stack.push({ value: child, depth: depth + 1 });
  }
  return true;
}
const blocksSchema = z
  .unknown()
  .refine(bounded, "Document is too large or deeply nested")
  .pipe(z.array(blockSchema).max(10000))
  .superRefine((blocks, ctx) => {
    const ids = new Set<string>();
    const visit = (items: Block[]) => {
      for (const b of items) {
        if (ids.has(b.id))
          ctx.addIssue({
            code: "custom",
            message: `Duplicate block ID: ${b.id}`,
          });
        ids.add(b.id);
        visit(b.children ?? []);
      }
    };
    visit(blocks);
  });
export const entryDateSchema = z.string().refine((value) => {
  if (!value) return true;
  if (!/^[1-9][0-9]{3}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12][0-9]|3[01]))?)?$/.test(value)) return false;
  if (value.length < 10) return true;
  return new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}, "Use a valid YYYY, YYYY-MM, or YYYY-MM-DD date.");
export const draftSchema = z.object({
  entryDate: entryDateSchema.default(""),
  title: z.string().trim().min(1).max(200),
  slug: slugSchema,
  summary: z.string().max(1000),
  category: z.string().max(100),
  tags: z.array(tagSchema).max(30).default([]),
  cover: z
    .string()
    .max(4000)
    .refine((v) => !v || !!safeUrl(v, true)),
  blocks: blocksSchema,
  version: z.number().int().positive().optional(),
});
export function inlineText(content: Block["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      typeof part === "string" ? part : (part.text ?? inlineText(part.content)),
    )
    .join("");
}
export function headings(
  blocks: Block[],
): { id: string; title: string; level: number }[] {
  return blocks.flatMap((b) => [
    ...(b.type === "heading"
      ? [
          {
            id: b.id,
            title: inlineText(b.content),
            level: Number(b.props?.level ?? 2),
          },
        ]
      : []),
    ...headings(b.children ?? []),
  ]);
}

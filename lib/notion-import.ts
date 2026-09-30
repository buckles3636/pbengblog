import type { Block, Inline } from "../shared/content";
import { safeUrl } from "../shared/content";
export type NotionBlock = {
  id: string;
  type: string;
  content?: string[];
  properties?: Record<string, any>;
  format?: Record<string, any>;
  [key: string]: any;
};
export function unwrap(record: any): any {
  let value = record;
  for (let i = 0; i < 4 && value?.value; i++) value = value.value;
  return value;
}
export function plain(value: any): string {
  return Array.isArray(value)
    ? value.map((v) => (typeof v === "string" ? v : (v[0] ?? ""))).join("")
    : typeof value === "string"
      ? value
      : "";
}
export function rewriteLink(href: string, routes: Map<string, string>): string {
  try {
    const url = new URL(href, "https://www.notion.so");
    if (
      url.hostname === "www.notion.so" ||
      url.hostname === "notion.so" ||
      url.hostname.endsWith(".notion.site")
    ) {
      const id = url.pathname.replace(/-/g, "").match(/[a-f0-9]{32}$/i)?.[0];
      if (id && routes.has(id)) {
        const anchor = url.hash.slice(1).replace(/-/g, "");
        const normalized =
          anchor.length === 32
            ? `${anchor.slice(0, 8)}-${anchor.slice(8, 12)}-${anchor.slice(12, 16)}-${anchor.slice(16, 20)}-${anchor.slice(20)}`
            : anchor;
        return `/${routes.get(id)}${normalized ? `#${normalized}` : ""}`;
      }
    }
  } catch {}
  return href;
}
export function rich(
  value: any,
  routes: Map<string, string>,
  warnings: string[],
): Inline[] {
  if (!Array.isArray(value)) return [];
  return value.map((part: any): Inline => {
    let text = String(part[0] ?? "");
    const marks = Array.isArray(part[1]) ? part[1] : [];
    const styles: Record<string, boolean> = {};
    let href: string | undefined;
    for (const mark of marks) {
      const type = mark[0];
      if (type === "e")
        return { type: "math", content: String(mark[1] ?? text) };
      if (type === "a") href = rewriteLink(String(mark[1]), routes);
      else if (["b", "i", "s", "_", "c"].includes(type))
        styles[
          (
            {
              b: "bold",
              i: "italic",
              s: "strike",
              _: "underline",
              c: "code",
            } as Record<string, string>
          )[type]
        ] = true;
      else if (type === "p") {
        const id = String(mark[1]).replace(/-/g, "");
        if (routes.has(id)) {
          text = `/${routes.get(id)}`;
          href = text;
        } else {
          warnings.push(`Unresolved page mention: ${mark[1]}`);
          text = `[Notion page ${mark[1]}]`;
        }
      } else if (type !== "h")
        warnings.push(`Inline annotation '${type}' needs review`);
    }
    const node: Inline = { type: "text", text, styles };
    return href && safeUrl(href)
      ? { type: "link", href, content: [node] }
      : node;
  });
}
export function convertPage(
  pageId: string,
  records: Record<string, NotionBlock>,
  routes: Map<string, string>,
  media: Map<string, string>,
) {
  const warnings: string[] = [];
  const visited = new Set<string>();
  const textBlock = (id: string, text: string): Block => ({
    id,
    type: "paragraph",
    content: [{ type: "text", text, styles: {} }],
  });
  function convert(id: string): Block[] {
    if (visited.has(id)) {
      warnings.push(`Repeated/cyclic block ${id}`);
      return [];
    }
    visited.add(id);
    const b = records[id];
    if (!b) {
      warnings.push(`Missing source block ${id}`);
      return [
        textBlock(id, `[Migration review: source block ${id} was unavailable]`),
      ];
    }
    const props = b.properties ?? {},
      title = rich(props.title, routes, warnings),
      children = (b.content ?? []).flatMap(convert);
    const base = { id, children };
    switch (b.type) {
      case "text":
        return [{ ...base, type: "paragraph", content: title }];
      case "header":
      case "sub_header":
      case "sub_sub_header":
        return [
          {
            ...base,
            type: "heading",
            props: {
              level: (
                { header: 1, sub_header: 2, sub_sub_header: 3 } as Record<
                  string,
                  number
                >
              )[b.type],
            },
            content: title,
          },
        ];
      case "bulleted_list":
        return [{ ...base, type: "bulletListItem", content: title }];
      case "numbered_list":
        return [{ ...base, type: "numberedListItem", content: title }];
      case "to_do":
        return [
          {
            ...base,
            type: "checkListItem",
            props: { checked: plain(props.checked) === "Yes" },
            content: title,
          },
        ];
      case "toggle":
        return [{ ...base, type: "toggleListItem", content: title }];
      case "quote":
        return [{ ...base, type: "quote", content: title }];
      case "callout":
        warnings.push(`Callout ${id} converted to a quote`);
        return [{ ...base, type: "quote", content: title }];
      case "code":
        return [
          {
            ...base,
            type: "codeBlock",
            props: { language: plain(props.language).toLowerCase() || "text" },
            content: plain(props.title),
          },
        ];
      case "equation":
        return [{ ...base, type: "mathBlock", content: plain(props.title) }];
      case "divider":
        return [{ ...base, type: "divider" }];
      case "image": {
        const url = media.get(id);
        if (!url) {
          warnings.push(`Image ${id} was not downloaded`);
          return [
            textBlock(
              id,
              `[Migration review: missing image — ${plain(props.caption) || id}]`,
            ),
            ...children,
          ];
        }
        return [
          {
            ...base,
            type: "image",
            props: {
              url,
              caption: plain(props.caption),
              name: plain(props.caption) || "Imported image",
            },
          },
        ];
      }
      case "column_list":
      case "column":
        return children;
      case "table_of_contents":
        return []; // Generated from headings by the website.
      case "table": {
        const columns = b.format?.table_block_column_order ?? [];
        const rows = (b.content ?? []).map((row) => ({
          cells: columns.map((key: string) =>
            rich(records[row]?.properties?.[key], routes, warnings),
          ),
        }));
        return [
          {
            id,
            type: "table",
            content: {
              type: "tableContent",
              headerRows: b.format?.table_block_row_header ? 1 : 0,
              rows,
            },
          },
        ];
      }
      case "table_row":
        return [];
      case "bookmark":
      case "embed":
      case "video":
      case "audio":
      case "file":
      case "pdf": {
        const url = rewriteLink(
          plain(props.source) || b.format?.display_source || "",
          routes,
        );
        warnings.push(
          `${b.type} ${id} retained as an external link; attachment not archived`,
        );
        return [
          {
            ...base,
            type: "paragraph",
            content: [
              {
                type: "text",
                text: `${plain(props.title) || b.type}: `,
                styles: {},
              },
              ...(safeUrl(url)
                ? ([
                    {
                      type: "link",
                      href: url,
                      content: [{ type: "text", text: url, styles: {} }],
                    },
                  ] as Inline[])
                : []),
            ],
          },
        ];
      }
      case "page": {
        const slug = routes.get(id.replace(/-/g, ""));
        return [
          {
            id,
            type: "paragraph",
            content: slug
              ? [
                  {
                    type: "link",
                    href: `/${slug}`,
                    content: [
                      { type: "text", text: plain(props.title), styles: {} },
                    ],
                  },
                ]
              : [
                  {
                    type: "text",
                    text: `[Linked page: ${plain(props.title)}]`,
                    styles: {},
                  },
                ],
          },
        ];
      }
      default:
        warnings.push(`Unsupported block '${b.type}' (${id})`);
        return [
          textBlock(id, `[Migration review: ${b.type}] ${plain(props.title)}`),
          ...children,
        ];
    }
  }
  const root = records[pageId];
  if (!root) throw new Error("Root page missing");
  if (!root.content?.length)
    warnings.push("Source page has no body; metadata and cover imported only.");
  return {
    blocks: (root.content ?? []).flatMap(convert),
    warnings: [...new Set(warnings)],
    sourceBlocks: visited.size,
  };
}

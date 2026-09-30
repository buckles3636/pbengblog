import HeadingOutline from "./HeadingOutline";
import React, { type ReactNode } from "react";
import katex from "katex";
import {
  type Block,
  type Inline,
  headings,
  inlineText,
  safeUrl,
} from "./content";
function Math({
  source,
  display = false,
}: {
  source: string;
  display?: boolean;
}) {
  return (
    <span
      className={display ? "equation" : "inline-equation"}
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(source, {
          displayMode: display,
          throwOnError: false,
          trust: false,
          strict: "warn",
          output: "htmlAndMathml",
        }),
      }}
    />
  );
}
function Rich({
  content,
}: {
  content: Inline[] | string | undefined;
}): ReactNode {
  if (typeof content === "string") return content;
  return content?.map((part, i) => {
    if (typeof part === "string")
      return <React.Fragment key={i}>{part}</React.Fragment>;
    if (part.type === "math")
      return (
        <Math
          key={i}
          source={
            typeof part.content === "string"
              ? part.content
              : inlineText(part.content)
          }
        />
      );
    if (part.type === "link")
      return (
        <a key={i} href={safeUrl(part.href)} rel="noreferrer">
          <Rich content={part.content} />
        </a>
      );
    let node: ReactNode = part.text ?? "";
    if (part.styles?.code) node = <code>{node}</code>;
    if (part.styles?.bold) node = <strong>{node}</strong>;
    if (part.styles?.italic) node = <em>{node}</em>;
    if (part.styles?.underline) node = <u>{node}</u>;
    if (part.styles?.strike) node = <s>{node}</s>;
    return <React.Fragment key={i}>{node}</React.Fragment>;
  });
}
function Nodes({ blocks }: { blocks: Block[] }) {
  return blocks.map((block) => {
    const c = (
      <Rich
        content={
          Array.isArray(block.content) || typeof block.content === "string"
            ? block.content
            : undefined
        }
      />
    );
    const props = block.props ?? {};
    let node: ReactNode;
    switch (block.type) {
      case "heading": {
        const Tag =
          `h${MathGlobal.min(6, MathGlobal.max(1, Number(props.level ?? 2)))}` as
            "h1" | "h2" | "h3";
        node = <Tag id={block.id}>{c}</Tag>;
        break;
      }
      case "image":
        node = (
          <figure>
            <img
              src={safeUrl(props.url, true)}
              alt={String(props.caption || props.name || "")}
              loading="lazy"
            />
            <figcaption>{String(props.caption ?? "")}</figcaption>
          </figure>
        );
        break;
      case "mathBlock":
        node = <Math source={inlineText(block.content)} display />;
        break;
      case "codeBlock":
        node = (
          <pre>
            <code>{inlineText(block.content)}</code>
          </pre>
        );
        break;
      case "bulletListItem":
        node = (
          <ul>
            <li>{c}</li>
          </ul>
        );
        break;
      case "numberedListItem":
        node = (
          <ol start={Number(props.start ?? 1)}>
            <li>{c}</li>
          </ol>
        );
        break;
      case "checkListItem":
        node = (
          <p className="check-item">
            <input
              type="checkbox"
              checked={!!props.checked}
              readOnly
              aria-label="Task status"
            />{" "}
            {c}
          </p>
        );
        break;
      case "quote":
        node = <blockquote>{c}</blockquote>;
        break;
      case "divider":
        node = <hr />;
        break;
      case "file":
      case "video":
      case "audio":
        node = (
          <p>
            <a href={safeUrl(props.url)}>
              {String(props.caption || props.name || "Attachment")}
            </a>
          </p>
        );
        break;
      case "table": {
        const rows =
          block.content &&
          !Array.isArray(block.content) &&
          typeof block.content !== "string"
            ? block.content.rows
            : [];
        node = (
          <div className="table-scroll">
            <table>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {row.cells.map((cell, j) => (
                      <td key={j}>
                        <Rich
                          content={Array.isArray(cell) ? cell : cell.content}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        break;
      }
      case "paragraph":
        node = <p>{c}</p>;
        break;
      default:
        node = <p>{c || `[Unsupported block: ${block.type}]`}</p>;
    }
    return (
      <React.Fragment key={block.id}>
        {node}
        {block.children?.length ? (
          <div className="block-children">
            <Nodes blocks={block.children} />
          </div>
        ) : null}
      </React.Fragment>
    );
  });
}
const MathGlobal = globalThis.Math;
export function Outline({
  blocks,
  editor = false,
}: {
  blocks: Block[];
  editor?: boolean;
}) {
  return <HeadingOutline items={headings(blocks)} editor={editor} />;
}
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="article-grid">
      <article className="prose">
        <Nodes blocks={blocks} />
      </article>
      <Outline blocks={blocks} />
    </div>
  );
}

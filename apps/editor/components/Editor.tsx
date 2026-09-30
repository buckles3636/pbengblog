"use client";
import { BlockNoteSchema, combineByGroup } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { BlockNoteView } from "@blocknote/mantine";
import {
  useCreateBlockNote,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
} from "@blocknote/react";
import {
  createReactMathBlockSpec,
  createReactInlineMathSpec,
  getMathSlashMenuItems,
  locales,
} from "@blocknote/math-block";
import { en } from "@blocknote/core/locales";
import "@blocknote/mantine/style.css";
import type { Block } from "../../../shared/content";
const schema = BlockNoteSchema.create().extend({
  blockSpecs: { mathBlock: createReactMathBlockSpec() },
  inlineContentSpecs: { math: createReactInlineMathSpec() },
});
export default function Editor({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  const editor = useCreateBlockNote({
    schema,
    dictionary: { ...en, math: locales.en },
    initialContent: blocks.length ? (blocks as any) : undefined,
    uploadFile: async (file) => {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data.url;
    },
  });
  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      slashMenu={false}
      onChange={() => onChange(editor.document as unknown as Block[])}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(
            combineByGroup(
              getDefaultReactSlashMenuItems(editor),
              getMathSlashMenuItems(editor),
            ),
            query,
          )
        }
      />
    </BlockNoteView>
  );
}

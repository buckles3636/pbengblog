import type { CSSProperties } from "react";
import type { Tag } from "./content";
// Stable by tag ID, including after renaming. Text and selection outlines remain
// meaningful without color; soft backgrounds keep the notebook palette readable.
export function tagStyle(tag: Tag): CSSProperties {
  let hash = 2166136764;
  for (const char of tag.id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const hue = (hash >>> 0) % 360;
  return {
    "--tag-bg": `hsl(${hue} 48% 90%)`,
    "--tag-ink": `hsl(${hue} 58% 23%)`,
    "--tag-border": `hsl(${hue} 34% 65%)`,
  } as CSSProperties;
}

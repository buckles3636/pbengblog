import { z } from "zod";
import { tagSchema } from "./content";
export const ideaInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  details: z.string().max(20000).default(""),
  tags: z.array(tagSchema).max(30).default([]),
  done: z.boolean().default(false),
});
export const ideaSaveSchema = ideaInputSchema.extend({
  version: z.number().int().positive(),
});
export type IdeaInput = z.infer<typeof ideaInputSchema>;
export type ProjectIdea = IdeaInput & {
  id: string;
  version: number;
  updatedAt: string;
};

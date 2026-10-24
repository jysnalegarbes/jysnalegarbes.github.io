import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One Markdown file per project in src/content/projects/.
// Frontmatter drives the Work gallery and the case study page; `order` sets the sequence.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      category: z.string(),
      year: z.number().int(),
      order: z.number(),
      cover: image(),
      coverAlt: z.string(),
      summary: z.string(),
      scope: z.array(z.string()).default([]),
      tools: z.string(),
      gallery: z
        .array(z.object({ image: image(), alt: z.string() }))
        .default([]),
      draft: z.boolean().default(false),
    }),
});

// Experiments for the In Progress page. `image` is optional: entries without one
// render as a solid placeholder tile.
const inProgress = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/in-progress' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      order: z.number(),
      image: image().optional(),
      alt: z.string().default(''),
      draft: z.boolean().default(false),
    }),
});

export const collections = { projects, 'in-progress': inProgress };

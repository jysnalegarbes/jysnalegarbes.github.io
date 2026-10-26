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

// Effects library (/lab/): one round.md per option round in lab/<project>/<page>/<round>/,
// next to the code it describes. `files` are relative to that folder; `demo` names a
// page in src/pages/lab/demo/ that takes ?pfx=<option number>.
const lab = defineCollection({
  loader: glob({ pattern: '**/round.md', base: './lab' }),
  schema: z.object({
    title: z.string(),
    project: z.string(),
    page: z.string(),
    order: z.number(),
    date: z.coerce.date(),
    summary: z.string(),
    demo: z.string().optional(),
    files: z.array(z.string()).default([]),
    options: z.array(
      z.object({
        name: z.string(),
        status: z.enum(['chosen', 'rejected', 'review']),
        note: z.string(),
        credit: z.string().optional(),
      }),
    ),
  }),
});

export const collections = { projects, 'in-progress': inProgress, lab };

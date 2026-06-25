import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/data/blog-posts" }),
	schema: z.object({
		title: z.string(),
		slug: z.string(),
		publishDate: z.union([z.string(), z.date()]),
		description: z.string(),
		// Optional override for the social preview image. A site-relative path
		// (e.g. "assets/my-card.png") or absolute URL. When omitted, the
		// auto-generated /og/<slug>.png card is used.
		image: z.string().optional(),
	}),
});

export const collections = { posts };
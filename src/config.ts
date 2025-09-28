// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "Justin Barias";
export const SITE_DESCRIPTION =
  "Welcome to my personal website and blog! I write about software engineering, AI, distributed systems, and all other things tech.";
export const LINKEDIN_HANDLE = "justin-barias-89ba6521";
export const MY_NAME = "Justin Barias";

// setup in astro.config.mjs
const BASE_URL = new URL(import.meta.env.SITE);
export const SITE_URL = BASE_URL.origin;
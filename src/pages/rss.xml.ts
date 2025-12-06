import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';
import type { APIContext } from 'astro';

const parser = new MarkdownIt();

function fixRelativeUrls(html: string, siteUrl: string): string {
  return html
    .replace(/src="\//g, `src="${siteUrl}/`)
    .replace(/href="\//g, `href="${siteUrl}/`);
}

export async function GET(context: APIContext) {
  const posts = await getCollection('posts');

  const sortedPosts = posts.sort(
    (a, b) => new Date(b.data.publishDate).getTime() - new Date(a.data.publishDate).getTime()
  );

  return rss({
    title: 'Justin Barias Blog',
    description: 'Thoughts on AI, engineering, and technology',
    site: context.site!,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: new Date(post.data.publishDate),
      link: `/blog/${post.data.slug}/`,
      content: fixRelativeUrls(
        sanitizeHtml(parser.render(post.body ?? ''), {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        }),
        String(context.site)
      ),
    })),
  });
}

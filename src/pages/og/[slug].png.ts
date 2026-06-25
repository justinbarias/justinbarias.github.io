// Per-post social card, generated at build time -> /og/<slug>.png
import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import readingTime from 'reading-time'
import { renderCard } from '../../og/card.js'

export async function getStaticPaths() {
  const posts = await getCollection('posts')
  return posts.map((post) => ({ params: { slug: post.data.slug }, props: { post } }))
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: Awaited<ReturnType<typeof getCollection>>[number] }
  const meta = `${post.data.publishDate} · ${readingTime(post.body ?? '').text}`
  const png = await renderCard({ title: post.data.title, meta })
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

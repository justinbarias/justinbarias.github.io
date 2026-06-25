// Site-wide default social card -> /og/default.png
// Used for the homepage, about, blog index, and any post without its own image.
import type { APIRoute } from 'astro'
import { renderCard } from '../../og/card.js'

export const GET: APIRoute = async () => {
  const png = await renderCard({
    title: 'Justin Barias',
    eyebrow: 'justinbarias.github.io',
    meta: 'Software · AI · Distributed Systems',
  })
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

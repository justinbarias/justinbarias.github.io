// Build-time social-card renderer.
// {title, eyebrow, meta} -> satori (HTML/CSS -> SVG, text baked to paths)
// -> sharp (SVG -> PNG). 1200x630, themed to the "quiet" editorial skin.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import satori from 'satori'
import sharp from 'sharp'

// Resolve from the project root: the build bundles this module into
// dist/chunks, so import.meta.url no longer points next to the fonts.
const font = (file) => readFileSync(join(process.cwd(), 'src/og/fonts', file))

const FONTS = [
  { name: 'Newsreader', data: font('newsreader-400.woff'), weight: 400, style: 'normal' },
  { name: 'Newsreader', data: font('newsreader-600.woff'), weight: 600, style: 'normal' },
  { name: 'JetBrains Mono', data: font('jetbrains-mono-500.woff'), weight: 500, style: 'normal' },
  { name: 'JetBrains Mono', data: font('jetbrains-mono-700.woff'), weight: 700, style: 'normal' },
]

// Quiet-skin tokens (src/styles/global.css :root)
const C = {
  bg: '#f7f6f2',
  fg: '#191a1c',
  muted: '#86847e',
  accent: '#356a72', // brand teal
  clay: '#a8462f', // warm clay accent
  rule: '#e4e2db',
}

// Minimal hyperscript so we don't pull in a JSX toolchain.
const h = (type, style, children) => ({
  type,
  props: { style, children },
})

// Longer titles step down so they stay on a few lines inside the frame.
function titleSize(title) {
  const n = title.length
  if (n > 72) return 52
  if (n > 48) return 60
  return 70
}

export async function renderCard({ title, eyebrow = 'justinbarias.github.io', meta = '' }) {
  const tree = h(
    'div',
    {
      width: 1200,
      height: 630,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: C.bg,
      padding: '72px 80px',
      // clay spine down the left edge for a branded pop
      borderLeft: `14px solid ${C.clay}`,
      fontFamily: 'Newsreader',
    },
    [
      // Kicker
      h(
        'div',
        {
          display: 'flex',
          fontFamily: 'JetBrains Mono',
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: C.accent,
        },
        eyebrow,
      ),
      // Title
      h(
        'div',
        {
          display: 'flex',
          fontFamily: 'Newsreader',
          fontWeight: 600,
          fontSize: titleSize(title),
          lineHeight: 1.1,
          color: C.fg,
          maxHeight: 330,
          overflow: 'hidden',
        },
        title,
      ),
      // Footer: name (left) + meta (right), divided by a hairline
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
        },
        [
          h('div', { display: 'flex', height: 1, backgroundColor: C.rule, marginBottom: 24 }, []),
          h(
            'div',
            {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            },
            [
              h(
                'div',
                { display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 600, color: C.fg },
                [
                  h('div', { display: 'flex', width: 16, height: 16, backgroundColor: C.clay, marginRight: 16 }, []),
                  h('div', { display: 'flex' }, 'Justin Barias'),
                ],
              ),
              h(
                'div',
                { display: 'flex', fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 22, color: C.muted },
                meta,
              ),
            ],
          ),
        ],
      ),
    ],
  )

  const svg = await satori(tree, { width: 1200, height: 630, fonts: FONTS })
  return sharp(Buffer.from(svg)).png().toBuffer()
}

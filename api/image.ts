import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_KEY = process.env.GOOGLE_CSE_API_KEY
const CX = process.env.GOOGLE_CSE_CX

const getQuery = (q: string | string[] | undefined) => {
  if (typeof q === 'string') return q.trim()
  if (Array.isArray(q)) return String(q[0] || '').trim()
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const query = getQuery(req.query.q)
  if (!query) {
    res.status(400).json({ error: 'Missing query' })
    return
  }

  if (!API_KEY || !CX) {
    res.status(500).json({ error: 'Missing Google CSE configuration' })
    return
  }

  const params = new URLSearchParams({
    key: API_KEY,
    cx: CX,
    q: query,
    searchType: 'image',
    num: '1',
    safe: 'active',
  })

  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`

  try {
    const response = await fetch(url)
    const body = await response.text()
    if (!response.ok) {
      res.status(response.status).json({ error: body.slice(0, 500) })
      return
    }

    let data: any
    try {
      data = JSON.parse(body)
    } catch {
      res.status(502).json({ error: 'Invalid response from Google' })
      return
    }

    const item = data?.items?.[0]
    const link = typeof item?.link === 'string' ? item.link : ''
    const thumbnail = typeof item?.image?.thumbnailLink === 'string' ? item.image.thumbnailLink : ''

    if (!link && !thumbnail) {
      res.status(404).json({ error: 'No image results' })
      return
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json({ url: thumbnail || link, thumbnail, link })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch image' })
  }
}

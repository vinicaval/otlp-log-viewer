import { NextResponse } from 'next/server'

const UPSTREAM_URL = 'https://take-home-assignment-otlp-logs-api.vercel.app/api/v2/logs'

export async function GET() {
  try {
    // The upstream endpoint returns fresh random mock data on every call, and
    // the UI's "Refresh" button relies on that — don't let Next.js's data
    // cache serve a stale response and make Refresh look like a no-op.
    const res = await fetch(UPSTREAM_URL, {
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${res.status} ${res.statusText}` },
        { status: res.status }
      )
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

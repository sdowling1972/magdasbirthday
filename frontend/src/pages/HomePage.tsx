import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { PartyInfo } from '../types'

function formatDate(iso: string) {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T12:00:00'))
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const MAPS_ADDRESS = '38 Bowcott Cres, London, Ontario, Canada'
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAPS_ADDRESS)}`

export function HomePage() {
  const [party, setParty] = useState<PartyInfo | null>(null)

  useEffect(() => {
    api.getParty().then(setParty).catch(() => {
      setParty({
        name: "Magda's Big Birthday",
        date: '2026-08-15',
        location: '38 Bowcott Cres., London',
        description: 'Join us to celebrate Magda!',
      })
    })
  }, [])

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">You&apos;re invited</p>
          <h1>{party?.name ?? "Magda's Big Birthday"}</h1>
          <p>
            {party?.description}
            {party ? ` · ${formatDate(party.date)}` : ''}
          </p>
          {party && (
            <>
              <p className="hero-address">
                <a
                  className="hero-map-link"
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {party.location}
                </a>
              </p>
              <p className="muted" style={{ marginTop: '-0.75rem', marginBottom: '1rem', color: 'rgba(255, 253, 249, 0.75)' }}>
                (rain date August 22)
              </p>
              <div className="hero-party-notes">
                <p>Please swing by any time between 2–7pm — no strict schedule.</p>
                <p>Party food + refreshments will be taken care of</p>
                <p>This is not a surprise… Magda knows and she&apos;s hyped!</p>
              </div>
            </>
          )}
          <div className="hero-actions">
            <Link to="/album" className="btn btn-blush">
              Browse the album
            </Link>
          </div>
        </div>
        <div className="hero-portrait">
          <img src="/magdaphoto.jpg" alt="Magda" />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>How it works</h2>
          <p>
            Click the RSVP button at the top of the page, fill in your details, and upload any fun
            photos you might have with Magda! You can also browse the photo album from others by
            clicking the Album button at the top.
          </p>
        </div>
      </section>
    </>
  )
}

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
            {party ? ` · ${formatDate(party.date)} · ${party.location}` : ''}
          </p>
          {party && (
            <p className="muted" style={{ marginTop: '-0.75rem', marginBottom: '1.75rem', color: 'rgba(255, 253, 249, 0.75)' }}>
              (rain date August 22)
            </p>
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
            Guests receive a personal RSVP link for their household. They can confirm attendance
            and upload favorite photos of Magda for the party slideshow.
          </p>
        </div>
      </section>
    </>
  )
}

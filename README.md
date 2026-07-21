# Magda's Big Birthday Party Planner

React + FastAPI + PostgreSQL app for organizing Magda's birthday: invite management, per-household RSVP links, photo collection, and an approved album.

## Stack

- **Frontend:** React (Vite + TypeScript)
- **Backend:** FastAPI + SQLAlchemy
- **Database:** PostgreSQL

## Quick start

### 1. Database

```bash
# Option A: Docker
docker compose up -d
# then set DATABASE_URL=postgresql+psycopg2://magda:magda@localhost:5432/magdasbirthday

# Option B: local Postgres (already used if you have Homebrew Postgres)
createdb magdasbirthday
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # adjust DATABASE_URL / party details / ADMIN_PASSWORD
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

| Surface | URL |
|---|---|
| Guest login | http://localhost:5173/login |
| Autologin | http://localhost:5173/autologin?key=AAAABBBBCCCCDDDD |
| Home (after auth) | http://localhost:5173 |
| Admin | http://localhost:5173/admin |
| Public album | http://localhost:5173/album (requires invite code) |
| Guest RSVP | http://localhost:5173/rsvp |

Guests must enter their 16-letter invite code (shown as `AAAA-BBBB-CCCC-DDDD`) before browsing. Admin invite links use `/autologin?key=...`.

Default admin password: `magda-admin` (change in `backend/.env`).

## Features

- **Admin dashboard** — invite / RSVP / photo counts
- **Invite management** — households with multiple guests on one invite; unique RSVP link per invite
- **Guest RSVP page** — per-person attending/declined, dietary notes, message
- **Photo uploads** — guests upload Magda photos from their RSVP page
- **Moderation** — approve/reject photos for the public album (and future slideshow)

## Party details

Edit `PARTY_NAME`, `PARTY_DATE`, `PARTY_LOCATION`, and `PARTY_DESCRIPTION` in `backend/.env`.

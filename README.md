# Magda's Big Birthday Party Planner

React + FastAPI + PostgreSQL app for organizing Magda's birthday: invite management, per-household RSVP links, photo collection, and an approved album.

## Stack

- **Frontend:** React (Vite + TypeScript)
- **Backend:** FastAPI + SQLAlchemy
- **Database:** PostgreSQL
- **Production:** AWS (S3 + CloudFront + App Runner + RDS) with Cloudflare DNS

## Local development

### 1. Database

```bash
# Option A: Docker
docker compose up -d
# then set DATABASE_URL=postgresql+psycopg2://magda:magda@localhost:5432/magdasbirthday

# Option B: local Postgres
createdb magdasbirthday
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
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

Default local admin password: `magda-admin` (change in `backend/.env`).

## Production deploy (AWS)

### One-time bootstrap

Requires AWS credentials with admin-ish rights, Docker, Terraform, and Node.

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
export ADMIN_PASSWORD='choose-a-strong-password'

chmod +x scripts/bootstrap-aws.sh
./scripts/bootstrap-aws.sh
```

Then in Cloudflare DNS for `magdas-big-bday.com` (proxied):

- `CNAME` `@` → CloudFront domain printed by the script  
- `CNAME` `www` → same CloudFront domain  
- SSL/TLS mode: **Full**

Add GitHub Actions secrets from the script output:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Ongoing updates

```bash
git push origin master
```

That triggers `.github/workflows/deploy.yml`: builds the API image, deploys App Runner, builds the frontend, syncs S3, and invalidates CloudFront.

You can also run **Actions → Deploy → Run workflow** in GitHub.

## Party details

Edit `PARTY_NAME`, `PARTY_DATE`, `PARTY_LOCATION`, and `PARTY_DESCRIPTION` in `backend/.env` locally, or App Runner env vars / Terraform in production.

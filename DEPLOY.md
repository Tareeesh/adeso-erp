# Deployment Guide — ADESO ERP

## Railway Deployment

### Step 1: Create Railway Project
1. Go to railway.app and create a new project
2. Add a PostgreSQL database plugin
3. Copy the DATABASE_URL from the plugin

### Step 2: Deploy Backend
1. Create a new service → Connect GitHub repo
2. Set root directory to `/backend`
3. Add all environment variables (see `.env.example`)
4. Railway will auto-deploy on push

### Step 3: Deploy Frontend
1. Create another service → Connect same repo
2. Set root directory to `/frontend`
3. Add environment variable: `VITE_API_URL` = your backend Railway URL
4. Build command: `npm run build`
5. Start command: `npx serve dist`

### Step 4: Run Migrations
In the Railway backend service terminal:
```
node migrations/run.js
```

### Step 5: First Login
- URL: your Railway frontend URL
- Email: thussein@adesoafrica.org
- Password: Admin@1234
- **CHANGE PASSWORD IMMEDIATELY after first login**

---

## Required Environment Variables (Backend)

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string (from Railway plugin) |
| JWT_SECRET | Random 64-char string |
| JWT_REFRESH_SECRET | Different random 64-char string |
| R2_ACCOUNT_ID | Cloudflare account ID |
| R2_ACCESS_KEY_ID | Cloudflare R2 access key |
| R2_SECRET_ACCESS_KEY | Cloudflare R2 secret key |
| R2_BUCKET_NAME | Your R2 bucket name |
| R2_PUBLIC_URL | R2 bucket endpoint URL |
| SMTP_HOST | Your SMTP host |
| SMTP_PORT | 587 (or 465 for SSL) |
| SMTP_USER | Your email username |
| SMTP_PASS | Your email password |
| EMAIL_FROM_NAME | ADESO ERP System |
| EMAIL_FROM_ADDRESS | erp@adesoafrica.org |
| APP_URL | Your frontend URL |

## Cloudflare R2 Setup
1. Go to Cloudflare Dashboard → R2
2. Create bucket named `erp-documents`
3. Create API token with R2 read/write permissions
4. Copy Account ID, Access Key, Secret Key

## Local Development
```bash
# Start PostgreSQL
docker-compose up postgres -d

# Backend
cd backend
cp .env.example .env
# Fill in .env values
npm install
node migrations/run.js
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

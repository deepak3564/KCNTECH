# KCN Customer Management SaaS

This is an end-to-end starter application for a cable TV operator business. It has:

- `frontend/`: mobile web app built with React
- `backend/`: API server built with Node, Express, Prisma, and PostgreSQL
- `docker-compose.yml`: optional local PostgreSQL database for development

## What The App Does

- Super Admin can create organisations and initial organisation admins.
- Each organisation has its own admin, employees, customers, plans, set-top boxes, payments, and reports.
- Admin can add employees, customers, cable plans, internet plans, set-top boxes, maintenance charges, and handovers.
- Employee can see assigned customers, filter pending/paid customers, collect payment, choose payment mode, and attach UPI proof.
- Monthly bills can be generated for every active customer. Bills begin as pending and become partial or paid as money is collected.
- Employee ledger shows how much an employee collected, how much was handed over to admin, and what balance is still due.

## Folder Structure

```text
kcn-customer-management-saas/
  backend/
    prisma/
      schema.prisma
      seed.ts
    src/
      lib/
      middleware/
      routes/
      server.ts
  frontend/
    src/
      api/
      styles/
      main.tsx
  docker-compose.yml
  package.json
```

## Local Setup On Mac

1. Install Node.js LTS from [nodejs.org](https://nodejs.org/).
2. Install Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/) if you want a local database.
3. Open this project folder in Terminal.
4. Install all dependencies:

```bash
npm run install:all
```

5. Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

6. For local Docker database, set `backend/.env` like this:

```bash
DATABASE_URL="postgresql://kcn:kcn_password@127.0.0.1:55432/kcn_customer_management"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=4000
CORS_ORIGIN="http://localhost:5173"
```

7. Start PostgreSQL:

```bash
docker compose up -d
```

8. Create database tables and sample data:

```bash
npm run db:migrate --prefix backend
npm run db:seed --prefix backend
```

9. Start backend:

```bash
npm run dev:backend
```

10. In a second Terminal tab, start frontend:

```bash
npm run dev:frontend
```

11. Open:

```text
http://localhost:5173
```

## Demo Logins

```text
Super Admin
Email: superadmin@kcn.local
Password: SuperAdmin@123

Organisation Admin
Email: admin@kcn.local
Password: Admin@123

Employee
Email: employee@kcn.local
Password: Employee@123
```

## Production Deployment

Recommended beginner-friendly deployment:

- Frontend: Vercel
- Backend: Render Web Service
- Database: Render PostgreSQL, Neon, or Supabase PostgreSQL

### Backend On Render

1. Push this project to GitHub.
2. Create a PostgreSQL database in Render, Neon, or Supabase.
3. Create a Render Web Service pointing to the GitHub repo.
4. Set Root Directory to `backend`.
5. Set Build Command:

```bash
npm install --production=false && npm run build
```

6. Set Pre-Deploy Command:

```bash
npx prisma migrate deploy
```

7. Set Start Command:

```bash
npm run start
```

8. Add environment variables:

```text
DATABASE_URL=<your production postgres url>
JWT_SECRET=<long random secret>
CORS_ORIGIN=<your Vercel frontend URL>
```

Render’s current Node/Express guide confirms using a Web Service with build/start commands, and Render’s Prisma guide recommends `prisma migrate deploy` before starting the app.

### Frontend On Vercel

1. Import the same GitHub repo into Vercel.
2. Set Root Directory to `frontend`.
3. Add environment variable:

```text
VITE_API_URL=https://your-backend.onrender.com/api
```

4. Build command:

```bash
npm run build
```

5. Output directory:

```text
dist
```

Vercel’s Vite guide confirms Vite environment variables should use the `VITE_` prefix.

## Important Production Improvements Before Selling

This starter is intentionally complete enough to run and extend, but before charging other cable operators you should add:

- Password reset by email or OTP.
- A proper profile screen for password change.
- Audit logs for edits, deleted payments, changed plans, and employee handovers.
- Cloud file storage for UPI proof images instead of local server uploads.
- Automated first-day monthly bill generation using a scheduler.
- Role-based permission polish, especially for editing payments.
- Backups, monitoring, and error tracking.
- Subscription billing for SaaS customers.

## Useful Sources Checked

- [Render Node Express deployment docs](https://render.com/docs/deploy-node-express-app)
- [Render environment variable docs](https://render.com/docs/configure-environment-variables)
- [Prisma Render deployment docs](https://www.prisma.io/docs/orm/prisma-client/deployment/traditional/deploy-to-render)
- [Prisma migrate deploy docs](https://www.prisma.io/docs/cli/migrate/deploy)
- [Vercel Vite deployment docs](https://vercel.com/docs/frameworks/frontend/vite)

# Backend setup checklist

- Run `sql/schema.sql` once against your PostgreSQL database.
- Set environment variables from `.env.example`.
- Never commit `.env` or expose `ADMIN_API_KEY`.
- Deploy with Node 18+, build command `npm install`, start command `npm start`.
- Test `GET /health`.
- Candidate form submits to `POST /api/applications`.
- Admin routes require `x-admin-api-key` header.
- The admin routes are API-only; there is no browser admin panel in this starter.

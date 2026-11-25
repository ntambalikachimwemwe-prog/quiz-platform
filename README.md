# GlobalWork

GlobalWork is a worldwide job and microtask discovery platform. Workers register free, browse external opportunities, save listings and track applications. Employers and task platforms control selection, task availability and payment.

## Run locally

```bash
npm install
npm start
```

Set `JWT_SECRET` and `ADMIN_EMAIL` / `ADMIN_PASSWORD` before production. Persistent data is stored in `data/globalwork.json`; mount persistent storage at `/var/data` and set `DATA_FILE=/var/data/globalwork.json` on Render.

## Important

GlobalWork aggregates third-party listings; it is not the employer or payment processor. External providers decide eligibility, availability, acceptance and payout. Listings are refreshed from public feeds and are not guaranteed to stay above 100. Never pay to apply through GlobalWork. Verify external providers before sharing personal information.
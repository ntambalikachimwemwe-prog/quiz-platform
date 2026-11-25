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

## Funding and investor marketplace
GlobalWork also includes funding profiles for investors and donors, project listings, private conversations, daily availability confirmation, and optional email notifications. A profile is counted as "available today" only when its owner actively confirms that status on the current UTC date. The 100-active-funder figure is a platform target, not a fabricated listing guarantee.

Funding conversations use the GlobalWork inbox. To send email alerts to users' registered email addresses (including Gmail), configure these Render environment variables: `SMTP_HOST`, `SMTP_PORT` (587 or 465), `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_FROM`. Without SMTP settings, messages still work in the website inbox, but email alerts are not sent.

Funding profiles and projects are user-submitted and unverified by default. Admin review endpoints are available under `/api/admin/funding` and `/api/admin/funding/verify`. Never imply that a listed funder has verified capital or that a project is guaranteed funding. GlobalWork does not custody, transfer, or invest funds.

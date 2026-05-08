# One!

One! is a mobile-first daily score tracker for spotting Dodge Durangos and Tesla Cybertrucks.

## Scoring

- Dodge Durango: `+1`
- Tesla Cybertruck: `+0.5`
- Wrong vehicle: `-1`

Scores are stored locally in the browser by calendar day. A new day starts at zero automatically, while previous days stay visible in the month calendar.

## Run locally

Use any static file server from this folder:

```sh
npx serve .
```

For Vercel, import this folder as a project. No build command is required.

## Image Credits

- Dodge Durango photo: Bull-Doser, public domain, Wikimedia Commons.
- Tesla Cybertruck photo: John Bauld, CC BY 2.0, Wikimedia Commons.

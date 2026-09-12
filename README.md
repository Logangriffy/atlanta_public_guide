# Atlanta + North Georgia Local Guide

Responsive public directory backed by a Google Sheets data feed.

## Architecture

- Private/admin source workbook: `Atlanta + North Georgia Food & Fun Guide`
- Hidden export tabs in the source workbook: `Website Export Places` and `Website Export Links`
- Public-safe mirror spreadsheet: `Atlanta Public Guide - Website Data Feed`
- Static responsive site in this repository
- Recommended hosting: Cloudflare Pages

## Automatic updates

The website reads the public-safe Google Sheets feed in the browser on each visit. Once the mirror spreadsheet is connected and readable, edits to the master workbook flow through the hidden export tabs and into the public feed automatically. No Cloudflare redeploy is needed just for data changes.

## Cloudflare Pages

Deploy this repository as a static site with no framework/build command required.

- Production branch: `main`
- Build command: leave blank
- Build output directory: `/`

## One-time Google Sheets setup

The public mirror spreadsheet needs one-time `IMPORTRANGE` authorization from the source workbook and public read access so the browser can retrieve the CSV feed.

Public feed spreadsheet ID: `1vnIouZJf1iCYqDfFF6A4gDkfEk-hsSVEhLtPXcFDcB0`

The site currently reads:

- `Places`
- `CommunityLinks`

Do not expose the private source workbook directly.

# Outreach Lead Search / Filter — Design Spec

**Date:** 2026-06-25
**Status:** Approved, building
**Context:** Phil is adding more scraped leads to the Outreach Leads tab and wants to search/filter
them by business size, industry, city, and distance from a ZIP code.

## Decisions (from brainstorming)

- **Distance:** ZIP-centroid via the `zipcodes` npm package (server-only), haversine miles. No
  per-address geocoding. Leads with no ZIP are EXCLUDED from distance filters.
- **Industry:** two levels — `segment` (broad) + `category` (detailed). Filter by either.
- **Size:** employee-count buckets `<50, 50–99, 100–199, 200–499, 500+`, derived from a parsed
  `employee_min`/`employee_max` midpoint.
- **New leads:** CSV upload; importer extended to map segment/category/employees.

## Data model (additive migrations, nullable)

`ALTER TABLE leads ADD COLUMN`: `segment TEXT`, `category TEXT`, `employee_min INTEGER`,
`employee_max INTEGER`. No coordinate columns — distance computed live from `postal_code`.

## New modules

- `src/lib/outreach/employee-size.ts` — `parseEmployees(s)` → {min,max}; `BUCKETS` + `bucketOf`.
- `src/lib/outreach/geo.ts` — `milesBetweenZips(a,b)` wrapping `zipcodes.distance`; null if unknown.

`zipcodes` added to deps + `serverExternalPackages` (server-only, like `pdf-parse`).

## Queries / API / UI

- `listLeadsByLane(db, lane, filters)` — SQL for segment/category/city/stage; JS for size bucket +
  distance. `laneFacets(db, lane)` → distinct segments/categories/cities for dropdowns.
- `importLeads`/`mapCsvRow` — aliases for segment/category/employees (parse band → min/max).
- `GET /api/outreach/leads` gains `segment, category, city, sizes, nearZip, withinMiles`; returns
  `{lane, leads, counts, facets}`.
- `outreach-leads.tsx` — filter bar: Segment ▾ · Category ▾ · City ▾ · size chips · "within [mi]
  of [ZIP]" + clear; sourced from facets; refetch on change.

## Backfill

Backfill segment/category/employee_min/max for the existing 103 from the original sheet, via a
one-off prod DB script after the migration deploys.

## Out of scope (v1)

Free-text keyword search, saved filters, map view.

## Success criteria

Filter by segment/category/city/size/distance (alone + combined); existing 103 filterable;
new CSV uploads populate fields; `zipcodes` resolves TN ZIPs (37027↔37203 ≈ 8–10 mi);
eslint clean, build compiles, tests pass.

# Development Audit Exceptions

## Drizzle Kit esbuild advisory

- Advisory: `GHSA-67mh-4wv8-2f99`
- Current chain: `drizzle-kit@0.31.10` -> `@esbuild-kit/esm-loader` -> `@esbuild-kit/core-utils` -> `esbuild@0.18.20`
- Scope: development-only database migration generation CLI under `apps/api`.
- Production exposure: excluded from production dependency audit with `npm run audit:prod`.

`npm audit fix --force` proposes a breaking Drizzle Kit change and beta Drizzle Kit versions are incompatible with the current Drizzle ORM RQB usage. Keep `drizzle-kit@0.31.10` until a stable compatible release removes `@esbuild-kit/*` or the project migrates the database generation path.

Controls:

- Do not expose Drizzle Kit or its dev server behavior on a network interface.
- Run migration generation locally or in isolated CI build jobs only.
- Keep production audit gating on `npm run audit:prod`.

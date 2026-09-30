# Static website publication boundary

Netlify uses the repository-root netlify.toml to run
`node scripts/build-site.mjs` and publish only `dist/`.
The build copies an explicit allowlist of current public pages, assets, metadata,
security.txt and _headers. Supabase functions, migrations, tests, rollback sources,
repository documentation and build scripts are never copied.

Add new public pages/assets to publicFiles in scripts/build-site.mjs. New files
are excluded by default. Source files and their parent directories must be real
files/directories, preventing a symlink from including unrelated private content.
Run `node --test scripts/build-site.test.mjs` before changing the publish list.
The test validates required entry points, unchanged assets/security headers, local
HTML links, unexpected-file exclusion and symlink rejection.

The website's URL layout, clean account URL and existing _headers stay unchanged.
No Supabase deployment is performed by this build. Backend changes must continue
to be deployed through the existing Supabase workflow.

Confirm the Netlify build/deploy reports publish=dist and the expected commit
before integrating backend PRs. Review future changes to the publish allowlist as
security-sensitive. A rollback to root publication could expose repository files;
retain this boundary when reverting unrelated frontend work.

Reference: https://docs.netlify.com/build/configure-builds/file-based-configuration/

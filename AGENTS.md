<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Related apps in this repo

This repo hosts more than one app across different branches (EFK members,
TACview, EFKtac), plus a related app in a separate repo (EFKtime). Before
touching anything outside this app, or investigating shared infra/capacity
questions, read `docs/INFRASTRUCTURE.md` first — it maps out each app's repo,
branch, hosting, and database/storage so you don't cross-contaminate branches
or misjudge what shares capacity with what.

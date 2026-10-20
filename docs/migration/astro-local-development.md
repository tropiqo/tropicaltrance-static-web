# Slice 2 — local Astro foundation

Use `nvm use` in this repository (Node **24.21.0**, npm **11.19.0**). Alternatively prepend `/Users/josue.ruiz/.nvm/versions/node/v24.21.0/bin` to PATH for the current shell. The sole direct dependency is **Astro 7.3.8**, exact-pinned; lockfile v3 pins its complete dependency graph. No inherited Codex/Uglify dependency is retained.

After approved registry access, `npm ci --ignore-scripts --no-audit --no-fund` installs the lockfile. `.npmrc` specifies the official registry, script suppression and strict engines. Optional fsevents declares an install script; it is never executed. Prebuilt Darwin ARM64/Linux x64 native packages are in the lockfile. macOS ARM64 build/tests have passed; actual Linux CI execution is still unverified. npm audit reported zero known vulnerabilities at this check; this is not permanent security assurance.

## Commands

- `npm run dev`: open <http://127.0.0.1:4321> (localhost:4321 normally also resolves locally).
- `npm run build`: validate static source, build five pages, check output/routes/navigation.
- `npm run preview`: serve generated dist on loopback, normally port 4321. To run beside dev: `npm run preview -- --port 4322`.
- `npm test`: bounded source, output, route and forbidden-content tests; run build first.
- `python3 -B .github/ci/check_policy.py --self-test`: validation-only CI policy and negative cases.

Astro 7 manages background dev/preview processes. Stop with `npm run dev -- stop` and `npm run preview -- stop` when finished. Servers are loopback-only; no public exposure or hosting is configured. In this execution dev is available at 127.0.0.1:4321; static preview was tested on 4322. HTTP tests cover four primary routes, the technical 404 and a missing Flavor URL. Dev serves /404.html with status 404; static preview serves that existing file with status 200; missing Flavor URLs return 404 in both.

## Scope and trust

Routes are /, /flavors/, /about/, /contact/, plus 404.html. Shared semantic shell supplies lang/title/description, working skip link, native nav/main/footer, focus, basic responsive system typography and static reduced-motion behavior. All pages visibly say development-only and carry noindex/nofollow. This is neutral structural copy, not approved public marketing. Contact has no address/form; Flavors is empty. The reusable [slug].astro scaffold returns an empty static route list, with no product pages, public mapper or synthetic fixtures.

Static output, directory routes and an isolated `public-astro` input prevent automatic copying of legacy Jekyll assets/demos/stale _site. No public-astro files exist. Tests reject additional routes, copied files/media/scripts, old claims, SSR/adapter/integration/private/remote dependencies. No client JavaScript is required by built navigation. These narrow checks do not fulfill all future Slice 5 audits or manual accessibility review.

All Jekyll source/assets remain untouched, except the earlier authorized workflow removal; package.json/lockfile and generated node_modules now belong to Astro. The old generated dependency tree was replaced by explicitly approved npm ci. Ignored .astro/dist are generated local caches/output, not release assets. No Studio/private artwork input is required. A standalone temporary build from website-owned source/dependencies succeeded without Studio/artwork/credentials and matched output hashes; no permanent reproducibility system was introduced.

CI remains read-only, pinned checkout/setup-node, locked script-disabled install and static build/tests only. No secrets/environment/deploy/artifact/event chaining. The original 17 negative policy cases remain. Remote deployment controls and actual GitHub Actions execution remain unverified; do not open a PR.

## Maintenance responsibility

The future **Website Technical Maintainer** role owns reviewed Node/npm/Astro/security/action pins, lockfile and lifecycle review, macOS/Linux checks and intentional upgrades. Brand owner remains accountable for appointing that role and approving scope; no named technical assignee is invented. Exact toolchain pins are resolved and locally tested, but task 2.2 remains partial until that assignment and outstanding environment verification are resolved. This role statement grants no release authority.

No full Tropical Editorial Hybrid design, licensed fonts/palette, real artwork/products, approved contact/public narrative, mapper/fixtures, Jekyll retirement, Cloudflare or release machinery. Only Slice 2 was implemented. Later slices require separate authorization.

Compatibility evidence: [Astro prerequisites](https://docs.astro.build/en/install-and-setup/), [Astro 7.3.8 registry metadata](https://registry.npmjs.org/astro/7.3.8), [Node LTS releases](https://nodejs.org/en/about/previous-releases). Registry engines are Node >=22.12 and npm >=9.6.5. Versions used here satisfy them; installed build evidence confirms local compatibility.

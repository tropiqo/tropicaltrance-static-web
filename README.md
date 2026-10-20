# Tropical Trance website

The current website is an independent Astro static project using the Tropical Editorial Hybrid design: Home, Flavors, About, Contact, a technical 404 and reusable Flavor Detail pages selected by validated local inputs.

This is a development foundation. A passing build or local preview does not authorize publication. The normal Flavor release is empty. The owner-approved, exact Trancy WebP appears on normal Home/About as one pinned static asset; synthetic Flavor media remains confined to local review.

See the [authoritative internal foundation handoff](docs/migration/astro-foundation-handoff.md) for current scope, exact inventories, recovery, responsibilities and deferred production work. This README remains the quick start; dated slice documents preserve earlier evidence.

## Prerequisites

- Node **24.21.0** and npm **11.19.0**, matching the engines and lockfile.
- Python **3.9 or newer** for standard-library HTML audits and CI policy checks.
- Existing repository inputs/dependencies; normal builds require no Studio connection or credentials.

If you use nvm, run `nvm use` here. Confirm `node --version` and `npm --version`. For a fresh checkout, install locked dependencies without lifecycle scripts:

```sh
npm ci --ignore-scripts --no-audit --no-fund
```

Astro **7.3.8** is locked. Use the Astro commands below; the obsolete Ruby/Rake/Jekyll build tooling has been retired.

## Local development

```sh
npm run dev
```

Open <http://127.0.0.1:4321/>. Development uses normal validated inputs and the approved static Trancy image, without review paths or synthetic Flavor fixtures. Navigation works without client JavaScript.

## Normal build and preview

```sh
npm run build
npm run preview -- --port 4321
```

Open <http://127.0.0.1:4321/>, `/about/`, `/flavors/` or `/contact/`. Output is `dist/`: currently five HTML pages, one stylesheet and one exact Trancy WebP, with no fixture detail routes.

Flavor content uses the unchanged closed v1 release contracts. The approved mascot is independently pinned at `public-astro/assets/trancy-web-r1.webp`; it requires no brand JSON, v2 eligibility or Studio lookup. `public-astro/` has complete inventory enforcement: an unlisted asset fails validation. Legacy `assets/`, `_site/`, theme/demo files and private files are not normal public inputs.

## Isolated local review

**Never publish synthetic Flavor fixtures, review-only Trancy media or `.review-build/`.** This is an internal visual test, not a public release.

```sh
npm run review:build
python3 -B -m http.server 4333 --bind 127.0.0.1 --directory .review-build
```

Local review URLs:

- Home: <http://127.0.0.1:4333/>
- About: <http://127.0.0.1:4333/about/>
- Flavors: <http://127.0.0.1:4333/flavors/>
- Synthetic details: <http://127.0.0.1:4333/flavors/fixture-coral/> and <http://127.0.0.1:4333/flavors/fixture-orchid/>
- Contact: <http://127.0.0.1:4333/contact/>
- Technical 404: <http://127.0.0.1:4333/404.html>

Stop the server with Ctrl-C. Keep it on loopback. Review HTML has a labeled disclosure and `noindex, nofollow`; neither grants public approval.

The fixed harness uses synthetic `tests/fixtures/public-inputs/` plus one separately pinned real Trancy delivery in ignored `review-assets/`. It builds into `.review-build/`, without modifying `dist/` or copying review paths or synthetic assets into normal publicDir. The approved normal WebP has identical bytes at its own fixed path. Every output resource and delivery digest is checked.

The same exact Trancy WebP is reused on Home/About. If its ignored file is absent, the explicit review command prepares it from the tracked, digest-verified `assets/images/TRANCY-01.png` using the pinned transformation. Source/toolchain/output drift fails closed. Keep the original and existing derivative unchanged, including the intentional **TROPICAL TRANCE** cup lettering.

## Validation

```sh
npm run validate
python3 -B .github/ci/check_policy.py --self-test
git diff --check
```

`validate` runs inputs, normal build, review build, tests and both output audits. Tests include independent deterministic builds/isolation and mascot integrity; an existing matching review WebP is reused without regeneration. Review tests require the original master and selected review delivery; normal builds remain independent of them.

| Command | Checks |
| --- | --- |
| `npm run validate:inputs` | Closed inputs, release/media/eligibility joins and source boundaries |
| `npm run build` | Normal inputs/source/build/output |
| `npm run review:build` | Isolated review inventory and exact delivery digests |
| `npm test` | Automated tests; verifies/prepares pinned local review asset first |
| `npm run validate:output` | Existing `dist/` routes/resources/privacy/isolation |
| `npm run validate:review-output` | Existing `.review-build/` resources and exact deliveries |
| `npm run verify:reproducible` | Repeated isolated builds and deliberate drift/extra-output failures |

Build first before standalone output audits or `verify:reproducible`. Structural PASS is distinct from user browser acceptance, remote CI and publication/release authorization. None of these commands deploys.

## Retained legacy material and URL decisions

Obsolete root prototype pages `index.md`, `about.md` and `contact.md` are retired. Astro retains `/`, `/about/` and `/contact/`. The approved legacy Jekyll/theme/Ruby/demo-source/custom-JavaScript implementation has also been retired. Historical demo media, author/comment data, license/history material and copyright notices remain preserved; they are not build inputs. Active migration notes remain in `docs/migration/`; active tests use plural `tests/`.

Future URL-migration decisions: old `#products` is intended to point to `/flavors/`; old `#trancy` to `/about/`; unsupported `#why-choose-us` has no replacement. These are **not implemented redirects or preserved hash anchors**. This batch adds no feed, sitemap or canonical-domain behavior.

## Attribution

This repository retains legacy [Minimal Mistakes](https://github.com/mmistakes/minimal-mistakes) **4.26.2** material by Michael Rose and contributors. The existing [LICENSE](LICENSE), copyright headers and upstream credits/license notices below are preserved. They describe the retained theme and incorporated dependencies, not a new license declaration for brand artwork or a claim that Astro uses those legacy assets.

## Credits

### Creator

**Michael Rose**

- <https://mademistakes.com>
- <https://twitter.com/mmistakes>
- <https://github.com/mmistakes>

### Icons + Demo Images:

- [The Noun Project](https://thenounproject.com) - Garrett Knoll, Arthur Shlain, and [tracy tam](https://thenounproject.com/tracytam)
- [Font Awesome](http://fontawesome.io/)
- [Unsplash](https://unsplash.com/)

### Other:

- [Jekyll](http://jekyllrb.com/)
- [jQuery](http://jquery.com/)
- [Susy](http://susy.oddbird.net/)
- [Breakpoint](http://breakpoint-sass.com/)
- [Magnific Popup](http://dimsemenov.com/plugins/magnific-popup/)
- [FitVids.JS](http://fitvidsjs.com/)
- [GreedyNav.js](https://github.com/lukejacksonn/GreedyNav)
- [Smooth Scroll](https://github.com/cferdinandi/smooth-scroll)
- [Gumshoe](https://github.com/cferdinandi/gumshoe)
- [jQuery throttle / debounce](http://benalman.com/projects/jquery-throttle-debounce-plugin/)
- [Lunr](http://lunrjs.com)
- [Clipboard.js](https://clipboardjs.com)

## License

The MIT License (MIT)

Copyright (c) 2013-2024 Michael Rose and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Minimal Mistakes incorporates icons from [The Noun Project](https://thenounproject.com/) 
creators Garrett Knoll, Arthur Shlain, and tracy tam.
Icons are distributed under Creative Commons Attribution 3.0 United States (CC BY 3.0 US).

Minimal Mistakes incorporates [Font Awesome](http://fontawesome.io/),
Copyright (c) 2017 Dave Gandy.
Font Awesome is distributed under the terms of the [SIL OFL 1.1](http://scripts.sil.org/OFL) 
and [MIT License](http://opensource.org/licenses/MIT).

Minimal Mistakes incorporates photographs from [Unsplash](https://unsplash.com).

Minimal Mistakes incorporates [Susy](http://susy.oddbird.net/),
Copyright (c) 2017, Miriam Eric Suzanne.
Susy is distributed under the terms of the [BSD 3-clause "New" or "Revised" License](https://opensource.org/licenses/BSD-3-Clause).

Minimal Mistakes incorporates [Breakpoint](http://breakpoint-sass.com/).
Breakpoint is distributed under the terms of the [MIT/GPL Licenses](http://opensource.org/licenses/MIT).

Minimal Mistakes incorporates [FitVids.js](https://github.com/davatron5000/FitVids.js/),
Copyright (c) 2013 Dave Rubert and Chris Coyier.
FitVids is distributed under the terms of the [WTFPL License](http://www.wtfpl.net/).

Minimal Mistakes incorporates [Magnific Popup](http://dimsemenov.com/plugins/magnific-popup/),
Copyright (c) 2014-2016 Dmitry Semenov, http://dimsemenov.com.
Magnific Popup is distributed under the terms of the MIT License.

Minimal Mistakes incorporates [Smooth Scroll](http://github.com/cferdinandi/smooth-scroll),
Copyright (c) 2019 Chris Ferdinandi.
Smooth Scroll is distributed under the terms of the [MIT License](http://opensource.org/licenses/MIT).

Minimal Mistakes incorporates [Gumshoejs](http://github.com/cferdinandi/gumshoe),
Copyright (c) 2019 Chris Ferdinandi.
Gumshoejs is distributed under the terms of the [MIT License](http://opensource.org/licenses/MIT).

Minimal Mistakes incorporates [jQuery throttle / debounce](http://benalman.com/projects/jquery-throttle-debounce-plugin/),
Copyright (c) 2010 "Cowboy" Ben Alman.
jQuery throttle / debounce is distributed under the terms of the [MIT License](http://opensource.org/licenses/MIT).

Minimal Mistakes incorporates [GreedyNav.js](https://github.com/lukejacksonn/GreedyNav),
Copyright (c) 2015 Luke Jackson.
GreedyNav.js is distributed under the terms of the [MIT License](http://opensource.org/licenses/MIT).

Minimal Mistakes incorporates [Jekyll Group-By-Array](https://github.com/mushishi78/jekyll-group-by-array),
Copyright (c) 2015 Max White <mushishi78@gmail.com>.
Jekyll Group-By-Array is distributed under the terms of the [MIT License](http://opensource.org/licenses/MIT).

Minimal Mistakes incorporates [@allejo's Pure Liquid Jekyll Table of Contents](https://allejo.io/blog/a-jekyll-toc-in-liquid-only/),
Copyright (c) 2017 Vladimir Jimenez.
Pure Liquid Jekyll Table of Contents is distributed under the terms of the [MIT License](http://opensource.org/licenses/MIT).

Minimal Mistakes incorporates [Lunr](http://lunrjs.com),
Copyright (c) 2018 Oliver Nightingale.
Lunr is distributed under the terms of the [MIT License](http://opensource.org/licenses/MIT).

Minimal Mistakes incorporates [clipboard.js](https://clipboardjs.com/),
Copyright (c) 2021 Zeno Rocha.
Clipboard.js is distributed under the terms of the [MIT License](https://opensource.org/licenses/MIT).

"""Bounded generated-site audit using Python's standard-library HTML parser.

Checks rendered structure/resources, not browser layout, computed accessibility or rights.
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote


def require(condition, message):
    if not condition:
        raise ValueError(message)


class Node:
    def __init__(self, tag, attrs, parent=None):
        require(len(attrs) == len(dict(attrs)), f"Duplicate {tag} attribute")
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def text(self):
        if self.attrs.get("aria-hidden") == "true" or "hidden" in self.attrs:
            return ""
        if self.tag == "img":
            return self.attrs.get("alt", "")
        return " ".join(c.text() if isinstance(c, Node) else c for c in self.children).strip()

    def within(self, ancestor):
        node = self.parent
        while node:
            if node.tag == ancestor:
                return True
            node = node.parent
        return False


class Document(HTMLParser):
    void = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, content):
        super().__init__(convert_charrefs=True)
        self.nodes, self.stack, self.doctype = [], [], False
        self.feed(content)
        self.close()
        require(not self.stack, "Unclosed HTML element")
        self.ids = {}
        for node in self.nodes:
            if "id" in node.attrs:
                value = node.attrs["id"]
                require(value and value not in self.ids, f"Duplicate/empty id: {value}")
                self.ids[value] = node

    def handle_decl(self, decl):
        require(decl.lower() == "doctype html" and not self.doctype, "Unexpected doctype")
        self.doctype = True

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.stack[-1] if self.stack else None)
        self.nodes.append(node)
        if node.parent:
            node.parent.children.append(node)
        if tag not in self.void:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.void:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        require(self.stack and self.stack[-1].tag == tag, f"Mismatched closing tag: {tag}")
        self.stack.pop()

    def handle_data(self, data):
        if self.stack:
            self.stack[-1].children.append(data)

    def find(self, tag):
        return [n for n in self.nodes if n.tag == tag]

    def name(self, node):
        if "aria-labelledby" in node.attrs:
            return " ".join(self.ids[i].text() for i in node.attrs["aria-labelledby"].split())
        return node.attrs.get("aria-label", node.text()).strip()

    def structure(self, page, indexing_authorized=False):
        page_indexable = indexing_authorized and page not in {"404.html", "404/index.html", "es/404/index.html"}
        require(self.doctype, "Missing HTML doctype")
        for tag in ["html", "head", "body", "main", "header", "footer", "title", "h1"]:
            require(len(self.find(tag)) == 1, f"Expected one {tag}")
        locale = self.find("html")[0].attrs.get("lang")
        require(locale in {"en", "es-MX"}, "Missing/incorrect lang")
        require(self.find("title")[0].within("head") and self.find("title")[0].text(), "Missing title")
        charset = [n for n in self.find("meta") if "charset" in n.attrs]
        require(len(charset) == 1 and charset[0].within("head") and charset[0].attrs["charset"].lower() == "utf-8", "Missing/incorrect charset")
        for tag in ["main", "header", "footer"]:
            require(self.find(tag)[0].parent.tag == "body", f"Invalid {tag} landmark placement")
        for name in ["description", "viewport", "robots"]:
            values = [n for n in self.find("meta") if n.attrs.get("name") == name]
            require(len(values) == 1 and values[0].within("head") and values[0].attrs.get("content", "").strip(), f"Missing/duplicate metadata: {name}")
            content = values[0].attrs["content"]
            if name == "viewport":
                require("width=device-width" in content and not re.search(r"user-scalable\s*=\s*no|maximum-scale", content), "Viewport restricts zoom")
            if name == "robots":
                expected = {"index", "follow"} if page_indexable else {"noindex", "nofollow"}
                require(expected.issubset({x.strip() for x in content.split(",")}), "Missing noindex/nofollow or authorized index/follow robots directive")
        require(not self.find("base"), "Base URL override forbidden")
        canonicals = [n for n in self.find("link") if "canonical" in n.attrs.get("rel", "").split()]
        require(len(canonicals) == (1 if page_indexable else 0), "Unexpected canonical or missing authorized canonical")
        if page_indexable:
            require(canonicals[0].attrs.get("href", "").startswith("https://"), "Canonical must use verified HTTPS origin")
        alternates = [n for n in self.find("link") if n.attrs.get("rel") == "alternate"]
        require(len(alternates) in ({0, 2} if page_indexable else {0}), "Language alternate count does not match build authorization")
        require(all(n.attrs.get("hreflang") in {"en", "es-MX"} and n.attrs.get("href", "").startswith("https://") for n in alternates), "Unsafe language alternate")
        main = self.find("main")[0]
        require(main.attrs.get("id") == "main" and main.attrs.get("tabindex") == "-1", "Invalid skip target")
        require(any(n.attrs.get("href") == "#main" and self.name(n) for n in self.find("a")), "Missing named skip link")
        require(self.find("h1")[0].within("main"), "h1 outside main")
        previous = 0
        for n in self.nodes:
            if re.fullmatch(r"h[1-6]", n.tag):
                level = int(n.tag[1])
                require(n.text() and level <= previous + 1, "Empty/skipped heading level")
                previous = level
        nav = self.find("nav")
        primary, footer = ("Primary", "Footer") if locale == "en" else ("Principal", "Pie de página")
        require(len(nav) == 2 and {n.attrs.get("aria-label") for n in nav} == {primary, footer}, "Navigation landmarks need distinct localized labels")
        require(all(n.within("header" if n.attrs["aria-label"] == primary else "footer") for n in nav), "Invalid navigation placement")
        scripts = self.find("script")
        videos = self.find("video")
        about = page in {"about/index.html", "es/about/index.html"}
        require(len(videos) <= 1 and (not videos or about), "Unexpected video placement/count")
        require(len(scripts) == 1 + len(videos), "Unexpected client script count")
        script_sources = [node.attrs.get("src") for node in scripts]
        require(script_sources.count("/assets/language-preference.js") == 1 and script_sources.count("/assets/cinematic-hero-video.js") == len(videos), "Unexpected client script source/count")
        for n in self.nodes:
            require(n.tag not in {"iframe", "form", "input", "object", "embed", "audio", "canvas", "astro-island"}, f"Unexpected runtime/control: {n.tag}")
            if n.tag == "script":
                require(set(n.attrs) == {"type", "src"} and n.attrs["type"] == "module" and n.attrs["src"] in {"/assets/cinematic-hero-video.js", "/assets/language-preference.js"}, "Unexpected script source/attributes")
                require(not n.text().strip(), "Inline script is forbidden")
            if n.tag == "video":
                required = {"src", "poster", "muted", "loop", "playsinline", "preload", "aria-describedby", "tabindex", "class", "id"}
                scoped = {name for name in n.attrs if re.fullmatch(r"data-astro-cid-[a-z0-9]+", name)}
                require(set(n.attrs) == required | scoped, "Unexpected video attributes")
                require(n.attrs["src"] == "/assets/emerald-gateway-web.mp4" and n.attrs["poster"] == "/assets/emerald-gateway-poster.webp", "Unexpected About video assets")
                require(all(name in n.attrs for name in ["muted", "loop", "playsinline"]) and n.attrs["preload"] == "none", "Unsafe video playback attributes")
                require("autoplay" not in n.attrs and n.attrs["aria-describedby"] == "emerald-gateway-description", "Video autoplay/accessibility mismatch")
                require(n.attrs["tabindex"] == "-1" and n.attrs["id"] == "emerald-gateway-video", "Unexpected video focus behavior")
            require(not any(k.startswith("on") for k in n.attrs), "Inline event handler forbidden")
            for attr in ["aria-labelledby", "aria-describedby", "aria-controls"]:
                if attr in n.attrs:
                    require(n.attrs[attr] and all(i in self.ids for i in n.attrs[attr].split()), f"Broken {attr}")
            require(not ("tabindex" in n.attrs and int(n.attrs["tabindex"]) > 0), "Positive tabindex")
            if n.tag in {"a", "button", "summary"}:
                require(self.name(n), f"Unnamed {n.tag}")
            if n.tag == "a":
                require(n.attrs.get("href"), "Anchor without destination")
            if n.tag == "img":
                require(n.attrs.get("src") and n.attrs.get("alt", "").strip(), "Missing image src/meaningful alt")
            classes = n.attrs.get("class", "").split()
            if any(c in classes for c in ["tropical-atmosphere", "decorative-background"]):
                require(n.attrs.get("aria-hidden") == "true", "Decoration exposed to assistive technology")
            if n.tag == "details":
                children = [c for c in n.children if isinstance(c, Node)]
                require(children and children[0].tag == "summary" and sum(c.tag == "summary" for c in children) == 1, "Invalid native disclosure")


def audit(root, indexing_authorized=False):
    require(not root.is_symlink(), "Symlink output root")
    root = root.resolve()
    require(root.is_dir(), "Missing build output")
    paths = list(root.rglob("*"))
    require(not any(p.is_symlink() for p in paths), "Symlink output entry")
    files = {p.relative_to(root).as_posix(): p for p in paths if p.is_file()}
    private_marker = re.compile(rb"tropical-trance-studio|artwork-workspace:|/Users/|/private/|authorityEvidence|reviewEvidenceContentId|candidateContentId|publication-decision|projection\.schema\.json")
    for name, file in files.items():
        require(not private_marker.search(file.read_bytes()), f"Private evidence/source marker in output: {name}")
    documents = {p: Document(file.read_text()) for p, file in files.items() if p.endswith(".html")}
    require(documents, "Missing HTML pages")
    referenced, resource_count = set(), 0

    def reference(value, page):
        nonlocal resource_count
        require(value and not re.search(r"[\s\\]", value), "Empty/unsafe resource URL")
        url = urlsplit(value)
        require(not url.scheme and not url.netloc and not url.query and "%" not in url.path, f"External/encoded/query resource: {value}")
        candidate = (root / url.path.lstrip("/")) if url.path.startswith("/") else (files[page].parent / url.path if url.path else files[page])
        if url.path.endswith("/"):
            candidate /= "index.html"
        target = candidate.resolve()
        require(target.is_relative_to(root), "Resource escapes output")
        key = target.relative_to(root).as_posix()
        require(key in files, f"Broken resource: {page} -> {value}")
        if url.fragment:
            require(key in documents and unquote(url.fragment) in documents[key].ids, f"Broken fragment: {page} -> {value}")
        referenced.add(key)
        resource_count += 1

    for page, doc in documents.items():
        try:
            doc.structure(page, indexing_authorized)
            for n in doc.nodes:
                for attr in ["href", "src", "poster"]:
                    if attr in n.attrs:
                        if n.tag == "link" and ("canonical" in n.attrs.get("rel", "").split() or n.attrs.get("rel") == "alternate"):
                            continue
                        value = n.attrs[attr]
                        parsed = urlsplit(value)
                        if n.tag == "a" and attr == "href" and (parsed.scheme or parsed.netloc):
                            require(parsed.scheme == "https" and parsed.netloc and parsed.username is None and parsed.password is None and parsed.fragment == "", f"Unsafe external link: {value}")
                            require(n.attrs.get("target") == "_blank", "External link must open in a new tab")
                            require({"noopener", "noreferrer"}.issubset(set(n.attrs.get("rel", "").split())), "External link missing safe rel attributes")
                        else:
                            reference(value, page)
                for attr in ["srcset", "imagesrcset"]:
                    if attr in n.attrs:
                        candidates = n.attrs[attr].split(",")
                        require(candidates, "Empty srcset")
                        for candidate in candidates:
                            parts = candidate.strip().split()
                            require(1 <= len(parts) <= 2 and (len(parts) == 1 or re.fullmatch(r"(?:[1-9]\d*w|(?:\d+(?:\.\d+)?|\.\d+)x)", parts[1])), "Malformed srcset")
                            reference(parts[0], page)
        except (ValueError, KeyError) as error:
            raise ValueError(f"{page}: {error}") from error
    for page, file in files.items():
        if not page.endswith(".html") and page not in {"robots.txt", "sitemap.xml"}:
            require(page in referenced, f"Unreferenced output resource: {page}")
        if page.endswith(".css"):
            require(not re.search(r"url\s*\(|@import\b|sourceMappingURL", file.read_text(), re.I), f"Unreviewed CSS resource/map: {page}")
    print(f"Rendered HTML structural/resource audit PASS: {len(documents)} pages, {resource_count} references (not browser/a11y acceptance)")


if __name__ == "__main__":
    try:
        require(len(sys.argv) == 3 and sys.argv[2] in {"--indexing-authorized", "--noindex"}, "Usage: audit-html.py OUTPUT_DIRECTORY (--indexing-authorized|--noindex)")
        audit(Path(sys.argv[1]), sys.argv[2] == "--indexing-authorized")
    except (ValueError, OSError) as error:
        print(f"Rendered HTML audit FAIL: {error}", file=sys.stderr)
        sys.exit(1)

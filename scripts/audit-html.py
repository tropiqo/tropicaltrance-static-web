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

    def structure(self):
        require(self.doctype, "Missing HTML doctype")
        for tag in ["html", "head", "body", "main", "header", "footer", "title", "h1"]:
            require(len(self.find(tag)) == 1, f"Expected one {tag}")
        require(self.find("html")[0].attrs.get("lang") == "en", "Missing/incorrect lang")
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
                require({"noindex", "nofollow"}.issubset({x.strip() for x in content.split(",")}), "Missing noindex/nofollow")
        require(not self.find("base"), "Base URL override forbidden")
        # There is no reviewed canonical origin in current website-owned inputs.
        require(not any("canonical" in n.attrs.get("rel", "").split() for n in self.find("link")), "Unexpected canonical: no reviewed canonical origin")
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
        require(len(nav) == 2 and {n.attrs.get("aria-label") for n in nav} == {"Primary", "Footer"}, "Navigation landmarks need distinct labels")
        require(all(n.within("header" if n.attrs["aria-label"] == "Primary" else "footer") for n in nav), "Invalid navigation placement")
        for n in self.nodes:
            require(n.tag not in {"script", "iframe", "form", "input", "object", "embed", "video", "audio", "canvas", "astro-island"}, f"Unexpected runtime/control: {n.tag}")
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


def audit(root):
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
            doc.structure()
            for n in doc.nodes:
                for attr in ["href", "src", "poster"]:
                    if attr in n.attrs:
                        reference(n.attrs[attr], page)
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
        if not page.endswith(".html"):
            require(page in referenced, f"Unreferenced output resource: {page}")
        if page.endswith(".css"):
            require(not re.search(r"url\s*\(|@import\b|sourceMappingURL", file.read_text(), re.I), f"Unreviewed CSS resource/map: {page}")
    print(f"Rendered HTML structural/resource audit PASS: {len(documents)} pages, {resource_count} references (not browser/a11y acceptance)")


if __name__ == "__main__":
    try:
        require(len(sys.argv) == 2, "Usage: audit-html.py OUTPUT_DIRECTORY")
        audit(Path(sys.argv[1]))
    except (ValueError, OSError) as error:
        print(f"Rendered HTML audit FAIL: {error}", file=sys.stderr)
        sys.exit(1)

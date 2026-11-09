#!/usr/bin/env python3
"""Classify ptask ### headings so evidence stays on the owning implementation PR.

Does not inspect file extensions. Heading intent decides spawn vs fold vs block.
"""
from __future__ import annotations

import json
import re
import sys
from typing import Any

HEADING_RE = re.compile(r"^(#{3})\s+(.*)$")
CHECKBOX_RE = re.compile(r"^\s*[-*]\s*\[([ xX])\]")
NUMBER_PREFIX_RE = re.compile(r"^\d+[.)]\s*")

EVIDENCE_TITLE_RE = re.compile(
    r"^(?:(?:visual|qa|ui)\s+)?(?:proof\s+)?screenshots?(?:\s+only)?$"
    r"|^(?:visual\s+(?:proof|qa)|qa(?:\s+pass)?|attach\s+evidence"
    r"|capture\s+screenshots?|screenshot\s+pass)$",
    re.I,
)
EVIDENCE_PHRASE_RE = re.compile(
    r"\b(?:proof\s+screenshots?|screenshots?\s+only|visual\s+(?:proof|qa)"
    r"|capture\s+screenshots?|attach\s+(?:screenshots?|evidence)"
    r"|qa\s+screenshots?|screenshot\s+pass)\b",
    re.I,
)
SCREENSHOT_TEST_RE = re.compile(
    r"\b(?:screenshot\s+tests?|visual\s+regression|playwright|chromatic|percy|"
    r"snapshot\s+tests?)\b",
    re.I,
)
AUDIT_RE = re.compile(
    r"\b(?:standalone\s+audit|explicit(?:ly)?\s+requested\s+audit|"
    r"security\s+audit|accessibility\s+audit|a11y\s+audit)\b",
    re.I,
)
DOCS_RE = re.compile(
    r"\b(?:docs?|document(?:ation|ing)?|readme|changelog|runbook)\b", re.I
)
TESTS_RE = re.compile(r"\b(?:tests?|specs?|coverage|playwright|e2e)\b", re.I)
INFRA_RE = re.compile(
    r"\b(?:infra(?:structure)?|ci|cd|pipeline|github\s+actions|deploy\s+workflow)\b",
    re.I,
)
PRODUCT_RE = re.compile(
    r"\b(?:page|pages|route|ui|component|feature|endpoint|schema|form|handler|"
    r"api|screen)\b",
    re.I,
)
NOOP_TITLE_RE = re.compile(r"^(?:open|create|file)\s+(?:a\s+)?pr$", re.I)

STOPWORDS = {
    "a",
    "an",
    "and",
    "attach",
    "capture",
    "desktop",
    "evidence",
    "for",
    "from",
    "mobile",
    "of",
    "on",
    "only",
    "page",
    "pages",
    "proof",
    "px",
    "qa",
    "screenshot",
    "screenshots",
    "slice",
    "task",
    "the",
    "to",
    "unit",
    "units",
    "visual",
    "with",
}

TOKEN_RE = re.compile(r"[^\W\d_]+", re.UNICODE)


def _title(raw: str) -> str:
    return NUMBER_PREFIX_RE.sub("", raw.strip())


def _tokens(text: str) -> set[str]:
    found = set()
    for match in TOKEN_RE.finditer(text.lower()):
        word = match.group(0)
        if len(word) < 4 or word in STOPWORDS:
            continue
        found.add(word)
    return found


def parse_headings(markdown: str) -> list[dict[str, Any]]:
    slices: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    body: list[str] = []

    def close() -> None:
        nonlocal current, body
        if current is None:
            return
        current["body"] = "\n".join(body).strip("\n")
        slices.append(current)
        current = None
        body = []

    for line in markdown.splitlines():
        match = HEADING_RE.match(line)
        if match:
            close()
            raw = match.group(2).strip()
            current = {
                "heading": line.strip(),
                "title": _title(raw),
                "raw_title": raw,
            }
            body = []
            continue
        if current is not None:
            if line.startswith("#") and not line.startswith("###"):
                close()
                continue
            body.append(line)
    close()
    return slices


def _checkbox_state(body: str) -> str:
    states = CHECKBOX_RE.findall(body)
    if not states:
        return "none"
    if all(mark.lower() == "x" for mark in states):
        return "done"
    return "open"


def _kind(title: str, body: str) -> str:
    combined = f"{title}\n{body}"
    screenshot_tests = bool(SCREENSHOT_TEST_RE.search(combined))
    pure_evidence = bool(EVIDENCE_TITLE_RE.match(title.strip()))
    evidence_title = bool(EVIDENCE_PHRASE_RE.search(title)) or pure_evidence
    product_title = bool(PRODUCT_RE.search(title))
    if screenshot_tests and not pure_evidence:
        return "tests"
    if evidence_title and product_title:
        return "implement"
    if evidence_title or pure_evidence:
        return "evidence"
    if AUDIT_RE.search(combined):
        return "audit"
    if INFRA_RE.search(title) or (INFRA_RE.search(combined) and not product_title):
        return "infra"
    if TESTS_RE.search(title) or (TESTS_RE.search(combined) and not product_title):
        return "tests"
    if DOCS_RE.search(title) or (DOCS_RE.search(combined) and not product_title):
        return "docs"
    if (
        EVIDENCE_PHRASE_RE.search(body)
        and not product_title
        and not screenshot_tests
        and not AUDIT_RE.search(combined)
        and not INFRA_RE.search(title)
        and not TESTS_RE.search(title)
        and not DOCS_RE.search(title)
    ):
        return "evidence"
    if NOOP_TITLE_RE.match(title.strip()):
        return "noop"
    return "implement"


def _route_owners(
    evidence: dict[str, Any], implement: list[dict[str, Any]]
) -> list[int]:
    haystack = _tokens(f"{evidence['title']}\n{evidence['body']}")
    matched: list[int] = []
    for owner in implement:
        if _tokens(owner["title"]) & haystack:
            matched.append(owner["index"])
    if matched:
        return matched
    return [owner["index"] for owner in implement]


def classify_plan(markdown: str) -> dict[str, Any]:
    parsed = parse_headings(markdown)
    annotated: list[dict[str, Any]] = []
    for i, item in enumerate(parsed, start=1):
        kind = _kind(item["title"], item["body"])
        done = _checkbox_state(item["body"]) == "done"
        annotated.append(
            {
                "index": i,
                "heading": item["heading"],
                "title": item["title"],
                "kind": kind,
                "done": done,
                "needs_evidence": kind == "implement",
                "body": item["body"],
            }
        )

    implement = [
        item
        for item in annotated
        if item["kind"] == "implement"
    ]
    result_slices: list[dict[str, Any]] = []
    for item in annotated:
        record = {
            "index": item["index"],
            "heading": item["heading"],
            "title": item["title"],
            "kind": item["kind"],
            "done": item["done"],
            "needs_evidence": item["needs_evidence"],
            "folded_from": [],
            "route_to": [],
            "owner_already_done": False,
        }
        if item["done"] and item["kind"] != "evidence":
            record["action"] = "skip"
            result_slices.append(record)
            continue
        if item["kind"] == "evidence":
            owners = _route_owners(item, implement)
            record["route_to"] = owners
            record["owner_already_done"] = bool(owners) and all(
                next(s for s in annotated if s["index"] == idx)["done"]
                for idx in owners
            )
            if owners:
                record["action"] = "fold"
            else:
                record["action"] = "block"
                record["reason"] = (
                    "evidence-only heading with no owning implementation slice"
                )
            result_slices.append(record)
            continue
        if item["kind"] == "noop":
            record["action"] = "block"
            record["reason"] = "no-op heading would open an empty PR"
            result_slices.append(record)
            continue
        record["action"] = "spawn"
        result_slices.append(record)

    by_index = {item["index"]: item for item in result_slices}
    for item in result_slices:
        if item["action"] != "fold":
            continue
        for owner_idx in item["route_to"]:
            owner = by_index[owner_idx]
            owner["folded_from"].append(item["heading"])
            if owner["action"] == "skip":
                # Owner already shipped; still do not spawn a proof PR.
                continue
            owner["needs_evidence"] = True

    return {
        "slices": [
            {k: v for k, v in item.items() if k != "body"}
            for item in result_slices
        ],
        "spawn": [item for item in result_slices if item["action"] == "spawn"],
        "fold": [item for item in result_slices if item["action"] == "fold"],
        "block": [item for item in result_slices if item["action"] == "block"],
    }


def review_disposition(
    action: str,
    kind: str,
    evidence_status: str,
) -> str:
    """Whether a slice may open a PR.

    evidence_status: present | missing | blocked | not-required
    returns: ready | incomplete | skip-pr
    """
    if action in {"fold", "block", "skip"}:
        return "skip-pr"
    if kind == "implement":
        if evidence_status == "present":
            return "ready"
        return "incomplete"
    if kind in {"docs", "tests", "infra", "audit"}:
        return "ready"
    return "skip-pr"


def _fail(name: str, message: str) -> None:
    raise AssertionError(f"{name}: {message}")


def _titles(items: list[dict[str, Any]]) -> list[str]:
    return [item["title"] for item in items]


def run_tests() -> None:
    cases: list[dict[str, Any]] = [
        {
            "name": "implementation+screenshots same PR",
            "md": """### 1. Representações page
- [ ] build the unit page
- [ ] wire the route
""",
            "spawn": ["Representações page"],
            "fold": [],
            "block": [],
            "needs_evidence": True,
        },
        {
            "name": "legacy proof-only heading",
            "md": """### 1. Representações page
- [ ] build the unit page

### 2. Proof screenshots
- [ ] desktop and 360px screenshots
""",
            "spawn": ["Representações page"],
            "fold": ["Proof screenshots"],
            "block": [],
            "folded_into": {"Representações page": ["### 2. Proof screenshots"]},
        },
        {
            "name": "multiple owning pages",
            "md": """### 1. Representações
- [ ] build the page

### 2. Sondas
- [ ] build the page

### 3. Shared nav
- [ ] link both pages

### 4. Proof screenshots
- [ ] desktop/360px screenshots for Representações
- [ ] desktop/360px screenshots for Sondas
""",
            "spawn": ["Representações", "Sondas", "Shared nav"],
            "fold": ["Proof screenshots"],
            "block": [],
            "route_to_titles": ["Representações", "Sondas"],
            "not_route_to": ["Shared nav"],
        },
        {
            "name": "no-op",
            "md": """### 1. Open a PR
""",
            "spawn": [],
            "fold": [],
            "block": ["Open a PR"],
        },
        {
            "name": "evidence-only with no owner",
            "md": """### 1. Proof screenshots
- [ ] capture desktop and 360px
""",
            "spawn": [],
            "fold": [],
            "block": ["Proof screenshots"],
        },
        {
            "name": "valid standalone docs",
            "md": """### 1. Document the help-form contract
- [ ] update README
""",
            "spawn": ["Document the help-form contract"],
            "kinds": {"Document the help-form contract": "docs"},
            "fold": [],
            "block": [],
            "needs_evidence": False,
        },
        {
            "name": "valid standalone tests",
            "md": """### 1. Add Playwright coverage for billing
- [ ] write the spec
""",
            "spawn": ["Add Playwright coverage for billing"],
            "kinds": {"Add Playwright coverage for billing": "tests"},
            "fold": [],
            "block": [],
            "needs_evidence": False,
        },
        {
            "name": "explicit standalone audit",
            "md": """### 1. Standalone accessibility audit
- [ ] report findings
""",
            "spawn": ["Standalone accessibility audit"],
            "kinds": {"Standalone accessibility audit": "audit"},
            "fold": [],
            "block": [],
        },
        {
            "name": "screenshot tests are tests not proof",
            "md": """### 1. Representações page
- [ ] build the page

### 2. Add screenshot tests
- [ ] Playwright visual snapshots
""",
            "spawn": ["Representações page", "Add screenshot tests"],
            "fold": [],
            "block": [],
            "kinds": {"Add screenshot tests": "tests"},
        },
    ]

    for case in cases:
        plan = classify_plan(case["md"])
        name = case["name"]
        if _titles(plan["spawn"]) != case["spawn"]:
            _fail(name, f"spawn {_titles(plan['spawn'])!r} != {case['spawn']!r}")
        if _titles(plan["fold"]) != case["fold"]:
            _fail(name, f"fold {_titles(plan['fold'])!r} != {case['fold']!r}")
        if _titles(plan["block"]) != case["block"]:
            _fail(name, f"block {_titles(plan['block'])!r} != {case['block']!r}")
        if case.get("needs_evidence") is True:
            for item in plan["spawn"]:
                if item["kind"] == "implement" and not item["needs_evidence"]:
                    _fail(name, f"{item['title']} missing needs_evidence")
        if case.get("needs_evidence") is False:
            for item in plan["spawn"]:
                if item["needs_evidence"]:
                    _fail(name, f"{item['title']} should not require UI evidence")
        if "folded_into" in case:
            by_title = {item["title"]: item for item in plan["spawn"]}
            for title, folded in case["folded_into"].items():
                if by_title[title]["folded_from"] != folded:
                    _fail(
                        name,
                        f"{title} folded_from {by_title[title]['folded_from']!r} != {folded!r}",
                    )
        if "route_to_titles" in case:
            title_by_index = {item["index"]: item["title"] for item in plan["slices"]}
            routed = [
                title_by_index[idx]
                for item in plan["fold"]
                for idx in item["route_to"]
            ]
            if routed != case["route_to_titles"]:
                _fail(name, f"route_to {routed!r} != {case['route_to_titles']!r}")
            if case.get("not_route_to"):
                for forbidden in case["not_route_to"]:
                    if forbidden in routed:
                        _fail(name, f"routed combined proof onto {forbidden}")
        if "kinds" in case:
            by_title = {item["title"]: item for item in plan["slices"]}
            for title, kind in case["kinds"].items():
                if by_title[title]["kind"] != kind:
                    _fail(
                        name,
                        f"{title} kind {by_title[title]['kind']!r} != {kind!r}",
                    )
        print(f"PASS {name}")

    disposition_cases = [
        ("implement present", "spawn", "implement", "present", "ready"),
        ("blocked evidence", "spawn", "implement", "blocked", "incomplete"),
        ("missing evidence", "spawn", "implement", "missing", "incomplete"),
        ("fold skip-pr", "fold", "evidence", "present", "skip-pr"),
        ("noop skip-pr", "block", "noop", "missing", "skip-pr"),
        ("docs ready", "spawn", "docs", "not-required", "ready"),
        ("tests ready", "spawn", "tests", "not-required", "ready"),
        ("infra ready", "spawn", "infra", "not-required", "ready"),
        ("audit ready", "spawn", "audit", "not-required", "ready"),
    ]
    for name, action, kind, status, expected in disposition_cases:
        got = review_disposition(action, kind, status)
        if got != expected:
            _fail(name, f"{got!r} != {expected!r}")
        print(f"PASS {name}")

    print(f"RESULTS pass={len(cases) + len(disposition_cases)} fail=0")


def main(argv: list[str]) -> int:
    if argv and argv[0] in {"--test", "--self-test"}:
        run_tests()
        return 0
    if argv and argv[0] in {"-h", "--help"}:
        print(
            "usage: queue-slices.py [--test] [PLAN.md]\n"
            "Classify ### headings. Prints JSON. Spawn those; fold proof onto owners.",
            file=sys.stderr,
        )
        return 2
    source = sys.stdin.read() if not argv else open(argv[0], encoding="utf-8").read()
    json.dump(classify_plan(source), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

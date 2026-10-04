"""Helpers shared by the listing and story parsers."""

from __future__ import annotations

import html as html_lib
import json
import math
import re
from datetime import date, datetime, timezone
from typing import Any, Iterable

from bs4 import BeautifulSoup, Tag

from .jsdata import JSData, parse_js_data

_SPACE = re.compile(r"[ \t\r\f\v  -   　]+")
_COUNT = re.compile(r"(\d[\d,.\s]*)\s*([kKmM])?\b")


def make_soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def clean_text(s: Any) -> str:
    """Unescaped text with whitespace collapsed. A number becomes its digits (the site's data sometimes
    stores a tag such as 16, or a title such as 1984, as a number); anything else that is not text gives ""."""
    if isinstance(s, bool):
        return ""
    if isinstance(s, int):
        s = str(s)
    elif isinstance(s, float):
        s = (str(int(s)) if s.is_integer() else str(s)) if math.isfinite(s) else ""
    if not s or not isinstance(s, str):
        return ""
    s = html_lib.unescape(s).replace("​", "").replace("﻿", "")
    return _SPACE.sub(" ", s).strip()


def text_of(el: Tag | None) -> str:
    return clean_text(el.get_text(" ", strip=True)) if el is not None else ""


def script_texts(soup: BeautifulSoup) -> list[str]:
    out = []
    for s in soup.find_all("script"):
        if s.get("src"):
            continue
        t = s.string if s.string is not None else s.get_text()
        if t and t.strip():
            out.append(t)
    return out


def page_jsdata(soup: BeautifulSoup) -> JSData:
    """Parse embedded data scripts (SolidStart/seroval, Next.js, plain JSON state)."""
    data = JSData()
    for s in soup.find_all("script"):
        if s.get("src"):
            continue
        typ = (s.get("type") or "").lower()
        if "ld+json" in typ:
            continue
        t = s.string if s.string is not None else s.get_text()
        if not t or len(t) < 20:
            continue
        if typ in ("application/json",) or s.get("id") == "__NEXT_DATA__":
            try:
                data.roots.append(json.loads(t))
                continue
            except ValueError:
                pass
        if "$R[" in t or "_$HY" in t or "__INITIAL" in t or "__NUXT" in t or "window." in t or t.lstrip().startswith("{"):
            parse_js_data(t, data)
    return data


def jsonld_objects(soup: BeautifulSoup) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for s in soup.find_all("script", attrs={"type": re.compile("ld\\+json", re.I)}):
        t = s.string if s.string is not None else s.get_text()
        try:
            data = json.loads(t)
        except (ValueError, TypeError):
            continue
        stack = [data]
        while stack:
            d = stack.pop()
            if isinstance(d, list):
                stack.extend(d)
            elif isinstance(d, dict):
                if "@graph" in d:
                    stack.append(d["@graph"])
                out.append(d)
    return out


def ld_type_is(obj: dict[str, Any], *types: str) -> bool:
    t = obj.get("@type")
    ts = t if isinstance(t, list) else [t]
    return any(x in types for x in ts if isinstance(x, str))


def meta_content(soup: BeautifulSoup, *, name: str | None = None, prop: str | None = None) -> str | None:
    if name:
        el = soup.find("meta", attrs={"name": name})
    else:
        el = soup.find("meta", attrs={"property": prop})
    return clean_text(el.get("content")) if el and el.get("content") else None


def parse_count(text: Any) -> tuple[int | None, bool]:
    """'12,345' -> (12345, False); '12.3k' -> (12300, True); 4 -> (4, False)."""
    if text is None or isinstance(text, bool):
        return None, False
    if isinstance(text, (int, float)):
        return (int(text), False) if math.isfinite(text) else (None, False)
    m = _COUNT.search(str(text))
    if not m:
        return None, False
    num, suffix = m.group(1).replace(",", "").replace(" ", ""), (m.group(2) or "").lower()
    try:
        value = float(num)
    except ValueError:
        return None, False
    if suffix == "k":
        return int(round(value * 1_000)), True
    if suffix == "m":
        return int(round(value * 1_000_000)), True
    return int(value), False


def parse_float(text: Any) -> float | None:
    if text is None or isinstance(text, bool):
        return None
    if isinstance(text, (int, float)):
        return float(text) if math.isfinite(text) else None
    m = re.search(r"\d+(?:\.\d+)?", str(text))
    return float(m.group(0)) if m else None


_DATE_FORMATS = ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%b %d, %Y", "%B %d, %Y", "%d %b %Y", "%d %B %Y")


def parse_date(value: Any) -> str | None:
    """Return an ISO date (YYYY-MM-DD) or None. Literotica uses MM/DD/YYYY."""
    if value is None:
        return None
    if isinstance(value, (int, float)) and value > 10_000_000:  # epoch seconds or ms
        v = value / 1000 if value > 10_000_000_000 else value
        try:
            return datetime.fromtimestamp(v, tz=timezone.utc).date().isoformat()
        except (OverflowError, OSError, ValueError):
            return None
    s = clean_text(str(value))
    if not s:
        return None
    m = re.match(r"(\d{4}-\d{2}-\d{2})[T ]", s)
    if m:
        s = m.group(1)
    for fmt in _DATE_FORMATS:
        try:
            d = datetime.strptime(s, fmt).date()
            return d.isoformat() if date(1995, 1, 1) <= d <= date(2100, 1, 1) else None
        except ValueError:
            continue
    m = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", s)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(1)), int(m.group(2))).isoformat()
        except ValueError:
            return None
    return None


def classes_containing(el: Tag, fragment: str) -> bool:
    cls = el.get("class") or []
    if isinstance(cls, str):
        cls = cls.split()
    return any(fragment in c for c in cls)


def first(items: Iterable[Any]) -> Any:
    for x in items:
        if x not in (None, "", [], {}):
            return x
    return None

"""Tolerant reader for data embedded in ``<script>`` tags.

Literotica's pages are server-rendered with SolidStart, which serialises page
data with *seroval* into JavaScript rather than JSON, for example::

    _$HY.r["workData[\\"my-story\\"]"]=$R[8]=($R[9]=...,$R[10]={allow_vote:!0,
        title:"My Story",url:"my-story",view_count:12345,rate_all:4.61,...})

Keys are unquoted, ``!0``/``!1`` mean true/false, and ``$R[n]`` are references
to values defined elsewhere. This module parses JavaScript object/array
literals with a small, forgiving recursive-descent parser. It never executes
code; anything it does not understand is skipped.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Iterator

_WS = re.compile(r"(?:\s+|//[^\n]*|/\*.*?\*/)+", re.S)
_IDENT = re.compile(r"[A-Za-z_$][\w$]*")
_NUMBER = re.compile(r"-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?n?")
_DQ = re.compile(r'"(?:[^"\\]|\\.)*"', re.S)
_SQ = re.compile(r"'(?:[^'\\]|\\.)*'", re.S)
_BT = re.compile(r"`(?:[^`\\]|\\.)*`", re.S)
_REF = re.compile(r"\$R\[(\d+)\]")
_OBJ_START = re.compile(r"\{\s*(?:[A-Za-z_$][\w$]*|\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'|\d+)\s*:")
_ESC = re.compile(r"\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r\n|[\s\S])")
_SIMPLE_ESC = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "v": "\v", "0": "\0"}


class _Fail(Exception):
    pass


class Ref:
    __slots__ = ("n",)

    def __init__(self, n: int):
        self.n = n

    def __repr__(self) -> str:
        return f"$R[{self.n}]"


@dataclass
class JSData:
    roots: list[Any] = field(default_factory=list)
    refs: dict[int, Any] = field(default_factory=dict)
    named: dict[str, Any] = field(default_factory=dict)

    def resolve(self, value: Any, _depth: int = 0) -> Any:
        while isinstance(value, Ref) and _depth < 50:
            value = self.refs.get(value.n)
            _depth += 1
        return None if isinstance(value, Ref) else value

    def iter_dicts(self) -> Iterator[dict[str, Any]]:
        """Every dict reachable from the parsed data (each yielded once)."""
        seen: set[int] = set()
        stack: list[Any] = list(self.roots) + list(self.refs.values()) + list(self.named.values())
        while stack:
            v = stack.pop()
            if isinstance(v, Ref):
                v = self.resolve(v)
            if isinstance(v, (dict, list)):
                if id(v) in seen:
                    continue
                seen.add(id(v))
                if isinstance(v, dict):
                    yield v
                    stack.extend(v.values())
                else:
                    stack.extend(v)

    def materialize(self, value: Any, depth: int = 4) -> Any:
        """Copy of ``value`` with references resolved down to ``depth`` levels."""
        value = self.resolve(value)
        if depth <= 0:
            return None if isinstance(value, (dict, list)) else value
        if isinstance(value, dict):
            return {k: self.materialize(v, depth - 1) for k, v in value.items()}
        if isinstance(value, list):
            return [self.materialize(v, depth - 1) for v in value]
        return value


def _unescape_js(raw: str) -> str:
    def repl(m: re.Match[str]) -> str:
        e = m.group(1)
        if e.startswith("u{"):
            return chr(int(e[2:-1], 16))
        if e[0] == "u" and len(e) == 5:
            return chr(int(e[1:], 16))
        if e[0] == "x" and len(e) == 3:
            return chr(int(e[1:], 16))
        if e in ("\n", "\r\n", "\r", "\u2028", "\u2029"):
            return ""  # line continuation
        return _SIMPLE_ESC.get(e, e)

    return _ESC.sub(repl, raw)


def _decode_string(token: str) -> str:
    body = token[1:-1]
    if token[0] == '"' and "\\x" not in body and "\\'" not in body and "\\u{" not in body:
        try:
            return json.loads(token)
        except ValueError:
            pass
    s = _unescape_js(body)
    # Recombine surrogate pairs produced by \uD83D\uDE00-style escapes.
    try:
        return s.encode("utf-16", "surrogatepass").decode("utf-16")
    except UnicodeError:
        return s


class _Parser:
    def __init__(self, text: str, data: JSData):
        self.s = text
        self.n = len(text)
        self.pos = 0
        self.data = data
        self.depth = 0

    def ws(self) -> None:
        m = _WS.match(self.s, self.pos)
        if m:
            self.pos = m.end()

    def peek(self) -> str:
        return self.s[self.pos] if self.pos < self.n else ""

    def startswith(self, t: str) -> bool:
        return self.s.startswith(t, self.pos)

    # value := primary postfix*
    def value(self) -> Any:
        self.depth += 1
        if self.depth > 400:
            raise _Fail("too deep")
        try:
            v, target = self.primary()
            while True:
                self.ws()
                c = self.peek()
                if c == "(" and target is not None:
                    args = self.args()
                    v, target = args, None  # call: keep the arguments (they hold the data)
                elif c == "." and target is not None:
                    self.pos += 1
                    m = _IDENT.match(self.s, self.pos)
                    if not m:
                        raise _Fail("bad member")
                    self.pos = m.end()
                    target = f"{target}.{m.group(0)}"
                    v = None
                elif c == "[" and target is not None:
                    self.pos += 1
                    self.ws()
                    key = self.value()
                    self.ws()
                    if self.peek() != "]":
                        raise _Fail("bad index")
                    self.pos += 1
                    target = f"{target}[{key}]"
                    v = None
                elif c == "=" and not self.startswith("==") and not self.startswith("=>"):
                    self.pos += 1
                    self.ws()
                    rhs = self.value()
                    if isinstance(v, Ref):
                        self.data.refs[v.n] = rhs
                    elif target is not None:
                        self.data.named[target] = rhs
                    return rhs
                else:
                    return v
        finally:
            self.depth -= 1

    def primary(self) -> tuple[Any, str | None]:
        self.ws()
        c = self.peek()
        if not c:
            raise _Fail("eof")
        if c == "{":
            return self.obj(), None
        if c == "[":
            return self.arr(), None
        if c in "\"'`":
            pattern = _DQ if c == '"' else _SQ if c == "'" else _BT
            m = pattern.match(self.s, self.pos)
            if not m:
                raise _Fail("bad string")
            self.pos = m.end()
            return _decode_string(m.group(0)), None
        if c == "!":
            self.pos += 1
            self.ws()
            if self.peek() in "01" and not (self.pos + 1 < self.n and self.s[self.pos + 1].isdigit()):
                b = self.peek() == "0"
                self.pos += 1
                return b, None
            inner = self.value()
            return (not inner), None
        if c == "-" or c.isdigit() or (c == "." and self.pos + 1 < self.n and self.s[self.pos + 1].isdigit()):
            if self.startswith("-Infinity"):
                self.pos += 9
                return float("-inf"), None
            m = _NUMBER.match(self.s, self.pos)
            if not m:
                raise _Fail("bad number")
            self.pos = m.end()
            t = m.group(0).rstrip("n")
            return (float(t) if any(ch in t for ch in ".eE") else int(t)), None
        if c == "$":
            m = _REF.match(self.s, self.pos)
            if m:
                self.pos = m.end()
                return Ref(int(m.group(1))), f"$R[{m.group(1)}]"
        if c == "(":
            self.pos += 1
            items = []
            while True:
                self.ws()
                if self.peek() == ")":
                    self.pos += 1
                    break
                items.append(self._tolerant_value(",)"))
                self.ws()
                if self.peek() == ",":
                    self.pos += 1
                elif self.peek() == ")":
                    self.pos += 1
                    break
                else:
                    raise _Fail("bad paren")
            return (items[-1] if items else None), None
        m = _IDENT.match(self.s, self.pos)
        if m:
            word = m.group(0)
            self.pos = m.end()
            if word == "true":
                return True, None
            if word == "false":
                return False, None
            if word in ("null", "undefined"):
                return None, None
            if word == "NaN":
                return float("nan"), None
            if word == "Infinity":
                return float("inf"), None
            if word == "void":
                self.value()
                return None, None
            if word == "new":
                self.ws()
                cm = _IDENT.match(self.s, self.pos)
                if not cm:
                    raise _Fail("bad new")
                self.pos = cm.end()
                cls = cm.group(0)
                while self.startswith("."):
                    self.pos += 1
                    cm = _IDENT.match(self.s, self.pos)
                    if not cm:
                        raise _Fail("bad new")
                    self.pos = cm.end()
                    cls = cm.group(0)
                self.ws()
                args = self.args() if self.peek() == "(" else []
                if cls == "Date" and args and isinstance(args[0], (str, int, float)):
                    return args[0], None
                if cls == "Map" and args and isinstance(args[0], list):
                    out = {}
                    for pair in args[0]:
                        if isinstance(pair, list) and len(pair) == 2 and isinstance(pair[0], (str, int, float)):
                            out[pair[0]] = pair[1]
                    return out, None
                if cls == "Set" and args and isinstance(args[0], list):
                    return args[0], None
                return (args[0] if len(args) == 1 else args), None
            if word == "function":
                raise _Fail("function")
            self.ws()
            if self.startswith("=>"):
                raise _Fail("arrow function")
            return None, word
        raise _Fail(f"unexpected {c!r}")

    def _tolerant_value(self, stops: str) -> Any:
        """Parse a value; if it cannot be parsed, skip it and return None."""
        start = self.pos
        try:
            return self.value()
        except _Fail:
            self.pos = start
            self._skip_to(stops)
            return None

    def args(self) -> list[Any]:
        assert self.peek() == "("
        self.pos += 1
        out: list[Any] = []
        while True:
            self.ws()
            if self.peek() == ")":
                self.pos += 1
                return out
            out.append(self._tolerant_value(",)"))
            self.ws()
            if self.peek() == ",":
                self.pos += 1
            elif self.peek() == ")":
                self.pos += 1
                return out
            else:
                raise _Fail("bad args")

    def _skip_to(self, stops: str) -> None:
        """Skip one malformed expression: up to the next stop char at depth 0."""
        depth = 0
        while self.pos < self.n:
            c = self.s[self.pos]
            if c in "\"'`":
                pattern = _DQ if c == '"' else _SQ if c == "'" else _BT
                m = pattern.match(self.s, self.pos)
                self.pos = m.end() if m else self.pos + 1
                continue
            if c in "{[(":
                depth += 1
            elif c in "}])":
                if depth == 0:
                    return
                depth -= 1
            elif c in stops and depth == 0:
                return
            self.pos += 1
        raise _Fail("unterminated")

    def obj(self) -> dict[str, Any]:
        self.pos += 1  # {
        out: dict[str, Any] = {}
        while True:
            self.ws()
            c = self.peek()
            if c == "}":
                self.pos += 1
                return out
            if c in "\"'":
                m = (_DQ if c == '"' else _SQ).match(self.s, self.pos)
                if not m:
                    raise _Fail("bad key")
                self.pos = m.end()
                key = _decode_string(m.group(0))
            else:
                m = _IDENT.match(self.s, self.pos) or _NUMBER.match(self.s, self.pos)
                if not m:
                    if self.startswith("..."):
                        self.pos += 3
                        self.value()
                        self._after_member()
                        continue
                    raise _Fail("bad key")
                self.pos = m.end()
                key = m.group(0)
            self.ws()
            if self.peek() != ":":
                # shorthand property {a, b} or method; skip it
                self._skip_to(",}")
                self._after_member()
                continue
            self.pos += 1
            start = self.pos
            try:
                out[key] = self.value()
            except _Fail:
                self.pos = start
                self._skip_to(",}")
                out[key] = None
            self._after_member()

    def _after_member(self) -> None:
        self.ws()
        c = self.peek()
        if c == ",":
            self.pos += 1
        elif c != "}":
            raise _Fail("bad object")

    def arr(self) -> list[Any]:
        self.pos += 1  # [
        out: list[Any] = []
        while True:
            self.ws()
            c = self.peek()
            if c == "]":
                self.pos += 1
                return out
            if c == ",":  # hole
                self.pos += 1
                out.append(None)
                continue
            start = self.pos
            try:
                out.append(self.value())
            except _Fail:
                self.pos = start
                self._skip_to(",]")
                out.append(None)
            self.ws()
            c = self.peek()
            if c == ",":
                self.pos += 1
            elif c != "]":
                raise _Fail("bad array")


def parse_js_data(text: str, data: JSData | None = None) -> JSData:
    """Parse every object literal / ``$R`` assignment / ``_$HY`` assignment in ``text``."""
    data = data if data is not None else JSData()
    p = _Parser(text, data)
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        attempt = False
        if c == "{":
            attempt = _OBJ_START.match(text, i) is not None
        elif c == "$":
            attempt = text.startswith("$R[", i)
        elif c == "_":
            attempt = text.startswith("_$HY", i)
        if not attempt:
            i += 1
            continue
        p.pos, p.depth = i, 0
        try:
            v = p.value()
            if isinstance(v, (dict, list)):
                data.roots.append(v)
            i = max(p.pos, i + 1)
        except (_Fail, RecursionError, IndexError, ValueError):
            i += 1
    return data


def parse_json_scripts(texts: list[str]) -> list[Any]:
    out = []
    for t in texts:
        try:
            out.append(json.loads(t))
        except ValueError:
            continue
    return out

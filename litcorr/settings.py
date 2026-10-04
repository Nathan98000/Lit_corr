"""Configuration: defaults, loading ``config.toml``, and safety validation.

The defaults below mirror ``config.toml``. Values in the file override them.
A few hard limits (minimum delay, maximum requests per minute) cannot be
relaxed from the config file; they exist so that a typo cannot turn the
collector into a fast crawler.
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:  # Python 3.11+
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - Python 3.10
    import tomli as tomllib  # type: ignore[no-redef]

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config.toml"

# Hard safety limits. Not configurable on purpose.
MIN_BASE_DELAY_SECONDS = 3.0
MAX_REQUESTS_PER_MINUTE = 15
ALLOWED_HOSTS = frozenset({"www.literotica.com"})


@dataclass
class Politeness:
    base_delay_seconds: float = 8.0
    jitter_seconds: float = 4.0
    max_requests_per_minute: int = 6
    max_requests_per_hour: int = 300
    max_requests_per_day: int = 3000
    max_requests_per_session: int = 1500
    timeout_connect_seconds: float = 10
    timeout_read_seconds: float = 30
    max_retries: int = 3
    backoff_base_seconds: float = 60
    backoff_max_seconds: float = 1800
    pause_after_429_seconds: float = 1800
    stop_after_429_count: int = 2
    stop_after_403_count: int = 1
    stop_after_error_streak: int = 5
    cooldown_after_429_hours: float = 6
    cooldown_after_block_hours: float = 24
    max_attempts_per_url: int = 3


@dataclass
class Identity:
    user_agent: str = (
        "LitCorrResearch/0.1 (non-commercial data-visualization project; "
        "one request at a time; contact: REPLACE_WITH_EMAIL_OR_URL)"
    )
    robots_token: str = "LitCorrResearch"


@dataclass
class Scope:
    base_url: str = "https://www.literotica.com"
    categories: list[str] = field(default_factory=list)
    exclude_categories: list[str] = field(
        default_factory=lambda: [
            "audio-sex-stories",
            "illustrated-erotic-fiction",
            "non-english-stories",
        ]
    )
    listing_strategy: str = "spread"
    max_listing_pages_per_category: int = 0
    max_stories_per_category: int = 300
    listing_oversample: float = 1.4
    text_mode: str = "full"
    max_pages_per_story: int = 20
    min_year: int = 0
    max_year: int = 0
    random_seed: int = 20261001


@dataclass
class Storage:
    data_dir: str = "data"


@dataclass
class Analysis:
    min_words_for_text_measures: int = 100
    min_views_for_rates: int = 100
    window_tokens: int = 500
    pacing_segments: int = 5
    min_words_for_pacing: int = 1000
    workers: int = 0


@dataclass
class Settings:
    politeness: Politeness = field(default_factory=Politeness)
    identity: Identity = field(default_factory=Identity)
    scope: Scope = field(default_factory=Scope)
    storage: Storage = field(default_factory=Storage)
    analysis: Analysis = field(default_factory=Analysis)
    config_path: Path | None = None

    @property
    def data_dir(self) -> Path:
        p = Path(self.storage.data_dir)
        if not p.is_absolute():
            base = self.config_path.parent if self.config_path else PROJECT_ROOT
            p = base / p
        return p

    def to_dict(self) -> dict[str, Any]:
        d = dataclasses.asdict(self)
        d["config_path"] = str(self.config_path) if self.config_path else None
        return d


class ConfigError(ValueError):
    pass


def _apply_section(obj: Any, values: dict[str, Any], section: str) -> None:
    known = {f.name: f for f in dataclasses.fields(obj)}
    for key, value in values.items():
        if key not in known:
            raise ConfigError(f"Unknown setting [{section}] {key} in config file")
        default = getattr(obj, key)
        if isinstance(default, bool):
            if not isinstance(value, bool):
                raise ConfigError(f"[{section}] {key} must be true or false")
        elif isinstance(default, (int, float)) and not isinstance(default, bool):
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                raise ConfigError(f"[{section}] {key} must be a number")
            value = type(default)(value) if isinstance(default, float) else value
        elif isinstance(default, list):
            if not isinstance(value, list):
                raise ConfigError(f"[{section}] {key} must be a list")
        elif isinstance(default, str):
            if not isinstance(value, str):
                raise ConfigError(f"[{section}] {key} must be text")
        setattr(obj, key, value)


def validate(settings: Settings) -> list[str]:
    """Raise ConfigError for unsafe/invalid values; return non-fatal warnings."""
    p, s, warnings = settings.politeness, settings.scope, []
    if p.base_delay_seconds < MIN_BASE_DELAY_SECONDS:
        raise ConfigError(
            f"base_delay_seconds must be at least {MIN_BASE_DELAY_SECONDS} "
            "(hard limit to keep the collector low-impact)"
        )
    if not 1 <= p.max_requests_per_minute <= MAX_REQUESTS_PER_MINUTE:
        raise ConfigError(f"max_requests_per_minute must be between 1 and {MAX_REQUESTS_PER_MINUTE}")
    if p.jitter_seconds < 0:
        raise ConfigError("jitter_seconds cannot be negative")
    for name in ("max_requests_per_hour", "max_requests_per_day", "max_requests_per_session"):
        if getattr(p, name) < 1:
            raise ConfigError(f"{name} must be at least 1")
    if p.max_retries < 0 or p.max_retries > 6:
        raise ConfigError("max_retries must be between 0 and 6")
    # The protective behaviour itself cannot be switched off from the config file.
    bounds = {
        "stop_after_403_count": (1, 3), "stop_after_429_count": (1, 3), "stop_after_error_streak": (1, 20),
        "max_attempts_per_url": (1, 5), "pause_after_429_seconds": (300, 86400),
        "cooldown_after_429_hours": (1, 168), "cooldown_after_block_hours": (6, 720),
        "backoff_base_seconds": (10, 3600), "backoff_max_seconds": (60, 86400),
        "timeout_connect_seconds": (1, 60), "timeout_read_seconds": (5, 180),
    }
    for name, (lo, hi) in bounds.items():
        val = getattr(p, name)
        if not lo <= val <= hi:
            raise ConfigError(f"{name} must be between {lo} and {hi} (got {val})")
    if p.backoff_max_seconds < p.backoff_base_seconds:
        raise ConfigError("backoff_max_seconds must be at least backoff_base_seconds")
    if s.listing_strategy not in ("spread", "all"):
        raise ConfigError('listing_strategy must be "spread" or "all"')
    if s.text_mode not in ("full", "first_page"):
        raise ConfigError('text_mode must be "full" or "first_page"')
    if s.max_pages_per_story < 1:
        raise ConfigError("max_pages_per_story must be at least 1")
    if s.max_stories_per_category < 1:
        raise ConfigError("max_stories_per_category must be at least 1")
    if s.listing_oversample < 1:
        raise ConfigError("listing_oversample must be at least 1")
    from urllib.parse import urlsplit

    host = urlsplit(s.base_url).hostname or ""
    if host not in ALLOWED_HOSTS:
        raise ConfigError(f"base_url host must be one of {sorted(ALLOWED_HOSTS)}")
    if "REPLACE_WITH" in settings.identity.user_agent:
        warnings.append(
            "identity.user_agent still contains the contact placeholder. Please add an "
            "email address or project URL so the site's operators can reach you."
        )
    if not settings.identity.robots_token.strip():
        raise ConfigError("identity.robots_token cannot be empty")
    if settings.identity.robots_token.lower() not in settings.identity.user_agent.lower():
        raise ConfigError("identity.robots_token must appear in identity.user_agent, so the robots.txt rules "
                          "followed are the ones that apply to the User-Agent actually sent")
    ua = settings.identity.user_agent.lower()
    if any(b in ua for b in ("mozilla", "chrome", "safari", "firefox", "applewebkit", "gecko", "edge/")):
        raise ConfigError("identity.user_agent must not imitate a web browser")
    a = settings.analysis
    if a.pacing_segments < 2:
        raise ConfigError("pacing_segments must be at least 2")
    if a.window_tokens < 50:
        raise ConfigError("window_tokens must be at least 50")
    return warnings


def load_settings(path: str | Path | None = None, overrides: dict[str, dict[str, Any]] | None = None) -> Settings:
    settings = Settings()
    cfg_path = Path(path) if path else DEFAULT_CONFIG_PATH
    if cfg_path.exists():
        with cfg_path.open("rb") as fh:
            raw = tomllib.load(fh)
        for section, values in raw.items():
            if not hasattr(settings, section) or section == "config_path":
                raise ConfigError(f"Unknown section [{section}] in {cfg_path}")
            if not isinstance(values, dict):
                raise ConfigError(f"[{section}] must be a table")
            _apply_section(getattr(settings, section), values, section)
        settings.config_path = cfg_path.resolve()
    elif path:
        raise ConfigError(f"Config file not found: {cfg_path}")
    for section, values in (overrides or {}).items():
        _apply_section(getattr(settings, section), values, section)
    validate(settings)
    return settings

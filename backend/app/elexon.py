"""Small, explicit client for the public Elexon Insights dataset API."""

from __future__ import annotations

import time
from datetime import date, datetime, time as clock_time, timedelta, timezone
from threading import Lock
from typing import Any
from zoneinfo import ZoneInfo

import requests

API_BASE = "https://data.elexon.co.uk/bmrs/api/v1"
LONDON = ZoneInfo("Europe/London")
UTC = timezone.utc
FORECAST_LOOKBACK_DAYS = 7
CACHE_TTL_SECONDS = 600

_cache: dict[tuple[str, ...], tuple[float, Any]] = {}
_cache_lock = Lock()


class ElexonError(RuntimeError):
    """Raised when Elexon's public API cannot provide a usable response."""


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)
    except (TypeError, ValueError):
        return None


def _get_json(dataset: str, params: dict[str, str]) -> list[dict[str, Any]]:
    url = f"{API_BASE}/datasets/{dataset}/stream"
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = requests.get(url, params=params, timeout=(5, 60))
            if response.status_code == 429 or response.status_code >= 500:
                response.raise_for_status()
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, list):
                raise ElexonError(f"Unexpected {dataset} response: expected a JSON list")
            return payload
        except (requests.RequestException, ValueError, ElexonError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(0.4 * (2**attempt))
    raise ElexonError(f"Could not retrieve {dataset} from Elexon: {last_error}") from last_error


def _cached(key: tuple[str, ...], loader, force_refresh: bool) -> Any:
    now = time.monotonic()
    if not force_refresh:
        with _cache_lock:
            item = _cache.get(key)
            if item and now - item[0] < CACHE_TTL_SECONDS:
                return item[1]
    value = loader()
    with _cache_lock:
        _cache[key] = (time.monotonic(), value)
    return value


def fetch_actuals(start: date, end: date, force_refresh: bool = False) -> list[dict[str, Any]]:
    key = ("FUELHH", start.isoformat(), end.isoformat())

    def load() -> list[dict[str, Any]]:
        return _get_json(
            "FUELHH",
            {
                "settlementDateFrom": start.isoformat(),
                "settlementDateTo": end.isoformat(),
            },
        )

    return _cached(key, load, force_refresh)


def _cutoff_for_delivery_day(delivery_day: date, cutoff: clock_time) -> datetime:
    decision_day = delivery_day - timedelta(days=1)
    return datetime.combine(decision_day, cutoff, tzinfo=LONDON).astimezone(UTC)


def fetch_forecasts(
    start: date,
    end: date,
    cutoff: clock_time,
    force_refresh: bool = False,
) -> list[dict[str, Any]]:
    # WINDFOR is queried by publish time so superseded vintages remain available.
    # Seven earlier days capture the forward horizon for the delivery intervals.
    publish_from = datetime.combine(
        start - timedelta(days=FORECAST_LOOKBACK_DAYS), clock_time.min, tzinfo=LONDON
    ).astimezone(UTC)
    publish_to = _cutoff_for_delivery_day(end, cutoff)
    key = ("WINDFOR", publish_from.isoformat(), publish_to.isoformat())

    def load() -> list[dict[str, Any]]:
        return _get_json(
            "WINDFOR",
            {
                "publishDateTimeFrom": publish_from.isoformat().replace("+00:00", "Z"),
                "publishDateTimeTo": publish_to.isoformat().replace("+00:00", "Z"),
            },
        )

    return _cached(key, load, force_refresh)

"""As-of forecast selection and forecast-versus-outturn metrics."""

from __future__ import annotations

import math
from datetime import date, datetime, time as clock_time, timedelta
from typing import Any

from .elexon import LONDON, UTC, parse_timestamp


def _generation(record: dict[str, Any]) -> float | None:
    try:
        value = float(record.get("generation"))
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def expected_intervals(day: date, resolution_minutes: int = 60) -> int:
    start = datetime.combine(day, clock_time.min, tzinfo=LONDON)
    end = datetime.combine(day + timedelta(days=1), clock_time.min, tzinfo=LONDON)
    return round((end.astimezone(UTC) - start.astimezone(UTC)).total_seconds() / (resolution_minutes * 60))


def _aggregate(rows: list[dict[str, Any]], expected: int) -> dict[str, Any]:
    paired = [row for row in rows if row["actualMW"] is not None and row["forecastMW"] is not None]
    if not paired:
        return {
            "matchedIntervals": 0,
            "expectedIntervals": expected,
            "coveragePercent": 0.0,
            "maeMW": None,
            "rmseMW": None,
            "biasMW": None,
            "wapePercent": None,
        }
    errors = [row["forecastMW"] - row["actualMW"] for row in paired]
    absolute = [abs(error) for error in errors]
    actual_total = sum(abs(row["actualMW"]) for row in paired)
    return {
        "matchedIntervals": len(paired),
        "expectedIntervals": expected,
        "coveragePercent": round(100 * len(paired) / expected, 1) if expected else 0,
        "maeMW": round(sum(absolute) / len(absolute), 1),
        "rmseMW": round(math.sqrt(sum(error * error for error in errors) / len(errors)), 1),
        "biasMW": round(sum(errors) / len(errors), 1),
        "wapePercent": round(100 * sum(absolute) / actual_total, 2) if actual_total else None,
    }


def _date_range(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def build_analysis(
    start: date,
    end: date,
    cutoff: clock_time,
    actual_records: list[dict[str, Any]],
    forecast_records: list[dict[str, Any]],
) -> dict[str, Any]:
    relevant_forecast_starts = [
        parsed
        for record in forecast_records
        if (parsed := parse_timestamp(record.get("startTime"))) is not None
        and start <= parsed.astimezone(LONDON).date() <= end
    ]
    # The January WINDFOR data returned by Elexon has hourly start times. Keep
    # half-hour support if that dataset provides it; never synthesize forecasts.
    comparison_resolution_minutes = (
        30 if any(stamp.minute == 30 for stamp in relevant_forecast_starts) else 60
    )

    actual_by_start: dict[datetime, dict[str, Any]] = {}
    for record in actual_records:
        if str(record.get("fuelType", "")).upper() != "WIND":
            continue
        target = parse_timestamp(record.get("startTime"))
        generation = _generation(record)
        if not target or generation is None or not start <= target.astimezone(LONDON).date() <= end:
            continue
        current = actual_by_start.get(target)
        published = parse_timestamp(record.get("publishTime")) or datetime.min.replace(tzinfo=UTC)
        existing_published = parse_timestamp(current.get("publishTime")) if current else None
        if current is None or existing_published is None or published > existing_published:
            actual_by_start[target] = {"generation": generation, "publishTime": record.get("publishTime")}

    # Keep the newest vintage available at each interval's D-1 decision cutoff.
    forecast_by_start: dict[datetime, dict[str, Any]] = {}
    for record in forecast_records:
        target = parse_timestamp(record.get("startTime"))
        published = parse_timestamp(record.get("publishTime"))
        generation = _generation(record)
        if not target or not published or generation is None:
            continue
        target_day = target.astimezone(LONDON).date()
        if not start <= target_day <= end:
            continue
        cutoff_utc = datetime.combine(
            target_day - timedelta(days=1), cutoff, tzinfo=LONDON
        ).astimezone(UTC)
        if published > cutoff_utc:
            continue
        current = forecast_by_start.get(target)
        if current is None or published > current["_published"]:
            forecast_by_start[target] = {
                "generation": generation,
                "publishTime": record.get("publishTime"),
                "_published": published,
            }

    interval_rows: list[dict[str, Any]] = []
    daily_rows: list[dict[str, Any]] = []
    current_day = start
    while current_day <= end:
        day_start = datetime.combine(current_day, clock_time.min, tzinfo=LONDON).astimezone(UTC)
        next_day_start = datetime.combine(
            current_day + timedelta(days=1), clock_time.min, tzinfo=LONDON
        ).astimezone(UTC)
        day_rows: list[dict[str, Any]] = []
        target = day_start
        while target < next_day_start:
            source_actuals = [
                actual_by_start.get(target + timedelta(minutes=offset))
                for offset in range(0, comparison_resolution_minutes, 30)
            ]
            # Require every underlying half-hour actual before creating an
            # hourly mean; a partial hour is missing data, not a lower value.
            if source_actuals and all(item is not None for item in source_actuals):
                actual = {
                    "generation": sum(item["generation"] for item in source_actuals) / len(source_actuals),
                    "publishTime": max(
                        (item["publishTime"] for item in source_actuals if item["publishTime"]),
                        key=lambda value: parse_timestamp(value) or datetime.min.replace(tzinfo=UTC),
                        default=None,
                    ),
                }
            else:
                actual = None
            forecast = forecast_by_start.get(target)
            actual_mw = actual["generation"] if actual else None
            forecast_mw = forecast["generation"] if forecast else None
            local_target = target.astimezone(LONDON)
            row = {
                "startTime": target.isoformat().replace("+00:00", "Z"),
                "localStartTime": local_target.isoformat(),
                "actualMW": actual_mw,
                "actualPublishTime": actual["publishTime"] if actual else None,
                "forecastMW": forecast_mw,
                "forecastPublishTime": forecast["publishTime"] if forecast else None,
                "errorMW": round(forecast_mw - actual_mw, 1)
                if forecast_mw is not None and actual_mw is not None
                else None,
            }
            day_rows.append(row)
            target += timedelta(minutes=comparison_resolution_minutes)

        daily_metrics = _aggregate(
            day_rows, expected_intervals(current_day, comparison_resolution_minutes)
        )
        used_publications = [
            parse_timestamp(row["forecastPublishTime"])
            for row in day_rows
            if row["forecastPublishTime"]
        ]
        daily_rows.append(
            {
                "deliveryDate": current_day.isoformat(),
                "decisionCutoff": datetime.combine(
                    current_day - timedelta(days=1), cutoff, tzinfo=LONDON
                ).isoformat(),
                "latestForecastPublishTime": max(used_publications).isoformat().replace("+00:00", "Z")
                if used_publications
                else None,
                "forecastIntervals": sum(row["forecastMW"] is not None for row in day_rows),
                "actualIntervals": sum(row["actualMW"] is not None for row in day_rows),
                **daily_metrics,
            }
        )
        interval_rows.extend(day_rows)
        current_day += timedelta(days=1)

    total_expected = sum(
        expected_intervals(day, comparison_resolution_minutes)
        for day in _date_range(start, end)
    )
    return {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "decisionCutoffLocalTime": cutoff.strftime("%H:%M"),
        "timezone": "Europe/London",
        "units": "MW",
        "actualResolutionMinutes": 30,
        "forecastResolutionMinutes": comparison_resolution_minutes,
        "comparisonResolutionMinutes": comparison_resolution_minutes,
        "actualAggregation": "mean of two half-hour FUELHH readings per hour"
        if comparison_resolution_minutes == 60
        else "one half-hour FUELHH reading per half-hour forecast",
        "forecastLookbackDays": 7,
        "metrics": _aggregate(interval_rows, total_expected),
        "daily": daily_rows,
        "intervals": interval_rows,
        "sources": {
            "actuals": "Elexon Insights FUELHH (fuelType=WIND)",
            "forecasts": "Elexon Insights WINDFOR, selected by publishTime as of decision cutoff",
        },
    }

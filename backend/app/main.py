from __future__ import annotations

from datetime import date, datetime, time as clock_time, timedelta, timezone
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .analysis import build_analysis
from .elexon import ElexonError, fetch_actuals, fetch_forecasts

JANUARY_START = date(2026, 1, 1)
JANUARY_END = date(2026, 1, 31)

app = FastAPI(
    title="Wind Forecast Monitor API",
    description="Historical Elexon national wind analysis for decisions made 1–31 January 2026; each decision is compared with next-day delivery using the forecast available by its cutoff.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "dataSource": "Elexon Insights public API"}


@app.get("/api/analysis")
def analysis(
    start: Annotated[date, Query()] = JANUARY_START,
    end: Annotated[date, Query()] = JANUARY_END,
    cutoff: Annotated[str, Query(pattern=r"^\d{2}:\d{2}$")] = "09:50",
    refresh: bool = False,
) -> dict:
    if start < JANUARY_START or end > JANUARY_END or start > end:
        raise HTTPException(status_code=422, detail="Choose decision dates within January 2026, with start before end.")
    try:
        cutoff_time = clock_time.fromisoformat(cutoff)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="cutoff must be a valid HH:MM time.") from exc
    delivery_start = start + timedelta(days=1)
    delivery_end = end + timedelta(days=1)
    try:
        actuals = fetch_actuals(delivery_start, delivery_end, force_refresh=refresh)
        forecasts = fetch_forecasts(delivery_start, delivery_end, cutoff_time, force_refresh=refresh)
    except ElexonError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    result = build_analysis(start, end, cutoff_time, actuals, forecasts)
    result["generatedAt"] = datetime.now(timezone.utc).isoformat()
    return result

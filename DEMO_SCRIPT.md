# Windwise · two-part demo script

**Runtime:** 3 minutes 15 seconds. Part 1 runs about 1:41; Part 2 about 1:35. Both are under five minutes, and the full video is under ten minutes.

**Data snapshot:** Elexon retrieval on 25 October 2026. Historical values may change upstream.

**Narration:** synthetic English (UK) neural voice. OpenAI Codex helped prepare the product and demo; this is disclosed in the README and video description.

## Part 1 · Client overview (0:00–1:41)

### 0:00–0:38 · Product and measured outcome

**On screen:** Dashboard overview with the five KPI cards and monthly error chart.

**Narration:** Windwise is a pilot monitor for a UK utility's day-ahead buying team. It shows the national wind forecast available at the decision cutoff and measures it against Elexon outturn. In the 25 October 2026 retrieval, all 744 expected hours are matched. MAE is 2,013 MW, RMSE is 2,505.9 MW, WAPE is 17.84%, and bias is +1,729.9 MW. The forecast ran high on average.

### 0:38–1:04 · January decision window

**On screen:** January 1 decision detail; point to the January 2 delivery date, cutoff, newest included forecast, and publication timestamps.

**Narration:** Decisions from January 1 through January 31 map to delivery on the next calendar day. For the January 1 decision, the selected forecast was published at 09:30, before the 09:50 UK cutoff. The market was not specified, so the N2EX-based cutoff is editable.

### 1:04–1:20 · Month-end boundary

**On screen:** January 31 decision detail showing February 1 delivery.

**Narration:** The January 31 decision is checked against February 1 delivery. The day view carries the month boundary explicitly and uses only forecast vintages published by the cutoff.

### 1:20–1:41 · Scope

**On screen:** Pilot boundary card comparing Elexon wind evidence with the additional data needed for a purchase quantity.

**Narration:** The measured scope is Elexon's national wind forecast and actuals. Demand, contracts, plant availability, interconnector position, and portfolio exposure are not in these datasets, so Windwise does not invent a trade quantity.

## Part 2 · Technical review (1:41–3:15)

### 1:41–1:59 · Architecture

**On screen:** React/Vite → FastAPI → Elexon diagram and Docker Compose note.

**Narration:** React with Vite calls a Python FastAPI service. The service retrieves FUELHH and WINDFOR and caches responses for ten minutes. Docker Compose starts the frontend and backend together.

### 1:59–2:18 · API date mapping

**On screen:** `backend/app/main.py`, highlighting January validation and the `+1 day` delivery range.

**Narration:** The API accepts only January decision dates, maps them to the next day's delivery dates, and fetches actuals and forecasts for that range. WINDFOR uses publication-time history with a seven-day lookback.

### 2:18–2:36 · As-of selection

**On screen:** `backend/app/analysis.py`, highlighting the cutoff filter and latest eligible publication selection.

**Narration:** For each delivery interval, the analysis calculates the cutoff in Europe/London, discards later publications, and selects the most recent eligible forecast. That prevents an archived later run from leaking into the decision snapshot.

### 2:36–2:56 · Resolution and metrics

**On screen:** `_aggregate` code and the matched-pair rules.

**Narration:** WINDFOR is hourly; FUELHH is half-hourly. Windwise averages both actual readings for each forecast hour and leaves incomplete pairs missing. MAE, RMSE, WAPE, signed bias, and coverage use matched intervals only.

### 2:56–3:15 · Checks and handover

**On screen:** Unit-check list, repository map, and Docker start command.

**Narration:** Unit checks cover the cutoff boundary, WIND filtering, hourly aggregation, missing values, and the January 31 to February 1 mapping. Run the pilot with Docker Compose. Hosting was skipped; the README documents setup and AI assistance.

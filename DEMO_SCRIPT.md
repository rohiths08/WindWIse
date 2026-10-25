# Windwise · two-part demo script

**Runtime:** 5:07 as shown on YouTube (307.8 seconds in the encoded file), under the 10-minute limit. Part 1: 2:36; Part 2: 2:32.

**Data snapshot:** Elexon API retrieval on 25 October 2026. Historical values can change upstream.

**Video format:** narrated slide walkthrough with a captured view of the running dashboard. AI assistance and synthetic voice are disclosed in the repository README.

## Part 1 · Client overview (0:00–2:36)

### Slide 1 · Product and user

Part one, the client overview. Windwise is a pilot for the UK utility team that buys power day ahead. It shows the national wind forecast available at the decision point and measures it against Elexon outturn for January 2026. The app answers what the wind forecast said and how it performed. It does not claim to calculate the utility’s residual procurement volume.

### Slide 2 · Decision cutoff

The decision clock matters. The dashboard defaults to a 09:50 UK local cutoff on the day before delivery, following published N2EX guidance. The brief did not name a specific auction or desk cutoff, so this is a working assumption and the time is editable. A forecast published by that cutoff may be selected. A forecast arriving later is excluded, even if it is visible in the archive today.

### Slide 3 · Live monthly dashboard

This is the running dashboard, using live Elexon records retrieved on the twenty-fifth of October 2026. The snapshot contains 744 paired hourly comparisons across all 31 January delivery days. Mean absolute error is 2,122.8 megawatts. Root mean square error is 2,616.7 megawatts, weighted absolute percentage error is 18.33 percent, and coverage is 100 percent. Historical source records can be revised, so the retrieval date is part of the result.

### Slide 4 · Daily accuracy and forecast vintage

The daily chart helps find dates with higher error. Selecting a point opens the day-level detail. For the first of January, daily mean absolute error is 4,258.2 megawatts across 24 paired hours. The latest forecast publication represented for that day is 09:30 Zulu on December thirty-first, before the 09:50 UK cutoff. The interval table exposes each selected publication timestamp.

### Slide 5 · Scope boundary

The product boundary is deliberate. A wind forecast is one input into a portfolio view. To calculate a purchase quantity, the team would also need demand, contracted generation, plant availability and portfolio position. Those inputs are outside the two scoped Elexon datasets. The app therefore supports the assessment without inventing a trade recommendation.

## Part 2 · Technical review (2:36–5:08)

### Slide 6 · Architecture

Part two, the technical review. The browser app is React and Vite. It calls a Python FastAPI service, which retrieves FUELHH and WINDFOR from Elexon’s public Insights API and caches responses in memory for ten minutes. Docker Compose starts the frontend and backend together. The API serves the selected data, metrics and interval-level forecast publication times.

### Slide 7 · As-of forecast rule

For each forecast target hour, the backend filters records to those published at or before the previous-day cutoff and chooses the latest publication time among them. In this example, the 09:30 vintage is eligible, while the 10:15 vintage is too late. The decision time is calculated in the Europe London time zone and converted for timestamp comparison, so the implementation does not assume a permanent UTC offset.

### Slide 8 · Resolution alignment

The January WINDFOR target points are hourly. FUELHH actual wind values are half-hourly. The comparison uses the average of both half-hour actuals within each forecast hour. If either actual reading is absent, that hourly actual is missing and the interval is not scored. The app does not create synthetic half-hour forecasts or replace gaps with zero.

### Slide 9 · Metrics and coverage

The service reports mean absolute error, root mean square error, weighted absolute percentage error, signed bias and coverage. Bias is forecast minus actual, so a positive value means the forecast was high on average. The displayed coverage is 744 paired values out of 744 expected hourly points for this snapshot. Each accuracy score uses only intervals that have both a forecast available at the cutoff and an actual.

### Slide 10 · Checks and extensions

The unit checks cover the cutoff boundary, later vintages, WIND filtering, hourly actual averaging, missing values and interval counts. The main extension points are confirming the desk’s exact cutoff, adding demand and portfolio data, and persisting forecast snapshots for an operational audit trail. The README describes the data sources, assumptions, local setup, deployment configuration and AI assistance. That concludes the client walkthrough and technical handover.

# Windwise · UK Wind Forecast Monitor

Windwise is a React and Python pilot dashboard for reviewing Elexon national wind forecasts against actual generation. It focuses on the forecast vintage available at the previous-day decision cutoff for each January 2026 delivery interval.

**Two-part demo video (unlisted, 5:07):** [Watch the product and technical walkthrough](https://youtu.be/Cr0m-9wPOUU).

## What it answers

- What wind generation forecast was available for each target hour when the day-ahead decision was due?
- How closely did that forecast match Elexon's later wind outturn?
- How complete is the forecast/actual comparison for each delivery day?

The app uses Elexon's FUELHH actual generation records filtered to `fuelType=WIND` and WINDFOR forecast records. It selects a forecast by `startTime`, keeping the record with the greatest `publishTime` at or before the decision cutoff for that delivery interval. Forecasts published after the cutoff are excluded. January WINDFOR records have hourly target times while FUELHH outturn is half-hourly, so each comparison uses the average of the two actual half-hour readings for that hour. The app does not synthesize half-hour forecasts. Missing hourly actuals stay missing and are not treated as zero.

The default cutoff is 09:50 UK local time on D−1, based on Nord Pool's published N2EX GB day-ahead auction guidance. The market was not specified in the brief, so this is an explicit working assumption; change the time control in the dashboard to inspect another decision point. January is on GMT, but the application uses the `Europe/London` time zone so delivery-day and clock changes are handled correctly.

This is a wind-side forecast monitor, not a full procurement recommendation. The scoped datasets do not contain consumer demand, the utility's contracted generation, interconnector position, or portfolio exposure, so the app does not invent a residual purchase quantity or trading instruction.

## Measures

- **MAE (MW):** mean absolute forecast error across matched hourly points.
- **RMSE (MW):** square root of mean squared error; larger misses count more.
- **WAPE (%):** sum of absolute errors divided by the sum of absolute actual wind generation across matched hourly points.
- **Coverage (%):** matched forecast-and-actual hourly points divided by expected hours in the selected period.
- **Bias (MW):** average forecast minus actual; positive means the forecast was high. Returned by the API for analysis.

No score is shown for an interval without both a forecast available by the cutoff and an actual. Coverage is displayed beside error metrics for that reason.

The live API snapshot retrieved on **25 October 2026** contains 744 of 744 matched hourly points (100% coverage): MAE 2,122.8 MW, RMSE 2,616.7 MW, WAPE 18.33%, and signed bias +1,840.3 MW. Elexon may revise historical records, so these values describe that retrieval and can change on refresh.

## Data and assumptions

- **Actuals:** [Elexon FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream), filtered to WIND and the January 2026 settlement dates.
- **Forecasts:** [Elexon WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream), queried by publication time to recover historical vintages.
- **API base:** `https://data.elexon.co.uk/bmrs/api/v1`. Elexon's developer portal says its public APIs require no API key. The server fetches data on request and caches each response in memory for ten minutes.
- **Delivery month:** 1–31 January 2026, interpreted as delivery dates in `Europe/London`. FUELHH supplies 48 half-hour values per winter day; WINDFOR target points are hourly in the retrieved January data. Metrics compare hourly wind forecasts with hourly actual means (24 points per day).
- **Decision cutoff:** 09:50 Europe/London on the preceding day by default, following Nord Pool's published N2EX guidance. The specific market/cutoff is configurable. Forecast inclusion is based strictly on `publishTime <= cutoff`.
- **Forecast lookback:** the API request begins seven days before the first delivery date to include the forward forecast horizon; the selection rule still uses each delivery day's cutoff.
- **Outturn vintage:** the latest FUELHH values currently returned by Elexon are used for evaluation. They are actuals, not values assumed to have been known at the day-ahead cutoff.
- **Scope limit:** no demand, prices, thermal availability, contracts, or other fuel types are used to produce procurement advice.

Elexon's developer portal documents the public API, historical publication-time retrieval, and the applicable data licence terms: [Insights Developer Portal](https://developer.data.elexon.co.uk/). Elexon data is attributed to Elexon Insights in the app and must remain subject to its data licence terms.

## Run with Docker

Requirements: Docker Engine with the Compose plugin.

```bash
docker compose up --build
```

Open <http://localhost:5173>. The API is also available at <http://localhost:8000/api/health> and the interactive API reference at <http://localhost:8000/docs>.

Stop the services with `Ctrl+C`; run `docker compose down` to remove the containers.

## Run without Docker

Backend, from `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend, from `frontend/` in another terminal:

```bash
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8000` by default. Set `VITE_API_PROXY_TARGET` to change the proxy target.

## Tests and build

The small unit suite exercises the cutoff selection rule, WIND-only actual filtering, half-hour-to-hour actual averaging, missing-data handling, and hourly/half-hour interval counts:

```bash
cd backend
python -m unittest discover -s tests -v
```

Build the frontend with `cd frontend && npm install && npm run build`.

## Deploy

The repository includes a Vercel FastAPI entry point and a build command that copies the Vite output into `public/` for static delivery. Vercel serves the React page and routes the API through FastAPI. From the repository root, run `vercel` and follow the prompts. Hosting was skipped at the user’s request. No deployment URL was created. The Vercel CLI was not authenticated, and the anonymous deployment attempt failed before creating a site. To deploy later, sign in to Vercel and run `vercel --prod` from the repository root.

## Directory guide

```text
app.py                       Vercel FastAPI entry point
backend/
  app/elexon.py               Elexon HTTP client and short-lived response cache
  app/analysis.py             As-of forecast selection, time-zone handling, and metrics
  app/main.py                 FastAPI endpoints and January range validation
  tests/test_analysis.py      Unit checks for the forecast cutoff and accuracy behavior
  Dockerfile                  Python API container
  requirements.txt            Python dependencies
frontend/
  src/main.jsx                React dashboard, charts, controls, and interval table
  src/styles.css              Responsive dashboard styling
  index.html                  Browser entry document and metadata
  vite.config.js              Development server and API proxy
  Dockerfile                  React/Vite container
docker-compose.yml            Local two-service Docker setup
vercel.json                   Vercel FastAPI runtime configuration
package.json                  Root deployment build command
pyproject.toml                Hosted Python project metadata
requirements.txt              Root Python dependency entry for Vercel
uv.lock                       Resolved hosted Python dependency versions
DEMO_SCRIPT.md                Two-part, under-10-minute video walkthrough
```

## AI assistance

OpenAI Codex was used to research the Elexon API, implement the application, tests and documentation, and prepare the demo script. The video narration uses a generic English (UK) synthetic voice generated with eSpeak NG. The as-of forecast selection and metric definitions are documented above and covered by unit checks.

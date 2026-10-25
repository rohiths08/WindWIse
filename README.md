# Windwise · UK Day-Ahead Wind Forecast Monitor

Windwise is a React and Python pilot for the UK utility team making day-ahead power buying decisions. It focuses on national wind generation using only Elexon WINDFOR forecasts and FUELHH `WIND` actuals.

**Two-part demo:** A revised 3:15 video is prepared locally but is not published. No YouTube URL is available; the previous video link refers to an earlier version and should not be submitted.

## What the pilot answers

- What national wind forecast was available by the selected cutoff for each buying decision?
- How did that forecast compare with the later Elexon wind outturn?
- How complete is each comparison, and where were forecast errors larger?

The dashboard opens with a selected decision snapshot, its next-day delivery, cutoff, latest eligible forecast publication, daily error, and paired-hour coverage. Use the date selector, previous/next controls, or the month chart to inspect another day. Export either the selected day or the full January interval set as CSV. Metric explanations and replay assumptions are available in expandable sections.

The brief asks for **decisions made in January 2026**. Windwise therefore evaluates decision dates from **1–31 January 2026**, with each day’s forecast checked against the **next day’s delivery** (2 January–1 February). The decision date and delivery date are shown separately in the dashboard and API.

For each delivery hour, Windwise selects the WINDFOR record with the greatest `publishTime` at or before the configured decision cutoff. Records published after the cutoff are excluded, even if they are now visible in Elexon’s historical archive. The default cutoff is **09:50 Europe/London on the decision date**, based on Nord Pool’s published N2EX GB day-ahead auction guidance. The brief did not identify a specific auction or trading desk, so this is a documented, editable assumption rather than a universal UK market deadline.

January WINDFOR target points are hourly in the retrieved data; FUELHH actuals are half-hourly. Each forecast hour is compared with the mean of its two half-hour actuals. Missing pairs remain missing and do not count as zero or enter the error metrics. The app displays coverage beside the scores.

This is a wind forecast monitor, not a procurement recommendation. The scoped datasets do not include consumer demand, the utility’s contracted generation, plant availability, interconnector position, or portfolio exposure. The app does not invent a residual purchase quantity or trade instruction.

## Accuracy measures

- **MAE (MW):** average absolute difference between forecast and actual.
- **RMSE (MW):** square root of mean squared error; larger misses count more.
- **WAPE (%):** total absolute error divided by total absolute actual wind generation.
- **Bias (MW):** average forecast minus actual; positive means the forecast ran high.
- **Coverage (%):** matched forecast-and-actual hourly points divided by expected hours.

The live Elexon retrieval on **25 October 2026** returned 744 matched hourly points out of 744 expected (100% coverage): **MAE 2,013.0 MW, RMSE 2,505.9 MW, WAPE 17.84%, and bias +1,729.9 MW**. These numbers describe that retrieval; Elexon may revise historical records, and a refresh may change the results.

## Data and assumptions

- **Actual generation:** [Elexon FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream), filtered to `fuelType=WIND`, queried for settlement dates 2 January–1 February 2026.
- **Forecast generation:** [Elexon WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream), queried by publication time to recover forecast vintages available by each January decision cutoff.
- **API base:** `https://data.elexon.co.uk/bmrs/api/v1`. The public Elexon API does not require an API key. Responses are cached in memory for ten minutes.
- **Decision period:** 1–31 January 2026, interpreted as decision dates in `Europe/London`; delivery targets run 2 January–1 February.
- **Decision cutoff:** 09:50 Europe/London on the decision date, following the published N2EX guidance. The cutoff is configurable in the dashboard.
- **Forecast lookback:** seven days before the first delivery date to capture the forward forecast horizon. The selection rule still applies each target hour’s own decision cutoff.
- **Outturn vintage:** the latest FUELHH values currently returned by Elexon are used to evaluate forecasts. They are not treated as data known at the buying decision.
- **Scope:** no demand, prices, thermal availability, contracts, or other fuel types are used to produce procurement advice.

Elexon’s [Insights Developer Portal](https://developer.data.elexon.co.uk/) documents the public API and data licence terms. Elexon data is attributed in the app and remains subject to those terms.

## Start with Docker

Requirements: Docker Engine with the Compose plugin.

```bash
docker compose up --build
```

Open <http://localhost:5173>. The API health endpoint is <http://localhost:8000/api/health> and the interactive API reference is <http://localhost:8000/docs>.

Stop the services with `Ctrl+C`; run `docker compose down` to remove the containers.

## Start without Docker

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

## Checks

The backend unit suite covers the as-of cutoff rule, WIND-only actual filtering, averaging half-hour outturn into an hourly actual, missing-data handling, the 24-hour daily interval count, and the January 31 decision mapping to February 1 delivery.

```bash
cd backend
python -m unittest discover -s tests -v
```

Build the frontend with `cd frontend && npm install && npm run build`.

## Repository and hosting

Public repository: [github.com/rohiths08/WindWIse](https://github.com/rohiths08/WindWIse).

**Hosted app:** no deployment URL is available. Hosting was skipped at the user’s request, so the Vercel/Heroku deployment requirement is currently outstanding. The repository retains Vercel configuration as a starting point for a later deployment.

The repository name `WindWIse` was selected explicitly by the user. It no longer uses the anonymous random-string naming requested in the original brief.

## Directory guide

```text
app.py                        Vercel FastAPI entry point
backend/
  app/elexon.py                Elexon HTTP client and ten-minute response cache
  app/analysis.py              decision cutoff selection, time zones, and accuracy metrics
  app/main.py                  FastAPI endpoints and January decision-date validation
  tests/test_analysis.py       unit tests for forecast selection and metric behavior
  Dockerfile                   Python API container
  requirements.txt             Python dependencies
frontend/
  src/main.jsx                 decision snapshot, date navigation, CSV exports, charts, metrics, and interval audit
  src/styles.css               responsive dashboard styling and keyboard focus states
  index.html                   browser entry page and metadata
  vite.config.js               development server and API proxy
  Dockerfile                   React/Vite container
docker-compose.yml             local frontend and backend services
vercel.json                    Vercel routing/runtime configuration
package.json                   root deployment build command
pyproject.toml                 hosted Python project metadata
requirements.txt               root Python dependencies for hosting
uv.lock                        resolved hosted Python dependency versions
DEMO_SCRIPT.md                 two-part video script and timing
```

## AI assistance

OpenAI Codex was used to research the Elexon API and market context, implement the application, analysis, tests and documentation, and prepare the demo. The submitted video uses a synthetic English (UK) voice generated with Microsoft Edge TTS; the narration is computer-generated, not a human recording.

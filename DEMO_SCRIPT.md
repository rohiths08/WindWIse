# Windwise · screen-recording guide and demo script

**Target runtime:** about 6 minutes. Part 1 is about 2:55 and Part 2 about 3:00; each stays below 5 minutes and the full demo stays below 10 minutes.

**Data note:** The example scores below came from the Elexon retrieval on 25 October 2026. Elexon can revise historical data, so quote the figures as a dated snapshot.

## Before recording

1. Start the app with `docker compose up --build` from the repository folder. Open `http://localhost:5173` in a maximized, regular browser window. Wait until the page says **Historical replay ready**.
2. Set the cutoff to **09:50**, return to **Home**, and make sure the featured January 1 decision is visible. Close unrelated tabs and notifications. For the technical part, have the repository open in an editor with the files listed below ready.
3. In OBS Studio, add a **Display Capture** or **Window Capture** source for the browser/editor and select the microphone you want to use. Check the audio meters and make a short test recording first. OBS recommends testing the recording and verifying the selected audio devices in its [Quick Start Guide](https://obsproject.com/kb/quick-start-guide).
4. Start recording, pause for two seconds, then begin speaking. Move the pointer slowly and pause briefly after each page change so the viewer can read the screen.
5. Record locally. MKV is safer if recording is interrupted; OBS can remux it to MP4 with **File → Remux Recordings** when you need an MP4 copy. See OBS’s [recording output guide](https://obsproject.com/kb/standard-recording-output-guide).

## Part 1 · Customer overview (0:00–2:55)

### 0:00–0:35 · Home

**Show:** Home hero, cutoff card, January summary cards, and featured decision.

**Say:** “This is Windwise, a pilot monitor for a UK utility’s day-ahead buying team. It answers two questions: which national wind forecast was available when a decision was made, and how did that forecast compare with the generation that actually followed? This replay covers the 31 decision dates in January 2026. Each decision is compared with the next day’s delivery, so the delivery window runs from 2 January through 1 February. The default cutoff is 09:50 UK local time and can be changed.”

### 0:35–1:15 · Decisions

**Show:** Click **Decisions**. Keep 1 January selected; point to the delivery date, 09:50 cutoff, eligible publication time, comparison chart, and interval table.

**Say:** “Here is the 1 January decision and its 2 January delivery. The newest forecast published by the cutoff was issued at 09:30, so it was available twenty minutes before the decision cutoff. The chart and table compare that forecast with the actual outturn hour by hour. A positive error means the forecast was higher than actual generation. I can also export the selected day or the month as CSV.”

### 1:15–2:05 · Accuracy

**Show:** Click **Accuracy**. Point across the five score cards, then trace the daily MAE chart.

**Say:** “The monthly view scores matched hourly intervals only. In the 25 October retrieval, coverage was 744 of 744 hours. MAE was 2,013 megawatts; RMSE was 2,505.9 megawatts; WAPE was 17.84 percent; and bias was plus 1,729.9 megawatts, meaning the forecast ran high on average. The daily chart helps the desk see which decisions had larger errors. These figures are a dated snapshot and can change if Elexon revises its archive.”

### 2:05–2:30 · Month-end

**Show:** Select the 31 January point on the daily chart. The app opens that decision in **Decisions**; point to 1 February delivery.

**Say:** “The final January decision maps to 1 February delivery. Showing that boundary explicitly avoids accidentally dropping the final next-day delivery from the analysis.”

### 2:30–2:55 · Scope

**Show:** Click **Method**. Point to the decision-to-forecast-to-delivery flow and the scope boundary.

**Say:** “This pilot uses only Elexon national wind forecasts and wind actuals. The data does not include consumer demand, contracts, plant availability, or the utility’s wider portfolio, so Windwise reports forecast evidence and accuracy rather than inventing a purchase quantity.”

## Part 2 · Technical review (2:55–5:55)

### 2:55–3:20 · Architecture

**Show:** On **Method**, point to the flow and implementation section, then switch to the public repository.

**Say:** “The frontend is React with Vite. It calls a Python FastAPI backend, which retrieves Elexon data and performs the as-of selection and scoring. Docker Compose starts the frontend and backend together. The four pages share the selected decision date and cutoff.”

### 3:20–3:50 · API and data retrieval

**Show:** In the repo, open `backend/app/main.py`, then `backend/app/elexon.py`.

**Say:** “The API validates January decision dates and maps each one to the next day’s delivery window. The Elexon client fetches FUELHH actuals filtered to WIND and WINDFOR forecast records by publication time. Responses are cached in memory for ten minutes.”

### 3:50–4:30 · As-of forecast selection

**Show:** Open `backend/app/analysis.py`; point to the cutoff construction and the latest eligible publish-time selection.

**Say:** “For each delivery interval, the analysis calculates the decision cutoff in Europe/London and discards forecasts published after it. Among the remaining records, it selects the latest publish time. That prevents a later forecast visible in today’s archive from leaking into what the desk is meant to have known.”

### 4:30–5:00 · Resolution and scoring

**Show:** Point to the actual aggregation and metric calculations in `analysis.py`, then briefly show the score definitions in the Accuracy page or README.

**Say:** “WINDFOR is hourly, while FUELHH is half-hourly. The two actual readings are averaged for each forecast hour. If the pair is incomplete, it stays missing rather than being treated as zero. MAE, RMSE, WAPE, bias, and coverage are calculated from matched forecast and actual hours.”

### 5:00–5:30 · Quality and handover

**Show:** Open `backend/tests/test_analysis.py`, then the README’s Docker setup and directory guide.

**Say:** “The included backend checks cover the cutoff rule, WIND filtering, half-hour aggregation, missing values, and the 1 January to 1 February boundary. The README explains the files, assumptions, and how to start the services with `docker compose up --build`.”

### 5:30–5:55 · Close

**Show:** Return to the Method page or repository README.

**Say:** “OpenAI Codex assisted with the research, implementation, checks, and documentation; that use is disclosed in the README. Hosting was skipped at my request, so this handover uses the local Docker app and public repository. Thank you.”

## Recording notes

- Keep the cursor away from figures while speaking, and do not rush the page changes.
- If the data is still loading, wait before recording. If a score changes after refresh, use the value currently shown and read the retrieval date on screen.
- This demo is intended to remain local unless you later choose to publish it.

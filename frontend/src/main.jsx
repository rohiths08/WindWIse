import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const monthStart = '2026-01-01'
const monthEnd = '2026-01-31'
const nf = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

function fmt(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return (digits === 0 ? nf : oneDecimal).format(Number(value))
}

function dateLabel(value, options = { day: '2-digit', month: 'short' }) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', options).format(new Date(`${value}T12:00:00Z`))
}

function timeLabel(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(value))
}

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  if (name === 'wind') return <svg {...common}><path d="M3 8h11.5a3 3 0 1 0-2.8-4"/><path d="M2 12h16a3 3 0 1 1-2.8 4"/><path d="M4 16h7a2.5 2.5 0 1 1-2.4 3"/></svg>
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  if (name === 'check') return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>
  if (name === 'refresh') return <svg {...common}><path d="M20 7v5h-5"/><path d="M4.7 9A8 8 0 0 1 18.5 6L20 12M4 17v-5h5"/><path d="M19.3 15A8 8 0 0 1 5.5 18L4 12"/></svg>
  if (name === 'arrow') return <svg {...common}><path d="M7 17 17 7M7 7h10v10"/></svg>
  if (name === 'download') return <svg {...common}><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>
}

function MetricCard({ label, value, suffix, note, icon, tone = '', tooltip }) {
  return <article className={`metric-card ${tone}`}>
    <div className="metric-top"><span title={tooltip} aria-label={tooltip ? `${label}. ${tooltip}` : undefined}>{label}<span className="metric-help" aria-hidden="true">ⓘ</span></span><span className="metric-icon"><Icon name={icon} /></span></div>
    <div className="metric-value">{value}<small>{suffix}</small></div>
    <div className="metric-note">{note}</div>
  </article>
}

function DailyErrorChart({ days, selectedDate, onSelect }) {
  const width = 760, height = 220, pad = { left: 42, right: 16, top: 16, bottom: 32 }
  const values = days.map(day => day.maeMW).filter(value => value !== null)
  const ceiling = Math.max(...values, 1) * 1.15
  const xAt = index => pad.left + index / Math.max(days.length - 1, 1) * (width - pad.left - pad.right)
  const yAt = value => height - pad.bottom - (value / ceiling) * (height - pad.top - pad.bottom)
  let started = false
  const path = days.map((day, index) => {
    if (day.maeMW === null) { started = false; return '' }
    const command = started ? 'L' : 'M'
    started = true
    return `${command}${xAt(index)},${yAt(day.maeMW)}`
  }).join(' ')
  const ticks = [0, ceiling / 2, ceiling]
  return <div className="chart-frame">
    <svg className="daily-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily mean absolute forecast error in megawatts">
      {ticks.map((tick, i) => <g key={i}><line x1={pad.left} x2={width - pad.right} y1={yAt(tick)} y2={yAt(tick)} className="grid-line"/><text x={pad.left - 8} y={yAt(tick) + 4} textAnchor="end" className="axis-label">{Math.round(tick / 1000)}k</text></g>)}
      <path d={path} className="daily-line" />
      {days.map((day, index) => day.maeMW === null ? null : <g key={day.decisionDate} className="chart-point" onClick={() => onSelect(day.decisionDate)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(day.decisionDate) } }} tabIndex="0" role="button" aria-label={`${dateLabel(day.decisionDate)}, MAE ${fmt(day.maeMW)} megawatts`}>
        <circle cx={xAt(index)} cy={yAt(day.maeMW)} r={day.decisionDate === selectedDate ? 5.5 : 3.5} className={day.decisionDate === selectedDate ? 'point-selected' : 'point'}/>
        <title>{dateLabel(day.decisionDate, { day: 'numeric', month: 'long' })} decision → {dateLabel(day.deliveryDate, { day: 'numeric', month: 'long' })} delivery: {fmt(day.maeMW)} MW MAE · {day.matchedIntervals}/{day.expectedIntervals} intervals</title>
      </g>)}
      {[0, 7, 14, 21, 28, days.length - 1].filter((v, i, arr) => arr.indexOf(v) === i && days[v]).map(index => <text key={index} x={xAt(index)} y={height - 8} textAnchor="middle" className="axis-label">{dateLabel(days[index].decisionDate)}</text>)}
    </svg>
  </div>
}

function ComparisonChart({ rows }) {
  const width = 900, height = 270, pad = { left: 58, right: 20, top: 16, bottom: 38 }
  const values = rows.flatMap(row => [row.actualMW, row.forecastMW]).filter(Number.isFinite)
  if (!values.length) return <div className="empty-chart">No matched forecast and actual intervals for this delivery day.</div>
  const min = Math.min(...values, 0), max = Math.max(...values, 1), span = Math.max(max - min, 1)
  const xAt = index => pad.left + index / Math.max(rows.length - 1, 1) * (width - pad.left - pad.right)
  const yAt = value => height - pad.bottom - (value - min) / span * (height - pad.top - pad.bottom)
  const line = key => {
    let started = false
    return rows.map((row, index) => {
      const value = row[key]
      if (!Number.isFinite(value)) { started = false; return '' }
      const command = started ? 'L' : 'M'
      started = true
      return `${command}${xAt(index)},${yAt(value)}`
    }).join(' ')
  }
  const tickValues = [min, min + span / 2, max]
  return <div className="chart-frame comparison-frame">
    <svg className="comparison-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Wind forecast compared with actual generation in megawatts">
      {tickValues.map((tick, i) => <g key={i}><line x1={pad.left} x2={width - pad.right} y1={yAt(tick)} y2={yAt(tick)} className="grid-line"/><text x={pad.left - 9} y={yAt(tick) + 4} textAnchor="end" className="axis-label">{Math.round(tick / 1000)}k</text></g>)}
      <path d={line('actualMW')} className="actual-line"/><path d={line('forecastMW')} className="forecast-line"/>
      {[0, 12, 24, 36, 47].filter(index => index < rows.length).map(index => <text key={index} x={xAt(index)} y={height - 10} textAnchor="middle" className="axis-label">{timeLabel(rows[index].startTime)}</text>)}
      {rows.map((row, index) => row.forecastMW === null ? null : <circle key={row.startTime} cx={xAt(index)} cy={yAt(row.forecastMW)} r="2" className="forecast-dot"><title>{timeLabel(row.startTime)} · forecast {fmt(row.forecastMW)} MW · actual {fmt(row.actualMW)} MW · published {timeLabel(row.forecastPublishTime)}</title></circle>)}
    </svg>
  </div>
}

const pageIds = ['home', 'decisions', 'accuracy', 'method']
const navItems = [
  ['home', 'Home'],
  ['decisions', 'Decisions'],
  ['accuracy', 'Accuracy'],
  ['method', 'Method'],
]

function pageFromHash() {
  const requested = window.location.hash.slice(1)
  return pageIds.includes(requested) ? requested : 'home'
}

function PageIntro({ kicker, title, description, children }) {
  return <section className="page-intro">
    <div><div className="section-kicker">{kicker}</div><h1>{title}</h1><p>{description}</p></div>
    {children && <div className="page-intro-side">{children}</div>}
  </section>
}

function App() {
  const [page, setPage] = useState(pageFromHash)
  const [cutoff, setCutoff] = useState('09:50')
  const [cutoffInput, setCutoffInput] = useState('09:50')
  const [cutoffInputError, setCutoffInputError] = useState('')
  const [selectedDate, setSelectedDate] = useState('2026-01-01')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  function updateCutoffInput(value) {
    setCutoffInput(value)
    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      setCutoff(value)
      setCutoffInputError('')
    } else {
      setCutoffInputError('Enter a valid 24-hour time in HH:MM format.')
    }
  }

  async function load({ refresh = false, signal } = {}) {
    setError('')
    refresh ? setRefreshing(true) : setLoading(true)
    try {
      const query = new URLSearchParams({ start: monthStart, end: monthEnd, cutoff })
      if (refresh) query.set('refresh', 'true')
      const response = await fetch(`/api/analysis?${query}`, { signal })
      const body = await response.json()
      if (!response.ok) throw new Error(body.detail || `Request failed (${response.status})`)
      setData(body)
      if (body.daily?.length && !body.daily.some(day => day.decisionDate === selectedDate && day.matchedIntervals)) {
        const firstWithData = body.daily.find(day => day.matchedIntervals > 0)
        if (firstWithData) setSelectedDate(firstWithData.decisionDate)
      }
    } catch (caught) {
      if (caught.name !== 'AbortError') setError(caught.message || 'Could not load Elexon data.')
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    load({ signal: controller.signal })
    return () => controller.abort()
  }, [cutoff])

  useEffect(() => {
    if (!pageIds.includes(window.location.hash.slice(1))) window.history.replaceState(null, '', '#home')
    function syncPage() {
      const route = pageFromHash()
      if (!pageIds.includes(window.location.hash.slice(1))) window.history.replaceState(null, '', '#home')
      setPage(route)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('hashchange', syncPage)
    return () => window.removeEventListener('hashchange', syncPage)
  }, [])

  const selected = useMemo(() => data?.daily?.find(day => day.decisionDate === selectedDate), [data, selectedDate])
  const selectedRows = useMemo(() => data?.intervals?.filter(row => row.localStartTime?.slice(0, 10) === selected?.deliveryDate) || [], [data, selected])
  const datesWithData = data?.daily?.filter(day => day.matchedIntervals > 0).length || 0
  const recentPublish = selected?.latestForecastPublishTime
  const latestGenerated = data?.generatedAt ? new Date(data.generatedAt) : null
  const selectedIndex = data?.daily?.findIndex(day => day.decisionDate === selectedDate) ?? -1
  const vintageLeadMinutes = selected?.decisionCutoff && recentPublish
    ? Math.max(0, Math.round((new Date(selected.decisionCutoff).getTime() - new Date(recentPublish).getTime()) / 60000))
    : null

  function moveDecision(offset) {
    if (!data?.daily?.length) return
    const next = Math.min(data.daily.length - 1, Math.max(0, selectedIndex + offset))
    setSelectedDate(data.daily[next].decisionDate)
  }

  function openDecision(date = selectedDate) {
    setSelectedDate(date)
    if (page !== 'decisions') window.location.hash = 'decisions'
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function downloadCsv(filename, rows, columns) {
    if (!rows?.length) return
    const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [columns.map(([, label]) => escape(label)).join(','), ...rows.map(row => columns.map(([key]) => escape(row[key])).join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function exportSelectedDay() {
    const rows = selectedRows.map(row => ({
      decisionDate: selected?.decisionDate,
      deliveryDate: selected?.deliveryDate,
      startTime: row.localStartTime,
      forecastMW: row.forecastMW,
      actualMW: row.actualMW,
      errorMW: row.errorMW,
      forecastPublishTime: row.forecastPublishTime,
    }))
    downloadCsv(`windwise-${selected?.decisionDate || 'decision'}-intervals.csv`, rows, [
      ['decisionDate', 'Decision date'], ['deliveryDate', 'Delivery date'], ['startTime', 'Period start (UK)'],
      ['forecastMW', 'Forecast (MW)'], ['actualMW', 'Actual (MW)'], ['errorMW', 'Error (MW)'], ['forecastPublishTime', 'Forecast published (UTC)'],
    ])
  }

  function exportMonth() {
    const deliveryToDecision = new Map(data?.daily?.map(day => [day.deliveryDate, day.decisionDate]) || [])
    const rows = (data?.intervals || []).map(row => ({
      decisionDate: deliveryToDecision.get(row.localStartTime?.slice(0, 10)),
      deliveryDate: row.localStartTime?.slice(0, 10),
      startTime: row.localStartTime,
      forecastMW: row.forecastMW,
      actualMW: row.actualMW,
      errorMW: row.errorMW,
      forecastPublishTime: row.forecastPublishTime,
    }))
    downloadCsv('windwise-january-2026-decisions.csv', rows, [
      ['decisionDate', 'Decision date'], ['deliveryDate', 'Delivery date'], ['startTime', 'Period start (UK)'],
      ['forecastMW', 'Forecast (MW)'], ['actualMW', 'Actual (MW)'], ['errorMW', 'Error (MW)'], ['forecastPublishTime', 'Forecast published (UTC)'],
    ])
  }

  const cutoffPanel = <div className="hero-console cutoff-console">
    <div className="console-top"><span className="console-status"><i/>{error ? 'Source data needs attention' : data ? 'Historical replay ready' : 'Loading Elexon data'}</span><span className="console-region">GB · ELEXON</span></div>
    <div className="console-main"><div><label className="console-label" htmlFor="cutoff">FORECAST CUT-OFF</label><div className="cutoff-control"><input id="cutoff" aria-label="Decision cutoff in UK local time, 24-hour HH:MM" aria-invalid={Boolean(cutoffInputError)} aria-describedby={cutoffInputError ? 'cutoff-error' : undefined} inputMode="text" autoComplete="off" spellCheck="false" maxLength={5} placeholder="09:50" value={cutoffInput} onChange={event => updateCutoffInput(event.target.value)} type="text"/></div>{cutoffInputError && <span id="cutoff-error" className="cutoff-input-error" role="alert">{cutoffInputError}</span>}</div><span className="console-zone">UK LOCAL TIME<br/>ON DECISION DATE</span></div>
    <div className="console-divider"/><p>Only forecasts published at or before this time enter the replay.</p>
    <div className="console-footer"><span><b>09:50</b> default N2EX cutoff</span><span>Europe/London</span></div>
  </div>

  const errorNotice = error && <section className="notice error-notice" role="alert"><Icon name="info"/><div><strong>Elexon data could not be loaded</strong><p>{error}</p><button onClick={() => load({ refresh: true })}>Try again</button></div></section>
  const loadingPanel = loading && !data && <section className="loading-panel" role="status" aria-live="polite"><span className="spinner"/><span>Loading January decisions and next-day outturn…</span></section>
  const refreshButton = <button className="refresh-button" onClick={() => load({ refresh: true })} disabled={refreshing || loading}><Icon name="refresh" size={15}/>{refreshing ? 'Refreshing Elexon…' : 'Refresh data'}</button>

  const metricCards = data && <section className="metrics-grid" aria-label="Monthly forecast accuracy metrics">
    <MetricCard label="Mean absolute error" value={fmt(data.metrics.maeMW)} suffix=" MW" note="Typical absolute miss per forecast hour" icon="wind" tone="metric-accent" tooltip="The average absolute difference between forecast and actual generation. Lower is better."/>
    <MetricCard label="Root mean square error" value={fmt(data.metrics.rmseMW)} suffix=" MW" note="Larger misses count more" icon="arrow" tooltip="The square root of mean squared error. It gives more weight to large forecast misses."/>
    <MetricCard label="WAPE" value={data.metrics.wapePercent == null ? '—' : fmt(data.metrics.wapePercent, 1)} suffix="%" note="Absolute error ÷ actual total" icon="check" tooltip="Weighted absolute percentage error: total absolute error divided by total actual wind generation."/>
    <MetricCard label="Forecast bias" value={data.metrics.biasMW == null ? '—' : `${data.metrics.biasMW > 0 ? '+' : ''}${fmt(data.metrics.biasMW)}`} suffix=" MW" note={data.metrics.biasMW == null ? 'No matched data' : data.metrics.biasMW > 0 ? 'Forecast ran high on average' : data.metrics.biasMW < 0 ? 'Forecast ran low on average' : 'No directional bias'} icon="arrow" tooltip="Mean forecast minus actual. Positive means forecasts were higher than outturn."/>
    <MetricCard label="Paired interval coverage" value={fmt(data.metrics.coveragePercent, 1)} suffix="%" note={`${nf.format(data.metrics.matchedIntervals)} of ${nf.format(data.metrics.expectedIntervals)} hours matched`} icon="clock" tone="metric-dark" tooltip="The share of expected hourly intervals with both a forecast and a valid paired actual."/>
  </section>

  const metricGuide = <details className="metric-guide"><summary>How to read these scores</summary><div className="metric-guide-grid"><p><strong>MAE</strong> shows the typical size of the miss in MW.</p><p><strong>RMSE</strong> highlights days with larger misses.</p><p><strong>WAPE</strong> scales absolute error against total actual wind.</p><p><strong>Bias</strong> shows whether the forecast tended high or low.</p><p><strong>Coverage</strong> tells you how much of the expected period is scored.</p></div></details>

  const decisionPanel = data && selected && <section className="decision-review" aria-labelledby="decision-title">
    <div className="decision-review-head">
      <div><div className="section-kicker"><Icon name="calendar" size={14}/> INSPECT A BUYING DECISION</div><h2 id="decision-title">Decision snapshot</h2></div>
      <div className="decision-actions">{refreshButton}<button className="quiet-button" onClick={exportSelectedDay} disabled={!selectedRows.length}><Icon name="download" size={15}/>Export day</button><button className="quiet-button" onClick={exportMonth} disabled={!data.intervals?.length}><Icon name="download" size={15}/>Export month</button></div>
    </div>
    <div className="decision-toolbar">
      <div className="date-picker-group"><label htmlFor="decision-date">DECISION DATE</label><div className="date-picker-controls"><button className="step-button" onClick={() => moveDecision(-1)} disabled={selectedIndex <= 0} aria-label="Previous decision date">‹</button><select id="decision-date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)}>{data.daily.map(day => <option key={day.decisionDate} value={day.decisionDate}>{dateLabel(day.decisionDate, { weekday: 'short', day: 'numeric', month: 'long' })}</option>)}</select><button className="step-button" onClick={() => moveDecision(1)} disabled={selectedIndex >= data.daily.length - 1} aria-label="Next decision date">›</button></div></div>
      <span className="decision-sequence"><span>{dateLabel(selected.decisionDate, { day: 'numeric', month: 'short' })}</span><b>→</b><span>{dateLabel(selected.deliveryDate, { day: 'numeric', month: 'short' })}</span><small>DECISION → DELIVERY</small></span>
      <div className={`vintage-status ${recentPublish ? 'is-available' : 'is-missing'}`}><span className="vintage-indicator"><Icon name={recentPublish ? 'check' : 'info'} size={16}/></span><div><strong>{recentPublish ? 'Latest eligible forecast vintage' : 'No forecast before cutoff'}</strong><span>{recentPublish ? `Published ${timeLabel(recentPublish)} UK${vintageLeadMinutes !== null ? ` · ${vintageLeadMinutes} min before cutoff` : ''}` : 'No eligible WINDFOR vintage found'}</span></div></div>
    </div>
    <div className="decision-stats"><div className="decision-stat"><span>DECISION CUTOFF</span><strong>{timeLabel(selected.decisionCutoff)} <small>UK time</small></strong></div><div className="decision-stat"><span>DAILY MAE</span><strong>{selected.maeMW == null ? '—' : <>{fmt(selected.maeMW)} <small>MW</small></>}</strong></div><div className="decision-stat"><span>PAIRED HOURS</span><strong>{selected.matchedIntervals}<small> / {selected.expectedIntervals}</small></strong></div><div className="decision-stat"><span>DELIVERY DATE</span><strong>{dateLabel(selected.deliveryDate, { day: 'numeric', month: 'short' })}</strong></div></div>
  </section>

  const deliveryAudit = data && selected && <section className="panel day-panel" aria-labelledby="hourly-title">
    <div className="panel-head day-head"><div><div className="section-kicker">HOURLY DELIVERY PROFILE</div><h3 id="hourly-title">Forecast versus actual</h3><p className="panel-subtitle">{dateLabel(selected.deliveryDate, { weekday: 'long', day: 'numeric', month: 'long' })} delivery · all times UK</p></div><div className="detail-legend"><span><i className="legend-actual"/>Actual outturn</span><span><i className="legend-forecast"/>Forecast at cutoff</span></div></div>
    <ComparisonChart rows={selectedRows}/>
    <div className="table-head"><div><div className="section-kicker">{data.comparisonResolutionMinutes === 60 ? 'HOURLY DETAIL' : 'HALF-HOURLY DETAIL'}</div><h4>Interval-by-interval audit</h4><p className="panel-subtitle">Positive error means forecast generation was higher than actual outturn.</p></div><span>{selectedRows.length} hourly intervals</span></div>
    <div className="table-scroll" role="region" aria-label="Forecast and actual interval data" tabIndex="0"><table><thead><tr><th>PERIOD START</th><th>FORECAST MW</th><th>ACTUAL MW</th><th>ERROR MW</th><th>FORECAST PUBLISHED</th></tr></thead><tbody>{selectedRows.map(row => <tr key={row.startTime}><td className="time-cell">{timeLabel(row.startTime)}</td><td>{fmt(row.forecastMW, 0)}</td><td>{fmt(row.actualMW, 0)}</td><td className={row.errorMW == null ? '' : row.errorMW > 0 ? 'error-positive' : 'error-negative'}>{row.errorMW == null ? '—' : `${row.errorMW > 0 ? '+' : ''}${fmt(row.errorMW, 0)}`}</td><td>{row.forecastPublishTime ? `${dateLabel(row.forecastPublishTime.slice(0, 10))} · ${timeLabel(row.forecastPublishTime)}` : 'No forecast before cutoff'}</td></tr>)}</tbody></table></div>
  </section>

  const performancePanel = data && <section className="panel performance-panel">
    <div className="panel-head"><div><div className="section-kicker">DAY-BY-DAY · {datesWithData} OF 31 DECISIONS WITH MATCHED DATA</div><h3>Find the harder days</h3><p className="panel-subtitle">Choose a point to open that decision’s next-day forecast and outturn.</p></div><div className="chart-head-actions"><div className="chart-legend"><span><i className="legend-error"/>Daily MAE</span><span className="legend-unit">MW</span></div><button className="text-button" onClick={exportMonth} disabled={!data.intervals?.length}><Icon name="download" size={14}/>Download data</button></div></div>
    <DailyErrorChart days={data.daily} selectedDate={selectedDate} onSelect={openDecision}/>
    <div className="chart-foot"><span>Daily MAE across next-day delivery intervals</span><span>Lower is better · selected date is highlighted</span></div>
  </section>

  const dataFootnote = data && <div className="data-footnote"><span>Data: Elexon Insights · FUELHH (WIND) and WINDFOR · Jan decisions → 2 Jan–1 Feb delivery</span><span>{latestGenerated ? `Retrieved ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(latestGenerated)} UTC` : 'January 2026 decisions'}</span></div>

  const homePage = <>
    <section className="hero home-hero">
      <div className="hero-copy"><div className="eyebrow"><span>DAY-AHEAD WIND DESK</span><span className="eyebrow-rule"/><span>HISTORICAL REPLAY · JAN 2026</span></div><h1>Make the call with<br/><em>the forecast you had.</em></h1><p>See what the buying desk could know at decision time. Windwise replays January’s Elexon wind forecasts against next-day outturn, without letting later forecasts leak into the comparison.</p><div className="hero-actions"><a className="primary-cta" href="#decisions">Review a decision <Icon name="arrow" size={15}/></a><a className="secondary-cta" href="#accuracy">See the accuracy</a></div><div className="hero-meta"><span><Icon name="check" size={15}/>31 decision dates</span><span className="meta-sep">·</span><span>National wind generation</span><span className="meta-sep">·</span><span>Hourly comparison</span></div></div>
      {cutoffPanel}
    </section>
    {errorNotice}
    {loadingPanel}
    {data && <>
      <section className="home-overview"><div className="home-section-head"><div><div className="section-kicker">JANUARY AT A GLANCE</div><h2>One month. 31 decisions. 744 forecast hours.</h2></div><a className="subtle-link" href="#accuracy">Explore all accuracy measures <Icon name="arrow" size={14}/></a></div>
        <div className="home-kpis"><article><span>MEAN ABSOLUTE ERROR</span><strong>{fmt(data.metrics.maeMW)} <small>MW</small></strong><p>Typical miss per forecast hour</p></article><article><span>FORECAST BIAS</span><strong className={data.metrics.biasMW > 0 ? 'bias-high' : ''}>{data.metrics.biasMW > 0 ? '+' : ''}{fmt(data.metrics.biasMW)} <small>MW</small></strong><p>{data.metrics.biasMW > 0 ? 'Forecast ran high on average' : 'Average forecast direction'}</p></article><article><span>PAIRED COVERAGE</span><strong>{fmt(data.metrics.coveragePercent, 1)}<small>%</small></strong><p>{nf.format(data.metrics.matchedIntervals)} of {nf.format(data.metrics.expectedIntervals)} hours matched</p></article></div>
      </section>
      {selected && <section className="home-snapshot"><div className="snapshot-copy"><span className="section-kicker">START WITH A DECISION</span><h2>{dateLabel(selected.decisionDate, { weekday: 'long', day: 'numeric', month: 'long' })} decision <b>→</b> {dateLabel(selected.deliveryDate, { weekday: 'short', day: 'numeric', month: 'short' })} delivery</h2><p>Cutoff {timeLabel(selected.decisionCutoff)} UK · latest eligible forecast {recentPublish ? `published ${timeLabel(recentPublish)}` : 'not available'}</p></div><div className="snapshot-score"><span>DAY MAE</span><strong>{selected.maeMW == null ? '—' : fmt(selected.maeMW)}<small> MW</small></strong></div><a className="snapshot-link" href="#decisions" aria-label="Open the selected decision review"><Icon name="arrow" size={18}/></a></section>}
      <section className="home-route-grid"><a href="#decisions"><span className="route-icon"><Icon name="calendar" size={18}/></span><span><strong>Review a decision</strong><small>Inspect the selected forecast vintage and hourly outturn.</small></span><b>→</b></a><a href="#accuracy"><span className="route-icon"><Icon name="arrow" size={18}/></span><span><strong>Compare performance</strong><small>See monthly scores and which days carried larger error.</small></span><b>→</b></a><a href="#method"><span className="route-icon"><Icon name="info" size={18}/></span><span><strong>Understand the method</strong><small>Read the cutoff, data alignment, and scope limits.</small></span><b>→</b></a></section>
      <div className="home-boundary"><Icon name="info" size={17}/><p><strong>Decision support, not a trade instruction.</strong> Wind accuracy is one input; a purchase quantity also needs demand and portfolio data.</p><a href="#method">Why this matters</a></div>
      {dataFootnote}
    </>}
  </>

  const decisionsPage = <>
    <PageIntro kicker="DECISION REVIEW · JANUARY 2026" title="Trace one buying decision." description="Choose a January decision date to see the eligible forecast, the next day’s wind outturn, and the error for each hour.">{cutoffPanel}</PageIntro>
    {errorNotice}{loadingPanel}
    {decisionPanel}
    {deliveryAudit}
    {dataFootnote}
  </>

  const accuracyPage = <>
    <PageIntro kicker="FORECAST PERFORMANCE · JANUARY 2026" title="Measure the misses, not just the forecast." description="Monthly scores summarize 744 next-day delivery hours. Use the daily line to find a date, then open its decision record."><span className="page-cutoff-note"><span>SCORING CUTOFF</span><strong>{cutoff} <small>UK</small></strong><a href="#decisions">Change cutoff</a></span></PageIntro>
    {errorNotice}{loadingPanel}
    {data && <><div className="accuracy-heading"><div><div className="section-kicker">MONTH AT A GLANCE · 1–31 JANUARY DECISION DATES</div><h2>Forecast accuracy scores</h2></div>{refreshButton}</div>{metricCards}{metricGuide}{performancePanel}{dataFootnote}</>}
  </>

  const methodPage = <>
    <PageIntro kicker="METHOD & SCOPE" title="A fair replay of what the desk knew." description="Every score uses only the Elexon wind forecast vintage available by the selected decision cutoff, matched with the following day’s actual generation." />
    <section className="method-flow"><div><span>01</span><strong>Decision date</strong><small>1–31 January 2026</small></div><b>→</b><div><span>02</span><strong>Forecast vintage</strong><small>Latest publishTime ≤ cutoff</small></div><b>→</b><div><span>03</span><strong>Delivery day</strong><small>Next calendar day</small></div><b>→</b><div><span>04</span><strong>Accuracy</strong><small>Matched intervals only</small></div></section>
    <section className="method-source-grid"><article className="source-card"><div className="source-card-icon"><Icon name="wind"/></div><span className="section-kicker">ACTUAL GENERATION</span><h2>FUELHH · WIND</h2><p>Half-hourly national wind outturn. For each forecast hour, the two available half-hour readings are averaged. Missing pairs stay missing.</p><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">Open Elexon FUELHH docs <Icon name="arrow" size={14}/></a></article><article className="source-card"><div className="source-card-icon"><Icon name="clock"/></div><span className="section-kicker">FORECAST GENERATION</span><h2>WINDFOR</h2><p>Each hourly delivery value uses the latest record published by the cutoff. Forecasts published later are excluded, even when present in today’s archive.</p><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">Open Elexon WINDFOR docs <Icon name="arrow" size={14}/></a></article></section>
    <section className="method-assumptions"><div><span className="section-kicker">EDITABLE DEFAULT</span><h2>N2EX decision cutoff</h2><p>The default is 09:50 Europe/London on the decision date, based on published N2EX guidance. The brief does not specify a particular auction or desk, so the cutoff can be changed from the Decisions page.</p><a href="#decisions">Current cutoff: {cutoff} UK · Edit it <Icon name="arrow" size={14}/></a></div><div><span className="section-kicker">SCOPE BOUNDARY</span><h2>Why there is no buy quantity</h2><p>The requested Elexon wind datasets contain neither consumer demand nor the utility’s contracts, plant availability, interconnector position, or portfolio exposure. This pilot reports forecast evidence and error; it does not invent a procurement instruction.</p></div></section>
    <details className="method-details" open><summary><span><span className="section-kicker">IMPLEMENTATION</span><strong>How the application is put together</strong></span><span className="method-summary-side">React · FastAPI · Docker</span></summary><div className="method-body"><div><h4>React dashboard</h4><p>Page-wise Home, Decisions, Accuracy, and Method views share a cutoff and selected decision state. Date-level and monthly interval exports are available as CSV.</p></div><div><h4>Python API</h4><p>FastAPI validates January decision dates, fetches the next-day Elexon delivery window, caches responses, applies as-of forecast selection, and calculates error metrics.</p></div><div><h4>Quality and disclosure</h4><p>Backend unit checks cover cutoff selection, WIND filtering, interval aggregation, missing data, and the February 1 boundary. OpenAI Codex assisted with research, implementation, and documentation, as disclosed in the README.</p></div><a href="https://github.com/rohiths08/WindWIse" target="_blank" rel="noreferrer">Review the public repository <Icon name="arrow" size={14}/></a></div></details>
    {dataFootnote}
  </>

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" aria-label="Windwise home"><span className="brand-mark"><Icon name="wind" size={21}/></span><span>windwise<span className="brand-dot">.</span></span></a>
      <nav className="topbar-nav" aria-label="Main navigation">{navItems.map(([id, label]) => <a key={id} href={`#${id}`} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined}>{label}</a>)}</nav>
      <div className="topbar-right"><span className="live-mark"><i/>ELEXON DATA</span><span className="topbar-divider"/><span className="edition">PILOT MONITOR <b>·</b> GB</span></div>
    </header>
    <main className={`content page-${page}`}>
      {page === 'home' && homePage}
      {page === 'decisions' && decisionsPage}
      {page === 'accuracy' && accuracyPage}
      {page === 'method' && methodPage}
    </main>
    <footer className="footer"><div className="footer-brand"><span className="brand-mark"><Icon name="wind" size={17}/></span><span>windwise.</span></div><span>Forecast visibility for confident day-ahead decisions.</span><span>INDEPENDENT PILOT · ELEXON DATA</span></footer>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)

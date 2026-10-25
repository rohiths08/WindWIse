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
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>
}

function MetricCard({ label, value, suffix, note, icon, tone = '' }) {
  return <article className={`metric-card ${tone}`}>
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon name={icon} /></span></div>
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
      {days.map((day, index) => day.maeMW === null ? null : <g key={day.deliveryDate} className="chart-point" onClick={() => onSelect(day.deliveryDate)} onKeyDown={event => event.key === 'Enter' && onSelect(day.deliveryDate)} tabIndex="0" role="button" aria-label={`${dateLabel(day.deliveryDate)}, MAE ${fmt(day.maeMW)} megawatts`}>
        <circle cx={xAt(index)} cy={yAt(day.maeMW)} r={day.deliveryDate === selectedDate ? 5.5 : 3.5} className={day.deliveryDate === selectedDate ? 'point-selected' : 'point'}/>
        <title>{dateLabel(day.deliveryDate, { day: 'numeric', month: 'long' })}: {fmt(day.maeMW)} MW MAE · {day.matchedIntervals}/{day.expectedIntervals} intervals</title>
      </g>)}
      {[0, 7, 14, 21, 28, days.length - 1].filter((v, i, arr) => arr.indexOf(v) === i && days[v]).map(index => <text key={index} x={xAt(index)} y={height - 8} textAnchor="middle" className="axis-label">{dateLabel(days[index].deliveryDate)}</text>)}
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

function App() {
  const [cutoff, setCutoff] = useState('09:50')
  const [selectedDate, setSelectedDate] = useState('2026-01-01')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  async function load({ refresh = false } = {}) {
    setError('')
    refresh ? setRefreshing(true) : setLoading(true)
    try {
      const query = new URLSearchParams({ start: monthStart, end: monthEnd, cutoff })
      if (refresh) query.set('refresh', 'true')
      const response = await fetch(`/api/analysis?${query}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.detail || `Request failed (${response.status})`)
      setData(body)
      if (body.daily?.length && !body.daily.some(day => day.deliveryDate === selectedDate && day.matchedIntervals)) {
        const firstWithData = body.daily.find(day => day.matchedIntervals > 0)
        if (firstWithData) setSelectedDate(firstWithData.deliveryDate)
      }
    } catch (caught) {
      setError(caught.message || 'Could not load Elexon data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [cutoff])

  const selected = useMemo(() => data?.daily?.find(day => day.deliveryDate === selectedDate), [data, selectedDate])
  const selectedRows = useMemo(() => data?.intervals?.filter(row => row.localStartTime?.slice(0, 10) === selectedDate) || [], [data, selectedDate])
  const datesWithData = data?.daily?.filter(day => day.matchedIntervals > 0).length || 0
  const recentPublish = selected?.latestForecastPublishTime
  const latestGenerated = data?.generatedAt ? new Date(data.generatedAt) : null

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Windwise home"><span className="brand-mark"><Icon name="wind" size={21}/></span><span>windwise<span className="brand-dot">.</span></span></a>
      <div className="topbar-right"><span className="live-mark"><i/>ELEXON BMRS DATA</span><span className="topbar-divider"/><span className="edition">PILOT MONITOR <b>·</b> GB</span></div>
    </header>

    <main id="top" className="content">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span>FORECAST OPERATIONS</span><span className="eyebrow-rule"/><span>JANUARY 2026</span></div>
          <h1>Know what the wind<br/><em>will bring tomorrow.</em></h1>
          <p>See the latest wind outlook available at the day-ahead decision point, then measure it against Elexon outturn.</p>
          <div className="hero-meta"><span><Icon name="clock" size={15}/>Decision snapshot: D−1 at {cutoff} UK</span><span className="meta-sep">/</span><span>{data ? `${data.comparisonResolutionMinutes}-minute comparison · actuals ${data.actualResolutionMinutes}-minute` : 'Hourly forecast with half-hour outturn'}</span></div>
        </div>
        <div className="hero-aside">
          <div className="wind-illustration" aria-hidden="true"><div className="sun-disc"/><div className="turbine turbine-one"><i/><b/><span/></div><div className="turbine turbine-two"><i/><b/><span/></div><div className="horizon"/><div className="wind-stroke stroke-one"/><div className="wind-stroke stroke-two"/></div>
          <div className="cutoff-control"><label htmlFor="cutoff">DECISION CUTOFF <span>UK LOCAL TIME</span></label><div className="cutoff-input"><Icon name="clock" size={16}/><input id="cutoff" value={cutoff} onChange={event => setCutoff(event.target.value)} type="time"/><span>DAY BEFORE DELIVERY</span></div><small>Defaults to the Nord Pool GB day-ahead auction gate closure.</small></div>
        </div>
      </section>

      <section className="section-heading overview-heading"><div><div className="section-kicker">MONTH AT A GLANCE</div><h2>January forecast performance</h2></div><button className="refresh-button" onClick={() => load({ refresh: true })} disabled={refreshing || loading}><Icon name="refresh" size={15}/>{refreshing ? 'Refreshing…' : 'Refresh data'}</button></section>

      {error && <section className="notice error-notice"><Icon name="info"/><div><strong>Elexon data could not be loaded</strong><p>{error}</p><button onClick={() => load({ refresh: true })}>Try again</button></div></section>}
      {(loading && !data) && <section className="loading-panel"><span className="spinner"/><span>Loading January actuals and forecast history from Elexon…</span></section>}

      {data && <>
        <section className="metrics-grid" aria-label="Monthly forecast accuracy metrics">
          <MetricCard label="Mean absolute error" value={fmt(data.metrics.maeMW)} suffix=" MW" note={`Typical absolute miss per ${data.comparisonResolutionMinutes === 60 ? 'forecast hour' : 'half-hour'}`} icon="wind" tone="metric-accent"/>
          <MetricCard label="Root mean square error" value={fmt(data.metrics.rmseMW)} suffix=" MW" note="Weights larger misses more heavily" icon="arrow"/>
          <MetricCard label="Weighted absolute error" value={data.metrics.wapePercent == null ? '—' : fmt(data.metrics.wapePercent, 1)} suffix="%" note="Absolute miss ÷ actual wind total" icon="check"/>
          <MetricCard label="Paired interval coverage" value={fmt(data.metrics.coveragePercent, 1)} suffix="%" note={`${nf.format(data.metrics.matchedIntervals)} of ${nf.format(data.metrics.expectedIntervals)} intervals matched`} icon="clock" tone="metric-dark"/>
        </section>

        <section className="panel performance-panel">
          <div className="panel-head"><div><div className="section-kicker">DAY-BY-DAY · {datesWithData} OF 31 DAYS WITH MATCHED DATA</div><h3>Forecast error across the month</h3></div><div className="chart-legend"><span><i className="legend-error"/>Daily MAE</span><span className="legend-unit">MW</span></div></div>
          <DailyErrorChart days={data.daily} selectedDate={selectedDate} onSelect={setSelectedDate}/>
          <div className="chart-foot"><span>Click a point to inspect that delivery day</span><span>Mean absolute error · lower is better</span></div>
        </section>

        <section className="panel day-panel">
          <div className="panel-head day-head"><div><div className="section-kicker">DELIVERY-DAY VIEW</div><h3>{selected ? dateLabel(selected.deliveryDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Select a day'}</h3></div><div className="day-controls"><label htmlFor="delivery-date">DELIVERY DATE</label><select id="delivery-date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)}>{data.daily.map(day => <option key={day.deliveryDate} value={day.deliveryDate}>{dateLabel(day.deliveryDate, { day: 'numeric', month: 'long' })}</option>)}</select></div></div>
          <div className="day-summary">
            <div className="day-stat"><span>AS-OF CUTOFF</span><strong>{selected ? timeLabel(selected.decisionCutoff) : '—'} <small>prior day</small></strong></div>
            <div className="day-stat"><span>NEWEST INCLUDED FORECAST</span><strong>{recentPublish ? `${timeLabel(recentPublish)} UK` : 'No vintage available'} <small>{recentPublish ? dateLabel(recentPublish.slice(0, 10)) : ''}</small></strong></div>
            <div className="day-stat"><span>DAY MAE</span><strong>{selected?.maeMW == null ? '—' : `${fmt(selected.maeMW)} MW`}</strong></div>
            <div className="day-stat"><span>PERIOD COVERAGE</span><strong>{selected ? `${selected.matchedIntervals}/${selected.expectedIntervals}` : '—'} <small>paired</small></strong></div>
          </div>
          <div className="detail-legend"><span><i className="legend-actual"/>Actual outturn</span><span><i className="legend-forecast"/>Forecast at cutoff</span><span className="legend-explainer">MW · UK time</span></div>
          <ComparisonChart rows={selectedRows}/>
          <div className="table-head"><div><div className="section-kicker">{data.comparisonResolutionMinutes === 60 ? 'HOURLY DETAIL' : 'HALF-HOURLY DETAIL'}</div><h4>Forecast beside actual</h4></div><span>{selectedRows.length} forecast periods</span></div>
          <div className="table-scroll"><table><thead><tr><th>PERIOD START</th><th>FORECAST MW</th><th>ACTUAL MW</th><th>ERROR MW</th><th>FORECAST PUBLISHED</th></tr></thead><tbody>{selectedRows.map(row => <tr key={row.startTime}><td className="time-cell">{timeLabel(row.startTime)}</td><td>{fmt(row.forecastMW, 0)}</td><td>{fmt(row.actualMW, 0)}</td><td className={row.errorMW == null ? '' : row.errorMW > 0 ? 'error-positive' : 'error-negative'}>{row.errorMW == null ? '—' : `${row.errorMW > 0 ? '+' : ''}${fmt(row.errorMW, 0)}`}</td><td>{row.forecastPublishTime ? `${dateLabel(row.forecastPublishTime.slice(0, 10))} · ${timeLabel(row.forecastPublishTime)}` : 'No forecast before cutoff'}</td></tr>)}</tbody></table></div>
        </section>

        <section className="method-strip"><div className="method-icon"><Icon name="check" size={19}/></div><div><strong>One forecast vintage per delivery interval, chosen as it would have been known.</strong><p>For each {data.comparisonResolutionMinutes === 60 ? 'hour' : 'half-hour'}, Windwise selects the record with the latest Elexon <code>publishTime</code> at or before the previous-day cutoff. January WINDFOR points are hourly, so paired FUELHH half-hours are averaged to an hourly actual; no half-hour forecasts are synthesized. Forecasts published later are excluded. A net procurement quantity would also require demand and portfolio data, outside this Elexon-only scope.</p></div><a href="https://developer.data.elexon.co.uk/" target="_blank" rel="noreferrer">Elexon source <Icon name="arrow" size={14}/></a></section>
        <div className="data-footnote"><span>Data: Elexon Insights · FUELHH (WIND) and WINDFOR</span><span>{latestGenerated ? `Retrieved ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(latestGenerated)} UTC` : 'Historical January 2026 delivery days'}</span></div>
      </>}
    </main>

    <footer className="footer"><div className="footer-brand"><span className="brand-mark"><Icon name="wind" size={17}/></span><span>windwise.</span></div><span>Forecast visibility for confident day-ahead decisions.</span><span>INDEPENDENT PILOT · ELEXON DATA</span></footer>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)

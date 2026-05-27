import {
  collection, query, where, orderBy, getDocs, getDoc,
  doc, Timestamp, limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { generatePatterns } from "./patternEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return null;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const avg      = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function fmtDate(date) {
  if (!date) return "—";
  return date.toLocaleDateString("en-AU", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fmtDateTime(date) {
  if (!date) return "—";
  return date.toLocaleString("en-AU", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── generateGlucoseReport ─────────────────────────────────────────────────────

/**
 * Fetches all glucoseReadings between startDate and endDate, calculates stats,
 * and groups readings by day.
 *
 * @param {string} userId
 * @param {string} childId
 * @param {object} child   — child document data (glucoseTargetMin/Max, etc.)
 * @param {Date}   startDate
 * @param {Date}   endDate
 * @returns {Promise<{type, child, dateRange, stats, dailyData, generatedAt}>}
 */
export async function generateGlucoseReport(userId, childId, child, startDate, endDate) {
  const startTs = Timestamp.fromDate(startDate);
  const endTs   = Timestamp.fromDate(endDate);

  const snap = await getDocs(query(
    collection(db, "users", userId, "children", childId, "glucoseReadings"),
    where("timestamp", ">=", startTs),
    where("timestamp", "<=", endTs),
    orderBy("timestamp", "asc"),
  ));

  const readings  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const vals      = readings.map(r => r.value).filter(v => v != null && v > 0);

  const targetMin = child.glucoseTargetMin || 4.0;
  const targetMax = child.glucoseTargetMax || 6.5;

  const inRange = vals.filter(v => v >= targetMin && v <= targetMax).length;
  const below   = vals.filter(v => v < targetMin).length;
  const above   = vals.filter(v => v > targetMax).length;
  const tir     = vals.length ? Math.round((inRange / vals.length) * 100) : 0;
  const avg     = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const highest = vals.length ? Math.max(...vals) : null;
  const lowest  = vals.length ? Math.min(...vals) : null;
  const sd      = vals.length >= 2 ? stdDev(vals) : null;

  // Group readings by calendar day (YYYY-MM-DD key)
  const dayMap = {};
  readings.forEach(r => {
    const d = toDate(r.timestamp);
    if (!d) return;
    const key = d.toISOString().slice(0, 10);
    if (!dayMap[key]) dayMap[key] = [];
    dayMap[key].push({ ...r, _date: d });
  });

  const dailyData = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, rds]) => {
      const dayVals = rds.map(r => r.value).filter(Boolean);
      const dayAvg  = dayVals.length ? dayVals.reduce((a, b) => a + b, 0) / dayVals.length : null;
      const dayMin  = dayVals.length ? Math.min(...dayVals) : null;
      const dayMax  = dayVals.length ? Math.max(...dayVals) : null;
      const dayLows = dayVals.filter(v => v < targetMin).length;
      return {
        dateKey,
        readings: rds,
        count: rds.length,
        avg:   dayAvg,
        min:   dayMin,
        max:   dayMax,
        lows:  dayLows,
      };
    });

  return {
    type: "glucose",
    child,
    dateRange: { startDate, endDate },
    stats: { total: vals.length, avg, tir, below, above, highest, lowest, sd, targetMin, targetMax },
    dailyData,
    generatedAt: new Date(),
  };
}

// ── generatePatternReport ─────────────────────────────────────────────────────

/**
 * Reads patternSummary/latest from Firestore. If patterns are stale (>24h) or
 * missing, calls generatePatterns() first.
 *
 * @param {string} userId
 * @param {string} childId
 * @param {object} child
 * @returns {Promise<{type, child, patterns, generatedAt}>}
 */
export async function generatePatternReport(userId, childId, child) {
  const summaryRef  = doc(db, "users", userId, "children", childId, "patternSummary", "latest");
  const summarySnap = await getDoc(summaryRef);

  let patterns    = [];
  let generatedAt = null;

  if (summarySnap.exists()) {
    const data  = summarySnap.data();
    patterns    = data.patterns    || [];
    generatedAt = toDate(data.generatedAt);
  }

  // Refresh if stale (>24 hours) or absent
  const isStale = !generatedAt || (Date.now() - generatedAt.getTime()) > 24 * 60 * 60 * 1000;

  if (isStale || patterns.length === 0) {
    patterns    = await generatePatterns(userId, childId, child);
    generatedAt = new Date();
  }

  return {
    type: "pattern",
    child,
    patterns,
    generatedAt: generatedAt || new Date(),
  };
}

// ── generateFullReport ────────────────────────────────────────────────────────

/**
 * Combines glucose report + pattern report + last 50 meals + last 50 symptom
 * events within the date range.
 *
 * @param {string} userId
 * @param {string} childId
 * @param {object} child
 * @param {Date}   startDate
 * @param {Date}   endDate
 * @returns {Promise<{type, child, dateRange, glucoseStats, dailyData, patterns, meals, symptoms, generatedAt}>}
 */
export async function generateFullReport(userId, childId, child, startDate, endDate) {
  const startTs = Timestamp.fromDate(startDate);
  const endTs   = Timestamp.fromDate(endDate);

  const [glucoseReport, patternReport, mealSnap, sympSnap] = await Promise.all([
    generateGlucoseReport(userId, childId, child, startDate, endDate),
    generatePatternReport(userId, childId, child),
    getDocs(query(
      collection(db, "users", userId, "children", childId, "mealLogs"),
      where("timestamp", ">=", startTs),
      where("timestamp", "<=", endTs),
      orderBy("timestamp", "desc"),
      limit(50),
    )),
    getDocs(query(
      collection(db, "users", userId, "children", childId, "symptomEvents"),
      where("timestamp", ">=", startTs),
      where("timestamp", "<=", endTs),
      orderBy("timestamp", "desc"),
      limit(50),
    )),
  ]);

  const meals    = mealSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const symptoms = sympSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return {
    type: "full",
    child,
    dateRange: { startDate, endDate },
    glucoseStats: glucoseReport.stats,
    dailyData:    glucoseReport.dailyData,
    patterns:     patternReport.patterns,
    meals,
    symptoms,
    generatedAt: new Date(),
  };
}

// ── generateReportHTML ────────────────────────────────────────────────────────

/**
 * Takes the structured data from any of the above generators and returns a
 * complete, print-ready HTML string. No external dependencies — inline CSS only.
 *
 * @param {object} reportData — output from generateGlucoseReport / generatePatternReport / generateFullReport
 * @param {"glucose"|"pattern"|"full"} type
 * @returns {string} Full HTML document
 */
export function generateReportHTML(reportData, type) {
  const { child, generatedAt } = reportData;

  const dob = child?.dob
    ? new Date(child.dob).toLocaleDateString("en-AU", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "—";

  const reportDateStr = generatedAt
    ? new Date(generatedAt).toLocaleString("en-AU", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const dateRangeStr = reportData.dateRange
    ? `${fmtDate(reportData.dateRange.startDate)} – ${fmtDate(reportData.dateRange.endDate)}`
    : null;

  // ── Inner HTML builders ───────────────────────────────────────────────────

  function glucoseStatsHTML(stats) {
    if (!stats || stats.total === 0) {
      return `<p class="muted">No glucose readings recorded in this period.</p>`;
    }
    const tirColour = stats.tir >= 70 ? "#00916A" : stats.tir >= 50 ? "#D97706" : "#B91C1C";
    return `
      <table class="data-table">
        <thead>
          <tr><th>Metric</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr><td>Total readings</td><td>${stats.total}</td></tr>
          <tr><td>Average glucose</td><td>${stats.avg != null ? stats.avg.toFixed(1) + " mmol/L" : "—"}</td></tr>
          <tr>
            <td>Time in range (${stats.targetMin}–${stats.targetMax} mmol/L)</td>
            <td style="color:${tirColour};font-weight:600">${stats.tir}%</td>
          </tr>
          <tr><td>Below range (&lt; ${stats.targetMin} mmol/L)</td><td>${stats.below} reading${stats.below !== 1 ? "s" : ""}</td></tr>
          <tr><td>Above range (&gt; ${stats.targetMax} mmol/L)</td><td>${stats.above} reading${stats.above !== 1 ? "s" : ""}</td></tr>
          <tr><td>Highest reading</td><td>${stats.highest != null ? stats.highest.toFixed(1) + " mmol/L" : "—"}</td></tr>
          <tr><td>Lowest reading</td><td>${stats.lowest != null ? stats.lowest.toFixed(1) + " mmol/L" : "—"}</td></tr>
          ${stats.sd != null ? `<tr><td>Standard deviation</td><td>${stats.sd.toFixed(2)} mmol/L</td></tr>` : ""}
        </tbody>
      </table>`;
  }

  function dailyTableHTML(dailyData) {
    if (!dailyData || dailyData.length === 0) return `<p class="muted">No day-by-day data available.</p>`;
    const rows = dailyData.map(day => {
      // Parse ISO date at noon local time to avoid UTC off-by-one on date display
      const dateLabel = new Date(day.dateKey + "T12:00:00").toLocaleDateString("en-AU", {
        weekday: "short", year: "numeric", month: "short", day: "numeric",
      });
      const lowStyle = day.lows > 0 ? `color:#B91C1C;font-weight:600` : "";
      return `
        <tr>
          <td>${dateLabel}</td>
          <td>${day.count}</td>
          <td>${day.avg != null ? day.avg.toFixed(1) : "—"}</td>
          <td>${day.min != null ? day.min.toFixed(1) : "—"}</td>
          <td>${day.max != null ? day.max.toFixed(1) : "—"}</td>
          <td style="${lowStyle}">${day.lows > 0 ? day.lows : "—"}</td>
        </tr>`;
    }).join("");
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th><th>Readings</th><th>Avg (mmol/L)</th>
            <th>Min</th><th>Max</th><th>Below target</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function patternsHTML(patterns) {
    if (!patterns || patterns.length === 0) {
      return `<p class="muted">No patterns available. Log more data and generate patterns from the Reports screen.</p>`;
    }
    const catLabels = {
      glucose: "Glucose Patterns",
      meal:    "Meal Correlations",
      symptom: "Symptom Patterns",
    };
    const grouped = {};
    patterns.forEach(p => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });
    return Object.entries(grouped).map(([cat, pats]) => `
      <h3 class="sub-heading">${catLabels[cat] || cat}</h3>
      ${pats.map(p => `
        <div class="pattern-block">
          <div class="pattern-title">${p.title}</div>
          <p class="pattern-desc">${p.description}</p>
          <div class="pattern-meta">${p.dataPoints} data point${p.dataPoints !== 1 ? "s" : ""} · 30-day window</div>
        </div>`).join("")}
    `).join("");
  }

  function mealsHTML(meals) {
    if (!meals || meals.length === 0) return `<p class="muted">No meals logged in this period.</p>`;
    const rows = meals.map(m => {
      const d = toDate(m.timestamp);
      return `
        <tr>
          <td>${d ? fmtDateTime(d) : "—"}</td>
          <td>${m.descriptionText || "—"}</td>
          <td>${m.carbsEstimate != null ? m.carbsEstimate + "g" : "—"}</td>
          <td class="muted">${m.notes || ""}</td>
        </tr>`;
    }).join("");
    return `
      <table class="data-table">
        <thead>
          <tr><th>Date / Time</th><th>Meal</th><th>Carbs</th><th>Notes</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function symptomsHTML(symptoms) {
    if (!symptoms || symptoms.length === 0) return `<p class="muted">No symptoms logged in this period.</p>`;
    const rows = symptoms.map(s => {
      const d    = toDate(s.timestamp);
      const syms = (s.quickTapSymptoms || []).join(", ");
      return `
        <tr>
          <td>${d ? fmtDateTime(d) : "—"}</td>
          <td>${syms || "—"}</td>
          <td>${s.observationText || "—"}</td>
          <td>${s.glucoseAtTime != null ? s.glucoseAtTime.toFixed(1) + " mmol/L" : "—"}</td>
        </tr>`;
    }).join("");
    return `
      <table class="data-table">
        <thead>
          <tr><th>Date / Time</th><th>Symptoms</th><th>Observation</th><th>Glucose</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── Body content by report type ───────────────────────────────────────────

  const titles = {
    glucose: "Glucose Report",
    pattern: "Pattern Report for Medical Team",
    full:    "Full History Export",
  };
  const reportTitle = titles[type] || "Report";

  let bodyContent = "";

  if (type === "glucose") {
    bodyContent = `
      <section>
        <h2 class="section-heading">Glucose Summary</h2>
        ${dateRangeStr ? `<p class="muted period-line">Period: ${dateRangeStr}</p>` : ""}
        ${glucoseStatsHTML(reportData.stats)}
      </section>
      <section>
        <h2 class="section-heading">Day-by-Day Breakdown</h2>
        ${dailyTableHTML(reportData.dailyData)}
      </section>`;

  } else if (type === "pattern") {
    bodyContent = `
      <section>
        <h2 class="section-heading">Pattern Analysis</h2>
        <p class="muted period-line">Based on 30 days of glucose, meal, and symptom data. Generated: ${reportDateStr}.</p>
        ${patternsHTML(reportData.patterns)}
      </section>`;

  } else if (type === "full") {
    bodyContent = `
      <section>
        <h2 class="section-heading">Glucose Summary</h2>
        ${dateRangeStr ? `<p class="muted period-line">Period: ${dateRangeStr}</p>` : ""}
        ${glucoseStatsHTML(reportData.glucoseStats)}
      </section>
      <section>
        <h2 class="section-heading">Day-by-Day Glucose Breakdown</h2>
        ${dailyTableHTML(reportData.dailyData)}
      </section>
      <section>
        <h2 class="section-heading">Pattern Analysis</h2>
        <p class="muted period-line">Patterns based on 30 days of data.</p>
        ${patternsHTML(reportData.patterns)}
      </section>
      <section>
        <h2 class="section-heading">Meal Log${reportData.meals?.length === 50 ? " (most recent 50)" : ""}</h2>
        ${mealsHTML(reportData.meals)}
      </section>
      <section>
        <h2 class="section-heading">Symptom Events${reportData.symptoms?.length === 50 ? " (most recent 50)" : ""}</h2>
        ${symptomsHTML(reportData.symptoms)}
      </section>`;
  }

  // ── Full HTML document ────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GlycoGuard — ${reportTitle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #1A2E3B;
      background: #fff;
      padding: 32px;
      max-width: 880px;
      margin: 0 auto;
    }

    /* ── Report header ── */
    .report-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 2px solid #1A2E3B;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .report-logo {
      font-size: 20px;
      font-weight: 800;
      color: #1A2E3B;
      letter-spacing: -0.4px;
      margin-bottom: 4px;
    }
    .report-logo span { color: #FF5DA8; }
    .report-title {
      font-size: 17px;
      font-weight: 700;
      color: #1A2E3B;
    }
    .report-meta {
      text-align: right;
      font-size: 11px;
      color: #6C757D;
      line-height: 1.9;
      padding-top: 2px;
    }

    /* ── Child info strip ── */
    .child-info {
      display: flex;
      gap: 28px;
      flex-wrap: wrap;
      background: #F5F8FA;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 28px;
    }
    .child-info-item { font-size: 11px; color: #6C757D; }
    .child-info-item strong {
      display: block;
      font-size: 13px;
      color: #1A2E3B;
      margin-bottom: 1px;
    }

    /* ── Sections ── */
    section { margin-bottom: 36px; }

    .section-heading {
      font-size: 15px;
      font-weight: 700;
      color: #1A2E3B;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 7px;
      margin-bottom: 14px;
    }
    .sub-heading {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.9px;
      color: #6C757D;
      margin: 18px 0 10px;
    }
    .period-line { margin-bottom: 12px; }

    /* ── Data table ── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 4px;
    }
    .data-table th {
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #6C757D;
      background: #F5F8FA;
      border-bottom: 1px solid #E2E8F0;
      padding: 7px 10px;
    }
    .data-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #F0F0F0;
      color: #1A2E3B;
      vertical-align: top;
    }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:nth-child(even) td { background: #FAFAFA; }

    /* ── Pattern blocks ── */
    .pattern-block {
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 12px;
      background: #FAFAFA;
    }
    .pattern-title {
      font-size: 13px;
      font-weight: 600;
      color: #1A2E3B;
      margin-bottom: 6px;
    }
    .pattern-desc {
      font-size: 13px;
      color: #4A5568;
      line-height: 1.65;
      margin-bottom: 6px;
    }
    .pattern-meta { font-size: 11px; color: #6C757D; }

    /* ── Utilities ── */
    .muted { color: #6C757D; font-size: 12px; }

    /* ── Footer ── */
    .report-footer {
      border-top: 1px solid #E2E8F0;
      padding-top: 14px;
      margin-top: 40px;
      font-size: 11px;
      color: #6C757D;
      line-height: 1.8;
    }
    .report-footer a { color: #6C757D; }

    /* ── Print ── */
    @media print {
      body { padding: 16px; font-size: 12px; }
      section { page-break-inside: avoid; }
      .report-footer { page-break-before: avoid; }
      .data-table th, .data-table td { padding: 5px 8px; }
    }
  </style>
</head>
<body>

  <div class="report-header">
    <div>
      <div class="report-logo">Glyco<span>Guard</span></div>
      <div class="report-title">${reportTitle}</div>
    </div>
    <div class="report-meta">
      <div>Generated ${reportDateStr}</div>
      ${dateRangeStr ? `<div>Period: ${dateRangeStr}</div>` : ""}
      <div>glycoguard.app</div>
    </div>
  </div>

  <div class="child-info">
    <div class="child-info-item">
      <strong>${child?.name || "—"}</strong>
      Child name
    </div>
    <div class="child-info-item">
      <strong>${dob}</strong>
      Date of birth
    </div>
    ${child?.diagnosis ? `
    <div class="child-info-item">
      <strong>${child.diagnosis}</strong>
      Diagnosis
    </div>` : ""}
    ${child?.glucoseTargetMin && child?.glucoseTargetMax ? `
    <div class="child-info-item">
      <strong>${child.glucoseTargetMin}–${child.glucoseTargetMax} mmol/L</strong>
      Target range
    </div>` : ""}
    ${child?.cgmDevice ? `
    <div class="child-info-item">
      <strong>${child.cgmDevice}</strong>
      CGM device
    </div>` : ""}
  </div>

  ${bodyContent}

  <div class="report-footer">
    Generated by GlycoGuard — <a href="https://glycoguard.app">glycoguard.app</a><br />
    This report is a management tool and not a medical diagnosis. All data was entered by a caregiver and has not been clinically verified.<br />
    This report should be reviewed by a qualified medical professional before any clinical decisions are made.
  </div>

</body>
</html>`;
}

import { supabase } from "../supabase";
import { mapGlucoseReading, mapMealLog, mapSymptomEvent } from "./dbMappers";
import { upsertVector } from "./vectorStore";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return null;
}

function fmtHour(h) {
  if (h === 0)  return "midnight";
  if (h < 12)   return `${h}am`;
  if (h === 12) return "noon";
  return `${h - 12}pm`;
}

const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Dedup guard — prevents concurrent runs ────────────────────────────────────

let _activeGeneration = null;

export async function generatePatterns(userId, childId, child) {
  if (_activeGeneration) return _activeGeneration;
  _activeGeneration = _run(userId, childId, child);
  try {
    return await _activeGeneration;
  } finally {
    _activeGeneration = null;
  }
}

// ── Core analysis ─────────────────────────────────────────────────────────────

async function _run(userId, childId, child) {
  const targetMin = child.glucoseTargetMin    || 4.0;
  const targetMax = child.glucoseTargetMax    || 6.5;
  const interval  = child.mealIntervalMinutes || 120;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString();

  const [glucRes, mealRes, sympRes] = await Promise.all([
    supabase.from("glucose_readings").select("*").eq("child_id", childId).gte("timestamp", cutoffIso).order("timestamp", { ascending: true }),
    supabase.from("meal_logs").select("*").eq("child_id", childId).gte("timestamp", cutoffIso).order("timestamp", { ascending: true }),
    supabase.from("symptom_events").select("*").eq("child_id", childId).gte("timestamp", cutoffIso).order("timestamp", { ascending: true }),
  ]);

  const readings = (glucRes.data || []).map(r => ({ id: r.id, ...mapGlucoseReading(r) }));
  const meals    = (mealRes.data || []).map(r => ({ id: r.id, ...mapMealLog(r) }));
  const symptoms = (sympRes.data || []).map(r => ({ id: r.id, ...mapSymptomEvent(r) }));

  const generatedAt = new Date().toISOString();
  const patterns = [];

  // ── 1. Glucose overview ───────────────────────────────────────────────────

  if (readings.length >= 5) {
    const vals    = readings.map(r => r.value).filter(Boolean);
    const inRange = vals.filter(v => v >= targetMin && v <= targetMax).length;
    const tir     = Math.round((inRange / vals.length) * 100);
    const avg     = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);

    patterns.push({
      category:    "glucose",
      title:       "30-Day Glucose Overview",
      description: `Time in range (${targetMin}–${targetMax} mmol/L): ${tir}%. Average: ${avg} mmol/L across ${vals.length} readings. Range: ${Math.min(...vals).toFixed(1)}–${Math.max(...vals).toFixed(1)} mmol/L.`,
      dataPoints:  vals.length,
      generatedAt,
    });

    // Recurring low windows — flag hours where lows occur on >30% of days with data
    const hourMap = {};
    readings.forEach(r => {
      const d = toDate(r.timestamp);
      if (!d || !r.value) return;
      const h   = d.getHours();
      const day = d.toDateString();
      if (!hourMap[h]) hourMap[h] = { lows: new Set(), days: new Set() };
      hourMap[h].days.add(day);
      if (r.value < targetMin) hourMap[h].lows.add(day);
    });

    const problematic = Object.entries(hourMap)
      .filter(([, { lows, days }]) => days.size >= 3 && lows.size / days.size >= 0.30)
      .map(([h, { lows, days }]) => ({
        hour:  parseInt(h),
        pct:   Math.round((lows.size / days.size) * 100),
        count: lows.size,
      }))
      .sort((a, b) => b.pct - a.pct);

    if (problematic.length > 0) {
      const listed = problematic.slice(0, 3).map(p =>
        `${fmtHour(p.hour)} (${p.pct}% of days, ${p.count} occurrence${p.count !== 1 ? "s" : ""})`
      );
      patterns.push({
        category:    "glucose",
        title:       "Recurring Low Glucose Windows",
        description: `Low glucose (below ${targetMin} mmol/L) occurs repeatedly at: ${listed.join("; ")}. Consider adjusting meal timing or adding a snack ahead of these windows.`,
        dataPoints:  problematic.reduce((a, p) => a + p.count, 0),
        meta:        { riskHours: problematic.slice(0, 3).map(p => ({ hour: p.hour, pct: p.pct })) },
        generatedAt,
      });
    }
  }

  // ── 2. Post-meal glucose trajectory ──────────────────────────────────────

  if (meals.length >= 3 && readings.length >= 5) {
    const matched = meals.map(meal => {
      const mt = toDate(meal.timestamp)?.getTime();
      if (!mt) return null;
      const post = readings.filter(r => {
        const t = toDate(r.timestamp)?.getTime();
        if (!t) return false;
        const min = (t - mt) / 60000;
        return min >= 60 && min <= 180;
      });
      if (post.length === 0) return null;
      const minPost = Math.min(...post.map(r => r.value));
      return { meal, minPost, hadLow: minPost < targetMin };
    }).filter(Boolean);

    if (matched.length >= 3) {
      const lows  = matched.filter(m => m.hadLow);
      const pct   = Math.round((lows.length / matched.length) * 100);
      const descs = [...new Set(lows.map(m => m.meal.descriptionText).filter(Boolean))].slice(0, 3);
      let desc = `Post-meal glucose dropped below target in ${lows.length} of ${matched.length} analysed meals (${pct}%).`;
      if (descs.length > 0) desc += ` Meals linked to post-meal lows include: ${descs.join(", ")}.`;
      patterns.push({
        category:    "meal",
        title:       "Post-Meal Glucose Trajectory",
        description: desc,
        dataPoints:  matched.length,
        generatedAt,
      });
    }
  }

  // ── 3. Meal interval violations ───────────────────────────────────────────

  if (meals.length >= 2) {
    const sorted = [...meals].sort((a, b) =>
      (toDate(a.timestamp)?.getTime() || 0) - (toDate(b.timestamp)?.getTime() || 0)
    );

    const violations = [];
    for (let i = 1; i < sorted.length; i++) {
      const t0 = toDate(sorted[i - 1].timestamp)?.getTime();
      const t1 = toDate(sorted[i].timestamp)?.getTime();
      if (!t0 || !t1) continue;
      const gap = (t1 - t0) / 60000;
      if (gap > interval) {
        const sympCount = symptoms.filter(s => {
          const t = toDate(s.timestamp)?.getTime();
          return t && t > t0 && t < t1;
        }).length;
        violations.push({ gap: Math.round(gap), sympCount });
      }
    }

    if (violations.length > 0) {
      const symptomatic = violations.filter(v => v.sympCount > 0).length;
      const avgGap      = Math.round(violations.reduce((a, v) => a + v.gap, 0) / violations.length);
      const maxGap      = Math.max(...violations.map(v => v.gap));
      let desc = `The ${interval}-minute meal interval was exceeded ${violations.length} time${violations.length !== 1 ? "s" : ""} in 30 days (avg gap: ${avgGap} min, longest: ${maxGap} min).`;
      if (symptomatic > 0) desc += ` Symptoms were logged during ${symptomatic} of these gaps.`;
      patterns.push({
        category:    "meal",
        title:       "Meal Interval Violations",
        description: desc,
        dataPoints:  violations.length,
        generatedAt,
      });
    }
  }

  // ── 4. Symptom time distribution ─────────────────────────────────────────

  if (symptoms.length >= 3) {
    const byHour  = new Array(24).fill(0);
    const byDow   = new Array(7).fill(0);
    const sympFreq = {};
    symptoms.forEach(s => {
      const d = toDate(s.timestamp);
      if (!d) return;
      byHour[d.getHours()]++;
      byDow[d.getDay()]++;
      (s.quickTapSymptoms || []).forEach(sym => { sympFreq[sym] = (sympFreq[sym] || 0) + 1; });
    });

    const topHours = byHour
      .map((n, h) => ({ h, n }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
      .map(x => `${fmtHour(x.h)} (${x.n})`);

    const peakDow  = byDow.indexOf(Math.max(...byDow));
    const topSymps = Object.entries(sympFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s);

    let desc = `${symptoms.length} symptom event${symptoms.length !== 1 ? "s" : ""} in 30 days. Peak times: ${topHours.join(", ")}.`;
    if (Math.max(...byDow) > 1) desc += ` ${DOW[peakDow]}s have the highest frequency.`;
    if (topSymps.length > 0)    desc += ` Most common: ${topSymps.join(", ")}.`;

    patterns.push({
      category:    "symptom",
      title:       "Symptom Timing Distribution",
      description: desc,
      dataPoints:  symptoms.length,
      generatedAt,
    });
  }

  // ── 5. Carb correlation ───────────────────────────────────────────────────

  const carbMeals = meals.filter(m => m.carbsEstimate != null && m.carbsEstimate > 0);
  if (carbMeals.length >= 3 && readings.length >= 5) {
    const groups = { "≤20g": [], "21–40g": [], ">40g": [] };
    carbMeals.forEach(meal => {
      const mt = toDate(meal.timestamp)?.getTime();
      if (!mt) return;
      const post = readings.filter(r => {
        const t = toDate(r.timestamp)?.getTime();
        if (!t) return false;
        const min = (t - mt) / 60000;
        return min >= 60 && min <= 180;
      });
      if (post.length === 0) return;
      const minPost = Math.min(...post.map(r => r.value));
      const key = meal.carbsEstimate <= 20 ? "≤20g" : meal.carbsEstimate <= 40 ? "21–40g" : ">40g";
      groups[key].push(minPost < targetMin);
    });

    const filled = Object.entries(groups).filter(([, g]) => g.length > 0);
    if (filled.length >= 2) {
      const summaries = filled.map(([label, g]) => {
        const lowPct = Math.round((g.filter(Boolean).length / g.length) * 100);
        return `${label}: ${lowPct}% post-meal lows (n=${g.length})`;
      });
      patterns.push({
        category:    "meal",
        title:       "Carbohydrate & Glucose Stability",
        description: `Correlation between meal carb content and post-meal glucose drops over 30 days. ${summaries.join("; ")}.`,
        dataPoints:  carbMeals.length,
        generatedAt,
      });
    }
  }

  // ── Upsert to Pinecone (non-fatal, 500ms between calls) ──────────────────

  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    try {
      await upsertVector({
        id:      `pattern-${userId}-${childId}-${p.category}-${i}`,
        content: `[PATTERN: ${p.title}] ${p.description} (${p.dataPoints} data points, 30-day window)`,
        childId,
        userId,
        type:    "pattern_summary",
      });
    } catch (e) {
      console.warn(`Pattern Pinecone upsert skipped (${p.category}-${i}):`, e.message);
    }
    if (i < patterns.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  // ── Write to Postgres ─────────────────────────────────────────────────────

  try {
    await supabase.from("pattern_summaries").upsert({
      child_id:     childId,
      patterns,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Pattern summary write failed:", e);
  }

  return patterns;
}

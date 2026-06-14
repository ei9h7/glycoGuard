// Maps Supabase (snake_case Postgres rows) <-> the camelCase shapes the app's
// screens/hooks expect (carried over from the Firestore document shape).

export function mapChild(row) {
  if (!row) return null;
  return {
    id:                  row.id,
    name:                row.name,
    dob:                 row.dob,
    diagnosis:           row.diagnosis,
    cgmDevice:           row.cgm_device,
    glucoseTargetMin:    row.glucose_target_min,
    glucoseTargetMax:    row.glucose_target_max,
    mealIntervalMinutes: row.meal_interval_minutes,
    coParentEmail:       row.co_parent_email,
    coParentUid:         row.co_parent_uid,
    coParentChildId:     row.co_parent_child_id,
    coParentStatus:      row.co_parent_status,
    sharing:             row.sharing || {},
  };
}

export function mapGlucoseReading(row) {
  return {
    id:        row.id,
    value:     row.value,
    notes:     row.notes,
    source:    row.source,
    loggedBy:  row.logged_by,
    timestamp: toTimestampLike(row.timestamp),
  };
}

export function mapMealLog(row) {
  return {
    id:              row.id,
    descriptionText: row.description_text,
    carbsEstimate:   row.carbs_estimate,
    notes:           row.notes,
    loggedBy:        row.logged_by,
    timestamp:       toTimestampLike(row.timestamp),
  };
}

export function mapSymptomEvent(row) {
  return {
    id:                row.id,
    quickTapSymptoms:  row.quick_tap_symptoms || [],
    observationText:   row.observation_text,
    glucoseAtTime:     row.glucose_at_time,
    loggedBy:          row.logged_by,
    timestamp:         toTimestampLike(row.timestamp),
  };
}

export function mapDocument(row) {
  return {
    id:             row.id,
    filename:       row.filename,
    type:           row.type,
    extractedText:  row.extracted_text,
    chunkCount:     row.chunk_count,
    loggedBy:       row.logged_by,
    createdAt:      toTimestampLike(row.created_at),
  };
}

export function mapPreferenceNote(row) {
  return {
    id:        row.id,
    content:   row.content,
    loggedBy:  row.logged_by,
    createdAt: toTimestampLike(row.created_at),
  };
}

// The app's screens were written against Firestore Timestamps, which expose
// `.toDate()`. Postgres returns ISO strings — wrap them so `.toDate()` keeps working.
export function toTimestampLike(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  return { toDate: () => date, seconds: Math.floor(date.getTime() / 1000) };
}

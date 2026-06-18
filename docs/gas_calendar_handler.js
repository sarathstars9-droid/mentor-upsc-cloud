// ─────────────────────────────────────────────────────────────────────────────
// Google Apps Script — UPSC Mentor Calendar Handler
// File: calendarHandler.gs  (paste entire contents into Apps Script editor)
//
// DEPLOYMENT CHECKLIST:
//   1. Open https://script.google.com → your project
//   2. Replace (or create) calendarHandler.gs with this file
//   3. In appsscript.json ensure:
//        "oauthScopes": ["https://www.googleapis.com/auth/calendar"]
//      AND Advanced Services → Google Calendar API → ON
//   4. Manage Deployments → New Version → Deploy
//   5. Copy the new /exec URL → set as SCRIPT_URL env var in Railway
//
// Protocol: POST with body  data=<JSON string>
//   Supported actions:
//     "upsert_calendar_event"  — create or patch a calendar event for a study block
//
// Returns JSON:
//   { ok: true,  calendarEventId: "...", calendarHtmlLink: "..." }
//   { ok: false, error: "..." }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entry point — Google Apps Script calls this for every HTTP POST.
 * The backend (calendarBridgeService.js) sends:
 *   Content-Type: application/x-www-form-urlencoded
 *   Body: data=<JSON>
 */
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var raw  = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    var params = {};

    // Parse application/x-www-form-urlencoded manually (Apps Script limitation)
    raw.split('&').forEach(function(pair) {
      var idx = pair.indexOf('=');
      if (idx < 0) return;
      var k = decodeURIComponent(pair.slice(0, idx).replace(/\+/g, ' '));
      var v = decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
      params[k] = v;
    });

    var data = {};
    try { data = JSON.parse(params['data'] || '{}'); } catch (parseErr) {
      output.setContent(JSON.stringify({ ok: false, error: 'invalid JSON in data param' }));
      return output;
    }

    var action = data.action || '';

    switch (action) {
      case 'upsert_calendar_event':
        output.setContent(JSON.stringify(upsertCalendarEvent(data)));
        return output;

      default:
        Logger.log('[calendarHandler] Unknown action: ' + action);
        output.setContent(JSON.stringify({ ok: false, error: 'Unknown action: ' + action }));
        return output;
    }

  } catch (err) {
    Logger.log('[calendarHandler] doPost error: ' + err.toString());
    output.setContent(JSON.stringify({ ok: false, error: err.toString() }));
    return output;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// upsertCalendarEvent
// Creates a new Google Calendar event, or patches an existing one.
//
// data fields expected:
//   title                    string   — event summary
//   description              string   — event body text
//   startTime                ISO8601  — event start (IST assumed if no TZ offset)
//   endTime                  ISO8601  — event end
//   calendarEventId          string?  — if set, try to patch; else insert
//   lifecycleAction          string   — 'start'|'pause'|'resume'|'complete'|'retry'
//   notificationMinutesBefore number  — popup alarm offset (0 = at start)
// ─────────────────────────────────────────────────────────────────────────────
function upsertCalendarEvent(data) {
  try {
    // Short-circuit for diagnostic probe requests — no real calendar event is created
    if (data.__probe === true) {
      Logger.log('[upsertCalendarEvent] Probe request received — returning ok without creating event');
      return { ok: true, calendarEventId: 'probe-ok', calendarHtmlLink: null, probe: true };
    }

    var calendarId = 'primary'; // use PropertiesService to override per user if needed

    var title       = data.title       || 'Study Block';
    var description = data.description || '';
    var startTime   = data.startTime   ? new Date(data.startTime) : new Date();
    var endTime     = data.endTime     ? new Date(data.endTime)   : new Date(startTime.getTime() + 60 * 60 * 1000);

    // Guard: if end <= start (block still running), use start + 1 h as placeholder
    if (endTime <= startTime) {
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    }

    var notifMins = typeof data.notificationMinutesBefore === 'number'
                    ? data.notificationMinutesBefore
                    : 0;

    var eventBody = {
      summary:     title,
      description: description,
      start:       { dateTime: startTime.toISOString(), timeZone: 'Asia/Kolkata' },
      end:         { dateTime: endTime.toISOString(),   timeZone: 'Asia/Kolkata' },
      reminders:   { useDefault: false, overrides: [{ method: 'popup', minutes: notifMins }] },
      colorId:     colorIdForLifecycleAction(data.lifecycleAction),
    };

    var existingId = data.calendarEventId || null;
    var event;

    if (existingId) {
      try {
        event = Calendar.Events.patch(eventBody, calendarId, existingId);
      } catch (patchErr) {
        // Event may have been deleted externally — create fresh
        Logger.log('[upsertCalendarEvent] patch failed, inserting fresh: ' + patchErr.toString());
        event = Calendar.Events.insert(eventBody, calendarId);
      }
    } else {
      event = Calendar.Events.insert(eventBody, calendarId);
    }

    Logger.log('[upsertCalendarEvent] ok — eventId: ' + event.id);
    return {
      ok:               true,
      calendarEventId:  event.id,
      calendarHtmlLink: event.htmlLink,
    };

  } catch (err) {
    Logger.log('[upsertCalendarEvent] ERROR: ' + err.toString());
    return { ok: false, error: err.toString() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Color mapping — Google Calendar colorId 1-11
// https://developers.google.com/calendar/api/v3/reference/colors/get
// ─────────────────────────────────────────────────────────────────────────────
function colorIdForLifecycleAction(action) {
  switch (action) {
    case 'start':    return '2';  // Sage (green)  — session begun
    case 'pause':    return '5';  // Banana (yellow) — paused
    case 'resume':   return '2';  // Sage (green)  — back on track
    case 'complete': return '8';  // Graphite (grey) — done
    case 'retry':    return '1';  // Lavender — retry sync
    default:         return '1';  // Lavender — fallback
  }
}

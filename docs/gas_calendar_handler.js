// ─────────────────────────────────────────────────────────────────────────────
// Google Apps Script — calendar handler
// Add this function to your existing Apps Script project (not a separate file).
// It handles the "upsert_calendar_event" action sent by calendarBridgeService.js.
//
// Required Apps Script permissions (via the manifest or OAuth prompt):
//   https://www.googleapis.com/auth/calendar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add this inside your existing doPost(e) handler's action switch:
 *
 *   case 'upsert_calendar_event':
 *     return ContentService
 *       .createTextOutput(JSON.stringify(upsertCalendarEvent(data)))
 *       .setMimeType(ContentService.MimeType.JSON);
 */

function upsertCalendarEvent(data) {
  try {
    var calendarId = 'primary'; // use PropertiesService to override per user if needed

    var title       = data.title       || 'Study Block';
    var description = data.description || '';
    var startTime   = data.startTime   ? new Date(data.startTime) : new Date();
    var endTime     = data.endTime     ? new Date(data.endTime)   : new Date(startTime.getTime() + 60 * 60 * 1000);

    // If end <= start (e.g. block still running), set end = start + 1h as placeholder
    if (endTime <= startTime) {
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    }

    var notification = {
      method:  'popup',
      minutes: typeof data.notificationMinutesBefore === 'number'
                 ? data.notificationMinutesBefore
                 : 0,
    };

    var eventBody = {
      summary:     title,
      description: description,
      start:       { dateTime: startTime.toISOString(), timeZone: 'Asia/Kolkata' },
      end:         { dateTime: endTime.toISOString(),   timeZone: 'Asia/Kolkata' },
      reminders:   { useDefault: false, overrides: [notification] },
      colorId:     colorIdForAction(data.lifecycleAction),
    };

    var existingEventId = data.calendarEventId || null;
    var event;

    if (existingEventId) {
      // Try to update existing event
      try {
        event = Calendar.Events.patch(eventBody, calendarId, existingEventId);
      } catch (patchErr) {
        // Event was deleted externally — create fresh
        event = Calendar.Events.insert(eventBody, calendarId);
      }
    } else {
      event = Calendar.Events.insert(eventBody, calendarId);
    }

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

function colorIdForAction(action) {
  // Google Calendar color IDs: 1-11
  // https://developers.google.com/calendar/api/v3/reference/colors/get
  switch (action) {
    case 'start':    return '2';  // Sage (green)
    case 'pause':    return '5';  // Banana (yellow)
    case 'resume':   return '2';  // Sage (green)
    case 'complete': return '8';  // Graphite (grey — done)
    default:         return '1';  // Lavender
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration note
// ─────────────────────────────────────────────────────────────────────────────
// 1. Open your Apps Script project (script.google.com)
// 2. Add the two functions above to Code.gs (or a new file calendarHandler.gs)
// 3. In your doPost(e) switch, add the case shown in the comment above
// 4. Re-deploy as a new version (Manage Deployments → New Version)
// 5. The backend calendarBridgeService.js will call SCRIPT_URL with:
//      action: "upsert_calendar_event", ...
// 6. Verify the Apps Script has Calendar API enabled:
//    Editor → Resources → Advanced Google services → Google Calendar API → ON
//    Also enable in Google Cloud Console for the associated project.

import calendars from "calendars";
import { me as companion } from "companion";
import { encode } from 'cbor';
import { outbox } from "file-transfer";
import { settingsStorage as settings } from "settings";

const MILLISECONDS_PER_MINUTE = 1000 * 60;

let CURRENT_EVENTS = null;

/* Implement sync task */
function doSync() {
  if (!companion.permissions.granted("run_background") || !companion.permissions.granted("access_calendar")) {
    send_payload_to_device({
      timestamp: Date.now(),
      error: "Required permissions not granted in the Fitbit App."
    });
    return;
  }

  calendars.searchCalendars()
  .then(calendars => {
    let calendarIdMap = {};
    settings.setItem(
      "calendars",
      JSON.stringify(calendars.sort((a, b) => {
        let atitle = a.title.toUpperCase();
        let btitle = b.title.toUpperCase();
        if (atitle < btitle) {
          return -1;
        } else if (btitle < atitle) {
          return 1;
        }
        return 0;
      }))
    );
    calendars.forEach( cal => {
      let enabledKey = "cal:"+cal['title']+":enabled";
      let colorKey = "cal:"+cal['title']+":color";
      if (settings.getItem(enabledKey) === null) {
        settings.setItem(enabledKey, "false");
      }
      if (settings.getItem(colorKey) === null) {
        settings.setItem(colorKey, '"white"');
      }
      if (settings.getItem(enabledKey) === "true") {
        calendarIdMap[cal.id] = cal['title'];
      }
    });
    return calendarIdMap;
  })
  .then((calendarIdMap) => {
    if (Object.keys(calendarIdMap).length == 0) {
      return [];  // TODO: Propagate to app as error
    }
    /* construct eventsQuery object: the next 24 hours worth of tasks */
    let startDate = new Date();
    let endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    let eventsQuery = { startDate: startDate, endDate: endDate, calendarIds: Object.keys(calendarIdMap) };

    return (
      calendars.searchEvents(eventsQuery)
      .then(function(todayEvents) {
        let day_start = new Date();
        day_start.setHours(0,0,0,0);

        var day_end = new Date();
        day_end.setHours(23,59,59,999);

        let deviceEvents = [];
        todayEvents.forEach(event => {
          let eventIsAllDay = event.isAllDay || (event.startDate <= day_start && event.endDate >= day_end );
          if (
              eventIsAllDay && settings.getItem("timeline_hide_allday") === "true"
              || event.userStatus === "declined" && settings.getItem("timeline_hide_declined") === "true"
              || event.title === "Out of office"
          ) {
            return;
          }

          deviceEvents.push({
            title: event.title,
            description: event.description,
            location: event.location,
            color: getCalendarColour(event.calendarId, calendarIdMap),
            isAccepted: event.userStatus === "accepted" || event.userStatus === "unknown",
            startDateHour: event.isAllDay ? event.startDate.getUTCHours() : event.startDate.getHours(),
            startDateMinute: event.isAllDay ? event.startDate.getUTCMinutes() :  event.startDate.getMinutes(),
            endDateHour: event.isAllDay ? event.endDate.getUTCHours() : event.endDate.getHours(),
            endDateMinute: event.isAllDay ? event.endDate.getUTCMinutes() : event.endDate.getMinutes(),
            startHours: (event.startDate.getTime() + (event.isAllDay ? event.startDate.getTimezoneOffset() * 6e4 : 0)) / 3.6e6,
            endHours: (event.endDate.getTime() + (event.isAllDay ? event.endDate.getTimezoneOffset() * 6e4 : 0)) / 3.6e6,
          });
        });

        return deviceEvents;
      })
    );
  })
  .then(deviceEvents => {
    let payload = {
      timestamp: Date.now()
    };
    if (CURRENT_EVENTS === null || JSON.stringify(deviceEvents) !== JSON.stringify(CURRENT_EVENTS)) {
      CURRENT_EVENTS = deviceEvents;
      payload.events = deviceEvents;
    }
    return payload;
  })
  .catch(error => {
    console.error(JSON.stringify(error));
    let payload = {
      timestamp: Date.now(),
      error: error
    };
    return payload;
  })
  .then(payload => {
    send_payload_to_device(payload);
  });

}

/* Utilities */
function getCalendarColour(calId, calIdMap) {
  return JSON.parse(settings.getItem("cal:"+calIdMap[calId]+":color") || '"white"');
}

function send_payload_to_device(payload) {
  outbox.enqueue("companion_payload", encode(payload)).then(function (ft) {
    // Queued successfully
    console.log("Payload successfully queued.");
  }).catch(function (error) {
    // Failed to queue
    throw new Error("Failed to queue events. Error: " + error);
  });
}

/* Initialise settings */
if (settings.getItem("timeline_hide_allday") === null) {
  settings.setItem("timeline_hide_allday", true);
}
if (settings.getItem("timeline_hide_declined") === null) {
  settings.setItem("timeline_hide_declined", true);
}
if (settings.getItem("timeline_hours") === null) {
  settings.setItem("timeline_hours", "7");
}

/* Set up lifecycle handlers */
companion.wakeInterval = 10 * MILLISECONDS_PER_MINUTE;  // Sync every 10 minutes
companion.addEventListener("wakeinterval", doSync);  // Listen for the event
companion.addEventListener("readystatechange", () => {
  CURRENT_EVENTS=null;
  doSync();
});

// Event fires when a setting is changed
settings.onchange = function(evt) {
  doSync();
}

doSync();

import calendars from "calendars";
import { me as companion } from "companion";
import { encode } from 'cbor';
import { outbox } from "file-transfer";
import { settingsStorage as settings } from "settings";

const MILLISECONDS_PER_MINUTE = 1000 * 60;

let CURRENT_EVENTS = null;

/* Implement sync task */
function doSync() {
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
        settings.setItem(colorKey, "white");
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
    
        let deviceEvents = [];
        todayEvents.forEach(event => {
          if ((event.isAllDay || event.title === "Out of office") && settings.getItem("timeline_hide_allday") === "true" || 
          event.userStatus === "AttendeeStatus.Declined" && settings.getItem("timeline_hide_declined") === "true") {
            return;
          }
          deviceEvents.push({
            title: event.title,
            description: event.description,
            location: event.location,
            color: getCalendarColour(event.calendarId, calendarIdMap),
            startDateHour: event.startDate.getHours(),
            startDateMinute: event.startDate.getMinutes(),
            endDateHour: event.endDate.getHours(),
            endDateMinutes: event.endDate.getMinutes(),
            startHours: event.startDate / 3.6e6,
            endHours: event.endDate / 3.6e6,
          });
        });

        return deviceEvents;
      })
    );
  })
  .then(deviceEvents => {
    if (CURRENT_EVENTS === null || JSON.stringify(deviceEvents) !== JSON.stringify(CURRENT_EVENTS)) {
      CURRENT_EVENTS = deviceEvents;
      outbox.enqueue("calendar_events", encode(deviceEvents)).then(function (ft) {
        // Queued successfully
        console.log("Transfer of events successfully queued.");
      }).catch(function (error) {
        // Failed to queue
        throw new Error("Failed to queue events. Error: " + error);
      });
    }
    outbox.enqueue("calendar_tic", encode(Date.now())).then(function (ft) {
      // Queued successfully
      console.log("Transfer of events successfully queued.");
    }).catch(function (error) {
      // Failed to queue
      throw new Error("Failed to queue events. Error: " + error);
    });
  })
  .catch(error => {
    console.error(error); // TODO: propagate to app
  });
  
}

/* Utilities */
function getCalendarColour(calId, calIdMap) {
  return JSON.parse(settings.getItem("cal:"+calIdMap[calId]+":color") || '"white"');
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
if (!companion.permissions.granted("run_background")) {
  
}
if (!companion.permissions.granted("access_calendar")) {
  console.warn("We're not allowed to access the calendar!");
}
companion.wakeInterval = 10 * MILLISECONDS_PER_MINUTE;  // Sync every 10 minutes
companion.addEventListener("wakeinterval", doSync);  // Listen for the event
companion.addEventListener("readystatechange", doSync);
// Event fires when a setting is changed
settings.onchange = function(evt) {
  doSync();
}

// Begin initial sync
doSync();
import { ClockFace } from "./ui";

let clockFace = new ClockFace();

// Update the <text> element every tick with the current time
import clock from "clock";

clock.granularity = "minutes"; // Update the clock every minute
clock.ontick = (evt) => {
  clockFace.setTime(evt.date);
};

// Change currentEvent back to next when screen turns off
import { display } from "display";

display.addEventListener("change", () => {
  if (!display.on) {
    clockFace.setCurrentEvent(0);
  }
});

// Calendar file updates
import { inbox } from "file-transfer";
import { readFileSync } from "fs";

function updateCalendarEvents() {
  let fileName;
  while ((fileName = inbox.nextFile())) {
    if (fileName === "companion_payload") {
      console.log("Payload received.");
      let payload = readFileSync(fileName, "cbor");
      clockFace.eventsLastUpdated = payload.timestamp;
      clockFace.renderSyncAge();
      if (payload.error !== undefined) {
        clockFace.setError(payload.error);
      } else if (payload.events !== undefined) {
        clockFace.setEvents(payload.events);
      }
    }
  }
}
inbox.addEventListener("newfile", updateCalendarEvents);
updateCalendarEvents();

// Heart rate updates
import { BodyPresenceSensor } from "body-presence";
import { HeartRateSensor } from "heart-rate";

if (BodyPresenceSensor) {
  const bodyPresence = new BodyPresenceSensor();
  bodyPresence.start();
}

if (HeartRateSensor) {
  const hrm = new HeartRateSensor();
  hrm.addEventListener("reading", () => {
    if (BodyPresenceSensor) {
      clockFace.setHeartRate(bodyPresence.present ? hrm.heartRate : null);
    } else {
      clockFace.setHeartRate(hrm.heartRate);
    }
  });
  hrm.start();
}

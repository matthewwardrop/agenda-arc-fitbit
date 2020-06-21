import document from "document";
import { preferences } from "user-settings";  // TODO: Move to index.js

import * as util from "./utils";


let root = document.getElementById('root');
const SCREEN_HEIGHT = root.height;
const SCREEN_WIDTH = root.width;
const UI_TIMELINE_Y_COVERAGE = 0.5;
const UI_CURRENT_TIME_OFFSET = 0.5;  // Hours
const UI_TIMELINE_EVENT_INFO_PADDING = 10;
const UI_TIMELINE_MAX_EVENT_ARCS = 20;
const DAYS = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat"
}
const MONTHS = {
  0: "Jan",
  1: "Feb",
  2: "Mar",
  3: "Apr",
  4: "May",
  5: "Jun",
  6: "Jul",
  7: "Aug",
  8: "Sep",
  9: "Oct",
  10: "Nov",
  11: "Dec"
}

const tick_length = 12;

// Get a handle on the <text> element

const UI_DATE_TEXT = document.getElementById("textDate");
const UI_TIME_TEXT = document.getElementById("textTime");
const UI_SYNCAGE_TEXT = document.getElementById("textSyncAge");
const UI_HEARTRATE_TEXT = document.getElementById("textHeartRate");
const UI_TIMELINE_ARC = document.getElementById("arcTimeline");
const UI_TIMELINE_NOW_TICK = document.getElementById('now');

const UI_STATUS_MESSAGE_TEXT = document.getElementById("statusMessage");
const UI_EVENT_TITLE = document.getElementById("eventName");
const UI_EVENT_DESC = document.getElementById("eventDesc");
const UI_EVENT_LOC = document.getElementById("eventLocation");
const UI_EVENT_PREV = document.getElementById("eventPrev");
const UI_EVENT_NEXT = document.getElementById("eventNext");


export class ClockFace {
  constructor() {
    this.hours_shown = 7;
    this.current_dt = null;
    this.relayout();
    this.events = [];
    this.currentEvent = 0;
    this.currentHours = null;
    this.eventsLastUpdated = -1;
  }

  relayout() {
    this.layoutTimelineArc();
    this.layoutEventInfo();
  }

  layoutTimelineArc() {
    // Prepare timeline circle and arcs
    const radius = SCREEN_WIDTH / 2 / Math.sin(Math.PI / 180 * 2 * this.hours_shown);
    const ctr_y = radius + SCREEN_HEIGHT * (1 - UI_TIMELINE_Y_COVERAGE);
    const ctr_x = SCREEN_WIDTH * 0.5;

    const min_theta = Math.acos(-0.5 * SCREEN_WIDTH / radius);
    const max_theta = Math.acos(0.5 * SCREEN_WIDTH / radius);
    const hour_sep = (max_theta - min_theta) / this.hours_shown;

    UI_TIMELINE_ARC.x = SCREEN_WIDTH / 2 - radius;
    UI_TIMELINE_ARC.y = ctr_y - radius;
    UI_TIMELINE_ARC.width = 2 * radius;
    UI_TIMELINE_ARC.height = 2 * radius;
    UI_TIMELINE_ARC.startAngle = 90 - min_theta * 180 / Math.PI - 10;
    UI_TIMELINE_ARC.sweepAngle = -(max_theta - min_theta) * 180 / Math.PI + 20;

    this.timeline_radius = radius;
    this.timeline_ctr_x = ctr_x;
    this.timeline_ctr_y = ctr_y;
    this.timeline_min_theta = min_theta;
    this.timeline_max_theta = max_theta;
    this.timeline_hour_sep = hour_sep;
    this.timeline_now_theta = UI_CURRENT_TIME_OFFSET * hour_sep + min_theta;
  }

  layoutEventInfo () {

    let bbox = new util.BBox(
      UI_TIMELINE_EVENT_INFO_PADDING, // x
      this.timeline_ctr_y - this.timeline_radius * Math.sin(Math.acos((SCREEN_WIDTH - 2 * UI_TIMELINE_EVENT_INFO_PADDING) / 2 / this.timeline_radius)) + 20,  // y
      SCREEN_WIDTH - 2 * UI_TIMELINE_EVENT_INFO_PADDING, // width
      SCREEN_HEIGHT // height
    );
    bbox.height -= bbox.y;

    const eventNameRatio = 0.3;
    const eventDescRatio = 0.55;
    const eventLocationRatio = 0.15;

    UI_STATUS_MESSAGE_TEXT.text = "Pending sync..."
    UI_STATUS_MESSAGE_TEXT.x = bbox.x;
    UI_STATUS_MESSAGE_TEXT.y = bbox.y;
    UI_STATUS_MESSAGE_TEXT.width = bbox.width;
    UI_STATUS_MESSAGE_TEXT.height = bbox.height;

    UI_EVENT_TITLE.x = UI_TIMELINE_EVENT_INFO_PADDING;
    UI_EVENT_TITLE.y = bbox.y;
    UI_EVENT_TITLE.height = eventNameRatio * bbox.height;
    UI_EVENT_TITLE.width = SCREEN_WIDTH - 2 * UI_TIMELINE_EVENT_INFO_PADDING;
    UI_EVENT_TITLE.fill = "white";
    UI_EVENT_TITLE.style.fontSize = eventNameRatio * bbox.height * 0.8;

    UI_EVENT_DESC.x = UI_TIMELINE_EVENT_INFO_PADDING;
    UI_EVENT_DESC.y = bbox.y + (eventNameRatio) * bbox.height;
    UI_EVENT_DESC.height = eventDescRatio * bbox.height;
    UI_EVENT_DESC.width = SCREEN_WIDTH - 2 * UI_TIMELINE_EVENT_INFO_PADDING;
    UI_EVENT_DESC.style.fontSize = eventDescRatio * bbox.height * 0.8 * 0.3;

    UI_EVENT_LOC.x = UI_TIMELINE_EVENT_INFO_PADDING;
    UI_EVENT_LOC.width = SCREEN_WIDTH - 2 * UI_TIMELINE_EVENT_INFO_PADDING;
    UI_EVENT_DESC.height = eventDescRatio * bbox.height;
    UI_EVENT_LOC.y = bbox.y + (eventNameRatio + eventDescRatio) * bbox.height;
    UI_EVENT_LOC.style.fontSize = eventLocationRatio * bbox.height * 0.8;
    UI_EVENT_LOC.textAnchor = "middle";

    UI_EVENT_PREV.onclick = () => {
      this.incrementCurrentEvent(-1);
    }
    UI_EVENT_NEXT.onclick = () => {
      this.incrementCurrentEvent(1);
    }
  }

  setTime(dt) {
    this.current_dt = dt;
    this.renderTimeText();
    this.renderSyncAge();
    this.renderTimeline();
  }

  setHeartRate(hr) {
    this.current_hr = hr;
    this.renderHeartRate();
  }

  setCurrentEvent(currentEvent) {
    if (currentEvent != this.currentEvent) {
      this.currentEvent = currentEvent;
      this.renderEvents();
    }
  }

  incrementCurrentEvent(offset) {
    if (this.eventsShowing.length > 0) {
        this.setCurrentEvent(
            (this.currentEvent + this.eventsShowing.length + offset) % this.eventsShowing.length
        );
    }
  }

  setEvents(events) {
    this.events = events;
    this.currentEvent = 0;
    this.renderEvents();
    this.renderEventInfo();
  }

  // Rendering of ticks / event info

  renderTimeText() {
    let today = this.current_dt;
    let hours = today.getHours();
    this.currentHours = today / 3.6e6;
    if (preferences.clockDisplay === "12h") {
      // 12h format
      hours = hours % 12 || 12;
    } else {
      // 24h format
      hours = util.zeroPad(hours);
    }
    let mins = util.zeroPad(today.getMinutes());
    UI_TIME_TEXT.text = `${hours}:${mins}`;
    UI_DATE_TEXT.text = `${DAYS[today.getDay()]}, ${MONTHS[today.getMonth()]} ${today.getDate()}`
  }

  renderSyncAge() {
      if (this.eventsLastUpdated < 0) {
        UI_SYNCAGE_TEXT.text = "⏰ Pending...";
      } else {
        UI_SYNCAGE_TEXT.text = "⏰ " + Math.max(0, Math.floor((new Date() - this.eventsLastUpdated) / 60 / 1000)) + " mins";
      }
  }

  renderHeartRate() {
    UI_HEARTRATE_TEXT.text = "♥ " + this.current_hr;
  }

  renderTimeline() {
    let old_min_theta_hours = this.timeline_min_theta_hours;
    this.timeline_min_theta_hours = Math.floor(this.current_dt / 3.6e6 / 0.25 ) * 0.25 - 0.5;

    this.renderNowTick();
    if (this.timeline_min_theta_hours != old_min_theta_hours) {
      this.renderTicks();
      this.renderEventArcs();
    }
  }

  renderTicks() {
    let mins = (this.timeline_min_theta_hours % 1) * 60;
    let startHour = new Date(this.current_dt - UI_CURRENT_TIME_OFFSET * 60 * 60 * 1000).getHours();
    let radius = this.timeline_radius;
    let ctr_x = this.timeline_ctr_x;
    let ctr_y = this.timeline_ctr_y;

    for (let i = 0; i < 9; i++) {
      let el = document.getElementById('tick[' + i + ']');
      let elLabel = document.getElementById("tickLabel[" + i + "]");

      if (preferences.clockDisplay === "12h") {
        elLabel.children[0].text = (startHour + i) % 12 || 12;
      } else {
        elLabel.children[0].text = util.zeroPad((startHour + i) % 24);
      }
      
      elLabel.children[0].style.fontSize = tick_length + 1;
      let theta = this.timeline_min_theta + (i - mins / 60) * this.timeline_hour_sep;

      el.x1 = (radius - 2) * Math.cos(-theta) + ctr_x;
      el.y1 = (radius - 2) * Math.sin(-theta) + ctr_y;

      el.x2 = (radius - 2 - tick_length) * Math.cos(-theta) + ctr_x;
      el.y2 = (radius - 2 - tick_length) * Math.sin(-theta) + ctr_y;

      let labelTheta = theta + 0.1 * this.timeline_hour_sep;
      
      elLabel.groupTransform.translate.x = (radius - 2 - tick_length) * Math.cos(-labelTheta) + ctr_x;
      elLabel.groupTransform.translate.y = (radius - 2 - tick_length) * Math.sin(-labelTheta) + ctr_y;
      elLabel.groupTransform.rotate.angle = -parseInt(Math.round((labelTheta - Math.PI / 2) * 180 / Math.PI));
    }
  }

  renderNowTick() {
    const now_offset = (this.currentHours - this.timeline_min_theta_hours) * this.timeline_hour_sep;

    UI_TIMELINE_NOW_TICK.x1 = this.timeline_radius * Math.cos(-this.timeline_min_theta - now_offset) + this.timeline_ctr_x;
    UI_TIMELINE_NOW_TICK.y1 = this.timeline_radius * Math.sin(-this.timeline_min_theta - now_offset) + this.timeline_ctr_y;
    UI_TIMELINE_NOW_TICK.x2 = (this.timeline_radius + 50) * Math.cos(-this.timeline_min_theta - now_offset) + this.timeline_ctr_x;
    UI_TIMELINE_NOW_TICK.y2 = (this.timeline_radius + 50) * Math.sin(-this.timeline_min_theta - now_offset) + this.timeline_ctr_y;
  }

  renderEvents() {
      this.renderEventArcs();
      this.renderEventInfo();
  }

  renderEventArcs() {
    this.eventsShowing = [];
    let arcIndex = 0;
    let radiusPadding = 12;
    let arcWidth = 5;
    let currentArcWidth = 10;
    let min_theta = this.timeline_min_theta;
    let max_theta = this.timeline_max_theta;
    let hour_sep = this.timeline_hour_sep;
    let ctr_y = this.timeline_ctr_y;

    let tracks = [];

    for (let i = 0; i < this.events.length; i++) {
      let eventInfo = this.events[i];
      let startAngle = min_theta + hour_sep * (eventInfo.startHours - this.timeline_min_theta_hours);
      let sweepAngle = hour_sep * (eventInfo.endHours - eventInfo.startHours);
      let endAngle = startAngle + sweepAngle;

      if (startAngle < this.timeline_max_theta || endAngle > this.timeline_min_theta) {
        continue;
      }

      // Clip startAngle and endAngle to that renderable on screen
      if (startAngle > min_theta) {
        sweepAngle += (startAngle - min_theta);
        startAngle = min_theta;
      }
      if (endAngle < max_theta) {
        sweepAngle = max_theta - startAngle;
      }

      this.eventsShowing.push(eventInfo);

      if (arcIndex >= UI_TIMELINE_MAX_EVENT_ARCS - 1) {
        console.log("Unable to show event due to insufficient arc placeholders.");
        continue;
      }

      let targetTrack = null;
      for (let track = 0; track < tracks.length; track++) {
        if (tracks[track] < eventInfo.startHours) {
          targetTrack = track;
          tracks[track] = eventInfo.endHours;
          break;
        }
      }
      if (targetTrack == null) {
        targetTrack = tracks.length + 1;
        tracks.push(eventInfo.endHours);
      }

      let el = document.getElementById("arc[" + (arcIndex++) + "]");
      el.style.display = "inline";

      let radius = this.timeline_radius + (1 + track) * radiusPadding + (this.currentEvent == i ? (currentArcWidth - arcWidth) / 2 : 0);
      el.x = SCREEN_WIDTH / 2 - radius;
      el.y = ctr_y - radius;
      el.width = 2 * radius;
      el.height = 2 * radius;
      el.arcWidth = this.currentEvent == i ? currentArcWidth : arcWidth;
      el.style.fill = eventInfo.isAccepted === true ? eventInfo.color : "#aaaaaa";

      el.startAngle = util.ang2arc(startAngle);
      el.sweepAngle = Math.max(1, util.ang2sweep(sweepAngle));

    }

    for (let i = arcIndex; i < UI_TIMELINE_MAX_EVENT_ARCS; i++) {
      let el = document.getElementById("arc[" + i + "]");
      el.style.display = "none";
    }

  }

  renderEventInfo() {
    if (this.currentEvent >= this.eventsShowing.length) {
      this.currentEvent = 0;
    }
    let eventShown = this.eventsShowing[this.currentEvent];
    if (this.eventsShowing.length == 0) {
      UI_STATUS_MESSAGE_TEXT.text = "No upcoming events";
      UI_EVENT_TITLE.text = "";
      UI_EVENT_DESC.text = "";
      UI_EVENT_LOC.text = "";
    } else {
      UI_STATUS_MESSAGE_TEXT.text = "";
      UI_EVENT_TITLE.text = eventShown.title || "No Title";
      UI_EVENT_DESC.text = eventShown.description || "No Description";
      UI_EVENT_LOC.text = eventShown.location || "No Location";
    }
  }

}

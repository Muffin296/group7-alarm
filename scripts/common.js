/* Group 7 - Alarm Clock
   common.js - small helpers used by several screens:
   page links, time formats, the alarm draft, sounds, camera and the alarm watcher. */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DRAFT_KEY = "group7-alarm-draft";
const FIRED_KEY = "group7-alarm-fired";

// ids of the dismiss modes in API.json
const MODE_NORMAL = 1;
const MODE_MATH = 2;
const MODE_SHAKE = 3;
const MODE_MISSION = 4;

const SHAKE_TARGET = 20;

/* ---------- Page helpers ---------- */
function byId(id) {
  return document.getElementById(id);
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function pageUrl(page, params) {
  const query = new URLSearchParams();
  for (const key in params) {
    if (params[key] !== null && params[key] !== undefined) {
      query.set(key, params[key]);
    }
  }
  const text = query.toString();
  return text ? page + "?" + text : page;
}

function goTo(page, params) {
  window.location.href = pageUrl(page, params || {});
}

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, function (char) {
    return map[char];
  });
}

function showError(id, message) {
  const box = byId(id);
  box.textContent = message;
  box.classList.remove("hidden");
  box.scrollIntoView({ block: "nearest" });
}

function hideError(id) {
  byId(id).classList.add("hidden");
}

/* ---------- Time helpers ---------- */
function pad(number) {
  return String(number).padStart(2, "0");
}

// "05:30", "PM" -> "17:30" (value of <input type="time">)
function to24h(time, period) {
  const parts = time.split(":").map(Number);
  let hours = parts[0];
  if (period === "AM" && hours === 12) {
    hours = 0;
  }
  if (period === "PM" && hours !== 12) {
    hours += 12;
  }
  return pad(hours) + ":" + pad(parts[1]);
}

// "17:30" -> { time: "05:30", period: "PM" }
function from24h(value) {
  const parts = value.split(":").map(Number);
  const period = parts[0] >= 12 ? "PM" : "AM";
  let hours = parts[0] % 12;
  if (hours === 0) {
    hours = 12;
  }
  return { time: pad(hours) + ":" + pad(parts[1]), period: period };
}

function formatClock(date) {
  const result = from24h(pad(date.getHours()) + ":" + pad(date.getMinutes()));
  return result.time + " " + result.period;
}

function repeatText(repeat) {
  if (!repeat || repeat.length === 0) {
    return "Once";
  }
  if (repeat.length === 7) {
    return "Daily";
  }
  const days = WEEK_ORDER.filter(function (day) {
    return repeat.includes(day);
  });
  if (days.join() === "Mon,Tue,Wed,Thu,Fri") {
    return "Mon-Fri";
  }
  if (days.join() === "Sat,Sun") {
    return "Weekends";
  }
  return days.join(", ");
}

function sortAlarms(alarms) {
  return alarms.sort(function (a, b) {
    return to24h(a.time, a.period).localeCompare(to24h(b.time, b.period));
  });
}

// Next date and time when this alarm will ring
function nextRing(alarm, now) {
  const parts = to24h(alarm.time, alarm.period).split(":").map(Number);
  for (let days = 0; days <= 7; days++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, parts[0], parts[1], 0);
    const dayOk = alarm.repeat.length === 0 || alarm.repeat.includes(DAY_NAMES[date.getDay()]);
    if (date > now && dayOk) {
      return { date: date, days: days };
    }
  }
  return null;
}

// "Tomorrow - 06:30 AM"
function nextAlarmInfo(alarms, now) {
  let best = null;
  alarms.forEach(function (alarm) {
    if (!alarm.enabled) {
      return;
    }
    const ring = nextRing(alarm, now);
    if (ring && (!best || ring.date < best.date)) {
      best = { date: ring.date, days: ring.days, alarm: alarm };
    }
  });
  if (!best) {
    return null;
  }
  let day = DAY_NAMES[best.date.getDay()];
  if (best.days === 0) {
    day = "Today";
  } else if (best.days === 1) {
    day = "Tomorrow";
  }
  return { text: day + " - " + best.alarm.time + " " + best.alarm.period, alarm: best.alarm };
}

/* ---------- Alarm draft ----------
   While the user edits an alarm, the changes are kept in sessionStorage,
   so they are not lost when the ringtone or dismiss mode screen is opened. */
function loadDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY));
  } catch (error) {
    return null;
  }
}

function saveDraft(draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("sessionStorage is not available.");
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    // nothing to clear
  }
}

function editorUrl(draft) {
  return pageUrl("02-alarm-editor.html", { id: draft && draft.id ? draft.id : null });
}

async function newAlarm() {
  const ringtones = await api.get("/ringtone");
  const modes = await api.get("/dismiss_mode");
  return {
    id: null,
    time: "07:00",
    period: "AM",
    label: "",
    repeat: [],
    enabled: true,
    ringtone: ringtones[0],
    dismiss_mode: modes[0],
    mission: null
  };
}

// Draft for screens 03, 04 and 05 (also works if the screen is opened directly)
async function ensureDraft() {
  const idParam = getParam("id");
  const alarmId = idParam ? Number(idParam) : null;
  let draft = loadDraft();
  if (!draft || draft.id !== alarmId) {
    // no draft, or the draft belongs to another alarm
    draft = alarmId ? await api.get("/alarm/" + alarmId) : await newAlarm();
    saveDraft(draft);
  }
  return draft;
}

function modeText(alarm) {
  let text = alarm.dismiss_mode.name;
  if (alarm.dismiss_mode.id === MODE_MISSION && alarm.mission) {
    text += " (" + alarm.mission.type + ")";
  }
  return text;
}

/* ---------- Sounds (Web Audio API, no sound files needed) ---------- */
const RINGTONE_SOUNDS = {
  1: { wave: "sine", notes: [523, 659, 784], step: 0.35 },           // Soft Rise
  2: { wave: "triangle", notes: [988, 0, 988, 0], step: 0.18 },      // Classic Bell
  3: { wave: "square", notes: [880, 0, 880, 0, 880], step: 0.12 },   // Digital Pulse
  4: { wave: "sine", notes: [2093, 2349, 0, 2637, 2093], step: 0.1 }, // Morning Birds
  5: { wave: "sine", notes: [1319, 988], step: 0.45 }                // Chime
};

let audioContext = null;
let ringTimer = null;

function getAudio() {
  if (!audioContext) {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) {
      return null;
    }
    audioContext = new AudioClass();
  }
  return audioContext;
}

function playRingtone(ringtoneId, volume) {
  const context = getAudio();
  if (!context) {
    return;
  }
  if (context.state === "suspended") {
    context.resume();
  }
  const sound = RINGTONE_SOUNDS[ringtoneId] || RINGTONE_SOUNDS[1];
  const level = volume || 0.2;
  let start = context.currentTime;
  sound.notes.forEach(function (frequency) {
    if (frequency > 0) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = sound.wave;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + sound.step);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + sound.step);
    }
    start += sound.step;
  });
}

// Browsers only play sound after the user touched the page,
// so the sound is also started again on the first tap or key press.
function unlockAudio() {
  const context = getAudio();
  if (context && context.state === "suspended") {
    context.resume();
  }
}

function startRinging(ringtoneId, volume) {
  stopRinging();
  playRingtone(ringtoneId, volume);
  ringTimer = setInterval(function () {
    playRingtone(ringtoneId, volume);
  }, 1600);
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("keydown", unlockAudio);
}

function stopRinging() {
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = null;
  }
}

/* ---------- Camera ---------- */
let cameraStream = null;

function setCameraMessage(box, message) {
  box.innerHTML = "<p>" + escapeHtml(message) + "</p>";
}

async function startCamera(box) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setCameraMessage(box, "No camera in this browser. Use the option below.");
    return null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.muted = true;
    video.srcObject = stream;
    box.innerHTML = "";
    box.appendChild(video);
    await video.play();
    cameraStream = stream;
    return video;
  } catch (error) {
    setCameraMessage(box, "Camera blocked or not found. Use the option below.");
    return null;
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(function (track) {
      track.stop();
    });
    cameraStream = null;
  }
}

/* ---------- Images (photo mission) ---------- */
function loadImage(file) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    image.onload = function () {
      resolve(image);
    };
    image.onerror = function () {
      reject(new Error("This image could not be opened."));
    };
    image.src = URL.createObjectURL(file);
  });
}

function sourceSize(source) {
  return {
    width: source.videoWidth || source.naturalWidth || source.width,
    height: source.videoHeight || source.naturalHeight || source.height
  };
}

function makeThumbnail(source, maxSize) {
  const size = sourceSize(source);
  const scale = Math.min(1, maxSize / Math.max(size.width, size.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(size.width * scale);
  canvas.height = Math.round(size.height * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

// "Average hash": the picture is made 8 x 8 grey pixels,
// each pixel brighter than the average = 1, darker = 0.
function imageHash(source) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext("2d");
  context.drawImage(source, 0, 0, 8, 8);
  const pixels = context.getImageData(0, 0, 8, 8).data;
  const greys = [];
  for (let i = 0; i < pixels.length; i += 4) {
    greys.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
  }
  const average = greys.reduce(function (sum, grey) {
    return sum + grey;
  }, 0) / greys.length;
  return greys.map(function (grey) {
    return grey > average ? "1" : "0";
  }).join("");
}

// 100 = same picture, 0 = completely different
function hashSimilarity(hashA, hashB) {
  let same = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] === hashB[i]) {
      same++;
    }
  }
  return Math.round((same / hashA.length) * 100);
}

async function readQrCode(source) {
  if (!("BarcodeDetector" in window)) {
    return null;
  }
  try {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const codes = await detector.detect(source);
    return codes.length > 0 ? codes[0].rawValue : null;
  } catch (error) {
    return null;
  }
}

function codeFromLocation(location) {
  // "Bathroom door" -> "BATHROOM-DOOR"
  return location.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ---------- Alarm watcher ----------
   On the setting screens, check every 2 seconds if an alarm must ring now. */
function startAlarmWatcher() {
  async function check() {
    const now = new Date();
    const hhmm = pad(now.getHours()) + ":" + pad(now.getMinutes());
    const today = DAY_NAMES[now.getDay()];
    const alarms = await api.get("/alarm");
    const due = alarms.find(function (alarm) {
      const dayOk = alarm.repeat.length === 0 || alarm.repeat.includes(today);
      return alarm.enabled && dayOk && to24h(alarm.time, alarm.period) === hhmm;
    });
    if (!due) {
      return;
    }
    const stamp = now.toDateString() + " " + hhmm + " #" + due.id;
    if (readStorage(FIRED_KEY) === stamp) {
      return; // already rang this minute
    }
    writeStorage(FIRED_KEY, stamp);
    if (due.repeat.length === 0) {
      await api.put("/alarm/" + due.id, { enabled: false }); // a "once" alarm turns off
    }
    goTo("06-alarm-ringing.html", { id: due.id });
  }
  check();
  setInterval(check, 2000);
}

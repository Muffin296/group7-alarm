/* Group 7 - Alarm Clock
   app.js - the interactions of every screen.
   Each HTML page has <body data-page="...">, and the function with the
   same name in "pages" runs when the page is loaded. */

const pages = {};

/* =========================================================
   01 Alarm list
   ========================================================= */
function alarmCard(alarm) {
  return "<div class=\"card\">" +
    "<a class=\"alarm-link\" href=\"02-alarm-editor.html?id=" + alarm.id + "\">" +
      "<span class=\"alarm-time\">" + alarm.time + " <small class=\"period\">" + alarm.period + "</small></span>" +
      "<span class=\"muted\">" + escapeHtml(alarm.label) + "</span>" +
      "<span class=\"light\">" + repeatText(alarm.repeat) + "</span>" +
    "</a>" +
    "<input class=\"switch\" type=\"checkbox\" data-id=\"" + alarm.id + "\"" + (alarm.enabled ? " checked" : "") +
      " aria-label=\"" + alarm.time + " " + alarm.period + " on/off\">" +
    "</div>";
}

pages.alarmList = async function () {
  clearDraft(); // a new visit of the list starts with no unsaved alarm
  const listBox = byId("alarm-list");

  async function showNextAlarm(alarms) {
    const next = nextAlarmInfo(alarms, new Date());
    byId("next-alarm").textContent = next ? next.text : "No alarm is on";
    byId("test-ring").classList.toggle("hidden", !next);
    if (next) {
      byId("test-ring").href = "06-alarm-ringing.html?id=" + next.alarm.id;
    }
  }

  async function render() {
    const alarms = sortAlarms(await api.get("/alarm"));
    if (alarms.length === 0) {
      listBox.innerHTML = "<p class=\"muted empty\">No alarm yet. Tap + to add one.</p>";
    } else {
      listBox.innerHTML = alarms.map(alarmCard).join("");
    }
    showNextAlarm(alarms);
  }

  // On / off switch -> PUT /alarm/{id}
  listBox.addEventListener("change", async function (event) {
    if (!event.target.matches(".switch")) {
      return;
    }
    await api.put("/alarm/" + event.target.dataset.id, { enabled: event.target.checked });
    showNextAlarm(await api.get("/alarm"));
  });

  await render();
  startAlarmWatcher();
};

/* =========================================================
   02 Alarm editor (create and edit)
   ========================================================= */
async function validateAlarm(draft, timeValue) {
  if (!timeValue) {
    return "Please choose an alarm time.";
  }
  if (draft.label.length > 30) {
    return "The label must be 30 characters or less.";
  }
  if (draft.dismiss_mode.id === MODE_MISSION && !draft.mission) {
    return "Set up the wake-up mission first (Dismiss mode > Set up).";
  }
  const alarms = await api.get("/alarm");
  const same = alarms.find(function (alarm) {
    return alarm.id !== draft.id && alarm.time === draft.time && alarm.period === draft.period;
  });
  if (same) {
    return "An alarm already exists at " + draft.time + " " + draft.period + " (" + same.label + ").";
  }
  return "";
}

function alarmData(draft) {
  const data = Object.assign({}, draft);
  delete data.id;
  if (!data.label) {
    data.label = "Alarm";
  }
  return data;
}

pages.alarmEditor = async function () {
  const idParam = getParam("id");
  const alarmId = idParam ? Number(idParam) : null;
  const form = byId("alarm-form");
  const timeInput = byId("alarm-time");
  const labelInput = byId("alarm-label");
  const dayBoxes = form.querySelectorAll("input[name='repeat']");

  // Use the draft if the user comes back from the ringtone / dismiss mode screen
  let draft = loadDraft();
  if (!draft || draft.id !== alarmId) {
    draft = alarmId ? await api.get("/alarm/" + alarmId) : await newAlarm();
  }
  saveDraft(draft);

  // Show the data
  byId("editor-title").textContent = alarmId ? "Edit alarm" : "New alarm";
  byId("delete-link").classList.toggle("hidden", !alarmId);
  timeInput.value = to24h(draft.time, draft.period);
  labelInput.value = draft.label;
  dayBoxes.forEach(function (box) {
    box.checked = draft.repeat.includes(box.value);
  });
  byId("ringtone-name").textContent = draft.ringtone.name;
  byId("dismiss-name").textContent = modeText(draft);
  byId("ringtone-link").href = pageUrl("03-ringtone.html", { id: alarmId });
  byId("dismiss-link").href = pageUrl("04-dismiss-mode.html", { id: alarmId });

  function readForm() {
    if (timeInput.value) {
      Object.assign(draft, from24h(timeInput.value));
    }
    draft.label = labelInput.value.trim();
    draft.repeat = [];
    dayBoxes.forEach(function (box) {
      if (box.checked) {
        draft.repeat.push(box.value);
      }
    });
    saveDraft(draft);
  }

  // Keep the changes before going to another screen
  byId("ringtone-link").addEventListener("click", readForm);
  byId("dismiss-link").addEventListener("click", readForm);
  byId("back-link").addEventListener("click", clearDraft);
  form.addEventListener("input", function () {
    hideError("form-error");
  });

  // Delete -> DELETE /alarm/{id}
  byId("delete-link").addEventListener("click", async function (event) {
    event.preventDefault();
    if (!confirm("Delete the " + draft.time + " " + draft.period + " alarm \"" + draft.label + "\"?")) {
      return;
    }
    await api.delete("/alarm/" + alarmId);
    clearDraft();
    goTo("01-alarm-list.html");
  });

  // Save -> POST /alarm (new) or PUT /alarm/{id} (edit)
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    readForm();
    const error = await validateAlarm(draft, timeInput.value);
    if (error) {
      showError("form-error", error);
      return;
    }
    if (alarmId) {
      await api.put("/alarm/" + alarmId, alarmData(draft));
    } else {
      await api.post("/alarm", alarmData(draft));
    }
    clearDraft();
    goTo("01-alarm-list.html");
  });

  startAlarmWatcher();
};

/* =========================================================
   03 Ringtone
   ========================================================= */
pages.ringtone = async function () {
  const draft = await ensureDraft();
  const ringtones = await api.get("/ringtone");
  const list = byId("ringtone-list");

  byId("back-link").href = editorUrl(draft);
  list.innerHTML = ringtones.map(function (ringtone) {
    return "<label class=\"card\">" +
      "<span class=\"icon\">&#9834;</span>" +
      "<span class=\"card-text\"><b>" + escapeHtml(ringtone.name) + "</b>" +
      "<span class=\"light\">" + escapeHtml(ringtone.type) + " - " + ringtone.duration + "</span></span>" +
      "<input type=\"radio\" name=\"ringtone\" value=\"" + ringtone.id + "\"" +
      (ringtone.id === draft.ringtone.id ? " checked" : "") + " aria-label=\"" + escapeHtml(ringtone.name) + "\">" +
      "</label>";
  }).join("");

  // Play a short preview when a sound is chosen
  list.addEventListener("change", function (event) {
    playRingtone(Number(event.target.value), 0.2);
    hideError("form-error");
  });

  byId("ringtone-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const checked = list.querySelector("input:checked");
    if (!checked) {
      showError("form-error", "Please choose a sound.");
      return;
    }
    draft.ringtone = ringtones.find(function (ringtone) {
      return ringtone.id === Number(checked.value);
    });
    saveDraft(draft);
    window.location.href = editorUrl(draft);
  });

  startAlarmWatcher();
};

/* =========================================================
   04 Dismiss mode
   ========================================================= */
pages.dismissMode = async function () {
  const draft = await ensureDraft();
  const modes = await api.get("/dismiss_mode");
  const list = byId("mode-list");

  byId("back-link").href = editorUrl(draft);
  list.innerHTML = modes.map(function (mode) {
    let extra = "";
    if (mode.id === MODE_MISSION) {
      const saved = draft.mission ? draft.mission.type + " - " + escapeHtml(draft.mission.target_location) : "Not set up yet";
      extra = "<span class=\"light\">" + saved + "</span>" +
        "<a class=\"small-link\" id=\"setup-link\" href=\"" + pageUrl("05-mission-setup.html", { id: draft.id }) + "\">Set up &rsaquo;</a>";
    }
    return "<label class=\"card\">" +
      "<input type=\"radio\" name=\"mode\" value=\"" + mode.id + "\"" + (mode.id === draft.dismiss_mode.id ? " checked" : "") + ">" +
      "<span class=\"card-text\"><b>" + escapeHtml(mode.name) + "</b>" +
      "<span class=\"light\">" + escapeHtml(mode.description) + "</span>" + extra + "</span>" +
      "<span class=\"tag tag-l" + mode.level + "\">L" + mode.level + "</span>" +
      "</label>";
  }).join("");

  function modeById(id) {
    return modes.find(function (mode) {
      return mode.id === id;
    });
  }

  list.addEventListener("change", function () {
    hideError("form-error");
  });

  // "Set up" chooses the wake-up mission mode and opens screen 05
  byId("setup-link").addEventListener("click", function () {
    draft.dismiss_mode = modeById(MODE_MISSION);
    saveDraft(draft);
  });

  byId("mode-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const checked = list.querySelector("input:checked");
    if (!checked) {
      showError("form-error", "Please choose a dismiss mode.");
      return;
    }
    const mode = modeById(Number(checked.value));
    if (mode.id === MODE_MISSION && !draft.mission) {
      showError("form-error", "Tap \"Set up\" to register the QR code or photo first.");
      return;
    }
    draft.dismiss_mode = mode;
    saveDraft(draft);
    window.location.href = editorUrl(draft);
  });

  startAlarmWatcher();
};

/* =========================================================
   05 Wake-up mission setup
   ========================================================= */
pages.missionSetup = async function () {
  const draft = await ensureDraft();
  const modes = await api.get("/dismiss_mode");
  const form = byId("mission-form");
  const fileInput = byId("mission-file");
  const locationInput = byId("mission-location");
  const preview = byId("mission-preview");
  const mission = draft.mission;
  let newFile = null; // what was read from the chosen file

  byId("back-link").href = pageUrl("04-dismiss-mode.html", { id: draft.id });

  function selectedType() {
    return form.querySelector("input[name='type']:checked").value;
  }

  function showTab() {
    const type = selectedType();
    const savedHere = mission && mission.type === type;
    byId("target-title").textContent = type === "QR code" ? "Scan or upload your QR" : "Take or upload a photo of the target";
    byId("target-icon").innerHTML = type === "QR code" ? "&#9638;" : "&#9673;";
    byId("target-status").textContent = savedHere ? "A target is already saved. Upload a new file to change it." : "";
    fileInput.value = "";
    newFile = null;
    preview.classList.toggle("hidden", !(savedHere && mission.photo_preview));
    if (savedHere && mission.photo_preview) {
      preview.src = mission.photo_preview;
    }
    hideError("form-error");
  }

  // Fill the form
  if (mission) {
    form.querySelector("input[value='" + mission.type + "']").checked = true;
    locationInput.value = mission.target_location;
  }
  showTab();
  form.querySelectorAll("input[name='type']").forEach(function (radio) {
    radio.addEventListener("change", showTab);
  });
  locationInput.addEventListener("input", function () {
    hideError("form-error");
  });

  // Read the chosen file
  fileInput.addEventListener("change", async function () {
    newFile = null;
    hideError("form-error");
    const file = fileInput.files[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      fileInput.value = "";
      showError("form-error", "Please choose an image file (PNG or JPG).");
      return;
    }
    try {
      const image = await loadImage(file);
      newFile = { name: file.name, preview: makeThumbnail(image, 160) };
      if (selectedType() === "QR code") {
        newFile.qrCode = await readQrCode(image);
        byId("target-status").textContent = newFile.qrCode ? "QR code read: " + newFile.qrCode : "File accepted: " + file.name;
      } else {
        newFile.hash = imageHash(image);
        byId("target-status").textContent = "Reference photo saved: " + file.name;
      }
      URL.revokeObjectURL(image.src);
      preview.src = newFile.preview;
      preview.classList.remove("hidden");
    } catch (error) {
      fileInput.value = "";
      showError("form-error", error.message);
    }
  });

  // Save -> POST or PUT /mission, then the alarm gets the mission
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const type = selectedType();
    const location = locationInput.value.trim();
    const savedHere = mission && mission.type === type;
    if (!newFile && !savedHere) {
      showError("form-error", type === "QR code" ? "Please upload the QR code image." : "Please add a reference photo.");
      return;
    }
    if (!location) {
      showError("form-error", "Please enter the target location.");
      return;
    }

    const data = { type: type, target_location: location, qr_code: null, photo_hash: null, photo_preview: null };
    if (type === "QR code") {
      if (newFile) {
        data.qr_code = newFile.qrCode || codeFromLocation(location);
      } else {
        data.qr_code = mission.qr_code || codeFromLocation(location);
      }
    } else {
      data.photo_hash = newFile ? newFile.hash : mission.photo_hash;
      data.photo_preview = newFile ? newFile.preview : mission.photo_preview;
    }

    const saved = mission && mission.id ? await api.put("/mission/" + mission.id, data) : await api.post("/mission", data);
    draft.mission = saved;
    draft.dismiss_mode = modes.find(function (mode) {
      return mode.id === MODE_MISSION;
    });

    if (draft.id) {
      // Existing alarm: save it and go back to the list (as in the design)
      await api.put("/alarm/" + draft.id, alarmData(draft));
      clearDraft();
      goTo("01-alarm-list.html");
    } else {
      // New alarm: go back to the editor, the user still has to tap "Save alarm"
      saveDraft(draft);
      window.location.href = editorUrl(draft);
    }
  });

  startAlarmWatcher();
};

/* =========================================================
   06 Alarm ringing
   ========================================================= */
async function ringingAlarm() {
  const id = getParam("id");
  if (id) {
    return api.get("/alarm/" + id);
  }
  const alarms = await api.get("/alarm");
  if (alarms.length === 0) {
    throw new Error("There is no alarm. Create one first.");
  }
  const next = nextAlarmInfo(alarms, new Date());
  return next ? next.alarm : alarms[0];
}

function challengeData(alarm, type) {
  const data = { alarm_id: alarm.id, type: type };
  if (type === "shake") {
    data.target = SHAKE_TARGET + " shakes";
  } else if (type === "qr") {
    data.target = alarm.mission.qr_code;
  } else if (type === "photo") {
    data.target = alarm.mission.target_location;
  }
  return data; // for "math" the API chooses the question
}

async function saveDismissal(alarm, challengeName) {
  stopRinging();
  stopCamera();
  const dismissal = await api.post("/dismissal", {
    alarm_id: alarm.id,
    dismissed_at: new Date().toISOString(),
    challenge: challengeName
  });
  goTo("12-alarm-dismissed.html", { id: alarm.id, dismissal: dismissal.id });
}

pages.alarmRinging = async function () {
  const alarm = await ringingAlarm();
  const mode = alarm.dismiss_mode.id;
  const button = byId("start-button");

  byId("ring-time").textContent = alarm.time;
  byId("ring-period").textContent = alarm.period;
  byId("ring-label").textContent = alarm.label;
  byId("ring-sound").textContent = "Sound: " + alarm.ringtone.name;
  byId("ring-mode").textContent = modeText(alarm);
  document.title = "06 Alarm ringing - " + alarm.time + " " + alarm.period;
  if (mode === MODE_NORMAL || (mode === MODE_MISSION && !alarm.mission)) {
    button.textContent = "Dismiss alarm";
  }

  startRinging(alarm.ringtone.id, 0.25);

  byId("ring-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    button.disabled = true;
    let page = null;
    let type = null;
    if (mode === MODE_MATH) {
      page = "07-math-challenge.html";
      type = "math";
    } else if (mode === MODE_SHAKE) {
      page = "09-shake-challenge.html";
      type = "shake";
    } else if (mode === MODE_MISSION && alarm.mission) {
      const isQr = alarm.mission.type === "QR code";
      page = isQr ? "10-qr-scanner.html" : "11-photo-matching.html";
      type = isQr ? "qr" : "photo";
    }
    if (!page) {
      await saveDismissal(alarm, "Tap to dismiss");
      return;
    }
    // POST /challenge, then open the challenge screen
    const challenge = await api.post("/challenge", challengeData(alarm, type));
    goTo(page, { id: alarm.id, challenge: challenge.id });
  });
};

/* =========================================================
   Shared by the challenge screens 07 to 11
   ========================================================= */
async function challengeContext(type) {
  const alarm = await ringingAlarm();
  const challengeId = getParam("challenge");
  let challenge;
  if (challengeId) {
    challenge = await api.get("/challenge/" + challengeId);
  } else {
    if ((type === "qr" || type === "photo") && !alarm.mission) {
      throw new Error("This alarm has no wake-up mission. Set it up in Dismiss mode first.");
    }
    challenge = await api.post("/challenge", challengeData(alarm, type));
  }
  byId("back-link").href = pageUrl("06-alarm-ringing.html", { id: alarm.id });
  startRinging(alarm.ringtone.id, 0.12); // the alarm keeps ringing during the challenge
  return { alarm: alarm, challenge: challenge };
}

async function completeChallenge(context, userInput, challengeName) {
  await api.put("/challenge/" + context.challenge.id, { user_input: String(userInput), completed: true });
  await saveDismissal(context.alarm, challengeName);
}

/* ---------- Math ---------- */
// "27 + 16 = ?" -> 43   (also works with - x and /)
function solveQuestion(target) {
  const tokens = target.split("=")[0].match(/\d+|[-+x*×/÷]/g) || ["0"];
  const terms = [Number(tokens[0])];
  const operators = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const number = Number(tokens[i + 1]);
    if ("x*×".includes(operator)) {
      terms[terms.length - 1] *= number;
    } else if ("/÷".includes(operator)) {
      terms[terms.length - 1] /= number;
    } else {
      operators.push(operator);
      terms.push(number);
    }
  }
  let result = terms[0];
  for (let i = 1; i < terms.length; i++) {
    result = operators[i - 1] === "+" ? result + terms[i] : result - terms[i];
  }
  return result;
}

function setupKeypad(input, beforeTyping) {
  input.addEventListener("input", function () {
    input.value = input.value.replace(/\D/g, "").slice(0, 6);
  });
  byId("keypad").addEventListener("click", function (event) {
    const key = event.target.dataset.key;
    if (!key) {
      return;
    }
    if (beforeTyping) {
      beforeTyping();
    }
    if (key === "clear") {
      input.value = "";
    } else if (key === "back") {
      input.value = input.value.slice(0, -1);
    } else if (input.value.length < 6) {
      input.value += key;
    }
    hideError("form-error");
  });
}

async function checkMathAnswer(context, value) {
  if (!/^\d+$/.test(value)) {
    showError("form-error", "Please enter a number.");
    return;
  }
  if (Number(value) === solveQuestion(context.challenge.target)) {
    await completeChallenge(context, value, "Math challenge");
    return;
  }
  // wrong answer -> PUT /challenge/{id} and open screen 08
  await api.put("/challenge/" + context.challenge.id, { user_input: value, completed: false });
  goTo("08-math-wrong-answer.html", { id: context.alarm.id, challenge: context.challenge.id });
}

pages.mathChallenge = async function () {
  const context = await challengeContext("math");
  const input = byId("answer");
  byId("question").textContent = context.challenge.target;
  input.value = "";
  setupKeypad(input);
  byId("math-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    await checkMathAnswer(context, input.value.trim());
  });
};

pages.mathWrong = async function () {
  const context = await challengeContext("math");
  const input = byId("answer");
  const wrong = context.challenge.user_input || "";
  byId("question").textContent = context.challenge.target;
  byId("wrong-message").textContent = "X Incorrect! " + wrong + " is not the answer. Try again.";
  input.value = wrong;

  function clearWrong() {
    if (input.classList.contains("answer-wrong")) {
      input.classList.remove("answer-wrong");
      input.value = "";
    }
  }

  setupKeypad(input, clearWrong);
  input.addEventListener("focus", clearWrong);
  byId("clear-button").addEventListener("click", function (event) {
    event.preventDefault();
    input.classList.remove("answer-wrong");
    input.value = "";
    input.focus();
  });

  // "Try again": with a new answer it is checked, otherwise screen 07 opens
  byId("math-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const value = input.value.trim();
    if (value === "" || input.classList.contains("answer-wrong")) {
      goTo("07-math-challenge.html", { id: context.alarm.id, challenge: context.challenge.id });
      return;
    }
    await checkMathAnswer(context, value);
  });
};

/* ---------- Shake ---------- */
pages.shakeChallenge = async function () {
  const context = await challengeContext("shake");
  const target = parseInt(context.challenge.target, 10) || SHAKE_TARGET;
  const phone = byId("shake-phone");
  let count = 0;
  let done = false;
  let lastShake = 0;
  let last = null;

  function update() {
    byId("shake-count").textContent = count + " / " + target;
    byId("shake-progress").value = count;
    byId("shake-progress").max = target;
    byId("shake-percent").textContent = Math.round((count / target) * 100) + "% complete";
  }

  async function addShake() {
    if (done) {
      return;
    }
    count++;
    update();
    phone.classList.remove("shaking");
    void phone.offsetWidth; // restart the animation
    phone.classList.add("shaking");
    if (count >= target) {
      done = true;
      await completeChallenge(context, count, "Shake phone");
    }
  }

  // Real phones: count a shake when the movement changes a lot
  function onMotion(event) {
    const a = event.accelerationIncludingGravity;
    if (!a || a.x === null) {
      return;
    }
    byId("shake-hint").classList.add("hidden");
    if (last) {
      const change = Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z);
      const now = Date.now();
      if (change > 25 && now - lastShake > 350) {
        lastShake = now;
        addShake();
      }
    }
    last = { x: a.x, y: a.y, z: a.z };
  }

  update();
  phone.addEventListener("click", addShake); // computers: tap the phone to count a shake

  window.addEventListener("devicemotion", onMotion);

  // iPhone: the motion sensor must be allowed with a tap first
  const needsPermission = typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function";
  if (needsPermission && navigator.maxTouchPoints > 0) {
    const allow = byId("motion-button");
    allow.classList.remove("hidden");
    allow.addEventListener("click", async function () {
      try {
        const answer = await DeviceMotionEvent.requestPermission();
        if (answer === "granted") {
          allow.classList.add("hidden");
        }
      } catch (error) {
        showError("form-error", "The motion sensor could not be used. Tap the phone instead.");
      }
    });
  }
};

/* ---------- QR code ---------- */
pages.qrScanner = async function () {
  const context = await challengeContext("qr");
  const mission = context.alarm.mission;
  const input = byId("qr-input");
  let lastWrong = "";
  let finished = false;

  byId("qr-target").textContent = mission.target_location + " QR";

  async function checkCode(code) {
    if (finished) {
      return;
    }
    if (code.trim().toUpperCase() === String(mission.qr_code).toUpperCase()) {
      finished = true;
      await completeChallenge(context, code, "QR code mission");
      return;
    }
    if (code !== lastWrong) {
      lastWrong = code;
      showError("form-error", "\"" + code + "\" is not the right QR code. Go to the " + mission.target_location + ".");
    }
  }

  byId("qr-form").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!input.value.trim()) {
      showError("form-error", "Please type the code written under the QR code.");
      return;
    }
    checkCode(input.value);
  });
  input.addEventListener("input", function () {
    hideError("form-error");
  });

  // Camera + BarcodeDetector (when the browser has it)
  const video = await startCamera(byId("camera"));
  if (!video) {
    return;
  }
  if (!("BarcodeDetector" in window)) {
    byId("qr-help").textContent = "This browser cannot read QR codes from the camera. Type the code written under the QR code.";
    return;
  }
  const scan = setInterval(async function () {
    if (finished) {
      clearInterval(scan);
      return;
    }
    const code = await readQrCode(video);
    if (code) {
      checkCode(code);
    }
  }, 400);
};

/* ---------- Photo ---------- */
pages.photoMatching = async function () {
  const context = await challengeContext("photo");
  const mission = context.alarm.mission;
  const fileInput = byId("photo-file");
  let video = null;

  byId("photo-target").textContent = mission.target_location;
  if (mission.photo_preview) {
    byId("reference-image").src = mission.photo_preview;
    byId("reference-image").classList.remove("hidden");
  }

  async function verify(source) {
    if (!mission.photo_hash) {
      // no reference picture was registered: any photo is accepted
      await completeChallenge(context, "photo", "Photo mission");
      return;
    }
    const similarity = hashSimilarity(imageHash(source), mission.photo_hash);
    if (similarity >= 80) {
      await completeChallenge(context, similarity + "% similar", "Photo mission");
    } else {
      showError("form-error", "This photo does not match the " + mission.target_location + " (" + similarity + "% similar). Try again.");
    }
  }

  fileInput.addEventListener("change", function () {
    hideError("form-error");
  });

  byId("photo-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (fileInput.files[0]) {
      try {
        const image = await loadImage(fileInput.files[0]);
        await verify(image);
      } catch (error) {
        showError("form-error", error.message);
      }
    } else if (video) {
      await verify(video);
    } else {
      showError("form-error", "Allow the camera or choose a photo first.");
    }
  });

  video = await startCamera(byId("camera"));
};

/* =========================================================
   12 Alarm dismissed
   ========================================================= */
pages.alarmDismissed = async function () {
  stopRinging();
  const id = getParam("dismissal");
  let dismissal = null;
  if (id) {
    dismissal = await api.get("/dismissal/" + id);
  } else {
    const all = await api.get("/dismissal");
    dismissal = all[all.length - 1];
  }
  if (dismissal) {
    byId("dismissed-time").textContent = "Alarm dismissed at " + formatClock(new Date(dismissal.dismissed_at));
    byId("dismissed-challenge").textContent = dismissal.challenge;
  }
};

/* =========================================================
   Start the right page
   ========================================================= */
function showFatalError(error) {
  console.error(error);
  const box = document.createElement("div");
  box.className = "box box-red";
  box.setAttribute("role", "alert");
  box.innerHTML = escapeHtml(error.message) + " <a href=\"01-alarm-list.html\">Back to my alarms</a>";
  document.body.prepend(box);
}

const startPage = pages[document.body.dataset.page];
if (startPage) {
  startPage().catch(showFatalError);
}

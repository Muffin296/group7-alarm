/* Group 7 - Alarm Clock
   api.js - a small fake REST API that runs inside the browser.

   The screens call it like a real server:
     await api.get("/alarm")            -> list of alarms
     await api.get("/alarm/2")          -> one alarm
     await api.post("/alarm", data)     -> create
     await api.put("/alarm/2", data)    -> update
     await api.delete("/alarm/2")       -> delete

   The first time, the data comes from API.json ("database" part).
   After that it is kept in localStorage, so changes stay after a reload.
   The allowed verbs of each endpoint come from the "API" part of API.json. */

const API_FILE = "API.json";
const STORAGE_KEY = "group7-alarm-db";

// Copy of API.json, used when the page is opened by double-click (file://),
// because browsers block fetch() for local files. Keep it the same as API.json.
const FALLBACK_JSON = {
  "data-sample": {
    "challenge": {
      "id": 101,
      "alarm_id": 1,
      "type": "math",
      "target": "27 + 16 = ?",
      "user_input": "41",
      "completed": false
    }
  },
  "API": {
    "/alarm": {
      "verbs": "POST, GET, PUT, DELETE",
      "description": "Get, create, update or delete an alarm (time, label, repeat, on/off, ringtone, dismiss mode)"
    },
    "/ringtone": {
      "verbs": "GET",
      "description": "Get the list of ringtones"
    },
    "/dismiss_mode": {
      "verbs": "GET",
      "description": "Get the list of dismiss modes"
    },
    "/mission": {
      "verbs": "POST, GET, PUT",
      "description": "Get, create or update the wake-up mission target (QR code or photo)"
    },
    "/challenge": {
      "verbs": "POST, GET, PUT",
      "description": "Create a challenge when the alarm rings, get it, or send the user's answer (math, shake, QR, photo)"
    },
    "/dismissal": {
      "verbs": "POST, GET",
      "description": "Save or get the time when the alarm was dismissed"
    }
  },
  "database": {
    "alarm": [
      {
        "id": 1,
        "time": "06:30",
        "period": "AM",
        "label": "Gym morning",
        "repeat": [
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri"
        ],
        "enabled": true,
        "ringtone": {
          "id": 1,
          "name": "Soft Rise",
          "type": "Gentle",
          "duration": "00:24"
        },
        "dismiss_mode": {
          "id": 2,
          "name": "Math challenge",
          "description": "Solve a short puzzle",
          "level": 2
        },
        "mission": {
          "id": 1,
          "type": "QR code",
          "target_location": "Bathroom door",
          "qr_code": "BATHROOM-DOOR",
          "photo_hash": null,
          "photo_preview": null
        }
      },
      {
        "id": 2,
        "time": "07:15",
        "period": "AM",
        "label": "Class",
        "repeat": [
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
          "Sun"
        ],
        "enabled": true,
        "ringtone": {
          "id": 2,
          "name": "Classic Bell",
          "type": "Bright",
          "duration": "00:17"
        },
        "dismiss_mode": {
          "id": 3,
          "name": "Shake phone",
          "description": "Complete a shake target",
          "level": 2
        },
        "mission": null
      },
      {
        "id": 3,
        "time": "08:00",
        "period": "AM",
        "label": "Study",
        "repeat": [
          "Sat",
          "Sun"
        ],
        "enabled": false,
        "ringtone": {
          "id": 4,
          "name": "Morning Birds",
          "type": "Nature",
          "duration": "00:33"
        },
        "dismiss_mode": {
          "id": 4,
          "name": "Wake-up mission",
          "description": "QR scan or matching photo",
          "level": 3
        },
        "mission": {
          "id": 2,
          "type": "Photo",
          "target_location": "Bathroom sink",
          "qr_code": null,
          "photo_hash": null,
          "photo_preview": null
        }
      }
    ],
    "ringtone": [
      {
        "id": 1,
        "name": "Soft Rise",
        "type": "Gentle",
        "duration": "00:24"
      },
      {
        "id": 2,
        "name": "Classic Bell",
        "type": "Bright",
        "duration": "00:17"
      },
      {
        "id": 3,
        "name": "Digital Pulse",
        "type": "Electronic",
        "duration": "00:20"
      },
      {
        "id": 4,
        "name": "Morning Birds",
        "type": "Nature",
        "duration": "00:33"
      },
      {
        "id": 5,
        "name": "Chime",
        "type": "Minimal",
        "duration": "00:14"
      }
    ],
    "dismiss_mode": [
      {
        "id": 1,
        "name": "Normal",
        "description": "Tap to dismiss",
        "level": 1
      },
      {
        "id": 2,
        "name": "Math challenge",
        "description": "Solve a short puzzle",
        "level": 2
      },
      {
        "id": 3,
        "name": "Shake phone",
        "description": "Complete a shake target",
        "level": 2
      },
      {
        "id": 4,
        "name": "Wake-up mission",
        "description": "QR scan or matching photo",
        "level": 3
      }
    ],
    "mission": [
      {
        "id": 1,
        "type": "QR code",
        "target_location": "Bathroom door",
        "qr_code": "BATHROOM-DOOR",
        "photo_hash": null,
        "photo_preview": null
      },
      {
        "id": 2,
        "type": "Photo",
        "target_location": "Bathroom sink",
        "qr_code": null,
        "photo_hash": null,
        "photo_preview": null
      }
    ],
    "challenge": [
      {
        "id": 101,
        "alarm_id": 1,
        "type": "math",
        "target": "27 + 16 = ?",
        "user_input": "41",
        "completed": false
      }
    ],
    "dismissal": [
      {
        "id": 1,
        "alarm_id": 1,
        "dismissed_at": "2026-11-18T06:32:00+07:00",
        "challenge": "Wake-up challenge"
      }
    ]
  }
};

let dbCache = null;

/* ---------- Storage helpers (storage can be blocked, so use try/catch) ---------- */
function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("localStorage is not available, changes are kept only on this page.");
  }
}

function copyOf(value) {
  return JSON.parse(JSON.stringify(value));
}

/* ---------- Load API.json ---------- */
async function loadApiFile() {
  try {
    const response = await fetch(API_FILE);
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    return await response.json();
  } catch (error) {
    console.info("API.json could not be fetched (" + error.message + "), the built-in copy is used.");
    return FALLBACK_JSON;
  }
}

async function getDb() {
  if (dbCache) {
    return dbCache;
  }
  const saved = readStorage(STORAGE_KEY);
  if (saved) {
    try {
      dbCache = JSON.parse(saved);
      return dbCache;
    } catch (error) {
      console.warn("Saved data was broken, loading API.json again.");
    }
  }
  const json = await loadApiFile();
  dbCache = {
    routes: json.API,
    sample: json["data-sample"],
    tables: copyOf(json.database)
  };
  saveDb();
  return dbCache;
}

function saveDb() {
  writeStorage(STORAGE_KEY, JSON.stringify(dbCache));
}

/* ---------- Request handling ---------- */
function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function nextId(table) {
  let max = 0;
  table.forEach(function (row) {
    if (row.id > max) {
      max = row.id;
    }
  });
  return max + 1;
}

function findRow(table, id, resource) {
  const row = table.find(function (item) {
    return item.id === id;
  });
  if (!row) {
    throw apiError(404, "No " + resource + " with id " + id + " was found.");
  }
  return row;
}

// Work the "server" does when a new row is created
function prepareNewRow(resource, row, db) {
  if (resource === "challenge") {
    if (row.type === "math" && !row.target) {
      row.target = db.sample.challenge.target; // "27 + 16 = ?" from API.json
    }
    row.user_input = row.user_input || "";
    row.completed = false;
  }
}

async function request(method, path, body) {
  const db = await getDb();
  const parts = path.split("/").filter(Boolean); // "/alarm/2" -> ["alarm", "2"]
  const resource = parts[0];
  const id = parts[1] ? Number(parts[1]) : null;
  const route = db.routes["/" + resource];

  if (!route) {
    throw apiError(404, "Unknown endpoint /" + resource);
  }
  const verbs = route.verbs.split(",").map(function (verb) {
    return verb.trim();
  });
  if (!verbs.includes(method)) {
    throw apiError(405, method + " is not allowed on /" + resource);
  }

  const table = db.tables[resource];

  if (method === "GET") {
    return copyOf(id === null ? table : findRow(table, id, resource));
  }

  if (method === "POST") {
    const row = Object.assign({}, copyOf(body || {}), { id: nextId(table) });
    prepareNewRow(resource, row, db);
    table.push(row);
    saveDb();
    return copyOf(row);
  }

  if (id === null) {
    throw apiError(400, method + " needs an id, for example /" + resource + "/1");
  }

  if (method === "PUT") {
    const row = findRow(table, id, resource);
    Object.assign(row, copyOf(body || {}), { id: id });
    saveDb();
    return copyOf(row);
  }

  // DELETE
  findRow(table, id, resource);
  db.tables[resource] = table.filter(function (item) {
    return item.id !== id;
  });
  saveDb();
  return { deleted: id };
}

const api = {
  get: function (path) {
    return request("GET", path);
  },
  post: function (path, body) {
    return request("POST", path, body);
  },
  put: function (path, body) {
    return request("PUT", path, body);
  },
  delete: function (path) {
    return request("DELETE", path);
  }
};

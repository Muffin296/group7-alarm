# Group 7 - Alarm Clock prototype (Step 4)

## Folder structure
```
Group7_Prototype/
  01-alarm-list.html ... 12-alarm-dismissed.html, index.html   (HTML at root)
  API.json                 (JSON API at root: schema, endpoints, sample data)
  css/style.css            (the only CSS file)
  scripts/api.js           (fake REST API on top of API.json + localStorage)
  scripts/common.js        (helpers: time, next alarm, draft, sound, camera, photo check)
  scripts/app.js           (the interactions of each screen)
  tests/Group7_Tests.xlsx  (scenario tests with results)
  pwa/                     (manifest.json + icons for "Add to Home Screen" on a phone)
```

## Open the app
- VS Code: right-click `index.html` > "Open with Live Server" (best, opens http://127.0.0.1:5500).
- Or double-click `index.html` (Chrome or Edge). The built-in copy of API.json is used then.

## Check it yourself
1. Follow `tests/Group7_Tests.xlsx` (sheet "Tests") row by row: Action + Test Data, then compare with Expected Result.
2. Start each scenario with fresh data: F12 > Application > Local Storage > delete the key `group7-alarm-db`, then reload.
3. Colours: F12 > Elements, select the element, look at "Computed" (for example the "on" switch is #4765D9).
4. Small phone: F12 > Ctrl+Shift+M, set 360 x 740.
5. Console: `await api.get("/alarm")` shows the saved alarms.

## Demo path
1. List > `+` > 05:45, "Run" > Save alarm.
2. Open an alarm > Ringtone (a preview plays) > Dismiss mode > Save.
3. "Test ring now" in the Next alarm box > Start wake-up challenge:
   Math (answer 43), Shake (shake 20 times, or tap the phone on a computer),
   QR (scan, or type BATHROOM-DOOR), Photo (photo of the registered target).
4. The alarm also rings by itself at its time while screen 01 to 05 is open.

## Use it as an app on an iPhone
The pages carry the iPhone home-screen tags, and `pwa/` holds the manifest and icons.
1. Put the folder on an https address (GitHub Pages) and open it in **Safari** on the iPhone.
2. Share button > "Add to Home Screen" > Add. The "Alarm G7" icon opens the app full screen.
3. The app on the home screen keeps its own data, separate from Safari.
4. Sound: turn off silent mode and tap the screen once after opening the app.
5. The alarm rings only while the app is open on screen (a web page cannot wake a locked phone).
6. Camera (QR, photo) and the shake sensor need https; on a plain http LAN address they do not work.

## Limits
- Data stays in this browser (localStorage); there is no real server.
- QR codes are read by the camera only where the browser has `BarcodeDetector`
  (for example Chrome on Android); elsewhere type the code under the QR.
- The camera needs http://localhost (Live Server) or https.
- Browsers may wait for a first tap on the page before playing the alarm sound.

/* Animohub video page tracker.
 * Sends opens, time on page, video progress and Cal.com bookings to the
 * Make scenario "Video 6 - Page tracker". One record per page in the
 * Make data store "Video views"; Telegram alerts on first open, return
 * visits, 50% watched, full watch and bookings.
 *
 * Bot/scanner guard: nothing is sent until the page has been visible for
 * 5 seconds or the visitor interacts (play, scroll, click, key).
 * Your own views: open any page once with ?me=1 to stop tracking in that
 * browser (?me=0 turns it back on).
 */
(function () {
  "use strict";
  var HOOK = "https://hook.eu1.make.com/lvg5gaiu4jneix7oivks8vj3t44qol43";
  var HEARTBEAT_S = 45;
  var MILESTONES = [25, 50, 75, 95];

  try {
    var q = new URLSearchParams(location.search);
    if (q.get("me") === "1") localStorage.setItem("ahNoTrack", "1");
    if (q.get("me") === "0") localStorage.removeItem("ahNoTrack");
    if (localStorage.getItem("ahNoTrack") === "1") return;
  } catch (e) { /* storage blocked: keep tracking */ }

  var m = location.pathname.match(/\/v\/([^\/]+)/);
  if (!m) return;
  var pageId = m[1];
  var pill = document.querySelector(".pill");
  var company = pill ? pill.textContent.replace(/^\s*Made for\s*/i, "").trim() : "";
  var ua = navigator.userAgent;
  var device = (/Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop") + " · " +
    (/Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "other");

  var opened = false;
  var activeMs = 0, lastTick = null, unsentMs = 0;
  var played = false, maxPct = 0, sentMilestones = {};

  function send(ev, extra) {
    var p = new URLSearchParams();
    p.set("id", pageId); p.set("ev", ev);
    p.set("title", document.title.replace(/\s*·\s*Animohub\s*$/, ""));
    p.set("co", company); p.set("url", location.origin + location.pathname);
    p.set("dev", device);
    if (extra) for (var k in extra) p.set(k, String(extra[k]));
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(HOOK, p)) return;
    } catch (e) {}
    try { fetch(HOOK, { method: "POST", body: p, mode: "no-cors", keepalive: true }); } catch (e) {}
  }

  function tick() {
    var now = Date.now();
    if (lastTick !== null && document.visibilityState === "visible") {
      var dt = now - lastTick;
      if (dt > 0 && dt < 120000) { activeMs += dt; unsentMs += dt; }
    }
    lastTick = now;
  }

  function flush(ev) {
    tick();
    if (!opened) return;
    var d = Math.round(unsentMs / 1000);
    if (d <= 0 && ev === "hb") return;
    unsentMs -= d * 1000;
    send(ev, { d: d, pct: maxPct });
  }

  function markOpen() {
    if (opened) return;
    opened = true;
    tick();
    var d = Math.round(unsentMs / 1000);
    unsentMs -= d * 1000;
    send("open", { d: d, ref: document.referrer || "" });
  }

  // Open = 5 visible seconds or any real interaction.
  lastTick = Date.now();
  var visibleTimer = setInterval(function () {
    tick();
    if (!opened && activeMs >= 5000) markOpen();
  }, 1000);
  ["scroll", "click", "keydown", "touchstart"].forEach(function (t) {
    window.addEventListener(t, markOpen, { once: true, passive: true });
  });

  setInterval(function () { flush("hb"); }, HEARTBEAT_S * 1000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush("leave"); else lastTick = Date.now();
  });
  window.addEventListener("pagehide", function () { flush("leave"); });

  // Video play + progress milestones.
  var video = document.querySelector("video");
  if (video) {
    video.addEventListener("play", function () {
      markOpen();
      if (!played) { played = true; tick(); send("play", { pct: maxPct }); }
    });
    video.addEventListener("timeupdate", function () {
      if (!video.duration || !isFinite(video.duration)) return;
      var pct = Math.floor((video.currentTime / video.duration) * 100);
      if (pct > maxPct) maxPct = pct;
      for (var i = 0; i < MILESTONES.length; i++) {
        var ms = MILESTONES[i];
        if (maxPct >= ms && !sentMilestones[ms]) {
          sentMilestones[ms] = true;
          var d = Math.round((tick(), unsentMs) / 1000);
          unsentMs -= d * 1000;
          send("progress", { pct: ms, d: d });
        }
      }
    });
    video.addEventListener("ended", function () { maxPct = 100; });
  }

  // Cal.com booking on the page.
  function hookCal(tries) {
    if (window.Cal && window.Cal.ns && window.Cal.ns.strategy) {
      var bookedSent = false;
      var onBooked = function () {
        if (bookedSent) return;
        bookedSent = true; markOpen(); send("booked", { pct: maxPct });
      };
      try { window.Cal.ns.strategy("on", { action: "bookingSuccessfulV2", callback: onBooked }); } catch (e) {}
      try { window.Cal.ns.strategy("on", { action: "bookingSuccessful", callback: onBooked }); } catch (e) {}
      return;
    }
    if (tries < 20) setTimeout(function () { hookCal(tries + 1); }, 500);
  }
  hookCal(0);
})();

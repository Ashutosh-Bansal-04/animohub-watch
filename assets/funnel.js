/* Animohub watch page booking funnel.
 *
 * Opt-in per page: add a <script id="ah-funnel" type="application/json">{...}</script>
 * config block, funnel.css and this file. Pages without the config are untouched.
 *
 *  - Pauses the video once at `pauseAtPct` (default 50) and shows the offer popup.
 *  - Shows an end panel over the player when the video finishes.
 *  - Draws the blurred account preview and the proof block under the video.
 *  - Shows a sticky booking bar after the popup is dismissed or the video ends.
 *
 * Booking buttons open Cal.com's own popup in the "strategy" namespace, so
 * track.js still reports bookings to the page tracker.
 */
(function () {
  "use strict";
  var cfgEl = document.getElementById("ah-funnel");
  if (!cfgEl) return;
  var cfg;
  try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }

  var video = document.querySelector(".player video");
  var player = document.querySelector(".player");
  if (!video || !player) return;

  var CAL_LINK = cfg.calLink || "animo-hub-xcswxx/quick-strategy-call";
  var CAL_URL = "https://cal.com/" + CAL_LINK;
  var first = cfg.firstName || "";
  var company = cfg.company || "";
  var pauseAt = cfg.pauseAtPct || 50;
  var pageKey = "ahFunnel:" + location.pathname;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function seen(k) { try { return localStorage.getItem(pageKey + ":" + k) === "1"; } catch (e) { return false; } }
  function mark(k) { try { localStorage.setItem(pageKey + ":" + k, "1"); } catch (e) {} }

  // A button that opens Cal.com's popup (data attributes are read by embed.js).
  var calConfig = JSON.stringify({ layout: "month_view", theme: "dark", name: first,
    notes: "Watched the video for " + company + " (" + (cfg.offerShort || "account list") + ")" });
  function bookBtn(label, extraClass) {
    return '<button type="button" class="ah-btn ah-primary ' + (extraClass || "") + '" data-cal-namespace="strategy" data-cal-link="' +
      esc(CAL_LINK) + '" data-cal-config=\'' + esc(calConfig) + '\'>' + esc(label) + ' &rarr;</button>';
  }

  function listHtml(rows, total) {
    if (!rows || !rows.length) return "";
    var h = '<div class="ah-list"><div class="ah-row ah-head"><span>Company</span><span>Signal</span><span>Buyer + first line</span></div>';
    rows.forEach(function (r) {
      h += '<div class="ah-row"><span class="ah-co">' + esc(r.company) + '</span><span class="ah-sig">' + esc(r.signal) +
        '</span><span class="ah-lock" aria-hidden="true">Owner name &middot; opening line</span></div>';
    });
    if (total && total > rows.length) h += '<div class="ah-more">+ ' + (total - rows.length) + ' more, unlocked on the call</div>';
    return h + "</div>";
  }

  var offer = cfg.offer || {};
  var listTotal = cfg.listTotal || 25;

  // ---------- 1. Mid-video popup ----------
  var modal = document.createElement("div");
  modal.className = "ah-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML =
    '<div class="ah-box">' +
      '<button type="button" class="ah-x" aria-label="Close">&times;</button>' +
      '<div class="ah-kicker">' + esc(offer.kicker || "Quick pause") + '</div>' +
      '<h2>' + esc(offer.headline || (first + ", want the actual list?")) + '</h2>' +
      '<p class="ah-lede">' + esc(offer.body || "") + '</p>' +
      listHtml(cfg.previewRows, listTotal) +
      '<div class="ah-actions">' + bookBtn(offer.button || "Pick a time") +
        '<button type="button" class="ah-btn ah-ghost ah-resume">Keep watching</button></div>' +
      (cfg.replyEmail ? '<span class="ah-small">Not ready for a call? <a href="mailto:' + esc(cfg.replyEmail) +
        '?subject=' + encodeURIComponent("Send me 10 of them") + '&body=' +
        encodeURIComponent("Hi, send me 10 of the accounts for " + company + ".") + '">Get 10 accounts by email instead</a></span>' : "") +
    '</div>';
  document.body.appendChild(modal);

  var modalOpen = false;
  function openModal() {
    if (modalOpen) return;
    modalOpen = true;
    mark("popup");
    try { video.pause(); } catch (e) {}
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen(); } catch (e) {} }
    if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) { try { video.webkitExitFullscreen(); } catch (e) {} }
    modal.classList.add("on");
  }
  function closeModal(resume) {
    if (!modalOpen) return;
    modalOpen = false;
    modal.classList.remove("on");
    showBar();
    if (resume) { try { video.play(); } catch (e) {} }
  }
  modal.querySelector(".ah-x").addEventListener("click", function () { closeModal(false); });
  modal.querySelector(".ah-resume").addEventListener("click", function () { closeModal(true); });
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(false); });
  // Booking button: hand over to Cal.com's popup and get out of the way.
  modal.querySelector("[data-cal-link]").addEventListener("click", function () {
    modalOpen = false; modal.classList.remove("on");
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(false); });

  video.addEventListener("timeupdate", function () {
    if (seen("popup") && !cfg.alwaysPopup) return;
    if (!video.duration || !isFinite(video.duration) || video.paused || video.seeking) return;
    if ((video.currentTime / video.duration) * 100 >= pauseAt) openModal();
  });

  // ---------- 2. End panel over the player ----------
  var steps = cfg.steps || [];
  var end = document.createElement("div");
  end.className = "ah-end";
  end.innerHTML =
    '<div class="ah-kicker">' + esc(cfg.endKicker || "What happens next") + '</div>' +
    '<h2>' + esc(cfg.endHeadline || "Want the full list?") + '</h2>' +
    (steps.length ? '<div class="ah-steps">' + steps.map(function (s, i) {
      return '<div class="ah-step"><b><i>' + (i + 1) + '</i>' + esc(s.title) + '</b>' + esc(s.text) + '</div>';
    }).join("") + '</div>' : "") +
    '<div class="ah-actions">' + bookBtn(offer.button || "Pick a time") +
      '<button type="button" class="ah-btn ah-ghost ah-replay">Replay</button></div>';
  player.appendChild(end);
  video.addEventListener("ended", function () {
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen(); } catch (e) {} }
    end.classList.add("on");
    showBar();
  });
  end.querySelector(".ah-replay").addEventListener("click", function () {
    end.classList.remove("on"); video.currentTime = 0; try { video.play(); } catch (e) {}
  });
  video.addEventListener("play", function () { end.classList.remove("on"); });

  // ---------- 3. Preview + proof sections under the video ----------
  var anchor = document.querySelector(".meta") || player;
  var blocks = "";
  if (cfg.previewRows && cfg.previewRows.length) {
    blocks += '<section class="ah-section"><h2>' + esc(cfg.previewTitle || "A peek at your list") + '</h2>' +
      '<p>' + esc(cfg.previewText || "") + '</p>' + listHtml(cfg.previewRows, listTotal) +
      '<div class="ah-actions">' + bookBtn(offer.button || "Pick a time") + '</div></section>';
  }
  var proof = cfg.proof;
  if (proof) {
    blocks += '<section class="ah-section"><h2>' + esc(proof.title || "Why the call is worth it") + '</h2><div class="ah-proof">' +
      (proof.guarantee ? '<div class="ah-card"><div class="num">' + esc(proof.guarantee.num) + '</div><b>' + esc(proof.guarantee.title) +
        '</b><span>' + esc(proof.guarantee.text) + '</span></div>' : "") +
      (proof.video ? '<a class="ah-card ah-vid" href="' + esc(proof.video.url) + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(proof.video.thumb) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"><div><b>' + esc(proof.video.title) + '</b><span>' +
        esc(proof.video.text) + '</span></div></a>' : "") +
      '</div></section>';
  }
  if (blocks) anchor.insertAdjacentHTML("afterend", blocks);

  // ---------- 4. Sticky booking bar ----------
  var bar = document.createElement("div");
  bar.className = "ah-bar";
  bar.innerHTML = '<p>' + esc(cfg.barText || "Get your account list") + '<span>' + esc(cfg.barSub || "") + '</span></p>' +
    bookBtn(cfg.barButton || "Pick a time") + '<button type="button" class="ah-x" aria-label="Hide">&times;</button>';
  document.body.appendChild(bar);
  var bookSection = document.querySelector("section.book");
  var barHidden = false, barReady = false;
  function inView(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }
  function updateBar() {
    var show = barReady && !barHidden && !modalOpen && !inView(bookSection);
    bar.classList.toggle("on", show);
  }
  function showBar() { if (seen("barclosed")) return; barReady = true; updateBar(); }
  bar.querySelector(".ah-x").addEventListener("click", function () { barHidden = true; mark("barclosed"); updateBar(); });
  window.addEventListener("scroll", updateBar, { passive: true });
  if (seen("popup")) showBar();

})();

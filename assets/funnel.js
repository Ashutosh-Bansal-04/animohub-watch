/* Animohub watch page booking funnel.
 *
 * Opt-in per page: add a <script id="ah-funnel" type="application/json">{...}</script>
 * config block, funnel.css and this file. Pages without the config are untouched.
 *
 *  - Pauses the video once at `pauseAtPct` (default 50) and shows the guarantee popup.
 *  - Shows an end panel over the player when the video finishes.
 *  - Adds the guarantee, formula, bonus (prospect preview) and proof sections under the video.
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
  var first = cfg.firstName || "";
  var company = cfg.company || "";
  var pauseAt = cfg.pauseAtPct || 50;
  var pageKey = "ahFunnel:" + location.pathname;
  var cta = cfg.button || "Book my strategy call";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function seen(k) { try { return localStorage.getItem(pageKey + ":" + k) === "1"; } catch (e) { return false; } }
  function mark(k) { try { localStorage.setItem(pageKey + ":" + k, "1"); } catch (e) {} }

  // A button that opens Cal.com's popup (data attributes are read by embed.js).
  var calConfig = JSON.stringify({ layout: "month_view", theme: "dark", name: first,
    notes: "Watched the video for " + company });
  function bookBtn(label) {
    return '<button type="button" class="ah-btn ah-primary" data-cal-namespace="strategy" data-cal-link="' +
      esc(CAL_LINK) + '" data-cal-config=\'' + esc(calConfig) + '\'>' + esc(label || cta) + ' &rarr;</button>';
  }

  var g = cfg.guarantee || {};
  var bonus = cfg.bonus || {};

  // Prospect cards: company + live signal readable, decision maker and opener locked.
  function prospectsHtml(rows, total) {
    if (!rows || !rows.length) return "";
    var h = '<div class="ah-pros">';
    rows.forEach(function (r) {
      h += '<div class="ah-pro"><div class="ah-pro-top"><span class="ah-co">' + esc(r.company) + '</span>' +
        '<span class="ah-tag">' + esc(r.signal) + '</span></div>' +
        '<div class="ah-pro-locked"><span class="ah-lock" aria-hidden="true">Decision maker name and title</span>' +
        '<span class="ah-lock" aria-hidden="true">Opening line written for this company, unlocked on the call</span></div></div>';
    });
    if (total && total > rows.length) h += '<div class="ah-more">+ ' + (total - rows.length) + ' more prospects, handed over on the call</div>';
    return h + "</div>";
  }
  function bonusPoints() {
    return (bonus.points || []).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join("");
  }

  // ---------- 1. Mid-video popup ----------
  var modal = document.createElement("div");
  modal.className = "ah-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML =
    '<div class="ah-box">' +
      '<button type="button" class="ah-x" aria-label="Close">&times;</button>' +
      '<div class="ah-kicker">' + esc(g.kicker || "Quick pause") + '</div>' +
      '<h2>' + esc(g.popupHeadline || g.headline || "") + '</h2>' +
      '<p class="ah-lede">' + esc(g.popupText || g.text || "") + '</p>' +
      (bonus.title ? '<div class="ah-bonus"><div class="ah-bonus-k">' + esc(bonus.kicker || "Free on the call") + '</div><b>' +
        esc(bonus.title) + '</b><ul>' + bonusPoints() + '</ul></div>' : "") +
      '<div class="ah-actions">' + bookBtn() +
        '<button type="button" class="ah-btn ah-ghost ah-resume">Keep watching</button></div>' +
      (cfg.trustLine ? '<span class="ah-small">' + esc(cfg.trustLine) + '</span>' : "") +
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
    updateBar();
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
    '<h2>' + esc(cfg.endHeadline || g.headline || "") + '</h2>' +
    (steps.length ? '<div class="ah-steps">' + steps.map(function (s, i) {
      return '<div class="ah-step"><b><i>' + (i + 1) + '</i>' + esc(s.title) + '</b>' + esc(s.text) + '</div>';
    }).join("") + '</div>' : "") +
    '<div class="ah-actions">' + bookBtn() +
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

  // ---------- 3. Sections under the video ----------
  var anchor = document.querySelector(".meta") || player;
  var blocks = "";

  // 3a. Guarantee, front and centre.
  if (g.headline) {
    blocks += '<section class="ah-section ah-guarantee"><div class="ah-g-badge"><span class="n">' + esc(g.num || "20") +
      '</span><span class="l">' + esc(g.badge || "meetings in 50 days") + '</span></div><div class="ah-g-body">' +
      '<div class="ah-kicker">' + esc(g.sectionKicker || "Our guarantee") + '</div><h2>' + esc(g.headline) + '</h2>' +
      '<p>' + esc(g.text || "") + '</p>' +
      (g.terms && g.terms.length ? '<ul class="ah-checks">' + g.terms.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("") + '</ul>' : "") +
      '<div class="ah-actions">' + bookBtn() + '</div></div></section>';
  }

  // 3a2. The written sequence (sequence-video pages): the emails as copyable text.
  var sq = cfg.sequence;
  if (sq && sq.emails && sq.emails.length) {
    blocks += '<section class="ah-section"><div class="ah-kicker">' + esc(sq.kicker || "Your sequence") + '</div><h2>' + esc(sq.title || "") + '</h2>' +
      (sq.text ? '<p>' + esc(sq.text) + '</p>' : "") + '<div class="ah-mails">' +
      sq.emails.map(function (m) {
        return '<div class="ah-mail"><div class="ah-mail-meta">' + esc(m.label) + '</div>' +
          (m.subject ? '<div class="ah-mail-subj">' + esc(m.subject) + '</div>' : "") +
          (m.lines || []).map(function (l) { return '<p>' + esc(l) + '</p>'; }).join("") +
          (m.why ? '<div class="ah-mail-why"><b>Why it works:</b> ' + esc(m.why) + '</div>' : "") + '</div>';
      }).join("") + '</div></section>';
  }

  // 3b. The formula.
  var f = cfg.formula;
  if (f && f.parts && f.parts.length) {
    blocks += '<section class="ah-section"><div class="ah-kicker">' + esc(f.kicker || "How we get there") + '</div><h2>' + esc(f.title || "") + '</h2>' +
      (f.text ? '<p>' + esc(f.text) + '</p>' : "") + '<div class="ah-formula">' +
      f.parts.map(function (p, i) {
        return (i ? '<span class="ah-op">+</span>' : "") + '<div class="ah-fx"><b>' + esc(p.title) + '</b><span>' + esc(p.text) + '</span></div>';
      }).join("") + '<span class="ah-op">=</span><div class="ah-fx ah-fx-out"><b>' + esc(f.result || "") + '</b><span>' + esc(f.resultText || "") + '</span></div>' +
      '</div></section>';
  }

  // 3c. Bonus: the prospects, framed as a deliverable.
  if (bonus.title) {
    blocks += '<section class="ah-section ah-bonus-sec"><div class="ah-kicker">' + esc(bonus.kicker || "Free on the call") + '</div><h2>' +
      esc(bonus.sectionTitle || bonus.title) + '</h2><p>' + esc(bonus.text || "") + '</p>' +
      (bonus.points && bonus.points.length ? '<ul class="ah-checks">' + bonusPoints() + '</ul>' : "") +
      prospectsHtml(cfg.previewRows, bonus.total || 25) +
      '<div class="ah-actions">' + bookBtn(bonus.button) + '</div></section>';
  }

  // 3d. Proof.
  var proof = cfg.proof;
  if (proof) {
    blocks += '<section class="ah-section"><div class="ah-kicker">' + esc(proof.kicker || "Why trust us") + '</div><h2>' + esc(proof.title || "") + '</h2>' +
      (proof.text ? '<p>' + esc(proof.text) + '</p>' : "") +
      (proof.stats && proof.stats.length ? '<div class="ah-stats">' + proof.stats.map(function (s) {
        return '<div class="ah-card"><div class="num">' + esc(s.num) + '</div><b>' + esc(s.title) + '</b>' + (s.text ? '<span>' + esc(s.text) + '</span>' : "") + '</div>';
      }).join("") + '</div>' : "") +
      (proof.video ? '<a class="ah-card ah-vid" href="' + esc(proof.video.url) + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(proof.video.thumb) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"><div><b>' + esc(proof.video.title) + '</b><span>' +
        esc(proof.video.text) + '</span></div></a>' : "") +
      (proof.quote ? '<blockquote class="ah-quote">' + esc(proof.quote) + '</blockquote>' : "") +
      '</section>';
  }
  if (blocks) anchor.insertAdjacentHTML("afterend", blocks);

  // ---------- 4. Sticky booking bar ----------
  var bar = document.createElement("div");
  bar.className = "ah-bar";
  bar.innerHTML = '<p>' + esc(cfg.barText || "") + '<span>' + esc(cfg.barSub || "") + '</span></p>' +
    bookBtn(cfg.barButton || "Book a call") + '<button type="button" class="ah-x" aria-label="Hide">&times;</button>';
  document.body.appendChild(bar);
  var bookSection = document.querySelector("section.book");
  var barHidden = false, barReady = false;
  function inView(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }
  function updateBar() {
    bar.classList.toggle("on", barReady && !barHidden && !modalOpen && !inView(bookSection));
  }
  function showBar() { if (seen("barclosed")) return; barReady = true; updateBar(); }
  bar.querySelector(".ah-x").addEventListener("click", function () { barHidden = true; mark("barclosed"); updateBar(); });
  window.addEventListener("scroll", updateBar, { passive: true });
  if (seen("popup")) showBar();
})();

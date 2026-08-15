(function () {
  "use strict";

  var listEl = document.querySelector("#trip-list");
  var statusEl = document.querySelector("#home-status");
  var form = document.querySelector("#create-form");
  var message = document.querySelector("#create-message");
  var loginPrompt = document.querySelector("#login-prompt");
  var loginLink = document.querySelector("#login-link");
  var newTripPanel = document.querySelector("#new-trip");
  var newTripToggle = document.querySelector("#new-trip-toggle");
  var cancelTrip = document.querySelector("#cancel-trip");
  var session = null;
  var appliedUid = undefined;
  var listRequest = 0;
  var debugMode = new URLSearchParams(window.location.search).has("debug");
  var debugEl = null;

  function setStatus(text) {
    statusEl.textContent = text || "";
  }

  function showMessage(text, type) {
    message.textContent = text || "";
    message.className = "message" + (type ? " message-" + type : "");
  }

  function debugLog(text) {
    if (!debugMode) return;
    if (!debugEl) {
      debugEl = document.createElement("pre");
      debugEl.className = "debug-log";
      listEl.parentNode.insertBefore(debugEl, listEl);
    }
    debugEl.textContent +=
      new Date().toISOString().slice(11, 19) + " " + text + "\n";
  }

  function sessionUid(value) {
    return value && value.idToken ? value.uid : null;
  }

  function showLoggedOut() {
    session = null;
    loginPrompt.hidden = false;
    loginLink.href =
      window.PaybackConfig.authOrigin +
      "/?returnTo=" +
      encodeURIComponent(window.location.href);
    newTripToggle.hidden = true;
    newTripPanel.hidden = true;
    listEl.innerHTML = "";
    setStatus("");
  }

  async function renderTrips(activeSession) {
    var requestId = ++listRequest;
    session = activeSession;
    loginPrompt.hidden = true;
    newTripToggle.hidden = false;
    setStatus("Yükleniyor…");

    try {
      var trips = await window.PaybackTrips.listMine(activeSession);
      if (requestId !== listRequest) return;

      debugLog("sorgu ok, kayıt=" + trips.length);

      if (!trips.length) {
        listEl.innerHTML =
          '<p class="empty">Henüz yolculuk yok. Yukarıdan ilkini oluştur.</p>';
        setStatus("");
        return;
      }

      listEl.innerHTML = trips
        .map(function (trip) {
          var peopleCount = (trip.people || []).length;
          var expenseCount = (trip.expenses || []).length;
          return (
            '<a class="trip-card" href="/y/' +
            encodeURIComponent(trip.id) +
            '">' +
            "<h3>" +
            window.PaybackTrips.escapeHtml(trip.title) +
            "</h3>" +
            "<p>" +
            peopleCount +
            " kişi · " +
            expenseCount +
            " harcama</p>" +
            "</a>"
          );
        })
        .join("");
      setStatus(trips.length + " yolculuk");
    } catch (error) {
      if (requestId !== listRequest) return;
      debugLog("sorgu hatası: " + error.message);
      listEl.innerHTML =
        '<p class="empty error">' +
        window.PaybackTrips.escapeHtml(error.message) +
        "</p>";
      setStatus("");
    }
  }

  function applySession(nextSession) {
    var uid = sessionUid(nextSession);
    if (uid === appliedUid) {
      debugLog("aynı oturum, atlandı uid=" + (uid || "yok"));
      return;
    }

    appliedUid = uid;
    debugLog(
      "uygula uid=" +
        (uid || "yok") +
        (nextSession && nextSession.email ? " " + nextSession.email : "")
    );

    if (!uid) {
      showLoggedOut();
      return;
    }

    renderTrips(nextSession);
  }

  async function resolveSession() {
    var client = await window.PaybackTrips.waitForAuth();
    var current = client.getCurrentSession && client.getCurrentSession();
    if (sessionUid(current)) return current;
    return window.PaybackTrips.getOptionalSession();
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    showMessage("Oluşturuluyor…");
    try {
      session = await resolveSession();
      if (!sessionUid(session)) {
        throw new Error("Yolculuk oluşturmak için giriş yap.");
      }
      var trip = await window.PaybackTrips.createTrip(
        {
          title: form.querySelector('[name="title"]').value,
          note: form.querySelector('[name="note"]').value,
          people: [],
          expenses: []
        },
        session
      );
      window.location.assign("/y/" + encodeURIComponent(trip.id));
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  newTripToggle.addEventListener("click", function () {
    newTripPanel.hidden = false;
    newTripToggle.setAttribute("aria-expanded", "true");
    form.querySelector('[name="title"]').focus();
  });

  cancelTrip.addEventListener("click", function () {
    newTripPanel.hidden = true;
    newTripToggle.setAttribute("aria-expanded", "false");
    form.reset();
    showMessage("");
  });

  window.addEventListener("cb-auth-changed", function (event) {
    debugLog("cb-auth-changed");
    applySession(event.detail && event.detail.session);
  });

  debugLog("ua=" + navigator.userAgent);

  resolveSession()
    .then(function (resolved) {
      if (appliedUid === undefined) applySession(resolved);
    })
    .catch(function (error) {
      debugLog("resolve hatası: " + error.message);
      if (appliedUid === undefined) applySession(null);
    });
})();

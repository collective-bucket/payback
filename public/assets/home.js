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
  var loadToken = 0;

  function setStatus(text) {
    statusEl.textContent = text || "";
  }

  function showMessage(text, type) {
    message.textContent = text || "";
    message.className = "message" + (type ? " message-" + type : "");
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

  async function load(preferredSession) {
    var token = ++loadToken;
    var nextSession = preferredSession;

    if (!nextSession || !nextSession.idToken) {
      nextSession = await window.PaybackTrips.getOptionalSession();
    }
    if (token !== loadToken) return;

    if (!nextSession || !nextSession.idToken) {
      showLoggedOut();
      return;
    }

    session = nextSession;
    loginPrompt.hidden = true;
    newTripToggle.hidden = false;
    setStatus("Yükleniyor…");

    try {
      var trips = await window.PaybackTrips.listMine(session);
      if (token !== loadToken) return;

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
      if (token !== loadToken) return;
      listEl.innerHTML =
        '<p class="empty error">' +
        window.PaybackTrips.escapeHtml(error.message) +
        "</p>";
      setStatus("");
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    showMessage("Oluşturuluyor…");
    try {
      session = await window.PaybackTrips.getOptionalSession();
      if (!session || !session.idToken) {
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
    load(event.detail && event.detail.session);
  });

  load();
})();

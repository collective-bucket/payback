(function () {
  "use strict";

  var listEl = document.querySelector("#trip-list");
  var statusEl = document.querySelector("#home-status");
  var form = document.querySelector("#create-form");
  var message = document.querySelector("#create-message");

  function setStatus(text) {
    statusEl.textContent = text || "";
  }

  function showMessage(text, type) {
    message.textContent = text || "";
    message.className = "message" + (type ? " message-" + type : "");
  }

  async function load() {
    var session;
    try {
      session = await window.PaybackTrips.requireSession();
    } catch (error) {
      listEl.innerHTML =
        '<p class="empty error">' +
        window.PaybackTrips.escapeHtml(error.message) +
        "</p>";
      setStatus("");
      return;
    }

    setStatus("Yükleniyor…");
    try {
      var trips = await window.PaybackTrips.listMine(session);
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
      var session = await window.PaybackTrips.requireSession();
      var trip = await window.PaybackTrips.createTrip(
        {
          title: form.title.value,
          note: form.note.value,
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

  load();
})();

(function () {
  "use strict";

  var messageEl = document.querySelector("#trip-message");
  var titleEl = document.querySelector("#trip-title");
  var noteEl = document.querySelector("#trip-note");
  var peopleList = document.querySelector("#people-list");
  var expenseList = document.querySelector("#expense-list");
  var personForm = document.querySelector("#person-form");
  var expenseForm = document.querySelector("#expense-form");
  var payerSelect = document.querySelector("#expense-payer");
  var peopleChecks = document.querySelector("#expense-people");
  var settleBtn = document.querySelector("#settle-btn");
  var ownerActions = document.querySelector("#owner-actions");
  var deleteTripBtn = document.querySelector("#delete-trip");
  var accessPrompt = document.querySelector("#access-prompt");
  var accessTitle = document.querySelector("#access-title");
  var accessText = document.querySelector("#access-text");
  var accessLogin = document.querySelector("#access-login");
  var tripContent = document.querySelector("#trip-content");
  var personToggle = document.querySelector("#person-toggle");
  var personCancel = document.querySelector("#person-cancel");
  var expenseToggle = document.querySelector("#expense-toggle");
  var expenseCancel = document.querySelector("#expense-cancel");

  var trip = null;
  var session = null;
  var canEdit = false;

  function showMessage(text, type) {
    messageEl.textContent = text || "";
    messageEl.className = "message" + (type ? " message-" + type : "");
  }

  function tripIdFromPath() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "y" && parts[1]) return decodeURIComponent(parts[1]);
    var params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  function renderPeople() {
    var people = trip.people || [];
    if (!people.length) {
      peopleList.innerHTML = '<li class="empty">Henüz kişi yok.</li>';
    } else {
      peopleList.innerHTML = people
        .map(function (person) {
          return (
            '<li class="list-item">' +
            '<div><div class="title">' +
            window.PaybackTrips.escapeHtml(person.name) +
            "</div></div>" +
            (canEdit
              ? '<button type="button" class="btn btn-ghost danger" data-remove-person="' +
                window.PaybackTrips.escapeHtml(person.id) +
                '">Sil</button>'
              : "") +
            "</li>"
          );
        })
        .join("");
    }

    payerSelect.innerHTML = people
      .map(function (person) {
        return (
          '<option value="' +
          window.PaybackTrips.escapeHtml(person.id) +
          '">' +
          window.PaybackTrips.escapeHtml(person.name) +
          "</option>"
        );
      })
      .join("");

    peopleChecks.innerHTML = people
      .map(function (person) {
        return (
          '<label><input type="checkbox" name="personIds" value="' +
          window.PaybackTrips.escapeHtml(person.id) +
          '" checked />' +
          window.PaybackTrips.escapeHtml(person.name) +
          "</label>"
        );
      })
      .join("");
  }

  function renderExpenses() {
    var expenses = trip.expenses || [];
    if (!expenses.length) {
      expenseList.innerHTML = '<li class="empty">Henüz harcama yok.</li>';
      return;
    }

    expenseList.innerHTML = expenses
      .slice()
      .reverse()
      .map(function (expense) {
        var included = (expense.personIds || [])
          .map(function (id) {
            return window.PaybackTrips.personName(trip, id);
          })
          .join(", ");
        return (
          '<li class="list-item">' +
          "<div>" +
          '<div class="title">' +
          window.PaybackTrips.escapeHtml(expense.label) +
          " · " +
          window.PaybackTrips.formatMoney(expense.amount) +
          "</div>" +
          '<div class="sub">Ödeyen: ' +
          window.PaybackTrips.escapeHtml(
            window.PaybackTrips.personName(trip, expense.payerId)
          ) +
          " · Dahil: " +
          window.PaybackTrips.escapeHtml(included) +
          "</div></div>" +
          (canEdit
            ? '<button type="button" class="btn btn-ghost danger" data-remove-expense="' +
              window.PaybackTrips.escapeHtml(expense.id) +
              '">Sil</button>'
            : "") +
          "</li>"
        );
      })
      .join("");
  }

  function renderHeader() {
    document.title = trip.title + " | Payback";
    titleEl.textContent = trip.title;
    noteEl.textContent = trip.note || "Kişi ve harcama ekle, sonra hesabı çıkar.";
    settleBtn.href = window.PaybackTrips.publicUrl(trip.id);
    ownerActions.hidden = false;
    personToggle.hidden = !personForm.hidden;
    expenseToggle.hidden = !expenseForm.hidden;
  }

  function renderAll() {
    renderHeader();
    renderPeople();
    renderExpenses();
  }

  async function persist() {
    if (!canEdit || !session) throw new Error("Düzenleme yetkisi yok.");
    trip = await window.PaybackTrips.saveTrip(trip, session);
    renderAll();
  }

  var appliedUid = undefined;
  var bootToken = 0;

  function sessionUid(value) {
    return value && value.idToken ? value.uid : null;
  }

  async function boot(preferredSession) {
    var id = tripIdFromPath();
    if (!id) {
      showMessage("Yolculuk bulunamadı.", "error");
      return;
    }

    var nextSession =
      preferredSession && preferredSession.idToken
        ? preferredSession
        : null;

    if (!nextSession) {
      nextSession = await window.PaybackTrips.getOptionalSession();
    }

    var uid = sessionUid(nextSession);
    if (uid === appliedUid && tripContent && !tripContent.hidden) return;
    appliedUid = uid;

    var token = ++bootToken;

    try {
      session = nextSession;
      if (!sessionUid(session)) {
        accessPrompt.hidden = false;
        accessTitle.textContent = "Giriş gerekli";
        accessText.textContent =
          "Bu yolculuğu düzenlemek için sahibi olarak giriş yap.";
        accessLogin.hidden = false;
        accessLogin.href =
          window.PaybackConfig.authOrigin +
          "/?returnTo=" +
          encodeURIComponent(window.location.href);
        tripContent.hidden = true;
        return;
      }

      trip = await window.PaybackTrips.getTrip(id, session.idToken);
      if (token !== bootToken) return;

      if (!trip) {
        showMessage("Yolculuk bulunamadı.", "error");
        return;
      }
      canEdit = Boolean(session && session.uid === trip.ownerUid);
      if (!canEdit) {
        accessPrompt.hidden = false;
        accessTitle.textContent = "Erişim yok";
        accessText.textContent =
          "Bu düzenleme ekranına yalnızca yolculuk sahibi erişebilir.";
        accessLogin.hidden = true;
        tripContent.hidden = true;
        return;
      }

      accessPrompt.hidden = true;
      tripContent.hidden = false;
      renderAll();
    } catch (error) {
      if (token !== bootToken) return;
      showMessage(error.message, "error");
    }
  }

  window.addEventListener("cb-auth-changed", function (event) {
    var next = event.detail && event.detail.session;
    if (sessionUid(next) === appliedUid) return;
    boot(next);
  });

  personForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!canEdit) return;
    var name = personForm.querySelector("#person-name").value.trim();
    if (!name) return;
    if ((trip.people || []).length >= window.PaybackTrips.MAX_PEOPLE) {
      showMessage("En fazla " + window.PaybackTrips.MAX_PEOPLE + " kişi eklenebilir.", "error");
      return;
    }
    trip.people = (trip.people || []).concat([
      { id: window.PaybackTrips.createId(), name: name }
    ]);
    try {
      await persist();
      personForm.reset();
      personForm.hidden = false;
      personToggle.hidden = true;
      personForm.querySelector("#person-name").focus();
      showMessage("Kişi eklendi.", "success");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  expenseForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!canEdit) return;
    if (!(trip.people || []).length) {
      showMessage("Önce en az bir kişi ekle.", "error");
      return;
    }
    if ((trip.expenses || []).length >= window.PaybackTrips.MAX_EXPENSES) {
      showMessage(
        "En fazla " + window.PaybackTrips.MAX_EXPENSES + " harcama eklenebilir.",
        "error"
      );
      return;
    }

    var personIds = Array.from(
      peopleChecks.querySelectorAll('input[name="personIds"]:checked')
    ).map(function (input) {
      return input.value;
    });

    if (!personIds.length) {
      showMessage("En az bir dahil kişi seç.", "error");
      return;
    }

    trip.expenses = (trip.expenses || []).concat([
      {
        id: window.PaybackTrips.createId(),
        payerId: payerSelect.value,
        label: expenseForm.querySelector("#expense-label").value.trim(),
        amount: Number(expenseForm.querySelector("#expense-amount").value),
        personIds: personIds,
        createdAt: new Date().toISOString()
      }
    ]);

    try {
      await persist();
      expenseForm.querySelector("#expense-label").value = "";
      expenseForm.querySelector("#expense-amount").value = "";
      peopleChecks.querySelectorAll('input[name="personIds"]').forEach(function (input) {
        input.checked = true;
      });
      showMessage("Harcama eklendi.", "success");
      expenseForm.hidden = false;
      expenseToggle.hidden = true;
      expenseForm.querySelector("#expense-label").focus();
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  peopleList.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-remove-person]");
    if (!button || !canEdit) return;
    var id = button.getAttribute("data-remove-person");
    var used = (trip.expenses || []).some(function (expense) {
      return (
        expense.payerId === id ||
        (expense.personIds || []).indexOf(id) >= 0
      );
    });
    if (used) {
      showMessage("Bu kişi bir harcamada geçiyor; önce ilgili harcamaları sil.", "error");
      return;
    }
    trip.people = (trip.people || []).filter(function (person) {
      return person.id !== id;
    });
    try {
      await persist();
      showMessage("Kişi silindi.", "success");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  expenseList.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-remove-expense]");
    if (!button || !canEdit) return;
    var id = button.getAttribute("data-remove-expense");
    trip.expenses = (trip.expenses || []).filter(function (expense) {
      return expense.id !== id;
    });
    try {
      await persist();
      showMessage("Harcama silindi.", "success");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  personToggle.addEventListener("click", function () {
    personForm.hidden = false;
    personToggle.hidden = true;
    personForm.querySelector("#person-name").focus();
  });

  personCancel.addEventListener("click", function () {
    personForm.hidden = true;
    personToggle.hidden = false;
    personForm.reset();
  });

  expenseToggle.addEventListener("click", function () {
    if (!(trip.people || []).length) {
      showMessage("Önce en az bir kişi ekle.", "error");
      return;
    }
    expenseForm.hidden = false;
    expenseToggle.hidden = true;
    expenseForm.querySelector("#expense-label").focus();
  });

  expenseCancel.addEventListener("click", function () {
    expenseForm.hidden = true;
    expenseToggle.hidden = false;
    expenseForm.reset();
    peopleChecks.querySelectorAll('input[name="personIds"]').forEach(function (input) {
      input.checked = true;
    });
  });

  deleteTripBtn.addEventListener("click", async function () {
    if (!canEdit) return;
    if (!window.confirm("Bu yolculuğu silmek istiyor musun?")) return;
    try {
      session = await window.PaybackTrips.requireSession();
      await window.PaybackTrips.removeTrip(trip.id, session);
      window.location.assign("/");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  boot();
})();

(function () {
  "use strict";

  var messageEl = document.querySelector("#trip-message");
  var titleEl = document.querySelector("#trip-title");
  var noteEl = document.querySelector("#trip-note");
  var peopleList = document.querySelector("#people-list");
  var expenseList = document.querySelector("#expense-list");
  var personDialog = document.querySelector("#person-dialog");
  var expenseDialog = document.querySelector("#expense-dialog");
  var confirmDialog = document.querySelector("#confirm-dialog");
  var personForm = document.querySelector("#person-form");
  var expenseForm = document.querySelector("#expense-form");
  var personDialogTitle = document.querySelector("#person-dialog-title");
  var expenseDialogTitle = document.querySelector("#expense-dialog-title");
  var personNameInput = document.querySelector("#person-name");
  var personIbanInput = document.querySelector("#person-iban");
  var personSubmit = document.querySelector("#person-submit");
  var personDelete = document.querySelector("#person-delete");
  var payerSelect = document.querySelector("#expense-payer");
  var peopleChecks = document.querySelector("#expense-people");
  var expenseLabel = document.querySelector("#expense-label");
  var expenseAmount = document.querySelector("#expense-amount");
  var expenseSubmit = document.querySelector("#expense-submit");
  var expenseDelete = document.querySelector("#expense-delete");
  var settleBtn = document.querySelector("#settle-btn");
  var ownerActions = document.querySelector("#owner-actions");
  var deleteTripBtn = document.querySelector("#delete-trip");
  var accessPrompt = document.querySelector("#access-prompt");
  var accessTitle = document.querySelector("#access-title");
  var accessText = document.querySelector("#access-text");
  var accessLogin = document.querySelector("#access-login");
  var tripContent = document.querySelector("#trip-content");
  var personToggle = document.querySelector("#person-toggle");
  var expenseToggle = document.querySelector("#expense-toggle");
  var includeAll = document.querySelector("#include-all");
  var includeNone = document.querySelector("#include-none");
  var confirmTitle = document.querySelector("#confirm-title");
  var confirmText = document.querySelector("#confirm-text");
  var confirmDelete = document.querySelector("#confirm-delete");
  var personMessage = document.querySelector("#person-message");
  var expenseMessage = document.querySelector("#expense-message");

  var trip = null;
  var session = null;
  var canEdit = false;
  var editingPersonId = null;
  var editingExpenseId = null;
  var pendingDelete = null;
  var deleting = false;
  var saving = false;

  function showMessage(text, type) {
    messageEl.textContent = text || "";
    messageEl.className = "message" + (type ? " message-" + type : "");
  }

  function showFormMessage(el, text, type) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "message" + (type ? " message-" + type : "");
  }

  function tripIdFromPath() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "y" && parts[1]) return decodeURIComponent(parts[1]);
    var params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  function cloneTrip(source) {
    return JSON.parse(JSON.stringify(source));
  }

  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog(dialog) {
    if (dialog.open) dialog.close();
  }

  function bindDialog(dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDialog(dialog);
    });
    dialog.querySelectorAll("[data-close-dialog]").forEach(function (button) {
      button.addEventListener("click", function () {
        closeDialog(dialog);
      });
    });
  }

  function selectedPersonIds() {
    return Array.from(
      peopleChecks.querySelectorAll('input[name="personIds"]:checked')
    ).map(function (input) {
      return input.value;
    });
  }

  function setIncludeChecks(personIds, checkedAll) {
    var selected = {};
    (personIds || []).forEach(function (id) {
      selected[id] = true;
    });
    peopleChecks.querySelectorAll('input[name="personIds"]').forEach(function (input) {
      input.checked = checkedAll ? true : Boolean(selected[input.value]);
    });
  }

  function fillPeopleOptions(selectedIds) {
    var people = trip.people || [];
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
          '<label class="chip">' +
          '<input type="checkbox" name="personIds" value="' +
          window.PaybackTrips.escapeHtml(person.id) +
          '" />' +
          "<span>" +
          window.PaybackTrips.escapeHtml(person.name) +
          "</span></label>"
        );
      })
      .join("");

    if (selectedIds) setIncludeChecks(selectedIds, false);
    else setIncludeChecks([], true);
  }

  function resetPersonFormState() {
    editingPersonId = null;
    personForm.reset();
    personDialogTitle.textContent = "Kişi ekle";
    personSubmit.textContent = "Kişi ekle";
    personDelete.hidden = true;
    showFormMessage(personMessage, "");
  }

  function resetExpenseFormState() {
    editingExpenseId = null;
    expenseForm.reset();
    expenseDialogTitle.textContent = "Harcama ekle";
    expenseSubmit.textContent = "Harcama ekle";
    expenseDelete.hidden = true;
    showFormMessage(expenseMessage, "");
    if (trip) fillPeopleOptions();
  }

  function closePersonDialog() {
    closeDialog(personDialog);
    resetPersonFormState();
  }

  function closeExpenseDialog() {
    closeDialog(expenseDialog);
    resetExpenseFormState();
  }

  function readPersonIban() {
    var iban = window.PaybackTrips.normalizeIban(personIbanInput.value);
    if (!window.PaybackTrips.isValidIban(iban)) {
      showFormMessage(
        personMessage,
        "Geçerli bir TR IBAN gir (TR + 24 rakam).",
        "error"
      );
      return null;
    }
    return iban;
  }

  function openPersonDialog(person) {
    closeExpenseDialog();
    showFormMessage(personMessage, "");
    if (person) {
      editingPersonId = person.id;
      personNameInput.value = person.name;
      personIbanInput.value = person.iban
        ? window.PaybackTrips.formatIban(person.iban)
        : "";
      personDialogTitle.textContent = "Kişiyi düzenle";
      personSubmit.textContent = "Kaydet";
      personDelete.hidden = false;
    } else {
      resetPersonFormState();
    }
    openDialog(personDialog);
    personNameInput.focus();
  }

  function openExpenseDialog(expense) {
    if (!(trip.people || []).length) {
      showMessage("Önce en az bir kişi ekle.", "error");
      return;
    }

    closePersonDialog();
    showFormMessage(expenseMessage, "");

    if (expense) {
      editingExpenseId = expense.id;
      expenseLabel.value = expense.label;
      expenseAmount.value = expense.amount;
      fillPeopleOptions(expense.personIds || []);
      payerSelect.value = expense.payerId;
      expenseDialogTitle.textContent = "Harcamayı düzenle";
      expenseSubmit.textContent = "Kaydet";
      expenseDelete.hidden = false;
    } else {
      resetExpenseFormState();
      fillPeopleOptions();
    }

    openDialog(expenseDialog);
    expenseLabel.focus();
  }

  function openConfirm(options) {
    pendingDelete = options;
    confirmTitle.textContent = options.title;
    confirmText.innerHTML =
      "<strong>" +
      window.PaybackTrips.escapeHtml(options.name) +
      "</strong> " +
      options.detail;
    confirmDelete.textContent = options.actionLabel;
    confirmDelete.disabled = false;
    openDialog(confirmDialog);
  }

  function personIsUsed(id) {
    return (trip.expenses || []).some(function (expense) {
      return (
        expense.payerId === id ||
        (expense.personIds || []).indexOf(id) >= 0
      );
    });
  }

  function renderPeople() {
    var people = trip.people || [];
    var expenses = trip.expenses || [];
    if (!people.length) {
      peopleList.innerHTML = '<li class="empty">Henüz kişi yok.</li>';
      return;
    }

    peopleList.innerHTML = people
      .map(function (person) {
        var paid = expenses.filter(function (expense) {
          return expense.payerId === person.id;
        });
        var total = paid.reduce(function (sum, expense) {
          return sum + Number(expense.amount || 0);
        }, 0);
        var labels = paid.map(function (expense) {
          return expense.label;
        });
        var detail = labels.length ? labels.join(", ") : "Harcama yok";
        if (person.iban) {
          detail =
            window.PaybackTrips.formatIban(person.iban) + " · " + detail;
        }
        var title =
          window.PaybackTrips.escapeHtml(person.name) +
          " · " +
          window.PaybackTrips.formatMoney(total);
        var sub = window.PaybackTrips.escapeHtml(detail);
        var body =
          '<div class="list-main"><div class="title">' +
          title +
          '</div><div class="sub">' +
          sub +
          "</div></div>";

        if (!canEdit) {
          return '<li class="list-item">' + body + "</li>";
        }

        return (
          '<li class="list-item is-action" tabindex="0" role="button" data-open-person="' +
          window.PaybackTrips.escapeHtml(person.id) +
          '" aria-label="' +
          window.PaybackTrips.escapeHtml(person.name) +
          ' kişisini düzenle">' +
          body +
          "</li>"
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
        var title =
          window.PaybackTrips.escapeHtml(expense.label) +
          " · " +
          window.PaybackTrips.formatMoney(expense.amount);
        var sub =
          "Ödeyen: " +
          window.PaybackTrips.escapeHtml(
            window.PaybackTrips.personName(trip, expense.payerId)
          ) +
          " · Dahil: " +
          window.PaybackTrips.escapeHtml(included);

        if (!canEdit) {
          return (
            '<li class="list-item">' +
            '<div class="list-main"><div class="title">' +
            title +
            '</div><div class="sub">' +
            sub +
            "</div></div></li>"
          );
        }

        return (
          '<li class="list-item is-action" tabindex="0" role="button" data-open-expense="' +
          window.PaybackTrips.escapeHtml(expense.id) +
          '" aria-label="' +
          window.PaybackTrips.escapeHtml(expense.label) +
          ' harcamasını düzenle">' +
          '<div class="list-main"><div class="title">' +
          title +
          '</div><div class="sub">' +
          sub +
          "</div></div></li>"
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
    personToggle.hidden = !canEdit;
    expenseToggle.hidden = !canEdit;
  }

  function renderAll() {
    renderHeader();
    renderPeople();
    renderExpenses();
  }

  async function persistDraft(nextTrip) {
    if (!canEdit || !session) throw new Error("Düzenleme yetkisi yok.");
    var saved = await window.PaybackTrips.saveTrip(nextTrip, session);
    trip = saved;
    renderAll();
    return saved;
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

  function activateListItem(event, attribute, openFn) {
    var item = event.target.closest("[" + attribute + "]");
    if (!item || !canEdit) return;
    var id = item.getAttribute(attribute);
    openFn(id);
  }

  function handleListKey(event, attribute, openFn) {
    if (event.key !== "Enter" && event.key !== " ") return;
    var item = event.target.closest("[" + attribute + "]");
    if (!item || !canEdit) return;
    event.preventDefault();
    openFn(item.getAttribute(attribute));
  }

  function openPersonById(id) {
    var person = (trip.people || []).find(function (row) {
      return row.id === id;
    });
    if (person) openPersonDialog(person);
  }

  function openExpenseById(id) {
    var expense = (trip.expenses || []).find(function (row) {
      return row.id === id;
    });
    if (expense) openExpenseDialog(expense);
  }

  window.addEventListener("cb-auth-changed", function (event) {
    var next = event.detail && event.detail.session;
    if (sessionUid(next) === appliedUid) return;
    boot(next);
  });

  personForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!canEdit || saving) return;
    var name = personNameInput.value.trim();
    if (!name) return;
    var iban = readPersonIban();
    if (iban === null) return;

    var draft = cloneTrip(trip);
    saving = true;
    personSubmit.disabled = true;

    try {
      if (editingPersonId) {
        draft.people = (draft.people || []).map(function (person) {
          if (person.id !== editingPersonId) return person;
          return { id: person.id, name: name, iban: iban };
        });
        await persistDraft(draft);
        closePersonDialog();
        showMessage("Kişi güncellendi.", "success");
        return;
      }

      if ((draft.people || []).length >= window.PaybackTrips.MAX_PEOPLE) {
        showFormMessage(
          personMessage,
          "En fazla " + window.PaybackTrips.MAX_PEOPLE + " kişi eklenebilir.",
          "error"
        );
        return;
      }

      draft.people = (draft.people || []).concat([
        { id: window.PaybackTrips.createId(), name: name, iban: iban }
      ]);
      await persistDraft(draft);
      resetPersonFormState();
      personNameInput.focus();
      showMessage("Kişi eklendi.", "success");
    } catch (error) {
      showFormMessage(personMessage, error.message, "error");
    } finally {
      saving = false;
      personSubmit.disabled = false;
    }
  });

  expenseForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!canEdit || saving) return;
    if (!(trip.people || []).length) {
      showFormMessage(expenseMessage, "Önce en az bir kişi ekle.", "error");
      return;
    }

    var personIds = selectedPersonIds();
    if (!personIds.length) {
      showFormMessage(expenseMessage, "En az bir dahil kişi seç.", "error");
      return;
    }

    var label = expenseLabel.value.trim();
    var amount = Number(expenseAmount.value);
    var payerId = payerSelect.value;
    var draft = cloneTrip(trip);
    saving = true;
    expenseSubmit.disabled = true;

    try {
      if (editingExpenseId) {
        draft.expenses = (draft.expenses || []).map(function (expense) {
          if (expense.id !== editingExpenseId) return expense;
          return {
            id: expense.id,
            payerId: payerId,
            label: label,
            amount: amount,
            personIds: personIds,
            createdAt: expense.createdAt || new Date().toISOString()
          };
        });
        await persistDraft(draft);
        closeExpenseDialog();
        showMessage("Harcama güncellendi.", "success");
        return;
      }

      if ((draft.expenses || []).length >= window.PaybackTrips.MAX_EXPENSES) {
        showFormMessage(
          expenseMessage,
          "En fazla " + window.PaybackTrips.MAX_EXPENSES + " harcama eklenebilir.",
          "error"
        );
        return;
      }

      draft.expenses = (draft.expenses || []).concat([
        {
          id: window.PaybackTrips.createId(),
          payerId: payerId,
          label: label,
          amount: amount,
          personIds: personIds,
          createdAt: new Date().toISOString()
        }
      ]);

      await persistDraft(draft);
      expenseLabel.value = "";
      expenseAmount.value = "";
      setIncludeChecks([], true);
      expenseDialogTitle.textContent = "Harcama ekle";
      expenseSubmit.textContent = "Harcama ekle";
      expenseDelete.hidden = true;
      editingExpenseId = null;
      showMessage("Harcama eklendi.", "success");
      expenseLabel.focus();
    } catch (error) {
      showFormMessage(expenseMessage, error.message, "error");
    } finally {
      saving = false;
      expenseSubmit.disabled = false;
    }
  });

  peopleList.addEventListener("click", function (event) {
    activateListItem(event, "data-open-person", openPersonById);
  });

  peopleList.addEventListener("keydown", function (event) {
    handleListKey(event, "data-open-person", openPersonById);
  });

  expenseList.addEventListener("click", function (event) {
    activateListItem(event, "data-open-expense", openExpenseById);
  });

  expenseList.addEventListener("keydown", function (event) {
    handleListKey(event, "data-open-expense", openExpenseById);
  });

  personToggle.addEventListener("click", function () {
    openPersonDialog(null);
  });

  expenseToggle.addEventListener("click", function () {
    openExpenseDialog(null);
  });

  includeAll.addEventListener("click", function () {
    setIncludeChecks([], true);
  });

  includeNone.addEventListener("click", function () {
    setIncludeChecks([], false);
  });

  personDelete.addEventListener("click", function () {
    if (!editingPersonId || !canEdit) return;
    if (personIsUsed(editingPersonId)) {
      showFormMessage(
        personMessage,
        "Bu kişi bir harcamada geçiyor; önce ilgili harcamaları sil.",
        "error"
      );
      return;
    }
    var person = (trip.people || []).find(function (row) {
      return row.id === editingPersonId;
    });
    openConfirm({
      type: "person",
      id: editingPersonId,
      title: "Kişi silinsin mi?",
      name: person ? person.name : "Bu kişi",
      detail: "kalıcı olarak silinecek. Bu işlem geri alınamaz.",
      actionLabel: "Kişiyi sil"
    });
  });

  expenseDelete.addEventListener("click", function () {
    if (!editingExpenseId || !canEdit) return;
    var expense = (trip.expenses || []).find(function (row) {
      return row.id === editingExpenseId;
    });
    openConfirm({
      type: "expense",
      id: editingExpenseId,
      title: "Harcama silinsin mi?",
      name: expense ? expense.label : "Bu harcama",
      detail: "kalıcı olarak silinecek. Bu işlem geri alınamaz.",
      actionLabel: "Harcamayı sil"
    });
  });

  deleteTripBtn.addEventListener("click", function () {
    if (!canEdit || !trip) return;
    openConfirm({
      type: "trip",
      id: trip.id,
      title: "Yolculuk silinsin mi?",
      name: trip.title || "Bu yolculuk",
      detail: "kalıcı olarak silinecek. Bu işlem geri alınamaz.",
      actionLabel: "Yolculuğu sil"
    });
  });

  confirmDelete.addEventListener("click", async function () {
    if (!pendingDelete || deleting || !canEdit) return;
    deleting = true;
    confirmDelete.disabled = true;

    try {
      if (pendingDelete.type === "trip") {
        session = await window.PaybackTrips.requireSession();
        await window.PaybackTrips.removeTrip(pendingDelete.id, session);
        window.location.assign("/");
        return;
      }

      var draft = cloneTrip(trip);
      if (pendingDelete.type === "person") {
        if (personIsUsed(pendingDelete.id)) {
          throw new Error(
            "Bu kişi bir harcamada geçiyor; önce ilgili harcamaları sil."
          );
        }
        draft.people = (draft.people || []).filter(function (person) {
          return person.id !== pendingDelete.id;
        });
        await persistDraft(draft);
        pendingDelete = null;
        closeDialog(confirmDialog);
        closePersonDialog();
        showMessage("Kişi silindi.", "success");
        return;
      }

      if (pendingDelete.type === "expense") {
        draft.expenses = (draft.expenses || []).filter(function (expense) {
          return expense.id !== pendingDelete.id;
        });
        await persistDraft(draft);
        pendingDelete = null;
        closeDialog(confirmDialog);
        closeExpenseDialog();
        showMessage("Harcama silindi.", "success");
      }
    } catch (error) {
      showMessage(error.message, "error");
      confirmDelete.disabled = false;
    } finally {
      deleting = false;
    }
  });

  personDialog.addEventListener("close", function () {
    resetPersonFormState();
  });

  expenseDialog.addEventListener("close", function () {
    resetExpenseFormState();
  });

  confirmDialog.addEventListener("close", function () {
    pendingDelete = null;
    confirmDelete.disabled = false;
  });

  bindDialog(personDialog);
  bindDialog(expenseDialog);
  bindDialog(confirmDialog);

  boot();
})();

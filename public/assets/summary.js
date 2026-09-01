(function () {
  "use strict";

  var titleEl = document.querySelector("#summary-title");
  var noteEl = document.querySelector("#summary-note");
  var contentEl = document.querySelector("#summary-content");
  var actionsEl = document.querySelector("#summary-actions");
  var expensesEl = document.querySelector("#summary-expenses");
  var balancesEl = document.querySelector("#summary-balances");
  var paymentsEl = document.querySelector("#summary-payments");
  var personFilter = document.querySelector("#payment-person-filter");
  var messageEl = document.querySelector("#summary-message");
  var shareButton = document.querySelector("#share-summary");
  var copyButton = document.querySelector("#copy-summary-link");
  var summaryUrl = "";
  var summaryTitle = "";
  var trip = null;
  var session = null;
  var canMarkPaid = false;
  var savingPaid = false;
  var filterPersonId = "";

  function summaryIdFromPath() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "s" && parts[1]) return decodeURIComponent(parts[1]);
    return new URLSearchParams(window.location.search).get("id");
  }

  function showMessage(text, type) {
    messageEl.textContent = text || "";
    messageEl.className = "message" + (type ? " message-" + type : "");
  }

  function applySession(nextSession) {
    session = nextSession && nextSession.idToken ? nextSession : null;
    canMarkPaid = Boolean(session && trip && session.uid === trip.ownerUid);
  }

  function paidLookup(source) {
    var map = {};
    ((source && source.paidPayments) || []).forEach(function (key) {
      map[key] = true;
    });
    return map;
  }

  async function copySummaryUrl() {
    await navigator.clipboard.writeText(summaryUrl);
    showMessage("Link kopyalandı.", "success");
  }

  async function sharePayment(row) {
    var title = row.getAttribute("data-share-title") || "";
    var text = row.getAttribute("data-share-text") || "";
    try {
      if (navigator.share) {
        await navigator.share({ title: title, text: text });
        showMessage("Paylaşım ekranı açıldı.", "success");
        return;
      }
      await navigator.clipboard.writeText(text);
      showMessage("Ödeme bilgisi kopyalandı.", "success");
    } catch (error) {
      if (error && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        showMessage("Ödeme bilgisi kopyalandı.", "success");
      } catch {
        showMessage("Paylaşılamadı.", "error");
      }
    }
  }

  function paymentSharePayload(payment, iban) {
    var who = payment.fromName + " → " + payment.toName;
    var amount = window.PaybackTrips.formatMoney(payment.amount);
    var text = who + " · " + amount;
    if (iban) text += "\n" + window.PaybackTrips.formatIban(iban);
    return { title: who, text: text };
  }

  function renderExpenses(source) {
    var expenses = source.expenses || [];
    if (!expenses.length) {
      expensesEl.innerHTML = '<li class="empty">Henüz harcama yok.</li>';
      return;
    }

    expensesEl.innerHTML = expenses
      .slice()
      .reverse()
      .map(function (expense) {
        var included = (expense.personIds || [])
          .map(function (id) {
            return window.PaybackTrips.personName(source, id);
          })
          .join(", ");
        return (
          '<li class="list-item"><div>' +
          '<div class="title">' +
          window.PaybackTrips.escapeHtml(expense.label) +
          " · " +
          window.PaybackTrips.formatMoney(expense.amount) +
          "</div>" +
          '<div class="sub">Ödeyen: ' +
          window.PaybackTrips.escapeHtml(
            window.PaybackTrips.personName(source, expense.payerId)
          ) +
          " · Dahil: " +
          window.PaybackTrips.escapeHtml(included) +
          "</div></div></li>"
        );
      })
      .join("");
  }

  function fillPersonFilter(source) {
    var people = source.people || [];
    personFilter.innerHTML =
      '<option value="">Tümü</option>' +
      people
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
    personFilter.value = filterPersonId;
    if (personFilter.value !== filterPersonId) {
      filterPersonId = "";
      personFilter.value = "";
    }
  }

  function visiblePayments(payments) {
    if (!filterPersonId) return payments;
    return payments.filter(function (payment) {
      return (
        payment.fromId === filterPersonId || payment.toId === filterPersonId
      );
    });
  }

  function renderPayments(source) {
    var result = window.PaybackSettle.settle(source);
    var paid = paidLookup(source);

    if (!result.payments.length) {
      paymentsEl.innerHTML = '<p class="empty">Ödeme gerekmiyor. Herkes denk.</p>';
      return;
    }

    var rows = visiblePayments(result.payments);
    if (!rows.length) {
      paymentsEl.innerHTML = '<p class="empty">Bu kişiye ait ödeme yok.</p>';
      return;
    }

    paymentsEl.innerHTML = rows
      .map(function (payment) {
        var key = window.PaybackTrips.paymentKey(payment.fromId, payment.toId);
        var isPaid = Boolean(paid[key]);
        var iban = window.PaybackTrips.personIban(source, payment.toId);
        var share = paymentSharePayload(payment, iban);
        var ibanHtml = iban
          ? '<div class="payment-iban">' +
            window.PaybackTrips.escapeHtml(
              window.PaybackTrips.formatIban(iban)
            ) +
            "</div>"
          : "";
        var checkbox =
          '<label class="payment-paid">' +
          '<input type="checkbox" data-payment-key="' +
          window.PaybackTrips.escapeHtml(key) +
          '"' +
          (isPaid ? " checked" : "") +
          (canMarkPaid && !savingPaid ? "" : " disabled") +
          ' aria-label="Ödendi olarak işaretle"' +
          (canMarkPaid
            ? ""
            : ' title="Yalnızca yolculuk sahibi işaretleyebilir"') +
          " /></label>";

        return (
          '<div class="payment-row' +
          (isPaid ? " is-paid" : "") +
          '" data-share-title="' +
          window.PaybackTrips.escapeHtml(share.title) +
          '" data-share-text="' +
          window.PaybackTrips.escapeHtml(share.text) +
          '"><div class="payment-main"><div class="payment-who">' +
          window.PaybackTrips.escapeHtml(payment.fromName) +
          " → " +
          window.PaybackTrips.escapeHtml(payment.toName) +
          "</div>" +
          ibanHtml +
          '</div><div class="payment-side"><span class="amount">' +
          window.PaybackTrips.formatMoney(payment.amount) +
          "</span>" +
          checkbox +
          "</div></div>"
        );
      })
      .join("");
  }

  function renderSettlement(source) {
    var result = window.PaybackSettle.settle(source);
    var expenses = source.expenses || [];

    balancesEl.innerHTML = result.status.length
      ? result.status
          .map(function (row) {
            var paidLabels = expenses
              .filter(function (expense) {
                return expense.payerId === row.id;
              })
              .map(function (expense) {
                return expense.label;
              });
            var detail = paidLabels.length
              ? paidLabels.join(", ")
              : "Harcama yok";
            return (
              '<li class="list-item"><div class="list-main">' +
              '<div class="title">' +
              window.PaybackTrips.escapeHtml(row.name) +
              " · " +
              window.PaybackTrips.formatMoney(row.amount) +
              "</div>" +
              '<div class="sub">' +
              window.PaybackTrips.escapeHtml(detail) +
              "</div></div></li>"
            );
          })
          .join("")
      : '<li class="empty">Kişi yok.</li>';

    renderPayments(source);
  }

  async function setPaid(key, checked) {
    if (!trip || !canMarkPaid || savingPaid) {
      if (trip) renderSettlement(trip);
      return;
    }

    var previous = (trip.paidPayments || []).slice();
    var next = previous.filter(function (item) {
      return item !== key;
    });
    if (checked) {
      if (next.length >= window.PaybackTrips.MAX_PAID_PAYMENTS) {
        showMessage(
          "En fazla " +
            window.PaybackTrips.MAX_PAID_PAYMENTS +
            " ödeme işaretlenebilir.",
          "error"
        );
        renderSettlement(trip);
        return;
      }
      next.push(key);
    }

    trip.paidPayments = next;
    savingPaid = true;
    renderSettlement(trip);

    try {
      session = await window.PaybackTrips.requireSession();
      applySession(session);
      trip = await window.PaybackTrips.saveTrip(trip, session);
      showMessage(checked ? "Ödeme ödendi olarak işaretlendi." : "Ödeme işareti kaldırıldı.", "success");
    } catch (error) {
      trip.paidPayments = previous;
      showMessage(error.message, "error");
    } finally {
      savingPaid = false;
      renderSettlement(trip);
    }
  }

  async function boot() {
    var id = summaryIdFromPath();
    if (!id) {
      showMessage("Yolculuk bulunamadı.", "error");
      return;
    }

    try {
      applySession(await window.PaybackTrips.getOptionalSession());
      trip = await window.PaybackTrips.getTrip(id);
      if (!trip) {
        showMessage("Yolculuk bulunamadı.", "error");
        return;
      }

      applySession(session);
      document.title = trip.title + " · Özet | Payback";
      titleEl.textContent = trip.title;
      noteEl.textContent = trip.note || "Yolculuk harcamaları ve hesap özeti.";
      summaryTitle = trip.title;
      summaryUrl = window.PaybackTrips.publicUrl(trip.id);
      fillPersonFilter(trip);
      renderExpenses(trip);
      renderSettlement(trip);
      contentEl.hidden = false;
      actionsEl.hidden = false;
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  shareButton.addEventListener("click", async function () {
    try {
      if (navigator.share) {
        await navigator.share({
          title: summaryTitle + " · Payback",
          text: summaryTitle + " yolculuk özeti",
          url: summaryUrl
        });
        showMessage("Paylaşım ekranı açıldı.", "success");
      } else {
        await copySummaryUrl();
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
      showMessage("Link paylaşılamadı.", "error");
    }
  });

  copyButton.addEventListener("click", async function () {
    try {
      await copySummaryUrl();
    } catch {
      showMessage("Link kopyalanamadı.", "error");
    }
  });

  paymentsEl.addEventListener("click", async function (event) {
    if (event.target.closest(".payment-paid")) return;
    var row = event.target.closest(".payment-row");
    if (!row) return;
    event.preventDefault();
    await sharePayment(row);
  });

  paymentsEl.addEventListener("change", function (event) {
    var input = event.target.closest("[data-payment-key]");
    if (!input) return;
    setPaid(input.getAttribute("data-payment-key"), input.checked);
  });

  personFilter.addEventListener("change", function () {
    filterPersonId = personFilter.value;
    if (trip) renderPayments(trip);
  });

  window.addEventListener("cb-auth-changed", function (event) {
    applySession(event.detail && event.detail.session);
    if (trip) renderSettlement(trip);
  });

  boot();
})();

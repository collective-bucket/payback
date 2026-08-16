(function () {
  "use strict";

  var titleEl = document.querySelector("#summary-title");
  var noteEl = document.querySelector("#summary-note");
  var contentEl = document.querySelector("#summary-content");
  var actionsEl = document.querySelector("#summary-actions");
  var expensesEl = document.querySelector("#summary-expenses");
  var balancesEl = document.querySelector("#summary-balances");
  var paymentsEl = document.querySelector("#summary-payments");
  var messageEl = document.querySelector("#summary-message");
  var shareButton = document.querySelector("#share-summary");
  var copyButton = document.querySelector("#copy-summary-link");
  var summaryUrl = "";
  var summaryTitle = "";

  function summaryIdFromPath() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "s" && parts[1]) return decodeURIComponent(parts[1]);
    return new URLSearchParams(window.location.search).get("id");
  }

  function showMessage(text, type) {
    messageEl.textContent = text || "";
    messageEl.className = "message" + (type ? " message-" + type : "");
  }

  async function copySummaryUrl() {
    await navigator.clipboard.writeText(summaryUrl);
    showMessage("Link kopyalandı.", "success");
  }

  function renderExpenses(trip) {
    var expenses = trip.expenses || [];
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
            return window.PaybackTrips.personName(trip, id);
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
            window.PaybackTrips.personName(trip, expense.payerId)
          ) +
          " · Dahil: " +
          window.PaybackTrips.escapeHtml(included) +
          "</div></div></li>"
        );
      })
      .join("");
  }

  function renderSettlement(trip) {
    var result = window.PaybackSettle.settle(trip);
    var expenses = trip.expenses || [];

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

    paymentsEl.innerHTML = result.payments.length
      ? result.payments
          .map(function (payment) {
            return (
              '<div class="payment-row"><span>' +
              window.PaybackTrips.escapeHtml(payment.fromName) +
              " → " +
              window.PaybackTrips.escapeHtml(payment.toName) +
              '</span><span class="amount">' +
              window.PaybackTrips.formatMoney(payment.amount) +
              "</span></div>"
            );
          })
          .join("")
      : '<p class="empty">Ödeme gerekmiyor. Herkes denk.</p>';
  }

  async function boot() {
    var id = summaryIdFromPath();
    if (!id) {
      showMessage("Yolculuk bulunamadı.", "error");
      return;
    }

    try {
      var trip = await window.PaybackTrips.getTrip(id);
      if (!trip) {
        showMessage("Yolculuk bulunamadı.", "error");
        return;
      }

      document.title = trip.title + " · Özet | Payback";
      titleEl.textContent = trip.title;
      noteEl.textContent = trip.note || "Yolculuk harcamaları ve hesap özeti.";
      summaryTitle = trip.title;
      summaryUrl = window.PaybackTrips.publicUrl(trip.id);
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

  boot();
})();

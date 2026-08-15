(function () {
  "use strict";

  var MAX_PEOPLE = 30;
  var MAX_EXPENSES = 200;

  function nowIso() {
    return new Date().toISOString();
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    }
    return Math.random().toString(36).slice(2, 14);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMoney(amount) {
    var value = Number(amount) || 0;
    return (
      value.toLocaleString("tr-TR", {
        minimumFractionDigits: value % 1 ? 2 : 0,
        maximumFractionDigits: 2
      }) + " ₺"
    );
  }

  async function waitForAuth() {
    var deadline = Date.now() + 10000;
    while (!window.CollectiveBucketAuth) {
      if (Date.now() > deadline) {
        throw new Error("Oturum servisi yüklenemedi.");
      }
      await new Promise(function (resolve) {
        setTimeout(resolve, 50);
      });
    }
    return window.CollectiveBucketAuth;
  }

  async function requireSession() {
    var client = await waitForAuth();
    var session = await client.getSession({ forceRefresh: true });
    if (!session || !session.idToken) {
      window.location.assign(
        window.PaybackConfig.authOrigin +
          "/?returnTo=" +
          encodeURIComponent(window.location.href)
      );
      throw new Error("Giriş gerekli.");
    }
    return session;
  }

  async function getOptionalSession() {
    try {
      var client = await waitForAuth();
      return await client.getSession({ forceRefresh: true });
    } catch {
      return null;
    }
  }

  function normalizePeople(people) {
    if (!Array.isArray(people)) return [];
    return people
      .map(function (person) {
        var name = String((person && person.name) || "").trim().slice(0, 60);
        var id = String((person && person.id) || "").trim().slice(0, 40);
        if (!name || !id) return null;
        return { id: id, name: name };
      })
      .filter(Boolean)
      .slice(0, MAX_PEOPLE);
  }

  function normalizeExpenses(expenses, people) {
    var peopleIds = {};
    normalizePeople(people).forEach(function (person) {
      peopleIds[person.id] = true;
    });

    if (!Array.isArray(expenses)) return [];
    return expenses
      .map(function (expense) {
        var id = String((expense && expense.id) || "").trim().slice(0, 40);
        var payerId = String((expense && expense.payerId) || "").trim();
        var label = String((expense && expense.label) || "").trim().slice(0, 120);
        var amount = Number(expense && expense.amount);
        var personIds = Array.isArray(expense && expense.personIds)
          ? expense.personIds
              .map(function (pid) {
                return String(pid || "").trim();
              })
              .filter(function (pid) {
                return peopleIds[pid];
              })
          : [];

        if (!id || !label || !peopleIds[payerId] || !(amount > 0)) return null;
        if (!personIds.length) return null;

        return {
          id: id,
          payerId: payerId,
          label: label,
          amount: Math.round(amount * 100) / 100,
          personIds: personIds.slice(0, MAX_PEOPLE),
          createdAt: String((expense && expense.createdAt) || nowIso())
        };
      })
      .filter(Boolean)
      .slice(0, MAX_EXPENSES);
  }

  function normalizeTrip(input, session, existing) {
    var title = String((input && input.title) || "").trim().slice(0, 120);
    if (!title) throw new Error("Yolculuk adı zorunlu.");

    var people = normalizePeople(input && input.people);
    var expenses = normalizeExpenses(input && input.expenses, people);

    return {
      ownerUid: existing ? existing.ownerUid : session.uid,
      title: title,
      note: String((input && input.note) || "").trim().slice(0, 500),
      people: people,
      expenses: expenses,
      createdAt: existing ? existing.createdAt || nowIso() : nowIso(),
      updatedAt: nowIso()
    };
  }

  async function listMine(session) {
    var docs = await window.PaybackFirestore.queryEquals(
      "trips",
      "ownerUid",
      session.uid,
      session.idToken
    );
    return docs.sort(function (a, b) {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
  }

  async function getTrip(id, token) {
    return window.PaybackFirestore.getDocument("trips", id, token);
  }

  async function createTrip(input, session) {
    var id = createId();
    var payload = normalizeTrip(input, session, null);
    return window.PaybackFirestore.createDocument(
      "trips",
      id,
      payload,
      session.idToken
    );
  }

  async function saveTrip(trip, session) {
    if (!trip || !trip.id) throw new Error("Yolculuk bulunamadı.");
    if (trip.ownerUid !== session.uid) {
      throw new Error("Bu yolculuğu düzenleme yetkiniz yok.");
    }
    var payload = normalizeTrip(trip, session, trip);
    return window.PaybackFirestore.updateDocument(
      "trips",
      trip.id,
      payload,
      session.idToken
    );
  }

  async function removeTrip(id, session) {
    var existing = await getTrip(id, session.idToken);
    if (!existing) throw new Error("Yolculuk bulunamadı.");
    if (existing.ownerUid !== session.uid) {
      throw new Error("Bu yolculuğu silme yetkiniz yok.");
    }
    await window.PaybackFirestore.deleteDocument("trips", id, session.idToken);
  }

  function publicUrl(id) {
    var origin =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
        ? window.location.origin
        : window.PaybackConfig.siteOrigin;
    return origin + "/s/" + encodeURIComponent(id);
  }

  function personName(trip, personId) {
    var person = ((trip && trip.people) || []).find(function (row) {
      return row.id === personId;
    });
    return person ? person.name : "Bilinmeyen";
  }

  window.PaybackTrips = {
    MAX_PEOPLE: MAX_PEOPLE,
    MAX_EXPENSES: MAX_EXPENSES,
    createId: createId,
    escapeHtml: escapeHtml,
    formatMoney: formatMoney,
    waitForAuth: waitForAuth,
    requireSession: requireSession,
    getOptionalSession: getOptionalSession,
    listMine: listMine,
    getTrip: getTrip,
    createTrip: createTrip,
    saveTrip: saveTrip,
    removeTrip: removeTrip,
    publicUrl: publicUrl,
    personName: personName,
    normalizePeople: normalizePeople,
    normalizeExpenses: normalizeExpenses
  };
})();

(function () {
  "use strict";

  // Kuruş cinsinden çalışır; UI TL gösterir.
  function toCents(amount) {
    return Math.round(Number(amount) * 100);
  }

  function fromCents(cents) {
    return Math.round(cents) / 100;
  }

  function balances(people, expenses) {
    var map = {};
    (people || []).forEach(function (person) {
      map[person.id] = { id: person.id, name: person.name, cents: 0 };
    });

    (expenses || []).forEach(function (expense) {
      var included = (expense.personIds || []).filter(function (id) {
        return map[id];
      });
      if (!included.length || !map[expense.payerId]) return;

      var total = toCents(expense.amount);
      if (total <= 0) return;

      var n = included.length;
      var base = Math.floor(total / n);
      var remainder = total - base * n;

      map[expense.payerId].cents += total;

      included.forEach(function (id, index) {
        // Kalan kuruşları ilk kişilere dağıt (ödeyene öncelik yok;
        // deterministik sıra personIds sırasıdır).
        map[id].cents -= base + (index < remainder ? 1 : 0);
      });
    });

    return Object.keys(map).map(function (id) {
      return {
        id: map[id].id,
        name: map[id].name,
        amount: fromCents(map[id].cents),
        cents: map[id].cents
      };
    });
  }

  function spending(people, expenses) {
    var map = {};
    (people || []).forEach(function (person) {
      map[person.id] = { id: person.id, name: person.name, cents: 0 };
    });

    (expenses || []).forEach(function (expense) {
      if (!map[expense.payerId]) return;
      var total = toCents(expense.amount);
      if (total > 0) map[expense.payerId].cents += total;
    });

    return Object.keys(map).map(function (id) {
      return {
        id: map[id].id,
        name: map[id].name,
        amount: fromCents(map[id].cents),
        cents: map[id].cents
      };
    });
  }

  function payments(people, expenses) {
    var status = balances(people, expenses)
      .map(function (row) {
        return {
          id: row.id,
          name: row.name,
          cents: row.cents
        };
      })
      .filter(function (row) {
        return row.cents !== 0;
      });

    var debtors = status
      .filter(function (row) {
        return row.cents < 0;
      })
      .map(function (row) {
        return { id: row.id, name: row.name, cents: -row.cents };
      })
      .sort(function (a, b) {
        return a.cents - b.cents;
      });

    var creditors = status
      .filter(function (row) {
        return row.cents > 0;
      })
      .map(function (row) {
        return { id: row.id, name: row.name, cents: row.cents };
      });

    var result = [];
    var i = 0;

    while (i < debtors.length) {
      // En küçük borçluyu, o an en çok alacağı olan kişiyle eşle.
      var target = null;
      creditors.forEach(function (creditor) {
        if (creditor.cents > 0 && (!target || creditor.cents > target.cents)) {
          target = creditor;
        }
      });
      if (!target) break;

      var pay = Math.min(debtors[i].cents, target.cents);
      if (pay > 0) {
        result.push({
          fromId: debtors[i].id,
          fromName: debtors[i].name,
          toId: target.id,
          toName: target.name,
          amount: fromCents(pay)
        });
      }
      debtors[i].cents -= pay;
      target.cents -= pay;
      if (debtors[i].cents === 0) i += 1;
    }

    return result;
  }

  function settle(trip) {
    var people = (trip && trip.people) || [];
    var expenses = (trip && trip.expenses) || [];
    return {
      status: spending(people, expenses),
      payments: payments(people, expenses)
    };
  }

  window.PaybackSettle = {
    toCents: toCents,
    fromCents: fromCents,
    balances: balances,
    spending: spending,
    payments: payments,
    settle: settle
  };
})();

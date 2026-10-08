/* ============================================================
   HUB DEMO CLOCK — the one thing the vendored app cannot be told.

   The Family Hub in the section-05 iframe is a BUILD, not source:
   public/nestify-hub-web/ is `flutter build web` output for a project
   (`nestify_hub_web`) that does not live in this repo. Its demo family —
   Beach day, Farmers market, the whole week of it — is seeded at ABSOLUTE
   dates in the week of Aug 16–22 2026, and its Home tab renders the week
   around DateTime.now(). Those two agreed for exactly seven days.

   After that the Home tab is seven columns of "No events", which is what
   the last beat of the section — "The household, handled together." —
   lands on. The Calendar tab does not go blank, because it is pinned to
   the demo week from the inside; only Home reads the real clock, so the
   section half-rotted rather than obviously breaking.

   🔴 THE PAGE ALREADY ASSUMES THIS DATE. hub.js pins its flying cards with
   `todayCol = 2` — today is a TUESDAY, and every card's destination column
   is computed off that. So the fix is not to invent a date here; it is to
   give the iframe the one the rest of the section was already built for,
   and Aug 18 2026 is that Tuesday.

   An OFFSET, not a freeze: the app is handed `real now + delta`, so the
   page opens at exactly 3:00 PM on the demo day and the clock in the header
   still ticks while a reader sits there. Freezing Date.now() outright is
   the other obvious move and it is worse — a stopped clock is visible in a
   header that prints minutes, and it makes any timer inside the app that
   diffs two nows into a divide-by-nothing.

   Everything else passes through: Date.parse, Date.UTC, `new Date(x)` with
   an argument, and the local timezone offset are all the real ones. Only
   the two ways of asking "what time is it NOW" are moved.

   🔴 RE-VENDORING THE BUILD DROPS THIS. It is loaded by one line in
   public/nestify-hub-web/index.html, which `flutter build web` overwrites.
   If that hub app is ever rebuilt, put the line back — or better, fix it at
   the source by seeding the demo relative to now, and delete this file.
   ============================================================ */
(function () {
  /* Tue Aug 18 2026, 3:00 PM, in the READER's timezone — the demo week is
     seeded in local time, so this has to be local too. Month is 0-based. */
  const DEMO_NOW = new Date(2026, 7, 18, 15, 0, 0).getTime();

  const RealDate = Date;
  const delta = DEMO_NOW - RealDate.now();

  window.Date = new Proxy(RealDate, {
    /* `new Date()` — the no-argument form is the only one that means "now" */
    construct(target, args, newTarget) {
      if (args.length === 0) return new target(target.now() + delta);
      return Reflect.construct(target, args, newTarget);
    },
    /* `Date()` called as a function returns a string, and always of now */
    apply(target, thisArg, args) {
      return new target(target.now() + delta).toString();
    },
    get(target, prop, recv) {
      if (prop === 'now') return function now() { return target.now() + delta; };
      const v = Reflect.get(target, prop, recv);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
})();

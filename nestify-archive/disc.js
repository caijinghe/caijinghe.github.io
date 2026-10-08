/* ============================================================
   THE DISC OPENS FROM THE POINTER

   Every filled-on-hover control on the site — .btn-disc (styles.css),
   .hd__fill (the header pills), .dv__fill (the device page's own) — is
   the same object: a circle wider than its button, scaled from 0 to 1
   under the label. It used to grow from the button's dead centre no
   matter where you came in from, which is the tell that it is an
   animation playing rather than the button answering you. It now grows
   from the point the cursor crossed the edge.

   🔴 CSS CANNOT DO THIS ALONE. There is no selector for "where the
   pointer entered", so the position has to be written in as two custom
   properties and the stylesheets read them with a 50% fallback — which
   means a page where this file never loads keeps the old centred
   behaviour rather than losing the hover altogether.

   🔴 ONE LISTENER ON THE WINDOW, not one per button. The buttons are in
   markup this file has never seen (the header injects some, the footer
   others) and they come and go with the menu, so binding per element
   would need a re-scan every time the DOM moves. Delegation is also why
   this is pointerover/pointerout rather than pointerenter/leave: those
   two do not bubble.

   🔴 AND THAT IS WHY relatedTarget IS CHECKED. pointerover fires again
   every time the cursor crosses onto a child — the label, the arrow, the
   svg inside it — and re-placing the disc on each of those would drag
   the origin around under the cursor while the circle is still opening.
   Only a crossing whose other side is OUTSIDE the button is a real
   enter or leave.

   🔴 It writes on leave too. The circle collapses toward where the
   cursor went out, so the gesture reads as one movement in and out of
   the same edge rather than as a thing that appears from the middle and
   returns to it.
   ============================================================ */
(function () {
  var SEL = '.btn-disc, .hd__btn, .dv__btn';

  /* 🔴 Percentages, not pixels. The disc is positioned in the button's
     own box, so a percentage survives the bar condensing on scroll and
     the pills being re-sized by their clamps — a px value written on
     enter would be stale the moment the header changes size under a
     pointer that has not moved. */
  function place(el, e) {
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    el.style.setProperty('--disc-x', ((e.clientX - r.left) / r.width * 100).toFixed(2) + '%');
    el.style.setProperty('--disc-y', ((e.clientY - r.top) / r.height * 100).toFixed(2) + '%');
  }

  function edge(e) {
    var t = e.target;
    if (!t || !t.closest) return;                 // text nodes, svg in old engines
    var el = t.closest(SEL);
    if (!el) return;
    /* a crossing that stays inside the same button is not an edge */
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    place(el, e);
  }

  addEventListener('pointerover', edge, { passive: true });
  addEventListener('pointerout', edge, { passive: true });
})();

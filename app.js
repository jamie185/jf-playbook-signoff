/* Gabrielle's Playbook sign-off (9 Oct 2026). Plain JS, no build. Answers autosave to this device and to Factory. */
(() => {
  const D = window.DATA;
  const LS = "jf-playbook-signoff-v1";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "$1");
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

  /* ---------- answers ---------- */
  let A = {};
  try { A = JSON.parse(localStorage.getItem(LS) || "{}"); } catch { A = {}; }
  const get = (k) => A[k] || {};
  const set = (k, patch) => { A[k] = { ...get(k), ...patch, t: Date.now() }; persist(); refresh(); };
  const required = []; // [key, sectionId]
  const need = (key, sec) => { if (!required.find((r) => r[0] === key)) required.push([key, sec]); };
  const isAnswered = (k) => {
    const v = A[k];
    if (!v) return false;
    return !!(v.verdict || v.choice || v.yn || v.score || (v.text && v.text.trim()) || v.confirmed);
  };

  let saveTimer = null, saving = false, dirty = false;
  function persist() {
    localStorage.setItem(LS, JSON.stringify(A));
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => push(false), 1200);
  }
  function labels() {
    const L = {};
    sections.forEach((s) => (L[s.id] = s.title));
    return L;
  }
  function meta() {
    const order = [], lab = {};
    required.forEach(([k]) => order.push(k));
    Object.keys(A).forEach((k) => { if (!k.startsWith("_") && !order.includes(k)) order.push(k); });
    order.forEach((k) => (lab[k] = LABEL[k] || k));
    return { order, labels: lab };
  }
  async function push(final) {
    if (saving && !final) { saveTimer = setTimeout(() => push(false), 1500); return; }
    saving = true;
    const st = $("#saveState");
    st.textContent = "Saving…"; st.classList.remove("err");
    try {
      const body = { key: D.key, final, progress: progressText(), answers: { ...A, _meta: meta() } };
      const r = await fetch(`${D.server}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(r.status);
      dirty = false;
      st.textContent = "Saved";
      return true;
    } catch (e) {
      st.textContent = "Saved on this device only"; st.classList.add("err");
      return false;
    } finally { saving = false; }
  }
  async function resume() {
    try {
      const r = await fetch(`${D.server}/load?key=${encodeURIComponent(D.key)}`);
      if (!r.ok) return;
      const s = await r.json();
      const srv = s.answers || {};
      let changed = false;
      for (const [k, v] of Object.entries(srv)) {
        if (k.startsWith("_")) continue;
        if (!A[k] || (v.t || 0) > (A[k].t || 0)) { A[k] = v; changed = true; }
      }
      if (changed) { localStorage.setItem(LS, JSON.stringify(A)); render(); }
    } catch { /* offline: local copy only */ }
  }

  /* ---------- small builders ---------- */
  const LABEL = {};
  const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

  function noteBox(key, show, placeholder = "Type, or use the microphone on your keyboard") {
    const v = get(key);
    const notes = (v.audio || []).map((f) => `<span class="cap">Voice note saved ✓</span>`).join("");
    return `<div class="note" data-note="${esc(key)}" ${show ? "" : "hidden"}>
      <textarea data-k="${esc(key)}" placeholder="${esc(placeholder)}">${esc(v.note || "")}</textarea>
      ${canRecord ? `<button class="mic" data-mic="${esc(key)}">${MIC}<span>Record a voice note</span></button>` : ""}
      <div class="vnotes" data-vn="${esc(key)}">${notes}</div></div>`;
  }
  function verdict(key, sec, label, words = ["Good to go", "Small changes", "Not right"]) {
    need(key, sec); LABEL[key] = label;
    const v = get(key).verdict;
    return `<div class="ask" id="a-${esc(key)}"><b>${esc(label)}</b>
      <div class="verdict">${["ok", "change", "no"].map((x, i) => `<button class="vbtn ${x} ${v === x ? "on" : ""}" data-v="${esc(key)}" data-val="${x}">${words[i]}</button>`).join("")}</div>
      ${noteBox(key, v === "change" || v === "no", v === "no" ? "What's wrong?" : "What would you change?")}</div>`;
  }
  function choice(key, sec, label, options, opts = {}) {
    need(key, sec); LABEL[key] = label;
    const v = get(key).choice;
    return `<div class="opts" id="a-${esc(key)}">${options.map((o) => `<button class="opt ${v === o ? "on" : ""}" data-c="${esc(key)}" data-val="${esc(o)}"><i></i><span>${esc(o)}</span></button>`).join("")}
      <button class="opt ${v === "__other" ? "on" : ""}" data-c="${esc(key)}" data-val="__other"><i></i><span>Something else</span></button></div>
      ${noteBox(key, v && v !== options[0], opts.placeholder || "Tell us what you'd do instead (optional if your choice says it)")}`;
  }
  function yesno(key, sec, label, extra = "") {
    need(key, sec); LABEL[key] = label;
    const v = get(key).yn;
    return `<div class="ask" id="a-${esc(key)}"><b>${esc(label)}</b>${extra}
      <div class="yn"><button class="vbtn ok ${v === "yes" ? "on" : ""}" data-yn="${esc(key)}" data-val="yes">Yes</button><button class="vbtn no ${v === "no" ? "on" : ""}" data-yn="${esc(key)}" data-val="no">No</button></div>
      ${noteBox(key, v === "no", "What's right instead?")}</div>`;
  }
  function openText(key, label, hint) {
    LABEL[key] = label;
    const v = get(key);
    return `<div class="ask"><b>${esc(label)}</b>${hint ? `<span class="small">${esc(hint)}</span>` : ""}
      <textarea data-k="${esc(key)}" data-text="1" placeholder="Type, or use the microphone on your keyboard">${esc(v.text || "")}</textarea>
      ${canRecord ? `<button class="mic" data-mic="${esc(key)}">${MIC}<span>Record a voice note</span></button>` : ""}
      <div class="vnotes" data-vn="${esc(key)}">${(v.audio || []).map(() => `<span class="cap">Voice note saved ✓</span>`).join("")}</div></div>`;
  }
  function clip(c) {
    return `<figure class="clip" data-clip="${esc(c.id)}"><div class="vwrap">
      <video muted playsinline loop preload="metadata" poster="${esc(c.poster)}" src="${esc(c.src)}"></video>
      <div class="vprog"><i></i></div></div>
      <div class="vcap"></div>
      <div class="vctl"><button data-sound>▶ Play with sound</button><span class="time">${mmss(c.len)}</span></div>
      <figcaption>${esc(c.why)}${c.filmTitle ? ` <span class="cap">From “${esc(c.filmTitle)}”.</span>` : ""}</figcaption></figure>`;
  }
  const cues = {};

  /* ---------- sections ---------- */
  const sections = [];
  const add = (s) => sections.push(s);
  const chMinutes = (c) => Math.round((1.1 + c.clips.reduce((a, x) => a + x.len, 0) / 60 + c.checks.length * 0.25) * 2) / 2;

  add({ id: "start", title: "Start here", min: 1, html: () => `
    <div class="hero"><h1>Hi Gabrielle.</h1>
    <p class="lede">This is the new trainer course, cut down to about 45 minutes. You don't need to watch all of it. Watch the short clips, skim the key rules and tap your answers.</p></div>
    <div class="tiles">
      <div class="tile"><b>What you're checking</b><p>Does it teach the JF way, in an order that works with your four training shifts? You know this better than anyone.</p></div>
      <div class="tile"><b>Already done for you</b><p>Spelling, broken buttons and contradictions were checked by 17 rounds of AI reviewers. Every practice was tapped through. That isn't your job here.</p></div>
      <div class="tile"><b>How it works</b><p>Every answer saves as you go. Stop any time and pick up on any device. If typing is slow, record a voice note.</p></div>
    </div>
    <div class="stats">
      <div class="stat"><div class="big">${D.totals.chapters}</div><span>chapters</span></div>
      <div class="stat"><div class="big">${D.totals.lessons}</div><span>lessons</span></div>
      <div class="stat"><div class="big">${Math.round(D.totals.minutes / 60 * 10) / 10}h</div><span>for a trainer</span></div>
      <div class="stat"><div class="big">${D.totals.films}</div><span>videos</span></div>
      <div class="stat"><div class="big">${D.totals.practice}</div><span>hands-on tasks</span></div>
      <div class="stat"><div class="big">${D.totals.quiz}</div><span>quizzes</span></div>
    </div>
    <p class="small" style="margin-top:16px">Some rules are marked <b style="color:var(--warn)">Jamie decided</b>. If you'd change one, say so. Jamie makes the final call on those.</p>
    <div class="next"><button class="btn" data-go="map">Start</button></div>` });

  add({ id: "map", title: "The course at a glance", min: 2, html: () => `
    <p class="lede">Eleven chapters, in this order. Each lesson mixes a short video, cards trainers can read or listen to, a hands-on practice in a copy of the real app, and a quick quiz. Tap a chapter to jump to it.</p>
    <div class="map">${D.chapters.map((c) => `<button class="mapc" style="--c:${c.colour}" data-go="ch-${c.id}"><b>${c.n}. ${esc(c.title)}</b><span>${esc(c.blurb)}</span><em data-mapdone="${c.id}">${c.lessons.length} lessons, ${c.minutes} min</em></button>`).join("")}</div>
    <div class="h3">What a practice looks like</div>
    <p class="small" style="margin-bottom:10px">Trainers do the real job in a copy of the app or WhatsApp. Here's a trainer texting Ava to move a session.</p>
    <div style="max-width:380px">${D.chapters[1].clips[0] ? clip(D.chapters[1].clips[0]) : ""}</div>
    <p class="small" style="margin-top:14px">Want to click through it yourself? <a href="https://jamiefitness.au/trainer-dashboard/playbook/index.php" target="_blank" rel="noopener">Open the real Playbook</a> (uses your Portal login). Not needed for this review.</p>
    <div class="next"><button class="btn" data-go="order">Next: your training order</button></div>` });

  add({ id: "order", title: "Your training order vs the course", min: 6, html: () => {
    const O = D.order;
    const counts = O.seq.reduce((a, s) => ((a[s.status] = (a[s.status] || 0) + 1), a), {});
    const st = { covered: "Covered", partly: "Partly", conflict: "Differs", missing: "Not in course", "in-person-only": "In person only" };
    return `
    <p class="lede">We mapped every heading in your trainer training guide (22 Sep) and the old master checklist, ${O.seq.length} topics, to where each one lives in the course.</p>
    <div class="callout" style="margin-top:14px"><b>The short version</b>${esc(O.verdict)}</div>
    <div class="h3">Suggested fit with your four shifts</div>
    <p class="small" style="margin-bottom:10px">Trainers do these lessons before each shift, so your time with them is practice, not explaining screens.</p>
    <div class="shifts">${O.shifts.map((s) => `<div class="shift"><h3>Before shift ${s.shift}</h3><ul>${s.before.map((b) => `<li>${esc(b)}</li>`).join("")}</ul><p class="small"><b style="color:var(--ink)">Your shift then covers:</b> ${esc(s.focus)}</p><p class="cap">${esc(s.why)}</p></div>`).join("")}</div>
    ${verdict("order:fit", "order", "Does this fit with how you train new starters?", ["Works for me", "Some changes", "Doesn't work"])}
    <div class="h3">Your guide, topic by topic</div>
    <p class="small">${Object.entries(counts).map(([k, n]) => `<span class="st ${k}" style="font-weight:700">${n} ${st[k] || k}</span>`).join(" · ")}. Read only. Skim the red ones.</p>
    <div class="seg" style="margin:10px 0" id="topicSeg">${[["attention", "Differs or missing"], ["partly", "Partly"], ["covered", "Covered"], ["all", "All"]].map(([k, l], i) => `<button data-tf="${k}" class="${i === 0 ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="topics" id="topics"></div>
    <div class="h3">Not in the course yet: what should happen?</div>
    <p class="small" style="margin-bottom:6px">Our suggestion is already selected. Change any you disagree with, then press the button underneath.</p>
    <div>${O.missing.map((m, i) => {
      const k = `gap:${i}`; LABEL[k] = `Gap: ${m.topic}`;
      const sug = /add/i.test(m.suggest) ? "add" : /outdated/i.test(m.suggest) ? "drop" : "keep";
      const v = get(k).choice || sug;
      const sugL = { add: "add it to the course", keep: "keep it for your shifts", drop: "drop it, it's outdated" }[sug];
      return `<div class="gap"><b>${esc(m.topic)}</b><span class="small">${esc(m.her_detail)}</span><span class="sugt">We suggest: ${sugL}</span>
        <div class="seg">${[["add", "Add to course"], ["keep", "Keep for my shifts"], ["drop", "Drop, it's outdated"]].map(([x, l]) => `<button data-gap="${i}" data-val="${x}" class="${v === x ? "on" : ""} ${sug === x ? "sug" : ""}">${l}</button>`).join("")}</div></div>`;
    }).join("")}</div>
    <div class="ask" id="a-gaps:confirmed"><b>${get("gaps:confirmed").confirmed ? "Thanks, these are saved." : "Happy with these choices?"}</b><button class="btn ${get("gaps:confirmed").confirmed ? "ghost" : ""}" data-confirmgaps style="justify-self:start">${get("gaps:confirmed").confirmed ? "Saved ✓" : "Yes, save these"}</button></div>
    <details><summary>New in the course since your guide (${O.new.length})</summary><div><ul class="prac">${O.new.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div></details>
    <div class="next"><button class="btn" data-go="decisions">Next: decisions only you can make</button></div>`;
  }, after: () => { need("order:fit", "order"); need("gaps:confirmed", "order"); LABEL["gaps:confirmed"] = "Confirmed the gap choices"; drawTopics("attention"); } });

  add({ id: "decisions", title: "Decisions only you can make", min: 7, html: () => `
    <p class="lede">${D.decisions.length} rules the course teaches that either send work to you, were decided without you, or are our best guess. Pick an answer for each. About 25 seconds each.</p>
    <div class="cards two" style="margin-top:16px">${D.decisions.map((d) => {
      const k = `dec:${d.id}`;
      const jamie = /jamie/i.test(d.source);
      return `<div class="card ${isAnswered(k) ? "answered" : ""}" data-card="${esc(k)}"><span class="src ${jamie ? "jamie" : ""}">${jamie ? "Jamie decided" : /assumption/i.test(d.source) ? "Our best guess, please confirm" : /guide/i.test(d.source) ? "Differs from your guide" : "New with Ava"}</span>
        <h3>${esc(d.title)}</h3>
        <div class="q course"><span class="who">Trainers are taught</span>${md(d.course_says)}</div>
        ${d.her_guide_says ? `<div class="q hers"><span class="who">Your guide says</span>${md(d.her_guide_says)}</div>` : ""}
        <p class="why">${esc(d.why_it_matters)}</p>
        ${choice(k, "decisions", d.title, d.options)}</div>`;
    }).join("")}</div>
    <div class="next"><button class="btn" data-go="diffs">Next: where your guide differs</button></div>` });

  add({ id: "diffs", title: "Where your guide and the course differ", min: 5, html: () => `
    <p class="lede">Places where your training guide or scripts say one thing and the course says another. Pick which is right today.</p>
    <div class="cards two" style="margin-top:16px">${D.conflicts.map((c, i) => {
      const k = `diff:${i}`;
      return `<div class="card ${isAnswered(k) ? "answered" : ""}" data-card="${esc(k)}"><span class="src sev-${esc(c.severity)}">${c.severity === "high" ? "Important" : c.severity === "medium" ? "Worth checking" : "Minor"}</span>
        <h3>${esc(c.topic)}</h3>
        <div class="q hers"><span class="who">Your guide</span>${md(c.her_doc)}</div>
        <div class="q course"><span class="who">The course</span>${md(c.playbook)}</div>
        <p class="why"><b style="color:var(--ink)">Our read:</b> ${esc(c.likely_current)}</p>
        <p style="font-weight:600">${esc(c.question_for_gab)}</p>
        ${choice(k, "diffs", c.topic, ["The course is right", "My guide is right, change the course"], { placeholder: "Anything to add?" })}</div>`;
    }).join("")}</div>
    <details><summary>Your terms the course doesn't use (${D.terms.length})</summary><div><ul class="prac">${D.terms.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div></details>
    <div class="next"><button class="btn" data-go="ch-${D.chapters[0].id}">Next: chapter by chapter</button></div>` });

  D.chapters.forEach((c, idx) => {
    const nxt = D.chapters[idx + 1] ? `ch-${D.chapters[idx + 1].id}` : "interview";
    add({ id: `ch-${c.id}`, title: `${c.n}. ${c.title}`, min: chMinutes(c), colour: c.colour, html: () => `
      <div class="ch-band" style="--c:${c.colour}"><div class="ch-dot">${esc(c.emoji)}</div>
        <p class="small">${c.lessons.length} lessons · ${c.minutes} min for a trainer · ${c.counts.films} videos · ${c.counts.practice} hands-on tasks · ${c.counts.quiz} quizzes</p></div>
      <p class="lede" style="margin:12px 0 18px">${esc(c.purpose)}</p>
      <div class="ch-grid" style="--c:${c.colour}">
        <div class="clips">${c.clips.length ? c.clips.map((x) => clip(x)).join("") : `<div class="callout"><b>No video in this chapter</b>It's cards, scenarios and quizzes. The screens are below.</div>`}</div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><b style="font-size:17px">What trainers learn</b>${"speechSynthesis" in window ? `<button class="listen" data-listen="${c.id}">▶ Listen</button>` : ""}</div>
          <ol class="learn">${c.learn.map((l) => `<li><span>${md(l.point)}<small>${esc(l.lesson)}</small></span></li>`).join("")}</ol>
          <details><summary>What they practise (${c.practise.length})</summary><div><ul class="prac">${c.practise.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div></details>
        </div>
      </div>
      <div class="h3">Screens trainers see</div>
      <div class="shots">${c.shots.map((s) => `<button data-zoom="${esc(s)}"><img loading="lazy" src="${esc(s)}" alt="Playbook screen"></button>`).join("")}</div>
      <div class="h3">Two quick checks</div>
      ${c.checks.map((q, i) => yesno(`chk:${c.id}:${i}`, `ch-${c.id}`, q.q,
        `${q.says ? `<div class="q course"><span class="who">Course${q.where ? ` · ${esc(q.where)}` : ""}</span>${esc(q.says)}</div>` : ""}${q.hers ? `<div class="q hers"><span class="who">Your guide</span>${esc(q.hers)}</div>` : ""}`)).join("")}
      ${verdict(`ch:${c.id}`, `ch-${c.id}`, `Is chapter ${c.n} right for a new trainer?`)}
      <details><summary>Lessons and all videos</summary><div>
        <div class="rows">${c.lessons.map((l) => `<div class="row"><span>${esc(l.title)}</span><span class="cap">${l.min} min</span></div>`).join("")}</div>
        ${c.films.length ? `<div class="h3" style="margin-top:12px">Full videos</div><div class="rows">${c.films.map((f, i) => `<div class="row"><span>${esc(f.title)}${f.talk ? " <span class='cap'>(Jamie's talk)</span>" : ""}</span><button class="play" data-film="${c.id}:${i}">▶ ${mmss(f.len)}</button></div>`).join("")}</div>` : ""}
        <p class="small" style="margin-top:10px"><a href="${esc(c.link)}" target="_blank" rel="noopener">Open this chapter in the real Playbook</a></p>
      </div></details>
      <div class="next"><button class="btn" data-go="${nxt}">${D.chapters[idx + 1] ? `Next: ${esc(D.chapters[idx + 1].title)}` : "Next: a few questions"}</button></div>` });
  });

  add({ id: "interview", title: "A few questions", min: 5, html: () => {
    const sc = get("q:score").score;
    LABEL["q:score"] = "1–10: how ready is it for Ida and Marco?";
    return `
    <p class="lede">Short answers are fine. Use the microphone if it's quicker.</p>
    <div class="ask" id="a-q:score"><b>On a scale of 1 to 10, how ready is this for Ida and Marco?</b>
      <div class="scale">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button data-score="${n}" class="${sc === n ? "on" : ""}">${n}</button>`).join("")}</div></div>
    ${openText("q:ten", sc ? `What would make it a 10 instead of a ${sc}?` : "What would make it a 10?")}
    ${openText("q:missing", "What do you always cover in your four shifts that's still missing?")}
    ${openText("q:outdated", "Anything outdated, or that we don't do any more?")}
    ${openText("q:struggle", "What do new trainers usually get wrong in their first fortnight? Does the course prepare them for it?")}
    ${openText("q:inperson", "Which parts should stay in person with you rather than online?")}
    ${openText("q:cut", "Anything you'd cut, so it's shorter or less overwhelming?")}
    ${openText("q:else", "Anything else Jamie should know?")}
    <div class="next"><button class="btn" data-go="signoff">Next: sign off</button></div>`;
  }, after: () => need("q:score", "interview") });

  add({ id: "signoff", title: "Sign off", min: 1, html: () => {
    const v = get("signoff");
    LABEL.signoff = "Final sign-off";
    const left = required.filter(([k]) => k !== "signoff" && !isAnswered(k));
    return `
    <p class="lede">Last step. Your answers go straight to Jamie.</p>
    <div class="opts" style="margin-top:14px">${[["ok", "Approved. Send it to Ida and Marco now"], ["change", "Approved once my changes are made"], ["no", "Not yet"]].map(([x, l]) => `<button class="opt ${v.verdict === x ? "on" : ""}" data-sign="${x}"><i></i><span>${l}</span></button>`).join("")}</div>
    <div class="ask"><b>Type your name to sign</b><input type="text" id="signName" value="${esc(v.name || "")}" placeholder="Gabrielle Ballard" autocomplete="name"></div>
    ${left.length ? `<p class="missing-list" style="margin-top:12px">You skipped ${left.length} question${left.length > 1 ? "s" : ""}: ${left.slice(0, 8).map(([k, s]) => `<a href="#a-${esc(k)}">${esc(LABEL[k] || k)}</a>`).join(", ")}${left.length > 8 ? " and more" : ""}. You can still send.</p>` : ""}
    <div class="next"><button class="btn" id="submit" ${v.verdict && (v.name || "").trim() ? "" : "disabled"}>${v.sent ? "Send my updated answers" : "Send to Jamie"}</button></div>
    <p class="cap" id="sendMsg" style="text-align:right;margin-top:8px"></p>`;
  } });

  /* ---------- render ---------- */
  function render() {
    required.length = 0;
    $("#app").innerHTML = sections.map((s, i) => `<section class="sec" id="${s.id}">
      ${s.id === "start" ? "" : `<div class="sec-head"><div class="sec-meta"><span>Part ${i} of ${sections.length - 1}</span><span>About ${s.min} min</span><span class="done" data-done="${s.id}"></span></div><h2>${esc(s.title)}</h2></div>`}
      ${s.html()}</section>`).join("");
    sections.forEach((s) => s.after && s.after());
    $("#tocList").innerHTML = sections.map((s) => `<li data-toc="${s.id}"><a href="#${s.id}"><b>${esc(s.title)}</b><span>${s.min} min</span></a></li>`).join("");
    wire();
    refresh();
  }

  function secDone(id) {
    const r = required.filter(([, s]) => s === id);
    return r.length ? r.filter(([k]) => isAnswered(k)).length / r.length : null;
  }
  function progressText() {
    const done = required.filter(([k]) => isAnswered(k)).length;
    return `${done}/${required.length}`;
  }
  function refresh() {
    const done = required.filter(([k]) => isAnswered(k)).length;
    window.__left = required.filter(([k]) => !isAnswered(k)).map(([k]) => k);
    $("#barFill").style.width = `${required.length ? (done / required.length) * 100 : 0}%`;
    let left = 0;
    sections.forEach((s) => {
      const f = secDone(s.id);
      const rem = f === null ? (s.id === "start" || s.id === "map" ? (A["_seen:" + s.id] ? 0 : s.min) : s.min) : s.min * (1 - f);
      left += rem;
      const tag = $(`[data-done="${s.id}"]`);
      if (tag) tag.textContent = f === 1 ? "Done ✓" : "";
      const li = $(`[data-toc="${s.id}"]`);
      if (li) { li.classList.toggle("done", f === 1); $("span", li).textContent = f === 1 ? "Done ✓" : `${Math.max(1, Math.round(s.min * (1 - (f || 0))))} min`; }
      const m = s.id.startsWith("ch-") && $(`[data-mapdone="${s.id.slice(3)}"]`);
      if (m && f === 1) { m.textContent = "Reviewed ✓"; m.parentElement.classList.add("done"); }
    });
    $("#barSub").textContent = done === required.length && required.length ? "All answered. Sign off at the bottom." : `About ${Math.max(1, Math.round(left))} min left · ${done} of ${required.length} answered`;
    $$("[data-card]").forEach((el) => el.classList.toggle("answered", isAnswered(el.dataset.card)));
  }

  function drawTopics(filter) {
    const box = $("#topics");
    if (!box) return;
    const st = { covered: "Covered", partly: "Partly covered", conflict: "Differs", missing: "Not in the course", "in-person-only": "In person only" };
    const rows = D.order.seq.filter((s) => filter === "all" || (filter === "attention" ? ["conflict", "missing"].includes(s.status) : s.status === filter));
    box.innerHTML = rows.map((s) => `<div class="topic"><span class="st ${esc(s.status)}">${st[s.status] || esc(s.status)}</span><b>${esc(s.topic)}</b>
      ${s.where.length ? `<span class="where">${s.where.map((w) => `${w.ch ? `Ch ${w.ch}: ` : ""}${esc(w.t)}`).join(" · ")}</span>` : ""}<span class="small">${esc(s.note)}</span></div>`).join("") || `<p class="small">Nothing here.</p>`;
  }

  /* ---------- video ---------- */
  const allClips = {};
  D.chapters.forEach((c) => c.clips.forEach((x) => (allClips[x.id] = x)));
  const io = "IntersectionObserver" in window ? new IntersectionObserver((ents) => {
    ents.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting && e.intersectionRatio > 0.55) { if (v.muted) v.play().catch(() => {}); }
      else if (!v.paused) { v.pause(); }
    });
  }, { threshold: [0, 0.55, 0.9] }) : null;

  function wireVideo(wrap, cueList) {
    const v = $("video", wrap), cap = $(".vcap", wrap), bar = $(".vprog i", wrap), btn = $("[data-sound]", wrap), tm = $(".time", wrap);
    let last = "";
    v.addEventListener("timeupdate", () => {
      const t = v.currentTime;
      const c = cueList.find((q) => t >= q[0] && t <= q[1] + 0.2);
      const txt = c ? c[2] : "";
      if (txt !== last) { cap.textContent = txt; last = txt; }
      if (v.duration) bar.style.width = `${(t / v.duration) * 100}%`;
      if (tm && v.duration) tm.textContent = `${mmss(t)} / ${mmss(v.duration)}`;
    });
    const toggle = () => {
      if (v.muted) { v.muted = false; v.loop = false; v.currentTime = 0; v.play().catch(() => {}); btn.textContent = "❚❚ Pause"; }
      else if (v.paused) { if (v.ended) v.currentTime = 0; v.play().catch(() => {}); btn.textContent = "❚❚ Pause"; }
      else { v.pause(); btn.textContent = "▶ Play"; }
    };
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
    v.addEventListener("ended", () => { btn.textContent = "↺ Watch again"; });
    v.addEventListener("click", toggle);
    if (io) io.observe(v);
  }

  function filmModal(f) {
    $("#modalBody").innerHTML = `<h3>${esc(f.title)}</h3><div class="vwrap" data-full><video playsinline controls preload="auto" poster="${esc(f.poster)}" src="${esc(f.src)}"></video></div><div class="vcap"></div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:10px"><span class="small">Speed</span><div class="seg" id="spd">${[1, 1.5, 2].map((s) => `<button data-spd="${s}" class="${s === 1.5 ? "on" : ""}">${s}×</button>`).join("")}</div></div>
      ${f.cues.length ? `<details><summary>Read it instead</summary><div class="transcript">${f.cues.map((q) => `<p data-t="${q[0]}">${esc(q[2])}</p>`).join("")}</div></details>` : ""}`;
    $("#modal").hidden = false;
    const v = $("#modalBody video"), cap = $("#modalBody .vcap");
    v.playbackRate = 1.5;
    v.addEventListener("loadedmetadata", () => (v.playbackRate = 1.5));
    v.play().catch(() => {});
    v.addEventListener("timeupdate", () => {
      const t = v.currentTime;
      const c = f.cues.find((q) => t >= q[0] && t <= q[1] + 0.2);
      cap.textContent = c ? c[2] : "";
      $$("#modalBody .transcript p").forEach((p) => p.classList.toggle("on", c && +p.dataset.t === c[0]));
    });
    $$("#spd button").forEach((b) => b.addEventListener("click", () => { v.playbackRate = +b.dataset.spd; $$("#spd button").forEach((x) => x.classList.toggle("on", x === b)); }));
    $$("#modalBody .transcript p").forEach((p) => p.addEventListener("click", () => { v.currentTime = +p.dataset.t; v.play(); }));
  }
  function closeModal() {
    const v = $("#modalBody video");
    if (v) v.pause();
    $("#modalBody").innerHTML = "";
    $("#modal").hidden = true;
  }

  /* ---------- voice notes ---------- */
  const canRecord = !!(navigator.mediaDevices && window.MediaRecorder);
  let rec = null;
  async function toggleRec(btn, key) {
    if (rec && rec.key === key) { rec.mr.stop(); return; }
    if (rec) rec.mr.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      const t0 = Date.now();
      rec = { mr, key };
      btn.classList.add("rec"); $("span", btn).textContent = "Recording · tap to stop";
      const tick = setInterval(() => { $("span", btn).textContent = `Recording ${mmss((Date.now() - t0) / 1000)} · tap to stop`; }, 500);
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        clearInterval(tick); stream.getTracks().forEach((t) => t.stop()); rec = null;
        btn.classList.remove("rec"); $("span", btn).textContent = "Record another voice note";
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/mp4" });
        const box = $(`[data-vn="${CSS.escape(key)}"]`);
        const url = URL.createObjectURL(blob);
        const el = document.createElement("div");
        el.innerHTML = `<audio controls src="${url}"></audio><span class="cap">Uploading…</span>`;
        box.appendChild(el);
        try {
          const r = await fetch(`${D.server}/audio?key=${encodeURIComponent(D.key)}&id=${encodeURIComponent(key.replace(/[^a-zA-Z0-9]/g, "-"))}`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
          const j = await r.json();
          if (!j.ok) throw 0;
          const v = get(key);
          set(key, { audio: [...(v.audio || []), j.file], ...(key.startsWith("q:") ? { text: (v.text || "") || "(voice note)" } : {}) });
          $(".cap", el).textContent = `Voice note saved (${mmss((Date.now() - t0) / 1000)})`;
        } catch { $(".cap", el).textContent = "Couldn't upload this one. Please type it instead."; }
      };
      mr.start();
    } catch {
      $("span", btn).textContent = "Microphone not available. Please type.";
    }
  }

  /* ---------- listen ---------- */
  let speaking = null;
  function listen(btn, id) {
    const synth = window.speechSynthesis;
    if (speaking === id) { synth.cancel(); speaking = null; btn.classList.remove("on"); btn.textContent = "▶ Listen"; return; }
    synth.cancel(); $$(".listen").forEach((b) => { b.classList.remove("on"); b.textContent = "▶ Listen"; });
    const c = D.chapters.find((x) => x.id === id);
    const text = [`Chapter ${c.n}. ${c.title}.`, c.purpose, "What trainers learn.", ...c.learn.map((l, i) => `${i + 1}. ${l.point}`)].join(" ").replace(/\$(\d+)\.(\d\d)/g, "$1 dollars $2");
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    u.voice = voices.find((v) => /en-AU/i.test(v.lang)) || voices.find((v) => /en-GB/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || null;
    u.rate = 1.05;
    u.onend = () => { speaking = null; btn.classList.remove("on"); btn.textContent = "▶ Listen"; };
    speaking = id; btn.classList.add("on"); btn.textContent = "■ Stop";
    synth.speak(u);
  }

  /* ---------- events ---------- */
  function wire() {
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => {
      const cur = b.closest("section");
      if (cur && (cur.id === "start" || cur.id === "map")) { A["_seen:" + cur.id] = { t: Date.now() }; persist(); refresh(); }
      document.getElementById(b.dataset.go).scrollIntoView({ behavior: "smooth" });
    }));
    $$("[data-v]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.v, val = b.dataset.val;
      set(k, { verdict: val });
      $$(`[data-v="${CSS.escape(k)}"]`).forEach((x) => x.classList.toggle("on", x === b));
      const n = $(`[data-note="${CSS.escape(k)}"]`); if (n) n.hidden = val === "ok";
    }));
    $$("[data-yn]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.yn, val = b.dataset.val;
      set(k, { yn: val });
      $$(`[data-yn="${CSS.escape(k)}"]`).forEach((x) => x.classList.toggle("on", x === b));
      const n = $(`[data-note="${CSS.escape(k)}"]`); if (n) n.hidden = val === "yes";
    }));
    $$("[data-c]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.c, val = b.dataset.val;
      set(k, { choice: val });
      const all = $$(`[data-c="${CSS.escape(k)}"]`);
      all.forEach((x) => x.classList.toggle("on", x === b));
      const n = $(`[data-note="${CSS.escape(k)}"]`); if (n) n.hidden = b === all[0];
    }));
    $$("[data-gap]").forEach((b) => b.addEventListener("click", () => {
      const k = `gap:${b.dataset.gap}`;
      set(k, { choice: b.dataset.val });
      $$(`[data-gap="${b.dataset.gap}"]`).forEach((x) => x.classList.toggle("on", x === b));
    }));
    const cg = $("[data-confirmgaps]");
    if (cg) cg.addEventListener("click", () => {
      D.order.missing.forEach((m, i) => {
        const k = `gap:${i}`;
        if (!get(k).choice) { const on = $(`[data-gap="${i}"].on`); if (on) A[k] = { choice: on.dataset.val, t: Date.now() }; }
      });
      set("gaps:confirmed", { confirmed: true });
      cg.textContent = "Saved ✓"; cg.classList.add("ghost");
      cg.previousElementSibling.textContent = "Thanks, these are saved.";
    });
    $$("textarea[data-k]").forEach((t) => t.addEventListener("input", () => {
      const k = t.dataset.k;
      A[k] = { ...get(k), [t.dataset.text ? "text" : "note"]: t.value, t: Date.now() };
      persist(); refresh();
    }));
    $$("[data-mic]").forEach((b) => b.addEventListener("click", () => toggleRec(b, b.dataset.mic)));
    $$("[data-score]").forEach((b) => b.addEventListener("click", () => {
      const n = +b.dataset.score;
      set("q:score", { score: n });
      $$("[data-score]").forEach((x) => x.classList.toggle("on", x === b));
      const lab = $(`[data-k="q:ten"]`)?.closest(".ask")?.querySelector("b");
      if (lab) lab.textContent = `What would make it a 10 instead of a ${n}?`;
    }));
    $$("[data-tf]").forEach((b) => b.addEventListener("click", () => { $$("[data-tf]").forEach((x) => x.classList.toggle("on", x === b)); drawTopics(b.dataset.tf); }));
    $$("[data-clip]").forEach((w) => wireVideo(w, allClips[w.dataset.clip].cues));
    $$("[data-film]").forEach((b) => b.addEventListener("click", () => { const [cid, i] = b.dataset.film.split(":"); filmModal(D.chapters.find((c) => c.id === cid).films[+i]); }));
    $$("[data-zoom]").forEach((b) => b.addEventListener("click", () => { $("#modalBody").innerHTML = `<img src="${esc(b.dataset.zoom)}" alt="">`; $("#modal").hidden = false; }));
    $$("[data-listen]").forEach((b) => b.addEventListener("click", () => listen(b, b.dataset.listen)));
    $$("[data-sign]").forEach((b) => b.addEventListener("click", () => {
      set("signoff", { verdict: b.dataset.sign });
      $$("[data-sign]").forEach((x) => x.classList.toggle("on", x === b));
      $("#submit").disabled = !(get("signoff").name || "").trim();
    }));
    const nm = $("#signName");
    if (nm) nm.addEventListener("input", () => {
      A.signoff = { ...get("signoff"), name: nm.value, t: Date.now() }; persist();
      $("#submit").disabled = !(get("signoff").verdict && nm.value.trim());
    });
    const sub = $("#submit");
    if (sub) sub.addEventListener("click", async () => {
      sub.disabled = true; $("#sendMsg").textContent = "Sending…";
      A.signoff = { ...get("signoff"), sent: Date.now(), t: Date.now() };
      localStorage.setItem(LS, JSON.stringify(A));
      const ok = await push(true);
      if (ok) {
        $("#signoff").innerHTML = `<div class="thanks"><h2>Thank you, ${esc((get("signoff").name || "Gabrielle").split(" ")[0])}.</h2><p class="lede" style="margin:12px auto 0">Jamie has your answers now. You can come back and change anything; just send again.</p><div class="next" style="justify-content:center"><button class="btn ghost" onclick="location.reload()">Back to my answers</button></div></div>`;
        $("#signoff").scrollIntoView({ behavior: "smooth" });
      } else {
        sub.disabled = false;
        $("#sendMsg").innerHTML = "Couldn't reach Jamie's server. Your answers are safe on this device. Try again in a minute, or <a href='#' id='copyAns'>copy them</a> and WhatsApp them to Jamie.";
        $("#copyAns").addEventListener("click", (e) => { e.preventDefault(); navigator.clipboard.writeText(plainAnswers()).then(() => ($("#sendMsg").textContent = "Copied. Paste it into WhatsApp to Jamie.")); });
      }
    });
  }
  function plainAnswers() {
    const m = meta();
    return m.order.filter((k) => A[k]).map((k) => {
      const v = A[k];
      const ans = v.verdict || v.choice || v.yn || v.score || (v.confirmed ? "confirmed" : "");
      return `${m.labels[k]}: ${ans}${v.note ? ` (${v.note})` : ""}${v.text ? ` ${v.text}` : ""}`;
    }).join("\n");
  }

  $("#tocBtn").addEventListener("click", () => ($("#toc").hidden = false));
  $("#tocClose").addEventListener("click", () => ($("#toc").hidden = true));
  $("#toc").addEventListener("click", (e) => { if (e.target.id === "toc" || e.target.closest("a")) $("#toc").hidden = true; });
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); $("#toc").hidden = true; } });
  window.addEventListener("pagehide", () => { if (dirty) navigator.sendBeacon?.(`${D.server}/save`, new Blob([JSON.stringify({ key: D.key, final: false, progress: progressText(), answers: { ...A, _meta: meta() } })], { type: "text/plain" })); });

  render();
  resume();
})();

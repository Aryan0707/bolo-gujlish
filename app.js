/* ================================================================
   BOLO GUJLISH — Gujlish AI
   A reply/rewrite/translate assistant for real, code-mixed
   Gujarati-English. Runs entirely on the model — real Gujlish
   spelling, code-switching, and register are not something a
   rule table can fake convincingly.
   ================================================================ */

(function(){
"use strict";

var AI_MODELS = [
  { id:"google/gemini-2.5-flash-lite",       lab:"Gemini 2.5 Flash Lite",  cost:"$0.08 / 1000",
    note:"Best value for Gujlish. Google has the deepest Indic investment — the romanization data this app uses is Google Research's own." },
  { id:"google/gemini-3.7-flash",            lab:"Gemini 3.7 Flash",       cost:"$0.36 / 1000",
    note:"Step up if Flash Lite feels shaky on longer sentences." },
  { id:"anthropic/claude-haiku-4.5",         lab:"Claude Haiku 4.5",       cost:"$0.95 / 1000",
    note:"Best at the chat corrections and explaining why a reply is unnatural." },
  { id:"anthropic/claude-sonnet-5",          lab:"Claude Sonnet 5",        cost:"$1.90 / 1000",
    note:"Strongest overall. Still only a few pounds a month at real usage." },
  { id:"google/gemini-3.5-flash-lite",       lab:"Gemini 3.5 Flash Lite",  cost:"Unverified",
    note:"Added on request — I can't confirm pricing or quality on Gujlish. Use Save & test before relying on it." },
  { id:"openai/gpt-5.6-luna",                lab:"GPT-5.6 Luna",           cost:"Unverified",
    note:"Added on request — I can't confirm pricing or quality on Gujlish. Use Save & test before relying on it." },
  { id:"x-ai/grok-4.6",                      lab:"Grok 4.6",               cost:"Unverified",
    note:"Added on request — I can't confirm pricing or quality on Gujlish. Use Save & test before relying on it." },
  { id:"deepseek/deepseek-v4-pro-0813",      lab:"DeepSeek V4 Pro",        cost:"Unverified",
    note:"Added on request — I can't confirm pricing or quality on Gujlish. Use Save & test before relying on it." },
  { id:"deepseek/deepseek-v4-flash-0731",    lab:"DeepSeek V4 Flash",      cost:"Unverified",
    note:"Added on request — I can't confirm pricing or quality on Gujlish. Use Save & test before relying on it." },
  { id:"google/gemma-4-31b-it:free",         lab:"Gemma 4 31B",            cost:"Free",
    note:"Free-tier model — I haven't tested this one on Gujlish myself. Use Save & test below to confirm it resolves before relying on it." },
  { id:"poolside/laguna-s-2.1:free",         lab:"Laguna S 2.1",           cost:"Free",
    note:"Free-tier model — I haven't tested this one on Gujlish myself. Use Save & test below to confirm it resolves before relying on it." }
];

/* ================================================================
   STATE
   ================================================================ */

var KEY = "bolo-gujlish-v2";
var mem = null;

function read(){
  try{ var v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; }
  catch(e){ return mem; }
}
function write(o){
  mem = o;
  try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){}
}

var S = read() || {};
if(typeof S.sound !== "boolean") S.sound = true;
if(!S.ai) S.ai = { key:"", model:"google/gemini-2.5-flash-lite" };
if(!S.gj) S.gj = { mode:"reply", lang:"roman", trlang:"roman", style:"gujlish",
  length:"short", texting:"natural", relation:"friend", strength:3, history:[], saved:[] };
if(!S.gj.history)  S.gj.history = [];
if(!S.gj.saved)    S.gj.saved = [];
if(!S.gj.trlang)   S.gj.trlang = "roman";
if(!S.gj.relation) S.gj.relation = "friend";
if(!S.gj.strength) S.gj.strength = 3;
if(!S.gj.conversations) S.gj.conversations = [];
if(!S.gj.activeConv)    S.gj.activeConv = "";

function save(){ write(S); }


/* ================================================================
   SOUND — synthesised, no assets
   ================================================================ */

var actx = null;
function tone(freq, dur, type, vol, delay){
  if(!S.sound) return;
  try{
    if(!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if(actx.state === "suspended") actx.resume();
    var t0 = actx.currentTime + (delay || 0);
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.09, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }catch(e){}
}
function sfxTap(){ tone(880, .045, "sine", .028, 0); }
function sfxGem(){ [880,1174.7,1567.98].forEach(function(f,i){ tone(f, .22, "sine", .06, i*.07); }); }

/* ================================================================
   HELPERS
   ================================================================ */

var app = document.getElementById("view");
function el(html){ var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function each(list, fn){ Array.prototype.forEach.call(list, fn); }
function $(sel, root){ return (root || document).querySelector(sel); }
function $$(sel, root){ return (root || document).querySelectorAll(sel); }

function toast(msg){
  var t = el('<div style="position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:60;' +
    'padding:12px 20px;border-radius:999px;background:rgba(11,10,16,.94);border:1px solid var(--edge);' +
    'backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font-family:var(--mono);font-size:12.5px;' +
    'letter-spacing:.1em;box-shadow:0 12px 40px -12px rgba(0,0,0,.9)">' + msg + '</div>');
  document.body.appendChild(t);
  setTimeout(function(){ t.style.transition = "opacity .4s"; t.style.opacity = "0"; }, 1500);
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 2000);
}

var REDUCED = false;
try{ REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}

/* Gujarati script availability — hide it rather than render tofu boxes */
var HAS_GUJ = true;
(function detectGujarati(){
  try{
    var c = document.createElement("canvas").getContext("2d");
    c.font = '32px "Gujarati Sangam MN","Nirmala UI","Shruti","Noto Sans Gujarati","Gujarati MT",sans-serif';
    var a = c.measureText("કેમ").width;
    c.font = "32px monospace";
    var b = c.measureText("કેમ").width;
    if(Math.abs(a - b) < 0.5){ HAS_GUJ = false; document.body.classList.add("no-guj"); }
  }catch(e){}
})();

/* ================================================================
   AI (optional, local only)
   The key is typed by the user into Settings and kept in this
   browser's localStorage. It is never written into the file.
   Published artifacts block outside connections, so this only
   works when the app is run locally.
   ================================================================ */

var AI = {
  on: function(){ return !!(S.ai && S.ai.key); },
  lastError: "",
  chat: function(messages, maxTokens, modelOverride){
    var key = S.ai.key, model = modelOverride || S.ai.model || AI_MODELS[0].id;
    return fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization":"Bearer " + key },
      body: JSON.stringify({ model: model, max_tokens: maxTokens || 400, messages: messages })
    }).then(function(r){
      if(!r.ok) return r.text().then(function(t){ throw new Error("HTTP " + r.status + " — " + t.slice(0,140)); });
      return r.json();
    }).then(function(j){
      var m = j && j.choices && j.choices[0] && j.choices[0].message;
      if(!m || !m.content) throw new Error("Empty reply from the model.");
      return m.content;
    });
  }
};

function aiErrorText(e){
  var m = (e && e.message) || String(e);
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)){
    return "Couldn't reach OpenRouter. If you're on the shared artifact link, outside connections are blocked there — run the local copy instead. Otherwise check your connection.";
  }
  if(/HTTP 401|HTTP 403/.test(m)) return "OpenRouter rejected the key. Check it in Settings.";
  if(/HTTP 402/.test(m)) return "OpenRouter says this account is out of credit.";
  if(/HTTP 429/.test(m)) return "Rate limited by OpenRouter. Wait a moment and try again.";
  return m;
}

/* ================================================================
   SHELL
   ================================================================ */

var screen = "translate";
var TABS = [
  { id:"translate", ic:"🔁", t:"Translate" },
  { id:"settings",  ic:"⚙",  t:"You" }
];

function paintShell(){
  var rail = $("#rail"), tabs = $("#tabs");
  rail.innerHTML = '<div class="brand">Bolo<br><em>Gujlish</em></div>' +
    TABS.map(function(t){
      return '<button class="nav' + (screen === t.id ? " on" : "") + '" data-go="' + t.id + '">' +
             '<span class="ic">' + t.ic + '</span>' + t.t + '</button>';
    }).join("");
  tabs.innerHTML = TABS.map(function(t){
    return '<button class="tab' + (screen === t.id ? " on" : "") + '" data-go="' + t.id + '">' +
           '<span class="ic">' + t.ic + '</span>' + t.t + '</button>';
  }).join("");
  each($$("[data-go]"), function(b){
    b.onclick = function(){ sfxTap(); go(b.getAttribute("data-go")); };
  });
}

/* an empty spacer, not just a leftover — in standalone/PWA mode this
   is what clears the iPhone notch (see the display-mode:standalone
   rule below); removing the element would put content under it */
function topBar(){
  return '<div class="top"></div>';
}

function go(name){
  clearTimeout(gjDebounce);   /* a pending auto-translate must not fire after you've navigated off */
  screen = name;
  paintShell();
  ({ translate:renderTranslate, settings:renderSettings })[name]();
  if(!REDUCED){ app.classList.remove("swap"); void app.offsetWidth; app.classList.add("swap"); }
  window.scrollTo(0, 0);
}


/* ================================================================
   GUJLISH AI — reply assistant
   Three modes: Translate, Reply (default), Rewrite. All three run
   entirely on the model — real Gujlish spelling and code-switching
   are not something a rule table can fake, and the earlier
   rule-composed sentences ("Tame Hello, kem cho? Tame good cho?")
   proved that trying to was worse than admitting it and using AI.
   ================================================================ */

var GJ_MODES = [
  { id:"translate", lab:"Translate" },
  { id:"reply",      lab:"Reply" },
  { id:"rewrite",    lab:"Rewrite" }
];
var GJ_LANG = [
  { id:"roman",   lab:"Roman Gujlish" },
  { id:"script",  lab:"ગુજરાતી" },
  { id:"english", lab:"English" }
];
/* offered only where the device can actually render it — otherwise
   "script" mode would just draw tofu boxes instead of Gujarati */
function gjLangOpts(){ return HAS_GUJ ? GJ_LANG : GJ_LANG.filter(function(o){ return o.id !== "script"; }); }
var GJ_STYLE = [
  { id:"casual",  lab:"Casual" },
  { id:"gujlish", lab:"Natural Gujlish" },
  { id:"polite",  lab:"Polite" },
  { id:"funny",   lab:"Funny" },
  { id:"flirty",  lab:"Flirty" },
  { id:"pro",     lab:"Professional" }
];
var GJ_LENGTH = [
  { id:"short",    lab:"Short" },
  { id:"normal",   lab:"Normal" },
  { id:"detailed", lab:"Detailed" }
];
var GJ_TEXTING = [
  { id:"clean",      lab:"Clean" },
  { id:"natural",    lab:"Natural" },
  { id:"verycasual", lab:"Very casual" }
];
var GJ_RELATION = [
  { id:"friend",    lab:"Friend" },
  { id:"crush",     lab:"Crush" },
  { id:"stranger",  lab:"Stranger" },
  { id:"family",    lab:"Family" },
  { id:"colleague", lab:"Colleague" },
  { id:"group",     lab:"Group" },
  { id:"women",     lab:"Women" }
];
var GJ_STRENGTH_LAB = { 1:"Very safe", 2:"Safe", 3:"Balanced", 4:"Bold", 5:"Savage" };
var GJ_MOOD_ICON = {
  happy:"😊", angry:"😠", dry:"😑", sarcastic:"😏", flirty:"😉",
  confused:"😕", serious:"😐", neutral:"🙂"
};
function gjLab(list, id){ var m = list.filter(function(o){ return o.id === id; })[0]; return m ? m.lab : id; }
function gjModeLab(id){ return gjLab(GJ_MODES, id); }
function looksGujScript(s){ return /[઀-૿]/.test(String(s)); }

/* per-mode drafts, so switching modes never loses what you typed */
var gjText = { translate:"", reply:"", rewrite:"" };
var gjCtx = "";
var gjCtxOpen = false;
var gjNewConvOpen = false;
var gjResults = null;    /* { mode, cards:[{label,text}], note, detected, error } — translate mode only */
var gjActiveGen = { reply:null, rewrite:null };  /* the live history entry backing each mode's carousel */
var gjCarIdx    = { reply:0, rewrite:0 };        /* which generation within it is on screen */
var gjGenError  = { reply:null, rewrite:null };  /* set only when there's no carousel yet to fall back to */
var gjBusy = false;
var gjReqId = 0;         /* bumped per request, so a slow abandoned call can't clobber a newer one */
var gjDebounce = null;   /* translate mode fires ~1s after typing stops, Google-style */
var gjHistOpen = false;
var gjSavedOpen = false;

function timeAgo(ts){
  var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if(s < 60) return "just now";
  var m = Math.round(s / 60); if(m < 60) return m + "m ago";
  var h = Math.round(m / 60); if(h < 24) return h + "h ago";
  var d = Math.round(h / 24); if(d < 7) return d + "d ago";
  return new Date(ts).toLocaleDateString();
}

/* a brief flourish on the element itself — a toast alone was easy to
   miss; re-triggerable because removing then re-adding the class
   restarts a CSS animation that a bare re-add would just no-op */
function gjFlash(el){
  if(!el) return;
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
}
function copyText(t, btn){
  function ok(){ sfxTap(); toast("Copied"); gjFlash(btn); }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(ok, function(){ gjLegacyCopy(t); ok(); });
  }else{ gjLegacyCopy(t); ok(); }
}
function gjLegacyCopy(t){
  var ta = document.createElement("textarea");
  ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.focus(); ta.select();
  try{ document.execCommand("copy"); }catch(e){}
  document.body.removeChild(ta);
}

function gjPushHistory(entry){
  /* Translate mode fires as you type and pause, so a sentence typed in
     three bursts would otherwise leave three near-duplicate rows. If
     the newest entry is just a longer/shorter version of the one on
     top, still fresh, update it in place instead of stacking another. */
  var top = S.gj.history[0];
  var sameThread = top && top.mode === entry.mode && (Date.now() - top.ts) < 30000 &&
    (entry.input.indexOf(top.input) === 0 || top.input.indexOf(entry.input) === 0);
  if(sameThread) S.gj.history[0] = entry;
  else{
    S.gj.history.unshift(entry);
    if(S.gj.history.length > 40) S.gj.history.length = 40;
  }
  save();
  gjRefreshCounts();
}
function gjSameCfg(a, b){
  return !!a && !!b && a.lang === b.lang && a.style === b.style && a.length === b.length && a.texting === b.texting &&
    a.relation === b.relation && a.strength === b.strength && (a.conv || "") === (b.conv || "");
}

/* ---- conversation memory -------------------------------------------
   A named thread that remembers itself: every incoming message you
   generate against becomes a "them" turn, every reply you copy
   becomes a "me" turn — no re-pasting the history each time. */

var GJ_CONV_CAP = 30, GJ_TURN_CAP = 60;

function gjConvById(id){ return S.gj.conversations.filter(function(c){ return c.id === id; })[0] || null; }
function gjNewConversation(name){
  name = String(name || "").trim();
  if(!name) return null;
  var conv = { id: "c" + Date.now() + Math.random().toString(36).slice(2, 7), name:name, thread:[], ts:Date.now() };
  S.gj.conversations.unshift(conv);
  if(S.gj.conversations.length > GJ_CONV_CAP) S.gj.conversations.length = GJ_CONV_CAP;
  S.gj.activeConv = conv.id;
  save();
  return conv;
}
function gjDeleteConversation(id){
  S.gj.conversations = S.gj.conversations.filter(function(c){ return c.id !== id; });
  if(S.gj.activeConv === id) S.gj.activeConv = "";
  save();
}
/* called once per generated incoming message, and once per copied
   reply — skips a duplicate "them" turn if you just regenerate
   against the same message without a new one arriving */
function gjAppendTurn(convId, who, text){
  var conv = gjConvById(convId);
  if(!conv || !text) return;
  var last = conv.thread[conv.thread.length - 1];
  if(last && last.who === who && last.text === text) return;
  conv.thread.push({ who:who, text:text, ts:Date.now() });
  if(conv.thread.length > GJ_TURN_CAP) conv.thread.splice(0, conv.thread.length - GJ_TURN_CAP);
  conv.ts = Date.now();
  save();
}
function gjFormatThread(thread, limit){
  return (thread || []).slice(-(limit || GJ_TURN_CAP)).map(function(t){
    return (t.who === "them" ? "Them: " : "Me: ") + t.text;
  }).join("\n");
}
/* a history row saved before the carousel existed only has .cards —
   read it as a one-generation session rather than migrating the file */
function gjEntryGens(h){ return h.generations || [{ cards: h.cards || [], ts: h.ts }]; }

/* Reply/Rewrite: every Regenerate is a new generation, not a
   replacement. Hitting Regenerate on the same input+settings appends
   to the session already on top of history; anything else — new
   text, a changed style pill — starts a fresh session. */
function gjPushGeneration(mode, input, context, cfg, cards, mood){
  var active = gjActiveGen[mode];
  var continuation = active && active.input === input && gjSameCfg(active.cfg, cfg) &&
    (mode !== "reply" || (active.context || "") === context);
  if(continuation){
    active.generations.push({ cards:cards, ts:Date.now() });
    active.ts = Date.now();
    if(mood) active.mood = mood;   /* re-detected each regenerate; keep the latest read */
    var i = S.gj.history.indexOf(active);
    if(i > 0){ S.gj.history.splice(i, 1); S.gj.history.unshift(active); }
    gjCarIdx[mode] = active.generations.length - 1;
  }else{
    var entry = { mode:mode, input:input, context:context, cfg:cfg, mood:mood || "",
      generations:[{ cards:cards, ts:Date.now() }], ts:Date.now() };
    S.gj.history.unshift(entry);
    if(S.gj.history.length > 40) S.gj.history.length = 40;
    gjActiveGen[mode] = entry;
    gjCarIdx[mode] = 0;
  }
  save();
  gjRefreshCounts();
}
/* After a reload, or coming back from another screen, silently
   reattach to the matching history entry so the carousel picks up
   where it left off instead of looking cleared. */
function gjReconcileActive(mode){
  if(gjActiveGen[mode]) return;
  var top = S.gj.history[0];
  if(!top || top.mode !== mode || !top.generations) return;
  var cfg = { lang:S.gj.lang, style:S.gj.style, length:S.gj.length, texting:S.gj.texting };
  var ctx = mode === "reply" ? gjCtx.trim() : "";
  if(top.input === (gjText[mode] || "").trim() && gjSameCfg(top.cfg, cfg) && (top.context || "") === ctx){
    gjActiveGen[mode] = top;
    gjCarIdx[mode] = top.generations.length - 1;
  }
}
function gjClearMode(mode){
  gjText[mode] = "";
  gjActiveGen[mode] = null;
  gjCarIdx[mode] = 0;
  gjGenError[mode] = null;
  gjBusy = false; gjReqId++;
  if(mode === "reply") gjCtx = "";
  sfxTap();
  renderTranslate();
}
function gjIsSaved(text){ return S.gj.saved.some(function(s){ return s.text === text; }); }
/* One tap toggles: bookmark it if it isn't saved, remove it if it is —
   matching Google's in-place star rather than a separate Save action. */
function gjToggleSaveCard(card, mode){
  var idx = S.gj.saved.findIndex(function(s){ return s.text === card.text; });
  if(idx > -1){
    S.gj.saved.splice(idx, 1);
    save(); sfxTap();
    gjRefreshCounts();
    if(gjSavedOpen) renderTranslate();
    return false;
  }
  S.gj.saved.unshift({ text:card.text, label:card.label, mode:mode, ts:Date.now() });
  if(S.gj.saved.length > 100) S.gj.saved.length = 100;
  save(); sfxGem(); toast("Saved");
  gjRefreshCounts();
  if(gjSavedOpen) renderTranslate();
  return true;
}
/* Google's History groups by calendar date; ours is already
   newest-first, so a running "last label seen" pass is enough. */
function gjDateLabel(ts){
  var d = new Date(ts), now = new Date();
  var startOf = function(x){ var y = new Date(x); y.setHours(0, 0, 0, 0); return y.getTime(); };
  var days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if(days <= 0) return "Today";
  if(days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" });
}
/* Generate updates only #gjOut, not the whole shell, so the footer
   History/Saved badges go stale unless nudged separately. */
function gjRefreshCounts(){
  var h = $("#gjHistBtn"), s = $("#gjSavedBtn");
  if(h) h.innerHTML = "History" + (S.gj.history.length ? ' <span class="cnt">' + S.gj.history.length + '</span>' : "");
  if(s) s.innerHTML = "Saved" + (S.gj.saved.length ? ' <span class="cnt">' + S.gj.saved.length + '</span>' : "");
}

/* ---- prompts ---------------------------------------------------
   Every rule below exists because a textbook translator gets it
   wrong: it normalizes spelling that real speakers vary on purpose,
   it forces English or Gujarati where a real texter wouldn't, and
   it produces one "correct" sentence instead of the several a real
   person might actually send. */

var GJ_RULES =
  "You write the way real bilingual Gujarati speakers actually text on WhatsApp and Instagram — not textbook Gujarati, and not plain English either. " +
  "Mix Gujarati and English only where it genuinely sounds natural; never force an English word in, and never force a Gujarati one either. " +
  "Roman Gujarati spelling varies between real speakers (che/chhe, hu/hun, ha/haa, kya/kyaay, bhai/bro) — don't normalize it to one 'correct' form. " +
  "Never produce a stiff, literal, word-for-word translation.";

function gjLangRule(lang){
  if(lang === "roman")
    return "Write in Roman-script Gujlish: real Gujarati words and grammar spelled in Latin letters, the way a Gujarati speaker actually texts — " +
      "for example 'Haa bhai, hu free chu aaje raate' or 'Aaje kai plan nathi yaar'. " +
      "This must actually be Gujarati, not plain English written in Roman letters — keep an English word only where a real speaker naturally would " +
      "(like 'meeting', 'plan', 'call'), never write the whole reply in English. No Gujarati Unicode.";
  if(lang === "script")
    return "Write in natural Gujarati Unicode script — the same natural code-mixed register people actually text in, not a stiff formal-Gujarati translation, " +
      "and not plain English.";
  return "Write in plain, casual English.";
}
function gjLengthRule(len){
  if(len === "short")    return "Keep it very short — under about 8 words, the way a real quick text reply looks.";
  if(len === "detailed") return "Two short sentences — still text-message length, not an essay.";
  return "One natural sentence.";
}
function gjTextingRule(tx){
  if(tx === "clean")      return "No slang, no abbreviations, no emoji.";
  if(tx === "verycasual") return "Heavier texting style is fine — abbreviations, slang, filler words like 'bhai'/'yaar', and an emoji if it actually fits.";
  return "Light, natural texting register — a filler word or one emoji is fine if it fits, but don't overdo it.";
}
function gjRelationRule(id){
  if(id === "crush")     return "This is someone you're romantically interested in — a little more thoughtful and warm, without being over the top.";
  if(id === "stranger")  return "You don't know this person well — stay polite and a bit more careful, not overly familiar.";
  if(id === "family")    return "This is family — warm and respectful. Dial back anything edgy no matter what the boldness level below says.";
  if(id === "colleague") return "This is a colleague — friendly, but professional-adjacent, not locker-room casual.";
  if(id === "group")     return "This is a group chat, not a one-on-one — there's an audience, so a little more performative is fine.";
  if(id === "women")     return "Be genuinely respectful and attentive in tone.";
  return "This is a close friend — fully casual, no filter needed.";
}
function gjStrengthRule(n){
  n = +n || 3;
  if(n <= 1) return "Very safe and mild — nothing that could read as edgy, sarcastic, or forward.";
  if(n === 2) return "Safe — friendly and low-key, minimal risk-taking.";
  if(n === 3) return "Balanced — normal texting confidence, a little personality is fine.";
  if(n === 4) return "Bold — confident, a bit cheeky or teasing is welcome.";
  return "Savage — sharp and unfiltered. Still not cruel or actually hurtful, just don't hold back.";
}

function gjReplySystem(style, relation, strength){
  return GJ_RULES + "\n\n" +
    "You are replying to an incoming message on someone's behalf. Produce exactly 3 different, ready-to-send replies — " +
    "genuinely different phrasing and tone from each other, not the same sentence three times. " +
    "Anchor the FIRST reply on this requested style: " + gjLab(GJ_STYLE, style) + ". " +
    "Give the other two sensible complementary alternatives (for example a more casual one and a more Gujarati-heavy one, or a more polished one — use judgement). " +
    "For every reply, invent your own short 1-3 word label describing its flavor (e.g. \"Casual\", \"Natural Gujlish\", \"More Gujarati\", \"Polite\", \"Playful\").\n" +
    "Who this is to: " + gjLab(GJ_RELATION, relation) + " — " + gjRelationRule(relation) + "\n" +
    "Reply boldness: " + (GJ_STRENGTH_LAB[strength] || "Balanced") + " — " + gjStrengthRule(strength) + "\n\n" +
    "Also read the incoming message's mood — one of: happy, angry, dry, sarcastic, flirty, confused, serious, neutral. " +
    "Let that genuinely inform the replies (a dry \"okay\" calls for something different than an angry one).\n" +
    "For every reply, also predict — in \"predicted\" — one short, natural line for how the other person would plausibly respond " +
    "if this exact message were sent. Same language and register as the reply itself, not a translation of it. A real guess, not a generic one.\n\n" +
    "Output ONLY strict JSON, no markdown fences, no commentary, in exactly this shape:\n" +
    '{"mood":"...","replies":[{"label":"...","text":"...","predicted":"..."},{"label":"...","text":"...","predicted":"..."},{"label":"...","text":"...","predicted":"..."}]}\n' +
    '"mood" is one lowercase word from the list above. Put it first, before the longer fields, in case the response is ever cut short.';
}
function gjRewriteSystem(style, relation, strength){
  return GJ_RULES + "\n\n" +
    "You are rewriting a person's own draft message so it sounds more natural, keeping their intended meaning intact. " +
    "Produce exactly 3 different rewritten versions — genuinely different phrasing and tone, not the same sentence three times. " +
    "Anchor the FIRST version on this requested style: " + gjLab(GJ_STYLE, style) + ". " +
    "Give the other two sensible complementary alternatives. " +
    "For every version, invent your own short 1-3 word label describing its flavor.\n" +
    "Who this is to: " + gjLab(GJ_RELATION, relation) + " — " + gjRelationRule(relation) + "\n" +
    "Reply boldness: " + (GJ_STRENGTH_LAB[strength] || "Balanced") + " — " + gjStrengthRule(strength) + "\n" +
    "For every version, also predict — in \"predicted\" — one short, natural line for how the recipient would plausibly respond " +
    "if this exact message were sent. Same language and register as the message itself. A real guess, not a generic one.\n\n" +
    "Output ONLY strict JSON, no markdown fences, no commentary, in exactly this shape:\n" +
    '{"replies":[{"label":"...","text":"...","predicted":"..."},{"label":"...","text":"...","predicted":"..."},{"label":"...","text":"...","predicted":"..."}]}';
}
function gjTranslateSystem(){
  return "You translate between English, Gujarati script, and Roman Gujlish, preserving natural meaning and tone rather than translating word-for-word. " +
    "The input may itself already be code-mixed Gujlish — that is normal; translate what it actually means. Detect the input language yourself.\n\n" +
    "Output ONLY strict JSON, no markdown fences, no commentary, in exactly this shape:\n" +
    '{"detected":"...","translation":"...","note":""}\n' +
    '"detected" is one short word for what you read: "Gujlish", "Gujarati", or "English". Put it first in the JSON, before the longer fields, ' +
    "in case the response is ever cut short.\n" +
    '"note" is optional — leave it empty unless there is a genuinely useful nuance (idiom, ambiguity, register) worth one short line. Do not add filler notes.';
}

function gjParseJson(txt){
  var m = String(txt).match(/\{[\s\S]*\}/);
  if(!m) return null;
  try{ return JSON.parse(m[0]); }catch(e){ return null; }
}
/* If the response got cut off mid-JSON (hit maxTokens on a longer
   reply set), a full JSON.parse fails on the whole blob even though
   most of it is fine. Salvage whichever individual {"label",...} pairs
   are complete rather than showing the raw JSON as a "reply". */
function gjSalvageReplies(txt){
  var out = [];
  var re = /\{\s*"label"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"(?:\s*,\s*"predicted"\s*:\s*"((?:[^"\\]|\\.)*)")?\s*\}/g;
  var m;
  while((m = re.exec(String(txt)))){
    try{
      out.push({
        label: JSON.parse('"' + m[1] + '"'),
        text: JSON.parse('"' + m[2] + '"'),
        predicted: m[3] ? (function(){ try{ return JSON.parse('"' + m[3] + '"'); }catch(e){ return ""; } })() : ""
      });
    }catch(e){}
  }
  return out;
}

/* ---- generation -------------------------------------------------- */

function gjRunGenerate(){
  var mode = S.gj.mode;
  var input = (gjText[mode] || "").trim();
  if(!input){ toast("Type something first"); return; }
  var myReqId = ++gjReqId;   /* if a slower earlier request resolves after this one, ignore it */
  gjBusy = true;
  if(mode === "translate") gjResults = null;
  else gjGenError[mode] = null;
  /* reply/rewrite deliberately do NOT clear gjActiveGen here — the
     existing carousel stays on screen, just dimmed, while a new
     generation is fetched, instead of vanishing and coming back */
  gjRenderOut();

  var sys, user, maxT, cfg, context, activeConv;
  if(mode === "translate"){
    sys = gjTranslateSystem();
    user = "Translate this to " + gjLab(GJ_LANG, S.gj.trlang) + ":\n\n" + input;
    maxT = 400;
  }else{
    if(mode === "reply" && S.gj.activeConv){
      activeConv = gjConvById(S.gj.activeConv);
      context = [activeConv ? gjFormatThread(activeConv.thread, 40) : "", gjCtx.trim()].filter(Boolean).join("\n");
    }else{
      context = mode === "reply" ? gjCtx.trim() : "";
    }
    cfg = { lang:S.gj.lang, style:S.gj.style, length:S.gj.length, texting:S.gj.texting,
      relation:S.gj.relation, strength:S.gj.strength, conv: mode === "reply" ? S.gj.activeConv : "" };
    sys = mode === "reply" ? gjReplySystem(S.gj.style, S.gj.relation, S.gj.strength)
                           : gjRewriteSystem(S.gj.style, S.gj.relation, S.gj.strength);
    user = (mode === "reply" ? "Incoming message: " : "Message to rewrite: ") + JSON.stringify(input) + "\n\n" +
      (mode === "reply" && context ? "Recent conversation, oldest first:\n" + context + "\n\n" : "") +
      "Output language: " + gjLab(GJ_LANG, S.gj.lang) + " — " + gjLangRule(S.gj.lang) + "\n" +
      "Length: " + gjLab(GJ_LENGTH, S.gj.length) + " — " + gjLengthRule(S.gj.length) + "\n" +
      "Texting style: " + gjLab(GJ_TEXTING, S.gj.texting) + " — " + gjTextingRule(S.gj.texting);
    maxT = 1500;   /* romanized Gujlish tokenizes inefficiently; the predicted-reply field adds real length too */
  }

  AI.chat([{ role:"system", content:sys }, { role:"user", content:user }], maxT).then(function(txt){
    if(myReqId !== gjReqId) return;   /* a newer request has already started */
    var j = gjParseJson(txt);
    gjBusy = false;
    if(mode === "translate"){
      var salvageT = String(txt).match(/"translation"\s*:\s*"((?:[^"\\]|\\.)*)/);
      var cards = (j && j.translation) ? [{ label:"Translation", text:String(j.translation).trim() }]
        : salvageT ? [{ label:"Translation", text:(function(){ try{ return JSON.parse('"' + salvageT[1] + '"'); }catch(e){ return salvageT[1]; } })().trim() }]
        : [{ label:"Translation", text:txt.trim() }];
      var note = (j && j.note) ? String(j.note).trim() : "";
      var detected = (j && j.detected) ? String(j.detected).trim() : "";
      gjResults = { mode:mode, cards:cards, note:note, detected:detected };
      gjPushHistory({
        mode:mode, input:input, context:"",
        cfg:{ lang:S.gj.lang, trlang:S.gj.trlang, style:S.gj.style, length:S.gj.length, texting:S.gj.texting },
        cards:cards, ts:Date.now()
      });
    }else{
      var salvage = gjSalvageReplies(txt);
      var repCards = (j && Array.isArray(j.replies) && j.replies.length)
        ? j.replies.filter(function(r){ return r && r.text; })
            .map(function(r){ return { label:String(r.label || "Reply"), text:String(r.text).trim(),
              predicted:String(r.predicted || "").trim() }; })
        : salvage.length ? salvage
        : [{ label: mode === "reply" ? "Reply" : "Rewrite", text:txt.trim(), predicted:"" }];
      var mood = (mode === "reply" && j && j.mood) ? String(j.mood).trim().toLowerCase() : "";
      gjPushGeneration(mode, input, context, cfg, repCards, mood);
      if(mode === "reply" && S.gj.activeConv) gjAppendTurn(S.gj.activeConv, "them", input);
    }
    gjRenderOut();
  }).catch(function(e){
    if(myReqId !== gjReqId) return;
    gjBusy = false;
    if(mode === "translate") gjResults = { mode:mode, cards:[], error:aiErrorText(e) };
    else if(gjActiveGen[mode]) toast("Couldn't regenerate — " + aiErrorText(e));
    else gjGenError[mode] = aiErrorText(e);
    gjRenderOut();
  });
}

function gjRenderOut(){
  var box = $("#gjOut");
  if(!box) return;
  if(S.gj.mode === "translate") return gjRenderTranslateOut(box);
  return gjRenderCarousel(box, S.gj.mode);
}

/* Reply/Rewrite: a horizontal carousel of past generations for the
   current draft. Regenerate appends a new one and jumps to it;
   Previous/Next/dots/swipe move between the ones already made.
   Nothing here is ever overwritten — only Clear starts over. */
function gjRenderCarousel(box, mode){
  var active = gjActiveGen[mode];
  var body = "";

  if(!active){
    if(gjBusy){
      body = '<div class="glass pad" style="margin-top:16px"><span class="typing"><i></i><i></i><i></i></span></div>';
    }else if(gjGenError[mode]){
      body = '<div class="glass pad" style="margin-top:16px"><div class="status">' +
        '<span class="dot off"></span>' + esc(gjGenError[mode]) + '</div></div>';
    }
  }else{
    var gens = active.generations;
    var idx = Math.min(gjCarIdx[mode], gens.length - 1);
    gjCarIdx[mode] = idx;
    var gen = gens[idx], multi = gen.cards.length > 1;
    body =
      (mode === "reply" && active.mood ? '<div class="moodbadge">' +
        '<span class="moodicon">' + (GJ_MOOD_ICON[active.mood] || "🙂") + '</span>' +
        '<span>Their message reads <b>' + esc(active.mood) + '</b></span>' +
      '</div>' : "") +
      '<div class="genhead">' +
        '<span class="genlab">Generation <b>' + (idx + 1) + '</b> / ' + gens.length + '</span>' +
        '<span class="genvar">' + gen.cards.length + ' variations</span>' +
      '</div>' +
      (gens.length > 1 ? '<div class="gendots">' + gens.map(function(_, i){
        return '<button class="gendot' + (i === idx ? " on" : "") + '" data-gi="' + i + '" aria-label="Generation ' + (i + 1) + '"' +
          (gjBusy ? " disabled" : "") + '></button>';
      }).join("") + '</div>' : "") +
      '<div class="gencards' + (gjBusy ? " busy" : "") + '" tabindex="0">' +
        '<div class="rcards">' + gen.cards.map(function(c, i){
          return '<div class="rcard' + (i === 0 && multi ? " rec" : "") + '">' +
            '<div class="rcard-top">' +
              '<span class="rcard-lab">' + esc(c.label) + '</span>' +
              (i === 0 && multi ? '<span class="rcard-badge">Recommended</span>' : "") +
            '</div>' +
            '<div class="rcard-txt' + (looksGujScript(c.text) ? " guj" : "") + '">' + esc(c.text) + '</div>' +
            '<div class="rcard-actions">' +
              '<button class="rcard-btn primary" data-gcopy="' + i + '">Copy</button>' +
              '<button class="rcard-btn bookmark' + (gjIsSaved(c.text) ? " on" : "") + '" data-gbm="' + i + '" ' +
                'aria-label="' + (gjIsSaved(c.text) ? "Remove from saved" : "Save") + '">' + (gjIsSaved(c.text) ? "★" : "☆") + '</button>' +
            '</div>' +
            (c.predicted
              ? '<button class="predicttoggle">🔮 Predict their reply</button>' +
                '<div class="predictblock" hidden>' +
                  '<span class="predictlab">They might say</span>' +
                  '<div class="predicttxt' + (looksGujScript(c.predicted) ? " guj" : "") + '">' + esc(c.predicted) + '</div>' +
                '</div>'
              : "") +
          '</div>';
        }).join("") + '</div>' +
      '</div>';
  }

  body += '<div class="gencarnav">' +
    '<button class="btn ghost sm" id="gjClear">Clear</button>' +
    (active ? '<button class="gennav-btn" id="gjPrev" aria-label="Previous generation"' +
      (gjCarIdx[mode] === 0 || gjBusy ? " disabled" : "") + '>‹</button>' : "") +
    '<button class="btn" id="gjGo"' + (gjBusy ? " disabled" : "") + '>' +
      (gjBusy ? "Generating…" : (active ? "Regenerate" : "Generate")) + '</button>' +
    (active ? '<button class="gennav-btn" id="gjNext" aria-label="Next generation"' +
      (gjCarIdx[mode] === active.generations.length - 1 || gjBusy ? " disabled" : "") + '>›</button>' : "") +
  '</div>';

  box.innerHTML = body;

  if(active){
    var gens2 = active.generations, curCards = gens2[gjCarIdx[mode]].cards;
    each($$("#gjOut [data-gcopy]"), function(b){
      b.onclick = function(){
        var text = curCards[+b.getAttribute("data-gcopy")].text;
        copyText(text, b);
        /* copying is the closest signal we get to "I'm using this one" —
           that's what actually grows the conversation's memory */
        if(mode === "reply" && S.gj.activeConv) gjAppendTurn(S.gj.activeConv, "me", text);
      };
    });
    each($$("#gjOut [data-gbm]"), function(b){
      b.onclick = function(){
        var c = curCards[+b.getAttribute("data-gbm")];
        var nowSaved = gjToggleSaveCard(c, mode);
        b.classList.toggle("on", nowSaved);
        b.textContent = nowSaved ? "★" : "☆";
        b.setAttribute("aria-label", nowSaved ? "Remove from saved" : "Save");
        if(nowSaved) gjFlash(b);
      };
    });
    each($$("#gjOut .predicttoggle"), function(b){
      b.onclick = function(){
        var block = b.nextElementSibling;
        if(block) block.hidden = false;
        b.hidden = true;
      };
    });
    each($$("#gjOut [data-gi]"), function(b){
      b.onclick = function(){ gjCarIdx[mode] = +b.getAttribute("data-gi"); sfxTap(); gjRenderOut(); };
    });
    var prevBtn = $("#gjPrev"), nextBtn = $("#gjNext");
    if(prevBtn) prevBtn.onclick = function(){ if(gjCarIdx[mode] > 0){ gjCarIdx[mode]--; sfxTap(); gjRenderOut(); } };
    if(nextBtn) nextBtn.onclick = function(){ if(gjCarIdx[mode] < gens2.length - 1){ gjCarIdx[mode]++; sfxTap(); gjRenderOut(); } };
    var cardsWrap = $(".gencards");
    if(cardsWrap){
      cardsWrap.onkeydown = function(e){
        if(e.key === "ArrowLeft" && prevBtn && !prevBtn.disabled) prevBtn.click();
        else if(e.key === "ArrowRight" && nextBtn && !nextBtn.disabled) nextBtn.click();
      };
      gjWireSwipe(cardsWrap, mode);
    }
  }
  $("#gjClear").onclick = function(){ gjClearMode(mode); };
  $("#gjGo").onclick = function(){ gjText[mode] = $("#gjIn").value; sfxTap(); gjRunGenerate(); };
}

/* Pointer Events cover mouse-drag on desktop and touch-swipe on
   mobile with one handler. Direction is decided on release, not
   dragged live — simpler, and the per-card fade-in on re-render
   already gives the switch some motion. */
function gjWireSwipe(el, mode){
  if(!el) return;
  var startX = 0, startY = 0, dragging = false;
  el.addEventListener("pointerdown", function(e){ startX = e.clientX; startY = e.clientY; dragging = true; });
  el.addEventListener("pointerup", function(e){
    if(!dragging) return;
    dragging = false;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    if(Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    var active = gjActiveGen[mode];
    if(!active || gjBusy) return;
    if(dx < 0 && gjCarIdx[mode] < active.generations.length - 1){ gjCarIdx[mode]++; sfxTap(); gjRenderOut(); }
    else if(dx > 0 && gjCarIdx[mode] > 0){ gjCarIdx[mode]--; sfxTap(); gjRenderOut(); }
  });
  el.addEventListener("pointercancel", function(){ dragging = false; });
}

/* the Google-style right-hand pane: a plain block of text, not a
   card — the shape only makes sense because translate mode always
   produces exactly one answer, unlike reply/rewrite's three */
var SPEECH_LANG = { script:"gu-IN", english:"en-US" };
function gjRenderTranslateOut(box){
  gjRefreshDetected();
  gjUpdateSwap();
  if(gjBusy){
    box.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    return;
  }
  if(!gjResults || gjResults.mode !== "translate"){
    box.innerHTML = '<div class="gtempty">Translation</div>';
    return;
  }
  if(gjResults.error){
    box.innerHTML = '<div class="status"><span class="dot off"></span>' + esc(gjResults.error) + '</div>';
    return;
  }
  var text = gjResults.cards[0].text;
  var canSpeak = !!(window.speechSynthesis && SPEECH_LANG[S.gj.trlang]);
  var isSaved = gjIsSaved(text);
  box.innerHTML = '<div class="gtout-txt' + (looksGujScript(text) ? " guj" : "") + '">' + esc(text) + '</div>' +
    (gjResults.note ? '<div class="hintline">' + esc(gjResults.note) + '</div>' : "") +
    '<div class="gtpanefoot out">' +
      '<span></span>' +
      '<span class="gticons">' +
        (canSpeak ? '<button class="gticon" id="gjSpeak" aria-label="Listen" title="Listen">🔊</button>' : "") +
        '<button class="gticon" id="gjOutCopy" aria-label="Copy" title="Copy">⧉</button>' +
        '<button class="gticon bookmark' + (isSaved ? " on" : "") + '" id="gjOutSave" ' +
          'aria-label="' + (isSaved ? "Remove from saved" : "Save") + '" title="' + (isSaved ? "Remove from saved" : "Save") + '">' +
          (isSaved ? "★" : "☆") + '</button>' +
      '</span>' +
    '</div>';
  var sp = $("#gjSpeak");
  if(sp) sp.onclick = function(){ gjSpeak(text, SPEECH_LANG[S.gj.trlang]); };
  $("#gjOutCopy").onclick = function(){ copyText(text, $("#gjOutCopy")); };
  $("#gjOutSave").onclick = function(){
    var nowSaved = gjToggleSaveCard(gjResults.cards[0], "translate");
    var btn = $("#gjOutSave");
    btn.classList.toggle("on", nowSaved);
    btn.textContent = nowSaved ? "★" : "☆";
    btn.setAttribute("aria-label", nowSaved ? "Remove from saved" : "Save");
    if(nowSaved) gjFlash(btn);
  };
}
function gjRefreshDetected(){
  var d = $("#gtDetected");
  if(!d) return;
  d.textContent = (gjResults && gjResults.mode === "translate" && gjResults.detected) ? gjResults.detected : "Detect language";
}
function gjSpeak(text, lang){
  if(!window.speechSynthesis) return;
  try{
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    window.speechSynthesis.speak(u);
  }catch(e){}
}

/* ---- config controls --------------------------------------------- */

function gjPillRow(label, opts, cur, key){
  return '<div class="cfggroup">' +
    '<div class="cfglab">' + esc(label) + '</div>' +
    '<div class="pillrow">' + opts.map(function(o){
      return '<button class="pill' + (cur === o.id ? " on" : "") + '" data-' + key + '="' + o.id + '">' + esc(o.lab) + '</button>';
    }).join("") + '</div>' +
  '</div>';
}
function gjStrengthHTML(){
  return '<div class="cfggroup">' +
    '<div class="cfglab">Reply boldness</div>' +
    '<div class="strengthrow">' +
      '<span class="strengthend">Safe</span>' +
      [1, 2, 3, 4, 5].map(function(n){
        return '<button class="strengthpip' + (+S.gj.strength === n ? " on" : "") + '" data-strength="' + n + '" ' +
          'aria-label="' + esc(GJ_STRENGTH_LAB[n]) + '" title="' + esc(GJ_STRENGTH_LAB[n]) + '">' + n + '</button>';
      }).join("") +
      '<span class="strengthend">Savage</span>' +
    '</div>' +
  '</div>';
}
function gjCfgHTML(){
  return gjPillRow("Language", gjLangOpts(), S.gj.lang, "lang") +
    gjPillRow("Style", GJ_STYLE, S.gj.style, "style") +
    gjPillRow("Length", GJ_LENGTH, S.gj.length, "length") +
    gjPillRow("Texting style", GJ_TEXTING, S.gj.texting, "texting") +
    gjPillRow("Talking to", GJ_RELATION, S.gj.relation, "relation") +
    gjStrengthHTML();
}
function gjWirePills(){
  ["lang", "style", "length", "texting", "trlang", "relation"].forEach(function(key){
    each($$("[data-" + key + "]"), function(b){
      b.onclick = function(){
        S.gj[key] = b.getAttribute("data-" + key);
        save(); sfxTap();
        each($$("[data-" + key + "]"), function(x){ x.classList.toggle("on", x === b); });
        /* the target language is part of the translation itself, so
           switching it re-runs immediately rather than waiting on
           another edit to the text */
        if(key === "trlang" && S.gj.mode === "translate" && gjText.translate.trim()){
          clearTimeout(gjDebounce);
          gjRunGenerate();
        }
      };
    });
  });
  each($$("[data-strength]"), function(b){
    b.onclick = function(){
      S.gj.strength = +b.getAttribute("data-strength");
      save(); sfxTap();
      each($$("[data-strength]"), function(x){ x.classList.toggle("on", x === b); });
    };
  });
}

function gjContextHTML(){
  return '<div class="ctxwrap">' +
    '<button class="linkbtn" id="gjCtxToggle">' + (gjCtxOpen ? "− Hide context" : "+ Add context") + '</button>' +
    (gjCtxOpen
      ? '<textarea id="gjCtxIn" class="trin ctxin" rows="3" ' +
          'placeholder="Them: I’m free tonight&#10;Me: Really?&#10;Them: Yeah, nothing planned" ' +
          'autocomplete="off" spellcheck="false">' + esc(gjCtx) + '</textarea>'
      : "") +
  '</div>';
}
function gjWireContext(){
  var t = $("#gjCtxToggle");
  if(t) t.onclick = function(){ gjCtxOpen = !gjCtxOpen; sfxTap(); renderTranslate(); };
  var c = $("#gjCtxIn");
  if(c) c.oninput = function(){ gjCtx = c.value; };
}

/* ---- conversation memory picker (Reply mode only) ------------------ */

function gjConversationHTML(){
  var conv = S.gj.activeConv ? gjConvById(S.gj.activeConv) : null;
  if(conv === null) S.gj.activeConv = "";   /* was deleted elsewhere */
  return '<div class="cfggroup">' +
    '<div class="cfglab">Conversation</div>' +
    '<div class="pillrow">' +
      '<button class="pill' + (!S.gj.activeConv ? " on" : "") + '" data-convid="">No memory</button>' +
      S.gj.conversations.map(function(c){
        return '<button class="pill' + (S.gj.activeConv === c.id ? " on" : "") + '" data-convid="' + c.id + '">' + esc(c.name) + '</button>';
      }).join("") +
      '<button class="pill new" id="gjNewConvBtn">+ New</button>' +
    '</div>' +
    (gjNewConvOpen
      ? '<div class="convnew">' +
          '<input id="gjNewConvName" type="text" placeholder="Their name — e.g. Rahul" autocomplete="off">' +
          '<button class="btn sm" id="gjNewConvCreate">Create</button>' +
        '</div>'
      : "") +
    (conv
      ? '<div class="convthread">' +
          '<div class="convthread-head">' +
            '<span>' + esc(conv.thread.length) + ' remembered turn' + (conv.thread.length === 1 ? "" : "s") + '</span>' +
            '<button class="linkbtn sm" id="gjConvClear">Clear</button>' +
            '<button class="linkbtn sm" id="gjConvDelete">Delete</button>' +
          '</div>' +
          (conv.thread.length
            ? conv.thread.slice(-4).map(function(t){
                return '<div class="convline"><b>' + (t.who === "them" ? "Them" : "Me") + ':</b> ' + esc(t.text) + '</div>';
              }).join("")
            : '<div class="convline convline-empty">Nothing yet — generate a reply and it starts remembering.</div>') +
        '</div>'
      : "") +
  '</div>';
}
function gjWireConversation(){
  each($$("[data-convid]"), function(b){
    b.onclick = function(){
      S.gj.activeConv = b.getAttribute("data-convid");
      gjNewConvOpen = false;
      save(); sfxTap();
      renderTranslate();
    };
  });
  var nb = $("#gjNewConvBtn");
  if(nb) nb.onclick = function(){ gjNewConvOpen = !gjNewConvOpen; sfxTap(); renderTranslate(); };
  var create = $("#gjNewConvCreate");
  if(create){
    var doCreate = function(){
      var input = $("#gjNewConvName");
      var conv = gjNewConversation(input ? input.value : "");
      if(conv){ gjNewConvOpen = false; sfxGem(); renderTranslate(); }
    };
    create.onclick = doCreate;
    var input = $("#gjNewConvName");
    if(input) input.onkeydown = function(e){ if(e.key === "Enter"){ e.preventDefault(); doCreate(); } };
  }
  var clr = $("#gjConvClear");
  if(clr) clr.onclick = function(){
    var conv = gjConvById(S.gj.activeConv);
    if(conv && confirm("Clear everything remembered in “" + conv.name + "”? This can't be undone.")){
      conv.thread = []; save(); sfxTap(); renderTranslate();
    }
  };
  var del = $("#gjConvDelete");
  if(del) del.onclick = function(){
    var conv = gjConvById(S.gj.activeConv);
    if(conv && confirm("Delete the conversation “" + conv.name + "”? This can't be undone.")){
      gjDeleteConversation(conv.id); sfxTap(); renderTranslate();
    }
  };
}

/* ---- reply / rewrite pane (unchanged card-based UI) --------------- */

function gjReplyRewritePaneHTML(mode){
  var placeholder = mode === "reply" ? "What's your plan today?" : "Paste your message here…";
  return '<textarea id="gjIn" class="trin" rows="3" placeholder="' + esc(placeholder) + '" ' +
      'autocomplete="off" spellcheck="false" aria-label="Message">' + esc(gjText[mode]) + '</textarea>' +
    (mode === "reply" ? gjConversationHTML() + gjContextHTML() : "") +
    gjCfgHTML() +
    '<div id="gjOut"></div>';
}
function gjWireReplyRewritePane(mode){
  var ta = $("#gjIn");
  ta.oninput = function(){ gjText[mode] = ta.value; };
  ta.onkeydown = function(e){
    if(e.key === "Enter" && (e.metaKey || e.ctrlKey)){
      e.preventDefault();
      var g = $("#gjGo");
      if(g && !g.disabled) g.click();
    }
  };
  if(mode === "reply"){ gjWireConversation(); gjWireContext(); }
  gjWirePills();
  gjReconcileActive(mode);
  gjRenderOut();
}

/* ---- translate pane — Google Translate's shape: a language bar,
   two plain panes, live output as you pause typing -------------------- */

function gjTranslatePaneHTML(){
  var canSwap = !!(gjResults && gjResults.mode === "translate" && !gjResults.error);
  return '<div class="gtbar">' +
      '<div class="gtlang" id="gtDetected">' +
        (gjResults && gjResults.mode === "translate" && gjResults.detected ? esc(gjResults.detected) : "Detect language") +
      '</div>' +
      '<button class="gtswap" id="gjSwap" aria-label="Use translation as new input" title="Use translation as new input"' +
        (canSwap ? "" : " disabled") + '>⇄</button>' +
      '<div class="pillrow gtto">' + gjLangOpts().map(function(o){
        return '<button class="pill' + (S.gj.trlang === o.id ? " on" : "") + '" data-trlang="' + o.id + '">' + esc(o.lab) + '</button>';
      }).join("") + '</div>' +
    '</div>' +
    '<div class="gtpanes">' +
      '<div class="gtpane">' +
        '<textarea id="gjIn" class="gtta" placeholder="Type or paste anything…" ' +
          'autocomplete="off" spellcheck="false" aria-label="Text to translate">' + esc(gjText.translate) + '</textarea>' +
        '<div class="gtpanefoot">' +
          '<span class="gtcount" id="gjCount">' + (gjText.translate || "").length + '</span>' +
          '<span class="gticons">' +
            (gjText.translate ? '<button class="gticon" id="gjClearX" aria-label="Clear" title="Clear">✕</button>' : "") +
          '</span>' +
        '</div>' +
      '</div>' +
      '<div class="gtdivider" aria-hidden="true"></div>' +
      '<div class="gtpane gtpane-out"><div id="gjOut"></div></div>' +
    '</div>';
}

function gjUpdateCount(){
  var c = $("#gjCount");
  if(c) c.textContent = (gjText.translate || "").length;
}
function gjUpdateSwap(){
  var b = $("#gjSwap");
  if(b) b.disabled = !(gjResults && gjResults.mode === "translate" && !gjResults.error);
}
function gjSwapTranslate(){
  if(!(gjResults && gjResults.mode === "translate" && !gjResults.error)) return;
  var newText = gjResults.cards[0].text;
  gjText.translate = newText;
  var ta = $("#gjIn");
  if(ta) ta.value = newText;
  gjResults = null;
  clearTimeout(gjDebounce);
  sfxTap();
  gjUpdateCount();
  gjRunGenerate();
}

function gjWireTranslatePane(){
  var ta = $("#gjIn");
  ta.oninput = function(){
    gjText.translate = ta.value;
    gjUpdateCount();
    clearTimeout(gjDebounce);
    if(!ta.value.trim()){
      gjResults = null; gjBusy = false; gjReqId++;
      gjRenderOut(); gjUpdateSwap();
      var x = $("#gjClearX"); if(x) x.remove();
      return;
    }
    if(!$("#gjClearX")){
      var foot = $(".gtpanefoot .gticons");
      if(foot) foot.innerHTML = '<button class="gticon" id="gjClearX" aria-label="Clear" title="Clear">✕</button>';
      wireClearX();
    }
    /* Google-style: translate on its own, ~1s after you stop typing,
       rather than waiting for a button — this does call the model
       automatically, so it spends OpenRouter credit as you type and
       pause, not only on an explicit click. */
    gjDebounce = setTimeout(function(){ gjRunGenerate(); }, 900);
  };
  ta.onkeydown = function(e){
    if(e.key === "Enter" && (e.metaKey || e.ctrlKey)){
      e.preventDefault();
      clearTimeout(gjDebounce);
      if(ta.value.trim()) gjRunGenerate();
    }
  };
  function wireClearX(){
    var x = $("#gjClearX");
    if(x) x.onclick = function(){
      gjText.translate = ""; ta.value = ""; gjResults = null; gjBusy = false; gjReqId++;
      clearTimeout(gjDebounce); sfxTap(); gjUpdateCount(); gjRenderOut(); gjUpdateSwap();
      x.remove();
      ta.focus();
    };
  }
  wireClearX();
  $("#gjSwap").onclick = gjSwapTranslate;
  gjWirePills();
  gjRenderOut();
}

function gjNoKeyHTML(){
  return '<div class="glass pad" style="margin-top:16px">' +
    '<div class="sidehead"><span>Add a key to start</span></div>' +
    '<div class="why" style="margin:0 0 14px">This runs on your own OpenRouter key. It is stored only in ' +
      'this browser, never in the app file, and goes nowhere except OpenRouter.</div>' +
    '<div class="rowbtns"><button class="btn" id="gjSetKey">Open settings</button></div>' +
  '</div>';
}

/* ---- history & saved ----------------------------------------------- */

function gjHistoryPanel(){
  if(!S.gj.history.length){
    return '<div class="glass pad" style="margin-top:14px"><div class="hintline" style="margin:0">' +
      'Nothing yet — your last translations, replies, and rewrites will show up here.</div></div>';
  }
  var out = "", lastLabel = null;
  S.gj.history.forEach(function(h, i){
    var label = gjDateLabel(h.ts);
    if(label !== lastLabel){ out += '<div class="histdate">' + esc(label) + '</div>'; lastLabel = label; }
    var gens = gjEntryGens(h);
    var lastCards = gens[gens.length - 1].cards;
    var top = lastCards && lastCards[0] ? lastCards[0].text : "";
    var isSaved = top && gjIsSaved(top);
    out += '<div class="histrow" data-hi="' + i + '">' +
      '<div class="histrow-main">' +
        '<div class="histmeta"><span class="histmode">' + esc(gjModeLab(h.mode)) +
          (gens.length > 1 ? ' <span class="histgen">×' + gens.length + '</span>' : "") +
          '</span></div>' +
        '<div class="histin">' + esc(h.input) + '</div>' +
        '<div class="histout' + (top && looksGujScript(top) ? " guj" : "") + '">' + esc(top) + '</div>' +
      '</div>' +
      (top ? '<button class="gticon bookmark' + (isSaved ? " on" : "") + '" data-hbm="' + i + '" ' +
        'aria-label="' + (isSaved ? "Remove from saved" : "Save") + '">' + (isSaved ? "★" : "☆") + '</button>' : "") +
    '</div>';
  });
  return '<div class="histlist">' + out + '</div>';
}
function gjWireHistory(){
  each($$(".histrow"), function(row){
    row.onclick = function(){
      var h = S.gj.history[+row.getAttribute("data-hi")];
      if(!h) return;
      S.gj.mode = h.mode;
      gjText[h.mode] = h.input;
      if(h.mode === "reply") gjCtx = h.context || "";
      if(h.cfg){
        if(h.cfg.lang) S.gj.lang = h.cfg.lang;
        if(h.cfg.trlang) S.gj.trlang = h.cfg.trlang;
        if(h.cfg.style) S.gj.style = h.cfg.style;
        if(h.cfg.length) S.gj.length = h.cfg.length;
        if(h.cfg.texting) S.gj.texting = h.cfg.texting;
        if(h.cfg.relation) S.gj.relation = h.cfg.relation;
        if(h.cfg.strength) S.gj.strength = h.cfg.strength;
        if(h.mode === "reply") S.gj.activeConv = h.cfg.conv || "";
      }
      if(h.mode === "translate"){
        gjResults = { mode:"translate", cards:h.cards, note:"", detected:"" };
      }else{
        if(!h.generations) h.generations = gjEntryGens(h);   /* upgrade a pre-carousel row in place */
        gjActiveGen[h.mode] = h;
        gjCarIdx[h.mode] = h.generations.length - 1;
      }
      gjHistOpen = false;
      save(); sfxTap();
      renderTranslate();
    };
  });
  each($$("[data-hbm]"), function(b){
    b.onclick = function(e){
      e.stopPropagation();
      var h = S.gj.history[+b.getAttribute("data-hbm")];
      if(!h) return;
      var gens = gjEntryGens(h);
      var top = gens[gens.length - 1].cards[0];
      if(!top) return;
      var nowSaved = gjToggleSaveCard(top, h.mode);
      b.classList.toggle("on", nowSaved);
      b.textContent = nowSaved ? "★" : "☆";
      b.setAttribute("aria-label", nowSaved ? "Remove from saved" : "Save");
      if(nowSaved) gjFlash(b);
    };
  });
}

/* A single flat list, matching Google's Phrasebook — we only have one
   kind of saved item, so a second tab would just be empty chrome. */
function gjSavedPanel(){
  if(!S.gj.saved.length){
    return '<div class="glass pad" style="margin-top:14px"><div class="hintline" style="margin:0">' +
      'Nothing saved yet — tap the star on any reply or translation to keep it here.</div></div>';
  }
  return '<div class="savedlist">' + S.gj.saved.map(function(sv, i){
    return '<div class="savedrow" data-si="' + i + '">' +
      '<div class="savedrow-body">' +
        '<div class="savedrow-txt' + (looksGujScript(sv.text) ? " guj" : "") + '">' + esc(sv.text) + '</div>' +
        '<div class="savedrow-meta">' + esc(sv.label || "") + (sv.label ? " · " : "") + timeAgo(sv.ts) + '</div>' +
      '</div>' +
      '<div class="savedrow-icons">' +
        '<button class="gticon" data-scopy="' + i + '" aria-label="Copy" title="Copy">⧉</button>' +
        '<button class="gticon bookmark on" data-sdel="' + i + '" aria-label="Remove from saved" title="Remove from saved">★</button>' +
      '</div>' +
    '</div>';
  }).join("") + '</div>';
}
function gjWireSaved(){
  each($$("[data-scopy]"), function(b){
    b.onclick = function(){ copyText(S.gj.saved[+b.getAttribute("data-scopy")].text, b); };
  });
  each($$("[data-sdel]"), function(b){
    b.onclick = function(){
      S.gj.saved.splice(+b.getAttribute("data-sdel"), 1);
      save(); sfxTap(); gjRefreshCounts(); renderTranslate();
    };
  });
}

/* ---- shell ---------------------------------------------------------- */

function renderTranslate(){
  var mode = S.gj.mode;
  var ready = AI.on();
  app.classList.toggle("wide", mode === "translate");

  /* the one <em> word per headline carries the gradient-italic accent —
     fixed, developer-authored strings, safe to embed as raw HTML */
  var heroH1 = mode === "reply" ? "Reply like you <em>mean it</em>"
    : mode === "rewrite" ? "Make it sound <em>natural</em>"
    : "Say it <em>right</em>";
  var heroP = mode === "reply"
    ? "Paste what they sent you and get three ready-to-send replies."
    : mode === "rewrite"
    ? "Paste your own draft and get three more natural versions."
    : "Translate between English, Roman Gujlish, and Gujarati script — by meaning, not word for word.";

  app.innerHTML = topBar() +
  '<div class="hero">' +
    '<div class="eyebrow">Gujlish AI</div>' +
    '<h1>' + heroH1 + '</h1>' +
    '<p>' + esc(heroP) + '</p>' +
  '</div>' +
  '<div class="modesw" role="group" aria-label="Mode">' +
    GJ_MODES.map(function(m){
      return '<button class="modeb' + (mode === m.id ? " on" : "") + '" data-mode="' + m.id + '">' + esc(m.lab) + '</button>';
    }).join("") +
  '</div>' +
  (!ready ? gjNoKeyHTML() : (mode === "translate" ? gjTranslatePaneHTML() : gjReplyRewritePaneHTML(mode))) +
  '<div class="gjfoot-links">' +
    '<button class="linkbtn" id="gjHistBtn">History' +
      (S.gj.history.length ? ' <span class="cnt">' + S.gj.history.length + '</span>' : "") + '</button>' +
    '<button class="linkbtn" id="gjSavedBtn">Saved' +
      (S.gj.saved.length ? ' <span class="cnt">' + S.gj.saved.length + '</span>' : "") + '</button>' +
  '</div>' +
  (gjHistOpen ? '<div class="panelenter">' + gjHistoryPanel() + '</div>' : "") +
  (gjSavedOpen ? '<div class="panelenter">' + gjSavedPanel() + '</div>' : "");

  each($$("[data-mode]"), function(b){
    b.onclick = function(){
      clearTimeout(gjDebounce);
      S.gj.mode = b.getAttribute("data-mode");
      save(); sfxTap(); gjResults = null; gjBusy = false; gjReqId++;
      renderTranslate();
    };
  });

  if(ready){
    if(mode === "translate") gjWireTranslatePane();
    else gjWireReplyRewritePane(mode);
  }else{
    var setk = $("#gjSetKey");
    if(setk) setk.onclick = function(){ sfxTap(); go("settings"); };
  }

  $("#gjHistBtn").onclick = function(){ gjHistOpen = !gjHistOpen; gjSavedOpen = false; sfxTap(); renderTranslate(); };
  $("#gjSavedBtn").onclick = function(){ gjSavedOpen = !gjSavedOpen; gjHistOpen = false; sfxTap(); renderTranslate(); };
  if(gjHistOpen) gjWireHistory();
  if(gjSavedOpen) gjWireSaved();
}


/* ================================================================
   SETTINGS
   ================================================================ */

function renderSettings(){
  var models = AI_MODELS;
  if(!models.some(function(m){ return m.id === S.ai.model; })){ S.ai.model = models[0].id; save(); }

  app.innerHTML = topBar() +
  '<div class="hero">' +
    '<div class="eyebrow">You</div>' +
    '<h1>Settings</h1>' +
  '</div>' +

  '<div class="glass pad" style="margin-bottom:14px">' +
    '<div class="sidehead"><span>AI</span>' +
      '<span class="chip ' + (AI.on() ? "ai" : "") + '">' + (AI.on() ? "connected" : "off") + '</span></div>' +
    '<div class="warn" style="margin-bottom:16px">' +
      'Your key is stored <b>only in this browser</b> (localStorage) on this device. It is never written into the app file and never sent anywhere except OpenRouter.' +
    '</div>' +
    '<div class="field">' +
      '<label for="k">OpenRouter API key</label>' +
      '<input id="k" type="password" placeholder="sk-or-v1-…" value="' + esc(S.ai.key || "") + '" autocomplete="off" spellcheck="false">' +
      '<div class="hint">Get one at openrouter.ai → Keys. Paste it here, not into a chat window.</div>' +
    '</div>' +
    '<div class="field">' +
      '<label for="m">Model</label>' +
      '<select id="m">' + models.map(function(m){
        return '<option value="' + esc(m.id) + '"' + (S.ai.model === m.id ? " selected" : "") +
               '>' + esc(m.lab) + ' — ' + esc(m.cost) + '</option>';
      }).join("") + '</select>' +
      '<div class="hint" id="mnote"></div>' +
    '</div>' +
    '<div class="rowbtns">' +
      '<button class="btn ghost" id="clearKey">Remove key</button>' +
      '<button class="btn" id="saveKey">Save &amp; test</button>' +
    '</div>' +
    '<div id="aiStatus" style="margin-top:12px"></div>' +
  '</div>' +

  '<div class="glass pad">' +
    '<div class="sidehead"><span>Sound</span></div>' +
    '<div class="pillrow">' +
      '<button class="pill' + (S.sound ? " on" : "") + '" id="sndOn">On</button>' +
      '<button class="pill' + (S.sound ? "" : " on") + '" id="sndOff">Off</button>' +
    '</div>' +
  '</div>';

  $("#sndOn").onclick = function(){ S.sound = true; save(); sfxTap(); renderSettings(); };
  $("#sndOff").onclick = function(){ S.sound = false; save(); renderSettings(); };

  function showNote(){
    var sel = $("#m"), box = $("#mnote");
    if(!sel || !box) return;
    var m = models.filter(function(x){ return x.id === sel.value; })[0];
    box.innerHTML = m ? esc(m.note) + ' <span style="color:var(--cotton-4)">· ' + esc(m.id) + '</span>' : "";
  }
  var msel = $("#m");
  if(msel) msel.onchange = showNote;
  showNote();

  $("#saveKey").onclick = function(){
    S.ai.key = $("#k").value.trim();
    S.ai.model = $("#m").value;
    save();
    var box = $("#aiStatus");
    if(!S.ai.key){ box.innerHTML = '<div class="status"><span class="dot off"></span>No key saved.</div>'; paintShell(); return; }
    box.innerHTML = '<div class="status"><span class="typing"><i></i><i></i><i></i></span> Testing…</div>';
    AI.chat([{ role:"user", content:"Reply with exactly: ok" }], 12).then(function(){
      box.innerHTML = '<div class="status"><span class="dot on"></span>Connected.</div>';
      sfxGem(); paintShell();
    }).catch(function(e){
      box.innerHTML = '<div class="status"><span class="dot off"></span>' + esc(aiErrorText(e)) + '</div>';
      paintShell();
    });
  };

  $("#clearKey").onclick = function(){
    S.ai.key = ""; save();
    $("#k").value = "";
    $("#aiStatus").innerHTML = '<div class="status"><span class="dot off"></span>Key removed from this browser.</div>';
    sfxTap(); paintShell();
  };
}


/* ================================================================
   BOOT
   ================================================================ */

save();
go("translate");

})();

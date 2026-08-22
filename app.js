/* ================================================================
   FLASHREPLY — Gujlish AI
   A reply/rewrite/translate assistant for real, code-mixed
   Gujarati-English. Runs entirely on the model — real Gujlish
   spelling, code-switching, and register are not something a
   rule table can fake convincingly.
   ================================================================ */

(function(){
"use strict";

/* Also hand-duplicated in the native keyboard project as
   gujlish-keyboard/Shared/AIModels.swift — that copy doesn't update
   itself, so mirror any add/remove/reprice here over there too. */
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
if(!S.eleven) S.eleven = { key:"", voiceId:"" };
if(!S.gj) S.gj = { mode:"reply", lang:"roman", trlang:"roman", style:"gujlish",
  length:"short", relation:"friend", strength:3, emotion:"cool", history:[], saved:[] };
if(!S.gj.history)  S.gj.history = [];
if(!S.gj.saved)    S.gj.saved = [];
if(!S.gj.trlang)   S.gj.trlang = "roman";
/* "script" (ગુજરાતી) was removed as a language option in favor of Hinglish —
   anyone whose saved preference still points at it falls back to Roman Gujlish. */
if(S.gj.trlang === "script") S.gj.trlang = "roman";
if(S.gj.lang === "script")   S.gj.lang = "roman";
if(!S.gj.relation) S.gj.relation = "friend";
if(!S.gj.strength) S.gj.strength = 3;
if(!S.gj.emotion)  S.gj.emotion = "cool";
if(!S.gj.formality) S.gj.formality = 3;
if(!S.gj.burst) S.gj.burst = "natural";
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

/* one consistent line-icon set, replacing the mismatched emoji glyphs
   (🔊 ⧉ ★ ‹ › ⇄ 🔮) that used to sit in these buttons — every icon
   here shares the same stroke weight and uses currentColor, so it
   just inherits whatever color the surrounding button/state already
   sets (hover, .on, .bookmark.on, disabled) with no extra wiring */
var ICON_PATHS = {
  speak: '<path d="M4.5 9.5v5h3.1l4.9 3.7V5.8l-4.9 3.7H4.5z"/><path d="M15.3 9.2a3.9 3.9 0 0 1 0 5.6"/><path d="M17.8 6.6a7.4 7.4 0 0 1 0 10.8"/>',
  copy: '<rect x="8.2" y="8.2" width="11.3" height="11.3" rx="2.6"/><path d="M15.5 8.2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.2"/>',
  star: '<path d="M12 3.6l2.35 4.86 5.3.6-3.9 3.75.94 5.3L12 15.5l-4.69 2.6.94-5.3-3.9-3.75 5.3-.6z"/>',
  chevronLeft: '<path d="M14.8 5.3l-6.4 6.7 6.4 6.7"/>',
  chevronRight: '<path d="M9.2 5.3l6.4 6.7-6.4 6.7"/>',
  swap: '<path d="M6 8.3h12.3m0 0l-3.6-3.6M18.3 8.3l-3.6 3.6"/><path d="M18 15.7H5.7m0 0l3.6 3.6M5.7 15.7l3.6-3.6"/>',
  sparkle: '<path d="M12 3.6l1.35 3.75L17.1 8.7l-3.75 1.35L12 13.8l-1.35-3.75L6.9 8.7l3.75-1.35z"/><path d="M18.6 14.5l.72 1.86 1.86.72-1.86.72-.72 1.86-.72-1.86-1.86-.72 1.86-.72z"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 3.4v2.5M12 18.1v2.5M20.6 12h-2.5M5.9 12H3.4M17.9 6.1l-1.77 1.77M7.87 16.13L6.1 17.9M17.9 17.9l-1.77-1.77M7.87 7.87L6.1 6.1"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  share: '<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>'
};
function gjIcon(name, size){
  var body = ICON_PATHS[name];
  if(!body) return "";
  size = size || 17;
  return '<svg class="gicon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
}

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
      if(j.usage && j.usage.total_tokens) gjRecordUsage(model, j.usage.total_tokens);
      return m.content;
    });
  }
};

/* A rough running total for THIS session only (resets on reload, not
   persisted) — the point is an honest "what has this actually cost so
   far" gut-check, not a precise bill. Free/Unverified models can't be
   priced, so those tokens just get flagged instead of guessed at. */
var gjUsage = { tokens:0, cost:0, unpriced:false };
var gjTtsChars = 0;
function gjRecordUsage(model, tokens){
  gjUsage.tokens += tokens;
  var m = AI_MODELS.filter(function(x){ return x.id === model; })[0];
  var priceMatch = m && m.cost && m.cost.match(/\$([\d.]+)/);
  if(priceMatch) gjUsage.cost += (tokens / 1000) * parseFloat(priceMatch[1]);
  else gjUsage.unpriced = true;
}

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

/* Real neural voice, on your own ElevenLabs key — costs their credits
   per call, every call, by design: you asked for it to be available
   whenever you want, not metered or held back. Falls back to the
   browser's free built-in voice whenever this isn't configured, or
   if a call to it fails. */
var gjAudioEl = null;
var Eleven = {
  on: function(){ return !!(S.eleven && S.eleven.key && S.eleven.voiceId); },
  speak: function(text){
    var key = S.eleven.key, voiceId = S.eleven.voiceId;
    gjTtsChars += text.length;
    return fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId), {
      method: "POST",
      headers: { "Content-Type":"application/json", "Accept":"audio/mpeg", "xi-api-key":key },
      body: JSON.stringify({ text:text, model_id:"eleven_multilingual_v2" })
    }).then(function(r){
      if(!r.ok) return r.text().then(function(t){ throw new Error("HTTP " + r.status + " — " + t.slice(0, 140)); });
      return r.blob();
    }).then(function(blob){
      return new Promise(function(resolve, reject){
        if(gjAudioEl){ gjAudioEl.pause(); }
        var url = URL.createObjectURL(blob);
        var audio = new Audio(url);
        gjAudioEl = audio;
        audio.onended = function(){ URL.revokeObjectURL(url); resolve(); };
        audio.onerror = function(){ URL.revokeObjectURL(url); reject(new Error("Playback failed.")); };
        audio.play().catch(reject);
      });
    });
  }
};
function elevenErrorText(e){
  var m = (e && e.message) || String(e);
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)){
    return "Couldn't reach ElevenLabs. If you're on the shared artifact link, outside connections are blocked there — run the local copy instead. Otherwise check your connection.";
  }
  if(/HTTP 401/.test(m)) return "ElevenLabs rejected the key. Check it in Settings.";
  if(/HTTP 400|HTTP 404/.test(m)) return "ElevenLabs didn't recognize that voice ID. Check it in Settings.";
  if(/HTTP 429/.test(m)) return "ElevenLabs rate limit or out of credit. Wait a moment or check your account.";
  return m;
}

/* ================================================================
   SHELL
   ================================================================ */

var screen = "translate";
/* label says "Assistant", not "Translate" — the screen inside holds
   Translate/Reply/Rewrite as its own mode switcher, so naming the nav
   item after just one of those modes collided with whichever mode was
   actually active (the nav stayed lit on "Translate" even in Reply) */
var TABS = [
  { id:"translate", ic:gjIcon("swap", 18), t:"Assistant" },
  { id:"settings",  ic:gjIcon("gear", 18), t:"You" }
];

function paintShell(){
  var rail = $("#rail"), tabs = $("#tabs");
  rail.innerHTML = '<div class="brand">Flash<br><em>Reply</em></div>' +
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

/* Reply leads since it's the mode actually used most day to day — the
   other two stay available but no longer share equal top billing. */
var GJ_MODES = [
  { id:"reply",      lab:"Reply" },
  { id:"translate",  lab:"Translate" },
  { id:"rewrite",    lab:"Rewrite" }
];

/* tap-to-try starters for a blank textarea — first thing a new visitor
   sees is an empty box with no sense of what the app actually does */
var GJ_EXAMPLES = {
  translate: ["Aaje kai khas plan nathi, tu bol?", "Are you free this weekend?"],
  reply:     ["Kal office aavish ke?", "Tu kya kar rahi hati?"],
  rewrite:   ["hey wat r u doing 2nite, wanna hang", "cant make it today sry, next time?"]
};
function gjExampleChips(mode){
  var list = GJ_EXAMPLES[mode];
  if(!list) return "";
  return '<div class="examplerow">' +
    '<span class="examplelab">Try:</span>' +
    list.map(function(t, i){ return '<button class="examplechip" data-ex="' + i + '">' + esc(t) + '</button>'; }).join("") +
  '</div>';
}
var GJ_LANG = [
  { id:"roman",    lab:"Roman Gujlish" },
  { id:"english",  lab:"English" },
  { id:"hinglish", lab:"Hinglish" }
];
var GJ_STYLE = [
  { id:"casual",  lab:"Casual" },
  { id:"gujlish", lab:"Natural Gujlish" },
  { id:"polite",  lab:"Polite" },
  { id:"funny",   lab:"Funny" },
  { id:"flirty",  lab:"Flirty" },
  { id:"pro",     lab:"Professional" },
  { id:"human",   lab:"Human Mode" }
];
var GJ_LENGTH = [
  { id:"short",    lab:"Short" },
  { id:"normal",   lab:"Normal" },
  { id:"detailed", lab:"Detailed" }
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
var GJ_STRENGTH_LIST = [1, 2, 3, 4, 5].map(function(n){ return { id:n, lab:GJ_STRENGTH_LAB[n] }; });
/* Quick tone default alongside Style — a slider rather than another
   dropdown, since Formal<->Casual is genuinely a spectrum (unlike Style's
   distinct flavors like Funny/Flirty/Human Mode, which stay a picker). */
var GJ_FORMALITY_LAB = { 1:"Very formal", 2:"Formal", 3:"Neutral", 4:"Casual", 5:"Very casual" };
var GJ_EMOTION = [
  { id:"happy",     lab:"Happy" },
  { id:"angry",     lab:"Angry" },
  { id:"sad",       lab:"Sad" },
  { id:"romantic",  lab:"Romantic" },
  { id:"emotional", lab:"Emotional" },
  { id:"cool",      lab:"Cool" },
  { id:"slang",     lab:"Slang" }
];
var GJ_MOOD_ICON = {
  happy:"😊", angry:"😠", dry:"😑", sarcastic:"😏", flirty:"😉",
  confused:"😕", serious:"😐", neutral:"🙂"
};
function gjLab(list, id){ var m = list.filter(function(o){ return o.id === id; })[0]; return m ? m.lab : id; }
function gjModeLab(id){ return gjLab(GJ_MODES, id); }
function looksGujScript(s){ return /[઀-૿]/.test(String(s)); }
/* A quick, deliberately imperfect client-side guess at what output
   language makes sense for what you just typed — good enough for a
   smart DEFAULT, not meant to replace the model's own real detection.
   Gujarati script or clearly Gujlish input → you probably want it in
   plain English; anything else → the app's whole point is turning
   English into Gujlish, so that's the default direction. */
function gjGuessTargetLang(input){
  var t = String(input).toLowerCase();
  if(looksGujScript(t)) return "english";
  if(/\b(che|chhe|hu|hun|nathi|karo|karu|kem|kya|kyare|kevi|kyaay|tame|tu|aaje|kale|bhai|yaar)\b/.test(t)) return "english";
  return "roman";
}

/* per-mode drafts, so switching modes never loses what you typed */
var gjText = { translate:"", reply:"", rewrite:"" };
var gjCtx = "";
var gjCtxOpen = false;
var gjNewConvOpen = false;
var gjTopicState = null;   /* { convId, busy, items:[...], error } — topic-suggestion generator */
var gjResults = null;    /* { mode, cards:[{label,text}], note, detected, error } — translate mode only */
var gjActiveGen = { reply:null, rewrite:null };  /* the live history entry backing each mode's carousel */
var gjCarIdx    = { reply:0, rewrite:0 };        /* which generation within it is on screen */
var gjGenError  = { reply:null, rewrite:null };  /* set only when there's no carousel yet to fall back to */
var gjBusy = false;
var gjReqId = 0;         /* bumped per request, so a slow abandoned call can't clobber a newer one */
var gjDebounce = null;   /* translate mode fires ~1s after typing stops, Google-style */
var gjTrlangManual = false;  /* true once you've manually tapped a target-language pill this input — stops auto-guessing from fighting your choice, resets when the input is cleared */
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
/* the native share sheet, one tap straight into WhatsApp/Instagram/SMS —
   falls back to plain Copy wherever navigator.share isn't available
   (most desktop browsers). A cancelled share isn't an error, just quiet. */
function shareText(t, btn){
  if(navigator.share){
    sfxTap();
    navigator.share({ text:t }).catch(function(){});
  }else{
    copyText(t, btn);
  }
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
  return !!a && !!b && a.lang === b.lang && a.style === b.style && a.length === b.length &&
    a.relation === b.relation && a.strength === b.strength && a.emotion === b.emotion &&
    (a.formality || 3) === (b.formality || 3) && (a.burst || "natural") === (b.burst || "natural") &&
    (a.conv || "") === (b.conv || "");
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
  if(gjTopicState && gjTopicState.convId === convId) gjTopicState = null;   /* new activity — any old suggestions are stale */
  save();
}
function gjFormatThread(thread, limit){
  return (thread || []).slice(-(limit || GJ_TURN_CAP)).map(function(t){
    return (t.who === "them" ? "Them: " : "Me: ") + t.text;
  }).join("\n");
}
/* a rough "this is going quiet" read — no real send timestamps to work
   from, so it's word-count based: the last few turns are all short,
   low-effort lines rather than an actual back-and forth */
function gjConvDying(thread){
  if(!thread || thread.length < 3) return false;
  var recent = thread.slice(-3);
  var words = recent.map(function(t){ return (t.text || "").trim().split(/\s+/).filter(Boolean).length; });
  return words.every(function(n){ return n > 0 && n <= 4; });
}
function gjTopicSystem(relation){
  return GJ_RULES + "\n\n" +
    "This conversation has gone quiet — short, low-effort lines back and forth. Suggest exactly 3 short, natural lines the user could send next " +
    "to revive it — genuinely different angles (e.g. a direct question, a callback to something said earlier in the thread, a lighthearted new topic). " +
    "These are messages to actually send, not descriptions of topics.\n" +
    "Who this is to: " + gjLab(GJ_RELATION, relation) + " — " + gjRelationRule(relation) + "\n\n" +
    "Output ONLY strict JSON, no markdown fences, no commentary, in exactly this shape:\n" +
    '{"topics":["...","...","..."]}';
}
function gjRunTopics(){
  var conv = gjConvById(S.gj.activeConv);
  if(!conv) return;
  gjTopicState = { convId:conv.id, busy:true, items:null, error:null };
  renderTranslate();
  var sys = gjTopicSystem(S.gj.relation);
  var user = "Recent conversation, oldest first:\n" + gjFormatThread(conv.thread, 20);
  AI.chat([{ role:"system", content:sys }, { role:"user", content:user }], 300).then(function(txt){
    if(!gjTopicState || gjTopicState.convId !== conv.id) return;
    var j = gjParseJson(txt);
    gjTopicState.busy = false;
    if(j && Array.isArray(j.topics) && j.topics.length){
      gjTopicState.items = j.topics.slice(0, 3).map(String);
    }else{
      gjTopicState.error = "Couldn't get suggestions — try again.";
    }
    renderTranslate();
  }).catch(function(e){
    if(!gjTopicState || gjTopicState.convId !== conv.id) return;
    gjTopicState.busy = false;
    gjTopicState.error = aiErrorText(e);
    renderTranslate();
  });
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
  var cfg = { lang:S.gj.lang, style:S.gj.style, length:S.gj.length };
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

var GJ_BURST = [
  { id:"off",     lab:"Off" },
  { id:"natural", lab:"Natural" },
  { id:"longer",  lab:"Longer" }
];
/* Real texting is rarely one smooth sentence stitched together with commas
   or "and" — a reply with more than one distinct beat (a statement plus a
   follow-up question, a reaction plus a question back) usually goes out as
   separate messages instead. This is model judgment, not a hard rule, so
   it's a genuine setting rather than always-on: Off keeps everything one
   message, Natural is the original 2-3 line behavior, Longer allows up to 4. */
function gjBurstRule(burst){
  if(burst === "off")
    return "Always write the reply as a single message on one line — never split it into multiple lines for any reason, even if it naturally " +
      "has more than one beat; combine it into one flowing sentence instead.";
  var maxLines = burst === "longer" ? "3-4" : "2-3";
  var rule = "Real texting is rarely one smooth sentence stitched together with commas or 'and'. The moment a reply has more than one distinct beat — " +
    "a statement plus a follow-up question, a reaction plus a question back, two separate points — a real person sends those as SEPARATE " +
    "messages, not one composed sentence. For example, someone asked what they ate would text back 'Aaje dal-bhaat khadhu' and 'Tu shu khadhu?' " +
    "as two separate texts, never joined into one line with 'and'. An impatient exchange might look like: 'Arey baba etlo' / 'Arey baba' / " +
    "'etlo gusso kem' / 'Tane jovani utaval hoy' / 'etle vaar vaar puchu chu' — five short blunt bursts, not one line. Default to splitting into " +
    maxLines + " short separate lines (joined by \\n in the same field) whenever a reply has more than one beat — stay on one line only when " +
    "there is genuinely just a single thought with nothing else attached.";
  if(burst === "longer")
    rule += " Push yourself to find every distinct beat available, not just the first split you notice — a greeting or reaction, a status update, " +
      "a feeling, a question back are each their own beat and each get their own line. Don't settle for 2 lines when a genuine 3rd or 4th beat " +
      "is available in what's actually being said — really stretch it out into that many separate texts. Still never invent a beat that isn't " +
      "genuinely there just to pad the count.";
  return rule;
}

function gjLangRule(lang){
  if(lang === "roman")
    return "Write in Roman-script Gujlish: real Gujarati words and grammar spelled in Latin letters, the way a Gujarati speaker actually texts — " +
      "for example 'Haa bhai, hu free chu aaje raate' or 'Aaje kai plan nathi yaar'. " +
      "This must actually be Gujarati, not plain English written in Roman letters — keep an English word only where a real speaker naturally would " +
      "(like 'meeting', 'plan', 'call'), never write the whole reply in English. No Gujarati Unicode.";
  if(lang === "hinglish")
    return "Write in Hinglish: real Hindi words and grammar spelled in Latin letters, mixed with English the way Hindi-English bilingual speakers " +
      "actually text — for example 'Haan yaar, aaj free hoon raat ko' or 'Kal ka plan kya hai bata'. " +
      "This must actually be Hindi, not Gujarati and not plain English written in Roman letters — keep an English word only where a real speaker " +
      "naturally would, never write the whole reply in English. No Devanagari script.";
  return "Write in plain, casual English.";
}
function gjLengthRule(len){
  if(len === "short")    return "Keep it very short — under about 8 words, the way a real quick text reply looks.";
  if(len === "detailed") return "Two short sentences — still text-message length, not an essay.";
  return "One natural sentence.";
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
/* "Human Mode" — the one style that isn't a tone/flavor but a directive
   to actively strip out AI-assistant tells, since GJ_RULES alone still
   lets a reply come out grammatically tidy and a little too eager */
function gjStyleRule(style){
  if(style === "human")
    return "This reply must NOT read like it came from an AI assistant. Actively avoid: perfect grammar, overly polished sentences, " +
      "corporate or customer-service phrasing (never anything like \"That sounds wonderful!\" or \"I would be happy to...\"), " +
      "repetitive AI stock phrases, and any unnecessary explaining. Write it short, a little imperfect, exactly like a real person " +
      "firing off a text on their phone — dropped words, casual punctuation, a stray emoji if it genuinely fits. " +
      "Example — AI-ish: \"That sounds wonderful! I would be happy to make plans with you.\" Human: \"Haa 😂 kai plan kariye pachi?\"";
  return "";
}
function gjEmotionRule(id){
  if(id === "happy")     return "Let genuine warmth and upbeat energy come through.";
  if(id === "angry")     return "Let real frustration or annoyance come through — sharper, more clipped phrasing.";
  if(id === "sad")       return "Let a subdued, down mood come through — quieter, lower-energy phrasing.";
  if(id === "romantic")  return "Write with warmth and tenderness — a little flirtatious or affectionate.";
  if(id === "emotional") return "Let real feeling come through openly — earnest and heartfelt, not guarded.";
  if(id === "slang")     return "Lean heavily into slang and casual shorthand — however a real friend would actually text it.";
  return "Stay relaxed and unbothered — low-key and effortless, not overly enthusiastic.";
}
function gjStrengthRule(n){
  n = +n || 3;
  if(n <= 1) return "Very safe and mild — nothing that could read as edgy, sarcastic, or forward.";
  if(n === 2) return "Safe — friendly and low-key, minimal risk-taking.";
  if(n === 3) return "Balanced — normal texting confidence, a little personality is fine.";
  if(n === 4) return "Bold — confident, a bit cheeky or teasing is welcome.";
  return "Savage — sharp and unfiltered. Still not cruel or actually hurtful, just don't hold back.";
}
function gjFormalityRule(n){
  n = +n || 3;
  if(n <= 1) return "Very formal register — respectful and measured, as if writing to someone you owe real politeness to. No slang.";
  if(n === 2) return "Formal — polite and a little proper, but not stiff.";
  if(n === 3) return "Neutral — normal everyday tone, neither dressed up nor sloppy.";
  if(n === 4) return "Casual — relaxed everyday texting, contractions and mild slang are fine.";
  return "Very casual — fully loose, heavy slang and shorthand, exactly how close friends actually text.";
}

function gjBurstJsonHint(burst){
  if(burst === "off")
    return '"text" is always a single line — never split it, even if the reply has more than one beat.';
  var maxLines = burst === "longer" ? "3-4" : "2-3";
  return '"text" should split into ' + maxLines + ' short lines separated by \\n whenever the reply has more than one beat (see above) — one line only when there\'s genuinely just a single thought.';
}
function gjReplySystem(style, relation, strength, emotion, formality, burst){
  return GJ_RULES + "\n\n" + gjBurstRule(burst) + "\n\n" +
    "You are replying to an incoming message on someone's behalf. Produce exactly 3 different, ready-to-send replies — " +
    "genuinely different phrasing and tone from each other, not the same sentence three times. " +
    "Anchor the FIRST reply on this requested style: " + gjLab(GJ_STYLE, style) + ". " + gjStyleRule(style) + " " +
    "Give the other two sensible complementary alternatives (for example a more casual one and a more Gujarati-heavy one, or a more polished one — use judgement). " +
    "For every reply, invent your own short 1-3 word label describing its flavor (e.g. \"Casual\", \"Natural Gujlish\", \"More Gujarati\", \"Polite\", \"Playful\").\n" +
    "Who this is to: " + gjLab(GJ_RELATION, relation) + " — " + gjRelationRule(relation) + "\n" +
    "Reply boldness: " + (GJ_STRENGTH_LAB[strength] || "Balanced") + " — " + gjStrengthRule(strength) + "\n" +
    "Emotional tone to write in: " + gjLab(GJ_EMOTION, emotion) + " — " + gjEmotionRule(emotion) + "\n" +
    "Formality: " + (GJ_FORMALITY_LAB[formality] || "Neutral") + " — " + gjFormalityRule(formality) + "\n\n" +
    "Also read the incoming message's mood — one of: happy, angry, dry, sarcastic, flirty, confused, serious, neutral. " +
    "Let that genuinely inform the replies (a dry \"okay\" calls for something different than an angry one).\n" +
    "For every reply, also predict — in \"predicted\" — one short, natural line for how the other person would plausibly respond " +
    "if this exact message were sent. Same language and register as the reply itself, not a translation of it. A real guess, not a generic one.\n\n" +
    "Output ONLY strict JSON, no markdown fences, no commentary, in exactly this shape:\n" +
    '{"mood":"...","replies":[{"label":"...","text":"...","predicted":"..."},{"label":"...","text":"...","predicted":"..."},{"label":"...","text":"...","predicted":"..."}]}\n' +
    '"mood" is one lowercase word from the list above. Put it first, before the longer fields, in case the response is ever cut short. ' +
    gjBurstJsonHint(burst);
}
function gjRewriteSystem(style, relation, strength, emotion, formality, burst){
  return GJ_RULES + "\n\n" + gjBurstRule(burst) + "\n\n" +
    "You are rewriting a person's own draft message so it sounds more natural, keeping their intended meaning intact. " +
    "Produce exactly 3 different rewritten versions — genuinely different phrasing and tone, not the same sentence three times. " +
    "Anchor the FIRST version on this requested style: " + gjLab(GJ_STYLE, style) + ". " + gjStyleRule(style) + " " +
    "Give the other two sensible complementary alternatives. " +
    "For every version, invent your own short 1-3 word label describing its flavor.\n" +
    "Who this is to: " + gjLab(GJ_RELATION, relation) + " — " + gjRelationRule(relation) + "\n" +
    "Reply boldness: " + (GJ_STRENGTH_LAB[strength] || "Balanced") + " — " + gjStrengthRule(strength) + "\n" +
    "Emotional tone to write in: " + gjLab(GJ_EMOTION, emotion) + " — " + gjEmotionRule(emotion) + "\n" +
    "Formality: " + (GJ_FORMALITY_LAB[formality] || "Neutral") + " — " + gjFormalityRule(formality) + "\n" +
    "For every version, also predict — in \"predicted\" — one short, natural line for how the recipient would plausibly respond " +
    "if this exact message were sent. Same language and register as the message itself. A real guess, not a generic one.\n\n" +
    "Output ONLY strict JSON, no markdown fences, no commentary, in exactly this shape:\n" +
    '{"replies":[{"label":"...","text":"...","predicted":"..."},{"label":"...","text":"...","predicted":"..."},{"label":"...","text":"...","predicted":"..."}]}\n' +
    gjBurstJsonHint(burst);
}
function gjTranslateSystem(){
  return "You translate between English, Roman Gujlish, and Hinglish, preserving natural meaning and tone rather than translating word-for-word. " +
    "The input may itself already be code-mixed Gujlish or Hinglish — that is normal; translate what it actually means. Detect the input language yourself.\n\n" +
    "Output ONLY strict JSON, no markdown fences, no commentary, in exactly this shape:\n" +
    '{"detected":"...","translation":"...","note":""}\n' +
    '"detected" is one short word for what you read: "Gujlish", "Hinglish", or "English". Put it first in the JSON, before the longer fields, ' +
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
    cfg = { lang:S.gj.lang, style:S.gj.style, length:S.gj.length,
      relation:S.gj.relation, strength:S.gj.strength, emotion:S.gj.emotion, formality:S.gj.formality, burst:S.gj.burst,
      conv: mode === "reply" ? S.gj.activeConv : "" };
    sys = mode === "reply" ? gjReplySystem(S.gj.style, S.gj.relation, S.gj.strength, S.gj.emotion, S.gj.formality, S.gj.burst)
                           : gjRewriteSystem(S.gj.style, S.gj.relation, S.gj.strength, S.gj.emotion, S.gj.formality, S.gj.burst);
    user = (mode === "reply" ? "Incoming message: " : "Message to rewrite: ") + JSON.stringify(input) + "\n\n" +
      (mode === "reply" && context ? "Recent conversation, oldest first:\n" + context + "\n\n" : "") +
      "Output language: " + gjLab(GJ_LANG, S.gj.lang) + " — " + gjLangRule(S.gj.lang) + "\n" +
      "Length: " + gjLab(GJ_LENGTH, S.gj.length) + " — " + gjLengthRule(S.gj.length) +
      (S.gj.burst !== "off" ? "\nReminder: the multi-beat burst rule from above still applies in this output language — splitting into separate short lines is not " +
      "an English-only trick, real Gujlish/Hinglish texting fragments exactly the same way." +
      (S.gj.burst === "longer" ? " You're in Longer mode — really look for a 3rd and 4th genuine beat before settling for just 2 lines." : "") : "");
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
        cfg:{ lang:S.gj.lang, trlang:S.gj.trlang, style:S.gj.style, length:S.gj.length },
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
            '<div class="rcard-txt' + (looksGujScript(c.text) ? " guj" : "") + '">' +
              c.text.split("\n").map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){
                return '<div class="burstline">' + esc(l) + '</div>';
              }).join("") +
            '</div>' +
            '<div class="rcard-actions">' +
              '<button class="rcard-btn primary" data-gcopy="' + i + '">Copy</button>' +
              '<button class="rcard-btn" data-gshare="' + i + '" aria-label="Share" title="Share">' + gjIcon("share", 15) + '</button>' +
              '<button class="rcard-btn" data-gspeak="' + i + '" aria-label="Listen" title="Listen">' + gjIcon("speak", 15) + '</button>' +
              '<button class="rcard-btn bookmark' + (gjIsSaved(c.text) ? " on" : "") + '" data-gbm="' + i + '" ' +
                'aria-label="' + (gjIsSaved(c.text) ? "Remove from saved" : "Save") + '">' + gjIcon("star", 15) + '</button>' +
            '</div>' +
            (c.predicted
              ? '<button class="predicttoggle">' + gjIcon("sparkle", 13) + ' Predict their reply</button>' +
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
      (gjCarIdx[mode] === 0 || gjBusy ? " disabled" : "") + '>' + gjIcon("chevronLeft", 16) + '</button>' : "") +
    '<button class="btn" id="gjGo"' + (gjBusy ? " disabled" : "") + '>' +
      (gjBusy ? "Generating…" : (active ? "Regenerate" : "Generate")) + '</button>' +
    (active ? '<button class="gennav-btn" id="gjNext" aria-label="Next generation"' +
      (gjCarIdx[mode] === active.generations.length - 1 || gjBusy ? " disabled" : "") + '>' + gjIcon("chevronRight", 16) + '</button>' : "") +
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
    each($$("#gjOut [data-gshare]"), function(b){
      b.onclick = function(){
        var text = curCards[+b.getAttribute("data-gshare")].text;
        shareText(text, b);
        if(mode === "reply" && S.gj.activeConv) gjAppendTurn(S.gj.activeConv, "me", text);
      };
    });
    each($$("#gjOut [data-gspeak]"), function(b){
      b.onclick = function(){
        var text = curCards[+b.getAttribute("data-gspeak")].text;
        gjSpeak(text, SPEECH_LANG[S.gj.lang] || "en-US", b);
      };
    });
    each($$("#gjOut [data-gbm]"), function(b){
      b.onclick = function(){
        var c = curCards[+b.getAttribute("data-gbm")];
        var nowSaved = gjToggleSaveCard(c, mode);
        b.classList.toggle("on", nowSaved);
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
/* roman Gujlish and Hinglish are both romanized code-mixed speech — a
   generic TTS voice reads the Latin letters as English and mangles them,
   so only plain English gets the free browser voice; the others need
   ElevenLabs (see canSpeak below). */
var SPEECH_LANG = { english:"en-US" };
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
  /* ElevenLabs handles code-mixed Gujlish/Hinglish far better than the
     browser's built-in voice, so once it's configured the Listen button
     stops being limited to plain English only */
  var canSpeak = Eleven.on() || !!(window.speechSynthesis && SPEECH_LANG[S.gj.trlang]);
  var isSaved = gjIsSaved(text);
  box.innerHTML = '<div class="gtout-txt' + (looksGujScript(text) ? " guj" : "") + '">' + esc(text) + '</div>' +
    (gjResults.note ? '<div class="hintline">' + esc(gjResults.note) + '</div>' : "") +
    '<div class="gtpanefoot out">' +
      '<span></span>' +
      '<span class="gticons">' +
        (canSpeak ? '<button class="gticon" id="gjSpeak" aria-label="Listen" title="Listen">' + gjIcon("speak") + '</button>' : "") +
        '<button class="gticon" id="gjOutShare" aria-label="Share" title="Share">' + gjIcon("share") + '</button>' +
        '<button class="gticon" id="gjOutCopy" aria-label="Copy" title="Copy">' + gjIcon("copy") + '</button>' +
        '<button class="gticon bookmark' + (isSaved ? " on" : "") + '" id="gjOutSave" ' +
          'aria-label="' + (isSaved ? "Remove from saved" : "Save") + '" title="' + (isSaved ? "Remove from saved" : "Save") + '">' +
          gjIcon("star") + '</button>' +
      '</span>' +
    '</div>';
  var sp = $("#gjSpeak");
  if(sp) sp.onclick = function(){ gjSpeak(text, SPEECH_LANG[S.gj.trlang] || "en-US", sp); };
  $("#gjOutShare").onclick = function(){ shareText(text, $("#gjOutShare")); };
  $("#gjOutCopy").onclick = function(){ copyText(text, $("#gjOutCopy")); };
  $("#gjOutSave").onclick = function(){
    var nowSaved = gjToggleSaveCard(gjResults.cards[0], "translate");
    var btn = $("#gjOutSave");
    btn.classList.toggle("on", nowSaved);
    btn.setAttribute("aria-label", nowSaved ? "Remove from saved" : "Save");
    if(nowSaved) gjFlash(btn);
  };
}
function gjRefreshDetected(){
  var d = $("#gtDetected");
  if(!d) return;
  d.textContent = (gjResults && gjResults.mode === "translate" && gjResults.detected) ? gjResults.detected : "Detect language";
}
function gjSpeak(text, lang, btn){
  if(Eleven.on()){
    if(btn){ btn.classList.add("speaking"); btn.disabled = true; }
    Eleven.speak(text).then(function(){
      if(btn){ btn.classList.remove("speaking"); btn.disabled = false; }
    }).catch(function(e){
      if(btn){ btn.classList.remove("speaking"); btn.disabled = false; }
      toast(elevenErrorText(e));
      gjSpeakBrowser(text, lang);   /* still let them hear something rather than just fail */
    });
    return;
  }
  gjSpeakBrowser(text, lang);
}
function gjSpeakBrowser(text, lang){
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
/* Language/Style/Talking-to/Emotion/Boldness are native <select>
   elements — a custom bottom-sheet picker was tried here, but the plain
   OS picker (checkmarks, native feel) tested better, so this reverted
   back to selects grouped under section labels rather than the old
   always-expanded pill rows. Length stays as inline pills since three
   options never needed a dropdown at all. */
function gjSelectRow(label, opts, cur, key, numeric){
  return '<div class="selrow">' +
    '<label class="selrow-lab" for="sel-' + key + '">' + esc(label) + '</label>' +
    '<select class="selrow-select" id="sel-' + key + '" data-selkey="' + key + '"' + (numeric ? ' data-numeric="1"' : "") + '>' +
      opts.map(function(o){
        var selected = numeric ? (+cur === +o.id) : (cur === o.id);
        return '<option value="' + esc(o.id) + '"' + (selected ? " selected" : "") + '>' + esc(o.lab) + '</option>';
      }).join("") +
    '</select>' +
  '</div>';
}
function gjWireSelects(){
  each($$("[data-selkey]"), function(sel){
    sel.onchange = function(){
      var key = sel.getAttribute("data-selkey");
      S.gj[key] = sel.hasAttribute("data-numeric") ? +sel.value : sel.value;
      save(); sfxTap();
    };
  });
}
function gjFormalityRowHTML(){
  var n = +S.gj.formality || 3;
  return '<div class="selrow rngrow">' +
      '<label class="selrow-lab" for="rng-formality">Formality</label>' +
      '<div class="rngwrap">' +
        '<input type="range" id="rng-formality" min="1" max="5" step="1" value="' + n + '">' +
        '<span class="rngval" id="rngval-formality">' + esc(GJ_FORMALITY_LAB[n]) + '</span>' +
      '</div>' +
    '</div>';
}
function gjWireFormalitySlider(){
  var rng = $("#rng-formality");
  if(!rng) return;
  rng.oninput = function(){
    var n = +rng.value;
    S.gj.formality = n;
    var lab = $("#rngval-formality"); if(lab) lab.textContent = GJ_FORMALITY_LAB[n];
    save();
  };
  rng.onchange = function(){ sfxTap(); };
}
function gjCfgHTML(){
  return '<div class="cfgsection">' +
      '<div class="cfgsectionlab">Reply settings</div>' +
      gjSelectRow("Language", GJ_LANG, S.gj.lang, "lang") +
      gjSelectRow("Style", GJ_STYLE, S.gj.style, "style") +
      gjFormalityRowHTML() +
      gjPillRow("Length", GJ_LENGTH, S.gj.length, "length") +
      gjSelectRow("Talking to", GJ_RELATION, S.gj.relation, "relation") +
      gjSelectRow("Emotion", GJ_EMOTION, S.gj.emotion, "emotion") +
    '</div>' +
    '<div class="cfgsection">' +
      '<div class="cfgsectionlab">More</div>' +
      gjSelectRow("Reply boldness", GJ_STRENGTH_LIST, S.gj.strength, "strength", true) +
      gjSelectRow("Message bursts", GJ_BURST, S.gj.burst, "burst") +
    '</div>';
}
function gjWirePills(){
  gjWireSelects();
  gjWireFormalitySlider();
  ["length", "trlang"].forEach(function(key){
    each($$("[data-" + key + "]"), function(b){
      b.onclick = function(){
        S.gj[key] = b.getAttribute("data-" + key);
        save(); sfxTap();
        each($$("[data-" + key + "]"), function(x){ x.classList.toggle("on", x === b); });
        if(key === "trlang" && S.gj.mode === "translate"){
          gjTrlangManual = true;   /* a real tap always wins over the auto-guess, even before you've typed anything */
          /* the target language is part of the translation itself, so
             switching it re-runs immediately rather than waiting on
             another edit to the text */
          if(gjText.translate.trim()){
            clearTimeout(gjDebounce);
            gjRunGenerate();
          }
        }
      };
    });
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
    (conv && gjConvDying(conv.thread) ? gjTopicHTML(conv) : "") +
  '</div>';
}
function gjTopicHTML(conv){
  var st = (gjTopicState && gjTopicState.convId === conv.id) ? gjTopicState : null;
  return '<div class="topicbox">' +
    '<div class="topicprompt">' + gjIcon("sparkle", 13) + ' Conversation slowing down? <b>Try talking about:</b></div>' +
    (!st
      ? '<button class="linkbtn sm" id="gjTopicBtn">Suggest topics</button>'
      : st.busy
        ? '<span class="typing"><i></i><i></i><i></i></span>'
        : st.error
          ? '<div class="hintline">' + esc(st.error) + ' <button class="linkbtn sm" id="gjTopicBtn">Retry</button></div>'
          : '<div class="topicchips">' + st.items.map(function(t, i){
              return '<button class="topicchip" data-tcopy="' + i + '">' + esc(t) + '</button>';
            }).join("") + '</div>') +
  '</div>';
}
function gjWireConversation(){
  each($$("[data-convid]"), function(b){
    b.onclick = function(){
      S.gj.activeConv = b.getAttribute("data-convid");
      gjNewConvOpen = false;
      gjTopicState = null;
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
      conv.thread = []; gjTopicState = null; save(); sfxTap(); renderTranslate();
    }
  };
  var del = $("#gjConvDelete");
  if(del) del.onclick = function(){
    var conv = gjConvById(S.gj.activeConv);
    if(conv && confirm("Delete the conversation “" + conv.name + "”? This can't be undone.")){
      gjDeleteConversation(conv.id); sfxTap(); renderTranslate();
    }
  };
  var topicBtn = $("#gjTopicBtn");
  if(topicBtn) topicBtn.onclick = function(){ sfxTap(); gjRunTopics(); };
  each($$("[data-tcopy]"), function(b){
    b.onclick = function(){
      var st = gjTopicState;
      var text = st && st.items && st.items[+b.getAttribute("data-tcopy")];
      if(text) copyText(text, b);
    };
  });
}

/* ---- reply / rewrite pane (unchanged card-based UI) --------------- */

function gjReplyRewritePaneHTML(mode){
  var placeholder = mode === "reply" ? "What's your plan today?" : "Paste your message here…";
  return '<textarea id="gjIn" class="trin" rows="3" placeholder="' + esc(placeholder) + '" ' +
      'autocomplete="off" spellcheck="false" aria-label="Message">' + esc(gjText[mode]) + '</textarea>' +
    (!gjText[mode] ? gjExampleChips(mode) : "") +
    (mode === "reply" ? gjConversationHTML() + gjContextHTML() : "") +
    gjCfgHTML() +
    '<div id="gjOut"></div>';
}
function gjWireReplyRewritePane(mode){
  var ta = $("#gjIn");
  ta.oninput = function(){
    gjText[mode] = ta.value;
    if(ta.value){ var exRow = $(".examplerow"); if(exRow) exRow.remove(); }
  };
  ta.onkeydown = function(e){
    if(e.key === "Enter" && (e.metaKey || e.ctrlKey)){
      e.preventDefault();
      var g = $("#gjGo");
      if(g && !g.disabled) g.click();
    }
  };
  each($$("[data-ex]"), function(b){
    b.onclick = function(){
      var text = GJ_EXAMPLES[mode][+b.getAttribute("data-ex")];
      gjText[mode] = text;
      ta.value = text;
      var exRow = $(".examplerow");
      if(exRow) exRow.remove();
      sfxTap();
      ta.focus();
    };
  });
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
        (canSwap ? "" : " disabled") + '>' + gjIcon("swap", 15) + '</button>' +
      '<div class="pillrow gtto">' + GJ_LANG.map(function(o){
        return '<button class="pill' + (S.gj.trlang === o.id ? " on" : "") + '" data-trlang="' + o.id + '">' + esc(o.lab) + '</button>';
      }).join("") + '</div>' +
    '</div>' +
    '<div class="gtpanes">' +
      '<div class="gtpane">' +
        '<textarea id="gjIn" class="gtta" placeholder="Type or paste anything…" ' +
          'autocomplete="off" spellcheck="false" aria-label="Text to translate">' + esc(gjText.translate) + '</textarea>' +
        (!gjText.translate ? gjExampleChips("translate") : "") +
        '<div class="gtpanefoot">' +
          '<span class="gtcount" id="gjCount">' + (gjText.translate || "").length + '</span>' +
          '<span class="gticons">' +
            (gjText.translate ? '<button class="gticon" id="gjClearX" aria-label="Clear" title="Clear">' + gjIcon("close", 14) + '</button>' : "") +
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
    if(ta.value){ var exRow = $(".examplerow"); if(exRow) exRow.remove(); }
    clearTimeout(gjDebounce);
    if(!ta.value.trim()){
      gjResults = null; gjBusy = false; gjReqId++;
      gjTrlangManual = false;   /* a cleared box starts fresh — next thing you type gets auto-guessed again */
      gjRenderOut(); gjUpdateSwap();
      var x = $("#gjClearX"); if(x) x.remove();
      return;
    }
    if(!gjTrlangManual){
      var guess = gjGuessTargetLang(ta.value);
      if(guess !== S.gj.trlang){
        S.gj.trlang = guess;
        save();
        each($$("[data-trlang]"), function(x){ x.classList.toggle("on", x.getAttribute("data-trlang") === guess); });
      }
    }
    if(!$("#gjClearX")){
      var foot = $(".gtpanefoot .gticons");
      if(foot) foot.innerHTML = '<button class="gticon" id="gjClearX" aria-label="Clear" title="Clear">' + gjIcon("close", 14) + '</button>';
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
  each($$("[data-ex]"), function(b){
    b.onclick = function(){
      var text = GJ_EXAMPLES.translate[+b.getAttribute("data-ex")];
      gjText.translate = text;
      ta.value = text;
      var exRow = $(".examplerow");
      if(exRow) exRow.remove();
      sfxTap();
      gjUpdateCount();
      clearTimeout(gjDebounce);
      gjRunGenerate();
    };
  });
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

var gjHistFilter = "";
function gjHistMatches(h, q){
  var gens = gjEntryGens(h);
  var top = gens[gens.length - 1].cards[0];
  var topText = top ? top.text : "";
  return (h.input || "").toLowerCase().indexOf(q) !== -1 || topText.toLowerCase().indexOf(q) !== -1;
}
function gjHistRowsHTML(){
  var q = gjHistFilter.trim().toLowerCase();
  var out = "", lastLabel = null, shown = 0;
  S.gj.history.forEach(function(h, i){
    if(q && !gjHistMatches(h, q)) return;
    shown++;
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
        'aria-label="' + (isSaved ? "Remove from saved" : "Save") + '">' + gjIcon("star") + '</button>' : "") +
    '</div>';
  });
  if(!shown) return '<div class="hintline" style="margin:14px 4px 0">No matches.</div>';
  return '<div class="histlist">' + out + '</div>';
}
function gjHistoryPanel(){
  if(!S.gj.history.length){
    return '<div class="glass pad" style="margin-top:14px"><div class="hintline" style="margin:0">' +
      'Nothing yet — your last translations, replies, and rewrites will show up here.</div></div>';
  }
  return (S.gj.history.length > 5
    ? '<div class="histsearch"><input id="gjHistSearch" type="text" placeholder="Search history…" ' +
        'value="' + esc(gjHistFilter) + '" autocomplete="off"></div>'
    : "") +
  '<div id="gjHistListWrap">' + gjHistRowsHTML() + '</div>';
}
function gjWireHistRows(){
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
        if(h.cfg.relation) S.gj.relation = h.cfg.relation;
        if(h.cfg.strength) S.gj.strength = h.cfg.strength;
        if(h.cfg.emotion) S.gj.emotion = h.cfg.emotion;
        if(h.cfg.formality) S.gj.formality = h.cfg.formality;
        if(h.cfg.burst) S.gj.burst = h.cfg.burst;
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
      b.setAttribute("aria-label", nowSaved ? "Remove from saved" : "Save");
      if(nowSaved) gjFlash(b);
    };
  });
}
function gjWireHistory(){
  var search = $("#gjHistSearch");
  if(search){
    search.oninput = function(){
      gjHistFilter = search.value;
      var wrap = $("#gjHistListWrap");
      if(wrap) wrap.innerHTML = gjHistRowsHTML();
      gjWireHistRows();
    };
  }
  gjWireHistRows();
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
        '<button class="gticon" data-sshare="' + i + '" aria-label="Share" title="Share">' + gjIcon("share") + '</button>' +
        '<button class="gticon" data-scopy="' + i + '" aria-label="Copy" title="Copy">' + gjIcon("copy") + '</button>' +
        '<button class="gticon bookmark on" data-sdel="' + i + '" aria-label="Remove from saved" title="Remove from saved">' + gjIcon("star") + '</button>' +
      '</div>' +
    '</div>';
  }).join("") + '</div>';
}
function gjWireSaved(){
  each($$("[data-sshare]"), function(b){
    b.onclick = function(){ shareText(S.gj.saved[+b.getAttribute("data-sshare")].text, b); };
  });
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
    : "Translate between English, Roman Gujlish, and Hinglish — by meaning, not word for word.";

  app.innerHTML = topBar() +
  '<div class="hero">' +
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

  var usageLine;
  if(!gjUsage.tokens && !gjTtsChars){
    usageLine = "Nothing yet this session.";
  }else{
    var usageParts = [];
    if(gjUsage.tokens){
      usageParts.push(gjUsage.tokens.toLocaleString() + " tokens" +
        (gjUsage.cost > 0 ? " (~$" + gjUsage.cost.toFixed(3) + ")" : "") +
        (gjUsage.unpriced ? " — includes a free/unverified model, not counted in that estimate" : ""));
    }
    if(gjTtsChars) usageParts.push(gjTtsChars.toLocaleString() + " characters spoken via ElevenLabs");
    usageLine = usageParts.join(" · ") + ". Rough estimate, not a bill — check openrouter.ai and elevenlabs.io for exact usage.";
  }

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
      '<select id="m">' +
        '<optgroup label="Models">' + models.filter(function(m){ return m.cost !== "Unverified"; }).map(function(m){
          return '<option value="' + esc(m.id) + '"' + (S.ai.model === m.id ? " selected" : "") +
                 '>' + esc(m.lab) + ' — ' + esc(m.cost) + '</option>';
        }).join("") + '</optgroup>' +
        /* these five were added on request without a confirmed price or
           quality check — "Unverified" sitting in the price slot read
           like a real cost, so they get their own group instead and no
           fake price at all; the note below still spells out the caveat */
        '<optgroup label="Not yet verified">' + models.filter(function(m){ return m.cost === "Unverified"; }).map(function(m){
          return '<option value="' + esc(m.id) + '"' + (S.ai.model === m.id ? " selected" : "") +
                 '>' + esc(m.lab) + '</option>';
        }).join("") + '</optgroup>' +
      '</select>' +
      '<div class="hint" id="mnote"></div>' +
    '</div>' +
    '<div class="rowbtns">' +
      '<button class="btn ghost" id="clearKey">Remove key</button>' +
      '<button class="btn" id="saveKey">Save &amp; test</button>' +
    '</div>' +
    (S.ai.key ? '<div class="hintline" id="copyKeyRow" style="margin-top:12px">' +
      '<button class="linkbtn" id="copyKeyKb">Copy key for keyboard app</button> — ' +
      'the keyboard and share extension keep their own separate key (different app sandbox), ' +
      'so paste it once into the FlashReply keyboard app\'s Settings screen.' +
    '</div>' : "") +
    '<div id="aiStatus" style="margin-top:12px"></div>' +
  '</div>' +

  '<div class="glass pad" style="margin-bottom:14px">' +
    '<div class="sidehead"><span>Voice</span>' +
      '<span class="chip ' + (Eleven.on() ? "ai" : "") + '">' + (Eleven.on() ? "connected" : "off") + '</span></div>' +
    '<div class="warn" style="margin-bottom:16px">' +
      'Real neural voice via your own ElevenLabs key, available on Listen whenever you want — that means it spends ' +
      'their credits every time, not just occasionally. Stored <b>only in this browser</b>, same as the OpenRouter key. ' +
      'Without this, Listen falls back to your browser\'s free built-in voice.' +
    '</div>' +
    '<div class="field">' +
      '<label for="ek">ElevenLabs API key</label>' +
      '<input id="ek" type="password" placeholder="…" value="' + esc(S.eleven.key || "") + '" autocomplete="off" spellcheck="false">' +
      '<div class="hint">Get one at elevenlabs.io → Settings → API Keys.</div>' +
    '</div>' +
    '<div class="field">' +
      '<label for="ev">Voice ID</label>' +
      '<input id="ev" type="text" placeholder="e.g. 21m00Tcm4TlvDq8ikWAM" value="' + esc(S.eleven.voiceId || "") + '" autocomplete="off" spellcheck="false">' +
      '<div class="hint">Find one at elevenlabs.io → Voices — open a voice and copy its ID.</div>' +
    '</div>' +
    '<div class="rowbtns">' +
      '<button class="btn ghost" id="clearEk">Remove key</button>' +
      '<button class="btn" id="saveEk">Save &amp; test</button>' +
    '</div>' +
    '<div class="hintline">Save &amp; test speaks a short phrase out loud — that itself uses a small amount of credit.</div>' +
    '<div id="elevenStatus" style="margin-top:12px"></div>' +
  '</div>' +

  '<div class="glass pad" style="margin-bottom:14px">' +
    '<div class="sidehead"><span>Usage this session</span></div>' +
    '<div class="hintline" style="margin:0">' + esc(usageLine) + '</div>' +
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
    box.innerHTML = m ? esc(m.note) : "";
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

  var copyKeyKb = $("#copyKeyKb");
  if(copyKeyKb) copyKeyKb.onclick = function(){ copyText(S.ai.key, copyKeyKb); };

  $("#saveEk").onclick = function(){
    S.eleven.key = $("#ek").value.trim();
    S.eleven.voiceId = $("#ev").value.trim();
    save();
    var box = $("#elevenStatus");
    if(!S.eleven.key || !S.eleven.voiceId){
      box.innerHTML = '<div class="status"><span class="dot off"></span>Add both a key and a voice ID.</div>';
      paintShell(); return;
    }
    box.innerHTML = '<div class="status"><span class="typing"><i></i><i></i><i></i></span> Testing…</div>';
    Eleven.speak("Hello.").then(function(){
      box.innerHTML = '<div class="status"><span class="dot on"></span>Connected. Listen is on everywhere now.</div>';
      sfxGem(); paintShell();
    }).catch(function(e){
      box.innerHTML = '<div class="status"><span class="dot off"></span>' + esc(elevenErrorText(e)) + '</div>';
      paintShell();
    });
  };

  $("#clearEk").onclick = function(){
    S.eleven.key = ""; save();
    $("#ek").value = "";
    $("#elevenStatus").innerHTML = '<div class="status"><span class="dot off"></span>Key removed from this browser. Listen falls back to your browser\'s free voice.</div>';
    sfxTap(); paintShell();
  };
}


/* ================================================================
   BOOT
   ================================================================ */

/* app-shell caching only — never touches OpenRouter/ElevenLabs calls,
   see sw.js. A silent no-op on file:// (the standalone dist build) and
   on any browser without support.

   Reloading once when a new service worker takes control is what
   actually gets a fresh deploy in front of you promptly — without it,
   an old cached shell can keep answering for a surprisingly long time
   on iOS Safari in particular, since it only checks for a new sw.js
   lazily rather than on every load. sw.js's own CACHE name also gets a
   fresh version stamp on every deploy (see deploy.sh) so the old
   cached shell is actually evicted once the new one activates, not
   just outvoted. */
if("serviceWorker" in navigator){
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").catch(function(){});
  });
  var gjSwReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", function(){
    if(gjSwReloaded) return;
    gjSwReloaded = true;
    location.reload();
  });
}

save();
go("translate");

})();

/* Caches only the app shell itself (this one page) so repeat opens are
   instant and the app still loads with no network at all. Everything
   else — OpenRouter, ElevenLabs — is left completely alone; a service
   worker sitting in front of those calls would be actively wrong.

   1787432257 is substituted with a real timestamp by deploy.sh on every
   deploy (this file, as checked in, is the template) — a fixed
   version string here meant the old cached shell never actually got
   evicted from one deploy to the next, just outvoted by the
   network-first fetch handler below, which isn't the same thing on a
   browser that serves this file itself from its own HTTP cache first. */
var CACHE = "bolo-gujlish-shell-1787432257";

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE).then(function(cache){ return cache.add(self.registration.scope); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if(url.origin !== location.origin) return;   /* never intercept API calls */

  event.respondWith(
    fetch(event.request).then(function(response){
      var copy = response.clone();
      caches.open(CACHE).then(function(cache){ cache.put(event.request, copy); });
      return response;
    }).catch(function(){
      return caches.match(event.request).then(function(cached){
        return cached || caches.match(self.registration.scope);
      });
    })
  );
});

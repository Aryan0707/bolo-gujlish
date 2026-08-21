/* Caches only the app shell itself (this one page) so repeat opens are
   instant and the app still loads with no network at all. Everything
   else — OpenRouter, ElevenLabs — is left completely alone; a service
   worker sitting in front of those calls would be actively wrong. */
var CACHE = "bolo-gujlish-shell-v1";

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

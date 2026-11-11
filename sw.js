/* RE:ON 영업관리 서비스 워커
   - 화면(HTML)은 항상 '네트워크 우선' → 배포한 최신 버전이 바로 반영됩니다 (오프라인일 때만 저장본 사용)
   - 영업 데이터(Supabase)는 절대 저장하지 않고 항상 서버에서 가져옵니다
   - 같은 사이트 파일(아이콘 등)도 네트워크 우선, 외부 스크립트/스타일만 저장해 두었다가 재사용합니다 */
const CACHE = "reon-sales-v2";
const SHELL = ["./", "./manifest.json", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return; // 영업 데이터는 캐시하지 않음

  // 화면(HTML): 네트워크 우선, 실패(오프라인) 시 저장본
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./"))
    );
    return;
  }

  // 같은 사이트 파일(아이콘·설정 등): 네트워크 우선 → 수정한 파일이 바로 반영됨, 오프라인이면 저장본
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 외부(CDN 스크립트·스타일): 저장본 우선 + 백그라운드 갱신
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});

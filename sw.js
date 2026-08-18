/* ══════════════════════════════════════════════════════════
   Choi's — 서비스 워커

   하는 일
     1) 화면을 이루는 파일(껍데기)을 저장해 두어 두 번째부터 빨리 열리게 합니다.
     2) 인터넷이 끊겨도 화면은 뜨게 합니다.
     3) 학급 데이터(Supabase)는 절대 저장하지 않습니다 — 늘 진짜 서버에서 받아옵니다.

   고칠 일이 생기면 아래 VERSION 숫자만 올리세요.
   그러면 옛날에 저장해 둔 파일이 모두 버려지고 새로 받아옵니다.
   ══════════════════════════════════════════════════════════ */

const VERSION = "v1";
const CACHE = "choisclass-" + VERSION;

/* 미리 저장해 둘 파일들 */
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.svg",
];

/* ── 설치: 껍데기를 미리 담아 둡니다 ── */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

/* ── 켜질 때: 지난 판 저장분을 버립니다 ── */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── 부름을 가로채는 규칙 ── */
self.addEventListener("fetch", (e) => {
  const req = e.request;

  /* 받아오기(GET)가 아니면 손대지 않습니다 — 저장·삭제는 늘 진짜 서버로 */
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* 학급 데이터(Supabase)와 다른 집 주소는 그대로 통과 */
  if (url.origin !== self.location.origin) {
    /* 글꼴만은 한 번 받아 두면 오래 쓰니 저장해 둡니다 */
    if (url.hostname === "cdn.jsdelivr.net") {
      e.respondWith(cacheFirst(req));
    }
    return;
  }
  if (url.pathname.indexOf("/rest/v1/") >= 0) return;

  /* 화면 문서: 새것 먼저, 안 되면 저장분 (선생님이 파일을 고치면 바로 반영) */
  if (req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") >= 0) {
    e.respondWith(networkFirst(req));
    return;
  }

  /* 아이콘·설정 파일 등: 저장분 먼저 (빠르게) */
  e.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    const shell = await cache.match("./index.html");
    if (shell) return shell;
    return new Response(
      "<meta charset='utf-8'><p style='font-family:sans-serif;padding:40px;text-align:center;color:#8C8C93'>" +
      "인터넷이 끊겨 있어요. 연결한 뒤 다시 열어 주세요.</p>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
    );
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) {
    /* 뒤에서 조용히 새것으로 바꿔 둡니다 */
    fetch(req).then((r) => { if (r && r.ok) cache.put(req, r.clone()); }).catch(() => {});
    return hit;
  }
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    return new Response("", { status: 504 });
  }
}

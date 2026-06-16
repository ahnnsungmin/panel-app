// ── Service Worker · 판넬 신청/입고 현황 PWA ──
const CACHE = 'panel-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap',
];

// 설치: 앱 셸 캐시
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { mode: 'cors' })).filter(() => true))
      .catch(() => {}))
  );
});

// 활성화: 오래된 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch 전략:
// - Supabase API → Network Only (항상 최신 데이터)
// - 폰트/CSS → Cache First
// - 나머지 → Network First with Cache Fallback
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase API: 항상 네트워크
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() =>
      new Response(JSON.stringify({ error: '오프라인 상태입니다. 인터넷 연결을 확인하세요.' }),
        { headers: { 'Content-Type': 'application/json' }, status: 503 })
    ));
    return;
  }

  // 폰트/정적 CDN: Cache First
  if (url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // 앱 파일: Network First → Cache Fallback
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request).then(c => c || caches.match('/index.html')))
  );
});

/**
 * sw.js  —  Service Worker (PWA + FCM)
 * [임시 디버그 모드 — 문제 해결 후 디버그 코드 제거 예정]
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAkgSzuTVqVWiY86GU7tgWLtEQRQFlLK-o",
  authDomain: "panelrequest-b95b6.firebaseapp.com",
  projectId: "panelrequest-b95b6",
  storageBucket: "panelrequest-b95b6.firebasestorage.app",
  messagingSenderId: "727086512417",
  appId: "1:727086512417:web:e65e845678421505906660",
});

const messaging = firebase.messaging();

const APP_SECRET = 'panel2026secret'; // index.html의 APP_SECRET과 동일해야 함

function debugLog(data) {
  return fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-secret': APP_SECRET },
    body: JSON.stringify({ action: 'sw-debug-log', ...data }),
  }).catch(() => {});
}

// ── 백그라운드 푸시 수신 (앱이 닫혀있거나 백그라운드일 때) ──────────────────────
messaging.onBackgroundMessage(payload => {
  const invocationId = Math.random().toString(36).slice(2, 8);
  const { title, body } = payload.notification;
  const tag = payload.data?.dedupeKey || 'panel-notify';

  // 디버그: 이 핸들러가 호출될 때마다 서버에 기록 (showNotification 호출 전에 먼저 기록)
  debugLog({ invocationId, tag, body, time: new Date().toISOString() });

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    data: { url: payload.fcmOptions?.link || '/' },
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

// ── PWA 캐싱 ─────────────────────────────────────────────────────────────────
const CACHE = 'panel-v4-debug';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

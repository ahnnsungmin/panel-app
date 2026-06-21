/**
 * sw.js  —  Service Worker (PWA + FCM)
 */

// Firebase SW SDK
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

// ── 백그라운드 푸시 수신 (앱이 닫혀있거나 백그라운드일 때) ──────────────────────
messaging.onBackgroundMessage(async payload => {
  const { title, body } = payload.notification;

  // 같은 내용의 알림이 이미 떠있으면 중복 표시 방지
  // (배터리 최적화로 깨어날 때 같은 푸시가 기기에 두 번 전달되는 경우 대비)
  const existing = await self.registration.getNotifications({ tag: 'panel-notify' });
  if (existing.some(n => n.body === body)) {
    return;
  }

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'panel-notify',
    renotify: true,
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
const CACHE = 'panel-v2';
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

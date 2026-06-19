/**
 * /api/notify.js  —  Vercel Serverless Function
 * index.html에서 상태 변경 직후 직접 호출 (Database Webhook 불필요)
 *
 * 환경변수:
 *   FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY  — Firebase 서비스 계정
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY                  — push_tokens 조회용
 *   NOTIFY_SECRET                                        — index.html의 APP_SECRET과 동일
 *   APP_URL                                               — https://panelrequest.vercel.app
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { createClient } from '@supabase/supabase-js';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FCM_PROJECT_ID,
      clientEmail: process.env.FCM_CLIENT_EMAIL,
      privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// ── 상태 변경별 알림 대상·메시지 정의 ─────────────────────────────────────────
//   새 신청 등록   → 해당 업체
//   업체 접수완료 → 신청팀
//   배송완료      → 신청팀
//   입고완료      → 해당 업체
function buildNotifications(type, record, oldRecord) {
  const r = record;
  const info = `${r.hull} ${r.deck} ${r.panel_no || ''}`.trim();

  if (type === 'INSERT') {
    return [{
      roleType: 'vendor', roleName: r.vendor,
      title: '📋 새 판넬 신청',
      body: `[${r.team}] ${info} ${r.type} 신청이 접수되었습니다.`,
    }];
  }

  if (type === 'UPDATE') {
    const prev = oldRecord?.status, curr = r.status;
    if (prev === curr) return [];
    const map = {
      received: [{ roleType: 'team', roleName: r.team,
        title: '✅ 판넬 접수완료',
        body: `${r.vendor}에서 접수를 완료했습니다. (${info})` }],
      shipped: [{ roleType: 'team', roleName: r.team,
        title: '🚚 판넬 배송완료',
        body: `${r.vendor}에서 배송을 완료했습니다. (${info})` }],
      stocked: [{ roleType: 'vendor', roleName: r.vendor,
        title: '🎉 판넬 입고완료',
        body: `[${r.team}] ${info} 판넬 입고가 완료되었습니다.` }],
    };
    return map[curr] || [];
  }
  return [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const secret = req.headers['x-app-secret'];
  if (secret !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, record, old_record } = req.body;
  const notifications = buildNotifications(type, record, old_record);
  if (!notifications.length) return res.json({ sent: 0, skipped: true });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const messaging = getMessaging();
  let sent = 0;

  for (const notif of notifications) {
    const { data: rows } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('role_type', notif.roleType)
      .eq('role_name', notif.roleName);

    if (!rows?.length) continue;

    for (const { token } of rows) {
      try {
        await messaging.send({
          token,
          notification: { title: notif.title, body: notif.body },
          webpush: {
            notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
            fcmOptions: { link: process.env.APP_URL || '/' },
          },
        });
        sent++;
      } catch (e) {
        if (e.code === 'messaging/registration-token-not-registered') {
          await supabase.from('push_tokens').delete().eq('token', token);
        }
      }
    }
  }

  return res.json({ sent });
}

import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';

const OFFLINE_QUEUE_KEY = 'tarik_offline_queue';

export function queueOfflineMutation(endpoint, body) {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ endpoint, body, timestamp: Date.now() });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event('tarik-sync-update'));
  } catch {}
}

export default function SyncStatusPill() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const checkQueue = useCallback(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      setPendingCount(queue.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    function handleOnline() { setIsOnline(true); triggerSync(); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('tarik-sync-update', checkQueue);
    checkQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('tarik-sync-update', checkQueue);
    };
  }, [checkQueue]);

  async function triggerSync() {
    if (!navigator.onLine || syncing) return;
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      if (queue.length === 0) return;

      setSyncing(true);
      for (const item of queue) {
        try {
          await api(item.endpoint, { method: 'POST', body: item.body });
        } catch {}
      }
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      setPendingCount(0);
    } catch {
    } finally {
      setSyncing(false);
    }
  }

  if (!isOnline || pendingCount > 0) {
    return (
      <div
        onClick={triggerSync}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'rgba(232, 163, 23, 0.15)',
          border: '1px solid rgba(232, 163, 23, 0.4)',
          borderRadius: 99,
          fontSize: 11.5,
          fontWeight: 700,
          color: 'var(--warn, #b8861f)',
          cursor: 'pointer',
        }}
        title="Click to sync offline changes"
      >
        <WifiOff size={13} className={syncing ? 'spin' : ''} />
        <span>{!isOnline ? 'Offline' : 'Syncing'} — {pendingCount} change{pendingCount === 1 ? '' : 's'} waiting</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: 'var(--primary-tint)',
        border: '1px solid rgba(27, 107, 74, 0.2)',
        borderRadius: 99,
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--primary)',
      }}
      title="All offline records synced to server"
    >
      <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
      <span>Synced just now</span>
    </div>
  );
}

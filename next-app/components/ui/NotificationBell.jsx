'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BellIcon, MilkDropIcon, PackageIcon, PaymentsIcon, InfoIcon } from '@/components/ui/Icons.jsx';
import { getInboxNotifications, markNotificationsAsRead } from '@/actions/notification.actions.js';

function getTypeIcon(type) {
  switch (type) {
    case 'DELIVERY':
      return <MilkDropIcon className="h-4 w-4 text-blue-600" />;
    case 'ORDER':
    case 'QUANTITY_CHANGE':
      return <PackageIcon className="h-4 w-4 text-amber-600" />;
    case 'PAYMENT':
      return <PaymentsIcon className="h-4 w-4 text-emerald-600" />;
    default:
      return <InfoIcon className="h-4 w-4 text-blue-600" />;
  }
}

function timeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function NotificationBell({ className = '' }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();

  async function fetchNotifications() {
    try {
      const res = await getInboxNotifications();
      if (res?.ok) {
        setNotifications(res.items || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Ignored
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleMarkAllRead() {
    setLoading(true);
    try {
      await markNotificationsAsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }

  async function handleItemClick(item) {
    if (!item.readAt) {
      markNotificationsAsRead([item.id]).catch(() => {});
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    }
    setOpen(false);
    if (item.href) {
      router.push(item.href);
    }
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        className="tap relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-2xs hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 transition-all active:scale-95"
      >
        <BellIcon className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {/* Dropdown Panel */}
      {open ? (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/10 backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-black text-slate-900">
                Notifications
              </span>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                Last 3 days
              </span>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
                  {unreadCount} new
                </span>
              ) : null}
            </div>

            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-2">
                  <BellIcon className="h-5 w-5" />
                </span>
                <p className="font-heading text-xs font-bold text-slate-700">
                  No notifications in the last 3 days
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Recent deliveries and order alerts will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.readAt;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                      isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 mt-0.5 shadow-2xs">
                      {getTypeIcon(item.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-heading font-bold truncate ${isUnread ? 'text-slate-950' : 'text-slate-700'}`}>
                          {item.title}
                        </p>
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 mt-0.5 line-clamp-2">
                        {item.body}
                      </p>
                    </div>
                    {isUnread ? (
                      <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

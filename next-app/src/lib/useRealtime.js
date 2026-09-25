'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client.js';

/**
 * Universal Supabase Realtime Hook for tables in the `app` schema.
 * Listens to Postgres changes over WebSockets with zero polling.
 *
 * @param {object} options
 * @param {string} options.table - Table name in `app` schema (e.g. 'users', 'milkman_profiles', 'deliveries', 'notifications')
 * @param {string} [options.schema='app'] - Database schema name (defaults to 'app')
 * @param {string} [options.event='*'] - Event type: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
 * @param {string} [options.filter] - Optional filter string (e.g. `milkman_id=eq.${id}`)
 * @param {Function} [options.onInsert] - Callback when a row is inserted
 * @param {Function} [options.onUpdate] - Callback when a row is updated
 * @param {Function} [options.onDelete] - Callback when a row is deleted
 * @param {Function} [options.onChange] - General callback for any event
 */
export function useRealtimeTable({
  table,
  schema = 'app',
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
}) {
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const onChangeRef = useRef(onChange);

  // Keep callback refs fresh without causing re-subscriptions
  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!table) return;

    let supabase;
    try {
      supabase = createClient();
    } catch (err) {
      console.warn('[useRealtimeTable] Could not initialize Supabase client:', err);
      return;
    }

    const channelName = `rt-${schema}-${table}-${filter || 'all'}-${Math.random().toString(36).substring(2, 7)}`;
    const channelConfig = {
      event,
      schema,
      table,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload) => {
        if (onChangeRef.current) onChangeRef.current(payload);

        if (payload.eventType === 'INSERT' && onInsertRef.current) {
          onInsertRef.current(payload.new);
        } else if (payload.eventType === 'UPDATE' && onUpdateRef.current) {
          onUpdateRef.current(payload.new, payload.old);
        } else if (payload.eventType === 'DELETE' && onDeleteRef.current) {
          onDeleteRef.current(payload.old);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Connected
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // Ignored on cleanup
      }
    };
  }, [table, schema, event, filter]);
}

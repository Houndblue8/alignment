import { Bell, BellOff, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DATA_MODE } from '../data/repo';
import { supabase } from '../data/supabase';
import { nowLocal } from '../lib/clock';
import { fromHHMM, toHHMM } from '../lib/format';
import { deviceLabel, disablePush, enablePush, pushState, type PushState } from '../lib/push';
import { addDays } from '../planner';
import { dayOf } from '../state/planning';
import { useApp } from '../state/store';
import { dueNow, remindersFor, type Reminder } from '../../supabase/functions/_shared/reminders.ts';

/** Today's reminders, computed the same way the server does. */
export function todaysReminders(): Reminder[] {
  const s = useApp.getState().s;
  if (!s) return [];
  const now = nowLocal();
  const rec = dayOf(s, now.date);
  return remindersFor({
    date: now.date,
    prefs: { open: s.settings.notifyOpen, photo: s.settings.notifyPhoto, morning: s.settings.notifyMorning, evening: s.settings.notifyEvening, bedtime: s.settings.notifyBedtime, blocks: s.settings.notifyBlocks },
    photoMin: s.settings.photoReminderMin,
    photoTaken: s.photos.some((p) => p.date === now.date),
    expectedWakeMin: s.days[addDays(now.date, -1)]?.plan.bedtime?.wakeMin ?? s.settings.wakeTargetMin,
    checkinDone: rec.checkinDone,
    anchorsDone: rec.coldShower.done && rec.walk.done,
    bedMin: rec.plan.bedtime?.bedMin ?? null,
    blocks: s.blocks.filter((b) => b.date === now.date).map((b) => ({ id: b.id, start: b.start, end: b.end, kind: b.kind, title: b.title, status: b.status, source: b.source, pinned: b.pinned, taskId: b.taskId, placeId: b.placeId })),
    big3: rec.big3.map((i) => i.taskId),
  });
}

/** When push is not on, reminders show inside the app while it is open (Part 10). */
export function useInAppReminders() {
  useEffect(() => {
    const shown = new Set<string>();
    const check = async () => {
      if ((await pushState()) === 'on') return;
      for (const r of dueNow(todaysReminders(), nowLocal().min)) {
        if (shown.has(r.key) || sessionStorage.getItem(`rem:${r.key}`)) continue;
        shown.add(r.key);
        sessionStorage.setItem(`rem:${r.key}`, '1');
        useApp.getState().showToast(`${r.title}. ${r.body}`);
      }
    };
    void check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);
}

const STATE_TEXT: Record<PushState, string> = {
  unsupported: 'This browser cannot receive notifications. Reminders show inside the app while it is open.',
  'needs-install': 'On iPhone, notifications only work in the installed app. Tap Share, then Add to Home Screen, open Alignment from the Home Screen, and come back here.',
  blocked: 'Notifications are blocked for this site. Turn them on in your browser or phone settings. Until then, reminders show inside the app while it is open.',
  off: 'Notifications are off on this device.',
  on: 'Notifications are on for this device.',
};

export function NotificationSettings() {
  const settings = useApp((a) => a.s!.settings);
  const save = useApp((a) => a.saveSettings);
  const toast = useApp((a) => a.showToast);
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void pushState().then(setState);
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (typeof r === 'string') toast(r, 'error');
      else {
        if (DATA_MODE === 'supabase') {
          const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: r.endpoint, keys: r.keys, device_label: deviceLabel() });
          if (error) throw new Error(error.message);
        }
        toast('Notifications are on for this device.');
      }
    } catch (e) {
      toast(`Could not turn on notifications. ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setState(await pushState());
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    const endpoint = await disablePush();
    if (endpoint && DATA_MODE === 'supabase') await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    setState(await pushState());
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke('push-test', { body: {} });
    setBusy(false);
    toast(error ? 'The test did not arrive. Check that notifications are allowed for Alignment.' : 'Test sent. It should arrive in a few seconds.', error ? 'error' : 'info');
  };

  const toggle = (key: 'notifyPhoto' | 'notifyOpen' | 'notifyMorning' | 'notifyEvening' | 'notifyBedtime' | 'notifyBlocks', label: string) => (
    <label className="row between">
      <span>{label}</span>
      <input type="checkbox" className="switch" checked={settings[key]} onChange={(e) => save({ [key]: e.target.checked })} />
    </label>
  );

  return (
    <div className="stack lg">
      {state && <p className={`banner small ${state === 'blocked' || state === 'unsupported' ? 'warn' : ''}`}>{STATE_TEXT[state]}</p>}
      <div className="row wrap">
        {state === 'off' && (
          <button className="btn primary" onClick={enable} disabled={busy}>
            <Bell size={16} aria-hidden="true" /> Enable notifications
          </button>
        )}
        {state === 'on' && (
          <>
            <button className="btn" onClick={test} disabled={busy}>
              <Send size={16} aria-hidden="true" /> Send a test
            </button>
            <button className="btn ghost" onClick={disable} disabled={busy}>
              <BellOff size={16} aria-hidden="true" /> Turn off on this device
            </button>
          </>
        )}
      </div>
      <div className="stack">
        {toggle('notifyMorning', 'Morning: cold shower and walk, at your wake time')}
        {toggle('notifyPhoto', 'Photo: a nudge if today has no photo yet')}
        {settings.notifyPhoto && (
          <label className="row between">
            <span className="small muted">Photo reminder time</span>
            <input
              className="field"
              style={{ width: 140 }}
              type="time"
              step={300}
              defaultValue={toHHMM(settings.photoReminderMin)}
              onBlur={(e) => {
                const m = fromHHMM(e.target.value);
                if (m !== null && m !== settings.photoReminderMin) void save({ photoReminderMin: m });
              }}
              aria-label="Photo reminder time"
            />
          </label>
        )}
        {toggle('notifyEvening', 'Evening: close the day and take the photo')}
        {toggle('notifyBedtime', 'Bedtime: at your recommended bedtime')}
        {toggle('notifyOpen', 'Open time: when a window of 30 minutes or more starts, with its best use')}
        {toggle('notifyBlocks', '5 minutes before each block')}
      </div>
    </div>
  );
}

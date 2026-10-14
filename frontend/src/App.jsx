import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import MobileView from './mobile/MobileView';
import {
  setupNotificationChannel,
  triggerNativeTestAlert,
  scheduleTaskNotifications,
  cancelTaskNotifications,
} from './mobile/notifications';

export const DEFAULT_CLOUD_SERVER = 'https://web-production-975c4.up.railway.app';

function getInitialServerUrl() {
  if (typeof localStorage === 'undefined') return DEFAULT_CLOUD_SERVER;
  const saved = localStorage.getItem('fintask_server_url');
  if (
    !saved ||
    saved.includes('192.168.') ||
    saved.includes('localhost') ||
    saved.includes('127.0.0.1') ||
    (typeof window !== 'undefined' && window.location.protocol === 'https:' && saved.startsWith('http://'))
  ) {
    try {
      localStorage.setItem('fintask_server_url', DEFAULT_CLOUD_SERVER);
    } catch (e) {}
    return DEFAULT_CLOUD_SERVER;
  }
  return saved;
}

let globalServerUrl = getInitialServerUrl();

function apiFetch(url, options) {
  const base = (globalServerUrl || '').trim().replace(/\/+$/, '');
  const fullUrl = url.startsWith('/') ? (base ? `${base}${url}` : url) : url;
  return fetch(fullUrl, options);
}

// Web Audio synthesizer for cross-device audible chimes
function playChime(urgency) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (urgency === 'critical' || urgency === 'emergency') {
      // Rapid urgent double chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.15); // D6
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      // Pleasant attention chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch (e) {
    // AudioContext blocked before interaction
  }
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, done: 0, overdue: 0, today: 0, pending: 0 });
  const [activeTab, setActiveTab] = useState('today');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Creation Form State
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState(2);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  // Edit Modal State
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueAt, setEditDueAt] = useState('');
  const [editPriority, setEditPriority] = useState(2);
  const [editNotes, setEditNotes] = useState('');

  // Device / Settings Modal State
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [ntfyTopic, setNtfyTopic] = useState('');
  const [notificationsAllowed, setNotificationsAllowed] = useState(
    typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false
  );
  // Sync & Server URL State
  const [serverUrl, setServerUrl] = useState(() => getInitialServerUrl());
  const [syncStatus, setSyncStatus] = useState('checking'); // 'connected' | 'offline' | 'checking'

  const lastNotificationIdRef = useRef(0);

  // Mobile View Platform & Preview State
  const [forceMobileView, setForceMobileView] = useState(() => {
    if (Capacitor.isNativePlatform()) return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'mobile' || params.get('platform') === 'mobile') return true;
    const saved = localStorage.getItem('fintask_view_mode');
    if (saved === 'mobile') return true;
    if (saved === 'desktop') return false;
    return window.innerWidth < 768;
  });

  // Mobile Native Platform Setup (Status bar style, splash screen hide & notification channel)
  useEffect(() => {
    globalServerUrl = serverUrl;
    setupNotificationChannel();
    if (Capacitor.isNativePlatform()) {
      try {
        StatusBar.setStyle({ style: Style.Dark });
        StatusBar.setBackgroundColor({ color: '#090a0f' });
        SplashScreen.hide();
      } catch (e) {
        // Safe fallback in web mode
      }
    }
  }, [serverUrl]);

  const navTabs = [
    { id: 'today', label: 'Today', countKey: 'today' },
    { id: 'upcoming', label: 'Upcoming', countKey: null },
    { id: 'overdue', label: 'Overdue', countKey: 'overdue' },
    { id: 'all', label: 'All Tasks', countKey: 'total' },
    { id: 'done', label: 'Completed', countKey: 'done' },
  ];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Format datetime for input
  const formatInputDatetime = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${y}-${m}-${d}T${h}:${min}`;
  };

  const calculatePreset = (type, hours) => {
    const now = new Date();
    if (hours) {
      return formatInputDatetime(new Date(now.getTime() + hours * 60 * 60 * 1000));
    }
    if (type === 'tonight') {
      const d = new Date(now);
      d.setHours(21, 0, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
      return formatInputDatetime(d);
    }
    if (type === 'tomorrow_morning') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return formatInputDatetime(d);
    }
    if (type === 'tomorrow_evening') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(17, 0, 0, 0);
      return formatInputDatetime(d);
    }
    if (type === 'friday') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = (5 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(17, 0, 0, 0);
      return formatInputDatetime(d);
    }
    if (type === 'next_monday') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = (1 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(9, 0, 0, 0);
      return formatInputDatetime(d);
    }
    return '';
  };

  const getDeadlineHelper = (isoStr) => {
    if (!isoStr) return { text: 'No deadline chosen (task will appear in upcoming without alerts)', cls: '' };
    const target = new Date(isoStr);
    const now = new Date();
    const diffMs = target - now;
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 0) {
      return { text: '⚠️ Deadline is in the past! Task will trigger escalating overdue prompts.', cls: 'past' };
    }
    const formatted = target.toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    let rel = '';
    if (diffMin < 60) rel = `in ${diffMin} minutes`;
    else if (diffMin < 1440) {
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      rel = `in ${h}h ${m}m`;
    } else {
      const d = Math.floor(diffMin / 1440);
      rel = `in ${d} day${d > 1 ? 's' : ''}`;
    }
    return { text: `🗓️ Set for ${formatted} (${rel})`, cls: 'valid' };
  };

  // Compute live prompt frequency cadence for a task
  const getEscalatingFrequencyTier = (isoStr, isDone, priority) => {
    if (!isoStr || isDone) return null;
    const due = new Date(isoStr);
    const now = new Date();
    const diffMin = Math.round((due - now) / 60000);

    if (diffMin < 0) {
      const freq = priority === 1 ? 'Every 1 min' : (priority === 2 ? 'Every 2 mins' : 'Every 3 mins');
      return { text: `🚨 Overdue Cadence: ${freq}`, cls: 'emergency' };
    }
    if (diffMin <= 10) return { text: '🚨 Final 10m: Prompting Every 2 mins', cls: 'critical' };
    if (diffMin <= 30) return { text: '⚡ Imminent: Prompting Every 5 mins', cls: 'urgent' };
    if (diffMin <= 120) return { text: '⏰ Approaching: Prompting Every 20 mins', cls: 'high' };
    if (diffMin <= 360) return { text: '⏰ Prompts: Every 1 hour', cls: 'med' };
    if (diffMin <= 1440) return { text: '📅 Due Today: Prompts every 3 hours', cls: 'low' };
    return null;
  };

  const getDeadlineBadge = (isoStr, isDone) => {
    if (!isoStr) return { label: 'No deadline', cls: 'none' };
    if (isDone) return { label: `Completed • ${isoStr.replace('T', ' ')}`, cls: 'done' };

    const due = new Date(isoStr);
    const now = new Date();
    const diffMs = due - now;
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 0) {
      const overdueMins = Math.abs(diffMin);
      if (overdueMins < 60) return { label: `⚠️ Overdue by ${overdueMins}m`, cls: 'overdue' };
      const hours = Math.floor(overdueMins / 60);
      if (hours < 24) return { label: `⚠️ Overdue by ${hours}h`, cls: 'overdue' };
      const days = Math.floor(hours / 24);
      return { label: `⚠️ Overdue by ${days}d`, cls: 'overdue' };
    }

    if (diffMin <= 120) return { label: `⚡ Due in ${diffMin}m`, cls: 'soon' };

    const isToday = due.toDateString() === now.toDateString();
    if (isToday) {
      const timeStr = due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return { label: `⏰ Today at ${timeStr}`, cls: 'today' };
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (due.toDateString() === tomorrow.toDateString()) {
      const timeStr = due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return { label: `Tomorrow at ${timeStr}`, cls: 'upcoming' };
    }

    const monthStr = due.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timeStr = due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { label: `${monthStr}, ${timeStr}`, cls: 'upcoming' };
  };

  // Local Storage helpers for seamless operation both locally and on Firebase
  const getLocalTasks = () => {
    try {
      const stored = localStorage.getItem('fintask_local_tasks');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [
      { id: 1, title: 'Figma UI System & Assets', notes: 'Design token alignment and component audit', priority: 1, due_at: '2026-10-18T17:00', done: 0 },
      { id: 2, title: 'Unsplash Images Subscription', notes: 'Asset licensing payment for production site', priority: 2, due_at: '2026-10-12T10:00', done: 0 },
      { id: 3, title: 'Dropbox Cloud Storage Renewal', notes: 'Backup storage archive allocation', priority: 3, due_at: '2026-10-25T14:00', done: 0 }
    ];
  };

  const saveLocalTasks = (newTasks) => {
    try {
      localStorage.setItem('fintask_local_tasks', JSON.stringify(newTasks));
    } catch (e) {}
  };

  const filterTasksByView = (allTasks, view) => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const nowIso = new Date().toISOString();
    if (view === 'done') return allTasks.filter((t) => t.done);
    if (view === 'today') return allTasks.filter((t) => !t.done && t.due_at && t.due_at.substring(0, 10) <= todayStr);
    if (view === 'upcoming') return allTasks.filter((t) => !t.done && (!t.due_at || t.due_at.substring(0, 10) > todayStr));
    if (view === 'overdue') return allTasks.filter((t) => !t.done && t.due_at && t.due_at < nowIso);
    return allTasks;
  };

  const computeLocalStats = (allTasks) => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const nowIso = new Date().toISOString();
    const total = allTasks.length;
    const done = allTasks.filter((t) => t.done).length;
    const overdue = allTasks.filter((t) => !t.done && t.due_at && t.due_at < nowIso).length;
    const today = allTasks.filter((t) => !t.done && t.due_at && t.due_at.substring(0, 10) === todayStr).length;
    const pending = allTasks.filter((t) => !t.done).length;
    return { total, done, overdue, today, pending };
  };

  const loadStats = async () => {
    try {
      const res = await apiFetch('/api/stats');
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        setStats(await res.json());
        return;
      }
    } catch (e) {}
    setStats(computeLocalStats(getLocalTasks()));
  };

  const loadTasks = async () => {
    try {
      const res = await apiFetch(`/api/tasks?view=${activeTab}`);
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        setTasks(data);
        saveLocalTasks(data);
        return;
      }
    } catch (e) {}
    setTasks(filterTasksByView(getLocalTasks(), activeTab));
  };

  const loadSettings = async () => {
    try {
      const res = await apiFetch('/api/settings');
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        setNtfyTopic(data.ntfy_topic || '');
        return;
      }
    } catch (e) {}
    setNtfyTopic(localStorage.getItem('fintask_ntfy_topic') || '');
  };

  const refreshAll = () => {
    loadStats();
    loadTasks();
  };

  // Real-time polling for cross-device notification events
  const pollNotifications = async () => {
    try {
      const res = await apiFetch(`/api/notifications/poll?since_id=${lastNotificationIdRef.current}`);
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) return;
      const events = await res.json();

      if (events.length > 0) {
        events.forEach((ev) => {
          if (ev.id > lastNotificationIdRef.current) {
            lastNotificationIdRef.current = ev.id;
          }
        });

        const latest = events[0];
        playChime(latest.urgency);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(latest.title, {
              body: latest.message,
              icon: '/vite.svg',
              tag: `fintask-${latest.id}`,
            });
          } catch (e) {}
        }

        showToast(latest.message);
        refreshAll();
      }
    } catch (e) {}
  };

  const syncWithServer = async () => {
    setSyncStatus('checking');
    try {
      const statsRes = await apiFetch('/api/stats');
      if (!statsRes.ok) throw new Error('Unreachable');
      const statsData = await statsRes.json();
      setStats(statsData);
      setSyncStatus('connected');

      // Sync offline tasks up to server if missing
      const allRes = await apiFetch('/api/tasks?view=all');
      if (allRes.ok) {
        const serverTasks = await allRes.json();
        const serverIds = new Set(serverTasks.map((t) => t.id));
        const localTasks = getLocalTasks();
        const unsynced = localTasks.filter((t) => !serverIds.has(t.id));

        for (const t of unsynced) {
          try {
            await apiFetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(t),
            });
          } catch (e) {}
        }
      }

      await loadTasks();
      showToast('Web & Mobile fully synced! 🔄');
      return true;
    } catch (err) {
      setSyncStatus('offline');
      return false;
    }
  };

  useEffect(() => {
    refreshAll();
    loadSettings();
    syncWithServer();
    const taskInterval = setInterval(refreshAll, 10000);
    const pollInterval = setInterval(pollNotifications, 4000);
    return () => {
      clearInterval(taskInterval);
      clearInterval(pollInterval);
    };
  }, [activeTab, serverUrl]);

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const res = await Notification.requestPermission();
    setNotificationsAllowed(res === 'granted');
    if (res === 'granted') {
      showToast('Device notifications enabled! 🔔');
      playChime('medium');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('fintask_ntfy_topic', ntfyTopic.trim());
      await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ntfy_topic: ntfyTopic.trim() }),
      });
    } catch (err) {}
    showToast('Device settings saved! 📱');
    setIsDeviceModalOpen(false);
  };

  const handleTestAlert = async () => {
    playChime('urgent');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    // Trigger native device notification (on Android/iOS phone app)
    const nativeRes = await triggerNativeTestAlert();

    // Broadcast through backend to other devices if server is reachable
    try {
      await apiFetch('/api/test-notification', { method: 'POST' });
    } catch (err) {}

    if (nativeRes.ok) {
      showToast('⚡ Native alert fired on your phone!');
    } else {
      showToast('Broadcasted test alert to all devices! ⚡');
    }
  };

  // Create task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask = {
      id: Date.now(),
      title: title.trim(),
      notes: notes.trim(),
      priority: Number(priority),
      due_at: dueAt || null,
      done: 0,
      created_at: new Date().toISOString()
    };

    try {
      const res = await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        const local = [newTask, ...getLocalTasks()];
        saveLocalTasks(local);
      }
    } catch (err) {
      const local = [newTask, ...getLocalTasks()];
      saveLocalTasks(local);
    }

    // Schedule native escalating alarms on mobile
    scheduleTaskNotifications(newTask);

    setTitle('');
    setDueAt('');
    setNotes('');
    setShowNotes(false);
    showToast('Task & deadline scheduled! 🎯');
    refreshAll();
  };

  // Toggle completion
  const handleToggleComplete = async (task, e) => {
    if (e) e.stopPropagation();
    try {
      const action = task.done ? 'reopen' : 'complete';
      const res = await apiFetch(`/api/tasks/${task.id}/${action}`, { method: 'POST' });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        const all = getLocalTasks().map((t) => t.id === task.id ? { ...t, done: t.done ? 0 : 1 } : t);
        saveLocalTasks(all);
      }
    } catch (err) {
      const all = getLocalTasks().map((t) => t.id === task.id ? { ...t, done: t.done ? 0 : 1 } : t);
      saveLocalTasks(all);
    }

    if (!task.done) {
      cancelTaskNotifications(task.id);
    } else {
      scheduleTaskNotifications(task);
    }

    showToast(task.done ? 'Task reopened' : 'Task completed! ✓');
    refreshAll();
  };

  // Quick Snooze
  const handleSnooze = async (taskId, minutes, e) => {
    if (e) e.stopPropagation();
    const newDue = formatInputDatetime(new Date(Date.now() + minutes * 60000));
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/snooze?minutes=${minutes}`, { method: 'POST' });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        const all = getLocalTasks().map((t) => t.id === taskId ? { ...t, due_at: newDue } : t);
        saveLocalTasks(all);
      }
    } catch (err) {
      const all = getLocalTasks().map((t) => t.id === taskId ? { ...t, due_at: newDue } : t);
      saveLocalTasks(all);
    }
    const text = minutes >= 1440 ? 'tomorrow' : (minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`);
    showToast(`Deadline postponed by ${text} ⏰`);
    refreshAll();
  };

  // Delete task
  const handleDeleteTask = async (taskId, taskTitle, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete "${taskTitle}"?`)) return;
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        const all = getLocalTasks().filter((t) => t.id !== taskId);
        saveLocalTasks(all);
      }
    } catch (err) {
      const all = getLocalTasks().filter((t) => t.id !== taskId);
      saveLocalTasks(all);
    }
    cancelTaskNotifications(taskId);
    showToast('Task deleted');
    refreshAll();
  };

  // Edit Modal
  const openEditModal = (task, e) => {
    if (e) e.stopPropagation();
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDueAt(task.due_at || '');
    setEditPriority(task.priority);
    setEditNotes(task.notes || '');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    const updated = {
      title: editTitle.trim(),
      priority: Number(editPriority),
      notes: editNotes.trim(),
      due_at: editDueAt || null,
    };

    try {
      const res = await apiFetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        const all = getLocalTasks().map((t) => t.id === editingTask.id ? { ...t, ...updated } : t);
        saveLocalTasks(all);
      }
    } catch (err) {
      const all = getLocalTasks().map((t) => t.id === editingTask.id ? { ...t, ...updated } : t);
      saveLocalTasks(all);
    }

    scheduleTaskNotifications({ ...editingTask, ...updated });
    showToast('Task updated successfully');
    setEditingTask(null);
  };

  const filteredTasks = tasks.filter((t) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inTitle = t.title.toLowerCase().includes(q);
      const inNotes = t.notes && t.notes.toLowerCase().includes(q);
      return inTitle || inNotes;
    }
    return true;
  });

  const deadlineHelper = getDeadlineHelper(dueAt);
  const editDeadlineHelper = getDeadlineHelper(editDueAt);
  const completionPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  if (forceMobileView) {
    return (
      <>
        <MobileView
          tasks={tasks}
          stats={stats}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleCreateTask={handleCreateTask}
          handleToggleComplete={handleToggleComplete}
          handleSnooze={handleSnooze}
          handleDeleteTask={handleDeleteTask}
          openEditModal={openEditModal}
          setIsDeviceModalOpen={setIsDeviceModalOpen}
          getDeadlineBadge={getDeadlineBadge}
          getEscalatingFrequencyTier={getEscalatingFrequencyTier}
          title={title}
          setTitle={setTitle}
          dueAt={dueAt}
          setDueAt={setDueAt}
          priority={priority}
          setPriority={setPriority}
          notes={notes}
          setNotes={setNotes}
          calculatePreset={calculatePreset}
          deadlineHelper={deadlineHelper}
          handleTestAlert={handleTestAlert}
          syncStatus={syncStatus}
          syncWithServer={syncWithServer}
          serverUrl={serverUrl}
          onSwitchToDesktop={() => {
            setForceMobileView(false);
            localStorage.setItem('fintask_view_mode', 'desktop');
          }}
        />

        {/* Global Multi-Device Modal accessible from Mobile */}
        {isDeviceModalOpen && (
          <div className="modal-overlay" onClick={() => setIsDeviceModalOpen(false)}>
            <div className="modal-glass-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-row">
                <h3>Multi-Device Real-Time Sync</h3>
                <button className="icon-btn-subtle" onClick={() => setIsDeviceModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Sync Server Connection */}
                <div className="glass-input-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="glass-input-label">Sync Server Connection</label>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 10,
                      backgroundColor: syncStatus === 'connected' ? 'rgba(34, 197, 94, 0.15)' : (syncStatus === 'checking' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                      color: syncStatus === 'connected' ? '#4ade80' : (syncStatus === 'checking' ? '#facc15' : '#f87171'),
                      border: `1px solid ${syncStatus === 'connected' ? 'rgba(34, 197, 94, 0.3)' : (syncStatus === 'checking' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)')}`
                    }}>
                      {syncStatus === 'connected' ? '🟢 Online & Connected' : (syncStatus === 'checking' ? '🟡 Checking...' : '🔴 Offline / Local')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="glass-text-input"
                      placeholder="e.g. https://web-production-975c4.up.railway.app"
                      value={serverUrl}
                      onChange={(e) => {
                        setServerUrl(e.target.value);
                        localStorage.setItem('fintask_server_url', e.target.value);
                      }}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: '#e0a96d' }}
                      onClick={syncWithServer}
                    >
                      🔄 Sync Now
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    Syncs tasks in real-time between your Mac web browser and Android phone app.
                  </div>
                </div>

                <div className="glass-input-row">
                  <label className="glass-input-label">NTFY Device Push Topic</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="glass-text-input"
                      placeholder="e.g. fintask-myalert-room"
                      value={ntfyTopic}
                      onChange={(e) => setNtfyTopic(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}
                      onClick={() => setNtfyTopic(`fintask-${Math.random().toString(36).substring(2, 8)}`)}
                    >
                      Random
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    Install the free <strong>ntfy</strong> app on your iPhone or Android and subscribe to this topic name. Your phone will ring & vibrate with escalating deadline alerts!
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', color: '#38bdf8' }}
                    onClick={handleTestAlert}
                  >
                    ⚡ Test Alert All Devices
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn-secondary" onClick={() => setIsDeviceModalOpen(false)}>
                      Close
                    </button>
                    <button type="submit" className="btn-primary-pill">
                      Save Topic
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Global Edit Modal accessible from Mobile */}
        {editingTask && (
          <div className="modal-overlay" onClick={() => setEditingTask(null)}>
            <div className="modal-glass-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-row">
                <h3>Edit Task & Deadline</h3>
                <button className="icon-btn-subtle" onClick={() => setEditingTask(null)}>✕</button>
              </div>

              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="glass-input-row">
                  <label className="glass-input-label">Task Title</label>
                  <input
                    type="text"
                    className="glass-text-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="glass-input-row">
                  <label className="glass-input-label">Priority Tier</label>
                  <div className="priority-segments-row">
                    <button
                      type="button"
                      className={`segment-btn ${editPriority === 1 ? 'active p1' : ''}`}
                      onClick={() => setEditPriority(1)}
                    >
                      🔥 High (P1)
                    </button>
                    <button
                      type="button"
                      className={`segment-btn ${editPriority === 2 ? 'active p2' : ''}`}
                      onClick={() => setEditPriority(2)}
                    >
                      ⚡ Medium (P2)
                    </button>
                    <button
                      type="button"
                      className={`segment-btn ${editPriority === 3 ? 'active p3' : ''}`}
                      onClick={() => setEditPriority(3)}
                    >
                      🌱 Low (P3)
                    </button>
                  </div>
                </div>

                <div className="deadline-picker-box">
                  <label className="glass-input-label">Modify Deadline</label>
                  <input
                    type="datetime-local"
                    className="glass-text-input"
                    value={editDueAt}
                    onChange={(e) => setEditDueAt(e.target.value)}
                  />
                  <div className="deadline-presets-grid">
                    <button
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => setEditDueAt(calculatePreset(null, 2))}
                    >
                      +2h
                    </button>
                    <button
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => setEditDueAt(calculatePreset('tonight'))}
                    >
                      Tonight
                    </button>
                    <button
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => setEditDueAt(calculatePreset('tomorrow_morning'))}
                    >
                      Tomorrow 9am
                    </button>
                    <button
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => setEditDueAt(calculatePreset('next_monday'))}
                    >
                      Next Mon
                    </button>
                    {editDueAt && (
                      <button
                        type="button"
                        className="preset-chip-btn clear"
                        onClick={() => setEditDueAt('')}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className={`dynamic-deadline-helper ${editDeadlineHelper.cls}`}>
                    {editDeadlineHelper.text}
                  </div>
                </div>

                <div className="glass-input-row">
                  <label className="glass-input-label">Notes</label>
                  <textarea
                    className="glass-text-input"
                    rows="2"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  ></textarea>
                </div>

                <div className="modal-actions-row">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setEditingTask(null)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary-pill">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="app-toast">
            <span>{toastMessage}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-viewport">
      {/* Ambient Top Bar */}
      <div className="ambient-topbar">
        <div className="ambient-author">
          Fintask Workspace
          <span>Escalating Urgency & Multi-Device Engine</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href="https://web-production-975c4.up.railway.app/download-apk"
            className="btn-secondary"
            style={{
              padding: '5px 12px',
              fontSize: '0.74rem',
              borderRadius: '20px',
              background: 'rgba(56, 189, 248, 0.14)',
              borderColor: 'rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              cursor: 'pointer',
              fontWeight: 600
            }}
            title="Download Android APK directly"
          >
            <span>📥</span>
            <span>Download APK</span>
          </a>

          <button
            className="btn-secondary"
            style={{
              padding: '5px 12px',
              fontSize: '0.72rem',
              borderRadius: '20px',
              background: syncStatus === 'connected' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.08)',
              borderColor: syncStatus === 'connected' ? 'rgba(34, 197, 94, 0.35)' : 'rgba(255, 255, 255, 0.16)',
              color: syncStatus === 'connected' ? '#4ade80' : 'rgba(255, 255, 255, 0.85)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
            onClick={syncWithServer}
            title={`Real-time sync status: ${syncStatus}. Tap to sync.`}
          >
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: syncStatus === 'connected' ? '#4ade80' : (syncStatus === 'checking' ? '#facc15' : '#f87171')
            }}></span>
            <span>{syncStatus === 'connected' ? 'Synced with Mobile' : (syncStatus === 'checking' ? 'Syncing...' : 'Local Only')}</span>
          </button>
          <div className="vision-battery">
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Active</span>
            <div className="vision-battery-pill"></div>
          </div>
        </div>
      </div>

      {/* Main Spatial Container */}
      <div className="spatial-container">
        {/* Left Floating Capsule Dock */}
        <aside className="dock-capsule" aria-label="Task views dock">
          <button
            className={`dock-btn ${activeTab === 'all' ? 'active' : ''}`}
            title="All Tasks"
            onClick={() => setActiveTab('all')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </button>
          <button
            className={`dock-btn ${activeTab === 'today' ? 'active' : ''}`}
            title="Due Today"
            onClick={() => setActiveTab('today')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </button>
          <button
            className={`dock-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
            title="Upcoming Deadlines"
            onClick={() => setActiveTab('upcoming')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
          <button
            className={`dock-btn ${activeTab === 'overdue' ? 'active' : ''}`}
            title="Overdue Tasks"
            onClick={() => setActiveTab('overdue')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </button>
          <button
            className="dock-btn"
            title="Settings & Alerts"
            onClick={() => setIsDeviceModalOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </aside>

        {/* Main Floating Glass Panel */}
        <main className="main-window">
          {/* Top Window Navigation */}
          <header className="window-nav">
            <div className="window-logo">
              <div className="logo-monogram">ft</div>
              <span>Fintask</span>
            </div>

            {/* Nav Pills Center Bar */}
            <nav className="nav-pills-bar" aria-label="Task category tabs">
              {navTabs.map((tab) => {
                let badgeCount = null;
                if (tab.id === 'today') badgeCount = stats.today;
                else if (tab.id === 'overdue') badgeCount = stats.overdue;
                else if (tab.id === 'all') badgeCount = stats.total;
                else if (tab.id === 'done') badgeCount = stats.done;
                else if (tab.id === 'upcoming') badgeCount = Math.max(0, stats.pending - stats.today);

                return (
                  <button
                    key={tab.id}
                    className={`nav-pill-btn ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    {badgeCount !== null && <span className="nav-pill-badge">{badgeCount}</span>}
                  </button>
                );
              })}
            </nav>


          </header>

          {/* Hero Section with Headline & Large Key Metrics */}
          <section className="hero-row">
            <div className="hero-left">
              <h1 className="hero-title">
                Smart<br />Deadlines
              </h1>

              {/* Circular Donut Gauge */}
              <div className="hero-gauge-container">
                <svg className="hero-gauge-svg" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth="3.2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.4"
                    strokeDasharray={`${completionPercent || 15}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="hero-gauge-num">
                  {stats.total > 0 ? completionPercent : stats.pending}
                  <sup>{stats.total > 0 ? '%' : ''}</sup>
                </span>
              </div>
            </div>

            {/* Large Stats Numbers */}
            <div className="hero-stats-group">
              <div className="hero-stat-item">
                <span className="hero-stat-label">Pending</span>
                <span className="hero-stat-value">{stats.pending}</span>
              </div>
              <div className="hero-stat-item">
                <span className="hero-stat-label">Due Today</span>
                <span className="hero-stat-value">{stats.today}</span>
              </div>
              <div className="hero-stat-item">
                <span className="hero-stat-label">Overdue</span>
                <span className={`hero-stat-value ${stats.overdue > 0 ? 'overdue' : ''}`}>
                  {stats.overdue}
                </span>
              </div>
              <div className="hero-stat-item">
                <span className="hero-stat-label">Completed</span>
                <span className="hero-stat-value">{stats.done}</span>
              </div>
            </div>
          </section>

          {/* Filter Toolbar */}
          <section className="toolbar-row">
            <div className="priority-filter-chips">
              <button
                className={`filter-chip ${priorityFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('all')}
              >
                All Priorities
              </button>
              <button
                className={`filter-chip ${priorityFilter === 1 ? 'active' : ''}`}
                onClick={() => setPriorityFilter(1)}
              >
                🔥 High (P1)
              </button>
              <button
                className={`filter-chip ${priorityFilter === 2 ? 'active' : ''}`}
                onClick={() => setPriorityFilter(2)}
              >
                ⚡ Medium (P2)
              </button>
              <button
                className={`filter-chip ${priorityFilter === 3 ? 'active' : ''}`}
                onClick={() => setPriorityFilter(3)}
              >
                🌱 Low (P3)
              </button>
            </div>

            <div className="search-box-wrap">
              <svg className="search-box-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                className="search-box-input"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </section>

          {/* 2-Column Workspace Grid */}
          <div className="workspace-grid">
            {/* Left Column: Dedicated Deadline & Task Input Card */}
            <article className="featured-stepper-card">
              <div className="stepper-header">
                <div className="card-title-group">
                  <div className="card-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="16"></line>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                  </div>
                  <div>
                    <h3>Schedule Task & Deadline</h3>
                    <p>Escalating prompts accelerate as the deadline nears</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="glass-input-row">
                  <label className="glass-input-label" htmlFor="new-task-title">
                    Task Title *
                  </label>
                  <input
                    id="new-task-title"
                    type="text"
                    className="glass-text-input"
                    placeholder="e.g. Prepare financial forecast report"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    required
                  />
                </div>

                <div className="glass-input-row">
                  <label className="glass-input-label">Priority Tier</label>
                  <div className="priority-segments-row">
                    <button
                      type="button"
                      className={`segment-btn ${priority === 1 ? 'active p1' : ''}`}
                      onClick={() => setPriority(1)}
                    >
                      🔥 High (P1)
                    </button>
                    <button
                      type="button"
                      className={`segment-btn ${priority === 2 ? 'active p2' : ''}`}
                      onClick={() => setPriority(2)}
                    >
                      ⚡ Medium (P2)
                    </button>
                    <button
                      type="button"
                      className={`segment-btn ${priority === 3 ? 'active p3' : ''}`}
                      onClick={() => setPriority(3)}
                    >
                      🌱 Low (P3)
                    </button>
                  </div>
                </div>

                {/* Dedicated Deadline Section */}
                <div className="deadline-picker-box">
                  <label className="glass-input-label" htmlFor="new-task-due">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    Task Deadline
                  </label>

                  <input
                    id="new-task-due"
                    type="datetime-local"
                    className="glass-text-input"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />

                  {/* Quick Deadline Shortcut Chips */}
                  <div className="deadline-presets-grid">
                    <button
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => setDueAt(calculatePreset(null, 2))}
                    >
                      +2 Hours
                    </button>
                    <button
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => setDueAt(calculatePreset('tonight'))}
                    >
                      Tonight 9 PM
                    </button>
                    <button
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => setDueAt(calculatePreset('tomorrow_morning'))}
                    >
                      Tomorrow 9 AM
                    </button>
                    <button
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => setDueAt(calculatePreset('tomorrow_evening'))}
                    >
                      Tomorrow 5 PM
                    </button>
                    <button
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => setDueAt(calculatePreset('friday'))}
                    >
                      This Friday
                    </button>
                    <button
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => setDueAt(calculatePreset('next_monday'))}
                    >
                      Next Monday
                    </button>
                    {dueAt && (
                      <button
                        type="button"
                        className="preset-chip-btn clear"
                        onClick={() => setDueAt('')}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className={`dynamic-deadline-helper ${deadlineHelper.cls}`}>
                    {deadlineHelper.text}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255,255,255,0.65)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '4px 0',
                    }}
                    onClick={() => setShowNotes(!showNotes)}
                  >
                    {showNotes ? '— Hide notes' : '+ Add task notes / details'}
                  </button>

                  {showNotes && (
                    <div style={{ marginTop: '8px' }}>
                      <textarea
                        className="glass-text-input"
                        rows="2"
                        placeholder="Context, links, instructions..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      ></textarea>
                    </div>
                  )}
                </div>

                <button type="submit" className="schedule-submit-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Schedule Task
                </button>
              </form>
            </article>

            {/* Right Column: Real Tasks List with Escalating Cadence Badges */}
            <aside className="tasks-cards-stack" aria-label="Task list">
              {filteredTasks.length === 0 ? (
                <div className="empty-tasks-placeholder">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: 8 }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                  <p>No tasks found in this view.</p>
                  <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>Schedule a task on the left with a deadline.</span>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const badge = getDeadlineBadge(task.due_at, task.done);
                  const tier = getEscalatingFrequencyTier(task.due_at, task.done, task.priority);
                  const isHighUrgency = !task.done && (badge.cls === 'overdue' || task.priority === 1);
                  const cardClass = isHighUrgency ? 'task-cream-card' : 'task-glass-card';

                  return (
                    <div
                      key={task.id}
                      className={`${cardClass} ${task.done ? 'done' : ''}`}
                    >
                      <div className="card-header-row">
                        <div className="card-title-col">
                          <h4 className={`task-card-title ${task.done ? 'strike' : ''}`}>
                            {task.title}
                          </h4>
                          {task.notes && (
                            <p className="task-card-notes">{task.notes}</p>
                          )}
                          {/* Live Escalating Frequency Tier Indicator */}
                          {tier && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              marginTop: '4px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: isHighUrgency ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                              color: isHighUrgency ? '#dc2626' : '#818cf8'
                            }}>
                              {tier.text}
                            </div>
                          )}
                        </div>

                        <div className="card-action-btns">
                          <button
                            className="icon-btn-subtle"
                            title="Edit task & deadline"
                            onClick={(e) => openEditModal(task, e)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 20h9"></path>
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                          </button>
                          <button
                            className="icon-btn-subtle delete"
                            title="Delete task"
                            onClick={(e) => handleDeleteTask(task.id, task.title, e)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="card-footer-row">
                        <div>
                          <div className={`card-deadline-badge ${badge.cls}`}>
                            {badge.label}
                          </div>

                          {!task.done && (
                            <div className="card-snooze-row">
                              <span style={{ fontSize: '0.62rem', opacity: 0.6, marginRight: 2 }}>Snooze:</span>
                              <button
                                className="quick-snooze-chip"
                                onClick={(e) => handleSnooze(task.id, 15, e)}
                                title="Snooze 15 minutes"
                              >
                                +15m
                              </button>
                              <button
                                className="quick-snooze-chip"
                                onClick={(e) => handleSnooze(task.id, 60, e)}
                                title="Snooze 1 hour"
                              >
                                +1h
                              </button>
                              <button
                                className="quick-snooze-chip"
                                onClick={(e) => handleSnooze(task.id, 180, e)}
                                title="Snooze 3 hours"
                              >
                                +3h
                              </button>
                              <button
                                className="quick-snooze-chip"
                                onClick={(e) => handleSnooze(task.id, 1440, e)}
                                title="Snooze to tomorrow"
                              >
                                +1d
                              </button>
                            </div>
                          )}
                        </div>

                        <div
                          className="vision-switch"
                          onClick={(e) => handleToggleComplete(task, e)}
                          title={task.done ? 'Mark active' : 'Mark completed'}
                        >
                          <span className={`switch-pill ${!task.done ? '' : 'active'}`}>✕</span>
                          <span className={`switch-pill ${!task.done ? 'active' : ''}`}>✓</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </aside>
          </div>

          <div className="carousel-indicator">
            <span className="carousel-dot"></span>
            <span className="carousel-bar"></span>
            <span className="carousel-dot"></span>
          </div>
        </main>
      </div>

      {/* Cross-Device / Settings Modal */}
      {isDeviceModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDeviceModalOpen(false)}>
          <div className="modal-glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>📱 Cross-Device Alerts Setup</h3>
              <button className="icon-btn-subtle" onClick={() => setIsDeviceModalOpen(false)}>✕</button>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              Deadlines prompt again and again with increasing frequency across all your connected devices:
            </div>

            {/* Browser / Current Device Web Notification Permission */}
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>This Device (Browser Alerts & Chimes)</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.65 }}>
                  {notificationsAllowed ? '✅ Audio chimes and popup notifications active' : 'Enable audio chimes & system popups on this screen'}
                </div>
              </div>
              {!notificationsAllowed && (
                <button
                  type="button"
                  className="btn-primary-pill"
                  style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                  onClick={requestNotificationPermission}
                >
                  Enable Now
                </button>
              )}
            </div>

            {/* Mobile Push & Server Sync */}
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Sync Server Connection */}
              <div className="glass-input-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="glass-input-label">Sync Server Connection</label>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 10,
                    backgroundColor: syncStatus === 'connected' ? 'rgba(34, 197, 94, 0.15)' : (syncStatus === 'checking' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                    color: syncStatus === 'connected' ? '#4ade80' : (syncStatus === 'checking' ? '#facc15' : '#f87171'),
                    border: `1px solid ${syncStatus === 'connected' ? 'rgba(34, 197, 94, 0.3)' : (syncStatus === 'checking' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)')}`
                  }}>
                    {syncStatus === 'connected' ? '🟢 Online & Connected' : (syncStatus === 'checking' ? '🟡 Checking...' : '🔴 Offline / Local')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="glass-text-input"
                    placeholder="e.g. https://web-production-975c4.up.railway.app"
                    value={serverUrl}
                    onChange={(e) => {
                      setServerUrl(e.target.value);
                      localStorage.setItem('fintask_server_url', e.target.value);
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: '#e0a96d' }}
                    onClick={syncWithServer}
                  >
                    🔄 Sync Now
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  Syncs tasks in real-time between your Mac web browser and Android phone app.
                </div>
              </div>

              <div className="glass-input-row">
                <label className="glass-input-label">
                  Mobile Push Topic (iOS & Android Lock-Screen Alerts)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="glass-text-input"
                    placeholder="e.g. fintask-aben-7788"
                    value={ntfyTopic}
                    onChange={(e) => setNtfyTopic(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}
                    onClick={() => setNtfyTopic(`fintask-${Math.random().toString(36).substring(2, 8)}`)}
                  >
                    Random
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  Install the free <strong>ntfy</strong> app on your iPhone or Android and subscribe to this topic name. Your phone will ring & vibrate with escalating deadline alerts!
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', color: '#38bdf8' }}
                  onClick={handleTestAlert}
                >
                  ⚡ Test Alert All Devices
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsDeviceModalOpen(false)}>
                    Close
                  </button>
                  <button type="submit" className="btn-primary-pill">
                    Save Topic
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="modal-overlay" onClick={() => setEditingTask(null)}>
          <div className="modal-glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Edit Task & Deadline</h3>
              <button className="icon-btn-subtle" onClick={() => setEditingTask(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="glass-input-row">
                <label className="glass-input-label">Task Title</label>
                <input
                  type="text"
                  className="glass-text-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="glass-input-row">
                <label className="glass-input-label">Priority Tier</label>
                <div className="priority-segments-row">
                  <button
                    type="button"
                    className={`segment-btn ${editPriority === 1 ? 'active p1' : ''}`}
                    onClick={() => setEditPriority(1)}
                  >
                    🔥 High (P1)
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${editPriority === 2 ? 'active p2' : ''}`}
                    onClick={() => setEditPriority(2)}
                  >
                    ⚡ Medium (P2)
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${editPriority === 3 ? 'active p3' : ''}`}
                    onClick={() => setEditPriority(3)}
                  >
                    🌱 Low (P3)
                  </button>
                </div>
              </div>

              <div className="deadline-picker-box">
                <label className="glass-input-label">Modify Deadline</label>
                <input
                  type="datetime-local"
                  className="glass-text-input"
                  value={editDueAt}
                  onChange={(e) => setEditDueAt(e.target.value)}
                />
                <div className="deadline-presets-grid">
                  <button
                    type="button"
                    className="preset-chip-btn"
                    onClick={() => setEditDueAt(calculatePreset(null, 2))}
                  >
                    +2h
                  </button>
                  <button
                    type="button"
                    className="preset-chip-btn"
                    onClick={() => setEditDueAt(calculatePreset('tonight'))}
                  >
                    Tonight
                  </button>
                  <button
                    type="button"
                    className="preset-chip-btn"
                    onClick={() => setEditDueAt(calculatePreset('tomorrow_morning'))}
                  >
                    Tomorrow 9am
                  </button>
                  <button
                    type="button"
                    className="preset-chip-btn"
                    onClick={() => setEditDueAt(calculatePreset('next_monday'))}
                  >
                    Next Mon
                  </button>
                  {editDueAt && (
                    <button
                      type="button"
                      className="preset-chip-btn clear"
                      onClick={() => setEditDueAt('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className={`dynamic-deadline-helper ${editDeadlineHelper.cls}`}>
                  {editDeadlineHelper.text}
                </div>
              </div>

              <div className="glass-input-row">
                <label className="glass-input-label">Notes</label>
                <textarea
                  className="glass-text-input"
                  rows="2"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                ></textarea>
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingTask(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-pill">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="app-toast">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

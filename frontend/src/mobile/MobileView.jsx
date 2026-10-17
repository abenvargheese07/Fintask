import React, { useState, useMemo, useRef } from 'react';
import './mobile.css';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { parseTaskNlp } from '../utils/taskNlp';

// Safe haptic trigger
const triggerHaptic = async (type = 'light') => {
  try {
    if (type === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (type === 'medium') {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch (e) {
    if (navigator.vibrate) navigator.vibrate(type === 'success' ? [100, 50, 100] : 40);
  }
};

export default function MobileView({
  tasks,
  stats,
  activeTab,
  setActiveTab,
  priorityFilter,
  setPriorityFilter,
  searchQuery,
  setSearchQuery,
  handleCreateTask,
  handleToggleComplete,
  handleSnooze,
  handleDeleteTask,
  openEditModal,
  setIsDeviceModalOpen,
  getDeadlineBadge,
  getEscalatingFrequencyTier,
  title,
  setTitle,
  dueAt,
  setDueAt,
  priority,
  setPriority,
  notes,
  setNotes,
  calculatePreset,
  deadlineHelper,
  onSwitchToDesktop,
  handleTestAlert,
  syncStatus,
  syncWithServer,
  serverUrl,
  ntfyTopic,
  notificationsAllowed,
  requestNotificationPermission,
}) {
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isQuickAddFocused, setIsQuickAddFocused] = useState(false);
  const [mobileNlpDismissed, setMobileNlpDismissed] = useState(false);
  const [showMobileCustomDate, setShowMobileCustomDate] = useState(false);

  const mobileNlpSuggestion = useMemo(() => {
    if (mobileNlpDismissed || !title.trim()) return { hasSuggestion: false };
    return parseTaskNlp(title);
  }, [title, mobileNlpDismissed]);

  const applyMobileNlp = () => {
    if (!mobileNlpSuggestion.hasSuggestion) return;
    triggerHaptic('medium');
    if (mobileNlpSuggestion.detectedDueAt) setDueAt(mobileNlpSuggestion.detectedDueAt);
    if (mobileNlpSuggestion.detectedPriority) setPriority(mobileNlpSuggestion.detectedPriority);
    setTitle(mobileNlpSuggestion.cleanTitle);
    setMobileNlpDismissed(true);
  };

  const navTabs = [
    { id: 'today', label: 'Today', countKey: 'today' },
    { id: 'upcoming', label: 'Upcoming', countKey: null },
    { id: 'overdue', label: 'Overdue', countKey: 'overdue' },
    { id: 'all', label: 'All Tasks', countKey: 'total' },
    { id: 'done', label: 'Completed', countKey: 'done' },
  ];

  const completionPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q));
    }
    return true;
  });

  const onSubmitTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    triggerHaptic('success');
    await handleCreateTask(e);
    setIsNewSheetOpen(false);
    setIsQuickAddFocused(false);
    setMobileNlpDismissed(false);
    setShowMobileCustomDate(false);
  };

  const onToggleDone = async (task, e) => {
    triggerHaptic(task.done ? 'light' : 'success');
    await handleToggleComplete(task, e);
  };

  const onSnooze = async (taskId, mins, e) => {
    triggerHaptic('medium');
    await handleSnooze(taskId, mins, e);
  };

  return (
    <div className="mobile-app-root">
      {/* Safe Area Top Header */}
      <header className="mobile-header">
        <div className="mobile-brand">
          <img
            src="/logo.png"
            alt="Fintask Logo"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              objectFit: 'cover',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
            }}
          />
          <div>
            <h2>Fintask</h2>
            <span>Mobile Edition</span>
          </div>
        </div>

        <div className="mobile-header-actions">
          {syncWithServer && (
            <button
              className="mobile-icon-btn"
              style={{
                width: 'auto',
                padding: '4px 8px',
                borderRadius: 12,
                gap: 5,
                fontSize: '0.68rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                color: syncStatus === 'connected' ? '#4ade80' : (syncStatus === 'checking' ? '#facc15' : '#f87171'),
                borderColor: syncStatus === 'connected' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.15)',
                background: syncStatus === 'connected' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.06)'
              }}
              title={`Sync with web: ${syncStatus}. Tap to refresh.`}
              onClick={syncWithServer}
            >
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: syncStatus === 'connected' ? '#4ade80' : (syncStatus === 'checking' ? '#facc15' : '#f87171')
              }}></span>
              <span>{syncStatus === 'connected' ? 'Synced' : (syncStatus === 'checking' ? '...' : 'Offline')}</span>
            </button>
          )}

          {onSwitchToDesktop && (
            <button
              className="mobile-icon-btn"
              title="Switch to Desktop View"
              onClick={onSwitchToDesktop}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="20" height="14" x="2" y="3" rx="2"></rect>
                <line x1="8" x2="16" y1="21" y2="21"></line>
                <line x1="12" x2="12" y1="17" y2="21"></line>
              </svg>
            </button>
          )}

          <a
            href="https://web-production-975c4.up.railway.app/download-apk"
            className="mobile-icon-btn"
            title="Download Android APK"
            style={{ textDecoration: 'none', color: '#38bdf8' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>

          <button
            className="mobile-icon-btn"
            title="Search"
            onClick={() => setShowSearch(!showSearch)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>

          <button
            className="mobile-icon-btn"
            title="Multi-Device Settings"
            onClick={() => setIsDeviceModalOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </header>

      {/* Expandable Search Input */}
      {showSearch && (
        <div style={{ padding: '8px 18px 0' }}>
          <input
            type="text"
            className="search-box-input"
            style={{ width: '100%', borderRadius: 12, padding: '8px 14px' }}
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* Hero Metrics Card */}
      <section className="mobile-hero-card">
        <div className="mobile-hero-top">
          <div className="mobile-hero-title-group">
            <h3>Smart Deadlines</h3>
            <p>Active task & reminder workflow</p>
          </div>

          {/* Donut Gauge */}
          <div className="hero-gauge-container" style={{ width: 50, height: 50 }}>
            <svg className="hero-gauge-svg" viewBox="0 0 36 36" style={{ width: 50, height: 50 }}>
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
            <span className="hero-gauge-num" style={{ fontSize: '0.9rem' }}>
              {stats.total > 0 ? completionPercent : stats.pending}
              <sup>{stats.total > 0 ? '%' : ''}</sup>
            </span>
          </div>
        </div>

        {/* 4 Stat Tiles */}
        <div className="mobile-stats-grid">
          <div className="mobile-stat-tile">
            <span>Pending</span>
            <span>{stats.pending}</span>
          </div>
          <div className="mobile-stat-tile">
            <span>Today</span>
            <span>{stats.today}</span>
          </div>
          <div className="mobile-stat-tile overdue">
            <span>Overdue</span>
            <span>{stats.overdue}</span>
          </div>
          <div className="mobile-stat-tile">
            <span>Done</span>
            <span>{stats.done}</span>
          </div>
        </div>
      </section>

      {/* Mobile Notification Actions & Topic Subscribe */}
      <div style={{ padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!notificationsAllowed && requestNotificationPermission && (
          <button
            type="button"
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: 14,
              border: '1px solid rgba(245, 158, 11, 0.5)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(0, 0, 0, 0.2))',
              color: '#fde68a',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
            }}
            onClick={requestNotificationPermission}
          >
            <span>🔔</span>
            <span>Enable App Notifications on This Phone</span>
          </button>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          {handleTestAlert && (
            <button
              type="button"
              className="mobile-test-alert-btn"
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 12,
                border: '1px solid rgba(224, 169, 109, 0.4)',
                background: 'linear-gradient(135deg, rgba(224, 169, 109, 0.16), rgba(255, 255, 255, 0.04))',
                color: '#f6d8ae',
                fontSize: '0.74rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
              onClick={handleTestAlert}
            >
              <span>⚡</span>
              <span>Test Alert</span>
            </button>
          )}

          {ntfyTopic && (
            <a
              href={`https://ntfy.sh/${ntfyTopic}`}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1.2,
                padding: '8px 10px',
                borderRadius: 12,
                border: '1px solid rgba(56, 189, 248, 0.4)',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.16), rgba(255, 255, 255, 0.04))',
                color: '#7dd3fc',
                fontSize: '0.74rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              title="Subscribe to background lock-screen push alerts via ntfy"
            >
              <span>📲</span>
              <span>Lock-Screen Push ↗</span>
            </a>
          )}
        </div>
      </div>

      {/* Mobile Instant Quick Add Strip */}
      <div className="mobile-quick-add-strip">
        <form onSubmit={onSubmitTask} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="mobile-quick-input-row">
            <span style={{ fontSize: '0.95rem' }}>⚡</span>
            <input
              type="text"
              className="mobile-quick-input-field"
              placeholder="Quick add task... (e.g. Call John tomorrow 9am !p1)"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (mobileNlpDismissed) setMobileNlpDismissed(false);
              }}
              onFocus={() => setIsQuickAddFocused(true)}
            />
            <button
              type="submit"
              className="mobile-quick-add-btn"
              disabled={!title.trim()}
              style={{ opacity: title.trim() ? 1 : 0.35 }}
              title="Schedule task"
            >
              ➔
            </button>
          </div>

          {/* Quick interactive chips & NLP preview */}
          {(isQuickAddFocused || title.trim() || dueAt) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, animation: 'slideDownFade 0.2s ease' }}>
              {mobileNlpSuggestion.hasSuggestion && (
                <div className="nlp-suggestion-banner" style={{ padding: '5px 10px', fontSize: '0.72rem' }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    ✨ {mobileNlpSuggestion.label}
                  </span>
                  <button
                    type="button"
                    className="nlp-suggestion-apply-btn"
                    onClick={applyMobileNlp}
                  >
                    Apply
                  </button>
                </div>
              )}

              <div className="mobile-quick-chips-scroll">
                <button
                  type="button"
                  className={`pill-toggle-btn ${priority === 1 ? 'active p1' : (priority === 2 ? 'active p2' : 'active p3')}`}
                  style={{ padding: '3px 9px', fontSize: '0.68rem' }}
                  onClick={() => {
                    triggerHaptic('light');
                    setPriority(priority === 1 ? 2 : (priority === 2 ? 3 : 1));
                  }}
                  title="Cycle priority"
                >
                  {priority === 1 ? '🔥 High' : (priority === 2 ? '⚡ Med' : '🌱 Low')}
                </button>

                <button
                  type="button"
                  className={`deadline-pill ${dueAt === calculatePreset(null, 2) ? 'active' : ''}`}
                  style={{ padding: '3px 9px', fontSize: '0.68rem' }}
                  onClick={() => {
                    triggerHaptic('light');
                    setDueAt(dueAt === calculatePreset(null, 2) ? '' : calculatePreset(null, 2));
                  }}
                >
                  +2h
                </button>

                <button
                  type="button"
                  className={`deadline-pill ${dueAt === calculatePreset('tonight') ? 'active' : ''}`}
                  style={{ padding: '3px 9px', fontSize: '0.68rem' }}
                  onClick={() => {
                    triggerHaptic('light');
                    setDueAt(dueAt === calculatePreset('tonight') ? '' : calculatePreset('tonight'));
                  }}
                >
                  Tonight
                </button>

                <button
                  type="button"
                  className={`deadline-pill ${dueAt === calculatePreset('tomorrow_morning') ? 'active' : ''}`}
                  style={{ padding: '3px 9px', fontSize: '0.68rem' }}
                  onClick={() => {
                    triggerHaptic('light');
                    setDueAt(dueAt === calculatePreset('tomorrow_morning') ? '' : calculatePreset('tomorrow_morning'));
                  }}
                >
                  Tomorrow
                </button>

                <button
                  type="button"
                  className={`deadline-pill ${dueAt === calculatePreset('friday') ? 'active' : ''}`}
                  style={{ padding: '3px 9px', fontSize: '0.68rem' }}
                  onClick={() => {
                    triggerHaptic('light');
                    setDueAt(dueAt === calculatePreset('friday') ? '' : calculatePreset('friday'));
                  }}
                >
                  Friday
                </button>

                <button
                  type="button"
                  className="deadline-pill"
                  style={{ padding: '3px 9px', fontSize: '0.68rem' }}
                  onClick={() => {
                    triggerHaptic('light');
                    setIsNewSheetOpen(true);
                  }}
                >
                  📝 Details...
                </button>

                {dueAt && (
                  <button
                    type="button"
                    style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.68rem', fontWeight: 600, padding: '2px 4px', cursor: 'pointer' }}
                    onClick={() => {
                      triggerHaptic('light');
                      setDueAt('');
                    }}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Horizontal Scrollable Tabs */}
      <nav className="mobile-tabs-scroll" aria-label="Task category tabs">
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
              className={`mobile-tab-pill ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic('light');
                setActiveTab(tab.id);
              }}
            >
              {tab.label}
              {badgeCount !== null && <span style={{ fontSize: '0.68rem', opacity: 0.75 }}>({badgeCount})</span>}
            </button>
          );
        })}
      </nav>

      {/* Priority Chips */}
      <div className="mobile-priority-row">
        <div className="mobile-chips-group">
          <button
            className={`mobile-chip ${priorityFilter === 'all' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('all')}
          >
            All
          </button>
          <button
            className={`mobile-chip ${priorityFilter === 1 ? 'active' : ''}`}
            onClick={() => setPriorityFilter(1)}
          >
            🔥 High
          </button>
          <button
            className={`mobile-chip ${priorityFilter === 2 ? 'active' : ''}`}
            onClick={() => setPriorityFilter(2)}
          >
            ⚡ Med
          </button>
          <button
            className={`mobile-chip ${priorityFilter === 3 ? 'active' : ''}`}
            onClick={() => setPriorityFilter(3)}
          >
            🌱 Low
          </button>
        </div>
      </div>

      {/* Tasks Feed */}
      <main className="mobile-tasks-feed">
        {filteredTasks.length === 0 ? (
          <div className="empty-tasks-placeholder" style={{ padding: '36px 16px' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: 8 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
            <p>No tasks in this view.</p>
            <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>Tap the '+' button below to schedule one.</span>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const badge = getDeadlineBadge(task.due_at, task.done);
            const tier = getEscalatingFrequencyTier(task.due_at, task.done, task.priority);
            const isHighUrgency = !task.done && (badge.cls === 'overdue' || task.priority === 1);

            return (
              <article
                key={task.id}
                className={`task-item-card ${isHighUrgency ? 'urgent-tier' : ''} ${task.done ? 'is-done' : ''}`}
              >
                {/* Left: Circular Completion Checkbox */}
                <button
                  type="button"
                  className={`task-checkbox-btn ${task.done ? 'checked' : ''}`}
                  onClick={(e) => {
                    triggerHaptic('medium');
                    onToggleDone(task, e);
                  }}
                  title={task.done ? 'Mark as incomplete' : 'Mark as complete'}
                  aria-label={task.done ? 'Mark as incomplete' : 'Mark as complete'}
                >
                  {task.done && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </button>

                {/* Main Content Area */}
                <div className="task-content-main">
                  {/* Top Row: Title, Priority Tag, Cadence Tier, Action Buttons */}
                  <div className="task-row-top">
                    <div className="task-title-group">
                      <h4 className={`task-headline ${task.done ? 'strike' : ''}`}>
                        {task.title}
                      </h4>

                      {/* Priority Chip */}
                      {task.priority === 1 && (
                        <span className="task-priority-tag p1">🔥 High</span>
                      )}
                      {task.priority === 2 && (
                        <span className="task-priority-tag p2">⚡ Med</span>
                      )}
                      {task.priority === 3 && (
                        <span className="task-priority-tag p3">🌱 Low</span>
                      )}

                      {/* Escalating Urgency Cadence */}
                      {!task.done && tier && (
                        <span className={`task-tier-tag ${isHighUrgency ? 'urgent' : ''}`}>
                          {tier.text}
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="task-action-btns">
                      <button
                        type="button"
                        className="task-icon-action-btn"
                        title="Edit"
                        onClick={(e) => {
                          triggerHaptic('light');
                          openEditModal(task, e);
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="task-icon-action-btn delete"
                        title="Delete"
                        onClick={(e) => {
                          triggerHaptic('light');
                          handleDeleteTask(task.id, task.title, e);
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  {task.notes && (
                    <p className="task-notes-snippet">{task.notes}</p>
                  )}

                  {/* Bottom Row: Deadline Chip & Snooze Pills */}
                  <div className="task-row-bottom">
                    <div className={`task-deadline-chip ${badge.cls}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span>{badge.label}</span>
                    </div>

                    {!task.done && (
                      <div className="task-snooze-group">
                        <span className="snooze-label">Snooze:</span>
                        <button
                          type="button"
                          className="task-snooze-pill"
                          onClick={(e) => {
                            triggerHaptic('light');
                            onSnooze(task.id, 15, e);
                          }}
                        >
                          +15m
                        </button>
                        <button
                          type="button"
                          className="task-snooze-pill"
                          onClick={(e) => {
                            triggerHaptic('light');
                            onSnooze(task.id, 60, e);
                          }}
                        >
                          +1h
                        </button>
                        <button
                          type="button"
                          className="task-snooze-pill"
                          onClick={(e) => {
                            triggerHaptic('light');
                            onSnooze(task.id, 1440, e);
                          }}
                        >
                          +1d
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </main>

      {/* Floating Action Button (FAB) for adding new task */}
      <button
        className="mobile-fab"
        title="Schedule Task"
        onClick={() => {
          triggerHaptic('medium');
          setIsNewSheetOpen(true);
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      {/* Mobile Bottom Navigation Bar */}
      <footer className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          className={`mobile-nav-item ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('today');
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>Today</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('upcoming');
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Upcoming</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'overdue' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('overdue');
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>Overdue</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('all');
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>All Tasks</span>
        </button>

        <button
          className="mobile-nav-item"
          onClick={() => {
            triggerHaptic('light');
            setIsDeviceModalOpen(true);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect>
            <line x1="12" x2="12.01" y1="18" y2="18"></line>
          </svg>
          <span>Devices</span>
        </button>
      </footer>

      {/* Slide-Up Mobile Bottom Sheet for Task Creation */}
      {isNewSheetOpen && (
        <div className="mobile-bottom-sheet-overlay" onClick={() => setIsNewSheetOpen(false)}>
          <div className="mobile-bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle-bar"></div>
            <div className="sheet-header">
              <h3>Schedule Task</h3>
              <button className="icon-btn-subtle" onClick={() => setIsNewSheetOpen(false)}>✕</button>
            </div>

            <form onSubmit={onSubmitTask} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="glass-input-row">
                <label className="glass-input-label">Task Title *</label>
                <input
                  type="text"
                  className="glass-text-input"
                  placeholder="e.g. Call client tomorrow 10am !p1"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (mobileNlpDismissed) setMobileNlpDismissed(false);
                  }}
                  maxLength={200}
                  required
                  autoFocus
                />

                {mobileNlpSuggestion.hasSuggestion && (
                  <div className="nlp-suggestion-banner" style={{ marginTop: 6, padding: '6px 12px', fontSize: '0.74rem' }}>
                    <span>✨ {mobileNlpSuggestion.label}</span>
                    <button type="button" className="nlp-suggestion-apply-btn" onClick={applyMobileNlp}>
                      Apply
                    </button>
                  </div>
                )}
              </div>

              <div className="glass-input-row">
                <label className="glass-input-label">Priority</label>
                <div className="priority-segments-row">
                  <button
                    type="button"
                    className={`segment-btn ${priority === 1 ? 'active p1' : ''}`}
                    onClick={() => {
                      triggerHaptic('light');
                      setPriority(1);
                    }}
                  >
                    🔥 High (P1)
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${priority === 2 ? 'active p2' : ''}`}
                    onClick={() => {
                      triggerHaptic('light');
                      setPriority(2);
                    }}
                  >
                    ⚡ Med (P2)
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${priority === 3 ? 'active p3' : ''}`}
                    onClick={() => {
                      triggerHaptic('light');
                      setPriority(3);
                    }}
                  >
                    🌱 Low (P3)
                  </button>
                </div>
              </div>

              <div className="deadline-picker-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="glass-input-label" style={{ margin: 0 }}>Deadline</label>
                  {dueAt && (
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => {
                        triggerHaptic('light');
                        setDueAt('');
                      }}
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>

                <div className="deadline-presets-grid">
                  <button type="button" className={`preset-chip-btn ${dueAt === calculatePreset(null, 2) ? 'active' : ''}`} onClick={() => { triggerHaptic('light'); setDueAt(calculatePreset(null, 2)); }}>+2h</button>
                  <button type="button" className={`preset-chip-btn ${dueAt === calculatePreset('tonight') ? 'active' : ''}`} onClick={() => { triggerHaptic('light'); setDueAt(calculatePreset('tonight')); }}>Tonight 9pm</button>
                  <button type="button" className={`preset-chip-btn ${dueAt === calculatePreset('tomorrow_morning') ? 'active' : ''}`} onClick={() => { triggerHaptic('light'); setDueAt(calculatePreset('tomorrow_morning')); }}>Tomorrow 9am</button>
                  <button type="button" className={`preset-chip-btn ${dueAt === calculatePreset('tomorrow_evening') ? 'active' : ''}`} onClick={() => { triggerHaptic('light'); setDueAt(calculatePreset('tomorrow_evening')); }}>Tomorrow 5pm</button>
                  <button type="button" className={`preset-chip-btn ${dueAt === calculatePreset('friday') ? 'active' : ''}`} onClick={() => { triggerHaptic('light'); setDueAt(calculatePreset('friday')); }}>Friday</button>
                  <button type="button" className="preset-chip-btn" onClick={() => { triggerHaptic('light'); setShowMobileCustomDate(!showMobileCustomDate); }}>Custom Date...</button>
                </div>

                {showMobileCustomDate && (
                  <input
                    type="datetime-local"
                    className="glass-text-input"
                    style={{ marginTop: 6 }}
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                )}

                {dueAt && (
                  <div className={`dynamic-deadline-helper ${deadlineHelper.cls}`} style={{ fontSize: '0.72rem', marginTop: 4 }}>
                    ⏳ {deadlineHelper.text}
                  </div>
                )}
              </div>

              <div className="glass-input-row">
                <label className="glass-input-label">Notes (Optional)</label>
                <textarea
                  className="glass-text-input"
                  rows="2"
                  placeholder="Details, sub-tasks, links..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
              </div>

              <button type="submit" className="schedule-submit-btn" style={{ marginTop: 6 }}>
                Schedule Task 🎯
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

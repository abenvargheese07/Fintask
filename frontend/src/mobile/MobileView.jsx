import React, { useState } from 'react';
import './mobile.css';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

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
    triggerHaptic('success');
    await handleCreateTask(e);
    setIsNewSheetOpen(false);
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
            const cardClass = isHighUrgency ? 'task-cream-card' : 'task-glass-card';

            return (
              <div
                key={task.id}
                className={`${cardClass} ${task.done ? 'done' : ''}`}
                style={{ borderRadius: 20, padding: '14px 16px' }}
              >
                <div className="card-header-row">
                  <div className="card-title-col">
                    <h4 className={`task-card-title ${task.done ? 'strike' : ''}`} style={{ fontSize: '0.92rem' }}>
                      {task.title}
                    </h4>
                    {task.notes && (
                      <p className="task-card-notes" style={{ fontSize: '0.72rem' }}>{task.notes}</p>
                    )}

                    {tier && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        marginTop: 4,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isHighUrgency ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                        color: isHighUrgency ? '#dc2626' : '#818cf8',
                      }}>
                        {tier.text}
                      </div>
                    )}
                  </div>

                  <div className="card-action-btns">
                    <button
                      className="icon-btn-subtle"
                      title="Edit"
                      onClick={(e) => openEditModal(task, e)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </button>
                    <button
                      className="icon-btn-subtle delete"
                      title="Delete"
                      onClick={(e) => handleDeleteTask(task.id, task.title, e)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="card-footer-row" style={{ marginTop: 6 }}>
                  <div>
                    <div className={`card-deadline-badge ${badge.cls}`} style={{ fontSize: '0.72rem' }}>
                      {badge.label}
                    </div>

                    {!task.done && (
                      <div className="card-snooze-row" style={{ marginTop: 4 }}>
                        <button className="quick-snooze-chip" onClick={(e) => onSnooze(task.id, 15, e)}>+15m</button>
                        <button className="quick-snooze-chip" onClick={(e) => onSnooze(task.id, 60, e)}>+1h</button>
                        <button className="quick-snooze-chip" onClick={(e) => onSnooze(task.id, 1440, e)}>+1d</button>
                      </div>
                    )}
                  </div>

                  <div
                    className="vision-switch"
                    onClick={(e) => onToggleDone(task, e)}
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
                  placeholder="e.g. Call client & review portfolio"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                  autoFocus
                />
              </div>

              <div className="glass-input-row">
                <label className="glass-input-label">Priority</label>
                <div className="priority-segments-row">
                  <button
                    type="button"
                    className={`segment-btn ${priority === 1 ? 'active p1' : ''}`}
                    onClick={() => setPriority(1)}
                  >
                    🔥 High
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${priority === 2 ? 'active p2' : ''}`}
                    onClick={() => setPriority(2)}
                  >
                    ⚡ Med
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${priority === 3 ? 'active p3' : ''}`}
                    onClick={() => setPriority(3)}
                  >
                    🌱 Low
                  </button>
                </div>
              </div>

              <div className="deadline-picker-box">
                <label className="glass-input-label">Deadline</label>
                <input
                  type="datetime-local"
                  className="glass-text-input"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
                <div className="deadline-presets-grid">
                  <button type="button" className="preset-chip-btn" onClick={() => setDueAt(calculatePreset(null, 2))}>+2h</button>
                  <button type="button" className="preset-chip-btn" onClick={() => setDueAt(calculatePreset('tonight'))}>Tonight</button>
                  <button type="button" className="preset-chip-btn" onClick={() => setDueAt(calculatePreset('tomorrow_morning'))}>Tomorrow 9am</button>
                  <button type="button" className="preset-chip-btn" onClick={() => setDueAt(calculatePreset('friday'))}>Friday</button>
                  {dueAt && <button type="button" className="preset-chip-btn clear" onClick={() => setDueAt('')}>Clear</button>}
                </div>
                <div className={`dynamic-deadline-helper ${deadlineHelper.cls}`} style={{ fontSize: '0.72rem' }}>
                  {deadlineHelper.text}
                </div>
              </div>

              <div className="glass-input-row">
                <label className="glass-input-label">Notes</label>
                <textarea
                  className="glass-text-input"
                  rows="2"
                  placeholder="Details, sub-tasks, links..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
              </div>

              <button type="submit" className="schedule-submit-btn" style={{ marginTop: 4 }}>
                Schedule Task
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

(() => {
  'use strict';

  const SWATCH_COLORS = [
    '#7c8cff', '#b57cff', '#4fd1c5', '#f6ad55',
    '#f687b3', '#4fd1a5', '#ff6b81', '#63b3ed',
    '#f6e05e', '#a0aec0'
  ];

  const RING_CIRCUMFERENCE = 2 * Math.PI * 38;

  let state = {
    subjects: [],
    tasks: []
  };

  let activeFilter = 'all';
  let activeSubjectId = null;
  let activeSort = 'due';
  let searchQuery = '';
  let editingTaskId = null;
  let selectedPriority = 'medium';
  let selectedSubjectColor = SWATCH_COLORS[0];

  // ---------- Elements ----------
  const el = (id) => document.getElementById(id);

  const subjectListEl = el('subjectList');
  const taskGroupsEl = el('taskGroups');
  const emptyStateEl = el('emptyState');
  const filterBarEl = el('filterBar');
  const searchInputEl = el('searchInput');
  const sortSelectEl = el('sortSelect');
  const toastEl = el('toast');

  const taskModalOverlay = el('taskModalOverlay');
  const taskForm = el('taskForm');
  const modalTitle = el('modalTitle');
  const taskIdInput = el('taskId');
  const taskTitleInput = el('taskTitle');
  const taskSubjectSelect = el('taskSubject');
  const taskDueInput = el('taskDue');
  const taskNotesInput = el('taskNotes');
  const prioritySegment = el('prioritySegment');

  const subjectModalOverlay = el('subjectModalOverlay');
  const subjectForm = el('subjectForm');
  const subjectNameInput = el('subjectName');
  const colorSwatchesEl = el('colorSwatches');

  // ---------- Persistence ----------
  async function loadState() {
    state = await window.homeworkAPI.load();
  }

  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => window.homeworkAPI.save(state), 150);
  }

  // ---------- Utils ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('visible'), 2200);
  }

  function todayStr() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function parseDate(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function dayDiff(dateA, dateB) {
    const ms = dateA.setHours(0,0,0,0) - dateB.setHours(0,0,0,0);
    return Math.round(ms / 86400000);
  }

  function formatDue(str) {
    const date = parseDate(str);
    if (!date) return 'No due date';
    const today = todayStr();
    const diff = dayDiff(new Date(date), new Date(today));
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    if (diff === -1) return 'Was due yesterday';
    if (diff < 0) return `Overdue by ${Math.abs(diff)}d`;
    if (diff <= 6) return `Due in ${diff}d`;
    return `Due ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }

  function getSubject(id) {
    return state.subjects.find((s) => s.id === id) || null;
  }

  function subjectTaskCount(id) {
    return state.tasks.filter((t) => t.subjectId === id && !t.completed).length;
  }

  // ---------- Subjects ----------
  function renderSubjects() {
    subjectListEl.innerHTML = '';

    const allItem = document.createElement('li');
    allItem.className = 'subject-item' + (activeSubjectId === null ? ' active' : '');
    allItem.innerHTML = `
      <span class="subject-dot" style="background:linear-gradient(135deg,var(--accent-a),var(--accent-b))"></span>
      <span class="subject-name">All subjects</span>
      <span class="subject-count">${state.tasks.filter((t) => !t.completed).length}</span>
    `;
    allItem.addEventListener('click', () => { activeSubjectId = null; renderAll(); });
    subjectListEl.appendChild(allItem);

    state.subjects.forEach((subject) => {
      const item = document.createElement('li');
      item.className = 'subject-item' + (activeSubjectId === subject.id ? ' active' : '');
      item.innerHTML = `
        <span class="subject-dot" style="background:${subject.color}"></span>
        <span class="subject-name">${escapeHtml(subject.name)}</span>
        <span class="subject-count">${subjectTaskCount(subject.id)}</span>
      `;
      item.addEventListener('click', () => { activeSubjectId = subject.id; renderAll(); });
      subjectListEl.appendChild(item);
    });
  }

  function populateSubjectSelect() {
    taskSubjectSelect.innerHTML = state.subjects
      .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
      .join('');
  }

  function renderColorSwatches() {
    colorSwatchesEl.innerHTML = '';
    SWATCH_COLORS.forEach((color) => {
      const sw = document.createElement('div');
      sw.className = 'swatch' + (color === selectedSubjectColor ? ' selected' : '');
      sw.style.background = color;
      sw.addEventListener('click', () => {
        selectedSubjectColor = color;
        renderColorSwatches();
      });
      colorSwatchesEl.appendChild(sw);
    });
  }

  // ---------- Stats ----------
  function renderStats() {
    const today = todayStr();
    const total = state.tasks.length;
    const done = state.tasks.filter((t) => t.completed).length;
    const pending = total - done;
    const overdue = state.tasks.filter((t) => {
      if (t.completed || !t.dueDate) return false;
      return dayDiff(new Date(parseDate(t.dueDate)), new Date(today)) < 0;
    }).length;
    const dueToday = state.tasks.filter((t) => {
      if (t.completed || !t.dueDate) return false;
      return dayDiff(new Date(parseDate(t.dueDate)), new Date(today)) === 0;
    }).length;

    el('statPending').textContent = pending;
    el('statOverdue').textContent = overdue;
    el('statToday').textContent = dueToday;
    el('statDone').textContent = done;

    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    el('progressPercent').textContent = `${pct}%`;
    el('progressSub').textContent = `${done} of ${total} done`;
    const ringFg = el('ringFg');
    const offset = RING_CIRCUMFERENCE - (pct / 100) * RING_CIRCUMFERENCE;
    ringFg.style.strokeDashoffset = offset;
    ringFg.style.stroke = pct === 100 && total > 0 ? 'var(--ok)' : 'var(--accent-a)';
  }

  // ---------- Task filtering / grouping ----------
  function getFilteredTasks() {
    const today = todayStr();
    let tasks = state.tasks.slice();

    if (activeSubjectId) {
      tasks = tasks.filter((t) => t.subjectId === activeSubjectId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      tasks = tasks.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      );
    }

    if (activeFilter === 'pending') {
      tasks = tasks.filter((t) => !t.completed);
    } else if (activeFilter === 'completed') {
      tasks = tasks.filter((t) => t.completed);
    } else if (activeFilter === 'overdue') {
      tasks = tasks.filter((t) => !t.completed && t.dueDate && dayDiff(new Date(parseDate(t.dueDate)), new Date(today)) < 0);
    }

    const priorityRank = { high: 0, medium: 1, low: 2 };
    tasks.sort((a, b) => {
      if (activeSort === 'priority') return priorityRank[a.priority] - priorityRank[b.priority];
      if (activeSort === 'subject') return (getSubject(a.subjectId)?.name || '').localeCompare(getSubject(b.subjectId)?.name || '');
      if (activeSort === 'created') return b.createdAt - a.createdAt;
      // due date default
      if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return parseDate(a.dueDate) - parseDate(b.dueDate);
    });

    return tasks;
  }

  function groupTasks(tasks) {
    const today = todayStr();
    const groups = {
      overdue: { title: 'Overdue', cls: 'overdue', items: [] },
      today: { title: 'Due Today', cls: 'today', items: [] },
      week: { title: 'This Week', cls: 'week', items: [] },
      later: { title: 'Later', cls: 'later', items: [] },
      none: { title: 'No Due Date', cls: 'none', items: [] },
      done: { title: 'Completed', cls: 'done', items: [] }
    };

    tasks.forEach((t) => {
      if (t.completed) { groups.done.items.push(t); return; }
      if (!t.dueDate) { groups.none.items.push(t); return; }
      const diff = dayDiff(new Date(parseDate(t.dueDate)), new Date(today));
      if (diff < 0) groups.overdue.items.push(t);
      else if (diff === 0) groups.today.items.push(t);
      else if (diff <= 6) groups.week.items.push(t);
      else groups.later.items.push(t);
    });

    return groups;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderTaskCard(task) {
    const subject = getSubject(task.subjectId);
    const today = todayStr();
    const diff = task.dueDate ? dayDiff(new Date(parseDate(task.dueDate)), new Date(today)) : null;
    const isOverdue = !task.completed && diff !== null && diff < 0;
    const isToday = !task.completed && diff === 0;

    const card = document.createElement('div');
    card.className = 'task-card' + (task.completed ? ' completed' : '') + (isOverdue ? ' overdue-flag' : '');
    card.dataset.id = task.id;

    card.innerHTML = `
      <div class="checkbox ${task.completed ? 'checked' : ''}" data-action="toggle">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="task-main">
        <div class="task-top-row">
          <span class="task-title">${escapeHtml(task.title)}</span>
          ${subject ? `<span class="subject-tag" style="color:${subject.color};background:${subject.color}22">${escapeHtml(subject.name)}</span>` : ''}
          <span class="priority-badge ${task.priority}">${task.priority}</span>
        </div>
        <div class="task-meta-row">
          <span class="task-due ${isOverdue ? 'is-overdue' : ''} ${isToday ? 'is-today' : ''}">📅 ${formatDue(task.dueDate)}</span>
        </div>
        ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ''}
      </div>
      <div class="task-actions">
        <button class="icon-btn small" data-action="edit" title="Edit">✎</button>
        <button class="icon-btn small" data-action="delete" title="Delete">🗑</button>
      </div>
    `;

    card.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleComplete(task.id));
    card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal(task.id));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTask(task.id));

    return card;
  }

  function renderTasks() {
    const filtered = getFilteredTasks();
    taskGroupsEl.innerHTML = '';

    if (state.tasks.length === 0) {
      emptyStateEl.classList.add('visible');
      return;
    }
    emptyStateEl.classList.remove('visible');

    const order = ['overdue', 'today', 'week', 'later', 'none', 'done'];
    const groups = groupTasks(filtered);
    let anyRendered = false;

    order.forEach((key) => {
      const group = groups[key];
      if (!group.items.length) return;
      anyRendered = true;

      const groupEl = document.createElement('div');
      groupEl.className = 'task-group';
      groupEl.innerHTML = `
        <div class="task-group-title ${group.cls}">
          <span class="dot"></span>
          <span>${group.title}</span>
          <span class="count">${group.items.length}</span>
        </div>
      `;
      const listEl = document.createElement('div');
      listEl.className = 'task-list';
      group.items.forEach((task) => listEl.appendChild(renderTaskCard(task)));
      groupEl.appendChild(listEl);
      taskGroupsEl.appendChild(groupEl);
    });

    if (!anyRendered) {
      const msg = document.createElement('div');
      msg.style.cssText = 'text-align:center;color:var(--text-2);padding:60px 0;font-size:13.5px;';
      msg.textContent = 'No homework matches your filters.';
      taskGroupsEl.appendChild(msg);
    }
  }

  function renderAll() {
    renderSubjects();
    renderStats();
    renderTasks();
  }

  // ---------- Task actions ----------
  function toggleComplete(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    persist();
    renderAll();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    persist();
    renderAll();
    toast('Homework deleted');
  }

  function clearCompleted() {
    const count = state.tasks.filter((t) => t.completed).length;
    if (!count) { toast('Nothing to clear'); return; }
    state.tasks = state.tasks.filter((t) => !t.completed);
    persist();
    renderAll();
    toast(`Cleared ${count} completed`);
  }

  // ---------- Modal: Task ----------
  function openNewModal() {
    editingTaskId = null;
    modalTitle.textContent = 'New Homework';
    taskIdInput.value = '';
    taskTitleInput.value = '';
    taskDueInput.value = '';
    taskNotesInput.value = '';
    populateSubjectSelect();
    if (activeSubjectId) taskSubjectSelect.value = activeSubjectId;
    setPriority('medium');
    taskModalOverlay.classList.add('visible');
    setTimeout(() => taskTitleInput.focus(), 50);
  }

  function openEditModal(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    editingTaskId = id;
    modalTitle.textContent = 'Edit Homework';
    taskIdInput.value = task.id;
    taskTitleInput.value = task.title;
    populateSubjectSelect();
    taskSubjectSelect.value = task.subjectId || '';
    taskDueInput.value = task.dueDate || '';
    taskNotesInput.value = task.notes || '';
    setPriority(task.priority);
    taskModalOverlay.classList.add('visible');
    setTimeout(() => taskTitleInput.focus(), 50);
  }

  function closeTaskModal() {
    taskModalOverlay.classList.remove('visible');
  }

  function setPriority(priority) {
    selectedPriority = priority;
    prioritySegment.querySelectorAll('.segment').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.priority === priority);
    });
  }

  function handleTaskSubmit(e) {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    if (!title) return;

    if (editingTaskId) {
      const task = state.tasks.find((t) => t.id === editingTaskId);
      task.title = title;
      task.subjectId = taskSubjectSelect.value || null;
      task.dueDate = taskDueInput.value || null;
      task.notes = taskNotesInput.value.trim();
      task.priority = selectedPriority;
      toast('Homework updated');
    } else {
      state.tasks.push({
        id: uid(),
        title,
        subjectId: taskSubjectSelect.value || null,
        dueDate: taskDueInput.value || null,
        notes: taskNotesInput.value.trim(),
        priority: selectedPriority,
        completed: false,
        createdAt: Date.now()
      });
      toast('Homework added');
    }

    persist();
    closeTaskModal();
    renderAll();
  }

  // ---------- Modal: Subject ----------
  function openSubjectModal() {
    subjectNameInput.value = '';
    selectedSubjectColor = SWATCH_COLORS[state.subjects.length % SWATCH_COLORS.length];
    renderColorSwatches();
    subjectModalOverlay.classList.add('visible');
    setTimeout(() => subjectNameInput.focus(), 50);
  }

  function closeSubjectModal() {
    subjectModalOverlay.classList.remove('visible');
  }

  function handleSubjectSubmit(e) {
    e.preventDefault();
    const name = subjectNameInput.value.trim();
    if (!name) return;
    state.subjects.push({ id: uid(), name, color: selectedSubjectColor });
    persist();
    closeSubjectModal();
    renderAll();
    toast('Subject added');
  }

  // ---------- Event wiring ----------
  function wireEvents() {
    el('newTaskBtn').addEventListener('click', openNewModal);
    el('emptyAddBtn').addEventListener('click', openNewModal);
    el('closeModalBtn').addEventListener('click', closeTaskModal);
    el('cancelTaskBtn').addEventListener('click', closeTaskModal);
    taskModalOverlay.addEventListener('click', (e) => { if (e.target === taskModalOverlay) closeTaskModal(); });
    taskForm.addEventListener('submit', handleTaskSubmit);

    prioritySegment.querySelectorAll('.segment').forEach((btn) => {
      btn.addEventListener('click', () => setPriority(btn.dataset.priority));
    });

    el('addSubjectBtn').addEventListener('click', openSubjectModal);
    el('closeSubjectModalBtn').addEventListener('click', closeSubjectModal);
    el('cancelSubjectBtn').addEventListener('click', closeSubjectModal);
    subjectModalOverlay.addEventListener('click', (e) => { if (e.target === subjectModalOverlay) closeSubjectModal(); });
    subjectForm.addEventListener('submit', handleSubjectSubmit);

    el('clearCompletedBtn').addEventListener('click', clearCompleted);

    filterBarEl.querySelectorAll('.filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        filterBarEl.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderTasks();
      });
    });

    searchInputEl.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderTasks();
    });

    sortSelectEl.addEventListener('change', (e) => {
      activeSort = e.target.value;
      renderTasks();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeTaskModal();
        closeSubjectModal();
      }
    });
  }

  // ---------- Init ----------
  async function init() {
    await loadState();
    wireEvents();
    renderAll();
  }

  init();
})();

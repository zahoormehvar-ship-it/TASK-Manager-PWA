import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, ChevronRight, ChevronDown, Check, Pencil, X, ListChecks, Calendar, Clock, Tag, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, PieChart, Pie } from 'recharts';

const STORAGE_KEY = 'personal-tasks-v4';

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function nowISO() {
  return new Date().toISOString();
}
function makeNode(title, dueDate = null, customChecklists = []) {
  return {
    id: uid(),
    title,
    done: false,
    createdAt: nowISO(),
    completedAt: null,
    dueDate: dueDate || null,
    checklists: customChecklists.map((label) => ({ id: uid(), label, done: false, completedAt: null })),
    children: [],
  };
}

function mapTree(nodes, id, fn) {
  return nodes.map((n) => {
    if (n.id === id) return fn(n);
    if (n.children && n.children.length) return { ...n, children: mapTree(n.children, id, fn) };
    return n;
  });
}
function removeFromTree(nodes, id) {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => (n.children && n.children.length ? { ...n, children: removeFromTree(n.children, id) } : n));
}
function addChildInTree(nodes, parentId, child) {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...(n.children || []), child] };
    if (n.children && n.children.length) return { ...n, children: addChildInTree(n.children, parentId, child) };
    return n;
  });
}
function flatten(nodes) {
  let out = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children && n.children.length) out = out.concat(flatten(n.children));
  }
  return out;
}
function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ProgressRing({ pct, size = 84 }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent-teal)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

function TaskNode({ node, depth, onToggle, onDelete, onAddChild, onRename, onToggleChecklist, onAddChecklist, onDeleteChecklist }) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [childVal, setChildVal] = useState('');
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(node.title);
  const [newChecklistTag, setNewChecklistTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);

  const hasChildren = node.children && node.children.length > 0;
  const doneChildren = hasChildren ? node.children.filter((c) => c.done).length : 0;

  const submitChild = () => {
    if (!childVal.trim()) return;
    onAddChild(node.id, childVal.trim());
    setChildVal('');
    setAdding(false);
    setOpen(true);
  };

  const submitEdit = () => {
    if (editVal.trim()) onRename(node.id, editVal.trim());
    else setEditVal(node.title);
    setEditing(false);
  };

  const submitTag = () => {
    if (newChecklistTag.trim()) {
      onAddChecklist(node.id, newChecklistTag.trim());
      setNewChecklistTag('');
    }
    setAddingTag(false);
  };

  const isOverdue = node.dueDate && new Date(node.dueDate) < new Date() && !node.done;

  return (
    <div className="node-wrapper">
      <div className="task-row" style={{ marginLeft: depth * 20 }}>
        <button onClick={() => setOpen((o) => !o)} className="icon-btn caret-btn" style={{ visibility: hasChildren ? 'visible' : 'hidden' }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <button onClick={() => onToggle(node.id)} className="checkbox" data-done={node.done}>
          {node.done && <Check size={12} color="#0F1116" strokeWidth={3} />}
        </button>

        <div className="task-content">
          <div className="task-title-bar">
            {editing ? (
              <input
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onBlur={submitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitEdit();
                  if (e.key === 'Escape') { setEditing(false); setEditVal(node.title); }
                }}
                className="edit-input"
              />
            ) : (
              <span onDoubleClick={() => setEditing(true)} className="task-title" data-done={node.done} title="Double-click to rename">
                {node.title}
              </span>
            )}
            {hasChildren && !editing && <span className="child-count">{doneChildren}/{node.children.length}</span>}
          </div>

          <div className="task-meta">
            <span className="meta-item"><Clock size={11} /> Created {formatDate(node.createdAt)}</span>
            {node.dueDate && (
              <span className={`meta-item due-tag ${isOverdue ? 'overdue' : ''}`}>
                <Calendar size={11} /> Due: {formatDate(node.dueDate)}
              </span>
            )}
          </div>

          <div className="checklist-container">
            {node.checklists?.map((item) => (
              <div key={item.id} className="checklist-chip" data-done={item.done} onClick={() => onToggleChecklist(node.id, item.id)}>
                <span className="chip-box">{item.done ? '✓' : '○'}</span>
                <span className="chip-label">{item.label}</span>
                <button className="chip-del" onClick={(e) => { e.stopPropagation(); onDeleteChecklist(node.id, item.id); }}>×</button>
              </div>
            ))}
            {addingTag ? (
              <div className="add-tag-input-wrap">
                <input
                  autoFocus
                  className="tag-input"
                  placeholder="Tag (e.g. Notes)"
                  value={newChecklistTag}
                  onChange={(e) => setNewChecklistTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitTag(); if (e.key === 'Escape') setAddingTag(false); }}
                  onBlur={submitTag}
                />
              </div>
            ) : (
              <button className="add-tag-btn" onClick={() => setAddingTag(true)}><Tag size={10} /> + Checkbox</button>
            )}
          </div>
        </div>

        <div className="row-actions">
          <button onClick={() => setAdding((a) => !a)} title="Add subtask" className="icon-btn"><Plus size={14} /></button>
          <button onClick={() => setEditing(true)} title="Rename" className="icon-btn"><Pencil size={12} /></button>
          <button onClick={() => onDelete(node.id)} title="Delete" className="icon-btn danger"><Trash2 size={13} /></button>
        </div>
      </div>

      {adding && (
        <div className="add-row" style={{ marginLeft: (depth + 1) * 20 + 20 }}>
          <input
            autoFocus
            value={childVal}
            onChange={(e) => setChildVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitChild(); if (e.key === 'Escape') { setAdding(false); setChildVal(''); } }}
            placeholder="Subtask title (e.g. Organic Chemistry)…"
            className="add-input"
          />
          <button onClick={submitChild} className="add-confirm">Add</button>
          <button onClick={() => { setAdding(false); setChildVal(''); }} className="icon-btn"><X size={14} /></button>
        </div>
      )}

      {hasChildren && open && (
        <div>
          {node.children.map((c) => (
            <TaskNode
              key={c.id}
              node={c}
              depth={depth + 1}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onRename={onRename}
              onToggleChecklist={onToggleChecklist}
              onAddChecklist={onAddChecklist}
              onDeleteChecklist={onDeleteChecklist}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newTagsStr, setNewTagsStr] = useState('');
  const [reportView, setReportView] = useState('weekly');
  const [syncState, setSyncState] = useState('idle');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTasks(JSON.parse(saved));
    } catch (e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSyncState('saving');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      setSyncState('idle');
    } catch (e) {
      setSyncState('error');
    }
  }, [tasks, loaded]);

  const addRootTask = () => {
    if (!newTitle.trim()) return;
    const initialTags = newTagsStr.split(',').map((s) => s.trim()).filter(Boolean);
    const newNode = makeNode(newTitle.trim(), newDueDate || null, initialTags);
    setTasks((t) => [...t, newNode]);
    setNewTitle('');
    setNewDueDate('');
    setNewTagsStr('');
  };

  const toggle = useCallback((id) => {
    setTasks((t) => mapTree(t, id, (n) => ({ ...n, done: !n.done, completedAt: !n.done ? nowISO() : null })));
  }, []);
  const del = useCallback((id) => setTasks((t) => removeFromTree(t, id)), []);
  const addChild = useCallback((parentId, title) => setTasks((t) => addChildInTree(t, parentId, makeNode(title))), []);
  const rename = useCallback((id, title) => setTasks((t) => mapTree(t, id, (n) => ({ ...n, title }))), []);

  const toggleChecklist = useCallback((taskId, checklistId) => {
    setTasks((t) =>
      mapTree(t, taskId, (n) => ({
        ...n,
        checklists: n.checklists.map((c) =>
          c.id === checklistId ? { ...c, done: !c.done, completedAt: !c.done ? nowISO() : null } : c
        ),
      }))
    );
  }, []);

  const addChecklist = useCallback((taskId, label) => {
    setTasks((t) => mapTree(t, taskId, (n) => ({ ...n, checklists: [...(n.checklists || []), { id: uid(), label, done: false, completedAt: null }] })));
  }, []);
  const deleteChecklist = useCallback((taskId, checklistId) => {
    setTasks((t) => mapTree(t, taskId, (n) => ({ ...n, checklists: n.checklists.filter((c) => c.id !== checklistId) })));
  }, []);

  const flat = useMemo(() => flatten(tasks), [tasks]);
  const totalCount = flat.length;
  const doneCount = flat.filter((n) => n.done).length;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  // Gather all completion events (from subtasks AND custom checkboxes)
  const completedEvents = useMemo(() => {
    const events = [];
    flat.forEach((node) => {
      if (node.done && node.completedAt) events.push(node.completedAt);
      node.checklists?.forEach((chk) => {
        if (chk.done && chk.completedAt) events.push(chk.completedAt);
      });
    });
    return events;
  }, [flat]);

    // Daily Activity Status Bar (Sun - Sat) - Requires 2+ completions for a pass
  const autoWeeklyDays = useMemo(() => {
    const now = new Date();
    const curr = new Date(now);
    const firstDayOfWeek = curr.getDate() - curr.getDay(); // Sunday

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((dayName, idx) => {
      const d = new Date(now);
      d.setDate(firstDayOfWeek + idx);
      const dateStr = d.toDateString();

      // Total items (subtasks or checkboxes) completed on this specific day
      const completionsOnDay = completedEvents.filter(
        (iso) => new Date(iso).toDateString() === dateStr
      ).length;

      const isToday = d.toDateString() === now.toDateString();
      const isPast = d < now && !isToday;

      let status = 'pending';
      // UPDATED THRESHOLD: Require at least 2 completions for 'pass'
      if (completionsOnDay >= 2) {
        status = 'pass';
      } else if (isPast) {
        status = 'fail'; // Past days with 0 or 1 completions will mark as failed
      } else if (isToday && completionsOnDay < 2) {
        status = 'pending'; // Today stays pending until 2 completions are hit
      }

      return { label: dayName, status, completionsOnDay, isToday };
    });
  }, [completedEvents]);

  return (
    <div className="wrap">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .wrap { --bg: #12151b; --surface: #1a1e26; --surface-2: #212631; --border: #2b303c; --text: #e9e7e0; --text-dim: #8b8f9c; --accent-teal: #4fd8c4; --accent-amber: #f2a65a; --accent-rose: #e8637a; background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; border-radius: 16px; padding: 28px; min-height: 100vh; box-sizing: border-box; }
        .wrap * { box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand-mark { width: 34px; height: 34px; border-radius: 9px; background: var(--accent-teal); display: flex; align-items: center; justify-content: center; color: #0f1116; }
        .brand h1 { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
        .brand p { margin: 0; font-size: 12.5px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }
        .sync-pill { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-dim); padding: 5px 10px; border: 1px solid var(--border); border-radius: 20px; display: flex; align-items: center; gap: 6px; }
        .sync-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-teal); }
        .auto-weekly-bar { display: flex; gap: 8px; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); padding: 12px; border-radius: 12px; margin-bottom: 20px; }
        .auto-day-card { flex: 1; text-align: center; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .auto-day-label { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--text-dim); }
        .auto-day-badge { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 1px solid var(--border); }
        .auto-day-badge[data-status="pass"] { background: rgba(79, 216, 196, 0.2); color: var(--accent-teal); border-color: var(--accent-teal); }
        .auto-day-badge[data-status="fail"] { background: rgba(232, 99, 122, 0.2); color: var(--accent-rose); border-color: var(--accent-rose); }
        .auto-day-badge[data-status="pending"] { background: rgba(242, 166, 90, 0.1); color: var(--text-dim); border-color: var(--border); }
        .daily-count-label { font-size: 10px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }
        .grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
        .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .panel-title { font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); margin: 0; }
        .add-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; background: var(--surface-2); padding: 12px; border-radius: 10px; border: 1px solid var(--border); }
        .add-input-main { background: transparent; border: none; color: var(--text); font-size: 14px; font-family: 'Inter', sans-serif; outline: none; width: 100%; }
        .add-form-options { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .add-form-options input { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; color: var(--text); font-size: 12px; outline: none; font-family: 'Inter', sans-serif; }
        .add-form-options input[type="datetime-local"] { color-scheme: dark; }
        .add-form button { background: var(--accent-teal); color: #0f1116; border: none; border-radius: 6px; padding: 6px 14px; font-weight: 600; font-size: 12.5px; cursor: pointer; margin-left: auto; display: flex; align-items: center; gap: 4px; }
        .node-wrapper { margin-bottom: 4px; }
        .task-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px; border-radius: 8px; }
        .task-row:hover { background: var(--surface-2); }
        .task-row:hover .row-actions { opacity: 1; }
        .task-content { flex: 1; min-width: 0; }
        .task-title-bar { display: flex; align-items: center; gap: 6px; }
        .icon-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 3px; display: flex; align-items: center; border-radius: 5px; flex-shrink: 0; }
        .icon-btn:hover { color: var(--accent-teal); background: var(--border); }
        .icon-btn.danger:hover { color: var(--accent-rose); }
        .caret-btn { margin-top: 2px; }
        .checkbox { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--border); background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; transition: all 0.15s ease; }
        .checkbox[data-done="true"] { background: var(--accent-teal); border-color: var(--accent-teal); }
        .task-title { font-size: 14px; cursor: text; user-select: none; color: var(--text); word-break: break-word; }
        .task-title[data-done="true"] { color: var(--text-dim); text-decoration: line-through; }
        .task-meta { display: flex; gap: 12px; margin-top: 4px; font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }
        .meta-item { display: flex; align-items: center; gap: 4px; }
        .due-tag.overdue { color: var(--accent-rose); font-weight: 600; }
        .checklist-container { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .checklist-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--surface-2); border: 1px solid var(--border); padding: 2px 7px; border-radius: 12px; font-size: 11px; cursor: pointer; }
        .checklist-chip[data-done="true"] { background: rgba(79, 216, 196, 0.1); border-color: var(--accent-teal); color: var(--accent-teal); }
        .chip-del { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 12px; padding: 0 0 0 4px; }
        .add-tag-btn { background: transparent; border: 1px dashed var(--border); color: var(--text-dim); padding: 2px 7px; border-radius: 12px; font-size: 10.5px; cursor: pointer; display: flex; align-items: center; gap: 3px; }
        .tag-input { background: var(--surface-2); border: 1px solid var(--accent-teal); color: var(--text); border-radius: 12px; padding: 2px 8px; font-size: 11px; outline: none; width: 110px; }
        .child-count { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--text-dim); background: var(--surface-2); padding: 1px 6px; border-radius: 10px; }
        .row-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s ease; }
        .edit-input { flex: 1; background: transparent; border: none; border-bottom: 1px solid var(--accent-teal); color: var(--text); font-size: 14px; outline: none; }
        .add-row { display: flex; gap: 6px; padding: 5px 8px 9px; align-items: center; }
        .add-input { flex: 1; background: var(--surface-2); border: 1px solid var(--border); border-radius: 7px; padding: 6px 10px; color: var(--text); font-size: 13px; outline: none; }
        .add-confirm { background: none; border: none; color: var(--accent-teal); font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .empty-state { text-align: center; padding: 40px 20px; color: var(--text-dim); }
        .stats-row { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; }
        .stats-numbers { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .stat-line { display: flex; justify-content: space-between; font-size: 12.5px; }
        .stat-line span:first-child { color: var(--text-dim); }
        .stat-line span:last-child { font-family: 'JetBrains Mono', monospace; color: var(--text); font-weight: 500; }
        .range-toggle { display: flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; padding: 2px; }
        .range-btn { background: none; border: none; color: var(--text-dim); font-size: 11px; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-family: 'JetBrains Mono', monospace; }
        .range-btn[data-active="true"] { background: var(--border); color: var(--accent-teal); font-weight: 600; }
      `}</style>

      <div className="header">
        <div className="brand">
          <div className="brand-mark"><ListChecks size={18} /></div>
          <div>
            <h1>Tasks & Analytics</h1>
            <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        <div className="sync-pill">
          <span className="sync-dot" />
          {syncState === 'saving' ? 'Saving…' : 'Saved'}
        </div>
      </div>

      {/* Daily Activity Tracker Bar (Sun - Sat) */}
      <div className="auto-weekly-bar">
        {autoWeeklyDays.map((d, i) => (
          <div key={i} className="auto-day-card">
            <span className="auto-day-label">{d.label}</span>
            <div className="auto-day-badge" data-status={d.status} title={`${d.completionsOnDay} item(s) completed on ${d.label}`}>
              {d.status === 'pass' ? '✓' : d.status === 'fail' ? '✕' : '○'}
            </div>
            <span className="daily-count-label">{d.completionsOnDay} done</span>
          </div>
        ))}
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-header"><p className="panel-title">Tasks & Curriculum</p></div>
          <div className="add-form">
            <input
              className="add-input-main"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRootTask()}
              placeholder="Add Subject (e.g. Chemistry)…"
            />
            <div className="add-form-options">
              <input type="datetime-local" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} title="Due Date & Time" />
              <input type="text" placeholder="Checkboxes (e.g. Notes, Exam 1, Exam 2)" value={newTagsStr} onChange={(e) => setNewTagsStr(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
              <button onClick={addRootTask}><Plus size={14} /> Add Task</button>
            </div>
          </div>

          {!loaded ? (
            <div className="empty-state"><p>Loading…</p></div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <ListChecks size={26} color="var(--text-dim)" />
              <p>No tasks created yet.</p>
            </div>
          ) : (
            <div>
              {tasks.map((t) => (
                <TaskNode
                  key={t.id}
                  node={t}
                  depth={0}
                  onToggle={toggle}
                  onDelete={del}
                  onAddChild={addChild}
                  onRename={rename}
                  onToggleChecklist={toggleChecklist}
                  onAddChecklist={addChecklist}
                  onDeleteChecklist={deleteChecklist}
                />
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <p className="panel-title">Graphical Reports</p>
            <div className="range-toggle">
              <button className="range-btn" data-active={reportView === 'weekly'} onClick={() => setReportView('weekly')}>Weekly</button>
              <button className="range-btn" data-active={reportView === 'monthly'} onClick={() => setReportView('monthly')}>Monthly Activity</button>
            </div>
          </div>

          <div className="stats-row">
            <ProgressRing pct={pct} />
            <div className="stats-numbers">
              <div className="stat-line"><span>Total tasks</span><span>{totalCount}</span></div>
              <div className="stat-line"><span>Completed tasks</span><span>{doneCount}</span></div>
              <div className="stat-line"><span>Overall Completion</span><span>{pct}%</span></div>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            {reportView === 'weekly' ? (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={weeklyPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={4}>
                    {weeklyPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthlyBarData} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval={0} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v} completed items`]} />
                  <Bar dataKey="count" fill="var(--accent-teal)" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


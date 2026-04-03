import React, { useState, useMemo } from 'react';
import { Plus, Check, Edit, Trash2, Clock, RefreshCw, AlertTriangle, ArrowRight, X } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';

const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

const PRIORITY_BAR = { high: '#ef4444', medium: '#f59e0b', low: '#94a3b8' };

const EMPTY_TASK = (user, isAdmin) => ({
    description: '',
    roomNumber: '',
    priority: 'medium',
    hostelId: isAdmin ? 'hostel1' : user.hostelId,
    assignedTo: '',
    deadline: '',
    recurringType: 'none',
});

const TaskManager = ({ tasks, users, currentUser, onAddTask, onCompleteTask, onUpdateTask, onDeleteTask, lang, selectedHostelFilter }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';

    const availableCashiers = useMemo(() => {
        const targetHostel = isAdmin ? selectedHostelFilter : currentUser.hostelId;
        return users.filter(u => u.role === 'cashier' && (u.hostelId === targetHostel || u.hostelId === 'all'));
    }, [users, selectedHostelFilter, currentUser, isAdmin]);

    const [showAdd, setShowAdd] = useState(false);
    const [newTask, setNewTask] = useState(() => EMPTY_TASK(currentUser, isAdmin));
    const [editingTask, setEditingTask] = useState(null);

    const sorted = useMemo(() => [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [tasks]);
    const newTasks      = useMemo(() => sorted.filter(t => !t.status || t.status === 'pending'),    [sorted]);
    const progressTasks = useMemo(() => sorted.filter(t => t.status === 'inprogress'),              [sorted]);
    const doneTasks     = useMemo(() => sorted.filter(t => t.status === 'done'),                    [sorted]);

    const getPriorityLabel = (p) => ({ low: t('low'), medium: t('medium'), high: t('high') }[p] ?? p);

    const getDeadlineChip = (task) => {
        if (!task.deadline || task.status === 'done') return null;
        const deadlineMs = new Date(task.deadline).setHours(23, 59, 59, 999);
        const nowMs = Date.now();
        const isOverdue = deadlineMs < nowMs;
        const diffDays = Math.ceil((deadlineMs - nowMs) / 86400000);
        const date = new Date(task.deadline).toLocaleDateString('ru');
        return { isOverdue, diffDays, label: isOverdue ? `Просрочено ${date}` : `До ${date}` };
    };

    const handleSubmit = () => {
        if (!newTask.description.trim()) return;
        onAddTask({
            ...newTask,
            status: 'pending',
            createdBy: currentUser.name,
            createdAt: new Date().toISOString(),
            hostelId: isAdmin ? newTask.hostelId : currentUser.hostelId,
        });
        setNewTask(EMPTY_TASK(currentUser, isAdmin));
        setShowAdd(false);
    };

    const handleUpdate = () => {
        if (!editingTask) return;
        onUpdateTask(editingTask.id, {
            description: editingTask.description,
            roomNumber: editingTask.roomNumber,
            priority: editingTask.priority,
            assignedTo: editingTask.assignedTo,
            deadline: editingTask.deadline || '',
            recurringType: editingTask.recurringType || 'none',
        });
        setEditingTask(null);
    };

    /* ── Task Card ── */
    const TaskCard = ({ task }) => {
        const assignedUser = task.assignedTo ? users.find(u => u.id === task.assignedTo) : null;
        const dl = getDeadlineChip(task);
        const isDone = task.status === 'done';
        const isProgress = task.status === 'inprogress';

        return (
            <div className={`relative bg-white border border-slate-200 rounded-xl p-4 mb-2.5 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${isDone ? 'opacity-60' : ''}`}>
                {/* priority bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: PRIORITY_BAR[task.priority] ?? PRIORITY_BAR.low }} />
                <div className="pl-3">
                    {/* top row */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                            task.priority === 'high'   ? 'bg-rose-100 text-rose-600' :
                            task.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                         'bg-slate-100 text-slate-500'
                        }`}>{getPriorityLabel(task.priority)}</span>
                        {task.roomNumber && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">🏠 №{task.roomNumber}</span>
                        )}
                    </div>

                    {/* description */}
                    <p className={`text-sm font-semibold leading-snug mb-2.5 ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {task.description}
                    </p>

                    {/* chips */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {dl && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                dl.isOverdue   ? 'bg-rose-100 text-rose-600' :
                                dl.diffDays <= 1 ? 'bg-amber-100 text-amber-700' :
                                                 'bg-slate-100 text-slate-500'
                            }`}>
                                {dl.isOverdue ? <AlertTriangle size={9}/> : <Clock size={9}/>}
                                {dl.label}
                            </span>
                        )}
                        {task.recurringType && task.recurringType !== 'none' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                                <RefreshCw size={9}/>
                                {task.recurringType === 'daily' ? 'Ежедневно' : 'Еженедельно'}
                            </span>
                        )}
                        {assignedUser && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                                👤 {assignedUser.name}
                            </span>
                        )}
                    </div>

                    {/* actions */}
                    {!isDone && (
                        <div className="flex items-center gap-1.5">
                            {!isProgress ? (
                                <button
                                    onClick={() => onUpdateTask(task.id, { status: 'inprogress' })}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
                                >
                                    <ArrowRight size={11}/> В работу
                                </button>
                            ) : (
                                <button
                                    onClick={() => onCompleteTask(task.id)}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                >
                                    <Check size={11}/> Готово
                                </button>
                            )}
                            {isAdmin && (
                                <>
                                    <button onClick={() => setEditingTask(task)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors">
                                        <Edit size={13}/>
                                    </button>
                                    <button onClick={() => onDeleteTask(task.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors">
                                        <Trash2 size={13}/>
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                    {isDone && isAdmin && (
                        <div className="flex justify-end">
                            <button onClick={() => onDeleteTask(task.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors">
                                <Trash2 size={13}/>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    /* ── Column ── */
    const Column = ({ title, dot, count, bgClass, borderClass, countClass, children, addable }) => (
        <div className={`${bgClass} ${borderClass} border rounded-2xl p-4`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full block ${dot}`}/>
                    <span className="text-sm font-black text-slate-700">{title}</span>
                </div>
                <span className={`text-[11px] font-black rounded-full px-2.5 py-0.5 ${countClass}`}>{count}</span>
            </div>
            {children}
            {addable && (
                <button
                    onClick={() => setShowAdd(true)}
                    className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all"
                >
                    + {t('addTask')}
                </button>
            )}
        </div>
    );

    /* ── Form fields (reused in add + edit modals) ── */
    const TaskFormFields = ({ data, setData }) => (
        <div className="space-y-3">
            <div>
                <label className={labelClass}>{t('description')} *</label>
                <input className={inputClass} value={data.description} onChange={e => setData({...data, description: e.target.value})} placeholder="Что нужно сделать?" autoFocus/>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelClass}>{t('priority')}</label>
                    <select className={inputClass} value={data.priority} onChange={e => setData({...data, priority: e.target.value})}>
                        <option value="high">{t('high')}</option>
                        <option value="medium">{t('medium')}</option>
                        <option value="low">{t('low')}</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>{t('room')}</label>
                    <input className={inputClass} value={data.roomNumber} onChange={e => setData({...data, roomNumber: e.target.value})} placeholder="№"/>
                </div>
                <div>
                    <label className={labelClass}>Дедлайн</label>
                    <input type="date" className={inputClass} value={data.deadline || ''} onChange={e => setData({...data, deadline: e.target.value})}/>
                </div>
                <div>
                    <label className={labelClass}>Повторение</label>
                    <select className={inputClass} value={data.recurringType || 'none'} onChange={e => setData({...data, recurringType: e.target.value})}>
                        <option value="none">Нет</option>
                        <option value="daily">Ежедневно</option>
                        <option value="weekly">Еженедельно</option>
                    </select>
                </div>
            </div>
            {isAdmin && (
                <div>
                    <label className={labelClass}>{t('assignTo')}</label>
                    <select className={inputClass} value={data.assignedTo || ''} onChange={e => setData({...data, assignedTo: e.target.value})}>
                        <option value="">{t('allCashiers')}</option>
                        {availableCashiers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>
            )}
        </div>
    );

    const ModalShell = ({ title, onClose, children }) => (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-black text-lg">{title}</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                        <X size={16}/>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );

    return (
        <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4 flex-wrap">
                    <h2 className="text-xl font-black text-slate-800">{t('tasks')}</h2>
                    <div className="flex gap-2">
                        {[
                            { n: newTasks.length,      label: 'Новые',   color: 'text-indigo-600' },
                            { n: progressTasks.length, label: 'В работе', color: 'text-amber-600' },
                            { n: doneTasks.length,     label: 'Готово',   color: 'text-emerald-600' },
                        ].map(({ n, label, color }) => (
                            <div key={label} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-center shadow-sm">
                                <div className={`text-lg font-black ${color}`}>{n}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <Button onClick={() => setShowAdd(true)} icon={Plus}>{t('addTask')}</Button>
            </div>

            {/* Kanban board */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Column
                    title="Новые" dot="bg-indigo-500" count={newTasks.length}
                    bgClass="bg-slate-50" borderClass="border-slate-200"
                    countClass="bg-slate-200 text-slate-600"
                    addable
                >
                    {newTasks.map(task => <TaskCard key={task.id} task={task}/>)}
                </Column>

                <Column
                    title="В работе" dot="bg-amber-500" count={progressTasks.length}
                    bgClass="bg-amber-50/50" borderClass="border-amber-200"
                    countClass="bg-amber-200 text-amber-700"
                >
                    {progressTasks.length === 0
                        ? <p className="text-center py-6 text-slate-300 text-xs font-bold">Нет задач в работе</p>
                        : progressTasks.map(task => <TaskCard key={task.id} task={task}/>)
                    }
                </Column>

                <Column
                    title="Готово" dot="bg-emerald-500" count={doneTasks.length}
                    bgClass="bg-emerald-50/50" borderClass="border-emerald-200"
                    countClass="bg-emerald-200 text-emerald-700"
                >
                    {doneTasks.length === 0
                        ? <p className="text-center py-6 text-slate-300 text-xs font-bold">Нет выполненных задач</p>
                        : doneTasks.map(task => <TaskCard key={task.id} task={task}/>)
                    }
                </Column>
            </div>

            {/* Add modal */}
            {showAdd && (
                <ModalShell title={t('addTask')} onClose={() => setShowAdd(false)}>
                    <TaskFormFields data={newTask} setData={setNewTask}/>
                    <div className="flex gap-3 mt-5">
                        <Button onClick={handleSubmit} icon={Plus} className="flex-1 justify-center">{t('save')}</Button>
                        <Button variant="secondary" onClick={() => setShowAdd(false)}>{t('cancel')}</Button>
                    </div>
                </ModalShell>
            )}

            {/* Edit modal */}
            {editingTask && (
                <ModalShell title={t('edit')} onClose={() => setEditingTask(null)}>
                    <TaskFormFields data={editingTask} setData={setEditingTask}/>
                    <div className="flex gap-3 mt-5">
                        <Button onClick={handleUpdate} className="flex-1 justify-center">{t('save')}</Button>
                        <Button variant="secondary" onClick={() => setEditingTask(null)}>{t('cancel')}</Button>
                    </div>
                </ModalShell>
            )}
        </div>
    );
};

export default TaskManager;

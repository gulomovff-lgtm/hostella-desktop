import React, { useState, useMemo } from 'react';
import { Plus, Check, Edit, Trash2 } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';

const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

const TaskManager = ({ tasks, users, currentUser, onAddTask, onCompleteTask, onUpdateTask, onDeleteTask, lang, selectedHostelFilter }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    
    const availableCashiers = useMemo(() => {
        const targetHostel = currentUser.role === 'admin' || currentUser.role === 'super' ? selectedHostelFilter : currentUser.hostelId;
        return users.filter(u => 
            u.role === 'cashier' && (u.hostelId === targetHostel || u.hostelId === 'all')
        );
    }, [users, selectedHostelFilter, currentUser]);
    
    const [newTask, setNewTask] = useState({ 
        description: '', 
        roomNumber: '', 
        priority: 'medium', 
        hostelId: currentUser.role === 'admin' || currentUser.role === 'super' ? 'hostel1' : currentUser.hostelId,
        assignedTo: ''
    });
    const [editingTask, setEditingTask] = useState(null);
    const filteredTasks = tasks.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    
    const getPriorityLabel = (p) => {
        if(p === 'low' || p === 'Низкий') return t('low');
        if(p === 'medium' || p === 'Средний') return t('medium');
        if(p === 'high' || p === 'Высокий') return t('high');
        return p;
    };
    
    const handleSubmit = () => {
        if (!newTask.description) return;
        onAddTask({
            ...newTask,
            status: 'pending',
            createdBy: currentUser.name,
            createdAt: new Date().toISOString(),
            hostelId: isAdmin ? newTask.hostelId : currentUser.hostelId
        });
        setNewTask({ 
            description: '', 
            roomNumber: '', 
            priority: 'medium', 
            hostelId: isAdmin ? 'hostel1' : currentUser.hostelId,
            assignedTo: ''
        });
    };
    
    const handleUpdate = () => {
        if(!editingTask) return;
        onUpdateTask(editingTask.id, { 
            description: editingTask.description, 
            roomNumber: editingTask.roomNumber, 
            priority: editingTask.priority,
            assignedTo: editingTask.assignedTo
        });
        setEditingTask(null);
    };
    
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg mb-4">{t('addTask')}</h3>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full"><label className={labelClass}>{t('description')}</label><input className={inputClass} value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} placeholder="..." /></div>
                    <div className="w-full md:w-32"><label className={labelClass}>{t('room')}</label><input className={inputClass} value={newTask.roomNumber} onChange={e => setNewTask({...newTask, roomNumber: e.target.value})} placeholder="№" /></div>
                    <div className="w-full md:w-40"><label className={labelClass}>{t('priority')}</label><select className={inputClass} value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}><option value="low">{t('low')}</option><option value="medium">{t('medium')}</option><option value="high">{t('high')}</option></select></div>
                    {isAdmin && (
                        <div className="w-full md:w-48">
                            <label className={labelClass}>{t('assignTo')}</label>
                            <select 
                                className={inputClass} 
                                value={newTask.assignedTo} 
                                onChange={e => setNewTask({...newTask, assignedTo: e.target.value})}
                            >
                                <option value="">{t('allCashiers')}</option>
                                {availableCashiers.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <Button onClick={handleSubmit} icon={Plus}>{t('save')}</Button>
                </div>
            </div>
            {editingTask && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
                        <h3 className="font-bold text-lg mb-4">{t('edit')}</h3>
                        <div className="space-y-3">
                            <input className={inputClass} value={editingTask.description} onChange={e => setEditingTask({...editingTask, description: e.target.value})} />
                            <div className="flex gap-2">
                                <input className={inputClass} value={editingTask.roomNumber} onChange={e => setEditingTask({...editingTask, roomNumber: e.target.value})} placeholder="Room" />
                                <select className={inputClass} value={editingTask.priority} onChange={e => setEditingTask({...editingTask, priority: e.target.value})}><option value="low">{t('low')}</option><option value="medium">{t('medium')}</option><option value="high">{t('high')}</option></select>
                            </div>
                            {isAdmin && (
                                <div>
                                    <label className={labelClass}>{t('assignTo')}</label>
                                    <select 
                                        className={inputClass} 
                                        value={editingTask.assignedTo || ''} 
                                        onChange={e => setEditingTask({...editingTask, assignedTo: e.target.value})}
                                    >
                                        <option value="">{t('allCashiers')}</option>
                                        {availableCashiers.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <Button onClick={handleUpdate} className="w-full">{t('save')}</Button>
                            <Button variant="secondary" onClick={() => setEditingTask(null)} className="w-full">{t('cancel')}</Button>
                        </div>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTasks.map(task => {
                    const assignedUser = task.assignedTo ? users.find(u => u.id === task.assignedTo) : null;
                    return (
                        <div key={task.id} className={`p-4 rounded-xl border flex flex-col justify-between ${task.status === 'done' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-indigo-100 shadow-sm'}`}>
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${task.priority === 'high' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>{getPriorityLabel(task.priority)}</span>
                                    {task.roomNumber && <span className="text-xs font-bold text-slate-600">{t('room')} {task.roomNumber}</span>}
                                </div>
                                <p className={`font-medium ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.description}</p>
                                <div className="text-[10px] text-slate-400 mt-2">
                                    {t('createdBy')}: {task.createdBy} • {new Date(task.createdAt).toLocaleDateString()}
                                    {assignedUser && <div className="mt-1 text-indigo-600">&gt; {assignedUser.name}</div>}
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                {task.status !== 'done' ? (
                                    <Button size="sm" variant="success" onClick={() => onCompleteTask(task.id)} icon={Check}>{t('done')}</Button>
                                ) : <span></span>}
                                {isAdmin && (
                                    <div className="flex gap-1">
                                        <button onClick={() => setEditingTask(task)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                                        <button onClick={() => onDeleteTask(task.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"><Trash2 size={16}/></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TaskManager;

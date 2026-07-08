import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
    LayoutDashboard, BedDouble, Calendar, FileText, AlertCircle,
    CheckSquare, Wallet, Users, UserCog, Clock, Lock, LogOut,
    UserPlus, Power, Globe, BellRing, Tag, ClipboardList,
    Settings, Users2, Building2, ClipboardCheck, BarChart3, Monitor, History, Home,
    Eye, EyeOff, GripVertical, PanelLeft, PanelRight, PanelTop, PanelBottom,
    SlidersHorizontal, RotateCcw, FolderOpen, Folder, ChevronDown, ChevronRight,
    FolderPlus, FolderMinus, Pencil, Check, ShieldCheck,
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { DEFAULT_FOLDERS, DEFAULT_CASHIER_FOLDERS, DEFAULT_CASHIER_ORDER } from '../../hooks/useNavPrefs';

// ─── Flat items list ──────────────────────────────────────────────────────────
const ALL_NAV_ITEMS = (t, pendingBookingsCount, pendingTasksCount, registrationsAlertCount) => [
    { id: 'dashboard',      icon: LayoutDashboard, label: t('dashboard'),       adminOnly: true, permKey: 'viewStats'    },
    { id: 'rooms',          icon: BedDouble,        label: t('rooms')                                                    },
    { id: 'calendar',       icon: Calendar,          label: t('calendar')                                                 },
    { id: 'debts',          icon: AlertCircle,       label: t('debts'),          permKey: 'viewDebts'                    },
    { id: 'clients',        icon: Users,             label: t('clients'),        permKey: 'viewClients'                  },
    { id: 'bookings',       icon: Globe,             label: t('bookings2'),      badge: pendingBookingsCount, glow: (pendingBookingsCount || 0) > 0, permKey: 'viewBookings' },
    { id: 'registrations',  icon: ClipboardCheck,    label: t('emehmon'),        badge: registrationsAlertCount, glow: (registrationsAlertCount || 0) > 0, permKey: 'viewRegistrations' },
    { id: 'cadastre',       icon: Home,              label: 'Кадастр',           permKey: 'viewCadastre'                 },
    { id: 'tasks',          icon: CheckSquare,       label: t('tasks'),          badge: pendingTasksCount, permKey: 'viewTasks' },
    { id: 'reports',        icon: FileText,          label: t('reports'),        adminOnly: true, permKey: 'viewReports' },
    { id: 'expenses',       icon: Wallet,            label: t('expenses'),       adminOnly: true, permKey: 'viewExpenses'},
    { id: 'analytics',      icon: BarChart3,         label: t('analytics'),      adminOnly: true                        },
    { id: 'guesthistory',   icon: History,           label: 'История гостей',    adminOnly: true                        },
    { id: 'manualstay',     icon: Users,             label: 'Ручной учёт',       permKey: 'viewManualStay'               },
    { id: 'staff',          icon: UserCog,           label: t('staff'),          adminOnly: true                        },
    { id: 'pricePerms',     icon: ShieldCheck,       label: 'Понижение цены',    adminOnly: true                        },
    { id: 'shifts',         icon: Clock,             label: t('shifts'),         adminOnly: true                        },
    { id: 'telegram',       icon: BellRing,          label: t('telegram2'),      adminOnly: true                        },
    { id: 'promos',         icon: Tag,               label: t('promos2'),        adminOnly: true                        },
    { id: 'referrals',      icon: Users2,            label: t('bonuses'),        permKey: 'viewReferrals'                },
    { id: 'hostelconfig',   icon: Settings,          label: t('hostelSettings'), adminOnly: true                        },
    { id: 'auditlog',       icon: ClipboardList,     label: t('auditHistory'),   superOnly: true                        },
    { id: 'sessions',       icon: Monitor,           label: t('sessions2'),      superOnly: true                        },
    { id: 'versions',       icon: ClipboardCheck,    label: 'Версии клиентов',   adminOnly: true                        },
];

const APP_THEMES = [
    { id: 'green', emoji: '🌿', label: 'Светлая' },
    { id: 'dark',  emoji: '🌙', label: 'Тёмная'  },
];

const POSITIONS = [
    { id: 'left',   Icon: PanelLeft,   label: 'Слева'  },
    { id: 'right',  Icon: PanelRight,  label: 'Справа' },
    { id: 'top',    Icon: PanelTop,    label: 'Сверху' },
    { id: 'bottom', Icon: PanelBottom, label: 'Снизу'  },
];

const FOLDER_ICONS = [
    { id: 'folder',    Icon: Folder        },
    { id: 'beds',      Icon: BedDouble     },
    { id: 'wallet',    Icon: Wallet        },
    { id: 'users',     Icon: Users         },
    { id: 'calendar',  Icon: Calendar      },
    { id: 'reports',   Icon: FileText      },
    { id: 'settings',  Icon: Settings      },
    { id: 'clock',     Icon: Clock         },
    { id: 'bell',      Icon: BellRing      },
    { id: 'tag',       Icon: Tag           },
    { id: 'home',      Icon: Home          },
    { id: 'clipboard', Icon: ClipboardList },
    { id: 'usercog',   Icon: UserCog       },
    { id: 'chart',     Icon: BarChart3     },
    { id: 'tasks',     Icon: CheckSquare   },
    { id: 'globe',     Icon: Globe         },
];

const Grip = () => (
    <GripVertical size={14} style={{ color: 'rgba(158,205,208,0.35)', flexShrink: 0 }}/>
);

// ─── Component ────────────────────────────────────────────────────────────────
const Navigation = ({
    currentUser, activeTab, setActiveTab, pendingTasksCount, pendingBookingsCount, lang,
    canPerformActions, onOpenExpense, onOpenCheckIn, onOpenShift,
    onOpenGroupCheckIn, onOpenRoomRental, onOpenGroupReceipt,
    onLogout, setLang, onOpenChangePassword,
    registrationsAlertCount = 0,
    appTheme = 'green', setAppTheme,
    navPrefs, onNavPrefs,
}) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    const isSuper = currentUser.role === 'super';

    const position = navPrefs?.position ?? 'left';
    const isHoriz  = position === 'top' || position === 'bottom';
    const navStyle = navPrefs?.navStyle ?? 'compact';
    const isWide   = !isHoriz && navStyle === 'wide';

    // ── State ──
    const [profileOpen,   setProfileOpen]   = React.useState(false);
    const [profilePos,    setProfilePos]    = React.useState({});
    const [checkinOpen,   setCheckinOpen]   = React.useState(false);
    const [checkinPos,    setCheckinPos]    = React.useState({});
    const [customizeOpen, setCustomizeOpen] = React.useState(false);
    const [hamburgerOpen, setHamburgerOpen] = React.useState(false);
    const [dragId,          setDragId]          = React.useState(null);  // item id being dragged in folder
    const [dragOverId,      setDragOverId]      = React.useState(null);  // item id or 'folder:fid'
    const [dragNavEntry,    setDragNavEntry]    = React.useState(null);  // 'folder:fid' or 'item:id' outer list
    const [dragOverNavEntry,setDragOverNavEntry]= React.useState(null); // outer list hover target
    const [editFolderId,  setEditFolderId]  = React.useState(null);
    const [editFolderName, setEditFolderName] = React.useState('');
    const [iconPickerFolderId, setIconPickerFolderId] = React.useState(null);

    const profileBtnRef  = React.useRef(null);
    const profileRef     = React.useRef(null);
    const checkinBtnRef  = React.useRef(null);
    const checkinMenuRef = React.useRef(null);
    const scrollRef      = React.useRef(null);   // customize modal scroll container
    const scrollRafRef   = React.useRef(null);   // rAF id for auto-scroll

    // Auto-scroll while dragging near edges of the customize modal list
    const handleModalDragOver = React.useCallback((e) => {
        const el = scrollRef.current;
        if (!el) return;
        const { top, bottom } = el.getBoundingClientRect();
        const zone = 60; // px from edge
        const speed = 8;
        cancelAnimationFrame(scrollRafRef.current);
        if (e.clientY < top + zone) {
            const scroll = () => { el.scrollTop -= speed; scrollRafRef.current = requestAnimationFrame(scroll); };
            scrollRafRef.current = requestAnimationFrame(scroll);
        } else if (e.clientY > bottom - zone) {
            const scroll = () => { el.scrollTop += speed; scrollRafRef.current = requestAnimationFrame(scroll); };
            scrollRafRef.current = requestAnimationFrame(scroll);
        }
    }, []);

    const handleModalDragEnd = React.useCallback(() => {
        cancelAnimationFrame(scrollRafRef.current);
    }, []);

    React.useEffect(() => {
        const handler = (e) => {
            if (
                profileRef.current    && !profileRef.current.contains(e.target) &&
                profileBtnRef.current && !profileBtnRef.current.contains(e.target)
            ) setProfileOpen(false);
            if (
                checkinMenuRef.current && !checkinMenuRef.current.contains(e.target) &&
                checkinBtnRef.current  && !checkinBtnRef.current.contains(e.target)
            ) setCheckinOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Permission filter ──
    const filterItem = (item) => {
        if (item.superOnly) return isSuper;
        if (item.adminOnly) {
            if (isAdmin) {
                if (item.permKey) return currentUser.permissions?.[item.permKey] !== false;
                return true;
            }
            if (item.permKey) return currentUser.permissions?.[item.permKey] === true;
            return false;
        }
        if (item.permKey) return currentUser.permissions?.[item.permKey] !== false;
        return true;
    };

    const allItems = ALL_NAV_ITEMS(t, pendingBookingsCount, pendingTasksCount, registrationsAlertCount);
    const accessibleItems = allItems.filter(filterItem);
    const accessibleIds   = new Set(accessibleItems.map(i => i.id));
    const hiddenSet = useMemo(() => new Set(navPrefs?.hidden ?? []), [navPrefs?.hidden]); // eslint-disable-line

    // ── Folders (use saved or defaults) ──
    const folders = useMemo(() => {
        const src = navPrefs?.folders ?? DEFAULT_FOLDERS;
        return src.map(f => ({ ...f, items: (f.items || []).filter(id => accessibleIds.has(id)) }));
    }, [navPrefs?.folders, accessibleIds]); // eslint-disable-line

    const openFolders = navPrefs?.openFolders ?? {};

    const folderItemIds = useMemo(() => new Set(folders.flatMap(f => f.items)), [folders]);

    // Items not in any folder (standalone) — just membership, order handled by resolvedNavOrder
    const standaloneItems = useMemo(() => {
        return accessibleItems.filter(i => !folderItemIds.has(i.id) && i.id !== 'dashboard');
    }, [accessibleItems, folderItemIds]); // eslint-disable-line

    // Resolved render order for sidebar and customize modal
    const resolvedNavOrder = React.useMemo(() => {
        const savedOrder = navPrefs?.navOrder;
        const folderEntries = folders.map(f => 'folder:' + f.id);
        // Respect legacy navPrefs.order for standalone items
        const legacyOrder = navPrefs?.order ?? [];
        const standaloneArr = accessibleItems.filter(i => !folderItemIds.has(i.id) && i.id !== 'dashboard');
        const standaloneEntries = [
            ...legacyOrder.map(id => 'item:' + id).filter(e => standaloneArr.some(i => 'item:' + i.id === e)),
            ...standaloneArr.filter(i => !legacyOrder.includes(i.id)).map(i => 'item:' + i.id),
        ];
        const hasDashboard = accessibleItems.some(i => i.id === 'dashboard') && !folderItemIds.has('dashboard');
        const allEntries = [
            ...(hasDashboard ? ['item:dashboard'] : []),
            ...standaloneEntries,
            ...folderEntries,
        ];
        if (!savedOrder || !savedOrder.length) return allEntries;
        // Rebuild: keep saved order but ensure folders always come after all items
        const itemEntries = allEntries.filter(e => !e.startsWith('folder:'));
        const savedItems = savedOrder.filter(e => itemEntries.includes(e));
        const savedFolders = savedOrder.filter(e => e.startsWith('folder:') && allEntries.includes(e));
        const missingItems   = itemEntries.filter(e => !savedItems.includes(e));
        const missingFolders = folderEntries.filter(e => !savedFolders.includes(e));
        return [...savedItems, ...missingItems, ...savedFolders, ...missingFolders];
    }, [navPrefs?.navOrder, navPrefs?.order, folders, accessibleItems, folderItemIds]); // eslint-disable-line

    const toggleFolder = (fid) => {
        const cur = openFolders[fid] ?? (navPrefs?.folders ? false : (DEFAULT_FOLDERS.find(f => f.id === fid)?.open ?? false));
        onNavPrefs?.({ openFolders: { ...openFolders, [fid]: !cur } });
    };

    const isFolderOpen = (fid) => {
        if (fid in openFolders) return openFolders[fid];
        const df = DEFAULT_FOLDERS.find(f => f.id === fid);
        return df?.open ?? false;
    };

    // ── Drag (customize modal) ──
    const clearDrag = () => { setDragId(null); setDragOverId(null); setDragNavEntry(null); setDragOverNavEntry(null); };

    const handleDragStart = (id) => { setDragNavEntry(null); setDragId(id); };
    const handleDragOver  = (id) => { if (id !== dragId) setDragOverId(id); };

    // Drag item into folder
    const handleDropOnFolder = (targetFolderId) => {
        if (!dragId) return;
        if (targetFolderId === 'standalone') {
            const newFolders = folders.map(f => ({ ...f, items: f.items.filter(id => id !== dragId) }));
            // Add to navOrder if not there yet
            const entry = 'item:' + dragId;
            const curOrder = navPrefs?.navOrder ?? resolvedNavOrder;
            const newOrder = curOrder.includes(entry) ? curOrder : [...curOrder, entry];
            onNavPrefs?.({ folders: newFolders, navOrder: newOrder });
        } else {
            const newFolders = folders.map(f => {
                if (f.id === targetFolderId) {
                    if (f.items.includes(dragId)) return f;
                    return { ...f, items: [...f.items, dragId] };
                }
                return { ...f, items: f.items.filter(id => id !== dragId) };
            });
            onNavPrefs?.({ folders: newFolders });
        }
        clearDrag();
    };

    // Reorder items within a folder
    const reorderItemInFolder = (folderId, fromItemId, toItemId) => {
        const newFolders = folders.map(f => {
            if (f.id !== folderId) return f;
            const items = [...f.items];
            const from  = items.indexOf(fromItemId);
            const to    = items.indexOf(toItemId);
            if (from === -1 || to === -1 || from === to) return f;
            items.splice(from, 1);
            items.splice(to, 0, fromItemId);
            return { ...f, items };
        });
        onNavPrefs?.({ folders: newFolders });
    };

    const toggleHidden = (id) => {
        const hidden = navPrefs?.hidden ?? [];
        onNavPrefs?.(hiddenSet.has(id)
            ? { hidden: hidden.filter(h => h !== id) }
            : { hidden: [...hidden, id] });
    };

    // Folder management
    const addFolder = () => {
        const id = `folder_${Date.now()}`;
        const newF = { id, label: 'Новая папка', items: [], open: false };
        onNavPrefs?.({ folders: [...folders, newF] });
        setEditFolderId(id);
        setEditFolderName('Новая папка');
    };

    const renameFolder = (fid, name) => {
        onNavPrefs?.({ folders: folders.map(f => f.id === fid ? { ...f, label: name } : f) });
    };

    const deleteFolder = (fid) => {
        onNavPrefs?.({ folders: folders.filter(f => f.id !== fid) });
    };

    const setFolderIcon = (fid, iconId) => {
        onNavPrefs?.({ folders: folders.map(f => f.id === fid ? { ...f, icon: iconId === 'folder' ? undefined : iconId } : f) });
    };

    const reorderFolders = (fromId, toId) => {
        if (!fromId || !toId || fromId === toId) return;
        reorderNav('folder:' + fromId, 'folder:' + toId);
    };

    // Reorder entries in the outer nav list (folders + standalone items interleaved)
    const reorderNav = (fromEntry, toEntry) => {
        if (!fromEntry || !toEntry || fromEntry === toEntry) return;
        const arr  = [...resolvedNavOrder];
        const from = arr.indexOf(fromEntry);
        const to   = arr.indexOf(toEntry);
        if (from === -1 || to === -1) return;
        arr.splice(from, 1);
        arr.splice(to, 0, fromEntry);
        onNavPrefs?.({ navOrder: arr });
    };

    // ── Popup positioning ──
    const handleCheckinToggle = () => {
        if (!checkinOpen && checkinBtnRef.current) {
            const r = checkinBtnRef.current.getBoundingClientRect();
            if (position === 'bottom') setCheckinPos({ bottom: window.innerHeight - r.top + 6, left: r.left });
            else if (position === 'top') setCheckinPos({ top: r.bottom + 6, left: r.left });
            else setCheckinPos({ top: r.top, left: position === 'right' ? r.left - 178 : r.right + 8 });
        }
        setCheckinOpen(o => !o);
    };

    const handleProfileToggle = () => {
        if (!profileOpen && profileBtnRef.current) {
            const r = profileBtnRef.current.getBoundingClientRect();
            if (position === 'bottom') setProfilePos({ bottom: window.innerHeight - r.top + 6, right: window.innerWidth - r.right });
            else if (position === 'top') setProfilePos({ top: r.bottom + 6, right: window.innerWidth - r.right });
            else if (position === 'right') setProfilePos({ bottom: window.innerHeight - r.bottom, right: window.innerWidth - r.left + 8 });
            else setProfilePos({ bottom: window.innerHeight - r.bottom, left: r.right + 8 });
        }
        setProfileOpen(o => !o);
    };

    const roleLabel  = isSuper ? t('superAdmin') : isAdmin ? t('admin') : t('cashier');
    const canCheckin = currentUser.role !== 'admin' && currentUser.role !== 'super';
    const btnBase    = { transition: 'all 0.15s', cursor: 'pointer' };

    // ── Active indicator ──
    const ActiveBar = () => !isHoriz ? (
        <span style={{
            position: 'absolute',
            [position === 'right' ? 'right' : 'left']: 0,
            top: '18%', bottom: '18%', width: 3,
            borderRadius: 3,
            background: 'linear-gradient(180deg,#f5b574,#e88c40)',
            boxShadow: '0 0 10px rgba(232,140,64,0.7)',
        }}/>
    ) : (
        <span style={{
            position: 'absolute',
            [position === 'bottom' ? 'top' : 'bottom']: 0,
            left: '16%', right: '16%', height: 3,
            background: 'linear-gradient(90deg,#f5b574,#e88c40)',
            borderRadius: 3,
            boxShadow: '0 0 10px rgba(232,140,64,0.7)',
        }}/>
    );

    // ── Render single nav item ──
    const renderItem = (item, indent = false) => {
        const Icon = item.icon;
        const act  = activeTab === item.id;
        if (hiddenSet.has(item.id)) return null;
        return (
            <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="dsb nav-item relative flex flex-col items-center justify-center transition-all"
                style={{
                    ...(isHoriz
                        ? { height: '100%', padding: '0 10px', minWidth: 64 }
                        : { width: '100%', paddingLeft: indent && !isHoriz ? 4 : 0 }),
                    background: act ? 'rgba(232,140,64,0.12)' : 'transparent',
                    color: act ? '#f5b574' : 'var(--nav-muted)',
                    outline: 'none', border: 'none', flexShrink: 0,
                }}
                onMouseOver={e => { if (!act) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#c8d8da'; } }}
                onMouseOut={e  => { if (!act) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--nav-muted)'; } }}
            >
                {act && <ActiveBar/>}
                <Icon size={isHoriz ? 20 : indent ? 20 : 24} strokeWidth={act ? 2.5 : 2}/>
                <span className="nav-lbl" style={{ fontSize: indent ? 8 : 9 }}>{item.label}</span>
                {(item.badge ?? 0) > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center"
                        style={{ background: '#e88c40', color: '#fff', fontSize: 9, fontWeight: 900,
                            minWidth: 16, height: 16, padding: '0 3px', borderRadius: 8,
                            border: '2px solid var(--nav-bg)', boxSizing: 'content-box',
                            animation: item.glow ? 'booking-pulse 1.5s ease-in-out infinite' : 'none' }}>
                        {item.badge}
                    </span>
                )}
            </button>
        );
    };

    // ── Render folder (accordion) — vertical only ──
    const renderFolder = (folder) => {
        const open = isFolderOpen(folder.id);
        const FolderIconComp = folder.icon
            ? (FOLDER_ICONS.find(f => f.id === folder.icon)?.Icon || Folder)
            : (open ? FolderOpen : Folder);
        const visItems = folder.items
            .map(id => accessibleItems.find(i => i.id === id))
            .filter(Boolean)
            .filter(i => !hiddenSet.has(i.id));

        // Badge sum for folder when closed
        const totalBadge = visItems.reduce((s, i) => s + (i.badge ?? 0), 0);
        const hasGlow    = visItems.some(i => i.glow && (i.badge ?? 0) > 0);
        const hasActive  = visItems.some(i => activeTab === i.id);

        return (
            <div key={folder.id}>
                <button
                    onClick={() => toggleFolder(folder.id)}
                    className="dsb nav-item relative flex flex-col items-center justify-center w-full transition-all"
                    style={{
                        background: hasActive && !open ? 'rgba(232,140,64,0.08)' : 'transparent',
                        color: hasActive ? '#f5b574' : 'var(--nav-muted)',
                        outline: 'none', border: 'none', flexShrink: 0,
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#c8d8da'; }}
                    onMouseOut={e  => { e.currentTarget.style.background = hasActive && !open ? 'rgba(232,140,64,0.08)' : 'transparent'; e.currentTarget.style.color = hasActive ? '#f5b574' : 'var(--nav-muted)'; }}
                >
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                        <FolderIconComp size={22} strokeWidth={2}/>
                        {!open && totalBadge > 0 && (
                            <span style={{
                                position: 'absolute', top: -4, right: -6,
                                background: '#e88c40', color: '#fff',
                                fontSize: 8, fontWeight: 900,
                                width: 14, height: 14, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                animation: hasGlow ? 'booking-pulse 1.5s ease-in-out infinite' : 'none',
                            }}>{totalBadge}</span>
                        )}
                    </div>
                    <span className="nav-lbl" style={{ fontSize: 8 }}>{folder.label}</span>
                    <span style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', opacity: 0.35 }}>
                        {open ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                    </span>
                </button>

                {open && (
                    <div style={{
                        borderLeft: '2px solid rgba(232,140,64,0.25)',
                        marginLeft: 8,
                        marginBottom: 2,
                    }}>
                        {visItems.map(item => renderItem(item, true))}
                    </div>
                )}
            </div>
        );
    };

    // ── Build nav content (folders + standalone items) ──
    const renderNavContent = () => {
        if (isHoriz) {
            const allVisible = accessibleItems.filter(i => !hiddenSet.has(i.id));
            return allVisible.map(i => renderItem(i));
        }
        return (
            <>
                {resolvedNavOrder.map(entry => {
                    if (entry.startsWith('folder:')) {
                        const fid = entry.slice(7);
                        const folder = folders.find(f => f.id === fid);
                        return folder ? renderFolder(folder) : null;
                    } else {
                        const id = entry.slice(5);
                        const item = accessibleItems.find(i => i.id === id);
                        return item && !hiddenSet.has(id) ? renderItem(item) : null;
                    }
                })}
            </>
        );
    };

    // ── Wide sidebar: row-layout item ──
    const renderItemWide = (item) => {
        const Icon = item.icon;
        const act  = activeTab === item.id;
        if (hiddenSet.has(item.id)) return null;
        return (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
                className="dsb"
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', position: 'relative', border: 'none', borderRadius: 10,
                    background: act ? 'rgba(232,140,64,0.12)' : 'transparent',
                    color: act ? '#f5b574' : 'var(--nav-muted)',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', flexShrink: 0,
                }}
                onMouseOver={e => { if (!act) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#c8d8da'; } }}
                onMouseOut={e  => { if (!act) { e.currentTarget.style.background = act ? 'rgba(232,140,64,0.12)' : 'transparent'; e.currentTarget.style.color = act ? '#f5b574' : 'var(--nav-muted)'; } }}
            >
                {act && <span style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'#e88c40', borderRadius:'0 3px 3px 0' }}/>}
                <Icon size={16} strokeWidth={act ? 2.5 : 2} style={{ flexShrink: 0 }}/>
                <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                {(item.badge ?? 0) > 0 && (
                    <span style={{ background: '#e88c40', color: '#fff', fontSize: 9, fontWeight: 900, padding: '1px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center', flexShrink: 0,
                        animation: item.glow ? 'booking-pulse 1.5s ease-in-out infinite' : 'none' }}>
                        {item.badge}
                    </span>
                )}
            </button>
        );
    };

    // ── Wide sidebar: folder accordion ──
    const renderFolderWide = (folder) => {
        const open = isFolderOpen(folder.id);
        const FolderIconComp = folder.icon
            ? (FOLDER_ICONS.find(f => f.id === folder.icon)?.Icon || Folder)
            : (open ? FolderOpen : Folder);
        const visItems = folder.items
            .map(id => accessibleItems.find(i => i.id === id))
            .filter(Boolean)
            .filter(i => !hiddenSet.has(i.id));
        const hasActive = visItems.some(i => activeTab === i.id);
        return (
            <div key={folder.id} style={{ marginBottom: 2 }}>
                <button onClick={() => toggleFolder(folder.id)}
                    className="dsb"
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 12px', border: 'none', borderRadius: 10,
                        background: hasActive && !open ? 'rgba(232,140,64,0.08)' : 'transparent',
                        color: hasActive ? '#f5b574' : 'var(--nav-muted)',
                        cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#c8d8da'; }}
                    onMouseOut={e  => { e.currentTarget.style.background = hasActive && !open ? 'rgba(232,140,64,0.08)' : 'transparent'; e.currentTarget.style.color = hasActive ? '#f5b574' : 'var(--nav-muted)'; }}
                >
                    <FolderIconComp size={16} strokeWidth={2} style={{ flexShrink: 0 }}/>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, textAlign: 'left' }}>{folder.label}</span>
                    {open ? <ChevronDown size={13} style={{ flexShrink: 0, opacity: 0.5 }}/> : <ChevronRight size={13} style={{ flexShrink: 0, opacity: 0.5 }}/>}
                </button>
                {open && (
                    <div style={{ borderLeft: '2px solid rgba(232,140,64,0.2)', marginLeft: 20, marginTop: 1, marginBottom: 2 }}>
                        {visItems.map(item => renderItemWide(item))}
                    </div>
                )}
            </div>
        );
    };

    // ── Wide sidebar: full nav content ──
    const renderNavContentWide = () => (
        <div style={{ padding: '6px 8px' }}>
            {resolvedNavOrder.map(entry => {
                if (entry.startsWith('folder:')) {
                    const fid = entry.slice(7);
                    const folder = folders.find(f => f.id === fid);
                    return folder ? renderFolderWide(folder) : null;
                } else {
                    const id = entry.slice(5);
                    const item = accessibleItems.find(i => i.id === id);
                    return item && !hiddenSet.has(id) ? renderItemWide(item) : null;
                }
            })}
        </div>
    );

    // ── Outer container style ──
    const outerStyle = isHoriz
        ? { height: 56, width: '100%', background: 'var(--nav-bg)', padding: 0,
            borderBottom: position === 'top'    ? '1px solid rgba(255,255,255,0.07)' : undefined,
            borderTop:    position === 'bottom' ? '1px solid rgba(255,255,255,0.07)' : undefined }
        : { width: isWide ? 220 : 80, background: 'var(--nav-bg)',
            borderRight: position === 'left'  ? '1px solid rgba(255,255,255,0.07)' : undefined,
            borderLeft:  position === 'right' ? '1px solid rgba(255,255,255,0.07)' : undefined };

    // ── SIDEBAR MENU (DEFAULT) ──
    return (
        <>
        <div className={`hidden md:flex shrink-0 overflow-hidden ${isHoriz ? 'flex-row' : 'flex-col'}`} style={{...outerStyle, padding: 0, margin: 0}}>
            <style>{`
                .dsb:focus,.dsb-btn:focus{outline:none!important;box-shadow:none!important}
                @keyframes booking-pulse{0%,100%{box-shadow:0 0 0 0 rgba(232,140,64,0.8)}50%{box-shadow:0 0 0 6px rgba(232,140,64,0)}}
                @keyframes checkin-border{0%,100%{box-shadow:0 0 0 0 rgba(20,184,166,0.55)}50%{box-shadow:0 0 0 4px rgba(20,184,166,0)}}
                .nav-item{padding-top:9px;padding-bottom:9px;position:relative;transition:all .18s cubic-bezier(.4,0,.2,1)}
                .nav-item svg{transition:transform .18s cubic-bezier(.4,0,.2,1)}
                .nav-item:hover svg{transform:translateY(-1px)}
                .nav-item:active svg{transform:scale(.92)}
                .nav-lbl{font-size:9px;font-weight:700;letter-spacing:.02em;line-height:1;margin-top:2px;text-align:center;transition:color .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72px}
                .dsb-btn{transition:all .18s cubic-bezier(.4,0,.2,1)!important}
                .dsb-btn:hover{transform:translateY(-1.5px)}
                .dsb-btn:active{transform:translateY(0) scale(.96)}
                @media(max-height:680px){.nav-item{padding-top:3px!important;padding-bottom:3px!important}}
                @media(max-height:540px){.nav-lbl{display:none!important}.nav-item{padding-top:2px!important;padding-bottom:2px!important}}
            `}</style>

            {/* ── Items ── */}
            {isHoriz ? (
                <div className="flex-1 flex flex-row overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'none', paddingLeft: '20px', paddingRight: '20px', minWidth: 0 }}>
                    {renderNavContent()}
                </div>
            ) : isWide ? (
                <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                    {renderNavContentWide()}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col" style={{ scrollbarWidth: 'none' }}>
                    {renderNavContent()}
                </div>
            )}

            {/* ── Action buttons ── */}
            {canPerformActions && (
                <div className="flex shrink-0" style={{
                    ...(isHoriz
                        ? { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 16px',
                            borderLeft: '1px solid rgba(255,255,255,0.09)', height: '100%' }
                        : isWide
                            ? { flexDirection: 'row', gap: 5, padding: '8px 8px 8px',
                                borderTop: '1px solid rgba(255,255,255,0.09)' }
                            : { flexDirection: 'column', gap: 6, padding: '8px 8px 10px',
                                borderTop: '1px solid rgba(255,255,255,0.09)' }),
                }}>
                    {canCheckin && (
                        <button ref={checkinBtnRef} onClick={handleCheckinToggle}
                            className="dsb-btn flex flex-col items-center justify-center rounded-2xl"
                            style={{ ...btnBase,
                                ...(isHoriz ? { padding: '3px 8px', height: 40, width: 72 } : isWide ? { padding: '7px 3px 6px', flex: 1 } : { padding: '9px 4px 7px', width: '100%' }),
                                gap: 4, background: checkinOpen ? 'linear-gradient(160deg,#0f9688,#0d7a6e)' : 'rgba(20,184,166,0.18)',
                                color: checkinOpen ? '#fff' : '#5eead4',
                                border: `1.5px solid ${checkinOpen ? 'rgba(94,234,212,0.5)' : 'rgba(20,184,166,0.3)'}`,
                                boxShadow: '0 2px 10px rgba(20,184,166,0.18), inset 0 1px 0 rgba(255,255,255,0.07)',
                                animation: 'none',
                            }}
                            onMouseOver={e => { e.currentTarget.style.background = 'linear-gradient(160deg,#0f9688,#0d7a6e)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={e  => { if (!checkinOpen) { e.currentTarget.style.background = 'rgba(20,184,166,0.18)'; e.currentTarget.style.color = '#5eead4'; } }}
                        >
                            <UserPlus size={isHoriz ? 16 : 18} strokeWidth={2.5}/>
                            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em' }}>{t('checkin')}</span>
                        </button>
                    )}
                    <button onClick={onOpenExpense}
                        className="dsb-btn flex flex-col items-center justify-center rounded-xl"
                        style={{ ...btnBase,
                            ...(isHoriz ? { padding: '3px 8px', height: 40, width: 72 } : isWide ? { padding: '7px 3px 6px', flex: 1 } : { padding: '7px 4px 5px', width: '100%' }),
                            gap: 3, background: 'rgba(234,179,8,0.14)', color: '#fde047',
                            border: '1px solid rgba(234,179,8,0.22)',
                            boxShadow: '0 2px 10px rgba(234,179,8,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(234,179,8,0.32)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseOut={e  => { e.currentTarget.style.background = 'rgba(234,179,8,0.14)'; e.currentTarget.style.color = '#fde047'; }}
                    >
                        <Wallet size={isHoriz ? 14 : 16} strokeWidth={2.5}/>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em' }}>{t('expense')}</span>
                    </button>
                    {canCheckin && (
                        <button onClick={onOpenShift}
                            className="dsb-btn flex flex-col items-center justify-center rounded-xl"
                            style={{ ...btnBase,
                                ...(isHoriz ? { padding: '3px 8px', height: 40, width: 72 } : isWide ? { padding: '7px 3px 6px', flex: 1 } : { padding: '7px 4px 5px', width: '100%' }),
                                gap: 3, background: 'rgba(239,68,68,0.14)', color: '#fca5a5',
                                border: '1px solid rgba(239,68,68,0.22)',
                                boxShadow: '0 2px 10px rgba(239,68,68,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
                            }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.32)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={e  => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; e.currentTarget.style.color = '#fca5a5'; }}
                        >
                            <Power size={isHoriz ? 14 : 16} strokeWidth={2.5}/>
                            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em' }}>{t('shift')}</span>
                        </button>
                    )}
                    {checkinOpen && ReactDOM.createPortal(
                        <div ref={checkinMenuRef} style={{
                            position: 'fixed',
                            left: checkinPos.left,
                            ...(checkinPos.bottom !== undefined
                                ? { bottom: checkinPos.bottom }
                                : { top: checkinPos.top }),
                            width: 170, background: 'var(--nav-popup)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                            zIndex: 180, overflow: 'hidden',
                        }}>
                            {[
                                { label: t('checkinOneGuest'), Icon: UserPlus,  color: '#5eead4', action: () => { setCheckinOpen(false); onOpenCheckIn(); } },
                                { label: t('checkinGroup'),     Icon: Users2,    color: '#a5b4fc', action: () => { setCheckinOpen(false); onOpenGroupCheckIn(); } },
                                { label: t('checkinRental'),    Icon: Building2, color: '#6ee7b7', action: () => { setCheckinOpen(false); onOpenRoomRental(); } },
                                { label: 'Лист в бухгалтерию',  Icon: FileText,  color: '#5eead4', action: () => { setCheckinOpen(false); onOpenGroupReceipt?.(); } },
                            ].map(({ label, Icon, color, action }) => (
                                <button key={label} onClick={action}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left"
                                    style={{ color, background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                    onMouseOut={e  => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <Icon size={15} strokeWidth={2}/>
                                    <span style={{ fontWeight: 600 }}>{label}</span>
                                </button>
                            ))}
                        </div>,
                        document.body,
                    )}
                </div>
            )}

            {/* ── Profile ── */}
            <div style={{
                borderTop:  !isHoriz ? '1px solid rgba(255,255,255,0.09)' : 'none',
                borderLeft: isHoriz  ? '1px solid rgba(255,255,255,0.09)' : 'none',
                paddingRight: isHoriz ? '20px' : undefined,
                paddingLeft: isHoriz ? '4px' : undefined,
                display: isHoriz ? 'flex' : undefined,
                alignItems: isHoriz ? 'center' : undefined,
                height: isHoriz ? '100%' : undefined,
                flexShrink: 0,
            }}>
                <button ref={profileBtnRef} onClick={handleProfileToggle}
                    className="flex items-center justify-center transition-all"
                    style={{ ...btnBase,
                        ...(isHoriz
                            ? { width: 54, height: 56, flexDirection: 'row' }
                            : isWide
                                ? { width: '100%', flexDirection: 'row', padding: '10px 12px', gap: 10 }
                                : { width: '100%', flexDirection: 'column', padding: '10px 0', gap: 3 }),
                        display: 'flex',
                        background: profileOpen ? 'rgba(255,255,255,0.12)' : 'transparent',
                    }}
                    onMouseOver={e => { if (!profileOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseOut={e  => { if (!profileOpen) e.currentTarget.style.background = 'transparent'; }}
                >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
                         style={{ background: '#e88c40', color: '#fff', flexShrink: 0 }}>
                        {(currentUser.name || '?')[0].toUpperCase()}
                    </div>
                    {isWide && (
                        <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#c8d8da', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {(currentUser.name || '?').split(' ')[0]}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--nav-muted)', marginTop: 1 }}>{roleLabel}</div>
                        </div>
                    )}
                    {!isHoriz && !isWide && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--nav-muted)', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(currentUser.name || '?').split(' ')[0]}
                        </span>
                    )}
                </button>

                {profileOpen && ReactDOM.createPortal(
                    <div ref={profileRef} style={{
                        position: 'fixed',
                        ...(position === 'bottom'
                            ? { bottom: profilePos.bottom, right: profilePos.right }
                            : position === 'top'
                                ? { top: profilePos.top, right: profilePos.right }
                                : position === 'right'
                                    ? { bottom: profilePos.bottom, right: profilePos.right }
                                    : { bottom: profilePos.bottom, left: profilePos.left }),
                        width: 240, background: 'var(--nav-popup)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.45)', zIndex: 180, overflow: 'hidden',
                    }}>
                        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                            <div className="text-sm font-black text-white">{currentUser.name}</div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--nav-muted)' }}>{roleLabel}</div>
                        </div>
                        <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                            <div className="text-[11px] font-bold uppercase mb-2" style={{ color: 'var(--nav-muted)' }}>{t('language')}</div>
                            <div className="flex gap-2">
                                {['ru', 'uz'].map(l => (
                                    <button key={l} onClick={() => setLang(l)}
                                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                                        style={lang === l ? { background: '#e88c40', color: '#fff' } : { background: 'rgba(255,255,255,0.08)', color: 'var(--nav-muted)' }}>
                                        {l.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {setAppTheme && (
                            <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                                <div className="text-[11px] font-bold uppercase mb-2" style={{ color: 'var(--nav-muted)' }}>Тема</div>
                                <div className="flex gap-2">
                                    {APP_THEMES.map(th => (
                                        <button key={th.id} onClick={() => setAppTheme(th.id)}
                                            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                                            style={appTheme === th.id ? { background: '#e88c40', color: '#fff' } : { background: 'rgba(255,255,255,0.08)', color: 'var(--nav-muted)' }}>
                                            <span>{th.emoji}</span><span>{th.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => { setProfileOpen(false); setCustomizeOpen(true); }}
                            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-left"
                            style={{ color: '#a5b4fc', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', outline: 'none', transition: 'background .15s' }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(165,180,252,0.1)'; }}
                            onMouseOut={e  => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <SlidersHorizontal size={15}/> Настроить меню
                        </button>
                        <button
                            onClick={() => { setProfileOpen(false); onOpenChangePassword(); }}
                            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-left"
                            style={{ color: '#c9e8ea', background: 'transparent', border: 'none', outline: 'none', transition: 'background .15s' }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                            onMouseOut={e  => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <Lock size={15}/> {t('changePassword')}
                        </button>
                        <button
                            onClick={() => { setProfileOpen(false); onLogout(); }}
                            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-left border-t"
                            style={{ color: '#fca5a5', background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', outline: 'none', transition: 'background .15s' }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                            onMouseOut={e  => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <LogOut size={15}/> {t('logout')}
                        </button>
                    </div>,
                    document.body,
                )}
            </div>

            {/* ── Customize modal ── */}
            {customizeOpen && ReactDOM.createPortal(
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setCustomizeOpen(false); }}
                >
                    <div style={{
                        background: 'var(--nav-popup)', borderRadius: 18, width: '100%', maxWidth: 860,
                        maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.13)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                    }}>
                        {/* Header */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <SlidersHorizontal size={17} style={{ color: '#a5b4fc' }}/>
                            <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, flex: 1 }}>Настройка меню</span>
                            <button onClick={() => setCustomizeOpen(false)}
                                style={{ color: 'var(--nav-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 4, fontSize: 16 }}>✕</button>
                        </div>

                        {/* Position picker */}
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ color: 'rgba(158,205,208,0.5)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                                Расположение меню
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                {POSITIONS.map(({ id, Icon: PosIcon, label }) => (
                                    <button key={id} onClick={() => onNavPrefs?.({ position: id })}
                                        style={{
                                            padding: '10px 4px', borderRadius: 10, cursor: 'pointer',
                                            border: `1.5px solid ${position === id ? '#e88c40' : 'rgba(255,255,255,0.1)'}`,
                                            background: position === id ? 'rgba(232,140,64,0.2)' : 'rgba(255,255,255,0.04)',
                                            color: position === id ? '#f5b574' : 'rgba(158,205,208,0.6)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                                            transition: 'all 0.15s',
                                        }}>
                                        <PosIcon size={18} strokeWidth={position === id ? 2.5 : 2}/>
                                        <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Style picker */}
                        {!isHoriz && (
                            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ color: 'rgba(158,205,208,0.5)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                                    Стиль меню
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {[
                                        { id: 'compact', label: 'Компактное', desc: '80px · иконки' },
                                        { id: 'wide',    label: 'Широкое',    desc: '220px · с текстом' },
                                    ].map(s => (
                                        <button key={s.id} onClick={() => onNavPrefs?.({ navStyle: s.id })}
                                            style={{
                                                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                                                border: `1.5px solid ${navStyle === s.id ? '#e88c40' : 'rgba(255,255,255,0.1)'}`,
                                                background: navStyle === s.id ? 'rgba(232,140,64,0.2)' : 'rgba(255,255,255,0.04)',
                                                color: navStyle === s.id ? '#f5b574' : 'rgba(158,205,208,0.6)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
                                                transition: 'all 0.15s', textAlign: 'left',
                                            }}
                                        >
                                            <span style={{ fontSize: 12, fontWeight: 800 }}>{s.label}</span>
                                            <span style={{ fontSize: 10, opacity: 0.65 }}>{s.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Unified nav structure — HORIZONTAL */}
                        <div
                            ref={scrollRef}
                            style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}
                            onDragOver={handleModalDragOver}
                            onDragEnd={handleModalDragEnd}
                            onDrop={handleModalDragEnd}
                        >
                            {/* Standalone items row */}
                            <div style={{ marginBottom: 18 }}>
                                <div style={{ color: 'rgba(158,205,208,0.45)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
                                    Основные пункты
                                </div>
                                <div
                                    style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 80, borderRadius: 12, padding: 6, border: `1.5px dashed ${dragId ? 'rgba(232,140,64,0.4)' : 'transparent'}`, transition: 'border-color 0.15s' }}
                                    onDragOver={(e) => { e.preventDefault(); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (dragId) handleDropOnFolder('standalone');
                                        clearDrag();
                                    }}
                                >
                                    {resolvedNavOrder.filter(e => e.startsWith('item:')).map((entry) => {
                                        const id = entry.slice(5);
                                        const item = allItems.find(i => i.id === id);
                                        if (!item || !accessibleIds.has(id)) return null;
                                        const hidden = hiddenSet.has(id);
                                        const isNavOver = dragOverNavEntry === entry;
                                        return (
                                            <div key={entry}
                                                draggable
                                                onDragStart={(e) => { e.stopPropagation(); setDragId(null); setDragNavEntry(entry); }}
                                                onDragOver={(e) => {
                                                    e.preventDefault(); e.stopPropagation();
                                                    if (dragNavEntry && dragNavEntry !== entry && !dragNavEntry.startsWith('folder:')) setDragOverNavEntry(entry);
                                                    else if (dragId) setDragOverNavEntry(entry);
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault(); e.stopPropagation();
                                                    if (dragNavEntry && !dragNavEntry.startsWith('folder:')) reorderNav(dragNavEntry, entry);
                                                    else if (dragId) handleDropOnFolder('standalone');
                                                    clearDrag();
                                                }}
                                                onDragEnd={() => clearDrag()}
                                                style={{
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                    padding: '10px 8px', cursor: 'grab', borderRadius: 12,
                                                    width: 80, minHeight: 72,
                                                    opacity: dragNavEntry === entry ? 0.3 : hidden ? 0.4 : 1,
                                                    background: isNavOver ? 'rgba(232,140,64,0.12)' : 'rgba(255,255,255,0.04)',
                                                    border: `1.5px solid ${isNavOver ? 'rgba(232,140,64,0.7)' : 'rgba(255,255,255,0.09)'}`,
                                                    userSelect: 'none', transition: 'all 0.12s', position: 'relative',
                                                }}
                                            >
                                                <item.icon size={20} style={{ color: hidden ? 'rgba(255,255,255,0.2)' : 'var(--nav-muted)', flexShrink: 0 }}/>
                                                <span style={{ fontSize: 10, fontWeight: 600, color: hidden ? 'rgba(255,255,255,0.25)' : '#c8d8da', textDecoration: hidden ? 'line-through' : 'none', textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>
                                                    {item.label}
                                                </span>
                                                <button onClick={() => toggleHidden(id)}
                                                    style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', color: hidden ? '#f87171' : 'rgba(52,211,153,0.6)', padding: 2, display: 'flex' }}>
                                                    {hidden ? <EyeOff size={11}/> : <Eye size={11}/>}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Folders row */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <span style={{ color: 'rgba(158,205,208,0.45)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                                        Папки
                                    </span>
                                    <button onClick={addFolder}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(165,180,252,0.12)', border: '1px solid rgba(165,180,252,0.25)', color: '#a5b4fc', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                        <FolderPlus size={13}/> Добавить папку
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    {resolvedNavOrder.filter(e => e.startsWith('folder:')).map((entry) => {
                                        const fid = entry.slice(7);
                                        const folder = folders.find(f => f.id === fid);
                                        if (!folder) return null;
                                        const FIC = folder.icon ? (FOLDER_ICONS.find(f => f.id === folder.icon)?.Icon || Folder) : Folder;
                                        const isNavOver = dragOverNavEntry === entry;
                                        const isItemOver = dragOverId === 'folder:' + folder.id;
                                        const visItemCount = folder.items.filter(id => accessibleIds.has(id)).length;
                                        return (
                                            <div key={folder.id}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    if (dragNavEntry?.startsWith('folder:') && dragNavEntry !== entry) setDragOverNavEntry(entry);
                                                    else if (dragNavEntry?.startsWith('item:') || dragId) setDragOverId('folder:' + folder.id);
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    if (dragNavEntry?.startsWith('item:')) {
                                                        const itemId = dragNavEntry.slice(5);
                                                        const newFolders = folders.map(f => {
                                                            if (f.id === folder.id) {
                                                                if (f.items.includes(itemId)) return f;
                                                                return { ...f, items: [...f.items, itemId] };
                                                            }
                                                            return { ...f, items: f.items.filter(id => id !== itemId) };
                                                        });
                                                        onNavPrefs?.({ folders: newFolders });
                                                    } else if (dragNavEntry?.startsWith('folder:')) {
                                                        reorderNav(dragNavEntry, entry);
                                                    } else if (dragId) {
                                                        handleDropOnFolder(folder.id);
                                                    }
                                                    clearDrag();
                                                }}
                                                style={{
                                                    borderRadius: 14, minWidth: 160,
                                                    border: `1.5px solid ${isNavOver ? 'rgba(165,180,252,0.7)' : isItemOver ? 'rgba(232,140,64,0.6)' : 'rgba(255,255,255,0.09)'}`,
                                                    background: isNavOver ? 'rgba(165,180,252,0.07)' : isItemOver ? 'rgba(232,140,64,0.07)' : 'rgba(255,255,255,0.03)',
                                                    transition: 'all 0.15s',
                                                    transform: dragNavEntry === entry ? 'scale(0.97)' : 'none',
                                                    opacity: dragNavEntry === entry ? 0.4 : 1,
                                                }}
                                            >
                                                {/* Folder header */}
                                                <div
                                                    draggable
                                                    onDragStart={(e) => { e.stopPropagation(); setDragId(null); setDragNavEntry(entry); }}
                                                    onDragEnd={() => clearDrag()}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 10px 6px', cursor: 'grab' }}>
                                                    <button
                                                        draggable={false}
                                                        onClick={(e) => { e.stopPropagation(); setIconPickerFolderId(iconPickerFolderId === folder.id ? null : folder.id); }}
                                                        style={{
                                                            background: iconPickerFolderId === folder.id ? 'rgba(165,180,252,0.2)' : 'rgba(255,255,255,0.07)',
                                                            border: `1px solid ${iconPickerFolderId === folder.id ? '#a5b4fc' : 'rgba(255,255,255,0.12)'}`,
                                                            borderRadius: 7, width: 26, height: 26, display: 'flex', alignItems: 'center',
                                                            justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                                                            color: iconPickerFolderId === folder.id ? '#a5b4fc' : 'rgba(158,205,208,0.6)',
                                                        }}
                                                    ><FIC size={13}/></button>
                                                    {editFolderId === folder.id ? (
                                                        <input
                                                            autoFocus
                                                            value={editFolderName}
                                                            onChange={e => setEditFolderName(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') { renameFolder(folder.id, editFolderName); setEditFolderId(null); } if (e.key === 'Escape') setEditFolderId(null); }}
                                                            style={{ flex: 1, width: 80, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#fff', padding: '2px 6px', fontSize: 12, outline: 'none' }}
                                                        />
                                                    ) : (
                                                        <span style={{ flex: 1, color: '#c8d8da', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{folder.label}</span>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                                        {editFolderId === folder.id ? (
                                                            <button onClick={() => { renameFolder(folder.id, editFolderName); setEditFolderId(null); }}
                                                                style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', padding: 2 }}><Check size={12}/></button>
                                                        ) : (
                                                            <button onClick={() => { setEditFolderId(folder.id); setEditFolderName(folder.label); }}
                                                                style={{ background: 'none', border: 'none', color: 'rgba(158,205,208,0.4)', cursor: 'pointer', padding: 2 }}><Pencil size={11}/></button>
                                                        )}
                                                        <button onClick={() => deleteFolder(folder.id)}
                                                            style={{ background: 'none', border: 'none', color: 'rgba(248,113,113,0.5)', cursor: 'pointer', padding: 2 }}><FolderMinus size={11}/></button>
                                                    </div>
                                                </div>

                                                {/* Icon picker */}
                                                {iconPickerFolderId === folder.id && (
                                                    <div style={{ padding: '0 8px 8px', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                                        {FOLDER_ICONS.map(({ id: iconId, Icon: IconOpt }) => {
                                                            const sel = (folder.icon || 'folder') === iconId;
                                                            return (
                                                                <button key={iconId} onClick={() => { setFolderIcon(folder.id, iconId); setIconPickerFolderId(null); }}
                                                                    style={{
                                                                        width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0,
                                                                        border: `1.5px solid ${sel ? '#a5b4fc' : 'rgba(255,255,255,0.1)'}`,
                                                                        background: sel ? 'rgba(165,180,252,0.2)' : 'rgba(255,255,255,0.04)',
                                                                        color: sel ? '#a5b4fc' : 'rgba(158,205,208,0.5)',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    }}>
                                                                    <IconOpt size={12}/>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Items inside folder — horizontal chips */}
                                                <div style={{ padding: '0 8px 8px', display: 'flex', flexWrap: 'wrap', gap: 5, minHeight: 36 }}>
                                                    {folder.items.map(itemId => {
                                                        const item = allItems.find(i => i.id === itemId);
                                                        if (!item || !accessibleIds.has(itemId)) return null;
                                                        const hidden = hiddenSet.has(itemId);
                                                        const isItemOver = dragOverId === 'inFolder:' + folder.id + ':' + itemId;
                                                        return (
                                                            <div key={itemId}
                                                                draggable
                                                                onDragStart={(e) => { e.stopPropagation(); handleDragStart(itemId); }}
                                                                onDragOver={(e) => {
                                                                    e.preventDefault(); e.stopPropagation();
                                                                    if (dragId && dragId !== itemId) setDragOverId('inFolder:' + folder.id + ':' + itemId);
                                                                }}
                                                                onDrop={(e) => {
                                                                    e.preventDefault(); e.stopPropagation();
                                                                    if (dragId && dragId !== itemId) {
                                                                        if (folder.items.includes(dragId)) reorderItemInFolder(folder.id, dragId, itemId);
                                                                        else {
                                                                            const newFolders = folders.map(f => {
                                                                                if (f.id === folder.id) {
                                                                                    const idx = f.items.indexOf(itemId);
                                                                                    const items = f.items.filter(id => id !== dragId);
                                                                                    items.splice(idx, 0, dragId);
                                                                                    return { ...f, items };
                                                                                }
                                                                                return { ...f, items: f.items.filter(id => id !== dragId) };
                                                                            });
                                                                            onNavPrefs?.({ folders: newFolders });
                                                                        }
                                                                    }
                                                                    clearDrag();
                                                                }}
                                                                onDragEnd={() => clearDrag()}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 5px',
                                                                    borderRadius: 8, cursor: 'grab',
                                                                    opacity: dragId === itemId ? 0.3 : hidden ? 0.4 : 1,
                                                                    background: isItemOver ? 'rgba(165,180,252,0.15)' : 'rgba(255,255,255,0.07)',
                                                                    border: `1px solid ${isItemOver ? 'rgba(165,180,252,0.5)' : 'rgba(255,255,255,0.1)'}`,
                                                                    userSelect: 'none', transition: 'all 0.1s',
                                                                }}
                                                            >
                                                                <item.icon size={11} style={{ color: 'var(--nav-muted)', flexShrink: 0 }}/>
                                                                <span style={{ fontSize: 11, fontWeight: 600, color: hidden ? 'rgba(255,255,255,0.25)' : '#c8d8da', textDecoration: hidden ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>
                                                                    {item.label}
                                                                </span>
                                                                <button
                                                                    title="Вынести из папки"
                                                                    onClick={() => {
                                                                        const newFolders = folders.map(f => ({ ...f, items: f.id === folder.id ? f.items.filter(id => id !== itemId) : f.items }));
                                                                        const itemEntry = 'item:' + itemId;
                                                                        const curOrder = navPrefs?.navOrder?.length ? [...navPrefs.navOrder] : [...resolvedNavOrder];
                                                                        const newOrder = curOrder.includes(itemEntry) ? curOrder : [...curOrder, itemEntry];
                                                                        onNavPrefs?.({ folders: newFolders, navOrder: newOrder });
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(158,205,208,0.4)', padding: '0 1px', fontSize: 11, fontWeight: 900, lineHeight: 1 }}
                                                                >↑</button>
                                                                <button onClick={() => toggleHidden(itemId)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: hidden ? '#f87171' : 'rgba(52,211,153,0.6)', padding: '0 1px', display: 'flex' }}>
                                                                    {hidden ? <EyeOff size={10}/> : <Eye size={10}/>}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                    {visItemCount === 0 && (
                                                        <span style={{ fontSize: 11, color: 'rgba(158,205,208,0.3)', fontStyle: 'italic', alignSelf: 'center' }}>Перетащите пункты</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {resolvedNavOrder.filter(e => e.startsWith('folder:')).length === 0 && (
                                        <div style={{ fontSize: 12, color: 'rgba(158,205,208,0.3)', padding: '8px 0', fontStyle: 'italic' }}>Папок нет — нажмите «Добавить папку»</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8 }}>
                            <button
                                onClick={() => onNavPrefs?.({
                                    order: [], hidden: [], position: 'left', openFolders: [], navStyle: 'compact',
                                    folders: currentUser?.role === 'cashier' ? DEFAULT_CASHIER_FOLDERS : null,
                                    navOrder: currentUser?.role === 'cashier' ? DEFAULT_CASHIER_ORDER : null,
                                })}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: 'rgba(158,205,208,0.7)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                                onMouseOut={e  => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                            >
                                <RotateCcw size={13}/> Сбросить
                            </button>
                            <button
                                onClick={() => setCustomizeOpen(false)}
                                style={{ flex: 1, padding: '9px', borderRadius: 10, background: '#e88c40', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}
                                onMouseOver={e => { e.currentTarget.style.background = '#d4773a'; }}
                                onMouseOut={e  => { e.currentTarget.style.background = '#e88c40'; }}
                            >
                                Готово
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
        </>
    );
};
export default Navigation;

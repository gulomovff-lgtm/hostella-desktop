import React, { useState, useMemo, useEffect } from 'react';
import { Users, Search, Globe, FileSpreadsheet, Merge, Trash2, History, Edit, ChevronLeft, ChevronRight, Upload, RefreshCw } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';
import ClientEditModal from '../Modals/ClientEditModal';

// --- Utilities ---
const COUNTRY_MAP = {
  'turkmenistan':'Туркмения','turkmenia':'Туркмения','uzbekistan':'Узбекистан','russia':'Россия',
  'russian federation':'Россия','kazakhstan':'Казахстан','tajikistan':'Таджикистан',
  'kyrgyzstan':'Кыргызстан','kirgizstan':'Кыргызстан','usa':'США','united states':'США',
  'united states of america':'США','china':'Китай','turkey':'Турция',
  'korea':'Корея (Южная)','south korea':'Корея (Южная)','india':'Индия','pakistan':'Пакистан',
  'afghanistan':'Афганистан','germany':'Германия','uk':'Великобритания',
  'united kingdom':'Великобритания','england':'Великобритания','france':'Франция',
  'italy':'Италия','spain':'Испания','japan':'Япония','uae':'ОАЭ','united arab emirates':'ОАЭ'
};

const COUNTRIES = [
  "Узбекистан","Россия","Казахстан","Таджикистан","Кыргызстан","Абхазия","Австралия","Австрия",
  "Азербайджан","Албания","Алжир","Ангола","Аргентина","Армения","Афганистан","Багамские Острова",
  "Бангладеш","Барбадос","Бахрейн","Белоруссия","Бельгия","Болгария","Бразилия","Великобритания",
  "Венгрия","Венесуэла","Вьетнам","Германия","Гонконг","Греция","Грузия","Дания","Египет",
  "Израиль","Индия","Индонезия","Иордания","Ирак","Иран","Ирландия","Исландия","Испания",
  "Италия","Канада","Катар","Кения","Кипр","Китай","Колумбия","Корея (Южная)","Куба","Кувейт",
  "Латвия","Литва","Малайзия","Мальдивы","Марокко","Мексика","Молдавия","Монголия","Непал",
  "Нидерланды","Новая Зеландия","Норвегия","ОАЭ","Пакистан","Польша","Португалия","Румыния",
  "Саудовская Аравия","Сербия","Сингапур","Сирия","Словакия","Словения","США","Таиланд",
  "Туркмения","Турция","Украина","Филиппины","Финляндия","Франция","Хорватия","Чехия","Чили",
  "Швейцария","Швеция","Шри-Ланка","Эстония","Япония"
];

const COUNTRY_FLAGS = {
  "Узбекистан":"UZ","Россия":"RU","Казахстан":"KZ","Таджикистан":"TJ","Кыргызстан":"KG","Абхазия":"GE",
  "Австралия":"AU","Австрия":"AT","Азербайджан":"AZ","Германия":"DE","Великобритания":"GB","США":"US",
  "Китай":"CN","Индия":"IN","Турция":"TR","ОАЭ":"AE","Корея (Южная)":"KR","Япония":"JP",
  "Франция":"FR","Италия":"IT","Испания":"ES","Польша":"PL","Украина":"UA","Пакистан":"PK",
  "Афганистан":"AF","Армения":"AM","Белоруссия":"BY","Грузия":"GE",
  "Туркмения":"TM","Монголия":"MN"
};

const FLAG_SIZES = [20, 40, 80, 160, 320];
const snapFlagSize = (s) => FLAG_SIZES.find(f => f >= s) || 320;
const Flag = ({ code, size = 20 }) => {
    if (!code) return null;
    const w = snapFlagSize(size), w2 = snapFlagSize(size * 2), h = Math.round(size * 0.75);
    return <img src={`https://flagcdn.com/w${w}/${code.toLowerCase()}.png`} srcSet={`https://flagcdn.com/w${w2}/${code.toLowerCase()}.png 2x`} width={size} height={h} alt={code} style={{ display:'inline-block', objectFit:'cover', borderRadius:2, verticalAlign:'middle', flexShrink:0 }}/>;
};

const getNormalizedCountry = (input) => {
    if (!input) return "Узбекистан";
    const clean = input.trim().replace(/['"]/g, '');
    const lower = clean.toLowerCase();
    if (COUNTRY_MAP[lower]) return COUNTRY_MAP[lower];
    const valid = COUNTRIES.find(c => c.toLowerCase() === lower);
    if (valid) return valid;
    return clean;
};

// --- ClientImportModal ---
const ClientImportModal = ({ onClose, onImport, lang }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const [fileData, setFileData] = useState([]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            const rows = text.split("\n").map(r => r.split(","));
            const parsed = rows.filter(r => r.length >= 2).map(r => ({
                fullName: r[0]?.replace(/['"]/g, '').trim()?.toUpperCase(),
                passport: r[1]?.replace(/['"]/g, '').trim()?.toUpperCase(),
                birthDate: r[2]?.replace(/['"]/g, '').trim(),
                country: getNormalizedCountry(r[3]?.replace(/['"]/g, '').trim() || "")
            })).filter(p => p.fullName && p.passport);
            setFileData(parsed);
        };
        reader.readAsText(file);
    };

    const confirmImport = () => { onImport(fileData); onClose(); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl flex flex-col max-h-[90vh]">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Upload size={20}/> {t('import')}</h3>
                <div className="mb-4">
                    <p className="text-sm text-slate-500 mb-2">CSV Format: Name,Passport,BirthDate,Country</p>
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                </div>
                {fileData.length > 0 && (
                    <div className="flex-1 overflow-auto border border-slate-200 rounded-lg mb-4">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr><th className="p-2">Name</th><th className="p-2">Passport</th><th className="p-2">Country</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {fileData.map((d, i) => (
                                    <tr key={i}><td className="p-2">{d.fullName}</td><td className="p-2">{d.passport}</td><td className="p-2">{d.country}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="flex gap-2">
                    <Button onClick={confirmImport} disabled={fileData.length === 0} className="flex-1">{t('save')} ({fileData.length})</Button>
                    <Button variant="secondary" onClick={onClose} className="flex-1">{t('cancel')}</Button>
                </div>
            </div>
        </div>
    );
};

// --- ClientsView ---
const ClientsView = ({ clients, onUpdateClient, onImportClients, onDeduplicate, onBulkDelete, onNormalizeCountries, onSyncFromGuests, lang, currentUser, onOpenClientHistory, activePassports = new Set() }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const [search, setSearch] = useState('');
    const [editingClient, setEditingClient] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [countryFilter, setCountryFilter] = useState('');
    const [recencyFilter, setRecencyFilter] = useState('');
    const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
    const [confirmNormalizeOpen, setConfirmNormalizeOpen] = useState(false);
    const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);

    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';

    const filtered = useMemo(() => {
        const nowMs = Date.now();
        const result = clients.filter(c => {
            const matchesSearch = !search ||
                (c.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
                (c.passport || '').includes(search.toUpperCase());
            const matchesCountry = !countryFilter || c.country === countryFilter;
            const matchesRecency = !recencyFilter || (() => {
                if (!c.lastVisit) return true;
                const daysSince = (nowMs - new Date(c.lastVisit).getTime()) / 86400000;
                return daysSince >= parseInt(recencyFilter);
            })();
            return matchesSearch && matchesCountry && matchesRecency;
        });
        // Активные гости — вперед
        if (activePassports.size > 0) {
            result.sort((a, b) => {
                const aActive = a.passport && activePassports.has(a.passport) ? 0 : 1;
                const bActive = b.passport && activePassports.has(b.passport) ? 0 : 1;
                return aActive - bActive;
            });
        }
        return result;
    }, [clients, search, countryFilter, recencyFilter, activePassports]);

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedClients = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const uniqueCountries = useMemo(() => {
        const countries = new Set(clients.map(c => c.country).filter(Boolean));
        return Array.from(countries).sort();
    }, [clients]);

    useEffect(() => { setCurrentPage(1); }, [search, countryFilter, recencyFilter, itemsPerPage]);

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(new Set(paginatedClients.map(c => c.id)));
        else setSelectedIds(new Set());
    };

    const handleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkDelete = () => {
        setConfirmBulkDeleteOpen(true);
    };

    const handleNormalize = () => { setConfirmNormalizeOpen(true); };

    return (
        <div className="space-y-4 pb-20">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium text-slate-700" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="w-full sm:w-52 py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none" value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
                        <option value="">Все страны</option>
                        {uniqueCountries.map(country => <option key={country} value={country}>{country}</option>)}
                    </select>
                    <select className="w-full sm:w-52 py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none" value={recencyFilter} onChange={e => setRecencyFilter(e.target.value)}>
                        <option value="">Все визиты</option>
                        <option value="30">Не были 30+ дней</option>
                        <option value="60">Не были 60+ дней</option>
                        <option value="90">Не были 90+ дней</option>
                        <option value="180">Не были 180+ дней</option>
                    </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && <>
                        <Button icon={Merge} variant="secondary" onClick={onDeduplicate}>{t('deduplicate')}</Button>
                        <Button icon={Globe} variant="secondary" onClick={handleNormalize}>{t('normalizeCountries')}</Button>
                        <Button icon={FileSpreadsheet} variant="secondary" onClick={() => setIsImportModalOpen(true)}>CSV</Button>
                        {onSyncFromGuests && <Button icon={RefreshCw} variant="secondary" onClick={() => setConfirmSyncOpen(true)}>Синхр. гостей</Button>}
                        {selectedIds.size > 0 && <Button icon={Trash2} variant="danger" onClick={handleBulkDelete}>{selectedIds.size} уд.</Button>}
                    </>}
                    <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span>Найдено: <strong className="text-slate-800">{filtered.length}</strong></span>
                        <select className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white" value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                            <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {paginatedClients.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                        <Users size={40} className="mx-auto mb-3 text-slate-300"/>
                        <p className="text-slate-500 font-medium">{t('noData')}</p>
                    </div>
                ) : paginatedClients.map(c => (
                    <div key={c.id} className={`bg-white rounded-2xl border transition-all hover:shadow-md group ${selectedIds.has(c.id) ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="p-4">
                            <div className="flex items-start gap-3 mb-3">
                                <div className="shrink-0 select-none w-10 h-8 flex items-center justify-center">
                                    {COUNTRY_FLAGS[c.country] ? <Flag code={COUNTRY_FLAGS[c.country]} size={40}/> : <span className="text-2xl">??</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <div className="font-bold text-slate-900 text-sm leading-tight truncate">{c.fullName}</div>
                                        {c.passport && activePassports.has(c.passport) && (
                                            <span className="shrink-0 inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block"/>Живёт
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5 truncate">{c.country || '—'}</div>
                                </div>
                                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isAdmin && <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => handleSelect(c.id)} onClick={e => e.stopPropagation()} className="rounded border-slate-300 text-indigo-600 mt-1"/>}
                                    <button onClick={() => onOpenClientHistory(c)} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg"><History size={14}/></button>
                                    <button onClick={() => setEditingClient(c)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><Edit size={14}/></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 rounded-xl px-3 py-2">
                                    <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Паспорт</div>
                                    <div className="text-xs font-mono font-bold text-indigo-700 truncate">{c.passport || '—'}</div>
                                </div>
                                <div className="bg-slate-50 rounded-xl px-3 py-2">
                                    <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Дата рожд.</div>
                                    <div className="text-xs font-medium text-slate-700">{c.birthDate || '—'}</div>
                                </div>
                            </div>
                            {(c.visits > 0 || c.lastVisit) && (
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                                    <span className="text-xs text-slate-400">{c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '—'}</span>
                                    {c.visits > 0 && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full">{c.visits}×</span>}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <Button variant="secondary" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} icon={ChevronLeft} size="sm"/>
                    {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                        let p;
                        if (totalPages<=5) p=i+1;
                        else if (currentPage<=3) p=i+1;
                        else if (currentPage>=totalPages-2) p=totalPages-4+i;
                        else p=currentPage-2+i;
                        return <Button key={p} variant={currentPage===p?'primary':'secondary'} onClick={() => setCurrentPage(p)} size="sm">{p}</Button>;
                    })}
                    <Button variant="secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} icon={ChevronRight} size="sm"/>
                </div>
            )}

            {editingClient && <ClientEditModal client={editingClient} onClose={() => setEditingClient(null)} onSave={(d) => { onUpdateClient(editingClient.id, d); setEditingClient(null); }} lang={lang}/>}
            {isImportModalOpen && <ClientImportModal onClose={() => setIsImportModalOpen(false)} onImport={(data) => { onImportClients(data); setIsImportModalOpen(false); }} lang={lang}/>}

            {confirmBulkDeleteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                        <div className="text-center mb-5">
                            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Trash2 size={22} className="text-rose-600"/>
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg">{t('deleteSelected')}</h3>
                            <p className="text-sm text-slate-500 mt-1">Выбрано гостей: <strong>{selectedIds.size}</strong>. Действие необратимо.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmBulkDeleteOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">Отмена</button>
                            <button onClick={() => { onBulkDelete(Array.from(selectedIds)); setSelectedIds(new Set()); setConfirmBulkDeleteOpen(false); }} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm">Удалить</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmNormalizeOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                        <div className="text-center mb-5">
                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Globe size={22} className="text-indigo-600"/>
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg">{t('normalizeCountries')}</h3>
                            <p className="text-sm text-slate-500 mt-1">Нормализация названий стран для всех клиентов.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmNormalizeOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">Отмена</button>
                            <button onClick={() => { onNormalizeCountries(); setConfirmNormalizeOpen(false); }} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm">Нормализовать</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmSyncOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                        <div className="text-center mb-5">
                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <RefreshCw size={22} className="text-emerald-600"/>
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg">Синхронизация гостей</h3>
                            <p className="text-sm text-slate-500 mt-1">Все активные гости с паспортными данными будут добавлены в базу клиентов (если их там ещё нет).</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmSyncOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">Отмена</button>
                            <button onClick={() => { onSyncFromGuests(); setConfirmSyncOpen(false); }} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm">Синхронизировать</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsView;

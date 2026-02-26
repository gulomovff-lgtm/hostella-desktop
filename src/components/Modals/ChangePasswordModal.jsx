import { useState } from 'react';
import { Lock, XCircle, AlertCircle } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';
import { verifyPassword, hashPassword } from '../../utils/hash';

const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

const ChangePasswordModal = ({ currentUser, users, onClose, onChangePassword, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setError('');

        const { match } = await verifyPassword(oldPassword, currentUser.pass);
        if (!match) {
            setError(t('wrongPassword'));
            return;
        }

        if (newPassword.length < 3) {
            setError('Пароль должен быть не менее 3 символов');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t('passwordsDontMatch'));
            return;
        }

        const hashed = await hashPassword(newPassword);
        onChangePassword(currentUser.id, hashed);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Lock size={20} className="text-indigo-600"/>
                        {t('changePassword')}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                        <XCircle size={20} className="text-slate-400"/>
                    </button>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                        <AlertCircle size={16}/>
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>{t('currentPassword')}</label>
                        <input
                            type="password"
                            className={inputClass}
                            value={oldPassword}
                            onChange={e => setOldPassword(e.target.value)}
                            placeholder="••••••"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>{t('newPassword')}</label>
                        <input
                            type="password"
                            className={inputClass}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="••••••"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>{t('confirmPassword')}</label>
                        <input
                            type="password"
                            className={inputClass}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleSubmit} className="flex-1" disabled={!oldPassword || !newPassword || !confirmPassword}>
                            {t('save')}
                        </Button>
                        <Button variant="secondary" onClick={onClose} className="flex-1">
                            {t('cancel')}
                        </Button>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
                    <strong>Текущий пользователь:</strong> {currentUser.name} ({currentUser.login})
                </div>
            </div>
        </div>
    );
};

export default ChangePasswordModal;

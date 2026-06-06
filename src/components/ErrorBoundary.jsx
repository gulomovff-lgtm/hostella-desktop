import React from 'react';
import { logSystemError } from '../utils/auditLog';

/**
 * Глобальный перехватчик ошибок отрисовки React.
 * Вместо «белого экрана» показывает понятный экран с кнопкой перезагрузки
 * и тихо отправляет отчёт об ошибке (Firestore + Telegram-алерт).
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, message: '' };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, message: error?.message || 'Unknown error' };
    }

    componentDidCatch(error, info) {
        try {
            logSystemError('react_render', error, {
                componentStack: (info?.componentStack || '').slice(0, 600),
                path: typeof window !== 'undefined' ? window.location?.hash || window.location?.pathname : '',
            });
        } catch { /* отчёт не должен мешать показу fallback */ }
    }

    handleReload = () => {
        try { window.location.reload(); } catch { /* ignore */ }
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div style={{
                minHeight: '100dvh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 18,
                padding: 24, textAlign: 'center', background: '#0f1e20', color: '#e2f7f8',
                fontFamily: 'system-ui, sans-serif',
            }}>
                <div style={{ fontSize: 48 }}>🛠️</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>Что-то пошло не так</div>
                <div style={{ fontSize: 14, color: '#9ecdd0', maxWidth: 420, lineHeight: 1.5 }}>
                    Произошла ошибка в приложении. Мы уже получили отчёт.
                    Попробуйте перезагрузить страницу.
                </div>
                <button
                    onClick={this.handleReload}
                    style={{
                        marginTop: 8, padding: '12px 28px', borderRadius: 14,
                        background: '#e88c40', color: '#fff', fontWeight: 700, fontSize: 15,
                        border: 'none', cursor: 'pointer',
                    }}
                >
                    🔄 Перезагрузить
                </button>
                {this.state.message && (
                    <div style={{
                        marginTop: 8, fontSize: 11, color: '#5b7d80', maxWidth: 420,
                        wordBreak: 'break-word', fontFamily: 'monospace',
                    }}>
                        {this.state.message}
                    </div>
                )}
            </div>
        );
    }
}

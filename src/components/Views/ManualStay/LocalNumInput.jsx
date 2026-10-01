import React, { useEffect, useState } from 'react';

const LocalNumInput = ({ value, onCommit, className, style, placeholder }) => {
    const [v, setV] = useState(value ?? '');
    useEffect(() => { setV(value ?? ''); }, [value]);
    return (
        <input type="number" min="0" value={v} placeholder={placeholder}
            onChange={e => setV(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => { if (String(v) !== String(value ?? '')) onCommit(v); }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            className={className} style={style} />
    );
};

// ── Мини-календарь периодов договора (месячная сетка, как Google Calendar) ──

export default LocalNumInput;

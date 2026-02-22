import { useState, useEffect, useCallback } from 'react';

const CBU_API   = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/all/';
const CACHE_KEY = 'cbu_rates_v2';
const CACHE_TTL = 3_600_000; // 1 час

export function useExchangeRate() {
    const [rates,     setRates    ] = useState(null);
    const [loading,   setLoading  ] = useState(true);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [error,     setError    ] = useState(false);

    const parseRates = (data) => {
        const map = {};
        data.forEach(item => {
            map[item.Ccy] = {
                rate: parseFloat(item.Rate),
                diff: parseFloat(item.Diff),
                date: item.Date,
                name: item.CcyNm_RU,
            };
        });
        return map;
    };

    const loadFromCache = () => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    };

    const fetchRates = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 8000);
            const res  = await fetch(CBU_API, { signal: ctrl.signal });
            clearTimeout(timer);
            const data = await res.json();
            const map  = parseRates(data);
            const now  = Date.now();
            setRates(map);
            setUpdatedAt(now);
            localStorage.setItem(CACHE_KEY, JSON.stringify({ map, time: now }));
        } catch {
            const cached = loadFromCache();
            if (cached) {
                setRates(cached.map);
                setUpdatedAt(cached.time);
            } else {
                setError(true);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const cached = loadFromCache();
        if (cached) {
            setRates(cached.map);
            setUpdatedAt(cached.time);
            setLoading(false);
            if (Date.now() - cached.time < CACHE_TTL) return; // свежий кеш
        }
        fetchRates();
    }, [fetchRates]);

    return { rates, loading, updatedAt, error, refresh: fetchRates };
}

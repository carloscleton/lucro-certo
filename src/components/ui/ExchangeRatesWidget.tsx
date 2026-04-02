import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface ExchangeData {
    USDBRL: { bid: string; pctChange: string; };
    EURBRL: { bid: string; pctChange: string; };
}

export function ExchangeRatesWidget() {
    const [data, setData] = useState<ExchangeData | null>(null);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL');
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error('Failed to fetch exchange rates', err);
            }
        };

        fetchRates();
        const interval = setInterval(fetchRates, 60000 * 5); // 5 minutes
        return () => clearInterval(interval);
    }, []);

    if (!data) return null;

    const renderRate = (currency: 'USD' | 'EUR', rate: { bid: string; pctChange: string }) => {
        const value = parseFloat(rate.bid).toFixed(2);
        const change = parseFloat(rate.pctChange);
        const isUp = change >= 0;

        return (
            <Tooltip content={`Variação Diária ${currency}/BRL: ${change > 0 ? '+' : ''}${change}%`}>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 rounded-full border border-gray-200 dark:border-slate-700/60 shadow-sm text-xs font-semibold hover:shadow transition-shadow cursor-default group">
                    {currency === 'USD' ? <span title="Dólar" className="opacity-90 group-hover:opacity-100 transition-opacity">🇺🇸</span> : <span title="Euro" className="opacity-90 group-hover:opacity-100 transition-opacity">🇪🇺</span>}
                    <span className="text-gray-700 dark:text-gray-300 tracking-tight">{currency}</span>
                    <span className="text-gray-400 font-normal">|</span>
                    <span className="text-gray-900 dark:text-white">R$ {value.replace('.', ',')}</span>
                    {isUp ? (
                        <TrendingUp size={12} className="text-emerald-500 ml-0.5" />
                    ) : (
                        <TrendingDown size={12} className="text-rose-500 ml-0.5" />
                    )}
                </div>
            </Tooltip>
        );
    };

    return (
        <div className="hidden xl:flex items-center gap-2 mx-4 animate-in fade-in duration-700">
            {data.USDBRL && renderRate('USD', data.USDBRL)}
            {data.EURBRL && renderRate('EUR', data.EURBRL)}
        </div>
    );
}

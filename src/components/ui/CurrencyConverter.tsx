import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, TrendingUp, Info } from 'lucide-react';

const FLAGS: Record<string, string> = {
  BRL: '🇧🇷',
  USD: '🇺🇸',
  EUR: '🇪🇺',
  PYG: '🇵🇾',
  ARS: '🇦🇷'
};

const INITIAL_RATES: Record<string, number> = {
  BRL: 1,
  USD: 5.0,
  EUR: 5.4,
  PYG: 0.0008, // 1 BRL = 1250 PYG approximately
  ARS: 0.0058  // 1 BRL = 172 ARS approximately
};

export const CurrencyConverter: React.FC = () => {
    const [fromCurrency, setFromCurrency] = useState('BRL');
    const [toCurrency, setToCurrency] = useState('PYG');
    const [fromAmount, setFromAmount] = useState<number | string>(30);
    const [toAmount, setToAmount] = useState<number | string>(0);
    const [rates, setRates] = useState<Record<string, number>>(INITIAL_RATES);

    // Fetch real rates from AwesomeAPI
    useEffect(() => {
        const fetchAllRates = async () => {
            try {
                // We fetch BRL based rates
                const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,PYG-BRL,ARS-BRL');
                if (res.ok) {
                    const json = await res.json();
                    const newRates = { ...INITIAL_RATES };
                    if (json.USDBRL) newRates.USD = parseFloat(json.USDBRL.bid);
                    if (json.EURBRL) newRates.EUR = parseFloat(json.EURBRL.bid);
                    if (json.PYGBRL) newRates.PYG = parseFloat(json.PYGBRL.bid);
                    if (json.ARSBRL) newRates.ARS = parseFloat(json.ARSBRL.bid);
                    setRates(newRates);
                }
            } catch (err) {
                console.error('Failed to fetch rates', err);
            }
        };
        fetchAllRates();
    }, []);

    const calculate = (amount: number, from: string, to: string) => {
        if (!amount) return 0;
        // Convert to BRL first as our base
        const amountInBRL = from === 'BRL' ? amount : amount * (rates[from] || 1);
        // Convert from BRL to target (wait, AwesomeAPI returns bid as "How much BRL is 1 USD?")
        // If 1 USD = 5 BRL, and I have 30 BRL, then 30 / 5 = 6 USD.
        // If 1 PYG = 0.0008 BRL, then 30 / 0.0008 = 37500 PYG.
        const result = to === 'BRL' ? amountInBRL : amountInBRL / (rates[to] || 1);
        return result;
    };

    useEffect(() => {
        const result = calculate(Number(fromAmount), fromCurrency, toCurrency);
        setToAmount(result.toFixed(2));
    }, [fromAmount, fromCurrency, toCurrency, rates]);

    const handleSwap = () => {
        const prevFrom = fromCurrency;
        setFromCurrency(toCurrency);
        setToCurrency(prevFrom);
        setFromAmount(toAmount);
    };

    const currentRate = calculate(1, fromCurrency, toCurrency).toFixed(4);

    return (
        <div className="bg-yellow-400 p-8 rounded-2xl shadow-xl max-w-4xl mx-auto font-sans text-gray-900 border-4 border-yellow-500 animate-in fade-in zoom-in duration-500">
            <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tighter leading-tight">
                Converta {(fromCurrency === 'BRL' ? 'Real Brasileiro' : fromCurrency)} para {(toCurrency === 'PYG' ? 'Guarani do Paraguai' : toCurrency)}
            </h1>
            <p className="text-lg font-medium mb-12 opacity-80">
                Acompanhe a cotação oficial e converta valores em tempo real para fins de faturamento e gestão.
            </p>

            <div className="flex flex-col md:flex-row items-center gap-4 relative">
                {/* FROM INPUT */}
                <div className="w-full bg-white rounded-xl border-2 border-gray-100 p-4 transition-all focus-within:ring-4 focus-within:ring-yellow-200 focus-within:border-gray-300">
                    <label className="text-xs uppercase font-bold text-gray-400 mb-1 block">Enviar valor</label>
                    <div className="flex items-center justify-between gap-4">
                        <input 
                            type="number" 
                            value={fromAmount}
                            onChange={(e) => setFromAmount(e.target.value)}
                            className="bg-transparent border-none text-3xl font-bold w-full focus:outline-none placeholder-gray-300"
                            placeholder="0"
                        />
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <span className="text-xl">{FLAGS[fromCurrency]}</span>
                            <span className="font-bold text-lg">{fromCurrency}</span>
                        </div>
                    </div>
                </div>

                {/* SWAP BUTTON */}
                <button 
                    onClick={handleSwap}
                    className="p-3 bg-white hover:bg-gray-50 rounded-full shadow-lg border border-gray-100 transition-all hover:scale-110 active:scale-95 z-10"
                >
                    <ArrowLeftRight size={24} className="text-gray-400" />
                </button>

                {/* TO INPUT */}
                <div className="w-full bg-white rounded-xl border-2 border-gray-100 p-4 transition-all focus-within:ring-4 focus-within:ring-yellow-200 focus-within:border-gray-300">
                    <label className="text-xs uppercase font-bold text-gray-400 mb-1 block">Destinatário recebe</label>
                    <div className="flex items-center justify-between gap-4">
                        <input 
                            type="text" 
                            value={toAmount}
                            readOnly
                            className="bg-transparent border-none text-3xl font-bold w-full focus:outline-none text-gray-700"
                        />
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <span className="text-xl">{FLAGS[toCurrency]}</span>
                            <select 
                                value={toCurrency}
                                onChange={(e) => setToCurrency(e.target.value)}
                                className="bg-transparent font-bold text-lg focus:outline-none cursor-pointer appearance-none pr-1"
                            >
                                {Object.keys(FLAGS).map(curr => (
                                    <option key={curr} value={curr}>{curr}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm font-semibold text-gray-900/80">
                <div className="flex items-center gap-1.5">
                    <TrendingUp size={18} className="text-black/60" />
                    <span>Taxa de câmbio: 1.00 {fromCurrency} = {currentRate} {toCurrency}</span>
                    <Tooltip content="Cotação atualizada via AwesomeAPI"><Info size={14} className="cursor-help" /></Tooltip>
                </div>
                <div>Tarifa de sistema: <span className="underline">0.00 {fromCurrency}</span></div>
            </div>
        </div>
    );
};

// Internal minimal tooltip for the component demo
const Tooltip: React.FC<{ content: string; children: React.ReactNode }> = ({ content, children }) => {
    return (
        <div className="relative group inline-block">
            {children}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {content}
            </div>
        </div>
    );
};

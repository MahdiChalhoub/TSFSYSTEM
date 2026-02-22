'use client';

import { useState } from 'react';
import { Delete } from 'lucide-react';
import clsx from 'clsx';

type NumpadMode = 'qty' | 'disc' | 'price';

export function Numpad({
    onValueConfirm,
    mode: initialMode = 'qty'
}: {
    onValueConfirm: (value: number, mode: NumpadMode) => void;
    mode?: NumpadMode;
}) {
    const [buffer, setBuffer] = useState('');
    const [mode, setMode] = useState<NumpadMode>(initialMode);

    const handleDigit = (d: string) => {
        if (d === '.' && buffer.includes('.')) return;
        setBuffer(prev => prev + d);
    };

    const handleBackspace = () => setBuffer(prev => prev.slice(0, -1));

    const handleConfirm = () => {
        const val = parseFloat(buffer);
        if (!isNaN(val) && val >= 0) {
            onValueConfirm(val, mode);
            setBuffer('');
        }
    };

    const modeLabels: Record<NumpadMode, string> = {
        qty: 'Qty',
        disc: 'Disc %',
        price: 'Price',
    };

    const modeColors: Record<NumpadMode, string> = {
        qty: 'bg-indigo-600 text-white',
        disc: 'bg-amber-500 text-white',
        price: 'bg-emerald-600 text-white',
    };

    return (
        <div className="flex flex-col gap-2">
            {/* Display */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{modeLabels[mode]}</span>
                <span className="flex-1 text-right text-xl font-black tabular-nums tracking-tighter text-gray-900">
                    {buffer || '0'}
                </span>
            </div>

            {/* Mode Selectors */}
            <div className="grid grid-cols-3 gap-1.5">
                {(['qty', 'disc', 'price'] as NumpadMode[]).map(m => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={clsx(
                            "py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                            mode === m ? modeColors[m] : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                    >
                        {modeLabels[m]}
                    </button>
                ))}
            </div>

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-1.5">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'].map(d => (
                    <button
                        key={d}
                        onClick={() => handleDigit(d)}
                        className="h-12 bg-white border border-gray-100 rounded-xl font-black text-lg text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                    >
                        {d}
                    </button>
                ))}
                <button
                    onClick={handleBackspace}
                    className="h-12 bg-white border border-gray-100 rounded-xl font-black text-gray-400 hover:bg-rose-50 hover:text-rose-500 active:scale-95 transition-all shadow-sm flex items-center justify-center"
                >
                    <Delete size={18} />
                </button>
            </div>

            {/* Confirm */}
            <button
                onClick={handleConfirm}
                disabled={!buffer}
                className={clsx(
                    "w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    buffer
                        ? `${modeColors[mode]} shadow-lg hover:opacity-90 active:scale-[0.98]`
                        : "bg-gray-100 text-gray-300 cursor-not-allowed"
                )}
            >
                Confirm {modeLabels[mode]}
            </button>
        </div>
    );
}

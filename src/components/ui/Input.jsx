import React from 'react';
import { cn } from '../../lib/utils';

export const Input = ({ label, type = "text", error, helper, className = "", ...props }) => (
    <div className="mb-5 group">
        {label && (
            <label className="block text-sm font-semibold text-slate-700 mb-2 transition-colors group-focus-within:text-indigo-600">
                {label}
            </label>
        )}
        <input
            type={type}
            className={cn(
                "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl",
                "focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500",
                "outline-none transition-all placeholder:text-slate-400",
                "disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed",
                error && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
                className
            )}
            onWheel={type === 'number' ? (e) => e.target.blur() : undefined}
            {...props}
        />
        {helper && !error && (
            <p className="text-xs text-slate-500 mt-1.5">{helper}</p>
        )}
        {error && (
            <p className="text-xs text-rose-500 mt-1.5">{error}</p>
        )}
    </div>
);

export const Select = ({ label, options = [], error, helper, className = "", placeholder, ...props }) => (
    <div className="mb-5 group">
        {label && (
            <label className="block text-sm font-semibold text-slate-700 mb-2 transition-colors group-focus-within:text-indigo-600">
                {label}
            </label>
        )}
        <div className="relative">
            <select
                className={cn(
                    "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl",
                    "focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500",
                    "outline-none transition-all appearance-none cursor-pointer",
                    "disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed",
                    error && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
                    className
                )}
                {...props}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map((opt, i) => (
                    <option key={opt.value || i} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
        {helper && !error && (
            <p className="text-xs text-slate-500 mt-1.5">{helper}</p>
        )}
        {error && (
            <p className="text-xs text-rose-500 mt-1.5">{error}</p>
        )}
    </div>
);

export const Textarea = ({ label, error, helper, className = "", ...props }) => (
    <div className="mb-5 group">
        {label && (
            <label className="block text-sm font-semibold text-slate-700 mb-2 transition-colors group-focus-within:text-indigo-600">
                {label}
            </label>
        )}
        <textarea
            className={cn(
                "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl",
                "focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500",
                "outline-none transition-all placeholder:text-slate-400 resize-none",
                "disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed",
                error && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
                className
            )}
            rows={4}
            {...props}
        />
        {helper && !error && (
            <p className="text-xs text-slate-500 mt-1.5">{helper}</p>
        )}
        {error && (
            <p className="text-xs text-rose-500 mt-1.5">{error}</p>
        )}
    </div>
);

export const Checkbox = ({ label, checked, onChange, disabled, className = "" }) => (
    <label className={cn("flex items-center gap-3 cursor-pointer group", disabled && "opacity-50 cursor-not-allowed", className)}>
        <div className={cn(
            "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center",
            checked ? "bg-indigo-600 border-indigo-600" : "border-slate-300 group-hover:border-indigo-400"
        )}>
            {checked && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
            )}
        </div>
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="sr-only"
        />
        {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
    </label>
);

export default Input;

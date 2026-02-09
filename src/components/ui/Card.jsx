import React from 'react';
import { cn } from '../../lib/utils';

export const Card = ({ children, className = "", noPadding = false, ...props }) => (
    <div
        className={cn(
            "bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300",
            noPadding ? '' : 'p-6',
            className
        )}
        {...props}
    >
        {children}
    </div>
);

export const StatCard = ({ title, value, icon: Icon, subtext, color = "blue", trend }) => {
    const styles = {
        blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
        green: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
        amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
        indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
        rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
        orange: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100" },
    };

    const currentStyle = styles[color] || styles.blue;

    return (
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 transition-transform hover:-translate-y-1 duration-300">
            <div className="flex items-start justify-between mb-4">
                <div className={cn("p-3 rounded-xl", currentStyle.bg, currentStyle.text)}>
                    {Icon && <Icon size={24} />}
                </div>
                {trend && (
                    <span className={cn(
                        "text-xs font-bold px-2 py-1 rounded-full",
                        trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
                {subtext && <p className="text-xs text-slate-400 mt-2 font-medium">{subtext}</p>}
            </div>
        </div>
    );
};

export default Card;

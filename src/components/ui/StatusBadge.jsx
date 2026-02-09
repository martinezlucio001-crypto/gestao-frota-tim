import React from 'react';
import { cn } from '../../lib/utils';

const statusStyles = {
    "Pendente": {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
        dot: "bg-amber-500"
    },
    "Pago Parcial": {
        bg: "bg-sky-50",
        text: "text-sky-700",
        border: "border-sky-200",
        dot: "bg-sky-500"
    },
    "Pago Total": {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        dot: "bg-emerald-500"
    }
};

export const StatusBadge = ({ status, size = "md" }) => {
    const style = statusStyles[status] || statusStyles["Pendente"];

    const sizeClasses = {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-3 py-1 text-xs",
        lg: "px-4 py-1.5 text-sm"
    };

    return (
        <div className="flex justify-center" title={status}>
            <span className={cn(
                "inline-flex items-center justify-center w-6 h-6 rounded-full border",
                style.bg, style.border
            )}>
                <span className={cn("w-2 h-2 rounded-full", style.dot)}></span>
            </span>
        </div>
    );
};

// Badge genérico para outros usos
export const Badge = ({ children, variant = "default", className = "" }) => {
    const variants = {
        default: "bg-slate-100 text-slate-700 border-slate-200",
        primary: "bg-indigo-50 text-indigo-700 border-indigo-200",
        success: "bg-emerald-50 text-emerald-700 border-emerald-200",
        warning: "bg-amber-50 text-amber-700 border-amber-200",
        danger: "bg-rose-50 text-rose-700 border-rose-200",
    };

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg border",
            variants[variant],
            className
        )}>
            {children}
        </span>
    );
};

export default StatusBadge;

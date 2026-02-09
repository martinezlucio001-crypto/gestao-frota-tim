import React from 'react';
import { cn } from '../../lib/utils';

// Variantes de botão seguindo o design system existente
const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300",
    secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm hover:border-slate-300",
    danger: "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100",
    ghost: "hover:bg-slate-100 text-slate-600",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200",
};

const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5",
    lg: "px-6 py-3 text-lg",
};

export const Button = ({
    children,
    onClick,
    variant = "primary",
    size = "md",
    className = "",
    disabled = false,
    type = "button",
    ...props
}) => {
    const baseStyle = "rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={cn(baseStyle, variants[variant], sizes[size], className)}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;

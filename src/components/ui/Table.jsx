import React from 'react';
import { cn } from '../../lib/utils';

export const Table = ({ children, className = "" }) => (
    <div className={cn("bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden", className)}>
        <div className="overflow-x-auto">
            <table className="w-full">
                {children}
            </table>
        </div>
    </div>
);

export const TableHeader = ({ children }) => (
    <thead className="bg-slate-50 border-b border-slate-100">
        {children}
    </thead>
);

export const TableBody = ({ children }) => (
    <tbody className="divide-y divide-slate-100">
        {children}
    </tbody>
);

export const TableRow = ({ children, onClick, className = "" }) => (
    <tr
        onClick={onClick}
        className={cn(
            "transition-colors",
            onClick && "cursor-pointer hover:bg-slate-50",
            className
        )}
    >
        {children}
    </tr>
);

export const TableHead = ({ children, className = "" }) => (
    <th className={cn(
        "px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider",
        className
    )}>
        {children}
    </th>
);

export const TableCell = ({ children, className = "" }) => (
    <td className={cn("px-6 py-4 text-sm text-slate-700", className)}>
        {children}
    </td>
);

// Componente para estado vazio
export const TableEmpty = ({ message = "Nenhum registro encontrado", icon: Icon }) => (
    <tr>
        <td colSpan={100} className="px-6 py-16 text-center">
            {Icon && (
                <div className="flex justify-center mb-4">
                    <div className="p-4 bg-slate-100 rounded-full">
                        <Icon className="w-8 h-8 text-slate-400" />
                    </div>
                </div>
            )}
            <p className="text-slate-500 font-medium">{message}</p>
        </td>
    </tr>
);

export default Table;

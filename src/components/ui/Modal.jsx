import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const ModalBackdrop = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
        <div
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
        >
            {children}
        </div>
        <div className="absolute inset-0 -z-10" onClick={onClose}></div>
    </div>
);

export const Modal = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon: Icon,
    iconBg = "bg-indigo-100",
    iconColor = "text-indigo-600",
    children,
    maxWidth = "max-w-lg"
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 transition-opacity duration-300">
            <div
                className={cn(
                    "bg-white w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col",
                    "rounded-t-2xl sm:rounded-3xl max-h-full sm:max-h-[90vh] h-[95vh] sm:h-auto",
                    maxWidth
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h2>
                        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        {Icon && (
                            <div className={cn("p-2 rounded-full", iconBg, iconColor)}>
                                <Icon size={24} />
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-8 overflow-y-auto flex-1">
                    {children}
                </div>
            </div>
            <div className="absolute inset-0 -z-10" onClick={onClose}></div>
        </div>
    );
};

export const ModalFooter = ({ children, className = "" }) => (
    <div className={cn("flex gap-4 mt-8 pt-4 border-t border-slate-100", className)}>
        {children}
    </div>
);

export default Modal;

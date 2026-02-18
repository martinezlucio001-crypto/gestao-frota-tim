
import React from 'react';
import { Truck, ExternalLink, ShieldCheck, ClipboardList, BarChart3, Users } from 'lucide-react';

const LandingPage = () => {
    const cards = [
        {
            title: 'Administração',
            description: 'Gestão completa da frota, custos e manutenção',
            icon: ShieldCheck,
            color: 'bg-indigo-600',
            href: '/admin',
            active: true
        },
        {
            title: 'Portal do Motorista',
            description: 'Registro de abastecimentos e manutenções',
            icon: Truck,
            color: 'bg-emerald-600',
            href: '/motorista',
            active: true
        },
        {
            title: 'Portal de Despachos STM',
            description: 'Controle de envio e recebimento de cargas (Santarém)',
            icon: ClipboardList,
            color: 'bg-blue-500',
            href: '#', // Placeholder
            active: false,
            badge: 'Em Breve'
        },
        {
            title: 'Portal de Controle BEL',
            description: 'Gestão logística e operacional (Belém)',
            icon: BarChart3,
            color: 'bg-amber-500',
            href: '#', // Placeholder
            active: false,
            badge: 'Em Breve'
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-5xl">

                {/* Header */}
                <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-4">
                        Gestão de Dados <span className="text-indigo-600">TIM Transportes</span>
                    </h1>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                        Central unificada para controle operacional, logístico e administrativo.
                    </p>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {cards.map((card, index) => (
                        <a
                            key={index}
                            href={card.active ? card.href : undefined}
                            className={`
                group relative bg-white rounded-2xl p-8 shadow-sm border border-slate-200 
                transition-all duration-300 
                ${card.active
                                    ? 'hover:shadow-xl hover:-translate-y-1 hover:border-indigo-100 cursor-pointer'
                                    : 'opacity-75 cursor-not-allowed grayscale-[0.5]'}
              `}
                            onClick={e => !card.active && e.preventDefault()}
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className={`p-4 rounded-xl ${card.color} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                    <card.icon size={32} />
                                </div>
                                {card.badge && (
                                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider rounded-full border border-slate-200">
                                        {card.badge}
                                    </span>
                                )}
                                {card.active && (
                                    <ExternalLink size={20} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                )}
                            </div>

                            <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-indigo-700 transition-colors">
                                {card.title}
                            </h3>
                            <p className="text-slate-500 leading-relaxed">
                                {card.description}
                            </p>
                        </a>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-16 text-center text-slate-400 text-sm">
                    <p>© {new Date().getFullYear()} TIM Transportes & Logística. Todos os direitos reservados.</p>
                </div>

            </div>
        </div>
    );
};

export default LandingPage;

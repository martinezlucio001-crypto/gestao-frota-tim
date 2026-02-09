import React from 'react';
import {
    TrendingUp,
    DollarSign,
    Package,
    Ship,
    Fuel,
    Truck,
    ArrowRight,
    AlertCircle
} from 'lucide-react';
import { StatCard, Card } from '../../components/ui';
import { formatCurrency } from '../../lib/utils';

const DashboardGeral = ({ onNavigate }) => {
    // TODO: Buscar dados reais do Firebase
    const stats = {
        totalPendente: 15750.00,
        totalPagoMes: 42380.00,
        despachosNoMes: 45,
        gastoCombustivelMes: 12500.00,
    };

    const quickLinks = [
        {
            title: 'Novo Despacho',
            description: 'Registrar um novo despacho',
            icon: Package,
            color: 'indigo',
            action: () => onNavigate('despacho-painel')
        },
        {
            title: 'Registrar Abastecimento',
            description: 'Lançar novo abastecimento',
            icon: Fuel,
            color: 'emerald',
            action: () => onNavigate('combustivel-dashboard')
        },
        {
            title: 'Gerenciar Frota',
            description: 'Visualizar veículos',
            icon: Truck,
            color: 'amber',
            action: () => onNavigate('combustivel-trucks')
        },
        {
            title: 'Servidores',
            description: 'Prestadores de serviço',
            icon: Ship,
            color: 'blue',
            action: () => onNavigate('despacho-servidores')
        },
    ];

    return (
        <div className="space-y-8">
            {/* Boas-vindas */}
            <div>
                <h1 className="text-3xl font-black text-slate-800">Bom dia! 👋</h1>
                <p className="text-slate-500 mt-1">Aqui está um resumo do seu negócio hoje.</p>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Pendente de Pagamento"
                    value={formatCurrency(stats.totalPendente)}
                    icon={AlertCircle}
                    color="amber"
                    subtext="Despachos aguardando pagamento"
                />
                <StatCard
                    title="Pago Este Mês"
                    value={formatCurrency(stats.totalPagoMes)}
                    icon={DollarSign}
                    color="green"
                    subtext="Total pago aos servidores"
                />
                <StatCard
                    title="Despachos no Mês"
                    value={stats.despachosNoMes}
                    icon={Package}
                    color="indigo"
                    subtext="Registros este mês"
                />
                <StatCard
                    title="Combustível"
                    value={formatCurrency(stats.gastoCombustivelMes)}
                    icon={Fuel}
                    color="rose"
                    subtext="Gasto com combustível"
                />
            </div>

            {/* Ações Rápidas */}
            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-4">Ações Rápidas</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {quickLinks.map((link, index) => (
                        <button
                            key={index}
                            onClick={link.action}
                            className="group bg-white rounded-2xl p-5 border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all text-left"
                        >
                            <div className={`w-12 h-12 rounded-xl bg-${link.color}-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                <link.icon className={`text-${link.color}-600`} size={24} />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-1">{link.title}</h3>
                            <p className="text-sm text-slate-500">{link.description}</p>
                            <div className="mt-3 flex items-center gap-1 text-indigo-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Acessar <ArrowRight size={16} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Alertas e Atividade Recente */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Alertas */}
                <Card>
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <AlertCircle className="text-amber-500" size={20} />
                        Alertas
                    </h3>
                    <div className="space-y-3">
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <p className="text-sm text-amber-700 font-medium">3 servidores com pagamento pendente</p>
                            <p className="text-xs text-amber-600 mt-1">Há mais de 7 dias</p>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                            <p className="text-sm text-rose-700 font-medium">2 veículos precisam de manutenção</p>
                            <p className="text-xs text-rose-600 mt-1">Verificar alertas</p>
                        </div>
                    </div>
                </Card>

                {/* Atividade Recente */}
                <Card>
                    <h3 className="font-bold text-slate-800 mb-4">Atividade Recente</h3>
                    <div className="space-y-4">
                        {[
                            { action: 'Novo despacho registrado', details: 'Santarém → Itaituba', time: '2 min atrás' },
                            { action: 'Pagamento efetuado', details: 'R$ 1.250,00 - Barco Amazônia', time: '1 hora atrás' },
                            { action: 'Abastecimento registrado', details: 'RXH6E81 - 200L', time: '3 horas atrás' },
                        ].map((item, index) => (
                            <div key={index} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2"></div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-700">{item.action}</p>
                                    <p className="text-xs text-slate-500">{item.details}</p>
                                </div>
                                <span className="text-xs text-slate-400">{item.time}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default DashboardGeral;

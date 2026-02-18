import React from 'react';
import App from '../../App';

/**
 * Módulo de Combustível Wrapper
 * Integra o App.jsx existente ao novo sistema unificado.
 */
const CombustivelModule = ({ view, user }) => {
    // Mapeamento de views do novo sistema para o App legado
    const viewMapping = {
        'dashboard': 'dashboard',
        'trucks': 'trucks',
        'maintenance': 'maintenance',
        'data': 'data-management'
    };

    const targetView = viewMapping[view] || 'dashboard';

    return (
        <div className="w-full">
            <App
                embedded={true}
                user={user}
                externalView={targetView}
                onNavigate={(newView) => {
                    // O App pode tentar navegar internamente, mas como estamos controlando via prop,
                    // o ideal seria que ele notificasse o pai.
                    // Por enquanto, o App muda seu estado interno 'view' via useEffect se externalView mudar.
                    // Se o usuário clicar em algo dentro do App que mude a view, o App muda seu estado local.
                    // Isso é aceitável para navegação interna do módulo.
                }}
            />
        </div>
    );
};

export default CombustivelModule;

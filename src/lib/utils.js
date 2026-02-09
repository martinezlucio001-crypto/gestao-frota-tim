// Funções utilitárias compartilhadas

// Formatar data BR (DD/MM/YYYY)
export const formatDateBR = (dateString) => {
    if (!dateString) return '-';
    const parts = dateString.split('T')[0].split('-');
    if (parts.length !== 3) return dateString;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
};

// Parse seguro de datas
export const parseDateSafe = (dateString) => {
    if (!dateString) return new Date(0);
    const str = String(dateString).split('T')[0];
    if (str.includes('/')) {
        const [day, month, year] = str.split('/');
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    const [year, month, day] = str.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day));
};

// Formatar moeda BRL
export const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

// Formatar número com separador de milhar
export const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined) return '0';
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
};

// Converter arquivo para Base64
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

// Gerar ID único simples
export const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Verificar se rota é bidirecional (origem ↔ destino)
export const routeMatches = (serverRoutes, origin, destination) => {
    return serverRoutes.some(route =>
        (route.origem === origin && route.destino === destination) ||
        (route.origem === destination && route.destino === origin)
    );
};

// Classes CSS condicionais (similar ao clsx)
export const cn = (...classes) => {
    return classes.filter(Boolean).join(' ');
};

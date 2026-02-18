// Lista de 20 cidades do Pará para uso nos dropdowns
export const CITIES = [
    "Alenquer",
    "Almeirim",
    "Aveiro",
    "Belterra",
    "Castelo de Sonhos",
    "Faro",
    "Itaituba",
    "Jacareacanga",
    "Juruti",
    "Mojuí dos Campos",
    "Monte Alegre",
    "Monte Dourado",
    "Novo Progresso",
    "Óbidos",
    "Oriximiná",
    "Prainha",
    "Rurópolis",
    "Santarém",
    "Terra Santa",
    "Trairão",
    "Trombetas"
];

// Tipos de carga disponíveis
export const CARGO_TYPES = [
    { value: "FNDE (Livros)", label: "FNDE (Livros)", onlyFromSantarem: true },
    { value: "Postal", label: "Postal", onlyFromSantarem: false },
    { value: "Densa", label: "Densa", onlyFromSantarem: false }
];

// Unidades de precificação
export const PRICING_UNITS = [
    { value: "kg", label: "Quilograma (Kg)" },
    { value: "volume", label: "Volume" },
    { value: "palete", label: "Palete" }
];

// Status financeiro
export const FINANCIAL_STATUS = [
    { value: "Pendente", label: "Pendente", color: "amber" },
    { value: "Pago Parcial", label: "Pago Parcial", color: "orange" },
    { value: "Pago Total", label: "Pago Total", color: "green" }
];

// Formas de pagamento
export const PAYMENT_METHODS = [
    { value: "PIX", label: "PIX" },
    { value: "TED", label: "TED" },
    { value: "Dinheiro", label: "Dinheiro" },
    { value: "Cheque", label: "Cheque" },
    { value: "Outro", label: "Outro" }
];

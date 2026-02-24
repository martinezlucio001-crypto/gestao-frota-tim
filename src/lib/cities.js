export const CITIES = [
    "AC ALENQUER",
    "AC ALMEIRIM",
    "AC AVEIRO",
    "AC BELTERRA",
    "AC CASTELO DOS SONHOS",
    "AC FARO",
    "AC ITAITUBA",
    "AC JACAREACANGA",
    "AC JURUTI",
    "AC MOJUI DOS CAMPOS",
    "AC MONTE ALEGRE",
    "AC MONTE DOURADO",
    "AC NOVO PROGRESSO",
    "AC OBIDOS",
    "AC ORIXIMINA",
    "AC PRAINHA",
    "AC RUROPOLIS",
    "AC SANTAREM",
    "CDD SANTAREM",
    "AC TERRA SANTA",
    "AC TRAIRAO",
    "AC PORTO TROMBETAS"
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

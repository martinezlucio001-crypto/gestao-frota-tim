import re
from bs4 import BeautifulSoup

# Copied from api/sync_emails.py for local testing
def limpar_html(texto):
    if not texto: return ""
    texto = re.sub(r'<[^>]+>', ' ', texto) 
    texto = texto.replace('&nbsp;', ' ').replace('=', '').strip()
    texto = re.sub(r'\s+', ' ', texto)
    return texto

def parse_email_html(html_content):
    dados = {
        "nota": None,
        "itens": [],
        "origem": "Desconhecida",
        "destino": "Desconhecido",
        "data_ocorrencia": None,
        "qtde_unitizadores": 0,
        "peso_total_declarado": 0.0,
        "peso_total_calculado": 0.0,
        "tipo_movimento": "DESCONHECIDO"
    }
    
    if not html_content: return None

    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 1. Regex Backup for Note Number
        text_content = soup.get_text()
        match_nota = re.search(r'(NN\d+)', text_content)
        if match_nota:
            dados["nota"] = match_nota.group(1)

        # 2. Extract Table Items
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all(['td', 'th'])
                
                # Skip Header Rows
                if any(c.name == 'th' for c in cols):
                    continue
                
                # Robust Header Check (case insensitive)
                col0_text = limpar_html(str(cols[0])).lower() if cols else ""
                col1_text = limpar_html(str(cols[1])).lower() if len(cols) > 1 else ""
                
                if 'nota de despacho' in col0_text or 'origem' in col1_text:
                    continue

                # New Structure expected (approx 9 columns):
                # 0:Nota, 1:Origem, 2:Destino, 3:Data, 4:QtdeUnit, 5:PesoTotal, 6:ListUnit, 7:ListLacre, 8:ListPeso
                if len(cols) >= 9:
                    idx_nota = 0
                    idx_origem = 1
                    idx_destino = 2
                    idx_data = 3
                    idx_qtde = 4
                    idx_peso_total = 5
                    idx_list_unit = 6
                    idx_list_lacre = 7
                    idx_list_peso = 8

                    # Extract scalar values from the first valid data row found
                    if dados["origem"] == "Desconhecida":
                        # If finding Nota in column, prefer it or cross-check
                        col_nota = limpar_html(str(cols[idx_nota]))
                        if "NN" in col_nota and not dados["nota"]:
                            dados["nota"] = col_nota
                        
                        dados["origem"] = limpar_html(str(cols[idx_origem]))
                        dados["destino"] = limpar_html(str(cols[idx_destino]))
                        dados["data_ocorrencia"] = limpar_html(str(cols[idx_data]))
                        
                        try:
                            raw_qtde = limpar_html(str(cols[idx_qtde]))
                            match_int = re.search(r'(\d+)', raw_qtde)
                            if match_int:
                                dados["qtde_unitizadores"] = int(match_int.group(1))
                        except: pass
                        
                        try:
                            p_str = limpar_html(str(cols[idx_peso_total])).replace('.', '').replace(',', '.').replace('Kg', '').strip()
                            dados["peso_total_declarado"] = float(p_str)
                        except: pass

                    # Helper to process lists
                    def get_clean_list(col):
                        for br in col.find_all('br'): br.replace_with(' ')
                        text = col.get_text(separator=' ', strip=True)
                        text = text.replace('&nbsp;', ' ').replace('=', '').replace('?', '')
                        return text.split()

                    raw_units = get_clean_list(cols[idx_list_unit])
                    raw_lacres = get_clean_list(cols[idx_list_lacre])
                    raw_pesos = get_clean_list(cols[idx_list_peso])
                    
                    max_len = max(len(raw_units), len(raw_lacres), len(raw_pesos))
                    for i in range(max_len):
                        unit_val = raw_units[i] if i < len(raw_units) else "?"
                        # Filter noise
                        if len(unit_val) < 4 or unit_val.lower() in ['unitizador', 'lacre', 'objeto']:
                            continue
                        
                        peso_str = raw_pesos[i] if i < len(raw_pesos) else "0"
                        peso_val = 0.0
                        try:
                            cl_peso = peso_str.replace('.', '').replace(',', '.').replace('Kg', '').strip()
                            peso_val = float(cl_peso)
                        except: pass

                        item = {
                            "unitizador": unit_val,
                            "lacre": raw_lacres[i] if i < len(raw_lacres) else "?",
                            "peso": peso_val,
                            "conferido": False
                        }
                        dados["itens"].append(item)

        if dados["itens"]:
            dados["peso_total_calculado"] = sum(item["peso"] for item in dados["itens"])

    except Exception as e:
        print(f"Erro no parsing HTML: {e}")
        return None
        
    return dados


# --- MOCK DATA ---
html_exemplo = """
<html>
<body>
    <p>Seguem dados da Nota: <strong>NN888888</strong></p>
    <table border="1">
        <thead>
            <tr>
                <td>Nota de Despacho</td> <!-- Header masked as td -->
                <td>Origem</td>
                <td>Destino</td>
                <td>Data/Hora Recebimento</td>
                <td>Qtde Unitizadores</td>
                <td>Peso total (kg)</td>
                <td>Unitizador</td>
                <td>Lacre/Objeto</td>
                <td>Peso(Kg)</td>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>NN888888</td>
                <td>Santarém</td>
                <td>Alenquer</td>
                <td>09/02/2026 14:30</td>
                <td>2</td>
                <td>1.500,50 Kg</td>
                <td>
                    UC001<br>
                    UC002
                </td>
                <td>
                    LACRE01<br>
                    LACRE02
                </td>
                <td>
                    500,00<br>
                    1.000,50
                </td>
            </tr>
        </tbody>
    </table>
</body>
</html>
"""

if __name__ == "__main__":
    print("-" * 30)
    print("Iniciando Teste Local de Parsing (Nova Estrutura)")
    print("-" * 30)
    
    resultado = parse_email_html(html_exemplo)
    
    if resultado:
        print(f"Nota Encontrada: {resultado['nota']}")
        print(f"Origem: {resultado['origem']}")
        # print(f"Destino: {resultado['destino']}")
        # print(f"Data Ocorrência: {resultado['data_ocorrencia']}")
        print(f"Qtde Unitizadores: {resultado['qtde_unitizadores']}")
        print(f"Peso Total Declarado: {resultado['peso_total_declarado']}")
        print(f"Peso Total Calculado: {resultado['peso_total_calculado']}")
        print("-" * 15)
        print("Itens Detalhados:")
        for item in resultado['itens']:
            print(item)
        
        print("-" * 30)
        # Verificações (Assertions) with try-except for debugging
        try:
            assert resultado['nota'] == "NN888888", "Nota mismatch"
            assert resultado['origem'] == "Santarém", "Origem mismatch"
            assert resultado['qtde_unitizadores'] == 2, f"Qtde mismatch: {resultado['qtde_unitizadores']}"
            assert resultado['peso_total_declarado'] == 1500.50, f"Peso mismatch: {resultado['peso_total_declarado']}"
            assert len(resultado['itens']) == 2, f"Len Itens mismatch: {len(resultado['itens'])}"
            assert resultado['peso_total_calculado'] == 1500.50, f"Peso Calc mismatch: {resultado['peso_total_calculado']}"
            print("SUCESSO: Nova lógica de parsing validada!")
        except AssertionError as e:
            print(f"FALHA NA ASSERTION: {e}")

    else:
        print("FALHA: Nenhum dado retornado.")

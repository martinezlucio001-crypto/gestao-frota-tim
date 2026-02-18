import os.path
import base64
import re
import json
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from bs4 import BeautifulSoup
from datetime import datetime

# --- CONFIGURATION ---
SCOPES = ['https://www.googleapis.com/auth/gmail.modify']
LABEL_NAME = "ROBO_TIM"
MAX_EMAILS = 10

# --- PARSING LOGIC (COPIED FROM sync_emails.py) ---
def limpar_html(texto):
    if not texto: return ""
    texto = re.sub(r'<[^>]+>', ' ', texto) 
    texto = texto.replace('&nbsp;', ' ').replace('=', '').strip()
    texto = re.sub(r'\s+', ' ', texto)
    return texto

def clean_city_name(name):
    if not name: return "Desconhecida"
    name = re.sub(r'^(CDD|AC|UD|AG|CTO|TECA)\s+', '', name, flags=re.IGNORECASE)
    return name.title()

def parse_email_html(html_content, subject=""):
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
                if any(c.name == 'th' for c in cols): continue
                
                col0_text = limpar_html(str(cols[0])).lower() if cols else ""
                col1_text = limpar_html(str(cols[1])).lower() if len(cols) > 1 else ""
                
                if 'nota de despacho' in col0_text or 'origem' in col1_text: continue

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

                    if dados["origem"] == "Desconhecida":
                        col_nota = limpar_html(str(cols[idx_nota]))
                        if "NN" in col_nota and not dados["nota"]:
                            dados["nota"] = col_nota
                        
                        dados["origem"] = clean_city_name(limpar_html(str(cols[idx_origem])))
                        dados["destino"] = clean_city_name(limpar_html(str(cols[idx_destino])))
                        dados["data_ocorrencia"] = limpar_html(str(cols[idx_data]))
                        
                        try:
                            raw_qtde = limpar_html(str(cols[idx_qtde]))
                            match_int = re.search(r'(\d+)', raw_qtde)
                            if match_int: dados["qtde_unitizadores"] = int(match_int.group(1))
                        except: pass
                        
                        try:
                            p_str = limpar_html(str(cols[idx_peso_total])).replace('.', '').replace(',', '.').replace('Kg', '').strip()
                            dados["peso_total_declarado"] = float(p_str)
                        except: pass

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
                        unit_val = raw_units[i] if i < len(raw_units) else ""
                        if len(unit_val) < 4 or unit_val.lower() in ['unitizador', 'lacre', 'objeto']: continue
                        
                        peso_str = raw_pesos[i] if i < len(raw_pesos) else "0"
                        peso_val = 0.0
                        try:
                            cl_peso = peso_str.replace('.', '').replace(',', '.').replace('Kg', '').strip()
                            peso_val = float(cl_peso)
                        except: pass

                        item = {
                            "unitizador": unit_val,
                            "lacre": raw_lacres[i] if i < len(raw_lacres) else "",
                            "peso": peso_val
                        }
                        dados["itens"].append(item)

        if dados["itens"]:
            dados["peso_total_calculado"] = sum(item["peso"] for item in dados["itens"])

        # Check Movement Type based on Subject
        is_entrada = "Recebimento de Carga" in subject or "Recebimento de carga" in subject
        is_saida = "Devolução de carga" in subject or "Devolução de Carga" in subject

        if is_entrada: dados["tipo_movimento"] = "RECEBIMENTO"
        elif is_saida: dados["tipo_movimento"] = "DEVOLUCAO"
        else: dados["tipo_movimento"] = "NAO_IDENTIFICADO"

    except Exception as e:
        print(f"Erro no parsing: {e}")
        return None
        
    return dados

# --- MAIN DEBUG LOGIC ---
def main():
    print("🚀 INICIANDO DIAGNÓSTICO DO ROBÔ...")
    
    # AUTH
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except RefreshError:
                print("⚠️ [AVISO] Token expirado ou revogado. Excluindo e solicitando novo login...")
                os.remove('token.json')
                creds = None
        
        if not creds:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    service = build('gmail', 'v1', credentials=creds)

    # CHECK LABEL
    results = service.users().labels().list(userId='me').execute()
    labels = results.get('labels', [])
    label_id = next((l['id'] for l in labels if l['name'] == LABEL_NAME), None)

    if not label_id:
        print(f"❌ [FALHA] Label '{LABEL_NAME}' não encontrada.")
        return
    print(f"✅ [SUCESSO] Label '{LABEL_NAME}' encontrada (ID: {label_id})")

    # FETCH EMAILS
    print(f"\n🔍 Buscando até {MAX_EMAILS} e-mails na label '{LABEL_NAME}'...")
    results = service.users().messages().list(userId='me', labelIds=[label_id], maxResults=MAX_EMAILS).execute()
    messages = results.get('messages', [])

    if not messages:
        print("⚠️ [AVISO] Nenhum e-mail encontrado na pasta.")
        return

    print(f"✅ [SUCESSO] Encontrados {len(messages)} e-mails. Analisando os mais recentes...")

    for msg in messages:
        print("\n---------------------------------------------------")
        msg_detail = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
        headers = msg_detail['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "Sem Assunto")
        date = next((h['value'] for h in headers if h['name'] == 'Date'), "Sem Data")
        
        print(f"📧 E-mail ID: {msg['id']}")
        print(f"📅 Data: {date}")
        print(f"📝 Assunto: {subject}")

        # Check Subject Patterns
        is_entrada = "Recebimento de Carga" in subject or "Recebimento de carga" in subject
        is_saida = "Devolução de carga" in subject or "Devolução de Carga" in subject
        
        if is_entrada:
            print("   ↳ 🟢 Tipo detectado: RECEBIMENTO (Entrada)")
        elif is_saida:
            print("   ↳ 🔵 Tipo detectado: DEVOLUÇÃO (Saída)")
        else:
            print("   ↳ 🔴 [ALERTA] Tipo NÃO detectado pelo Assunto! (Verifique se mudou o padrão)")

        # Get HTML
        html_body = None
        if 'parts' in msg_detail['payload']:
            for part in msg_detail['payload']['parts']:
                if part['mimeType'] == 'text/html':
                    html_body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                    break
        elif msg_detail['payload'].get('mimeType') == 'text/html':
             html_body = base64.urlsafe_b64decode(msg_detail['payload']['body']['data']).decode('utf-8')

        if not html_body:
            print("   ↳ ❌ [ERRO] Não foi possível extrair o corpo HTML.")
            continue

        # Test Parse
        try:
            dados = parse_email_html(html_body, subject)
            if not dados['nota']:
                print("   ↳ ❌ [ERRO] O parser não encontrou o Número da Nota (NN...). Estrutura do HTML mudou?")
            else:
                print(f"   ↳ ✅ [OK] Nota: {dados['nota']}")
                print(f"   ↳    Origem: {dados['origem']} -> Destino: {dados['destino']}")
                print(f"   ↳    Itens identificados: {len(dados['itens'])}")
        except Exception as e:
             print(f"   ↳ ❌ [CRÍTICO] Erro ao parsear HTML: {e}")

    # FINAL REPORT
    if creds and creds.refresh_token:
        print("\n\n" + "="*60)
        print("🔑 NOVO REFRESH TOKEN GERADO (Copie para a Vercel):")
        print(creds.refresh_token)
        print("="*60 + "\n")
    else:
        print("\n⚠️ AVISO: Não foi possível obter o Refresh Token nesta execução.")

if __name__ == '__main__':
    main()

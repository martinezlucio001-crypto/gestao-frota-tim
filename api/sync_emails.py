from http.server import BaseHTTPRequestHandler
import os
import json
import base64
import re
from urllib.parse import urlparse, parse_qs
from datetime import datetime

# Bibliotecas de Terceiros
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# -------------------------------------------------------------------------
# CONFIGURAÇÃO E CONSTANTES
# -------------------------------------------------------------------------
MAX_EMAILS_PER_RUN = 3
LABEL_NAME = "ROBO_TIM"
COLLECTION_NAME = "tb_despachos_conferencia"

# -------------------------------------------------------------------------
# FUNÇÕES AUXILIARES DE PARSING
# -------------------------------------------------------------------------
def limpar_html(texto):
    if not texto: return ""
    texto = re.sub(r'<[^>]+>', ' ', texto) # Remove tags
    texto = texto.replace('&nbsp;', ' ').replace('=', '').strip()
    texto = re.sub(r'\s+', ' ', texto) # Remove espaços duplos
    return texto

def parse_email_html(html_content):
    """
    Extrai dados da nota e itens da tabela HTML.
    Retorna dict ou None se falhar.
    """
    dados = {
        "nota": None,
        "itens": [],
        "origem": "Desconhecida",
        "destino": "Desconhecido",
        "peso_total": 0.0
    }
    
    if not html_content: return None

    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 1. Extrair Nota
        text_content = soup.get_text()
        match_nota = re.search(r'(NN\d+)', text_content)
        if match_nota:
            dados["nota"] = match_nota.group(1)
        else:
            print("AVISO: Nenhuma nota 'NN...' encontrada no email.")
            return None

        # 2. Extrair Tabela de Itens
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all(['td', 'th'])
                # Heurística: Linhas de dados costumam ter várias colunas
                if len(cols) >= 6:
                    # Índices estimados (Ajustar conforme layout real)
                    # 0:Origem, 1:Destino, ..., 5:Unitizador, 6:Lacre, 7:Peso
                    idx_origem, idx_destino = 0, 1
                    idx_unit, idx_lacre, idx_peso = 5, 6, 7
                    
                    if len(cols) > idx_peso:
                         # Pega Origem/Destino da primeira linha válida
                        if dados["origem"] == "Desconhecida":
                             dados["origem"] = limpar_html(str(cols[idx_origem]))
                             dados["destino"] = limpar_html(str(cols[idx_destino]))
                        
                        # --- LÓGICA DE LIMPEZA APERFEIÇOADA ---
                        def get_clean_list(col):
                            # Troca <br> por espaço
                            for br in col.find_all('br'): br.replace_with(' ')
                            # Limpa caracteres indesejados
                            text = col.get_text(separator=' ', strip=True)
                            text = text.replace('&nbsp;', ' ').replace('=', '').replace('?', '')
                            return text.split()

                        raw_units = get_clean_list(cols[idx_unit])
                        raw_lacres = get_clean_list(cols[idx_lacre])
                        raw_pesos = get_clean_list(cols[idx_peso])
                        
                        # Pareamento
                        max_len = max(len(raw_units), len(raw_lacres), len(raw_pesos))
                        for i in range(max_len):
                            unit_val = raw_units[i] if i < len(raw_units) else "?"
                            
                            # FILTRAGEM DE LIXO
                            # Ignora se muito curto ou se for cabeçalho
                            if len(unit_val) < 4 or unit_val.lower() in ['unitizador', 'lacre']:
                                continue

                            peso_str = raw_pesos[i] if i < len(raw_pesos) else "0"
                            peso_val = 0.0
                            try:
                                peso_val = float(peso_str.replace(',', '.').replace('Kg', ''))
                            except: pass

                            item = {
                                "unitizador": unit_val,
                                "lacre": raw_lacres[i] if i < len(raw_lacres) else "?",
                                "peso": peso_val,
                                "conferido": False
                            }
                            dados["itens"].append(item)

        # 3. Calcula Peso Total
        if dados["itens"]:
            dados["peso_total"] = sum(item["peso"] for item in dados["itens"])

    except Exception as e:
        print(f"Erro no parsing HTML: {e}")
        return None
        
    return dados

# -------------------------------------------------------------------------
# HANDLER PRINCIPAL (VERCEL)
# -------------------------------------------------------------------------
class handler(BaseHTTPRequestHandler):
    
    def do_GET(self):
        self.process_request()

    def do_POST(self):
        self.process_request()

    def process_request(self):
        # 1. Autenticação (CRON_SECRET)
        query = parse_qs(urlparse(self.path).query)
        key = query.get('key', [None])[0]
        cron_secret = os.environ.get('CRON_SECRET')
        
        if not cron_secret or key != cron_secret:
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"Unauthorized")
            return

        try:
            # 2. Inicializar Firebase (Singleton)
            if not firebase_admin._apps:
                firebase_creds_str = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
                
                # Tratamento robusto de JSON
                if not firebase_creds_str:
                    raise Exception("FIREBASE_SERVICE_ACCOUNT not configured")
                
                try:
                    # Tenta decodificar Base64 se parecer ser um
                    if "{" not in firebase_creds_str[:5]: 
                        firebase_creds_str = base64.b64decode(firebase_creds_str).decode('utf-8')
                except:
                    pass # Se falhar, assume que é string JSON normal
                
                # Trata quebras de linha escapadas
                firebase_creds_dict = json.loads(firebase_creds_str.replace('\\n', '\n'))
                
                cred = credentials.Certificate(firebase_creds_dict)
                firebase_admin.initialize_app(cred)

            db = firestore.client()

            # 3. Conexão Gmail (OAuth2)
            gmail_creds = Credentials(
                None, # token (acesso) é gerado pelo refresh
                refresh_token=os.environ.get('GOOGLE_REFRESH_TOKEN'),
                token_uri="https://oauth2.googleapis.com/token",
                client_id=os.environ.get('GOOGLE_CLIENT_ID'),
                client_secret=os.environ.get('GOOGLE_CLIENT_SECRET')
            )
            
            # Atualiza o token se necessário (auto)
            if not gmail_creds.valid:
                gmail_creds.refresh(Request())

            service = build('gmail', 'v1', credentials=gmail_creds)

            # 4. Buscar Label ID
            results = service.users().labels().list(userId='me').execute()
            labels = results.get('labels', [])
            label_id = next((l['id'] for l in labels if l['name'] == LABEL_NAME), None)

            if not label_id:
                self.respond_success("Label ROBO_TIM não encontrada no Gmail.")
                return

            # 5. Buscar E-mails
            results = service.users().messages().list(
                userId='me', 
                labelIds=[label_id], 
                maxResults=MAX_EMAILS_PER_RUN
            ).execute()
            messages = results.get('messages', [])

            processed_count = 0
            
            if not messages:
                self.respond_success("Nenhum e-mail pendente.")
                return

            print(f"Encontrados {len(messages)} e-mails.")

            # 6. Processar E-mails
            for msg in messages:
                try:
                    msg_detail = service.users().messages().get(
                        userId='me', id=msg['id'], format='full'
                    ).execute()
                    
                    headers = msg_detail['payload']['headers']
                    subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "")
                    date_header = next((h['value'] for h in headers if h['name'] == 'Date'), "")
                    
                    # Extrair corpo HTML
                    html_body = ""
                    if 'parts' in msg_detail['payload']:
                        for part in msg_detail['payload']['parts']:
                            if part['mimeType'] == 'text/html':
                                html_body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                                break
                    elif msg_detail['payload']['mimeType'] == 'text/html':
                        html_body = base64.urlsafe_b64decode(msg_detail['payload']['body']['data']).decode('utf-8')

                    # Parsear dados
                    parsed_data = parse_email_html(html_body)
                    
                    if parsed_data and parsed_data['nota']:
                        nota_id = parsed_data['nota']
                        print(f"Processando Nota: {nota_id} | Assunto: {subject}")
                        
                        doc_ref = db.collection(COLLECTION_NAME).document(nota_id)
                        
                        # Lógica de Negócio
                        is_entrada = "Recebimento de Carga" in subject
                        is_saida = "Devolução de carga" in subject
                        
                        if is_entrada:
                            # CENÁRIO A: ENTRADA
                            doc_snap = doc_ref.get()
                            if not doc_snap.exists:
                                doc_ref.set({
                                    "nota_despacho": nota_id,
                                    "status": "RECEBIDO",
                                    "data_recebimento": date_header, # Mantem formato original string
                                    "data_entrega": None,
                                    "origem": parsed_data['origem'],
                                    "destino": parsed_data['destino'],
                                    "peso_total": parsed_data['peso_total'],
                                    "itens": parsed_data['itens'],
                                    "criado_em": firestore.SERVER_TIMESTAMP
                                })
                            else:
                                print(f"Nota {nota_id} já existe. Ignorando entrada.")

                        elif is_saida:
                            # CENÁRIO B: SAÍDA (Devolução)
                            # Força atualização/criação com status ENTREGUE
                            doc_ref.set({
                                "status": "ENTREGUE",
                                "data_entrega": date_header,
                                # Se não existir, preenche o básico (Fallback)
                                "nota_despacho": nota_id, 
                            }, merge=True)
                        
                        # 7. Remover Label (Cleanup)
                        service.users().messages().batchModify(
                            userId='me',
                            body={
                                'ids': [msg['id']],
                                'removeLabelIds': [label_id]
                            }
                        ).execute()
                        
                        processed_count += 1
                    else:
                        print(f"Falha ao parsear nota do email {msg['id']}")

                except Exception as e:
                    print(f"Erro ao processar mensagem {msg['id']}: {e}")
                    # Continua para o próximo email

            self.respond_success(f"Processados {processed_count} e-mails.")

        except Exception as e:
            print(f"Erro Crítico: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Internal Error: {str(e)}".encode())

    def respond_success(self, message):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "success", "message": message}).encode())

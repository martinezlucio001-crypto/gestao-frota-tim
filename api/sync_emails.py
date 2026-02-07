from http.server import BaseHTTPRequestHandler
import os
import json
import base64
import re
from urllib.parse import urlparse, parse_qs
from datetime import datetime
import requests

# Third-party libraries
from bs4 import BeautifulSoup
from google.oauth2.credentials import Credentials
from google.oauth2 import service_account
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# -------------------------------------------------------------------------
# CONSTANTS & CONFIGURATION
# -------------------------------------------------------------------------
MAX_EMAILS_PER_RUN = 3
LABEL_NAME = "ROBO_TIM"
COLLECTION_NAME = "tb_despachos_conferencia"

# -------------------------------------------------------------------------
# FIRESTORE REST API HELPERS
# -------------------------------------------------------------------------
class FirestoreClient:
    def __init__(self, service_account_info):
        self.project_id = service_account_info.get("project_id")
        self.base_url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents"
        
        # Authenticate using service account
        self.creds = service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=["https://www.googleapis.com/auth/datastore"]
        )

    def _get_token(self):
        if not self.creds.valid:
            self.creds.refresh(Request())
        return self.creds.token

    def _headers(self):
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json"
        }

    def get_document(self, collection, doc_id):
        url = f"{self.base_url}/{collection}/{doc_id}"
        response = requests.get(url, headers=self._headers())
        if response.status_code == 200:
            return response.json()
        if response.status_code == 404:
            return None
        raise Exception(f"Firestore GET Error {response.status_code}: {response.text}")

    def create_document(self, collection, doc_id, data):
        """Creates or overwrites a document (set/upsert behavior)"""
        # Firestore REST API uses specific JSON format with type mapping
        # We need a helper to convert python dict to Firestore JSON
        firestore_data = self._to_firestore_json(data)
        
        # Using PATCH with updateMask is complex for full overwrite, 
        # but PATCH without mask acts as upsert/merge depending on query params.
        # To simulate 'set' (overwrite), we can just PATCH.
        
        url = f"{self.base_url}/{collection}/{doc_id}"
        response = requests.patch(url, headers=self._headers(), json=firestore_data)
        
        if response.status_code != 200:
             raise Exception(f"Firestore SET Error {response.status_code}: {response.text}")
        return response.json()

    def update_document(self, collection, doc_id, data):
        """Updates specific fields (merge behavior)"""
        firestore_data = self._to_firestore_json(data)
        
        # Build query params for updateMask to only update provided fields
        params = []
        for key in data.keys():
            params.append(f"updateMask.fieldPaths={key}")
        
        query_string = "&".join(params)
        url = f"{self.base_url}/{collection}/{doc_id}?{query_string}"
        
        response = requests.patch(url, headers=self._headers(), json=firestore_data)
        if response.status_code != 200:
             raise Exception(f"Firestore UPDATE Error {response.status_code}: {response.text}")
        return response.json()

    def _to_firestore_json(self, data):
        """Converts simple python dict to Firestore JSON format"""
        fields = {}
        for key, value in data.items():
            if value is None:
                fields[key] = {"nullValue": None}
            elif isinstance(value, bool):
                fields[key] = {"booleanValue": value}
            elif isinstance(value, int):
                fields[key] = {"integerValue": str(value)}
            elif isinstance(value, float):
                fields[key] = {"doubleValue": value}
            elif isinstance(value, str):
                fields[key] = {"stringValue": value}
            elif isinstance(value, list):
                # Recursive call for list items. 
                # Simplified: assumes list of dicts (Map) or simple types
                array_values = []
                for item in value:
                     if isinstance(item, dict):
                         array_values.append({"mapValue": {"fields": self._to_firestore_json(item)["fields"]}})
                     else:
                         # Handle simple types if needed (skipped for now based on known usage)
                         pass 
                fields[key] = {"arrayValue": {"values": array_values}}
            elif isinstance(value, dict):
                 # Special handling for firestore.SERVER_TIMESTAMP placeholder
                if value == "SERVER_TIMESTAMP": 
                     fields[key] = {"timestampValue": datetime.utcnow().isoformat() + "Z"}
                else:
                    fields[key] = {"mapValue": {"fields": self._to_firestore_json(value)["fields"]}}
        
        return {"fields": fields}

# -------------------------------------------------------------------------
# PARSING HELPERS
# -------------------------------------------------------------------------
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
        "peso_total": 0.0
    }
    
    if not html_content: return None

    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 1. Extract Note Number
        text_content = soup.get_text()
        match_nota = re.search(r'(NN\d+)', text_content)
        if match_nota:
            dados["nota"] = match_nota.group(1)
        else:
            print("AVISO: Nenhuma nota 'NN...' encontrada no email.")
            return None

        # 2. Extract Table Items
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all(['td', 'th'])
                if len(cols) >= 6:
                    idx_origem, idx_destino = 0, 1
                    idx_unit, idx_lacre, idx_peso = 5, 6, 7
                    
                    if len(cols) > idx_peso:
                        if dados["origem"] == "Desconhecida":
                             dados["origem"] = limpar_html(str(cols[idx_origem]))
                             dados["destino"] = limpar_html(str(cols[idx_destino]))
                        
                        def get_clean_list(col):
                            for br in col.find_all('br'): br.replace_with(' ')
                            text = col.get_text(separator=' ', strip=True)
                            text = text.replace('&nbsp;', ' ').replace('=', '').replace('?', '')
                            return text.split()

                        raw_units = get_clean_list(cols[idx_unit])
                        raw_lacres = get_clean_list(cols[idx_lacre])
                        raw_pesos = get_clean_list(cols[idx_peso])
                        
                        max_len = max(len(raw_units), len(raw_lacres), len(raw_pesos))
                        for i in range(max_len):
                            unit_val = raw_units[i] if i < len(raw_units) else "?"
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

        if dados["itens"]:
            dados["peso_total"] = sum(item["peso"] for item in dados["itens"])

    except Exception as e:
        print(f"Erro no parsing HTML: {e}")
        return None
        
    return dados

# -------------------------------------------------------------------------
# MAIN HANDLER (VERCEL)
# -------------------------------------------------------------------------
class handler(BaseHTTPRequestHandler):
    
    def do_GET(self):
        self.process_request()

    def do_POST(self):
        self.process_request()

    def process_request(self):
        query = parse_qs(urlparse(self.path).query)
        key = query.get('key', [None])[0]
        cron_secret = os.environ.get('CRON_SECRET')
        
        if not cron_secret or key != cron_secret:
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"Unauthorized")
            return

        try:
            # 1. Initialize Firestore REST Client
            firebase_creds_str = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
            if not firebase_creds_str:
                raise Exception("FIREBASE_SERVICE_ACCOUNT not configured")
            
            try:
                # First attempt: standard JSON load
                firebase_creds_dict = json.loads(firebase_creds_str)
            except json.JSONDecodeError:
                # Second attempt: handle potential escaped newlines ONLY if standard load fails
                # (Common issue when copying from .env files sometimes)
                try:
                    firebase_creds_dict = json.loads(firebase_creds_str.replace('\\n', '\n'))
                except:
                    # Final attempt: direct cleanup of invisible control characters
                    # (Sometimes copy-paste introduces weird chars)
                    clean_str = "".join(ch for ch in firebase_creds_str if getattr(ch, 'isprintable', lambda: True)())
                    firebase_creds_dict = json.loads(clean_str)

            # 2. Gmail Connection (OAuth2)
            gmail_creds = Credentials(
                None,
                refresh_token=os.environ.get('GOOGLE_REFRESH_TOKEN'),
                token_uri="https://oauth2.googleapis.com/token",
                client_id=os.environ.get('GOOGLE_CLIENT_ID'),
                client_secret=os.environ.get('GOOGLE_CLIENT_SECRET')
            )
            
            if not gmail_creds.valid:
                gmail_creds.refresh(Request())

            service = build('gmail', 'v1', credentials=gmail_creds)

            # 3. Find Label
            results = service.users().labels().list(userId='me').execute()
            labels = results.get('labels', [])
            label_id = next((l['id'] for l in labels if l['name'] == LABEL_NAME), None)

            if not label_id:
                self.respond_success("Label ROBO_TIM não encontrada no Gmail.")
                return

            # 4. Fetch Emails
            results = service.users().messages().list(
                userId='me', labelIds=[label_id], maxResults=MAX_EMAILS_PER_RUN
            ).execute()
            messages = results.get('messages', [])

            processed_count = 0
            
            if not messages:
                self.respond_success("Nenhum e-mail pendente.")
                return

            print(f"Encontrados {len(messages)} e-mails.")

            # Helper for recursive part extraction
            def get_html_part(payload):
                if payload['mimeType'] == 'text/html':
                    return base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
                
                parts = payload.get('parts', [])
                for part in parts:
                    result = get_html_part(part)
                    if result: return result
                return None

            debug_logs = []
            
            # 5. Process Emails
            for msg in messages:
                try:
                    msg_detail = service.users().messages().get(
                        userId='me', id=msg['id'], format='full'
                    ).execute()
                    
                    headers = msg_detail['payload']['headers']
                    subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "")
                    date_header = next((h['value'] for h in headers if h['name'] == 'Date'), "")
                    
                    debug_logs.append(f"Analisando: {subject[:50]}...")
                    
                    html_body = get_html_part(msg_detail['payload'])
                    
                    if not html_body:
                        debug_logs.append(f" - [ERRO] HTML não encontrado no corpo do email.")
                        continue

                    parsed_data = parse_email_html(html_body)
                    
                    if not parsed_data or not parsed_data['nota']:
                         debug_logs.append(f" - [PULADO] Nota não encontrada no HTML. (parsed={bool(parsed_data)})")
                         # Debug: dump text snippet to see what's wrong
                         soup = BeautifulSoup(html_body, 'html.parser')
                         text_snippet = soup.get_text()[:100].replace('\n', ' ')
                         debug_logs.append(f"   Snippet: {text_snippet}")
                         continue

                    nota_id = parsed_data['nota']
                    debug_logs.append(f" - [OK] Nota encontrada: {nota_id}")
                    
                    is_entrada = "Recebimento de Carga" in subject or "Recebimento de Carga" in subject
                    is_saida = "Devolução de carga" in subject or "Devolução de carga" in subject # redundancy for clarity/safety
                    
                    if is_entrada:
                        existing_doc = db_client.get_document(COLLECTION_NAME, nota_id)
                        if not existing_doc:
                            payload = {
                                "nota_despacho": nota_id,
                                "status": "RECEBIDO",
                                "data_recebimento": date_header,
                                "data_entrega": None,
                                "origem": parsed_data['origem'],
                                "destino": parsed_data['destino'],
                                "peso_total": parsed_data['peso_total'],
                                "itens": parsed_data['itens'],
                                "criado_em": "SERVER_TIMESTAMP"
                            }
                            db_client.create_document(COLLECTION_NAME, nota_id, payload)
                            debug_logs.append(f"   -> [SALVO] Documento criado.")
                        else:
                            debug_logs.append(f"   -> [IGNORADO] Nota já existe.")

                    elif is_saida:
                        payload = {
                            "status": "ENTREGUE",
                            "data_entrega": date_header,
                            "nota_despacho": nota_id
                        }
                        try:
                            db_client.update_document(COLLECTION_NAME, nota_id, payload)
                            debug_logs.append(f"   -> [ATUALIZADO] Status mudado para ENTREGUE.")
                        except:
                            db_client.create_document(COLLECTION_NAME, nota_id, payload)
                            debug_logs.append(f"   -> [CRIADO-SAIDA] Documento de saída criado.")
                    else:
                        debug_logs.append(f"   -> [PULADO] Assunto não bate com filtros de entrada/saída.")
                    
                    # Remove Label
                    service.users().messages().batchModify(
                        userId='me',
                        body={'ids': [msg['id']], 'removeLabelIds': [label_id]}
                    ).execute()
                    
                    processed_count += 1

                except Exception as e:
                    print(f"Erro ao processar mensagem {msg['id']}: {e}")
                    debug_logs.append(f" - [CRITICO] Erro exceção: {str(e)}")

            self.respond_success(f"Processados {processed_count} e-mails.", debug_logs)

        except Exception as e:
            print(f"Erro Crítico: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Internal Error: {str(e)}".encode())

    def respond_success(self, message, debug_logs=None):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        res = {"status": "success", "message": message}
        if debug_logs: res["debug_logs"] = debug_logs
        self.wfile.write(json.dumps(res, ensure_ascii=False).encode())

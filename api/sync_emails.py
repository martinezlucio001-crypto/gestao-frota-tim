from http.server import BaseHTTPRequestHandler
import os
import json
import base64
import re
import time
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
MAX_EMAILS_PER_RUN = 5
LABEL_NAME = "ROBO_TIM"
LABEL_PROCESSED = "PROCESSADO"
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
        firestore_data = self._to_firestore_json(data)
        url = f"{self.base_url}/{collection}/{doc_id}"
        response = requests.patch(url, headers=self._headers(), json=firestore_data)
        
        if response.status_code != 200:
             raise Exception(f"Firestore SET Error {response.status_code}: {response.text}")
        return response.json()

    def update_document(self, collection, doc_id, data):
        """Updates specific fields (merge behavior)"""
        firestore_data = self._to_firestore_json(data)
        
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
                array_values = []
                for item in value:
                     if isinstance(item, dict):
                         array_values.append({"mapValue": {"fields": self._to_firestore_json(item)["fields"]}})
                     else:
                         pass 
                fields[key] = {"arrayValue": {"values": array_values}}
            elif isinstance(value, dict):
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

def clean_city_name(name):
    if not name: return "Desconhecida"
    # Remove common prefixes like "CDD ", "AC ", "UD ", etc.
    name = re.sub(r'^(CDD|AC|UD|AG|CTO|TECA)\s+', '', name, flags=re.IGNORECASE)
    # Title case "RIO DE JANEIRO" -> "Rio De Janeiro" (simple) or keep upper if preferred.
    # User prefers simple names. Let's Title Case.
    return name.title()

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
        "tipo_movimento": "DESCONHECIDO" # Recebimento ou Entrega
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
                        
                        dados["origem"] = clean_city_name(limpar_html(str(cols[idx_origem])))
                        dados["destino"] = clean_city_name(limpar_html(str(cols[idx_destino])))
                        dados["data_ocorrencia"] = limpar_html(str(cols[idx_data]))
                        
                        try:
                            # Try to extract integer from string like "5" or "5 un"
                            raw_qtde = limpar_html(str(cols[idx_qtde]))
                            match_int = re.search(r'(\d+)', raw_qtde)
                            if match_int:
                                dados["qtde_unitizadores"] = int(match_int.group(1))
                        except: pass
                        
                        try:
                            # "1.500,50 Kg" -> 1500.50
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
                        unit_val = raw_units[i] if i < len(raw_units) else ""
                        # Filter noise
                        if len(unit_val) < 4 or unit_val.lower() in ['unitizador', 'lacre', 'objeto']:
                            continue
                        
                        peso_str = raw_pesos[i] if i < len(raw_pesos) else "0"
                        peso_val = 0.0
                        try:
                             # "10,5" -> 10.5
                            cl_peso = peso_str.replace('.', '').replace(',', '.').replace('Kg', '').strip()
                            peso_val = float(cl_peso)
                        except: pass

                        item = {
                            "unitizador": unit_val,
                            "lacre": raw_lacres[i] if i < len(raw_lacres) else "",
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

# -------------------------------------------------------------------------
# MAIN HANDLER (VERCEL)
# -------------------------------------------------------------------------
class handler(BaseHTTPRequestHandler):
    
    def do_GET(self):
        self.process_request()

    def do_POST(self):
        self.process_request()

    def _get_or_create_label(self, service, label_name):
        try:
            results = service.users().labels().list(userId='me').execute()
            labels = results.get('labels', [])
            existing = next((l for l in labels if l['name'] == label_name), None)
            
            if existing:
                return existing['id']
            
            # Create if not exists
            label_object = {
                'name': label_name,
                'labelListVisibility': 'labelShow',
                'messageListVisibility': 'show'
            }
            created = service.users().labels().create(userId='me', body=label_object).execute()
            return created['id']
        except Exception as e:
            print(f"Erro ao criar label {label_name}: {e}")
            return None

    def process_request(self):
        start_time = time.time()
        query = parse_qs(urlparse(self.path).query)
        key = query.get('key', [None])[0]
        cron_secret = os.environ.get('CRON_SECRET')
        
        if not cron_secret or key != cron_secret:
            self._set_headers(401)
            self.wfile.write(json.dumps({
                "error": "Unauthorized", 
                "message": "Invalid or missing key."
            }).encode('utf-8'))
            return

        try:
            # 1. Initialize Firestore
            firebase_creds_str = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
            if not firebase_creds_str:
                raise Exception("FIREBASE_SERVICE_ACCOUNT not configured")
            
            try:
                firebase_creds_dict = json.loads(firebase_creds_str)
            except json.JSONDecodeError:
                try:
                    firebase_creds_dict = json.loads(firebase_creds_str.replace('\\n', '\n'))
                except:
                    clean_str = "".join(ch for ch in firebase_creds_str if getattr(ch, 'isprintable', lambda: True)())
                    firebase_creds_dict = json.loads(clean_str)

            db_client = FirestoreClient(firebase_creds_dict)

            # 2. Gmail Connection
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

            # 3. Handle Labels
            # Find Source Label
            results = service.users().labels().list(userId='me').execute()
            labels = results.get('labels', [])
            label_robo_id = next((l['id'] for l in labels if l['name'] == LABEL_NAME), None)

            if not label_robo_id:
                self.respond_success("Label ROBO_TIM não encontrada.", start_time)
                return

            # Find/Create Destination Label
            label_processed_id = self._get_or_create_label(service, LABEL_PROCESSED)
            if not label_processed_id:
                print("AVISO: Não foi possível obter ID da label PROCESSADO.")

            # 4. Fetch Emails
            # Fetch larger batch (50) to find older emails, then take the last N (Oldest)
            results = service.users().messages().list(
                userId='me', labelIds=[label_robo_id], maxResults=50
            ).execute()
            all_messages = results.get('messages', [])
            
            # Take the last MAX_EMAILS_PER_RUN (The oldest in this batch)
            messages = all_messages[-MAX_EMAILS_PER_RUN:]
            
            # Process Oldest First (Chronological Order)
            messages.reverse()


            debug_logs = []
            debug_logs.append(f"Iniciando sincronização. Label ID: {label_robo_id}")

            processed_count = 0
            if not messages:
                debug_logs.append("Nenhuma mensagem encontrada na busca da API.")
                self.respond_success("Nenhum e-mail pendente.", start_time, debug_logs)
                return

            print(f"Encontrados {len(messages)} e-mails.")

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
                        debug_logs.append(f" - [ERRO] HTML não encontrado.")
                        continue

                    parsed_data = parse_email_html(html_body)
                    
                    if not parsed_data or not parsed_data['nota']:
                         debug_logs.append(f" - [PULADO] Nota não encontrada no HTML.")
                         continue

                    nota_id = parsed_data['nota']
                    debug_logs.append(f" - [OK] Nota encontrada: {nota_id}")
                    
                    # Check Headers for type or Subject
                    is_entrada = "Recebimento de Carga" in subject or "Recebimento de carga" in subject
                    is_saida = "Devolução de carga" in subject or "Devolução de Carga" in subject
                    
                    # Force check to avoid skipping valid emails if case sensitivity issues
                    if not is_entrada and not is_saida:
                        # Fallback heuristic: check if data_ocorrencia/origem exist
                        pass 

                    if is_entrada:
                        parsed_data["tipo_movimento"] = "RECEBIMENTO"
                        existing_doc = db_client.get_document(COLLECTION_NAME, nota_id)
                        
                        if not existing_doc:
                            # Payload for New Note
                            payload = {
                                "nota_despacho": nota_id,
                                "status": "RECEBIDO", # Yellow dot only
                                "data_email": date_header,
                                "data_ocorrencia": parsed_data['data_ocorrencia'], 
                                "origem": parsed_data['origem'],
                                "destino": parsed_data['destino'],
                                "qtde_unitizadores": parsed_data['qtde_unitizadores'],
                                "peso_total_declarado": parsed_data['peso_total_declarado'],
                                "peso_total_calculado": parsed_data['peso_total_calculado'],
                                "itens": parsed_data['itens'],
                                "criado_em": "SERVER_TIMESTAMP",
                                "divergencia": None, 
                                "created_by": "ROBO" 
                            }
                            db_client.create_document(COLLECTION_NAME, nota_id, payload)
                            debug_logs.append(f"   -> [SALVO] Documento criado com {len(parsed_data['itens'])} itens.")
                        else:
                            # Update Existing Note (Fix Orphan or Update Entry Data)
                            payload = {
                                "nota_despacho": nota_id,
                                "data_email": date_header,
                                "data_ocorrencia": parsed_data['data_ocorrencia'], 
                                "origem": parsed_data['origem'],
                                "destino": parsed_data['destino'],
                                "qtde_unitizadores": parsed_data['qtde_unitizadores'],
                                "peso_total_declarado": parsed_data['peso_total_declarado'],
                                "peso_total_calculado": parsed_data['peso_total_calculado'],
                                "itens": parsed_data['itens'],
                                "last_updated": "SERVER_TIMESTAMP"
                            }
                            
                            # Check if it was an ORPHAN (has exit data 'itens_conferencia')
                            existing_fields = existing_doc.get('fields', {})
                            itens_conferencia = existing_fields.get('itens_conferencia')
                            
                            if itens_conferencia:
                                # Re-run Reconciliation (V2 Logic)
                                # We need to parse the stored 'itens_conferencia' back to list of dicts
                                # Firestore format is complex, but let's assume we can extract critical data
                                # Actually, it's better to implement a robust comparison helper.
                                
                                # Simplified for now: match by Unitizer ID
                                stored_units = {}
                                
                                # Helper to extract from Firestore Array
                                try:
                                    vals = itens_conferencia.get('arrayValue', {}).get('values', [])
                                    for v in vals:
                                        fdata = v.get('mapValue', {}).get('fields', {})
                                        uid = fdata.get('unitizador', {}).get('stringValue', '').strip()
                                        w = float(fdata.get('peso', {}).get('doubleValue', 0))
                                        if uid: stored_units[uid] = w
                                except:
                                    pass # Malformed data

                                entry_items = parsed_data['itens'] # List of dicts
                                
                                divergences = []
                                matched_count = 0
                                
                                for item in entry_items:
                                    uid = item['unitizador'].strip()
                                    w_entry = item['peso']
                                    
                                    if uid in stored_units:
                                        matched_count += 1
                                        w_exit = stored_units[uid]
                                        if abs(w_entry - w_exit) > 0.1: # 100g tolerance
                                            divergences.append(f"Unit {uid}: Peso Entrada {w_entry} != Saida {w_exit}")
                                    else:
                                        divergences.append(f"Unit {uid}: Não consta na devolução")
                                
                                # Check for items in Exit that are not in Entry
                                entry_uids = set(i['unitizador'].strip() for i in entry_items)
                                for uid in stored_units:
                                    if uid not in entry_uids:
                                        divergences.append(f"Unit {uid}: Faltou na entrada (sobra na devolução)")

                                if divergences:
                                    payload['status'] = "DIVERGENTE"
                                    payload['divergencia'] = "; ".join(divergences)
                                    debug_logs.append(f"   -> [RECONCILIACAO] Divergências encontradas: {len(divergences)}")
                                else:
                                    payload['status'] = "CONCLUIDO"
                                    payload['divergencia'] = None
                                    debug_logs.append(f"   -> [RECONCILIACAO] Sucesso! Nota conciliada.")

                            else:
                                # Just a normal update of Entry data (no exit data yet)
                                # Clear orphan status if it was set wrongly
                                doc_status = existing_fields.get('status', {}).get('stringValue')
                                if doc_status == 'DEVOLVED_ORPHAN':
                                    payload['divergencia'] = None
                                    payload['status'] = 'RECEBIDO' # Reset to valid state
                            
                            db_client.update_document(COLLECTION_NAME, nota_id, payload)
                            debug_logs.append(f"   -> [ATUALIZADO] Dados de Entrada vinculados.")

                    elif is_saida:
                        parsed_data["tipo_movimento"] = "ENTREGA"
                        existing_doc = db_client.get_document(COLLECTION_NAME, nota_id)

                        if existing_doc:
                            # Reconciliation Logic (V2) - Triggered by Exit Email
                            doc_data = existing_doc.get('fields', {})
                            
                            # We need Entry data ('itens') to compare against this Exit email ('itens' -> save as 'itens_conferencia')
                            # Extract Entry items from Firestore
                            stored_units = {}
                            try:
                                # 'itens' in Firestore
                                f_itens = doc_data.get('itens', {}).get('arrayValue', {}).get('values', [])
                                for v in f_itens:
                                    fdata = v.get('mapValue', {}).get('fields', {})
                                    uid = fdata.get('unitizador', {}).get('stringValue', '').strip()
                                    w = float(fdata.get('peso', {}).get('doubleValue', 0))
                                    if uid: stored_units[uid] = w
                            except: pass

                            # Current Email is Exit
                            exit_items = parsed_data['itens']
                            
                            divergences = []
                            
                            if not stored_units:
                                # No entry data found (?) -> Should be Orphan but we are in "existing_doc" block
                                # Verify status. If status is RECEBIDO, we should have items.
                                # If status is DEVOLVED_ORPHAN, implies we are re-processing exit?
                                pass

                            for item in exit_items:
                                uid = item['unitizador'].strip()
                                w_exit = item['peso']
                                
                                if uid in stored_units:
                                    w_entry = stored_units[uid]
                                    if abs(w_entry - w_exit) > 0.1:
                                        divergences.append(f"Unit {uid}: Peso Entrada {w_entry} != Saida {w_exit}")
                                else:
                                    divergences.append(f"Unit {uid}: Não consta na entrada")
                            
                            # Reverse check
                            exit_uids = set(i['unitizador'].strip() for i in exit_items)
                            for uid in stored_units:
                                if uid not in exit_uids:
                                    divergences.append(f"Unit {uid}: Faltou na devolução")

                            # Determine Status
                            new_status = "CONCLUIDO"
                            divergencia_text = None
                            
                            if divergences:
                                new_status = "DIVERGENTE"
                                divergencia_text = "; ".join(divergences)
                            
                            # Update Payload
                            payload = {
                                "status": new_status,
                                "data_entrega": parsed_data['data_ocorrencia'] or date_header,
                                "divergencia": divergencia_text,
                                "itens_conferencia": parsed_data['itens'], # Save exit items separately!
                                "last_updated": "SERVER_TIMESTAMP"
                            }
                            
                            db_client.update_document(COLLECTION_NAME, nota_id, payload)
                            debug_logs.append(f"   -> [ATUALIZADO] Status: {new_status}. Div: {divergencia_text or 'Nenhuma'}")
                            
                        else:
                            # Orphan Note (Devolved without Receipt)
                            payload = {
                                "nota_despacho": nota_id,
                                "status": "DEVOLVED_ORPHAN",
                                "data_email": date_header,
                                "data_ocorrencia": parsed_data['data_ocorrencia'], 
                                "data_entrega": parsed_data['data_ocorrencia'],
                                "origem": parsed_data['origem'],
                                "destino": parsed_data['destino'],
                                "qtde_unitizadores": parsed_data['qtde_unitizadores'],
                                "peso_total_declarado": parsed_data['peso_total_declarado'],
                                "peso_total_calculado": parsed_data['peso_total_calculado'],
                                "itens_conferencia": parsed_data['itens'], # Save as conferência
                                "itens": [], # Empty entry items
                                "criado_em": "SERVER_TIMESTAMP",
                                "divergencia": "Nota de Devolução sem entrada prévia.",
                                "created_by": "ROBO"
                            }
                            db_client.create_document(COLLECTION_NAME, nota_id, payload)
                            debug_logs.append(f"   -> [CRIADO-ORFAO] Nota de Devolução sem origem.")

                    else:
                        debug_logs.append(f"   -> [PULADO] Tipo de movimento não identificado no assunto.")
                        continue # Skip label removal
                    
                    # Swap Label
                    if label_processed_id:
                        mods = {
                            'ids': [msg['id']],
                            'removeLabelIds': [label_robo_id],
                            'addLabelIds': [label_processed_id]
                        }
                        service.users().messages().batchModify(userId='me', body=mods).execute()
                        debug_logs.append(f"   -> [LABEL] Trocado ROBO_TIM por PROCESSADO.")
                    else:
                        debug_logs.append(f"   -> [ERRO-LABEL] ID de PROCESSADO não disponível.")

                    processed_count += 1

                except Exception as e:
                    print(f"Erro ao processar mensagem {msg['id']}: {e}")
                    debug_logs.append(f" - [CRITICO] Erro exceção: {str(e)}")

            # 6. Save Sync Metadata
            try:
                meta_payload = {
                    "last_sync": "SERVER_TIMESTAMP",
                    "status": "SUCCESS",
                    "processed_count": processed_count
                }
                db_client.create_document("artifacts", f"{os.environ.get('FIREBASE_APP_ID', 'default')}_sync_metadata", meta_payload)
            except Exception as e:
                debug_logs.append(f" - [ERRO] Falha ao salvar metadata: {e}")

            self.respond_success(f"Processados {processed_count} e-mails.", start_time, debug_logs)



        except Exception as e:
            print(f"Erro Crítico: {e}")
            self._set_headers(500)
            res = {"status": "error", "message": f"Internal Error: {str(e)}"}
            self.wfile.write(json.dumps(res).encode('utf-8'))

    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def respond_success(self, message, start_time, debug_logs=None):
        duration = time.time() - start_time
        self._set_headers(200)
        
        res = {
            "status": "success", 
            "message": message,
            "execution_time_seconds": round(duration, 2)
        }
        if debug_logs: res["debug_logs"] = debug_logs
        self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))

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
MAX_EMAILS_PER_RUN = 50
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
# MERGE HELPER
# -------------------------------------------------------------------------
def merge_item_lists(existing_items, new_items):
    """
    Merges two lists of items based on 'unitizador' ID.
    existing_items: List of dicts (from Firestore or parsed)
    new_items: List of dicts (from current email)
    Returns: Merged list of dicts
    """
    merged_map = {}
    
    # Process Existing
    for item in existing_items:
        uid = item.get('unitizador', '').strip()
        if uid: merged_map[uid] = item
        
    # Process New (Updates/Adds)
    for item in new_items:
        uid = item.get('unitizador', '').strip()
        if uid:
            # If exists, we could update weight? 
            # User expectation: "Complementar". 
            # If same unitizer appears twice with different weight, usually latest wins or it's a duplicate.
            # We'll let new item overwrite existing if key matches, or add if new.
            merged_map[uid] = item
            
    return list(merged_map.values())

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
    if not name: return "DESCONHECIDA"
    
    # 1. Uppercase and Trim (New Standard)
    name = name.strip().upper()
    
    # 2. Remove Accents
    replacements = {
        'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A',
        'É': 'E', 'Ê': 'E',
        'Í': 'I',
        'Ó': 'O', 'Õ': 'O', 'Ô': 'O',
        'Ú': 'U',
        'Ç': 'C',
        'Ü': 'U'
    }
    for k, v in replacements.items():
        name = name.replace(k, v)
        
    # 3. Preserve Prefixes (AC, CDD, etc.) - DO NOT REMOVE
    # User requirement: Keep "CDD SANTAREM", "AC OBIDOS", etc.
    
    return name

def parse_email_html(html_content):
    parsed_results = []
    
    if not html_content: return []

    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Extract Table Items
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all(['td', 'th'])
                
                # Minimum columns validation
                if len(cols) < 7: continue
                
                # Check for "Header" row (skip)
                col0_text = limpar_html(str(cols[0])).lower() if cols else ""
                if 'nota de despacho' in col0_text or 'origem' in col0_text:
                    continue
                
                # Check for Data Row (Must have "NN" in first column)
                # Col 0: Nota
                raw_nota = limpar_html(str(cols[0]))
                if "NN" not in raw_nota:
                    continue
                    
                # Setup specific indexes for standard TIM emails
                idx_nota = 0
                idx_origem = 1
                idx_destino = 2
                idx_data = 3
                idx_qtde = 4
                idx_peso_total = 5
                idx_list_unit = 6
                idx_list_lacre = 7
                idx_list_peso = 8
                
                # Create Note Object
                dados = {
                    "nota": None,
                    "itens": [],
                    "origem": "DESCONHECIDA",
                    "destino": "DESCONHECIDO",
                    "data_ocorrencia": None,
                    "qtde_unitizadores": 0,
                    "peso_total_declarado": 0.0,
                    "peso_total_calculado": 0.0,
                    "tipo_movimento": "DESCONHECIDO" # Will be set by Subject later
                }
                
                # Extract Metadata
                match_nota = re.search(r'(NN\d+)', raw_nota)
                if match_nota:
                    dados["nota"] = match_nota.group(1)
                else:
                    continue # Valid row must have NN
                    
                dados["origem"] = clean_city_name(limpar_html(str(cols[idx_origem])))
                dados["destino"] = clean_city_name(limpar_html(str(cols[idx_destino])))
                dados["data_ocorrencia"] = limpar_html(str(cols[idx_data]))
                
                try:
                    raw_qtde = limpar_html(str(cols[idx_qtde]))
                    match_int = re.search(r'(\d+)', raw_qtde)
                    if match_int: dados["qtde_unitizadores"] = int(match_int.group(1))
                except: pass
                
                try:
                    # "1.500,50 Kg"
                    p_str = limpar_html(str(cols[idx_peso_total])).replace('.', '').replace(',', '.').replace('Kg', '').strip()
                    dados["peso_total_declarado"] = float(p_str)
                except: pass

                # Extract Lists (Unitizers, Lacres, Pesos)
                # Helper to split by <br> or whitespace
                def get_clean_list(col):
                    # Replace <br> with explicit separator to ensure splitting
                    for br in col.find_all('br'): br.replace_with(' ||| ')
                    text = col.get_text(separator=' ', strip=True)
                    text = text.replace('&nbsp;', ' ').replace('=', '').replace('?', '')
                    # Split by our separator or whitespace
                    if '|||' in text:
                        return [x.strip() for x in text.split('|||') if x.strip()]
                    return text.split()

                raw_units = get_clean_list(cols[idx_list_unit])
                raw_lacres = get_clean_list(cols[idx_list_lacre]) if len(cols) > idx_list_lacre else []
                raw_pesos = get_clean_list(cols[idx_list_peso]) if len(cols) > idx_list_peso else []
                
                max_len = max(len(raw_units), len(raw_lacres), len(raw_pesos))
                
                for i in range(max_len):
                    unit_val = raw_units[i] if i < len(raw_units) else ""
                    
                    # Filter noise
                    if len(unit_val) < 4 or unit_val.lower() in ['unitizador', 'lacre', 'objeto']:
                        continue
                    
                    lacre_val = raw_lacres[i] if i < len(raw_lacres) else ""
                    peso_str = raw_pesos[i] if i < len(raw_pesos) else "0"
                    
                    peso_val = 0.0
                    try:
                        cl_peso = peso_str.replace('.', '').replace(',', '.').replace('Kg', '').strip()
                        peso_val = float(cl_peso)
                    except: pass

                    item = {
                        "unitizador": unit_val,
                        "lacre": lacre_val,
                        "peso": peso_val,
                        "conferido": False
                    }
                    dados["itens"].append(item)
                    
                if dados["itens"]:
                    dados["peso_total_calculado"] = sum(item["peso"] for item in dados["itens"])
                    
                parsed_results.append(dados)

    except Exception as e:
        print(f"Erro no parsing HTML: {e}")
        return []
        
    return parsed_results

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

        # --- SCRIPT PAUSADO TEMPORARIAMENTE ---
        # Para reativar, remova as linhas abaixo
        self.respond_success("Script pausado conforme solicitado.", start_time)
        return
        # --------------------------------------

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
                userId='me', labelIds=[label_robo_id], maxResults=500
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

                    parsed_data_list = parse_email_html(html_body)
                    
                    if not parsed_data_list:
                         debug_logs.append(f" - [PULADO] Nenhuma nota encontrada ou erro no parse.")
                         continue
                    
                    debug_logs.append(f" - [OK] {len(parsed_data_list)} notas identificadas.")

                    # Determine Movement Type based on Subject (Global for the email)
                    is_entrada = "Recebimento de Carga" in subject or "Recebimento de carga" in subject
                    is_saida = "Devolução de carga" in subject or "Devolução de Carga" in subject

                    for parsed_data in parsed_data_list:
                        nota_id = parsed_data['nota']
                        debug_logs.append(f"   > Processando Nota: {nota_id}")

                        if is_entrada:
                            parsed_data["tipo_movimento"] = "RECEBIMENTO"
                            existing_doc = db_client.get_document(COLLECTION_NAME, nota_id)
                            
                            if not existing_doc:
                                # Payload for New Note
                                payload = {
                                    "nota_despacho": nota_id,
                                    "status": "RECEBIDO", 
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
                                    "created_by": "ROBO",
                                    "msgs_entrada": 1,
                                    "msgs_saida": 0
                                }
                                db_client.create_document(COLLECTION_NAME, nota_id, payload)
                                debug_logs.append(f"     -> [SALVO] Criado com {len(parsed_data['itens'])} itens.")
                            else:
                                # Update Existing Note (MERGE)
                                existing_fields = existing_doc.get('fields', {})
                                
                                # 1. Extract Existing ITENS
                                existing_itens = []
                                try:
                                    vals = existing_fields.get('itens', {}).get('arrayValue', {}).get('values', [])
                                    for v in vals:
                                        fdata = v.get('mapValue', {}).get('fields', {})
                                        existing_itens.append({
                                            "unitizador": fdata.get('unitizador', {}).get('stringValue', '').strip(),
                                            "lacre": fdata.get('lacre', {}).get('stringValue', ''),
                                            "peso": float(fdata.get('peso', {}).get('doubleValue', 0)),
                                            "conferido": fdata.get('conferido', {}).get('booleanValue', False)
                                        })
                                except: pass
                                
                                # 2. Merge New Items (parsed_data['itens']) with Existing
                                merged_itens = merge_item_lists(existing_itens, parsed_data['itens'])
                                
                                # Calculate new totals from MERGED items
                                new_total_weight = sum(i['peso'] for i in merged_itens)
                                
                                # Increment Message Count
                                current_count = 1
                                try:
                                    if 'msgs_entrada' in existing_fields:
                                        current_count = int(existing_fields['msgs_entrada'].get('integerValue', 1))
                                    else:
                                        current_count = 1 # Default if field missing
                                except: pass
                                
                                new_msg_count = current_count + 1

                                payload = {
                                    "nota_despacho": nota_id,
                                    "data_email": date_header,
                                    "data_ocorrencia": parsed_data['data_ocorrencia'], 
                                    "origem": parsed_data['origem'],
                                    "destino": parsed_data['destino'],
                                    "qtde_unitizadores": len(merged_itens), 
                                    "peso_total_declarado": new_total_weight, 
                                    "peso_total_calculado": new_total_weight, 
                                    "itens": merged_itens,
                                    "last_updated": "SERVER_TIMESTAMP",
                                    "msgs_entrada": new_msg_count # Save Count
                                }
                                
                                # Check Recalculation logic if Exit data exists
                                itens_conferencia_field = existing_fields.get('itens_conferencia')
                                
                                if itens_conferencia_field:
                                    # Reconciliation Logic
                                    stored_units = {}
                                    try:
                                        vals = itens_conferencia_field.get('arrayValue', {}).get('values', [])
                                        for v in vals:
                                            fdata = v.get('mapValue', {}).get('fields', {})
                                            uid = fdata.get('unitizador', {}).get('stringValue', '').strip()
                                            w = float(fdata.get('peso', {}).get('doubleValue', 0))
                                            if uid: stored_units[uid] = w
                                    except: pass

                                    entry_items = merged_itens # Use Merged List
                                    divergences = []
                                    
                                    for item in entry_items:
                                        uid = item['unitizador'].strip()
                                        w_entry = item['peso']
                                        if uid in stored_units:
                                            w_exit = stored_units[uid]
                                            if abs(w_entry - w_exit) > 0.1:
                                                divergences.append(f"Unit {uid}: Peso Entrada {w_entry} != Saida {w_exit}")
                                        else:
                                            divergences.append(f"Unit {uid}: Não consta na devolução")
                                    
                                    entry_uids = set(i['unitizador'].strip() for i in entry_items)
                                    for uid in stored_units:
                                        if uid not in entry_uids:
                                            divergences.append(f"Unit {uid}: Faltou na entrada")

                                    if divergences:
                                        payload['status'] = "DIVERGENTE"
                                        payload['divergencia'] = "; ".join(divergences)
                                    else:
                                        payload['status'] = "CONCLUIDO"
                                        payload['divergencia'] = None
                                else:
                                    doc_status = existing_fields.get('status', {}).get('stringValue')
                                    if doc_status == 'DEVOLVED_ORPHAN':
                                        payload['divergencia'] = None
                                        payload['status'] = 'RECEBIDO'
                                
                                db_client.update_document(COLLECTION_NAME, nota_id, payload)
                                debug_logs.append(f"     -> [ATUALIZADO] Dados de Entrada mesclados e vinculados ({new_msg_count} e-mails).")

                        elif is_saida:
                            parsed_data["tipo_movimento"] = "ENTREGA"
                            existing_doc = db_client.get_document(COLLECTION_NAME, nota_id)

                            if existing_doc:
                                doc_data = existing_doc.get('fields', {})
                                
                                # 1. Extract Existing EXIT Items (itens_conferencia)
                                existing_exit_items = []
                                try:
                                    vals = doc_data.get('itens_conferencia', {}).get('arrayValue', {}).get('values', [])
                                    for v in vals:
                                        fdata = v.get('mapValue', {}).get('fields', {})
                                        existing_exit_items.append({
                                            "unitizador": fdata.get('unitizador', {}).get('stringValue', '').strip(),
                                            "lacre": fdata.get('lacre', {}).get('stringValue', ''),
                                            "peso": float(fdata.get('peso', {}).get('doubleValue', 0)),
                                            "conferido": fdata.get('conferido', {}).get('booleanValue', False)
                                        })
                                except: pass
                                
                                # 2. Merge New Exit Items with Existing
                                merged_exit_items = merge_item_lists(existing_exit_items, parsed_data['itens'])
                                stored_units = {i['unitizador']: i['peso'] for i in merged_exit_items}

                                # 3. Extract ENTRY Items to compare
                                entry_items = []
                                try:
                                    f_itens = doc_data.get('itens', {}).get('arrayValue', {}).get('values', [])
                                    for v in f_itens:
                                        fdata = v.get('mapValue', {}).get('fields', {})
                                        entry_items.append({
                                            "unitizador": fdata.get('unitizador', {}).get('stringValue', '').strip(),
                                            "peso": float(fdata.get('peso', {}).get('doubleValue', 0))
                                        })
                                except: pass

                                divergences = []
                                
                                # Compare Merged Exit Data vs Entry Data
                                for item in merged_exit_items:
                                    uid = item['unitizador'].strip()
                                    w_exit = item['peso']
                                    
                                    # Find matching Entry item
                                    w_entry = next((i['peso'] for i in entry_items if i['unitizador'] == uid), None)
                                    
                                    if w_entry is not None:
                                        if abs(w_entry - w_exit) > 0.1:
                                            divergences.append(f"Unit {uid}: Peso Entrada {w_entry} != Saida {w_exit}")
                                    else:
                                        # Only flag as missing if we HAVE entry items (otherwise it's just orphan)
                                        if entry_items:
                                            divergences.append(f"Unit {uid}: Não consta na entrada")
                                
                                # Reverse check (Missing in Exit)
                                if entry_items:
                                    exit_uids = set(i['unitizador'].strip() for i in merged_exit_items)
                                    for i in entry_items:
                                        if i['unitizador'] not in exit_uids:
                                            divergences.append(f"Unit {i['unitizador']}: Faltou na devolução")

                                # Determine Status
                                new_status = "CONCLUIDO" if not divergences else "DIVERGENTE"
                                if not entry_items: new_status = "DEVOLVED_ORPHAN" # Or keep existing if it was orphan
                                
                                # Calculate totals
                                new_total_weight = sum(i['peso'] for i in merged_exit_items)
                                
                                # Increment Message Count (Exit)
                                current_count = 0
                                try:
                                    if 'msgs_saida' in doc_data:
                                        current_count = int(doc_data['msgs_saida'].get('integerValue', 0))
                                    else:
                                        # If field missing, assume 1 if exiting items exist, strictly 0 if not?
                                        # Assume 0 or 1. Let's assume 1 if we are updating an existing exit note.
                                        # If existing_exit_items is empty, likely 0.
                                        current_count = 1 if existing_exit_items else 0
                                except: pass
                                
                                new_msg_count = current_count + 1
                                
                                payload = {
                                    "status": new_status,
                                    "data_entrega": parsed_data['data_ocorrencia'] or date_header,
                                    "divergencia": "; ".join(divergences) if divergences else None,
                                    "itens_conferencia": merged_exit_items, # Save MERGED items
                                    "qtde_unitizadores": len(merged_exit_items),
                                    "peso_total_declarado": new_total_weight, 
                                    "peso_total_calculado": new_total_weight, 
                                    "last_updated": "SERVER_TIMESTAMP",
                                    "msgs_saida": new_msg_count
                                }
                                
                                db_client.update_document(COLLECTION_NAME, nota_id, payload)
                                debug_logs.append(f"     -> [ATUALIZADO] Saída mesclada ({new_msg_count} e-mails). Status: {new_status}")
                                
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
                                    "created_by": "ROBO",
                                    "msgs_entrada": 0,
                                    "msgs_saida": 1
                                }
                                db_client.create_document(COLLECTION_NAME, nota_id, payload)
                                debug_logs.append(f"     -> [CRIADO-ORFAO] Devolução sem origem.")

                        else:
                            debug_logs.append(f"     -> [PULADO] Tipo (Subject) não reconhecido.")

                    # Swap Label (Once per email, after all notes processed)
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

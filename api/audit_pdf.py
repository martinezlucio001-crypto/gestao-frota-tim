from http.server import BaseHTTPRequestHandler
import os
import json
import cgi
import re
from datetime import datetime
import io

# Third-party
import pdfplumber
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

# -------------------------------------------------------------------------
# FIRESTORE CLIENT (Simplified from sync_emails.py)
# -------------------------------------------------------------------------
class FirestoreClient:
    def __init__(self, service_account_info):
        self.project_id = service_account_info.get("project_id")
        self.base_url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents"
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

    def run_query(self, collection):
        """Fetches ALL documents from a collection (simplified)"""
        url = f"{self.base_url}:runQuery"
        # Query to select all documents
        query = {
            "structuredQuery": {
                "from": [{"collectionId": collection}]
            }
        }
        response = requests.post(url, headers=self._headers(), json=query)
        if response.status_code == 200:
            return response.json()
        raise Exception(f"Firestore Query Error {response.status_code}")

    def update_document(self, collection, doc_id, data):
        """Updates specific fields (merge behavior)"""
        # Convert simple dict to Firestore JSON
        fields = {}
        for k, v in data.items():
            if isinstance(v, str): fields[k] = {"stringValue": v}
            elif isinstance(v, bool): fields[k] = {"booleanValue": v}
            elif isinstance(v, (int, float)): fields[k] = {"doubleValue": float(v)}
            elif isinstance(v, list): 
                # Basic support for array of objects update NOT implemented here for brevity
                # We typically update the whole 'itens' array
                pass 
                
        # For 'itens', we need to construct the complex arrayValue
        if 'itens' in data:
            array_values = []
            for item in data['itens']:
                item_fields = {}
                for ik, iv in item.items():
                    if isinstance(iv, str): item_fields[ik] = {"stringValue": iv}
                    elif isinstance(iv, bool): item_fields[ik] = {"booleanValue": iv}
                    elif isinstance(iv, (int, float)): item_fields[ik] = {"doubleValue": float(iv)}
                array_values.append({"mapValue": {"fields": item_fields}})
            fields['itens'] = {"arrayValue": {"values": array_values}}

        # Construct patch URL with updateMask
        params = [f"updateMask.fieldPaths={k}" for k in fields.keys()]
        query_string = "&".join(params)
        url = f"{self.base_url}/{collection}/{doc_id}?{query_string}"
        
        body = {"fields": fields}
        requests.patch(url, headers=self._headers(), json=body)

# -------------------------------------------------------------------------
# PDF TEXT EXTRACTION
# -------------------------------------------------------------------------
def extract_text_from_pdf(file_bytes):
    text_content = ""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_content += text + "\n"
        
        # Normalize: Remove all whitespace and uppercase
        normalized = re.sub(r'\s+', '', text_content).upper()
        return normalized
    except Exception as e:
        print(f"Erro ao ler PDF: {e}")
        return ""

# -------------------------------------------------------------------------
# HANDLER
# -------------------------------------------------------------------------
class handler(BaseHTTPRequestHandler):
    
    def do_POST(self):
        try:
            # 1. Parse Multipart Form Data
            ctype, pdict = cgi.parse_header(self.headers.get('content-type'))
            if ctype != 'multipart/form-data':
                self.send_error(400, "Content-Type must be multipart/form-data")
                return
            
            pdict['boundary'] = bytes(pdict['boundary'], "utf-8")
            form = cgi.FieldStorage(
                fp=self.rfile, 
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
            )

            # 2. Setup Firestore
            firebase_creds = json.loads(os.environ.get('FIREBASE_SERVICE_ACCOUNT'))
            db = FirestoreClient(firebase_creds)
            
            # 3. Fetch Existing Data (All Dispatch Notes)
            # Optimization: In real prod, we might want to filter, but here we need to cross-check everything
            query_results = db.run_query("tb_despachos_conferencia")
            
            # Index Unitizers: { "UNIT_CODE": { "doc_id": "...", "item_index": 0, "current_data": {...} } }
            unitizer_map = {}
            
            for doc_wrapper in query_results:
                if 'document' not in doc_wrapper: continue
                
                doc = doc_wrapper['document']
                doc_id = doc.name.split('/')[-1]
                fields = doc.get('fields', {})
                
                # Extract 'itens' array
                itens_array = fields.get('itens', {}).get('arrayValue', {}).get('values', [])
                
                for idx, item_wrapper in enumerate(itens_array):
                    item_fields = item_wrapper.get('mapValue', {}).get('fields', {})
                    
                    code = item_fields.get('unitizador', {}).get('stringValue', '').strip()
                    if not code: continue
                    
                    # Store current state
                    unitizer_map[code.replace(" ", "").upper()] = {
                        "doc_id": doc_id,
                        "item_index": idx,
                        "data": {
                            "unitizador": item_fields.get('unitizador', {}).get('stringValue', ''),
                            "lacre": item_fields.get('lacre', {}).get('stringValue', ''),
                            "peso": float(item_fields.get('peso', {}).get('doubleValue', 0)),
                            "conferido": item_fields.get('conferido', {}).get('booleanValue', False),
                            # Preserve existing correios check if needed, or overwrite? 
                            # Plan: overwrite if found in current PDF, preserve otherwise.
                            "correios_match": item_fields.get('correios_match', {}).get('booleanValue', False),
                            "correios_ref_month": item_fields.get('correios_ref_month', {}).get('stringValue', ''),
                            "correios_type": item_fields.get('correios_type', {}).get('stringValue', ''),
                            "correios_value": float(item_fields.get('correios_value', {}).get('doubleValue', 0)),
                        }
                    }

            # 4. Process Files
            files_to_process = []
            
            if 'file_postal' in form:
                files_to_process.append({
                    'type': 'Postal',
                    'bytes': form['file_postal'].file.read(),
                    'month': form.getvalue('month_postal'),
                    'price': float(form.getvalue('price_postal', 2.89))
                })
                
            if 'file_densa' in form:
                files_to_process.append({
                    'type': 'Densa',
                    'bytes': form['file_densa'].file.read(),
                    'month': form.getvalue('month_densa'),
                    'price': float(form.getvalue('price_densa', 0.39))
                })

            total_found = 0
            missing_codes = []
            updates_by_doc = {} # { "doc_id": [modified_items_list] }

            # Pre-load all known codes to "missing" list, remove as found
            # Actually, user wants "Unitizadores que não foram encontrados nos PDFs INDICADOS"
            # This implies we scan the PDF for unitizers? Or we scan the DB unitizers against the PDF?
            # "compararemos os unitizadores extraídos dos e-mails com os extratos" -> 
            # Source of truth = DB (emails). Target = PDF.
            # IF DB item IN PDF -> Found. IF DB item NOT IN PDF -> Missing.
            
            # Let's collect ALL DB codes first
            all_db_codes = set(unitizer_map.keys())
            found_codes = set()
            
            # 5. Audit Logic
            for file_info in files_to_process:
                pdf_text = extract_text_from_pdf(file_info['bytes'])
                
                # Check each DB unitizer against this PDF
                for code, info in unitizer_map.items():
                    if code in pdf_text:
                        found_codes.add(code)
                        
                        # Prepare Update
                        item_data = info['data']
                        item_data['correios_match'] = True
                        item_data['correios_ref_month'] = file_info['month']
                        item_data['correios_type'] = file_info['type']
                        item_data['correios_value'] = file_info['price']
                        
                        doc_id = info['doc_id']
                        if doc_id not in updates_by_doc:
                            # Need to reconstruct the FULL items list for this doc to update it safely
                            # This is tricky without full doc context.
                            # Better approach: We have the full `query_results`.
                            updates_by_doc[doc_id] = {} # Placeholder
                        
            # 6. Apply Updates
            # We need to iterate over `updates_by_doc` and commit changes.
            # Since we need to update the WHOLE `itens` array to avoid index shifting issues (though indices should be stable),
            # let's map back to the original docs.
            
            batch_updates = 0
            
            # Re-iterate documents to build final payloads
            for doc_wrapper in query_results:
                if 'document' not in doc_wrapper: continue
                doc_id = doc_wrapper['document'].name.split('/')[-1]
                
                # Check if this doc has any found items
                doc_needs_update = False
                
                fields = doc_wrapper['document'].get('fields', {})
                current_itens = []
                
                # Re-parse items from this doc
                raw_itens = fields.get('itens', {}).get('arrayValue', {}).get('values', [])
                
                for raw_item in raw_itens:
                    i_fields = raw_item.get('mapValue', {}).get('fields', {})
                    
                    # Reconstruct item dict
                    item_dict = {
                        "unitizador": i_fields.get('unitizador', {}).get('stringValue', ''),
                        "lacre": i_fields.get('lacre', {}).get('stringValue', ''),
                        "peso": float(i_fields.get('peso', {}).get('doubleValue', 0)),
                        "conferido": i_fields.get('conferido', {}).get('booleanValue', False),
                        "correios_match": i_fields.get('correios_match', {}).get('booleanValue', False),
                        "correios_ref_month": i_fields.get('correios_ref_month', {}).get('stringValue', ''),
                        "correios_type": i_fields.get('correios_type', {}).get('stringValue', ''),
                        "correios_value": float(i_fields.get('correios_value', {}).get('doubleValue', 0)),
                    }
                    
                    code = item_dict['unitizador'].replace(" ", "").upper()
                    
                    # Update logic
                    if code in found_codes:
                        # Find which file matched it (optimization: we just know it was found in *one of them*)
                        # Retrieve the specific match details from our unitizer_map loop?
                        # Actually, our unitizer_map loop above updated the 'data' dict.
                        # Let's use that.
                        updated_data = unitizer_map.get(code, {}).get('data')
                        if updated_data and updated_data.get('correios_match'):
                            if item_dict['correios_match'] != True: # Only update if changed
                                item_dict = updated_data
                                doc_needs_update = True
                            # If already true, maybe update metadata if different? 
                            # For simplicity, assume if match true, checking again updates metadata.
                            if item_dict['correios_ref_month'] != updated_data['correios_ref_month']:
                                item_dict = updated_data
                                doc_needs_update = True
                    
                    current_itens.append(item_dict)

                if doc_needs_update:
                    db.update_document("tb_despachos_conferencia", doc_id, {"itens": current_itens})
                    batch_updates += 1

            # 7. Calculate Missing
            missing_list = list(all_db_codes - found_codes)
            
            # Response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response_data = {
                "status": "success",
                "found_count": len(found_codes),
                "missing_count": len(missing_list),
                "total_processed": len(all_db_codes),
                "docs_updated": batch_updates,
                "missing_codes": sorted(missing_list)
            }
            
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

        except Exception as e:
            print(f"Error: {e}")
            self.send_error(500, f"Internal Server Error: {str(e)}")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

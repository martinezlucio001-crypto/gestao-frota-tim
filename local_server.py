import os
import re
import json
import pdfplumber
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.cloud import firestore

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# --- CONFIG ---
TOKEN_FILE = 'firestore_token.json'
CREDENTIALS_FILE = 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/datastore']

def get_firestore_client():
    creds = None
    if os.path.exists(TOKEN_FILE):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        except:
            creds = None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except:
                creds = None
        
        if not creds:
            if not os.path.exists(CREDENTIALS_FILE):
                print(f"❌ ERRO: '{CREDENTIALS_FILE}' não encontrado!")
                return None

            print("🔑 Autenticação necessária (Janela do navegador)...")
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

    try:
        # PROJECT ID HARDCODED TO MATCH FIREBASE CONFIG
        project_id = 'gestao-frota-tim'
        
        # import json
        # with open(CREDENTIALS_FILE) as f:
        #     c_data = json.load(f)
        #     project_id = c_data.get('installed', {}).get('project_id')
        
        return firestore.Client(credentials=creds, project=project_id)
    except Exception as e:
        print(f"❌ Erro Firestore: {e}")
        return None

def extract_text_from_pdf(file_stream):
    text_content = ""
    try:
        with pdfplumber.open(file_stream) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text: text_content += text + "\n"
        return re.sub(r'\s+', '', text_content).upper()
    except Exception as e:
        print(f"Erro PDF: {e}")
        return ""

@app.route('/api/audit_pdf', methods=['POST'])
def audit_pdf():
    print("📥 Recebendo requisição de auditoria...")
    
    # 1. Init DB
    db = get_firestore_client()
    if not db:
        return jsonify({'error': 'Falha na autenticação do banco de dados'}), 500

    # 2. Get Data from DB
    print("⏳ Carregando unitizadores do banco...")
    unitizer_map = {}
    docs = db.collection('tb_despachos_conferencia').stream()
    
    for doc in docs:
        doc_data = doc.to_dict()
        doc_id = doc.id
        itens = doc_data.get('itens', [])
        
        for idx, item in enumerate(itens):
            # Normalizar estrutura do item
            item_dict = {}
            if isinstance(item, str):
                item_dict = {'unitizador': item.split(' - ')[0]}
            elif isinstance(item, dict):
                item_dict = item
            
            code = item_dict.get('unitizador', '').strip()
            if code:
                norm_code = code.replace(" ", "").upper()
                unitizer_map[norm_code] = {
                    "doc_id": doc_id,
                    "item_index": idx,
                    "data": item_dict 
                }

    all_db_codes = set(unitizer_map.keys())
    print(f"✅ {len(all_db_codes)} unitizadores carregados.")

    # 3. Process Files
    files_to_process = []
    
    # helper to process allowed files
    def process_form_file(key, type_label):
        file = request.files.get(key)
        month = request.form.get(key.replace('file_', 'month_'))
        price = request.form.get(key.replace('file_', 'price_'))
        
        if file:
            print(f"📄 Processando {type_label}: {file.filename} ({month})")
            return {
                'type': type_label,
                'content': extract_text_from_pdf(file),
                'month': month,
                'price': float(price) if price else 0.0
            }
        return None

    if 'file_postal' in request.files:
        f = process_form_file('file_postal', 'Postal')
        if f: files_to_process.append(f)
        
    if 'file_densa' in request.files:
        f = process_form_file('file_densa', 'Densa')
        if f: files_to_process.append(f)

    if not files_to_process:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    # 4. Cross-Reference & Prepare Updates
    found_codes = set()
    updates_by_doc = {} # doc_id -> list of updated items
    
    for f_info in files_to_process:
        pdf_text = f_info['content']
        
        for code in all_db_codes:
            if code in pdf_text:
                found_codes.add(code)
                
                # Prepare Update Data
                meta = unitizer_map[code]
                item_data = meta['data']
                
                # Check if update is needed
                needs_update = False
                if not item_data.get('correios_match'): needs_update = True
                if item_data.get('correios_ref_month') != f_info['month']: needs_update = True
                
                if needs_update:
                    item_data['correios_match'] = True
                    item_data['correios_ref_month'] = f_info['month']
                    item_data['correios_type'] = f_info['type']
                    item_data['correios_value'] = f_info['price']
                    
                    doc_id = meta['doc_id']
                    if doc_id not in updates_by_doc:
                        updates_by_doc[doc_id] = []
                    
                    # We store the MODIFIED item data
                    # Wait! Logic issue: If a doc has 10 items, we need the whole array to update it properly via 'update'
                    # or strictly use array manipulation if we want to be fancy.
                    # EASIER: Since we loaded ALL data, we can just reconstruct the array for the doc.
                    pass

    # 5. Apply Updates (Batching per document)
    # Re-reading docs that need updates to ensure safety or using loaded data?
    # Using loaded data is faster but theoretically risky if concurrent edits. 
    # For local server single user, it's fine.
    
    updated_count = 0
    
    # Group by Doc to minimize writes
    # We need to re-fetch the specific docs to ensure we have the full array structure correct before writing back
    # Or rely on the 'unitizer_map' if it holds reference to mutable objects? No, deepcopy issues.
    
    # Better strategy: Loop through the 'updates_by_doc' keys, fetch doc, update metrics, write back.
    # To do that efficiently, we need to know WHICH docs contain found unitizers.
    
    docs_to_update = set()
    for code in found_codes:
        docs_to_update.add(unitizer_map[code]['doc_id'])
    
    print(f"💾 Atualizando {len(docs_to_update)} documentos no Firestore...")
    
    batch = db.batch()
    batch_count = 0
    
    for doc_id in docs_to_update:
        doc_ref = db.collection('tb_despachos_conferencia').document(doc_id)
        # We need to read current state to update array
        snapshot = doc_ref.get()
        if not snapshot.exists: continue
        
        d_data = snapshot.to_dict()
        d_itens = d_data.get('itens', [])
        modified = False
        
        new_itens = []
        for item in d_itens:
            # Normalize item
            i_dict = item if isinstance(item, dict) else {'unitizador': item.split(' - ')[0]}
            code = i_dict.get('unitizador', '').strip().replace(" ", "").upper()
            
            # Check if this specific item was found in THIS upload session
            # We need to know WHICH file found it to apply correct metadata
            
            # Simple check: is code in found_codes?
            if code in found_codes:
                # Find which file info applies (Postal vs Densa priority? or just last one?)
                # If in both, usually Densa/Postal might duplicate.
                # Let's verify against the files processed.
                
                matched_file = None
                for f in files_to_process:
                    if code in f['content']:
                        matched_file = f
                        break # Take first match
                
                if matched_file:
                    # Check if changes needed
                    if i_dict.get('correios_match') != True or \
                       i_dict.get('correios_ref_month') != matched_file['month']:
                        
                        i_dict['correios_match'] = True
                        i_dict['correios_ref_month'] = matched_file['month']
                        i_dict['correios_type'] = matched_file['type']
                        i_dict['correios_value'] = matched_file['price']
                        modified = True
            
            new_itens.append(i_dict)
            
        if modified:
            batch.update(doc_ref, {'itens': new_itens})
            batch_count += 1
            updated_count += 1
            
            if batch_count >= 400: # Firestore batch limit 500
                batch.commit()
                batch = db.batch()
                batch_count = 0

    if batch_count > 0:
        batch.commit()

    missing_list = sorted(list(all_db_codes - found_codes))
    
    print("✅ Processamento concluído.")
    
    return jsonify({
        "status": "success",
        "found_count": len(found_codes),
        "missing_count": len(missing_list),
        "total_processed": len(all_db_codes),
        "docs_updated": updated_count,
        "missing_codes": missing_list
    })

if __name__ == '__main__':
    try:
        print("🚀 Servidor de Auditoria Local rodando em http://localhost:5000")
        app.run(port=5000)
    except Exception as e:
        print(f"❌ ERRO CRÍTICO AO INICIAR SERVIDOR: {e}")
        input("Pressione Enter para fechar...")

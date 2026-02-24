
import firebase_admin
from firebase_admin import credentials, firestore
import google.auth

# CONFIG
PROJECT_ID = 'gestao-frota-tim' # Hardcoded to match frontend
APP_ID = 'frota-tim-oficial'
COLLECTIONS = [
    'tb_despachos_conferencia',
    f'artifacts/{APP_ID}/despachos'
]

# CITY MAPPING RULES
# 1. To Uppercase
# 2. Add "AC " prefix if not "SANTAREM" (handled specially) or if not already present
# 3. Handle specific replacements (accents)

def standardize_city(city_name):
    if not city_name: return city_name
    
    # 1. Uppercase & Trim
    s = city_name.strip().upper()
    
    # 2. Remove Accents / Specific fixes
    replacements = {
        'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A',
        'É': 'E', 'Ê': 'E',
        'Í': 'I',
        'Ó': 'O', 'Õ': 'O', 'Ô': 'O',
        'Ú': 'U',
        'Ç': 'C',
        'MOJUÍ': 'MOJUI',
        'MOJUI DOS CAMPOS': 'MOJUI DOS CAMPOS', # Just to be safe
        'ÓBIDOS': 'OBIDOS',
        'OBIDOS': 'OBIDOS',
        'ORIXIMINÁ': 'ORIXIMINA',
        'ORIXIMINA': 'ORIXIMINA',
        'RURÓPOLIS': 'RUROPOLIS',
        'RUROPOLIS': 'RUROPOLIS',
        'BELÉM': 'BELEM',
        'BELEM': 'BELEM',
        'SANTARÉM': 'SANTAREM',
        'SANTAREM': 'SANTAREM',
        'CDD SANTAREM': 'CDD SANTAREM',
        'AC SANTAREM': 'AC SANTAREM'
    }
    
    for k, v in replacements.items():
        s = s.replace(k, v)
        
    # 3. Prefix Logic
    # If it is EXACTLY "SANTAREM", user said default to "CDD SANTAREM" for logic, 
    # but for existing data, "Santarém" usually implies the main hub. 
    # Let's map "SANTAREM" -> "CDD SANTAREM" as per our modal logic default.
    
    if s == 'SANTAREM':
        return 'CDD SANTAREM'
        
    # If start with AC or CDD, leave it
    if s.startswith('AC ') or s.startswith('CDD '):
        return s
        
    # Else add AC
    return f'AC {s}'

def migrate():
    print("🚀 Iniciando migração de cidades...")
    
    try:
        # Auth usually works with ADC if logged in via gcloud, or we try to use the credentials.json 
        # But credentials.json here is OAuth Client ID (for frontend auth), NOT Service Account.
        # Python Admin SDK needs Service Account OR default credentials.
        # Check if we can use ADC.
        cred = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])[0]
        firebase_admin.initialize_app(credentials.ApplicationDefault(), {
            'projectId': PROJECT_ID,
        })
    except Exception as e:
        print(f"⚠️ Erro ao autenticar com ADC: {e}")
        print("Tentando método alternativo (pode falhar se não tiver credencial de serviço)...")
        # Since user doesn't have a service account file explicitly mentioned (local_server.py tried to use one but commented out), 
        # this script might fail if 'gcloud auth application-default login' wasn't run.
        # However, previous local_server.py suggested it MIGHT work if logged in.
        return

    db = firestore.client()
    
    for col_path in COLLECTIONS:
        print(f"\n📂 Processando coleção: {col_path}")
        docs = db.collection(col_path).stream()
        
        batch = db.batch()
        count = 0
        total_updated = 0
        
        for doc in docs:
            data = doc.to_dict()
            doc_ref = doc.reference
            updates = {}
            
            # Check Origem
            origem = data.get('origem')
            if origen := standardize_city(origem):
                if origen != origem:
                    updates['origem'] = origen

            # Check Destino
            destino = data.get('destino')
            if destin := standardize_city(destino):
                if destin != destino:
                    updates['destino'] = destin
            
            # Commit if changes
            if updates:
                batch.update(doc_ref, updates)
                count += 1
                total_updated += 1
                print(f"   - {doc.id}: {updates}")
            
            if count >= 400:
                batch.commit()
                batch = db.batch()
                count = 0
                
        if count > 0:
            batch.commit()
            
        print(f"✅ Concluído {col_path}: {total_updated} documentos atualizados.")

if __name__ == "__main__":
    migrate()

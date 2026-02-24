import os
import json
import time
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.cloud import firestore

TOKEN_FILE = 'firestore_token.json'
CREDENTIALS_FILE = 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/datastore']

def get_firestore_client():
    creds = None
    if os.path.exists(TOKEN_FILE):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        except:
            print("⚠️ Token salvo inválido.")
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

            print("🔑 Autenticação necessária. Uma janela do navegador deve abrir...")
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

    try:
        with open(CREDENTIALS_FILE) as f:
            c_data = json.load(f)
            project_id = c_data.get('installed', {}).get('project_id')

        print(f"🔌 Conectando ao Firestore: {project_id}")
        return firestore.Client(credentials=creds, project=project_id)
    except Exception as e:
        print(f"❌ Erro Firestore: {e}")
        return None

def main():
    print("========================================")
    print(" INICIANDO MIGRAÇÃO DO BANCO DE DADOS")
    print("========================================")
    
    db = get_firestore_client()
    if not db:
        print("Falha na autenticação.")
        return

    print("Verificando documentos na coleção 'tb_despachos_conferencia'...")
    try:
        docs = db.collection('tb_despachos_conferencia').stream()
        
        migracoes = []
        for doc in docs:
            # Documentos com IDs aleatórios costumam ter 20 caracteres
            if len(doc.id) == 20:
                data = doc.to_dict()
                nota_id = data.get('nota_despacho')
                if nota_id and str(nota_id).startswith('NN'):
                    migracoes.append({
                        'origem_id': doc.id,
                        'destino_id': str(nota_id).strip(),
                        'data': data
                    })

        total = len(migracoes)
        print(f"Foram encontrados {total} documentos importados via Excel com IDs aleatórios.")
        
        if total == 0:
            print("Nenhuma migração necessária.")
            return

        confirm = input(f"Deseja iniciar a migração segura para o padrão de ID NN... agora? (S/N): ")
        if confirm.upper() != 'S':
            print("Operação cancelada.")
            return

        print("Migrando... (Isso pode levar alguns minutos)")
        
        # Batch writing (limite de 500 ops por vez no Firebase, 
        # mas faremos lotes de 200 writes + 200 deletes para folga)
        batch = db.batch()
        ops_count = 0
        migrados = 0

        for m in migracoes:
            target_ref = db.collection('tb_despachos_conferencia').document(m['destino_id'])
            source_ref = db.collection('tb_despachos_conferencia').document(m['origem_id'])
            
            # Criar novo
            batch.set(target_ref, m['data'])
            # Deletar antigo
            batch.delete(source_ref)
            
            ops_count += 2
            migrados += 1
            
            if ops_count >= 400:
                batch.commit()
                print(f"Lote concluído. Migrados até agora: {migrados} de {total}...")
                batch = db.batch()
                ops_count = 0
                time.sleep(1) # Pequeña pausa para não exceder taxa de backend

        # Commit os restantes
        if ops_count > 0:
            batch.commit()

        print("========================================")
        print(f"✅ SUCESSO! {migrados} notas migradas com segurança para o robô.")
        print("========================================")

    except Exception as e:
        print(f"❌ Erro durante a migração: {e}")

if __name__ == '__main__':
    main()

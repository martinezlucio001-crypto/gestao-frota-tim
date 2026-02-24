
import firebase_admin
from firebase_admin import credentials, firestore
import google.auth

# CONFIG
PROJECT_ID = 'gestao-frota-tim'
APP_ID = 'frota-tim-oficial'

# ONDE ESTÃO OS DADOS:
# 1. 'tb_despachos_conferencia' -> Dados importados AUTOMATICAMENTE pelo Robô de E-mails.
# 2. f'artifacts/{APP_ID}/despachos' -> Dados MANUAIS ou IMPORTADOS via planilha na página nova.
# 3. f'artifacts/{APP_ID}/abastecimentos' -> Dados de COMBUSTÍVEL/FROTA (NÃO TOCAR!!!)

# APAGAR APENAS DADOS DO ROBÔ (Para reprocessar e-mails)
COLLECTIONS_TO_CLEAR = [
    'tb_despachos_conferencia', 
    # 'artifacts/{APP_ID}/despachos' # <--- COMENTADO POR SEGURANÇA. Descomente se quiser apagar os manuais também.
]

def delete_collection(coll_ref, batch_size):
    docs = coll_ref.limit(batch_size).stream()
    deleted = 0

    for doc in docs:
        print(f'Deletando doc {doc.id}...')
        doc.reference.delete()
        deleted = deleted + 1

    if deleted >= batch_size:
        return delete_collection(coll_ref, batch_size)
        
    return deleted

def clear_db():
    print("⚠️  ATENÇÃO: Você está prestes a limpar os dados do ROBÔ DE E-MAILS.")
    print(f"Coleções alvo: {COLLECTIONS_TO_CLEAR}")
    print("OBS: Os dados de Combustível/Frota NÃO serão tocados.")
    
    confirm = input("Digite 'DELETAR' para confirmar: ")
    
    if confirm != 'DELETAR':
        print("Operação cancelada.")
        return

    try:
        # Tenta pegar credencial padrão (gcloud auth application-default login)
        cred = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])[0]
        firebase_admin.initialize_app(credentials.ApplicationDefault(), {
            'projectId': PROJECT_ID,
        })
    except Exception as e:
        print(f"Erro de autenticação: {e}")
        print("Tente rodar 'gcloud auth application-default login' no terminal antes.")
        return

    db = firestore.client()

    for col_path in COLLECTIONS_TO_CLEAR:
        print(f"\n🗑️  Limpando coleção: {col_path}")
        ref = db.collection(col_path)
        delete_collection(ref, 50)
        print("✅ Coleção limpa.")

if __name__ == "__main__":
    clear_db()

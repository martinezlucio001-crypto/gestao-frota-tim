"""
Migração: Base64 → Firebase Storage + Criação de portalAccess
=====================================================================
Este script faz duas coisas:
1. Cria documentos portalAccess para motoristas e admins
2. Migra imagens base64 nos entries do Firestore para o Firebase Storage

Uso: python migrate_base64_to_storage.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
import base64
import sys
import time
import uuid
import requests
import google.auth.transport.requests
from google.oauth2 import service_account

# Inicializar Firebase Admin (apenas Firestore)
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

APP_ID = "frota-tim-oficial"

# Firebase Storage config  
STORAGE_BUCKET = "gestao-frota-tim.firebasestorage.app"

# Criar credenciais OAuth2 para o Storage REST API
SCOPES = ["https://www.googleapis.com/auth/firebase.storage", "https://www.googleapis.com/auth/cloud-platform"]
sa_creds = service_account.Credentials.from_service_account_file("serviceAccountKey.json", scopes=SCOPES)
auth_request = google.auth.transport.requests.Request()
sa_creds.refresh(auth_request)

# ============================================================
# PARTE 1: Criar documentos portalAccess
# ============================================================

PORTAL_USERS = {
    # Motoristas
    "bXm3aIIeofR2hSfkjlRAD4KHYGI2": {"name": "Alexandre", "allowedPortals": ["motorista"]},
    "GrXEYjN2I7XPhdXZanbT87hZqTH3": {"name": "Lobato", "allowedPortals": ["motorista"]},
    "Mk7IiCp6yXcjUQD6k3nsuQtF9H23": {"name": "Luiz", "allowedPortals": ["motorista"]},
    "ecMxCaShUMdaavvGHQheNcXsiOA3": {"name": "Teste", "allowedPortals": ["motorista"]},
    "5FmNd8r3gIhlqIbScTHn8DC8eBG3": {"name": "Charles", "allowedPortals": ["motorista"]},
    "kSTAqCKR8id8BLcNHhZPhaDRHYn1": {"name": "Emerson", "allowedPortals": ["motorista"]},
    "DVX2N0lG4kVUaEdcJNWJCRQAgh03": {"name": "Rodilson", "allowedPortals": ["motorista"]},
    "Q0Iv2C8Uz7PvlU8PkpUwH7rSqcG2": {"name": "Vagno", "allowedPortals": ["motorista"]},
    "tso2hFytuqS02mXXUEgmQXdAIgs2": {"name": "Carlos", "allowedPortals": ["motorista"]},
    # Admins
    "TjxPv2prIFcr4zfNEHijItb9Y7q1": {"name": "Lúcio", "allowedPortals": ["admin"]},
    "Eaeq8817o8N87z84b9Y5InIxTQz1": {"name": "Gladys", "allowedPortals": ["admin"]},
}


def criar_portal_access():
    """Cria documentos portalAccess para todos os usuários."""
    print("\n" + "=" * 60)
    print("PARTE 1: Criando documentos portalAccess")
    print("=" * 60)
    
    criados = 0
    existentes = 0
    
    for uid, data in PORTAL_USERS.items():
        doc_ref = db.collection("portalAccess").document(uid)
        doc = doc_ref.get()
        
        if doc.exists:
            print(f"  ⚠️  {data['name']} ({uid[:8]}...) — já existe, pulando")
            existentes += 1
        else:
            doc_ref.set({
                "name": data["name"],
                "allowedPortals": data["allowedPortals"],
                "createdAt": firestore.SERVER_TIMESTAMP,
            })
            portal_str = ", ".join(data["allowedPortals"])
            print(f"  ✅ {data['name']} ({uid[:8]}...) — criado [{portal_str}]")
            criados += 1
    
    print(f"\n📊 Resultado: {criados} criados, {existentes} já existiam")
    return criados


# ============================================================
# PARTE 2: Migrar base64 para Storage
# ============================================================

FIELDS_TO_MIGRATE = [
    ("odometerBeforePhoto", "odometerBefore"),
    ("odometerAfterPhoto", "odometerAfter"),
    ("receiptPhoto", "receipt"),
]


def is_base64_image(value):
    """Verifica se o valor é uma string base64 de imagem."""
    if not isinstance(value, str):
        return False
    return value.startswith("data:image/")


def upload_base64_to_storage(base64_string, storage_path):
    """Faz upload de uma string base64 para o Firebase Storage via REST API."""
    try:
        # Separar o header do conteúdo
        header, b64_data = base64_string.split(",", 1)
        
        # Decodificar
        image_bytes = base64.b64decode(b64_data)
        
        # Determinar content type
        content_type = "image/jpeg"
        if "image/png" in header:
            content_type = "image/png"
        elif "image/webp" in header:
            content_type = "image/webp"
        
        # Gerar token de download
        download_token = str(uuid.uuid4())
        
        # Refresh token se necessário
        if not sa_creds.valid:
            sa_creds.refresh(auth_request)
        
        # Upload via Firebase Storage REST API
        encoded_path = requests.utils.quote(storage_path, safe='')
        upload_url = f"https://firebasestorage.googleapis.com/v0/b/{STORAGE_BUCKET}/o/{encoded_path}"
        
        headers = {
            "Authorization": f"Bearer {sa_creds.token}",
            "Content-Type": content_type,
            "X-Goog-Upload-Protocol": "raw",
        }
        
        response = requests.post(upload_url, headers=headers, data=image_bytes)
        
        if response.status_code != 200:
            print(f"    ❌ Upload HTTP {response.status_code}: {response.text[:100]}")
            return None
        
        # Atualizar metadata com o download token
        metadata_url = f"https://firebasestorage.googleapis.com/v0/b/{STORAGE_BUCKET}/o/{encoded_path}"
        metadata_headers = {
            "Authorization": f"Bearer {sa_creds.token}",
            "Content-Type": "application/json",
        }
        metadata_body = {
            "metadata": {"firebaseStorageDownloadTokens": download_token}
        }
        requests.patch(metadata_url, headers=metadata_headers, json=metadata_body)
        
        # Construir URL de download
        url = f"https://firebasestorage.googleapis.com/v0/b/{STORAGE_BUCKET}/o/{encoded_path}?alt=media&token={download_token}"
        return url
        
    except Exception as e:
        print(f"    ❌ Erro no upload: {e}")
        return None


def migrar_base64():
    """Migra imagens base64 dos entries para o Firebase Storage."""
    print("\n" + "=" * 60)
    print("PARTE 2: Migrando imagens base64 → Firebase Storage")
    print("=" * 60)
    
    # Buscar todos os entries
    entries_ref = db.collection("artifacts").document(APP_ID).collection("public").document("data").collection("entries")
    entries = entries_ref.stream()
    
    total_docs = 0
    docs_migrados = 0
    fotos_migradas = 0
    erros = 0
    
    entries_list = list(entries)
    total_docs = len(entries_list)
    print(f"\n📋 Total de registros encontrados: {total_docs}")
    
    for i, entry_doc in enumerate(entries_list):
        doc_id = entry_doc.id
        data = entry_doc.to_dict()
        updates = {}
        had_base64 = False
        
        for field_name, storage_name in FIELDS_TO_MIGRATE:
            value = data.get(field_name)
            if is_base64_image(value):
                had_base64 = True
                size_kb = len(value) / 1024
                storage_path = f"entries/{doc_id}/{storage_name}"
                
                print(f"  [{i+1}/{total_docs}] {doc_id[:8]}... → {storage_name} ({size_kb:.0f} KB)", end=" ")
                
                url = upload_base64_to_storage(value, storage_path)
                if url:
                    updates[field_name] = url
                    # Manter compatibilidade com o painel admin
                    if storage_name == "odometerBefore":
                        updates["odometerUrl"] = url
                    elif storage_name == "receipt":
                        updates["receiptUrl"] = url
                    fotos_migradas += 1
                    print("✅")
                else:
                    erros += 1
                    print("❌")
        
        # Atualizar documento se houve migração
        if updates:
            updates["hasReceipt"] = bool(updates.get("receiptUrl") or updates.get("receiptPhoto"))
            updates["hasOdometer"] = bool(
                updates.get("odometerUrl") or updates.get("odometerBeforePhoto") or 
                data.get("odometerAfterPhoto", "").startswith("http") if isinstance(data.get("odometerAfterPhoto"), str) else False
            )
            entries_ref.document(doc_id).update(updates)
            docs_migrados += 1
        elif not had_base64 and (i + 1) % 20 == 0:
            print(f"  [{i+1}/{total_docs}] Processando... (sem base64)")
    
    print(f"\n📊 Resultado da migração:")
    print(f"   📄 Documentos processados: {total_docs}")
    print(f"   🔄 Documentos migrados: {docs_migrados}")
    print(f"   📸 Fotos migradas: {fotos_migradas}")
    print(f"   ❌ Erros: {erros}")
    
    return docs_migrados, fotos_migradas, erros


# ============================================================
# EXECUÇÃO
# ============================================================

if __name__ == "__main__":
    print("\n🚀 Iniciando migração Base64 → Firebase Storage")
    print("=" * 60)
    
    # Parte 1
    criar_portal_access()
    
    # Parte 2
    docs, fotos, erros = migrar_base64()
    
    print("\n" + "=" * 60)
    if erros == 0:
        print("✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!")
    else:
        print(f"⚠️  MIGRAÇÃO CONCLUÍDA COM {erros} ERRO(S)")
    print("=" * 60)

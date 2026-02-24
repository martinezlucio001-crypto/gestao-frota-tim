import os
import re
import glob
import pdfplumber

# Google Auth
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.cloud import firestore

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
            # Run local server with fixed port if possible or rely on console
            creds = flow.run_local_server(port=0)
        
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

    try:
        # Infer project_id from credentials.json if possible, or just init
        # Loading JSON to get project_id is safer
        import json
        with open(CREDENTIALS_FILE) as f:
            c_data = json.load(f)
            project_id = c_data.get('installed', {}).get('project_id')

        print(f"🔌 Conectando ao Firestore: {project_id}")
        return firestore.Client(credentials=creds, project=project_id)
    except Exception as e:
        print(f"❌ Erro Firestore: {e}")
        return None

def get_all_unitizers(db):
    print("⏳ Lendo banco de dados (tb_despachos_conferencia)...")
    docs = db.collection('tb_despachos_conferencia').stream()
    unitizers = set()
    for doc in docs:
        data = doc.to_dict()
        for item in data.get('itens', []):
            code = item if isinstance(item, str) else item.get('unitizador', '')
            if isinstance(code, str): code = code.split(' - ')[0]
            if code: unitizers.add(code.replace(" ", "").upper())
    print(f"✅ {len(unitizers)} unitizadores carregados do sistema.")
    return unitizers

def extract_text_from_pdf(path):
    print(f"📄 Lendo PDF: {path} (Aguarde...)")
    text = ""
    try:
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                if i % 20 == 0: print(f"   Processando página {i+1}...")
                text += (page.extract_text() or "") + "\n"
        return re.sub(r'\s+', '', text).upper()
    except Exception as e:
        print(f"❌ Erro PDF: {e}")
        return ""

def select_file():
    pdfs = glob.glob("*.pdf")
    if not pdfs:
        print("❌ Nenhum arquivo PDF encontrado nesta pasta.")
        return None
    
    print("\nArquivos PDF encontrados:")
    for i, f in enumerate(pdfs):
        print(f"[{i+1}] {f}")
    
    while True:
        choice = input("\nEscolha o número do arquivo (ou 0 para sair): ")
        if choice == '0': return None
        if choice.isdigit() and 1 <= int(choice) <= len(pdfs):
            return pdfs[int(choice)-1]
        print("Opção inválida.")

def main():
    print("="*40)
    print(" AUDITORIA DE UNITIZADORES (LOCAL)")
    print("="*40)

    # 1. DB
    db = get_firestore_client()
    if not db: return

    # 2. File
    path = select_file()
    if not path: return

    # 3. Process
    db_codes = get_all_unitizers(db)
    pdf_text = extract_text_from_pdf(path)

    # 4. Compare
    print("\n🔍 Comparando dados...")
    found = [c for c in db_codes if c in pdf_text]
    missing = [c for c in db_codes if c not in pdf_text]

    print("\n" + "-"*30)
    print(f"🎯 RESULTADO: {path}")
    print("-"*30)
    print(f"Total Sistema:   {len(db_codes)}")
    print(f"Encontrados:     {len(found)} ✅")
    print(f"Não Localizados: {len(missing)} ❌")

    if missing:
        if input("\nSalvar lista de ausentes? (S/N): ").upper() == 'S':
            with open("faltantes.txt", "w") as f:
                f.write("\n".join(sorted(missing)))
            print("📝 Salvo em 'faltantes.txt'")
    
    input("\nPressione Enter para encerrar...")

if __name__ == "__main__":
    main()

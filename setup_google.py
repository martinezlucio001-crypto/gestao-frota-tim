from google_auth_oauthlib.flow import InstalledAppFlow
import os

# Define que queremos permissão para ler e modificar (tirar a etiqueta)
SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

def main():
    # Verifica se você tem o arquivo que baixou do Google
    if not os.path.exists('credentials.json'):
        print("❌ ERRO: O arquivo 'credentials.json' não está nesta pasta.")
        return

    # Inicia o fluxo de login
    flow = InstalledAppFlow.from_client_secrets_file(
        'credentials.json', SCOPES)
    
    # O 'prompt=consent' força o Google a te dar um novo Refresh Token
    creds = flow.run_local_server(port=0, access_type='offline', prompt='consent')

    print("\n" + "="*60)
    print("✅ SUCESSO! DADOS PARA A VERCEL (Copie tudo abaixo):")
    print("="*60)
    
    print(f"\nGOOGLE_REFRESH_TOKEN:\n{creds.refresh_token}")
    print(f"\nGOOGLE_CLIENT_ID:\n{creds.client_id}")
    print(f"\nGOOGLE_CLIENT_SECRET:\n{creds.client_secret}")
    
    print("\n" + "="*60)

if __name__ == '__main__':
    main()
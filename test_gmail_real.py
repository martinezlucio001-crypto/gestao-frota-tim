import os.path
import base64
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from bs4 import BeautifulSoup
import re

# Escopos (Permissão de Leitura)
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def main():
    creds = None
    # Tenta usar o token.json se já existir (login salvo)
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # Se não tiver login válido, abre o navegador
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Salva para a próxima vez
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    service = build('gmail', 'v1', credentials=creds)

    # 1. Busca o ID do Label ROBO_TIM
    results = service.users().labels().list(userId='me').execute()
    labels = results.get('labels', [])
    label_id = next((l['id'] for l in labels if l['name'] == 'ROBO_TIM'), None)

    if not label_id:
        print("❌ ERRO: Label 'ROBO_TIM' não encontrada no seu Gmail.")
        return

    print(f"✅ Label ROBO_TIM encontrada! ID: {label_id}")

    # 2. Busca mensagens com esse Label
    results = service.users().messages().list(userId='me', labelIds=[label_id], maxResults=1).execute()
    messages = results.get('messages', [])

    if not messages:
        print("⚠️ AVISO: Nenhum e-mail com a etiqueta ROBO_TIM encontrado.")
        print("Dica: Envie um e-mail de teste e aplique o marcador manualmente para testar.")
        return

    print("📧 E-mail encontrado! Baixando conteúdo...")

    # 3. Baixa o conteúdo do e-mail
    msg = service.users().messages().get(userId='me', id=messages[0]['id'], format='full').execute()
    payload = msg['payload']
    headers = payload.get('headers')
    
    # Pega o Assunto
    subject = next(h['value'] for h in headers if h['name'] == 'Subject')
    print(f"\n--- ASSUNTO: {subject} ---")

    # Decodifica o HTML
    def get_html_body(payload):
        if 'parts' in payload:
            for part in payload['parts']:
                if part['mimeType'] == 'text/html':
                    return base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
        elif payload.get('mimeType') == 'text/html':
             return base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
        return ""

    html = get_html_body(payload)
    
    if not html:
        print("❌ ERRO: Não consegui extrair o HTML do e-mail.")
        return

    # 4. Tenta Extrair os Dados (Teste da Lógica)
    soup = BeautifulSoup(html, 'html.parser')
    # Procura Nota
    nota_encontrada = "Não encontrada"
    if "Nota de Despacho" in html:
        match = re.search(r'NN\d+', html)
        if match:
            nota_encontrada = match.group(0)
            print(f"✅ SUCESSO! Nota identificada no HTML: {nota_encontrada}")
        else:
            print("⚠️ Achei a tabela, mas não achei o padrão 'NN123...'")
    else:
        print("❌ ERRO: O texto 'Nota de Despacho' não está no HTML.")

    print("\nTeste concluído. Se apareceu a Nota acima, o robô vai funcionar na Vercel!")

if __name__ == '__main__':
    main()
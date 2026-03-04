import firebase_admin
from firebase_admin import credentials, firestore
import json
import os

creds_path = "C:/Users/marti/OneDrive/Desktop/gestao-frota-tim/serviceAccountKey.json"
if os.path.exists(creds_path):
    cred = credentials.Certificate(creds_path)
    if not len(firebase_admin._apps):
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    appId = "frota-tim-oficial"
    docs = db.collection('artifacts').document(appId).collection('public').document('data').collection('entries').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(5).get()
    doc = db.collection('artifacts').document(appId).collection('public').document('data').collection('entries').document('QwakSoVg8ge2bgEybXmM').get()
    with open('output.txt', 'w') as f:
        f.write(json.dumps(doc.to_dict(), indent=2))
else:
    print("Credentials not found")

import pandas as pd
import unicodedata
import re
import os
import json
import requests
from io import StringIO
from datetime import datetime
import gspread
from google.oauth2.service_account import Credentials

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIARIO_PATH = os.path.join(BASE_DIR, 'backend', 'data', 'diario.txt')
OUTPUT_JSON = os.path.join(BASE_DIR, 'outputs', 'encontrados.json')
PLANILHA_URL = 'https://docs.google.com/spreadsheets/d/1k3i1Wm5nypzaA4aBTckffsNxw0kJW70rSmqViNVRkDM/gviz/tq?tqx=out:csv&sheet=Página1'

def normalize_text(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s.upper().strip()

try:
    response = requests.get(PLANILHA_URL)
    response.raise_for_status()
    lista_pessoas = pd.read_csv(StringIO(response.text))
    
    # Atualizado para incluir a nova coluna 'rf_hifen' (esperada na 8ª coluna da planilha)
    lista_pessoas.columns = [
        'nome', 'unidade', 'rf', 'rf_vinculo', 
        'rf_pontos_vinculo', 'rf_com_pontos', 
        'rf_hifen_vinculo', 'rf_hifen'
    ]
    
    with open(DIARIO_PATH, 'r', encoding='utf-8') as f:
        diario = normalize_text(f.read())
except Exception as e:
    print(f"Erro ao carregar dados: {e}")
    exit()

encontrados = []

for _, row in lista_pessoas.iterrows():
    nome = str(row['nome']) if pd.notna(row['nome']) else ""
    rf = str(row['rf']) if pd.notna(row['rf']) else ""
    rf_vinc = str(row['rf_vinculo']) if pd.notna(row['rf_vinculo']) else ""
    rf_pontos_vinc = str(row['rf_pontos_vinculo']) if pd.notna(row['rf_pontos_vinculo']) else ""
    rf_com_pontos = str(row['rf_com_pontos']) if pd.notna(row['rf_com_pontos']) else ""
    rf_hifen_vinc = str(row['rf_hifen_vinculo']) if pd.notna(row['rf_hifen_vinculo']) else ""
    rf_hifen = str(row['rf_hifen']) if pd.notna(row['rf_hifen']) else ""
    unidade = str(row['unidade']) if pd.notna(row['unidade']) else ""
    
    categoria = "CEI" if "CEI" in unidade.upper() else ("EMEI" if "EMEI" in unidade.upper() else "OUTROS")
    
    candidatos = {
        'NOME': [normalize_text(nome)],
        'RF': [rf],
        'RF_VINCULO': [rf_vinc],
        'RF_PONTOS_VINCULO': [rf_pontos_vinc],
        'RF_COM_PONTOS': [rf_com_pontos],
        'RF_HIFEN_VINCULO': [rf_hifen_vinc],
        'RF_HIFEN': [rf_hifen]
    }
    
    match_campo = None
    valor_match = ""
    for campo, valores in candidatos.items():
        valido = next((v for v in valores if v and v != "-1" and re.search(r'\b' + re.escape(v) + r'\b', diario)), None)
        if valido:
            match_campo = campo
            valor_match = valido
            break
    
    if match_campo:
        encontrados.append({
            'NOME': nome, 
            'UNIDADE': unidade, 
            'RF': rf, 
            'RF_VINCULO': rf_vinc,
            'RF_PONTOS_VINCULO': rf_pontos_vinc, 
            'RF_COM_PONTOS': rf_com_pontos,
            'RF_HIFEN_VINCULO': rf_hifen_vinc,
            'RF_HIFEN': rf_hifen,
            'TIPO': categoria, 
            'MATCH_CAMPO': match_campo,
            'VALOR_MATCH': valor_match
        })
        print(f"Match encontrado: {nome} | Campo: {match_campo} | Valor: {valor_match}")

os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(encontrados, f, ensure_ascii=False, indent=4)
print(f"Finalizado. {len(encontrados)} registros encontrados.")

# --- SALVAR NO HISTÓRICO DA PLANILHA GOOGLE ---
def salvar_no_historico(encontrados_lista):
    creds_path = os.path.join(BASE_DIR, 'backend', 'credentials.json')
    if not os.path.exists(creds_path):
        print("Arquivo credentials.json não encontrado. Pulando salvamento no histórico.")
        return

    try:
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        client = gspread.authorize(creds)
        
        planilha_url = "https://docs.google.com/spreadsheets/d/1k3i1Wm5nypzaA4aBTckffsNxw0kJW70rSmqViNVRkDM/edit?gid=567498651#gid=567498651"
        planilha = client.open_by_url(planilha_url)
        sheet = planilha.worksheet("Historico")
        
        data_atual = datetime.now().strftime("%d/%m/%Y")
        registros_existentes = sheet.get_all_records()

        linhas_novas = []
        for item in encontrados_lista:
            nome_pessoa = item['NOME']
            unidade_pessoa = item['UNIDADE']
            criterio_valor = item['VALOR_MATCH']
            
            ja_salvo = any(
                str(r.get('Data')) == data_atual and 
                str(r.get('Nome')) == nome_pessoa and 
                str(r.get('Unidade')) == unidade_pessoa 
                for r in registros_existentes
            )
            
            if not ja_salvo:
                linhas_novas.append([data_atual, nome_pessoa, unidade_pessoa, criterio_valor])
        
        if linhas_novas:
            sheet.append_rows(linhas_novas)
            print(f"{len(linhas_novas)} novos registros salvos no Histórico da planilha!")
        else:
            print("Nenhum registro novo para adicionar ao histórico.")
            
    except Exception as e:
        print(f"Erro ao atualizar histórico no Google Sheets: {e}")

salvar_no_historico(encontrados)
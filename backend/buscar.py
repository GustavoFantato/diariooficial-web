import pandas as pd
import unicodedata
import re
import os
import json
import requests
from io import StringIO

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
    # Ajustado para o novo nome da coluna 4: rf_pontos_vinculo
    lista_pessoas.columns = ['nome', 'unidade', 'rf', 'rf_vinculo', 'rf_pontos_vinculo', 'rf_com_pontos']
    
    with open(DIARIO_PATH, 'r', encoding='utf-8') as f:
        diario = normalize_text(f.read())
except Exception as e:
    print(f"Erro ao carregar dados: {e}")
    exit()

encontrados = []

for _, row in lista_pessoas.iterrows():
    nome = str(row['nome']) if pd.notna(row['nome']) else ""
    # RFs e variantes
    rf = str(row['rf']) if pd.notna(row['rf']) else ""
    rf_vinc = str(row['rf_vinculo']) if pd.notna(row['rf_vinculo']) else ""
    rf_pontos_vinc = str(row['rf_pontos_vinculo']) if pd.notna(row['rf_pontos_vinculo']) else ""
    rf_pontos = str(row['rf_com_pontos']) if pd.notna(row['rf_com_pontos']) else ""
    unidade = str(row['unidade']) if pd.notna(row['unidade']) else ""
    
    categoria = "CEI" if "CEI" in unidade.upper() else ("EMEI" if "EMEI" in unidade.upper() else "OUTROS")
    
    candidatos = {
        'NOME': [normalize_text(nome)],
        'RF': [rf],
        'RF_VINCULO': [rf_vinc],
        'RF_PONTOS_VINCULO': [rf_pontos_vinc],
        'RF_COM_PONTOS': [rf_pontos]
    }
    
    match_campo = None
    for campo, valores in candidatos.items():
        # Busca no diário usando regex para garantir bordas de palavra
        if any(re.search(r'\b' + re.escape(v) + r'\b', diario) for v in valores if v and v != "-1"):
            match_campo = campo
            break
    
    if match_campo:
        encontrados.append({
            'NOME': nome, 'UNIDADE': unidade, 'RF': rf, 'RF_VINCULO': rf_vinc,
            'RF_PONTOS_VINCULO': rf_pontos_vinc, 'RF_COM_PONTOS': rf_pontos,
            'TIPO': categoria, 'MATCH_CAMPO': match_campo
        })
        print(f"Match encontrado: {nome} | Campo: {match_campo}")

os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(encontrados, f, ensure_ascii=False, indent=4)
print(f"Finalizado. {len(encontrados)} registros encontrados.")
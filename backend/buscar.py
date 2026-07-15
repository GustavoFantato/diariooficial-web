import pandas as pd
import unicodedata
import re
import os
import json
import requests  # Importante: para baixar o CSV direto da web

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIARIO_PATH = os.path.join(BASE_DIR, 'backend', 'data', 'diario.txt')
OUTPUT_JSON = os.path.join(BASE_DIR, 'outputs', 'encontrados.json')

# O link da sua planilha
PLANILHA_URL = 'https://docs.google.com/spreadsheets/d/1k3i1Wm5nypzaA4aBTckffsNxw0kJW70rSmqViNVRkDM/gviz/tq?tqx=out:csv&sheet=Página1'

def normalize_text(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s.upper().strip()

# 1. Carrega os dados DIRETO da Planilha
try:
    # Baixa o conteúdo da planilha como CSV
    response = requests.get(PLANILHA_URL)
    response.raise_for_status()
    
    # Salva temporariamente na memória com o pandas
    from io import StringIO
    lista_pessoas = pd.read_csv(StringIO(response.text))
    
    # Define as colunas conforme o seu novo formato (6 colunas)
    lista_pessoas.columns = ['nome', 'unidade', 'rf', 'rf_vinculo', 'nome_sem_acento', 'rf_com_pontos']
    
    with open(DIARIO_PATH, 'r', encoding='utf-8') as f:
        diario = normalize_text(f.read())
except Exception as e:
    print(f"Erro ao carregar da planilha ou do diário: {e}")
    exit()

encontrados = []

print("Buscando no diário...")

# 2. Busca iterando pelas linhas
for _, row in lista_pessoas.iterrows():
    # Converte tudo para string e trata valores vazios (NaN)
    nome = str(row['nome']) if pd.notna(row['nome']) else ""
    nome_sem_acento = normalize_text(str(row['nome_sem_acento'])) if pd.notna(row['nome_sem_acento']) else ""
    rf = str(row['rf']) if pd.notna(row['rf']) else ""
    rf_pontos = str(row['rf_com_pontos']) if pd.notna(row['rf_com_pontos']) else ""
    rf_vinc = str(row['rf_vinculo']) if pd.notna(row['rf_vinculo']) else ""
    unidade = str(row['unidade']) if pd.notna(row['unidade']) else ""
    
    categoria = "CEI" if "CEI" in unidade.upper() else ("EMEI" if "EMEI" in unidade.upper() else "OUTROS")
    
    # Lógica de busca combinada
    possiveis_nomes = [normalize_text(nome), nome_sem_acento]
    possiveis_rfs = [rf, rf_pontos, rf_vinc]
    
    # Verifica se encontrou nome E RF (o 'any' garante que basta um dos formatos bater)
    encontrou_nome = any(re.search(r'\b' + re.escape(n) + r'\b', diario) for n in possiveis_nomes if n)
    encontrou_rf = any(r in diario for r in possiveis_rfs if r and r != "-1")
    
    if encontrou_nome or encontrou_rf:
        encontrados.append({
            'NOME': nome, 
            'UNIDADE': unidade,
            'RF': rf,
            'RF_VINCULO': rf_vinc,
            'NOME_SEM_ACENTO': row['nome_sem_acento'],
            'RF_COM_PONTOS': row['rf_com_pontos'],
            'TIPO': categoria
        })
        print(f"Encontrado: {nome} (Tipo: {categoria})")

# 3. Salva os resultados
os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(encontrados, f, ensure_ascii=False, indent=4)
print(f"Finalizado. {len(encontrados)} registros encontrados.")
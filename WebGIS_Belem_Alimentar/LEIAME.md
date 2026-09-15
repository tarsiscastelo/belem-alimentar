# Belém Alimentar – WebGIS (Produto 2)

Site estático: Leaflet + camadas em arquivos .js (GeoJSON). Sem servidor.

## Abrir no computador
Clique duas vezes em `index.html` (funciona offline; os mapas-base Mapa/Satélite precisam de internet).

## Publicar grátis no GitHub Pages
1. Crie uma conta em github.com e um repositório público (ex.: `belem-alimentar`).
2. Envie todo o conteúdo desta pasta (Add file → Upload files).
3. Settings → Pages → Branch `main` / pasta `/ (root)` → Save.
4. Em ~1 min o site fica em `https://SEU-USUARIO.github.io/belem-alimentar/`.

## Atualizar dados
- Edite as camadas no QGIS e rode `build_data.py` (Python + geopandas) dentro da pasta `INSTITUTO ESCOLHAS`; ele regrava `data/*.js`.
- Cores, nomes de camadas e rótulos de campos: bloco `FIELDS` e `LAYERS` em `app.js`.

## Estrutura
- `index.html` – layout e estilos
- `app.js` – mapa, camadas, pop-ups, busca, indicadores, downloads
- `data/` – camadas convertidas (WGS84, simplificadas) e `uso_solo.png`
- `lib/` – Leaflet 1.9.4

Malhas IBGE 2023 (Brasil, UFs, municípios do Pará) simplificadas para web; originais em `_DOUTORADO - TESE\IBGE`.

import geopandas as gpd, pandas as pd, json, warnings, numpy as np, unicodedata
from shapely.geometry import mapping
from shapely import set_precision, make_valid
warnings.filterwarnings("ignore")
OUT="/home/claude/webgis/data/"
UTM="EPSG:31982"
def fixtxt(s):
    if not isinstance(s,str): return s
    try: return s.encode("latin1").decode("utf-8",errors="ignore").strip()
    except Exception: return s.strip()
def rd(p,enc=None,crs=None):
    g=gpd.read_file(p,encoding=enc) if enc else gpd.read_file(p)
    if g.crs is None: g=g.set_crs(crs)
    return g
def to_js(key,g,cols,simplify=None,prec=5):
    g=g.copy()
    if simplify:
        g=g.to_crs(UTM); g["geometry"]=g.geometry.simplify(simplify,preserve_topology=True); 
    g=g.to_crs(4326)
    g=g[~g.geometry.is_empty & g.geometry.notna()]
    import shapely; g["geometry"]=shapely.transform(g.geometry.values, lambda c: np.round(c,prec))
    g=g[cols+["geometry"]]
    gj=json.loads(g.to_json(drop_id=True))
    for f in gj["features"]:
        f["properties"]={k:(None if (isinstance(v,float) and np.isnan(v)) else (round(v,4) if isinstance(v,float) else v)) for k,v in f["properties"].items()}
    s=json.dumps(gj,ensure_ascii=False,separators=(",",":"))
    open(OUT+key+".js","w").write(f"window.GEO=window.GEO||{{}};GEO[{json.dumps(key)}]={s};")
    print(key,len(gj["features"]),round(len(s)/1024),"KB")
    return g

norm=lambda s: unicodedata.normalize("NFKD",str(s)).encode("ascii","ignore").decode().upper().strip()

lim=rd("5. Recorte Belém/LIMITE_MUN_BELEM.shp"); to_js("limite",lim,["NM_MUN"],simplify=10)
bai=rd("5. Recorte Belém/BAIRROS_BELEM.shp"); bai["geometry"]=bai.geometry.make_valid()
bai=bai.rename(columns={"STRING":"bairro","COD_BAIRRO":"cod"})

fe=rd("5. Estabelecimentos públicos/FEIRAS/FEIRAS.shp").rename(columns={"Feiras_e_P":"nome","Total_de_P":"total_p","Total_de_E":"total_e","Ind_Feir_D":"indice","Cod":"cod"})
me=rd("5. Estabelecimentos públicos/MERCADOS/MERCADOS.shp").rename(columns={"Mercado":"nome","Indice_de":"indice","COD":"cod"})
me=me[me.geometry.notna() & ~me.geometry.is_empty]
po=rd("5. Estabelecimentos públicos/PORTOS/PORTOS.shp").rename(columns={"Porto_Feir":"nome","2019":"i2019","2021":"i2021","COD":"cod"})
po=po[po.geometry.notna() & ~po.geometry.is_empty]

def escolas(p,rede):
    g=rd(p,enc="latin1")
    for c in g.columns:
        if g[c].dtype==object: g[c]=g[c].map(fixtxt)
    g=g.rename(columns={"Name":"nome","Etapas_e_M":"etapas","Porte_da_E":"porte","C__digo_IN":"inep","Endere__o":"endereco","Localiza__":"localizacao","Telefone":"telefone"})
    g["rede"]=rede
    for c in ["etapas","porte","inep","endereco","localizacao","telefone"]:
        if c not in g: g[c]=None
    return g
em=escolas("5. Estabelecimentos públicos/ESCOLAS/Rede Municipal.shp","Municipal")
ee=escolas("5. Estabelecimentos públicos/ESCOLAS/Rede Estadual.shp","Estadual")
ef=gpd.read_file("5. Estabelecimentos públicos/ESCOLAS/Rede Federal.shp"); ef=ef.rename(columns={"Name":"nome"}); ef["rede"]="Federal"
import re
def parse(d,k):
    m=re.search(k+r":\s*([^<]*)",d or ""); return m.group(1).strip() if m else None
for c,k in [("etapas","Etapas e Modalidade de Ensino Oferecidas"),("porte","Porte da Escola"),("inep","Código INEP"),("endereco","Endereço"),("localizacao","Localização"),("telefone","Telefone")]:
    ef[c]=ef.descriptio.map(lambda d: parse(d,k))
cols_esc=["nome","rede","etapas","porte","inep","endereco","localizacao","telefone"]

ag=rd("5. Estabelecimentos Agropecuários/Poligonos agricultura.shp").rename(columns={"Bairro":"bairro"})
ep=rd("6. Espaços Potenciais/Espaços potenciais Final.shp").rename(columns={"Area":"area_m2","Bairro":"bairro","UC":"uc"})
ca=rd("5. Estabelecimentos Agropecuários/estab_agropec_belem_censo.shp",crs=4326)
ca["endereco"]=(ca.NOM_TIPO_S.fillna("")+" "+ca.NOM_SEGLOG.fillna("")).str.strip()
ca["localidade"]=ca.DSC_LOCALI.fillna("").str.strip()
uc=rd("5. Áreas ambientais e Assentamentos/ucs_belem.shp",crs=4326)
uc["nome"]=uc.Legenda.fillna(uc.NOME_UC1.str.title()); uc["esfera"]=uc.ESFERA5; uc["ano"]=uc.ANO_CRIA6; uc["ato"]=uc.ATO_LEGA9
uc["area_ha"]=(uc.to_crs(UTM).area/1e4).round(1)
asn=rd("5. Áreas ambientais e Assentamentos/Assentamento Brasil_PA.shp").rename(columns={"nome_proje":"nome","area_hecta":"area_ha","num_famili":"familias","capacidade":"capacidade","data_de_cr":"criacao"})
us=gpd.read_file("5. Uso do Solo/uso_ocupacao_belem_25_01_22.shp").rename(columns={"Classe":"classe"})
us=us.explode(index_parts=False); us["a"]=us.area
us=us[us.a>30000]  # remove fragmentos < 3 ha (escala web)
us["geometry"]=us.geometry.simplify(40,preserve_topology=True)
from shapely.ops import unary_union
from shapely.geometry import MultiPolygon
def mp(gs):
    out=[]
    for g in gs:
        out+= list(g.geoms) if hasattr(g,"geoms") else [g]
    return MultiPolygon([p for p in out if p.geom_type=="Polygon"])
us=gpd.GeoDataFrame([{"classe":k,"geometry":mp(v.geometry)} for k,v in us.groupby("classe")],crs=us.crs)
ina=gpd.read_file("5. Estabelecimentos Privados/estabelecimentos_innatura_misto.geojson")
ult=gpd.read_file("5. Estabelecimentos Privados/estabelecimentos_ultraprocessados.geojson")
hx=ina.merge(ult[["id","e_ultraprocessados","ultraprocessados_5k"]],on="id")
hx=hx.rename(columns={"e_innat_misto":"n_innatura","innat_misto_5k":"innatura_5k","e_ultraprocessados":"n_ultra","ultraprocessados_5k":"ultra_5k"})
hx["pct_ultra"]=np.where((hx.n_innatura+hx.n_ultra)>0, hx.n_ultra/(hx.n_innatura+hx.n_ultra)*100, np.nan).round(1)
ce=gpd.read_file("3. De onde vêm os alimentos/ceasa.shp").rename(columns={"_Municipio":"municipio","_Estado":"uf","_frutas":"frutas","_hort-folh":"hort_folha","_hort-frut":"hort_fruto","_hort-raiz":"hort_raiz"})
ce["total"]=ce[["frutas","hort_folha","hort_fruto","hort_raiz"]].sum(axis=1)
ce=ce[ce.total>0].sort_values("total",ascending=False)

# ---------- indicadores por bairro ----------
bu=bai.to_crs(UTM)
def count(pts,name):
    j=gpd.sjoin(pts.to_crs(UTM)[["geometry"]],bu.reset_index()[["cod","geometry"]],predicate="within")
    return j.groupby("cod").size().rename(name)
bu=bu.set_index("cod")
bu=bu.join(count(fe,"n_feiras")).join(count(me,"n_mercados")).join(count(em,"n_esc_mun")).join(count(ee,"n_esc_est")).join(count(ef,"n_esc_fed")).join(count(ag,"n_agric")).join(count(ca,"n_agropec"))
epc=ep.to_crs(UTM).copy(); epc["geometry"]=epc.geometry.representative_point()
j=gpd.sjoin(epc[["area_m2","geometry"]],bu.reset_index()[["cod","geometry"]],predicate="within"); bu=bu.join(j.groupby("cod").area_m2.sum().rename("area_pot_m2"))
bu=bu.fillna({c:0 for c in ["n_feiras","n_mercados","n_esc_mun","n_esc_est","n_esc_fed","n_agric","n_agropec","area_pot_m2"]})
bu["area_km2"]=(bu.area/1e6).round(2)
# população (soma dos hexágonos pelo centróide)
hc=hx.copy(); hc["geometry"]=hc.geometry.centroid
j=gpd.sjoin(hc[["populacao","n_innatura","n_ultra","geometry"]],bu.reset_index()[["cod","geometry"]],predicate="within")
bu=bu.join(j.groupby("cod")[["populacao","n_innatura","n_ultra"]].sum().rename(columns={"populacao":"pop_est"}))
bu=bu.reset_index()
for c in ["n_feiras","n_mercados","n_esc_mun","n_esc_est","n_esc_fed","n_agric","n_agropec","pop_est","n_innatura","n_ultra"]: bu[c]=bu[c].fillna(0).astype(int)
bu["n_escolas"]=bu.n_esc_mun+bu.n_esc_est+bu.n_esc_fed
bu["area_pot_ha"]=(bu.area_pot_m2/1e4).round(2)
bu["pct_ultra"]=np.where((bu.n_innatura+bu.n_ultra)>0,bu.n_ultra/(bu.n_innatura+bu.n_ultra)*100,np.nan).round(1)
# checagem com a planilha
xl=pd.read_excel("5. Estabelecimentos públicos/ESCOLAS/quantidade de escolas por bairros.xlsx",sheet_name=1)
xl["k"]=xl.STRING.map(norm); chk=bu.assign(k=bu.bairro.map(norm)).merge(xl,on="k",how="left")
diff=chk[chk.n_esc_mun!=chk["Quantidade de Escolas"]][["bairro","n_esc_mun","Quantidade de Escolas"]]
print("diferenças escolas municipais vs planilha:\n",diff.to_string())
print("feiras por bairro soma",bu.n_feiras.sum(),"/",len(fe), " bairros com feira:",(bu.n_feiras>0).sum())
bcols=["bairro","cod","area_km2","pop_est","n_feiras","n_mercados","n_escolas","n_esc_mun","n_esc_est","n_esc_fed","n_agric","n_agropec","area_pot_ha","n_innatura","n_ultra","pct_ultra"]
to_js("bairros",bu.set_crs(UTM),bcols,simplify=8)

to_js("feiras",fe,["cod","nome","total_p","total_e","indice"])
to_js("mercados",me,["cod","nome","indice"])
to_js("portos",po,["cod","nome","i2019","i2021"])
to_js("esc_municipal",em,cols_esc); to_js("esc_estadual",ee,cols_esc); to_js("esc_federal",ef,cols_esc)
to_js("agricultura",ag,["bairro"])
to_js("potenciais",ep,["bairro","area_m2","uc"],simplify=2)
to_js("agropec_censo",ca,["endereco","localidade"])
to_js("ucs",uc,["nome","esfera","ano","ato","area_ha"],simplify=15)
to_js("assentamentos",asn,["nome","area_ha","familias","capacidade","criacao"],simplify=15)
to_js("uso_solo",us,["classe"],simplify=None,prec=4)
to_js("ambiente_alimentar",hx,["populacao","n_innatura","n_ultra","innatura_5k","ultra_5k","pct_ultra"],simplify=None)
to_js("ceasa_origem",ce,["municipio","uf","frutas","hort_folha","hort_fruto","hort_raiz","total"],prec=4)
bu[bcols].to_csv("/home/claude/webgis/indicadores_bairros.csv",index=False)

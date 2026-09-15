/* Belém Alimentar – WebGIS (Produto 2 da tese)
   Estrutura: CONFIG (camadas, rótulos, indicadores) → mapa → painéis.
   Para renomear campos ou mudar cores, edite apenas os blocos FIELDS e LAYERS. */
(function(){
"use strict";
const GEO = window.GEO || {};
const $ = s => document.querySelector(s);
const fmt = (v, d=0) => v==null || Number.isNaN(v) ? "—" : Number(v).toLocaleString("pt-BR",{maximumFractionDigits:d,minimumFractionDigits:0});
const norm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const title = s => String(s||"").toLowerCase().replace(/(^|[\s\-(\/])([a-zà-ú])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E|Em)\b/g,w=>w.toLowerCase());

/* ---------- dicionário de campos (rótulos dos pop-ups e CSV) ---------- */
const FIELDS = {
  CD_MUN:"Código IBGE", NM_MUN:"Município", NM_RGI:"Região imediata", NM_RGINT:"Região intermediária", AREA_KM2:"Área (km²)", ceasa_t:"Enviado à CEASA-PA", CD_UF:"Código UF", NM_UF:"Unidade da Federação", SIGLA_UF:"Sigla", NM_REGIAO:"Região", NM_PAIS:"País",
  bairro:"Bairro", cod:"Código", area_km2:"Área (km²)", pop_est:"População estimada (hab.)",
  n_feiras:"Feiras livres", n_mercados:"Mercados municipais", n_escolas:"Escolas (todas as redes)",
  n_esc_mun:"Escolas municipais", n_esc_est:"Escolas estaduais", n_esc_fed:"Escolas federais",
  n_agric:"Pontos de agricultura", n_agropec:"Estab. agropecuários (CNEFE)", area_pot_ha:"Área potencial p/ AUP (ha)",
  n_innatura:"Estab. in natura/misto", n_ultra:"Estab. ultraprocessados", pct_ultra:"Ultraprocessados (%)",
  nome:"Nome", total_p:"Total de P", total_e:"Total de E", indice:"Índice",
  i2019:"Índice 2019", i2021:"Índice 2021", rede:"Rede", etapas:"Etapas de ensino", porte:"Porte",
  inep:"Código INEP", endereco:"Endereço", localizacao:"Localização", telefone:"Telefone",
  area_m2:"Área (m²)", uc:"Em UC", localidade:"Localidade", esfera:"Esfera", ano:"Ano de criação", ato:"Ato legal",
  area_ha:"Área (ha)", familias:"Famílias", capacidade:"Capacidade", criacao:"Criação",
  populacao:"População (hab.)", innatura_5k:"In natura/misto por 5 mil hab.", ultra_5k:"Ultraprocessados por 5 mil hab.",
  municipio:"Município", uf:"Estado", frutas:"Frutas", hort_folha:"Hortaliças folhosas", hort_fruto:"Hortaliças-fruto", hort_raiz:"Raízes e tubérculos", total:"Total"
};

/* ---------- escalas de cor ---------- */
const RAMP_G = ["#EEF6EA","#C9EAC2","#7BC77C","#2A924B","#00441B"];   // mesma rampa do QGIS (escolas por bairro)
const RAMP_O = ["#FFF1E2","#FDD0A2","#FD8D3C","#D94801","#7F2704"];
function breaks(values, n=5){
  const v = values.filter(x=>x!=null && !Number.isNaN(x)).sort((a,b)=>a-b);
  if(!v.length) return [];
  const hasZero = v[0]===0, pos = v.filter(x=>x>0), k = hasZero ? n-1 : n, out=[];
  if(hasZero) out.push(0);
  for(let i=1;i<=k;i++){ const q = pos[Math.min(pos.length-1, Math.ceil(i*pos.length/k)-1)]; if(q!=null && !out.includes(q)) out.push(q); }
  return out; // limites superiores de cada classe
}
const classOf = (x, br) => { if(x==null||Number.isNaN(x)) return -1; for(let i=0;i<br.length;i++) if(x<=br[i]) return i; return br.length-1; };
const colorFor = (x, br, ramp) => { const c = classOf(x,br); if(c<0) return "transparent"; const off = ramp.length-br.length; return ramp[Math.max(0,c+off)]; };
function rampHTML(br, ramp, d=0){
  if(!br.length) return "";
  const off = ramp.length-br.length;
  return '<div class="ramp">'+br.map((b,i)=>{
    const lo = i===0 ? null : br[i-1];
    const lab = lo==null ? (b===0?"0":"até "+fmt(b,d)) : (fmt(lo,d)+" – "+fmt(b,d));
    return `<div><span style="background:${ramp[i+off]}"></span>${lab}</div>`;
  }).join("")+"</div>";
}

/* ---------- indicadores por bairro ---------- */
const bairros = GEO.bairros.features;
bairros.forEach(f=>{ const p=f.properties;
  p.dens_pop = p.area_km2 ? p.pop_est/p.area_km2 : null;
  p.feiras_100k = p.pop_est>500 ? p.n_feiras/p.pop_est*1e5 : null;
  p.esc_10k = p.pop_est>500 ? p.n_escolas/p.pop_est*1e4 : null;
});
const IND = {
  n_feiras:{label:"Feiras livres",d:0},
  feiras_100k:{label:"Feiras por 100 mil hab.",d:1},
  n_mercados:{label:"Mercados municipais",d:0},
  n_escolas:{label:"Escolas (todas as redes)",d:0},
  n_esc_mun:{label:"Escolas municipais",d:0},
  esc_10k:{label:"Escolas por 10 mil hab.",d:1},
  n_agric:{label:"Pontos de agricultura urbana",d:0},
  area_pot_ha:{label:"Área potencial para AUP (ha)",d:1},
  pop_est:{label:"População estimada (hab.)",d:0},
  dens_pop:{label:"Densidade (hab./km²)",d:0},
  pct_ultra:{label:"Estab. ultraprocessados (%)",d:1,ramp:RAMP_O}
};
const HEX_IND = {
  innatura_5k:{label:"In natura/misto por 5 mil hab.",d:1},
  ultra_5k:{label:"Ultraprocessados por 5 mil hab.",d:1,ramp:RAMP_O},
  pct_ultra:{label:"Ultraprocessados no total (%)",d:1,ramp:RAMP_O},
  populacao:{label:"População (hab.)",d:0}
};
const state = { bInd:"n_feiras", hInd:"innatura_5k", ceasa:"total", selBairro:null };

/* ---------- mapa ---------- */
const map = L.map("map",{zoomControl:true,preferCanvas:false,attributionControl:true}).setView([-1.40,-48.46],11);
map.attributionControl.setPrefix(false);
["pPoly","pHex","pImg","pLine","pPts"].forEach((n,i)=>{ map.createPane(n).style.zIndex = 390+i*10; });
map.getPane("pImg").style.zIndex = 385;
const canvas = L.canvas({padding:.3,pane:"pHex"});
const canvasPoly = L.canvas({padding:.3,pane:"pPoly"});

/* mapas-base (em ambientes sem acesso externo, o mapa segue só com as camadas vetoriais) */
const isDark = () => document.documentElement.dataset.theme==="dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
const BASES = {
  mapa:{label:"Mapa", make:()=>L.tileLayer(isDark()?"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png":"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{maxZoom:19,attribution:"© OpenStreetMap · © CARTO"})},
  satelite:{label:"Satélite", make:()=>L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Imagem © Esri, Maxar, Earthstar Geographics"})},
  nenhum:{label:"Sem base", make:()=>null}
};
let baseLayer=null, baseKey="mapa", tilesOk=null;
function setBase(k){
  baseKey=k; if(baseLayer){ map.removeLayer(baseLayer); baseLayer=null; }
  const lyr = BASES[k].make();
  if(lyr){
    let loaded=0, failed=0;
    lyr.on("tileload",()=>{loaded++; tilesOk=true;});
    lyr.on("tileerror",()=>{ failed++; if(!loaded && failed>=4 && tilesOk!==true){ tilesOk=false; disableTiles(); } });
    baseLayer = lyr.addTo(map);
  }
  document.querySelectorAll("#basemaps button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.k===k));
}
function disableTiles(){
  if(baseLayer){ map.removeLayer(baseLayer); baseLayer=null; }
  document.querySelectorAll("#basemaps button").forEach(b=>{ if(b.dataset.k!=="nenhum") b.disabled=true; b.setAttribute("aria-pressed", b.dataset.k==="nenhum"); });
  toast("Mapa-base externo indisponível neste ambiente – exibindo só as camadas da pesquisa.");
}
$("#basemaps").innerHTML = Object.entries(BASES).map(([k,b])=>`<button type="button" data-k="${k}" aria-pressed="false">${b.label}</button>`).join("");
$("#basemaps").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b && !b.disabled) setBase(b.dataset.k); });

/* ---------- pop-ups ---------- */
function popup(kind, p, keys, dec={}){
  const rows = keys.filter(k=>p[k]!=null && p[k]!=="").map(k=>`<dt>${FIELDS[k]||k}</dt><dd>${typeof p[k]==="number"?fmt(p[k],dec[k]??2):esc(p[k])}</dd>`).join("");
  const name = p.nome || p.bairro || p.municipio || p.classe || "";
  return `<div class="pop"><p class="k">${esc(kind)}</p>${name?`<h3>${esc(p.bairro?title(name):name)}</h3>`:""}<dl>${rows}</dl></div>`;
}
const pointStyle = (fill, stroke="#1a1a1a", r=6, w=1.2) => ({radius:r,fillColor:fill,color:stroke,weight:w,fillOpacity:.95,opacity:1,pane:"pPts"});

/* ---------- camadas ---------- */
const LAYERS = [];
function def(o){ LAYERS.push(o); return o; }

const GROUPS = [
  {id:"abast", title:"Abastecimento alimentar"},
  {id:"escolas", title:"Escolas"},
  {id:"aup", title:"Agricultura urbana e periurbana"},
  {id:"terr", title:"Território e ambiente"},
  {id:"origem", title:"De onde vêm os alimentos"},
  {id:"ibge", title:"Brasil e Pará – malhas IBGE 2023"}
];

def({id:"feiras",group:"abast",label:"Feiras livres",data:"feiras",on:true,sw:{t:"pt",c:"#F5D33A"},
  build:g=>L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,pointStyle("#F5D33A","#1a1a1a",7,1.5)),
    onEachFeature:(f,l)=>{ l.bindPopup(popup("Feira livre",f.properties,["total_p","total_e","indice"],{indice:3})); l.bindTooltip(f.properties.nome,{direction:"top",offset:[0,-6]}); }}),
  source:"Levantamento de campo / Instituto Escolhas (2022)"});
def({id:"mercados",group:"abast",label:"Mercados municipais",data:"mercados",on:true,sw:{t:"pt",c:"#FF9E17"},
  build:g=>L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,pointStyle("#FF9E17","#3a2a10",5.5)),
    onEachFeature:(f,l)=>{ l.bindPopup(popup("Mercado municipal",{...f.properties,nome:title(f.properties.nome)},["indice"],{indice:3})); l.bindTooltip(title(f.properties.nome),{direction:"top"}); }}),
  source:"Instituto Escolhas (2022)"});
def({id:"portos",group:"abast",label:"Portos e feiras do açaí",data:"portos",sw:{t:"pt",c:"#2F7FA3"},
  build:g=>L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,pointStyle("#2F7FA3","#0d2a38",6)),
    onEachFeature:(f,l)=>l.bindPopup(popup("Porto",{...f.properties,nome:title(f.properties.nome)},["i2019","i2021"],{i2019:3,i2021:3}))}),
  source:"Instituto Escolhas (2022)"});

const escCols=["rede","etapas","porte","inep","endereco","localizacao","telefone"];
def({id:"esc_municipal",group:"escolas",label:"Rede municipal",data:"esc_municipal",sw:{t:"pt",c:"#DB1E2A",s:"#fff"},
  build:g=>L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,pointStyle("#DB1E2A","#ffffff",5.5,1.4)),onEachFeature:(f,l)=>l.bindPopup(popup("Escola municipal",f.properties,escCols))}),
  source:"INEP – Catálogo de Escolas (via Instituto Escolhas)"});
def({id:"esc_estadual",group:"escolas",label:"Rede estadual",data:"esc_estadual",sw:{t:"pt",c:"#E5B636"},
  build:g=>L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,pointStyle("#E5B636","#3a2e0c",4.5,1)),onEachFeature:(f,l)=>l.bindPopup(popup("Escola estadual",f.properties,escCols))}),
  source:"INEP – Catálogo de Escolas (via Instituto Escolhas)"});
def({id:"esc_federal",group:"escolas",label:"Rede federal",data:"esc_federal",sw:{t:"pt",c:"#91522D"},
  build:g=>L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,pointStyle("#91522D","#2a160b",5,1)),onEachFeature:(f,l)=>l.bindPopup(popup("Escola federal",f.properties,escCols))}),
  source:"INEP – Catálogo de Escolas (via Instituto Escolhas)"});

def({id:"agricultura",group:"aup",label:"Pontos de agricultura",data:"agricultura",sw:{t:"pt",c:"#54B04A",s:"#3D8035"},
  build:g=>L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,pointStyle("#54B04A","#2f6a28",5,1.4)),onEachFeature:(f,l)=>l.bindPopup(popup("Ponto de agricultura",{...f.properties,bairro:title(f.properties.bairro)},["bairro"]))}),
  source:"Instituto Escolhas (2022)"});
def({id:"potenciais",group:"aup",label:"Espaços potenciais para AUP",data:"potenciais",sw:{t:"pg",c:"#49D11C"},
  build:g=>L.geoJSON(g,{renderer:canvasPoly,style:{color:"#2f8a12",weight:.6,fillColor:"#49D11C",fillOpacity:.7,pane:"pPoly"},
    onEachFeature:(f,l)=>l.bindPopup(popup("Espaço potencial",{...f.properties,bairro:title(f.properties.bairro)},["area_m2","uc"],{area_m2:0}))}),
  source:"Instituto Escolhas (2022)"});
def({id:"agropec_censo",group:"aup",label:"Estab. agropecuários (CNEFE)",data:"agropec_censo",sw:{t:"pt",c:"#C77A12"},
  build:g=>L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,{...pointStyle("#C77A12","#4a2c05",3.2,.6),renderer:L.canvas({pane:"pPts"})}),onEachFeature:(f,l)=>l.bindPopup(popup("Estabelecimento agropecuário",f.properties,["endereco","localidade"]))}),
  source:"IBGE – CNEFE, Censo Agropecuário 2017 (via Instituto Escolhas)"});

def({id:"bairros",group:"terr",label:"Bairros – indicador",data:"bairros",on:true,sw:{t:"pg",c:"#7BC77C"},
  build:g=>L.geoJSON(g,{renderer:canvasPoly,style:bairroStyle,onEachFeature:(f,l)=>{
    l.on("click",()=>{ selectBairro(f.properties.cod,false); });
    l.bindTooltip(()=>`<b>${esc(title(f.properties.bairro))}</b><br>${IND[state.bInd].label}: ${fmt(f.properties[state.bInd],IND[state.bInd].d)}`,{sticky:true});
  }}),
  sub:()=>`<select id="bIndSel" aria-label="Indicador dos bairros">${Object.entries(IND).map(([k,v])=>`<option value="${k}"${k===state.bInd?" selected":""}>${v.label}</option>`).join("")}</select><div id="bLegend"></div>`,
  source:"IBGE (bairros); contagens calculadas nesta pesquisa"});
def({id:"ambiente",group:"terr",label:"Ambiente alimentar (hexágonos 1 km²)",data:"ambiente_alimentar",sw:{t:"pg",c:"#FD8D3C"},
  build:g=>L.geoJSON(g,{renderer:canvas,style:hexStyle,onEachFeature:(f,l)=>l.bindPopup(popup("Ambiente alimentar",f.properties,["populacao","n_innatura","n_ultra","innatura_5k","ultra_5k","pct_ultra"],{populacao:0,innatura_5k:1,ultra_5k:1,pct_ultra:1}))}),
  sub:()=>`<select id="hIndSel" aria-label="Indicador do ambiente alimentar">${Object.entries(HEX_IND).map(([k,v])=>`<option value="${k}"${k===state.hInd?" selected":""}>${v.label}</option>`).join("")}</select><div id="hLegend"></div>`,
  source:"Instituto Escolhas (2022) – CNPJ/RAIS e grade populacional"});
def({id:"uso_solo",group:"terr",label:"Uso e ocupação do solo (2022)",sw:{t:"pg",c:"#136E2E"},
  build:()=>L.imageOverlay("data/uso_solo.png",[[-1.5265773626254806,-48.62440149790193],[-1.0194257443294734,-48.29612597233193]],{opacity:.72,pane:"pImg"}),
  count:5,
  sub:()=>`<div class="ramp">${[["Água","#4cb9eb"],["Área urbana","#f781bf"],["Vegetação","#136e2e"],["Agricultura","#ffbe00"],["Mineração","#a05214"]].map(([n,c])=>`<div><span style="background:${c}"></span>${n}</div>`).join("")}</div>`,
  source:"Instituto Escolhas – classificação de imagem (jan/2022)", nodownload:true});
def({id:"ucs",group:"terr",label:"Unidades de conservação",data:"ucs",sw:{t:"pg",c:"#91522D"},
  build:g=>L.geoJSON(g,{style:{color:"#5c3218",weight:1.2,fillColor:"#91522D",fillOpacity:.35,dashArray:"4 3",pane:"pPoly"},onEachFeature:(f,l)=>l.bindPopup(popup("Unidade de conservação",f.properties,["esfera","ano","ato","area_ha"],{area_ha:0}))}),
  source:"ICMBio/Ideflor-Bio (via Instituto Escolhas)"});
def({id:"assentamentos",group:"terr",label:"Assentamentos (INCRA)",data:"assentamentos",sw:{t:"pg",c:"#D5B43C"},
  build:g=>L.geoJSON(g,{style:{color:"#7a6415",weight:1,fillColor:"#D5B43C",fillOpacity:.5,pane:"pPoly"},onEachFeature:(f,l)=>l.bindPopup(popup("Projeto de assentamento",f.properties,["area_ha","familias","capacidade","criacao"],{area_ha:1}))}),
  source:"INCRA (via Instituto Escolhas)"});
def({id:"limite",group:"terr",label:"Limite municipal",data:"limite",on:true,sw:{t:"ln",c:"#E02020"},
  build:g=>L.geoJSON(g,{interactive:false,style:{color:"#E02020",weight:2,fill:false,pane:"pLine"}}),
  source:"IBGE – Malha municipal"});

def({id:"ceasa",group:"origem",label:"Origem dos alimentos na CEASA-PA",data:"ceasa_origem",sw:{t:"pt",c:"#2F7D4F"},fit:"brasil",
  build:g=>L.geoJSON(g,{pointToLayer:(f,ll)=>L.circleMarker(ll,ceasaStyle(f)),onEachFeature:(f,l)=>l.bindPopup(popup("Município de origem",f.properties,["uf","frutas","hort_folha","hort_fruto","hort_raiz","total"],{frutas:0,hort_folha:0,hort_fruto:0,hort_raiz:0,total:0}))}),
  sub:()=>`<select id="ceasaSel" aria-label="Grupo de alimentos">${["total","frutas","hort_folha","hort_fruto","hort_raiz"].map(k=>`<option value="${k}"${k===state.ceasa?" selected":""}>${FIELDS[k]}</option>`).join("")}</select><div class="ramp"><div><span style="background:#2F7D4F;border-radius:50%"></span>Municípios do Pará</div><div><span style="background:#C58B1C;border-radius:50%"></span>Outros estados</div></div><p class="note">Círculo proporcional à quantidade comercializada. Ao ligar, o mapa se afasta para o Brasil; ao desligar, volta a Belém.</p>`,
  source:"CEASA-PA (via Instituto Escolhas, 2022)"});

/* malhas IBGE 2023 */
def({id:"pa_municipios",group:"ibge",label:"Municípios do Pará",data:"pa_municipios",sw:{t:"pg",c:"#CFE3C8"},fit:"para",
  build:g=>L.geoJSON(g,{renderer:canvasPoly,style:f=>({pane:"pPoly",color:isDark()?"#8aa593":"#5d7465",weight:.7,fillColor:f.properties.ceasa_t>0?colorFor(f.properties.ceasa_t,munBreaks,RAMP_G):"#ffffff",fillOpacity:f.properties.ceasa_t>0?.65:.12}),
    onEachFeature:(f,l)=>{ l.bindPopup(popup("Município do Pará",{...f.properties,nome:f.properties.NM_MUN},["CD_MUN","NM_RGI","NM_RGINT","AREA_KM2","ceasa_t"],{AREA_KM2:1,ceasa_t:0})); l.bindTooltip(f.properties.NM_MUN,{sticky:true}); }}),
  sub:()=>`<div id="munLegend"></div><p class="note">Cor: quantidade enviada à CEASA-PA (Instituto Escolhas). Contorno claro = sem registro.</p>`,
  source:"IBGE – Malha Municipal 2023"});
def({id:"br_uf",group:"ibge",label:"Unidades da Federação",data:"br_uf",sw:{t:"pg",c:"transparent",s:"#6B5B95"},fit:"brasil",
  build:g=>L.geoJSON(g,{style:{pane:"pLine",color:"#6B5B95",weight:1.1,fill:true,fillOpacity:0},
    onEachFeature:(f,l)=>{ l.bindPopup(popup("Unidade da Federação",{...f.properties,nome:f.properties.NM_UF},["SIGLA_UF","CD_UF","NM_REGIAO","AREA_KM2"],{AREA_KM2:0})); l.bindTooltip(f.properties.SIGLA_UF,{sticky:true}); }}),
  source:"IBGE – Malha Municipal 2023"});
def({id:"br_pais",group:"ibge",label:"Limite do Brasil",data:"br_pais",sw:{t:"ln",c:"#1B1B1B"},fit:"brasil",
  build:g=>L.geoJSON(g,{interactive:false,style:{pane:"pLine",color:isDark()?"#E3EBE4":"#1B1B1B",weight:2,fill:false}}),
  source:"IBGE – dissolvido a partir de BR_UF_2023"});

/* estilos dinâmicos */
let bBreaks=[], hBreaks=[], ceasaMax=1;
const munBreaks = breaks(GEO.pa_municipios.features.map(f=>f.properties.ceasa_t).filter(v=>v>0),5);
function computeBreaks(){
  bBreaks = breaks(bairros.map(f=>f.properties[state.bInd]));
  hBreaks = breaks(GEO.ambiente_alimentar.features.map(f=>f.properties[state.hInd]));
  ceasaMax = Math.max(...GEO.ceasa_origem.features.map(f=>f.properties[state.ceasa]||0));
}
function bairroStyle(f){
  const p=f.properties, ind=IND[state.bInd], sel = state.selBairro===p.cod;
  const v=p[state.bInd];
  return {pane:"pPoly",color: sel ? "#F5D33A" : (isDark()?"#0b120d":"#2b3a30"), weight: sel?3.5:.7,
    fillColor: v==null ? "#bfc6bd" : colorFor(v,bBreaks,ind.ramp||RAMP_G), fillOpacity: v==null?.25:.72};
}
function hexStyle(f){ const v=f.properties[state.hInd], ind=HEX_IND[state.hInd];
  return {pane:"pHex",color:"#ffffff",weight:.3,opacity:.5,fillColor: v==null?"transparent":colorFor(v,hBreaks,ind.ramp||RAMP_G),fillOpacity: v==null?0:.75}; }
function ceasaStyle(f){ const v=f.properties[state.ceasa]||0;
  return {pane:"pPts",radius: v? 2.5+22*Math.sqrt(v/ceasaMax):0,fillColor: f.properties.uf==="Pará"?"#2F7D4F":"#C58B1C",color:"#fff",weight:.8,fillOpacity:.75}; }
computeBreaks();

/* instanciar */
const inst={};
LAYERS.forEach(L_=>{ L_.count = L_.count ?? (L_.data ? GEO[L_.data].features.length : 0); });
function layerOf(id){ const d=LAYERS.find(x=>x.id===id); if(!inst[id]) inst[id]=d.build(d.data?GEO[d.data]:null); return inst[id]; }
function toggle(id,on){
  const d=LAYERS.find(x=>x.id===id), l=layerOf(id);
  const WIDE={brasil:[[-34,-74],[5.5,-34]],para:[[-9.9,-58.9],[2.7,-45.8]]};
  if(on){ l.addTo(map); if(d.fit) map.flyToBounds(WIDE[d.fit],{duration:.8}); }
  else { map.removeLayer(l); if(d.fit && !LAYERS.some(x=>x.fit && x.id!==id && inst[x.id] && map.hasLayer(inst[x.id]))) map.flyToBounds(inst.bairros.getBounds(),{duration:.8}); }
  const sub=document.getElementById("sub-"+id); if(sub) sub.hidden=!on;
}

/* ---------- painel Camadas ---------- */
function swatch(sw){ const s = sw.t==="pt" ? `background:${sw.c};${sw.s?`border-color:${sw.s};box-shadow:0 0 0 1px #0006`:""}` : sw.t==="ln" ? `border-color:${sw.c}` : `background:${sw.c}`; return `<span class="sw"><i class="${sw.t}" style="${s}"></i></span>`; }
$("#p-camadas").innerHTML = GROUPS.map(g=>`<section><p class="eyebrow">${g.title}</p><div class="group">${
  LAYERS.filter(l=>l.group===g.id).map(l=>`<div class="lyr"><input type="checkbox" id="chk-${l.id}" ${l.on?"checked":""}>${swatch(l.sw)}<label for="chk-${l.id}">${l.label}</label><span class="n">${fmt(l.count)}</span>${l.sub?`<div class="sub" id="sub-${l.id}" ${l.on?"":"hidden"}>${l.sub()}</div>`:""}</div>`).join("")
}</div></section>`).join("") + `<p class="note">Clique nos elementos do mapa para ver os atributos. Contagens por bairro consideram apenas pontos dentro dos 71 polígonos de bairros do IBGE.</p>`;
$("#p-camadas").addEventListener("change",e=>{
  const t=e.target;
  if(t.id?.startsWith("chk-")) toggle(t.id.slice(4), t.checked);
  if(t.id==="bIndSel") setBInd(t.value);
  if(t.id==="hIndSel"){ state.hInd=t.value; computeBreaks(); inst.ambiente?.setStyle(hexStyle); legends(); }
  if(t.id==="ceasaSel"){ state.ceasa=t.value; computeBreaks(); inst.ceasa?.eachLayer(l=>{ const s=ceasaStyle(l.feature); l.setStyle(s); l.setRadius(s.radius); }); }
});
function legends(){
  const bl=$("#bLegend"); if(bl) bl.innerHTML = rampHTML(bBreaks, IND[state.bInd].ramp||RAMP_G, IND[state.bInd].d);
  const ml=$("#munLegend"); if(ml) ml.innerHTML = rampHTML(munBreaks, RAMP_G, 0);
  const hl=$("#hLegend"); if(hl) hl.innerHTML = rampHTML(hBreaks, HEX_IND[state.hInd].ramp||RAMP_G, HEX_IND[state.hInd].d);
}
function setBInd(k){
  state.bInd=k; computeBreaks(); inst.bairros?.setStyle(bairroStyle); legends();
  const a=$("#bIndSel"); if(a) a.value=k; const b=$("#rankSel"); if(b) b.value=k;
  renderPanel();
}

/* ---------- painel Indicadores ---------- */
const sortedB = [...bairros].sort((a,b)=>a.properties.bairro.localeCompare(b.properties.bairro,"pt-BR"));
function sum(k){ return bairros.reduce((s,f)=>s+(f.properties[k]||0),0); }
function renderPanel(){
  const f = state.selBairro ? bairros.find(x=>x.properties.cod===state.selBairro) : null;
  const P = f ? f.properties : (()=>{ const t={bairro:"Belém – 71 bairros"}; ["area_km2","pop_est","n_feiras","n_mercados","n_escolas","n_esc_mun","n_esc_est","n_esc_fed","n_agric","n_agropec","area_pot_ha","n_innatura","n_ultra"].forEach(k=>t[k]=sum(k)); t.pct_ultra=t.n_ultra/(t.n_innatura+t.n_ultra)*100; return t; })();
  const ind=IND[state.bInd];
  const ranked = bairros.filter(x=>x.properties[state.bInd]!=null).sort((a,b)=>b.properties[state.bInd]-a.properties[state.bInd]);
  let top = ranked.slice(0,12);
  if(f && !top.includes(f) && f.properties[state.bInd]!=null) top = [...top.slice(0,11), f];
  const max = ranked.length ? ranked[0].properties[state.bInd] : 1;
  const pos = f ? ranked.indexOf(f)+1 : 0;
  $("#p-ind").innerHTML = `
    <div class="picker"><label class="eyebrow" for="bSel">Bairro</label>
      <select id="bSel"><option value="">Belém (todos os bairros)</option>${sortedB.map(x=>`<option value="${x.properties.cod}"${x.properties.cod===state.selBairro?" selected":""}>${esc(title(x.properties.bairro))}</option>`).join("")}</select></div>
    <div class="card">
      <h2>${esc(f?title(P.bairro):P.bairro)}</h2>
      <div class="stats">
        ${stat(P.pop_est,"habitantes (estimativa)")}${stat(P.area_km2,"km² de área",2)}
        ${stat(P.n_feiras,"feiras livres")}${stat(P.n_mercados,"mercados municipais")}
        ${stat(P.n_escolas,`escolas · ${fmt(P.n_esc_mun)} mun. / ${fmt(P.n_esc_est)} est. / ${fmt(P.n_esc_fed)} fed.`)}${stat(P.n_agric,"pontos de agricultura")}
        ${stat(P.area_pot_ha,"ha potenciais para AUP",1)}${stat(P.pct_ultra,"% dos estab. são de ultraprocessados",1)}
      </div>
      ${f && pos ? `<p class="note">${pos}º de ${ranked.length} bairros em <b>${ind.label.toLowerCase()}</b>.</p>`:""}
    </div>
    <section>
      <div class="rank-head"><p class="eyebrow">Ranking dos bairros</p>
        <select id="rankSel" aria-label="Indicador do ranking">${Object.entries(IND).map(([k,v])=>`<option value="${k}"${k===state.bInd?" selected":""}>${v.label}</option>`).join("")}</select></div>
      <div class="bars">${top.map(x=>{ const v=x.properties[state.bInd]; return `<button type="button" class="bar${x===f?" sel":""}" data-cod="${x.properties.cod}"><span class="lbl">${ranked.indexOf(x)+1}. ${esc(title(x.properties.bairro))}</span><span class="trk"><span class="fill" style="display:block;width:${max?Math.max(1,v/max*100):0}%"></span></span><span class="v">${fmt(v,ind.d)}</span></button>`; }).join("")}</div>
      <p class="note">O indicador escolhido também colore a camada de bairros no mapa.</p>
    </section>`;
}
const stat=(v,l,d=0)=>`<div class="stat"><b>${fmt(v,d)}</b><span>${l}</span></div>`;
$("#p-ind").addEventListener("change",e=>{
  if(e.target.id==="bSel") selectBairro(e.target.value||null,true);
  if(e.target.id==="rankSel") setBInd(e.target.value);
});
$("#p-ind").addEventListener("click",e=>{ const b=e.target.closest(".bar"); if(b) selectBairro(b.dataset.cod,true); });

function selectBairro(cod, zoom){
  state.selBairro = cod;
  if(!map.hasLayer(layerOf("bairros"))){ $("#chk-bairros").checked=true; toggle("bairros",true); }
  inst.bairros.setStyle(bairroStyle);
  if(cod){ const l = inst.bairros.getLayers().find(x=>x.feature.properties.cod===cod); if(l){ if(zoom) map.flyToBounds(l.getBounds(),{padding:[40,40],maxZoom:15,duration:.7}); l.bringToFront?.(); } }
  renderPanel(); showTab("p-ind"); openSheet(true);
}

/* ---------- painel Dados ---------- */
$("#p-dados").innerHTML = `
  <section><p class="eyebrow">Baixar camadas</p>
    <div class="dl">${LAYERS.filter(l=>!l.nodownload).map(l=>`<div class="name">${l.label}<small>${fmt(l.count)} feições · ${esc(l.source)}</small></div><button class="chip" type="button" data-dl="${l.id}" data-f="geojson">GeoJSON</button><button class="chip" type="button" data-dl="${l.id}" data-f="csv">CSV</button>`).join("")}
    <div class="name">Indicadores por bairro<small>71 bairros · tabela consolidada</small></div><span></span><button class="chip" type="button" data-dl="bairros" data-f="csv">CSV</button></div>
  </section>
  <section class="src"><p class="eyebrow">Sobre os dados</p>
    <p>Sistema de referência: SIRGAS 2000 / UTM 22S (EPSG:31982) no projeto QGIS; publicado em WGS84 (EPSG:4326), com geometrias simplificadas para a web.</p>
    <p>População por bairro estimada pela soma dos hexágonos de 1 km² cujo centróide cai no bairro – serve para comparação relativa, não substitui o Censo.</p>
    <p>A camada de uso do solo é exibida como imagem (fragmentos &lt; 3 ha omitidos).</p>
  </section>
  <section class="src"><p class="eyebrow">Autoria</p>
    <p>Társis Ney Castelo Branco Barros Magalhães – Tese de Doutorado, PPGEDAM/NUMA/UFPA.</p>
    <p>Bases: Instituto Escolhas, IBGE, INEP, INCRA, CEASA-PA e levantamento de campo.</p>
  </section>`;
$("#p-dados").addEventListener("click",e=>{ const b=e.target.closest("[data-dl]"); if(b) download(b.dataset.dl,b.dataset.f); });
function download(id,format){
  const d=LAYERS.find(x=>x.id===id), gj=GEO[d.data];
  let blob, name=`belem_alimentar_${d.data}.${format}`;
  if(format==="geojson") blob=new Blob([JSON.stringify(gj)],{type:"application/geo+json"});
  else {
    const keys=[...new Set(gj.features.flatMap(f=>Object.keys(f.properties)))];
    const isPt=gj.features[0]?.geometry.type==="Point";
    const head=[...keys.map(k=>FIELDS[k]||k),...(isPt?["longitude","latitude"]:[])];
    const q=v=>{ if(v==null) return ""; const s=typeof v==="number"?String(v).replace(".",","):String(v); return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
    const rows=gj.features.map(f=>[...keys.map(k=>q(f.properties[k])),...(isPt?f.geometry.coordinates.map(c=>String(c).replace(".",",")):[])].join(";"));
    blob=new Blob(["﻿"+head.join(";")+"\n"+rows.join("\n")],{type:"text/csv;charset=utf-8"});
  }
  try{
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    toast(`Baixando ${name}. Se nada acontecer, este ambiente bloqueia downloads – use o site publicado.`);
  }catch(err){ toast("Download bloqueado neste ambiente – use o site publicado."); }
}

/* ---------- busca ---------- */
const INDEX=[];
bairros.forEach(f=>INDEX.push({t:title(f.properties.bairro),k:"Bairro",f,lyr:"bairros"}));
[["feiras","Feira"],["mercados","Mercado"],["portos","Porto"],["esc_municipal","Escola municipal"],["esc_estadual","Escola estadual"],["esc_federal","Escola federal"]].forEach(([id,k])=>
  GEO[LAYERS.find(l=>l.id===id).data].features.forEach(f=>INDEX.push({t:k==="Feira"?f.properties.nome:title(f.properties.nome),k,f,lyr:id})));
INDEX.forEach(i=>i.n=norm(i.t));
let hits=[], active=0;
$("#q").addEventListener("input",()=>{
  const q=norm($("#q").value.trim()); const box=$("#results");
  if(q.length<2){ box.hidden=true; return; }
  const terms=q.split(/\s+/);
  hits=INDEX.filter(i=>terms.every(t=>i.n.includes(t))).sort((a,b)=>(a.n.startsWith(q)?0:1)-(b.n.startsWith(q)?0:1)||a.t.length-b.t.length).slice(0,12);
  active=0;
  box.innerHTML = hits.length ? hits.map((h,i)=>`<button type="button" data-i="${i}" class="${i===0?"active":""}"><span>${esc(h.t)}</span><em>${h.k}</em></button>`).join("") : `<p class="note" style="padding:8px 10px">Nada encontrado para “${esc($("#q").value)}”.</p>`;
  box.hidden=false;
});
$("#q").addEventListener("keydown",e=>{
  const btns=[...document.querySelectorAll("#results button")];
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); active=(active+(e.key==="ArrowDown"?1:-1)+btns.length)%btns.length; btns.forEach((b,i)=>b.classList.toggle("active",i===active)); }
  if(e.key==="Enter" && hits[active]) go(hits[active]);
  if(e.key==="Escape") $("#results").hidden=true;
});
$("#results").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b) go(hits[+b.dataset.i]); });
document.addEventListener("click",e=>{ if(!e.target.closest(".search")) $("#results").hidden=true; });
function go(h){
  $("#results").hidden=true; $("#q").value=h.t;
  if(h.lyr==="bairros"){ selectBairro(h.f.properties.cod,true); return; }
  const chk=$("#chk-"+h.lyr); if(!chk.checked){ chk.checked=true; toggle(h.lyr,true); }
  const l=inst[h.lyr].getLayers().find(x=>x.feature===h.f);
  const ll=l.getLatLng(); map.flyTo(ll,16,{duration:.7}); map.once("moveend",()=>l.openPopup());
}

/* ---------- abas, tema, mobile, aviso ---------- */
function showTab(id){ document.querySelectorAll(".tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.pane===id)); document.querySelectorAll(".pane").forEach(p=>p.hidden=p.id!==id); }
document.querySelector(".tabs").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b){ showTab(b.dataset.pane); openSheet(true); } });
function openSheet(on){ $("#side").classList.toggle("open",on); }
$("#sheetBtn").addEventListener("click",()=>openSheet(!$("#side").classList.contains("open")));
$("#themeBtn").addEventListener("click",()=>{ const r=document.documentElement; r.dataset.theme = isDark()?"light":"dark"; if(baseKey==="mapa" && tilesOk!==false) setBase("mapa"); inst.bairros?.setStyle(bairroStyle); });
let tt; function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(tt); tt=setTimeout(()=>t.hidden=true,4200); }

/* ---------- início ---------- */
LAYERS.filter(l=>l.on).forEach(l=>toggle(l.id,true));
map.fitBounds(inst.bairros.getBounds(),{padding:[20,20]});
setBase("mapa");
legends(); renderPanel();
})();

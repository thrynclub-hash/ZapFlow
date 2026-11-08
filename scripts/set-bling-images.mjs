// Atualiza midia.imagens.externas dos produtos Bling usando as fotos já
// hospedadas no bucket product-images do Supabase (CDN da Netshoes tinha
// proteção anti-hotlink, bloqueava download direto do Bling — ver
// import-bling-catalog.mjs). Roda: node scripts/set-bling-images.mjs <manifesto_csv> <access_token>

import { readFileSync } from "node:fs";

const [, , manifestoPath, catalogoPath, accessToken] = process.argv;
const SUPABASE_URL = "https://bhiggyigsrqfabqhutne.supabase.co";
const API = "https://api.bling.com.br/Api/v3";
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };

function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const cols = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const fields = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === ";" && !inQuotes) { fields.push(cur); cur = ""; }
      else cur += c;
    }
    fields.push(cur);
    const row = {};
    cols.forEach((col, i) => (row[col] = fields[i] ?? ""));
    return row;
  });
}

async function bling(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const rows = parseCsv(readFileSync(manifestoPath, "utf-8")).filter((r) => r.status === "ok");
const byParentSku = new Map();
for (const r of rows) {
  if (!byParentSku.has(r.sku_pai)) byParentSku.set(r.sku_pai, []);
  byParentSku.get(r.sku_pai).push(r.caminho_local.replace(/^fotos_produtos\/Netshoes\//, ""));
}

// lista resumida do Bling não confia no código do pai — casa por nome,
// usando o catálogo que já tem "Descrição curta" por sku_pai.
const catalogRows = parseCsv(readFileSync(catalogoPath, "utf-8"));
const nameByParentSku = new Map();
for (const r of catalogRows) nameByParentSku.set(r["Código do produto pai"], r["Descrição curta"]);

let allProducts = [];
for (let page = 1; page <= 20; page++) {
  const res = await bling(`/produtos?pagina=${page}&limite=100`);
  if (!res.data?.length) break;
  allProducts.push(...res.data);
  if (res.data.length < 100) break;
}

function norm(s) { return (s || "").trim().toLowerCase().replace(/\s+/g, " "); }

let ok = 0, skip = 0;
for (const [parentSku, paths] of byParentSku) {
  const name = norm(nameByParentSku.get(parentSku));
  const parent = allProducts.find((p) => p.formato === "V" && norm(p.nome) === name);
  if (!parent) { console.warn(`sem produto no Bling pra ${parentSku} ("${nameByParentSku.get(parentSku)}")`); skip++; continue; }

  const parentFull = (await bling(`/produtos/${parent.id}`)).data;
  const urls = paths.slice(0, 5).map((p) => ({ link: `${SUPABASE_URL}/storage/v1/object/public/product-images/netshoes/${p}` }));

  const resp = await bling(`/produtos/${parent.id}`, {
    method: "PUT",
    body: JSON.stringify({
      nome: parent.nome, tipo: parent.tipo, situacao: parent.situacao, formato: parent.formato,
      variacoes: parentFull.variacoes,
      midia: { imagens: { imagensURL: urls } },
    }),
  });
  if (resp.data?.warnings?.length) console.warn(`  avisos:`, resp.data.warnings);
  console.log(`OK: ${parent.nome} (${urls.length} fotos)`);
  ok++;
}

console.log(`\nFeito. ${ok} produtos com foto atualizada, ${skip} sem produto correspondente no Bling.`);

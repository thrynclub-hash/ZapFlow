// Importa catálogo real (CSV) pros produtos já existentes no Bling,
// casando por nome. Atualiza: código (SKU), descrição, imagens, preço de
// custo, estoque (placeholder por disponibilidade — sem contagem real
// na fonte). Uso único/repetível, roda com: node scripts/import-bling-catalog.mjs <csv> <access_token> <deposito_id>
//
// ponytail: estoque é placeholder (InStock=50, OutOfStock=0) — ajustar
// manual quando o usuário souber a quantidade real por produto.

import { readFileSync } from "node:fs";

const [, , csvPath, accessToken, depositoId] = process.argv;
if (!csvPath || !accessToken || !depositoId) {
  console.error("uso: node import-bling-catalog.mjs <csv> <access_token> <deposito_id>");
  process.exit(1);
}

const API = "https://api.bling.com.br/Api/v3";
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };

function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const cols = lines[0].split(";");
  return lines.slice(1).map((line) => {
    // parser simples: respeita campos entre aspas contendo ';'
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

const rows = parseCsv(readFileSync(csvPath, "utf-8"));
const byParentSku = new Map();
for (const r of rows) {
  const key = r["Código do produto pai"];
  if (!byParentSku.has(key)) byParentSku.set(key, []);
  byParentSku.get(key).push(r);
}

console.log(`${byParentSku.size} produtos pai, ${rows.length} variações no CSV.`);

// Bling não tem busca por nome exato direta — lista tudo (paginado) 1x.
let allProducts = [];
for (let page = 1; page <= 20; page++) {
  const res = await bling(`/produtos?pagina=${page}&limite=100`);
  if (!res.data?.length) break;
  allProducts.push(...res.data);
  if (res.data.length < 100) break;
}
console.log(`${allProducts.length} produtos encontrados no Bling.`);

function norm(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

let matched = 0, unmatched = 0;
for (const [parentSku, variants] of byParentSku) {
  const name = norm(variants[0]["Descrição curta"]);
  const parent = allProducts.find((p) => p.formato === "V" && norm(p.nome) === name);
  if (!parent) {
    console.warn(`SEM MATCH no Bling: "${variants[0]["Descrição curta"]}" (pai ${parentSku})`);
    unmatched++;
    continue;
  }

  const images = [variants[0]["Imagem 1"], variants[0]["Imagem 2"]].filter(Boolean).map((url) => ({ url }));
  const parentFull = (await bling(`/produtos/${parent.id}`)).data;

  await bling(`/produtos/${parent.id}`, {
    method: "PUT",
    body: JSON.stringify({
      nome: parent.nome, tipo: parent.tipo, situacao: parent.situacao, formato: parent.formato,
      variacoes: parentFull.variacoes,
      codigo: parentSku,
      descricaoCurta: variants[0]["Descrição complementar"] || parent.descricaoCurta,
      marca: variants[0]["Marca"] || "",
      midia: images.length ? { imagens: { externas: images } } : undefined,
    }),
  });

  const children = await bling(`/produtos?idProdutoPai=${parent.id}`);
  for (const row of variants) {
    const size = (row["Descrição da variação"].match(/Tamanho:([^;]+)/) || [])[1]?.trim();
    const child = (children.data || []).find((c) => c.nome.includes(`Tamanho:${size}`));
    if (!child) { console.warn(`  variação sem match: ${row["Descrição da variação"]} (sku ${row["Código (SKU)"]})`); continue; }

    await bling(`/produtos/${child.id}`, {
      method: "PUT",
      body: JSON.stringify({
        nome: child.nome, tipo: child.tipo, situacao: child.situacao, formato: child.formato,
        codigo: row["Código (SKU)"],
        precoCusto: Number(row["Preço"]) || 0,
      }),
    });

    const inStock = row["Disponibilidade na origem"] === "InStock";
    await bling(`/estoques`, {
      method: "POST",
      body: JSON.stringify({
        produto: { id: child.id },
        deposito: { id: Number(depositoId) },
        operacao: "B",
        quantidade: inStock ? 50 : 0,
        observacoes: "Import catálogo real ZapFlow (placeholder até contagem real)",
      }),
    });
  }
  matched++;
  console.log(`OK: ${parent.nome} (${variants.length} variações)`);
}

console.log(`\nFeito. ${matched} produtos pai atualizados, ${unmatched} sem match no Bling.`);

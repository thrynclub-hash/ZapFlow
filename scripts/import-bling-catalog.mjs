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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Bling limita 3 req/s — espaça toda chamada.
async function bling(path, opts = {}) {
  await sleep(400);
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
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

let matched = 0, unmatched = 0;
for (const [parentSku, variants] of byParentSku) {
  const name = norm(variants[0]["Descrição curta"]);
  // Bling às vezes acrescenta sufixo de cor no nome pra desambiguar
  // produtos pai com a mesma descrição base (ex: "- Preto+Cinza") — aceita
  // o nome do catálogo como prefixo do nome real, não só igualdade exata.
  // Se houver mais de um candidato (duas cores do mesmo produto base),
  // desempata pela cor da própria variação.
  const candidates = allProducts.filter((p) => p.formato === "V" && norm(p.nome).startsWith(name));
  const color = norm((variants[0]["Descrição da variação"].match(/Cor:([^;]+)/) || [])[1]);
  // match exato do sufixo "- Cor" (não substring — "preto" é substring de
  // "preto+cinza", então teria que comparar igualdade do sufixo inteiro)
  // CSV às vezes não distingue cor nenhuma (duas cores "Preto" com descrição
  // idêntica) — sem como adivinhar, pula pro usuário resolver manual.
  const parent = candidates.length <= 1 ? candidates[0]
    : candidates.find((p) => color && norm(p.nome.split(" - ").pop()) === color);
  if (!parent) {
    console.warn(`SEM MATCH no Bling: "${variants[0]["Descrição curta"]}" (pai ${parentSku})`);
    unmatched++;
    continue;
  }

  try {
    const parentFull = (await bling(`/produtos/${parent.id}`)).data;
    if (!parentFull.variacoes?.length) throw new Error("variacoes vazio no GET, pulando (tentar de novo depois)");

    // "Descrição complementar" vem vazia na fonte — usa "Descrição curta"
    // (que tem o texto real) como complementar também, senão Nuvemshop recusa
    // export por "produto não possui descrição".
    const desc = variants[0]["Descrição curta"] || "";

    await bling(`/produtos/${parent.id}`, {
      method: "PUT",
      body: JSON.stringify({
        nome: parent.nome, tipo: parent.tipo, situacao: parent.situacao, formato: parent.formato,
        variacoes: parentFull.variacoes,
        codigo: parentSku,
        descricaoCurta: desc || parent.descricaoCurta,
        descricaoComplementar: desc || parent.descricaoComplementar,
        marca: variants[0]["Marca"] || "",
      }),
    });

    // ?idProdutoPai não filtra de verdade (API devolve tudo) — restringe
    // pelo prefixo do nome, já que todo filho é "{nome do pai} Cor:...;Tamanho:X".
    // Precisa do espaço depois do nome do pai — "Preto" é prefixo de
    // "Preto+Cinza" sem espaço, startsWith puro pegava filho do produto errado.
    const siblings = allProducts.filter((p) => p.id !== parent.id && p.nome.startsWith(`${parent.nome} `));
    for (const row of variants) {
      const size = (row["Descrição da variação"].match(/Tamanho:([^;]+)/) || [])[1]?.trim();
      // endsWith, não includes — "G" é substring de "GG", includes erra a escolha.
      const child = siblings.find((c) => c.nome.endsWith(`Tamanho:${size}`));
      if (!child) { console.warn(`  variação sem match: ${row["Descrição da variação"]} (sku ${row["Código (SKU)"]})`); continue; }

      // "Preço" na fonte é o preço de venda já raspado do site de origem
      // (Netshoes/Zattini), não custo. Fonte não tem preço de custo nem
      // promocional — nenhum dos dois é setável aqui.
      await bling(`/produtos/${child.id}`, {
        method: "PUT",
        body: JSON.stringify({
          nome: child.nome, tipo: child.tipo, situacao: child.situacao, formato: child.formato,
          codigo: row["Código (SKU)"],
          preco: Number(row["Preço"]) || 0,
          // Nuvemshop exige descrição em CADA variação, não só no pai.
          descricaoCurta: desc || child.descricaoCurta,
          descricaoComplementar: desc || child.descricaoComplementar,
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
  } catch (e) {
    console.error(`FALHOU: ${parent.nome} (${parentSku}):`, e.message);
    unmatched++;
  }
}

console.log(`\nFeito. ${matched} produtos pai atualizados, ${unmatched} sem match no Bling.`);

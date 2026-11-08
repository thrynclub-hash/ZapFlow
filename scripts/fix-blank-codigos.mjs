import { readFileSync } from "node:fs";

const token = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const cols = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const fields = []; let cur = "", inQ = false;
    for (const c of line) {
      if (c === '"') inQ = !inQ;
      else if (c === ";" && !inQ) { fields.push(cur); cur = ""; }
      else cur += c;
    }
    fields.push(cur);
    const row = {};
    cols.forEach((col, i) => (row[col] = fields[i] ?? ""));
    return row;
  });
}

const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
async function bling(path, opts = {}) {
  await sleep(400);
  const res = await fetch(`https://api.bling.com.br/Api/v3${path}`, { ...opts, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const csv = parseCsv(readFileSync(process.argv[3], "utf-8"));
const blankIds = process.argv[4].split(",").map(Number);
const depositoId = Number(process.argv[5]);

const all = (await bling("/produtos?pagina=1&limite=100")).data;
function parentOf(child) {
  const candidates = all.filter((p) => p.formato === "V" && child.nome.startsWith(p.nome) && p.id !== child.id);
  return candidates.sort((a, b) => b.nome.length - a.nome.length)[0];
}

for (const id of blankIds) {
  const child = (await bling(`/produtos/${id}`)).data;
  const parent = parentOf(child);
  if (!parent || !parent.codigo) { console.warn("sem parent/codigo pra", child.nome); continue; }
  const size = (child.nome.match(/Tamanho:([A-Z]+)$/) || [])[1];
  const color = (child.nome.match(/Cor:([^;]+);Tamanho/) || [])[1];
  const row = csv.find((r) => r["Código do produto pai"] === parent.codigo &&
    r["Descrição da variação"].includes(`Tamanho:${size}`) &&
    (!color || r["Descrição da variação"].includes(`Cor:${color}`)));
  if (!row) { console.warn("sem linha csv pra", child.nome, "pai codigo", parent.codigo); continue; }

  await bling(`/produtos/${id}`, {
    method: "PUT",
    body: JSON.stringify({ nome: child.nome, tipo: child.tipo, situacao: child.situacao, formato: child.formato, codigo: row["Código (SKU)"], precoCusto: Number(row["Preço"]) || 0 }),
  });
  const inStock = row["Disponibilidade na origem"] === "InStock";
  await bling("/estoques", {
    method: "POST",
    body: JSON.stringify({ produto: { id }, deposito: { id: depositoId }, operacao: "B", quantidade: inStock ? 50 : 0, observacoes: "Fix import ZapFlow" }),
  });
  console.log("ok", id, row["Código (SKU)"]);
}

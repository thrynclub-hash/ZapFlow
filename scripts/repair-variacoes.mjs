// Reconstrói o array `variacoes` de produtos pai (formato V) que o Bling
// zera como efeito colateral de "Exportar produtos multiloja" — não afeta
// os filhos de verdade (continuam existindo, com nome/codigo intactos),
// só a referência que o PAI guarda. Uso único/repetível:
// node scripts/repair-variacoes.mjs <access_token>

const token = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function bling(path, opts = {}) {
  await sleep(400);
  const res = await fetch(`https://api.bling.com.br/Api/v3${path}`, { ...opts, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const all = (await bling("/produtos?pagina=1&limite=100")).data;
const parents = all.filter((p) => p.formato === "V");

for (const parent of parents) {
  // espaço depois do nome do pai — "Preto" é prefixo de "Preto+Cinza" sem
  // espaço, startsWith puro pegava filho do produto errado.
  const children = all
    .filter((p) => p.id !== parent.id && p.nome.startsWith(`${parent.nome} `) && p.nome.includes("Tamanho:"))
    .map((c) => ({
      id: c.id, nome: c.nome, codigo: c.codigo, preco: c.preco, tipo: c.tipo, situacao: c.situacao, formato: c.formato,
      variacao: { nome: c.nome.slice(parent.nome.length).trim() },
    }));
  if (!children.length) { console.warn(`sem filhos achados pra "${parent.nome}" (id ${parent.id})`); continue; }

  const full = (await bling(`/produtos/${parent.id}`)).data;
  if (full.variacoes?.length) { console.log(`ok (já tinha variacoes): ${parent.nome}`); continue; }

  // PUT substitui o produto inteiro — reenvia codigo/descrição/preço que já
  // estavam lá, senão o reparo apaga esses campos (achado da vez passada).
  await bling(`/produtos/${parent.id}`, {
    method: "PUT",
    body: JSON.stringify({
      nome: full.nome, tipo: full.tipo, situacao: full.situacao, formato: full.formato,
      codigo: full.codigo, descricaoCurta: full.descricaoCurta, descricaoComplementar: full.descricaoComplementar,
      marca: full.marca, variacoes: children,
    }),
  });
  console.log(`reparado: ${parent.nome} (${children.length} variações)`);
}

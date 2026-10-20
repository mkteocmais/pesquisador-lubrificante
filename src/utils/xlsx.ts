// Gera um .xlsx de verdade (não CSV) sem biblioteca: o arquivo é um ZIP com
// alguns XMLs. Usamos ZIP sem compressão ("store"), que o Excel aceita, e
// textos inline. Cada aba sai com cabeçalho fixo e filtro ligado, pronta para
// tabela dinâmica.

export type Celula = string | number | Date | null | undefined;

export interface Coluna {
  titulo: string;
  largura?: number;
  formato?: "texto" | "moeda" | "numero" | "data";
}

export interface Aba {
  nome: string;
  colunas: Coluna[];
  linhas: Celula[][];
}

const enc = new TextEncoder();

// ---- ZIP -------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(arquivos: { nome: string; dados: Uint8Array }[]): Blob {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const agora = new Date();
  const dosTime = (agora.getHours() << 11) | (agora.getMinutes() << 5) | Math.floor(agora.getSeconds() / 2);
  const dosDate = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();

  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const crc = crc32(a.dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true); // sem compressão
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, a.dados.length, true);
    local.setUint32(22, a.dados.length, true);
    local.setUint16(26, nome.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nome, a.dados);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, a.dados.length, true);
    cd.setUint32(24, a.dados.length, true);
    cd.setUint16(28, nome.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nome);
    offset += 30 + nome.length + a.dados.length;
  }

  const tamanhoCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, offset, true);

  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ---- Planilha --------------------------------------------------------------

function esc(s: string): string {
  return s
    // Caracteres de controle quebram o XML do Excel.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function letraColuna(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Data do Excel = dias desde 30/12/1899, no horário local (como o vendedor viu).
function serialExcel(d: Date): number {
  const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return (local - Date.UTC(1899, 11, 30)) / 86400000;
}

// Índices dos estilos em styles.xml (cellXfs).
const ESTILO = { padrao: 0, cabecalho: 1, data: 2, moeda: 3, numero: 4 };

function celulaXml(ref: string, v: Celula, formato: Coluna["formato"]): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return `<c r="${ref}" s="${ESTILO.data}"><v>${serialExcel(v)}</v></c>`;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    const s = formato === "moeda" ? ESTILO.moeda : formato === "numero" ? ESTILO.numero : ESTILO.padrao;
    return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function abaXml(aba: Aba): string {
  const cols = aba.colunas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura ?? 16}" customWidth="1"/>`)
    .join("");
  const cab = `<row r="1">${aba.colunas
    .map((c, i) => `<c r="${letraColuna(i)}1" s="${ESTILO.cabecalho}" t="inlineStr"><is><t>${esc(c.titulo)}</t></is></c>`)
    .join("")}</row>`;
  const linhas = aba.linhas
    .map((l, r) => {
      const n = r + 2;
      return `<row r="${n}">${l.map((v, i) => celulaXml(`${letraColuna(i)}${n}`, v, aba.colunas[i]?.formato)).join("")}</row>`;
    })
    .join("");
  const ultima = `${letraColuna(aba.colunas.length - 1)}${aba.linhas.length + 1}`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols><sheetData>${cab}${linhas}</sheetData>` +
    `<autoFilter ref="A1:${ultima}"/>` +
    `</worksheet>`
  );
}

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="165" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="166" formatCode="#,##0.00"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF003CA6"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="5">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

export function gerarXlsx(abas: Aba[]): Blob {
  // Nome de aba: até 31 caracteres e sem : \ / ? * [ ]
  const nomes = abas.map((a) => a.nome.replace(/[:\\/?*[\]]/g, " ").slice(0, 31));
  const arquivos = [
    {
      nome: "[Content_Types].xml",
      xml:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        abas
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
          )
          .join("") +
        `</Types>`,
    },
    {
      nome: "_rels/.rels",
      xml:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      nome: "xl/workbook.xml",
      xml:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${nomes.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
        `<definedNames>${abas
          .map((a, i) =>
            `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(nomes[i].replace(/'/g, "''"))}'!$A$1:$${letraColuna(a.colunas.length - 1)}$${a.linhas.length + 1}</definedName>`
          )
          .join("")}</definedNames>` +
        `</workbook>`,
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      xml:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        abas
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
          )
          .join("") +
        `<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    { nome: "xl/styles.xml", xml: STYLES },
    ...abas.map((a, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, xml: abaXml(a) })),
  ];
  return zip(arquivos.map((a) => ({ nome: a.nome, dados: enc.encode(a.xml) })));
}

export function baixarArquivo(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

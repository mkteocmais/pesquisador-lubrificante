import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, MapPin, X } from "lucide-react";
import type { Concorrente, Lancamento, NovoLancamento, Perfil, Produto } from "../../types";
import { salvarLancamento, sugerirEquivalente } from "../../lib/api";
import { buscarLocal } from "../../utils/localizacao";
import { DESEMPENHOS, EMBALAGENS, FLUXOS, MARCAS_BASE, TODAS_VISCOSIDADES, UFS, VISCOSIDADES, separarDesempenho } from "../../utils/options";
import { chaveTexto, parsePreco, precoParaTexto } from "../../utils/format";
import { mensagemErro } from "../../utils/erros";
import { theme, textStyles } from "../../utils/theme";
import { Campo } from "../common/Campo";
import { SuggestInput } from "../common/SuggestInput";
import { useToast } from "../common/ToastProvider";
import { ProdutoPicker } from "./ProdutoPicker";

// Onde a pesquisa foi feita. Fica preenchido ao "lançar outro" no mesmo lugar.
export interface LocalPesquisa {
  empresa: string;
  cidade: string;
  estado: string;
  localizacao: string | null;
}

interface Props {
  perfil: Perfil;
  produtos: Produto[];
  concorrentes: Concorrente[];
  inicial?: Lancamento;
  local?: LocalPesquisa | null;
  onSalvo: (l: Lancamento, local: LocalPesquisa) => void;
  onCancelar?: () => void;
}

const OUTRO = "__outro__";

// Valor salvo que não está na lista vira "Outro" + texto livre.
function separarOutro(valor: string | null | undefined, lista: string[]): [string, string] {
  if (!valor) return ["", ""];
  const achado = lista.find((o) => chaveTexto(o) === chaveTexto(valor));
  return achado ? [achado, ""] : [OUTRO, valor];
}

export function LancamentoForm({ perfil, produtos, concorrentes, inicial, local, onSalvo, onCancelar }: Props) {
  const { showError } = useToast();
  const editando = !!inicial;
  const nomesEmbalagem = useMemo(() => EMBALAGENS.map((e) => e.nome), []);

  const [empresa, setEmpresa] = useState(inicial?.empresa ?? local?.empresa ?? "");
  const [cidade, setCidade] = useState(inicial?.cidade ?? local?.cidade ?? "");
  const [estado, setEstado] = useState(inicial?.estado ?? local?.estado ?? perfil.estado ?? "");
  const [latLong, setLatLong] = useState<string | null>(inicial?.localizacao ?? local?.localizacao ?? null);
  const [gps, setGps] = useState<"buscando" | "ok" | "sem" | null>(null);

  const [marca, setMarca] = useState(inicial?.marca ?? "");
  const [produto, setProduto] = useState(inicial?.produto ?? "");
  const [visc, setVisc] = useState(() => separarOutro(inicial?.viscosidade, TODAS_VISCOSIDADES)[0]);
  const [viscOutro, setViscOutro] = useState(() => separarOutro(inicial?.viscosidade, TODAS_VISCOSIDADES)[1]);
  const [desempenho, setDesempenho] = useState(inicial?.desempenho ?? "");
  const [verTodosDesempenhos, setVerTodosDesempenhos] = useState(false);
  const [produtoRef, setProdutoRef] = useState<string | null>(inicial?.produto_ref_id ?? null);
  const [sugestoes, setSugestoes] = useState<{ produto_id: string; usos: number }[]>([]);

  const [fluxo, setFluxo] = useState(inicial?.cliente ?? "");
  const [emb, setEmb] = useState(() => separarOutro(inicial?.sku, nomesEmbalagem)[0]);
  const [embOutro, setEmbOutro] = useState(() => separarOutro(inicial?.sku, nomesEmbalagem)[1]);
  const [preco, setPreco] = useState(precoParaTexto(inicial?.preco));

  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);

  // GPS só ao criar e quando o local ainda não veio de um lançamento anterior.
  useEffect(() => {
    if (editando || local) return;
    let vivo = true;
    setGps("buscando");
    buscarLocal().then((l) => {
      if (!vivo) return;
      if (!l) return setGps("sem");
      setLatLong(l.latLong);
      if (l.cidade) setCidade((c) => c || l.cidade || "");
      if (l.uf) setEstado(l.uf);
      setGps("ok");
    });
    return () => {
      vivo = false;
    };
  }, [editando, local]);

  // Sugere o nosso equivalente mais usado pela equipe para este concorrente.
  useEffect(() => {
    if (!marca.trim() || !produto.trim()) {
      setSugestoes([]);
      return;
    }
    const id = window.setTimeout(() => {
      sugerirEquivalente(marca, produto)
        .then(setSugestoes)
        .catch(() => setSugestoes([]));
    }, 500);
    return () => window.clearTimeout(id);
  }, [marca, produto]);

  useEffect(() => {
    if (!foto) {
      setFotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(foto);
    setFotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const opcoesMarca = useMemo(() => {
    const vistas = concorrentes.map((c) => c.marca);
    return Array.from(new Set([...vistas, ...MARCAS_BASE]));
  }, [concorrentes]);

  const opcoesProduto = useMemo(() => {
    const k = chaveTexto(marca);
    return concorrentes.filter((c) => c.produto && (!k || chaveTexto(c.marca) === k)).map((c) => c.produto as string);
  }, [concorrentes, marca]);

  const escolherProduto = (v: string) => {
    setProduto(v);
    // Escolheu um produto já pesquisado: aproveita a viscosidade dele.
    if (!visc) {
      const c = concorrentes.find((x) => chaveTexto(x.marca) === chaveTexto(marca) && chaveTexto(x.produto) === chaveTexto(v));
      if (c?.viscosidade) {
        const [sel, outro] = separarOutro(c.viscosidade, TODAS_VISCOSIDADES);
        setVisc(sel);
        setViscOutro(outro);
      }
    }
  };

  const viscFinal = visc === OUTRO ? viscOutro.trim() : visc;
  const embFinal = emb === OUTRO ? embOutro.trim() : emb;
  const precoNum = parsePreco(preco);

  const faltando: string[] = [];
  if (!empresa.trim()) faltando.push("empresa");
  if (!estado) faltando.push("UF");
  if (!marca.trim()) faltando.push("marca");
  if (!produto.trim()) faltando.push("produto");
  if (!fluxo) faltando.push("fluxo de venda");
  if (!embFinal) faltando.push("embalagem");
  if (!(precoNum > 0)) faltando.push("preço");

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (faltando.length) return;
    setSalvando(true);
    const dados: NovoLancamento = {
      empresa: empresa.trim(),
      cidade: cidade.trim() || null,
      estado,
      marca: marca.trim(),
      produto: produto.trim(),
      viscosidade: viscFinal || null,
      desempenho: separarDesempenho(desempenho).join(", ") || null,
      cliente: fluxo,
      sku: embFinal,
      preco: Math.round(precoNum * 100) / 100,
      produto_ref_id: produtoRef,
      ...(editando ? {} : { localizacao: latLong }),
    };
    try {
      const salvo = await salvarLancamento({ perfil, dados, foto, id: inicial?.id });
      onSalvo(salvo, { empresa: dados.empresa ?? "", cidade: dados.cidade ?? "", estado, localizacao: latLong });
    } catch (err) {
      showError(mensagemErro(err, "Não foi possível gravar o preço. Tente de novo."));
      setSalvando(false);
    }
  };

  const erro = (cond: boolean) => (tentou && cond ? " border-rose-400 focus:border-rose-500" : "");
  const fotoAtual = fotoPreview ?? inicial?.foto_url ?? null;

  return (
    <form onSubmit={salvar} className="space-y-6" noValidate>
      {/* Foto da etiqueta/gôndola: opcional, ajuda a conferir depois. */}
      <section className="space-y-3">
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        <input ref={galeriaRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        {fotoAtual ? (
          <div className="relative rounded-lg overflow-hidden border border-line bg-sunken">
            <img src={fotoAtual} alt="Foto do produto pesquisado" className="w-full max-h-64 object-contain" />
            {foto && (
              <button
                type="button"
                onClick={() => setFoto(null)}
                aria-label="Tirar foto"
                className="absolute top-2 right-2 p-2 rounded-full bg-white/90 text-ink"
              >
                <X size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="absolute bottom-2 right-2 px-3 py-2 rounded-full bg-white/90 text-ink text-xs font-semibold"
            >
              Trocar foto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => cameraRef.current?.click()} className="bg-brand text-white rounded-lg py-5 flex flex-col items-center gap-2 active:scale-[0.98] transition-all">
              <Camera size={26} />
              <span className="text-sm font-semibold">Câmera</span>
            </button>
            <button type="button" onClick={() => galeriaRef.current?.click()} className="bg-brand-soft text-brand-ink rounded-lg py-5 flex flex-col items-center gap-2 active:scale-[0.98] transition-all">
              <ImageIcon size={26} />
              <span className="text-sm font-semibold">Galeria</span>
            </button>
          </div>
        )}
        {!fotoAtual && <p className="text-xs text-muted text-center">A foto é opcional.</p>}
      </section>

      <section className="space-y-4">
        <h2 className={textStyles.section}>Onde</h2>
        <Campo label="Empresa pesquisada" htmlFor="f-empresa">
          <input id="f-empresa" autoComplete="off" className={theme.input + erro(!empresa.trim())} placeholder="Nome do local ou da empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} maxLength={200} />
        </Campo>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Campo label="Cidade" htmlFor="f-cidade">
            <input id="f-cidade" autoComplete="off" className={theme.input} placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={120} />
          </Campo>
          <Campo label="UF" htmlFor="f-uf">
            <select id="f-uf" className={theme.select + erro(!estado)} value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">--</option>
              {UFS.map((u) => (
                <option key={u.sigla} value={u.sigla}>
                  {u.sigla}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {gps && (
          <p className="text-xs text-muted flex items-center gap-1.5 ml-1">
            <MapPin size={14} />
            {gps === "buscando" ? "Buscando sua localização..." : gps === "ok" ? "Localização detectada" : "Sem GPS: preencha cidade e UF"}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className={textStyles.section}>Produto do concorrente</h2>
        <Campo label="Marca">
          <SuggestInput
            value={marca}
            onChange={setMarca}
            options={opcoesMarca}
            placeholder="Ex: Lubrax, Mobil, Shell..."
            ariaLabel="Marca"
            className={theme.input + erro(!marca.trim())}
          />
        </Campo>
        <Campo label="Nome do produto">
          <SuggestInput
            value={produto}
            onChange={escolherProduto}
            options={opcoesProduto}
            showOnEmpty={!!marca.trim()}
            placeholder="Ex: Essencial CI-4, Rimula R4..."
            ariaLabel="Nome do produto"
            className={theme.input + erro(!produto.trim())}
          />
        </Campo>
        <Campo label="Viscosidade" htmlFor="f-visc">
          <select id="f-visc" className={theme.select} value={visc} onChange={(e) => setVisc(e.target.value)}>
            <option value="">Selecione...</option>
            {VISCOSIDADES.map((g) => (
              <optgroup key={g.grupo} label={g.grupo}>
                {g.opcoes.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </optgroup>
            ))}
            <option value={OUTRO}>Outra (digitar)</option>
          </select>
          {visc === OUTRO && (
            <input autoComplete="off" className={theme.input + " mt-2"} placeholder="Digite a viscosidade" aria-label="Outra viscosidade" value={viscOutro} onChange={(e) => setViscOutro(e.target.value)} maxLength={60} />
          )}
        </Campo>
        <Campo label="Desempenho" htmlFor="f-desemp" dica="Especificações do rótulo. Toque para marcar ou digite separando por vírgula.">
          <input
            id="f-desemp"
            autoComplete="off"
            className={theme.input}
            placeholder="Ex: API SP, ACEA C3, DEXOS 1 Gen 3"
            value={desempenho}
            onChange={(e) => setDesempenho(e.target.value)}
            maxLength={200}
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(verTodosDesempenhos ? DESEMPENHOS : DESEMPENHOS.slice(0, 10)).map((d) => {
              const lista = separarDesempenho(desempenho);
              const marcado = lista.some((x) => x.toLowerCase() === d.toLowerCase());
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() =>
                    setDesempenho(
                      (marcado ? lista.filter((x) => x.toLowerCase() !== d.toLowerCase()) : [...lista, d]).join(", ")
                    )
                  }
                  className={`text-xs px-2.5 py-1.5 rounded-md border ${
                    marcado ? "bg-brand text-white border-brand" : "bg-surface text-ink border-line"
                  }`}
                >
                  {d}
                </button>
              );
            })}
            <button type="button" onClick={() => setVerTodosDesempenhos((v) => !v)} className="text-xs px-2 py-1.5 text-brand-ink font-medium">
              {verTodosDesempenhos ? "menos" : "mais..."}
            </button>
          </div>
        </Campo>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className={textStyles.section}>Equivalente Grupo Pax</h2>
          <p className="text-xs text-muted mt-0.5">Qual produto nosso concorre com esse? É o que alimenta a base de equivalências.</p>
        </div>
        <ProdutoPicker produtos={produtos} valor={produtoRef} onChange={setProdutoRef} viscosidade={viscFinal} sugestoes={sugestoes} />
      </section>

      <section className="space-y-4">
        <h2 className={textStyles.section}>Preço</h2>
        <Campo label="Fluxo de venda (de → para)" htmlFor="f-fluxo">
          <select id="f-fluxo" className={theme.select + erro(!fluxo)} value={fluxo} onChange={(e) => setFluxo(e.target.value)}>
            <option value="">Selecione...</option>
            {FLUXOS.map((f) => (
              <option key={f} value={f}>
                {f.replace("->", "→")}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Embalagem" htmlFor="f-emb">
          <select id="f-emb" className={theme.select + erro(!embFinal)} value={emb} onChange={(e) => setEmb(e.target.value)}>
            <option value="">Selecione...</option>
            {nomesEmbalagem.map((o) => (
              <option key={o}>{o}</option>
            ))}
            <option value={OUTRO}>Outra (digitar)</option>
          </select>
          {emb === OUTRO && (
            <input autoComplete="off" className={theme.input + " mt-2"} placeholder="Descreva a embalagem" aria-label="Outra embalagem" value={embOutro} onChange={(e) => setEmbOutro(e.target.value)} maxLength={80} />
          )}
        </Campo>
        <div className={`rounded-lg border-2 p-4 text-center ${tentou && !(precoNum > 0) ? "border-rose-400" : "border-brand"} bg-brand-soft/40`}>
          <label htmlFor="f-preco" className="text-[13px] font-medium text-brand-ink">
            Preço pesquisado da embalagem
          </label>
          <div className="flex items-center justify-center gap-1 mt-1">
            <span className="text-2xl font-semibold text-brand-ink">R$</span>
            <input
              id="f-preco"
              autoComplete="off"
              inputMode="decimal"
              placeholder="0,00"
              className="w-full max-w-[220px] bg-transparent text-center text-4xl font-semibold text-brand-ink outline-none placeholder:text-brand-light tabular-nums"
              value={preco}
              onChange={(e) => setPreco(e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </div>
        </div>
      </section>

      {tentou && faltando.length > 0 && (
        <p role="alert" className="text-sm text-rose-600 text-center">
          Falta preencher: {faltando.join(", ")}.
        </p>
      )}

      <div className="space-y-3 pb-4">
        <button type="submit" disabled={salvando} className={theme.botaoPrimario}>
          {salvando ? <Loader2 className="animate-spin mx-auto" size={20} /> : editando ? "Salvar alterações" : "Gravar preço"}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="w-full py-3 text-sm font-semibold text-muted">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

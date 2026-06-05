const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'settings', 'FiscalSettings.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// --- 1. REMOVE DUPLICATE MODAL BLOCK ---
const targetModalComment = '{/* Modal de Cobertura e Homologações por Estado (UF) */}';
const firstModalIdx = content.indexOf(targetModalComment);
if (firstModalIdx === -1) {
    console.error("ERRO: Não encontrou o comentário do primeiro modal!");
    process.exit(1);
}

const secondModalIdx = content.indexOf(targetModalComment, firstModalIdx + 1);
const resultModalIdx = content.indexOf('{/* Modal de Resultado */}');

if (secondModalIdx !== -1 && resultModalIdx !== -1 && secondModalIdx < resultModalIdx) {
    content = content.substring(0, secondModalIdx) + content.substring(resultModalIdx);
    console.log("Sucesso: Bloco de modal duplicado removido!");
} else {
    console.log("Nota: O bloco duplicado já havia sido removido ou não foi detectado.");
}

// --- 2. UPDATE IMPORTS ---
const targetImports = "import { Building2, Save, ExternalLink, ShieldCheck, AlertCircle, Eye, EyeOff, RefreshCw, Search, Mail, MessageCircle, Send, Globe, Check, X, ChevronRight } from 'lucide-react';";
const replacementImports = "import { Building2, Save, ExternalLink, ShieldCheck, AlertCircle, Eye, EyeOff, RefreshCw, Search, Mail, MessageCircle, Send, Globe, Check, X, ChevronRight, Info } from 'lucide-react';";

if (content.includes(targetImports)) {
    content = content.replace(targetImports, replacementImports);
    console.log("Sucesso: Adicionado Info ao import de lucide-react.");
} else if (content.includes("lucide-react") && content.includes("Info")) {
    console.log("Nota: Import de Info já presente.");
} else {
    console.error("ERRO: Não encontrou a linha de imports padrão de lucide-react!");
    process.exit(1);
}

// --- 3. INJECT HELPER FUNCTION ---
const targetHelperAnchor = "export function FiscalSettings() {";
const replacementHelper = `const formatDadosObrigatorios = (dados: any) => {
    if (!dados) return "Consulta não disponível";
    
    let campos: string[] = [];
    if (Array.isArray(dados.campos)) {
        campos = dados.campos;
    } else if (Array.isArray(dados)) {
        campos = dados;
    } else if (typeof dados === 'string') {
        return dados;
    }
    
    if (campos.length === 0) return "Consulta não disponível";
    
    const formatted = campos.map(c => {
        if (typeof c !== 'string') return String(c);
        
        const parts = c.split('.');
        if (parts.length === 2) {
            const section = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            let field = parts[1].replace(/([A-Z])/g, ' $1').trim();
            field = field.charAt(0).toUpperCase() + field.slice(1);
            
            if (field.toLowerCase() === 'cpf cnpj') field = 'CpfCnpj';
            
            return \`\${section} - \${field}\`;
        }
        
        return c.charAt(0).toUpperCase() + c.slice(1);
    });
    
    const hasOnlyTomador = formatted.every(item => item.startsWith("Tomador - "));
    if (hasOnlyTomador && formatted.length > 0) {
        const list = formatted.map(item => item.replace("Tomador - ", ""));
        return \`Tomador - \${list.join(', ')}\`;
    }
    
    return formatted.join(', ');
};

export function FiscalSettings() {`;

if (content.includes("const formatDadosObrigatorios =")) {
    console.log("Nota: Função formatDadosObrigatorios já definida.");
} else if (content.includes(targetHelperAnchor)) {
    content = content.replace(targetHelperAnchor, replacementHelper);
    console.log("Sucesso: Função formatDadosObrigatorios injetada.");
} else {
    console.error("ERRO: Não encontrou o gancho de exportação export function FiscalSettings()!");
    process.exit(1);
}

// --- 4. REDESIGN SINGLE CITY SEARCH CARD ---
const targetSingleCardStart = `{/* Card de Resultado para Nome ou IBGE */}`;
const singleCardAnchor = `tecnoSpeedCityInfo && (searchMode === 'name' || searchMode === 'ibge') && (`;
const singleCardEnd = `                                        </div>
                                    </div>
                                )}`;

// Vamos encontrar o bloco completo do card de resultado único e substituí-lo
const singleStartIdx = content.indexOf(targetSingleCardStart);
if (singleStartIdx === -1) {
    console.error("ERRO: Não encontrou o início do Card de Resultado Único!");
    process.exit(1);
}

const singleAnchorIdx = content.indexOf(singleCardAnchor, singleStartIdx);
if (singleAnchorIdx === -1) {
    console.error("ERRO: Não encontrou a âncora do Card de Resultado Único!");
    process.exit(1);
}

const singleEndIdx = content.indexOf(singleCardEnd, singleAnchorIdx);
if (singleEndIdx === -1) {
    console.error("ERRO: Não encontrou o fim do Card de Resultado Único!");
    process.exit(1);
}

const originalSingleCard = content.substring(singleStartIdx, singleEndIdx + singleCardEnd.length);

const replacementSingleCard = `                                {/* Card de Resultado para Nome ou IBGE */}
                                {tecnoSpeedCityInfo && (searchMode === 'name' || searchMode === 'ibge') && (
                                    <div className="mt-4 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-md animate-in fade-in slide-in-from-top-3 duration-300">
                                        {cityNotHomologatedMessage && (
                                            <div className="p-4 bg-rose-50 dark:bg-rose-955/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex items-start gap-3 text-rose-800 dark:text-rose-455 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <AlertCircle className="shrink-0 text-rose-500 mt-0.5" size={18} />
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wider">Atenção: Município Não Homologado</p>
                                                    <p className="text-[11px] font-semibold opacity-90 mt-1 leading-relaxed">{cityNotHomologatedMessage}</p>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                            {/* Detalhes do Município */}
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex justify-between items-start w-full gap-4">
                                                        {/* Cidade */}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-wider select-none">
                                                                Cidade <Info size={10} className="text-gray-455 dark:text-slate-500 shrink-0" />
                                                            </span>
                                                            <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5 truncate">
                                                                {tecnoSpeedCityInfo.nome || selectedSearchCity?.nome || ('Código ' + (tecnoSpeedCityInfo.codigoIbge || tecnoSpeedCityInfo.ibge))}
                                                            </span>
                                                        </div>
                                                        {/* UF */}
                                                        <div className="flex flex-col items-end shrink-0">
                                                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider select-none">
                                                                UF
                                                            </span>
                                                            <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5">
                                                                {tecnoSpeedCityInfo.uf || searchUf}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Botão de definir como cidade ativa */}
                                                    {!cityNotHomologatedMessage && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const activeIbge = String(tecnoSpeedCityInfo.codigoIbge || tecnoSpeedCityInfo.ibge || selectedSearchCity?.id);
                                                                const activeName = tecnoSpeedCityInfo.nome || selectedSearchCity?.nome;
                                                                const activeUf = tecnoSpeedCityInfo.uf || searchUf;
                                                                
                                                                setConfig(prev => ({
                                                                    ...prev,
                                                                    endereco: {
                                                                        ...prev.endereco,
                                                                        codigoCidade: activeIbge,
                                                                        cidade: activeName,
                                                                        uf: activeUf
                                                                    }
                                                                }));
                                                                
                                                                setResultModal({
                                                                    isOpen: true,
                                                                    title: 'Cidade Selecionada!',
                                                                    message: \`A cidade \${activeName} - \${activeUf} foi definida como ativa nas configurações fiscais do emitente. Lembre-se de salvar para persistir as alterações.\`,
                                                                    type: 'success'
                                                                });
                                                            }}
                                                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-955/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-1 active:scale-95 transition-all shrink-0 ml-2"
                                                        >
                                                            <Check size={12} />
                                                            Definir como Cidade Ativa
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Três colunas técnicas */}
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Layout de integração</span>
                                                        <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 truncate">
                                                            {tecnoSpeedCityInfo.padraoNacional?.producao || tecnoSpeedCityInfo.padraoNacional?.homologacao ? 'NFS-e Nacional' : 'WebService'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Padrão</span>
                                                        {tecnoSpeedCityInfo.padrao ? (
                                                            <a 
                                                                href={\`https://docs.plugnotas.com.br/docs/padrao-\${tecnoSpeedCityInfo.padrao.toLowerCase()}\`}
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-[10px] font-extrabold text-sky-500 hover:text-sky-655 dark:text-sky-400 dark:hover:text-sky-300 mt-0.5 flex items-center gap-0.5 transition-colors truncate"
                                                            >
                                                                <ExternalLink size={9} className="shrink-0" />
                                                                {tecnoSpeedCityInfo.padrao}
                                                            </a>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 mt-0.5">Não informado</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Código IBGE</span>
                                                        <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 font-mono truncate">
                                                            {tecnoSpeedCityInfo.codigoIbge || tecnoSpeedCityInfo.ibge || selectedSearchCity?.id}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Dados obrigatórios */}
                                                <div className="flex flex-col pt-1">
                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-widest select-none">
                                                        Dados obrigatórios das notas tomadas <Info size={9} className="text-gray-405 dark:text-slate-500 shrink-0" />
                                                    </span>
                                                    <span className={\`text-[10px] font-extrabold mt-0.5 leading-relaxed truncate \${
                                                        formatDadosObrigatorios(tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas) === "Consulta não disponível"
                                                            ? 'text-gray-450 dark:text-slate-500 font-medium'
                                                            : 'text-gray-800 dark:text-slate-350'
                                                    }\`}>
                                                        {formatDadosObrigatorios(tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Checklist de Recursos & Requisitos */}
                                            <div className="p-5 bg-gray-50/50 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-4">
                                                <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-normal select-none">Requisitos e Recursos Homologados</h5>
                                                
                                                <hr className="border-gray-100 dark:border-slate-800/80 my-1" />

                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-4">
                                                    {/* Item 1: Notas tomadas */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {!!tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas && formatDadosObrigatorios(tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas) !== "Consulta não disponível" ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                <X size={9} strokeWidth={4} />
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                            Notas tomadas <Info size={9} className="text-gray-400 shrink-0" />
                                                        </span>
                                                    </div>

                                                    {/* Item 2: Login */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {tecnoSpeedCityInfo.login ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                <X size={9} strokeWidth={4} />
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                            Login <Info size={9} className="text-gray-400 shrink-0" />
                                                        </span>
                                                    </div>

                                                    {/* Item 3: Senha */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {tecnoSpeedCityInfo.senha ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                <X size={9} strokeWidth={4} />
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                            Senha <Info size={9} className="text-gray-400 shrink-0" />
                                                        </span>
                                                    </div>

                                                    {/* Item 4: Múltiplos serviços */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {tecnoSpeedCityInfo.multiservicos ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                <X size={9} strokeWidth={4} />
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                            Múltiplos serviços <Info size={9} className="text-gray-400 shrink-0" />
                                                        </span>
                                                    </div>

                                                    {/* Item 5: Certificado */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {!tecnoSpeedCityInfo.certificado ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                <X size={9} strokeWidth={4} />
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                            Certificado <Info size={9} className="text-gray-400 shrink-0" />
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}`;

content = content.replace(originalSingleCard, replacementSingleCard);
console.log("Sucesso: Card de busca única redesenhado!");

// --- 5. REDESIGN MODAL LIST CITY CARD ---
// Encontrar o retorno do loop das cidades
const modalLoopStart = `filteredStateCities.map((city) => {`;
const modalMapStartIdx = content.indexOf(modalLoopStart);

if (modalMapStartIdx === -1) {
    console.error("ERRO: Não encontrou o início do map de cidades do modal!");
    process.exit(1);
}

// Vamos encontrar o "return (" e o container "div" interno correspondente
const returnIdx = content.indexOf("return (", modalMapStartIdx);
const divStartIdx = content.indexOf("<div", returnIdx);
const divOriginalStart = content.substring(divStartIdx, divStartIdx + 120);

// Vamos encontrar o final do card do modal (antes do "const status = ...")
// Ele termina na linha ");" correspondente ao map das cidades
const originalCardBlockStart = content.substring(divStartIdx, divStartIdx + 15000); // margem bem grande para conter todo o card

const closingDivMatch = originalCardBlockStart.match(/<\/div>\s*\n\s*\);/);
if (!closingDivMatch) {
    console.error("ERRO: Não encontrou o fechamento do bloco de card no loop do modal!");
    process.exit(1);
}

const closingDivIdx = closingDivMatch.index + 6; // inclui o "</div>"
const originalModalCard = originalCardBlockStart.substring(0, closingDivIdx);

const replacementModalCard = `                                            <div 
                                                key={city.id}
                                                className={\`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 flex flex-col justify-between group \${
                                                    status?.loading 
                                                        ? 'border-indigo-300 dark:border-indigo-900 ring-2 ring-indigo-500/10 bg-indigo-50/5 dark:bg-indigo-955/5 animate-pulse' 
                                                        : isVerified && notHomologated
                                                            ? 'border-rose-200 dark:border-rose-955/40 hover:border-rose-300 dark:hover:border-rose-955/60 shadow-sm shadow-rose-500/5'
                                                            : isVerified
                                                                ? 'border-emerald-250 dark:border-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-950/60 shadow-sm shadow-emerald-500/5'
                                                                : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-md'
                                                }\`}
                                            >
                                                {/* Topo do Card */}
                                                <div>
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="flex justify-between items-start w-full gap-4">
                                                            {/* Cidade */}
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-wider select-none">
                                                                    Cidade <Info size={10} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                                                </span>
                                                                <span className="text-xs font-black text-gray-900 dark:text-white mt-0.5 truncate" title={city.nome}>
                                                                    {city.nome}
                                                                </span>
                                                            </div>
                                                            {/* UF */}
                                                            <div className="flex flex-col items-end shrink-0">
                                                                <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider select-none">
                                                                    UF
                                                                </span>
                                                                <span className="text-xs font-black text-gray-900 dark:text-white mt-0.5">
                                                                    {searchUf}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Status Badge */}
                                                        {status?.loading ? (
                                                            <span className="inline-flex items-center gap-1 text-[8px] font-extrabold text-indigo-655 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-955 px-1.5 py-0.5 rounded-md border border-indigo-100/30 shrink-0">
                                                                <RefreshCw size={8} className="animate-spin" />
                                                                Consultando
                                                            </span>
                                                        ) : isVerified && notHomologated ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-rose-600 dark:text-rose-455 bg-rose-50 dark:bg-rose-955/30 px-1.5 py-0.5 rounded-md border border-rose-100/30 shrink-0">
                                                                <X size={8} />
                                                                Indisponível
                                                            </span>
                                                        ) : isVerified ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-955/30 px-1.5 py-0.5 rounded-md border border-emerald-100/30 shrink-0">
                                                                <Check size={8} />
                                                                Homologado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-850 px-1.5 py-0.5 rounded-md border border-gray-150/40 shrink-0">
                                                                Não verificado
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Conteúdo Técnico */}
                                                    {isVerified ? (
                                                        <div className="mt-4 space-y-3.5 animate-in fade-in duration-200">
                                                            {/* Três colunas técnicas: Layout, Padrão, Código IBGE */}
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Layout de integração</span>
                                                                    <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 truncate">
                                                                        {cityInfo?.padraoNacional?.producao || cityInfo?.padraoNacional?.homologacao ? 'NFS-e Nacional' : 'WebService'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Padrão</span>
                                                                    {cityInfo?.padrao ? (
                                                                        <a 
                                                                            href={\`https://docs.plugnotas.com.br/docs/padrao-\${cityInfo.padrao.toLowerCase()}\`}
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer" 
                                                                            className="text-[10px] font-extrabold text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 mt-0.5 flex items-center gap-0.5 transition-colors truncate"
                                                                        >
                                                                            <ExternalLink size={9} className="shrink-0" />
                                                                            {cityInfo.padrao}
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 mt-0.5">Não informado</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Código IBGE</span>
                                                                    <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 font-mono truncate">
                                                                        {city.id}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Dados obrigatórios */}
                                                            <div className="flex flex-col pt-0.5">
                                                                <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-widest select-none">
                                                                    Dados obrigatórios das notas tomadas <Info size={9} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                                                </span>
                                                                <span className={\`text-[10px] font-extrabold mt-0.5 leading-relaxed truncate \${
                                                                    formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas) === "Consulta não disponível"
                                                                        ? 'text-gray-400 dark:text-slate-500 font-medium'
                                                                        : 'text-gray-800 dark:text-slate-350'
                                                                }\`}>
                                                                    {formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas)}
                                                                </span>
                                                            </div>

                                                            <hr className="border-gray-100 dark:border-slate-800/80 my-1" />

                                                            {/* Checklist de requisitos (Grid de 3 Colunas) */}
                                                            <div className="grid grid-cols-3 gap-x-2 gap-y-3 pt-1">
                                                                {/* Item 1: Notas tomadas */}
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    {!!cityInfo?.dadosObrigatoriosNotasTomadas && formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas) !== "Consulta não disponível" ? (
                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                            <Check size={9} strokeWidth={4} />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                            <X size={9} strokeWidth={4} />
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                        Notas tomadas <Info size={9} className="text-gray-400 shrink-0" />
                                                                    </span>
                                                                </div>

                                                                {/* Item 2: Login */}
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    {cityInfo?.login ? (
                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                            <Check size={9} strokeWidth={4} />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                            <X size={9} strokeWidth={4} />
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                        Login <Info size={9} className="text-gray-400 shrink-0" />
                                                                    </span>
                                                                </div>

                                                                {/* Item 3: Senha */}
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    {cityInfo?.senha ? (
                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                            <Check size={9} strokeWidth={4} />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                            <X size={9} strokeWidth={4} />
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                        Senha <Info size={9} className="text-gray-400 shrink-0" />
                                                                    </span>
                                                                </div>

                                                                {/* Item 4: Múltiplos serviços */}
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    {cityInfo?.multiservicos ? (
                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                            <Check size={9} strokeWidth={4} />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                            <X size={9} strokeWidth={4} />
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                        Múltiplos serviços <Info size={9} className="text-gray-400 shrink-0" />
                                                                    </span>
                                                                </div>

                                                                {/* Item 5: Certificado */}
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    {!cityInfo?.certificado ? (
                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                            <Check size={9} strokeWidth={4} />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                            <X size={9} strokeWidth={4} />
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                        Certificado <Info size={9} className="text-gray-400 shrink-0" />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="py-2.5 flex items-center justify-center text-center bg-gray-50 dark:bg-slate-855/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-800 mt-3 flex-1 min-h-[140px]">
                                                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">Aguardando consulta de requisitos</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Ações do Card */}
                                                <div className="mt-4 pt-3.5 border-t border-gray-150 dark:border-slate-805 flex items-center justify-between gap-2">
                                                    {/* Botão de Verificação Única / Re-verificação */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleVerifySingleCityInState(city.id, city.nome)}
                                                        disabled={status?.loading || verifyingAllStateCities}
                                                        className="text-[10px] font-bold text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <RefreshCw size={10} className={status?.loading ? 'animate-spin' : ''} />
                                                        {isVerified ? 'Atualizar Dados' : 'Verificar Requisitos'}
                                                    </button>

                                                    {/* Selecionar como ativa se homologado */}
                                                    {isVerified && !notHomologated && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setConfig(prev => ({
                                                                    ...prev,
                                                                    endereco: {
                                                                        ...prev.endereco,
                                                                        codigoCidade: String(city.id),
                                                                        cidade: city.nome,
                                                                        uf: searchUf
                                                                    }
                                                                }));
                                                                
                                                                setResultModal({
                                                                    isOpen: true,
                                                                    title: 'Cidade Selecionada!',
                                                                    message: \`A cidade \${city.nome} - \${searchUf} foi definida como ativa nas configurações fiscais do emitente. Lembre-se de salvar para persistir as alterações.\`,
                                                                    type: 'success'
                                                                });
                                                                setIsStateModalOpen(false);
                                                            }}
                                                            className="text-[10px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-0.5 active:scale-95 transition-all shadow-sm shadow-emerald-500/10"
                                                        >
                                                            <Check size={10} />
                                                            Selecionar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>`;

content = content.replace(originalModalCard, replacementModalCard);
console.log("Sucesso: Card do loop do modal estadual redesenhado!");

fs.writeFileSync(filePath, content, 'utf8');
console.log("Sucesso: Arquivo FiscalSettings.tsx salvo!");

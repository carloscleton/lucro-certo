const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'settings', 'FiscalSettings.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// --- BLOCK 1: IMPORTS ---
const targetImports = "import { Building2, Save, ExternalLink, ShieldCheck, AlertCircle, Eye, EyeOff, RefreshCw, Search, Mail, MessageCircle, Send, Globe, Check, X, ChevronRight } from 'lucide-react';";
const replacementImports = "import { Building2, Save, ExternalLink, ShieldCheck, AlertCircle, Eye, EyeOff, RefreshCw, Search, Mail, MessageCircle, Send, Globe, Check, X, ChevronRight, Info } from 'lucide-react';";

if (!content.includes(targetImports)) {
    console.error("ERRO: Não encontrou os imports no arquivo!");
    process.exit(1);
}
content = content.replace(targetImports, replacementImports);

// --- BLOCK 2: HELPER FUNCTION ---
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

if (!content.includes(targetHelperAnchor)) {
    console.error("ERRO: Não encontrou o gancho export no arquivo!");
    process.exit(1);
}
content = content.replace(targetHelperAnchor, replacementHelper);

// --- BLOCK 3: SINGLE CITY SEARCH DETAILS CARD ---
const targetSingleCard = `                                {/* Card de Resultado para Nome ou IBGE */}
                                {tecnoSpeedCityInfo && (searchMode === 'name' || searchMode === 'ibge') && (
                                    <div className="mt-4 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-md animate-in fade-in slide-in-from-top-3 duration-300">
                                        {cityNotHomologatedMessage && (
                                            <div className="p-4 bg-rose-50 dark:bg-rose-955/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex items-start gap-3 text-rose-800 dark:text-rose-455 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <AlertCircle className="shrink-0 text-rose-500 mt-0.5" size={18} />
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wider">Atenção: Município Não Homologado</p>
                                                    <p className="text-[11px] font-semibold opacity-90 mt-1 leading-relaxed">{cityNotHomologatedMessage}</p>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                            {/* Detalhes do Município */}
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Município Selecionado</span>
                                                        <h4 className="text-lg font-black text-gray-900 dark:text-white">
                                                            {tecnoSpeedCityInfo.nome || selectedSearchCity?.nome || ('Código ' + (tecnoSpeedCityInfo.codigoIbge || tecnoSpeedCityInfo.ibge))} - {tecnoSpeedCityInfo.uf || searchUf}
                                                        </h4>
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
                                                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-1 active:scale-95 transition-all shrink-0"
                                                        >
                                                            <Check size={12} />
                                                            Definir como Cidade Ativa
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-100/50 dark:border-slate-800">
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Código IBGE</span>
                                                        <code className="text-xs font-bold font-mono text-indigo-650 dark:text-indigo-400">
                                                            {tecnoSpeedCityInfo.codigoIbge || tecnoSpeedCityInfo.ibge || selectedSearchCity?.id}
                                                        </code>
                                                    </div>
                                                    <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-100/50 dark:border-slate-800">
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Padrão / Provedor</span>
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block truncate font-mono">
                                                            {tecnoSpeedCityInfo.padrao || 'Não informado'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/30 dark:border-indigo-900/20">
                                                    <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">Layout de Integração</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-indigo-500 text-white rounded-lg">
                                                            <Globe size={12} />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                                                            {tecnoSpeedCityInfo.padraoNacional?.producao || tecnoSpeedCityInfo.padraoNacional?.homologacao
                                                                ? 'NFS-e Padrão Nacional (Receita Federal)'
                                                                : 'WebService Municipal Dedicado'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Checklist de Recursos & Requisitos */}
                                            <div className="p-4 bg-gray-50 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-3">
                                                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Requisitos e Recursos Homologados</h5>
                                                
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100/60 dark:border-slate-800 shadow-sm">
                                                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Exige Certificado Digital</span>
                                                        <div className={\`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full \${tecnoSpeedCityInfo.certificado ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}\`}>
                                                            {tecnoSpeedCityInfo.certificado ? <AlertCircle size={10} /> : <Check size={10} />}
                                                            {tecnoSpeedCityInfo.certificado ? 'Exigido' : 'Isento'}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100/60 dark:border-slate-800 shadow-sm">
                                                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Suporte a Múltiplos Serviços</span>
                                                        <div className={\`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full \${tecnoSpeedCityInfo.multiservicos ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-655 dark:bg-red-900/20 dark:text-red-400'}\`}>
                                                            {tecnoSpeedCityInfo.multiservicos ? <Check size={10} /> : <X size={10} />}
                                                            {tecnoSpeedCityInfo.multiservicos ? 'Suportado' : 'Não suportado'}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100/60 dark:border-slate-800 shadow-sm">
                                                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Exige Login do Prestador</span>
                                                        <div className={\`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full \${tecnoSpeedCityInfo.login ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}\`}>
                                                            {tecnoSpeedCityInfo.login ? <AlertCircle size={10} /> : <Check size={10} />}
                                                            {tecnoSpeedCityInfo.login ? 'Necessário' : 'Não exigido'}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100/60 dark:border-slate-800 shadow-sm">
                                                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Exige Senha do Prestador</span>
                                                        <div className={\`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full \${tecnoSpeedCityInfo.senha ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}\`}>
                                                            {tecnoSpeedCityInfo.senha ? <AlertCircle size={10} /> : <Check size={10} />}
                                                            {tecnoSpeedCityInfo.senha ? 'Necessário' : 'Não exigido'}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100/60 dark:border-slate-800 shadow-sm">
                                                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">NFS-e Nacional Homologação</span>
                                                        <div className={\`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full \${tecnoSpeedCityInfo.padraoNacional?.homologacao ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-655 dark:bg-red-900/20 dark:text-red-400'}\`}>
                                                            {tecnoSpeedCityInfo.padraoNacional?.homologacao ? <Check size={10} /> : <X size={10} />}
                                                            {tecnoSpeedCityInfo.padraoNacional?.homologacao ? 'Disponível' : 'Indisponível'}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100/60 dark:border-slate-800 shadow-sm">
                                                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">NFS-e Nacional Produção</span>
                                                        <div className={\`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full \${tecnoSpeedCityInfo.padraoNacional?.producao ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-655 dark:bg-red-900/20 dark:text-red-400'}\`}>
                                                            {tecnoSpeedCityInfo.padraoNacional?.producao ? <Check size={10} /> : <X size={10} />}
                                                            {tecnoSpeedCityInfo.padraoNacional?.producao ? 'Disponível' : 'Indisponível'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}`;

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
                                            {/* Detalhes do Município (Lado Esquerdo) */}
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex justify-between items-start w-full gap-4">
                                                        {/* Cidade */}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-wider">
                                                                Cidade <Info size={10} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                                            </span>
                                                            <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5 truncate">
                                                                {tecnoSpeedCityInfo.nome || selectedSearchCity?.nome || ('Código ' + (tecnoSpeedCityInfo.codigoIbge || tecnoSpeedCityInfo.ibge))}
                                                            </span>
                                                        </div>
                                                        {/* UF */}
                                                        <div className="flex flex-col items-end shrink-0">
                                                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">
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
                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal">Layout de integração</span>
                                                        <span className="text-[10px] font-extrabold text-gray-850 dark:text-slate-300 mt-0.5 truncate">
                                                            {tecnoSpeedCityInfo.padraoNacional?.producao || tecnoSpeedCityInfo.padraoNacional?.homologacao ? 'NFS-e Nacional' : 'WebService'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal">Padrão</span>
                                                        {tecnoSpeedCityInfo.padrao ? (
                                                            <a 
                                                                href="https://docs.plugnotas.com.br/docs/provedores-homologados" 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-[10px] font-extrabold text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 mt-0.5 flex items-center gap-0.5 transition-colors truncate"
                                                            >
                                                                <ExternalLink size={9} className="shrink-0" />
                                                                {tecnoSpeedCityInfo.padrao}
                                                            </a>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-gray-755 dark:text-gray-300 mt-0.5">Não informado</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal">Código IBGE</span>
                                                        <span className="text-[10px] font-extrabold text-gray-855 dark:text-slate-300 mt-0.5 font-mono truncate">
                                                            {tecnoSpeedCityInfo.codigoIbge || tecnoSpeedCityInfo.ibge || selectedSearchCity?.id}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Dados obrigatórios */}
                                                <div className="flex flex-col pt-1">
                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-widest">
                                                        Dados obrigatórios das notas tomadas <Info size={9} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                                    </span>
                                                    <span className={\`text-[10px] font-extrabold mt-0.5 leading-relaxed truncate \${
                                                        formatDadosObrigatorios(tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas) === "Consulta não disponível"
                                                            ? 'text-gray-400 dark:text-slate-500 font-medium'
                                                            : 'text-gray-800 dark:text-slate-350'
                                                    }\`}>
                                                        {formatDadosObrigatorios(tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Checklist de Recursos & Requisitos (Lado Direito) */}
                                            <div className="p-5 bg-gray-50/50 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-4">
                                                <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-normal">Requisitos e Recursos Homologados</h5>
                                                
                                                <hr className="border-gray-100 dark:border-slate-800/80 my-1" />

                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-4">
                                                    {/* Item 1: Notas tomadas */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {!!tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas && formatDadosObrigatorios(tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas) !== "Consulta não disponível" ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm">
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
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm">
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
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm">
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
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm">
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
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm">
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

if (!content.includes(targetSingleCard)) {
    console.error("ERRO: Não encontrou o targetSingleCard no arquivo!");
    process.exit(1);
}
content = content.replace(targetSingleCard, replacementSingleCard);

// --- BLOCK 4: MODAL CARD ---
const targetModalCard = `                                            <div 
                                                key={city.id}
                                                className={\`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 flex flex-col justify-between group \${
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
                                                    <div className="flex justify-between items-start">
                                                        {/* Cidade */}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-wider">
                                                                Cidade <Info size={10} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                                            </span>
                                                            <span className="text-xs font-black text-gray-900 dark:text-white mt-0.5 truncate" title={city.nome}>
                                                                {city.nome}
                                                            </span>
                                                        </div>
                                                        {/* UF */}
                                                        <div className="flex flex-col items-end shrink-0">
                                                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                                                UF
                                                            </span>
                                                            <span className="text-xs font-black text-gray-900 dark:text-white mt-0.5">
                                                                {searchUf}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Conteúdo Técnico */}
                                                    {isVerified ? (
                                                        <div className="mt-4 space-y-3.5 animate-in fade-in duration-200">
                                                            {/* Três colunas técnicas: Layout, Padrão, Código IBGE */}
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal">Layout de integração</span>
                                                                    <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 truncate">
                                                                        {cityInfo?.padraoNacional?.producao || cityInfo?.padraoNacional?.homologacao ? 'NFS-e Nacional' : 'WebService'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal">Padrão</span>
                                                                    {cityInfo?.padrao ? (
                                                                        <a 
                                                                            href="https://docs.plugnotas.com.br/docs/provedores-homologados" 
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
                                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal">Código IBGE</span>
                                                                    <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 font-mono truncate">
                                                                        {city.id}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Dados obrigatórios */}
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-widest">
                                                                    Dados obrigatórios das notas tomadas <Info size={9} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                                                </span>
                                                                <span className={\`text-[10px] font-extrabold mt-0.5 leading-relaxed truncate \${
                                                                    formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas) === "Consulta não disponível"
                                                                        ? 'text-gray-400 dark:text-slate-500 font-medium'
                                                                        : 'text-gray-800 dark:text-slate-355'
                                                                }\`}>
                                                                    {formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas)}
                                                                </span>
                                                            </div>

                                                            <hr className="border-gray-100 dark:border-slate-800/80 my-1" />

                                                            {/* Checklist de requisitos (Grid de 3 Colunas) */}
                                                            <div className="grid grid-cols-3 gap-x-2 gap-y-3">
                                                                {/* Item 1: Notas tomadas */}
                                                                <div className="flex items-center gap-1 min-w-0">
                                                                    {!!cityInfo?.dadosObrigatoriosNotasTomadas && formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas) !== "Consulta não disponível" ? (
                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-3.5 h-3.5 shadow-sm">
                                                                            <Check size={8} strokeWidth={4} />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-3.5 h-3.5 shadow-sm">
                                                                            <X size={8} strokeWidth={4} />
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                        Notas tomadas <Info size={8} className="text-gray-400 shrink-0" />
                                                                    </span>
                                                                </div>

                                                                {/* Item 2: Login */}
                                                                <div className="flex items-center gap-1 min-w-0">
                                                                    {cityInfo?.login ? (
                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-3.5 h-3.5 shadow-sm">
                                                                            <Check size={8} strokeWidth={4} />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-3.5 h-3.5 shadow-sm">
                                                                            <X size={8} strokeWidth={4} />
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                        Login <Info size={8} className="text-gray-400 shrink-0" />
                                                                    </span>
                                                                </div>

                                                                {/* Item 3: Senha */}
                                                                <div className="flex items-center gap-1 min-w-0">
                                                                    {cityInfo?.senha ? (
                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-3.5 h-3.5 shadow-sm">
                                                                            <Check size={8} strokeWidth={4} />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-3.5 h-3.5 shadow-sm">
                                                                            <X size={8} strokeWidth={4} />
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                        Senha <Info size={8} className="text-gray-400 shrink-0" />
                                                                    </span>
                                                                </div>

                                                                {/* Item 4: Múltiplos serviços */}
                                                                <div className="flex items-center gap-1 min-w-0">
                                                                    {cityInfo?.multiservicos ? (
                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-3.5 h-3.5 shadow-sm">
                                                                            <Check size={8} strokeWidth={4} />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-3.5 h-3.5 shadow-sm">
                                                                            <X size={8} strokeWidth={4} />
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                        Múltiplos serviços <Info size={8} className="text-gray-400 shrink-0" />
                                                                    </span>
                                                                </div>

                                                                {/* Item 5: Certificado */}
                                                                <div className="flex items-center gap-1 min-w-0">
                                                                    {!cityInfo?.certificado ? (
                                                                        <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-3.5 h-3.5 shadow-sm">
                                                                            <Check size={8} strokeWidth={4} />
                                                                        </span>
                                                                    ) : (
                                                                        <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-3.5 h-3.5 shadow-sm">
                                                                            <X size={8} strokeWidth={4} />
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                        Certificado <Info size={8} className="text-gray-400 shrink-0" />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="py-8 flex flex-col items-center justify-center text-center bg-gray-50 dark:bg-slate-850/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-800 mt-4">
                                                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Aguardando verificação</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>`;

// Para achar a div interna do modal card, vamos fazer um replace cirúrgico no arquivo.
// O target do modal card é o container completo da div do city card.
// Vamos ler o conteúdo atual (que já tem o bloco do modal card com o estilo antigo mas sem a nossa modificação corrompida).
const cleanModalCardBodyStr = `                                            <div 
                                                key={city.id}
                                                className={\`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 flex flex-col justify-between group \${
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
                                                    <div className="flex justify-between items-start">
                                                        {/* Cidade */}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-wider">
                                                                Cidade <Info size={10} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                                            </span>
                                                            <span className="text-xs font-black text-gray-900 dark:text-white mt-0.5 truncate" title={city.nome}>
                                                                {city.nome}
                                                            </span>
                                                        </div>
                                                        {/* UF */}
                                                        <div className="flex flex-col items-end shrink-0">
                                                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                                                UF
                                                            </span>
                                                            <span className="text-xs font-black text-gray-900 dark:text-white mt-0.5">
                                                                {searchUf}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Conteúdo Técnico */}
                                                    {isVerified ? (
                                                        <div className="mt-4 space-y-3.5 animate-in fade-in duration-200">
                                                            {/* Três colunas técnicas: Layout, Padrão, Código IBGE */}
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal">Layout de integração</span>
                                                                    <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 truncate">
                                                                        {cityInfo?.padraoNacional?.producao || cityInfo?.padraoNacional?.homologacao ? 'NFS-e Nacional' : 'WebService'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal">Padrão</span>
                                                                    {cityInfo?.padrao ? (
                                                                        <a 
                                                                            href="https://docs.plugnotas.com.br/docs/provedores-homologados" 
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
                                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal">Código IBGE</span>
                                                                    <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 font-mono truncate">
                                                                        {city.id}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Dados obrigatórios */}
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-widest">
                                                                    Dados obrigatórios das notas tomadas <Info size={9} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                                                </span>
                                                                <span className={\`text-[10px] font-extrabold mt-0.5 leading-relaxed truncate \${
                                                                    formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas) === "Consulta não disponível"
                                                                        ? 'text-gray-400 dark:text-slate-500 font-medium'
                                                                        : 'text-gray-800 dark:text-slate-355'
                                                                }\`}>
                                                                    {formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas)}
                                                                </span>
                                                            </div>

                                                            <hr className="border-gray-100 dark:border-slate-800/80 my-1" />

                                                            {/* Checklist de requisitos rápidos */}
                                                            <div className="flex flex-wrap gap-1 mt-2.5">
                                                                <span className={\`inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md \${
                                                                    cityInfo?.certificado ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100/30' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100/30'
                                                                }\`}>
                                                                    Certificado: {cityInfo?.certificado ? 'Exigido' : 'Isento'}
                                                                </span>
                                                                <span className={\`inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md \${
                                                                    cityInfo?.multiservicos ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100/30' : 'bg-rose-50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-400 border border-rose-100/30'
                                                                }\`}>
                                                                    Múltiplos Serviços: {cityInfo?.multiservicos ? 'Sim' : 'Não'}
                                                                </span>
                                                                <span className={\`inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md \${
                                                                    cityInfo?.login ? 'bg-amber-50 dark:bg-amber-955/30 text-amber-600 dark:text-amber-400 border border-amber-100/30' : 'bg-emerald-50 dark:bg-emerald-955/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100/30'
                                                                }\`}>
                                                                    Login: {cityInfo?.login ? 'Exigido' : 'Isento'}
                                                                </span>
                                                                <span className={\`inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md \${
                                                                    cityInfo?.senha ? 'bg-amber-50 dark:bg-amber-955/30 text-amber-600 dark:text-amber-400 border border-amber-100/30' : 'bg-emerald-50 dark:bg-emerald-955/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100/30'
                                                                }\`}>
                                                                    Senha: {cityInfo?.senha ? 'Exigido' : 'Isento'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="py-8 flex flex-col items-center justify-center text-center bg-gray-50 dark:bg-slate-850/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-800 mt-4">
                                                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Aguardando verificação</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>`;

if (!content.includes(cleanModalCardBodyStr)) {
    // Caso a nossa substituição anterior já tenha modificado um pouco, vamos testar o target
    console.error("ERRO: Não encontrou o targetModalCard no arquivo!");
    process.exit(1);
}

content = content.replace(cleanModalCardBodyStr, targetModalCard);

fs.writeFileSync(filePath, content, 'utf8');
console.log("SUCESSO: As duas visualizações dos cards foram estilizadas com o visual do mockup do usuário com 100% de sucesso!");

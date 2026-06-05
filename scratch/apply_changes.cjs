const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'settings', 'FiscalSettings.tsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// --- BLOCK 1: STATE VARIABLES ---
const target1 = `    const [searchingCityTecnoSpeed, setSearchingCityTecnoSpeed] = useState(false);
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
    const cityDropdownRef = useRef<HTMLDivElement>(null);
    const prevUfRef = useRef<string>(searchUf);`;

const replacement1 = `    const [searchingCityTecnoSpeed, setSearchingCityTecnoSpeed] = useState(false);
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
    const cityDropdownRef = useRef<HTMLDivElement>(null);
    const prevUfRef = useRef<string>(searchUf);

    // Estado e campos adicionais para as novas opções de busca (Mockup do usuário)
    const [searchMode, setSearchMode] = useState<'name' | 'ibge' | 'uf'>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(\`fiscal_searchMode_\${currentEntity.id}\`) : null;
        return (saved as 'name' | 'ibge' | 'uf') || 'name';
    });
    const [searchIbgeQuery, setSearchIbgeQuery] = useState(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(\`fiscal_searchIbgeQuery_\${currentEntity.id}\`) : null;
        return saved || '';
    });
    
    // Estados do Modal de visualização completa do Estado (UF)
    const [isStateModalOpen, setIsStateModalOpen] = useState(false);
    const [stateCitiesStatus, setStateCitiesStatus] = useState<Record<string, { loading: boolean; error?: string; data?: any; isNotHomologated?: boolean }>>({});
    const [verifyingAllStateCities, setVerifyingAllStateCities] = useState(false);
    const [verificationProgress, setVerificationProgress] = useState({ current: 0, total: 0 });
    const [stateModalFilterQuery, setStateModalFilterQuery] = useState('');

    useEffect(() => {
        if (!currentEntity.id) return;
        sessionStorage.setItem(\`fiscal_searchMode_\${currentEntity.id}\`, searchMode);
    }, [searchMode, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        sessionStorage.setItem(\`fiscal_searchIbgeQuery_\${currentEntity.id}\`, searchIbgeQuery);
    }, [searchIbgeQuery, currentEntity.id]);

    // Filtrar municípios no modal estadual
    const filteredStateCities = useMemo(() => {
        if (!stateModalFilterQuery.trim()) return citiesList;
        const cleanString = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim();
        const target = cleanString(stateModalFilterQuery);
        return citiesList.filter(c => 
            cleanString(c.nome).includes(target) || 
            c.id.includes(target)
        );
    }, [citiesList, stateModalFilterQuery]);

    // Consultar cidade na TecnoSpeed usando o código IBGE diretamente
    const handleSearchCityByIbge = async (ibgeCode: string) => {
        if (!ibgeCode || ibgeCode.length !== 7) return;
        setSearchingCityTecnoSpeed(true);
        setTecnoSpeedCityInfo(null);
        setCityNotHomologatedMessage(null);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = await fiscalService.consultarCidadeNotaNacional(ibgeCode, currentEntity.id!, token);
            setTecnoSpeedCityInfo(result.data || result);
        } catch (err: any) {
            console.error('Erro ao consultar cidade por IBGE na TecnoSpeed:', err);
            const nestedError = extractTecnoSpeedError(err);
            
            if (nestedError && nestedError.data) {
                setTecnoSpeedCityInfo(nestedError.data);
                setCityNotHomologatedMessage(nestedError.message || 'Município não homologado na TecnoSpeed no momento.');
            } else {
                setResultModal({
                    isOpen: true,
                    title: 'Erro na Consulta por IBGE',
                    message: nestedError.message || 'Não foi possível obter os dados da cidade consultada.',
                    type: 'error',
                    data: nestedError.data ? {
                        'Dados Técnicos': nestedError.data
                    } : undefined
                });
            }
        } finally {
            setSearchingCityTecnoSpeed(false);
        }
    };

    // Verificar requisitos de uma única cidade dentro do Modal Estadual
    const handleVerifySingleCityInState = async (cityId: string, cityName: string) => {
        setStateCitiesStatus(prev => ({
            ...prev,
            [cityId]: { loading: true }
        }));
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = await fiscalService.consultarCidadeNotaNacional(cityId, currentEntity.id!, token);
            const data = result.data || result;
            setStateCitiesStatus(prev => ({
                ...prev,
                [cityId]: { loading: false, data, isNotHomologated: false }
            }));
        } catch (err: any) {
            console.error(\`Erro ao consultar \${cityName} no estado:\`, err);
            const nestedError = extractTecnoSpeedError(err);
            if (nestedError && nestedError.data) {
                setStateCitiesStatus(prev => ({
                    ...prev,
                    [cityId]: { 
                        loading: false, 
                        data: nestedError.data, 
                        isNotHomologated: true,
                        error: nestedError.message || 'Município não homologado'
                    }
                }));
            } else {
                setStateCitiesStatus(prev => ({
                    ...prev,
                    [cityId]: { 
                        loading: false, 
                        error: nestedError.message || 'Erro de conexão'
                    }
                }));
            }
        }
    };

    // Verificar todas as cidades do estado em lote, com delay de 80ms (Throttling contra rate limits)
    const handleVerifyAllStateCities = async () => {
        if (citiesList.length === 0 || verifyingAllStateCities) return;
        
        setVerifyingAllStateCities(true);
        setVerificationProgress({ current: 0, total: citiesList.length });
        
        const citiesToVerify = [...citiesList];
        
        let token = '';
        try {
            const session = await supabase.auth.getSession();
            token = session.data.session?.access_token || '';
        } catch (err) {
            console.error('Erro ao obter sessão para verificação em lote:', err);
        }

        if (!token) {
            setResultModal({
                isOpen: true,
                title: 'Erro na Sessão',
                message: 'Sessão expirada. Por favor, recarregue a página e tente novamente.',
                type: 'error'
            });
            setVerifyingAllStateCities(false);
            return;
        }

        // Loop sequencial com throttle
        for (let i = 0; i < citiesToVerify.length; i++) {
            let isStillVerifying = false;
            setVerifyingAllStateCities(prev => {
                isStillVerifying = prev;
                return prev;
            });
            if (!isStillVerifying) {
                break;
            }

            const city = citiesToVerify[i];
            
            const currentStatus = stateCitiesStatus[city.id];
            if (currentStatus && currentStatus.data && !currentStatus.error) {
                setVerificationProgress(prev => ({ ...prev, current: i + 1 }));
                continue;
            }

            setStateCitiesStatus(prev => ({
                ...prev,
                [city.id]: { loading: true }
            }));

            try {
                const result = await fiscalService.consultarCidadeNotaNacional(city.id, currentEntity.id!, token);
                const data = result.data || result;
                setStateCitiesStatus(prev => ({
                    ...prev,
                    [city.id]: { loading: false, data, isNotHomologated: false }
                }));
            } catch (err: any) {
                const nestedError = extractTecnoSpeedError(err);
                if (nestedError && nestedError.data) {
                    setStateCitiesStatus(prev => ({
                        ...prev,
                        [city.id]: { 
                            loading: false, 
                            data: nestedError.data, 
                            isNotHomologated: true,
                            error: nestedError.message || 'Município não homologado'
                        }
                    }));
                } else {
                    setStateCitiesStatus(prev => ({
                        ...prev,
                        [city.id]: { 
                            loading: false, 
                            error: nestedError.message || 'Erro de conexão'
                        }
                    }));
                }
            }

            setVerificationProgress(prev => ({ ...prev, current: i + 1 }));
            await new Promise(resolve => setTimeout(resolve, 80));
        }

        setVerifyingAllStateCities(false);
    };`;

if (!content.includes(target1)) {
    console.error('ERRO: Não encontrou o target1 no arquivo!');
    process.exit(1);
}
content = content.replace(target1, replacement1);

// --- BLOCK 2: THE SEARCH PANEL ---
// Localizar o comentário do inicio da ferramenta de homologação
const panelStartStr = `                            {/* Ferramenta de Homologação de Cidades TecnoSpeed */}`;
// Localizar a div que vem logo após a ferramenta
const panelEndStr = `                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800">`;

const startIndex = content.indexOf(panelStartStr);
const endIndex = content.indexOf(panelEndStr);

if (startIndex === -1 || endIndex === -1) {
    console.error('ERRO: Não encontrou o bloco da ferramenta de homologação!');
    process.exit(1);
}

// O trecho a ser substituído começa em startIndex e termina em endIndex
const oldPanelBlock = content.substring(startIndex, endIndex);

const newPanelBlock = `                            {/* Ferramenta de Homologação de Cidades TecnoSpeed */}
                            <div className="p-6 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 dark:from-slate-900/50 dark:via-slate-900/40 dark:to-purple-955/5 rounded-2xl border border-gray-200/85 dark:border-slate-800 shadow-sm space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
                                            <Search size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">Ferramenta de Cobertura e Homologação</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Verifique a homologação e requisitos fiscais de qualquer cidade do Brasil na TecnoSpeed.</p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-150/40 shrink-0">
                                        2.226 Cidades & 152 Padrões
                                    </span>
                                </div>

                                {/* Dropdown de Seleção de Tipo de Busca (como no mockup do usuário) */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo de Pesquisa</label>
                                        <select
                                            value={searchMode}
                                            onChange={(e) => {
                                                setSearchMode(e.target.value as 'name' | 'ibge' | 'uf');
                                                setTecnoSpeedCityInfo(null);
                                                setCityNotHomologatedMessage(null);
                                            }}
                                            className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 shadow-sm cursor-pointer"
                                        >
                                            <option value="name">Buscar cidades por nome</option>
                                            <option value="ibge">Buscar cidades por código IBGE</option>
                                            <option value="uf">Buscar cidades por UF</option>
                                        </select>
                                    </div>

                                    {/* Inputs contextuais baseados na escolha do usuário */}
                                    {searchMode === 'name' && (
                                        <>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estado (UF)</label>
                                                <select
                                                    value={searchUf}
                                                    onChange={(e) => setSearchUf(e.target.value)}
                                                    className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 shadow-sm cursor-pointer"
                                                >
                                                    {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                                                        <option key={uf} value={uf}>{uf}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1.5 relative" ref={cityDropdownRef}>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cidade</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder={loadingCitiesList ? 'Carregando cidades...' : 'Digite para buscar a cidade...'}
                                                        value={searchCityQuery}
                                                        onChange={(e) => {
                                                            setSearchCityQuery(e.target.value);
                                                            setIsCityDropdownOpen(true);
                                                            const exactMatch = citiesList.find(c => c.nome.toLowerCase() === e.target.value.toLowerCase());
                                                            if (exactMatch) {
                                                                setSelectedSearchCity(exactMatch);
                                                            } else {
                                                                setSelectedSearchCity(null);
                                                            }
                                                            setTecnoSpeedCityInfo(null);
                                                        }}
                                                        onFocus={() => setIsCityDropdownOpen(true)}
                                                        disabled={loadingCitiesList}
                                                        className="w-full h-11 pl-4 pr-10 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-all shadow-sm"
                                                        autoComplete="off"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                        {searchCityQuery && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSearchCityQuery('');
                                                                    setSelectedSearchCity(null);
                                                                    setTecnoSpeedCityInfo(null);
                                                                }}
                                                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                                                            disabled={loadingCitiesList}
                                                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                                        >
                                                            <ChevronRight size={16} className={\`transform transition-transform duration-200 \${isCityDropdownOpen ? '-rotate-90' : 'rotate-90'}\`} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {isCityDropdownOpen && filteredCities.length > 0 && (
                                                    <div className="absolute left-0 right-0 top-[102%] z-50 max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl scrollbar-thin animate-in fade-in slide-in-from-top-1 duration-150">
                                                        {filteredCities.map((c) => (
                                                            <button
                                                                key={c.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedSearchCity(c);
                                                                    setSearchCityQuery(c.nome);
                                                                    setTecnoSpeedCityInfo(null);
                                                                    setIsCityDropdownOpen(false);
                                                                }}
                                                                className={\`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between \${selectedSearchCity?.id === c.id ? 'bg-indigo-50/50 dark:bg-slate-700/30 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}\`}
                                                            >
                                                                <span>{c.nome}</span>
                                                                {selectedSearchCity?.id === c.id && <Check size={12} className="text-indigo-600 dark:text-indigo-400" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {searchMode === 'ibge' && (
                                        <div className="flex flex-col gap-1.5 md:col-span-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Código IBGE (7 dígitos)</label>
                                            <input
                                                type="text"
                                                maxLength={7}
                                                placeholder="Digite o código IBGE de 7 dígitos... Ex: 2400208"
                                                value={searchIbgeQuery}
                                                onChange={(e) => setSearchIbgeQuery(e.target.value.replace(/\\D/g, ''))}
                                                className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 tracking-wider shadow-sm text-gray-700 dark:text-gray-300"
                                            />
                                        </div>
                                    )}

                                    {searchMode === 'uf' && (
                                        <>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estado (UF)</label>
                                                <select
                                                    value={searchUf}
                                                    onChange={(e) => setSearchUf(e.target.value)}
                                                    className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 shadow-sm cursor-pointer"
                                                >
                                                    {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                                                        <option key={uf} value={uf}>{uf}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex items-center h-11">
                                                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 font-medium">
                                                    Total no Estado: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{citiesList.length} cidades</strong>
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Botão de Busca Contextual */}
                                <div className="flex justify-end pt-1">
                                    {searchMode === 'name' && (
                                        <Button
                                            type="button"
                                            onClick={handleSearchCityTecnoSpeed}
                                            disabled={!selectedSearchCity || searchingCityTecnoSpeed}
                                            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/10 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                                        >
                                            {searchingCityTecnoSpeed ? (
                                                <RefreshCw size={14} className="animate-spin text-white" />
                                            ) : (
                                                <Search size={14} className="text-white" />
                                            )}
                                            Buscar Cidade
                                        </Button>
                                    )}

                                    {searchMode === 'ibge' && (
                                        <Button
                                            type="button"
                                            onClick={() => handleSearchCityByIbge(searchIbgeQuery)}
                                            disabled={searchIbgeQuery.length !== 7 || searchingCityTecnoSpeed}
                                            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/10 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                                        >
                                            {searchingCityTecnoSpeed ? (
                                                <RefreshCw size={14} className="animate-spin text-white" />
                                            ) : (
                                                <Search size={14} className="text-white" />
                                            )}
                                            Buscar por IBGE
                                        </Button>
                                    )}

                                    {searchMode === 'uf' && (
                                        <Button
                                            type="button"
                                            onClick={() => setIsStateModalOpen(true)}
                                            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-500/10 transition-all active:scale-95"
                                        >
                                            <Globe size={16} />
                                            Visualizar Cobertura Estadual ({searchUf})
                                        </Button>
                                    )}
                                </div>

                                {/* Card de Resultado para Nome ou IBGE */}
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
                                )}
                            </div>
`;

content = content.replace(oldPanelBlock, newPanelBlock);

// --- BLOCK 3: THE STATE COVERAGE MODAL ---
const target3 = `            {/* Modal de Resultado */}
            <ResultModal`;

const replacement3 = `            {/* Modal de Cobertura e Homologações por Estado (UF) */}
            {isStateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        
                        {/* Header do Modal */}
                        <div className="p-6 border-b border-gray-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <span className="p-1.5 bg-indigo-100 dark:bg-indigo-955 text-indigo-650 dark:text-indigo-400 rounded-xl">
                                        <Globe size={18} />
                                    </span>
                                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
                                        Diretório de Cobertura do Estado: <span className="text-indigo-600 dark:text-indigo-400 font-black">{searchUf}</span>
                                    </h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30">
                                        {citiesList.length} Municípios
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Consulte e gerencie a homologação fiscal de todas as cidades do estado em lote ou individualmente.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    onClick={handleVerifyAllStateCities}
                                    disabled={verifyingAllStateCities || citiesList.length === 0}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-indigo-500/10 flex items-center gap-1.5"
                                >
                                    {verifyingAllStateCities ? (
                                        <RefreshCw size={14} className="animate-spin" />
                                    ) : (
                                        <Check size={14} />
                                    )}
                                    {verifyingAllStateCities 
                                        ? \`Verificando (\${verificationProgress.current}/\${verificationProgress.total})\`
                                        : 'Verificar Todos os Municípios'
                                    }
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (verifyingAllStateCities) {
                                            if (confirm('Deseja interromper a verificação em lote?')) {
                                                setVerifyingAllStateCities(false);
                                            } else {
                                                return;
                                            }
                                        }
                                        setIsStateModalOpen(false);
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Barra de Progresso Encorpada para Verificação em Lote */}
                        {verifyingAllStateCities && (
                            <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border-b border-indigo-100/30 dark:border-indigo-950/20 px-6 py-2.5 flex items-center justify-between gap-4 animate-in slide-in-from-top-1">
                                <div className="flex-1">
                                    <div className="flex justify-between text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                                        <span>Processando homologações em lote...</span>
                                        <span>{Math.round((verificationProgress.current / verificationProgress.total) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-indigo-600 h-full rounded-full transition-all duration-150"
                                            style={{ width: \`\${(verificationProgress.current / verificationProgress.total) * 100}%\` }}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setVerifyingAllStateCities(false)}
                                    className="px-3 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-extrabold text-rose-600 hover:text-rose-700 active:scale-95 transition-all shadow-sm shrink-0"
                                >
                                    Parar lote
                                </button>
                            </div>
                        )}

                        {/* Filtros Internos do Modal */}
                        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center gap-3">
                            <div className="relative flex-1 max-w-md">
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Filtrar municípios por nome ou código IBGE..."
                                    value={stateModalFilterQuery}
                                    onChange={(e) => setStateModalFilterQuery(e.target.value)}
                                    className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-955/20 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 transition-all shadow-inner"
                                />
                                {stateModalFilterQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setStateModalFilterQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-auto">
                                Exibindo {filteredStateCities.length} de {citiesList.length} cidades
                            </span>
                        </div>

                        {/* Corpo Scrollable com Grid de Cidades */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-slate-950/10 scrollbar-thin">
                            {filteredStateCities.length === 0 ? (
                                <div className="py-20 flex flex-col justify-center items-center text-center">
                                    <Search size={32} className="text-gray-300 dark:text-slate-700 mb-3" />
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Nenhuma cidade encontrada</p>
                                    <p className="text-xs text-gray-400 mt-1">Tente ajustar sua busca por nome ou código IBGE.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredStateCities.map((city) => {
                                        const status = stateCitiesStatus[city.id];
                                        const isVerified = !!status && !status.loading && (!!status.data || !!status.error);
                                        const notHomologated = !!status && !!status.isNotHomologated;
                                        const cityInfo = status?.data;

                                        return (
                                            <div 
                                                key={city.id}
                                                className={\`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 flex flex-col justify-between group \${
                                                    status?.loading 
                                                        ? 'border-indigo-300 dark:border-indigo-900 ring-2 ring-indigo-500/10 bg-indigo-50/5 dark:bg-indigo-950/5 animate-pulse' 
                                                        : isVerified && notHomologated
                                                            ? 'border-rose-200 dark:border-rose-955/40 hover:border-rose-300 dark:hover:border-rose-955/60 shadow-sm shadow-rose-500/5'
                                                            : isVerified
                                                                ? 'border-emerald-250 dark:border-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-950/60 shadow-sm shadow-emerald-500/5'
                                                                : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-md'
                                                }\`}
                                            >
                                                {/* Topo do Card */}
                                                <div>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <h5 className="text-xs font-black text-gray-900 dark:text-white truncate" title={city.nome}>
                                                                {city.nome}
                                                            </h5>
                                                            <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 font-mono">
                                                                IBGE: {city.id}
                                                            </span>
                                                        </div>

                                                        {/* Status Badge */}
                                                        {status?.loading ? (
                                                            <span className="inline-flex items-center gap-1 text-[8px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-955 px-1.5 py-0.5 rounded-md border border-indigo-100/30">
                                                                <RefreshCw size={8} className="animate-spin" />
                                                                Consultando
                                                            </span>
                                                        ) : isVerified && notHomologated ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-rose-600 dark:text-rose-455 bg-rose-50 dark:bg-rose-955/30 px-1.5 py-0.5 rounded-md border border-rose-100/30">
                                                                <X size={8} />
                                                                Indisponível
                                                            </span>
                                                        ) : isVerified ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-md border border-emerald-100/30">
                                                                <Check size={8} />
                                                                Homologado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-850 px-1.5 py-0.5 rounded-md border border-gray-150/40">
                                                                Não verificado
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Conteúdo Técnico */}
                                                    {isVerified ? (
                                                        <div className="mt-3 space-y-2.5 animate-in fade-in duration-200">
                                                            {/* Provedor e layout */}
                                                            <div className="flex items-center justify-between gap-2 text-[9px] font-semibold text-gray-500 dark:text-gray-400">
                                                                <span>Padrão/Provedor:</span>
                                                                <span className="font-bold text-gray-700 dark:text-gray-300 font-mono truncate max-w-[120px]">
                                                                    {cityInfo?.padrao || 'Não informado'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2 text-[9px] font-semibold text-gray-500 dark:text-gray-400">
                                                                <span>Tipo de Layout:</span>
                                                                <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[150px]">
                                                                    {cityInfo?.padraoNacional?.producao || cityInfo?.padraoNacional?.homologacao
                                                                        ? 'NFS-e Nacional'
                                                                        : 'WebService Municipal'}
                                                                </span>
                                                            </div>

                                                            {/* Checklist de requisitos rápidos */}
                                                            <div className="flex flex-wrap gap-1 mt-2.5">
                                                                <span className={\`inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md \${
                                                                    cityInfo?.certificado ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100/30' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100/30'
                                                                }\`}>
                                                                    Certificado: {cityInfo?.certificado ? 'Exigido' : 'Isento'}
                                                                </span>
                                                                <span className={\`inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md \${
                                                                    cityInfo?.multiservicos ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100/30' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100/30'
                                                                }\`}>
                                                                    Múltiplos Serviços: {cityInfo?.multiservicos ? 'Sim' : 'Não'}
                                                                </span>
                                                                <span className={\`inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md \${
                                                                    cityInfo?.login ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100/30' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100/30'
                                                                }\`}>
                                                                    Login: {cityInfo?.login ? 'Exigido' : 'Isento'}
                                                                </span>
                                                                <span className={\`inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md \${
                                                                    cityInfo?.senha ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100/30' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 border border-emerald-100/30'
                                                                }\`}>
                                                                    Senha: {cityInfo?.senha ? 'Exigido' : 'Isento'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="py-2.5 flex items-center justify-center text-center bg-gray-50 dark:bg-slate-850/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-800 mt-3">
                                                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">Aguardando consulta de requisitos</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Ações do Card */}
                                                <div className="mt-4 pt-3.5 border-t border-gray-100 dark:border-slate-805 flex items-center justify-between gap-2">
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
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="p-4 border-t border-gray-150 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                            <span>Diretório de Cobertura Fiscal Antigravity</span>
                            <span>TecnoSpeed PlugNotas</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Resultado */}
            <ResultModal`;

if (!content.includes(target3)) {
    console.error('ERRO: Não encontrou o target3 no arquivo!');
    process.exit(1);
}
content = content.replace(target3, replacement3);

fs.writeFileSync(filePath, content, 'utf8');
console.log('SUCESSO: Todas as alterações foram aplicadas cirurgicamente e com precisão!');

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Wrench, Wand2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { TextArea } from '../ui/TextArea';
import { Modal } from '../ui/Modal';
import { useCompanies } from '../../hooks/useCompanies';
import { useEntity } from '../../context/EntityContext';
import type { Service } from '../../hooks/useServices';
import { useAutoSave } from '../../hooks/useAutoSave';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';

interface ServiceFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Service | null;
}

export function ServiceForm({ isOpen, onClose, onSubmit, initialData }: ServiceFormProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState(0);
    const [unit, setUnit] = useState('');
    const [showInPdf, setShowInPdf] = useState(true);
    const [loading, setLoading] = useState(false);
    const [munCode, setMunCode] = useState('');
    const [lcItem, setLcItem] = useState('');
    const [isLoyalty, setIsLoyalty] = useState(false);
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    const { currentEntity } = useEntity();
    const { companies } = useCompanies();
    const { notify } = useNotification();
    const currentCompany = companies.find(c => c.id === currentEntity.id);
    const isFiscalEnabled = currentEntity.type === 'company' && currentCompany?.fiscal_module_enabled;

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setDescription(initialData.description || '');
            setPrice(initialData.price);
            setUnit(initialData.unit || '');
            setShowInPdf(initialData.show_in_pdf !== false);
            setMunCode(initialData.codigo_servico_municipal || '');
            setLcItem(initialData.item_lista_servico || '');
            setIsLoyalty(initialData.is_loyalty || false);
        } else {
            setName('');
            setDescription('');
            setPrice(0);
            setUnit('');
            setShowInPdf(true);
            setMunCode('');
            setLcItem('');
            setIsLoyalty(false);
        }
    }, [initialData, isOpen]);

    const { clearCache } = useAutoSave(
        'service_form',
        { name, description, price, unit, showInPdf, munCode, lcItem },
        {
            name: setName, description: setDescription, price: setPrice,
            unit: setUnit, showInPdf: setShowInPdf, munCode: setMunCode,
            lcItem: setLcItem,
            isLoyalty: setIsLoyalty
        },
        !initialData,
        isOpen
    );

    const handleClose = () => {
        clearCache();
        onClose();
    };

    const handleGenerateDescription = async () => {
        if (!name) {
            notify('warning', 'Digite o nome do serviço primeiro para a IA gerar a descrição.', 'Atenção');
            return;
        }
        
        setIsGeneratingDesc(true);
        try {
            const prompt = `Crie uma descrição comercial atrativa e direta para o seguinte serviço: "${name}".
Regras: No máximo 2 frases curtas, tom profissional, foque no benefício para o cliente e não use aspas nem introduções.`;

            const { data, error } = await supabase.functions.invoke('social-copilot-magic', {
                body: { 
                    company_id: currentEntity.id, 
                    mode: 'landing_plan_magic', 
                    topic: prompt 
                }
            });

            if (error) throw error;
            if (data?.template) {
                setDescription(data.template.replace(/^["']|["']$/g, '').trim());
                notify('success', 'Descrição gerada com sucesso!', 'IA Mágica');
            } else {
                throw new Error("Nenhum texto gerado");
            }
        } catch (err: any) {
            console.error('AI Error:', err);
            notify('error', 'Falha ao gerar descrição com IA.', 'Erro');
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({
                name,
                description,
                price,
                unit,
                show_in_pdf: showInPdf,
                codigo_servico_municipal: munCode,
                item_lista_servico: lcItem,
                is_loyalty: isLoyalty,
            });
            clearCache();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={initialData ? 'Editar Serviço' : 'Novo Serviço'}
            subtitle={initialData ? 'Atualize as informações do serviço cadastrado' : 'Cadastre um novo serviço no sistema'}
            icon={Wrench}
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label="Nome do Serviço *"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Ex: Consultoria Técnica, Manutenção..."
                />

                <div className="flex flex-col gap-1 w-full">
                    <div className="flex justify-between items-center w-full">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Descrição
                        </label>
                        <button 
                           type="button" 
                           onClick={handleGenerateDescription}
                           className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded-md transition-all"
                           disabled={isGeneratingDesc}
                        >
                             <Wand2 size={12} className={isGeneratingDesc ? "animate-pulse" : ""} /> {isGeneratingDesc ? 'GERANDO...' : 'IA MÁGICA'}
                        </button>
                    </div>
                    <TextArea
                        rows={3}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Descreva o serviço oferecido..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <CurrencyInput
                        label="Preço Unitário (R$) *"
                        value={price}
                        onChange={num => setPrice(num)}
                        required
                    />
                    <Input
                        label="Unidade"
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        placeholder="Ex: hr, un, m²"
                    />
                </div>

                {isFiscalEnabled && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 space-y-4">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Dados Fiscais (NFS-e)</h4>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Cód. Serviço Municipal"
                                value={munCode}
                                onChange={e => setMunCode(e.target.value)}
                                placeholder="Consultar Prefeitura"
                                helpText="Código de tributação do município"
                            />
                            <Input
                                label="Item Lista Serviço"
                                value={lcItem}
                                onChange={e => setLcItem(e.target.value)}
                                placeholder="Ex: 01.01"
                                helpText="Item da Lei Complementar 116/2003"
                            />
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-4 py-2">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="show-in-pdf"
                            checked={showInPdf}
                            onChange={e => setShowInPdf(e.target.checked)}
                            className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                        />
                        <label htmlFor="show-in-pdf" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            Serviço ativo e mostrar no PDF
                        </label>
                    </div>

                    {currentEntity.loyalty_module_enabled && (
                        <div className="flex items-start gap-2 p-3 rounded-xl border-2 border-indigo-100 bg-indigo-50/20 dark:border-indigo-900/10 dark:bg-indigo-900/10 hover:bg-indigo-50/50 transition-colors cursor-pointer" onClick={() => setIsLoyalty(!isLoyalty)}>
                            <div className="pt-0.5">
                                <input
                                    type="checkbox"
                                    id="is-loyalty"
                                    checked={isLoyalty}
                                    onChange={e => setIsLoyalty(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                                />
                            </div>
                            <div className="flex-1">
                                <label htmlFor="is-loyalty" className="text-sm font-bold text-gray-900 dark:text-white cursor-pointer select-none">
                                    🏆 Disponível no Clube de Fidelidade
                                </label>
                                <p className="text-[10px] text-gray-400 mt-1">Este serviço poderá ser incluído em planos de recorrência e gerar cobranças automáticas para seus assinantes.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={handleClose} className="px-8">
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={loading} className="bg-emerald-600 hover:bg-emerald-700 px-8">
                        Salvar
                    </Button>
                </div>
            </form>
        </Modal>
    );
}


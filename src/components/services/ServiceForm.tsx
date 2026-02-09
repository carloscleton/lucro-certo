import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Wrench } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Modal } from '../ui/Modal';
import { useCompanies } from '../../hooks/useCompanies';
import { useEntity } from '../../context/EntityContext';
import type { Service } from '../../hooks/useServices';

interface ServiceFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Service | null;
}

export function ServiceForm({ isOpen, onClose, onSubmit, initialData }: ServiceFormProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [unit, setUnit] = useState('');
    const [showInPdf, setShowInPdf] = useState(true);
    const [loading, setLoading] = useState(false);
    const [munCode, setMunCode] = useState('');
    const [lcItem, setLcItem] = useState('');

    const { currentEntity } = useEntity();
    const { companies } = useCompanies();
    const currentCompany = companies.find(c => c.id === currentEntity.id);
    const isFiscalEnabled = currentEntity.type === 'company' && currentCompany?.fiscal_module_enabled;

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setDescription(initialData.description || '');
            setPrice(initialData.price.toString());
            setUnit(initialData.unit || '');
            setShowInPdf(initialData.show_in_pdf !== false);
            setMunCode(initialData.codigo_servico_municipal || '');
            setLcItem(initialData.item_lista_servico || '');
        } else {
            setName('');
            setDescription('');
            setPrice('');
            setUnit('');
            setShowInPdf(true);
            setMunCode('');
            setLcItem('');
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({
                name,
                description,
                price: parseFloat(price) || 0,
                unit,
                show_in_pdf: showInPdf,
                codigo_servico_municipal: munCode,
                item_lista_servico: lcItem,
            });
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
            onClose={onClose}
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

                <TextArea
                    label="Descrição"
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Descreva o serviço oferecido..."
                />

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Preço Unitário (R$) *"
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        placeholder="0.00"
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
                                label="Cód. Serviço Municipal *"
                                value={munCode}
                                onChange={e => setMunCode(e.target.value)}
                                placeholder="Consultar Prefeitura"
                                required={isFiscalEnabled}
                                helpText="Código de tributação do município"
                            />
                            <Input
                                label="Item Lista Servico *"
                                value={lcItem}
                                onChange={e => setLcItem(e.target.value)}
                                placeholder="Ex: 01.01"
                                required={isFiscalEnabled}
                                helpText="Item da Lei Complementar 116/2003"
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="show-in-pdf"
                        checked={showInPdf}
                        onChange={e => setShowInPdf(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                    />
                    <label htmlFor="show-in-pdf" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        Serviço ativo e mostrar no PDF
                    </label>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={onClose} className="px-8">
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


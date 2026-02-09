import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Package } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Modal } from '../ui/Modal';
import { useCompanies } from '../../hooks/useCompanies';
import { useEntity } from '../../context/EntityContext';
import type { Product } from '../../hooks/useProducts';

interface ProductFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: Product | null;
}

export function ProductForm({ isOpen, onClose, onSubmit, initialData }: ProductFormProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [subDescription, setSubDescription] = useState('');
    const [price, setPrice] = useState('');
    const [unit, setUnit] = useState('');
    const [showInPdf, setShowInPdf] = useState(true);
    const [loading, setLoading] = useState(false);
    const [ncm, setNcm] = useState('');
    const [cest, setCest] = useState('');
    const [origem, setOrigem] = useState('0');
    const [costPrice, setCostPrice] = useState('');

    const { currentEntity } = useEntity();
    const { companies } = useCompanies();
    const currentCompany = companies.find(c => c.id === currentEntity.id);
    const isFiscalEnabled = currentEntity.type === 'company' && currentCompany?.fiscal_module_enabled;

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setDescription(initialData.description || '');
            setSubDescription(initialData.sub_description || '');
            setPrice(initialData.price.toString());
            setUnit(initialData.unit || '');
            setShowInPdf(initialData.show_in_pdf !== false);
            setNcm(initialData.ncm || '');
            setCest(initialData.cest || '');
            setOrigem((initialData.origem ?? 0).toString());
            setCostPrice(initialData.preco_custo?.toString() || '');
        } else {
            setName('');
            setDescription('');
            setSubDescription('');
            setPrice('');
            setUnit('');
            setShowInPdf(true);
            setNcm('');
            setCest('');
            setOrigem('0');
            setCostPrice('');
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({
                name,
                description,
                sub_description: subDescription,
                price: parseFloat(price) || 0,
                unit,
                show_in_pdf: showInPdf,
                ncm,
                cest,
                origem: parseInt(origem) || 0,
                preco_custo: parseFloat(costPrice) || 0,
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
            title={initialData ? 'Editar Produto' : 'Novo Produto'}
            subtitle={initialData ? 'Atualize as informações do produto' : 'Cadastre um novo produto no catálogo'}
            icon={Package}
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label="Nome do Produto *"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Ex: Cimento 50kg, Parafuso..."
                />

                <TextArea
                    label="Descrição"
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Detalhes técnicos sobre o produto..."
                />

                <Input
                    label="Sub Descrição / Marca"
                    value={subDescription}
                    onChange={e => setSubDescription(e.target.value)}
                    placeholder="Ex: Fabricante, Modelo, Cor..."
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
                        placeholder="Ex: un, cx, kg"
                    />
                </div>

                {isFiscalEnabled && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 space-y-4">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Dados Fiscais (TecnoSpeed)</h4>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="NCM *"
                                value={ncm}
                                onChange={e => setNcm(e.target.value.replace(/\D/g, '').substring(0, 8))}
                                placeholder="8 dígitos"
                                required={isFiscalEnabled}
                                helpText="Nomenclatura Comum do Mercosul"
                            />
                            <Input
                                label="CEST"
                                value={cest}
                                onChange={e => setCest(e.target.value.replace(/\D/g, '').substring(0, 7))}
                                placeholder="7 dígitos"
                                helpText="Cód. Especificador de Sub. Tributária"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Origem da Mercadoria *
                                </label>
                                <select
                                    value={origem}
                                    onChange={e => setOrigem(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="0">0 - Nacional</option>
                                    <option value="1">1 - Estrangeira (Importação Direta)</option>
                                    <option value="2">2 - Estrangeira (Adquirida Interno)</option>
                                    <option value="3">3 - Nacional (Conteúdo Import. &gt; 40%)</option>
                                    <option value="4">4 - Nacional (Prod. Básica)</option>
                                    <option value="5">5 - Nacional (Import. &lt; 40%)</option>
                                </select>
                            </div>
                            <Input
                                label="Preço de Custo (R$)"
                                type="number"
                                step="0.01"
                                value={costPrice}
                                onChange={e => setCostPrice(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="show-in-pdf-product"
                        checked={showInPdf}
                        onChange={e => setShowInPdf(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                    />
                    <label htmlFor="show-in-pdf-product" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        Produto ativo e mostrar no PDF
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


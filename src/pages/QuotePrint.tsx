import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useQuotes } from '../hooks/useQuotes';
import type { Quote } from '../hooks/useQuotes';
import { useEntity } from '../context/EntityContext';
import { useAuth } from '../context/AuthContext';
import { PDFService } from '../services/pdfService';

export function QuotePrint() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getQuote } = useQuotes();
    const { currentEntity } = useEntity();
    const { user } = useAuth();
    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadQuote(id);
        }
    }, [id]);

    const loadQuote = async (quoteId: string) => {
        try {
            const data = await getQuote(quoteId);
            setQuote(data);
        } catch (error) {
            console.error(error);
            alert('Erro ao carregar orçamento');
            navigate('/quotes');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleGeneratePDF = async () => {
        if (!quote) return;

        try {
            // Dynamically import PDFService to avoid circular dependencies if any, 
            // or just ensure it is imported at top. 
            // Actually, let's just use the imported one.
            // We need to import PDFService at the top of the file first.
            // const { PDFService } = await import('../services/pdfService'); // Removed dynamic import as it's now a static import

            console.log('🖨️ Generating PDF with Entity Data:', currentEntity);

            const getStr = (val: any) => val ? String(val) : '';

            const pdfUrl = await PDFService.generateAndUploadQuotePDF({
                quote: {
                    id: quote.id,
                    title: quote.title,
                    created_at: quote.created_at,
                    valid_until: quote.valid_until || '',
                    status: quote.status,
                    discount: quote.discount || 0,
                    discount_type: quote.discount_type || 'amount',
                    notes: quote.notes
                },
                customer: {
                    name: quote.contact?.name || 'Cliente',
                    email: quote.contact?.email,
                    phone: quote.contact?.phone,
                    address: (quote.contact as any)?.address
                },
                items: quote.items?.filter(i => i.show_in_pdf !== false).map(i => ({
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    total_price: i.total_price
                })) || [],
                company: {
                    name: currentEntity?.name || 'Minha Empresa',
                    legal_name: (currentEntity as any)?.legal_name,
                    cnpj: (currentEntity as any)?.cnpj,
                    logo_url: currentEntity?.logo_url,
                    email: user?.email || '',
                    address: currentEntity?.type === 'company'
                        ? [
                            getStr((currentEntity as any).street),
                            getStr((currentEntity as any).number),
                            getStr((currentEntity as any).complement),
                            getStr((currentEntity as any).neighborhood),
                            getStr((currentEntity as any).city) + '/' + getStr((currentEntity as any).state),
                            getStr((currentEntity as any).zip_code)
                        ].filter(Boolean).join(', ')
                        : undefined
                },
                subtotal: quote.total_amount + (quote.discount || 0),
                total: quote.total_amount
            }, currentEntity?.id || 'personal');

            // Open PDF in new tab
            window.open(pdfUrl, '_blank');

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Erro ao gerar PDF');
        }
    };

    if (loading) return <div className="flex justify-center p-10">Carregando...</div>;
    if (!quote) return <div className="flex justify-center p-10">Orçamento não encontrado.</div>;

    return (
        <div className="bg-gray-100 min-h-screen p-4 md:p-8 print:p-0 print:bg-white">
            {/* Toolbar - Hidden on Print */}
            <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
                <Button variant="ghost" onClick={() => navigate('/quotes')}>
                    <ArrowLeft size={18} className="mr-2" />
                    Voltar
                </Button>
                <div className="flex gap-2">
                    <Button onClick={handleGeneratePDF}>
                        <Printer size={18} className="mr-2" />
                        Gerar PDF
                    </Button>
                    <Button onClick={handlePrint} variant="outline">
                        Imprimir Tela
                    </Button>
                </div>
            </div>

            {/* A4 Paper Look */}
            <div className="max-w-4xl mx-auto bg-white shadow-lg p-8 md:p-12 print:shadow-none print:p-0 min-h-[29.7cm]">

                {/* Header */}
                <div className="flex justify-between items-start mb-12 border-b pb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">ORÇAMENTO</h1>
                        <p className="text-gray-500">#{quote.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                        {currentEntity?.logo_url ? (
                            <img
                                src={currentEntity.logo_url}
                                alt={currentEntity.name}
                                className="h-16 object-contain ml-auto mb-2"
                            />
                        ) : null}
                        <h2 className="text-xl font-semibold text-gray-800">{currentEntity?.name || 'Sua Empresa'}</h2>
                        <p className="text-sm text-gray-600">{user?.email}</p>
                        {/* Address placeholders if available in future */}
                        <p className="text-sm text-gray-600 mt-1">Data: {new Date(quote.created_at).toLocaleDateString()}</p>
                        {quote.valid_until && (
                            <p className="text-sm text-red-500 font-medium">Válido até: {new Date(quote.valid_until).toLocaleDateString()}</p>
                        )}
                    </div>
                </div>

                {/* Client Info */}
                <div className="mb-10">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cliente</h3>
                    <div className="bg-gray-50 p-4 rounded-lg print:bg-transparent print:p-0">
                        <p className="text-lg font-medium text-gray-900">{quote.contact?.name}</p>
                        <p className="text-gray-600">{quote.contact?.email}</p>
                    </div>
                </div>

                {/* Title/Description */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">{quote.title}</h2>
                </div>

                {/* Items Table */}
                <div className="mb-10">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-100">
                                <th className="py-3 text-sm font-semibold text-gray-600">ITEM / DESCRIÇÃO</th>
                                <th className="py-3 text-sm font-semibold text-gray-600 text-center w-24">QTD</th>
                                <th className="py-3 text-sm font-semibold text-gray-600 text-right w-32">UNITÁRIO</th>
                                <th className="py-3 text-sm font-semibold text-gray-600 text-right w-32">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody className="align-top">
                            {quote.items?.filter(item => item.show_in_pdf !== false).map((item, index) => (
                                <tr key={index} className="border-b border-gray-50">
                                    <td className="py-3 text-gray-800">
                                        <p className="font-medium">{item.description}</p>
                                    </td>
                                    <td className="py-3 text-gray-600 text-center">{item.quantity}</td>
                                    <td className="py-3 text-gray-600 text-right">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unit_price)}
                                    </td>
                                    <td className="py-3 text-gray-800 font-medium text-right">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total_price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} className="pt-6 text-right text-gray-600 font-medium">Subtotal</td>
                                <td className="pt-6 text-right text-gray-800 font-medium">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                        quote.discount_type === 'percentage'
                                            ? (quote.total_amount || 0) / (1 - ((quote.discount || 0) / 100))
                                            : (quote.total_amount || 0) + (quote.discount || 0)
                                    )}
                                </td>
                            </tr>
                            {quote.discount && quote.discount > 0 && (
                                <tr>
                                    <td colSpan={3} className="pt-2 text-right text-red-500 font-medium">
                                        Desconto {quote.discount_type === 'percentage' ? `(${quote.discount}%)` : ''}
                                    </td>
                                    <td className="pt-2 text-right text-red-500 font-medium">
                                        - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                            quote.discount_type === 'percentage'
                                                ? ((quote.total_amount || 0) / (1 - ((quote.discount || 0) / 100))) - (quote.total_amount || 0)
                                                : quote.discount
                                        )}
                                    </td>
                                </tr>
                            )}
                            <tr>
                                <td colSpan={3} className="pt-2 text-right text-xl font-bold text-gray-900"> TOTAL</td>
                                <td className="pt-2 text-right text-xl font-bold text-blue-600">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total_amount)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Notes */}
                {quote.notes && (
                    <div className="mb-12 border-t pt-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Observações</h3>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
                    </div>
                )}

                {/* Footer Signature */}
                <div className="mt-20 flex justify-between items-end print:mt-auto">
                    <div className="border-t border-gray-300 w-64 pt-2 text-center text-xs text-gray-400">
                        Assinatura do Responsável
                    </div>
                    <div className="border-t border-gray-300 w-64 pt-2 text-center text-xs text-gray-400">
                        De acordo (Cliente)
                    </div>
                </div>
            </div>

            <style type="text/css" media="print">
                {`
                @page { size: auto; margin: 0mm; }
                body { background-color: white; }
                `}
            </style>
        </div>
    );
}

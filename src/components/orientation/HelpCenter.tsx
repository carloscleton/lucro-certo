import { useState } from 'react';
import { HelpCircle, PlayCircle, BookOpen, MessageCircle, X } from 'lucide-react';
import { Button } from '../ui/Button';

export function HelpCenter() {
    const [isOpen, setIsOpen] = useState(false);

    const guides = [
        {
            title: 'Primeiros Passos',
            icon: PlayCircle,
            description: 'Aprenda o básico do Lucro Certo.',
            link: '#', // TODO: Add real links
        },
        {
            title: 'Fluxo de Caixa',
            icon: DollarSignIcon,
            description: 'Como organizar suas entradas e saídas.',
            link: '#',
        },
        {
            title: 'Gerindo Clientes',
            icon: BookOpen,
            description: 'Cadastro e gestão de pacientes/clientes.',
            link: '#',
        },
    ];

    function DollarSignIcon(props: any) {
        return (
            <svg
                {...props}
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <line x1="12" x2="12" y1="2" y2="22" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999]">
            {isOpen ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-80 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <HelpCircle size={20} />
                            <span className="font-bold">Central de Ajuda</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:rotate-90 transition-transform">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Precisa de ajuda? Escolha um dos guias rápidos abaixo ou fale conosco.
                        </p>

                        <div className="space-y-2">
                            {guides.map((guide, index) => (
                                <a
                                    key={index}
                                    href={guide.link}
                                    className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all group"
                                >
                                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                        <guide.icon size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{guide.title}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{guide.description}</p>
                                    </div>
                                </a>
                            ))}
                        </div>

                        <Button className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700">
                            <MessageCircle size={18} />
                            Falar com Suporte
                        </Button>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-900 text-center">
                        <button
                            onClick={() => {
                                localStorage.removeItem('lucro_certo_onboarding_seen');
                                window.location.reload();
                            }}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            Reiniciar Tour de Boas-vindas
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all flex items-center justify-center group"
                    title="Ajuda"
                >
                    <HelpCircle size={28} className="group-hover:rotate-12 transition-transform" />
                </button>
            )}
        </div>
    );
}

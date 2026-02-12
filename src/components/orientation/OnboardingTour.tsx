import { useState, useEffect } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import type { Step, CallBackProps } from 'react-joyride';

export function OnboardingTour() {
    const [run, setRun] = useState(false);

    useEffect(() => {
        // Check if the user has already seen the tour
        const hasSeenTour = localStorage.getItem('lucro_certo_onboarding_seen');
        if (!hasSeenTour) {
            // Small delay to ensure the layout is fully rendered
            const timer = setTimeout(() => {
                setRun(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const steps: Step[] = [
        {
            target: 'body',
            content: (
                <div className="text-left">
                    <h3 className="font-bold text-lg mb-2">Bem-vindo ao Lucro Certo! 🚀</h3>
                    <p>Estamos felizes em ter você aqui. Vamos te mostrar rapidamente como aproveitar ao máximo nossa plataforma.</p>
                </div>
            ),
            placement: 'center',
        },
        {
            target: '[data-tour="sidebar"]',
            content: 'Aqui fica o seu menu lateral. Por ele você acessa todas as funcionalidades do sistema.',
            placement: 'right',
        },
        {
            target: '[data-tour="entity-selector"]',
            content: 'Este é o seletor de ambiente. Você pode alternar entre suas finanças pessoais e de suas empresas aqui.',
            placement: 'right',
        },
        {
            target: '[data-tour="nav-dashboard"]',
            content: 'No Dashboard, você tem uma visão geral da saúde financeira do seu negócio.',
            placement: 'right',
        },
        {
            target: '[data-tour="nav-cashflow"]',
            content: 'O Fluxo de Caixa permite acompanhar todas as entradas e saídas detalhadamente.',
            placement: 'right',
        },
        {
            target: '[data-tour="nav-quotes"]',
            content: 'Em Orçamentos, você cria e gerencia as propostas enviadas para seus clientes.',
            placement: 'right',
        },
        {
            target: '[data-tour="user-section"]',
            content: 'Aqui você gerencia seu perfil e pode sair da plataforma com segurança.',
            placement: 'top',
        },
    ];

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRun(false);
            localStorage.setItem('lucro_certo_onboarding_seen', 'true');
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showProgress
            showSkipButton
            callback={handleJoyrideCallback}
            locale={{
                back: 'Voltar',
                close: 'Fechar',
                last: 'Finalizar',
                next: 'Próximo',
                skip: 'Pular',
            }}
            styles={{
                options: {
                    primaryColor: '#2563eb',
                    zIndex: 10000,
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
            }}
        />
    );
}

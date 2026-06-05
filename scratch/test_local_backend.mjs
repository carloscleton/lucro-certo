import axios from 'axios';

async function test() {
    const payload = [
        {
            "idIntegracao": "TEST_" + Date.now(),
            "prestador": {
                "cpfCnpj": "08187168000160",
                "inscricaoMunicipal": "8214100099"
            },
            "tomador": {
                "cpfCnpj": "00000000000000",
                "razaoSocial": "Cliente de Teste LTDA",
                "email": "teste@exemplo.com",
                "endereco": {
                    "codigoCidade": "4115200",
                    "uf": "PR",
                    "logradouro": "Rua Teste",
                    "numero": "123",
                    "bairro": "Centro",
                    "cep": "87000000"
                }
            },
            "servico": [
                {
                    "codigo": "01.01",
                    "codigoTributacao": "01.01",
                    "discriminacao": "Servico de teste",
                    "cnae": "6201501",
                    "iss": {
                        "aliquota": 2,
                        "exigibilidade": 1,
                        "tipoTributacao": 7
                    },
                    "valor": {
                        "servico": 100,
                        "descontoCondicionado": 0,
                        "descontoIncondicionado": 0
                    },
                    "codigoIbge": "4115200"
                }
            ]
        }
    ];

    try {
        const response = await axios.post('http://localhost:3001/api/fiscal-module/emitir', {
            companyId: '84d1586e-5d0c-456f-aa12-aefc5a9364a7',
            payload,
            type: 'nfse',
            isLabTest: true
        });
        console.log("SUCCESS:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("ERROR STATUS:", e.response?.status);
        console.error("ERROR DATA:", JSON.stringify(e.response?.data, null, 2));
    }
}

test();

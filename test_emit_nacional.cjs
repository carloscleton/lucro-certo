const axios = require('axios');

async function testNacional() {
    const payload = [
        {
            "idIntegracao": "TEST_NACIONAL_" + Date.now(),
            "versao": "1.00",
            "prestador": {
                "cpfCnpj": "08187168000160",
                "inscricaoMunicipal": "1234567"
            },
            "tomador": {
                "cpfCnpj": "00000000000000",
                "razaoSocial": "Cliente de Teste LTDA",
                "email": "teste@exemplo.com",
                "endereco": {
                    "codigoCidade": "3106200",
                    "uf": "MG",
                    "logradouro": "Rua Teste",
                    "numero": "123",
                    "bairro": "Centro",
                    "cep": "31000000"
                }
            },
            "servico": [
                {
                    "codigo": "010101",
                    "codigoTributacao": "010",
                    "discriminacao": "Servico de teste",
                    "cnae": "6201501",
                    "iss": {
                        "aliquota": 0,
                        "exigibilidade": 1,
                        "tipoTributacao": 7
                    },
                    "valor": {
                        "servico": 100,
                        "descontoCondicionado": 0,
                        "descontoIncondicionado": 0
                    },
                    "codigoIbge": "3106200"
                }
            ]
        }
    ];

    try {
        const response = await axios.post('https://api.sandbox.plugnotas.com.br/nfse', payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': '2da392a6-79d2-4304-a8b7-959572c7e44d'
            }
        });
        console.log("EMIT NACIONAL SUCCESS:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("EMIT NACIONAL ERROR:", JSON.stringify(e.response?.data || e.message, null, 2));
    }
}

testNacional();

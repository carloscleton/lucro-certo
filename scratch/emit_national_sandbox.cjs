const axios = require('axios');

const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d';
const baseUrl = 'https://api.sandbox.plugnotas.com.br';

async function emitNational() {
    const payload = [
      {
        "idIntegracao": "TEST_NACIONAL_" + Date.now(),
        "versao": "1.00",
        "emitente": {
          "tipo": 1,
          "codigoCidade": "3106200"
        },
        "prestador": {
          "cpfCnpj": "00893566000190"
        },
        "tomador": {
          "cpfCnpj": "99999999999999",
          "razaoSocial": "Empresa de Teste LTDA",
          "email": "teste@nfe.io",
          "endereco": {
            "descricaoCidade": "Belo Horizonte",
            "cep": "31000000",
            "tipoLogradouro": "Rua",
            "logradouro": "Barao do rio branco",
            "tipoBairro": "Centro",
            "codigoCidade": "3106200",
            "complemento": "sala 01",
            "estado": "MG",
            "numero": "1001",
            "bairro": "Centro"
          }
        },
        "servico": [
          {
            "codigo": "01.01.01",
            "discriminacao": "Descrição dos serviços prestados via Laboratório JSON",
            "iss": {
              "tipoTributacao": 1,
              "exigibilidade": 1,
              "retido": false,
              "aliquota": 2.81
            },
            "valor": {
              "servico": 100
            },
            "quantidade": 1,
            "valorUnitario": 100,
            "tributacaoTotal": {
              "federal": {
                "valor": 0.9,
                "valorPercentual": 0.9
              },
              "estadual": {
                "valor": 0,
                "valorPercentual": 0
              },
              "municipal": {
                "valor": 0.1,
                "valorPercentual": 0.1
              }
            }
          }
        ]
      }
    ];

    try {
        console.log('Sending emission request to PlugNotas Sandbox...');
        const res = await axios.post(`${baseUrl}/nfse`, payload, {
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            }
        });
        console.log('Emission Response:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Error emitting:', err.response?.data || err.message);
    }
}

emitNational();

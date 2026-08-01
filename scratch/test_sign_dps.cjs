const { SignedXml } = require('xml-crypto');
const forge = require('node-forge');

const keys = forge.pki.rsa.generateKeyPair(2048);
const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
cert.sign(keys.privateKey, forge.md.sha256.create());
const certPem = forge.pki.certificateToPem(cert);

const dpsId = 'DPS240810210089356600019000001001785470897629';
const dpsXml = `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00"><infDPS Id="${dpsId}"><tpAmb>2</tpAmb></infDPS></DPS>`;

const sig = new SignedXml({
    privateKey: privateKeyPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
});

sig.addReference({
    xpath: "//*[local-name()='infDPS']",
    transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    uri: `#${dpsId}`
});

sig.keyInfoProvider = {
    getKeyInfo(key, prefix) {
        return '<X509Data><X509Certificate>TEST</X509Certificate></X509Data>';
    },
    getKey() { return Buffer.from(privateKeyPem); }
};

sig.computeSignature(dpsXml, {
    prefix: '',
    location: { reference: "//*[local-name()='infDPS']", action: 'after' }
});

console.log(sig.getSignedXml());

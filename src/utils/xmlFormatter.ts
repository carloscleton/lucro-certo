export function formatXmlString(xml: string): string {
    if (!xml || typeof xml !== 'string') return '';
    let formatted = '';
    let indent = '';
    const tab = '  ';

    // Remove espaços entre tags preservando texto interno
    const cleanXml = xml.replace(/>\s+</g, '><').trim();

    // Splitta em elementos XML
    const reg = /(<[^\/>]+?>|<[^\/>]+?\/>|<\/[^>]+?>|[^<]+)/g;
    const matches = cleanXml.match(reg);

    if (!matches) return xml;

    for (let i = 0; i < matches.length; i++) {
        const node = matches[i];
        if (!node.trim()) continue;

        if (node.startsWith('</')) {
            indent = indent.substring(tab.length);
            formatted += indent + node + '\n';
        } else if (node.startsWith('<') && node.endsWith('/>')) {
            formatted += indent + node + '\n';
        } else if (node.startsWith('<?xml') || node.startsWith('<!DOCTYPE')) {
            formatted += indent + node + '\n';
        } else if (node.startsWith('<')) {
            const nextNode = matches[i + 1];
            const afterNextNode = matches[i + 2];

            if (nextNode && !nextNode.startsWith('<') && afterNextNode && afterNextNode.startsWith('</')) {
                formatted += indent + node + nextNode + afterNextNode + '\n';
                i += 2;
            } else {
                formatted += indent + node + '\n';
                indent += tab;
            }
        } else {
            formatted += indent + node.trim() + '\n';
        }
    }

    return formatted.trim();
}

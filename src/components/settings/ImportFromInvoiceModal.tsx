import { useRef, useState } from 'react';
import { FileUp, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { extractFiscalDataFromXml } from '../../utils/invoiceConfigExtractor';
import {
  mapToTecnoSpeed, mapToNfeio, mapToNational, getAtPath, type ImportField,
} from '../../utils/fiscalImportMappers';

type Provider = 'tecnospeed' | 'nfeio' | 'national';

interface Props {
  isOpen: boolean;
  provider: Provider;
  currentState: Record<string, any>;
  onClose: () => void;
  onApply: (fields: ImportField[]) => void;
}

const MAPPERS = { tecnospeed: mapToTecnoSpeed, nfeio: mapToNfeio, national: mapToNational };
const PROVIDER_NAME = { tecnospeed: 'TecnoSpeed', nfeio: 'NFe.io', national: 'Portal Nacional' };

const show = (v: any) => (v === true ? 'Sim' : v === false ? 'Não' : v === undefined || v === null || v === '' ? '—' : String(v));

export function ImportFromInvoiceModal({ isOpen, provider, currentState, onClose, onApply }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState<ImportField[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  if (!isOpen) return null;

  const reset = () => { setFields([]); setSelected({}); setError(''); setInfo(''); };
  const close = () => { reset(); onClose(); };

  const handleFile = async (file?: File) => {
    reset();
    if (!file) return;
    if (!/\.xml$/i.test(file.name) && file.type !== 'text/xml' && file.type !== 'application/xml') {
      setError('Envie o arquivo XML da nota fiscal (.xml).');
      return;
    }
    try {
      const data = extractFiscalDataFromXml(await file.text());
      const mapped = MAPPERS[provider](data);
      if (!mapped.length) { setError('Nenhum campo aproveitável foi encontrado neste XML.'); return; }
      setFields(mapped);
      setSelected(Object.fromEntries(mapped.map(f => [f.path, String(getAtPath(currentState, f.path) ?? '') !== String(f.value)])));
      setInfo(`Layout ${data.layout === 'nacional' ? 'NFS-e Padrão Nacional' : 'ABRASF'} • ${data.razaoSocial || data.cnpj}`);
    } catch (e: any) {
      setError(e?.message || 'Falha ao ler o XML.');
    }
  };

  const apply = () => {
    onApply(fields.filter(f => selected[f.path]));
    close();
  };

  const count = Object.values(selected).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={close}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Importar configuração de Nota Fiscal (XML)</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">Provedor: {PROVIDER_NAME[provider]} — os campos serão apenas preenchidos; revise e clique em Salvar.</p>
          </div>
          <button type="button" onClick={close} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400"
          >
            <FileUp className="mx-auto mb-2 text-blue-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Clique ou arraste o XML da NFS-e</p>
            <p className="text-xs text-gray-500">Padrão Nacional ou ABRASF</p>
            <input ref={inputRef} type="file" accept=".xml,text/xml,application/xml" className="hidden"
              onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg"><AlertCircle size={16} />{error}</div>
          )}
          {info && <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{info}</p>}

          {fields.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-slate-700">
                  <th className="py-2 w-8"></th><th>Campo</th><th>Valor atual</th><th>Valor da nota</th>
                </tr>
              </thead>
              <tbody>
                {fields.map(f => (
                  <tr key={f.path} className="border-b border-gray-50 dark:border-slate-700/50">
                    <td className="py-1.5">
                      <input type="checkbox" checked={!!selected[f.path]}
                        onChange={e => setSelected(s => ({ ...s, [f.path]: e.target.checked }))} />
                    </td>
                    <td className="font-semibold text-gray-700 dark:text-slate-200">{f.label}</td>
                    <td className="text-gray-500 max-w-[180px] truncate">{show(getAtPath(currentState, f.path))}</td>
                    <td className="text-blue-700 dark:text-blue-400 font-semibold max-w-[220px] truncate" title={show(f.value)}>{show(f.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-gray-400">Não são importados: chaves de API, tokens, webhooks, certificado digital e ambiente.</p>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-100 dark:border-slate-700">
          <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
          <Button type="button" onClick={apply} disabled={!count}><Check size={16} className="mr-1" />Aplicar {count} campo(s)</Button>
        </div>
      </div>
    </div>
  );
}

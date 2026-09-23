import { useEffect, useState } from 'react';
import { deleteTemplate, listTemplates, saveTemplate, type SavedTemplate, type TemplateDraft } from './library';

interface Props {
  draft: TemplateDraft;
  onLoad: (saved: SavedTemplate) => void;
  disabled: boolean;
}

export default function TemplateLibrary({ draft, onLoad, disabled }: Props) {
  const [items, setItems] = useState<SavedTemplate[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [removeId, setRemoveId] = useState('');
  useEffect(() => {
    let active = true;
    void listTemplates().then((result) => { if (active) setItems(result); }, () => {
      if (active) setMessage('No se pudo abrir la biblioteca en este navegador.');
    });
    return () => { active = false; };
  }, []);

  const save = async (update: boolean) => {
    setBusy(true); setMessage('');
    try {
      const saved = await saveTemplate(name, draft, update ? selected : undefined);
      setItems(await listTemplates()); setSelected(saved.id); setName(saved.name);
      setMessage(update ? 'Plantilla actualizada.' : 'Plantilla guardada con sus imágenes. La música no se ha incluido.');
    } catch (error) {
      setMessage(error instanceof Error ? `No se pudo guardar: ${error.message}` : 'No se pudo guardar. Comprueba el espacio disponible del navegador.');
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteTemplate(id); setItems(await listTemplates());
      if (selected === id) setSelected('');
      setRemoveId(''); setMessage('Plantilla eliminada de la biblioteca. La escena actual se conserva.');
    } catch { setMessage('No se pudo eliminar la plantilla.'); }
    finally { setBusy(false); }
  };

  return <fieldset className="template-library" disabled={disabled || busy}>
    <div className="section-title"><span className="section-number">★</span><h2>Mis plantillas</h2></div>
    <p className="section-hint">Guarda la composición completa: imágenes, fondos, textos, letras y efectos, sin música. Al usarla, se mantiene la canción que tengas abierta.</p>
    <label className="field"><span>Nombre de la plantilla</span><input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Retrato con humo verde" /></label>
    <div className="template-library-actions">
      <button className="quiet-button" disabled={!name.trim()} onClick={() => void save(false)}>Guardar como nueva</button>
      <button className="quiet-button" disabled={!selected || !name.trim()} onClick={() => void save(true)}>Actualizar seleccionada</button>
    </div>
    <p className="section-hint">Los cambios del editor solo modifican una plantilla guardada si pulsas «Actualizar seleccionada». Puedes guardar variantes como nuevas.</p>
    <div className="saved-template-list">
      {items.map((item) => <div className={`saved-template ${selected === item.id ? 'selected' : ''}`} key={item.id}>
        <div><strong>{item.name}</strong><small>{item.config.ratio === 'portrait' ? '9:16' : item.config.ratio === 'square' ? '1:1' : '16:9'} · {new Date(item.updatedAt).toLocaleDateString()}</small></div>
        <button className="quiet-button" aria-label={`Usar ${item.name}`} onClick={() => {
          onLoad(item); setSelected(item.id); setName(item.name); setRemoveId('');
          setMessage('Composición recuperada. Puedes cambiar la canción o el contenido del marco.');
        }}>Usar</button>
        {removeId === item.id ? <><button className="quiet-button" onClick={() => void remove(item.id)}>Eliminar definitivamente</button><button className="quiet-button" onClick={() => setRemoveId('')}>Cancelar</button></> : <button className="quiet-button" aria-label={`Eliminar ${item.name}`} onClick={() => setRemoveId(item.id)}>×</button>}
      </div>)}
      {!items.length && <p className="section-hint">Todavía no tienes plantillas guardadas.</p>}
    </div>
    {message && <p className="library-message" role="status">{message}</p>}
    <small className="section-hint">Se guardan en este navegador y esta dirección. Borrar los datos del sitio también borra la biblioteca.</small>
  </fieldset>;
}

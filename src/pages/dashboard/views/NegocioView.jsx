import { useState } from 'react';
import { Store, CheckCircle2 } from 'lucide-react';
import { C } from '../theme';
import { SectionCard } from '../components/ui';
import { Field } from '../components/Modal';

/* =========================================================================
   VISTA: MI NEGOCIO (solo owner)
   Perfil del negocio: nombre, teléfono, dirección, descripción y logo.
   Las reglas replican las del servidor (businesses.js); el servidor es quien decide.
   ========================================================================= */
const inputStyle = { background: C.bg, border: `1px solid ${C.border}`, color: C.text };
const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none';
const TELEFONO = /^[0-9+()\-\s]{7,20}$/;

const esUrlWeb = (v) => {
  try {
    const { protocol } = new URL(v);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const desdeNegocio = (b) => ({
  name: b?.name || '',
  phone: b?.phone || '',
  address: b?.address || '',
  description: b?.description || '',
  logo: b?.logo || '',
});

function validar(f) {
  const name = f.name.trim();
  if (!name) return 'Ingresa el nombre del negocio.';
  if (name.length > 80) return 'El nombre del negocio es demasiado largo (máximo 80 caracteres).';
  if (f.phone.trim() && !TELEFONO.test(f.phone.trim())) return 'El teléfono solo puede tener números, espacios, +, - y paréntesis (7 a 20 caracteres).';
  if (f.address.trim().length > 200) return 'La dirección es demasiado larga (máximo 200 caracteres).';
  if (f.description.trim().length > 500) return 'La descripción es demasiado larga (máximo 500 caracteres).';
  const logo = f.logo.trim();
  if (logo.length > 2048) return 'La dirección del logo es demasiado larga (máximo 2048 caracteres).';
  if (logo && !esUrlWeb(logo)) return 'El logo debe ser una dirección web válida (http o https).';
  return '';
}

export function NegocioView({ business, onSave }) {
  const [form, setForm] = useState(() => desdeNegocio(business));
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [logoRoto, setLogoRoto] = useState(false);

  const cambia = (campo) => (e) => {
    setForm({ ...form, [campo]: e.target.value });
    setGuardado(false);
    if (campo === 'logo') setLogoRoto(false);
  };

  const sinCambios = JSON.stringify(form) === JSON.stringify(desdeNegocio(business));
  const logoValido = form.logo.trim() && esUrlWeb(form.logo.trim()) && form.logo.trim().length <= 2048;

  const submit = async (e) => {
    e.preventDefault();
    const problema = validar(form);
    if (problema) { setError(problema); setGuardado(false); return; }
    setError('');
    setGuardando(true);
    const result = await onSave({
      name: form.name,
      phone: form.phone,
      address: form.address,
      description: form.description,
      logoUrl: form.logo.trim() || null,
    });
    setGuardando(false);
    if (!result.ok) { setError(result.error); return; }
    setForm(desdeNegocio(result.business));
    setGuardado(true);
  };

  return (
    <div className="space-y-5 bd-fade-in max-w-3xl">
      <SectionCard title="Perfil de tu barbería">
        <form onSubmit={submit} noValidate className="space-y-4">
          {error && <div role="alert" className="text-xs px-3 py-2 rounded-lg" style={{ background: C.redBg, color: C.red }}>{error}</div>}
          {guardado && (
            <div role="status" className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: C.accentBg, color: C.text }}>
              <CheckCircle2 size={16} style={{ color: C.accent }} aria-hidden="true" /> Cambios guardados.
            </div>
          )}

          <Field label="Nombre del negocio">
            <input value={form.name} onChange={cambia('name')} maxLength={120} className={inputClass} style={inputStyle} autoComplete="organization" />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Teléfono">
              <input type="tel" value={form.phone} onChange={cambia('phone')} className={inputClass} style={inputStyle} placeholder="Ej. 300 123 4567" autoComplete="tel" />
            </Field>
            <Field label="Dirección">
              <input value={form.address} onChange={cambia('address')} className={inputClass} style={inputStyle} placeholder="Ej. Calle 10 # 5-20, Bogotá" autoComplete="street-address" />
            </Field>
          </div>

          <Field label="Descripción">
            <textarea value={form.description} onChange={cambia('description')} rows={3} className={inputClass} style={inputStyle} placeholder="Cuéntales a tus clientes qué hace especial a tu barbería." />
          </Field>
          <p className="text-xs -mt-2 text-right" style={{ color: form.description.length > 500 ? C.red : C.textFaint }}>{form.description.length}/500</p>

          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ background: C.bgSoft, border: `1px solid ${C.border}` }}>
              {logoValido && !logoRoto
                ? <img src={form.logo.trim()} alt="Vista previa del logo" onError={() => setLogoRoto(true)} className="w-full h-full object-contain" />
                : <Store size={22} style={{ color: C.textFaint }} aria-hidden="true" />}
            </div>
            <div className="flex-1 min-w-0">
              <Field label="Logo (dirección de la imagen)">
                <input type="url" value={form.logo} onChange={cambia('logo')} className={inputClass} style={inputStyle} placeholder="https://…/logo.png" autoComplete="off" />
              </Field>
              {logoRoto && <p className="text-xs mt-1" style={{ color: C.red }}>No pudimos cargar esa imagen. Revisa la dirección.</p>}
              <p className="text-xs mt-1" style={{ color: C.textFaint }}>Déjalo vacío si no tienes logo.</p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={guardando || sinCambios} className="px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: C.accent, color: C.onAccent }}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

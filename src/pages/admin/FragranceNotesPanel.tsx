import React, { useState, useEffect, useMemo } from 'react';
import { FlaskConical, Search, Save } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { neonDb } from '../../services/neonDb';
import type { FragranceNotesEntry } from '../../types';

export const FragranceNotesPanel: React.FC = () => {
  const { products } = useStore();
  const [notesList, setNotesList] = useState<FragranceNotesEntry[]>([]);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string>('');
  const [form, setForm] = useState<Partial<FragranceNotesEntry>>({});
  const [msg, setMsg] = useState('');

  const load = async () => {
    const list = await neonDb.getFragranceNotes();
    setNotesList(list);
  };
  useEffect(() => { void load(); }, []);

  const notesByProd = useMemo(() => new Map(notesList.map(n => [n.product_id, n])), [notesList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter(p => {
        const n = notesByProd.get(p.id);
        const hay = `${p.name_ar} ${p.brand} ${n?.scent_family || ''} ${n?.top_notes || ''} ${n?.heart_notes || ''} ${n?.base_notes || ''}`.toLowerCase();
        return !q || hay.includes(q);
      })
      .slice(0, 60);
  }, [products, notesByProd, query]);

  const startEdit = (productId: string) => {
    const existing = notesByProd.get(productId);
    const p = products.find(x => x.id === productId);
    setEditingId(productId);
    setForm(existing || {
      product_id: productId,
      scent_family: 'شرقي خشبي عنبري',
      inspired_by: p?.name_ar || '',
      concentration: p?.concentration || 'Extrait de Parfum',
      gender: p?.gender || 'unisex',
      season: 'طوال العام',
      top_notes: '',
      heart_notes: '',
      base_notes: '',
      longevity_hours: '8-12 ساعة',
      sillage: 'فواح'
    });
    setMsg('');
  };

  const saveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await neonDb.upsertFragranceNotes({ ...form, product_id: editingId });
    if (res.success) {
      setMsg('تم حفظ الهرم العطري بنجاح.');
      setEditingId('');
      void load();
    } else setMsg(res.error || 'تعذر الحفظ');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-[#fe9931]" />
          <span>دليل النوتات والهرم العطري والبدائل</span>
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          ابحث بالافتتاحية أو القلب أو القاعدة أو العائلة العطرية لمساعدة العملاء في ترشيح العطور المناسبة
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ابحث باسم العطر، الدار، أو النوتة (عود، فانيليا، زعفران...)"
          className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#fe9931]"
        />
      </div>

      {msg && <div className="p-3 rounded-xl bg-green-50 text-green-700 text-xs font-bold">{msg}</div>}

      {editingId && (
        <form onSubmit={saveNotes} className="bg-white border-2 border-[#fe9931] rounded-2xl p-5 space-y-3">
          <p className="font-bold text-sm text-[#252a31]">
            تعديل الهرم العطري: {products.find(p => p.id === editingId)?.name_ar}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" value={form.scent_family || ''} onChange={e => setForm({ ...form, scent_family: e.target.value })} placeholder="العائلة العطرية" className="px-3 py-2 rounded-xl border text-xs" />
            <input type="text" value={form.inspired_by || ''} onChange={e => setForm({ ...form, inspired_by: e.target.value })} placeholder="مستوحى من / العطر الأصلي" className="px-3 py-2 rounded-xl border text-xs" />
            <input type="text" value={form.concentration || ''} onChange={e => setForm({ ...form, concentration: e.target.value })} placeholder="التركيز" className="px-3 py-2 rounded-xl border text-xs" />
            <input type="text" value={form.top_notes || ''} onChange={e => setForm({ ...form, top_notes: e.target.value })} placeholder="الافتتاحية (Top Notes)" className="px-3 py-2 rounded-xl border text-xs" />
            <input type="text" value={form.heart_notes || ''} onChange={e => setForm({ ...form, heart_notes: e.target.value })} placeholder="قلب العطر (Heart Notes)" className="px-3 py-2 rounded-xl border text-xs" />
            <input type="text" value={form.base_notes || ''} onChange={e => setForm({ ...form, base_notes: e.target.value })} placeholder="القاعدة (Base Notes)" className="px-3 py-2 rounded-xl border text-xs" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-5 py-2 rounded-full bg-[#fe9931] text-white text-xs font-bold flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> حفظ النوتات
            </button>
            <button type="button" onClick={() => setEditingId('')} className="px-4 py-2 rounded-full border text-xs font-bold">إلغاء</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => {
          const n = notesByProd.get(p.id);
          return (
            <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-start gap-3">
                  <img src={p.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 bg-gray-100" />
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-[#252a31] line-clamp-2">{p.name_ar}</p>
                    <p className="text-[11px] text-[#fe9931] font-semibold mt-0.5">{p.brand}</p>
                  </div>
                </div>
                {n ? (
                  <div className="mt-3 text-[11px] space-y-1 text-gray-600 bg-amber-50/40 p-2.5 rounded-xl">
                    <p><strong>العائلة:</strong> {n.scent_family}</p>
                    <p><strong>الافتتاحية:</strong> {n.top_notes || '—'}</p>
                    <p><strong>القلب:</strong> {n.heart_notes || '—'}</p>
                    <p><strong>القاعدة:</strong> {n.base_notes || '—'}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-gray-400">لم تُضف النوتات بعد</p>
                )}
              </div>
              <button type="button" onClick={() => startEdit(p.id)}
                className="w-full py-1.5 rounded-full border border-gray-200 hover:border-[#fe9931] hover:text-[#fe9931] text-xs font-bold">
                {n ? 'تعديل النوتات' : 'إضافة الهرم العطري'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

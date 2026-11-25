import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Sparkles, Boxes, Download, Upload, Star, Eye, EyeOff, Copy, Trash2, Edit3, Plus, Check, X, Link2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { neonDb } from '../../services/neonDb';
import { formatEGP } from '../../utils/arabicNumbers';
import { buildProductAdUrl } from '../../utils/adLinks';
import type { Product } from '../../types';

function safeCsvCell(val: unknown): string {
  const s = String(val ?? '').replace(/"/g, '""');
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guarded}"`;
}

export const InventoryAndCatalogPanel: React.FC<{ section: 'products' | 'inventory' | 'tools' }> = ({ section }) => {
  const { products, collections, updateProduct, toggleProductVisibility, deleteProduct, duplicateProduct, bulkAddProducts } = useStore();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (section === 'tools') {
      neonDb.getAllProductReviews().then(r => setReviews(r.reviews || [])).catch(() => {});
    }
  }, [section]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (catFilter !== 'all' && p.category !== catFilter && !(p.categories || []).includes(catFilter)) return false;
      if (q && !`${p.name_ar} ${p.brand} ${p.handle}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, catFilter]);

  const valuation = useMemo(() => {
    let retail = 0, cost = 0, units = 0;
    for (const p of filtered) {
      units += p.stock;
      retail += p.price * p.stock;
      cost += (p.cost_price ?? Math.round(p.price * 0.45)) * p.stock;
    }
    return { retail, cost, margin: retail - cost, units };
  }, [filtered]);

  const exportCsv = () => {
    const headers = ['ID', 'Name', 'Brand', 'Category', 'StartingPrice', 'CostPrice', 'Stock', 'Sizes', 'Active'];
    const rows = filtered.map(p => [
      p.id, p.name_ar, p.brand, p.category, p.price, p.cost_price ?? 0, p.stock, (p.size_options || []).join('|'), p.is_active
    ].map(safeCsvCell).join(','));
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `qamar-inventory-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = () => {
    const data = filtered.map(p => ({
      'المعرف': p.id,
      'اسم العطر': p.name_ar,
      'الدار': p.brand,
      'القسم': p.category,
      'أقل سعر': p.price,
      'التكلفة': p.cost_price ?? 0,
      'المخزون': p.stock,
      'الأحجام': (p.size_options || []).join(' / ')
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Qamar Inventory');
    XLSX.writeFile(wb, `qamar-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const mapped: Product[] = rows.filter(r => r['اسم العطر'] || r.name_ar).map((r, i) => ({
      id: String(r['المعرف'] || r.id || `Product_import_${Date.now()}_${i}`),
      handle: String(r['اسم العطر'] || r.name_ar),
      name_ar: String(r['اسم العطر'] || r.name_ar),
      name_en: String(r['اسم العطر'] || r.name_ar),
      brand: String(r['الدار'] || r.brand || 'Qamar Fragrances'),
      category: String(r['القسم'] || r.category || 'عطور-نيش-وعطور-عربية-للجنسين'),
      categories: [String(r['القسم'] || r.category || 'عطور-نيش-وعطور-عربية-للجنسين')],
      price: Number(r['أقل سعر'] || r.price || 100),
      cost_price: Number(r['التكلفة'] || r.cost_price || 45),
      stock: Number(r['المخزون'] || r.stock || 50),
      in_stock: true,
      is_active: true,
      is_featured: false,
      shop_order: 500 + i,
      size_options: ['5ml', '10ml', '30ml', '50ml', '100ml'],
      variants: [{ id: `var-${Date.now()}-${i}`, label: '100ml', price: Number(r['أقل سعر'] || r.price || 100) }],
      images: ['/qamar-images/626c06f2fe557fd9.webp'],
      description_ar: String(r['اسم العطر'] || r.name_ar),
      description_en: String(r['اسم العطر'] || r.name_ar),
      specs: {}
    }));
    const res = await bulkAddProducts(mapped);
    setMsg(`تم استيراد ${res.inserted} عطر بنجاح.`);
  };

  if (section === 'tools') {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
          <Star className="w-5 h-5 text-[#fe9931]" />
          <span>مراجعة تقييمات العملاء ({reviews.length})</span>
        </h1>
        <div className="bg-white border rounded-2xl divide-y">
          {reviews.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">لا توجد تقييمات حالياً.</p>
          ) : reviews.map(r => (
            <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-[#252a31]">{r.author_name} — <span className="text-[#fe9931]">{r.product_name_ar}</span></p>
                <p className="text-gray-600 mt-1">{r.comment}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-bold">{r.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={async () => { await neonDb.updateProductReviewStatus(r.id, 'approved'); setReviews(prev => prev.map(x => x.id === r.id ? { ...x, status: 'approved' } : x)); }}
                  className="p-2 rounded-lg bg-green-50 text-green-700"><Check className="w-4 h-4" /></button>
                <button type="button" onClick={async () => { await neonDb.updateProductReviewStatus(r.id, 'rejected'); setReviews(prev => prev.map(x => x.id === r.id ? { ...x, status: 'rejected' } : x)); }}
                  className="p-2 rounded-lg bg-amber-50 text-amber-700"><X className="w-4 h-4" /></button>
                <button type="button" onClick={async () => { await neonDb.deleteProductReview(r.id); setReviews(prev => prev.filter(x => x.id !== r.id)); }}
                  className="p-2 rounded-lg bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
          {section === 'inventory' ? <Boxes className="w-5 h-5 text-[#fe9931]" /> : <Sparkles className="w-5 h-5 text-[#fe9931]" />}
          <span>{section === 'inventory' ? 'تقييم المخزون وتقارير Excel' : `إدارة كتالوج العطور (${products.length})`}</span>
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportXlsx} className="px-4 py-2 rounded-xl bg-[#4f4335] text-white text-xs font-bold flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> تصدير Excel
          </button>
          <button type="button" onClick={exportCsv} className="px-4 py-2 rounded-xl border bg-white text-xs font-bold flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> تصدير CSV
          </button>
          <label className="px-4 py-2 rounded-xl bg-[#fe9931] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> استيراد Excel
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} className="hidden" />
          </label>
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-green-50 text-green-700 text-xs font-bold">{msg}</div>}

      {section === 'inventory' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border"><p className="text-xs text-gray-500">إجمالي الوحدات</p><p className="text-xl font-black mt-1">{valuation.units.toLocaleString()}</p></div>
          <div className="bg-white p-4 rounded-2xl border"><p className="text-xs text-gray-500">القيمة البيعية</p><p className="text-xl font-black text-[#fe9931] mt-1">{formatEGP(valuation.retail, false)}</p></div>
          <div className="bg-white p-4 rounded-2xl border"><p className="text-xs text-gray-500">تكلفة المخزون</p><p className="text-xl font-black mt-1">{formatEGP(valuation.cost, false)}</p></div>
          <div className="bg-white p-4 rounded-2xl border"><p className="text-xs text-gray-500">هامش الربح المتوقع</p><p className="text-xl font-black text-green-600 mt-1">{formatEGP(valuation.margin, false)}</p></div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم العطر أو الدار..."
          className="flex-1 min-w-[220px] px-4 py-2 rounded-xl border bg-white text-xs" />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-4 py-2 rounded-xl border bg-white text-xs">
          <option value="all">كل المجموعات</option>
          {collections.map(c => <option key={c.id} value={c.handle}>{c.title}</option>)}
        </select>
        <button type="button" onClick={() => setEditing({
          id: `Product_new_${Date.now()}`,
          handle: `new-perfume-${Date.now()}`,
          name_ar: '',
          name_en: '',
          brand: 'Qamar Fragrances',
          category: collections[0]?.handle || 'عطور-نيش-وعطور-عربية-للجنسين',
          categories: [collections[0]?.handle || 'عطور-نيش-وعطور-عربية-للجنسين'],
          price: 95,
          cost_price: 45,
          stock: 50,
          in_stock: true,
          is_active: true,
          is_featured: false,
          shop_order: 0,
          size_options: ['5ml', '10ml', '30ml', '50ml', '100ml'],
          variants: [
            { id: `var-5-${Date.now()}`, label: '5ml', price: 95 },
            { id: `var-10-${Date.now()}`, label: '10ml', price: 175 },
            { id: `var-50-${Date.now()}`, label: '50ml', price: 650 },
            { id: `var-100-${Date.now()}`, label: '100ml', price: 1200 }
          ],
          images: ['/qamar-images/626c06f2fe557fd9.webp'],
          description_ar: '',
          description_en: '',
          specs: {}
        })} className="px-4 py-2 rounded-xl bg-[#fe9931] text-white text-xs font-bold flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> إضافة عطر جديد
        </button>
      </div>

      {editing && (
        <div className="bg-white border-2 border-[#fe9931] rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm">{editing.name_ar ? `تعديل: ${editing.name_ar}` : 'عطر جديد'}</h3>
            <button type="button" onClick={() => setEditing(null)}><X className="w-4 h-4 text-gray-500" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <input type="text" value={editing.name_ar} onChange={e => setEditing({ ...editing, name_ar: e.target.value, handle: editing.handle || e.target.value })} placeholder="اسم العطر" className="px-3 py-2 border rounded-xl" />
            <input type="text" value={editing.brand} onChange={e => setEditing({ ...editing, brand: e.target.value })} placeholder="الدار" className="px-3 py-2 border rounded-xl" />
            <input type="number" value={editing.stock} onChange={e => setEditing({ ...editing, stock: Number(e.target.value) })} placeholder="المخزون" className="px-3 py-2 border rounded-xl" />
            <input type="number" value={editing.cost_price ?? 0} onChange={e => setEditing({ ...editing, cost_price: Number(e.target.value) })} placeholder="التكلفة" className="px-3 py-2 border rounded-xl" />
            <select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value, categories: [e.target.value] })} className="px-3 py-2 border rounded-xl bg-white">
              {collections.map(c => <option key={c.id} value={c.handle}>{c.title}</option>)}
            </select>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={editing.is_featured} onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} className="accent-[#fe9931]" /> عرض في "عطورنا الفائقة"</label>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-600">أسعار الأحجام:</p>
            <div className="flex flex-wrap gap-2">
              {editing.variants.map((v, idx) => (
                <div key={v.id} className="flex items-center gap-1.5 border rounded-xl px-2.5 py-1.5 text-xs">
                  <span className="font-bold">{v.label}:</span>
                  <input type="number" value={v.price} onChange={e => {
                    const next = [...editing.variants];
                    next[idx] = { ...v, price: Number(e.target.value) };
                    setEditing({ ...editing, variants: next, price: Math.min(...next.map(x => x.price)) });
                  }} className="w-16 px-1.5 py-0.5 border rounded" />
                </div>
              ))}
            </div>
          </div>
          <button type="button" onClick={async () => {
            const exists = products.some(p => p.id === editing.id);
            if (exists) await updateProduct(editing.id, editing);
            else await bulkAddProducts([editing]);
            setEditing(null);
            setMsg('تم حفظ بيانات العطر.');
          }} className="px-6 py-2 rounded-full bg-[#fe9931] text-white text-xs font-bold">
            حفظ التغييرات
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-xs text-right">
            <thead className="bg-gray-50 font-bold text-gray-500 sticky top-0">
              <tr>
                <th className="p-3">العطر</th>
                <th className="p-3">الدار</th>
                <th className="p-3">الأحجام</th>
                <th className="p-3">يبدأ من</th>
                <th className="p-3">المخزون</th>
                <th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 120).map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="p-3 flex items-center gap-2.5">
                    <img src={p.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 bg-gray-100" />
                    <span className="font-bold text-[#252a31] line-clamp-1">{p.name_ar}</span>
                  </td>
                  <td className="p-3 text-gray-500">{p.brand}</td>
                  <td className="p-3 text-gray-500">{(p.size_options || []).join(' · ')}</td>
                  <td className="p-3 font-bold text-[#fe9931]">{p.price} ج.م</td>
                  <td className="p-3 font-bold">{p.stock}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid={`btn-copy-ad-${p.id}`}
                        onClick={async () => {
                          const url = buildProductAdUrl({ handle: p.handle, source: 'facebook', medium: 'cpc' });
                          try { await navigator.clipboard.writeText(url); } catch {}
                          setMsg(`تم نسخ رابط إعلان فيسبوك المشفّر لعطر "${p.name_ar}" جاهزاً للـ Carousel!`);
                        }}
                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-colors"
                        title="نسخ رابط مشفّر جاهز لإعلان فيسبوك/إنستجرام"
                      >
                        <Link2 className="w-3 h-3" /> رابط إعلان
                      </button>
                      <button type="button" onClick={() => setEditing(p)} className="p-1.5 rounded-lg hover:bg-gray-100" title="تعديل"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => toggleProductVisibility(p.id, !p.is_active)} className="p-1.5 rounded-lg hover:bg-gray-100" title="إظهار/إخفاء">
                        {p.is_active ? <Eye className="w-3.5 h-3.5 text-green-600" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                      <button type="button" onClick={() => duplicateProduct(p.id)} className="p-1.5 rounded-lg hover:bg-gray-100" title="نسخ"><Copy className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

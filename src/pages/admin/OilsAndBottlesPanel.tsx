import React, { useState, useEffect } from 'react';
import { Droplets, Plus, Trash2, PackageCheck, RefreshCw } from 'lucide-react';
import { neonDb } from '../../services/neonDb';
import type { OilReserve, BottleSupply } from '../../types';

export const OilsAndBottlesPanel: React.FC = () => {
  const [oils, setOils] = useState<OilReserve[]>([]);
  const [bottles, setBottles] = useState<BottleSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [perfumeTitle, setPerfumeTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [supplier, setSupplier] = useState('');
  const [stockMl, setStockMl] = useState('500');
  const [costPerMl, setCostPerMl] = useState('9');
  const [concPct, setConcPct] = useState('32');
  const [macerationDays, setMacerationDays] = useState('21');
  const [batchCode, setBatchCode] = useState('');
  const [shelfLocation, setShelfLocation] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [o, b] = await Promise.all([neonDb.getOilReserves(), neonDb.getBottleSupplies()]);
      setOils(o);
      setBottles(b);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const addOil = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await neonDb.upsertOilReserve({
      perfume_title: perfumeTitle,
      brand,
      oil_supplier: supplier,
      stock_ml: Number(stockMl),
      cost_per_ml: Number(costPerMl),
      concentration_pct: Number(concPct),
      maceration_days: Number(macerationDays),
      batch_code: batchCode,
      shelf_location: shelfLocation
    });
    if (res.success) {
      setMsg('تم حفظ مخزون الزيت العطري.');
      setPerfumeTitle(''); setBrand(''); setBatchCode('');
      void load();
    } else setMsg(res.error || 'تعذر الحفظ');
  };

  const adjustBottle = async (b: BottleSupply, delta: number) => {
    const next = Math.max(0, b.stock_qty + delta);
    setBottles(prev => prev.map(x => x.id === b.id ? { ...x, stock_qty: next } : x));
    await neonDb.updateBottleSupply(b.id, next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
            <Droplets className="w-5 h-5 text-[#fe9931]" />
            <span>مخزون الزيوت العطرية الخام والزجاجات الفارغة</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            متابعة رصيد الزيت بالمللي، نسبة التركيز، أيام التعتيق، وحساب عدد العبوات القابلة للتعبئة
          </p>
        </div>
        <button type="button" onClick={load} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          تحديث
        </button>
      </div>

      {msg && <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold">{msg}</div>}

      {/* Empty Atomizer Bottles Grid */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="font-bold text-sm text-[#252a31] flex items-center gap-2 mb-4">
          <PackageCheck className="w-4 h-4 text-[#fe9931]" />
          <span>رصيد الزجاجات الفارغة والبخاخات</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bottles.map(b => {
            const low = b.stock_qty <= b.min_threshold;
            return (
              <div key={b.id} className={`p-4 rounded-xl border ${low ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50/40'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#fe9931] text-base">{b.size_label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {b.stock_qty} زجاجة
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{b.bottle_type}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">التكلفة: {b.cost_per_unit} ج.م | حد التنبيه: {b.min_threshold}</p>
                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={() => adjustBottle(b, -10)} className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs font-bold">-10</button>
                  <button type="button" onClick={() => adjustBottle(b, 10)} className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs font-bold">+10</button>
                  <button type="button" onClick={() => adjustBottle(b, 50)} className="px-2.5 py-1 rounded-lg bg-[#fe9931] text-white text-xs font-bold">+50</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add Raw Oil Batch */}
      <form onSubmit={addOil} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-bold text-sm text-[#252a31] flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#fe9931]" />
          <span>إضافة / تحديث دفعة زيت عطري خام</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input type="text" required value={perfumeTitle} onChange={e => setPerfumeTitle(e.target.value)} placeholder="اسم العطر"
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs" />
          <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="الدار العطرية (مثال: Amouage)"
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs" />
          <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="المورد"
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs" />
          <input type="text" value={batchCode} onChange={e => setBatchCode(e.target.value)} placeholder="كود التشغيلة (Batch)"
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs" />
          <input type="number" step="0.1" value={stockMl} onChange={e => setStockMl(e.target.value)} placeholder="الكمية (مللي)"
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs" />
          <input type="number" step="0.1" value={costPerMl} onChange={e => setCostPerMl(e.target.value)} placeholder="تكلفة الملي (ج.م)"
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs" />
          <input type="number" value={concPct} onChange={e => setConcPct(e.target.value)} placeholder="نسبة التركيز %"
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs" />
          <input type="text" value={shelfLocation} onChange={e => setShelfLocation(e.target.value)} placeholder="الرف / المكان"
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs" />
        </div>
        <button type="submit" className="px-5 py-2 rounded-full bg-[#fe9931] text-white text-xs font-bold">
          حفظ في مخزون الزيوت
        </button>
      </form>

      {/* Raw Oils Table with Decanting Yield Calculator */}
      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-gray-50 text-gray-500 font-bold">
              <tr>
                <th className="p-3">العطر</th>
                <th className="p-3">الدار</th>
                <th className="p-3">رصيد الزيت</th>
                <th className="p-3">التركيز</th>
                <th className="p-3">التعتيق</th>
                <th className="p-3">إنتاجية متوقعة (10ml / 50ml)</th>
                <th className="p-3">الرف / التشغيلة</th>
                <th className="p-3">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">جاري التحميل...</td></tr>
              ) : oils.map(o => {
                const pct = Math.max(10, o.concentration_pct || 30) / 100;
                const totalPerfumeMl = Math.round(Number(o.stock_ml) / pct);
                const bottles10 = Math.floor(totalPerfumeMl / 10);
                const bottles50 = Math.floor(totalPerfumeMl / 50);
                return (
                  <tr key={o.id} className="hover:bg-gray-50/70">
                    <td className="p-3 font-bold text-[#252a31]">{o.perfume_title}</td>
                    <td className="p-3 text-gray-500">{o.brand}</td>
                    <td className="p-3 font-bold text-[#fe9931]">{o.stock_ml} ml</td>
                    <td className="p-3">{o.concentration_pct}%</td>
                    <td className="p-3">{o.maceration_days} يوم</td>
                    <td className="p-3 text-gray-600">{bottles10} × 10ml | {bottles50} × 50ml</td>
                    <td className="p-3 text-gray-500">{o.shelf_location} {o.batch_code && `(${o.batch_code})`}</td>
                    <td className="p-3">
                      <button type="button" onClick={async () => { await neonDb.deleteOilReserve(o.id); void load(); }}
                        className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

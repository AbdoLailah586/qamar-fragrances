import React, { useState, useMemo } from 'react';
import { Calculator, Tag, Printer, ClipboardCheck, AlertTriangle, Package, Truck } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { neonDb } from '../../services/neonDb';
import { formatEGP } from '../../utils/arabicNumbers';

export const PerfumeOperationsPanels: React.FC<{ section: 'pricing' | 'labels' | 'quality' | 'stocktake' | 'reorder' | 'suppliers' }> = ({ section }) => {
  const { products, updateProduct } = useStore();

  // Pricing Calculator State
  const [oilCostPerMl, setOilCostPerMl] = useState(10);
  const [concPct, setConcPct] = useState(32);
  const [alcoholPerMl, setAlcoholPerMl] = useState(0.5);
  const [bottleCost, setBottleCost] = useState(25);
  const [packagingCost, setPackagingCost] = useState(15);
  const [targetMarginPct, setTargetMarginPct] = useState(45);

  // Label Printer State
  const [labelSearch, setLabelSearch] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [labelSize, setLabelSize] = useState('50ml');

  // Suppliers State
  const [supProdId, setSupProdId] = useState(products[0]?.id || '');
  const [supName, setSupName] = useState('');
  const [supPrice, setSupPrice] = useState('');
  const [quotes, setQuotes] = useState<any[]>([]);

  const decantRows = useMemo(() => {
    const sizes = [5, 10, 30, 50, 100];
    return sizes.map(ml => {
      const oilMl = ml * (concPct / 100);
      const alcMl = ml - oilMl;
      const liquidCost = oilMl * oilCostPerMl + alcMl * alcoholPerMl;
      const bCost = ml <= 10 ? bottleCost * 0.6 : bottleCost;
      const totalCost = liquidCost + bCost + packagingCost;
      const recommendedPrice = Math.ceil(totalCost / Math.max(0.1, 1 - targetMarginPct / 100) / 5) * 5;
      return { ml, oilMl, totalCost, recommendedPrice, profit: recommendedPrice - totalCost };
    });
  }, [oilCostPerMl, concPct, alcoholPerMl, bottleCost, packagingCost, targetMarginPct]);

  if (section === 'pricing') {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
          <Calculator className="w-5 h-5 text-[#fe9931]" />
          <span>حاسبة تسعير الملي والتعبئة والهامش</span>
        </h1>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
          <label className="space-y-1 font-bold"><span>تكلفة مللي الزيت (ج.م)</span><input type="number" value={oilCostPerMl} onChange={e => setOilCostPerMl(Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl" /></label>
          <label className="space-y-1 font-bold"><span>نسبة التركيز %</span><input type="number" value={concPct} onChange={e => setConcPct(Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl" /></label>
          <label className="space-y-1 font-bold"><span>تكلفة مللي المذيب</span><input type="number" step="0.1" value={alcoholPerMl} onChange={e => setAlcoholPerMl(Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl" /></label>
          <label className="space-y-1 font-bold"><span>تكلفة الزجاجة (ج.م)</span><input type="number" value={bottleCost} onChange={e => setBottleCost(Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl" /></label>
          <label className="space-y-1 font-bold"><span>العلبة والاستيكر</span><input type="number" value={packagingCost} onChange={e => setPackagingCost(Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl" /></label>
          <label className="space-y-1 font-bold"><span>هامش الربح المستهدف %</span><input type="number" value={targetMarginPct} onChange={e => setTargetMarginPct(Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl" /></label>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-xs text-right">
            <thead className="bg-gray-50 font-bold text-gray-600">
              <tr><th className="p-3">الحجم</th><th className="p-3">كمية الزيت الصافي</th><th className="p-3">إجمالي التكلفة</th><th className="p-3">السعر المقترح</th><th className="p-3">صافي الربح</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {decantRows.map(r => (
                <tr key={r.ml}>
                  <td className="p-3 font-extrabold text-[#fe9931]">{r.ml}ml</td>
                  <td className="p-3">{r.oilMl.toFixed(1)} ml</td>
                  <td className="p-3 font-bold">{r.totalCost.toFixed(0)} ج.م</td>
                  <td className="p-3 font-extrabold text-[#252a31]">{r.recommendedPrice} ج.م</td>
                  <td className="p-3 font-bold text-green-600">+{r.profit.toFixed(0)} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'labels') {
    const matches = products.filter(p => p.name_ar.toLowerCase().includes(labelSearch.toLowerCase())).slice(0, 24);
    const chosen = products.filter(p => selectedLabelIds.includes(p.id));
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#fe9931]" />
            <span>طباعة استيكرات زجاجات العطور</span>
          </h1>
          <div className="flex items-center gap-2">
            <select value={labelSize} onChange={e => setLabelSize(e.target.value)} className="px-3 py-2 border rounded-xl text-xs bg-white">
              {['5ml', '10ml', '30ml', '50ml', '100ml', 'تولا'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" onClick={() => window.print()} className="px-4 py-2 rounded-full bg-[#fe9931] text-white text-xs font-bold flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> طباعة الاستيكرات
            </button>
          </div>
        </div>

        <input type="text" value={labelSearch} onChange={e => setLabelSearch(e.target.value)} placeholder="اختر العطور لطباعة ملصقات الزجاجات..."
          className="w-full max-w-md px-4 py-2 rounded-xl border bg-white text-xs print:hidden" />

        <div className="flex flex-wrap gap-2 print:hidden">
          {matches.map(p => {
            const on = selectedLabelIds.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => setSelectedLabelIds(prev => on ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                className={`px-3 py-1.5 rounded-full text-xs border ${on ? 'bg-[#fe9931] text-white border-[#fe9931]' : 'bg-white border-gray-200'}`}>
                {p.name_ar}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {(chosen.length ? chosen : matches.slice(0, 4)).map(p => {
            const v = p.variants?.find(x => x.label === labelSize) || p.variants?.[0];
            return (
              <div key={p.id} className="bg-white border-2 border-dashed border-[#4f4335] rounded-xl p-3 text-center space-y-1">
                <p className="text-[10px] font-extrabold tracking-widest uppercase text-[#fe9931]">QAMAR FRAGRANCES</p>
                <p className="text-xs font-extrabold text-[#252a31] line-clamp-2">{p.name_ar}</p>
                <p className="text-[11px] text-gray-500">{v?.label || labelSize} • {p.concentration || 'Extrait'}</p>
                <p className="text-sm font-black text-[#252a31]">{formatEGP(v?.price ?? p.price)}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (section === 'quality') {
    const missingDesc = products.filter(p => !p.description_ar || p.description_ar === p.name_ar);
    const missingPrice = products.filter(p => !p.price || p.price <= 0);
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-[#fe9931]" /><span>مراجعة جودة البيانات والكتالوج</span></h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border"><p className="text-xs text-gray-500">إجمالي العطور</p><p className="text-2xl font-black mt-1">{products.length}</p></div>
          <div className="bg-white p-5 rounded-2xl border"><p className="text-xs text-gray-500">تحتاج وصف عطري تفصيلي</p><p className="text-2xl font-black text-[#fe9931] mt-1">{missingDesc.length}</p></div>
          <div className="bg-white p-5 rounded-2xl border"><p className="text-xs text-gray-500">بدون سعر</p><p className="text-2xl font-black text-red-600 mt-1">{missingPrice.length}</p></div>
        </div>
      </div>
    );
  }

  if (section === 'stocktake') {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2"><Package className="w-5 h-5 text-[#fe9931]" /><span>الجرد السريع للمخزون</span></h1>
        <div className="bg-white border rounded-2xl divide-y max-h-[65vh] overflow-y-auto">
          {products.slice(0, 80).map(p => (
            <div key={p.id} className="p-3 flex items-center justify-between gap-4 text-xs">
              <span className="font-bold text-[#252a31] truncate">{p.name_ar}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => updateProduct(p.id, { stock: Math.max(0, p.stock - 1) })} className="px-2.5 py-1 border rounded-lg">-1</button>
                <span className="w-10 text-center font-extrabold">{p.stock}</span>
                <button type="button" onClick={() => updateProduct(p.id, { stock: p.stock + 5 })} className="px-2.5 py-1 bg-[#fe9931] text-white rounded-lg">+5</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'reorder') {
    const lowStock = products.filter(p => p.stock <= 10);
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-[#fe9931]" /><span>نواقص العطور وإعادة الطلب ({lowStock.length})</span></h1>
        {lowStock.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border text-center text-sm text-green-700 font-bold">كل العطور متوفرة بمخزون آمن (&gt; 10 وحدات).</div>
        ) : (
          <div className="bg-white border rounded-2xl divide-y">
            {lowStock.map(p => (
              <div key={p.id} className="p-3.5 flex items-center justify-between text-xs">
                <span className="font-bold">{p.name_ar}</span>
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold">متبقي {p.stock}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // suppliers
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold text-[#252a31] flex items-center gap-2"><Truck className="w-5 h-5 text-[#fe9931]" /><span>عروض أسعار موردي الزيوت والزجاجات</span></h1>
      <form
        onSubmit={async e => {
          e.preventDefault();
          await neonDb.addSupplierQuote(supProdId, supName, Number(supPrice));
          setQuotes(await neonDb.getSupplierQuotes(supProdId));
          setSupName(''); setSupPrice('');
        }}
        className="bg-white border rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
      >
        <select value={supProdId} onChange={async e => { setSupProdId(e.target.value); setQuotes(await neonDb.getSupplierQuotes(e.target.value)); }} className="px-3 py-2 border rounded-xl">
          {products.slice(0, 60).map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
        </select>
        <input type="text" required value={supName} onChange={e => setSupName(e.target.value)} placeholder="اسم المورد" className="px-3 py-2 border rounded-xl" />
        <input type="number" required value={supPrice} onChange={e => setSupPrice(e.target.value)} placeholder="السعر المورد (ج.م)" className="px-3 py-2 border rounded-xl" />
        <button type="submit" className="px-4 py-2 rounded-full bg-[#fe9931] text-white font-bold">تسجيل عرض</button>
      </form>
      <div className="bg-white border rounded-2xl divide-y">
        {quotes.map(q => (
          <div key={q.id} className="p-3.5 flex justify-between text-xs"><span className="font-bold">{q.supplier_name}</span><span className="text-[#fe9931] font-extrabold">{q.quoted_price} ج.م</span></div>
        ))}
      </div>
    </div>
  );
};

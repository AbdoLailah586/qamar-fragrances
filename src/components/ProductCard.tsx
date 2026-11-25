import React from 'react';
import { Heart } from 'lucide-react';
import type { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../utils/arabicNumbers';

interface Props {
  product: Product;
}

export const ProductCard: React.FC<Props> = ({ product }) => {
  const { openProduct, buyNow, isInWishlist, toggleWishlist } = useStore();
  const hasMultipleVariants = (product.variants?.length || 0) > 1;
  const fav = isInWishlist(product.id);

  return (
    <div className="bg-white flex flex-col justify-between group rounded-2xl p-2 border border-gray-100 shadow-[0_1px_6px_rgba(0,0,0,0.03)] md:rounded-none md:p-0 md:border-0 md:shadow-none">
      <div>
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#f8f9fa] border border-gray-100">
          <button
            type="button"
            onClick={() => openProduct(product)}
            className="w-full h-full block focus:outline-none"
          >
            <img
              src={product.images?.[0] || '/qamar-images/626c06f2fe557fd9.webp'}
              alt={product.name_ar}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </button>

          <button
            type="button"
            onClick={e => { e.stopPropagation(); toggleWishlist(product.id); }}
            aria-label="المفضلة"
            className={`absolute top-2.5 left-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition ${
              fav ? 'bg-[#fe9931] text-white' : 'bg-white/90 text-gray-500 hover:text-[#fe9931]'
            }`}
          >
            <Heart className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
          </button>

          {!product.in_stock && (
            <span className="absolute top-2.5 right-2.5 bg-gray-900/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
              غير متوفر
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => openProduct(product)}
          className="w-full text-right mt-2.5 md:mt-3 focus:outline-none"
        >
          <h3 className="text-[13px] md:text-[15px] font-semibold md:font-medium text-[#252a31] line-clamp-2 min-h-[38px] md:min-h-[42px] leading-snug group-hover:text-[#fe9931] transition">
            {product.name_ar}
          </h3>
        </button>

        <div className="mt-1 md:mt-1.5 mb-2.5 md:mb-3 flex items-center gap-2">
          <span className="text-[14px] md:text-[16px] font-bold text-[#252a31]">
            {formatEGP(product.price)}
          </span>
          {product.original_price && product.original_price > product.price && (
            <span className="text-[11px] md:text-xs text-gray-400 line-through">
              {formatEGP(product.original_price)}
            </span>
          )}
        </div>
      </div>

      {hasMultipleVariants ? (
        <button
          type="button"
          onClick={() => openProduct(product)}
          className="w-full py-2 md:py-2.5 px-3 md:px-4 rounded-full border border-gray-300 text-xs md:text-sm font-semibold md:font-medium text-[#252a31] hover:border-[#fe9931] hover:text-[#fe9931] transition text-center"
        >
          حدد اختيارك
        </button>
      ) : (
        <button
          type="button"
          disabled={!product.in_stock}
          onClick={() => buyNow(product, 1, product.variants?.[0] || null)}
          className="w-full py-2 md:py-2.5 px-3 md:px-4 rounded-full border border-gray-300 text-xs md:text-sm font-semibold md:font-medium text-[#252a31] hover:border-[#fe9931] hover:bg-[#fe9931] hover:text-white disabled:opacity-50 transition text-center"
        >
          اشتري الآن
        </button>
      )}
    </div>
  );
};

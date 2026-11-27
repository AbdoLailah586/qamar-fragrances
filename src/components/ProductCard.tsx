import React from 'react';
import { Heart } from 'lucide-react';
import type { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../utils/arabicNumbers';
import { WatermarkOverlay } from './WatermarkOverlay';

interface Props {
  product: Product;
  index?: number;
}

export const ProductCard: React.FC<Props> = ({ product, index = 0 }) => {
  const { openProduct, buyNow, isInWishlist, toggleWishlist } = useStore();
  const hasMultipleVariants = (product.variants?.length || 0) > 1;
  const fav = isInWishlist(product.id);
  const primaryImage = product.images?.[0] || '/qamar-images/626c06f2fe557fd9.webp';
  const secondaryImage =
    product.images?.[1] && product.images[1] !== primaryImage ? product.images[1] : null;

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }}
      className="qamar-card-reveal bg-white flex flex-col justify-between group rounded-2xl p-2 border border-gray-100 shadow-[0_1px_6px_rgba(0,0,0,0.03)] md:rounded-2xl md:p-2 md:border-transparent md:shadow-none md:hover:border-gray-100 md:hover:shadow-[0_10px_28px_rgba(79,67,53,0.08)] md:hover:-translate-y-1 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
      <div>
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#f8f9fa] border border-gray-100">
          <button
            type="button"
            onClick={() => openProduct(product)}
            className="w-full h-full block focus:outline-none relative overflow-hidden"
          >
            {/* Primary studio image: fades smoothly to second image if available, otherwise zooms fluidly */}
            <img
              src={primaryImage}
              alt={product.name_ar}
              loading="lazy"
              draggable={false}
              onDragStart={e => e.preventDefault()}
              onContextMenu={e => e.preventDefault()}
              className={`w-full h-full object-cover will-change-transform transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                secondaryImage
                  ? 'group-hover:opacity-0 group-hover:scale-105'
                  : 'group-hover:scale-[1.07]'
              }`}
            />

            {/* Secondary bottle/product image shown smoothly on hover */}
            {secondaryImage && (
              <img
                src={secondaryImage}
                alt={`${product.name_ar} — صورة إضافية`}
                loading="lazy"
                draggable={false}
                onDragStart={e => e.preventDefault()}
                onContextMenu={e => e.preventDefault()}
                className="absolute inset-0 w-full h-full object-cover opacity-0 scale-100 will-change-transform transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:scale-[1.06]"
              />
            )}
            <WatermarkOverlay compact />
          </button>

          {secondaryImage && (
            <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/85 backdrop-blur-sm shadow-xs opacity-75 group-hover:opacity-100 transition-opacity duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#252a31] group-hover:bg-gray-300 transition-colors" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-[#fe9931] transition-colors" />
            </div>
          )}

          <button
            type="button"
            onClick={e => { e.stopPropagation(); toggleWishlist(product.id); }}
            aria-label="المفضلة"
            className={`absolute top-2.5 left-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 hover:scale-110 active:scale-90 ${
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
          <h3 className="text-[13px] md:text-[15px] font-semibold md:font-medium text-[#252a31] line-clamp-2 min-h-[38px] md:min-h-[42px] leading-snug group-hover:text-[#fe9931] transition-colors duration-300">
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
          className="w-full py-2 md:py-2.5 px-3 md:px-4 rounded-full border border-gray-300 text-xs md:text-sm font-semibold md:font-medium text-[#252a31] hover:border-[#fe9931] hover:text-[#fe9931] active:scale-[0.98] transition-all duration-200 text-center"
        >
          حدد اختيارك
        </button>
      ) : (
        <button
          type="button"
          disabled={!product.in_stock}
          onClick={() => buyNow(product, 1, product.variants?.[0] || null)}
          className="w-full py-2 md:py-2.5 px-3 md:px-4 rounded-full border border-gray-300 text-xs md:text-sm font-semibold md:font-medium text-[#252a31] hover:border-[#fe9931] hover:bg-[#fe9931] hover:text-white active:scale-[0.98] disabled:opacity-50 transition-all duration-200 text-center"
        >
          اشتري الآن
        </button>
      )}
    </div>
  );
};

import React from 'react';
import { useStore } from '../context/StoreContext';

export const Footer: React.FC = () => {
  const { settings, navigate } = useStore();
  const socialHref = (name: string) => settings.social_links.find(s => s.name === name)?.link || '#';

  return (
    <footer className="bg-white border-t border-[#eaeaea] mt-16 py-12 px-4">
      <div className="max-w-[1320px] mx-auto flex flex-col items-center justify-center gap-6 text-center">
        <button type="button" onClick={() => navigate('home')} className="focus:outline-none">
          <img
            src={settings.logo_url || '/qamar-images/626c06f2fe557fd9.webp'}
            alt="Qamar Fragrances"
            className="h-20 w-auto object-contain mx-auto"
          />
        </button>

        <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-semibold text-[#252a31]">
          <button type="button" onClick={() => navigate('home')} className="hover:text-[#fe9931] transition">
            الرئيسية
          </button>
          <button type="button" onClick={() => navigate('shop', { category: 'all', search: '' })} className="hover:text-[#fe9931] transition">
            تسوّق
          </button>
          <button type="button" onClick={() => navigate('contact')} className="hover:text-[#fe9931] transition">
            تواصل معنا
          </button>
          <button type="button" onClick={() => navigate('track-order')} className="hover:text-[#fe9931] transition">
            تتبع طلبك
          </button>
        </div>

        <div className="flex items-center justify-center gap-3">
          <a href={socialHref('facebook')} target="_blank" rel="noreferrer" aria-label="Facebook"
             className="w-9 h-9 rounded-full border border-gray-300 text-[#252a31] flex items-center justify-center hover:border-[#fe9931] hover:text-[#fe9931] transition text-xs font-bold">
            f
          </a>
          <a href={socialHref('instagram')} target="_blank" rel="noreferrer" aria-label="Instagram"
             className="w-9 h-9 rounded-full border border-gray-300 text-[#252a31] flex items-center justify-center hover:border-[#fe9931] hover:text-[#fe9931] transition text-xs font-bold">
            IG
          </a>
          <a href={socialHref('whatsapp')} target="_blank" rel="noreferrer" aria-label="WhatsApp"
             className="w-9 h-9 rounded-full border border-gray-300 text-[#252a31] flex items-center justify-center hover:border-[#fe9931] hover:text-[#fe9931] transition text-xs font-bold">
            WA
          </a>
          <a href={socialHref('tiktok')} target="_blank" rel="noreferrer" aria-label="TikTok"
             className="w-9 h-9 rounded-full border border-gray-300 text-[#252a31] flex items-center justify-center hover:border-[#fe9931] hover:text-[#fe9931] transition text-xs font-bold">
            TT
          </a>
        </div>

        <p className="text-xs text-gray-400">
          {settings.address_ar} • {settings.phone}
        </p>
      </div>
    </footer>
  );
};

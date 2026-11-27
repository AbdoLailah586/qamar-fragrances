import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product, CartItem, Order, StoreCollection, StoreSettings, ProductVariant } from '../types';
import { neonDb } from '../services/neonDb';
import { useAuth } from './AuthContext';
import { deviceIsOnline, readOfflineCatalog, saveOfflineCatalog } from '../services/offlineCatalog';
import { readStorage, writeStorage, readStoredArray, readStoredJson, writeStoredJson } from '../utils/browserStorage';
import { getOrCaptureVisitorAttribution, type VisitorAttribution } from '../utils/visitorAttribution';
import { applyPageSeo, buildStoreJsonLd } from '../utils/seo';
import { initMetaPixel, normalizeMetaPixelId, trackMetaEvent } from '../utils/metaPixel';

export type AppTab =
  | 'home'
  | 'shop'
  | 'product'
  | 'contact'
  | 'cart'
  | 'checkout'
  | 'order-success'
  | 'track-order'
  | 'profile'
  | 'admin'
  | 'terms'
  | 'privacy'
  | 'refund'
  | 'shipping';

const defaultSettings: StoreSettings = {
  store_name: 'Qamar Fragrances',
  store_name_ar: 'قمر للعطور',
  tagline_ar: 'نحن علامة متخصصة في تقديم عطور تجمع بين الفخامة والثبات والهوية المميزة، بنفحات مختارة بعناية تناسب مختلف الأذواق والمناسبات، أثرًا يدوم مع كل حضور',
  logo_url: '/qamar-images/626c06f2fe557fd9.webp',
  favicon_url: '/qamar-images/dcfeffa82651d149.png',
  primary_color: '#fe9931',
  ink_normal: '#4f4335',
  ink_subdued: '#585757',
  whatsapp_number: '201003732029',
  phone: '+20 10 03732029',
  email: 'qamaraboalnaga@gmail.com',
  address_ar: 'المنصورة - شارع الإمام محمد عبده - فى مقدمة شارع المدارس',
  shipping_fee: 60,
  free_shipping_threshold: 1500,
  social_links: [
    { name: 'facebook', link: 'https://web.facebook.com/QamarPerfu/' },
    { name: 'instagram', link: 'https://www.instagram.com/qamar_fragrances' },
    { name: 'whatsapp', link: 'http://wa.me/+201003732029' },
    { name: 'tiktok', link: 'https://www.tiktok.com/@qamaraboalnaga' }
  ],
  hero_heading: 'عطور محاكاة بجودة مطابقة للأوريجينال',
  hero_subheading: 'في قمر للعطور نؤمن أن العطر ليس مجرد رائحة، بل هو انعكاس للشخصية ولمسة تترك أثرًا في كل مكان. لذلك نصنع عطورًا تجمع بين الفخامة والثبات والتفاصيل الراقية.',
  hero_image: '/qamar-images/a182f7810c27ec59.webp',
  hero_mobile_image: '/qamar-images/66b77b422345ca7e.webp',
  collections_heading: 'مجوعاتنا المميزة لك',
  featured_heading: 'عطورنا الفائقة',
  announcement_enabled: false,
  announcement_text: 'لا تنسى السؤال عن عروضنا المستمرة'
};

const defaultCollections: StoreCollection[] = [
  { id: 'ProductCollection_cmov7nblb05st01ye091yfvxs', handle: 'عطور-رجالى-ديزاينر', title: 'عطور رجالى ديزاينر', image: '/qamar-images/9fafdf14cb15c244.webp', sort_order: 0, products_count: 88 },
  { id: 'ProductCollection_cmov7nblb05su01yeaa6ydqpa', handle: 'عطور-نيش-وعطور-عربية-للجنسين', title: 'عطور نيش وعطور عربية للجنسين', image: '/qamar-images/a752eeaaacea505d.webp', sort_order: 1, products_count: 188 },
  { id: 'ProductCollection_cmov7nblb05sv01yeaeuyhoo1', handle: 'عطور-نسائى-ديزاينر', title: 'عطور نسائى ديزاينر', image: '/qamar-images/511670dfe402e0ad.webp', sort_order: 2, products_count: 81 },
  { id: 'ProductCollection_cmov7nblb05sw01ye9gqp3put', handle: 'مسك-الخام-زيوت-عطرية', title: 'مسك الخام & زيوت عطرية', image: '/qamar-images/5b5ed81b61260783.webp', sort_order: 3, products_count: 7 },
  { id: 'ProductCollection_cmov7nblb05sx01ye9ehdhxtx', handle: 'بادى-سبلاش-لوشن-للجسم', title: 'بادى سبلاش & لوشن للجسم', image: '/qamar-images/2ad169d5e0b8b2aa.webp', sort_order: 4, products_count: 6 },
  { id: 'ProductCollection_cmotqo4ws01th01m858luff1b', handle: 'عطور-نيش', title: 'فواحات & مباخر & بخور', image: '/qamar-images/d7a6fbf5d536e2fc.webp', sort_order: 5, products_count: 29 }
];

interface RouteState {
  tab: AppTab;
  category: string;
  search: string;
  productHandle?: string;
}

function parseUrlRoute(): RouteState {
  if (typeof window === 'undefined') return { tab: 'home', category: 'all', search: '' };
  let rawPath = window.location.pathname;
  try {
    rawPath = decodeURIComponent(window.location.pathname);
  } catch {}
  let pathname = rawPath.replace(/^\/(ar|en)(?=\/|$)/, '') || '/';
  if (pathname !== '/' && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  const sp = new URLSearchParams(window.location.search);

  if (pathname === '/' || pathname === '') return { tab: 'home', category: 'all', search: '' };
  if (pathname === '/shop') {
    return { tab: 'shop', category: sp.get('category') || 'all', search: sp.get('q') || sp.get('search') || '' };
  }
  if (pathname.startsWith('/product/all/')) {
    const handle = pathname.slice('/product/all/'.length);
    return { tab: 'product', category: 'all', search: '', productHandle: handle };
  }
  if (pathname.startsWith('/product/')) {
    const col = pathname.slice('/product/'.length);
    if (col && col !== 'all') return { tab: 'shop', category: col, search: '' };
  }
  if (pathname === '/contact-us' || pathname === '/contact') return { tab: 'contact', category: 'all', search: '' };
  if (pathname === '/cart') return { tab: 'cart', category: 'all', search: '' };
  if (pathname === '/checkout') return { tab: 'checkout', category: 'all', search: '' };
  if (pathname === '/order-success') return { tab: 'order-success', category: 'all', search: '' };
  if (pathname === '/track-order' || pathname === '/tracking') return { tab: 'track-order', category: 'all', search: '' };
  if (pathname === '/profile' || pathname === '/account') return { tab: 'profile', category: 'all', search: '' };
  if (pathname === '/terms' || pathname === '/terms-of-use' || pathname === '/policies') return { tab: 'terms', category: 'all', search: '' };
  if (pathname === '/privacy' || pathname === '/privacy-policy') return { tab: 'privacy', category: 'all', search: '' };
  if (pathname === '/refund' || pathname === '/return-policy' || pathname === '/returns') return { tab: 'refund', category: 'all', search: '' };
  if (pathname === '/shipping' || pathname === '/shipping-policy') return { tab: 'shipping', category: 'all', search: '' };
  if (pathname === '/admin') return { tab: 'admin', category: 'all', search: '' };

  return { tab: 'home', category: 'all', search: '' };
}

interface StoreContextType {
  products: Product[];
  collections: StoreCollection[];
  settings: StoreSettings;
  isCatalogLoading: boolean;
  isOfflineCatalog: boolean;
  refreshCatalog: () => void;
  updateProduct: (id: string, updated: Partial<Product>) => Promise<boolean>;
  toggleProductVisibility: (id: string, isActive: boolean) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  duplicateProduct: (id: string) => Promise<void>;
  bulkAddProducts: (items: Product[]) => Promise<{ inserted: number; errors: number }>;
  updateSettings: (next: Partial<StoreSettings>) => Promise<void>;

  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, variant?: ProductVariant | null) => void;
  buyNow: (product: Product, quantity?: number, variant?: ProductVariant | null) => void;
  removeFromCart: (productId: string, selectedSize?: string) => void;
  updateCartQuantity: (productId: string, quantity: number, selectedSize?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  orders: Order[];
  currentOrder: Order | null;
  createOrder: (orderData: any) => Promise<Order>;
  cancelOrder: (orderId: string, reason: string, by?: 'customer_whatsapp' | 'admin') => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  refreshOrders: () => Promise<void>;
  activeCarts: any[];
  refreshActiveCarts: () => Promise<void>;

  currentTab: AppTab;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedProduct: Product | null;
  navigate: (tab: AppTab, options?: { category?: string; search?: string; product?: Product; productHandle?: string }) => void;
  openProduct: (product: Product) => void;
  sessionId: string;
  visitorAttribution: VisitorAttribution;
  recentlyViewedIds: string[];
  clearRecentlyViewed: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: account, sessionReady, adminSections } = useAuth();
  const canViewHiddenProducts = ['products', 'inventory', 'quality', 'stocktake', 'reorder', 'labels', 'suppliers']
    .some(s => adminSections.includes(s));

  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<StoreCollection[]>(defaultCollections);
  const [settings, setSettings] = useState<StoreSettings>(() => ({
    ...defaultSettings,
    ...readStoredJson<Partial<StoreSettings>>('qamar_store_settings', {})
  }));
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isOfflineCatalog, setIsOfflineCatalog] = useState(!deviceIsOnline());
  const [reloadTick, setReloadTick] = useState(0);

  const [sessionId] = useState(() => {
    let sid = readStorage('qamar_session_id');
    if (!sid) {
      sid = `qmr_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
      writeStorage('qamar_session_id', sid);
    }
    return sid;
  });

  const [cart, setCart] = useState<CartItem[]>(() => readStoredArray<CartItem>('qamar_cart'));
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>(() => readStoredArray<string>('qamar_wishlist'));
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => readStoredArray<string>('qamar_recently_viewed'));
  const [visitorAttribution, setVisitorAttribution] = useState<VisitorAttribution>(() => getOrCaptureVisitorAttribution());
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(() => {
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('qamar_last_order') : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [activeCarts, setActiveCarts] = useState<any[]>([]);

  const initialRoute = parseUrlRoute();
  const [currentTab, setCurrentTab] = useState<AppTab>(initialRoute.tab);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialRoute.category);
  const [searchQuery, setSearchQuery] = useState<string>(initialRoute.search);
  const [pendingHandle, setPendingHandle] = useState<string | undefined>(initialRoute.productHandle);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Sync URL popstate
  useEffect(() => {
    const onPop = () => {
      const r = parseUrlRoute();
      setCurrentTab(r.tab);
      setSelectedCategory(r.category);
      setSearchQuery(r.search);
      setPendingHandle(r.productHandle);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Load public catalog, collections, and settings immediately on mount (Edge CDN cached GET!)
  useEffect(() => {
    let cancelled = false;
    setIsCatalogLoading(true);

    const loadAll = async () => {
      try {
        const [prods, cols, remoteSettings] = await Promise.all([
          neonDb.getAllProducts({ includeHidden: false }),
          neonDb.getCollections().catch(() => defaultCollections),
          neonDb.getStoreSettings().catch(() => null)
        ]);
        if (cancelled) return;
        if (prods.length > 0) {
          setProducts(prods);
          setIsOfflineCatalog(false);
          void saveOfflineCatalog(prods);
        }
        if (Array.isArray(cols) && cols.length > 0) setCollections(cols);
        if (remoteSettings && typeof remoteSettings === 'object') {
          setSettings(prev => {
            const merged = { ...prev, ...remoteSettings };
            writeStoredJson('qamar_store_settings', merged);
            return merged;
          });
        }
      } catch {
        const offline = await readOfflineCatalog();
        if (!cancelled && offline?.products?.length) {
          setProducts(offline.products);
          setIsOfflineCatalog(true);
        }
      } finally {
        if (!cancelled) setIsCatalogLoading(false);
      }
    };

    void loadAll();
    return () => { cancelled = true; };
  }, [reloadTick]);

  // If authenticated staff with product permissions logs in, reload uncached full inventory via POST
  useEffect(() => {
    if (!sessionReady || !canViewHiddenProducts) return;
    let cancelled = false;
    neonDb.getAllProducts({ includeHidden: true }).then(prods => {
      if (!cancelled && prods.length) setProducts(prods);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sessionReady, canViewHiddenProducts, reloadTick]);

  // Load user orders if signed in
  useEffect(() => {
    if (!sessionReady) return;
    if (!account) { setOrders([]); setActiveCarts([]); return; }
    neonDb.getOrders().then(setOrders).catch(() => {});
    if (adminSections.includes('crm')) {
      neonDb.getActiveCarts().then(setActiveCarts).catch(() => {});
    }
  }, [sessionReady, account?.id, adminSections.join(',')]);

  // Resolve product URL handle once products arrive
  useEffect(() => {
    if (!pendingHandle || !products.length) return;
    const decoded = decodeURIComponent(pendingHandle).trim().toLowerCase();
    const match = products.find(p =>
      p.handle.trim().toLowerCase() === decoded ||
      p.name_ar.trim().toLowerCase() === decoded ||
      p.id === pendingHandle
    );
    if (match) setSelectedProduct(match);
  }, [pendingHandle, products]);

  const lastTrackedProductIdRef = React.useRef<string>('');
  useEffect(() => {
    if (currentTab !== 'product' || !selectedProduct?.id) return;
    setRecentlyViewedIds(prev => {
      const next = [selectedProduct.id, ...prev.filter(id => id !== selectedProduct.id)].slice(0, 15);
      writeStoredJson('qamar_recently_viewed', next);
      return next;
    });
    if (!deviceIsOnline()) return;
    if (lastTrackedProductIdRef.current === selectedProduct.id) return;
    lastTrackedProductIdRef.current = selectedProduct.id;
    neonDb
      .trackActivity({
        sessionId,
        customerId: account?.id,
        customerName: account?.name,
        customerPhone: account?.phone,
        customerEmail: account?.email,
        actionType: 'view_product',
        targetId: selectedProduct.id,
        attribution: visitorAttribution,
        metadata: {
          category: selectedProduct.category,
          name_ar: selectedProduct.name_ar,
          handle: selectedProduct.handle,
          price: selectedProduct.price,
          image: selectedProduct.images?.[0]
        }
      })
      .catch(() => {});
    trackMetaEvent('ViewContent', {
      content_ids: [selectedProduct.id],
      content_name: selectedProduct.name_ar,
      content_type: 'product',
      value: Number(selectedProduct.price || 0),
      currency: 'EGP'
    });
  }, [currentTab, selectedProduct?.id, selectedProduct?.name_ar, selectedProduct?.price, selectedProduct?.category, selectedProduct?.handle, selectedProduct?.images, sessionId, account?.id, account?.name, account?.phone, account?.email, visitorAttribution]);

  // Persist cart & sync active cart
  useEffect(() => {
    writeStoredJson('qamar_cart', cart);
    if (!deviceIsOnline()) return;
    const sub = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    neonDb
      .syncActiveCart({
        sessionId,
        customerId: account?.id,
        customerEmail: account?.email,
        customerName: account?.name,
        customerPhone: account?.phone,
        items: cart,
        subtotal: sub,
        attribution: visitorAttribution
      })
      .catch(() => {});
  }, [cart, sessionId, account?.id, account?.email, account?.name, account?.phone, visitorAttribution]);

  // Capture visitor traffic (registered & guest), attribute ad/search source, and hydrate recently viewed history
  const pingSentRef = React.useRef<string>('');
  useEffect(() => {
    if (!sessionReady || !deviceIsOnline()) return;
    const pingKey = `${account?.id || 'guest'}:${currentTab}`;
    if (pingSentRef.current === pingKey) return;
    pingSentRef.current = pingKey;

    const latestAttr = getOrCaptureVisitorAttribution();
    setVisitorAttribution(latestAttr);

    neonDb
      .trackActivity({
        sessionId,
        customerId: account?.id,
        customerName: account?.name,
        customerPhone: account?.phone,
        customerEmail: account?.email,
        actionType: account?.id ? 'session_ping' : 'page_visit',
        targetId: typeof window !== 'undefined' ? window.location.pathname : '/ar',
        attribution: latestAttr
      })
      .catch(() => {});

    neonDb.getRecentlyViewedProductIds(sessionId).then(ids => {
      if (!Array.isArray(ids) || !ids.length) return;
      setRecentlyViewedIds(prev => {
        const merged = Array.from(new Set([...prev, ...ids])).slice(0, 15);
        writeStoredJson('qamar_recently_viewed', merged);
        return merged;
      });
    }).catch(() => {});
  }, [sessionReady, account?.id, sessionId, currentTab]);

  // Keep global document SEO & Store JSON-LD synchronized on Storefront routes
  useEffect(() => {
    if (currentTab === 'product' || currentTab === 'admin' || typeof window === 'undefined') return;
    const origin = window.location.origin;
    const titles: Record<string, string> = {
      home: `${settings.store_name_ar || 'قمر للعطور'} | Qamar Fragrances — عطور محاكاة فاخرة`,
      shop: `${selectedCategory && selectedCategory !== 'all' ? selectedCategory.replace(/-/g, ' ') : 'جميع العطور'} | قمر للعطور`,
      contact: 'تواصل معنا | قمر للعطور',
      cart: 'سلة التسوق | قمر للعطور',
      checkout: 'إتمام الطلب | قمر للعطور',
      'order-success': 'تم تأكيد الطلب | قمر للعطور',
      'track-order': 'تتبع طلبك | قمر للعطور',
      profile: 'حسابي | قمر للعطور',
      terms: 'شروط الاستخدام | قمر للعطور',
      privacy: 'سياسة الخصوصية | قمر للعطور',
      refund: 'سياسة الاستبدال والاسترجاع | قمر للعطور',
      shipping: 'سياسة الشحن والتوصيل | قمر للعطور'
    };
    applyPageSeo({
      title: titles[currentTab] || 'قمر للعطور | Qamar Fragrances',
      description: settings.tagline_ar || 'عطور محاكاة بجودة مطابقة للأوريجينال - قمر للعطور',
      image: settings.logo_url || '/qamar-images/626c06f2fe557fd9.webp',
      jsonLd: currentTab === 'home' ? buildStoreJsonLd(origin, settings) : undefined
    });
  }, [currentTab, selectedCategory, settings]);

  // Initialize Meta Pixel (numeric ID only, no Access Token required) & track PageView / InitiateCheckout
  const activePixelId = settings.meta_pixel_enabled !== false ? normalizeMetaPixelId(settings.meta_pixel_id) : '';
  useEffect(() => {
    if (!activePixelId || currentTab === 'admin') return;
    if (initMetaPixel(activePixelId)) {
      trackMetaEvent('PageView');
      if (currentTab === 'checkout' && cart.length > 0) {
        trackMetaEvent('InitiateCheckout', {
          content_ids: cart.map(c => c.product.id),
          num_items: cart.reduce((s, c) => s + c.quantity, 0),
          value: cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0),
          currency: 'EGP'
        });
      }
    }
  }, [activePixelId, currentTab, selectedProduct?.id, selectedCategory]);

  useEffect(() => { writeStoredJson('qamar_wishlist', wishlist); }, [wishlist]);

  const navigate = (tab: AppTab, options?: { category?: string; search?: string; product?: Product; productHandle?: string }) => {
    setCurrentTab(tab);
    if (options?.category !== undefined) setSelectedCategory(options.category);
    if (options?.search !== undefined) setSearchQuery(options.search);
    if (options?.product) {
      setSelectedProduct(options.product);
      setPendingHandle(options.product.handle);
    } else if (options?.productHandle) {
      setPendingHandle(options.productHandle);
    }

    let nextPath = '/ar';
    const cat = options?.category ?? selectedCategory;
    const q = options?.search ?? searchQuery;
    if (tab === 'shop') {
      if (cat && cat !== 'all' && !q) {
        nextPath = `/ar/product/${encodeURIComponent(cat)}`;
      } else {
        const qs = new URLSearchParams();
        if (cat && cat !== 'all') qs.set('category', cat);
        if (q) qs.set('q', q);
        nextPath = `/ar/shop${qs.toString() ? `?${qs.toString()}` : ''}`;
      }
    } else if (tab === 'product') {
      const h = options?.product?.handle || options?.productHandle || selectedProduct?.handle || '';
      nextPath = `/ar/product/all/${encodeURIComponent(h)}`;
    } else if (tab === 'contact') nextPath = '/ar/contact-us';
    else if (tab === 'cart') nextPath = '/ar/cart';
    else if (tab === 'checkout') nextPath = '/ar/checkout';
    else if (tab === 'order-success') nextPath = '/ar/order-success';
    else if (tab === 'track-order') nextPath = '/ar/track-order';
    else if (tab === 'profile') nextPath = '/ar/profile';
    else if (tab === 'terms') nextPath = '/ar/terms';
    else if (tab === 'privacy') nextPath = '/ar/privacy-policy';
    else if (tab === 'refund') nextPath = '/ar/return-policy';
    else if (tab === 'shipping') nextPath = '/ar/shipping-policy';
    else if (tab === 'admin') nextPath = '/ar/admin';

    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== nextPath) {
      window.history.pushState({}, '', nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openProduct = (product: Product) => {
    navigate('product', { product });
  };

  const addToCart = (product: Product, quantity = 1, variant?: ProductVariant | null) => {
    const v = variant || product.variants?.[0] || null;
    const size = v?.label || product.size_options?.[0] || 'العبوة الكاملة';
    const unitPrice = Number(v?.price ?? product.price);
    const variantId = v?.id || product.id;

    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id && i.selectedSize === size);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity, unitPrice };
        return next;
      }
      return [...prev, { product, quantity, selectedSize: size, variantId, unitPrice }];
    });
    setIsCartOpen(true);
    neonDb.trackActivity({ sessionId, customerId: account?.id, actionType: 'add_to_cart', targetId: product.id, metadata: { size } }).catch(() => {});
    trackMetaEvent('AddToCart', {
      content_ids: [product.id],
      content_name: product.name_ar,
      content_type: 'product',
      value: unitPrice * quantity,
      currency: 'EGP'
    });
  };

  const buyNow = (product: Product, quantity = 1, variant?: ProductVariant | null) => {
    const v = variant || product.variants?.[0] || null;
    const size = v?.label || product.size_options?.[0] || 'العبوة الكاملة';
    const unitPrice = Number(v?.price ?? product.price);
    const variantId = v?.id || product.id;
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id && i.selectedSize === size);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity, unitPrice };
        return next;
      }
      return [...prev, { product, quantity, selectedSize: size, variantId, unitPrice }];
    });
    trackMetaEvent('AddToCart', {
      content_ids: [product.id],
      content_name: product.name_ar,
      content_type: 'product',
      value: unitPrice * quantity,
      currency: 'EGP'
    });
    setIsCartOpen(false);
    navigate('checkout');
  };

  const removeFromCart = (productId: string, selectedSize?: string) => {
    setCart(prev => prev.filter(i => !(i.product.id === productId && (!selectedSize || i.selectedSize === selectedSize))));
  };

  const updateCartQuantity = (productId: string, quantity: number, selectedSize?: string) => {
    if (quantity <= 0) return removeFromCart(productId, selectedSize);
    setCart(prev => prev.map(i => (i.product.id === productId && (!selectedSize || i.selectedSize === selectedSize)) ? { ...i, quantity } : i));
  };

  const clearCart = () => setCart([]);

  const toggleWishlist = (productId: string) => {
    setWishlist(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
    if (account) neonDb.logWishlistEvent(account.id, productId).catch(() => {});
  };

  const createOrder = async (orderData: any): Promise<Order> => {
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const orderNumber = `QMR-${new Date().getFullYear()}-${String(Math.floor(100000 + Math.random() * 900000))}`;
    const order: Order = {
      ...orderData,
      session_id: sessionId,
      id: orderId,
      order_number: orderNumber,
      tracking_number: orderNumber,
      order_status: 'pending',
      payment_status: 'unpaid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const res = await neonDb.createOrder(order);
    if (!res) throw new Error('تعذر تأكيد الطلب. تحقق من توفر الكميات والأسعار الحالية.');
    const checkoutUrl = typeof res === 'object' ? res?.payment?.checkoutUrl : undefined;
    const savedOrder: Order = { ...order, checkout_url: checkoutUrl };
    trackMetaEvent('Purchase', {
      content_ids: order.items.map(i => i.product.id),
      num_items: order.items.reduce((s, i) => s + i.quantity, 0),
      value: Number(order.total || 0),
      currency: 'EGP',
      order_id: order.order_number
    });
    setCurrentOrder(savedOrder);
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('qamar_last_order', JSON.stringify(savedOrder));
    } catch {}
    setOrders(prev => [savedOrder, ...prev]);
    clearCart();
    return savedOrder;
  };

  const cancelOrder = async (orderId: string, reason: string, by: 'customer_whatsapp' | 'admin' = 'admin') => {
    const ok = await neonDb.cancelOrder(orderId, reason, by);
    if (ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: 'cancelled', cancellation_reason: reason } : o));
    }
    return ok;
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await neonDb.updateOrderState(orderId, { order_status: status });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: status as any } : o));
  };

  const updateProduct = async (id: string, updated: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
    return neonDb.updateProduct(id, {
      price: updated.price,
      old_price: updated.original_price,
      stock_quantity: updated.stock,
      is_active: updated.is_active,
      is_featured: updated.is_featured,
      product: updated
    });
  };

  const toggleProductVisibility = async (id: string, isActive: boolean) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: isActive, in_stock: isActive && p.stock > 0 } : p));
    return neonDb.toggleProductVisibility(id, isActive);
  };

  const deleteProduct = async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    return neonDb.deleteProduct(id);
  };

  const duplicateProduct = async (id: string) => {
    const target = products.find(p => p.id === id);
    if (!target) return;
    const copy: Product = {
      ...target,
      id: `Product_copy_${Date.now()}`,
      handle: `${target.handle}-copy-${Date.now().toString().slice(-4)}`,
      name_ar: `${target.name_ar} (نسخة)`,
      name_en: `${target.name_en} (Copy)`
    };
    setProducts(prev => [copy, ...prev]);
    await neonDb.bulkInsertProducts([copy]);
  };

  const bulkAddProducts = async (items: Product[]) => {
    const res = await neonDb.bulkInsertProducts(items);
    setReloadTick(t => t + 1);
    return res;
  };

  const updateSettings = async (next: Partial<StoreSettings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    writeStoredJson('qamar_store_settings', merged);
    await neonDb.updateStoreSettings(merged);
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartSubtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <StoreContext.Provider value={{
      products,
      collections,
      settings,
      isCatalogLoading,
      isOfflineCatalog,
      refreshCatalog: () => setReloadTick(t => t + 1),
      updateProduct,
      toggleProductVisibility,
      deleteProduct,
      duplicateProduct,
      bulkAddProducts,
      updateSettings,
      cart,
      addToCart,
      buyNow,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      cartCount,
      cartSubtotal,
      isCartOpen,
      setIsCartOpen,
      wishlist,
      toggleWishlist,
      isInWishlist: id => wishlist.includes(id),
      orders,
      currentOrder,
      createOrder,
      cancelOrder,
      updateOrderStatus,
      refreshOrders: async () => { setOrders(await neonDb.getOrders()); },
      activeCarts,
      refreshActiveCarts: async () => { setActiveCarts(await neonDb.getActiveCarts()); },
      currentTab,
      selectedCategory,
      setSelectedCategory,
      searchQuery,
      setSearchQuery,
      selectedProduct,
      navigate,
      openProduct,
      sessionId,
      visitorAttribution,
      recentlyViewedIds,
      clearRecentlyViewed: () => {
        setRecentlyViewedIds([]);
        writeStoredJson('qamar_recently_viewed', []);
      }
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
};

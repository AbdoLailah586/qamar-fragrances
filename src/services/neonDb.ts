import type {
  Product,
  Order,
  StoreCollection,
  StoreSettings,
  OilReserve,
  BottleSupply,
  FragranceNotesEntry
} from '../types';

async function callStore(method: string, args: any[] = []) {
  const response = await fetch('/api/store', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args })
  });
  const data = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(data.error || 'تعذر تنفيذ الطلب. راجع صلاحية حسابك.'), { code: data.code });
  }
  return data.result;
}

async function callPublicStoreGet(method: string, query: Record<string, string | number | undefined> = {}) {
  const searchParams = new URLSearchParams({ method });
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') searchParams.set(k, String(v));
  }
  const response = await fetch(`/api/store?${searchParams.toString()}`, {
    method: 'GET',
    credentials: 'same-origin'
  });
  const data = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(data.error || 'تعذر تنفيذ الطلب.'), { code: data.code });
  }
  return data.result;
}

async function callAction(method: string, args: any[] = []) {
  try {
    return await callStore(method, args);
  } catch (e: any) {
    return { success: false, error: e.message, code: e.code };
  }
}

export const neonDb = {
  async getSession() { return callStore('getSession'); },
  async logoutSession() { return callStore('logout'); },
  async authenticateUser(email: string, password: string) { return callStore('authenticateUser', [email, password]); },
  async registerCustomer(name: string, email: string, phone: string, password: string) {
    return callStore('registerCustomer', [name, email, phone, password]);
  },
  async verifyTotpLogin(_email: string, code: string) { return callStore('completeSecondFactor', [code]); },
  async getUserAccess(userId: string) { return callStore('getUserAccess', [userId]); },
  async updateUserAccess(userId: string, access: { role: 'admin' | 'customer'; permissions: string[] }) {
    return callStore('updateUserAccess', [userId, access]);
  },
  async getAllUsers() { return callStore('getAllUsers'); },
  async getUserInsights(userId: string) { return callAction('getUserInsights', [userId]); },
  async adminCreateUser(data: { name: string; email: string; phone?: string; password: string; role: 'admin' | 'customer'; permissions?: string[] }) {
    return callAction('adminCreateUser', [data]);
  },
  async deleteUser(userId: string) { return callAction('deleteUser', [userId]); },
  async updateUserProfile(userId: string, data: any) { return callAction('updateUserProfile', [userId, data]); },
  async updateUserEmail(userId: string, newEmail: string) { return callAction('updateUserEmail', [userId, newEmail]); },
  async changePassword(userId: string, oldPass: string, newPass: string) {
    return callAction('changePassword', [userId, oldPass, newPass]);
  },

  async sendVerificationOtp(email: string, name?: string) {
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });
      return await res.json();
    } catch {
      return { success: false, error: 'تعذر الاتصال بخدمة التحقق من البريد.' };
    }
  },

  async verifyOtpAndCreateUser(data: { email: string; code: string; name: string; phone: string; password?: string }) {
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch {
      return { success: false, error: 'تعذر التحقق من الكود.' };
    }
  },

  async persistGoogleUser(googleUser: { credential: string }) {
    try {
      const res = await fetch('/api/google-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googleUser)
      });
      return await res.json();
    } catch {
      return { success: false, error: 'تعذر حفظ بيانات Google.' };
    }
  },

  async setupTotp(userId: string) { return callAction('setupTotp', [userId]); },
  async confirmTotp(userId: string, code: string) { return callAction('confirmTotp', [userId, code]); },
  async disableTotp(userId: string, code: string) { return callAction('disableTotp', [userId, code]); },

  async getCollections(): Promise<StoreCollection[]> {
    return await callPublicStoreGet('getCollections');
  },

  async getAllProducts(params?: { includeHidden?: boolean }): Promise<Product[]> {
    const pageSize = 400;
    const first = await this.getProducts({ limit: pageSize, offset: 0, includeHidden: params?.includeHidden });
    if (first.total <= pageSize) return first.products;
    const remaining = await Promise.all(
      Array.from({ length: Math.ceil(first.total / pageSize) - 1 }, (_, index) =>
        this.getProducts({ limit: pageSize, offset: (index + 1) * pageSize, includeHidden: params?.includeHidden })
      )
    );
    return [...first.products, ...remaining.flatMap(page => page.products)];
  },

  async getProducts(params?: {
    category?: string;
    search?: string;
    size?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    limit?: number;
    offset?: number;
    includeHidden?: boolean;
  }): Promise<{ products: Product[]; total: number }> {
    if (params?.includeHidden) {
      return await callStore('getProducts', [params]);
    }
    return await callPublicStoreGet('getProducts', {
      limit: Math.max(1, Math.min(500, Number(params?.limit) || 50)),
      offset: Math.max(0, Number(params?.offset) || 0),
      category: params?.category && params.category !== 'all' ? params.category : undefined,
      search: params?.search?.trim() || undefined,
      size: params?.size || undefined,
      minPrice: params?.minPrice,
      maxPrice: params?.maxPrice,
      sort: params?.sort && params.sort !== 'default' ? params.sort : undefined
    });
  },

  async toggleProductVisibility(productId: string, isActive: boolean): Promise<boolean> {
    return callStore('toggleProductVisibility', [productId, isActive]);
  },

  async updateProduct(productId: string, updates: any): Promise<boolean> {
    return callStore('updateProduct', [productId, updates]);
  },

  async deleteProduct(productId: string): Promise<boolean> {
    return callStore('deleteProduct', [productId]);
  },

  async bulkInsertProducts(products: Product[]): Promise<{ inserted: number; errors: number }> {
    return callStore('bulkInsertProducts', [products]);
  },

  async getStoreSettings(options?: { bypassCache?: boolean }): Promise<StoreSettings | null> {
    try {
      if (options?.bypassCache) return await callStore('getStoreSettings', []);
      return await callPublicStoreGet('getStoreSettings');
    } catch {
      return null;
    }
  },

  async updateStoreSettings(settings: Partial<StoreSettings>) {
    return callAction('updateStoreSettings', [settings]);
  },

  async createOrder(order: Order): Promise<boolean> { return callStore('createOrder', [order]); },
  async getOrders(): Promise<Order[]> { return callStore('getOrders', []); },
  async trackOrder(number: string, phone: string): Promise<Order | null> { return callStore('trackOrder', [number, phone]); },
  async cancelOrder(orderId: string, reason: string, by: 'customer_whatsapp' | 'admin') {
    return callStore('cancelOrder', [orderId, reason, by]);
  },
  async updateOrderState(id: string, changes: Record<string, string>) { return callStore('updateOrderState', [id, changes]); },

  async getPickingList(): Promise<Order[]> { return callStore('getPickingList', []); },
  async confirmPacking(orderId: string, codes: string[], options?: any) { return callAction('confirmPacking', [orderId, codes, options]); },
  async updateOrderStatus(orderId: string, status: string, options?: any) { return callAction('updateOrderStatus', [orderId, status, options]); },
  async getDeliveryBoard(): Promise<Order[]> { return callStore('getDeliveryBoard', []); },
  async recordDeliveryRefusal(orderId: string, reason: string, courierName?: string) {
    return callAction('recordDeliveryRefusal', [orderId, reason, courierName]);
  },
  async getRefusalHistory(phone: string) { return callStore('getRefusalHistory', [phone]); },
  async getAllRefusals(limit = 100) { return callStore('getAllRefusals', [limit]); },

  async trackActivity(activity: any) { return callStore('trackActivity', [activity]); },
  async syncActiveCart(cart: any) { return callStore('syncActiveCart', [cart]); },
  async getActiveCarts() { return callStore('getActiveCarts', []); },
  async getPersonalizedRecommendations(sessionId: string) { return callStore('getPersonalizedRecommendations', [sessionId]); },
  async logWishlistEvent(customerId: string, productId: string) { return callStore('logWishlistEvent', [customerId, productId]); },
  async getWishlistGap(limit = 5) { return callStore('getWishlistGap', [limit]); },

  async getAuditLog(limit = 100) { return callStore('getAuditLog', [limit]); },
  async addSupplierQuote(productId: string, supplierName: string, price: number) {
    return callStore('addSupplierQuote', [productId, supplierName, price]);
  },
  async getSupplierQuotes(productId: string) { return callStore('getSupplierQuotes', [productId]); },

  async submitProductReview(reviewData: any) { return callAction('submitProductReview', [reviewData]); },
  async getProductReviews(productId: string, sessionId?: string) {
    try { return await callStore('getProductReviews', [productId, sessionId]); } catch { return []; }
  },
  async getAllProductReviews(params?: { status?: string; limit?: number }) {
    try { return await callStore('getAllProductReviews', [params]); } catch { return { reviews: [], counts: { pending: 0, approved: 0, rejected: 0, all: 0 } }; }
  },
  async updateProductReviewStatus(reviewId: string, status: 'approved' | 'rejected') {
    return callAction('updateProductReviewStatus', [reviewId, status]);
  },
  async deleteProductReview(reviewId: string) { return callAction('deleteProductReview', [reviewId]); },

  async findOrCreateSupportTicket(phone: string, name?: string, subject?: string, orderId?: string) {
    return callStore('findOrCreateSupportTicket', [phone, name, subject, orderId]);
  },
  async createSupportTicket(phone: string, message: string, name?: string, subject?: string, orderId?: string) {
    return callStore('createSupportTicket', [phone, message, name, subject, orderId]);
  },
  async listSupportTickets(status?: string) { return callStore('listSupportTickets', [status]); },
  async getSupportTicket(ticketId: string) { return callStore('getSupportTicket', [ticketId]); },
  async replySupportTicket(ticketId: string, senderType: 'staff' | 'customer', body: string) {
    return callStore('replySupportTicket', [ticketId, senderType, body]);
  },
  async escalateSupportTicket(ticketId: string, reason: string) { return callStore('escalateSupportTicket', [ticketId, reason]); },
  async closeSupportTicket(ticketId: string) { return callStore('closeSupportTicket', [ticketId]); },
  async rateSupportTicket(ticketId: string, rating: number, comment?: string) {
    return callStore('rateSupportTicket', [ticketId, rating, comment]);
  },

  // Perfume ERP methods
  async getOilReserves(): Promise<OilReserve[]> { return callStore('getOilReserves', []); },
  async upsertOilReserve(entry: Partial<OilReserve>) { return callAction('upsertOilReserve', [entry]); },
  async deleteOilReserve(id: string) { return callAction('deleteOilReserve', [id]); },
  async getBottleSupplies(): Promise<BottleSupply[]> { return callStore('getBottleSupplies', []); },
  async updateBottleSupply(id: string, stockQty: number, costPerUnit?: number) {
    return callAction('updateBottleSupply', [id, stockQty, costPerUnit]);
  },
  async getFragranceNotes(): Promise<FragranceNotesEntry[]> {
    try { return await callPublicStoreGet('getFragranceNotes'); } catch { return []; }
  },
  async upsertFragranceNotes(entry: Partial<FragranceNotesEntry>) {
    return callAction('upsertFragranceNotes', [entry]);
  },

  // WhatsApp Automation & CRM RPCs
  async getWhatsAppAdminConfig() { return callStore('getWhatsAppAdminConfig', []); },
  async saveWhatsAppAdminConfig(config: any) { return callAction('saveWhatsAppAdminConfig', [config]); },
  async testWhatsAppConnection() { return callAction('testWhatsAppConnection', []); },
  async getWhatsAppNotifications(limit = 80) { return callStore('getWhatsAppNotifications', [limit]); },
  async sendOrderWhatsApp(orderId: string, type: string, customText?: string, recipientOverride?: string) {
    return callAction('sendOrderWhatsApp', [orderId, type, customText, recipientOverride]);
  },
  async sendTestWhatsApp(phone: string, text: string) {
    return callAction('sendTestWhatsApp', [phone, text]);
  }
};

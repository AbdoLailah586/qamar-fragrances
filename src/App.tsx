import React, { Suspense, lazy } from 'react';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { AuthModal } from './components/AuthModal';
import { PwaStatus } from './components/PwaControls';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { ProductDetails } from './pages/ProductDetails';
import { ContactUs } from './pages/ContactUs';
import { CartPage } from './pages/CartPage';
import { Checkout } from './pages/Checkout';
import { OrderSuccess } from './pages/OrderSuccess';
import { OrderTracking } from './pages/OrderTracking';
import { Profile } from './pages/Profile';

// Lazy-load the Admin ERP so customer storefront bundles remain lightweight and fast
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

const StorefrontRouter: React.FC = () => {
  const { currentTab } = useStore();

  if (currentTab === 'admin') {
    return (
      <>
        <Suspense fallback={<div className="p-16 text-center text-sm text-gray-500">جاري تحميل لوحة الإدارة...</div>}>
          <AdminDashboard />
        </Suspense>
        <AuthModal />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PwaStatus />
      <Navbar />
      <div className="flex-1">
        {currentTab === 'home' && <Home />}
        {currentTab === 'shop' && <Shop />}
        {currentTab === 'product' && <ProductDetails />}
        {currentTab === 'contact' && <ContactUs />}
        {currentTab === 'cart' && <CartPage />}
        {currentTab === 'checkout' && <Checkout />}
        {currentTab === 'order-success' && <OrderSuccess />}
        {currentTab === 'track-order' && <OrderTracking />}
        {currentTab === 'profile' && <Profile />}
      </div>
      <Footer />
      <MobileBottomNav />
      <CartDrawer />
      <AuthModal />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <StorefrontRouter />
      </StoreProvider>
    </AuthProvider>
  );
}

export default App;

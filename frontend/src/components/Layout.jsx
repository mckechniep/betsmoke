// ============================================
// LAYOUT COMPONENT
// ============================================
// Wraps all pages with Navbar and consistent styling.
// ============================================

import Navbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;

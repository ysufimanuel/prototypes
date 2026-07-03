/**
 * Login Page - Halaman login dan registrasi gereja
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerChurch } from '@/auth/auth';
import { t, setLanguage } from '@/core/i18n';
import { useStoreSelector } from '@/core/store';
import { Church, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const language = useStoreSelector(s => s.language);

  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Login form
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    remember: false,
  });

  // Register form
  const [registerForm, setRegisterForm] = useState({
    churchName: '',
    churchAddress: '',
    churchCity: '',
    churchPhone: '',
    churchEmail: '',
    adminName: '',
    adminUsername: '',
    adminEmail: '',
    adminPassword: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await loginUser(loginForm.username, loginForm.password);
    if (success) {
      navigate('/');
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const success = await registerChurch(
      {
        nama: registerForm.churchName,
        alamat: registerForm.churchAddress,
        kota: registerForm.churchCity,
        telepon: registerForm.churchPhone,
        email: registerForm.churchEmail,
      },
      {
        nama: registerForm.adminName,
        username: registerForm.adminUsername,
        email: registerForm.adminEmail,
        password: registerForm.adminPassword,
      }
    );

    if (success) {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#1a0a00] to-[#1a1a1a] p-5 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-1/2 -right-[30%] w-[80%] h-[150%] bg-[radial-gradient(ellipse,rgba(255,107,0,0.15)_0%,transparent_60%)] animate-pulse" />

      <div className="w-full max-w-[450px] bg-[#141414] rounded-2xl p-10 shadow-2xl border border-[#2a2a2a] relative z-10">
        {!isRegister ? (
          // LOGIN FORM
          <>
            <div className="text-center mb-8">
              <div className="w-[90px] h-[90px] bg-gradient-to-br from-orange-500 to-orange-700 rounded-full flex items-center justify-center text-white text-4xl shadow-lg shadow-orange-500/30 mx-auto mb-5 animate-bounce">
                <Church className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{t('app-title')}</h2>
              <p className="text-gray-400 text-sm">{t('app-subtitle')}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2.5 font-medium">
                  {t('username')}
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder={t('username')}
                  required
                  className="w-full px-4 py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2.5 font-medium">
                  {t('password')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder={t('password')}
                    required
                    className="w-full px-4 py-3.5 pr-12 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-orange-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loginForm.remember}
                    onChange={e => setLoginForm({ ...loginForm, remember: e.target.checked })}
                    className="accent-orange-500"
                  />
                  <span>{t('remember-me')}</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const email = prompt('Masukkan email Anda:');
                    if (email) {
                      import('@/auth/auth').then(m => m.resetPassword(email));
                    }
                  }}
                  className="text-orange-400 hover:underline"
                >
                  {t('forgot-password')}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white font-semibold text-base hover:shadow-lg hover:shadow-orange-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="animate-pulse">{t('loading')}</span>
                ) : (
                  t('login')
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsRegister(true)}
                className="text-orange-400 text-sm hover:underline font-medium"
              >
                {t('register-church')}
              </button>
            </div>
          </>
        ) : (
          // REGISTER FORM
          <>
            <div className="text-center mb-8">
              <div className="w-[90px] h-[90px] bg-gradient-to-br from-orange-500 to-orange-700 rounded-full flex items-center justify-center text-white text-4xl shadow-lg shadow-orange-500/30 mx-auto mb-5">
                <Church className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{t('register-church')}</h2>
              <p className="text-gray-400 text-sm">Buat akun untuk gereja Anda</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {/* Church Data */}
              <div className="text-orange-400 font-semibold text-sm flex items-center gap-2">
                <Church className="w-4 h-4" />
                Data Gereja
              </div>

              <input
                type="text"
                placeholder="Nama Gereja"
                required
                value={registerForm.churchName}
                onChange={e => setRegisterForm({ ...registerForm, churchName: e.target.value })}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
              />
              <input
                type="text"
                placeholder="Alamat"
                required
                value={registerForm.churchAddress}
                onChange={e => setRegisterForm({ ...registerForm, churchAddress: e.target.value })}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Kota"
                  required
                  value={registerForm.churchCity}
                  onChange={e => setRegisterForm({ ...registerForm, churchCity: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                />
                <input
                  type="tel"
                  placeholder="Telepon"
                  value={registerForm.churchPhone}
                  onChange={e => setRegisterForm({ ...registerForm, churchPhone: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                />
              </div>
              <input
                type="email"
                placeholder="Email Gereja"
                value={registerForm.churchEmail}
                onChange={e => setRegisterForm({ ...registerForm, churchEmail: e.target.value })}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
              />

              {/* Divider */}
              <div className="border-t border-[#2a2a2a] pt-2">
                <div className="text-orange-400 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Akun Super Admin
                </div>
              </div>

              <input
                type="text"
                placeholder="Nama Admin"
                required
                value={registerForm.adminName}
                onChange={e => setRegisterForm({ ...registerForm, adminName: e.target.value })}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
              />
              <input
                type="text"
                placeholder="Username"
                required
                value={registerForm.adminUsername}
                onChange={e => setRegisterForm({ ...registerForm, adminUsername: e.target.value })}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
              />
              <input
                type="email"
                placeholder="Email (untuk login)"
                required
                value={registerForm.adminEmail}
                onChange={e => setRegisterForm({ ...registerForm, adminEmail: e.target.value })}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (minimal 6 karakter)"
                  required
                  minLength={6}
                  value={registerForm.adminPassword}
                  onChange={e => setRegisterForm({ ...registerForm, adminPassword: e.target.value })}
                  className="w-full px-4 py-3 pr-12 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-orange-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white font-semibold hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? t('loading') : t('register-church')}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setIsRegister(false)}
                className="text-orange-400 text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('back')} ke Login
              </button>
            </div>
          </>
        )}

        {/* Language Selector */}
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setLanguage('id')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              language === 'id'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-[#2a2a2a]'
            }`}
          >
            Bahasa Indonesia
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              language === 'en'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-[#2a2a2a]'
            }`}
          >
            English
          </button>
        </div>
      </div>
    </div>
  );
}

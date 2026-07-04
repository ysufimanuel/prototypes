import { useState } from 'react';
import { Church, Eye, EyeOff, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LoginProps {
  onLogin: (username: string, password: string) => boolean;
  lang: 'id' | 'en';
  toggleLang: () => void;
}

export function Login({ onLogin, lang, toggleLang }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError(lang === 'id' ? 'Username dan password wajib diisi' : 'Username and password are required');
      return;
    }
    const success = onLogin(username, password);
    if (!success) {
      setError(lang === 'id' ? 'Username atau password salah' : 'Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#121212] to-[#1a0a00] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Church className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            {lang === 'id' ? 'Sistem Manajemen Gereja' : 'Church Management System'}
          </h1>
          <p className="text-gray-400 text-sm">
            {lang === 'id' ? 'Kelola jemaat dengan mudah' : 'Manage your church with ease'}
          </p>
        </div>

        <div className="bg-[#1e1e1e]/80 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white text-center mb-6">
            {lang === 'id' ? 'Masuk ke Akun Anda' : 'Sign In to Your Account'}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {lang === 'id' ? 'Username' : 'Username'}
              </label>
              <Input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={lang === 'id' ? 'Masukkan username' : 'Enter username'}
                className="bg-[#2a2a2a] border-white/10 text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {lang === 'id' ? 'Password' : 'Password'}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={lang === 'id' ? 'Masukkan password' : 'Enter password'}
                  className="bg-[#2a2a2a] border-white/10 text-white placeholder:text-gray-500 pr-10 focus:border-orange-500 focus:ring-orange-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium py-5 shadow-lg shadow-orange-500/20"
            >
              {lang === 'id' ? 'Masuk' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-gray-500 text-xs">
              {lang === 'id' ? 'Demo: username: admin | password: admin123' : 'Demo: username: admin | password: admin123'}
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={toggleLang}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-orange-400 transition-colors"
          >
            <Globe className="w-4 h-4" />
            {lang === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}
          </button>
        </div>
      </div>
    </div>
  );
}

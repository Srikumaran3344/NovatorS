'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'
import { Menu, X, ChevronDown } from 'lucide-react'

export default function Navbar() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(data)
    }
    getProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      getProfile()
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    router.push('/')
    router.refresh()
  }

  const navLinks = [
    { href: '/', label: 'Registry' },
    { href: '/archived', label: 'Archived' },
    ...(profile ? [{ href: '/dashboard', label: 'My Projects' }] : []),
    ...(profile?.role === 'approver' || profile?.role === 'admin'
      ? [{ href: '/approvals', label: 'Approvals' }]
      : []),
    ...((profile?.role === 'approver' && (profile as any)?.approver_type === 'CO')
      ? [{ href: '/manage', label: 'Manage' }]
      : []),
    ...(profile?.role === 'admin'
      ? [{ href: '/admin', label: 'Admin' }]
      : []),
  ]

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-gray-900">
          <img src="/myLogo.png" alt="Logo" className="w-8 h-8 rounded-lg flex items-center justify-center object-contain"/>
            <span className="text-sm">SAF Project Registry</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-3">
            {profile ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: 'var(--olive)' }}>
                    {profile.full_name?.[0] || profile.email[0].toUpperCase()}
                  </div>
                  <span className="max-w-[120px] truncate">{profile.full_name || profile.email}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs text-gray-500">{profile.rank} {profile.company}</p>
                      <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
                    </div>
                    <Link href="/profile" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setUserMenuOpen(false)}>
                      Edit Profile
                    </Link>
                    <button onClick={handleSignOut} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5">
                  Sign in
                </Link>
                <Link href="/auth/register" className="btn-primary text-sm px-3 py-1.5">
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white py-2 px-4">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
              className="block py-2 text-sm text-gray-700 hover:text-gray-900">
              {link.label}
            </Link>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-100">
            {profile ? (
              <button onClick={handleSignOut} className="block py-2 text-sm text-red-600">Sign out</button>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700">Sign in</Link>
                <Link href="/auth/register" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700">Register</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
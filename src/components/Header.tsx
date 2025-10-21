'use client';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full p-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm fixed top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold tracking-tight text-white">
          SENTINEL <span className="text-sky-500">PRO</span>
        </Link>
        <ConnectButton />
      </div>
    </header>
  );
}
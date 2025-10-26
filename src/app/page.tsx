import ThreeScene from "../components/3d-scene"; // Usando caminho relativo
import Link from "next/link";

export default function Home() {
  return (
    // O -mt-20 compensa o padding que adicionamos no layout para o Header fixo
    <div className="relative w-full h-screen flex items-center justify-center text-center -mt-20">
      <ThreeScene />

      <div className="relative z-10 p-8 flex flex-col items-center">
        <h1
          className="text-6xl md:text-8xl font-black tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400"
          style={{ textShadow: "0 0 30px rgba(14, 165, 233, 0.5)" }}
        >
          Sentinel Pro
        </h1>
        <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-2xl">
          Visualize e acompanhe seu portfólio de ativos on-chain em tempo real.
          Simples, rápido e seguro.
        </p>
        <Link
          href="/dashboard"
          className="mt-12 inline-block bg-sky-500 hover:bg-sky-600 text-white font-bold text-lg py-3 px-8 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/50"
        >
          Ver meu Portfólio
        </Link>
      </div>
    </div>
  );
}

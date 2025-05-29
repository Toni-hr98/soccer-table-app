'use client'

import { useEffect, useState } from 'react'

interface Particle {
  id: number
  left: string
  animationDelay: string
  animationDuration: string
  size: number
  opacity: number
}

const ParticlesBackground = () => {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    // Create particles with CSS animation properties
    const newParticles: Particle[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 20}s`,
      animationDuration: `${20 + Math.random() * 10}s`,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.3 + 0.1
    }))
    setParticles(newParticles)
  }, [])

  return (
    <>
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 2 }}>
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-white animate-float-up"
            style={{
              left: particle.left,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity,
              animationDelay: particle.animationDelay,
              animationDuration: particle.animationDuration
            }}
          />
        ))}
      </div>
      
      <style jsx global>{`
        @keyframes float-up {
          0% {
            transform: translateY(100vh) translateX(0px);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100px) translateX(${Math.random() > 0.5 ? '' : '-'}${20 + Math.random() * 40}px);
            opacity: 0;
          }
        }
        
        .animate-float-up {
          animation: float-up linear infinite;
        }
        
        /* Add some subtle pulsing to make it more alive */
        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 0.1;
          }
          50% {
            opacity: 0.4;
          }
        }
        
        .particle:nth-child(3n) {
          animation: float-up linear infinite, pulse-subtle 4s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}

export default ParticlesBackground 
'use client'

import { useCallback, useEffect, useState } from 'react'
import Particles from 'react-tsparticles'
import { loadBasic } from 'tsparticles-basic'
import type { Engine } from 'tsparticles-engine'

const ParticlesBackground = () => {
  const [particlesConfig, setParticlesConfig] = useState<any>(null)

  useEffect(() => {
    // Load the particles config
    fetch('/particlesjs-config.json')
      .then(response => response.json())
      .then(config => setParticlesConfig(config))
      .catch(error => console.error('Error loading particles config:', error))
  }, [])

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadBasic(engine)
  }, [])

  const particlesLoaded = useCallback(async (container: any) => {
    // Optional callback for when particles are loaded
  }, [])

  if (!particlesConfig) {
    return null // Don't render anything until config is loaded
  }

  return (
    <Particles
      id="tsparticles"
      init={particlesInit}
      loaded={particlesLoaded}
      options={particlesConfig}
            style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none'
      }}
    />
  )
}

export default ParticlesBackground 
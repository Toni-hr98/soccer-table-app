'use client'

import { memo, useState, useEffect } from 'react'
import Lottie from 'lottie-react'

interface FireAnimationProps {
  size?: 'small' | 'medium' | 'large' | 'custom'
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
}

const FireAnimation = memo(({ 
  size = 'medium', 
  width,
  height,
  className = '', 
  style = {} 
}: FireAnimationProps) => {
  const [animationData, setAnimationData] = useState(null)

  useEffect(() => {
    fetch('/fire-animation.json')
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(error => console.error('Error loading fire animation:', error))
  }, [])

  const getSizeClasses = () => {
    if (size === 'custom') return ''
    
    switch (size) {
      case 'small':
        return 'w-6 h-6'
      case 'medium':
        return 'w-12 h-12'
      case 'large':
        return 'w-20 h-20'
      default:
        return 'w-12 h-12'
    }
  }

  const getCustomStyle = () => {
    if (size === 'custom' && width && height) {
      return {
        width: `${width}px`,
        height: `${height}px`,
        transform: 'translate(-24%, -40%)',
        ...style
      }
    }
    return style
  }

  if (!animationData) {
    return (
      <div 
        className={`${getSizeClasses()} ${className} flex items-center justify-center`} 
        style={getCustomStyle()}
      >
        <span className="text-orange-500">🔥</span>
      </div>
    )
  }

  return (
    <div className={`${getSizeClasses()} ${className}`} style={getCustomStyle()}>
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  )
})

FireAnimation.displayName = 'FireAnimation'

export default FireAnimation 
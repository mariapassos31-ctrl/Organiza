import React from 'react'

export const Card = ({ children, className = '', onClick = null }) => {
  return (
    <div
      className={`bg-white rounded-lg shadow-md p-4 md:p-6 hover:shadow-lg transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}